// Geocoding adapter — place name → coordinates, via Open-Meteo's free, key-free
// geocoding API (on-brand; we already use Open-Meteo). City/town/neighbourhood
// level; pincodes don't resolve here (a later source can fill that gap).

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

export interface GeoResult {
  name: string;
  admin1?: string;
  country_code?: string;
  lat: number;
  lon: number;
}

interface OmGeoResponse {
  results?: Array<{
    name?: string;
    admin1?: string;
    country_code?: string;
    latitude?: number;
    longitude?: number;
  }>;
}

/** Resolve a query to up to `count` matching places (best first), or []. */
export async function geocodeList(query: string, count = 1): Promise<GeoResult[]> {
  const q = query.trim();
  if (!q) return [];

  const url = `${GEOCODE_URL}?name=${encodeURIComponent(q)}&count=${count}&language=en`;
  try {
    // Place → coords is stable; cache hard at the edge. Time-box the upstream so
    // a slow geocoder can never hang a request.
    const res = await fetch(url, {
      cf: { cacheTtl: 86400, cacheEverything: true },
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as OmGeoResponse;
    return (body.results ?? [])
      .filter((r) => typeof r.latitude === "number" && typeof r.longitude === "number")
      .map((r) => ({
        name: r.name ?? q,
        admin1: r.admin1,
        country_code: r.country_code,
        lat: r.latitude as number,
        lon: r.longitude as number,
      }));
  } catch {
    return [];
  }
}

/** Resolve a query to the single best matching place, or null. */
export async function geocode(query: string): Promise<GeoResult | null> {
  return (await geocodeList(query, 1))[0] ?? null;
}
