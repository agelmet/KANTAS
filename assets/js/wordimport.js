/* Word (.docx) → άρθρα. Χρησιμοποιείται από το admin (στον browser) και από το build (node).
   Μορφή που διαβάζει (όπως τη στέλνει ο πελάτης):
     ΑΡΘΡΟ 3 / ΒΟΙΩΤΙΑ
     ΤΙΤΛΟΣ            (προαιρετικό)
     <τίτλος, υπότιτλος…>
     ΚΕΙΜΕΝΟ
     <παράγραφοι…>
   Χωρίς καμία εξωτερική βιβλιοθήκη: το .docx είναι zip, το ανοίγουμε με DecompressionStream. */

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const dec = (s) => s.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, (m, e) =>
  e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e]);

async function inflateRaw(bytes) {
  const ds = new DecompressionStream("deflate-raw");
  const out = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/* Βρίσκει ένα αρχείο μέσα στο zip (central directory) */
async function unzipEntry(buf, name) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf);
  let e = u8.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error("Δεν είναι αρχείο Word (.docx)");
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
  const td = new TextDecoder();
  for (let i = 0; i < n; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const fl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
    const off = dv.getUint32(p + 42, true);
    const fname = td.decode(u8.subarray(p + 46, p + 46 + fl));
    if (fname === name) {
      const lfl = dv.getUint16(off + 26, true), lxl = dv.getUint16(off + 28, true);
      const data = u8.subarray(off + 30 + lfl + lxl, off + 30 + lfl + lxl + csize);
      return method === 0 ? data : await inflateRaw(data);
    }
    p += 46 + fl + xl + cl;
  }
  throw new Error("Δεν βρέθηκε το κείμενο μέσα στο Word");
}

/* Παράγραφοι του Word: [{t: κείμενο, b: όλη έντονη}] */
export async function readDocx(arrayBuffer) {
  let xml = new TextDecoder().decode(await unzipEntry(arrayBuffer, "word/document.xml"));
  xml = xml.replace(/<mc:Fallback>[\s\S]*?<\/mc:Fallback>/g, "");
  const re = /<w:p[\s>]|<\/w:p>|<w:r(?:\s[^>]*)?>|<\/w:r>|<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:t\/>|<w:tab\/>|<w:br\/>|<w:cr\/>|<w:b(\s[^>]*)?\/>/g;
  const out = []; const stack = []; let runBold = false, m;
  while ((m = re.exec(xml))) {
    const tok = m[0];
    if (tok.startsWith("<w:p")) stack.push({ t: "", bold: 0, all: 0 });
    else if (tok === "</w:p>") {
      const p = stack.pop(); if (!p) continue;
      const t = p.t.replace(/\ufeff/g, "").replace(/\u00a0/g, " ").replace(/[ ]{2,}/g, " ").trim();
      out.push({ t, b: p.all > 0 && p.bold >= p.all * 0.8 });
    } else if (tok.startsWith("<w:r") && !tok.startsWith("<w:rPr")) runBold = false;
    else if (tok === "</w:r>") runBold = false;
    else if (tok.startsWith("<w:b")) runBold = !/w:val="(0|false|off)"/.test(m[2] || "");
    else if (tok === "<w:tab/>") { if (stack.length) stack[stack.length - 1].t += "\t"; }
    else if (tok === "<w:br/>" || tok === "<w:cr/>") { if (stack.length) stack[stack.length - 1].t += " "; }
    else if (m[1] !== undefined) {
      const p = stack[stack.length - 1]; if (!p) continue;
      const s = dec(m[1]); p.t += s; const n = s.trim().length; p.all += n; if (runBold) p.bold += n;
    }
  }
  return out;
}

const plain = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

