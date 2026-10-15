import centroids from "../data/centroids.json";
import { haversineKm } from "./near";
import type { Centroid } from "./types";

// Reverse-geocode a point to a human label using the bundled bharatlas grid,
// a city ward in the 16 metros, a district elsewhere. Self-contained (no
// per-request API call); nearest-centroid is approximate near borders but fast.
const GRID = centroids as Centroid[];

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
  const best = nearestCentroid(lat, lon);
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
  return best.state ? `${best.name}, ${best.state}` : best.name;
}

/** The state/UT a point falls in, via the nearest grid centroid (for points
 *  whose own source lacks a reliable state, e.g. the air stations). */
export function stateAt(lat: number, lon: number): string | undefined {
  return nearestCentroid(lat, lon)?.state ?? undefined;
}
