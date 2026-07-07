import { test } from "node:test";
import assert from "node:assert/strict";
import { openApiSpec, llmsTxt, sitemapXml } from "../src/meta";

test("openApiSpec: a valid 3.1 spec covering the read endpoints", () => {
  const s = openApiSpec("https://mugilu.live") as any;
  assert.equal(s.openapi, "3.1.0");
  assert.equal(s.servers[0].url, "https://mugilu.live");
  assert.equal(s.paths["/c/{coord}.json"].get.operationId, "conditionsAt");
  assert.ok(s.paths["/near"] && s.paths["/suggest"] && s.paths["/warnings.json"] && s.paths["/index.json"]);
  const params = s.paths["/c/{coord}.json"].get.parameters.map((p: any) => p.name);
  assert.ok(params.includes("coord") && params.includes("as") && params.includes("ref"));
});

test("llms.txt: advertises the MCP server + the OpenAPI spec", () => {
  const t = llmsTxt("https://mugilu.live");
  assert.match(t, /MCP server.*\/mcp/);
  assert.match(t, /openapi\.json/);
});

test("sitemap.xml: every URL carries a <lastmod> (crawl-freshness signal)", () => {
  const xml = sitemapXml("https://mugilu.live");
  const locs = (xml.match(/<loc>/g) || []).length;
  const mods = (xml.match(/<lastmod>/g) || []).length;
  assert.ok(locs > 100, "has the slug pages");
  assert.equal(mods, locs, "every <url> has a <lastmod>");
  // explainer pages get the fixed date; live pages get a fresh (YYYY-MM-DD) date
  assert.match(xml, /<loc>https:\/\/mugilu\.live\/about<\/loc><lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
});

test("sitemap.xml: lists the /places directory (the crawlable index of place pages)", () => {
  const xml = sitemapXml("https://mugilu.live");
  assert.match(xml, /<loc>https:\/\/mugilu\.live\/places<\/loc>/);
});

test("sitemap.xml: place pages carry a stable lastmod (not a daily-churning one)", () => {
  const xml = sitemapXml("https://mugilu.live");
  const lastmodOf = (loc: string) => {
    const m = xml.match(
      new RegExp(`<loc>${loc.replace(/[.\\/]/g, "\\$&")}</loc><lastmod>(\\d{4}-\\d{2}-\\d{2})</lastmod>`),
    );
    return m && m[1];
  };
  // a place page shares the explainers' fixed date, so stamping ~800 pages "today"
  // every day doesn't teach crawlers to distrust our lastmod.
  const about = lastmodOf("https://mugilu.live/about");
  assert.ok(about, "explainer has a lastmod");
  assert.equal(lastmodOf("https://mugilu.live/c/bengaluru"), about);
  assert.equal(lastmodOf("https://mugilu.live/c/mumbai"), about);
});

test("sitemap.xml: hreflang alternates pair the en/hi/kn versions (+ x-default)", () => {
  const xml = sitemapXml("https://mugilu.live");
  assert.match(xml, /xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/);
  // home: English unprefixed, hi/kn prefixed, x-default = English
  assert.match(xml, /<xhtml:link rel="alternate" hreflang="en" href="https:\/\/mugilu\.live"\/>/);
  assert.match(xml, /<xhtml:link rel="alternate" hreflang="kn" href="https:\/\/mugilu\.live\/kn"\/>/);
  assert.match(xml, /<xhtml:link rel="alternate" hreflang="x-default" href="https:\/\/mugilu\.live"\/>/);
  // a deep page keeps its path under the language prefix
  assert.match(xml, /<xhtml:link rel="alternate" hreflang="hi" href="https:\/\/mugilu\.live\/hi\/about"\/>/);
});