/* Ετικέτα «ΒΟΙΩΤΙΑ», «ΑΘΛΗΤΙΚΑ ΠΟΔΟΣΦΑΙΡΟ ΦΩΚΙΔΑ»… → ενότητα / υποενότητα */
export function mapLabel(label) {
  const L = plain(label || "");
  const sport = /ΑΘΛΗΤ|ΠΟΔΟΣΦ|ΜΠΑΣΚ|ΣΠΟΡ|ΒΟΛΕΪ|ΒΟΛΕΙ/.test(L);
  if (sport) return { cat: "athlitismos", sub: /ΠΟΔΟΣΦ/.test(L) ? "podosfairo" : /ΜΠΑΣΚ/.test(L) ? "basket" : "alla" };
  const reg = [["ΒΟΙΩΤ", "boiotia"], ["ΕΥΒΟ", "evoia"], ["ΦΘΙΩΤ", "fthiotida"], ["ΦΩΚΙΔ", "fokida"], ["ΕΥΡΥΤΑΝ", "evrytania"]];
  for (const [k, s] of reg) if (L.includes(k)) return { cat: "sterea", sub: s };
  if (/ΣΤΕΡΕ/.test(L)) return { cat: "sterea", sub: "" };
  if (/ΚΟΣΜ|ΔΙΕΘΝ/.test(L)) return { cat: "kosmos", sub: "" };
  if (/ΥΓΕΙ/.test(L)) return { cat: "ygeia", sub: "" };
  if (/ΑΡΘΡ|ΑΠΟΨ|ΓΝΩΜ|ΣΧΟΛΙ/.test(L)) return { cat: "arthra", sub: "" };
  return { cat: "ellada", sub: "" };
}

/* Χωρίζει τις παραγράφους σε άρθρα */
export function splitArticles(paras) {
  const arts = []; let cur = null; const seen = new Set(), seenP = new Set();
  for (const { t, b } of paras) {
    const m = t.match(/^ΑΡΘΡΟ\s*(\d+)\s*[\/–-]\s*(.+)$/i);
    if (m) {
      const n = +m[1];
      if (seen.has(n)) { cur = null; continue; }
      seen.add(n); cur = { n, label: m[2].trim(), head: [], body: [], mode: "head" }; arts.push(cur); continue;
    }
    if (!cur || !t) continue;
    if (/^ΤΙΤΛΟΣ:?$/i.test(t)) continue;
    if (/^ΚΕΙΜΕΝΟ:?$/i.test(t)) { cur.mode = "body"; continue; }
    if (cur.mode === "body") { if (t.length > 80 && seenP.has(t)) continue; seenP.add(t); }
    cur[cur.mode].push({ t, b });
  }
  return arts;
}

