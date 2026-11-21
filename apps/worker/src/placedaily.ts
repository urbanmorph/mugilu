import type { Env } from "./index";
import { AIR_DAILY_PREFIX, readJson, type AirDay } from "./airdaily";
import { WX_DAILY_PREFIX, type WxDailyFile } from "./collect";
import { acqTime, type FireDetection, type FiresSnapshot } from "./firms";
import type { WxDay } from "./openmeteo";
import { haversineKm } from "./near";
import { allSlugPlaces, type SlugPlace } from "./slugs";
import type { Centroid } from "./types";
import centroids from "../data/centroids.json";
import { gzip } from "./gzip";
import { reason } from "./logs";

// The history panel's record: each India day, every named place's air, fires and modelled
// weather, joined once a night from three daily records mugilu already keeps:
// - air: archive/air-daily (airdaily.ts), the stations within 25 km, each by its worst reading
//   that day, and the middle of those;
// - fires: archive/firms (firms.ts, by UTC day), the detections within 100 km that day;
// - weather: archive/wx-daily (collect.ts), the figures of the nearest point of the district grid.
// The day goes to archive/place-daily/<date>.json.gz, then the last 30 days to one file per state,
// trends/30/<state>.json, so a place page reads one small file.
//
// The run (hourly, after the air summary): days from PLACE_DAILY_START to the last ended,
// newest first; a day is joined when its air and weather are in, or once it is two days old
// with whatever there is; a day already joined is never redone. It has its own time budget
// and a cap on days per run; the state files are rebuilt when a day was written.

export const PLACE_DAILY_PREFIX = "archive/place-daily/";
/** The first day joined: the daily weather (archive/wx-daily) is filled back to here
 *  (scripts/backfill-wx-daily.ts). A day before its weather is filled would be joined without
 *  it for good, so move this earlier only after filling the weather further back. */
export const PLACE_DAILY_START = "2026-10-21";
export const TRENDS_PREFIX = "trends/30/";
export const TREND_DAYS = 30;
const AIR_KM = 25;
const FIRE_KM = 100;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const IST = 5.5 * HOUR;

/** A place's day. Each field is absent when there was no data for it. */
export interface PlaceDay extends Omit<WxDay, "date"> {
  /** The middle station's worst AQI of the day, of the stations within 25 km. */
  air?: number;
  /** Stations within 25 km with a reading that day. */
  stations?: number;
  /** Fires seen by satellite within 100 km that day. */
  fires?: number;
}
export interface PlaceDailyFile {
  date: string;
  places: Record<string, PlaceDay>;
}

/** The series of a place's trend, one value a day (null: no data), oldest first. */
export const SERIES = [
  "air",
  "fires",
  "feels_max",
  "feels_min",
  "rain_mm",
  "gust_kmh",
  "uv_max",
  "vis_min_m",
  "dust_max",
] as const;
export type Series = (typeof SERIES)[number];
export type PlaceTrend = Record<Series, (number | null)[]> & {
  days: string[];
  /** The most stations within 25 km on any of the days. */
  stations: number;
};
interface StateTrend {
  days: string[];
  places: Record<string, Omit<PlaceTrend, "days">>;
}

const dayStart = (day: string) => Date.parse(`${day}T00:00:00+05:30`);
const isoDay = (ms: number) => new Date(ms + IST).toISOString().slice(0, 10);
const prevDay = (day: string) => isoDay(dayStart(day) - 12 * HOUR);
const keyOf = (day: string) => `${PLACE_DAILY_PREFIX}${day}.json.gz`;
const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
/** Within `km` of a point, with a cheap latitude cut before the great circle. */
const near = (lat: number, lon: number, km: number) => (la: number, lo: number) =>
  Math.abs(la - lat) <= km / 111 && haversineKm(lat, lon, la, lo) <= km;

/** The state file a place's trend is in. */
export const trendKey = (p: Pick<SlugPlace, "state">) =>
  `${TRENDS_PREFIX}${(p.state ?? "other")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}.json`;

