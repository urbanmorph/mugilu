import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ambientRisk,
  ambientMeaning,
  personaAlso,
  personaAction,
  PERSONAS,
  SENSITIVE,
  PERSONA_ACTION,
} from "../src/score";
import type { Conditions } from "../src/types";

test("personaAlso: surfaces an asthmatic's air trigger under a heat headline (option A)", () => {
  // Severe heat (the headline) + moderate air. Asthma is sensitive to air.
  const c = cond({
    air: {
      aqi: 130,
      band: "moderate",
      pollutants: {},
      yll: null,
      station: { id: "x", name: "x", city: "x", distance_km: 1 },
      source: "cpcb",
    },
    heat: { wbgt_c: 36, apparent_c: 44, source: "om" },
  });
  const everyone = ambientRisk(c, "everyone");
  assert.equal(everyone.driver, "Heat");
  assert.equal(personaAlso(everyone), null); // no callout for everyone
  const asthma = ambientRisk(c, "asthma");
  assert.equal(asthma.driver, "Heat"); // the killer hazard is NOT buried
  assert.match(personaAlso(asthma) ?? "", /air/i); // ...but the air trigger is surfaced
});

test("ambientRisk: sub-zero feels-like reads as a Cold driver, not Heat (directional thermal)", () => {
  const c = cond({ heat: { temp_c: 2, apparent_c: -1, humidity_pct: 70, source: "open-meteo" } });
  const r = ambientRisk(c, "everyone");
  assert.equal(r.driver, "Cold");
  assert.equal(r.band, "severe");
  assert.match(ambientMeaning(r), /cold/i);
});

test("ambientRisk: damaging gusts read as a Wind hazard", () => {
  const r = ambientRisk(cond({ wind: { gust_kmh: 95, speed_kmh: 60, source: "open-meteo" } }), "everyone");
  assert.equal(r.driver, "Wind");
  assert.equal(r.band, "severe");
});

test("ambientRisk: dense fog reads as a Fog hazard", () => {
  const r = ambientRisk(cond({ visibility: { meters: 150, source: "open-meteo" } }), "everyone");
  assert.equal(r.driver, "Fog");
  assert.equal(r.band, "severe");
});

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
      air: {
        aqi: 30,
        band: "good",
        pollutants: {},
        yll: null,
        station: { id: "x", name: "x", city: "x", distance_km: 1 },
        source: "cpcb",
      },
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
      air: {
        aqi: 150,
        band: "moderate",
        pollutants: {},
        yll: null,
        station: { id: "x", name: "x", city: "x", distance_km: 1 },
        source: "cpcb",
      },
      heat: { apparent_c: 46, source: "om" }, // severe heat
    }),
    "everyone",
  );
  assert.equal(r.driver, "Heat");
  assert.equal(r.band, "severe");
});

test("ambientRisk: persona amplifies the hazards you're sensitive to", () => {
  const base = cond({
    air: {
      aqi: 180,
      band: "poor",
      pollutants: {},
      yll: null,
      station: { id: "x", name: "x", city: "x", distance_km: 1 },
      source: "cpcb",
    },
  }); // air at level "high" (2)
  const everyone = ambientRisk(base, "everyone");
  const asthma = ambientRisk(base, "asthma");
  assert.equal(everyone.band, "high");
  assert.equal(asthma.band, "severe"); // asthma bumps air high → severe
});

