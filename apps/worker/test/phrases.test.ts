import { test } from "node:test";
import assert from "node:assert/strict";
import { facts as factsAt, STATION_MAX_KM, type Fact } from "../src/facts";
import {
  answerLine,
  conditionsText,
  factText,
  PHRASES,
  placeDescription,
  placeTitle,
  steProblems,
  warningsText,
} from "../src/phrases";
import type { Conditions } from "../src/types";
import { LANGS } from "../src/i18n";

// The reading-sentence system (supporting-docs/READING_SENTENCES_SPEC.md): facts from the
// conditions, each with how mugilu knows it, said by one phrasebook in every language.

const AT = "2026-11-22T04:16:05.966Z";
/** The facts on the reading's own day, so today's high still counts. */
const facts = (c: Conditions) => factsAt(c, new Date(AT));
function cond(o: Partial<Conditions> = {}): Conditions {
  return {
    location: { lat: 13.2272, lon: 77.5741 },
    place: "Bengaluru Rural, Karnataka",
    as_of: AT,
    air: {
      aqi: 351,
      band: "vpoor",
      pollutants: { pm25: 200 },
      yll: 17.8,
      station: { id: "airnet-12031", name: "Rajanukunte", city: "Bengaluru", distance_km: 6.79 },
      source: "airnet",
    },
    air_as_of: "2026-11-22T03:15:00.000Z",
    heat: { temp_c: 23.3, apparent_c: 25, humidity_pct: 68, wet_bulb_c: 19, wbgt_c: 24.8, source: "open-meteo" },
    heat_vs_normal: {
      today_max_c: 28,
      normal_max_c: 26,
      anomaly_c: 2,
      notable: false,
      date: "2026-11-22",
      period: "late November",
      baseline: "1991-2020 normals",
      source: "era5",
    } as Conditions["heat_vs_normal"],
    rain: { precipitation_mm: 0, probability_pct: 0, source: "open-meteo" },
    uv: { index: 4.35, source: "open-meteo" },
    dust: { dust_ug_m3: 4, aod: 0.43, source: "open-meteo" },
    wind: { speed_kmh: 8.7, gust_kmh: 21.2, direction_deg: 96, source: "open-meteo" },
    visibility: { meters: 15600, source: "open-meteo" },
    smoke: { count: 1, frp_sum: 4.6, nearest_km: 55.3, radius_km: 100, source: "firms" },
    warnings: [],
    nearby_warnings: [],
    attribution: "Sources: Airnet (CSTEP) via OAQ, via mugilu",
    disclaimer: "Informational only.",
    ...o,
  };
}
const MODELLED = cond({
  air: { aqi: 111, band: "moderate", pollutants: {}, yll: 1.9, station: null, source: "open-meteo", modelled: true },
  air_as_of: undefined,
  visibility: { meters: 600, source: "open-meteo" },
  smoke: { count: 3, frp_sum: 39.9, nearest_km: 69.4, radius_km: 100, source: "firms" },
});
const fact = <K extends Fact["key"]>(fs: Fact[], key: K) => fs.find((f) => f.key === key) as Extract<Fact, { key: K }>;

test("facts: air from a station names the network, the station, its distance and the reading time", () => {
  const air = fact(facts(cond()), "air");
  assert.deepEqual(air.source, {
    kind: "measured",
    network: "airnet",
    station: "Rajanukunte",
    km: 6.79,
    at: "2026-11-22T03:15:00.000Z",
  });
  assert.equal(air.level, 3);
});

test("facts: modelled air says why, with the radius from the code, never CPCB", () => {
  const air = fact(facts(MODELLED), "air");
  assert.deepEqual(air.source, {
    kind: "modelled",
    model: "open-meteo",
    reason: "no_station",
    radius_km: STATION_MAX_KM,
  });
  assert.equal(STATION_MAX_KM, 50);
});

test("facts: weather from the district grid is a fallback with its time; fires are seen by satellite; warnings are official", () => {
  const fs = facts(
    cond({
      weather_as_of: "2026-11-22T00:30:00.000Z",
      heat: { temp_c: 23, apparent_c: 25, source: "open-meteo", as_of: "2026-11-22T00:30:00.000Z" },
    }),
  );
  assert.deepEqual(fact(fs, "temp").source, { kind: "fallback", grid_at: "2026-11-22T00:30:00.000Z" });
  assert.equal(fact(fs, "smoke").source.kind, "satellite");
  assert.equal(fact(fs, "warnings").source.kind, "official");
});

