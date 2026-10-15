import type { NormalizedStation } from "./types";
import { haversineKm } from "./near";
import { subIndex } from "./aqi";

// Low-cost sensors (everything but CPCB's reference monitors) sometimes stick
// near zero or spike to nonsense (PM2.5 820, SO2 2720 µg/m³). Their readings stay
// in the data, but a reading that fails these checks must not answer for a place
// or headline the national picture. CPCB is the reference, so it is not checked.

/** Outdoor PM2.5 below this in an Indian city means a stuck sensor, not clean air. */
const PM25_FLOOR = 3;
/** Neighbours within this radius form the local baseline. */
const NEIGHBOUR_KM = 20;
/** Need at least this many neighbours reporting a pollutant to judge it. */
const MIN_NEIGHBOURS = 3;
/** A reading more than this factor off the neighbours' median is an outlier. */
const OUTLIER_FACTOR = 4;

type Pollutant = keyof NormalizedStation["pollutants"];

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * False when a low-cost sensor's reading is implausible against the floor or its
 * neighbours. With `strict`, a sensor too isolated to be checked at all also
 * fails (used where one reading would headline the whole country).
 */
export function isPlausible(s: NormalizedStation, stations: NormalizedStation[], strict = false): boolean {
  if (s.provider === "cpcb") return true;
  const p = s.pollutants;
  if (p.pm25 != null && p.pm25 < PM25_FLOOR) return false;
  if (s.lat == null || s.lon == null) return !strict;

  const near = stations.filter(
    (o) => o !== s && o.lat != null && o.lon != null && haversineKm(s.lat!, s.lon!, o.lat, o.lon) <= NEIGHBOUR_KM,
  );
  let checked = false;
  for (const k of Object.keys(p) as Pollutant[]) {
    const v = p[k];
    if (v == null) continue;
    // Judge against CPCB reference monitors when there are enough of them, so
    // a cluster of sensors that all run high cannot vouch for one another.
    const values = (ns: NormalizedStation[]) => ns.map((o) => o.pollutants[k]).filter((x): x is number => x != null);
    const ref = values(near.filter((o) => o.provider === "cpcb"));
    const vals = ref.length >= MIN_NEIGHBOURS ? ref : values(near);
    if (vals.length < MIN_NEIGHBOURS) continue;
    checked = true;
    const m = median(vals);
    // Too high only matters when it would raise the alarm (sub-index past
    // "satisfactory"), so a merely busy roadside sensor is not thrown out.
    if (v > m * OUTLIER_FACTOR && (subIndex(k, v) ?? 0) > 100) return false;
    // Too low: particulates only; gases legitimately swing to near zero.
    if ((k === "pm25" || k === "pm10") && v < m / OUTLIER_FACTOR) return false;
  }
  return checked || !strict;
}
