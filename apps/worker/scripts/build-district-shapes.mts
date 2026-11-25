// Build data/district-shapes.json: every LGD district's outline, simplified to about 1 km,
// so a point can be named by the district that contains it (src/place.ts districtAt).
// The nearest district centre was wrong for big districts: Leh's centre lies far north of
// Leh town, so Leh read "Kargil".
//
// Source: bharatlas LGD districts (CC0-1.0 / CC-BY-4.0), the same file build-centroids.mjs
// reads, so feature i here is centroid `lgd_districts-<i>` there (its name and state).
// Run (from apps/worker): npx tsx scripts/build-district-shapes.mts
//
// Data-extraction rules this follows: the 90 MB download is cached in
// ~/.cache/mugilu/districts and fetched only when missing (to a .part file, renamed when
// complete); the simplified file is cached beside it; the output is rewritten only when its
// checksum changes, so a second run changes nothing; logs are unbuffered lines.
// Format: [index] -> null, or [minLon, minLat, maxLon, maxLat, ring, ring...] in
// thousandths of a degree, each ring [lon0, lat0, dLon, dLat, ...] (steps from the last point).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, writeSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import centroids from "../data/centroids.json";

const SRC = "https://pub-0429b8e3b5a946e69ea007df844a6f1c.r2.dev/admin/districts/LGD_Districts.geojson";
const CACHE = join(homedir(), ".cache/mugilu/districts");
const RAW = join(CACHE, "LGD_Districts.geojson");
const SIMPLE = join(CACHE, "simple-1000.json");
const OUT = new URL("../data/district-shapes.json", import.meta.url);
const Q = 1000; // thousandths of a degree (about 100 m), well under the 1 km simplification
const log = (s: string) => writeSync(1, `${s}\n`);

mkdirSync(CACHE, { recursive: true });
if (!existsSync(RAW)) {
  log(`downloading ${SRC}`);
  const r = await fetch(SRC);
  if (!r.ok) throw new Error(`download failed: ${r.status}`);
  writeFileSync(`${RAW}.part`, Buffer.from(await r.arrayBuffer()));
  renameSync(`${RAW}.part`, RAW);
}
if (!existsSync(SIMPLE)) {
  log("simplifying to about 1 km (mapshaper)");
  execFileSync(
    "npx",
    [
      "--yes",
      "mapshaper@0.8.10",
      RAW,
      "-filter-fields",
      "dtname,stname",
      "-simplify",
      "interval=1000",
      "keep-shapes",
      "-o",
      `${SIMPLE}.part`,
      "format=geojson",
      "precision=0.001",
      "force",
    ],
    { stdio: "inherit" },
  );
  renameSync(`${SIMPLE}.part`, SIMPLE);
}

type Ring = [number, number][];
const geo = JSON.parse(readFileSync(SIMPLE, "utf8")) as {
  features: { properties: { dtname: string }; geometry: { type: string; coordinates: unknown } | null }[];
};
const grid = centroids as { id: string; name: string }[];
const byId = new Map(grid.map((c) => [c.id, c.name]));
const out = geo.features.map((f, i) => {
  // The centroid of the same feature carries the label; check the files still line up.
  const name = byId.get(`lgd_districts-${i}`);
  if (!f.geometry) return null;
  if (!name) throw new Error(`no centroid lgd_districts-${i} for ${f.properties.dtname}`);
  const polys = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as Ring[][];
  const rings = polys.flat();
  const q = (v: number) => Math.round(v * Q);
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  const enc = rings.map((ring) => {
    const r: number[] = [];
    let [px, py] = [0, 0];
    ring.forEach(([lon, lat], k) => {
      const [x, y] = [q(lon), q(lat)];
      [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
      r.push(k ? x - px : x, k ? y - py : y);
      [px, py] = [x, y];
    });
    return r;
  });
  return [x0, y0, x1, y1, ...enc];
});
const json = JSON.stringify(out);
const sum = (s: string) => createHash("sha256").update(s).digest("hex");
if (existsSync(OUT) && sum(readFileSync(OUT, "utf8")) === sum(json)) log("unchanged");
else {
  writeFileSync(OUT, json);
  log(`wrote ${out.filter(Boolean).length} districts, ${json.length} bytes`);
}
