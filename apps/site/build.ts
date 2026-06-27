import { mkdirSync, writeFileSync, copyFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Snapshot, NormalizedStation } from "./src/types";
import { renderHome } from "./src/templates/home";
import { renderStation } from "./src/templates/station";
import {
  renderDocsIndex,
  renderApiDocs,
  renderAiAgents,
  renderDataSources,
  renderAbout,
} from "./src/templates/docs";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "dist");
const staticDir = join(here, "static");

const DATA_URL = process.env.DATA_URL ?? "http://127.0.0.1:8787/data/latest.json";
const SITE_URL = process.env.SITE_URL ?? "https://mugilu.live";

function copyDir(src: string, dst: string) {
  if (!existsSync(src)) return;
  mkdirSync(dst, { recursive: true });
  for (const name of readdirSync(src)) {
    const s = join(src, name);
    const d = join(dst, name);
    if (statSync(s).isDirectory()) copyDir(s, d);
    else copyFileSync(s, d);
  }
}

async function fetchSnapshot(): Promise<Snapshot> {
  console.log(`[build] fetching snapshot from ${DATA_URL}`);
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`snapshot fetch failed: ${res.status}`);
  return (await res.json()) as Snapshot;
}

function writeFile(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

async function main() {
  mkdirSync(dist, { recursive: true });

  // 1. Static assets
  copyDir(staticDir, dist);
  const oatDir = join(here, "node_modules", "@knadh", "oat");
  for (const f of ["oat.min.css", "oat.min.js"]) {
    const src = join(oatDir, f);
    if (existsSync(src)) copyFileSync(src, join(dist, f));
  }

  // 2. Snapshot
  const snap = await fetchSnapshot();
  console.log(`[build] ${snap.station_count} stations, generated_at ${snap.generated_at}`);

  // 3. Homepage + docs pages
  writeFile(join(dist, "index.html"), renderHome(snap, SITE_URL));
  writeFile(join(dist, "docs", "index.html"), renderDocsIndex(SITE_URL));
  writeFile(join(dist, "docs", "api", "index.html"), renderApiDocs(SITE_URL));
  writeFile(join(dist, "docs", "ai-agents", "index.html"), renderAiAgents(SITE_URL));
  writeFile(join(dist, "docs", "data-sources", "index.html"), renderDataSources(SITE_URL));
  writeFile(join(dist, "about", "index.html"), renderAbout(SITE_URL));

  // Copy openapi.yaml from repo root so /openapi.yaml works.
  const openapiSrc = join(here, "..", "..", "openapi.yaml");
  if (existsSync(openapiSrc)) copyFileSync(openapiSrc, join(dist, "openapi.yaml"));

  // 4. Station pages
  let count = 0;
  const seen = new Set<string>();
  const SAFE_ID = /^[A-Za-z0-9_-]+$/;
  let skipped = 0;
  for (const s of snap.stations) {
    if (!s.raw_id || !SAFE_ID.test(s.raw_id)) {
      skipped++;
      continue;
    }
    const key = `${s.provider}/${s.raw_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const html = renderStation(s, snap.generated_at, SITE_URL);
    // On-disk path uses raw id verbatim — the home template must use the same.
    writeFile(join(dist, "s", s.provider, s.raw_id, "index.html"), html);
    count++;
  }
  console.log(`[build] wrote ${count} station pages${skipped ? ` (skipped ${skipped} with unsafe raw_id)` : ""}`);

  // 5. robots.txt
  writeFile(
    join(dist, "robots.txt"),
    `User-agent: *
Allow: /

User-agent: GPTBot
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`,
  );

  // 6. sitemap.xml
  const urls = [
    `${SITE_URL}/`,
    `${SITE_URL}/docs`,
    `${SITE_URL}/docs/api`,
    `${SITE_URL}/docs/ai-agents`,
    `${SITE_URL}/docs/data-sources`,
    `${SITE_URL}/about`,
    ...[...seen].map((k) => `${SITE_URL}/s/${k}`),
  ];
  writeFile(
    join(dist, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `<url><loc>${u}</loc></url>`).join("\n")}
</urlset>
`,
  );

  // 7. llms.txt
  writeFile(
    join(dist, "llms.txt"),
    `# mugilu — India air quality leaderboard

> Unofficial mirror of oaq.notf.in. ${snap.station_count} stations across India,
> updated hourly. Data from CPCB, Airnet (CSTEP), and Aurassure via the OAQ
> Data Broker. Every station page also shows an estimated years-of-life-lost
> figure from the Air Quality Life Index. MIT-licensed code.

## Structured entry points

- Leaderboard HTML: ${SITE_URL}/
- Leaderboard JSON: ${SITE_URL}/index.json
- Leaderboard Markdown: ${SITE_URL}/index.md
- Per-station HTML: ${SITE_URL}/s/{provider}/{id}
- Per-station JSON: ${SITE_URL}/s/{provider}/{id}.json
- Per-station Markdown: ${SITE_URL}/s/{provider}/{id}.md
- OpenAPI spec: ${SITE_URL}/openapi.yaml
- Sitemap: ${SITE_URL}/sitemap.xml

## Health impact (AQLI)

Each station carries a \`yll\` field in the JSON API and a rendered section
in HTML and Markdown variants. The formula is:

  years_of_life_lost = max(0, PM2.5 − 5) × 0.098

where 0.098 yr per µg/m³ is from Ebenstein et al. 2017 PNAS and 5 µg/m³ is
the WHO 2021 annual guideline. See /docs/data-sources#health-impact for the
full citation list and caveats.

## Attribution

Data © CPCB, Airnet (CSTEP), Aurassure. Licensed CC BY 4.0.
AQLI methodology © Greenstone et al. (U Chicago EPIC).
UI built on Oat (https://oat.ink) by Kailash Nadh.
This is an unaffiliated mirror of https://oaq.notf.in.
`,
  );

  console.log(`[build] done → ${dist}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
