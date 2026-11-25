import centroids from "../data/centroids.json";
import shapes from "../data/district-shapes.json";
import { haversineKm } from "./near";
import type { Centroid } from "./types";

// Reverse-geocode a point to a human label using the bundled bharatlas grid,
// a city ward in the 16 metros, a district elsewhere. Self-contained (no
// per-request API call); nearest-centroid is approximate near borders but fast.
const GRID = centroids as Centroid[];
const BY_ID = new Map(GRID.map((c) => [c.id, c]));

// Each LGD district's outline (scripts/build-district-shapes.mts), simplified to about 1 km:
// [minLon, minLat, maxLon, maxLat, ...rings] in thousandths of a degree, each ring a start
// point then steps. Index i is centroid `lgd_districts-<i>`.
const SHAPES = shapes as (number[] | null)[];
const Q = 1000;

/** Whether (x, y) lies inside a district's rings (even-odd, so holes and enclaves count). */
function inside(shape: (number | number[])[], x: number, y: number): boolean {
  let hit = false;
  for (const ring of shape.slice(4) as number[][]) {
    let [px, py] = [ring[0], ring[1]];
    for (let k = 2; k <= ring.length; k += 2) {
      // The last edge closes the ring back to its start.
      const [qx, qy] = k < ring.length ? [px + ring[k], py + ring[k + 1]] : [ring[0], ring[1]];
      if (qy > y !== py > y && x < ((qx - px) * (y - py)) / (qy - py) + px) hit = !hit;
      [px, py] = [qx, qy];
    }
  }
  return hit;
}

/** The district whose outline holds the point, or null (at sea, abroad, or in a ~1 km
 *  sliver the simplified outlines miss). */
export function districtAt(lat: number, lon: number): Centroid | null {
  const [x, y] = [lon * Q, lat * Q];
  for (let i = 0; i < SHAPES.length; i++) {
    const s = SHAPES[i];
    if (s && x >= s[0] && y >= s[1] && x <= s[2] && y <= s[3] && inside(s, x, y))
      return BY_ID.get(`lgd_districts-${i}`) ?? null;
  }
  return null;
}

/** "Bengaluru" from a ward source_layer like "wards_bengaluru_gba". */
function cityOf(sourceLayer: string): string | null {
  const m = sourceLayer.match(/^wards_([a-z]+)/);
  if (!m) return null;
  return m[1].charAt(0).toUpperCase() + m[1].slice(1);
}

// BMC's 24 wards are officially bare letter codes (A, L, H/W, G/S…). bharatlas
// mirrors that faithfully, so a raw label reads "L, Mumbai" — meaningless to a
// reader. We alias each code to the locality it's best known by, for a human
// label. bharatlas stays the source of truth; this is display-only curation.
const BMC_WARD_AREA: Record<string, string> = {
  A: "Colaba",
  B: "Sandhurst Road",
  C: "Kalbadevi",
  D: "Malabar Hill",
  E: "Byculla",
  "F/N": "Matunga",
  "F/S": "Parel",
  "G/N": "Dadar",
  "G/S": "Worli",
  "H/E": "Bandra East",
  "H/W": "Bandra West",
  "K/E": "Andheri East",
  "K/W": "Andheri West",
  L: "Kurla",
  "M/E": "Govandi",
  "M/W": "Chembur",
  N: "Ghatkopar",
  "P/N": "Malad",
  "P/S": "Goregaon",
  "R/C": "Borivali",
  "R/N": "Dahisar",
  "R/S": "Kandivali",
  S: "Bhandup",
  T: "Mulund",
};

function nearestCentroid(lat: number, lon: number): Centroid | null {
  let best: Centroid | null = null;
  let bestD = Infinity;
  for (const c of GRID) {
    const d = haversineKm(lat, lon, c.lat, c.lon);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/** Nearest admin label for a point: "Ward, City" in metros, "District, State" elsewhere. */
export function nearestPlace(lat: number, lon: number): string | null {
  const near = nearestCentroid(lat, lon);
  // A metro point reads its nearest ward; elsewhere, the district that holds it (the nearest
  // district centre misleads in big districts: Leh town's nearest centre is Kargil's).
  const best = near?.level === "ward" ? near : (districtAt(lat, lon) ?? near);
  if (!best) return null;
  if (best.level === "ward") {
    const city = cityOf(best.source_layer);
    // BMC ward codes ("L", "H/W") → the locality they're known by; other cities
    // keep the ward name as-is.
    const aliased = city === "Mumbai" ? BMC_WARD_AREA[best.name] : undefined;
    // Some ward centroids carry an id-like ("wards_bengaluru-0") or bare-number
    // ("62") name; fall back to the city alone rather than show a meaningless id.
    const idLike = /^wards?_/i.test(best.name) || /^\d+$/.test(best.name);
    const human = aliased ?? (idLike ? null : best.name);
    return [human, city].filter(Boolean).join(", ") || best.name;
  }
  return best.state && best.state !== best.name ? `${best.name}, ${best.state}` : best.name;
}

/** The state/UT a point falls in, via the nearest grid centroid (for points
 *  whose own source lacks a reliable state, e.g. the air stations). */
export function stateAt(lat: number, lon: number): string | undefined {
  return (districtAt(lat, lon) ?? nearestCentroid(lat, lon))?.state ?? undefined;
}
