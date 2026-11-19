// Every route, through the worker's own fetch(), over production-shaped data (test/helpers/worker.ts).
// The pages: the signage shell's landmarks and chrome on each, in every language. The data
// surfaces: status, type and the shape builders rely on. Write and admin routes: still gated.
import { test } from "node:test";
import assert from "node:assert/strict";
import { testWorker } from "./helpers/worker";
import { DISCLAIMER_FULL } from "../src/ui/components";
import { t, type Lang } from "../src/i18n";
import { esc } from "../src/html";

const w = testWorker();
const html = async (path: string, init?: RequestInit) => {
  const res = await w.get(path, init);
  assert.equal(res.status, 200, path);
  assert.match(res.headers.get("content-type") ?? "", /^text\/html/, path);
  return res.text();
};
const json = async (path: string) => {
  const res = await w.get(path);
  assert.equal(res.status, 200, path);
  assert.match(res.headers.get("content-type") ?? "", /^application\/(json|manifest\+json)/, path);
  return res.json() as Promise<Record<string, unknown>>;
};
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

const PAGES = [
  "/",
  "/c/delhi",
  "/c/28.61,77.21",
  "/c/delhi?as=asthma",
  "/c/visakhapatnam",
  "/s/cpcb/6081",
  "/display",
  "/about",
  "/methodology",
  "/terms",
  "/places",
  "/warnings",
];

