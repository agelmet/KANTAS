/* Κοινός κώδικας εμφάνισης — τρέχει ίδιος στον browser (προσχέδιο), στο build (node) και στον server (Netlify Function).
   state = { settings, ads, articles: [meta…] }   ctx = { mode: "live" | "draft", base: "/" | "" , now: Date } */

export const CATS = [
  { k: "ellada", t: "Ελλάδα", c: "#1F4E9C" },
  { k: "sterea", t: "Στερεά Ελλάδα", c: "#0D7A5F", subs: [["boiotia", "Βοιωτία"], ["evoia", "Εύβοια"], ["fthiotida", "Φθιώτιδα"], ["fokida", "Φωκίδα"], ["evrytania", "Ευρυτανία"]] },
  { k: "arthra", t: "Άρθρα", c: "#9A5B13" },
  { k: "athlitismos", t: "Αθλητισμός", c: "#D2401E", subs: [["podosfairo", "Ποδόσφαιρο"], ["basket", "Μπάσκετ"], ["alla", "Άλλα σπορ"]] },
  { k: "kosmos", t: "Κόσμος", c: "#5A3E9E" },
  { k: "ygeia", t: "Υγεία", c: "#0F8B8D" },
];
export const catOf = (k) => CATS.find((c) => c.k === k) || CATS[0];
export const subName = (k, s) => { const c = catOf(k); const x = (c.subs || []).find((y) => y[0] === s); return x ? x[1] : ""; };

