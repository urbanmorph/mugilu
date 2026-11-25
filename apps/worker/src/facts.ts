import { STATION_MAX_KM } from "./conditions";
import { heatVsNormalToday } from "./heatnormals";
import {
  airLevelOf,
  coldLevelOf,
  dustLevelOf,
  fogLevelOf,
  heatLevelOf,
  rainLevelOf,
  firesInCleanAir,
  uvLevelOf,
  windLevelOf,
} from "./score";
import type { Conditions, ProviderId, StandIn, Warning } from "./types";

// The facts behind every sentence mugilu writes about a place (supporting-docs/
// READING_SENTENCES_SPEC.md): what is true, at what level, and how mugilu knows it. Every
// surface (title, description, answer line, reading sentences, questions) reads these and
// never the raw conditions, so a source or a radius can't be said two ways. Levels come from
// score.ts; this file holds no thresholds of its own.

export { STATION_MAX_KM };

/** How mugilu knows a value. A closed set: a new data path needs a kind here, and sentences
 *  for it in every language, before it can reach a page. */
export type Provenance =
  | { kind: "measured"; network: ProviderId; station: string; km: number; at: string }
  | { kind: "modelled"; model: "open-meteo"; reason?: "no_station"; radius_km?: number }
  | {
      kind: "modelled";
      model: "open-meteo";
      reason: "station_apart";
      station: string;
      km: number;
      height_m: number;
      aqi: number | null;
    }
  | { kind: "fallback"; grid_at: string }
  | { kind: "kept"; at: string }
  | { kind: "satellite"; by: "NASA FIRMS"; radius_km: number; window_h: number }
  | { kind: "official"; via: "SACHET" };

type Level = 0 | 1 | 2 | 3;
type Base = { level: Level; source: Provenance };

/** A CPCB air band, as the air reading carries it. */
type AirBand = Exclude<Conditions["air"], null>["band"];

export type Fact =
  | (Base & { key: "air"; aqi: number; band: AirBand })
  | (Base & {
      key: "temp";
      /** Heat or cold, whichever is raised more (heat on a tie). */
      hazard: "heat" | "cold";
      temp_c: number;
      feels_c: number;
      /** Today's high against the 1991-2020 normal (ERA5), when there is one. */
      normal?: { max_c: number; normal_c: number; delta_c: number; date: string };
    })
  | (Base & { key: "rain"; mm: number })
  | (Base & { key: "wind"; speed_kmh: number; gust_kmh: number; direction_deg?: number })
  | (Base & { key: "fog"; metres: number })
  | (Base & {
      key: "smoke";
      count: number;
      nearest_km: number | null;
      radius_km: number;
      /** The air band here when it is clean: the fires are context, not a hazard (score.ts). */
      clean?: AirBand;
    })
  | (Base & { key: "uv"; index: number })
  | (Base & { key: "dust"; ugm3: number })
  | (Base & { key: "warnings"; here: Warning[]; nearby: Warning[] });

const FIRMS_WINDOW_H = 24;
const lv = (n: number | null | undefined): Level => Math.max(0, Math.min(3, n ?? 0)) as Level;

/** Weather from the live call, or the stand-in that filled it: this place's own kept
 *  answer, or the district grid. */
const weather = (l: StandIn | null | undefined): Provenance =>
  !l?.as_of
    ? { kind: "modelled", model: "open-meteo" }
    : l.stand_in === "kept"
      ? { kind: "kept", at: l.as_of }
      : { kind: "fallback", grid_at: l.as_of };

function warnLevel(ws: Warning[]): Level {
  if (!ws.length) return 0;
  const colours = ws.map((w) => w.color.toLowerCase());
  return colours.includes("red") ? 3 : colours.includes("orange") ? 2 : 1;
}

// Order of equal levels: official warnings first, then air, then the rest as the page lists them.
const ORDER: Fact["key"][] = ["warnings", "air", "temp", "rain", "wind", "fog", "smoke", "uv", "dust"];

