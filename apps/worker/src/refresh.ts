import type { Env } from "./index";
import { getSignature, signUrl } from "./handshake";
import { PROVIDERS, type NormalizedStation, type ProviderId, type Snapshot, type UpstreamStation } from "./types";
import { computeAqi, aqiBand } from "./aqi";

// AQLI coefficient from Ebenstein et al. 2017 PNAS (0.098 yr per µg/m³)
// above the WHO 2021 annual PM2.5 guideline (5 µg/m³).
function lifeYearsLost(pm25: number | undefined): number | null {
  if (pm25 === undefined || !Number.isFinite(pm25)) return null;
  return +(Math.max(0, pm25 - 5) * 0.098).toFixed(2);
}

function num(x: unknown): number | undefined {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string" && x.trim() !== "") {
    const n = Number(x);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function pickCoords(s: UpstreamStation): { lat: number | null; lon: number | null } {
  const lat = num(s.lat) ?? num(s.latitude) ?? null;
  const lon = num(s.lon) ?? num(s.longitude) ?? null;
  return { lat, lon };
}

// Pull pollutant values from whichever shape the upstream uses. The OAQ feed is
// undocumented and shapes vary across providers. We try several keys.
function pickPollutants(raw: UpstreamStation): NormalizedStation["pollutants"] {
  const src: Record<string, unknown> = {
    ...(raw.pollutants ?? {}),
    ...(raw.readings ?? {}),
    ...raw,
  };

  const pick = (...keys: string[]): number | undefined => {
    for (const k of keys) {
      const v = num(src[k]);
      if (v !== undefined) return v;
    }
    return undefined;
  };

  const p: NormalizedStation["pollutants"] = {};
  const pm25 = pick("pm25", "PM2.5", "pm2_5", "pm25_avg");
  const pm10 = pick("pm10", "PM10", "pm10_avg");
  const no2 = pick("no2", "NO2");
  const so2 = pick("so2", "SO2");
  const co = pick("co", "CO");
  const o3 = pick("o3", "O3", "ozone");
  const nh3 = pick("nh3", "NH3");
  if (pm25 !== undefined) p.pm25 = pm25;
  if (pm10 !== undefined) p.pm10 = pm10;
  if (no2 !== undefined) p.no2 = no2;
  if (so2 !== undefined) p.so2 = so2;
  if (co !== undefined) p.co = co;
  if (o3 !== undefined) p.o3 = o3;
  if (nh3 !== undefined) p.nh3 = nh3;
  return p;
}

/**
 * Strip trailing "city + agency" suffixes from station names.
 *
 * The OAQ feed often embeds the city and the reporting agency in the name,
 * producing strings like:
 *   "Ashok Vihar, Delhi - DPCC"
 *   "Sadanand Nagar, Mehsana - Nexteng Enviro"
 *   "Worli, Mumbai -MPCB"
 *
 * When we already know the city from the `city` field, strip from the first
 * occurrence of ", {city}" onwards. This handles agency names we could never
 * enumerate (Nexteng Enviro, IPCA Lab, Kerala PCB, Birla Cement, …) without
 * breaking legitimate names like "Knowledge Park - V" or "North Campus, DU"
 * where the trailing segment isn't the city.
 *
 * Falls back to the old regex for names where we don't have a city.
 */
export function cleanStationName(name: string, city?: string): string {
  let out = name.trim();

  // Step 1: if we know the city, strip ", {city} …" exactly (most precise).
  if (city) {
    const c = city.trim();
    if (c) {
      const re = new RegExp(`,\\s*${c.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b.*$`, "iu");
      out = out.replace(re, "").trim();
    }
  }

  // Step 2: generic agency suffix: ", <anything up to 60 chars> - <agency>"
  // where <agency> is a short uppercase token OR a word that looks like an
  // agency name (2+ words, or contains "PCB", "Lab", "Cement", "Ltd").
  // Done after the city step so "Mundka, Delhi - DPCC" gets ", Delhi - DPCC"
  // stripped even when s.city is "New Delhi".
  out = out.replace(/,\s*[^,]{1,60}\s*-\s*[A-Z][A-Za-z.]{1,30}(?:\s+[A-Za-z.]{1,30}){0,3}\s*$/u, "").trim();

  // Step 3: no-space dash agency (e.g. "Worli, Mumbai -MPCB").
  out = out.replace(/,\s*[^,]{1,60}\s*-[A-Z]{2,8}\s*$/u, "").trim();

  // Defensive: never return empty.
  return out || name.trim();
}

function normalize(provider: ProviderId, raw: UpstreamStation): NormalizedStation {
  const { lat, lon } = pickCoords(raw);
  const pollutants = pickPollutants(raw);
  const aqi = computeAqi(pollutants);
  const rawId = String(raw.id ?? raw.name ?? "unknown").trim();
  const id = `${provider}-${rawId}`;
  const city = String(raw.city ?? "").trim();
  return {
    id,
    raw_id: rawId,
    provider,
    name: cleanStationName(String(raw.name ?? "Unknown").trim(), city),
    city,
    state: String(raw.state ?? "").trim(),
    lat,
    lon,
    pollutants,
    aqi,
    band: aqiBand(aqi),
    ts: (raw.timestamp as string) ?? (raw.last_updated as string) ?? null,
    yll: lifeYearsLost(pollutants.pm25),
  };
}

async function fetchProvider(env: Env, provider: ProviderId): Promise<UpstreamStation[]> {
  const sig = await getSignature(env);
  const url = signUrl(sig, `provider=${provider}/live/global/all_stations_latest.json`);
  const res = await fetch(url, { cf: { cacheEverything: false } });
  // Log any rate-limit headers the upstream exposes so we notice if we get close.
  const used = res.headers.get("x-ratelimit-used");
  const remaining = res.headers.get("x-ratelimit-remaining");
  const limit = res.headers.get("x-ratelimit-limit");
  if (used || remaining || limit) {
    console.log(`[ratelimit] ${provider} used=${used} remaining=${remaining} limit=${limit}`);
  }
  if (!res.ok) {
    throw new Error(`provider ${provider} fetch failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
  const body = (await res.json()) as { stations?: UpstreamStation[] } | UpstreamStation[];
  if (Array.isArray(body)) return body;
  return body.stations ?? [];
}

export async function refreshLatest(env: Env): Promise<Snapshot> {
  const all: NormalizedStation[] = [];
  for (const p of PROVIDERS) {
    try {
      const raws = await fetchProvider(env, p);
      for (const raw of raws) all.push(normalize(p, raw));
    } catch (e) {
      console.error(`[refresh] provider ${p}:`, e);
    }
  }

  // Sort worst first: valid AQI desc, unknowns last.
  all.sort((a, b) => {
    if (a.aqi === null && b.aqi === null) return a.name.localeCompare(b.name);
    if (a.aqi === null) return 1;
    if (b.aqi === null) return -1;
    if (b.aqi !== a.aqi) return b.aqi - a.aqi;
    const ap = a.pollutants.pm25 ?? 0;
    const bp = b.pollutants.pm25 ?? 0;
    if (bp !== ap) return bp - ap;
    return a.name.localeCompare(b.name);
  });

  const snapshot: Snapshot = {
    generated_at: new Date().toISOString(),
    station_count: all.length,
    providers: [...PROVIDERS],
    stations: all,
  };

  // Write full + top slices to R2.
  const writes: Promise<unknown>[] = [
    env.OAQ_R2.put("data/latest.json", JSON.stringify(snapshot, null, 2), {
      httpMetadata: { contentType: "application/json", cacheControl: "public, max-age=60" },
    }),
    env.OAQ_R2.put("data/latest.min.json", JSON.stringify(snapshot), {
      httpMetadata: { contentType: "application/json", cacheControl: "public, max-age=60" },
    }),
    env.OAQ_R2.put(
      "data/worst-top-50.json",
      JSON.stringify({ ...snapshot, stations: all.filter((s) => s.aqi !== null).slice(0, 50) }),
      { httpMetadata: { contentType: "application/json" } },
    ),
    env.OAQ_R2.put(
      "data/best-top-50.json",
      JSON.stringify({
        ...snapshot,
        stations: [...all.filter((s) => s.aqi !== null)].sort((a, b) => a.aqi! - b.aqi!).slice(0, 50),
      }),
      { httpMetadata: { contentType: "application/json" } },
    ),
  ];
  await Promise.all(writes);
  return snapshot;
}
