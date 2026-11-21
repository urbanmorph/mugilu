import type { Env } from "./index";
import type { NormalizedStation, Snapshot } from "./types";
import { gzip } from "./gzip";
import { reason } from "./logs";

// The daily air summary: one small file per India (IST) day, archive/air-daily/<YYYY-MM-DD>.json.gz,
// made from that day's 24 hourly snapshots in archive/air/ (refresh.ts). A trend then reads 30
// small files for 30 days instead of 720 large ones.
//
// Each station's readings are counted once each (by their own time) and only when taken that
// day: a station that stops reporting stays in later snapshots with its old reading. A city is
// the median of its stations that reported within 3 hours of each snapshot, then that day's
// worst and mean of those hourly medians.
//
// The run: days from the archive's first (29 Jun 2026) to the last that has ended in India,
// newest first; each day written as soon as it is summed (a stopped run keeps what it wrote and
// the next continues); a day already summarised is never redone; a day with no files is written
// as no data so it is not retried. It has its own time budget and a cap on days per run.

export const AIR_DAILY_PREFIX = "archive/air-daily/";
/** The first day of the hourly air archive. */
export const AIR_ARCHIVE_START = "2026-06-29";
const HOUR = 3_600_000;
const IST = 5.5 * HOUR;
/** A reading older than this, at the snapshot, is not counted in the city's hourly median. */
const FRESH = 3 * HOUR;

export interface StationDay {
  name: string;
  city: string;
  state: string;
  lat: number | null;
  lon: number | null;
  /** Readings that day (each counted once). */
  n: number;
  aqi_max: number;
  aqi_mean: number;
  pm25_max?: number;
  pm25_mean?: number;
  pm10_max?: number;
  pm10_mean?: number;
}
export interface CityDay {
  name: string;
  state: string;
  /** Stations with a reading that day. */
  stations: number;
  /** Hours with a median. */
  hours: number;
  aqi_max: number;
  aqi_mean: number;
}
export interface AirDay {
  /** The India day, YYYY-MM-DD. */
  date: string;
  /** Hourly files found (24 when none is missing). */
  hours: number;
  stations: Record<string, StationDay>;
  /** By city, keyed lowercase. */
  cities: Record<string, CityDay>;
}

const dayStart = (day: string) => Date.parse(`${day}T00:00:00+05:30`);
const isoDay = (ms: number) => new Date(ms + IST).toISOString().slice(0, 10);

/** The 24 hourly archive files of an India day: UTC 19:00 the day before to 18:00. */
export function istDayKeys(day: string): string[] {
  const first = dayStart(day) + HOUR / 2;
  return Array.from({ length: 24 }, (_, i) => {
    const t = new Date(first + i * HOUR).toISOString();
    return `archive/air/${t.slice(0, 10)}/${t.slice(11, 13)}.json.gz`;
  });
}

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** One day from its snapshots. */
export function summarizeDay(day: string, snaps: Snapshot[]): AirDay {
  const from = dayStart(day);
  const to = from + 24 * HOUR;
  const readings = new Map<string, { s: NormalizedStation; by: Map<string, NormalizedStation> }>();
  const cityHours = new Map<string, number[]>();
  const cityMeta = new Map<string, { name: string; state: string; ids: Set<string> }>();
  for (const snap of snaps) {
    const gen = Date.parse(snap.generated_at);
    const hourly = new Map<string, number[]>();
    for (const s of snap.stations) {
      if (s.aqi == null || !s.ts) continue;
      const t = Date.parse(s.ts);
      if (!(t >= from && t < to)) continue;
      const r = readings.get(s.id) ?? { s, by: new Map() };
      r.by.set(s.ts, s);
      readings.set(s.id, r);
      const key = s.city?.trim().toLowerCase();
      if (!key) continue;
      const meta = cityMeta.get(key) ?? { name: s.city.trim(), state: s.state, ids: new Set<string>() };
      meta.ids.add(s.id);
      cityMeta.set(key, meta);
      if (gen - t <= FRESH) hourly.set(key, [...(hourly.get(key) ?? []), s.aqi]);
    }
    for (const [key, v] of hourly) cityHours.set(key, [...(cityHours.get(key) ?? []), median(v)]);
  }

  const stations: Record<string, StationDay> = {};
  for (const [id, { s, by }] of readings) {
    const rs = [...by.values()];
    const aqi = rs.map((x) => x.aqi as number);
    const out: StationDay = {
      name: s.name,
      city: s.city,
      state: s.state,
      lat: s.lat,
      lon: s.lon,
      n: rs.length,
      aqi_max: Math.max(...aqi),
      aqi_mean: Math.round(mean(aqi)),
    };
    for (const p of ["pm25", "pm10"] as const) {
      const v = rs.map((x) => x.pollutants?.[p]).filter((x): x is number => x != null);
      if (v.length) Object.assign(out, { [`${p}_max`]: r1(Math.max(...v)), [`${p}_mean`]: r1(mean(v)) });
    }
    stations[id] = out;
  }
  const cities: Record<string, CityDay> = {};
  for (const [key, meta] of cityMeta) {
    const h = cityHours.get(key) ?? [];
    if (!h.length) continue;
    cities[key] = {
      name: meta.name,
      state: meta.state,
      stations: meta.ids.size,
      hours: h.length,
      aqi_max: Math.round(Math.max(...h)),
      aqi_mean: Math.round(mean(h)),
    };
  }
  return { date: day, hours: snaps.length, stations, cities };
}

