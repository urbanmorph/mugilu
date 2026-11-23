import { test } from "node:test";
import assert from "node:assert/strict";
import { renderConditionsPage } from "../src/pages/place";
import type { Conditions } from "../src/types";

// The place page says its readings in the words people search (supporting-docs/
// READING_SENTENCES_SPEC.md, step 2): the title and description from the facts, the search
// phrase under the place name, a two-sentence answer, a heading and a sentence on each
// reading, the official warnings always, and the questions people ask.

function conditions(o: Partial<Conditions> = {}): Conditions {
  return {
    location: { lat: 13.2272, lon: 77.5741 },
    place: "Bengaluru Rural, Karnataka",
    as_of: "2026-11-22T04:16:05.966Z",
    air_as_of: "2026-11-22T03:15:00.000Z",
    air: {
      aqi: 351,
      band: "vpoor",
      pollutants: { pm25: 200 },
      yll: 17.8,
      station: { id: "airnet-12031", name: "Rajanukunte", city: "Bengaluru", distance_km: 6.79 },
      source: "airnet",
    },
    heat: { temp_c: 23.3, apparent_c: 25, humidity_pct: 68, wet_bulb_c: 19, wbgt_c: 24.8, source: "open-meteo" },
    rain: { precipitation_mm: 0, probability_pct: 0, source: "open-meteo" },
    uv: { index: 4.35, source: "open-meteo" },
    dust: { dust_ug_m3: 4, aod: 0.43, source: "open-meteo" },
    wind: { speed_kmh: 8.7, gust_kmh: 21.2, direction_deg: 96, source: "open-meteo" },
    visibility: { meters: 1100, source: "open-meteo" },
    smoke: { count: 3, frp_sum: 39.9, nearest_km: 69.4, radius_km: 100, source: "firms" },
    warnings: [],
    nearby_warnings: [],
    attribution: "Sources: Airnet (CSTEP) via OAQ, via mugilu",
    disclaimer: "Informational only.",
    ...o,
  };
}
const NAMED = "https://mugilu.live/c/bengaluru-rural";
const page = (c = conditions(), lang: "en" | "hi" | "kn" = "en") => renderConditionsPage(c, "everyone", NAMED, lang);
const text = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ");

test("place page: the title and description come from the facts, with the air's source", () => {
  const html = page();
  assert.equal(
    html.match(/<title>([^<]*)<\/title>/)![1],
    "Bengaluru Rural AQI today: 351 Very Poor and weather | mugilu",
  );
  assert.match(
    html.match(/<meta name="description" content="([^"]*)"/)![1],
    /^Bengaluru Rural AQI 351 \(Very Poor\) at 08:45 IST, measured by Airnet \(CSTEP\) at Rajanukunte\./,
  );
});

test("place page: the title uses the short name; a name two districts share keeps its state", () => {
  const title = (html: string) => html.match(/<title>([^<]*)<\/title>/)![1];
  const almora = conditions({
    place: "Almora, Uttarakhand",
    air: { ...conditions().air!, aqi: 111, band: "moderate" },
  });
  assert.equal(
    title(renderConditionsPage(almora, "everyone", "https://mugilu.live/c/almora")),
    "Almora AQI today: 111 Moderate, weather and IMD warnings | mugilu",
  );
  const aurangabad = conditions({
    place: "Aurangabad, Bihar",
    air: { ...conditions().air!, aqi: 111, band: "moderate" },
  });
  assert.match(
    title(renderConditionsPage(aurangabad, "everyone", "https://mugilu.live/c/aurangabad-bihar")),
    /^Aurangabad, Bihar AQI today: 111 Moderate/,
  );
});

test("place page: the search phrase sits in the headline, and a two-sentence answer under it", () => {
  const html = page();
  assert.match(
    html,
    /<h1 class="t-title loc"[^>]*>Bengaluru Rural, Karnataka<span class="h1sub">Air quality and weather now<\/span><\/h1>/,
  );
  assert.match(
    text(html),
    /In Bengaluru Rural now, the air quality is very poor, AQI 351\. It is 23°C, with no rain and no official warning\./,
  );
});

test("place page: each reading has a heading in searched words and its value in a sentence", () => {
  const html = page();
  // each reading's heading: the words people search, with the place
  assert.match(html, /<h2 class="lab">Temperature in Bengaluru Rural now<\/h2>/);
  assert.match(html, /<h2 class="lab">Wind in Bengaluru Rural now<\/h2>/);
  assert.match(html, /<h2 class="lab">Fog in Bengaluru Rural now<\/h2>/);
  assert.match(html, /<h2 class="lab">Is it raining in Bengaluru Rural\?<\/h2>/);
  assert.match(html, /<h2 class="lab">Bengaluru Rural AQI now<\/h2>/);
  const s = text(html);
  assert.match(s, /The Airnet \(CSTEP\) station Rajanukunte, 6\.8 km away, measured it at 08:45 IST\./);
  assert.match(s, /The wind speed is 9 km\/h, from the east\. Gusts reach 21 km\/h\./);
  assert.match(s, /The visibility is 1\.1 km\. There is no fog: IMD uses the word fog below 1 km\./);
});

test("place page: the official warnings always have their section, also when there is none", () => {
  const html = page();
  assert.match(html, /<h2 class="bar" id="warn">[\s\S]*?IMD and NDMA warnings for Bengaluru Rural/);
  assert.match(text(html), /No IMD or NDMA warning covers Bengaluru Rural now\./);
});

test("place page: questions people ask, answered from the facts; the persona one carries the disclaimer", () => {
  const html = page();
  assert.equal((html.match(/<dt>/g) ?? []).length, 5);
  const s = text(html);
  assert.match(s, /What is the AQI in Bengaluru Rural now\?/);
  assert.match(
    s,
    /Will it rain in Bengaluru Rural today\? There is no rain now\. mugilu shows the conditions now\. It does not forecast\./,
  );
  assert.match(
    s,
    /Can children play outside in Bengaluru Rural now\? The air is dangerous\. Today, keep outdoor play short and easy\. Informational only, not medical advice\./,
  );
});

test("place page: in Hindi and Kannada the new words are translated", () => {
  const hi = text(page(conditions(), "hi"));
  assert.match(hi, /बेंगलुरु|Bengaluru Rural में अभी वायु गुणवत्ता बहुत खराब है, AQI 351।/);
  assert.match(hi, /में हवा अभी/);
  assert.match(hi, /क्या .+ में बारिश हो रही है\?/);
  const kn = text(page(conditions(), "kn"));
  assert.match(kn, /ಬೆಂಗಳೂರು ಗ್ರಾಮಾಂತರ ಪ್ರದೇಶದಲ್ಲಿ ಈಗ ವಾಯು ಗುಣಮಟ್ಟ ತುಂಬಾ ಕೆಟ್ಟದಾಗಿದೆ, AQI 351\./); // its Kannada name
  for (const s of [hi, kn])
    for (const en of [
      /Air quality and weather now/,
      /warnings for/,
      /Wind in/,
      /Is it raining/,
      /What is the AQI/,
      /The air quality is/,
    ])
      assert.doesNotMatch(s, en);
});

test("place page: air modelled says why, never CPCB", () => {
  const s = text(
    page(
      conditions({
        air: {
          aqi: 111,
          band: "moderate",
          pollutants: {},
          yll: 1.9,
          station: null,
          source: "open-meteo",
          modelled: true,
        },
      }),
    ),
  );
  assert.match(s, /Open-Meteo models this value\. No air station is within 50 km\./);
});
