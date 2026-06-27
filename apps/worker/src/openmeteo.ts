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
}

/** Simplified WBGT (shade) from temperature + humidity (Australian BoM):
 *  e = (RH/100)·6.105·exp(17.27·T/(237.7+T)); WBGT = 0.567·T + 0.393·e + 3.94.
 *  An explicit heat-stress index; runs slightly hot in very dry heat. */
function wbgt(t?: number, rh?: number): number | undefined {
  if (t == null || rh == null) return undefined;
  const e = (rh / 100) * 6.105 * Math.exp((17.27 * t) / (237.7 + t));
  return +(0.567 * t + 0.393 * e + 3.94).toFixed(1);
}

interface OmResponse {
  current?: Record<string, unknown>;
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
  const res = await fetch(url, { cf: { cacheTtl: 900, cacheEverything: true } });
  if (!res.ok) throw new Error(`open-meteo ${res.status}: ${url}`);
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
    "wind_speed_10m,wind_gusts_10m,wind_direction_10m,visibility";
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
  };

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
    console.error("[open-meteo] forecast failed:", forecast.reason);
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
    console.error("[open-meteo] air-quality failed:", air.reason);
  }

  return out;
}

const BULK_BATCH = 100;

async function fetchBulk(url: string): Promise<OmResponse[]> {
  const res = await fetch(url, { cf: { cacheTtl: 600, cacheEverything: true } });
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
 */
export async function getOpenMeteoBulk(coords: Array<{ lat: number; lon: number }>, delayMs = 0): Promise<Wx[]> {
  const out: Wx[] = new Array(coords.length);
  for (let i = 0; i < coords.length; i += BULK_BATCH) {
    if (i > 0 && delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    const chunk = coords.slice(i, i + BULK_BATCH);
    const lats = chunk.map((c) => c.lat.toFixed(3)).join(",");
    const lons = chunk.map((c) => c.lon.toFixed(3)).join(",");
    const common = `latitude=${lats}&longitude=${lons}&timezone=auto`;
    const [fc, aq] = await Promise.allSettled([
      fetchBulk(
        `${FORECAST_URL}?${common}&current=` +
          "temperature_2m,relative_humidity_2m,apparent_temperature,wet_bulb_temperature_2m,precipitation",
      ),
      fetchBulk(`${AIR_QUALITY_URL}?${common}&current=uv_index,dust`),
    ]);
    const fcArr = fc.status === "fulfilled" ? fc.value : [];
    const aqArr = aq.status === "fulfilled" ? aq.value : [];
    for (let j = 0; j < chunk.length; j++) {
      const f = fcArr[j]?.current ?? {};
      const a = aqArr[j]?.current ?? {};
      out[i + j] = {
        temp_c: num(f.temperature_2m),
        apparent_c: num(f.apparent_temperature),
        wet_bulb_c: num(f.wet_bulb_temperature_2m),
        humidity_pct: num(f.relative_humidity_2m),
        rain_mm: num(f.precipitation),
        uv: num(a.uv_index),
        dust_ug_m3: num(a.dust),
      };
    }
  }
  return out;
}
