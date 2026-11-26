/* Κοινά για τις functions. Όλο το περιεχόμενο ζει στο Netlify Blobs:
   κάθε αλλαγή από τον πίνακα φαίνεται αμέσως και ΔΕΝ κάνει deploy (0 credits). */
import { getStore } from "@netlify/blobs";
import { SEED } from "./_seed.mjs";
// sha-256 του κωδικού του πίνακα. Αλλάζει εδώ ή με τη μεταβλητή ADMIN_PASS στο Netlify (κερδίζει).
export const PASS_SHA256 = "d0573e62c9b62697854879b25c5b58be32aaf5acfb78b42daf9da0a26c30520e";
export const store = () => getStore({ name: "kantas-content", consistency: "strong" });
export const images = () => getStore("kantas-images");
export const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
async function sha256(t) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
export async function checkPass(p) {
  if (typeof p !== "string" || !p) return false;
  const ok = process.env.ADMIN_PASS ? p === process.env.ADMIN_PASS : (await sha256(p)) === PASS_SHA256;
  if (!ok) await new Promise((r) => setTimeout(r, 700));
  return ok;
}
/* Συντάκτες: κάθε δημοσιογράφος έχει δικό του κωδικό. Τα άρθρα του ΔΕΝ δημοσιεύονται —
   πάνε «Για έγκριση» και τα δημοσιεύει μόνο ο εκδότης (κωδικός διαχειριστή).
   staff.json = { list: [{ id, name, code, on, at }] }   pending.json = { list: [{ pid, by:{id,name}, st, at, upd, meta, note, aid }] } */
export async function getStaff() { const t = await store().get("staff.json"); return t ? JSON.parse(t) : { list: [] }; }
export async function setStaff(x) { await store().set("staff.json", JSON.stringify(x)); }
export async function getPending() { const t = await store().get("pending.json"); return t ? JSON.parse(t) : { list: [] }; }
export async function setPending(x) { await store().set("pending.json", JSON.stringify(x)); }
/* Ποιος μπαίνει: { role: "admin" } ή { role: "writer", id, name } ή null */
export async function auth(p) {
  if (typeof p !== "string" || !p) return null;
  const isAdmin = process.env.ADMIN_PASS ? p === process.env.ADMIN_PASS : (await sha256(p)) === PASS_SHA256;
  if (isAdmin) return { role: "admin" };
  const w = (await getStaff()).list.find((x) => x.on !== false && x.code === p);
  if (w) return { role: "writer", id: w.id, name: w.name };
  await new Promise((r) => setTimeout(r, 700));
  return null;
}
/* Το ευρετήριο (ρυθμίσεις, διαφημίσεις, όλα τα άρθρα χωρίς το κείμενο). Την πρώτη φορά γράφει το αρχικό περιεχόμενο. */
export async function getIndex() {
  const st = store();
  let t = await st.get("index.json");
  if (!t) {
    await st.set("index.json", JSON.stringify(SEED.state));
    for (const [id, body] of Object.entries(SEED.bodies)) await st.set("a/" + id + ".json", JSON.stringify({ id, body }));
    return structuredClone(SEED.state);
  }
  return JSON.parse(t);
}
export async function getBody(id) {
  if (!/^[\w-]+$/.test(id)) return "";
  const t = await store().get("a/" + id + ".json");
  if (t) return JSON.parse(t).body || "";
  return SEED.bodies[id] || "";
}
