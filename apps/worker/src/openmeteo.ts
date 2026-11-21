import type {
  HeatConditions,
  RainConditions,
  UvConditions,
  DustConditions,
  WindConditions,
  VisibilityConditions,
  Wx,
  AirPollutants,
} from "./types";
import { reason } from "./logs";

// Open-Meteo adapter (A3). One zero-key fetch to each of the forecast and
// air-quality endpoints fills the heat / rain / uv / dust layers of the
// conditions schema. Free for non-commercial use (which mugilu is, forever).

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

export interface OpenMeteoConditions {
  heat: HeatConditions | null;
  rain: RainConditions | null;
  uv: UvConditions | null;
  dust: DustConditions | null;
  wind: WindConditions | null;
  visibility: VisibilityConditions | null;
  /** Modelled air pollutants, the gap-filler when no ground station is near.
   *  co is in mg/m³ (CPCB unit); the rest in µg/m³. */
  airModel: AirPollutants | null;
  /** Today's modelled daily maximum here, the local date it is for, and the
   *  point's elevation: the inputs to the heat-compared-with-normal read. */
  todayMax: TodayMax | null;
  /** A call failed or returned no reading, so some layers are missing for that reason. */
  failed: boolean;
}

export interface TodayMax {
  date: string;
  max_c: number;
  elevation_m?: number;
}

/** Simplified WBGT (shade) from temperature + humidity (Australian BoM):
 *  e = (RH/100)·6.105·exp(17.27·T/(237.7+T)); WBGT = 0.567·T + 0.393·e + 3.94.
 *  An explicit heat-stress index; runs slightly hot in very dry heat. */
export function wbgt(t?: number, rh?: number): number | undefined {
  if (t == null || rh == null) return undefined;
  const e = (rh / 100) * 6.105 * Math.exp((17.27 * t) / (237.7 + t));
  return +(0.567 * t + 0.393 * e + 3.94).toFixed(1);
}

interface OmResponse {
  current?: Record<string, unknown>;
  daily?: { time?: string[] } & Record<string, unknown[] | undefined>;
  hourly?: { time?: string[]; precipitation?: unknown[]; dust?: unknown[] };
  elevation?: number;
}

/** Round to ~1 km grid so nearby points share a cache key and one upstream call. */
function quantize(n: number): number {
  return +n.toFixed(2);
}

function num(x: unknown): number | undefined {
  return typeof x === "number" && Number.isFinite(x) ? x : undefined;
}

