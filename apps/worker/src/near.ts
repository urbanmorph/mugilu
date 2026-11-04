import { indianPoint } from "./india";
import type { NearStation, NormalizedStation } from "./types";
import { STALE_AFTER_MS } from "./snapshot";

/** What the station endpoints (/near, /index.json, /s/...json) say about their numbers,
 *  which the numbers can't say themselves: CO is mg/m3 while the other pollutants are
 *  ug/m3, the AQI is CPCB's, and every station listed reported within the last few
 *  hours (older ones are left out, snapshot.ts). The conditions contract reuses the
 *  pollutant and AQI units. */
export const STATION_META = {
  units: {
    pollutants: { co: "mg/m3", default: "ug/m3" },
    aqi: "cpcb_0_500",
    yll_years: "years",
    distance_km: "km",
  },
  fresh_within_hours: STALE_AFTER_MS / 3600_000,
} as const;

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
 * missing/empty or the point is outside India (mugilu covers India only).
 * Callers turn null into a 400. Guards against `Number(null) === 0` silently passing as a valid point.
 */
export function parseLatLon(latParam: string | null, lonParam: string | null): { lat: number; lon: number } | null {
  if (!latParam || !lonParam) return null;
  return indianPoint(Number(latParam), Number(lonParam));
}
