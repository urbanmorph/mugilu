// Post-build sanity check. Runs a battery of automated checks against dist/.
// Kept dep-free (pure Node) so it can run in CI without installing anything.
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "dist");

let failed = 0;
function ok(msg: string) {
  console.log(`[verify] ✓ ${msg}`);
}
function warn(msg: string) {
  console.warn(`[verify] ⚠ ${msg}`);
}
function fail(msg: string) {
  console.error(`[verify] ✘ ${msg}`);
  failed++;
}

if (!existsSync(join(dist, "index.html"))) {
  console.error("[verify] dist/index.html missing — run build first");
  process.exit(1);
}

const home = readFileSync(join(dist, "index.html"), "utf8");

// ----- 1. Home meta tags -----
for (const tag of [
  '<meta name="viewport"',
  '<meta name="color-scheme"',
  '<meta name="description"',
  '<link rel="canonical"',
  '<meta property="og:title"',
  '<script type="application/ld+json">',
]) {
  if (!home.includes(tag)) fail(`home missing: ${tag}`);
}
if (!failed) ok("home meta tags present");

// ----- 2. Filter script + assets -----
if (!home.includes('src="/filter.js"')) fail("home missing filter.js reference");
for (const f of ["filter.js", "oat.min.css", "oat.min.js", "app.css"]) {
  if (!existsSync(join(dist, f))) fail(`dist/${f} missing`);
}
ok("filter.js + oat + app assets present");

// ----- 3. Every home station link resolves to a file on disk -----
const hrefRe = /href="\/s\/([^/]+)\/([^"#?]+)"/g;
const links = new Set<string>();
let m: RegExpExecArray | null;
while ((m = hrefRe.exec(home)) !== null) {
  links.add(`${decodeURIComponent(m[1])}/${decodeURIComponent(m[2])}`);
}
if (links.size === 0) fail("no station links found in home");
let missing = 0;
for (const key of links) {
  if (!existsSync(join(dist, "s", key, "index.html"))) {
    console.error(`[verify]   ✘ missing ${key}`);
    missing++;
  }
}
if (missing) fail(`${missing}/${links.size} home station links have no file`);
else ok(`all ${links.size} home station links resolve to files`);

// ----- 4. Sitemap parity -----
const sitemap = readFileSync(join(dist, "sitemap.xml"), "utf8");
if (!sitemap.startsWith("<?xml")) fail("sitemap.xml missing XML prolog");
if (!sitemap.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')) fail("sitemap.xml missing xmlns");
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => x[1]);
const stationSitemap = sitemapUrls.filter((u) => u.includes("/s/"));
if (stationSitemap.length < links.size) {
  fail(`sitemap has ${stationSitemap.length} station URLs but home references ${links.size}`);
} else {
  ok(`sitemap valid, ${stationSitemap.length} station URLs`);
}

// ----- 5. Home JSON-LD parses + has @context -----
const ldRe = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
let ldCount = 0;
while ((m = ldRe.exec(home)) !== null) {
  try {
    const j = JSON.parse(m[1]);
    if (j["@context"] !== "https://schema.org") fail(`home JSON-LD ${ldCount} missing @context`);
    if (!j["@type"]) fail(`home JSON-LD ${ldCount} missing @type`);
    ldCount++;
  } catch (e) {
    fail(`home JSON-LD ${ldCount} invalid: ${(e as Error).message}`);
  }
}
if (ldCount === 0) fail("no JSON-LD on home");
else ok(`home JSON-LD: ${ldCount} block(s), schema-valid`);

// ----- 6. Audit ALL station pages, not just one -----
function listStationFiles(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const provider of readdirSync(dir)) {
    const pd = join(dir, provider);
    if (!statSync(pd).isDirectory()) continue;
    for (const id of readdirSync(pd)) {
      const f = join(pd, id, "index.html");
      if (existsSync(f)) out.push(f);
    }
  }
  return out;
}
const stationFiles = listStationFiles(join(dist, "s"));
if (stationFiles.length === 0) fail("no station pages found under dist/s");

