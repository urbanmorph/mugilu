// Regenerate apps/worker/data/centroids.json — mugilu's weather-sampling grid.
//
// It pulls admin boundaries from bharatlas (districts nationally + city wards in
// the major metros) and computes one interior point per polygon. The result is a
// tiered grid: coarse in rural districts, ward-dense in cities (where population
// and urban-heat-islands concentrate) — so heat/rain/UV/dust can be sampled at a
// hazard-appropriate resolution, not tethered to the 658 air monitors.
//
// Run:  node --max-old-space-size=4096 apps/worker/scripts/build-centroids.mjs
// (the LGD districts geojson is ~90 MB, so the large heap is required for the parse.)
//
// Data: bharatlas.com — LGD districts (CC0-1.0 / CC-BY-4.0), OpenCity/Oorvani city
// wards (ODbL-1.0 / CC-BY-SA-4.0). Attribute accordingly downstream.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = "https://pub-0429b8e3b5a946e69ea007df844a6f1c.r2.dev/admin";
const WARD_CITIES = [
  "wards_bengaluru_gba", "wards_delhi", "wards_chennai", "wards_hyderabad",
  "wards_mumbai", "wards_kolkata", "wards_pune", "wards_ahmedabad", "wards_jaipur",
  "wards_gurugram", "wards_kochi", "wards_bhubaneshwar", "wards_vizag", "wards_thane",
  "wards_indore", "wards_coimbatore",
];
const LAYERS = [
  { id: "lgd_districts", level: "district", url: `${BASE}/districts/LGD_Districts.geojson` },
  ...WARD_CITIES.map((id) => ({ id, level: "ward", url: `${BASE}/${id.replace(/_/g, "-")}/${id}.geojson` })),
];

const NAME_KEYS = ["dtname", "Dist", "district", "ward_name", "WARD_NAME", "name", "Name", "NAME", "wardname", "KGISWardName"];

function ringSignedArea(ring) {
  let a = 0;
  for (let i = 0, n = ring.length - 1; i < n; i++) {
    const [x0, y0] = ring[i], [x1, y1] = ring[i + 1];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}

function ringCentroid(ring) {
  const area = ringSignedArea(ring);
  if (Math.abs(area) < 1e-12) {
    let sx = 0, sy = 0;
    for (const [x, y] of ring) { sx += x; sy += y; }
    return [sx / ring.length, sy / ring.length];
  }
  let cx = 0, cy = 0;
  for (let i = 0, n = ring.length - 1; i < n; i++) {
    const [x0, y0] = ring[i], [x1, y1] = ring[i + 1];
    const f = x0 * y1 - x1 * y0;
    cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  return [cx / (6 * area), cy / (6 * area)];
}

function featureCentroid(geom) {
  if (!geom) return null;
  const polys = geom.type === "Polygon" ? [geom.coordinates]
    : geom.type === "MultiPolygon" ? geom.coordinates : [];
  let best = null, bestArea = -1;
  for (const poly of polys) {
    const ring = poly[0];
    if (!ring || ring.length < 4) continue;
    const a = Math.abs(ringSignedArea(ring));
    if (a > bestArea) { bestArea = a; best = ring; }
  }
  if (!best) return null;
  const [c0, c1] = ringCentroid(best);
  // Auto-detect coord order via India's bbox (some layers are KML-derived [lat,lon]).
  let lat, lon;
  if (c0 >= 6 && c0 <= 38 && c1 >= 68 && c1 <= 98) { lat = c0; lon = c1; }
  else { lon = c0; lat = c1; }
  if (lat < 6 || lat > 38 || lon < 68 || lon > 98) return null;
  return { lat: +lat.toFixed(4), lon: +lon.toFixed(4) };
}

function pickName(props) {
  for (const k of NAME_KEYS) if (props[k]) return String(props[k]).trim();
  return null;
}

const all = [];
for (const layer of LAYERS) {
  const res = await fetch(layer.url);
  if (!res.ok) { console.error(`SKIP ${layer.id}: HTTP ${res.status}`); continue; }
  const fc = await res.json();
  const feats = fc.features || [];
  let n = 0;
  for (let i = 0; i < feats.length; i++) {
    const c = featureCentroid(feats[i].geometry);
    if (!c) continue;
    all.push({
      id: `${layer.id}-${i}`,
      name: pickName(feats[i].properties || {}) || `${layer.id}-${i}`,
      level: layer.level,
      source_layer: layer.id,
      lat: c.lat,
      lon: c.lon,
    });
    n++;
  }
  console.log(`${layer.id}: ${n} / ${feats.length}`);
}

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "centroids.json");
writeFileSync(out, JSON.stringify(all));
const byLevel = {};
for (const c of all) byLevel[c.level] = (byLevel[c.level] || 0) + 1;
console.log(`\nwrote ${all.length} centroids → ${out}`, JSON.stringify(byLevel));
