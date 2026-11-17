/* Πίνακας διαχείρισης — Στερεά Σήμερα.
   Στο live: όλα αποθηκεύονται στο Netlify Blobs μέσω /api (καμία ανανέωση site, καμία χρέωση).
   Στο προσχέδιο: «δοκιμή» — οι αλλαγές μένουν μόνο σε αυτή τη συσκευή (localStorage). */
import { CATS, catOf, subName, slugify, excerpt, esc, fmtDate, links } from "./shared.js";
import { importDocx, photoNumber } from "./wordimport.js";

const app = document.getElementById("app");
const TRIAL_KEY = "kantas-trial", PASS_KEY = "kantas-pass";
let LIVE = false, PASS = "", S = null; // S = ευρετήριο (settings, ads, articles, trash)
let BODIES = {};                        // κείμενα (δοκιμή)
let view = "list", filt = "", q = "", showN = 40;

const I = {
  list: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  word: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12l1.5 6 1.5-4.5 1.5 4.5 1.5-6"/>',
  ads: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15l2.5-6 2.5 6M7.8 13h3.4M15 9v6h1.5a2.5 2.5 0 0 0 0-5H15"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  img: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M21 16l-5-5-9 9"/>',
  check: '<circle cx="12" cy="12" r="10"/><path d="M7.5 12.5l3 3 6-6.5"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>', down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
};
const ic = (n, w = 22) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${I[n]}</svg>`;
const LOGO = '<svg viewBox="0 0 40 40"><rect width="40" height="40" rx="9" fill="#C8102E"/><path d="M29 12H11l9 8-9 8h18" fill="none" stroke="#fff" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round"/></svg>';

function toast(msg, err) { const t = document.getElementById("toast"); t.textContent = msg; t.className = "on" + (err ? " err" : ""); clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = ""), err ? 4200 : 2400); }
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const site = () => (S && S.settings && S.settings.name) || "Στερεά Σήμερα";
const ctx = () => ({ mode: LIVE ? "live" : "draft", base: LIVE ? "/" : "", now: new Date() });
const artUrl = (m) => links(ctx()).art(m);
const thumbUrl = (img) => { if (!img || !img.u) return ""; if (!img.s) return links(ctx()).asset(img.u); return links(ctx()).asset(img.u + "-" + img.s[0] + ".webp"); };

/* ---------------- αποθήκευση: live ή δοκιμή ---------------- */
async function post(action, extra = {}) {
  const r = await fetch("/api/save", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pass: PASS, action, ...extra }) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) { sessionStorage.removeItem(PASS_KEY); throw new Error("Λάθος κωδικός"); }
  if (!r.ok || !j.ok) throw new Error(j.error || "Κάτι πήγε στραβά (" + r.status + ")");
  return j;
}
function trialSave() {
  try { localStorage.setItem(TRIAL_KEY, JSON.stringify({ state: S, bodies: BODIES })); }
  catch { throw new Error("Η δοκιμή γέμισε τη μνήμη της συσκευής — σβήστε κάποιες φωτογραφίες ή πατήστε «Σβήσιμο δοκιμής»."); }
}
function localMeta(m, body, old) {
  const title = (m.title || "").trim();
  return { ...m, id: old ? old.id : (m.id || Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 5)), slug: slugify(title), title,
    date: m.date ? new Date(m.date).toISOString() : new Date().toISOString(), upd: old ? new Date().toISOString() : undefined,
    ex: excerpt(body), words: String(body).split(/\s+/).length };
}
const api = {
  async load() {
    if (LIVE) { S = (await post("load")).state; return; }
    const t = JSON.parse(localStorage.getItem(TRIAL_KEY) || "null");
    if (t && t.state) { S = t.state; BODIES = t.bodies || {}; return; }
    S = await (await fetch("content.json", { cache: "no-store" })).json(); S.trash = S.trash || []; BODIES = {};
  },
  async body(id) {
    if (LIVE) return (await post("body", { id })).body;
    if (BODIES[id] != null) return BODIES[id];
    try { const r = await fetch("a/" + id + ".json", { cache: "no-store" }); return r.ok ? (await r.json()).body : ""; } catch { return ""; }
  },
  async saveArticle(meta, body) {
    if (LIVE) { const j = await post("saveArticle", { meta, body }); const i = S.articles.findIndex((a) => a.id === j.meta.id); if (i >= 0) S.articles[i] = j.meta; else S.articles.push(j.meta); sortA(); return j.meta; }
    const i = S.articles.findIndex((a) => a.id === meta.id); const m = localMeta(meta, body, i >= 0 ? S.articles[i] : null);
    if (i >= 0) S.articles[i] = m; else S.articles.push(m); BODIES[m.id] = body; sortA(); trialSave(); return m;
  },
  async saveMany(items) {
    if (LIVE) { const j = await post("saveMany", { items }); for (const m of j.metas) { const i = S.articles.findIndex((a) => a.id === m.id); if (i >= 0) S.articles[i] = m; else S.articles.push(m); } sortA(); return j.metas; }
    const out = []; for (const it of items) { const m = localMeta(it.meta, it.body, null); S.articles.push(m); BODIES[m.id] = it.body; out.push(m); } sortA(); trialSave(); return out;
  },
  async del(id) {
    if (LIVE) await post("delete", { id });
    const i = S.articles.findIndex((a) => a.id === id); if (i >= 0) { S.trash = [{ ...S.articles[i], deleted: new Date().toISOString() }, ...(S.trash || [])]; S.articles.splice(i, 1); }
    if (!LIVE) trialSave();
  },
  async restore(id) {
    if (LIVE) await post("restore", { id });
    const i = (S.trash || []).findIndex((a) => a.id === id); if (i >= 0) { const m = S.trash.splice(i, 1)[0]; delete m.deleted; S.articles.push(m); sortA(); }
    if (!LIVE) trialSave();
  },
  async saveAds(ads) { if (LIVE) await post("saveAds", { ads }); S.ads = ads; if (!LIVE) trialSave(); },
  async saveSettings(st) { if (LIVE) await post("saveSettings", { settings: st }); S.settings = st; if (!LIVE) trialSave(); },
  async upload(blob, w, h) {
    if (!LIVE) return { u: await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); }), w, h };
    const r = await fetch("/api/upload", { method: "POST", headers: { "x-pass": PASS, "content-type": blob.type }, body: blob });
    const j = await r.json().catch(() => ({})); if (!r.ok || !j.ok) throw new Error("Η φωτογραφία δεν ανέβηκε (" + (j.error || r.status) + ")");
    return { u: j.url, w, h };
  },
};
const sortA = () => S.articles.sort((a, b) => new Date(b.date) - new Date(a.date));

/* Μικραίνει τη φωτογραφία στη συσκευή πριν ανέβει */
async function shrink(file, max = 1600, q = 0.82) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(async () => {
    const img = new Image(); img.src = URL.createObjectURL(file); await img.decode(); return img; });
  const sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * sc), h = Math.round(bmp.height * sc);
  const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(bmp, 0, 0, w, h);
  let blob = await new Promise((r) => c.toBlob(r, "image/webp", q));
  if (!blob || blob.type !== "image/webp") blob = await new Promise((r) => c.toBlob(r, "image/jpeg", q));
  return { blob, w, h };
}
async function uploadPhoto(file, max) { const sm = await shrink(file, LIVE ? max || 1600 : 1100, LIVE ? 0.82 : 0.72); return api.upload(sm.blob, sm.w, sm.h); }

/* ---------------- είσοδος ---------------- */
async function start() {
  try { const r = await fetch("/api/status", { cache: "no-store" }); LIVE = r.ok && (await r.json()).ok === true; } catch { LIVE = false; }
  if (LIVE) { PASS = sessionStorage.getItem(PASS_KEY) || ""; if (PASS) { try { await api.load(); return shell(); } catch { PASS = ""; } } return login(); }
  login();
}
function login() {
  app.innerHTML = `<div class="login"><form class="lcard" autocomplete="off">
