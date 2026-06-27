// CPCB AQI computation.
// Reference: https://cpcb.nic.in/National-Air-Quality-Index/
// Sub-index per pollutant using breakpoints; overall AQI = max of sub-indices.
// Pollutants: PM2.5 (24h), PM10 (24h), NO2 (24h), SO2 (24h), CO (8h, mg/m³), O3 (8h), NH3 (24h).
// We treat the live reading as a proxy for the averaging window, imperfect but consistent with how
// most dashboards (including oaq.notf.in) display "current AQI".

import type { NormalizedStation } from "./types";

type Breakpoints = [number, number, number, number][]; // [cLow, cHigh, iLow, iHigh]

// prettier-ignore
const BP: Record<string, Breakpoints> = {
  pm25: [[0, 30, 0, 50], [31, 60, 51, 100], [61, 90, 101, 200], [91, 120, 201, 300], [121, 250, 301, 400], [251, 500, 401, 500]],
  pm10: [[0, 50, 0, 50], [51, 100, 51, 100], [101, 250, 101, 200], [251, 350, 201, 300], [351, 430, 301, 400], [431, 600, 401, 500]],
  no2:  [[0, 40, 0, 50], [41, 80, 51, 100], [81, 180, 101, 200], [181, 280, 201, 300], [281, 400, 301, 400], [401, 600, 401, 500]],
  so2:  [[0, 40, 0, 50], [41, 80, 51, 100], [81, 380, 101, 200], [381, 800, 201, 300], [801, 1600, 301, 400], [1601, 2400, 401, 500]],
  co:   [[0, 1.0, 0, 50], [1.1, 2.0, 51, 100], [2.1, 10, 101, 200], [10.1, 17, 201, 300], [17.1, 34, 301, 400], [34.1, 50, 401, 500]],
  o3:   [[0, 50, 0, 50], [51, 100, 51, 100], [101, 168, 101, 200], [169, 208, 201, 300], [209, 748, 301, 400], [749, 1000, 401, 500]],
  nh3:  [[0, 200, 0, 50], [201, 400, 51, 100], [401, 800, 101, 200], [801, 1200, 201, 300], [1201, 1800, 301, 400], [1801, 2400, 401, 500]],
};

function subIndex(pollutant: keyof typeof BP, value: number): number | null {
  const bps = BP[pollutant];
  if (!bps) return null;
  for (const [cLow, cHigh, iLow, iHigh] of bps) {
    if (value >= cLow && value <= cHigh) {
      return Math.round(((iHigh - iLow) / (cHigh - cLow)) * (value - cLow) + iLow);
    }
  }
  // Above the top breakpoint: saturate at 500.
  if (value > bps[bps.length - 1][1]) return 500;
  return null;
}

export function computeAqi(p: NormalizedStation["pollutants"]): number | null {
  const subs: number[] = [];
  for (const k of Object.keys(p) as (keyof typeof BP)[]) {
    const v = p[k as keyof NormalizedStation["pollutants"]];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) continue;
    const s = subIndex(k, v);
    if (s !== null) subs.push(s);
  }
  // CPCB requires at least PM2.5 or PM10 AND at least 3 pollutants for a valid AQI,
  // but for a live dashboard we relax to "at least 1 sub-index present".
  if (subs.length === 0) return null;
  return Math.max(...subs);
}

export function aqiBand(aqi: number | null): NormalizedStation["band"] {
  if (aqi === null || !Number.isFinite(aqi)) return "unknown";
  if (aqi <= 50) return "good";
  if (aqi <= 100) return "satisfactory";
  if (aqi <= 200) return "moderate";
  if (aqi <= 300) return "poor";
  if (aqi <= 400) return "vpoor";
  return "severe";
}
