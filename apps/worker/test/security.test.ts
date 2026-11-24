import { test } from "node:test";
import assert from "node:assert/strict";
import { securityHeaders } from "../src/security";
import { testWorker } from "./helpers/worker";
import { readFileSync } from "node:fs";

// Security headers on every response (W4 in supporting-docs/platform-audit-tracker-2026-11-24.md).
// Framing: the embed is for other sites and the kiosk for signage players (and /display), so both
// may be framed by anyone; every other page only by mugilu itself. Scripts are not restricted yet:
// the pages' inline scripts move to files first (W20).

const SAME = "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'";
const OPEN = "frame-ancestors *; base-uri 'self'; object-src 'none'; form-action 'self'";
const at = (path: string) =>
  securityHeaders(
    new Request(`https://mugilu.live${path}`),
    new Response("x", { headers: { "content-type": "text/html" } }),
  );

test("securityHeaders: HSTS, nosniff, referrer and permissions on any response", () => {
  const h = at("/c/delhi").headers;
  assert.equal(h.get("strict-transport-security"), "max-age=31536000; includeSubDomains");
  assert.equal(h.get("x-content-type-options"), "nosniff");
  assert.equal(h.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.equal(h.get("permissions-policy"), "geolocation=(self), camera=(), microphone=()");
  assert.equal(h.get("content-type"), "text/html", "the response's own headers stay");
});

test("securityHeaders: only the embed and the kiosk may be framed by other sites", () => {
  assert.equal(at("/c/delhi").headers.get("content-security-policy"), SAME);
  assert.equal(at("/").headers.get("content-security-policy"), SAME);
  assert.equal(at("/embed/12.97,77.59").headers.get("content-security-policy"), OPEN);
  assert.equal(at("/kn/embed/12.97,77.59").headers.get("content-security-policy"), OPEN, "in every language");
  assert.equal(at("/c/bengaluru?kiosk").headers.get("content-security-policy"), OPEN);
  assert.equal(at("/hi/c/bengaluru?kiosk&as=asthma").headers.get("content-security-policy"), OPEN);
  assert.equal(at("/embedded").headers.get("content-security-policy"), SAME, "a prefix is not the embed");
});

test("securityHeaders: a redirect (immutable headers) still gets them, with its status and location", () => {
  const r = securityHeaders(
    new Request("https://www.mugilu.live/c/delhi"),
    Response.redirect("https://mugilu.live/c/delhi", 301),
  );
  assert.equal(r.status, 301);
  assert.equal(r.headers.get("location"), "https://mugilu.live/c/delhi");
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
});

test("worker: every route type carries the headers, a cached second view and a 404 too", async () => {
  const w = testWorker();
  for (const path of ["/", "/c/delhi", "/c/delhi", "/warnings", "/places", "/llms.txt", "/sitemap.xml", "/nope"]) {
    const res = await w.get(path);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff", path);
    assert.equal(res.headers.get("content-security-policy"), SAME, path);
  }
  assert.equal((await w.get("/c/bengaluru?kiosk")).headers.get("content-security-policy"), OPEN);
});

test("public/_headers: the static files get the same base headers", () => {
  const file = readFileSync(new URL("../public/_headers", import.meta.url), "utf8");
  const all = file.slice(file.indexOf("\n/*\n"));
  const h = at("/").headers;
  for (const k of ["Strict-Transport-Security", "X-Content-Type-Options", "Referrer-Policy"])
    assert.ok(all.includes(`  ${k}: ${h.get(k)}`), k);
});