<div class="mark">${LOGO}<span>${esc(site())}</span></div><h1>Πίνακας διαχείρισης</h1>
${LIVE ? `<p>Γράψτε τον κωδικό σας.</p><input type="password" inputmode="numeric" name="p" aria-label="Κωδικός" required autofocus>`
  : `<div class="trialnote"><b>Δοκιμαστική λειτουργία.</b> Μπορείτε να δοκιμάσετε τα πάντα· οι αλλαγές φαίνονται μόνο σε αυτή τη συσκευή μέχρι να ανέβει το site στο domain του.</div>`}
<button class="btn pri big" style="width:100%">${LIVE ? "Είσοδος" : "Είσοδος στη δοκιμή"}</button></form></div>`;
  $("form").onsubmit = async (e) => {
    e.preventDefault(); const b = $("button", e.target); b.disabled = true;
    try { if (LIVE) { PASS = e.target.p.value.trim(); await post("login"); sessionStorage.setItem(PASS_KEY, PASS); } await api.load(); shell(); }
    catch (err) { toast(err.message, true); b.disabled = false; }
  };
}

/* ---------------- κέλυφος ---------------- */
function shell() {
  app.innerHTML = `<header class="top"><div class="mark">${LOGO}<span>${esc(site())}</span></div>
<a href="${LIVE ? "/" : "./"}" target="_blank" rel="noopener">Το site ↗</a><button class="hide-s" data-out>Έξοδος</button></header>
${LIVE ? "" : `<div class="trialbar">Δοκιμή: οι αλλαγές φαίνονται μόνο σε αυτή τη συσκευή · <a href="#" data-reset>Σβήσιμο δοκιμής</a></div>`}
<div class="lay"><nav class="tabs" aria-label="Μενού">
<button data-v="list">${ic("list")}Άρθρα</button><button data-v="new">${ic("plus")}Νέο άρθρο</button><button data-v="import">${ic("word")}Από Word</button><button data-v="ads">${ic("ads")}Διαφημίσεις</button><button data-v="settings">${ic("gear")}Ρυθμίσεις</button>
</nav><section class="view" id="view"></section></div>`;
  $$(".tabs button").forEach((b) => (b.onclick = () => go(b.dataset.v)));
  const o = $("[data-out]"); if (o) o.onclick = () => { sessionStorage.removeItem(PASS_KEY); location.reload(); };
  const r = $("[data-reset]"); if (r) r.onclick = (e) => { e.preventDefault(); if (confirm("Να σβηστούν όλες οι δοκιμαστικές αλλαγές από αυτή τη συσκευή;")) { localStorage.removeItem(TRIAL_KEY); location.reload(); } };
  go(location.hash === "#word" ? "import" : "list");
}
function go(v, arg) {
  view = v; $$(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.v === (v === "edit" ? (arg ? "list" : "new") : v)));
  document.querySelectorAll(".savebar").forEach((x) => x.remove());
  window.scrollTo(0, 0);
  ({ list: vList, new: () => vEdit(null), edit: () => vEdit(arg), import: vImport, ads: vAds, settings: vSettings })[v]();
}

/* ---------------- λίστα άρθρων ---------------- */
function when(m) {
  const d = new Date(m.date), now = new Date();
  const day = (x) => x.toLocaleDateString("el-GR", { timeZone: "Europe/Athens" });
  const t = fmtDate(m.date, "time");
  if (day(d) === day(now)) return "Σήμερα " + t;
  const y = new Date(now - 864e5); if (day(d) === day(y)) return "Χθες " + t;
  return fmtDate(m.date, "short");
}
function thumb(m) {
  const c = catOf(m.cat); const u = thumbUrl(m.img);
  return u ? `<span class="th" style="background-image:url('${esc(u)}')"></span>` : `<span class="th" style="background:${c.c}">${esc(subName(m.cat, m.sub) || c.t)}</span>`;
}
function vList() {
  const V = $("#view");
  const cnt = (k) => S.articles.filter((a) => a.cat === k || (a.also || []).includes(k)).length;
  const n = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  let list = S.articles.filter((a) => !filt || a.cat === filt || (a.also || []).includes(filt));
  if (q) list = list.filter((a) => n(a.title + " " + a.lead + " " + (a.kicker || "")).includes(n(q)));
  const now = Date.now();
  V.innerHTML = `<h2 class="vt">Άρθρα</h2><p class="vs">${S.articles.length} άρθρα στο site. Πατήστε ένα άρθρο για να το αλλάξετε.</p>
