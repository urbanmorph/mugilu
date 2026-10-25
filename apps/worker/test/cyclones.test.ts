import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { basinOf, collectCyclones, compass, jtwcProducts, parseJtwcText } from "../src/cyclones";
import { CYCLONES_KEY, loadCyclones } from "../src/snapshot";
import { testD1 } from "./d1";

const fx = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");
const RSS = fx("jtwc.rss");
const TCFA = fx("jtwc-io9826web.txt"); // Invest 98B, Bay of Bengal, 25 Oct 2026
const WARNING = fx("jtwc-wp3026web.txt"); // Typhoon 30W (In-fa): the warning format, any basin

test("jtwcProducts: the North Indian Ocean texts in the feed, nothing else", () => {
  // The feed lists the Pacific storms too; only io* products are ours.
  assert.deepEqual(jtwcProducts(RSS), ["https://www.metoc.navy.mil/jtwc/products/io9826web.txt"]);
  assert.deepEqual(jtwcProducts("<rss></rss>"), []);
});

test("parseJtwcText: a formation alert gives the centre and the way it moves", () => {
  const s = parseJtwcText(TCFA)!;
  assert.equal(s.kind, "alert");
  assert.equal(s.id, "98B");
  assert.equal(s.name, undefined);
  assert.deepEqual([s.lat, s.lon], [15.8, 90.9]);
  assert.equal(s.moving, "W");
  assert.deepEqual(s.track, []);
  assert.equal(s.issued, "251100Z");
});

test("parseJtwcText: a warning gives the centre, the name and the forecast track", () => {
  const s = parseJtwcText(WARNING)!;
  assert.equal(s.kind, "warning");
  assert.equal(s.id, "30W");
  assert.equal(s.name, "In-fa");
  assert.deepEqual([s.lat, s.lon], [12.8, 164.5]);
  assert.equal(s.moving, "NW"); // 330 degrees
  assert.equal(s.track.length, 8); // 12, 24, 36, 48, 60, 72, 96, 120 h
  assert.deepEqual(s.track[0], { lat: 13.7, lon: 163.6 });
  assert.deepEqual(s.track.at(-1), { lat: 18.5, lon: 145.0 });
});

test("parseJtwcText: south and west are negative; text that is not a product is null", () => {
  const s = parseJtwcText(TCFA.replace("NEAR 15.8N 90.9E", "NEAR 15.8S 90.9W"))!;
  assert.deepEqual([s.lat, s.lon], [-15.8, -90.9]);
  assert.equal(parseJtwcText("<html>Access Denied</html>"), null);
  assert.equal(parseJtwcText(""), null);
});

test("compass: degrees to the eight points", () => {
  assert.equal(compass(0), "N");
  assert.equal(compass(44), "NE");
  assert.equal(compass(270), "W");
  assert.equal(compass(330), "NW");
  assert.equal(compass(359), "N");
});

test("basinOf: the Arabian Sea west of the peninsula, the Bay of Bengal east of it, else none", () => {
  assert.equal(basinOf(15.8, 90.9), "bay");
  assert.equal(basinOf(12, 95), "bay"); // Andaman Sea counts with the Bay
  assert.equal(basinOf(15, 68), "arabian");
  assert.equal(basinOf(12.8, 164.5), null); // the Pacific
  assert.equal(basinOf(-12, 80), null); // the south Indian Ocean
});

function envWith() {
  const store = new Map<string, string>();
  const OAQ_R2 = {
    async put(k: string, v: string) {
      store.set(k, v);
    },
    async get(k: string) {
      const v = store.get(k);
      return v === undefined ? null : { json: async () => JSON.parse(v) };
    },
  };
  return { env: { OAQ_R2, METRICS: testD1() } as unknown as Parameters<typeof collectCyclones>[0], store };
}

test("collectCyclones: the feed's Indian Ocean systems, stored with their basin", async () => {
  const { env, store } = envWith();
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (u: string) =>
      new Response(String(u).endsWith(".rss") ? RSS : TCFA)) as unknown as typeof fetch;
    const snap = await collectCyclones(env);
    assert.equal(snap.systems.length, 1);
    assert.equal(snap.systems[0].basin, "bay");
    assert.ok(store.has(CYCLONES_KEY));
    assert.equal((await loadCyclones(env))?.systems[0].id, "98B");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("collectCyclones: a failed feed keeps the last snapshot and counts against JTWC", async () => {
  const { env, store } = envWith();
  store.set(CYCLONES_KEY, JSON.stringify({ generated_at: new Date().toISOString(), systems: [{ id: "98B" }] }));
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response("down", { status: 503 })) as unknown as typeof fetch;
    await assert.rejects(collectCyclones(env));
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.match(store.get(CYCLONES_KEY)!, /98B/);
  const rows = (
    await (env as unknown as { METRICS: ReturnType<typeof testD1> }).METRICS.prepare(
      "SELECT name, n FROM counters",
    ).all()
  ).results as { name: string; n: number }[];
  assert.ok(rows.some((r) => r.name === "err:upstream:jtwc" && r.n === 1));
});

test("loadCyclones: a snapshot older than 12 hours speaks for nothing", async () => {
  const { env, store } = envWith();
  const old = new Date(Date.now() - 13 * 3600_000).toISOString();
  store.set(CYCLONES_KEY, JSON.stringify({ generated_at: old, systems: [{ id: "98B" }] }));
  assert.equal(await loadCyclones(env), null);
});
