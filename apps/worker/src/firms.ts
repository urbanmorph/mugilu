import { haversineKm } from "./near";
import type { Env } from "./index";
import { FIRES_KEY, putJson } from "./snapshot";
import { counted } from "./metrics";

// NASA FIRMS: near-real-time fire / thermal-anomaly detections (VIIRS 375 m).
// This is the fire / crop-burn smoke layer, seasonally the dominant air-health
// driver across north India (Oct–Nov stubble burning). Needs a free MAP_KEY
// (FIRMS_MAP_KEY). Following the SACHET pattern: a cron polls India-wide, writes
// the current set + archives new days (the moat), and /c point-queries it.

const FIRMS_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv";
// VIIRS 375 m, the best resolution for crop fires. One satellite at a time: the smoke bands
// (score.ts) were benchmarked on one satellite's detections, and two would count each fire
// twice. NOAA-21 first, NOAA-20 when it fails or is empty. SNPP's NRT feed ended 2 Nov 2026
// and FIRMS went on answering it with an empty CSV, which read as "no fires" for days.
export const SOURCES = ["VIIRS_NOAA21_NRT", "VIIRS_NOAA20_NRT"] as const;
const INDIA_BBOX = "68,6,98,38"; // west,south,east,north

export interface FireDetection {
  lat: number;
  lon: number;
  frp: number; // fire radiative power, MW
  confidence: string; // VIIRS: l/n/h (low/nominal/high)
  acq: string; // "YYYY-MM-DD HHMM" UTC
  daynight: string; // D / N
}

export interface FiresSnapshot {
  generated_at: string;
  count: number;
  fires: FireDetection[];
}

/** Parse FIRMS area CSV into detections. Columns are addressed by header name
 *  (order-independent): latitude, longitude, acq_date, acq_time, confidence, frp, daynight. */
export function parseFirmsCsv(csv: string): FireDetection[] {
  const lines = csv.trim().split(/\r?\n/);
  const h = lines[0].split(",").map((s) => s.trim());
  const at = (k: string) => h.indexOf(k);
  const iLat = at("latitude"),
    iLon = at("longitude"),
    iFrp = at("frp"),
    iConf = at("confidence"),
    iDate = at("acq_date"),
    iTime = at("acq_time"),
    iDn = at("daynight");
  // No lat/lon header means FIRMS sent an error (bad key, outage) with HTTP 200:
  // throw so the caller keeps the last snapshot instead of writing "no fires".
  if (iLat < 0 || iLon < 0) throw new Error("firms: not a FIRMS CSV");
  const out: FireDetection[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(",");
    const lat = Number(c[iLat]);
    const lon = Number(c[iLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    out.push({
      lat,
      lon,
      frp: iFrp >= 0 ? Number(c[iFrp]) || 0 : 0,
      confidence: iConf >= 0 ? (c[iConf] ?? "").trim() : "",
      acq: `${iDate >= 0 ? c[iDate] : ""} ${iTime >= 0 ? c[iTime] : ""}`.trim(),
      daynight: iDn >= 0 ? (c[iDn] ?? "").trim() : "",
    });
  }
  return out;
}

export interface FireRisk {
  count: number; // detections within the radius
  frp_sum: number; // total fire radiative power nearby (MW)
  nearest_km: number | null;
}

/** Smoke/fire pressure at a point: active detections within `radiusKm`, with the
 *  total FRP and the nearest fire. Distance via the shared haversine. */
export function fireRiskAt(fires: FireDetection[], lat: number, lon: number, radiusKm = 100): FireRisk {
  let count = 0;
  let frp = 0;
  let nearest: number | null = null;
  for (const f of fires) {
    const d = haversineKm(lat, lon, f.lat, f.lon);
    if (d > radiusKm) continue;
    count++;
    frp += f.frp;
    if (nearest === null || d < nearest) nearest = d;
  }
  return { count, frp_sum: +frp.toFixed(1), nearest_km: nearest === null ? null : +nearest.toFixed(1) };
}

// FIRMS's day range counts UTC calendar days ("1" is today since 00:00 UTC), so it is asked
// for two and 24 hours kept. With "1", every day from 00:00 UTC to the first satellite pass
// over India (about 08:00 UTC) read as no fires at all. The 24 hours end at the newest
// detection, not the clock: NRT data lags a pass by hours, so a clock window drops
// yesterday's afternoon pass before today's has arrived, and the count dips for hours.
const DAY_RANGE = 2;
const WINDOW_MS = 24 * 3600_000;

/** A detection's time: acq is "YYYY-MM-DD HHMM" in UTC (HHMM may lose its leading zeros). */
const acqTime = (acq: string) => {
  const [date, hhmm = "0"] = acq.split(" ");
  const t = hhmm.padStart(4, "0");
  return Date.parse(`${date}T${t.slice(0, 2)}:${t.slice(2)}:00Z`);
};

/**
 * Poll FIRMS for India, keep the last 24 h, write that set to R2, and archive each UTC
 * day's own detections so the burning-season record accrues (the moat). ETag-free.
 * FIRMS rotates the NRT file, so we just overwrite the current snapshot.
 */
export async function collectFires(
  env: Env,
  now = new Date(),
): Promise<{ count: number; source: string; archived: boolean }> {
  const key = env.FIRMS_MAP_KEY;
  if (!key) throw new Error("FIRMS_MAP_KEY not set");
  const read = async (source: string) => {
    const res = await fetch(`${FIRMS_URL}/${key}/${source}/${INDIA_BBOX}/${DAY_RANGE}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`firms ${res.status}`);
    return parseFirmsCsv(await res.text());
  };
  // Only every satellite failing is the upstream step failing (err:upstream:firms).
  const [source, days] = await counted(env, "firms", async () => {
    let first: [string, FireDetection[]] | null = null;
    let error: unknown = null;
    for (const s of SOURCES) {
      try {
        const f = await read(s);
        if (f.length) return [s, f] as [string, FireDetection[]];
        first ??= [s, f];
      } catch (e) {
        error ??= e;
      }
    }
    if (first) return first;
    throw error;
  });
  const times = days.map((f) => acqTime(f.acq)).filter(Number.isFinite);
  const since = (times.length ? Math.max(...times) : now.getTime()) - WINDOW_MS;
  const fires = days.filter((f) => acqTime(f.acq) >= since);
  const snapshot: FiresSnapshot = {
    generated_at: now.toISOString(),
    count: fires.length,
    fires,
  };
  await putJson(env, FIRES_KEY, JSON.stringify(snapshot), "public, max-age=900");
  // Archive each UTC day's own detections (the moat), today's always (an empty day is a
  // record too) and yesterday's again, now that its last passes are in.
  const today = snapshot.generated_at.slice(0, 10);
  for (const day of new Set([today, ...days.map((f) => f.acq.slice(0, 10))])) {
    const own = days.filter((f) => f.acq.startsWith(day));
    const archive: FiresSnapshot = { generated_at: snapshot.generated_at, count: own.length, fires: own };
    await env.OAQ_R2.put(`archive/firms/${day}.json`, JSON.stringify(archive), {
      httpMetadata: { contentType: "application/json" },
    });
  }
  return { count: fires.length, source, archived: true };
}