<div class="quick"><button class="btn pri big" data-go="new">${ic("plus", 26)}<span>Νέο άρθρο<small>Γράψτε ή επικολλήστε ένα άρθρο</small></span></button>
<button class="btn dark big" data-go="import">${ic("word", 26)}<span>Ανέβασμα από Word<small>Όλα τα άρθρα της ημέρας μαζί</small></span></button></div>
<div class="filters"><button class="chip${!filt ? " on" : ""}" data-f="">Όλα <b>${S.articles.length}</b></button>${CATS.map((c) => `<button class="chip${filt === c.k ? " on" : ""}" data-f="${c.k}" style="--cc:${c.c}"><i></i>${esc(c.t)} <b>${cnt(c.k)}</b></button>`).join("")}</div>
<input class="search" type="search" placeholder="Αναζήτηση στα άρθρα…" value="${esc(q)}" aria-label="Αναζήτηση">
<div class="alist">${list.slice(0, showN).map((m) => { const c = catOf(m.cat); const sched = new Date(m.date) > now;
  return `<div class="ai" data-id="${m.id}">${thumb(m)}<div><h3>${esc(m.title)}</h3><div class="meta"><span class="tagc" style="--cc:${c.c}">${esc(subName(m.cat, m.sub) || c.t)}</span><span>${when(m)}</span>${m.feat ? '<span class="badge f">Κεντρικό</span>' : ""}${m.draft ? '<span class="badge d">Πρόχειρο</span>' : ""}${sched && !m.draft ? '<span class="badge s">Προγραμματισμένο</span>' : ""}</div></div>
<div class="acts"><button class="ib${m.feat ? " on" : ""}" data-star title="Κεντρικό θέμα" aria-label="Κεντρικό θέμα">${ic("star")}</button><button class="ib ed-b" data-edit aria-label="Επεξεργασία">${ic("edit")}</button><button class="ib" data-del aria-label="Διαγραφή">${ic("trash")}</button></div></div>`; }).join("") || '<p class="vs">Δεν βρέθηκαν άρθρα.</p>'}</div>
${list.length > showN ? `<div class="moreb"><button class="btn" data-more>Περισσότερα (${list.length - showN})</button></div>` : ""}
${(S.trash || []).length ? `<details class="trash"><summary>Κάδος (${S.trash.length}) — άρθρα που σβήσατε</summary><div class="alist">${S.trash.slice(0, 50).map((m) => `<div class="ai" data-tid="${m.id}" style="cursor:default">${thumb(m)}<div><h3>${esc(m.title)}</h3><div class="meta">Σβήστηκε ${m.deleted ? fmtDate(m.deleted, "short") : ""}</div></div><div class="acts"><button class="btn" data-restore>Επαναφορά</button></div></div>`).join("")}</div></details>` : ""}`;
  $$("[data-go]", V).forEach((b) => (b.onclick = () => go(b.dataset.go)));
  $$("[data-f]", V).forEach((b) => (b.onclick = () => { filt = b.dataset.f; showN = 40; vList(); }));
  const si = $(".search", V); si.oninput = () => { q = si.value; clearTimeout(si.t); si.t = setTimeout(() => { vList(); const x = $(".search"); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }, 250); };
  const mb = $("[data-more]", V); if (mb) mb.onclick = () => { showN += 60; vList(); };
  $$(".ai[data-id]", V).forEach((row) => {
    const id = row.dataset.id; const m = S.articles.find((a) => a.id === id);
    row.onclick = async (e) => {
      if (e.target.closest("[data-star]")) {
        e.stopPropagation(); const body = await api.body(id);
        try { await api.saveArticle({ ...m, feat: !m.feat }, body); toast(m.feat ? "Δεν είναι πια κεντρικό" : "Έγινε κεντρικό θέμα"); vList(); } catch (err) { toast(err.message, true); } return;
      }
      if (e.target.closest("[data-del]")) {
        e.stopPropagation(); if (!confirm("Να σβηστεί το άρθρο;\n\n«" + m.title + "»\n\n(Μπορείτε να το επαναφέρετε από τον Κάδο.)")) return;
        try { await api.del(id); toast("Σβήστηκε — υπάρχει στον Κάδο"); vList(); } catch (err) { toast(err.message, true); } return;
      }
      go("edit", id);
    };
  });
  $$("[data-restore]", V).forEach((b) => (b.onclick = async () => { try { await api.restore(b.closest("[data-tid]").dataset.tid); toast("Επανήλθε"); vList(); } catch (err) { toast(err.message, true); } }));
}

/* ---------------- επεξεργασία / νέο άρθρο ---------------- */
const localDT = (iso) => { const d = iso ? new Date(iso) : new Date(); const z = new Date(d - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 16); };
function normBody(t) {
  // κάθε γραμμή = παράγραφος (εκτός από γραμμές πίνακα «|» και λίστας «-»)
  const L = String(t || "").replace(/\r/g, "").split("\n");
  const out = []; let prev = "";
  for (const raw of L) {
    const l = raw.replace(/\s+$/, "");
    if (!l.trim()) { if (out.length && out[out.length - 1] !== "") out.push(""); prev = ""; continue; }
    const kind = /^\s*\|/.test(l) ? "t" : /^\s*[-•]\s/.test(l) ? "l" : "p";
    if (out.length && out[out.length - 1] !== "" && !(kind !== "p" && kind === prev)) out.push("");
    out.push(l.trim()); prev = kind;
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
async function vEdit(id) {
  const V = $("#view");
  const old = id ? S.articles.find((a) => a.id === id) : null;
  const m = old ? structuredClone(old) : { cat: filt || "sterea", sub: filt ? "" : "boiotia", also: [], kicker: "", title: "", lead: "", img: null, date: "", author: "", feat: false, draft: false };
  let body = old ? await api.body(id) : "";
  let dirty = false;
  const subsHtml = () => { const c = catOf(m.cat); return c.subs ? `<div class="subs">${c.subs.map(([s, n]) => `<button type="button" data-sub="${s}" class="${m.sub === s ? "on" : ""}">${esc(n)}</button>`).join("")}</div>` : ""; };
  const photoHtml = () => m.img && m.img.u ? `<img src="${esc(thumbUrl({ ...m.img, s: m.img.s ? [m.img.s[Math.min(1, m.img.s.length - 1)]] : undefined }))}" alt=""><div class="row"><label class="btn">${ic("img")}Αλλαγή<input type="file" accept="image/*" hidden data-file></label><button type="button" class="btn ghost danger" data-noimg>Αφαίρεση</button></div>`
    : `<div style="color:var(--mute)">${ic("img", 38)}</div><p style="margin:6px 0 12px;font-weight:800">Σύρετε εδώ μια φωτογραφία ή</p><label class="btn pri">${ic("img")}Επιλογή φωτογραφίας<input type="file" accept="image/*" hidden data-file></label>`;
  V.innerHTML = `<h2 class="vt">${old ? "Επεξεργασία άρθρου" : "Νέο άρθρο"}</h2><p class="vs">${old ? `Δημοσιεύτηκε ${when(old)} · <a href="${esc(artUrl(old))}" target="_blank" rel="noopener">Προβολή στο site ↗</a>` : "Συμπληρώστε τα παρακάτω και πατήστε «Δημοσίευση»."}</p>
