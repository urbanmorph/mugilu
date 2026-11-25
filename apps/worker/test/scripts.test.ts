// W20: no page runs an inline script but the theme's (allowed by its hash), so the CSP can
// restrict scripts. Each page's script is a file the asset route rebuilds from its URL.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { testWorker } from "./helpers/worker";
import { THEME_HEAD_JS } from "../src/ui/components";
import { THEME_HEAD_SHA } from "../src/security";

const w = testWorker();
const PAGES = [
  "/",
  "/c/delhi",
  "/c/delhi?as=asthma",
  "/c/visakhapatnam",
  "/s/cpcb/6081",
  "/display",
  "/display?as=heart",
  "/about",
  "/methodology",
  "/terms",
  "/places",
  "/warnings",
  "/c/delhi?kiosk",
  "/embed/12.97,77.59",
  "/c/zzqqxx",
  "/c/delhi/warnings",
];
const paths = ["", "/hi", "/kn"].flatMap((l) => PAGES.map((p) => l + (p === "/" && l ? "" : p)));

test("THEME_HEAD_SHA is the hash of the one inline script", () => {
  assert.equal(THEME_HEAD_SHA, `'sha256-${createHash("sha256").update(THEME_HEAD_JS).digest("base64")}'`);
});

test("every page: no inline script but the theme's; its script file is served, immutable", async () => {
  const seen = new Set<string>();
  for (const p of paths) {
    const res = await w.get(p, { headers: { accept: "text/html" } });
    const html = await res.text();
    for (const m of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
      const attrs = m[1] ?? "";
      if (/type="application\/(ld\+)?json"/.test(attrs) || /\ssrc="/.test(attrs)) continue;
      assert.equal(m[2], THEME_HEAD_JS, `${p}: inline script ${m[2].slice(0, 60)}`);
    }
    for (const [, src] of html.matchAll(/<script src="(\/assets\/js\/[^"]+)"/g)) {
      if (seen.has(src)) continue;
      seen.add(src);
      const js = await w.get(src);
      assert.equal(js.status, 200, `${p}: ${src}`);
      assert.match(js.headers.get("content-type") ?? "", /^text\/javascript/);
      assert.match(js.headers.get("cache-control") ?? "", /immutable/, `${p}: ${src} rebuilt to the same content`);
      assert.ok((await js.text()).length > 0);
    }
  }
  assert.ok(seen.size >= 20, `${seen.size} distinct script files`);
});

test("script route: an old hash gets the current file briefly; unknown names and personas are 404", async () => {
  const html = await (await w.get("/c/delhi")).text();
  const src = html.match(/<script src="(\/assets\/js\/[^"]+)"/)![1];
  const old = await w.get(src.replace(/-[0-9a-z]+\.js$/, "-0.js"));
  assert.equal(old.status, 200);
  assert.equal(old.headers.get("cache-control"), "public, max-age=300");
  for (const bad of [
    "/assets/js/en/page/1/nope-1.js",
    "/assets/js/en/page/0/display.evil-1.js",
    "/assets/js/xx/page/0/base-1.js",
  ])
    assert.equal((await w.get(bad)).status, 404, bad);
});

test("CSP: scripts restricted in report-only mode, to mugilu, the theme hash and the analytics beacon", async () => {
  const res = await w.get("/c/delhi");
  const ro = res.headers.get("content-security-policy-report-only") ?? "";
  assert.match(ro, /script-src 'self' 'sha256-[^']+' https:\/\/static\.cloudflareinsights\.com/);
  assert.ok(ro.includes(THEME_HEAD_SHA));
  assert.match(ro, /report-uri \/csp-report/);
  assert.doesNotMatch(res.headers.get("content-security-policy") ?? "", /script-src/, "not enforced yet");
});

test("/csp-report: a report is logged and answered 204; anything else there is refused", async () => {
  const report = {
    "csp-report": {
      "document-uri": "https://mugilu.live/c/delhi",
      "violated-directive": "script-src-elem",
      "blocked-uri": "inline",
    },
  };
  const res = await w.get("/csp-report", {
    method: "POST",
    headers: { "content-type": "application/csp-report" },
    body: JSON.stringify(report),
  });
  assert.equal(res.status, 204);
  assert.equal((await w.get("/csp-report")).status, 405);
});

test("home prerenders the first of Your places through a rule file, not an inline script", async () => {
  const res = await w.get("/");
  const link = res.headers.get("speculation-rules");
  assert.match(link ?? "", /^"\/assets\/speculation-[0-9a-z]+\.json"$/);
  const rules = await w.get(JSON.parse(link!));
  assert.equal(rules.headers.get("content-type"), "application/speculationrules+json");
  const body = (await rules.json()) as { prerender: { where: { selector_matches: string } }[] };
  assert.equal(body.prerender[0].where.selector_matches, "#yp ul.yp li:first-child a");
  const html = await res.text();
  assert.match(html, /<section class="panel" id="yp" hidden[\s\S]*<ul class="yp[ "]/, "the list the rule points at");
});
