import type { HeatConditions, RainConditions, UvConditions, DustConditions } from "./types";

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
  // Cache the upstream at the edge — these values only change ~hourly.
  const res = await fetch(url, { cf: { cacheTtl: 900, cacheEverything: true } });
  if (!res.ok) throw new Error(`open-meteo ${res.status}: ${url}`);
  return (await res.json()) as OmResponse;
}

/**
 * Heat (incl. wet-bulb), rain, UV and dust for a point. Each upstream is
 * fetched independently — if one fails, the others still return (the failed
 * layer is null), so a flaky endpoint never blanks the whole response.
 */
export async function getOpenMeteo(lat: number, lon: number): Promise<OpenMeteoConditions> {
  const coords = `latitude=${quantize(lat)}&longitude=${quantize(lon)}&timezone=auto`;
  const forecastUrl =
    `${FORECAST_URL}?${coords}&current=` +
    "temperature_2m,relative_humidity_2m,apparent_temperature,wet_bulb_temperature_2m,precipitation";
  const airUrl = `${AIR_QUALITY_URL}?${coords}&current=uv_index,dust,aerosol_optical_depth`;

  const [forecast, air] = await Promise.allSettled([fetchCurrent(forecastUrl), fetchCurrent(airUrl)]);

  const out: OpenMeteoConditions = { heat: null, rain: null, uv: null, dust: null };

  if (forecast.status === "fulfilled" && forecast.value.current) {
    const c = forecast.value.current;
    out.heat = {
      temp_c: num(c.temperature_2m),
      humidity_pct: num(c.relative_humidity_2m),
      apparent_c: num(c.apparent_temperature),
      wet_bulb_c: num(c.wet_bulb_temperature_2m),
      source: "open-meteo",
    };
    out.rain = { precipitation_mm: num(c.precipitation), source: "open-meteo" };
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
  } else if (air.status === "rejected") {
    console.error("[open-meteo] air-quality failed:", air.reason);
  }

  return out;
}