<form class="ed" novalidate>
<div class="card f"><span class="lab">Ενότητα</span><div class="cats">${CATS.map((c) => `<button type="button" data-cat="${c.k}" class="${m.cat === c.k ? "on" : ""}" style="--cc:${c.c}"><i></i>${esc(c.t)}</button>`).join("")}</div><div data-subs>${subsHtml()}</div></div>
<div class="card ed">
<div class="f"><label for="e-t">Τίτλος</label><textarea id="e-t" class="title" name="title" rows="2" required placeholder="Ο τίτλος του άρθρου">${esc(m.title)}</textarea></div>
<div class="f"><label for="e-k">Υπέρτιτλος <span style="font-weight:500;color:var(--mute)">(προαιρετικό — μικρό κείμενο πάνω από τον τίτλο, π.χ. «Λιβαδειά»)</span></label><input id="e-k" type="text" name="kicker" value="${esc(m.kicker)}"></div>
<div class="f"><label for="e-l">Υπότιτλος / περίληψη <span style="font-weight:500;color:var(--mute)">(προαιρετικό)</span></label><textarea id="e-l" class="lead" name="lead" rows="2">${esc(m.lead)}</textarea></div>
</div>
<div class="card f"><span class="lab">Φωτογραφία</span><div class="photo${m.img && m.img.u ? " has" : ""}" data-photo>${photoHtml()}</div>
<div class="f" style="margin-top:12px"><label for="e-c">Λεζάντα φωτογραφίας <span style="font-weight:500;color:var(--mute)">(προαιρετικό)</span></label><input id="e-c" type="text" name="cap" value="${esc((m.img && m.img.cap) || "")}"></div></div>
<div class="card f"><label for="e-b">Κείμενο</label>
<div class="tools"><button type="button" data-ins="h">Ενδιάμεσος τίτλος</button><button type="button" data-ins="b">Έντονα</button><button type="button" data-ins="l">Λίστα</button><button type="button" data-ins="a">Σύνδεσμος</button><button type="button" data-ins="t">Πίνακας (αποτελέσματα)</button></div>
<textarea id="e-b" class="body" name="body" placeholder="Γράψτε ή επικολλήστε εδώ το κείμενο. Κάθε γραμμή γίνεται παράγραφος.">${esc(body)}</textarea>
<small>Κάθε γραμμή γίνεται παράγραφος. «## » στην αρχή = ενδιάμεσος τίτλος · **λέξεις** = έντονα · γραμμές που αρχίζουν με «|» = πίνακας (π.χ. «| Θήβα – Λαμία | 0-0»).</small></div>
<div class="card ed">
<div class="two"><div class="f"><label for="e-a">Συντάκτης <span style="font-weight:500;color:var(--mute)">(προαιρετικό)</span></label><input id="e-a" type="text" name="author" value="${esc(m.author)}"></div>
<div class="f"><label for="e-d">Ημερομηνία & ώρα</label><input id="e-d" type="datetime-local" name="date" value="${localDT(m.date)}"><small>Αν βάλετε μελλοντική ώρα, το άρθρο θα εμφανιστεί μόνο του τότε.</small></div></div>
<div class="toggles"><label class="tg"><input type="checkbox" name="feat" ${m.feat ? "checked" : ""}><span>Κεντρικό θέμα<small>Μπαίνει μεγάλο, πάνω-πάνω στην αρχική σελίδα.</small></span></label>
<label class="tg"><input type="checkbox" name="draft" ${m.draft ? "checked" : ""}><span>Πρόχειρο<small>Αποθηκεύεται αλλά δεν φαίνεται ακόμη στο site.</small></span></label></div>
<div class="f"><span class="lab">Να φαίνεται και στις ενότητες <span style="font-weight:500;color:var(--mute)">(προαιρετικό)</span></span><div class="also">${CATS.map((c) => `<label><input type="checkbox" name="also" value="${c.k}" ${(m.also || []).includes(c.k) ? "checked" : ""}>${esc(c.t)}</label>`).join("")}</div></div>
</div>
</form>`;
  const bar = document.createElement("div"); bar.className = "savebar";
  bar.innerHTML = `<div class="in"><span class="st" data-st>${old ? "" : "Νέο άρθρο"}</span>${old ? `<button class="btn ghost danger" data-del>${ic("trash")}Διαγραφή</button>` : ""}<button class="btn" data-cancel>Πίσω</button><button class="btn pri big" data-save>${old ? "Αποθήκευση" : "Δημοσίευση"}</button></div>`;
  document.body.appendChild(bar);
  const F = $("form", V);
  const mark = () => { dirty = true; $("[data-st]").textContent = "Υπάρχουν αλλαγές που δεν αποθηκεύτηκαν"; };
  F.addEventListener("input", mark);
  const bindSubs = () => $$("[data-sub]", V).forEach((b) => (b.onclick = () => { m.sub = m.sub === b.dataset.sub ? "" : b.dataset.sub; $("[data-subs]", V).innerHTML = subsHtml(); bindSubs(); mark(); }));
  $$("[data-cat]", V).forEach((b) => (b.onclick = () => { m.cat = b.dataset.cat; const c = catOf(m.cat); m.sub = c.subs ? (c.k === "sterea" ? "boiotia" : c.subs[0][0]) : ""; $$("[data-cat]", V).forEach((x) => x.classList.toggle("on", x === b)); $("[data-subs]", V).innerHTML = subsHtml(); bindSubs(); mark(); }));
  bindSubs();
  const ph = $("[data-photo]", V);
  const bindPhoto = () => {
    const fi = $("[data-file]", ph); if (fi) fi.onchange = () => fi.files[0] && setPhoto(fi.files[0]);
    const nb = $("[data-noimg]", ph); if (nb) nb.onclick = () => { m.img = null; ph.classList.remove("has"); ph.innerHTML = photoHtml(); bindPhoto(); mark(); };
  };
  async function setPhoto(file) {
    ph.innerHTML = '<p style="font-weight:800">Ανέβασμα φωτογραφίας…</p>';
    try { const up = await uploadPhoto(file); m.img = { ...up, cap: F.cap.value }; ph.classList.add("has"); mark(); }
    catch (err) { toast(err.message, true); }
    ph.innerHTML = photoHtml(); bindPhoto();
  }
  bindPhoto();
  ph.addEventListener("dragover", (e) => { e.preventDefault(); ph.classList.add("drag"); });
  ph.addEventListener("dragleave", () => ph.classList.remove("drag"));
  ph.addEventListener("drop", (e) => { e.preventDefault(); ph.classList.remove("drag"); const f = [...e.dataTransfer.files].find((x) => x.type.startsWith("image/")); if (f) setPhoto(f); });
  const ta = F.body;
  $$("[data-ins]", V).forEach((b) => (b.onclick = () => {
    const s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e); let ins = "";
    const k = b.dataset.ins;
    if (k === "h") ins = "\n\n## " + (sel || "Ενδιάμεσος τίτλος") + "\n\n";
    if (k === "b") ins = "**" + (sel || "έντονο κείμενο") + "**";
    if (k === "l") ins = "\n\n" + (sel ? sel.split("\n").map((x) => "- " + x).join("\n") : "- πρώτο\n- δεύτερο") + "\n\n";
    if (k === "a") { const url = prompt("Διεύθυνση συνδέσμου (https://…)"); if (!url) return; ins = "[" + (sel || "κείμενο συνδέσμου") + "](" + url + ")"; }
    if (k === "t") ins = "\n\n" + (sel ? sel.split("\n").map((x) => "| " + x.split("\t").join(" | ")).join("\n") : "| Ομάδα Α – Ομάδα Β | 1-0\n| Ομάδα Γ – Ομάδα Δ | 2-2") + "\n\n";
    ta.setRangeText(ins, s, e, "end"); ta.focus(); mark();
  }));
  $("[data-cancel]").onclick = () => { if (dirty && !confirm("Να φύγετε χωρίς αποθήκευση;")) return; go("list"); };
  const db = $("[data-del]"); if (db) db.onclick = async () => { if (!confirm("Να σβηστεί το άρθρο; (Μπορείτε να το επαναφέρετε από τον Κάδο.)")) return; try { await api.del(id); toast("Σβήστηκε"); go("list"); } catch (err) { toast(err.message, true); } };
  $("[data-save]").onclick = async () => {
    const title = F.title.value.trim(); if (!title) { toast("Γράψτε τίτλο", true); F.title.focus(); return; }
    const b = $("[data-save]"); b.disabled = true; b.textContent = "Αποθήκευση…";
    const meta = { ...m, title, kicker: F.kicker.value.trim(), lead: F.lead.value.trim(), author: F.author.value.trim(), feat: F.feat.checked, draft: F.draft.checked,
      date: F.date.value ? new Date(F.date.value).toISOString() : new Date().toISOString(), also: $$("[name=also]:checked", F).map((x) => x.value).filter((x) => x !== m.cat),
      img: m.img ? { ...m.img, cap: F.cap.value.trim() } : null };
    try { const saved = await api.saveArticle(meta, normBody(F.body.value)); dirty = false;
      toast(old ? "Αποθηκεύτηκε" : (meta.draft ? "Αποθηκεύτηκε ως πρόχειρο" : "Δημοσιεύτηκε!")); go("edit", saved.id);
    } catch (err) { toast(err.message, true); b.disabled = false; b.textContent = old ? "Αποθήκευση" : "Δημοσίευση"; }
  };
}

/* ---------------- εισαγωγή από Word ---------------- */
function vImport() {
  const V = $("#view");
  let arts = null; const photos = new Map(); // αριθμός άρθρου → File
  V.innerHTML = `<h2 class="vt">Ανέβασμα από Word</h2><p class="vs">Ανεβάστε το Word με τα άρθρα της ημέρας και τις φωτογραφίες. Το site τα χωρίζει μόνο του σε άρθρα και ενότητες.</p>
