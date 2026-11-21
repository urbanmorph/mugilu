import { test } from "node:test";
import assert from "node:assert/strict";
import { hasCoverage } from "../src/collect";
import type { ConditionsPoint } from "../src/types";

const pt = (wx: ConditionsPoint["wx"]) => ({ wx }) as ConditionsPoint;
const full = pt({ temp_c: 30, uv: 5 });
const blank = pt({ temp_c: null, apparent_c: null, uv: null } as unknown as ConditionsPoint["wx"]);

test("hasCoverage: a grid where Open-Meteo answered is written", () => {
  assert.equal(hasCoverage([...Array(95).fill(full), ...Array(5).fill(blank)]), true);
});

test("hasCoverage: a failed or rate-limited run (mostly blank points) keeps the previous grid", () => {
  assert.equal(hasCoverage(Array(100).fill(blank)), false);
  assert.equal(hasCoverage([...Array(50).fill(full), ...Array(50).fill(blank)]), false);
  assert.equal(hasCoverage([]), false);
});

// The 4-hourly grid is kept, gzipped, beside the live file: archive/conditions/{YYYY-MM-DD}/{HH}.json.gz, so
// mugilu builds its own record of modelled heat, rain, UV and dust per district instead of overwriting it.
import { gunzipSync } from "node:zlib";
import { collectConditions, conditionsArchiveKey } from "../src/collect";
import type { Env } from "../src/index";

test("conditionsArchiveKey: the snapshot's UTC date and hour", () => {
  assert.equal(conditionsArchiveKey("2026-11-12T08:05:31.123Z"), "archive/conditions/2026-11-12/08.json.gz");
});

function fakeEnv() {
  const puts = new Map<string, { body: unknown; meta: unknown }>();
  const env = {
    OAQ_R2: {
      put: async (k: string, body: unknown, meta: unknown) => void puts.set(k, { body, meta }),
      head: async () => null,
    },
  } as unknown as Env;
  return { env, puts };
}

function fakeOpenMeteo(answer: boolean) {
  const real = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    const n = new URL(url).searchParams.get("latitude")!.split(",").length;
    if (!answer) return new Response("{}", { status: 503 });
    const one = url.includes("air-quality")
      ? { current: { uv_index: 5, dust: 10 } }
      : { current: { temperature_2m: 30 }, hourly: { precipitation: [0] } };
    return Response.json(Array.from({ length: n }, () => one));
  }) as typeof fetch;
  return () => (globalThis.fetch = real);
}

test("collectConditions: writes the live grid and keeps a gzipped copy in the archive", async () => {
  const restore = fakeOpenMeteo(true);
  try {
    const { env, puts } = fakeEnv();
    const snap = await collectConditions(env, 0);
    const key = conditionsArchiveKey(snap.generated_at);
    assert.ok(puts.has("data/conditions.json"));
    const a = puts.get(key)!;
    assert.deepEqual(a.meta, { httpMetadata: { contentType: "application/json", contentEncoding: "gzip" } });
    const kept = JSON.parse(gunzipSync(Buffer.from(a.body as ArrayBuffer)).toString());
    assert.equal(kept.point_count, snap.point_count);
    assert.equal(kept.points[0].wx.temp_c, 30);
  } finally {
    restore();
  }
});

test("collectConditions: a failed run writes nothing, to the live file or the archive", async () => {
  const restore = fakeOpenMeteo(false);
  try {
    const { env, puts } = fakeEnv();
    await assert.rejects(collectConditions(env, 0));
    assert.equal(puts.size, 0);
  } finally {
    restore();
  }
});

// The day just ended, once: the first run of an India day also asks Open-Meteo for yesterday's daily
// figures (on the same calls) and keeps them as archive/wx-daily/{date}.json.gz, by grid point id.
import { WX_DAILY_PREFIX } from "../src/collect";

function fakeEnvWith(have: string[] = []) {
  const { env, puts } = fakeEnv();
  (env.OAQ_R2 as unknown as { head: (k: string) => Promise<unknown> }).head = async (k: string) =>
    have.includes(k) || puts.has(k) ? {} : null;
  return { env, puts };
}

function fakeOpenMeteoDay(date: string) {
  const real = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    urls.push(url);
    const n = new URL(url).searchParams.get("latitude")!.split(",").length;
    const past = url.includes("past_days=1");
    const one = url.includes("air-quality")
      ? {
          current: { uv_index: 5, dust: 10 },
          ...(past ? { hourly: { time: [`${date}T03:00`, `${date}T04:00`], dust: [40, 90] } } : {}),
        }
      : {
          current: { temperature_2m: 30 },
          hourly: { precipitation: [0] },
          ...(past
            ? {
                daily: {
                  time: [date, "next"],
                  apparent_temperature_max: [33, 0],
                  apparent_temperature_min: [12, 0],
                  precipitation_sum: [0, 0],
                  wind_gusts_10m_max: [20, 0],
                  uv_index_max: [6, 0],
                  visibility_min: [900, 0],
                },
              }
            : {}),
        };
    return Response.json(Array.from({ length: n }, () => one));
  }) as typeof fetch;
  return { urls, restore: () => (globalThis.fetch = real) };
}

// 21 Nov, 01:35 in India: the 20th ended 95 minutes ago.
const AFTER_MIDNIGHT = Date.parse("2026-11-20T20:05:00Z");

test("collectConditions: the first run of an India day keeps yesterday's figures for every grid point", async () => {
  const om = fakeOpenMeteoDay("2026-11-20");
  try {
    const { env, puts } = fakeEnvWith();
    const snap = await collectConditions(env, 0, AFTER_MIDNIGHT);
    assert.ok(om.urls.every((u) => u.includes("past_days=1")));
    const kept = puts.get(`${WX_DAILY_PREFIX}2026-11-20.json.gz`)!;
    assert.deepEqual(kept.meta, { httpMetadata: { contentType: "application/json", contentEncoding: "gzip" } });
    const d = JSON.parse(gunzipSync(Buffer.from(kept.body as ArrayBuffer)).toString());
    assert.equal(d.date, "2026-11-20");
    const id = snap.points[0].id;
    assert.deepEqual(d.points[id], {
      feels_max: 33,
      feels_min: 12,
      rain_mm: 0,
      gust_kmh: 20,
      uv_max: 6,
      vis_min_m: 900,
      dust_max: 90,
    });
    assert.equal(Object.keys(d.points).length, snap.point_count);
    assert.equal((snap.points[0].wx as { day?: unknown }).day, undefined, "the live grid stays as it was");
  } finally {
    om.restore();
  }
});

test("collectConditions: later runs that day ask for nothing more", async () => {
  const om = fakeOpenMeteoDay("2026-11-20");
  try {
    const { env, puts } = fakeEnvWith([`${WX_DAILY_PREFIX}2026-11-20.json.gz`]);
    await collectConditions(env, 0, AFTER_MIDNIGHT + 4 * 3600_000);
    assert.ok(om.urls.every((u) => !u.includes("past_days")));
    assert.ok(![...puts.keys()].some((k) => k.startsWith(WX_DAILY_PREFIX)));
  } finally {
    om.restore();
  }
});

test("collectConditions: figures for another day (Open-Meteo's day not yet turned) are not kept as yesterday", async () => {
  const om = fakeOpenMeteoDay("2026-11-19");
  try {
    const { env, puts } = fakeEnvWith();
    await collectConditions(env, 0, AFTER_MIDNIGHT);
    assert.ok(![...puts.keys()].some((k) => k.startsWith(WX_DAILY_PREFIX)));
  } finally {
    om.restore();
  }
});
