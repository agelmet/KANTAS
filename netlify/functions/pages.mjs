/* Οι σελίδες του site στο live, φτιαγμένες τη στιγμή από το Netlify Blobs:
   /  /kat/<ενότητα>[/<υπο>]  /arthro/<id>/<slug>  /roi  /anazitisi  /sitemap.xml  /news-sitemap.xml  /rss.xml
   Κρατιούνται στο CDN και καθαρίζουν (purge) σε κάθε αποθήκευση από τον πίνακα. */
import { getIndex, getBody } from "./_lib.mjs";
import { route, docHtml, visible, links, catOf, CATS, esc, imgSrc } from "./_shared.mjs";
import { V } from "./_seed.mjs";

const H = (type, extra = {}) => ({ "content-type": type, "cache-control": "public, max-age=0, must-revalidate",
  "netlify-cdn-cache-control": "public, durable, s-maxage=600, stale-while-revalidate=120", "netlify-cache-tag": "kantas", ...extra });

export default async (req) => {
  const u = new URL(req.url); const origin = u.origin; let p = decodeURIComponent(u.pathname);
  if (p.length > 1 && p.endsWith("/")) return Response.redirect(origin + p.slice(0, -1) + u.search, 301);
  const state = await getIndex();
  const ctx = { mode: "live", base: "/", now: new Date(), origin };
  const L = links(ctx);
  const all = visible(state, ctx.now);
  if (p === "/sitemap.xml") {
    const urls = [["/", all[0] && all[0].date], ["/roi"], ["/epikoinonia"], ["/taftotita"], ...CATS.flatMap((c) => [["/kat/" + c.k], ...(c.subs || []).map(([s]) => ["/kat/" + c.k + "/" + s])]),
      ...all.slice(0, 5000).map((m) => [L.art(m), m.upd || m.date])];
    return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(([x, d]) => `<url><loc>${esc(origin + x)}</loc>${d ? `<lastmod>${d}</lastmod>` : ""}</url>`).join("")}</urlset>`, { headers: H("application/xml; charset=utf-8") });
  }
  if (p === "/news-sitemap.xml") {
    const two = Date.now() - 2 * 864e5; const site = (state.settings || {}).name || "";
    return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${all.filter((m) => new Date(m.date) > two).slice(0, 1000).map((m) => `<url><loc>${esc(origin + L.art(m))}</loc><news:news><news:publication><news:name>${esc(site)}</news:name><news:language>el</news:language></news:publication><news:publication_date>${m.date}</news:publication_date><news:title>${esc(m.title)}</news:title></news:news></url>`).join("")}</urlset>`, { headers: H("application/xml; charset=utf-8") });
  }
  if (p === "/rss.xml") {
    const st = state.settings || {};
    return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${esc(st.name)}</title><link>${origin}/</link><description>${esc(st.tagline || "")}</description><language>el</language><atom:link href="${origin}/rss.xml" rel="self" type="application/rss+xml"/>${all.slice(0, 40).map((m) => `<item><title>${esc(m.title)}</title><link>${esc(origin + L.art(m))}</link><guid>${esc(origin + L.art(m))}</guid><pubDate>${new Date(m.date).toUTCString()}</pubDate><category>${esc(catOf(m.cat).t)}</category><description>${esc(m.lead || m.ex || "")}</description>${m.img && m.img.u ? `<enclosure url="${esc(origin + imgSrc(m.img, ctx, 960))}" type="image/webp" length="0"/>` : ""}</item>`).join("")}</channel></rss>`, { headers: H("application/rss+xml; charset=utf-8") });
  }
  const page = +u.searchParams.get("page") || 1;
  let opts = null;
  if (p === "/" || p === "/index.html") opts = {};
  else if (p === "/roi") opts = { k: "roi", page };
  else if (p === "/epikoinonia" || p === "/taftotita") opts = { p: p.slice(1) };
  else if (p === "/anazitisi") opts = { q: u.searchParams.get("q") || "" };
  else { let m;
    if ((m = p.match(/^\/kat\/([a-z]+)(?:\/([a-z]+))?$/))) opts = { k: m[1], s: m[2] || "", page };
    else if ((m = p.match(/^\/arthro\/([\w-]+)(?:\/([\w-]*))?$/))) {
      const meta = state.articles.find((a) => a.id === m[1]);
      if (meta && m[2] !== meta.slug) return Response.redirect(origin + L.art(meta), 301);
      opts = { a: m[1], body: meta ? await getBody(m[1]) : "" };
    } else opts = { notFound: true };
  }
  const r = route(state, ctx, opts);
  return new Response(docHtml(state, ctx, r, { origin, v: V }), { status: r.status || 200, headers: H("text/html; charset=utf-8") });
};
export const config = { path: ["/", "/index.html", "/kat/*", "/arthro/*", "/roi", "/anazitisi", "/epikoinonia", "/taftotita", "/sitemap.xml", "/news-sitemap.xml", "/rss.xml"] };
