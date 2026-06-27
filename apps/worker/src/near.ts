import type { NearStation, NormalizedStation } from "./types";

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two lat/lon points, in kilometres. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * The `n` stations nearest to (lat, lon), nearest first. Stations without
 * coordinates are skipped. Cheap by design: a single linear pass + sort over
 * the ~658 stations already held in the snapshot, no upstream call. This is
 * what makes the air layer lat/lng-addressable.
 */
export function findNearest(stations: NormalizedStation[], lat: number, lon: number, n: number): NearStation[] {
  const withDist: NearStation[] = [];
  for (const s of stations) {
    if (s.lat == null || s.lon == null) continue;
    withDist.push({ ...s, distance_km: +haversineKm(lat, lon, s.lat, s.lon).toFixed(2) });
  }
  withDist.sort((a, b) => a.distance_km - b.distance_km);
  return withDist.slice(0, n);
}

/**
 * Parse + validate `lat`/`lon` request params. Returns null when either is
 * missing/empty or the pair is out of geographic range. Callers turn null into
 * a 400. Guards against `Number(null) === 0` silently passing as a valid point.
 */
export function parseLatLon(latParam: string | null, lonParam: string | null): { lat: number; lon: number } | null {
  if (!latParam || !lonParam) return null;
  const lat = Number(latParam);
  const lon = Number(lonParam);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}
