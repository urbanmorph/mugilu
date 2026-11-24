import { test } from "node:test";
import assert from "node:assert/strict";
import { AIR_DAILY_PREFIX, collectAirDaily, istDayKeys, readJson, summarizeDay, type AirDay } from "../src/airdaily";
import { gzip } from "../src/gzip";
import { testWorker } from "./helpers/worker";
import type { Env } from "../src/index";
import type { NormalizedStation, Snapshot } from "../src/types";

// The daily air summary: one small file per India (IST) day from the 24 hourly archives, so a
// 30-day trend reads 30 files, not 720.

const st = (o: Partial<NormalizedStation> & { id: string }): NormalizedStation =>
  ({
    raw_id: o.id,
    provider: "cpcb",
    name: o.id,
    city: "Delhi",
    state: "Delhi",
    lat: 28.6,
    lon: 77.2,
    pollutants: {},
    aqi: 100,
    band: "moderate",
    ts: null,
    ...o,
  }) as NormalizedStation;
const snap = (generated_at: string, stations: NormalizedStation[]): Snapshot => ({
  generated_at,
  station_count: stations.length,
  providers: ["cpcb"],
  stations,
});

test("istDayKeys: an India day is the UTC hours 18:30 the day before to 18:30, as 24 archive files", () => {
  const keys = istDayKeys("2026-11-10");
  assert.equal(keys.length, 24);
  assert.equal(keys[0], "archive/air/2026-11-09/19.json.gz"); // 00:30 IST on the 10th
  assert.equal(keys[23], "archive/air/2026-11-10/18.json.gz"); // 23:30 IST on the 10th
});

test("summarizeDay: each reading counted once (by its time), only readings inside the day", () => {
  const day = "2026-11-10";
  const a1 = st({ id: "a", aqi: 300, ts: "2026-11-10T09:00:00+05:30", pollutants: { pm25: 150, pm10: 280 } });
  const a2 = st({ id: "a", aqi: 200, ts: "2026-11-10T10:00:00+05:30", pollutants: { pm25: 90, pm10: 160 } });
  const stale = st({ id: "a", aqi: 200, ts: "2026-11-10T10:00:00+05:30", pollutants: { pm25: 90, pm10: 160 } });
  const yesterday = st({ id: "b", aqi: 450, ts: "2026-11-09T22:00:00+05:30" }); // before the day
  const d = summarizeDay(day, [
    snap("2026-11-10T03:35:00Z", [a1, yesterday]),
    snap("2026-11-10T04:35:00Z", [a2]),
    snap("2026-11-10T05:35:00Z", [stale]), // the same reading again: counted once
  ]);
  assert.equal(d.date, day);
  assert.equal(d.hours, 3);
  assert.deepEqual(d.stations.a, {
    name: "a",
    city: "Delhi",
    state: "Delhi",
    lat: 28.6,
    lon: 77.2,
    n: 2,
    aqi_max: 300,
    aqi_mean: 250,
    pm25_max: 150,
    pm25_mean: 120,
    pm10_max: 280,
    pm10_mean: 220,
  });
  assert.equal(d.stations.b, undefined, "only readings taken that day");
});

test("summarizeDay: a city is the median of its fresh stations each hour, then that day's worst and mean", () => {
  const at = (h: string) => `2026-11-10T${h}:00:00+05:30`;
  const d = summarizeDay("2026-11-10", [
    snap("2026-11-10T03:35:00Z", [
      st({ id: "a", aqi: 100, ts: at("08") }),
      st({ id: "b", aqi: 300, ts: at("09") }),
      st({ id: "c", aqi: 200, ts: at("09") }),
      st({ id: "old", aqi: 500, ts: at("02") }), // more than 3 h before the snapshot: not fresh
    ]),
    snap("2026-11-10T04:35:00Z", [st({ id: "a", aqi: 400, ts: at("10") })]),
  ]);
  assert.deepEqual(d.cities.delhi, {
    name: "Delhi",
    state: "Delhi",
    stations: 4,
    hours: 2,
    aqi_max: 400,
    aqi_mean: 300,
  });
});

