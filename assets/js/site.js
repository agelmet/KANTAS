/* perifereia24.gr — συμπεριφορά σελίδας. Στο προσχέδιο (GitHub Pages) φτιάχνει και τις σελίδες (?k= / ?a= / ?q=). */
import { route, headerHtml, footerHtml } from "./shared.js";

const root = document.documentElement;
root.classList.add("js");
const MODE = root.dataset.mode;
const ctx = { mode: MODE, base: MODE === "live" ? "/" : "", now: new Date() };
const TRIAL_KEY = "kantas-trial";

function readTrial() { try { return JSON.parse(localStorage.getItem(TRIAL_KEY) || "null"); } catch { return null; } }

async function draftRender() {
  const el = document.getElementById("data"); if (!el) return;
  let state = JSON.parse(el.textContent);
  const trial = readTrial();
  if (trial && trial.state) state = trial.state;
  const p = new URLSearchParams(location.search);
  const a = p.get("a"), k = p.get("k"), s = p.get("s") || "", q = p.get("q"), pg = p.get("p"), page = +p.get("page") || 1;
  if (!a && !k && q == null && !pg && !trial) return; // η αρχική είναι ήδη έτοιμη
  let body = "";
  if (a) {
    body = trial && trial.bodies && trial.bodies[a] != null ? trial.bodies[a] : "";
    if (!body) { try { const r = await fetch("a/" + a + ".json", { cache: "no-store" }); if (r.ok) body = (await r.json()).body || ""; } catch {} }
  }
  const r = route(state, ctx, { a, k, s, q, page, body, p: pg });
  document.title = r.title;
  const d = document.querySelector('meta[name="description"]'); if (d) d.content = r.desc || "";
  document.getElementById("hdr").innerHTML = headerHtml(state, ctx, r.active);
  document.getElementById("main").innerHTML = r.main;
  document.getElementById("ftr").innerHTML = footerHtml(state, ctx);
  if (trial) {
    const bar = document.createElement("div"); bar.className = "trial";
    bar.innerHTML = 'Βλέπετε τη <b>δοκιμή</b> από τον πίνακα διαχείρισης (μόνο σε αυτή τη συσκευή). <a href="admin.html">Πίνακας</a> · <a href="#" data-endtrial>Κανονική προβολή</a>';
    document.body.prepend(bar);
    bar.querySelector("[data-endtrial]").onclick = (e) => { e.preventDefault(); if (confirm("Να σβηστεί η δοκιμή από αυτή τη συσκευή;")) { localStorage.removeItem(TRIAL_KEY); location.reload(); } };
  }
  if (a) window.scrollTo(0, 0);
}

function behave() {
  // σημερινή ημερομηνία (αν η σελίδα ήρθε από cache)
  const t = document.querySelector("[data-today]");
  if (t) t.textContent = new Intl.DateTimeFormat("el-GR", { timeZone: "Europe/Athens", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  const nav = document.querySelector(".nav");
  if (nav) { const io = new IntersectionObserver(([e]) => nav.classList.toggle("sh", !e.isIntersecting)); const m = document.querySelector(".mast"); if (m) io.observe(m); }
  document.addEventListener("click", async (e) => {
    const el = e.target.closest("[data-search],[data-search-close],[data-burger],[data-mnav-close],[data-copy],[data-zoom],.lb,.mnav");
    if (!el) return;
    if (el.matches("[data-search]")) { const b = document.querySelector("[data-srchbox]"); b.hidden = !b.hidden; if (!b.hidden) b.querySelector("input").focus(); }
    else if (el.matches("[data-search-close]")) document.querySelector("[data-srchbox]").hidden = true;
    else if (el.matches("[data-burger]")) { const m = document.querySelector("[data-mnav]"); m.hidden = false; el.setAttribute("aria-expanded", "true"); document.body.style.overflow = "hidden"; m.querySelector(".x").focus(); }
    else if (el.matches("[data-mnav-close]") || (el.matches(".mnav") && e.target === el)) closeMnav();
    else if (el.matches("[data-copy]")) {
      const w = el.closest("[data-share]"); const url = w.dataset.url || location.href;
      if (navigator.share && matchMedia("(hover:none)").matches) { try { await navigator.share({ title: w.dataset.title, url }); } catch {} return; }
      try { await navigator.clipboard.writeText(url); el.classList.add("ok"); el.setAttribute("aria-label", "Αντιγράφηκε"); setTimeout(() => el.classList.remove("ok"), 1600); } catch {}
    } else if (el.matches("[data-zoom]")) { const lb = document.querySelector("[data-lb]"); lb.querySelector("img").src = el.dataset.zoom; lb.hidden = false; lb.querySelector(".x").focus(); }
    else if (el.matches(".lb")) { el.hidden = true; }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeMnav(); const lb = document.querySelector("[data-lb]"); if (lb) lb.hidden = true; const s = document.querySelector("[data-srchbox]"); if (s) s.hidden = true; } });
  function closeMnav() { const m = document.querySelector("[data-mnav]"); if (!m || m.hidden) return; m.hidden = true; document.body.style.overflow = ""; const b = document.querySelector("[data-burger]"); if (b) { b.setAttribute("aria-expanded", "false"); b.focus(); } }
  // απαλή εμφάνιση καρτών (το περιεχόμενο είναι πάντα ορατό χωρίς JS)
  if (!matchMedia("(prefers-reduced-motion:reduce)").matches && "IntersectionObserver" in window && !document.hidden) {
    const els = document.querySelectorAll(".blk,.cgrid .c,.rel,.wide");
    const io = new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); } }), { rootMargin: "0px 0px -6% 0px" });
    els.forEach((x) => { if (x.getBoundingClientRect().top > innerHeight) { x.classList.add("rv"); io.observe(x); } });
    setTimeout(() => els.forEach((x) => x.classList.add("in")), 4000);
  }
}

(async () => { if (MODE !== "live") { try { await draftRender(); } catch (e) { console.warn(e); } } behave(); })();
