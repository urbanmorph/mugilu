import { haversineKm } from "./near";
import type { Env } from "./index";

// NASA FIRMS: near-real-time fire / thermal-anomaly detections (VIIRS 375 m).
// This is the fire / crop-burn smoke layer — seasonally the dominant air-health
// driver across north India (Oct–Nov stubble burning). Needs a free MAP_KEY
// (FIRMS_MAP_KEY). Following the SACHET pattern: a cron polls India-wide, writes
// the current set + archives new days (the moat), and /c point-queries it.

const FIRMS_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv";
const SOURCE = "VIIRS_SNPP_NRT"; // 375 m, ~best resolution for crop fires
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
  if (lines.length < 2) return [];
  const h = lines[0].split(",").map((s) => s.trim());
  const at = (k: string) => h.indexOf(k);
  const iLat = at("latitude"),
    iLon = at("longitude"),
    iFrp = at("frp"),
    iConf = at("confidence"),
    iDate = at("acq_date"),
    iTime = at("acq_time"),
    iDn = at("daynight");
  if (iLat < 0 || iLon < 0) return [];
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
export function fireRiskAt(
  fires: FireDetection[],
  lat: number,
  lon: number,
  radiusKm = 100,
): FireRisk {
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

/**
 * Poll FIRMS for India (last 24 h), write the current set to R2, and archive a
 * per-day roll-up so the burning-season record accrues (the moat). ETag-free —
 * FIRMS rotates the NRT file, so we just overwrite the current snapshot.
 */
export async function collectFires(env: Env): Promise<{ count: number; archived: boolean }> {
  const key = env.FIRMS_MAP_KEY;
  if (!key) throw new Error("FIRMS_MAP_KEY not set");
  const url = `${FIRMS_URL}/${key}/${SOURCE}/${INDIA_BBOX}/1`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`firms ${res.status}`);
  const fires = parseFirmsCsv(await res.text());
  const snapshot: FiresSnapshot = {
    generated_at: new Date().toISOString(),
    count: fires.length,
    fires,
  };
  await env.OAQ_R2.put("data/fires.json", JSON.stringify(snapshot), {
    httpMetadata: { contentType: "application/json", cacheControl: "public, max-age=900" },
  });
  // Archive a daily snapshot (the moat). Date stamp in UTC; overwrite within the
  // day so the latest, fullest day's set is what's kept.
  const day = snapshot.generated_at.slice(0, 10);
  await env.OAQ_R2.put(`archive/firms/${day}.json`, JSON.stringify(snapshot), {
    httpMetadata: { contentType: "application/json" },
  });
  return { count: fires.length, archived: true };
}

/** Load the current fires snapshot from R2 (null if not collected yet). */
export async function loadFires(env: Env): Promise<FiresSnapshot | null> {
  const obj = await env.OAQ_R2.get("data/fires.json");
  if (!obj) return null;
  return (await obj.json()) as FiresSnapshot;
}
