import { test } from "node:test";
import assert from "node:assert/strict";
import { ambientRisk, ambientMeaning } from "../src/score";
import type { Conditions } from "../src/types";

function cond(partial: Partial<Conditions>): Conditions {
  return {
    location: { lat: 0, lon: 0 },
    as_of: "now",
    air: null,
    heat: null,
    rain: null,
    uv: null,
    dust: null,
    attribution: "",
    disclaimer: "",
    ...partial,
  };
}

test("ambientRisk: worst hazard drives the band, and is named", () => {
  // Clean air, but severe heat (wet-bulb 31) → overall severe, driven by Heat.
  const r = ambientRisk(
    cond({
      air: { aqi: 30, band: "good", pollutants: {}, yll: null, station: { id: "x", name: "x", city: "x", distance_km: 1 }, source: "cpcb" },
      heat: { wet_bulb_c: 31, apparent_c: 42, source: "om" },
    }),
    "everyone",
  );
  assert.equal(r.band, "severe");
  assert.equal(r.driver, "Heat");
  assert.ok(r.score >= 90);
});

test("ambientRisk: never air-biased — heat can beat moderate air", () => {
  const r = ambientRisk(
    cond({
      air: { aqi: 150, band: "moderate", pollutants: {}, yll: null, station: { id: "x", name: "x", city: "x", distance_km: 1 }, source: "cpcb" },
      heat: { apparent_c: 46, source: "om" }, // severe heat
    }),
    "everyone",
  );
  assert.equal(r.driver, "Heat");
  assert.equal(r.band, "severe");
});

test("ambientRisk: persona amplifies the hazards you're sensitive to", () => {
  const base = cond({
    air: { aqi: 180, band: "poor", pollutants: {}, yll: null, station: { id: "x", name: "x", city: "x", distance_km: 1 }, source: "cpcb" },
  }); // air at level "high" (2)
  const everyone = ambientRisk(base, "everyone");
  const asthma = ambientRisk(base, "asthma");
  assert.equal(everyone.band, "high");
  assert.equal(asthma.band, "severe"); // asthma bumps air high → severe
});

test("ambientRisk: an official warning is a hazard of its own", () => {
  const r = ambientRisk(
    cond({
      warnings: [{ event: "Cyclone", severity: "Warning", color: "red", certainty: "Observed", area: "coast", issuer: "IMD", until: "", identifier: "1", headline: "" }],
    }),
    "everyone",
  );
  assert.equal(r.band, "severe");
  assert.equal(r.driver, "Warning");
});

test("ambientRisk: no data → low, with empty hazard list", () => {
  const r = ambientRisk(cond({}), "everyone");
  assert.equal(r.band, "low");
  assert.equal(r.hazards.length, 0);
});

test("ambientRisk: very-high UV is only moderate for everyone (not over-weighted)", () => {
  const r = ambientRisk(cond({ uv: { index: 9, source: "om" } }), "everyone");
  assert.equal(r.band, "moderate");
  assert.equal(r.driver, "UV");
  // ...but escalates for the sun-exposed
  assert.equal(ambientRisk(cond({ uv: { index: 9, source: "om" } }), "outdoor").band, "high");
});

test("ambientRisk: smoke bands benchmarked to real India fire density", () => {
  const smoke = (count: number, frp_sum: number) =>
    ambientRisk(cond({ smoke: { count, frp_sum, nearest_km: 10, radius_km: 100, source: "firms" } }), "everyone");
  assert.equal(smoke(90, 460).band, "severe"); // peak Punjab/forest belt
  assert.equal(smoke(90, 460).driver, "Smoke");
  assert.equal(smoke(44, 237).band, "high"); // shoulder-season belt
  assert.equal(smoke(9, 22).band, "moderate"); // a handful of fires near a metro
  assert.equal(smoke(2, 5).hazards.length, 0); // 2 distant fires → negligible, not a hazard
});

test("ambientMeaning: a plain sentence that explains the band", () => {
  assert.match(ambientMeaning(ambientRisk(cond({}), "everyone")), /good/i);
  assert.match(
    ambientMeaning(ambientRisk(cond({ heat: { apparent_c: 47, source: "om" } }), "everyone")),
    /heat/i,
  );
});
