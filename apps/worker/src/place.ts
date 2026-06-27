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

/** Nearest admin label for a point: "Ward, City" in metros, a district name elsewhere. */
export function nearestPlace(lat: number, lon: number): string | null {
  let best: Centroid | null = null;
  let bestD = Infinity;
  for (const c of GRID) {
    const d = haversineKm(lat, lon, c.lat, c.lon);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  if (!best) return null;
  if (best.level === "ward") {
    const city = cityOf(best.source_layer);
    return city ? `${best.name}, ${city}` : best.name;
  }
  return best.name;
}
