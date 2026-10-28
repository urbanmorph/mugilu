import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  gridNodes,
  byPriority,
  dailyClimatology,
  weeklyTenths,
  requestWeight,
  renderNormals,
  fetchCell,
} from "../scripts/build-heat-normals";
import { normalMaxAt, WEEKS } from "../src/heatnormals";

// 1991-2020, every day: what a full archive answer covers.
const TIMES: string[] = [];
for (let d = new Date(Date.UTC(1991, 0, 1)); d.getUTCFullYear() <= 2020; d.setUTCDate(d.getUTCDate() + 1))
  TIMES.push(d.toISOString().slice(0, 10));

test("fetchCell: cache a full answer; wait out a minutely/hourly cap; stop on the daily cap; skip a bad request", async () => {
  const realFetch = globalThis.fetch;
  const reply = (status: number, body: object) => {
    globalThis.fetch = (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
  };
  const go = () => fetchCell({ lat: 28.5, lon: 77.5 }, new AbortController().signal);
  try {
    reply(200, { elevation: 197, daily: { time: TIMES, temperature_2m_max: TIMES.map(() => 30) } });
    assert.equal((await go()).kind, "ok");
    const jan1Missing = TIMES.map((t) => (t.endsWith("-01-01") ? null : 30));
    reply(200, { elevation: 197, daily: { time: TIMES, temperature_2m_max: jan1Missing } });
    const gap = await go();
    assert.deepEqual([gap.kind, gap.kind !== "ok" && gap.why], ["retry", "short answer"], "a day of year with no data");
    reply(200, { elevation: 197, daily: { time: [], temperature_2m_max: [30] } });
    assert.deepEqual(
      [(await go()).kind, (await go()).spent],
      ["retry", true],
      "a short answer is retried and still counts against the quota",
    );
    reply(429, { error: true, reason: "Minutely API request limit exceeded. Please try again in one minute." });
    assert.equal((await go()).kind, "retry");
    reply(429, { error: true, reason: "Daily API request limit exceeded. Please try again tomorrow." });
    assert.equal((await go()).kind, "stop");
    reply(400, { error: true, reason: "Cannot initialize WeatherVariable from invalid String value" });
    assert.equal((await go()).kind, "skip");
    reply(502, { error: true, reason: "Bad gateway" });
    assert.equal((await go()).kind, "retry");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("requestWeight: Open-Meteo's documented formula, nLocations x nDays/14 x nVariables/10", () => {
  // Their worked example: 10 locations, 1 variable, 3650 days = 260.7 calls.
  assert.equal(+requestWeight(3650, 1, 10).toFixed(1), 260.7);
  // One cell, 1991-2020 daily max: 10958 days.
  assert.equal(+requestWeight(10958, 1).toFixed(1), 78.3);
});

test("gridNodes: keeps a node when any part of its cell is inside; nodes sit on half steps", () => {
  const inside = (lat: number, lon: number) => lat >= 10.2 && lat <= 10.3 && lon >= 70.2 && lon <= 70.3;
  const nodes = gridNodes(1, inside, { minLat: 8, maxLat: 12, minLon: 68, maxLon: 72 });
  assert.deepEqual(
    nodes.map((n) => [n.lat, n.lon]),
    [[10.5, 70.5]],
  );
});

test("gridNodes: a node at sea is sampled at the nearest land in its cell, so a coast is not read as sea", () => {
  const inside = (lat: number, lon: number) => lat >= 10.2 && lat <= 10.3 && lon >= 70.2 && lon <= 70.3;
  const [n] = gridNodes(1, inside, { minLat: 8, maxLat: 12, minLon: 68, maxLon: 72 });
  assert.deepEqual(n.sample, { lat: 10.3, lon: 70.3 });
  const [land] = gridNodes(1, () => true, { minLat: 10, maxLat: 11, minLon: 70, maxLon: 71 });
  assert.deepEqual(land.sample, { lat: 10.5, lon: 70.5 });
});

// The outline is grown ~5 km, so "inside" near a coast can still be sea. Land at least
// ~11 km in from the outline's edge is trusted; a point the archive reported at sea
// level (elevation 0) is never sampled again; a point it reported as land is kept.
const BOX = { minLat: 10, maxLat: 11, minLon: 70, maxLon: 71 };
const northOf = (lat0: number) => (lat: number) => lat >= lat0;

test("gridNodes: a node in the outline's coastal buffer moves to land well inside it", () => {
  const [n] = gridNodes(1, northOf(10.47), BOX);
  assert.deepEqual(n.sample, { lat: 10.6, lon: 70.5 });
});

test("gridNodes: a point the archive found at sea is skipped; one it found on land is kept", () => {
  const [moved] = gridNodes(1, northOf(10.47), BOX, new Map([["10.6,70.5", 0]]));
  assert.deepEqual(moved.sample, { lat: 10.6, lon: 70.45 });
  const [kept] = gridNodes(1, northOf(10.47), BOX, new Map([["10.5,70.5", 120]]));
  assert.deepEqual(kept.sample, { lat: 10.5, lon: 70.5 });
});

test("gridNodes: a node well inside the outline but found at sea level is not sampled again", () => {
  // Kuttanad (Alappuzha) lies below sea level: the archive says 0 or less, so the node itself is
  // skipped and the nearest other point is tried, not the same point every attempt.
  const [n] = gridNodes(1, () => true, BOX, new Map([["10.5,70.5", -1]]));
  assert.notDeepEqual(n.sample, { lat: 10.5, lon: 70.5 });
});

test("bundled normals: every node is on land (elevation above 0) with a full, finite year", () => {
  const file = JSON.parse(readFileSync(new URL("../data/heat-normals.json", import.meta.url), "utf8"));
  for (const [k, v] of Object.entries(file.nodes as Record<string, number[]>)) {
    assert.ok(v[0] > 0, `${k} has elevation ${v[0]}: an offshore sample`);
    assert.equal(v.length, 1 + WEEKS, k);
    assert.ok(v.every(Number.isFinite), `${k} has a gap`);
  }
});

test("byPriority: nodes nearest a priority city come first", () => {
  const nodes = [
    { lat: 20.5, lon: 80.5 },
    { lat: 28.5, lon: 77.5 },
    { lat: 12.5, lon: 77.5 },
  ];
  const sorted = byPriority(nodes, [
    { lat: 12.97, lon: 77.59 },
    { lat: 28.61, lon: 77.21 },
  ]);
  assert.deepEqual(
    sorted
      .slice(0, 2)
      .map((n) => n.lat)
      .sort(),
    [12.5, 28.5],
  );
  assert.equal(sorted[2].lat, 20.5);
});

test("dailyClimatology: mean per day of year across years, Feb 29 dropped, gaps skipped", () => {
  const times: string[] = [];
  const values: (number | null)[] = [];
  for (const y of [2019, 2020]) {
    for (let d = new Date(Date.UTC(y, 0, 1)); d.getUTCFullYear() === y; d.setUTCDate(d.getUTCDate() + 1)) {
      times.push(d.toISOString().slice(0, 10));
      values.push(y === 2019 ? 30 : 32);
    }
  }
  values[0] = null;
  const clim = dailyClimatology(times, values, 1);
  assert.equal(clim.length, 365);
  assert.equal(clim[0], 32); // 2019-01-01 missing, only 2020 counts
  assert.equal(clim[100], 31);
});

test("dailyClimatology: smooths with a circular window", () => {
  const times: string[] = [];
  const values: number[] = [];
  for (let d = new Date(Date.UTC(2019, 0, 1)); d.getUTCFullYear() === 2019; d.setUTCDate(d.getUTCDate() + 1)) {
    times.push(d.toISOString().slice(0, 10));
    values.push(times.length === 1 ? 31 : 30); // a spike on Jan 1
  }
  const clim = dailyClimatology(times, values, 3);
  assert.ok(Math.abs(clim[364] - 30 - 1 / 3) < 1e-9); // Dec 31 sees Jan 1 through the wrap
  assert.ok(Math.abs(clim[0] - 30 - 1 / 3) < 1e-9);
  assert.equal(clim[5], 30);
});

test("weeklyTenths + renderNormals round-trip through the worker lookup", () => {
  const daily = Array.from({ length: 365 }, (_, d) => 30 + 10 * Math.sin((2 * Math.PI * d) / 365));
  const weeks = weeklyTenths(daily);
  assert.equal(weeks.length, WEEKS);
  assert.ok(weeks.every(Number.isInteger));
  const file = JSON.parse(renderNormals(1, [{ lat: 28.5, lon: 77.5, elevation: 216, weeks }]));
  // Day 91 (~Apr 1) sits near the sine's peak: 40 °C.
  const v = normalMaxAt(28.5, 77.5, "2026-04-01", undefined, file)!;
  assert.ok(Math.abs(v - daily[90]) < 0.2, `got ${v}, want ~${daily[90]}`);
  assert.equal(
    renderNormals(1, [{ lat: 28.5, lon: 77.5, elevation: 216, weeks }]),
    renderNormals(1, [{ lat: 28.5, lon: 77.5, elevation: 216, weeks }]),
  );
});