/** The facts for a place, the most important first (highest level; ties in ORDER). */
export function facts(c: Conditions, now = new Date()): Fact[] {
  const out: Fact[] = [];
  const a = c.air;
  if (a && a.aqi != null)
    out.push({
      key: "air",
      aqi: a.aqi,
      band: a.band,
      level: lv(airLevelOf(a.band)),
      source: a.station
        ? {
            kind: "measured",
            network: a.source as ProviderId,
            station: a.station.name,
            km: a.station.distance_km,
            at: c.air_as_of ?? c.as_of,
          }
        : a.station_apart
          ? {
              kind: "modelled",
              model: "open-meteo",
              reason: "station_apart",
              station: [a.station_apart.name, a.station_apart.city].filter(Boolean).join(", "),
              km: a.station_apart.distance_km,
              height_m: a.station_apart.height_m,
              aqi: a.station_apart.aqi,
            }
          : { kind: "modelled", model: "open-meteo", reason: "no_station", radius_km: STATION_MAX_KM },
    });
  const h = c.heat;
  if (h?.temp_c != null && h.apparent_c != null) {
    const heat = heatLevelOf(h);
    const cold = coldLevelOf(h.apparent_c);
    // Only today's high: a cached reading can outlive IST midnight.
    const n = heatVsNormalToday(c.heat_vs_normal, now) ? c.heat_vs_normal : null;
    out.push({
      key: "temp",
      hazard: cold > heat ? "cold" : "heat",
      temp_c: h.temp_c,
      feels_c: h.apparent_c,
      level: lv(Math.max(heat, cold)),
      source: weather(h),
      ...(n ? { normal: { max_c: n.today_max_c, normal_c: n.normal_max_c, delta_c: n.anomaly_c, date: n.date } } : {}),
    });
  }
  if (c.rain?.precipitation_mm != null)
    out.push({
      key: "rain",
      mm: c.rain.precipitation_mm,
      level: lv(rainLevelOf(c.rain.precipitation_mm)),
      source: weather(c.rain),
    });
  const w = c.wind;
  if (w?.speed_kmh != null)
    out.push({
      key: "wind",
      speed_kmh: w.speed_kmh,
      gust_kmh: w.gust_kmh ?? w.speed_kmh,
      direction_deg: w.direction_deg,
      level: lv(windLevelOf(w.gust_kmh ?? w.speed_kmh)),
      source: weather(w),
    });
  if (c.visibility?.meters != null)
    out.push({
      key: "fog",
      metres: c.visibility.meters,
      level: lv(fogLevelOf(c.visibility.meters)),
      source: weather(c.visibility),
    });
  if (c.smoke)
    out.push({
      key: "smoke",
      count: c.smoke.count,
      nearest_km: c.smoke.nearest_km,
      radius_km: c.smoke.radius_km,
      level: lv(null),
      clean: firesInCleanAir(c) ? c.air!.band : undefined,
      source: { kind: "satellite", by: "NASA FIRMS", radius_km: c.smoke.radius_km, window_h: FIRMS_WINDOW_H },
    });
  if (c.uv?.index != null)
    out.push({ key: "uv", index: c.uv.index, level: lv(uvLevelOf(c.uv.index)), source: weather(c.uv) });
  if (c.dust?.dust_ug_m3 != null)
    out.push({
      key: "dust",
      ugm3: c.dust.dust_ug_m3,
      level: lv(dustLevelOf(c.dust.dust_ug_m3)),
      source: weather(c.dust),
    });
  const here = c.warnings ?? [];
  out.push({
    key: "warnings",
    here,
    nearby: c.nearby_warnings ?? [],
    level: warnLevel(here),
    source: { kind: "official", via: "SACHET" },
  });

  const rank = (f: Fact) => ORDER.indexOf(f.key);
  return out.sort((x, y) => y.level - x.level || rank(x) - rank(y));
}