<div class="two"><label class="drop" data-dw>${ic("word", 40)}<b>1. Το Word με τα άρθρα</b><span>Πατήστε για επιλογή (.docx)</span><input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"></label>
<label class="drop" data-dp>${ic("img", 40)}<b>2. Οι φωτογραφίες</b><span>Επιλέξτε όλες μαζί — π.χ. «ΑΡ. 3.jpg» πάει στο Άρθρο 3</span><input type="file" accept="image/*" multiple></label></div>
<div class="card" style="margin-top:14px;font-size:14.5px;color:#3A414B"><b>Πώς γράφεται το Word:</b> κάθε άρθρο ξεκινά με «ΑΡΘΡΟ 1 / ΒΟΙΩΤΙΑ» (ή ΕΛΛΑΔΑ, ΚΟΣΜΟΣ, ΥΓΕΙΑ, ΑΡΘΡΑ, ΑΘΛΗΤΙΚΑ ΠΟΔΟΣΦΑΙΡΟ, ΕΥΒΟΙΑ, ΦΘΙΩΤΙΔΑ…), μετά ο τίτλος, μετά η λέξη «ΚΕΙΜΕΝΟ» και το κείμενο — όπως ακριβώς τα στέλνετε ήδη.</div>
<div data-res></div>`;
  const dw = $("[data-dw]", V), dp = $("[data-dp]", V), res = $("[data-res]", V);
  for (const d of [dw, dp]) { d.addEventListener("dragover", (e) => { e.preventDefault(); d.classList.add("drag"); }); d.addEventListener("dragleave", () => d.classList.remove("drag")); }
  dw.addEventListener("drop", (e) => { e.preventDefault(); dw.classList.remove("drag"); const f = [...e.dataTransfer.files].find((x) => /\.docx$/i.test(x.name)); if (f) readWord(f); });
  dp.addEventListener("drop", (e) => { e.preventDefault(); dp.classList.remove("drag"); addPhotos([...e.dataTransfer.files]); });
  $("input", dw).onchange = (e) => e.target.files[0] && readWord(e.target.files[0]);
  $("input", dp).onchange = (e) => addPhotos([...e.target.files]);
  async function readWord(f) {
    try { arts = await importDocx(await f.arrayBuffer()); }
    catch (err) { toast(err.message || "Δεν διαβάστηκε το Word", true); return; }
    if (!arts.length) { toast("Δεν βρέθηκαν άρθρα — κάθε άρθρο πρέπει να ξεκινά με «ΑΡΘΡΟ 1 / …»", true); return; }
    const n = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
    const have = new Set(S.articles.map((a) => n(a.title)));
    arts.forEach((a, i) => { a.on = !have.has(n(a.title)); a.dupe = !a.on; a.feat = false; });
    if (arts.length && !arts.some((a) => a.feat)) { const f0 = arts.find((a) => a.on); if (f0) f0.feat = true; }
    dw.classList.add("done"); $("b", dw).textContent = "1. " + f.name; $("span", dw).textContent = arts.length + " άρθρα βρέθηκαν · πατήστε για άλλο αρχείο";
    draw();
  }
  function addPhotos(files) {
    let k = 0; for (const f of files) { if (!f.type.startsWith("image/")) continue; const n = photoNumber(f.name); if (n != null) { photos.set(n, f); k++; } }
    dp.classList.toggle("done", photos.size > 0); $("span", dp).textContent = photos.size + " φωτογραφίες · πατήστε για να προσθέσετε κι άλλες";
    if (k < files.length) toast("Κάποιες φωτογραφίες δεν έχουν αριθμό άρθρου στο όνομα");
    draw();
  }
  const catOpts = (a) => CATS.map((c) => `<option value="${c.k}"${a.cat === c.k ? " selected" : ""}>${esc(c.t)}</option>`).join("");
  const subOpts = (a) => { const c = catOf(a.cat); return c.subs ? `<select data-k="sub"><option value="">—</option>${c.subs.map(([s, n]) => `<option value="${s}"${a.sub === s ? " selected" : ""}>${esc(n)}</option>`).join("")}</select>` : ""; };
  function draw() {
    if (!arts) { res.innerHTML = ""; return; }
    const on = arts.filter((a) => a.on);
    res.innerHTML = `<div class="imp"><div class="card row" style="justify-content:space-between"><div><b style="font-size:18px">${arts.length} άρθρα</b> · ${arts.filter((a) => photos.has(a.n)).length} με φωτογραφία<br><span style="color:var(--mute);font-size:14px">Ελέγξτε τις ενότητες και πατήστε «Δημοσίευση». Το πρώτο θα είναι το πιο πρόσφατο.</span></div>
