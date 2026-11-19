// The whole worker in a test: its real fetch() over in-memory KV, R2 (seeded from a
// trimmed copy of production's data/ snapshots in test/fixtures/worker/), a SQLite D1,
// a no-op edge cache, and upstream HTTP (Open-Meteo, geocoders) replayed from
// test/fixtures/worker/net.json. RECORD=1 fetches and saves any request not yet recorded;
// without it an unrecorded upstream call answers 503, so a test never touches the network.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { mock } from "node:test";
import worker, { type Env } from "../../src/index";
import { testD1 } from "../d1";

const FIX = new URL("../fixtures/worker/", import.meta.url);
const NET = new URL("net.json", FIX);
const SEEDED = ["latest", "conditions", "fires", "warnings", "cyclones", "gazetteer"];

// The fixtures are a snapshot of one moment, and the worker drops readings that are
// too old, so the clock is pinned to that moment (shortly after the snapshot was taken):
// otherwise the tests pass on the day the fixtures were recorded and fail hours later.
const SNAPSHOT_AT = JSON.parse(readFileSync(new URL("latest.json", FIX), "utf8")).generated_at as string;
export const FIXTURE_NOW = Date.parse(SNAPSHOT_AT) + 10 * 60_000;
let pinned = false;
function pinClock(): void {
  if (pinned) return;
  mock.timers.enable({ apis: ["Date"], now: FIXTURE_NOW });
  pinned = true;
}

class MemR2 {
  // Binary bodies (the gzipped archives) stay bytes; text stays text.
  store = new Map<string, string | Uint8Array>();
  meta = new Map<string, Record<string, string>>();
  async get(key: string) {
    const body = this.store.get(key);
    if (body == null) return null;
    const text = () => (typeof body === "string" ? body : new TextDecoder().decode(body));
    const bytes = () => (typeof body === "string" ? new TextEncoder().encode(body) : body);
    return {
      body: new Response(bytes()).body,
      httpMetadata: { contentType: "application/json" },
      text: async () => text(),
      json: async () => JSON.parse(text()),
      arrayBuffer: async () => bytes().slice().buffer,
      writeHttpMetadata: (h: Headers) => h.set("content-type", "application/json"),
    };
  }
  async head(key: string) {
    return this.store.has(key) ? { key, size: this.store.get(key)!.length, uploaded: new Date() } : null;
  }
  async put(
    key: string,
    value: string | ArrayBuffer | Uint8Array,
    opts: { customMetadata?: Record<string, string> } = {},
  ) {
    this.store.set(
      key,
      typeof value === "string" ? value : new Uint8Array(value instanceof ArrayBuffer ? value : value.slice()),
    );
    this.meta.set(key, { ...opts.customMetadata });
  }
  async list(opts: { prefix?: string } = {}) {
    const objects = [...this.store.keys()]
      .filter((k) => k.startsWith(opts.prefix ?? ""))
      .map((key) => ({
        key,
        size: this.store.get(key)!.length,
        uploaded: new Date(),
        customMetadata: this.meta.get(key) ?? {},
      }));
    return { objects, truncated: false, delimitedPrefixes: [] };
  }
  async delete(key: string) {
    this.store.delete(key);
    this.meta.delete(key);
  }
}

class MemKV {
  store = new Map<string, string>();
  async get(key: string, type?: string | { type?: string }) {
    const v = this.store.get(key) ?? null;
    const t = typeof type === "string" ? type : type?.type;
    return v != null && t === "json" ? JSON.parse(v) : v;
  }
  async put(key: string, value: string) {
    this.store.set(key, value);
  }
  async delete(key: string) {
    this.store.delete(key);
  }
  async list(opts: { prefix?: string } = {}) {
    const keys = [...this.store.keys()].filter((k) => k.startsWith(opts.prefix ?? "")).map((name) => ({ name }));
    return { keys, list_complete: true };
  }
}

type Recorded = Record<string, { status: number; type: string; body: string }>;
const recorded: Recorded = existsSync(NET) ? JSON.parse(readFileSync(NET, "utf8")) : {};
/** The real network fetch, for scripts that compare with production. */
export const realFetch = globalThis.fetch;
let dirty = false;

/** Upstream HTTP, replayed (or recorded with RECORD=1). Keyed by method + URL. */
async function replayFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const req = new Request(input, init);
  const key = `${req.method} ${req.url}`;
  let hit = recorded[key];
  if (!hit && process.env.RECORD === "1") {
    const res = await realFetch(req.url, { method: req.method, headers: req.headers });
    hit = recorded[key] = { status: res.status, type: res.headers.get("content-type") ?? "", body: await res.text() };
    dirty = true;
  }
  if (!hit) return new Response("unrecorded upstream in test: " + key, { status: 503 });
  return new Response(hit.body, { status: hit.status, headers: { "content-type": hit.type } });
}

/** Save newly recorded upstream answers (RECORD=1 only). */
export function saveRecordings(): void {
  if (dirty) writeFileSync(NET, JSON.stringify(recorded, null, 0));
}

export interface TestWorker {
  env: Env;
  get(path: string, init?: RequestInit): Promise<Response>;
}

/** A fresh worker environment seeded from the fixtures. */
export function testWorker(extra: Partial<Env> = {}): TestWorker {
  pinClock();
  const r2 = new MemR2();
  for (const k of SEEDED) r2.store.set(`data/${k}.json`, readFileSync(new URL(`${k}.json`, FIX), "utf8"));
  const env = {
    OAQ_KV: new MemKV(),
    OAQ_R2: r2,
    METRICS: testD1(),
    EVENTS: { writeDataPoint() {} },
    OAQ_API_KEY: "test",
    OAQ_BROKER_URL: "https://broker.invalid",
    OAQ_BASE_URL: "https://oaq.invalid",
    ADMIN_KEY: "test-admin",
    ...extra,
  } as unknown as Env;
  (globalThis as { caches?: unknown }).caches = {
    default: { match: async () => undefined, put: async () => {}, delete: async () => false },
    open: async () => ({ match: async () => undefined, put: async () => {} }),
  };
  globalThis.fetch = replayFetch as typeof fetch;
  return {
    env,
    async get(path, init) {
      const waits: Promise<unknown>[] = [];
      const ctx = { waitUntil: (p: Promise<unknown>) => waits.push(p), passThroughOnException() {} };
      const res = await worker.fetch(
        new Request(`https://mugilu.live${path}`, init),
        env,
        ctx as unknown as ExecutionContext,
      );
      await Promise.allSettled(waits);
      return res;
    },
  };
}
