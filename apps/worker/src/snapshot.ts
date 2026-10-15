import type { Env } from "./index";
import type { Snapshot, ConditionsSnapshot, NormalizedStation } from "./types";
import type { WarningsSnapshot } from "./sachet";
import type { FiresSnapshot } from "./firms";

// One place for the R2-backed snapshot reads, so the key strings + casts live
// once (the web routes and the MCP tools share these).

export async function loadJson<T>(env: Env, key: string): Promise<T | null> {
  const obj = await env.OAQ_R2.get(key);
  return obj ? ((await obj.json()) as T) : null;
}

/** Whether a snapshot was generated within maxAgeMs. A failed run keeps the last
 *  good snapshot (refresh, collect, firms), so readers bound how old it may get. */
export function youngerThan(snap: { generated_at: string }, maxAgeMs: number, now = Date.now()): boolean {
  return now - Date.parse(snap.generated_at) <= maxAgeMs;
}

async function loadRecent<T extends { generated_at: string }>(env: Env, key: string, maxAgeMs: number) {
  const snap = await loadJson<T>(env, key);
  return snap && youngerThan(snap, maxAgeMs) ? snap : null;
}

export const LATEST_KEY = "data/latest.json";
/** The air snapshot as written, stale stations included (refresh's carry-forward). */
export const loadRawSnapshot = (env: Env) => loadJson<Snapshot>(env, LATEST_KEY);

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
  const snap = await loadRawSnapshot(env);
  if (!snap) return null;
  const stations = freshStations(snap.stations);
  return { ...snap, stations, station_count: stations.length };
}
// The grid is collected every 4h and fires hourly; past these ages the runs have
// been failing and the data no longer describes now. (Warnings carry no bound:
// that snapshot is only rewritten when the feed changes, so its age means nothing.)
export const loadGrid = (env: Env) => loadRecent<ConditionsSnapshot>(env, "data/conditions.json", 12 * 3600_000);
export const loadFires = (env: Env) => loadRecent<FiresSnapshot>(env, "data/fires.json", 6 * 3600_000);
export const loadWarningsSnapshot = (env: Env) => loadJson<WarningsSnapshot>(env, "data/warnings.json");
