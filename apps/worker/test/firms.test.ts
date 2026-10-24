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
