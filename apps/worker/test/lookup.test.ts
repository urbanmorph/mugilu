import { test } from "node:test";
import assert from "node:assert/strict";
import { lookupConditions } from "../src/lookup";
import type { Env } from "../src/index";
import { testD1 } from "./d1";

const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Open-Meteo answers; SACHET has nothing. R2 is empty (no snapshot, no fires).
function mockFetch(): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const u = String(input);
    if (u.includes("open-meteo")) {
      const body = u.includes("air-quality")
        ? { current: { pm2_5: 20, uv_index: 1, dust: 2 } }
        : { current: { temperature_2m: 30, relative_humidity_2m: 50, apparent_temperature: 32 } };
      return Response.json(body);
    }
    return new Response("[]", { headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

function setup() {
  const events: { blobs: string[] }[] = [];
  const pending: Promise<unknown>[] = [];
  const METRICS = testD1();
  const env = {
    OAQ_R2: { get: async () => null },
    METRICS,
    EVENTS: { writeDataPoint: (e: { blobs: string[] }) => events.push(e) },
  } as unknown as Env;
  const ctx = { waitUntil: (p: Promise<unknown>) => pending.push(p) } as unknown as ExecutionContext;
  const rows = async (sql: string) => (await METRICS.prepare(sql).all()).results as Record<string, unknown>[];
  return { env, ctx, events, settle: () => Promise.all(pending), rows };
}

async function withFetch<T>(fn: () => Promise<T>): Promise<T> {
  const real = globalThis.fetch;
  globalThis.fetch = mockFetch();
  try {
    return await fn();
  } finally {
    globalThis.fetch = real;
  }
}

function req(path: string, headers: Record<string, string> = {}): { req: Request; url: URL } {
  const url = new URL(`https://mugilu.live${path}`);
  return { req: new Request(url, { headers: { "user-agent": CHROME, ...headers } }), url };
}

test("lookupConditions: /embed records the lookup, the referrer AND the behaviour event, like the page", async () => {
  const s = setup();
  const r = req("/embed/12.97,77.59", { referer: "https://news.example.com/story" });
  const c = await withFetch(() =>
    lookupConditions(s.env, s.ctx, { lat: 12.97, lon: 77.59, persona: "asthma", fmt: "embed", ua: CHROME, ...r }),
  );
  await s.settle();
  assert.ok(c.heat, "conditions are built");
  assert.equal(s.events.length, 1, "one Analytics Engine event");
  assert.equal(s.events[0].blobs[0], "embed");
  assert.equal(s.events[0].blobs[1], "asthma");
  assert.equal((await s.rows("SELECT * FROM lookups")).length, 1);
  const counters = (await s.rows("SELECT name FROM counters")).map((x) => x.name);
  assert.ok(counters.includes("fmt:embed"));
  const refs = await s.rows("SELECT host, surface FROM referrers");
  assert.deepEqual(refs, [{ host: "example.com", surface: "embed" }]);
});

test("lookupConditions: an API format counts the referrer under 'api'; the page does not", async () => {
  const s = setup();
  const headers = { referer: "https://app.example.org/" };
  await withFetch(async () => {
    const a = req("/c/12.97,77.59.json", headers);
    await lookupConditions(s.env, s.ctx, {
      lat: 12.97,
      lon: 77.59,
      persona: "everyone",
      fmt: "json",
      ua: CHROME,
      ...a,
    });
    const b = req("/c/12.97,77.59", headers);
    await lookupConditions(s.env, s.ctx, {
      lat: 12.97,
      lon: 77.59,
      persona: "everyone",
      fmt: "html",
      ua: CHROME,
      ...b,
    });
  });
  await s.settle();
  assert.deepEqual(await s.rows("SELECT surface, n FROM referrers"), [{ surface: "api", n: 1 }]);
  assert.deepEqual(
    s.events.map((e) => e.blobs[0]),
    ["json", "html"],
  );
});

test("lookupConditions: a kiosk is an event but not a place lookup; a label names the place", async () => {
  const s = setup();
  const c = await withFetch(() =>
    lookupConditions(s.env, s.ctx, {
      lat: 12.97,
      lon: 77.59,
      persona: "everyone",
      fmt: "kiosk",
      ua: CHROME,
      label: "Bengaluru, Karnataka",
    }),
  );
  await s.settle();
  assert.equal(c.place, "Bengaluru, Karnataka");
  assert.equal(s.events[0].blobs[0], "kiosk");
  assert.equal((await s.rows("SELECT * FROM lookups")).length, 0);
});

test("lookupConditions: a warm isolate reads each snapshot from R2 once, not per request", async () => {
  const s = setup();
  const reads: string[] = [];
  (s.env as unknown as { OAQ_R2: { get: (k: string) => Promise<null> } }).OAQ_R2 = {
    get: async (k: string) => (reads.push(k), null),
  };
  await withFetch(async () => {
    for (let i = 0; i < 3; i++)
      await lookupConditions(s.env, s.ctx, { lat: 12.97, lon: 77.59, persona: "everyone", fmt: "json", ua: CHROME });
  });
  assert.deepEqual(reads.sort(), ["data/fires.json", "data/latest.json"]);
});

test("lookupConditions: the upstream weather and warning calls do not wait for R2", async () => {
  const s = setup();
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let fetchedWhileR2Pending = 0;
  let r2Done = false;
  (s.env as unknown as { OAQ_R2: { get: () => Promise<null> } }).OAQ_R2 = {
    get: async () => {
      await gate;
      r2Done = true;
      return null;
    },
  };
  const real = globalThis.fetch;
  const mock = mockFetch();
  globalThis.fetch = ((input: RequestInfo | URL) => {
    if (!r2Done) fetchedWhileR2Pending++;
    return mock(input);
  }) as typeof fetch;
  try {
    const p = lookupConditions(s.env, s.ctx, { lat: 12.9, lon: 77.5, persona: "everyone", fmt: "json", ua: CHROME });
    await new Promise((r) => setTimeout(r, 10));
    release();
    await p;
  } finally {
    globalThis.fetch = real;
  }
  assert.ok(fetchedWhileR2Pending >= 3, `upstream calls started while R2 was pending (${fetchedWhileR2Pending})`);
});

test("lookupConditions: MCP records the lookup and event without a request", async () => {
  const s = setup();
  await withFetch(() =>
    lookupConditions(s.env, s.ctx, { lat: 12.97, lon: 77.59, persona: "everyone", fmt: "mcp", ua: CHROME }),
  );
  await s.settle();
  assert.equal(s.events[0].blobs[0], "mcp");
  assert.equal((await s.rows("SELECT * FROM lookups")).length, 1);
  assert.equal((await s.rows("SELECT * FROM referrers")).length, 0);
});