/** An R2 object as JSON, gunzipping when it is gzip (the archives are stored compressed). */
export async function readJson<T>(env: Env, key: string): Promise<T | null> {
  const o = await env.OAQ_R2.get(key);
  if (!o) return null;
  const bytes = new Uint8Array(await o.arrayBuffer());
  const text =
    bytes[0] === 0x1f && bytes[1] === 0x8b
      ? await new Response(new Response(bytes).body!.pipeThrough(new DecompressionStream("gzip"))).text()
      : new TextDecoder().decode(bytes);
  return JSON.parse(text) as T;
}

const keyOf = (day: string) => `${AIR_DAILY_PREFIX}${day}.json.gz`;

/** The summaries of these days, null where a day is not summarised. */
export const loadAirDays = (env: Env, days: string[]): Promise<(AirDay | null)[]> =>
  Promise.all(days.map((d) => readJson<AirDay>(env, keyOf(d))));

export interface AirDailyOpts {
  now?: number;
  /** The first day to summarise. */
  start?: string;
  /** At most this many days a run. */
  maxDays?: number;
  /** No new day starts after this long. */
  budgetMs?: number;
}
export interface AirDailyRun {
  written: string[];
  /** Days still to do (over the cap or out of time). */
  pending: number;
  ms: number;
}

/** Summarise the ended days not yet summarised, newest first. Never throws. */
export async function collectAirDaily(env: Env, o: AirDailyOpts = {}): Promise<AirDailyRun> {
  const { now = Date.now(), start = AIR_ARCHIVE_START, maxDays = 4, budgetMs = 20_000 } = o;
  const t0 = Date.now();
  const run: AirDailyRun = { written: [], pending: 0, ms: 0 };
  try {
    // The last India day that ended over an hour ago (its 18:00 UTC file is written at 18:05).
    const last = isoDay(now - HOUR - 24 * HOUR);
    const days: string[] = [];
    for (let d = last; d >= start; d = isoDay(dayStart(d) - 12 * HOUR)) days.push(d);
    const have = new Set<string>();
    let cursor: string | undefined;
    do {
      const page = await env.OAQ_R2.list({ prefix: AIR_DAILY_PREFIX, cursor });
      for (const x of page.objects) have.add(x.key.slice(AIR_DAILY_PREFIX.length, -".json.gz".length));
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    const todo = days.filter((d) => !have.has(d));
    for (const day of todo) {
      if (run.written.length >= maxDays || Date.now() - t0 >= budgetMs) break;
      const snaps = (await Promise.all(istDayKeys(day).map((k) => readJson<Snapshot>(env, k)))).filter(
        (s): s is Snapshot => s != null,
      );
      const summary = summarizeDay(day, snaps);
      await env.OAQ_R2.put(keyOf(day), await gzip(JSON.stringify(summary)), {
        httpMetadata: { contentType: "application/json", contentEncoding: "gzip" },
      });
      run.written.push(day);
      console.log(
        `[air-daily] ${day}: ${summary.hours} hours, ${Object.keys(summary.stations).length} stations, ${Object.keys(summary.cities).length} cities`,
      );
    }
    run.pending = todo.length - run.written.length;
  } catch (e) {
    console.error(`[air-daily] failed: ${reason(e)}`);
  }
  run.ms = Date.now() - t0;
  if (run.written.length || run.pending)
    console.log(`[air-daily] done in ${run.ms} ms: ${run.written.length} written, ${run.pending} left`);
  return run;
}
