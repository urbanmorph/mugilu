import type { NormalizedStation } from "./types";
import type { GeoResult } from "./geocode";

export interface Suggestion {
  label: string;
  sublabel?: string;
  lat: number;
  lon: number;
  kind: "coord" | "station" | "place";
}

// Well-known Indian city renames / colloquial names → canonical form, plus
// native-script names for the major station cities so an Indian-script query
// reaches our (English-named) station gazetteer directly. Keys are matched
// case-folded; native scripts are caseless, so the literal form is the key.
const ALIASES: Record<string, string> = {
  bangalore: "Bengaluru",
  bombay: "Mumbai",
  calcutta: "Kolkata",
  madras: "Chennai",
  poona: "Pune",
  gurgaon: "Gurugram",
  trivandrum: "Thiruvananthapuram",
  pondicherry: "Puducherry",
  baroda: "Vadodara",
  mysore: "Mysuru",
  mangalore: "Mangaluru",
  // Native-script aliases (Hindi + the city's own script) for station cities.
  बेंगलुरु: "Bengaluru",
  ಬೆಂಗಳೂರು: "Bengaluru",
  பெங்களூரு: "Bengaluru",
  मुंबई: "Mumbai",
  મુંબઈ: "Mumbai",
  दिल्ली: "Delhi",
  "नई दिल्ली": "Delhi",
  चेन्नई: "Chennai",
  சென்னை: "Chennai",
  कोलकाता: "Kolkata",
  কলকাতা: "Kolkata",
  हैदराबाद: "Hyderabad",
  హైదరాబాద్: "Hyderabad",
  पुणे: "Pune",
  अहमदाबाद: "Ahmedabad",
  અમદાવાદ: "Ahmedabad",
  जयपुर: "Jaipur",
  लखनऊ: "Lucknow",
  कानपुर: "Kanpur",
  कोच्चि: "Kochi",
};

/** Rewrite a known old/colloquial city name to its canonical form. */
export function applyAlias(q: string): string {
  const t = q.trim();
  return ALIASES[t.toLowerCase()] ?? t;
}

/** Detect a "lat,lon" (or "lat, lon") query → coordinates, else null. */
export function parseCoordQuery(q: string): { lat: number; lon: number } | null {
  const m = q.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

/**
 * Gazetteer: match the query against the station names + cities we already
 * hold (prefix first, then substring). Instant, no upstream call, and uniquely
 * ours, since these are India's actual air-monitoring points.
 */
export function matchStations(stations: NormalizedStation[], q: string, limit: number): Suggestion[] {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) return [];
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  for (const prefixPass of [true, false]) {
    for (const s of stations) {
      if (s.lat == null || s.lon == null) continue;
      const name = s.name.toLowerCase();
      const city = s.city.toLowerCase();
      const hit = prefixPass
        ? name.startsWith(needle) || city.startsWith(needle)
        : name.includes(needle) || city.includes(needle);
      if (!hit) continue;
      const key = `${s.name}|${s.city}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ label: s.name, sublabel: s.city || undefined, lat: s.lat, lon: s.lon, kind: "station" });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/**
 * Build typeahead suggestions: a coord query short-circuits; otherwise apply the
 * alias, match our gazetteer (stations first, our unique value), and merge
 * India-ranked geocoded places. Geocoding is injected for testability.
 */
export async function buildSuggestions(
  stations: NormalizedStation[],
  q: string,
  geocodeList: (query: string, count: number) => Promise<GeoResult[]>,
  limit = 6,
): Promise<Suggestion[]> {
  const coord = parseCoordQuery(q);
  if (coord) {
    return [
      { label: `${coord.lat}, ${coord.lon}`, sublabel: "coordinates", lat: coord.lat, lon: coord.lon, kind: "coord" },
    ];
  }

  const query = applyAlias(q);
  const stationHits = matchStations(stations, query, limit);

  // The gazetteer is instant and uniquely ours. Only pay for a geocoding
  // network call (~700ms) when it finds nothing. This keeps the typeahead snappy
  // for the common case (most Indian queries are near a station we already hold).
  if (stationHits.length > 0) return stationHits;

  const geo = await geocodeList(query, 5);
  const ranked = [...geo].sort((a, b) => (b.country_code === "IN" ? 1 : 0) - (a.country_code === "IN" ? 1 : 0));
  return ranked.slice(0, limit).map((r) => ({
    label: r.name,
    sublabel: [r.admin1, r.country_code].filter(Boolean).join(", ") || undefined,
    lat: r.lat,
    lon: r.lon,
    kind: "place",
  }));
}
