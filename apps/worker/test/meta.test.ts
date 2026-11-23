import { test } from "node:test";
import assert from "node:assert/strict";
import { openApiSpec, llmsTxt, sitemapXml, robotsTxt, mcpJson } from "../src/meta";
import { TOOLS } from "../src/mcptools";

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

test("llms.txt + OpenAPI: one honest User-Agent request, and the MCP count by app", () => {
  const ask =
    "Please send a `User-Agent` that names your app (for example `my-app/1.0`). We read it only to tell apps, AI tools and crawlers apart, so our counts of how each mode is used stay honest. We don't store it, and we don't track who you are.";
  const t = llmsTxt("https://mugilu.live");
  assert.ok(t.includes(ask));
  assert.ok(t.includes("We count MCP calls by the app name your client sends, and keep nothing else."));
  const s = openApiSpec("https://mugilu.live") as any;
  assert.ok(s.info.description.includes(ask));
});

// One policy with yellide (overlooked, 23 Nov 2026): search and answers yes, model training and SEO
// backlink databases no. The Cloudflare zone blocks the same crawlers for those that ignore it.
const TRAINING = [
  "GPTBot",
  "ClaudeBot",
  "CCBot",
  "Google-Extended",
  "Applebot-Extended",
  "meta-externalagent",
  "Amazonbot",
  "Bytespider",
];
const BACKLINKS = ["AhrefsBot", "SemrushBot", "MJ12bot", "DataForSeoBot", "SerpstatBot"];
const ANSWERS = [
  "Googlebot",
  "Bingbot",
  "Applebot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "ExaSearchBot",
  "PetalBot",
];

/** {user agent (lower case): [field, value][]}, a group per run of User-agent lines and the rules after them. */
function robotsGroups(t: string): Record<string, [string, string][]> {
  const out: Record<string, [string, string][]> = {};
  let agents: string[] = [];
  let rules: [string, string][] | null = null;
  for (const raw of t.split("\n")) {
    const line = raw.split("#")[0].trim();
    const i = line.indexOf(":");
    if (i < 0) continue;
    const field = line.slice(0, i).trim().toLowerCase();
    const value = line.slice(i + 1).trim();
    if (field === "user-agent") {
      if (rules) [agents, rules] = [[], null];
      agents.push(value.toLowerCase());
    } else if (["allow", "disallow", "content-signal"].includes(field)) {
      if (!rules) {
        rules = [];
        for (const a of agents) out[a] = rules;
      }
      rules.push([field, value]);
    }
  }
  return out;
}

