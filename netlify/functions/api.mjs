/* /api/*  — ο πίνακας διαχείρισης.
   POST /api/save   {pass, action, …}       (login, load, body, saveArticle, saveMany, order, delete, restore, purge, saveAds, saveSettings, undo,
                                             συντάκτες: staffList, staffAdd, staffSet, staffDel, staffCode · έγκριση: plist, pget, approve, preturn, preject
                                             ο ίδιος ο συντάκτης: mine, pget, submit, withdraw)
   POST /api/upload (x-pass, σώμα = εικόνα) → {url}
   GET  /api/img/<key>   φωτογραφίες που ανέβηκαν από τον πίνακα
   GET  /api/status      «είμαι στο live»                                             */
import { store, images, json, auth, getIndex, getBody, getStaff, setStaff, getPending, setPending } from "./_lib.mjs";
import { slugify, excerpt } from "./_shared.mjs";
let purgeCache = null;
try { ({ purgeCache } = await import("@netlify/functions")); } catch {}

const TYPES = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif" };
const clean = (s, n = 400) => String(s == null ? "" : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, n);
const rid = () => Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 5);

function normMeta(m, body, old) {
  const id = old ? old.id : (/^[\w-]{4,20}$/.test(m.id || "") ? m.id : rid());
  const title = clean(m.title, 300).trim();
  const img = m.img && m.img.u ? { u: clean(m.img.u, 300), s: Array.isArray(m.img.s) ? m.img.s.map(Number).slice(0, 6) : undefined,
    w: +m.img.w || 1200, h: +m.img.h || 800, cap: clean(m.img.cap, 300), pos: clean(m.img.pos, 30) } : null;
  if (img && !img.s) delete img.s;
  const date = m.date && !isNaN(new Date(m.date)) ? new Date(m.date).toISOString() : (old ? old.date : new Date().toISOString());
  return { id, slug: slugify(title), cat: clean(m.cat, 30) || "ellada", sub: clean(m.sub, 30), also: (m.also || []).map((x) => clean(x, 30)).slice(0, 6),
    kicker: clean(m.kicker, 120).trim(), title, lead: clean(m.lead, 700).trim(), img, date, upd: old ? new Date().toISOString() : undefined,
    author: clean(m.author, 80).trim(), feat: !!m.feat, rank: m.feat ? (+m.rank || (old && old.rank) || 99) : undefined, draft: !!m.draft, noTime: m.noTime ? true : undefined, ex: excerpt(body), words: String(body).split(/\s+/).length };
}
async function saveIndex(ix) {
  const st = store(); ix.updated = new Date().toISOString();
  ix.articles.sort((a, b) => new Date(b.date) - new Date(a.date));
  const prev = await st.get("index.json");
  if (prev) { await st.set("index-prev.json", prev); await st.set("history/" + ix.updated.slice(0, 10) + ".json", prev); }
  await st.set("index.json", JSON.stringify(ix));
  if (purgeCache) { try { await purgeCache({ tags: ["kantas"] }); } catch {} }
  return ix.updated;
}

