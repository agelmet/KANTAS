/* /api/*  — ο πίνακας διαχείρισης.
   POST /api/save   {pass, action, …}       (login, load, body, saveArticle, saveMany, delete, restore, purge, saveAds, saveSettings, undo)
   POST /api/upload (x-pass, σώμα = εικόνα) → {url}
   GET  /api/img/<key>   φωτογραφίες που ανέβηκαν από τον πίνακα
   GET  /api/status      «είμαι στο live»                                             */
import { store, images, json, checkPass, getIndex, getBody } from "./_lib.mjs";
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
    author: clean(m.author, 80).trim(), feat: !!m.feat, draft: !!m.draft, ex: excerpt(body), words: String(body).split(/\s+/).length };
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

async function handleSave(req) {
  let b; try { b = await req.json(); } catch { return json({ ok: false, error: "json" }, 400); }
  if (!(await checkPass(b.pass))) return json({ ok: false, error: "pass" }, 401);
  const st = store();
  if (b.action === "login") return json({ ok: true });
  const ix = await getIndex();
  if (b.action === "load") return json({ ok: true, state: ix });
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
    if (b.action === "saveAds") {
      if (!Array.isArray(b.ads)) return json({ ok: false }, 400);
      ix.ads = b.ads.slice(0, 60).map((a) => ({ id: clean(a.id, 40) || rid(), name: clean(a.name, 120), link: clean(a.link, 400), slot: a.slot === "wide" ? "wide" : "side",
        on: a.on !== false, from: clean(a.from, 10), to: clean(a.to, 10), img: a.img && a.img.u ? { u: clean(a.img.u, 300), w: +a.img.w || 600, h: +a.img.h || 340 } : null }));
      const when = await saveIndex(ix); return json({ ok: true, when });
    }
    if (b.action === "saveSettings") {
      const s = b.settings || {}; const o = {};
      for (const k of ["name", "tagline", "description", "email", "phone", "advertise", "mit", "facebook", "instagram", "youtube", "tiktok"]) o[k] = clean(s[k], k === "description" ? 400 : 200).trim();
      ix.settings = o; const when = await saveIndex(ix); return json({ ok: true, when });
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
    if (!(await checkPass(req.headers.get("x-pass")))) return json({ ok: false, error: "pass" }, 401);
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
