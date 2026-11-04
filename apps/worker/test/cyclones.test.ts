import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { basinOf, collectCyclones, compass, issuedAt, jtwcProducts, parseJtwcText } from "../src/cyclones";
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
    const snap = await collectCyclones(env, new Date("2026-10-25T12:00:00Z"));
    assert.equal(snap.systems.length, 1);
    assert.equal(snap.systems[0].basin, "bay");
    assert.equal(snap.systems[0].at, "2026-10-25T11:00:00.000Z"); // when JTWC placed it
    assert.ok(store.has(CYCLONES_KEY));
    assert.equal(JSON.parse(store.get(CYCLONES_KEY)!).systems[0].id, "98B");
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

test("parseJtwcText: a final warning is marked final", () => {
  assert.equal(parseJtwcText(WARNING)!.final, undefined);
  const last = WARNING.replace(
    "REMARKS:",
    "REMARKS:\nTHIS IS THE FINAL WARNING ON THIS SYSTEM BY THE JOINT TYPHOON WRNCEN PEARL HARBOR HI.",
  );
  assert.equal(parseJtwcText(last)!.final, true);
});

test("issuedAt: JTWC's DDHHMMZ as a time, in the month it belongs to", () => {
  assert.equal(issuedAt("030900Z", new Date("2026-11-04T08:05:00Z")), "2026-11-03T09:00:00.000Z");
  // Read on 1 November, the 31st is October's.
  assert.equal(issuedAt("310600Z", new Date("2026-11-01T02:00:00Z")), "2026-10-31T06:00:00.000Z");
  // Read on 1 January, the 31st is last year's December.
  assert.equal(issuedAt("311800Z", new Date("2027-01-01T01:00:00Z")), "2026-12-31T18:00:00.000Z");
});

/** collectCyclones over one product text, at `now`. */
async function collectOne(text: string, now: Date) {
  const { env } = envWith();
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (u: string) =>
      new Response(String(u).endsWith(".rss") ? RSS : text)) as unknown as typeof fetch;
    return await collectCyclones(env, now);
  } finally {
    globalThis.fetch = realFetch;
  }
}

// The Pacific warning moved into the Bay of Bengal, so it counts as ours.
const BAY_WARNING = WARNING.replace(/(\d{6}Z\s+---\s+(?:NEAR\s+)?)[\d.]+N\s+[\d.]+E/, (_, at) => `${at}15.8N 80.2E`);

test("collectCyclones: a final warning is not shown (the system has gone or weakened)", async () => {
  const at = new Date("2026-10-25T16:00:00Z");
  assert.equal((await collectOne(BAY_WARNING, at)).systems.length, 1);
  const last = BAY_WARNING.replace("REMARKS:", "REMARKS:\nTHIS IS THE FINAL WARNING ON THIS SYSTEM.");
  assert.equal((await collectOne(last, at)).systems.length, 0);
});

test("collectCyclones: a warning left in the feed past 12 hours, or an alert past 24, is not shown", async () => {
  // The warning was issued 25th 15:00Z, the alert 25th 11:00Z.
  assert.equal((await collectOne(BAY_WARNING, new Date("2026-10-26T02:59:00Z"))).systems.length, 1);
  assert.equal((await collectOne(BAY_WARNING, new Date("2026-10-26T03:01:00Z"))).systems.length, 0);
  assert.equal((await collectOne(TCFA, new Date("2026-10-26T10:59:00Z"))).systems.length, 1);
  assert.equal((await collectOne(TCFA, new Date("2026-10-26T11:01:00Z"))).systems.length, 0);
});
