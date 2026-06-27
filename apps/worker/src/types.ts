export type ProviderId = "cpcb" | "airnet" | "aurassure";

export const PROVIDERS: ProviderId[] = ["cpcb", "airnet", "aurassure"];

export interface Signature {
  baseUrl: string;   // "https://oaq.notf.in/v1/"
  signature: string; // "URLPrefix=…&Expires=…&KeyName=…&Signature=…"
  expires: number;   // unix seconds
}

// Shape of OAQ's upstream all_stations_latest.json (best-effort; fields are
// defensively optional because the API is undocumented).
export interface UpstreamStation {
  id?: string | number;
  name?: string;
  city?: string;
  state?: string;
  country?: string;
  lat?: number;
  lon?: number;
  latitude?: number;
  longitude?: number;
  pollutants?: Record<string, number | null | undefined>;
  readings?: Record<string, number | null | undefined>;
  timestamp?: string;
  last_updated?: string;
  [k: string]: unknown;
}

export interface NormalizedStation {
  id: string;            // "{provider}-{raw_id}", globally unique
  raw_id: string;        // upstream id, as-is (may contain hyphens)
  provider: ProviderId;
  name: string;
  city: string;
  state: string;
  lat: number | null;
  lon: number | null;
  pollutants: {
    pm25?: number;
    pm10?: number;
    no2?: number;
    so2?: number;
    co?: number;
    o3?: number;
    nh3?: number;
  };
  aqi: number | null;
  band: "good" | "satisfactory" | "moderate" | "poor" | "vpoor" | "severe" | "unknown";
  ts: string | null;
  /** AQLI: years of life expectancy lost if this PM2.5 level persisted as
   *  the annual average. max(0, pm25 − 5) × 0.098. Null if no pm25. */
  yll?: number | null;
}

export interface Snapshot {
  generated_at: string;
  station_count: number;
  providers: ProviderId[];
  stations: NormalizedStation[];
}

// ── Conditions: the coordinate → conditions contract ────────────────────────
// The keystone of mugilu. Each data source is an adapter that fills part of
// this; layers we can't fill are null. Provenance (`source`), `attribution`,
// and the `disclaimer` travel WITH the data (see conditions.ts) so a consumer
// that drops the MCP/init instructions still receives the licence terms.

/** A station plus its great-circle distance from the query point. */
export interface NearStation extends NormalizedStation {
  distance_km: number;
}

/** Air quality at a point, taken from the nearest ground station. */
export interface AirConditions {
  aqi: number | null;
  band: NormalizedStation["band"];
  pollutants: NormalizedStation["pollutants"];
  /** AQLI years-of-life lost from PM2.5; null if no PM2.5. */
  yll: number | null;
  /** The station this reading came from, and how far it is. */
  station: { id: string; name: string; city: string; distance_km: number };
  /** Provider behind the reading (via the OAQ broker). */
  source: ProviderId;
}

/** Heat / humid-heat, modelled. Filled by the Open-Meteo adapter (A3). */
export interface HeatConditions {
  temp_c?: number;
  humidity_pct?: number;
  apparent_c?: number; // "feels like"
  wet_bulb_c?: number; // survivability metric
  source: string;
}

export interface RainConditions {
  precipitation_mm?: number;
  probability_pct?: number;
  source: string;
}

export interface UvConditions {
  index?: number;
  source: string;
}

export interface DustConditions {
  aod?: number; // aerosol optical depth (unitless)
  dust_ug_m3?: number;
  source: string;
}

/** An official NDMA/SACHET warning active at a point (IMD/SDMA-issued). */
export interface Warning {
  event: string; // disaster_type, e.g. "Thunderstorm with Lightning"
  severity: string; // WATCH / Severe / Extreme …
  color: string; // severity_color: yellow / orange / red
  certainty: string; // severity_level
  area: string; // area_description
  issuer: string; // alert_source
  until: string; // short effective-end time
  identifier: string; // → FetchXMLFile for full CAP
  headline: string; // warning_message (may be localized)
}

/** The assembled response for /c/{lat},{lon} (A4). Unfilled layers are null. */
export interface Conditions {
  location: { lat: number; lon: number };
  /** Nearest admin label (ward in metros, district elsewhere), if resolvable. */
  place?: string;
  as_of: string; // ISO timestamp of assembly
  air: AirConditions | null;
  heat: HeatConditions | null;
  rain: RainConditions | null;
  uv: UvConditions | null;
  dust: DustConditions | null;
  /** Official NDMA/SACHET warnings active at this point. */
  warnings?: Warning[];
  /** Ready-to-paste credit line for whatever sources contributed. */
  attribution: string;
  /** Always present, always relayed. */
  disclaimer: string;
}

// ── National conditions grid (the de-bias) ──────────────────────────────────
// Heat/rain/UV/dust come from a model that covers everywhere, so they're sampled
// over a tiered admin grid (districts nationally + city wards), not the air
// monitors. See data/centroids.json + scripts/build-centroids.mjs.

/** Modelled weather conditions at a point (Open-Meteo). */
export interface Wx {
  temp_c?: number;
  apparent_c?: number; // "feels like"
  wet_bulb_c?: number;
  humidity_pct?: number;
  rain_mm?: number;
  uv?: number;
  dust_ug_m3?: number;
}

/** A sampling point from the admin grid (district or city ward). */
export interface Centroid {
  id: string;
  name: string;
  level: string; // "district" | "ward"
  source_layer: string;
  lat: number;
  lon: number;
}

/** A grid point with its current conditions. */
export interface ConditionsPoint extends Centroid {
  wx: Wx;
}

export interface ConditionsSnapshot {
  generated_at: string;
  point_count: number;
  points: ConditionsPoint[];
}