<button class="btn pri big" data-pub ${on.length ? "" : "disabled"}>Δημοσίευση ${on.length} ${on.length === 1 ? "άρθρου" : "άρθρων"}</button></div>
${arts.map((a, i) => { const f = photos.get(a.n); const c = catOf(a.cat);
  return `<div class="ir${a.on ? "" : " off"}" data-i="${i}"><input type="checkbox" class="ck" ${a.on ? "checked" : ""} aria-label="Να δημοσιευτεί">
<label class="th" style="${f ? "" : "background:" + c.c}" data-th>${f ? "" : "Χωρίς<br>φωτογραφία"}<input type="file" accept="image/*" hidden></label>
<div><input class="t" value="${esc(a.title)}" aria-label="Τίτλος">${a.lead ? `<div class="l">${esc(a.lead)}</div>` : ""}
<div class="opts"><span class="n">Άρθρο ${a.n}</span><select data-k="cat">${catOpts(a)}</select>${subOpts(a)}<label class="sw" style="font-size:13.5px"><input type="checkbox" data-k="feat" ${a.feat ? "checked" : ""}>Κεντρικό</label>${a.dupe ? '<span class="warn">Υπάρχει ήδη στο site</span>' : ""}</div></div></div>`; }).join("")}
</div>`;
    arts.forEach((a, i) => { const f = photos.get(a.n); if (f) { const th = $(`[data-i="${i}"] [data-th]`, res); th.style.backgroundImage = `url(${URL.createObjectURL(f)})`; } });
    $$(".ir", res).forEach((row) => {
      const a = arts[+row.dataset.i];
      $(".ck", row).onchange = (e) => { a.on = e.target.checked; draw(); };
      $("input.t", row).oninput = (e) => (a.title = e.target.value);
      $("[data-k=cat]", row).onchange = (e) => { a.cat = e.target.value; const c = catOf(a.cat); a.sub = c.subs ? c.subs[0][0] : ""; draw(); };
      const sb = $("[data-k=sub]", row); if (sb) sb.onchange = (e) => (a.sub = e.target.value);
      $("[data-k=feat]", row).onchange = (e) => (a.feat = e.target.checked);
      $("[data-th] input", row).onchange = (e) => { if (e.target.files[0]) { photos.set(a.n, e.target.files[0]); draw(); } };
    });
    const pb = $("[data-pub]", res); if (pb) pb.onclick = publish;
  }
  async function publish() {
    const list = arts.filter((a) => a.on && a.title.trim()); if (!list.length) return;
    res.innerHTML = `<div class="card done-card"><h3>Δημοσίευση…</h3><div class="prog"><i></i></div><p data-msg>Ανέβασμα φωτογραφιών</p></div>`;
    const bar = $(".prog i", res), msg = $("[data-msg]", res);
    const now = Date.now(); const items = [];
    try {
      for (let i = 0; i < list.length; i++) {
        const a = list[i]; const f = photos.get(a.n); let img = null;
        if (f) { msg.textContent = `Φωτογραφία ${i + 1} από ${list.length}`; img = { ...(await uploadPhoto(f)), cap: "" }; }
        bar.style.width = Math.round(((i + 1) / list.length) * 85) + "%";
        items.push({ meta: { cat: a.cat, sub: a.sub, also: [], kicker: a.kicker, title: a.title.trim(), lead: a.lead, img, author: a.author, feat: a.feat, draft: false,
          date: new Date(now - i * 60000).toISOString() }, body: a.body });
      }
      msg.textContent = "Αποθήκευση άρθρων…";
      for (let i = 0; i < items.length; i += 25) await api.saveMany(items.slice(i, i + 25));
      bar.style.width = "100%";
      res.innerHTML = `<div class="card done-card">${ic("check", 60)}<h3>Δημοσιεύτηκαν ${items.length} άρθρα</h3><p style="color:var(--mute)">Είναι ήδη στο site, στις ενότητές τους.</p><div class="row" style="justify-content:center"><a class="btn pri" href="${LIVE ? "/" : "./"}" target="_blank" rel="noopener">Άνοιγμα site ↗</a><button class="btn" data-go="list">Λίστα άρθρων</button></div></div>`;
      $("[data-go]", res).onclick = () => go("list");
    } catch (err) { toast(err.message, true); draw(); }
  }
}

/* ---------------- διαφημίσεις ---------------- */
function vAds() {
  const V = $("#view");
  let ads = structuredClone(S.ads || []); let dirty = false;
  const draw = () => {
    V.innerHTML = `<h2 class="vt">Διαφημίσεις</h2><p class="vs">Στον υπολογιστή φαίνονται στη στήλη δεξιά· στο κινητό ανάμεσα στις ειδήσεις. Αλλάξτε σειρά με τα βελάκια.</p>
