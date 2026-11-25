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
import { earliestIso } from "./ist";
import type { CacheLike } from "./edge";

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
  /** A call failed or returned no reading, so some layers are missing (or stand in) for that reason. */
  failed: boolean;
  /** When a failed call was filled from this point's last good answer: that answer's time
   *  (the older one, if both were). Each layer so filled carries it as as_of. */
  staleAt?: string;
  /** The time of a stand-in airModel; absent when it is live. */
  airModelAt?: string;
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

// The page's weather call is on the request path, so it has a budget. Most answers come
// in about half a second; a call still open at HEDGE_MS, or refused for a passing reason,
// is asked once more (a fresh connection often answers at once), and the first good
// answer wins. Never more than two calls, never past BUDGET_MS. (W26)
const HEDGE_MS = 2000;
const BUDGET_MS = 4000;
const PASSING = new Set([429, 502, 503, 504]);
// A good answer is kept per exact point (same URL), so a failed call can show it, dated.
const STALE_MAX_MS = 3 * 3600_000;
const AT = "x-mugilu-at";

export interface FetchOptions {
  store?: CacheLike;
  hedgeMs?: number;
  budgetMs?: number;
  /** The time a good answer is kept as (tests). */
  now?: number;
}

class Refused extends Error {
  constructor(readonly status: number) {
    super(`open-meteo ${status}`);
  }
}

async function ask(url: string, signal: AbortSignal, again = false): Promise<OmResponse> {
  // Cache the upstream at the edge: these values only change ~hourly. A second call goes
  // straight to Open-Meteo, so the edge cannot hold it behind the first call's open fetch.
  const cf = again ? { cacheEverything: false } : { cacheTtl: 900, cacheEverything: true };
  const res = await fetch(url, { cf, signal });
  if (!res.ok) throw new Refused(res.status);
  return (await res.json()) as OmResponse;
}

/** One answer within the budget: a second call when the first stalls or is refused for a
 *  passing reason. The first call's error is the one reported. */
async function fetchCurrent(url: string, hedgeMs = HEDGE_MS, budgetMs = BUDGET_MS): Promise<OmResponse> {
  const ctl = new AbortController();
  const budget = setTimeout(() => ctl.abort(new DOMException("open-meteo took too long", "TimeoutError")), budgetMs);
  const signal = ctl.signal;
  const first = ask(url, signal);
  const second = new Promise<OmResponse>((resolve, reject) => {
    const go = () => ask(url, signal, true).then(resolve, reject);
    const timer = setTimeout(go, hedgeMs);
    first.then(
      () => clearTimeout(timer),
      (e) => {
        clearTimeout(timer);
        if (e instanceof Refused && !PASSING.has(e.status)) reject(e);
        else if (!signal.aborted) go();
        else reject(e);
      },
    );
  });
  try {
    return await Promise.any([first, second]);
  } catch (e) {
    throw (e as AggregateError).errors?.[0] ?? e;
  } finally {
    clearTimeout(budget);
    ctl.abort(); // the call that lost, if one is still open
  }
}

const staleKey = (url: string) => new Request(`https://stale.mugilu.invalid/?u=${encodeURIComponent(url)}`);

/** Keep a good answer for this exact URL. Best effort: a failed write never fails the read. */
async function keep(store: CacheLike | undefined, url: string, body: OmResponse, now: number): Promise<void> {
  if (!store) return;
  const headers = {
    "content-type": "application/json",
    "cache-control": `max-age=${STALE_MAX_MS / 1000}`,
    [AT]: String(now),
  };
  await store.put(staleKey(url), new Response(JSON.stringify(body), { headers })).catch(() => {});
}

/** This URL's last good answer and its time, if one is kept and young enough. */
async function recall(store: CacheLike | undefined, url: string): Promise<{ body: OmResponse; at: number } | null> {
  const hit = store ? await store.match(staleKey(url)).catch(() => undefined) : undefined;
  const at = Number(hit?.headers.get(AT));
  if (!hit || !at || Date.now() - at > STALE_MAX_MS) return null;
  return { body: (await hit.json()) as OmResponse, at };
}

