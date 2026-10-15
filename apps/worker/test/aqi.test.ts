// Run with: pnpm -C apps/worker test
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeAqi, aqiBand, subIndex } from "../src/aqi";

// Reference values from CPCB breakpoints
// https://cpcb.nic.in/National-Air-Quality-Index/

test("PM2.5 30 → sub-index 50 (Good upper bound)", () => {
  assert.equal(computeAqi({ pm25: 30 }), 50);
});

test("PM2.5 60 → sub-index 100 (Satisfactory upper bound)", () => {
  assert.equal(computeAqi({ pm25: 60 }), 100);
});

test("PM2.5 90 → sub-index 200 (Moderate upper bound)", () => {
  assert.equal(computeAqi({ pm25: 90 }), 200);
});

test("PM2.5 120 → sub-index 300 (Poor upper bound)", () => {
  assert.equal(computeAqi({ pm25: 120 }), 300);
});

test("PM2.5 250 → sub-index 400 (Very Poor upper bound)", () => {
  assert.equal(computeAqi({ pm25: 250 }), 400);
});

test("PM2.5 500 → sub-index 500 (Severe cap)", () => {
  assert.equal(computeAqi({ pm25: 500 }), 500);
});

test("PM2.5 above top breakpoint saturates at 500", () => {
  assert.equal(computeAqi({ pm25: 750 }), 500);
});

test("PM10 250 → 200", () => {
  assert.equal(computeAqi({ pm10: 250 }), 200);
});

test("CO 2.0 mg/m³ → 100", () => {
  assert.equal(computeAqi({ co: 2.0 }), 100);
});

test("Overall AQI = max of sub-indices", () => {
  // PM2.5 = 45 → ~75, PM10 = 250 → 200, NO2 = 10 → ~12 → max = 200
  assert.equal(computeAqi({ pm25: 45, pm10: 250, no2: 10 }), 200);
});

test("No pollutants → null", () => {
  assert.equal(computeAqi({}), null);
});

test("Negative / non-finite values ignored", () => {
  assert.equal(computeAqi({ pm25: -1, pm10: 100 }), 100);
  assert.equal(computeAqi({ pm25: NaN }), null);
});

test("aqiBand classification", () => {
  assert.equal(aqiBand(0), "good");
  assert.equal(aqiBand(50), "good");
  assert.equal(aqiBand(51), "satisfactory");
  assert.equal(aqiBand(100), "satisfactory");
  assert.equal(aqiBand(101), "moderate");
  assert.equal(aqiBand(200), "moderate");
  assert.equal(aqiBand(201), "poor");
  assert.equal(aqiBand(300), "poor");
  assert.equal(aqiBand(301), "vpoor");
  assert.equal(aqiBand(400), "vpoor");
  assert.equal(aqiBand(401), "severe");
  assert.equal(aqiBand(500), "severe");
  assert.equal(aqiBand(null), "unknown");
});

// CPCB publishes integer-edged ranges (0-30, 31-60, ...). Real readings are
// fractional, so a value in the gap (30.5) must still get a sub-index.
test("subIndex: fractional readings between CPCB's integer ranges still get a sub-index", () => {
  for (const [p, v] of [
    ["pm25", 30.5],
    ["pm25", 60.4],
    ["pm25", 250.5],
    ["pm10", 100.7],
    ["no2", 40.2],
    ["co", 1.05],
    ["o3", 168.5],
    ["nh3", 200.5],
  ] as const)
    assert.notEqual(subIndex(p, v), null, `${p} ${v}`);
  assert.ok(subIndex("pm25", 250.5)! >= 400); // severe edge, not dropped
});

test("computeAqi: a gap value is not dropped from the max (PM2.5 250.5 + PM10 100 is ~401, not 100)", () => {
  assert.ok(computeAqi({ pm25: 250.5, pm10: 100 })! >= 400);
});

test("subIndex: monotonic across every pollutant's whole range (no holes, no dips)", () => {
  for (const [p, top] of [
    ["pm25", 500],
    ["pm10", 600],
    ["no2", 600],
    ["so2", 2400],
    ["co", 50],
    ["o3", 1000],
    ["nh3", 2400],
  ] as const) {
    let prev = -1;
    for (let v = 0; v <= top; v += top / 5000) {
      const s = subIndex(p, v);
      assert.notEqual(s, null, `${p} ${v}`);
      assert.ok(s! >= prev, `${p} dips at ${v}`);
      prev = s!;
    }
  }
});