test("ambientRisk: an official warning is a hazard of its own", () => {
  const r = ambientRisk(
    cond({
      warnings: [
        {
          event: "Cyclone",
          severity: "Warning",
          color: "red",
          certainty: "Observed",
          area: "coast",
          issuer: "IMD",
          until: "",
          identifier: "1",
          headline: "",
        },
      ],
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

test("ambientRisk: WBGT contributes to heat, calibrated so extreme=35 is severe", () => {
  // WBGT 35 (BoM extreme) reads severe even with a mild feels-like.
  assert.equal(ambientRisk(cond({ heat: { wbgt_c: 35, apparent_c: 34, source: "om" } }), "everyone").band, "severe");
  // WBGT 33 (very high) is high, not severe — it no longer over-escalates dry heat.
  const r = ambientRisk(cond({ heat: { wbgt_c: 33, apparent_c: 30, source: "om" } }), "everyone");
  assert.equal(r.band, "high");
  assert.equal(r.driver, "Heat");
});

test("ambientMeaning: a plain sentence that explains the band", () => {
  assert.match(ambientMeaning(ambientRisk(cond({}), "everyone")), /good/i);
  assert.match(ambientMeaning(ambientRisk(cond({ heat: { apparent_c: 47, source: "om" } }), "everyone")), /heat/i);
});

// ── Persona advice: the bump changes what to do, never what the air is called ──

const air = (band: "moderate" | "poor", aqi: number): Conditions["air"] => ({
  aqi,
  band,
  pollutants: {},
  yll: null,
  station: { id: "x", name: "x", city: "x", distance_km: 1 },
  source: "cpcb",
});

test("ambientMeaning: a persona bump keeps the CPCB description (moderate air is not called poor)", () => {
  const r = ambientRisk(cond({ air: air("moderate", 150) }), "asthma");
  assert.equal(r.band, "high"); // bumped for asthma...
  assert.equal(ambientMeaning(r), ambientMeaning(ambientRisk(cond({ air: air("moderate", 150) }), "everyone")));
  assert.doesNotMatch(ambientMeaning(r), /poor/i); // ...but still described as CPCB moderate
});

test("personaAction: tells the persona what to do about their own trigger", () => {
  const asthma = ambientRisk(cond({ air: air("moderate", 150) }), "asthma");
  assert.match(personaAction(asthma) ?? "", /exercise outdoors/i);
  const heart = ambientRisk(cond({ air: air("poor", 250) }), "heart");
  assert.match(personaAction(heart) ?? "", /exertion/i);
});

test("personaAction: none for everyone, none when the driver is not the persona's trigger", () => {
  assert.equal(personaAction(ambientRisk(cond({ air: air("poor", 250) }), "everyone")), null);
  // UV is not an asthma trigger.
  assert.equal(personaAction(ambientRisk(cond({ uv: { index: 11, source: "om" } }), "asthma")), null);
});

test("heat advice: older adults are not told to just go indoors (hot homes kill too)", () => {
  const r = ambientRisk(cond({ heat: { apparent_c: 41, source: "om" } }), "elderly");
  assert.equal(r.driver, "Heat");
  const said = `${ambientMeaning(r)} ${personaAction(r)}`;
  assert.doesNotMatch(said, /avoid being outdoors/i);
  assert.match(said, /check on you/i);
});

test("heat advice: even for everyone, dangerous heat points to somewhere cool, not just indoors", () => {
  const r = ambientRisk(cond({ heat: { apparent_c: 47, source: "om" } }), "everyone");
  assert.equal(r.band, "severe");
  assert.match(ambientMeaning(r), /somewhere cool/i);
});

test("ambientRisk: outdoor workers feel air and dust (prolonged exposure), children feel dust", () => {
  const moderateAir = cond({ air: air("moderate", 150) });
  assert.equal(ambientRisk(moderateAir, "outdoor").band, "high");
  const dusty = cond({ dust: { dust_ug_m3: 100, source: "om" } });
  assert.equal(ambientRisk(dusty, "outdoor").band, "high");
  assert.equal(ambientRisk(dusty, "child").band, "high");
  assert.equal(ambientRisk(dusty, "everyone").band, "moderate");
});

test("personaAction: every persona has an action for each hazard it is sensitive to", () => {
  for (const p of PERSONAS) for (const h of SENSITIVE[p]) assert.ok(PERSONA_ACTION[p]?.[h], `${p}/${h} has no action`);
});

test("personaAction: exposure steps only, never medical advice (no medication, symptoms or diagnosis)", () => {
  const medical = /inhaler|medicine|medication|dose|doctor|hospital|symptom|chest pain|breathless|treat|diagnos|N95/i;
  for (const p of PERSONAS)
    for (const [h, said] of Object.entries(PERSONA_ACTION[p])) assert.doesNotMatch(said ?? "", medical, `${p}/${h}`);
});
