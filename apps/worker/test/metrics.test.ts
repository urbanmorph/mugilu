import { test } from "node:test";
import assert from "node:assert/strict";
import { recordLookup, recordReferrer, recordEvent, topPlaces, counters, clientClass } from "../src/metrics";
import type { Env } from "../src/index";
import type { Conditions } from "../src/types";

const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

test("clientClass: real browsers are humans", () => {
  assert.equal(clientClass(CHROME), "human");
  assert.equal(clientClass("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1"), "human");
});

test("clientClass: AI/LLM agents get their own bucket (even when the UA says 'bot')", () => {
  for (const ua of [
    "Mozilla/5.0 (compatible; GPTBot/1.1; +https://openai.com/gptbot)",
    "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
    "ChatGPT-User/1.0",
    "PerplexityBot/1.0 (+https://perplexity.ai/bot)",
    "Mozilla/5.0 (compatible; CCBot/2.0; +https://commoncrawl.org/faq/)",
    "Bytespider",
  ]) {
    assert.equal(clientClass(ua), "llm", ua);
  }
});

test("clientClass: search crawlers, scanners and scripts are bots", () => {
  for (const ua of [
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
    "curl/8.1.2",
    "python-requests/2.31.0",
    "Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0.0.0 Safari/537.36",
  ]) {
    assert.equal(clientClass(ua), "bot", ua);
  }
});

test("clientClass: a missing/empty User-Agent is a bot, never a human", () => {
  assert.equal(clientClass(null), "bot");
  assert.equal(clientClass(undefined), "bot");
  assert.equal(clientClass(""), "bot");
});

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

test("recordEvent: writes anonymous dimensions to Analytics Engine (format/persona/region/class)", () => {
  let captured: { blobs?: unknown[]; doubles?: unknown[]; indexes?: unknown[] } | null = null;
  const env = { EVENTS: { writeDataPoint: (e: typeof captured) => (captured = e) } } as unknown as Env;
  recordEvent(env, cond(), "asthma", "json", "GPTBot/1.1"); // an API hit from an LLM agent
  assert.equal(captured!.blobs![0], "json"); // format
  assert.equal(captured!.blobs![1], "asthma"); // persona
  assert.equal(captured!.blobs![4], "Punjab"); // region from stateAt — no precise coord, no IP
  assert.equal(captured!.blobs![6], "llm"); // client class (human / llm / bot)
  assert.equal(captured!.indexes![0], "json");
});

test("recordEvent: no-op when the binding is absent, and best-effort on failure", () => {
  assert.doesNotThrow(() => recordEvent({} as unknown as Env, cond(), "everyone", "html", CHROME)); // no EVENTS binding
  const bad = {
    EVENTS: {
      writeDataPoint: () => {
        throw new Error("ae down");
      },
    },
  } as unknown as Env;
  assert.doesNotThrow(() => recordEvent(bad, cond(), "everyone", "html", null));
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

test("recordLookup: rounds coords to a ~11km grid (privacy), tallies the format + client class", async () => {
  const { db, calls } = mockDB();
  await recordLookup({ METRICS: db } as unknown as Env, 30.94, 75.86, "Ludhiana, Punjab", "html", CHROME);
  const lookup = calls.find((c) => /INSERT INTO lookups/.test(c.sql));
  assert.ok(lookup, "writes a lookup row");
  // the ROUNDED grid key + coords, never the precise 30.94/75.86
  assert.deepEqual(lookup!.args.slice(0, 4), ["30.9,75.9", "Ludhiana, Punjab", 30.9, 75.9]);
  const tallies = calls.filter((c) => /INSERT INTO counters/.test(c.sql)).map((c) => c.args[0]);
  assert.ok(tallies.includes("fmt:html"), "tallies the format");
  assert.ok(tallies.includes("class:human"), "tallies the client class");
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
  await recordLookup({ METRICS: bad } as unknown as Env, 1, 1, "x", "html", null); // must not throw
  assert.deepEqual(await topPlaces({ METRICS: bad } as unknown as Env), []);
  assert.deepEqual(await counters({ METRICS: bad } as unknown as Env), {});
});
