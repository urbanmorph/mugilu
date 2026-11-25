// Build data/place-elev.json: every named place's ground height (m), from Open-Meteo's
// elevation model (Copernicus DEM, 90 m), so state pages and the sitemap dates can tell when a
// station is in different air by height (conditions.ts speaksFor) without a forecast call.
// Run (from apps/worker): npx tsx scripts/build-place-elev.mts
//
// Data-extraction rules this follows: each batch's answer is written to the cache
// (~/.cache/mugilu/place-elev.json) as it arrives, so a stopped run resumes; places already
// cached are skipped, so a second run fetches nothing; the output is rewritten only when its
// checksum changes; a 429 waits a minute and retries; logs are unbuffered lines.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync, writeSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { allSlugPlaces } from "../src/slugs";

const CACHE = join(homedir(), ".cache/mugilu/place-elev.json");
const OUT = new URL("../data/place-elev.json", import.meta.url);
const log = (s: string) => writeSync(1, `${s}\n`);
const places = allSlugPlaces();
const have: Record<string, number> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
const todo = places.filter((p) => have[p.slug] == null);
log(`${places.length - todo.length} cached, ${todo.length} to fetch`);
for (let i = 0; i < todo.length;) {
  const b = todo.slice(i, i + 100);
  const q = (k: "lat" | "lon") => b.map((p) => p[k]).join(",");
  const r = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${q("lat")}&longitude=${q("lon")}`);
  const j = (await r.json().catch(() => ({}))) as { elevation?: number[]; reason?: string };
  if (!j.elevation) {
    log(`waiting a minute: ${j.reason ?? r.status}`);
    await new Promise((ok) => setTimeout(ok, 61_000));
    continue;
  }
  b.forEach((p, k) => (have[p.slug] = Math.round(j.elevation![k])));
  writeFileSync(`${CACHE}.part`, JSON.stringify(have));
  renameSync(`${CACHE}.part`, CACHE);
  i += b.length;
  log(`${Object.keys(have).length}/${places.length}`);
}
const out = Object.fromEntries(places.map((p) => [p.slug, Math.round(have[p.slug])]).sort());
const json = JSON.stringify(out);
const sum = (s: string) => createHash("sha256").update(s).digest("hex");
if (existsSync(OUT) && sum(readFileSync(OUT, "utf8")) === sum(json)) log("unchanged");
else {
  writeFileSync(OUT, json);
  log(`wrote ${places.length} places`);
}
