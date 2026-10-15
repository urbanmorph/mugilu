import type { Env } from "./index";
import type { Snapshot, ConditionsSnapshot, NormalizedStation } from "./types";
import type { WarningsSnapshot } from "./sachet";

// One place for the R2-backed snapshot reads, so the key strings + casts live
// once (the web routes and the MCP tools share these).

export async function loadJson<T>(env: Env, key: string): Promise<T | null> {
  const obj = await env.OAQ_R2.get(key);
  return obj ? ((await obj.json()) as T) : null;
}

// A station whose last reading is older than this no longer answers for "now".
// Live feeds report within ~2h; past 3h the rest are dead feeds (some months old).
export const STALE_AFTER_MS = 3 * 3600_000;

/** The stations whose reading is recent enough to speak for now. A missing or
 *  unparseable time can't vouch for itself, so it is treated as stale. */
export function freshStations(stations: NormalizedStation[], now = Date.now()): NormalizedStation[] {
  return stations.filter((s) => {
    const t = s.ts ? Date.parse(s.ts) : NaN;
    return now - t <= STALE_AFTER_MS;
  });
}

/** The air snapshot with stale stations dropped at read time, so every reader
 *  (places, headlines, nearest stations, MCP) is fresh even if refreshes stall. */
export async function loadSnapshot(env: Env): Promise<Snapshot | null> {
  const snap = await loadJson<Snapshot>(env, "data/latest.json");
  if (!snap) return null;
  const stations = freshStations(snap.stations);
  return { ...snap, stations, station_count: stations.length };
}
export const loadGrid = (env: Env) => loadJson<ConditionsSnapshot>(env, "data/conditions.json");
export const loadWarningsSnapshot = (env: Env) => loadJson<WarningsSnapshot>(env, "data/warnings.json");
