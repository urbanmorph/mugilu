// The readings in the order they matter to a person now, shared by every surface
// (the /c page, the display and the conditions image) so they never disagree:
// the headline hazard first, then by risk, the persona's own triggers first among
// equals, then what people check first. Also each reading's short value and the
// gauge it is drawn on, against the thresholds the Ambient read uses.

import type { Conditions } from "./types";
import { THRESHOLDS, SENSITIVE, smokeLevel, coldLevelOf } from "./score";
import type { AmbientRisk } from "./score";

// The hazard each layer reads (the thermal layer is Heat or Cold, whichever it is now).
const LAYER_HAZARDS: Record<string, string[]> = {
  air: ["Air"],
  heat: ["Heat", "Cold"],
  sun: ["UV"],
  dust: ["Dust"],
  wind: ["Wind"],
  fog: ["Fog"],
  smoke: ["Smoke"],
};
// What people check first when nothing stands out: the air they breathe, how hot
// it is and how strong the sun (side by side), whether it will rain, then the rest.
const CARE_ORDER = ["air", "heat", "sun", "rain", "wind", "fog", "smoke", "dust"];

/** Rain worth planning around (a commute, the washing): falling now, or a 40%+ chance. */
const RAIN_LIKELY_PCT = 40;
function rainLikely(c: Conditions): boolean {
  return (c.rain?.precipitation_mm ?? 0) > 0 || (c.rain?.probability_pct ?? 0) >= RAIN_LIKELY_PCT;
}

/** The hazard each layer reads right now (Heat or Cold for the thermal layer). */
function layerHazards(k: string, risk: AmbientRisk) {
  return risk.hazards.filter((h) => LAYER_HAZARDS[k]?.includes(h.hazard));
}

/** Whether this layer reads one of the persona's own triggers. */
export function forPersona(k: string, risk: AmbientRisk): boolean {
  return layerHazards(k, risk).some((h) => SENSITIVE[risk.persona].includes(h.hazard));
}

/** Whether this layer is the Ambient read's headline hazard. */
export function isDriver(key: string, risk: AmbientRisk): boolean {
  return LAYER_HAZARDS[key]?.includes(risk.driver) ?? false;
}

/** How risky a layer is now (0-3). Rain carries no health level, so it counts as 1
 *  only when it is falling or likely. */
export function layerLevel(k: string, risk: AmbientRisk, c: Conditions): number {
  return k === "rain" ? Number(rainLikely(c)) : Math.max(0, ...layerHazards(k, risk).map((h) => h.level));
}

/** Layers in the order they matter to this person now. */
export function orderByRisk<T extends { key: string }>(items: T[], risk: AmbientRisk, c: Conditions): T[] {
  const rank = (k: string) => [
    isDriver(k, risk) ? 0 : 1,
    -layerLevel(k, risk, c),
    forPersona(k, risk) ? 0 : 1,
    CARE_ORDER.indexOf(k),
  ];
  return [...items].sort((a, b) => {
    const ra = rank(a.key),
      rb = rank(b.key);
    return ra.reduce((d, x, i) => d || x - rb[i], 0);
  });
}

/** The place's display name, raw (escape it where it is written out): the resolved
 *  place, else the nearest station's city, else the coordinate. */
export function placeLabel(c: Conditions): string {
  return c.place || c.air?.station?.city || `${c.location.lat},${c.location.lon}`;
}

/** Where v sits on lo..hi, as a percentage pinned to 0-100 (one decimal), on a log
 *  scale for spans like 100 m-10 km. Shared by the page graphics and the image bars. */
export function gaugePos(v: number, lo: number, hi: number, log = false): number {
  const p = log ? Math.log(v / lo) / Math.log(hi / lo) : (v - lo) / (hi - lo);
  return +(Math.max(0, Math.min(1, p)) * 100).toFixed(1);
}

/** Where a reading sits: its value, the span drawn, and the thresholds marked on it. */
export interface Gauge {
  v: number;
  lo: number;
  hi: number;
  ticks: readonly number[];
  log?: boolean;
}

/** One reading, short: an English label, a value with its unit, its risk level and gauge. */
export interface Brief {
  key: string;
  label: string;
  value: string;
  level: number;
  gauge: Gauge;
}

export const km = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

/** Every reading present, short, in the order they matter now. */
export function briefs(c: Conditions, risk: AmbientRisk): Brief[] {
  const out: Omit<Brief, "level">[] = [];
  if (c.air?.aqi != null)
    out.push({
      key: "air",
      label: "Air",
      value: `AQI ${c.air.aqi}`,
      gauge: { v: c.air.aqi, lo: 0, hi: 500, ticks: [100, 200, 300] },
    });
  const a = c.heat?.apparent_c;
  if (a != null) {
    const cold = coldLevelOf(a) > 0;
    out.push({
      key: "heat",
      label: "Heat",
      value: `${Math.round(a)}°`,
      gauge: cold
        ? { v: a, lo: -10, hi: 30, ticks: THRESHOLDS.cold }
        : { v: a, lo: 20, hi: 50, ticks: THRESHOLDS.apparent },
    });
  }
  if (c.uv?.index != null)
    out.push({
      key: "sun",
      label: "Sun",
      value: `UV ${Math.round(c.uv.index)}`,
      gauge: { v: c.uv.index, lo: 0, hi: 12, ticks: THRESHOLDS.uv },
    });
  if (c.rain?.probability_pct != null)
    out.push({
      key: "rain",
      label: "Rain",
      value: `${Math.round(c.rain.probability_pct)}%`,
      gauge: { v: c.rain.probability_pct, lo: 0, hi: 100, ticks: [RAIN_LIKELY_PCT] },
    });
  const gust = c.wind?.gust_kmh ?? c.wind?.speed_kmh;
  if (gust != null)
    out.push({
      key: "wind",
      label: "Wind",
      value: `${Math.round(gust)} km/h`,
      gauge: { v: gust, lo: 0, hi: 100, ticks: THRESHOLDS.wind },
    });
  const m = c.visibility?.meters;
  if (m != null && m < 5000)
    out.push({
      key: "fog",
      label: "Visibility",
      value: km(m),
      gauge: { v: m, lo: 100, hi: 10000, ticks: [...THRESHOLDS.fog, 5000], log: true },
    });
  if (c.smoke && smokeLevel(c.smoke) != null)
    out.push({
      key: "smoke",
      label: "Smoke",
      value: `${c.smoke.count}`,
      gauge: { v: c.smoke.count, lo: 0, hi: 100, ticks: THRESHOLDS.smokeCount },
    });
  if (c.dust?.dust_ug_m3 != null)
    out.push({
      key: "dust",
      label: "Dust",
      value: `${Math.round(c.dust.dust_ug_m3)} µg/m³`,
      gauge: { v: c.dust.dust_ug_m3, lo: 0, hi: 600, ticks: THRESHOLDS.dust },
    });
  return orderByRisk(
    out.map((b) => ({ ...b, level: layerLevel(b.key, risk, c) })),
    risk,
    c,
  );
}