<div class="row" style="margin-bottom:14px"><label class="btn pri">${ic("plus")}Νέα διαφήμιση<input type="file" accept="image/*" hidden data-new></label></div>
<div class="adl">${ads.map((a, i) => `<div class="adc${a.on === false ? " off" : ""}" data-i="${i}">
<label class="img" title="Αλλαγή εικόνας">${a.img && a.img.u ? `<img src="${esc(links(ctx()).asset(a.img.u))}" alt="">` : "Χωρίς εικόνα"}<input type="file" accept="image/*" hidden data-img></label>
<div><div class="f"><label>Όνομα (για εσάς)</label><input type="text" data-k="name" value="${esc(a.name || "")}"></div>
<div class="f"><label>Πού πηγαίνει όταν πατηθεί</label><input type="text" data-k="link" value="${esc(a.link || "")}" placeholder="https://… ή tel:2261012345"><small>Ιστοσελίδα, Facebook ή τηλέφωνο (tel:…). Κενό = δεν πατιέται.</small></div>
<div class="two"><div class="f"><label>Θέση</label><select data-k="slot"><option value="side"${a.slot !== "wide" ? " selected" : ""}>Στήλη δεξιά</option><option value="wide"${a.slot === "wide" ? " selected" : ""}>Οριζόντια, ανάμεσα στις ενότητες</option></select></div>
<div class="two"><div class="f"><label>Από</label><input type="date" data-k="from" value="${esc(a.from || "")}"></div><div class="f"><label>Έως</label><input type="date" data-k="to" value="${esc(a.to || "")}"></div></div></div>
<div class="row"><label class="sw"><input type="checkbox" data-k="on" ${a.on !== false ? "checked" : ""}>Ενεργή</label><span style="flex:1"></span>
<button class="ib" data-mv="-1" aria-label="Πάνω" ${i ? "" : "disabled"}>${ic("up")}</button><button class="ib" data-mv="1" aria-label="Κάτω" ${i < ads.length - 1 ? "" : "disabled"}>${ic("down")}</button><button class="ib" data-rm aria-label="Διαγραφή">${ic("trash")}</button></div></div></div>`).join("") || '<p class="vs">Δεν υπάρχουν διαφημίσεις.</p>'}</div>`;
    let sb = $(".savebar"); if (!sb) { sb = document.createElement("div"); sb.className = "savebar"; document.body.appendChild(sb); }
    sb.innerHTML = `<div class="in"><span class="st">${dirty ? "Υπάρχουν αλλαγές" : "Όλα αποθηκευμένα"}</span><button class="btn pri big" data-save ${dirty ? "" : "disabled"}>Αποθήκευση διαφημίσεων</button></div>`;
    $("[data-save]", sb).onclick = async () => { try { await api.saveAds(ads); dirty = false; toast("Οι διαφημίσεις αποθηκεύτηκαν"); draw(); } catch (err) { toast(err.message, true); } };
    const touch = () => { dirty = true; $(".savebar .st").textContent = "Υπάρχουν αλλαγές"; $(".savebar [data-save]").disabled = false; };
    $("[data-new]", V).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; toast("Ανέβασμα…");
      try { const up = await uploadPhoto(f, 900); ads.unshift({ id: "ad-" + Date.now().toString(36), name: f.name.replace(/\.[^.]+$/, ""), link: "", slot: "side", on: true, from: "", to: "", img: up }); dirty = true; draw(); } catch (err) { toast(err.message, true); } };
    $$(".adc", V).forEach((el) => {
      const a = ads[+el.dataset.i];
      $$("[data-k]", el).forEach((inp) => (inp.oninput = inp.onchange = () => { const k = inp.dataset.k; a[k] = k === "on" ? inp.checked : inp.value.trim(); if (k === "on") el.classList.toggle("off", !inp.checked); touch(); }));
      $("[data-img]", el).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { a.img = await uploadPhoto(f, 900); dirty = true; draw(); } catch (err) { toast(err.message, true); } };
      $$("[data-mv]", el).forEach((b) => (b.onclick = () => { const i = +el.dataset.i, j = i + +b.dataset.mv; [ads[i], ads[j]] = [ads[j], ads[i]]; dirty = true; draw(); }));
      $("[data-rm]", el).onclick = () => { if (confirm("Να σβηστεί η διαφήμιση «" + (a.name || "") + "»;")) { ads.splice(+el.dataset.i, 1); dirty = true; draw(); } };
    });
  };
  draw();
}

/* ---------------- ρυθμίσεις ---------------- */
function vSettings() {
  const V = $("#view"); const s = { ...(S.settings || {}) };
  const F = [["name", "Όνομα του site", "text"], ["tagline", "Σύνθημα (κάτω από το λογότυπο)", "text"], ["description", "Περιγραφή για το Google", "text"],
    ["email", "E-mail επικοινωνίας", "email"], ["phone", "Τηλέφωνο επικοινωνίας", "tel"], ["advertise", "E-mail για διαφημίσεις", "email"], ["mit", "Αριθμός ΜΗΤ (Μητρώο Επιγραφικού Τύπου)", "text"],
    ["facebook", "Facebook (σύνδεσμος)", "url"], ["instagram", "Instagram (σύνδεσμος)", "url"], ["youtube", "YouTube (σύνδεσμος)", "url"], ["tiktok", "TikTok (σύνδεσμος)", "url"]];
  V.innerHTML = `<h2 class="vt">Ρυθμίσεις</h2><p class="vs">Ό,τι γράψετε εδώ φαίνεται στην κεφαλίδα και στο κάτω μέρος κάθε σελίδας. Κενά πεδία δεν εμφανίζονται.</p>
<form class="card ed" novalidate>${F.map(([k, l, t]) => `<div class="f"><label for="s-${k}">${l}</label><input id="s-${k}" type="${t}" name="${k}" value="${esc(s[k] || "")}"></div>`).join("")}
<button class="btn pri big">Αποθήκευση ρυθμίσεων</button></form>`;
  $("form", V).onsubmit = async (e) => { e.preventDefault(); const o = {}; F.forEach(([k]) => (o[k] = e.target[k].value.trim())); try { await api.saveSettings(o); toast("Αποθηκεύτηκε"); $(".top .mark span").textContent = site(); } catch (err) { toast(err.message, true); } };
}

window.addEventListener("beforeunload", (e) => { if ($(".savebar .st") && /δεν αποθηκεύτηκαν|Υπάρχουν αλλαγές/.test($(".savebar .st").textContent)) { e.preventDefault(); e.returnValue = ""; } });
start();