async function newCode(sf) {
  const used = new Set(sf.list.map((x) => x.code));
  for (;;) { const c = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000)); if (!used.has(c) && c !== process.env.ADMIN_PASS) return c; }
}
async function pBody(pid) { if (!/^[\w-]+$/.test(pid || "")) return ""; const t = await store().get("p/" + pid + ".json"); return t ? JSON.parse(t).body || "" : ""; }
/* κρατάμε όλα τα «περιμένει» και τα 150 πιο πρόσφατα από τα υπόλοιπα */
function trimQ(pq) { const wait = pq.list.filter((x) => x.st === "pending" || x.st === "returned"); const done = pq.list.filter((x) => !(x.st === "pending" || x.st === "returned")).sort((a, b) => (b.upd || b.at).localeCompare(a.upd || a.at)).slice(0, 150); pq.list = [...wait, ...done]; return pq; }
/* Ο συντάκτης γράφει και στέλνει — δεν δημοσιεύει, δεν σβήνει, δεν βλέπει τα άλλα */
function pMeta(m, who) {
  const img = m.img && m.img.u ? { u: clean(m.img.u, 300), w: +m.img.w || 1200, h: +m.img.h || 800, cap: clean(m.img.cap, 300) } : null;
  return { title: clean(m.title, 300).trim(), kicker: clean(m.kicker, 120).trim(), lead: clean(m.lead, 700).trim(), cat: clean(m.cat, 30) || "ellada", sub: clean(m.sub, 30),
    also: (m.also || []).map((x) => clean(x, 30)).slice(0, 6), author: clean(m.author, 80).trim() || who.name, img };
}
async function handleWriter(b, who) {
  const st = store(); const pq = await getPending();
  const mineQ = () => pq.list.filter((x) => x.by && x.by.id === who.id).sort((a, c) => (c.upd || c.at).localeCompare(a.upd || a.at));
  if (b.action === "load" || b.action === "mine") { const ix = await getIndex(); return json({ ok: true, state: { settings: { name: (ix.settings || {}).name || "" }, articles: [], ads: [] }, list: mineQ() }); }
  if (b.action === "pget") { const it = mineQ().find((x) => x.pid === b.pid); if (!it) return json({ ok: false, error: "id" }, 404); return json({ ok: true, item: it, body: await pBody(it.pid) }); }
  if (b.action === "submit") {
    const meta = pMeta(b.meta || {}, who); if (!meta.title) return json({ ok: false, error: "title" }, 400);
    let it = b.pid ? mineQ().find((x) => x.pid === b.pid && (x.st === "pending" || x.st === "returned")) : null;
    if (b.pid && !it) return json({ ok: false, error: "id" }, 404);
    if (!it) { if (pq.list.filter((x) => x.st === "pending").length >= 200) return json({ ok: false, error: "full" }, 400); it = { pid: rid(), by: { id: who.id, name: who.name }, at: new Date().toISOString() }; pq.list.push(it); }
    Object.assign(it, { st: "pending", meta, upd: new Date().toISOString() });
    await st.set("p/" + it.pid + ".json", JSON.stringify({ pid: it.pid, body: clean(b.body, 120000) }));
    await setPending(trimQ(pq)); return json({ ok: true, item: it });
  }
  if (b.action === "withdraw") {
    const i = pq.list.findIndex((x) => x.pid === b.pid && x.by && x.by.id === who.id && (x.st === "pending" || x.st === "returned")); if (i < 0) return json({ ok: false, error: "id" }, 404);
    pq.list.splice(i, 1); await st.delete("p/" + b.pid + ".json"); await setPending(pq); return json({ ok: true });
  }
  return json({ ok: false, error: "role" }, 403);
}

