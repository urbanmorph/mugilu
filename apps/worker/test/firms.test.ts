import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFirmsCsv, fireRiskAt, collectFires } from "../src/firms";
import { testD1 } from "./d1";

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
  const env = { METRICS: testD1(), FIRMS_MAP_KEY: "k", OAQ_R2: r2, SNAPSHOT: r2 } as unknown as Parameters<typeof collectFires>[0];
  const HEADER = CSV.split("\n")[0];
  const realFetch = globalThis.fetch;
  const asked: string[] = [];
  const answer = (by: Record<string, () => Response>) => (async (u: string) => {
    const s = String(u).split("/")[7];
    asked.push(s);
    return by[s]();
  }) as unknown as typeof fetch;
  try {
    globalThis.fetch = answer({ VIIRS_NOAA21_NRT: () => new Response(CSV) });
    assert.deepEqual(await collectFires(env), { count: 3, source: "VIIRS_NOAA21_NRT", archived: true });
    assert.deepEqual(asked, ["VIIRS_NOAA21_NRT"]);

    asked.length = 0;
    globalThis.fetch = answer({ VIIRS_NOAA21_NRT: () => new Response(HEADER), VIIRS_NOAA20_NRT: () => new Response(CSV) });
    assert.equal((await collectFires(env)).source, "VIIRS_NOAA20_NRT");
    assert.deepEqual(asked, ["VIIRS_NOAA21_NRT", "VIIRS_NOAA20_NRT"]);

    globalThis.fetch = answer({ VIIRS_NOAA21_NRT: () => new Response("down", { status: 503 }), VIIRS_NOAA20_NRT: () => new Response(CSV) });
    assert.equal((await collectFires(env)).count, 3);

    // both empty: a genuine zero is written as zero (and logged, for ops to see)
    globalThis.fetch = answer({ VIIRS_NOAA21_NRT: () => new Response(HEADER), VIIRS_NOAA20_NRT: () => new Response(HEADER) });
    assert.deepEqual(await collectFires(env), { count: 0, source: "VIIRS_NOAA21_NRT", archived: true });
  } finally {
    globalThis.fetch = realFetch;
  }
});
