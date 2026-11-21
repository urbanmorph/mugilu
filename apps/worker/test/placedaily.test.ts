import { test } from "node:test";
import assert from "node:assert/strict";
import {
  collectPlaceDaily,
  loadPlaceTrend,
  PLACE_DAILY_PREFIX,
  summarizePlaces,
  TREND_DAYS,
  trendKey,
  type PlaceDailyFile,
} from "../src/placedaily";
import { AIR_DAILY_PREFIX, type AirDay } from "../src/airdaily";
import { WX_DAILY_PREFIX, type WxDailyFile } from "../src/collect";
import type { FireDetection, FiresSnapshot } from "../src/firms";
import { gzip } from "../src/gzip";
import { testWorker } from "./helpers/worker";
import type { Env } from "../src/index";
import type { SlugPlace } from "../src/slugs";

// The history panel's record: each India day, every named place's air (from the daily air
// summary), fires within 100 km (from the FIRMS archive) and modelled weather (from the grid's
// daily figures), joined once a night so a place page reads one small file.

const DELHI: SlugPlace = { slug: "delhi", name: "Delhi", state: "Delhi", lat: 28.61, lon: 77.21 };
const PUNE: SlugPlace = { slug: "pune", name: "Pune", state: "Maharashtra", lat: 18.52, lon: 73.86 };
const GRID = [
  { id: "g-delhi", lat: 28.6, lon: 77.2 },
  { id: "g-pune", lat: 18.5, lon: 73.85 },
];
const station = (lat: number, lon: number, aqi_max: number) => ({
  name: "s",
  city: "c",
  state: "s",
  lat,
  lon,
  n: 20,
  aqi_max,
  aqi_mean: aqi_max - 50,
});
const AIR: AirDay = {
  date: "2026-11-10",
  hours: 24,
  stations: {
    a: station(28.62, 77.22, 300),
    b: station(28.55, 77.1, 400),
    c: station(28.7, 77.3, 200),
    far: station(27.2, 78.0, 500), // Agra, over 25 km from Delhi
    nopos: { ...station(0, 0, 999), lat: null, lon: null },
  },
  cities: {},
};
const WX: WxDailyFile = {
  date: "2026-11-10",
  points: {
    "g-delhi": { feels_max: 27, feels_min: 9, rain_mm: 0, gust_kmh: 22, uv_max: 4.5, vis_min_m: 400, dust_max: 120 },
  },
};
const fire = (lat: number, lon: number, acq: string): FireDetection =>
  ({ lat, lon, frp: 5, confidence: "n", acq, daynight: "D" }) as FireDetection;

test("summarizePlaces: air is the middle of the stations within 25 km (each by its worst reading)", () => {
  const d = summarizePlaces("2026-11-10", [DELHI, PUNE], AIR, WX, [], GRID);
  assert.equal(d.places.delhi.air, 300);
  assert.equal(d.places.delhi.stations, 3);
  assert.equal(d.places.pune.air, undefined, "no station near: no air");
});

test("summarizePlaces: the weather of the nearest grid point; fires within 100 km", () => {
  const fires = [
    fire(28.9, 77.5, "2026-11-10 0800"),
    fire(29.2, 77.0, "2026-11-10 0900"),
    fire(30.9, 75.8, "2026-11-10 0800"),
  ];
  const d = summarizePlaces("2026-11-10", [DELHI, PUNE], AIR, WX, fires, GRID);
  assert.deepEqual(d.places.delhi, {
    air: 300,
    stations: 3,
    fires: 2,
    feels_max: 27,
    feels_min: 9,
    rain_mm: 0,
    gust_kmh: 22,
    uv_max: 4.5,
    vis_min_m: 400,
    dust_max: 120,
  });
  assert.deepEqual(d.places.pune, { fires: 0 }, "no weather for its point that day; no fires near");
});

test("summarizePlaces: no fire record that day is no data, not zero fires", () => {
  const d = summarizePlaces("2026-11-10", [DELHI], AIR, null, null, GRID);
  assert.deepEqual(d.places.delhi, { air: 300, stations: 3 });
});

test("trendKey: one file per state", () => {
  assert.equal(trendKey(DELHI), "trends/30/delhi.json");
  assert.equal(trendKey({ ...PUNE, state: "Jammu and Kashmir" }), "trends/30/jammu-and-kashmir.json");
  assert.equal(trendKey({ ...PUNE, state: undefined }), "trends/30/other.json");
});

// ── The run, over the in-memory R2 ──────────────────────────────────────────────────
const NOW = Date.parse("2026-11-12T21:00:00Z"); // 02:30 IST on the 13th
const putGz = async (env: Env, key: string, v: unknown) =>
  env.OAQ_R2.put(key, await gzip(JSON.stringify(v)), { httpMetadata: { contentEncoding: "gzip" } } as never);
