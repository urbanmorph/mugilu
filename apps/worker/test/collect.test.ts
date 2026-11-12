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
    OAQ_R2: { put: async (k: string, body: unknown, meta: unknown) => void puts.set(k, { body, meta }) },
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
