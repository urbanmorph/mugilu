import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFirmsCsv, fireRiskAt, collectFires } from "../src/firms";
import { testD1 } from "./d1";

const NOON = new Date("2026-06-27T12:00:00Z"); // the fixture's day

// VIIRS area CSV sample: two fires in Punjab (~30.12 N), one near Delhi.
const CSV = `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight
30.123,75.456,330.1,0.4,0.4,2026-06-27,0812,N,VIIRS,n,2.0NRT,295.1,12.3,D
30.130,75.460,360.0,0.4,0.4,2026-06-27,0812,N,VIIRS,h,2.0NRT,300.0,45.0,D
28.610,77.210,320.0,0.4,0.4,2026-06-27,0812,N,VIIRS,l,2.0NRT,290.0,3.0,D`;

test("parseFirmsCsv: header-addressed parse of lat/lon/frp/confidence/daynight", () => {
  const fires = parseFirmsCsv(CSV);
  assert.equal(fires.length, 3);
  assert.equal(fires[0].lat, 30.123);
  assert.equal(fires[0].frp, 12.3);
  assert.equal(fires[1].confidence, "h");
  assert.equal(fires[0].daynight, "D");
  assert.match(fires[0].acq, /2026-06-27 0812/);
});

test("parseFirmsCsv: header-only input → [] (no fires today)", () => {
  assert.deepEqual(parseFirmsCsv("latitude,longitude,frp"), []);
});

test("parseFirmsCsv: a body that isn't FIRMS CSV is an upstream error, not 'no fires'", () => {
  // FIRMS answers a bad key or outage with text and HTTP 200; that must not
  // overwrite the fires snapshot with zero detections.
  assert.throws(() => parseFirmsCsv(""));
  assert.throws(() => parseFirmsCsv("Invalid MAP_KEY."));
});

test("fireRiskAt: counts + sums FRP within radius and finds the nearest", () => {
  const fires = parseFirmsCsv(CSV);
  const r = fireRiskAt(fires, 30.125, 75.458, 50); // amid the two Punjab fires
  assert.equal(r.count, 2); // Delhi fire is ~250 km away, excluded
  assert.equal(r.frp_sum, 57.3); // 12.3 + 45.0
  assert.ok(r.nearest_km !== null && r.nearest_km < 5);
});

test("fireRiskAt: nothing within radius → zero, nearest null", () => {
  const r = fireRiskAt(parseFirmsCsv(CSV), 12.97, 77.59, 50); // Bengaluru, far
  assert.equal(r.count, 0);
  assert.equal(r.frp_sum, 0);
  assert.equal(r.nearest_km, null);
});

test("collectFires: a FIRMS call that fails or answers with something else is counted against FIRMS", async () => {
  const METRICS = testD1();
  const env = { METRICS, FIRMS_MAP_KEY: "k" } as unknown as Parameters<typeof collectFires>[0];
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response("down", { status: 500 })) as unknown as typeof fetch;
    await assert.rejects(collectFires(env));
    globalThis.fetch = (async () => new Response("Invalid MAP_KEY.")) as unknown as typeof fetch;
    await assert.rejects(collectFires(env));
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.deepEqual((await METRICS.prepare("SELECT name, n FROM counters").all()).results, [
    { name: "err:upstream:firms", n: 2 },
  ]);
});

// SNPP's NRT feed ended on 2 Nov 2026: FIRMS kept answering with a header and no rows, so
// mugilu wrote "no fires" for days. NOAA-21 is read first, NOAA-20 when it fails or is empty;
// never both at once, since the smoke bands were benchmarked on one satellite's detections.
test("collectFires: reads NOAA-21, falls back to NOAA-20 when it fails or is empty, never SNPP", async () => {
  const puts: Record<string, string> = {};
  const r2 = { put: async (k: string, v: string) => void (puts[k] = v) };
  const env = { METRICS: testD1(), FIRMS_MAP_KEY: "k", OAQ_R2: r2, SNAPSHOT: r2 } as unknown as Parameters<
    typeof collectFires
  >[0];
  const HEADER = CSV.split("\n")[0];
  const realFetch = globalThis.fetch;
  const asked: string[] = [];
  const answer = (by: Record<string, () => Response>) =>
    (async (u: string) => {
      const s = String(u).split("/")[7];
      asked.push(s);
      return by[s]();
    }) as unknown as typeof fetch;
  try {
    globalThis.fetch = answer({ VIIRS_NOAA21_NRT: () => new Response(CSV) });
    assert.deepEqual(await collectFires(env, NOON), { count: 3, source: "VIIRS_NOAA21_NRT", archived: true });
    assert.deepEqual(asked, ["VIIRS_NOAA21_NRT"]);

    asked.length = 0;
    globalThis.fetch = answer({
      VIIRS_NOAA21_NRT: () => new Response(HEADER),
      VIIRS_NOAA20_NRT: () => new Response(CSV),
    });
    assert.equal((await collectFires(env, NOON)).source, "VIIRS_NOAA20_NRT");
    assert.deepEqual(asked, ["VIIRS_NOAA21_NRT", "VIIRS_NOAA20_NRT"]);

    globalThis.fetch = answer({
      VIIRS_NOAA21_NRT: () => new Response("down", { status: 503 }),
      VIIRS_NOAA20_NRT: () => new Response(CSV),
    });
    assert.equal((await collectFires(env, NOON)).count, 3);

    // both empty: a genuine zero is written as zero (and logged, for ops to see)
    globalThis.fetch = answer({
      VIIRS_NOAA21_NRT: () => new Response(HEADER),
      VIIRS_NOAA20_NRT: () => new Response(HEADER),
    });
    assert.deepEqual(await collectFires(env, NOON), { count: 0, source: "VIIRS_NOAA21_NRT", archived: true });
  } finally {
    globalThis.fetch = realFetch;
  }
});