type GridPoint = Pick<Centroid, "id" | "lat" | "lon">;
const nearestCache = new WeakMap<readonly GridPoint[], Map<string, string>>();
/** The grid point nearest each place (the places are the grid's districts, plus a few city centres). */
function nearestPoint(grid: readonly GridPoint[], p: SlugPlace): string | undefined {
  let m = nearestCache.get(grid);
  if (!m) nearestCache.set(grid, (m = new Map()));
  if (!m.has(p.slug)) {
    let best: GridPoint | undefined;
    let bestKm = Infinity;
    for (const g of grid) {
      const km = haversineKm(p.lat, p.lon, g.lat, g.lon);
      if (km < bestKm) [best, bestKm] = [g, km];
    }
    if (best) m.set(p.slug, best.id);
  }
  return m.get(p.slug);
}

/** One India day for every place. `fires` is null when there is no fire record that day. */
export function summarizePlaces(
  date: string,
  places: SlugPlace[],
  air: AirDay | null,
  wx: WxDailyFile | null,
  fires: FireDetection[] | null,
  grid: readonly GridPoint[],
): PlaceDailyFile {
  const stations = Object.values(air?.stations ?? {}).filter((s) => s.lat != null && s.lon != null);
  const out: PlaceDailyFile = { date, places: {} };
  for (const p of places) {
    const d: PlaceDay = {};
    const airNear = near(p.lat, p.lon, AIR_KM);
    const worst = stations.filter((s) => airNear(s.lat!, s.lon!)).map((s) => s.aqi_max);
    if (worst.length) Object.assign(d, { air: Math.round(median(worst)), stations: worst.length });
    if (fires) {
      const fireNear = near(p.lat, p.lon, FIRE_KM);
      d.fires = fires.filter((f) => fireNear(f.lat, f.lon)).length;
    }
    const id = wx && nearestPoint(grid, p);
    if (id && wx.points[id]) Object.assign(d, wx.points[id]);
    if (Object.keys(d).length) out.places[p.slug] = d;
  }
  return out;
}

/** The fires of an India day from the two UTC-day archives it spans; null when there is no
 *  record (a missing file, or an empty one: India is never without a fire for a whole day, so
 *  an empty file is an outage, as on 3 to 6 Nov 2026). */
async function firesOf(env: Env, day: string): Promise<FireDetection[] | null> {
  const from = dayStart(day);
  const utc = [new Date(from).toISOString().slice(0, 10), day];
  const files = await Promise.all(utc.map((d) => readJson<FiresSnapshot>(env, `archive/firms/${d}.json`)));
  const all = files.flatMap((f) => f?.fires ?? []);
  const own = all.filter((f) => {
    const t = acqTime(f.acq);
    return t >= from && t < from + DAY;
  });
  return own.length ? own : null;
}

export interface PlaceDailyOpts {
  now?: number;
  start?: string;
  maxDays?: number;
  budgetMs?: number;
  /** For tests: the places and the grid (default: every named place, the district grid). */
  places?: SlugPlace[];
  grid?: readonly GridPoint[];
}
export interface PlaceDailyRun {
  written: string[];
  /** Ended days whose air or weather is not in yet. */
  waiting: number;
  /** Days still to do (over the cap or out of time). */
  pending: number;
  ms: number;
}

const DISTRICTS = (centroids as Centroid[]).filter((c) => c.level === "district");

async function listDays(env: Env, prefix: string): Promise<Set<string>> {
  const have = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await env.OAQ_R2.list({ prefix, cursor });
    for (const x of page.objects) have.add(x.key.slice(prefix.length, -".json.gz".length));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return have;
}