async function handleSave(req) {
  let b; try { b = await req.json(); } catch { return json({ ok: false, error: "json" }, 400); }
  const who = await auth(b.pass);
  if (!who) return json({ ok: false, error: "pass" }, 401);
  const st = store();
  if (b.action === "login") return json({ ok: true, role: who.role, name: who.name || "" });
  if (who.role === "writer") return handleWriter(b, who);
  const ix = await getIndex();
  if (b.action === "load") { const pq = await getPending(); return json({ ok: true, state: ix, pend: pq.list.filter((x) => x.st === "pending").length }); }
  if (b.action === "body") return json({ ok: true, body: await getBody(String(b.id || "")) });
  const upsert = async (item) => {
    const body = clean(item.body, 120000);
    const i = ix.articles.findIndex((a) => a.id === item.meta.id);
    const meta = normMeta(item.meta, body, i >= 0 ? ix.articles[i] : null);
    if (!meta.title) throw new Error("title");
    await st.set("a/" + meta.id + ".json", JSON.stringify({ id: meta.id, body }));
    if (i >= 0) ix.articles[i] = meta; else ix.articles.push(meta);
    return meta;
  };
  try {
    if (b.action === "saveArticle") { const meta = await upsert(b); const when = await saveIndex(ix); return json({ ok: true, meta, when }); }
    if (b.action === "saveMany") {
      if (!Array.isArray(b.items) || b.items.length > 80) return json({ ok: false, error: "items" }, 400);
      const metas = []; for (const it of b.items) metas.push(await upsert(it));
      const when = await saveIndex(ix); return json({ ok: true, metas, when });
    }
    if (b.action === "delete") {
      const i = ix.articles.findIndex((a) => a.id === b.id); if (i < 0) return json({ ok: false, error: "id" }, 404);
      ix.trash = [ { ...ix.articles[i], deleted: new Date().toISOString() }, ...(ix.trash || []) ].slice(0, 300);
      ix.articles.splice(i, 1); const when = await saveIndex(ix); return json({ ok: true, when });
    }
    if (b.action === "restore") {
      const i = (ix.trash || []).findIndex((a) => a.id === b.id); if (i < 0) return json({ ok: false, error: "id" }, 404);
      const m = ix.trash.splice(i, 1)[0]; delete m.deleted; ix.articles.push(m); const when = await saveIndex(ix); return json({ ok: true, when });
    }
    if (b.action === "purge") {
      ix.trash = (ix.trash || []).filter((a) => a.id !== b.id); await st.delete("a/" + b.id + ".json"); const when = await saveIndex(ix); return json({ ok: true, when });
    }
    if (b.action === "order") {   // σειρά των καρφιτσωμένων στην αρχική: ids = [κύριο θέμα, 2ο, 3ο…]
      if (!Array.isArray(b.ids)) return json({ ok: false }, 400);
      const ids = b.ids.slice(0, 40).map((x) => clean(x, 30));
      for (const a of ix.articles) { const r = ids.indexOf(a.id); if (r >= 0) { a.feat = true; a.rank = r + 1; } else if (a.feat) { a.feat = false; delete a.rank; } }
      const when = await saveIndex(ix); return json({ ok: true, when });
    }
    if (b.action === "saveAds") {
      if (!Array.isArray(b.ads)) return json({ ok: false }, 400);
      ix.ads = b.ads.slice(0, 60).map((a) => ({ id: clean(a.id, 40) || rid(), name: clean(a.name, 120), link: clean(a.link, 400), slot: a.slot === "wide" ? "wide" : "side", after: clean(a.after, 30),
        on: a.on !== false, from: clean(a.from, 10), to: clean(a.to, 10), img: a.img && a.img.u ? { u: clean(a.img.u, 300), w: +a.img.w || 600, h: +a.img.h || 340 } : null }));
      const when = await saveIndex(ix); return json({ ok: true, when });
    }
    if (b.action === "saveSettings") {
      const s = b.settings || {}; const o = {};
      for (const k of ["name", "tagline", "description", "email", "phone", "advertise", "mit", "facebook", "instagram", "youtube", "tiktok", "publisher", "director", "editor", "address", "afm", "about", "contactNote"]) o[k] = clean(s[k], k === "description" ? 400 : k === "about" || k === "contactNote" ? 4000 : 200).trim();
      o.feedNoDup = s.feedNoDup !== false;
      ix.settings = o; const when = await saveIndex(ix); return json({ ok: true, when });
    }
    /* ---- συντάκτες ---- */
    if (b.action === "staffList") return json({ ok: true, list: (await getStaff()).list });
    if (b.action === "staffAdd") {
      const name = clean(b.name, 80).trim(); if (!name) return json({ ok: false, error: "name" }, 400);
      const sf = await getStaff(); if (sf.list.length >= 40) return json({ ok: false, error: "max" }, 400);
      const w = { id: rid(), name, code: await newCode(sf), on: true, at: new Date().toISOString() };
      sf.list.push(w); await setStaff(sf); return json({ ok: true, w });
    }
    if (b.action === "staffSet" || b.action === "staffCode" || b.action === "staffDel") {
      const sf = await getStaff(); const i = sf.list.findIndex((x) => x.id === b.id); if (i < 0) return json({ ok: false, error: "id" }, 404);
      if (b.action === "staffDel") sf.list.splice(i, 1);
      else if (b.action === "staffCode") sf.list[i].code = await newCode(sf);
      else { if (b.name != null && clean(b.name, 80).trim()) sf.list[i].name = clean(b.name, 80).trim(); if (b.on != null) sf.list[i].on = !!b.on; }
      await setStaff(sf); return json({ ok: true, list: sf.list });
    }
    /* ---- άρθρα που περιμένουν έγκριση ---- */
    if (b.action === "plist") return json({ ok: true, list: (await getPending()).list });
    if (b.action === "pget") { const it = (await getPending()).list.find((x) => x.pid === b.pid); if (!it) return json({ ok: false, error: "id" }, 404); return json({ ok: true, item: it, body: await pBody(it.pid) }); }
    if (b.action === "approve") {
      const pq = await getPending(); const it = pq.list.find((x) => x.pid === b.pid && x.st === "pending"); if (!it) return json({ ok: false, error: "id" }, 404);
      const meta = await upsert({ meta: { ...b.meta, id: undefined, draft: false }, body: b.body });
      const when = await saveIndex(ix);
      Object.assign(it, { st: "approved", aid: meta.id, slug: meta.slug, upd: new Date().toISOString(), note: "" });
      await setPending(trimQ(pq)); await st.delete("p/" + it.pid + ".json");
      return json({ ok: true, meta, when });
    }
    if (b.action === "preturn" || b.action === "preject") {
      const pq = await getPending(); const it = pq.list.find((x) => x.pid === b.pid && x.st === "pending"); if (!it) return json({ ok: false, error: "id" }, 404);
      it.st = b.action === "preturn" ? "returned" : "rejected"; it.note = clean(b.note, 1500).trim(); it.upd = new Date().toISOString();
      await setPending(trimQ(pq)); return json({ ok: true });
    }
    if (b.action === "undo") {
      const prev = await st.get("index-prev.json"); if (!prev) return json({ ok: false, error: "none" }, 404);
      await st.set("index.json", prev); if (purgeCache) { try { await purgeCache({ tags: ["kantas"] }); } catch {} }
      return json({ ok: true });
    }
  } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }
  return json({ ok: false, error: "action" }, 400);
}