test("facts: most important first, in the order of their level; a missing layer is not a fact", () => {
  const fs = facts(MODELLED);
  assert.deepEqual(
    fs.map((f) => f.key),
    ["air", "fog", "warnings", "temp", "rain", "wind", "smoke", "uv", "dust"], // fires: context, never a level
  );
  assert.equal(
    facts(cond({ uv: null })).some((f) => f.key === "uv"),
    false,
  );
});

test("factText: the reading, then how mugilu knows it, in short sentences", () => {
  const fs = facts(cond());
  assert.equal(
    factText(fact(fs, "air"), "en"),
    "The air quality is very poor, AQI 351. The Airnet (CSTEP) station Rajanukunte, 6.8 km away, measured it at 08:45 IST.",
  );
  assert.equal(
    factText(fact(facts(MODELLED), "air"), "en"),
    "The air quality is moderate, AQI 111. Open-Meteo models this value. No air station is within 50 km.",
  );
  assert.equal(
    factText(fact(fs, "temp"), "en"),
    "The temperature is 23°C. It feels like 25°C. The high today is 28°C, 2°C above normal for late November.",
  );
  assert.equal(factText(fact(fs, "wind"), "en"), "The wind speed is 9 km/h, from the east. Gusts reach 21 km/h.");
  assert.equal(factText(fact(fs, "rain"), "en"), "There is no rain now.");
  assert.equal(
    factText(fact(facts(MODELLED), "fog"), "en"),
    "The visibility is 600 m. This is fog: the visibility is below 1 km.",
  );
  assert.equal(
    factText(fact(fs, "smoke"), "en"),
    "A satellite saw 1 fire within 100 km in the last 24 hours. The nearest is 55 km away.",
  );
});

test("factText: Hindi and Kannada keep the station's own name and use the site's terms", () => {
  const air = fact(facts(cond()), "air");
  assert.equal(
    factText(air, "hi"),
    "वायु गुणवत्ता बहुत खराब है, AQI 351। Airnet (CSTEP) के Rajanukunte स्टेशन ने इसे 08:45 IST पर मापा। स्टेशन 6.8 km दूर है।",
  );
  assert.equal(
    factText(air, "kn"),
    "ವಾಯು ಗುಣಮಟ್ಟ ತುಂಬಾ ಕೆಟ್ಟದಾಗಿದೆ, AQI 351. Airnet (CSTEP) ಜಾಲದ Rajanukunte ನಿಲ್ದಾಣ ಇದನ್ನು 08:45 IST ಕ್ಕೆ ಅಳೆದಿದೆ. ನಿಲ್ದಾಣ 6.8 km ದೂರದಲ್ಲಿದೆ.",
  );
});

test("place names take no ending: Hindi uses a postposition, Kannada the word for area", () => {
  const fs = facts(cond());
  assert.match(answerLine(fs, "बेंगलुरु ग्रामीण", "hi"), /^बेंगलुरु ग्रामीण में अभी/);
  assert.match(answerLine(fs, "ಬೆಂಗಳೂರು ಗ್ರಾಮಾಂತರ", "kn"), /^ಬೆಂಗಳೂರು ಗ್ರಾಮಾಂತರ ಪ್ರದೇಶದಲ್ಲಿ ಈಗ/);
  assert.match(warningsText(fact(fs, "warnings"), "ಅಲ್ಮೋರಾ", "kn"), /ಅಲ್ಮೋರಾ ಪ್ರದೇಶಕ್ಕೆ/);
});

test("warningsText: none, one over the spot, or one only nearby", () => {
  const w = {
    event: "Rain",
    severity: "Severe",
    color: "orange",
    certainty: "Likely",
    area: "Almora",
    issuer: "controlroom@ndma.gov.in (IMD Dehradun)",
    until: "Sun Nov 23, 08:30",
    identifier: "1",
    headline: "Heavy rain likely",
  };
  const none = fact(facts(cond()), "warnings");
  assert.equal(warningsText(none, "Almora", "en"), "No IMD or NDMA warning covers Almora now.");
  const here = fact(facts(cond({ warnings: [w] })), "warnings");
  assert.equal(warningsText(here, "Almora", "en"), "IMD Dehradun issued an orange warning for Almora: rain, snow.");
  assert.equal(here.level, 2);
  const near = fact(facts(cond({ nearby_warnings: [{ ...w, covers: false }] })), "warnings");
  assert.equal(
    warningsText(near, "Almora", "en"),
    "No IMD or NDMA warning covers Almora now. 1 warning covers an area near Almora.",
  );
});