export const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const GR = { α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o" };
export function slugify(t) {
  let s = String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  s = s.replace(/ου/g, "ou").replace(/αι/g, "ai").replace(/ει/g, "ei").replace(/οι/g, "oi").replace(/μπ/g, "b").replace(/ντ/g, "nt").replace(/γκ/g, "gk");
  s = s.replace(/[α-ως]/g, (c) => GR[c] || "");
  s = s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (s.length > 70) s = s.slice(0, 70).replace(/-[^-]*$/, "");
  return s || "arthro";
}

const TZ = "Europe/Athens";
const pad = (n) => String(n).padStart(2, "0");
function parts(iso) {
  const d = new Date(iso);
  const f = new Intl.DateTimeFormat("el-GR", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const o = {}; f.forEach((p) => (o[p.type] = p.value)); return o;
}
export function fmtDate(iso, style = "full") {
  if (!iso) return "";
  const d = new Date(iso);
  if (style === "time") { const p = parts(iso); return p.hour + ":" + p.minute; }
  if (style === "short") { const p = parts(iso); return p.day + "/" + p.month + "/" + p.year + " · " + p.hour + ":" + p.minute; }
  if (style === "day") return new Intl.DateTimeFormat("el-GR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d);
  return new Intl.DateTimeFormat("el-GR", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" }).format(d) + ", " + fmtDate(iso, "time");
}
export function ago(iso, now) {
  const m = Math.round((now - new Date(iso)) / 60000);
  if (m < 1) return "μόλις τώρα";
  if (m < 60) return m + "′ πριν";
  const h = Math.floor(m / 60);
  if (h < 24) return h + (h === 1 ? " ώρα πριν" : " ώρες πριν");
  return fmtDate(iso, "short").split(" · ")[0];
}

/* Σύνδεσμοι: στο live «/arthro/<id>/<slug>», στο προσχέδιο «?a=<id>» */
export function links(ctx) {
  const live = ctx.mode === "live";
  return {
    home: live ? "/" : "./",
    cat: (k, s, page) => live ? "/kat/" + k + (s ? "/" + s : "") + (page > 1 ? "?page=" + page : "")
      : "?k=" + k + (s ? "&s=" + s : "") + (page > 1 ? "&page=" + page : ""),
    art: (m) => live ? "/arthro/" + m.id + "/" + (m.slug || slugify(m.title)) : "?a=" + m.id,
    search: (q) => (live ? "/anazitisi" : "./") + "?q=" + encodeURIComponent(q || ""),
    roi: (page) => live ? "/roi" + (page > 1 ? "?page=" + page : "") : "?k=roi" + (page > 1 ? "&page=" + page : ""),
    privacy: live ? "/privacy" : "privacy.html",
    asset: (p) => (p.startsWith("/") || /^https?:|^data:/.test(p)) ? p : (live ? "/" : "") + p,
  };
}

/* Φωτογραφία: {u, s:[480,960,…], w, h, cap, pos} — u χωρίς κατάληξη όταν υπάρχουν μεγέθη */
export function imgSrc(img, ctx, want = 960) {
  const L = links(ctx);
  if (!img || !img.u) return "";
  if (!img.s) return L.asset(img.u);
  const s = img.s.find((x) => x >= want) || img.s[img.s.length - 1];
  return L.asset(img.u + "-" + s + ".webp");
}
export function imgTag(img, ctx, { sizes = "(max-width:700px) 100vw, 640px", cls = "", eager = false, alt = "", want = 960 } = {}) {
  if (!img || !img.u) return "";
  const L = links(ctx);
  const set = img.s ? img.s.map((s) => L.asset(img.u + "-" + s + ".webp") + " " + s + "w").join(", ") : "";
  const st = img.pos ? ` style="object-position:${esc(img.pos)}"` : "";
  return `<img src="${esc(imgSrc(img, ctx, want))}"${set ? ` srcset="${esc(set)}" sizes="${sizes}"` : ""} width="${img.w || 1200}" height="${img.h || 800}" alt="${esc(alt)}"${cls ? ` class="${cls}"` : ""}${st} ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}

/* Εικονίδια για άρθρα χωρίς φωτογραφία */
const ICONS = {
  podosfairo: '<circle cx="32" cy="32" r="22"/><path d="M32 21l9 6.5-3.4 10.6H26.4L23 27.5z"/><path d="M32 10v11M54 28l-13 -.5M46 50l-8.4-11.9M18 50l8.4-11.9M10 28l13-.5"/>',
  basket: '<circle cx="32" cy="32" r="22"/><path d="M10 32h44M32 10v44M16.5 16.5c8 8 8 23 0 31M47.5 16.5c-8 8-8 23 0 31"/>',
  alla: '<path d="M20 12h24v10a12 12 0 0 1-24 0z"/><path d="M20 16h-7a7 7 0 0 0 9 11M44 16h7a7 7 0 0 1-9 11M32 34v10M24 52h16M27 44h10v8H27z"/>',
  def: '<rect x="12" y="14" width="40" height="36" rx="4"/><path d="M12 24h40M20 32h24M20 39h24M20 46h14"/>',
};
export function noImg(m, big = false) {
  const c = catOf(m.cat);
  const ic = ICONS[m.sub] || ICONS[m.cat === "athlitismos" ? "alla" : "def"];
  return `<span class="noimg${big ? " big" : ""}" style="--cc:${c.c}" aria-hidden="true"><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${ic}</svg><b>${esc(subName(m.cat, m.sub) || c.t)}</b></span>`;
}

/* Κείμενο άρθρου: παράγραφοι με κενή γραμμή, «## » ενδιάμεσος τίτλος, «| α | β» πίνακας, «- » λίστα, **έντονα**, [κείμενο](url) */
function inline(s) {
  let h = esc(s);
  h = h.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return h;
}
export function bodyHtml(md) {
  const blocks = String(md || "").replace(/\r/g, "").split(/\n{2,}/);
  let out = "";
  for (const b of blocks) {
    const t = b.trim(); if (!t) continue;
    const lines = t.split("\n");
    if (lines.every((l) => l.trim().startsWith("|"))) {
      const rows = lines.map((l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()));
      const cols = Math.max(...rows.map((r) => r.length));
      out += `<div class="tbl"><table>${rows.map((r) => "<tr>" + r.map((c, i) => `<td${cols > 1 && i === r.length - 1 && r.length > 1 ? ' class="r"' : ""}>${inline(c)}</td>`).join("") + "</tr>").join("")}</table></div>`;
    } else if (lines.every((l) => /^\s*[-•]\s/.test(l))) {
      out += "<ul>" + lines.map((l) => "<li>" + inline(l.replace(/^\s*[-•]\s/, "")) + "</li>").join("") + "</ul>";
    } else if (t.startsWith("## ")) out += "<h2>" + inline(t.slice(3)) + "</h2>";
    else if (t.startsWith("> ")) out += "<blockquote>" + inline(t.slice(2)) + "</blockquote>";
    else out += "<p>" + lines.map(inline).join("<br>") + "</p>";
  }
  return out;
}
export function excerpt(md, n = 170) {
  const p = String(md || "").split(/\n{2,}/).find((b) => b.trim() && !/^(##|\||-|>)/.test(b.trim())) || "";
  const t = p.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, "") + "…" : t;
}
export const readMins = (m) => Math.max(1, Math.round((m.words || 200) / 220));

/* ---------- επιλογές λίστας ---------- */
export function visible(state, now) {
  const t = +now;
  return (state.articles || []).filter((a) => !a.draft && new Date(a.date) <= t + 60000).sort((a, b) => new Date(b.date) - new Date(a.date));
}
export const inCat = (a, k, s) => (a.cat === k && (!s || a.sub === s)) || (!s && (a.also || []).includes(k));
export function activeAds(state, slot, now) {
  const day = new Date(now).toISOString().slice(0, 10);
  return (state.ads || []).filter((a) => a.on !== false && a.img && a.img.u && (a.slot || "side") === slot &&
    (!a.from || a.from <= day) && (!a.to || a.to >= day));
}

/* ---------- κομμάτια ---------- */
function kickerHtml(m, ctx, withCat = true) {
  const L = links(ctx), c = catOf(m.cat);
  const lab = subName(m.cat, m.sub) || c.t;
  return `<span class="kick" style="--cc:${c.c}">${withCat ? `<a href="${L.cat(m.cat, subName(m.cat, m.sub) ? m.sub : "")}">${esc(lab)}</a>` : ""}${m.kicker ? `<em>${esc(m.kicker)}</em>` : ""}</span>`;
}
function media(m, ctx, opts = {}) {
  return `<span class="med${opts.cls ? " " + opts.cls : ""}">${m.img && m.img.u ? imgTag(m.img, ctx, { alt: m.title, ...opts }) : noImg(m, opts.big)}</span>`;
}
export function card(m, ctx, v = "std", opts = {}) {
  const L = links(ctx);
  const ex = m.lead || m.ex || "";
  if (v === "row") return `<article class="c c-row"><a class="ov" href="${L.art(m)}" aria-label="${esc(m.title)}"></a>${media(m, ctx, { sizes: "120px", want: 480 })}<div class="ct">${kickerHtml(m, ctx)}<h3>${esc(m.title)}</h3><time datetime="${m.date}">${ago(m.date, ctx.now)}</time></div></article>`;
  if (v === "text") return `<article class="c c-text"><a class="ov" href="${L.art(m)}" aria-label="${esc(m.title)}"></a>${kickerHtml(m, ctx)}<h3>${esc(m.title)}</h3><time datetime="${m.date}">${ago(m.date, ctx.now)}</time></article>`;
  if (v === "big") return `<article class="c c-big"><a class="ov" href="${L.art(m)}" aria-label="${esc(m.title)}"></a>${media(m, ctx, { sizes: "(max-width:900px) 100vw, 640px", want: 960, eager: opts.eager, big: true })}<div class="ct">${kickerHtml(m, ctx)}<h3>${esc(m.title)}</h3>${ex ? `<p>${esc(ex)}</p>` : ""}<time datetime="${m.date}">${ago(m.date, ctx.now)}</time></div></article>`;
  return `<article class="c c-std"><a class="ov" href="${L.art(m)}" aria-label="${esc(m.title)}"></a>${media(m, ctx, { sizes: "(max-width:700px) 100vw, 320px", want: 480 })}<div class="ct">${kickerHtml(m, ctx)}<h3>${esc(m.title)}</h3>${opts.ex && ex ? `<p>${esc(ex)}</p>` : ""}<time datetime="${m.date}">${ago(m.date, ctx.now)}</time></div></article>`;
}
export function adHtml(a, ctx, cls = "") {
  const L = links(ctx);
  const img = `<img src="${esc(L.asset(a.img.u))}" width="${a.img.w || 600}" height="${a.img.h || 340}" alt="${esc(a.name || "Διαφήμιση")}" loading="lazy" decoding="async">`;
  return `<div class="ad ${cls}"><span class="adl">Διαφήμιση</span>${a.link ? `<a href="${esc(a.link)}" target="${/^tel:|^mailto:/.test(a.link) ? "_self" : "_blank"}" rel="sponsored noopener">${img}</a>` : img}</div>`;
}

export function headerHtml(state, ctx, active = "") {
  const L = links(ctx), st = state.settings || {};
  const list = visible(state, ctx.now).slice(0, 8);
  const tick = list.map((m) => `<a href="${L.art(m)}"><b>${fmtDate(m.date, "time")}</b>${esc(m.title)}</a>`).join("");
  const navs = CATS.map((c) => `<li class="${c.subs ? "has" : ""}${active === c.k ? " on" : ""}" style="--cc:${c.c}"><a href="${L.cat(c.k)}">${esc(c.t)}</a>${c.subs ? `<ul>${c.subs.map(([s, n]) => `<li><a href="${L.cat(c.k, s)}">${esc(n)}</a></li>`).join("")}</ul>` : ""}</li>`).join("");
  const soc = socials(st);
  return `<div class="topbar"><div class="wrap"><span class="today" data-today>${fmtDate(ctx.now.toISOString(), "day")}</span>
${tick ? `<div class="tick" aria-label="Τελευταία νέα"><span class="tl">Τώρα</span><div class="tw"><div class="tr">${tick}${tick}</div></div></div>` : ""}
${soc ? `<div class="soc">${soc}</div>` : ""}</div></div>
<header class="mast"><div class="wrap">
<a class="logo" href="${L.home}" aria-label="${esc(st.name || "")} — αρχική">${logoHtml(st)}</a>
${st.tagline ? `<p class="tag">${esc(st.tagline)}</p>` : ""}
<div class="mtools"><button class="srch-b" type="button" data-search aria-label="Αναζήτηση"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><span>Αναζήτηση</span></button>
<button class="burger" type="button" aria-label="Μενού" aria-expanded="false" data-burger><span></span><span></span><span></span></button></div>
</div></header>
<nav class="nav" aria-label="Ενότητες"><div class="wrap"><ul><li class="h${active === "home" ? " on" : ""}"><a href="${L.home}" aria-label="Αρχική"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9H3z"/></svg></a></li>${navs}<li class="roi${active === "roi" ? " on" : ""}"><a href="${L.roi()}">Ροή ειδήσεων</a></li></ul></div></nav>
<div class="srch" hidden data-srchbox><form class="wrap" action="${ctx.mode === "live" ? "/anazitisi" : "./"}" method="get" role="search"><input type="search" name="q" placeholder="Αναζήτηση ειδήσεων…" aria-label="Αναζήτηση" autocomplete="off"><button type="submit">Αναζήτηση</button><button type="button" class="x" data-search-close aria-label="Κλείσιμο">✕</button></form></div>
<div class="mnav" hidden data-mnav><div class="mn-in"><button type="button" class="x" data-mnav-close aria-label="Κλείσιμο μενού">✕</button>
<a class="mn-h" href="${L.home}">Αρχική</a>${CATS.map((c) => `<div class="mn-c" style="--cc:${c.c}"><a href="${L.cat(c.k)}">${esc(c.t)}</a>${c.subs ? `<div class="mn-s">${c.subs.map(([s, n]) => `<a href="${L.cat(c.k, s)}">${esc(n)}</a>`).join("")}</div>` : ""}</div>`).join("")}<a class="mn-h" href="${L.roi()}">Ροή ειδήσεων</a>${soc ? `<div class="soc">${soc}</div>` : ""}</div></div>`;
}
export function logoHtml(st) {
  const name = (st.name || "Στερεά Σήμερα").trim();
  const parts = name.split(/\s+/);
  const a = parts.length > 1 ? parts.slice(0, -1).join(" ") : name, b = parts.length > 1 ? parts[parts.length - 1] : "";
  return `<span class="lg-m" aria-hidden="true"><svg viewBox="0 0 40 40"><rect width="40" height="40" rx="9" fill="#C8102E"/><path d="M29 12H11l9 8-9 8h18" fill="none" stroke="#fff" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round"/></svg></span><span class="lg-t"><span class="lg-a">${esc(a)}</span>${b ? `<span class="lg-b">${esc(b)}</span>` : ""}</span>`;
}
function socials(st) {
  const S = [["facebook", "Facebook", '<path d="M14 8h3V4h-3c-2.8 0-4 1.8-4 4.3V10H7v4h3v8h4v-8h3l1-4h-4V8.6c0-.4.3-.6.6-.6z"/>'],
    ["instagram", "Instagram", '<rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.2" cy="6.8" r="1.2"/>'],
    ["youtube", "YouTube", '<path d="M21.6 7.2a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.6 2.6 0 0 0 2.4 7.2 27 27 0 0 0 2 12a27 27 0 0 0 .4 4.8 2.6 2.6 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.6 2.6 0 0 0 1.8-1.8A27 27 0 0 0 22 12a27 27 0 0 0-.4-4.8zM10 15V9l5.2 3z"/>'],
    ["tiktok", "TikTok", '<path d="M16 3c.4 2.5 2 4 4.5 4.2v3.3c-1.7 0-3.2-.5-4.5-1.4v6.6A5.8 5.8 0 1 1 10.2 9.9v3.4a2.5 2.5 0 1 0 2.5 2.5V3z"/>']];
  return S.filter(([k]) => st[k]).map(([k, n, p]) => `<a href="${esc(st[k])}" target="_blank" rel="noopener" aria-label="${n}"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">${p}</svg></a>`).join("");
}
export function footerHtml(state, ctx) {
  const L = links(ctx), st = state.settings || {};
  const contact = [st.email && `<a href="mailto:${esc(st.email)}">${esc(st.email)}</a>`, st.phone && `<a href="tel:${esc(st.phone.replace(/\s/g, ""))}">${esc(st.phone)}</a>`].filter(Boolean).join(" · ");
  return `<footer class="foot"><div class="wrap fg">
<div class="f1"><a class="logo inv" href="${L.home}">${logoHtml(st)}</a>${st.tagline ? `<p>${esc(st.tagline)}</p>` : ""}${socials(st) ? `<div class="soc">${socials(st)}</div>` : ""}</div>
${CATS.map((c) => `<div class="fc"><a class="fh" href="${L.cat(c.k)}" style="--cc:${c.c}">${esc(c.t)}</a>${(c.subs || []).map(([s, n]) => `<a href="${L.cat(c.k, s)}">${esc(n)}</a>`).join("")}</div>`).join("")}
</div><div class="wrap fbot">
<p>${contact ? "Επικοινωνία: " + contact : ""}${st.advertise ? ` · <a href="mailto:${esc(st.advertise)}">Διαφημιστείτε μαζί μας</a>` : ""}${st.mit ? ` · Αρ. Μητρώου Επιγραφικού Τύπου (ΜΗΤ): ${esc(st.mit)}` : ""}</p>
<p>© ${new Date(ctx.now).getFullYear()} ${esc(st.name || "")} · <a href="${L.privacy}">Απόρρητο &amp; cookies</a> · <a class="cred" href="https://advonmedia.com" target="_blank" rel="noopener">Designed by <b class="adv">Advon Media</b></a></p>
</div></footer>`;
}

export function sidebarHtml(state, ctx, { latest = true, exclude = "", sticky = false } = {}) {
  const L = links(ctx);
  const ads = activeAds(state, "side", ctx.now);
  const lt = latest ? visible(state, ctx.now).filter((m) => m.id !== exclude).slice(0, 6) : [];
  return `<aside class="side">${ads.length ? `<div class="ads">${ads.map((a) => adHtml(a, ctx)).join("")}</div>` : ""}
${lt.length ? `<section class="sl${sticky ? " stk" : ""}"><h2 class="sh"><span>Τελευταία</span></h2><ol>${lt.map((m) => `<li><a href="${L.art(m)}"><time>${fmtDate(m.date, "time")}</time><span>${esc(m.title)}</span></a></li>`).join("")}</ol><a class="more" href="${L.roi()}">Όλη η ροή →</a></section>` : ""}</aside>`;
}
/* διαφημίσεις μέσα στη ροή για κινητά (στην οθόνη υπολογιστή είναι στο πλάι) */
function inlineAd(ads, i, ctx) { if (!ads.length) return ""; return adHtml(ads[i % ads.length], ctx, "mob"); }

/* ---------- σελίδες ---------- */
export function homeHtml(state, ctx) {
  const L = links(ctx);
  const all = visible(state, ctx.now);
  if (!all.length) return `<div class="wrap empty"><p>Δεν υπάρχουν ακόμη άρθρα.</p></div>`;
  const feat = all.filter((a) => a.feat);
  const lead = feat[0] || all[0];
  const used = new Set([lead.id]);
  const sec = [...feat.slice(1), ...all].filter((a) => !used.has(a.id) && (used.add(a.id), true)).slice(0, 2);
  const roi = all.slice(0, 9);
  const sideAds = activeAds(state, "side", ctx.now), wide = activeAds(state, "wide", ctx.now);
  let blocks = "", ai = 1;
  const variants = { ellada: "a", sterea: "s", arthra: "op", athlitismos: "sp", kosmos: "b", ygeia: "a" };
  const shown = new Set([lead.id, ...sec.map((x) => x.id)]);
  CATS.forEach((c, i) => {
    let list = all.filter((a) => inCat(a, c.k) && !shown.has(a.id));
    if (!list.length) list = all.filter((a) => inCat(a, c.k));
    if (!list.length) return;
    blocks += sectionBlock(c, list, ctx, variants[c.k] || "a");
    if (wide.length && i % 2 === 1) blocks += `<div class="wide">${adHtml(wide[(i >> 1) % wide.length], ctx)}</div>`;
    else blocks += inlineAd(sideAds, ai++, ctx);
  });
  return `<div class="wrap grid"><div class="main">
<section class="hero" aria-label="Κεντρικά θέματα">
${card(lead, ctx, "big", { eager: true })}
<div class="hsec">${sec.map((m) => card(m, ctx, "std", { ex: true })).join("")}</div>
<div class="roi-h"><h2 class="sh"><span>Ροή ειδήσεων</span></h2><ol>${roi.map((m) => `<li style="--cc:${catOf(m.cat).c}"><a href="${L.art(m)}"><time>${fmtDate(m.date, "time")}</time><span><i>${esc(subName(m.cat, m.sub) || catOf(m.cat).t)}</i>${esc(m.title)}</span></a></li>`).join("")}</ol><a class="more" href="${L.roi()}">Όλες οι ειδήσεις →</a></div>
</section>
${inlineAd(sideAds, 0, ctx)}
${blocks}
</div>${sidebarHtml(state, ctx, { sticky: true })}</div>`;
}

function sectionBlock(c, list, ctx, v) {
  const L = links(ctx);
  const head = `<header class="bh"><h2><a href="${L.cat(c.k)}">${esc(c.t)}</a></h2>${c.subs ? `<nav class="chips" aria-label="${esc(c.t)}">${c.subs.map(([s, n]) => `<a href="${L.cat(c.k, s)}">${esc(n)}</a>`).join("")}</nav>` : ""}<a class="all" href="${L.cat(c.k)}">Όλα <span aria-hidden="true">→</span></a></header>`;
  let body = "";
  if (v !== "op" && list.length === 1) body = `<div class="b-one">${card(list[0], ctx, "big")}</div>`;
  else if (v !== "op" && list.length === 2) body = `<div class="b-two">${list.map((m) => card(m, ctx, "std", { ex: true })).join("")}</div>`;
  else if (v === "sp") body = `<div class="b-sp">${card(list[0], ctx, "big")}<div class="b-col">${list.slice(1, 4).map((m) => card(m, ctx, "row")).join("")}</div></div>`;
  else if (v === "op") body = `<div class="b-op">${list.slice(0, 3).map((m) => `<article class="c c-op"><a class="ov" href="${L.art(m)}" aria-label="${esc(m.title)}"></a><span class="q" aria-hidden="true">“</span><h3>${esc(m.title)}</h3>${m.author ? `<span class="by">${esc(m.author)}</span>` : ""}<time datetime="${m.date}">${ago(m.date, ctx.now)}</time></article>`).join("")}</div>`;
  else if (v === "b") body = `<div class="b-4">${list.slice(0, 4).map((m) => card(m, ctx, "std")).join("")}</div>`;
  else if (v === "s") body = `<div class="b-s">${card(list[0], ctx, "big")}<div class="b-2">${list.slice(1, 5).map((m) => card(m, ctx, "std")).join("")}</div></div>${list.length > 5 ? `<div class="b-txt">${list.slice(5, 9).map((m) => card(m, ctx, "text")).join("")}</div>` : ""}`;
  else body = `<div class="b-a">${card(list[0], ctx, "big")}<div class="b-col">${list.slice(1, 5).map((m) => card(m, ctx, "row")).join("")}</div></div>`;
  return `<section class="blk blk-${v}" style="--cc:${c.c}" aria-label="${esc(c.t)}">${head}${body}</section>`;
}

export function catHtml(state, ctx, k, s, page = 1) {
  const L = links(ctx), PER = 18;
  const all = visible(state, ctx.now);
  const roi = k === "roi";
  const c = roi ? { k: "roi", t: "Ροή ειδήσεων", c: "#C8102E" } : catOf(k);
  const list = roi ? all : all.filter((a) => inCat(a, k, s));
  const pages = Math.max(1, Math.ceil(list.length / PER));
  page = Math.min(Math.max(1, page | 0), pages);
  const items = list.slice((page - 1) * PER, page * PER);
  const title = s ? subName(k, s) : c.t;
  const chips = c.subs ? `<nav class="chips big" aria-label="Υποενότητες"><a href="${L.cat(k)}"${!s ? ' class="on"' : ""}>Όλα</a>${c.subs.map(([x, n]) => `<a href="${L.cat(k, x)}"${s === x ? ' class="on"' : ""}>${esc(n)}</a>`).join("")}</nav>` : "";
  const sideAds = activeAds(state, "side", ctx.now);
  let grid = "";
  if (!items.length) grid = `<p class="empty">Δεν υπάρχουν ακόμη άρθρα σε αυτή την ενότητα.</p>`;
  else {
    const first = page === 1 ? items[0] : null;
    const rest = first ? items.slice(1) : items;
    grid = (first ? `<div class="c-first">${card(first, ctx, "big", { eager: true })}</div>` : "") +
      `<div class="cgrid">${rest.map((m, i) => card(m, ctx, "std", { ex: true }) + (i === 5 && sideAds.length ? `<div class="cg-ad">${inlineAd(sideAds, 0, ctx)}</div>` : "")).join("")}</div>`;
  }
  const pg = pages > 1 ? `<nav class="pager" aria-label="Σελίδες">${page > 1 ? `<a href="${roi ? L.roi(page - 1) : L.cat(k, s, page - 1)}">← Νεότερα</a>` : "<span></span>"}<span>Σελίδα ${page} από ${pages}</span>${page < pages ? `<a href="${roi ? L.roi(page + 1) : L.cat(k, s, page + 1)}">Παλαιότερα →</a>` : "<span></span>"}</nav>` : "";
  return `<div class="wrap grid"><div class="main"><header class="ph" style="--cc:${c.c}"><nav class="crumbs" aria-label="Διαδρομή"><a href="${L.home}">Αρχική</a>${s ? ` <span>›</span> <a href="${L.cat(k)}">${esc(c.t)}</a>` : ""}</nav><h1>${esc(title)}</h1>${chips}</header>${grid}${pg}</div>${sidebarHtml(state, ctx)}</div>`;
}

export function articleHtml(state, ctx, m, body) {
  const L = links(ctx), c = catOf(m.cat), st = state.settings || {};
  const sn = subName(m.cat, m.sub);
  const all = visible(state, ctx.now);
  const rel = all.filter((a) => a.id !== m.id && a.cat === m.cat).slice(0, 4);
  const more = rel.length < 4 ? all.filter((a) => a.id !== m.id && !rel.includes(a)).slice(0, 4 - rel.length) : [];
  const url = (ctx.origin || "") + L.art(m);
  const share = `<div class="share" data-share data-url="${esc(url)}" data-title="${esc(m.title)}"><span>Κοινοποίηση</span>
<a class="fb" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank" rel="noopener" aria-label="Facebook"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M14 8h3V4h-3c-2.8 0-4 1.8-4 4.3V10H7v4h3v8h4v-8h3l1-4h-4V8.6c0-.4.3-.6.6-.6z"/></svg></a>
<a class="xx" href="https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(m.title)}" target="_blank" rel="noopener" aria-label="X"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8zM16.7 19.2h1.7L7.4 4.7H5.6z"/></svg></a>
<a class="vb" href="viber://forward?text=${encodeURIComponent(m.title + " " + url)}" aria-label="Viber"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2.2c-5 0-9 3.5-9 8.2 0 2.6 1.2 4.7 3.1 6.2V21l3.4-2c.8.2 1.6.3 2.5.3 5 0 9-3.5 9-8.2s-4-8.9-9-8.9zm3.9 11.6c-.3.6-1.2 1.1-1.8 1.1-.5 0-1.1-.1-2.7-.8a8.6 8.6 0 0 1-3.6-3.3c-.6-.9-.9-1.8-.9-2.6 0-1 .6-1.6 1-1.8.3-.2.6-.2.8-.2l.5.1c.2.4.7 1.6.8 1.7s.1.3 0 .5l-.5.7c-.1.2-.2.3 0 .6.4.8 1.6 2 2.6 2.4.3.1.5.1.6-.1l.7-.8c.2-.2.4-.2.6-.1l1.6.8c.3.1.4.3.4.5-.1.4-.1.9-.1 1.3z"/></svg></a>
<a class="wa" href="https://wa.me/?text=${encodeURIComponent(m.title + " " + url)}" target="_blank" rel="noopener" aria-label="WhatsApp"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.9 5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2s-1 .3-3.4-.7a11.7 11.7 0 0 1-4.6-4.1c-.4-.5-1.1-1.6-1.1-3s.7-2.1 1-2.4a1 1 0 0 1 .8-.4h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.1-.3.3-.1.6a8.9 8.9 0 0 0 1.6 2 8 8 0 0 0 2.3 1.4c.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.6-.1l2 1c.3.1.5.2.5.3a2.4 2.4 0 0 1-.2 1.3z"/></svg></a>
<button type="button" class="cp" data-copy aria-label="Αντιγραφή συνδέσμου"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg></button></div>`;
  const artAds = activeAds(state, "side", ctx.now);
  let bh = bodyHtml(body || "");
  // μία διαφήμιση στη μέση του κειμένου (κινητά)
  if (artAds.length) { const ps = bh.split("</p>"); if (ps.length > 5) { const at = Math.floor(ps.length / 2); ps[at] = ps[at] + "</p>" + inlineAd(artAds, (m.id.charCodeAt(m.id.length - 1) || 0), ctx); bh = ps.join("</p>").replace("</p></p>", "</p>"); } }
  const fig = m.img && m.img.u ? `<figure class="afig"><button type="button" class="zoom" data-zoom="${esc(imgSrc(m.img, ctx, 1600))}" aria-label="Μεγέθυνση φωτογραφίας">${imgTag(m.img, ctx, { eager: true, sizes: "(max-width:900px) 100vw, 820px", want: 1600, alt: m.img.alt || m.title })}</button>${m.img.cap ? `<figcaption>${esc(m.img.cap)}</figcaption>` : ""}</figure>` : "";
  return `<div class="wrap grid"><div class="main"><article class="art" style="--cc:${c.c}">
<nav class="crumbs" aria-label="Διαδρομή"><a href="${L.home}">Αρχική</a> <span>›</span> <a href="${L.cat(m.cat)}">${esc(c.t)}</a>${sn ? ` <span>›</span> <a href="${L.cat(m.cat, m.sub)}">${esc(sn)}</a>` : ""}</nav>
<header class="ah">${m.kicker ? `<p class="akick">${esc(m.kicker)}</p>` : ""}<h1>${esc(m.title)}</h1>${m.lead ? `<p class="alead">${esc(m.lead)}</p>` : ""}
<div class="ameta"><div class="mm">${m.author ? `<span class="by">${esc(m.author)}</span>` : `<span class="by">${esc(st.name || "")}</span>`}<time datetime="${m.date}">${fmtDate(m.date)}</time>${m.upd && m.upd > m.date ? `<span>Ενημέρωση: ${fmtDate(m.upd)}</span>` : ""}<span>${readMins(m)}′ ανάγνωση</span></div>${share}</div></header>
${fig}
<div class="abody">${bh}</div>
<footer class="afoot">${share}<a class="back" href="${L.cat(m.cat)}">Περισσότερα από ${esc(c.t)} →</a></footer>
</article>
${rel.length + more.length ? `<section class="rel"><h2 class="sh"><span>Διαβάστε ακόμη</span></h2><div class="b-4">${[...rel, ...more].map((x) => card(x, ctx, "std")).join("")}</div></section>` : ""}
</div>${sidebarHtml(state, ctx, { exclude: m.id })}</div>
<div class="lb" hidden data-lb><button type="button" class="x" aria-label="Κλείσιμο">✕</button><img alt=""></div>`;
}

export function searchHtml(state, ctx, q) {
  const n = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const words = n(q).split(/\s+/).filter((w) => w.length > 1);
  const res = words.length ? visible(state, ctx.now).filter((a) => { const h = n(a.title + " " + a.lead + " " + a.kicker + " " + (a.ex || "") + " " + (a.author || "")); return words.every((w) => h.includes(w)); }) : [];
  return `<div class="wrap grid"><div class="main"><header class="ph"><h1>Αναζήτηση</h1><form class="sform" action="${ctx.mode === "live" ? "/anazitisi" : "./"}" method="get" role="search"><input type="search" name="q" value="${esc(q)}" placeholder="Τι ψάχνετε;" aria-label="Αναζήτηση"><button>Αναζήτηση</button></form>${q ? `<p class="cnt">${res.length ? res.length + (res.length === 1 ? " αποτέλεσμα" : " αποτελέσματα") : "Δεν βρέθηκαν αποτελέσματα"} για «${esc(q)}»</p>` : ""}</header>
<div class="cgrid">${res.slice(0, 60).map((m) => card(m, ctx, "std", { ex: true })).join("")}</div></div>${sidebarHtml(state, ctx)}</div>`;
}

/* ---------- ολόκληρη σελίδα ---------- */
export function route(state, ctx, { k, s, a, q, page, body, notFound }) {
  const st = state.settings || {}, L = links(ctx);
  const site = st.name || "Στερεά Σήμερα";
  if (notFound) return { title: "Η σελίδα δεν βρέθηκε | " + site, desc: st.tagline || "", main: `<div class="wrap empty"><h1>Η σελίδα δεν βρέθηκε</h1><p><a href="${L.home}">Επιστροφή στην αρχική</a></p></div>`, active: "", status: 404 };
  if (a) {
    const m = (state.articles || []).find((x) => x.id === a);
    if (!m) return route(state, ctx, { notFound: true });
    return { title: m.title + " | " + site, desc: m.lead || m.ex || "", main: articleHtml(state, ctx, m, body), active: m.cat, art: m, path: L.art(m),
      image: m.img && m.img.u ? imgSrc(m.img, ctx, 1200) : "" };
  }
  if (q != null) return { title: "Αναζήτηση: " + q + " | " + site, desc: "", main: searchHtml(state, ctx, q), active: "", noindex: true, path: L.search(q) };
  if (k === "roi") return { title: "Ροή ειδήσεων | " + site, desc: "Όλες οι τελευταίες ειδήσεις από την Ελλάδα, τη Στερεά Ελλάδα, τον αθλητισμό και τον κόσμο.", main: catHtml(state, ctx, "roi", "", page), active: "roi", path: L.roi(page) };
  if (k) {
    if (!CATS.find((c) => c.k === k) || (s && !subName(k, s))) return route(state, ctx, { notFound: true });
    const c = catOf(k), t = s ? subName(k, s) : c.t;
    return { title: t + " — Ειδήσεις | " + site, desc: `Οι τελευταίες ειδήσεις για ${s ? "τη " + t : c.t === "Άρθρα" ? "τα άρθρα γνώμης" : t}: ${site}.`, main: catHtml(state, ctx, k, s, page), active: k, path: L.cat(k, s, page) };
  }
  return { title: site + " — " + (st.tagline || "Ειδήσεις"), desc: st.description || st.tagline || "", main: homeHtml(state, ctx), active: "home", path: L.home, home: true };
}

/* ---------- πλήρες έγγραφο (build + server) ---------- */
export function docHtml(state, ctx, r, { origin = "", data = "", v = "1" } = {}) {
  const st = state.settings || {}, L = links(ctx);
  const A = (p) => L.asset(p) + (/\.(css|js)$/.test(p) ? "?v=" + v : "");
  const live = ctx.mode === "live";
  const canon = live && origin && r.path ? origin + r.path : "";
  const site = st.name || "Στερεά Σήμερα";
  const img = r.image ? (r.image.startsWith("http") ? r.image : origin + r.image) : (origin ? origin + "/assets/og.jpg" : "");
  const ld = [];
  const org = { "@type": "NewsMediaOrganization", "@id": (origin || "") + "/#org", name: site, url: (origin || "") + "/", logo: { "@type": "ImageObject", url: (origin || "") + "/assets/icons/icon-512.png" } };
  const sameAs = ["facebook", "instagram", "youtube", "tiktok"].map((k) => st[k]).filter(Boolean); if (sameAs.length) org.sameAs = sameAs;
  if (r.art) {
    const m = r.art;
    ld.push({ "@type": "NewsArticle", headline: m.title.slice(0, 110), description: m.lead || m.ex || "", datePublished: m.date, dateModified: m.upd || m.date,
      articleSection: catOf(m.cat).t, image: img ? [img] : undefined, mainEntityOfPage: canon || undefined,
      author: m.author ? { "@type": "Person", name: m.author } : { "@id": (origin || "") + "/#org" }, publisher: { "@id": (origin || "") + "/#org" } });
    const bc = [{ n: "Αρχική", u: "/" }, { n: catOf(m.cat).t, u: "/kat/" + m.cat }];
    if (subName(m.cat, m.sub)) bc.push({ n: subName(m.cat, m.sub), u: "/kat/" + m.cat + "/" + m.sub });
    ld.push({ "@type": "BreadcrumbList", itemListElement: bc.map((b, i) => ({ "@type": "ListItem", position: i + 1, name: b.n, item: (origin || "") + b.u })) });
  }
  if (r.home) ld.push({ "@type": "WebSite", name: site, url: (origin || "") + "/", potentialAction: { "@type": "SearchAction", target: (origin || "") + "/anazitisi?q={q}", "query-input": "required name=q" } });
  ld.push(org);
  const jsonld = `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": ld }).replace(/</g, "\\u003c")}</script>`;
  return `<!DOCTYPE html>
<html lang="el" data-mode="${ctx.mode}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(r.title)}</title>
<meta name="description" content="${esc(r.desc || "")}">
<meta name="robots" content="${r.noindex || r.status === 404 ? "noindex,follow" : "index,follow,max-image-preview:large"}">
<script id="advon-draft-guard">(function(){var h=location.hostname;if(/(^|\\.)drafts\\.advonmedia\\.com$|\\.github\\.io$|\\.netlify\\.app$/.test(h)){var m=document.createElement('meta');m.name='robots';m.content='noindex,nofollow';document.head.appendChild(m);}})();</script>
${canon ? `<link rel="canonical" href="${esc(canon)}">` : ""}
<meta name="theme-color" content="#12161C">
<meta property="og:site_name" content="${esc(site)}">
<meta property="og:locale" content="el_GR">
<meta property="og:type" content="${r.art ? "article" : "website"}">
<meta property="og:title" content="${esc(r.art ? r.art.title : r.title)}">
<meta property="og:description" content="${esc(r.desc || "")}">
${canon ? `<meta property="og:url" content="${esc(canon)}">` : ""}
${img ? `<meta property="og:image" content="${esc(img)}"><meta name="twitter:card" content="summary_large_image">` : ""}
${r.art ? `<meta property="article:published_time" content="${r.art.date}"><meta property="article:section" content="${esc(catOf(r.art.cat).t)}">` : ""}
<link rel="icon" href="${A("favicon.ico")}" sizes="48x48">
<link rel="icon" href="${A("assets/icons/favicon.svg")}" type="image/svg+xml">
<link rel="apple-touch-icon" href="${A("assets/icons/apple-touch-icon.png")}">
<link rel="manifest" href="${A("site.webmanifest")}">
${live ? `<link rel="alternate" type="application/rss+xml" title="${esc(site)}" href="/rss.xml">` : ""}
<link rel="preload" href="${A("assets/fonts/source-serif-4-greek-700-normal.woff2")}" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${A("assets/fonts/manrope-greek-700-normal.woff2")}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${A("assets/css/site.css")}">
${jsonld}
</head>
<body>
<a class="skip" href="#main">Μετάβαση στο περιεχόμενο</a>
<div id="hdr">${headerHtml(state, ctx, r.active)}</div>
<main id="main">${r.main}</main>
<div id="ftr">${footerHtml(state, ctx)}</div>
${data ? `<script type="application/json" id="data">${data.replace(/</g, "\\u003c")}</script>` : ""}
<script type="module" src="${A("assets/js/site.js")}"></script>
</body>
</html>`;
}