export default async (req) => {
  const u = new URL(req.url); const p = u.pathname.replace(/\/+$/, "");
  if (p === "/api/status") return json({ ok: true });
  if (p === "/api/save") { if (req.method !== "POST") return json({ ok: false }, 405); return handleSave(req); }
  if (p === "/api/upload") {
    if (req.method !== "POST") return json({ ok: false }, 405);
    if (!(await auth(req.headers.get("x-pass")))) return json({ ok: false, error: "pass" }, 401);
    const type = (req.headers.get("content-type") || "").split(";")[0];
    if (!TYPES[type]) return json({ ok: false, error: "type" }, 415);
    const buf = await req.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > 6 * 1024 * 1024) return json({ ok: false, error: "size" }, 413);
    const key = new Date().toISOString().slice(0, 10) + "-" + crypto.randomUUID().slice(0, 8) + "." + TYPES[type];
    await images().set(key, buf, { metadata: { type } });
    return json({ ok: true, url: "/api/img/" + key });
  }
  if (p.startsWith("/api/img/")) {
    const key = p.slice(9);
    if (!/^[\w.-]+$/.test(key)) return new Response("", { status: 400 });
    const r = await images().getWithMetadata(key, { type: "arrayBuffer" });
    if (!r || !r.data) return new Response("", { status: 404 });
    return new Response(r.data, { headers: { "content-type": (r.metadata && r.metadata.type) || "image/webp", "cache-control": "public, max-age=31536000, immutable" } });
  }
  return json({ ok: false }, 404);
};
export const config = { path: "/api/*" };