// ── The run, over the in-memory R2 ──────────────────────────────────────────────────
const NOW = Date.parse("2026-11-12T02:00:00Z"); // 07:30 IST on the 12th: the 11th ended 1.5 h ago
async function seedHour(env: Env, key: string, s: Snapshot) {
  await env.OAQ_R2.put(key, await gzip(JSON.stringify(s)), { httpMetadata: { contentEncoding: "gzip" } } as never);
}
async function seedDays(env: Env, days: string[]) {
  for (const day of days)
    for (const key of istDayKeys(day).slice(0, 3)) {
      const [, d, h] = key.match(/(\d{4}-\d{2}-\d{2})\/(\d{2})/)!;
      await seedHour(env, key, snap(`${d}T${h}:35:00Z`, [st({ id: "a", aqi: 150, ts: `${d}T${h}:30:00Z` })]));
    }
}

test("collectAirDaily: summarises each ended day, newest first, up to its limit; a rerun continues and then does nothing", async () => {
  const { env } = testWorker();
  await seedDays(env, ["2026-11-09", "2026-11-10", "2026-11-11"]);
  const first = await collectAirDaily(env, { now: NOW, start: "2026-11-09", maxDays: 2 });
  assert.deepEqual(first.written, ["2026-11-11", "2026-11-10"], "newest first; the 11th ended over an hour ago");
  assert.equal(first.pending, 1);
  const second = await collectAirDaily(env, { now: NOW, start: "2026-11-09", maxDays: 2 });
  assert.deepEqual(second.written, ["2026-11-09"]);
  const puts: string[] = [];
  const put = env.OAQ_R2.put.bind(env.OAQ_R2);
  env.OAQ_R2.put = (async (k: string, ...r: unknown[]) => {
    puts.push(k);
    return (put as (...a: unknown[]) => unknown)(k, ...r);
  }) as typeof env.OAQ_R2.put;
  const third = await collectAirDaily(env, { now: NOW, start: "2026-11-09", maxDays: 2 });
  assert.deepEqual(third.written, []);
  assert.deepEqual(puts, [], "nothing rewritten");
  const d11 = (await readJson<AirDay>(env, `${AIR_DAILY_PREFIX}2026-11-11.json.gz`))!;
  assert.equal(d11.hours, 3);
  assert.equal(d11.stations.a.aqi_max, 150);
});

test("collectAirDaily: a day not yet over waits; a day with no files is recorded as no data, not retried", async () => {
  const { env } = testWorker();
  await seedDays(env, ["2026-11-12"]); // still today in India
  const r = await collectAirDaily(env, { now: NOW, start: "2026-11-10" });
  assert.deepEqual(r.written, ["2026-11-11", "2026-11-10"]);
  const d = (await readJson<AirDay>(env, `${AIR_DAILY_PREFIX}2026-11-10.json.gz`))!;
  assert.equal(d.hours, 0);
  assert.deepEqual(d.stations, {});
  assert.ok(!(await env.OAQ_R2.head(`${AIR_DAILY_PREFIX}2026-11-12.json.gz`)), "today waits");
});

test("collectAirDaily: out of time it stops between days, keeping what it wrote", async () => {
  const { env } = testWorker();
  await seedDays(env, ["2026-11-10", "2026-11-11"]);
  const r = await collectAirDaily(env, { now: NOW, start: "2026-11-10", budgetMs: 0 });
  assert.deepEqual(r.written, []);
  assert.equal(r.pending, 2);
});

test("/air-daily/collect is an admin route: 401 without the key", async () => {
  const { adminGate } = await import("../src/admin");
  assert.equal(
    adminGate("/air-daily/collect", new Request("https://mugilu.live/air-daily/collect"), { ADMIN_KEY: "k" })?.status,
    401,
  );
});
