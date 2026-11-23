import outline from "../data/india.json";

// India's outline: LGD state boundaries (via bharatlas, CC0/CC-BY-4.0) dissolved,
// grown ~5 km so coasts and island reefs count, and simplified to ~20 KB. mugilu
// covers India only; this is how a coordinate is checked against that.
export type Ring = [number, number][]; // [lon, lat]
const RINGS = (outline as unknown as { polygons: Ring[][] }).polygons.map(([ring]) => {
  let minLon = Infinity,
    maxLon = -Infinity,
    minLat = Infinity,
    maxLat = -Infinity;
  for (const [lon, lat] of ring) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  return { ring, minLon, maxLon, minLat, maxLat };
});

/** Even-odd ray cast: is the point inside the ring? */
/** Whether a point is inside a ring (even-odd rule); also used for SACHET alert areas. */
export function inRing(ring: Ring, lon: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** A test for "inside any of these rings", with each ring's box checked first (cheap) so the
 *  ray cast runs only for rings near the point. Coordinates in any one plane (lon/lat, pixels). */
export function inAnyRing(rings: Ring[]): (x: number, y: number) => boolean {
  const boxes = rings.map((ring) => {
    const xs = ring.map((p) => p[0]);
    const ys = ring.map((p) => p[1]);
    return { ring, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  });
  return (x, y) => boxes.some((b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 && inRing(b.ring, x, y));
}

/** The point, if it is a real coordinate in India; else null. The one gate every
 *  coordinate input goes through (parseLatLon, parseCoordQuery). */
export function indianPoint(lat: number, lon: number): { lat: number; lon: number } | null {
  return Number.isFinite(lat) && Number.isFinite(lon) && inIndia(lat, lon) ? { lat, lon } : null;
}

/** Whether a coordinate falls in India (mainland or islands). */
export function inIndia(lat: number, lon: number): boolean {
  return RINGS.some(
    (r) => lon >= r.minLon && lon <= r.maxLon && lat >= r.minLat && lat <= r.maxLat && inRing(r.ring, lon, lat),
  );
}
