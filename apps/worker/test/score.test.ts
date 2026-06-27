import { test } from "node:test";
import assert from "node:assert/strict";
import { ambientRisk } from "../src/score";
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