let stationsBadLd = 0;
let stationsNoH1 = 0;
let stationsNoCanonical = 0;
let stationsNoColorScheme = 0;
let stationsNoOgImage = 0;
let stationsWithUndefined = 0;
let stationsBadBand = 0;
for (const f of stationFiles) {
  const html = readFileSync(f, "utf8");
  if (!/<h1>[^<]+<\/h1>/.test(html)) stationsNoH1++;
  if (!html.includes('<link rel="canonical"')) stationsNoCanonical++;
  if (!html.includes('<meta name="color-scheme"')) stationsNoColorScheme++;
  if (!html.includes('<meta property="og:image"')) stationsNoOgImage++;
  if (/\bundefined\b/.test(html)) stationsWithUndefined++;
  // Make sure every station uses a known band class on the hero.
  const bandMatch = html.match(/class="band ([a-z]+)"/);
  if (bandMatch && !["good", "satisfactory", "moderate", "poor", "vpoor", "severe", "unknown"].includes(bandMatch[1])) {
    stationsBadBand++;
  }
  // JSON-LD validity
  const lre = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let mm: RegExpExecArray | null;
  while ((mm = lre.exec(html)) !== null) {
    try {
      const j = JSON.parse(mm[1]);
      if (!j["@context"] || !j["@type"]) stationsBadLd++;
    } catch {
      stationsBadLd++;
      break;
    }
  }
}
if (stationsNoH1) fail(`${stationsNoH1}/${stationFiles.length} station pages missing <h1>`);
if (stationsNoCanonical) fail(`${stationsNoCanonical}/${stationFiles.length} missing canonical`);
if (stationsNoColorScheme) fail(`${stationsNoColorScheme}/${stationFiles.length} missing color-scheme`);
if (stationsNoOgImage) fail(`${stationsNoOgImage}/${stationFiles.length} missing og:image`);
if (stationsBadLd) fail(`${stationsBadLd}/${stationFiles.length} have invalid JSON-LD`);
if (stationsBadBand) fail(`${stationsBadBand}/${stationFiles.length} have unknown band class`);
if (stationsWithUndefined)
  warn(
    `${stationsWithUndefined}/${stationFiles.length} contain literal "undefined" text (may be legit in a station name)`,
  );
if (
  stationsNoH1 + stationsNoCanonical + stationsNoColorScheme + stationsNoOgImage + stationsBadLd + stationsBadBand ===
  0
) {
  ok(`all ${stationFiles.length} station pages pass structural + JSON-LD checks`);
}

// ----- 7. Docs pages -----
const docsPages = [
  "docs/index.html",
  "docs/api/index.html",
  "docs/ai-agents/index.html",
  "docs/data-sources/index.html",
  "about/index.html",
];
for (const p of docsPages) {
  const full = join(dist, p);
  if (!existsSync(full)) {
    fail(`missing ${p}`);
    continue;
  }
  const html = readFileSync(full, "utf8");
  if (!html.includes('<meta name="color-scheme"')) fail(`${p} missing color-scheme`);
  if (!html.includes('<link rel="canonical"')) fail(`${p} missing canonical`);
  if (!html.includes('<meta name="description"')) fail(`${p} missing description`);
}
ok(`${docsPages.length} docs pages present with required meta`);

// ----- 8. openapi.yaml sanity -----
if (!existsSync(join(dist, "openapi.yaml"))) fail("openapi.yaml missing");
else {
  const y = readFileSync(join(dist, "openapi.yaml"), "utf8");
  if (!/^openapi:\s*3\.1/m.test(y)) fail("openapi.yaml not 3.1");
  if (!/paths:/m.test(y)) fail("openapi.yaml missing paths");
  if (!/components:/m.test(y)) fail("openapi.yaml missing components");
  ok("openapi.yaml present, 3.1, has paths + components");
}

// ----- 9. robots.txt -----
const robots = readFileSync(join(dist, "robots.txt"), "utf8");
for (const ua of ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]) {
  if (!robots.includes(`User-agent: ${ua}`)) fail(`robots.txt missing ${ua}`);
}
if (!robots.includes("Sitemap:")) fail("robots.txt missing Sitemap");
ok("robots.txt has all required user-agents + sitemap");

// ----- 10. llms.txt -----
const llms = readFileSync(join(dist, "llms.txt"), "utf8");
for (const needle of ["oaq.notf.in", "/index.md", "/index.json", "/sitemap.xml", "CPCB", "Oat"]) {
  if (!llms.includes(needle)) fail(`llms.txt missing: ${needle}`);
}
ok("llms.txt attribution + entry points present");

// ----- 11. Byte sizes -----
const sizes: Record<string, number> = {};
for (const f of ["index.html", "oat.min.css", "oat.min.js", "app.css", "filter.js"]) {
  sizes[f] = statSync(join(dist, f)).size;
}
ok(`sizes (bytes): ${JSON.stringify(sizes)}`);

if (failed) {
  console.error(`\n[verify] ${failed} check(s) FAILED`);
  process.exit(1);
}
console.log("\n[verify] all checks passed");
