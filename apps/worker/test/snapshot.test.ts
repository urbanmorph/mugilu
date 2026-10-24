import { test } from "node:test";
import assert from "node:assert/strict";
import { freshStations, loadJson, MEMO_TTL_MS, putJson, STALE_AFTER_MS, youngerThan } from "../src/snapshot";
import type { Env } from "../src/index";
import type { NormalizedStation } from "../src/types";

const st = (id: string, ts: string | null): NormalizedStation => ({
  id,
  raw_id: id,
  provider: "cpcb",
  name: id,
  city: "",
  state: "",
  lat: 12.9,
  lon: 77.6,
  pollutants: { pm25: 40 },
  aqi: 67,
  band: "satisfactory",
  ts,
  yll: null,
});

test("freshStations: drops readings older than the cutoff, or with no time, from answering for now", () => {
  const now = Date.parse("2026-10-15T05:00:00Z");
  const kept = freshStations(
    [
      st("fresh", "2026-10-15T09:45:00+05:30"), // 45 min old, IST offset
      st("edge", new Date(now - STALE_AFTER_MS + 60_000).toISOString()),
      st("old", "2026-10-15T06:00:00+05:30"), // 5h old
      st("jan", "2026-01-13T10:00:00+05:30"),
      st("none", null),
      st("garbage", "not a date"),
    ],
    now,
  ).map((s) => s.id);
  assert.deepEqual(kept, ["fresh", "edge"]);
});

test("freshStations: a reading stamped slightly in the future (clock skew) still counts", () => {
  const now = Date.parse("2026-10-15T05:00:00Z");
  assert.equal(freshStations([st("skew", "2026-10-15T05:05:00Z")], now).length, 1);
});

test("youngerThan: a snapshot kept through failed runs stops being served once too old", () => {
  const now = Date.parse("2026-10-15T12:00:00Z");
  assert.equal(youngerThan({ generated_at: "2026-10-15T09:00:00Z" }, 6 * 3600_000, now), true);
  assert.equal(youngerThan({ generated_at: "2026-10-14T12:00:00Z" }, 6 * 3600_000, now), false);
  assert.equal(youngerThan({ generated_at: "garbage" }, 6 * 3600_000, now), false);
});

// An R2 stand-in that counts reads, so a test can see what reaches the bucket.
function countingEnv(objects: Record<string, unknown>, fail = false) {
  const reads: string[] = [];
  const env = {
    OAQ_R2: {
      get: async (key: string) => {
        reads.push(key);
        if (fail) throw new Error("r2 down");
        return key in objects ? { json: async () => structuredClone(objects[key]) } : null;
      },
      put: async (key: string, body: string) => void (objects[key] = JSON.parse(body)),
    },
  } as unknown as Env;
  return { env, reads };
}

test("loadJson: a warm isolate reads and parses each R2 object once per MEMO_TTL_MS", async () => {
  const { env, reads } = countingEnv({ "data/x.json": { v: 1 } });
  const t0 = 1_000_000;
  const a = await loadJson(env, "data/x.json", t0);
  const b = await loadJson(env, "data/x.json", t0 + MEMO_TTL_MS - 1);
  assert.deepEqual(a, { v: 1 });
  assert.equal(a, b, "a later request gets the parsed object, no new read");
  assert.deepEqual(reads, ["data/x.json"]);
  await loadJson(env, "data/x.json", t0 + MEMO_TTL_MS);
  assert.equal(reads.length, 2, "re-read once the memo is older than its TTL");
});

test("loadJson: only settled values are shared, never another request's read in flight", async () => {
  // In workerd a read belongs to the request that started it; a second request
  // awaiting it can hang once the first one ends. So an unsettled read is not shared.
  const { env, reads } = countingEnv({ "data/x.json": { v: 1 } });
  const first = loadJson(env, "data/x.json", 0);
  const second = loadJson(env, "data/x.json", 0);
  assert.notEqual(first, second);
  await Promise.all([first, second]);
  assert.equal(reads.length, 2);
  await loadJson(env, "data/x.json", 1);
  assert.equal(reads.length, 2, "once settled, it is shared");
});

test("loadJson: fails as a rejected promise, never a synchronous throw", async () => {
  const p = loadJson({} as Env, "data/x.json"); // no bucket binding
  assert.ok(p instanceof Promise);
  await assert.rejects(p);
});

test("loadJson: a missing object is remembered too; a failed read is not", async () => {
  const missing = countingEnv({});
  assert.equal(await loadJson(missing.env, "data/none.json", 0), null);
  assert.equal(await loadJson(missing.env, "data/none.json", 1), null);
  assert.equal(missing.reads.length, 1);
  const broken = countingEnv({}, true);
  await assert.rejects(loadJson(broken.env, "data/x.json", 0));
  await assert.rejects(loadJson(broken.env, "data/x.json", 1));
  assert.equal(broken.reads.length, 2, "a failure is retried on the next request");
});

test("putJson: a writer in this isolate drops its key, so the next read is fresh", async () => {
  const { env, reads } = countingEnv({ "data/x.json": { v: 1 } });
  await loadJson(env, "data/x.json", 0);
  await putJson(env, "data/x.json", JSON.stringify({ v: 2 }), "public, max-age=60");
  assert.deepEqual(await loadJson(env, "data/x.json", 1), { v: 2 });
  assert.equal(reads.length, 2);
});

test("putJson: a read that started before the write does not put the old version back", async () => {
  const { env } = countingEnv({ "data/x.json": { v: 1 } });
  const before = loadJson(env, "data/x.json", 0); // in flight across the write
  await putJson(env, "data/x.json", JSON.stringify({ v: 2 }), "public, max-age=60");
  await before;
  assert.deepEqual(await loadJson(env, "data/x.json", 1), { v: 2 });
});

test("MEMO_TTL_MS: far inside the freshness bounds, so a memo never outlives what readers accept", () => {
  assert.ok(MEMO_TTL_MS <= 5 * 60_000);
  assert.ok(MEMO_TTL_MS < STALE_AFTER_MS / 10);
});
