import outline from "../data/india.json";

// India's outline: LGD state boundaries (via bharatlas, CC0/CC-BY-4.0) dissolved,
// grown ~5 km so coasts and island reefs count, and simplified to ~20 KB. mugilu
// covers India only; this is how a coordinate is checked against that.
type Ring = [number, number][]; // [lon, lat]
const RINGS: { ring: Ring; minLon: number; maxLon: number; minLat: number; maxLat: number }[] = (
  outline as unknown as { polygons: Ring[][] }
).polygons.map(([ring]) => ({
  ring,
  minLon: Math.min(...ring.map((p) => p[0])),
  maxLon: Math.max(...ring.map((p) => p[0])),
  minLat: Math.min(...ring.map((p) => p[1])),
  maxLat: Math.max(...ring.map((p) => p[1])),
}));

/** Even-odd ray cast: is the point inside the ring? */
function inRing(ring: Ring, lon: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Whether a coordinate falls in India (mainland or islands). */
export function inIndia(lat: number, lon: number): boolean {
  return RINGS.some(
    (r) => lon >= r.minLon && lon <= r.maxLon && lat >= r.minLat && lat <= r.maxLat && inRing(r.ring, lon, lat),
  );
}