async function seed(env: Env, day: string, { air = true, wx = true } = {}) {
  if (air) await putGz(env, `${AIR_DAILY_PREFIX}${day}.json.gz`, { ...AIR, date: day });
  if (wx) await putGz(env, `${WX_DAILY_PREFIX}${day}.json.gz`, { ...WX, date: day });
}
const firms = (day: string, fires: FireDetection[]): FiresSnapshot => ({
  generated_at: `${day}T23:00:00Z`,
  count: fires.length,
  fires,
});

test("collectPlaceDaily: joins each ready day, newest first, then the 30-day file per state", async () => {
  const { env } = testWorker();
  await seed(env, "2026-11-12");
  await seed(env, "2026-11-11");
  // The 12th in India is 18:30 UTC on the 11th to 18:30 on the 12th: one fire from each UTC file.
  await env.OAQ_R2.put(
    "archive/firms/2026-11-11.json",
    JSON.stringify(firms("2026-11-11", [fire(28.7, 77.3, "2026-11-11 2000"), fire(28.7, 77.3, "2026-11-11 1000")])),
  );
  await env.OAQ_R2.put(
    "archive/firms/2026-11-12.json",
    JSON.stringify(firms("2026-11-12", [fire(28.7, 77.3, "2026-11-12 0800"), fire(28.7, 77.3, "2026-11-12 1900")])),
  );
  const r = await collectPlaceDaily(env, { now: NOW, start: "2026-11-11", places: [DELHI, PUNE], grid: GRID });
  assert.deepEqual(r.written, ["2026-11-12", "2026-11-11"]);
  const t = await loadPlaceTrend(env, DELHI);
  assert.ok(t);
  assert.equal(t.days.length, TREND_DAYS);
  assert.equal(t.days.at(-1), "2026-11-12");
  assert.equal(t.days[0], "2026-10-14");
  assert.equal(t.air.at(-1), 300);
  assert.equal(t.air[0], null, "a day before the record is no data");
  assert.equal(t.fires.at(-1), 2, "the India day's own fires, from both UTC files");
  assert.equal(t.feels_max.at(-1), 27);
  assert.equal(t.stations, 3, "the most stations on any day");
  const pune = await loadPlaceTrend(env, PUNE);
  assert.equal(pune?.air.at(-1), null);
});

test("collectPlaceDaily: a day waits for its air and weather, until it is two days old", async () => {
  const { env } = testWorker();
  await seed(env, "2026-11-12", { wx: false }); // the weather comes with the next 4-hourly run
  // The 11th has nothing yet and ended 26 hours ago: it waits too.
  await seed(env, "2026-11-10", { wx: false }); // ended 50 hours ago, its weather never came
  const r = await collectPlaceDaily(env, { now: NOW, start: "2026-11-10", places: [DELHI], grid: GRID });
  assert.deepEqual(r.written, ["2026-11-10"], "built with what there is");
  assert.equal(r.waiting, 2);
  assert.ok(!(await env.OAQ_R2.head(`${PLACE_DAILY_PREFIX}2026-11-11.json.gz`)));
  const t = await loadPlaceTrend(env, DELHI);
  assert.equal(t?.air.at(-1), 300);
  assert.equal(t?.feels_max.at(-1), null);
});

test("collectPlaceDaily: a rerun with nothing new reads and writes nothing", async () => {
  const { env } = testWorker();
  await seed(env, "2026-11-12");
  await collectPlaceDaily(env, { now: NOW, start: "2026-11-12", places: [DELHI], grid: GRID });
  const puts: string[] = [];
  const put = env.OAQ_R2.put.bind(env.OAQ_R2);
  env.OAQ_R2.put = (async (k: string, ...rest: unknown[]) => {
    puts.push(k);
    return (put as (...a: unknown[]) => unknown)(k, ...rest);
  }) as typeof env.OAQ_R2.put;
  const r = await collectPlaceDaily(env, { now: NOW, start: "2026-11-12", places: [DELHI], grid: GRID });
  assert.deepEqual(r.written, []);
  assert.deepEqual(puts, []);
});

test("collectPlaceDaily: out of time it stops between days, and the state files still follow what it wrote", async () => {
  const { env } = testWorker();
  await seed(env, "2026-11-12");
  await seed(env, "2026-11-11");
  const r = await collectPlaceDaily(env, { now: NOW, start: "2026-11-11", places: [DELHI], grid: GRID, maxDays: 1 });
  assert.deepEqual(r.written, ["2026-11-12"]);
  assert.equal(r.pending, 1);
  assert.equal((await loadPlaceTrend(env, DELHI))?.air.at(-1), 300);
});

test("loadPlaceTrend: no file yet is null", async () => {
  const { env } = testWorker();
  assert.equal(await loadPlaceTrend(env, DELHI), null);
});

test("the place-daily file keeps no empty places", () => {
  const d: PlaceDailyFile = summarizePlaces("2026-11-10", [PUNE], null, null, null, GRID);
  assert.deepEqual(d.places, {});
});
