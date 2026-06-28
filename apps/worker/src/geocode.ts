// Geocoding adapter: place name → coordinates, via Open-Meteo's free, key-free
// geocoding API (on-brand; we already use Open-Meteo). City/town/neighbourhood
// level; pincodes don't resolve here (a later source can fill that gap).

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

// Indian-script Unicode blocks → Open-Meteo geocoder language code. The geocoder
// only returns native-script place names when `language` matches the query's
// script (GeoNames alternate-names are language-keyed), so a Devanagari/Tamil/etc.
// query with the default language=en returns nothing. Detect it from the query.
function scriptLang(q: string): string {
  if (/[ऀ-ॿ]/.test(q)) return "hi"; // Devanagari (Hindi/Marathi)
  if (/[ঀ-৿]/.test(q)) return "bn"; // Bengali
  if (/[਀-੿]/.test(q)) return "pa"; // Gurmukhi (Punjabi)
  if (/[઀-૿]/.test(q)) return "gu"; // Gujarati
  if (/[଀-୿]/.test(q)) return "or"; // Odia
  if (/[஀-௿]/.test(q)) return "ta"; // Tamil
  if (/[ఀ-౿]/.test(q)) return "te"; // Telugu
  if (/[ಀ-೿]/.test(q)) return "kn"; // Kannada
  if (/[ഀ-ൿ]/.test(q)) return "ml"; // Malayalam
  return "en";
}

/** Airport feature codes: the geocoder sometimes ranks the airport above the
 *  city of the same name (especially for native-script queries). Down-ranked. */
function isAirport(code?: string): boolean {
  return code === "AIRP" || code === "AIRH" || code === "AIRB" || code === "AIRF";
}

export interface GeoResult {
  name: string;
  admin1?: string;
  country_code?: string;
  feature_code?: string;
  lat: number;
  lon: number;
}

interface OmGeoResponse {
  results?: Array<{
    name?: string;
    admin1?: string;
    country_code?: string;
    feature_code?: string;
    latitude?: number;
    longitude?: number;
  }>;
}

/** Resolve a query to up to `count` matching places (best first), or []. */
export async function geocodeList(query: string, count = 1): Promise<GeoResult[]> {
  const q = query.trim();
  if (!q) return [];

  const language = scriptLang(q);
  // For native-script queries, fetch a few even when the caller wants one, so a
  // city can be preferred over the airport of the same name before slicing.
  const fetchCount = language === "en" ? count : Math.max(count, 5);
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(q)}&count=${fetchCount}&language=${language}`;
  try {
    // Place → coords is stable; cache hard at the edge. Time-box the upstream so
    // a slow geocoder can never hang a request.
    const res = await fetch(url, {
      cf: { cacheTtl: 86400, cacheEverything: true },
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as OmGeoResponse;
    const results = (body.results ?? [])
      .filter((r) => typeof r.latitude === "number" && typeof r.longitude === "number")
      .map((r) => ({
        name: r.name ?? q,
        admin1: r.admin1,
        country_code: r.country_code,
        feature_code: r.feature_code,
        lat: r.latitude as number,
        lon: r.longitude as number,
      }));
    // Stable down-rank of airports so the city outranks the airport of the same name.
    results.sort((a, b) => (isAirport(a.feature_code) ? 1 : 0) - (isAirport(b.feature_code) ? 1 : 0));
    return results.slice(0, count);
  } catch {
    return [];
  }
}

/** Resolve a query to the single best matching place, or null. */
export async function geocode(query: string): Promise<GeoResult | null> {
  return (await geocodeList(query, 1))[0] ?? null;
}
