import type { Env } from "./index";
import type { Snapshot, ConditionsSnapshot, NormalizedStation } from "./types";
import type { WarningsSnapshot } from "./sachet";
import type { FiresSnapshot } from "./firms";
import type { CyclonesSnapshot } from "./cyclones";

// One place for the R2-backed snapshot reads, so the key strings + casts live
// once (the web routes and the MCP tools share these).

/** How long a warm isolate reuses an R2 object it already read and parsed. The
 *  snapshots change at most hourly (grid 4-hourly) and readers bound their age in
 *  hours (STALE_AFTER_MS, youngerThan), so a few minutes of reuse changes nothing a
 *  reader sees while sparing an R2 read + a JSON parse of up to a few MB per request. */
export const MEMO_TTL_MS = 2 * 60_000;

// Per isolate, per bucket binding (tests get a fresh bucket each, so no leakage).
// Only SETTLED values are kept: in workerd a read belongs to the request that
// started it, and another request awaiting it can hang once that request ends. So
// concurrent cold requests each read; every later one reuses the parsed object.
// Callers must treat what they get as read-only: it is shared across requests.
// `gen` counts writes per key, so a read that started before a write cannot put
// the old version back.
interface Memo {
  values: Map<string, { at: number; value: unknown }>;
  gen: Map<string, number>;
}
const memo = new WeakMap<object, Memo>();

/** An R2 JSON object, parsed, reused for MEMO_TTL_MS. Failures are rejections. */
export async function loadJson<T>(env: Env, key: string, now = Date.now()): Promise<T | null> {
  let m = memo.get(env.OAQ_R2);
  if (!m) memo.set(env.OAQ_R2, (m = { values: new Map(), gen: new Map() }));
  const hit = m.values.get(key);
  if (hit && now - hit.at < MEMO_TTL_MS) return hit.value as T | null;
  const gen = m.gen.get(key) ?? 0;
  const obj = await env.OAQ_R2.get(key);
  const value = obj ? ((await obj.json()) as T) : null;
  // A failed read throws above and is not remembered: the next request retries.
  if ((m.gen.get(key) ?? 0) === gen) m.values.set(key, { at: now, value });
  return value;
}

/** Write a JSON snapshot (served at /data/{key} with `cacheControl`) and drop the
 *  memoised copy, so this isolate serves the new version straight away. */
export async function putJson(env: Env, key: string, body: string, cacheControl: string): Promise<void> {
  await env.OAQ_R2.put(key, body, { httpMetadata: { contentType: "application/json", cacheControl } });
  const m = memo.get(env.OAQ_R2);
  if (!m) return;
  m.values.delete(key);
  m.gen.set(key, (m.gen.get(key) ?? 0) + 1);
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
export const GRID_KEY = "data/conditions.json";
export const FIRES_KEY = "data/fires.json";
export const WARNINGS_KEY = "data/warnings.json";
export const CYCLONES_KEY = "data/cyclones.json";
export const loadGrid = (env: Env) => loadRecent<ConditionsSnapshot>(env, GRID_KEY, 12 * 3600_000);
export const loadFires = (env: Env) => loadRecent<FiresSnapshot>(env, FIRES_KEY, 6 * 3600_000);
// JTWC is polled hourly; past half a day the runs have been failing and a storm moves on.
export const loadCyclones = (env: Env) => loadRecent<CyclonesSnapshot>(env, CYCLONES_KEY, 12 * 3600_000);
export const loadWarningsSnapshot = (env: Env) => loadJson<WarningsSnapshot>(env, WARNINGS_KEY);