test("placeTitle: the place and the AQI first, shortened to fit 60 characters; hi/kn add the Latin name", () => {
  assert.equal(
    placeTitle(facts(MODELLED), "Almora", "Almora", "en"),
    "Almora AQI today: 111 Moderate, weather and IMD warnings | mugilu",
  );
  const long = placeTitle(facts(cond()), "Bengaluru Rural", "Bengaluru Rural", "en");
  assert.equal(long, "Bengaluru Rural AQI today: 351 Very Poor and weather | mugilu");
  assert.ok(long.replace(" | mugilu", "").length <= 60);
  assert.equal(
    placeTitle(facts(MODELLED), "अल्मोड़ा", "Almora", "hi"),
    "अल्मोड़ा AQI आज: 111 मध्यम, मौसम और चेतावनी | Almora | mugilu",
  );
});

test("placeDescription: the air with its source first, the update time last, 160 characters at most", () => {
  const d = placeDescription(facts(MODELLED), "Almora", AT, "en");
  assert.match(d, /^Almora AQI 111 \(Moderate\), modelled: no air station within 50 km\./);
  assert.match(d, /Updated 09:46 IST\.$/);
  for (const lang of LANGS)
    for (const c of [cond(), MODELLED])
      assert.ok(placeDescription(facts(c), "Bengaluru Rural", AT, lang).length <= 160);
});

test("every template exists in English, Hindi and Kannada, with the same slots", () => {
  for (const [id, byLang] of Object.entries(PHRASES)) {
    const slots = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const en = [byLang.en].flat();
    for (const lang of LANGS) {
      const v = [byLang[lang]].flat();
      assert.ok(v.length && v.every(Boolean), `${id} ${lang}`);
      assert.deepEqual(slots(v[0]), slots(en[0]), `${id} ${lang} slots`);
    }
  }
});

test("no template types a radius: radii come from the code", () => {
  for (const [id, byLang] of Object.entries(PHRASES))
    for (const s of Object.values(byLang).flat()) assert.doesNotMatch(s, /\b(20|25|50|100) ?km\b/, id);
});

test("writing rules: every English sentence the system can make passes; no medical words in any language", () => {
  const medical = /inhaler|medicine|medication|dose|doctor|hospital|symptom|chest pain|breathless|treat|diagnos|N95/i;
  const w = {
    event: "Rain",
    severity: "Severe",
    color: "red",
    certainty: "Likely",
    area: "X",
    issuer: "IMD Pune",
    until: "",
    identifier: "1",
    headline: "h",
  };
  for (const c of [
    cond(),
    MODELLED,
    cond({ warnings: [w] }),
    cond({ rain: { precipitation_mm: 2.4, source: "open-meteo" } }),
  ]) {
    const fs = facts(c);
    const en = [
      ...fs.map((f) => factText(f, "en")),
      answerLine(fs, "Bengaluru Rural", "en"),
      warningsText(fact(fs, "warnings"), "Pune", "en"),
    ];
    assert.deepEqual(steProblems(en.join(" ")), []);
    for (const lang of LANGS) for (const f of fs) assert.doesNotMatch(factText(f, lang), medical);
  }
});

test("Hindi and Kannada sentences carry no English words beyond names, units and agencies", () => {
  const allowed =
    /\b(AQI|UV|IST|km|mm|Open-Meteo|IMD|NDMA|SACHET|CPCB|Airnet|CSTEP|Aurassure|Google|AirView\+?|Rajanukunte|Dehradun|mugilu)\b/g;
  for (const c of [cond(), MODELLED]) {
    const fs = facts(c);
    for (const lang of ["hi", "kn"] as const)
      for (const s of [...fs.map((f) => factText(f, lang)), answerLine(fs, "X", lang)])
        assert.doesNotMatch(s.replace(allowed, ""), /[A-Za-z]{2,}/, `${lang}: ${s}`);
  }
});

// Spec step 5: the API and MCP carry the page's own sentences (`text`), so agents quote the
// same words the page says, in the language asked for.
test("conditionsText: the answer line and each reading's sentence, the same words as the page", () => {
  const c = cond();
  const en = conditionsText(c, "en");
  assert.equal(en.lang, "en");
  assert.equal(en.answer, answerLine(facts(c), "Bengaluru Rural", "en"));
  assert.equal(en.readings.air, factText(fact(facts(c), "air"), "en"));
  assert.match(en.readings.warnings, /Bengaluru Rural/);
  assert.deepEqual(Object.keys(en.readings).sort(), [
    "air",
    "dust",
    "fog",
    "rain",
    "smoke",
    "temp",
    "uv",
    "warnings",
    "wind",
  ]);
  const kn = conditionsText(c, "kn");
  assert.equal(kn.lang, "kn");
  assert.notEqual(kn.answer, en.answer);
  assert.match(kn.answer, /ಬೆಂಗಳೂರು/, "the native name, as the Kannada page says it");
});