// FIRMS's day range counts UTC calendar days: "1" is today since 00:00 UTC, so from 05:30 to
// about 13:30 IST (the first satellite pass) mugilu read 0 fires every day. It now asks for
// two days and keeps the last 24 hours, and archives each UTC day's own detections.
test("collectFires: the last 24 hours, across UTC midnight, not just today's date", async () => {
  const puts: Record<string, string> = {};
  const r2 = { put: async (k: string, v: string) => void (puts[k] = v) };
  const env = { METRICS: testD1(), FIRMS_MAP_KEY: "k", OAQ_R2: r2 } as unknown as Parameters<typeof collectFires>[0];
  const HEADER = CSV.split("\n")[0];
  const row = (date: string, time: string, lat = 30.1) =>
    `${lat},75.4,330,0.4,0.4,${date},${time},N,VIIRS,n,2.0NRT,295,5.0,N`;
  const csv = [
    HEADER,
    row("2026-06-26", "2250"),
    row("2026-06-27", "0812"),
    row("2026-06-27", "2040"),
    row("2026-06-28", "0010"),
  ].join("\n");
  const asked: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (u: string) => (asked.push(String(u)), new Response(csv))) as unknown as typeof fetch;
  try {
    const r = await collectFires(env, new Date("2026-06-28T00:30:00Z"));
    assert.ok(asked[0].endsWith("/2"), asked[0]); // two UTC days asked for
    assert.equal(r.count, 3); // 27 Jun 08:12, 20:40 and 28 Jun 00:10; 26 Jun 22:50 is over 24 h old
    const snap = JSON.parse(puts["data/fires.json"]);
    assert.deepEqual(
      snap.fires.map((f: { acq: string }) => f.acq),
      ["2026-06-27 0812", "2026-06-27 2040", "2026-06-28 0010"],
    );
    // each UTC day keeps its own detections, so yesterday's archive is complete
    assert.deepEqual(JSON.parse(puts["archive/firms/2026-06-27.json"]).fires.length, 2);
    assert.deepEqual(JSON.parse(puts["archive/firms/2026-06-28.json"]).fires.length, 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});

// NRT data lags a satellite pass by hours: just after 24 h have passed since yesterday's big
// afternoon pass, today's has not arrived yet. Counting back from the newest detection, not
// from the clock, keeps one of each daily pass in the window instead of dropping both.
test("collectFires: the window ends at the newest detection, so a late pass does not empty it", async () => {
  const puts: Record<string, string> = {};
  const r2 = { put: async (k: string, v: string) => void (puts[k] = v) };
  const env = { METRICS: testD1(), FIRMS_MAP_KEY: "k", OAQ_R2: r2 } as unknown as Parameters<typeof collectFires>[0];
  const HEADER = CSV.split("\n")[0];
  const row = (date: string, time: string) => `30.1,75.4,330,0.4,0.4,${date},${time},N,VIIRS,n,2.0NRT,295,5.0,D`;
  // yesterday's afternoon pass (many fires) at 08:12, today's night pass at 06:01 (newest)
  const csv = [
    HEADER,
    ...Array(5).fill(row("2026-11-07", "0812")),
    row("2026-11-07", "2005"),
    row("2026-11-08", "601"),
  ].join("\n");
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(csv)) as unknown as typeof fetch;
  try {
    const r = await collectFires(env, new Date("2026-11-08T08:20:00Z")); // 24 h after 08:12 yesterday has passed
    assert.equal(r.count, 7); // yesterday's pass is kept until today's arrives
  } finally {
    globalThis.fetch = realFetch;
  }
});
