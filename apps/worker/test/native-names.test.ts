import { test } from "node:test";
import assert from "node:assert/strict";
import { renderConditionsPage } from "../src/pages/place";
import { renderPlaces } from "../src/pages/places";
import { LIST_FILTER_JS } from "../src/ui/components";
import { localName, nativeNames, placeBySlug } from "../src/slugs";
import type { Conditions } from "../src/types";

// Hindi and Kannada pages name a place as its own people write it (supporting-docs/
// READING_SENTENCES_SPEC.md, step 4): Hindi in the Hindi-speaking states, Kannada in Karnataka,
// both for the major cities; the Latin name stays beside it, so both searches match.

function almora(o: Partial<Conditions> = {}): Conditions {
  return {
    location: { lat: 29.6908, lon: 79.504 },
    place: "Almora, Uttarakhand",
    as_of: "2026-11-22T04:16:05.966Z",
    air: { aqi: 111, band: "moderate", pollutants: {}, yll: 1.9, station: null, source: "open-meteo", modelled: true },
    heat: { temp_c: 16, apparent_c: 15, humidity_pct: 60, wet_bulb_c: 11, wbgt_c: 14, source: "open-meteo" },
    rain: { precipitation_mm: 0, probability_pct: 0, source: "open-meteo" },
    warnings: [],
    nearby_warnings: [],
    attribution: "Sources: Open-Meteo, via mugilu",
    disclaimer: "Informational only.",
    ...o,
  } as Conditions;
}
const URL_ALMORA = "https://mugilu.live/c/almora";
const text = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

test("localName: Hindi in a Hindi-speaking state, Kannada in Karnataka, both for a major city; else Latin", () => {
  assert.equal(localName(placeBySlug("almora")!, "hi"), "अल्मोड़ा");
  assert.equal(localName(placeBySlug("almora")!, "kn"), "Almora");
  assert.equal(localName(placeBySlug("almora")!, "en"), "Almora");
  assert.equal(localName(placeBySlug("udupi")!, "kn"), "ಉಡುಪಿ");
  assert.equal(localName(placeBySlug("udupi")!, "hi"), "Udupi");
  assert.equal(localName(placeBySlug("mumbai")!, "hi"), "मुंबई");
  assert.equal(localName(placeBySlug("bengaluru")!, "kn"), "ಬೆಂಗಳೂರು");
  assert.equal(localName(placeBySlug("gurugram")!, "hi"), "गुरुग्राम", "the current name, not Gurgaon");
  assert.equal(localName(placeBySlug("longding")!, "hi"), "Longding");
  assert.deepEqual(nativeNames("bengaluru"), ["बेंगलुरु", "ಬೆಂಗಳೂರು"]);
});

test("place page (hi): the native name leads the title, the Latin name follows; the heading has both", () => {
  const html = renderConditionsPage(almora(), "everyone", URL_ALMORA, "hi");
  assert.match(html.match(/<title>([^<]*)<\/title>/)![1], /^अल्मोड़ा AQI आज: 111 .* \| Almora \| mugilu$/);
  assert.match(
    html,
    /<h1 class="t-title loc"[^>]*>अल्मोड़ा<span class="h1sub"><span lang="en">Almora, Uttarakhand<\/span> · /,
  );
  assert.match(text(html), /अल्मोड़ा में अभी/);
  assert.match(html, /"alternateName":\["अल्मोड़ा"\]/);
});

test("place page (en, and kn where there is no Kannada name): unchanged", () => {
  const en = renderConditionsPage(almora(), "everyone", URL_ALMORA, "en");
  assert.match(en, /<h1 class="t-title loc"[^>]*>Almora, Uttarakhand<span class="h1sub">Air quality/);
  assert.match(en.match(/<title>([^<]*)<\/title>/)![1], /^Almora AQI today/);
  const kn = renderConditionsPage(almora(), "everyone", URL_ALMORA, "kn");
  assert.match(kn, /<h1 class="t-title loc"[^>]*>Almora, Uttarakhand<span class="h1sub">/);
});

test("place directory (hi, kn): each place by its native name", () => {
  assert.match(renderPlaces("hi"), /href="\/hi\/c\/almora">अल्मोड़ा</);
  assert.match(renderPlaces("kn"), /href="\/kn\/c\/udupi">ಉಡುಪಿ</);
  assert.match(renderPlaces("en"), /href="\/c\/almora">Almora</);
});

test("place directory (hi): the find box still matches the Latin name", () => {
  assert.match(renderPlaces("hi"), /<li data-k="Almora"><a href="\/hi\/c\/almora">अल्मोड़ा</);
  assert.match(renderPlaces("en"), /<li><a href="\/c\/almora">Almora</);

  assert.match(LIST_FILTER_JS, /getAttribute\('data-k'\)/);
});
