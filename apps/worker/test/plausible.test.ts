import { test } from "node:test";
import assert from "node:assert/strict";
import { isPlausible } from "../src/plausible";
import { pickStation } from "../src/conditions";
import { worstAirStation } from "../src/highlights";
import { computeAqi, aqiBand } from "../src/aqi";
import type { NormalizedStation } from "../src/types";

// 0.01° of latitude ≈ 1.1 km; all stations sit on lon 77.
function st(
  id: string,
  provider: NormalizedStation["provider"],
  lat: number,
  pollutants: NormalizedStation["pollutants"],
): NormalizedStation {
  const aqi = computeAqi(pollutants);
  return {
    id,
    raw_id: id,
    provider,
    name: id,
    city: id,
    state: "",
    lat,
    lon: 77,
    pollutants,
    aqi,
    band: aqiBand(aqi),
    ts: null,
  };
}
const town = [
  st("c1", "cpcb", 12.02, { pm25: 40, so2: 10 }),
  st("c2", "cpcb", 12.03, { pm25: 50, so2: 15 }),
  st("c3", "cpcb", 12.04, { pm25: 45, so2: 20 }),
];

test("isPlausible: CPCB is the reference and is never rejected", () => {
  assert.equal(isPlausible(st("c", "cpcb", 12, { pm25: 0.5 }), town), true);
});

test("isPlausible: a sensor stuck near zero fails the PM2.5 floor, even with no neighbours", () => {
  assert.equal(isPlausible(st("a", "airview", 30, { pm25: 0.57 }), []), false);
});

test("isPlausible: far below or far above the neighbours fails; within the band passes", () => {
  assert.equal(isPlausible(st("lo", "airview", 12, { pm25: 8 }), town), false);
  assert.equal(isPlausible(st("hi", "airview", 12, { pm25: 820 }), town), false);
  assert.equal(isPlausible(st("ok", "airview", 12, { pm25: 70 }), town), true);
});

test("isPlausible: a gas spike fails only when it would raise the alarm", () => {
  assert.equal(isPlausible(st("so2", "aurassure", 12, { pm25: 40, so2: 2720 }), town), false);
  // 5x the median SO2 but still "good" on the AQI scale: left alone.
  assert.equal(isPlausible(st("so2ok", "aurassure", 12, { pm25: 40, so2: 75 }), town), true);
});

test("isPlausible: CPCB neighbours set the baseline, so a high-running sensor cluster cannot vouch for itself", () => {
  const cluster = [12.011, 12.012, 12.013].map((lat, i) => st(`s${i}`, "airview", lat, { pm25: 90 }));
  assert.equal(isPlausible(st("v", "airview", 12, { pm25: 260 }), [...cluster, ...town]), false);
  assert.equal(isPlausible(st("v", "airview", 12, { pm25: 260 }), cluster), true);
});

test("isPlausible: too few neighbours to judge leaves the reading alone", () => {
  assert.equal(isPlausible(st("x", "airview", 12, { pm25: 820 }), town.slice(0, 2)), true);
  // ...except in strict mode, where an unchecked sensor fails (CPCB still passes).
  assert.equal(isPlausible(st("x", "airview", 12, { pm25: 820 }), town.slice(0, 2), true), false);
  assert.equal(isPlausible(st("c", "cpcb", 30, { pm25: 300 }), [], true), true);
});

test("pickStation: a stuck nearest sensor is passed over for the next plausible station", () => {
  const stuck = st("stuck", "airview", 12.001, { pm25: 0.6 });
  const next = st("next", "airview", 12.005, { pm25: 45 });
  assert.equal(pickStation([stuck, next], 12, 77)?.id, "next");
});

test("worstAirStation: a spiking or isolated sensor cannot headline the country", () => {
  const spike = st("spike", "airview", 12.01, { pm25: 820 });
  const isolated = st("isolated", "airview", 30, { pm25: 250 });
  assert.equal(worstAirStation([spike, isolated, ...town])?.name, "c2");
});

test("worstAirStation: names the monitor as well as its city, so one junction does not read as the whole city", () => {
  const silk = { ...st("silk", "cpcb", 12.917, { pm10: 642 }), name: "Silk Board", city: "Bengaluru" };
  const w = worstAirStation([silk, ...town])!;
  assert.equal(w.name, "Bengaluru");
  assert.equal(w.station, "Silk Board");
  // No city: the monitor's own name is the place, with no repeat.
  assert.equal(worstAirStation(town)?.station, undefined);
});