async function fetchCurrent(url: string): Promise<OmResponse> {
  // Cache the upstream at the edge. These values only change ~hourly.
  // Time-boxed: this is on the page's request path, so a slow upstream nulls its
  // layer (getOpenMeteo tolerates a failed call) instead of hanging the page.
  const res = await fetch(url, { cf: { cacheTtl: 900, cacheEverything: true }, signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);
  return (await res.json()) as OmResponse;
}

/**
 * Heat (incl. wet-bulb), rain, UV and dust for a point. Each upstream is
 * fetched independently. If one fails, the others still return (the failed
 * layer is null), so a flaky endpoint never blanks the whole response.
 */
export async function getOpenMeteo(lat: number, lon: number): Promise<OpenMeteoConditions> {
  const coords = `latitude=${quantize(lat)}&longitude=${quantize(lon)}&timezone=auto`;
  const forecastUrl =
    `${FORECAST_URL}?${coords}&current=` +
    "temperature_2m,relative_humidity_2m,apparent_temperature,wet_bulb_temperature_2m,precipitation,precipitation_probability," +
    "wind_speed_10m,wind_gusts_10m,wind_direction_10m,visibility" +
    // Today's high, for the heat-compared-with-normal read: the same request with
    // one more variable (11, which Open-Meteo counts as 1.1 calls).
    "&daily=temperature_2m_max&forecast_days=1";
  const airUrl =
    `${AIR_QUALITY_URL}?${coords}&current=` +
    "pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,ammonia,uv_index,dust,aerosol_optical_depth";

  const [forecast, air] = await Promise.allSettled([fetchCurrent(forecastUrl), fetchCurrent(airUrl)]);

  const out: OpenMeteoConditions = {
    heat: null,
    rain: null,
    uv: null,
    dust: null,
    wind: null,
    visibility: null,
    airModel: null,
    todayMax: null,
    failed: [forecast, air].some((r) => r.status === "rejected" || !r.value.current),
  };

  if (forecast.status === "fulfilled") {
    const { daily, elevation } = forecast.value;
    const max = num(daily?.temperature_2m_max?.[0]);
    const date = daily?.time?.[0];
    if (max != null && date) out.todayMax = { date, max_c: max, elevation_m: num(elevation) };
  }

  if (forecast.status === "fulfilled" && forecast.value.current) {
    const c = forecast.value.current;
    const t = num(c.temperature_2m);
    const rh = num(c.relative_humidity_2m);
    out.heat = {
      temp_c: t,
      humidity_pct: rh,
      apparent_c: num(c.apparent_temperature),
      wet_bulb_c: num(c.wet_bulb_temperature_2m),
      wbgt_c: wbgt(t, rh),
      source: "open-meteo",
    };
    out.rain = {
      precipitation_mm: num(c.precipitation),
      probability_pct: num(c.precipitation_probability),
      source: "open-meteo",
    };
    out.wind = {
      speed_kmh: num(c.wind_speed_10m),
      gust_kmh: num(c.wind_gusts_10m),
      direction_deg: num(c.wind_direction_10m),
      source: "open-meteo",
    };
    const vis = num(c.visibility);
    out.visibility = vis != null ? { meters: vis, source: "open-meteo" } : null;
  } else if (forecast.status === "rejected") {
    console.error(`[open-meteo] forecast failed: ${reason(forecast.reason)}`);
  }

  if (air.status === "fulfilled" && air.value.current) {
    const c = air.value.current;
    out.uv = { index: num(c.uv_index), source: "open-meteo" };
    out.dust = {
      dust_ug_m3: num(c.dust),
      aod: num(c.aerosol_optical_depth),
      source: "open-meteo",
    };
    const pm25 = num(c.pm2_5);
    const pm10 = num(c.pm10);
    const o3 = num(c.ozone);
    const no2 = num(c.nitrogen_dioxide);
    const so2 = num(c.sulphur_dioxide);
    const coUg = num(c.carbon_monoxide);
    const co = coUg != null ? +(coUg / 1000).toFixed(2) : undefined; // µg/m³ → mg/m³ (CPCB CO unit)
    const nh3 = num(c.ammonia);
    // Only offer a model fill when at least one PM value is present (PM drives AQI).
    out.airModel = pm25 != null || pm10 != null ? { pm25, pm10, o3, no2, so2, co, nh3 } : null;
  } else if (air.status === "rejected") {
    console.error(`[open-meteo] air-quality failed: ${reason(air.reason)}`);
  }

  return out;
}

const BULK_BATCH = 100;

/** A whole local day's modelled figures at a point: the history panel's record of each
 *  modelled hazard (heat, cold, rain, wind, fog, UV, dust). */
export interface WxDay {
  /** The local (India) date, YYYY-MM-DD. */
  date: string;
  feels_max?: number;
  feels_min?: number;
  rain_mm?: number;
  gust_kmh?: number;
  uv_max?: number;
  vis_min_m?: number;
  /** The day's highest hourly dust (µg/m³). */
  dust_max?: number;
}

/** Open-Meteo's daily variables for a WxDay, in the order of its fields. */
const DAILY_VARS = [
  ["feels_max", "apparent_temperature_max"],
  ["feels_min", "apparent_temperature_min"],
  ["rain_mm", "precipitation_sum"],
  ["gust_kmh", "wind_gusts_10m_max"],
  ["uv_max", "uv_index_max"],
  ["vis_min_m", "visibility_min"],
] as const;
// Yesterday and today in the daily arrays (index 0 is the day just ended); the hourly
// forecast keeps its own length (forecast_hours), so the 24-hour rain sum is unchanged.
const PAST_DAY = "&past_days=1&forecast_days=1";

/** The first (just ended) day of a pastDay response, with that day's highest hourly dust. */
function dayOf(fc: OmResponse | undefined, aq: OmResponse | undefined): WxDay | undefined {
  const date = fc?.daily?.time?.[0];
  if (!date) return undefined;
  const out: WxDay = { date };
  for (const [k, v] of DAILY_VARS) {
    const n = num(fc?.daily?.[v]?.[0]);
    if (n != null) out[k] = n;
  }
  const times = aq?.hourly?.time ?? [];
  const dust = (aq?.hourly?.dust ?? [])
    .filter((_, i) => times[i]?.startsWith(date))
    .map(num)
    .filter((n): n is number => n != null);
  if (dust.length) out.dust_max = Math.max(...dust);
  return out;
}

async function fetchBulk(url: string): Promise<OmResponse[]> {
  // Cron-only, but still bounded so one stuck batch can't eat the whole run.
  const res = await fetch(url, { cf: { cacheTtl: 600, cacheEverything: true }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`open-meteo bulk ${res.status}`);
  const body = (await res.json()) as OmResponse | OmResponse[];
  // Bulk (multi-coordinate) returns an array; a single coord returns an object.
  return Array.isArray(body) ? body : [body];
}

/**
 * Bulk heat/rain/UV/dust for many points, used to build the national grid.
 * Open-Meteo accepts ~100 coordinates per call and returns results in input
 * order, so we batch and stitch. Forecast + air-quality are fetched per batch
 * with allSettled, so one flaky endpoint only nulls those fields.
 * `pastDay` also asks, on the same two calls, for the day just ended (`day`): six daily
 * variables and the hourly dust, about a fifth more of Open-Meteo's quota for that run.
 */
export async function getOpenMeteoBulk(
  coords: Array<{ lat: number; lon: number }>,
  delayMs = 0,
  { pastDay = false }: { pastDay?: boolean } = {},
): Promise<(Wx & { day?: WxDay })[]> {
  const out: (Wx & { day?: WxDay })[] = new Array(coords.length);
  for (let i = 0; i < coords.length; i += BULK_BATCH) {
    if (i > 0 && delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    const chunk = coords.slice(i, i + BULK_BATCH);
    const lats = chunk.map((c) => c.lat.toFixed(3)).join(",");
    const lons = chunk.map((c) => c.lon.toFixed(3)).join(",");
    const common = `latitude=${lats}&longitude=${lons}&timezone=auto`;
    const past = pastDay ? PAST_DAY : "";
    const [fc, aq] = await Promise.allSettled([
      fetchBulk(
        `${FORECAST_URL}?${common}&current=` +
          "temperature_2m,relative_humidity_2m,apparent_temperature,wet_bulb_temperature_2m,precipitation" +
          "&hourly=precipitation&forecast_hours=24" +
          (pastDay ? `${past}&daily=${DAILY_VARS.map(([, v]) => v).join(",")}` : ""),
      ),
      fetchBulk(`${AIR_QUALITY_URL}?${common}&current=uv_index,dust${pastDay ? `${past}&hourly=dust` : ""}`),
    ]);
    const fcArr = fc.status === "fulfilled" ? fc.value : [];
    const aqArr = aq.status === "fulfilled" ? aq.value : [];
    for (let j = 0; j < chunk.length; j++) {
      const f = fcArr[j]?.current ?? {};
      const a = aqArr[j]?.current ?? {};
      const next24 = fcArr[j]?.hourly?.precipitation;
      out[i + j] = {
        temp_c: num(f.temperature_2m),
        apparent_c: num(f.apparent_temperature),
        wet_bulb_c: num(f.wet_bulb_temperature_2m),
        humidity_pct: num(f.relative_humidity_2m),
        rain_mm: num(f.precipitation),
        rain_24h_mm: next24 ? +next24.reduce((s: number, v) => s + (num(v) ?? 0), 0).toFixed(1) : undefined,
        uv: num(a.uv_index),
        dust_ug_m3: num(a.dust),
        ...(pastDay ? { day: dayOf(fcArr[j], aqArr[j]) } : {}),
      };
    }
  }
  return out;
}