/** A live answer (kept for next time), else the kept one with its time, else the failure. */
async function answer(url: string, o: FetchOptions): Promise<{ body: OmResponse; staleAt?: string }> {
  try {
    const body = await fetchCurrent(url, o.hedgeMs, o.budgetMs);
    if (body.current) await keep(o.store, url, body, o.now ?? Date.now());
    return { body };
  } catch (e) {
    const kept = await recall(o.store, url);
    if (!kept) throw e;
    console.error(
      `[open-meteo] ${url.includes("air-quality") ? "air-quality" : "forecast"} failed (${reason(e)}); used this point's answer from ${new Date(kept.at).toISOString()}`,
    );
    return { body: kept.body, staleAt: new Date(kept.at).toISOString() };
  }
}

const edgeCache = (): CacheLike | undefined => (globalThis as { caches?: { default?: CacheLike } }).caches?.default;

/**
 * Heat (incl. wet-bulb), rain, UV and dust for a point. Each upstream is
 * fetched independently. If one fails, the others still return (the failed
 * layer is null), so a flaky endpoint never blanks the whole response.
 */
export async function getOpenMeteo(lat: number, lon: number, opts: FetchOptions = {}): Promise<OpenMeteoConditions> {
  const o = { store: edgeCache(), ...opts };
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

  const [fcAns, airAns] = await Promise.allSettled([answer(forecastUrl, o), answer(airUrl, o)]);
  const fcAt = fcAns.status === "fulfilled" ? fcAns.value.staleAt : undefined;
  const airAt = airAns.status === "fulfilled" ? airAns.value.staleAt : undefined;
  const forecast = settledBody(fcAns);
  const air = settledBody(airAns);

  const out: OpenMeteoConditions = {
    heat: null,
    rain: null,
    uv: null,
    dust: null,
    wind: null,
    visibility: null,
    airModel: null,
    todayMax: null,
    failed: !!(fcAt || airAt) || [forecast, air].some((r) => r.status === "rejected" || !r.value.current),
  };
  const staleAt = earliestIso(fcAt, airAt);
  if (staleAt) out.staleAt = staleAt;
  const kept = (at?: string) => (at ? { as_of: at, stand_in: "kept" as const } : {});
  const fcDated = kept(fcAt);
  const airDated = kept(airAt);

  // An old copy's daily high may be another day's, so today's high comes only live.
  if (forecast.status === "fulfilled" && !fcAt) {
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
      ...fcDated,
    };
    out.rain = {
      precipitation_mm: num(c.precipitation),
      probability_pct: num(c.precipitation_probability),
      source: "open-meteo",
      ...fcDated,
    };
    out.wind = {
      speed_kmh: num(c.wind_speed_10m),
      gust_kmh: num(c.wind_gusts_10m),
      direction_deg: num(c.wind_direction_10m),
      source: "open-meteo",
      ...fcDated,
    };
    const vis = num(c.visibility);
    out.visibility = vis != null ? { meters: vis, source: "open-meteo", ...fcDated } : null;
  } else if (forecast.status === "rejected") {
    console.error(`[open-meteo] forecast failed: ${reason(forecast.reason)}`);
  }

  if (air.status === "fulfilled" && air.value.current) {
    const c = air.value.current;
    out.uv = { index: num(c.uv_index), source: "open-meteo", ...airDated };
    out.dust = {
      dust_ug_m3: num(c.dust),
      aod: num(c.aerosol_optical_depth),
      source: "open-meteo",
      ...airDated,
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
    if (out.airModel && airAt) out.airModelAt = airAt;
  } else if (air.status === "rejected") {
    console.error(`[open-meteo] air-quality failed: ${reason(air.reason)}`);
  }

  return out;
}

/** The settled answer's body, in the shape the layer code reads. */
function settledBody(r: PromiseSettledResult<{ body: OmResponse }>): PromiseSettledResult<OmResponse> {
  return r.status === "fulfilled" ? { status: "fulfilled", value: r.value.body } : r;
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