for (const lang of ["", "/hi", "/kn"])
  for (const page of PAGES) {
    const path = lang + (page === "/" && lang ? "" : page);
    test(`${path}: the signage shell (skip link, one main, one h1, header nav, footer, theme switch, disclaimer)`, async () => {
      const h = await html(path);
      assert.match(h, /<body class="mg"/);
      assert.match(h, /<a class="skip" href="#main">/);
      assert.equal(count(h, /<main id="main"/g), 1);
      assert.equal(count(h, /<h1[\s>]/g), 1);
      assert.match(h, /<header class="sh">[\s\S]*<nav/);
      assert.match(h, /<footer class="sf">/);
      assert.equal(count(h, /<input[^>]*name="theme"/g), 3);
      assert.ok(h.includes(esc(t(DISCLAIMER_FULL, (lang.slice(1) || "en") as Lang))), "the full disclaimer");
      assert.match(h, new RegExp(`<html lang="${lang ? lang.slice(1) : "en"}"`));
      // one stylesheet (tokens + standard): no page CSS, and nothing of the old shell
      assert.equal(count(h, /<link rel="stylesheet" href="\/assets\/site-/g), 1);
      assert.doesNotMatch(h, /<style>/);
      assert.doesNotMatch(h, /class="topnav"|linear-gradient\(180deg,color-mix/);
    });
  }

test("/mcp: the page for a browser, JSON-RPC for a client", async () => {
  assert.match(await html("/mcp", { headers: { accept: "text/html" } }), /<main id="main"/);
  const res = await w.get("/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });
  assert.equal(res.status, 200);
  const body = await res.text();
  for (const tool of ["conditions_at", "search_place", "nearest_stations", "active_warnings", "national_now"])
    assert.ok(body.includes(tool), tool);
});

test("the place page carries a warning band only when a warning covers the place", async () => {
  const warned = await html("/c/visakhapatnam");
  assert.match(warned, /Severe Cyclonic Storm/);
  const calm = await html("/c/delhi");
  assert.doesNotMatch(calm, /class="[^"]*warnband/);
});

test("the kiosk: always dark, no site chrome, a QR, the full disclaimer", async () => {
  const h = await html("/c/delhi?kiosk");
  assert.match(h, /<html lang="en" data-theme="dark"/);
  assert.doesNotMatch(h, /<header class="sh">|<footer class="sf">/);
  assert.match(h, /<svg[^>]*class="[^"]*qrimg/);
  assert.ok(h.includes(DISCLAIMER_FULL));
});

test("the embed: no chrome, both disclaimers for the container query", async () => {
  const h = await html("/embed/28.61,77.21");
  assert.match(h, /data-embed/);
  assert.doesNotMatch(h, /<header class="sh">/);
  assert.ok(h.includes(DISCLAIMER_FULL));
  assert.ok(h.includes("Informational only, not medical advice."));
});

test("404: the signage page, with status 404", async () => {
  const res = await w.get("/no-such-page");
  assert.equal(res.status, 404);
  assert.match(await res.text(), /<main id="main"/);
});

test("data surfaces keep their shapes", async () => {
  const c = await json("/c/delhi.json");
  // the v1 contract, key for key as production serves it
  assert.deepEqual(Object.keys(c), [
    "schema",
    "version",
    "location",
    "place",
    "as_of",
    "refresh_after_seconds",
    "units",
    "air",
    "heat",
    "heat_vs_normal",
    "rain",
    "uv",
    "dust",
    "wind",
    "visibility",
    "smoke",
    "warnings",
    "nearby_warnings",
    "ambient",
    "attribution",
    "disclaimer",
  ]);
  const s = await json("/s/cpcb/6081.json");
  assert.deepEqual(Object.keys(s), ["generated_at", "units", "fresh_within_hours", "station"]);
  const wj = await json("/warnings.json");
  assert.ok(Array.isArray(wj.alerts));
  const ix = await json("/index.json");
  assert.ok(Array.isArray(ix.stations));
  const near = await json("/near?lat=28.6&lon=77.2");
  assert.ok(Array.isArray(near.stations));
  assert.ok(Array.isArray((await json("/suggest?q=del")).suggestions));
  for (const p of ["/openapi.json", "/.well-known/mcp.json", "/manifest.webmanifest"]) await json(p);
});

test("markdown and text surfaces", async () => {
  for (const [p, type] of [
    ["/c/delhi.md", /^text\/markdown/],
    ["/s/cpcb/6081.md", /^text\/markdown/],
    ["/warnings.md", /^text\/markdown/],
    ["/index.md", /^text\/markdown/],
    ["/robots.txt", /^text\/plain/],
    ["/llms.txt", /^text\/plain/],
    ["/sitemap.xml", /^application\/xml/],
    ["/sw.js", /^text\/javascript/],
    ["/favicon.svg", /^image\/svg\+xml/],
  ] as const) {
    const res = await w.get(p);
    assert.equal(res.status, 200, p);
    assert.match(res.headers.get("content-type") ?? "", type, p);
  }
});

test("/go sends a search to its place, keeping the kiosk", async () => {
  const res = await w.get("/go?q=delhi&kiosk=1");
  assert.equal(res.status, 302);
  assert.match(res.headers.get("location") ?? "", /\/c\/[^?]+\?kiosk/);
});

test("admin and write routes stay gated", async () => {
  for (const p of ["/api/counts", "/refresh", "/collect", "/warnings/collect", "/fires/collect"]) {
    const res = await w.get(p);
    assert.equal(res.status, 401, p);
  }
});

test("the place page's persona switch is links: no script needed, crawlable, arrow keys never navigate", async () => {
  const page = await html("/c/delhi?as=asthma");
  assert.match(page, /<nav class="segf" aria-labelledby="who">/);
  assert.match(page, /<a href="\/c\/delhi\?as=asthma" aria-current="page">/);
  assert.match(page, /<a href="\/c\/delhi">/);
  assert.doesNotMatch(page, /name="who"/);
});

test("the language links keep the persona, and the 404 page's lead to home", async () => {
  const page = await html("/c/delhi?as=asthma");
  assert.match(page, /<a href="\/hi\/c\/delhi\?as=asthma" lang="hi" hreflang="hi">/);
  const res = await w.get("/no-such-page", { headers: { accept: "text/html" } });
  const nf = await res.text();
  assert.match(nf, /<a href="\/hi" lang="hi" hreflang="hi">/);
  assert.doesNotMatch(nf, /href="\/hi\/404"/);
});

test("station links and the embed snippet are encoded and escaped", async () => {
  const { stationPath } = await import("../src/pages/read");
  assert.equal(stationPath("cpcb", 'x"/../y'), "/s/cpcb/x%22%2F..%2Fy");
  const embed = await html("/hi/embed/28.61,77.21");
  // The copy-paste snippet is shown as text, so its quotes are entities.
  assert.match(embed, /iframe src=&quot;https:\/\/mugilu\.live\/hi\/embed\/28\.61,77\.21&quot;/);
});