const lowerStart = (s) => /^[«"“(]?[a-zα-ωάέήίόύώϊϋΐΰ]/.test(s);
const DAYS = /^(Δευτέρα|Τρίτη|Τετάρτη|Πέμπτη|Παρασκευή|Σάββατο|Κυριακή)(?![Α-Ωα-ωά-ώΆ-Ώ])/;
const isRow = (t) => t.includes("\t") || /^(Ρεπό|ΡΕΠΟ)\s*:/.test(t) ||
  (t.length < 90 && !/[.!?;…,]$/.test(t) && !/^[«"“]/.test(t) && /^[^\s].{1,45}\s[–-]\s[^\s].{1,45}$/.test(t) && !DAYS.test(t) && !lowerStart(t));
const isShort = (t) => t.length < 78 && !/[.…;]$/.test(t);
const fixQuotes = (s) => s.replace(/\\(\s|$)/g, "$1").replace(/\s+/g, " ").trim();

/* Από ένα άρθρο του Word φτιάχνει {kicker,title,lead,body,author,cat,sub} — body σε απλή μορφή:
   παράγραφοι χωρισμένες με κενή γραμμή, «## » ενδιάμεσος τίτλος, «| α | β» γραμμή πίνακα. */
export function toArticle(raw) {
  const head = raw.head.map((h) => fixQuotes(h.t)).filter(Boolean);
  let kicker = "", title = "", lead = "";
  let i = 0;
  if (head.length > 1 && (/:$/.test(head[0]) || (head[0] === plain(head[0]) && head[0].length < 30) ||
      (head[0].split(" ").length <= 3 && head[0].length < 28 && !lowerStart(head[1])))) {
    kicker = head[0].replace(/:$/, ""); i = 1;
  }
  title = head[i] || ""; i++;
  const FN = /^(τη|την|το|τον|του|της|τους|τις|των|τα|τo|για|στη|στην|στο|στον|στα|στις|στους|με|από|και|που|σε|ως|έως|μετά|προς)\s/;
  let lastPart = title;
  while (i < head.length && ((lowerStart(head[i]) && (FN.test(head[i]) || lastPart.length < 30)) || (title.length < 26 && head[i].length < 50))) {
    const sep = /[:;,–-]$/.test(title) || lowerStart(head[i]) ? " " : ": ";
    title += sep + head[i]; lastPart = head[i]; i++;
  }
  lead = head.slice(i).join(" ");
  if (lead && lowerStart(lead)) lead = lead[0].toUpperCase() + lead.slice(1);

  let lines = raw.body.map((b) => b.t.replace(/\r/g, "")).filter((t) => t.trim());
  const norm = (s) => s.replace(/\s+/g, " ").trim();
  while (lines.length && (norm(lines[0]) === norm(title) || (lead && norm(lines[0]) === norm(lead)) ||
         norm(lines[0]) === norm(head.join(" ")))) lines.shift();
  // συντάκτης στο τέλος (π.χ. «Ντάρδη Βασιλική»)
  let author = "";
  const last = lines[lines.length - 1];
  if (last && last.length <= 40 && !/[.!?:;»\t0-9–-]/.test(last) && last.trim().split(/\s+/).length <= 4 && lines.length > 2) {
    author = norm(last).replace(/(^|\s)(\S)/g, (m, s, c) => s + c.toUpperCase()); lines.pop();
  }
  const blocks = []; let group = [];
  const flush = () => {
    if (!group.length) return;
    const j = fixQuotes(group.join(" "));
    if (group.length === 1 && /\S:\s\S/.test(j) && !/:$/.test(j)) blocks.push(j);
    else blocks.push(j.length <= 170 ? "## " + j : j);
    group = [];
  };
  for (const l of lines) {
    const t = l.trim();
    if (isRow(t)) {
      flush();
      const cells = t.split("\t").map((c) => c.trim()).filter(Boolean);
      blocks.push("| " + cells.join(" | "));
      continue;
    }
    if (isShort(t) && !DAYS.test(t)) { group.push(t); if (/[!?]$/.test(t)) flush(); continue; }
    if (DAYS.test(t) && t.length < 60) { flush(); blocks.push("## " + norm(t)); continue; }
    flush(); blocks.push(norm(t));
  }
  flush();
  if (!lead && blocks[0] && blocks[0].startsWith("## ") && blocks[1] && !blocks[1].startsWith("## ") && !blocks[1].startsWith("|")) {
    lead = blocks.shift().slice(3);
  }
  // πίνακες: κολλάμε τις γραμμές μεταξύ τους (μία νέα γραμμή), τα υπόλοιπα με κενή γραμμή
  let body = "";
  blocks.forEach((b, k) => {
    if (k) body += b.startsWith("|") && blocks[k - 1].startsWith("|") ? "\n" : "\n\n";
    body += b;
  });
  const { cat, sub } = mapLabel(raw.label);
  return { n: raw.n, label: raw.label, kicker, title, lead, body, author, cat, sub };
}

export async function importDocx(arrayBuffer) {
  const paras = await readDocx(arrayBuffer);
  return splitArticles(paras).map(toArticle);
}

/* «ΑΡ. 7.jpg», «αρ 12.png», «7.jpeg», «arthro7.jpg» → 7 */
export function photoNumber(name) {
  const m = String(name).replace(/\.[a-z0-9]+$/i, "").match(/(\d+)/);
  return m ? +m[1] : null;
}
