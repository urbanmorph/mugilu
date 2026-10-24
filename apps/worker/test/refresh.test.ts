import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanStationName, carryForward, providerStations, snapshotHealthy } from "../src/refresh";
import type { NormalizedStation, Snapshot } from "../src/types";

test("cleanStationName with known city strips ', {city} …'", () => {
  assert.equal(cleanStationName("Ashok Vihar, Delhi - DPCC", "Delhi"), "Ashok Vihar");
  assert.equal(cleanStationName("FTI Kidwai Nagar, Kanpur - UPPCB", "Kanpur"), "FTI Kidwai Nagar");
  assert.equal(cleanStationName("Sadanand Nagar, Mehsana - Nexteng Enviro", "Mehsana"), "Sadanand Nagar");
  assert.equal(cleanStationName("Worli, Mumbai -MPCB", "Mumbai"), "Worli");
  assert.equal(cleanStationName("Polayathode, Kollam - Kerala PCB", "Kollam"), "Polayathode");
  assert.equal(cleanStationName("Bandhavgar Colony, Satna - Birla Cement", "Satna"), "Bandhavgar Colony");
});

test("cleanStationName is case-insensitive on city match", () => {
  assert.equal(cleanStationName("Place, delhi - something", "Delhi"), "Place");
});

test("cleanStationName preserves names without the pattern", () => {
  assert.equal(cleanStationName("Anand Vihar", "Delhi"), "Anand Vihar");
  assert.equal(cleanStationName("Silk Board", "Bengaluru"), "Silk Board");
  assert.equal(cleanStationName("Bandra Kurla Complex", "Mumbai"), "Bandra Kurla Complex");
});

test("cleanStationName preserves roman-numeral tails when city doesn't match", () => {
  assert.equal(cleanStationName("Knowledge Park - V", "Greater Noida"), "Knowledge Park - V");
  assert.equal(cleanStationName("Knowledge Park - III", "Greater Noida"), "Knowledge Park - III");
});

test("cleanStationName handles name-city mismatch via generic step", () => {
  // s.city = "New Delhi" but name embeds "Delhi" — city step can't match.
  assert.equal(cleanStationName("Mundka, Delhi - DPCC", "New Delhi"), "Mundka");
  assert.equal(cleanStationName("NSIT Dwarka, Delhi - CPCB", "New Delhi"), "NSIT Dwarka");
});

test("cleanStationName handles no-space dash (' -MPCB')", () => {
  assert.equal(cleanStationName("Worli, Mumbai -MPCB", "Mumbai"), "Worli");
});

test("cleanStationName handles multi-word agency tails", () => {
  assert.equal(cleanStationName("GIDC, Nandesari - Nandesari Ind. Association"), "GIDC");
  assert.equal(cleanStationName("Bandhavgar Colony, Satna - Birla Cement"), "Bandhavgar Colony");
  assert.equal(cleanStationName("Shasthri Nagar, Ratlam - IPCA Lab"), "Shasthri Nagar");
});

test("cleanStationName never returns empty", () => {
  // Pathological input that might strip everything.
  assert.equal(cleanStationName(", Delhi - DPCC", "Delhi"), ", Delhi - DPCC");
});

test("cleanStationName falls back to regex when city is missing", () => {
  assert.equal(cleanStationName("Ratandeep Housing Society, Solapur - MPCB"), "Ratandeep Housing Society");
  assert.equal(cleanStationName("Anand Vihar"), "Anand Vihar");
});

test("cleanStationName: a city with regex characters is matched literally, never throws", () => {
  assert.equal(cleanStationName("Sector 5, Navi Mumbai (CIDCO) - MPCB", "Navi Mumbai (CIDCO)"), "Sector 5");
  assert.doesNotThrow(() => cleanStationName("X, Foo (Bar", "Foo (Bar"));
  assert.doesNotThrow(() => cleanStationName("X, [Y", "[Y"));
});

const sta = (provider: string, id: string) => ({ id: `${provider}-${id}`, provider }) as unknown as NormalizedStation;
const prev = {
  generated_at: "t0",
  station_count: 3,
  providers: [],
  stations: [sta("cpcb", "1"), sta("airnet", "2"), sta("airnet", "3")],
} as unknown as Snapshot;

test("carryForward: a provider that failed this run keeps its last stations (they age out by ts)", () => {
  const out = carryForward([sta("cpcb", "9")], ["airnet"], prev).map((s) => s.id);
  assert.deepEqual(out, ["cpcb-9", "airnet-2", "airnet-3"]);
});

test("carryForward: nothing failed, nothing carried; no previous snapshot, nothing to carry", () => {
  assert.equal(carryForward([sta("cpcb", "9")], [], prev).length, 1);
  assert.equal(carryForward([], ["cpcb"], null).length, 0);
});

test("providerStations: an HTTP-200 body with no station list is a failure, not an empty provider", () => {
  assert.deepEqual(providerStations([{ id: 1 }]), [{ id: 1 }]);
  assert.deepEqual(providerStations({ stations: [{ id: 1 }] }), [{ id: 1 }]);
  assert.throws(() => providerStations({ error: "quota" }));
  assert.throws(() => providerStations({ stations: [] }));
  assert.throws(() => providerStations([]));
});

test("snapshotHealthy: an empty run, or one far below the snapshot it replaces, is unhealthy", () => {
  assert.equal(snapshotHealthy(0, 900), false);
  assert.equal(snapshotHealthy(0, undefined), false);
  assert.equal(snapshotHealthy(400, 900), false, "under half the previous run");
  assert.equal(snapshotHealthy(450, 900), true);
  assert.equal(snapshotHealthy(1200, 900), true);
  assert.equal(snapshotHealthy(5, undefined), true, "no previous snapshot to compare with");
});
