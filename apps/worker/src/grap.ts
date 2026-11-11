import { haversineKm } from "./near";
import type { NormalizedStation } from "./types";

// GRAP (the Graded Response Action Plan) is CAQM's set of curbs for Delhi-NCR, in stages
// tied to Delhi's city AQI: Stage I at 201-300, II at 301-400, III at 401-450, IV above
// 450. CAQM decides when a stage is in force (often on a forecast, and not always at the
// threshold), and publishes it only on a JavaScript-built site, so mugilu does not claim
// the stage in force: it says which stage's range Delhi's AQI is in now, and names CAQM.

/** Places within this reach of central Delhi count as NCR here: Delhi, Gurugram, Noida,
 *  Ghaziabad, Faridabad and Sonipat (the outer NCR districts are left out). */
const NCR_KM = 75;
const DELHI = { lat: 28.61, lon: 77.21 };

export interface GrapRead {
  /** The mean AQI of Delhi's CPCB stations reporting now (CPCB's city AQI averages them too). */
  aqi: number;
  stations: number;
  /** The stage whose AQI range that is: 0 below Stage I, then 1-4. */
  stage: 0 | 1 | 2 | 3 | 4;
}

const stageOf = (aqi: number): GrapRead["stage"] => (aqi > 450 ? 4 : aqi > 400 ? 3 : aqi > 300 ? 2 : aqi > 200 ? 1 : 0);

/** Delhi's GRAP range for a spot in Delhi-NCR; null elsewhere, or with no Delhi reading. */
export function grapRead(stations: NormalizedStation[], lat: number, lon: number): GrapRead | null {
  if (haversineKm(lat, lon, DELHI.lat, DELHI.lon) > NCR_KM) return null;
  const delhi = stations.filter((s) => s.provider === "cpcb" && s.city === "Delhi" && s.aqi != null);
  if (!delhi.length) return null;
  const aqi = Math.round(delhi.reduce((a, s) => a + (s.aqi as number), 0) / delhi.length);
  return { aqi, stations: delhi.length, stage: stageOf(aqi) };
}