/** Join the ended days not yet joined, newest first, then rebuild the state files. Never throws. */
export async function collectPlaceDaily(env: Env, o: PlaceDailyOpts = {}): Promise<PlaceDailyRun> {
  const {
    now = Date.now(),
    start = PLACE_DAILY_START,
    maxDays = 3,
    budgetMs = 20_000,
    places = allSlugPlaces(),
    grid = DISTRICTS,
  } = o;
  const t0 = Date.now();
  const run: PlaceDailyRun = { written: [], waiting: 0, pending: 0, ms: 0 };
  try {
    const last = isoDay(now - DAY);
    const [have, air, wx] = await Promise.all([
      listDays(env, PLACE_DAILY_PREFIX),
      listDays(env, AIR_DAILY_PREFIX),
      listDays(env, WX_DAILY_PREFIX),
    ]);
    const todo: string[] = [];
    for (let d = last; d >= start; d = prevDay(d)) if (!have.has(d)) todo.push(d);
    let left = todo.length;
    for (const day of todo) {
      const old = now - (dayStart(day) + DAY) >= 2 * DAY;
      if (!(air.has(day) && wx.has(day)) && !old) {
        run.waiting++;
        left--;
        continue;
      }
      if (run.written.length >= maxDays || Date.now() - t0 >= budgetMs) break;
      const [a, w, f] = await Promise.all([
        air.has(day) ? readJson<AirDay>(env, `${AIR_DAILY_PREFIX}${day}.json.gz`) : null,
        wx.has(day) ? readJson<WxDailyFile>(env, `${WX_DAILY_PREFIX}${day}.json.gz`) : null,
        firesOf(env, day),
      ]);
      const file = summarizePlaces(day, places, a, w, f, grid);
      await env.OAQ_R2.put(keyOf(day), await gzip(JSON.stringify(file)), {
        httpMetadata: { contentType: "application/json", contentEncoding: "gzip" },
      });
      run.written.push(day);
      left--;
      console.log(
        `[place-daily] ${day}: ${Object.keys(file.places).length} places (air ${a ? "yes" : "no"}, weather ${w ? "yes" : "no"}, fires ${f ? f.length : "no data"})`,
      );
    }
    run.pending = left;
    if (run.written.length) await writeTrends(env, places, [...have, ...run.written]);
  } catch (e) {
    console.error(`[place-daily] failed: ${reason(e)}`);
  }
  run.ms = Date.now() - t0;
  if (run.written.length || run.pending)
    console.log(
      `[place-daily] done in ${run.ms} ms: ${run.written.length} written, ${run.waiting} waiting, ${run.pending} left`,
    );
  return run;
}

/** The last 30 days (ending at the newest joined day) of every place, one file per state. */
async function writeTrends(env: Env, places: SlugPlace[], joined: string[]): Promise<void> {
  const end = joined.reduce((a, b) => (b > a ? b : a));
  const days: string[] = [end];
  while (days.length < TREND_DAYS) days.unshift(prevDay(days[0]));
  const have = new Set(joined);
  const files = await Promise.all(
    days.map((d) => (have.has(d) ? readJson<PlaceDailyFile>(env, keyOf(d)) : Promise.resolve(null))),
  );
  const byState = new Map<string, StateTrend>();
  for (const p of places) {
    const key = trendKey(p);
    const st = byState.get(key) ?? { days, places: {} };
    byState.set(key, st);
    const rows = files.map((f) => f?.places[p.slug]);
    const t = { stations: Math.max(0, ...rows.map((r) => r?.stations ?? 0)) } as Omit<PlaceTrend, "days">;
    for (const s of SERIES) t[s] = rows.map((r) => r?.[s] ?? null);
    st.places[p.slug] = t;
  }
  await Promise.all(
    [...byState].map(([key, st]) =>
      env.OAQ_R2.put(key, JSON.stringify(st), { httpMetadata: { contentType: "application/json" } }),
    ),
  );
}

/** A place's last 30 days, or null before the first night's file. */
export async function loadPlaceTrend(env: Env, p: SlugPlace): Promise<PlaceTrend | null> {
  const st = await readJson<StateTrend>(env, trendKey(p));
  const t = st?.places[p.slug];
  return st && t ? { days: st.days, ...t } : null;
}
