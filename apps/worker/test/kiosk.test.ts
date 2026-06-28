import { test } from "node:test";
import assert from "node:assert/strict";
import { renderKioskPage, renderDisplayBuilder } from "../src/page";
import type { Conditions } from "../src/types";

function conditions(overrides: Partial<Conditions> = {}): Conditions {
  return {
    location: { lat: 28.61, lon: 77.21 },
    as_of: "2026-06-28T11:00:00.000Z",
    air_as_of: "2026-06-28T11:00:00.000Z",
    place: "Delhi, Delhi",
    air: {
      aqi: 140,
      band: "moderate",
      pollutants: { pm25: 14 },
      station: { id: "x", name: "X", city: "Delhi", distance_km: 2 },
      source: "cpcb",
    },
    heat: { temp_c: 41, humidity_pct: 31, apparent_c: 46, wet_bulb_c: 27, source: "open-meteo" },
    uv: { index: 7, source: "open-meteo" },
    dust: { dust_ug_m3: 232, source: "open-meteo" },
    rain: { precipitation_mm: 0, probability_pct: 43, source: "open-meteo" },
    attribution: "Sources: CPCB via OAQ, Open-Meteo (CC-BY 4.0), via mugilu",
    disclaimer: "Informational only, not for medical, emergency, or safety-critical decisions.",
    ...overrides,
  };
}

test("renderKioskPage: full-bleed display with the QR, self-refresh and wake lock", () => {
  const html = renderKioskPage(conditions(), "everyone", "https://mugilu.live/c/delhi", "<svg>QR</svg>");
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /Delhi, Delhi/); // place
  assert.match(html, /Ambient/); // the headline read
  assert.match(html, /<svg>QR<\/svg>/); // the QR is injected for the phone hand-off
  assert.match(html, /scan for this/i);
  assert.match(html, /wakeLock/); // keeps the screen awake (tablets/phones)
  assert.match(html, /location\.reload/); // self-refreshing
  assert.match(html, /\/health/); // reachability-gated so a blip never white-screens
  assert.match(html, /\.bar,\.foot\{display:none\}/); // no site chrome on a wall display
  assert.match(html, /Air/);
  assert.match(html, /Heat/);
});

test("renderKioskPage: canonical points at the plain /c page (dedup, not indexed twice)", () => {
  const html = renderKioskPage(conditions(), "elderly", "https://mugilu.live/c/delhi", "<svg/>");
  assert.match(html, /<link rel="canonical" href="https:\/\/mugilu\.live\/c\/delhi">/);
});

test("renderDisplayBuilder: pick a place, weight it, open the kiosk", () => {
  const html = renderDisplayBuilder("everyone");
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /Put mugilu/);
  assert.match(html, /\/c\/bengaluru\?kiosk/); // a popular tile opens the kiosk
  assert.match(html, /action="\/go"/); // search routes through /go
  assert.match(html, /name="kiosk" value="1"/); // ...carrying the kiosk flag
  assert.match(html, /Fully Kiosk/); // the unattended how-to
});

test("renderDisplayBuilder: a chosen persona carries into the tiles and the search", () => {
  const html = renderDisplayBuilder("elderly");
  assert.match(html, /\/c\/bengaluru\?kiosk&as=elderly/);
  assert.match(html, /name="as" value="elderly"/);
  assert.match(html, /class="on"/); // the persona pill is selected
});
