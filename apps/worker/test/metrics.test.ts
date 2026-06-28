import { test } from "node:test";
import assert from "node:assert/strict";
import { recordLookup, recordReferrer, recordEvent, topPlaces, counters } from "../src/metrics";
import type { Env } from "../src/index";
import type { Conditions } from "../src/types";

// Minimal conditions at a real coord (Ludhiana → state Punjab via stateAt).
function cond(): Conditions {
  return {
    location: { lat: 30.9, lon: 75.85 },
    as_of: "now",
    air: {
      aqi: 104,
      band: "moderate",
      pollutants: {},
      yll: null,
      station: { id: "x", name: "x", city: "x", distance_km: 1 },
      source: "cpcb",
    },
    heat: { apparent_c: 38, source: "om" },
    rain: null,
    uv: null,
    dust: null,
    wind: null,
    visibility: null,
    smoke: null,
    attribution: "",
    disclaimer: "",
  } as unknown as Conditions;
}

test("recordEvent: writes anonymous dimensions to Analytics Engine (format/persona/region)", () => {
  let captured: { blobs?: unknown[]; doubles?: unknown[]; indexes?: unknown[] } | null = null;
  const env = { EVENTS: { writeDataPoint: (e: typeof captured) => (captured = e) } } as unknown as Env;
  recordEvent(env, cond(), "asthma", "json");
  assert.equal(captured!.blobs![0], "json"); // format
  assert.equal(captured!.blobs![1], "asthma"); // persona
  assert.equal(captured!.blobs![4], "Punjab"); // region from stateAt — no precise coord, no IP
  assert.equal(captured!.indexes![0], "json");
});

test("recordEvent: no-op when the binding is absent, and best-effort on failure", () => {
  assert.doesNotThrow(() => recordEvent({} as unknown as Env, cond(), "everyone", "html")); // no EVENTS binding
  const bad = {
    EVENTS: {
      writeDataPoint: () => {
        throw new Error("ae down");
      },
    },
  } as unknown as Env;
  assert.doesNotThrow(() => recordEvent(bad, cond(), "everyone", "html"));
});

function req(headers: Record<string, string> = {}): Request {
  return { headers: { get: (k: string) => headers[k.toLowerCase()] ?? null } } as unknown as Request;
}

// A tiny D1 stand-in that records prepared statements + their bound args.
function mockDB(rows: Record<string, unknown[]> = {}) {
  const calls: Array<{ sql: string; args: unknown[] }> = [];
  function stmt(sql: string) {
    const s = {
      sql,
      args: [] as unknown[],
      bind(...a: unknown[]) {
        s.args = a;
        return s;
      },
      async all<T>() {
        calls.push({ sql, args: s.args });
        return { results: (rows[Object.keys(rows).find((k) => sql.includes(k)) ?? ""] ?? []) as T[] };
      },
      async run() {
        calls.push({ sql, args: s.args });
        return {};
      },
    };
    return s;
  }
  return {
    calls,
    db: {
      prepare: (sql: string) => stmt(sql),
      async batch(stmts: Array<{ sql: string; args: unknown[] }>) {
        for (const st of stmts) calls.push({ sql: st.sql, args: st.args });
        return [];
      },
    },
  };
}

test("recordLookup: rounds coordinates to a ~11km grid (privacy) and tallies the format", async () => {
  const { db, calls } = mockDB();
  await recordLookup({ METRICS: db } as unknown as Env, 30.94, 75.86, "Ludhiana, Punjab", "html");
  const lookup = calls.find((c) => /INSERT INTO lookups/.test(c.sql));
  assert.ok(lookup, "writes a lookup row");
  // the ROUNDED grid key + coords, never the precise 30.94/75.86
  assert.deepEqual(lookup!.args.slice(0, 4), ["30.9,75.9", "Ludhiana, Punjab", 30.9, 75.9]);
  const fmt = calls.find((c) => /INSERT INTO counters/.test(c.sql));
  assert.deepEqual(fmt!.args, ["fmt:html"]);
});

test("topPlaces: returns most-looked-up places, gated by a cumulative threshold", async () => {
  const { db, calls } = mockDB({ lookups: [{ label: "Delhi, Delhi", lat: 28.6, lon: 77.2, n: 9 }] });
  const r = await topPlaces({ METRICS: db } as unknown as Env, 5, 25);
  assert.equal(r[0].label, "Delhi, Delhi");
  assert.equal(r[0].n, 9);
  const q = calls.find((c) => /FROM lookups/.test(c.sql));
  assert.match(q!.sql, /n >= \?/); // a minimum-count threshold is applied in SQL
  assert.deepEqual(q!.args, [25, 5]); // minN, limit
});

test("recordReferrer: captures the referring host (no www), domain-level", async () => {
  const { db, calls } = mockDB();
  await recordReferrer(
    { METRICS: db } as unknown as Env,
    "embed",
    req({ referer: "https://www.example.com/page?x=1" }),
    new URL("https://mugilu.live/embed/1,2"),
  );
  const ins = calls.find((c) => /INSERT INTO referrers/.test(c.sql));
  assert.deepEqual(ins!.args, ["embed|example.com", "example.com", "embed"]); // host only, no path/www
});

test("recordReferrer: ?ref= self-identifies server-to-server callers", async () => {
  const { db, calls } = mockDB();
  await recordReferrer(
    { METRICS: db } as unknown as Env,
    "api",
    req(),
    new URL("https://mugilu.live/c/1,2.json?ref=MyApp"),
  );
  const ins = calls.find((c) => /referrers/.test(c.sql));
  assert.deepEqual(ins!.args, ["api|myapp", "myapp", "api"]);
});

test("recordReferrer: skips our own pages and empty referrers", async () => {
  const { db, calls } = mockDB();
  const e = { METRICS: db } as unknown as Env;
  await recordReferrer(
    e,
    "api",
    req({ referer: "https://mugilu.live/about" }),
    new URL("https://mugilu.live/c/1,2.json"),
  );
  await recordReferrer(e, "api", req(), new URL("https://mugilu.live/c/1,2.json"));
  assert.equal(calls.length, 0); // nothing written for own-host or no-referrer
});

test("metrics are best-effort: a D1 failure never throws or surfaces", async () => {
  const bad = {
    prepare: () => {
      throw new Error("d1 down");
    },
    batch: () => {
      throw new Error("d1 down");
    },
  };
  await recordLookup({ METRICS: bad } as unknown as Env, 1, 1, "x", "html"); // must not throw
  assert.deepEqual(await topPlaces({ METRICS: bad } as unknown as Env), []);
  assert.deepEqual(await counters({ METRICS: bad } as unknown as Env), {});
});