/** Whether a path is closed by a group's Disallow lines (with * as any run, as Google and Bing read it). */
const closed = (rules: [string, string][], path: string) =>
  rules.some(
    ([f, v]) =>
      f === "disallow" && v && new RegExp("^" + v.replace(/[.?+^$()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")).test(path),
  );

test("robots.txt: everyone reads the site, the API and MCP; a screen's copy and the embed card are not crawled", () => {
  const t = robotsTxt("https://mugilu.live");
  const g = robotsGroups(t);
  for (const p of ["/", "/c/almora", "/c/almora.json", "/c/almora.md", "/mcp", "/warnings", "/llms.txt"])
    assert.ok(!closed(g["*"], p), p);
  // the kiosk view and the embed card are the place page again, for a screen or another site
  for (const p of ["/c/almora?kiosk", "/c/almora?as=asthma&kiosk", "/embed/12.97,77.59"])
    assert.ok(closed(g["*"], p), p);
  assert.deepEqual(
    g["*"].find(([f]) => f === "content-signal"),
    ["content-signal", "search=yes, ai-input=yes, ai-train=no"],
  );
  assert.match(t, /Sitemap: https:\/\/mugilu\.live\/sitemap\.xml/);
});

test("robots.txt: training and backlink crawlers are closed out; search and answer crawlers are never named", () => {
  const g = robotsGroups(robotsTxt("https://mugilu.live"));
  for (const a of [...TRAINING, ...BACKLINKS]) assert.ok(closed(g[a.toLowerCase()], "/c/almora"), a);
  for (const a of ANSWERS) assert.equal(g[a.toLowerCase()], undefined, a);
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

test("llmsTxt: an H1 and Markdown links (what the llms.txt convention and Lighthouse expect), covering every surface", () => {
  const s = llmsTxt("https://mugilu.live");
  assert.match(s, /^# /);
  assert.ok([...s.matchAll(/\[[^\]]+\]\(https:\/\/mugilu\.live[^)]*\)/g)].length >= 10);
  for (const re of [
    /\.png/,
    /\/embed\//,
    /\/display/,
    /\/hi\b/,
    /\/kn\b/,
    /heat_vs_normal/,
    /"order"/,
    /persona_layers/,
  ])
    assert.match(s, re);
});

test("/.well-known/mcp.json: points agents at the hosted server and names every tool it offers", () => {
  const m = JSON.parse(mcpJson("https://mugilu.live"));
  assert.equal(m.name, "mugilu");
  assert.equal(m.homepage, "https://mugilu.live");
  assert.deepEqual(m.remotes, [{ type: "streamable-http", url: "https://mugilu.live/mcp" }]);
  assert.deepEqual(
    m.tools,
    TOOLS.map((t) => t.name),
  );
  assert.ok(m.description.length >= 40);
});

test("llms.txt: lists /places, the directory of every district and city, and what marks a warned one", () => {
  assert.match(
    llmsTxt("https://mugilu.live"),
    /- \[Every place\]\(https:\/\/mugilu\.live\/places\): [^\n]*official warning/,
  );
});

// The two manifests are kept by hand in one file; this keeps them from drifting apart.
test("OpenAPI covers every machine-readable URL llms.txt advertises", () => {
  const spec = openApiSpec("https://mugilu.live") as { paths: Record<string, unknown> };
  const urls = [...llmsTxt("https://mugilu.live").matchAll(/https:\/\/mugilu\.live(\/[^\s)?]*)/g)].map((m) => m[1]);
  const machine = urls
    .map((p) => p.replace(/\{lat\},\{lon\}|-?\d+\.\d+,-?\d+\.\d+/, "{coord}"))
    .filter((p) => p !== "/openapi.json") // the spec itself
    .filter((p) => /\.(json|md|png)$/.test(p) || p === "/near" || p === "/suggest");
  assert.ok(machine.length >= 8, `found ${machine.length}`);
  for (const p of new Set(machine)) assert.ok(p in spec.paths, `${p} is in llms.txt but not the OpenAPI spec`);
});

test("OpenAPI: the Markdown twins, the snapshot image and the station endpoints, each with its media type", () => {
  const { paths } = openApiSpec("https://mugilu.live") as {
    paths: Record<string, { get: { responses: { "200": { content: Record<string, unknown> } } } }>;
  };
  const type = (p: string) => Object.keys(paths[p]?.get.responses["200"].content ?? {})[0];
  for (const p of ["/c/{coord}.md", "/index.md", "/warnings.md", "/s/{provider}/{id}.md"])
    assert.equal(type(p), "text/markdown", p);
  assert.equal(type("/c/{coord}.png"), "image/png");
  assert.equal(type("/s/{provider}/{id}.json"), "application/json");
});

test("OpenAPI: /warnings.json describes the snapshot and each alert, as the code stores it", () => {
  const { paths } = openApiSpec("https://mugilu.live") as {
    paths: Record<string, { get: { responses: { "200": { content: Record<string, { schema: any }> } } } }>;
  };
  const s = paths["/warnings.json"].get.responses["200"].content["application/json"].schema;
  assert.deepEqual(s.required, ["generated_at", "count", "alerts"]);
  assert.deepEqual(Object.keys(s.properties.alerts.items.properties), [
    "identifier",
    "headline",
    "category",
    "issuer",
    "link",
    "sent",
    "expires",
  ]);
});
