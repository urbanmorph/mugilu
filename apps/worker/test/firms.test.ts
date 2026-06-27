import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFirmsCsv, fireRiskAt } from "../src/firms";

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

test("parseFirmsCsv: empty or header-only input → []", () => {
  assert.deepEqual(parseFirmsCsv(""), []);
  assert.deepEqual(parseFirmsCsv("latitude,longitude,frp"), []);
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
