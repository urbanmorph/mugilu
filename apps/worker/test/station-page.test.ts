import { test } from "node:test";
import assert from "node:assert/strict";
import { renderStationPage, renderConditionsPage } from "../src/page";
import { robotsTxt } from "../src/meta";
import type { Conditions, NormalizedStation } from "../src/types";

const st = (over: Partial<NormalizedStation> = {}): NormalizedStation => ({
  id: "cpcb-1558",
  raw_id: "1558",
  provider: "cpcb",
  name: "Anand Vihar",
  city: "Delhi",
  state: "",
  lat: 28.6469,
  lon: 77.3152,
  pollutants: { pm25: 280, pm10: 512, co: 1.6 },
  aqi: 412,
  band: "severe",
  ts: "2026-11-11T13:45:00+05:30",
  yll: 9.1,
  ...over,
});
const near = [st({ id: "cpcb-1", raw_id: "1", name: "ITO", aqi: 344, band: "vpoor", lat: 28.63, lon: 77.24 })];

test("renderStationPage: titled the way people search, with the number, band, city and source", () => {
  const html = renderStationPage(st(), near, true);
  assert.match(html, /<title>Anand Vihar AQI today: 412 Severe · Delhi · air quality station · mugilu<\/title>/);
  assert.match(
    html,
    /<meta name="description" content="Anand Vihar \(Delhi\) AQI 412 \(Severe\) right now, measured by Central Pollution Control Board/,
  );
  assert.match(html, /<link rel="canonical" href="https:\/\/mugilu\.live\/s\/cpcb\/1558"/);
  assert.match(html, /<h1[^>]*>Anand Vihar<\/h1>/);
  assert.match(html, /PM2\.5[\s\S]*280/); // the pollutants
  assert.match(html, /CO[\s\S]*1\.6[\s\S]*mg\/m³/); // CO in mg/m³
  assert.match(html, /href="\/c\/28\.6469,77\.3152"/); // the full sky here
  assert.match(html, /href="\/s\/cpcb\/1"[^>]*>[\s\S]*ITO[\s\S]*344/); // nearby stations
  assert.match(html, /Informational only/); // the disclaimer
  assert.match(html, /href="\/s\/cpcb\/1558\.json"/); // its data
});

test("renderStationPage: a station with no recent reading says so, with no number", () => {
  const html = renderStationPage(st(), [], false);
  assert.match(html, /No recent reading from this station/);
  assert.doesNotMatch(html, /<title>[^<]*412/);
  assert.match(html, /<title>Anand Vihar · Delhi · air quality station · mugilu<\/title>/);
});

test("renderStationPage (hi): localised framing, names and acronyms Latin, links prefixed", () => {
  const html = renderStationPage(st(), near, true, "hi");
  assert.match(html, /<title>Anand Vihar AQI आज: 412 गंभीर · Delhi · वायु गुणवत्ता स्टेशन · mugilu<\/title>/);
  assert.match(html, /href="\/hi\/c\/28\.6469,77\.3152"/);
  assert.match(html, /href="\/hi\/s\/cpcb\/1"/);
});

test("station pages stay out of the index but pass their links on; robots.txt lists no station sitemap", () => {
  // 1,334 thin station pages were never crawled (Search Console: "Discovered, not indexed", zero
  // impressions in 90 days); they stay for people, out of Google's way for the city pages.
  assert.match(renderStationPage(st(), near, true), /<meta name="robots" content="noindex, follow">/);
  assert.doesNotMatch(robotsTxt("https://mugilu.live"), /sitemap-stations/);
  assert.match(robotsTxt("https://mugilu.live"), /Sitemap: https:\/\/mugilu\.live\/sitemap\.xml/);
});

test("renderConditionsPage: lists the air stations near the place, linking to each", () => {
  const c = {
    location: { lat: 28.61, lon: 77.21 },
    place: "Delhi",
    as_of: "2026-11-11T08:20:00.000Z",
    air: {
      aqi: 344,
      band: "vpoor",
      pollutants: {},
      station: { id: "cpcb-1", name: "ITO", city: "Delhi", distance_km: 2 },
      source: "cpcb",
    },
    heat: null,
    rain: null,
    uv: null,
    dust: null,
    wind: null,
    visibility: null,
    smoke: null,
    nearby_stations: [
      { ...st(), distance_km: 11.2 },
      { ...near[0], distance_km: 3.1 },
    ],
    attribution: "Sources: CPCB via OAQ",
    disclaimer: "Informational only.",
  } as unknown as Conditions;
  const html = renderConditionsPage(c);
  // a named place (and a point that canonicalises to one) is indexable
  assert.doesNotMatch(html, /name="robots"/);
  // an arbitrary point is not: there are endless of them, all thin
  assert.match(
    renderConditionsPage(c, "everyone", "https://mugilu.live/c/28.61,77.21", "en", undefined, true),
    /<meta name="robots" content="noindex, follow">/,
  );
  assert.match(html, /Air stations near here/);
  assert.match(html, /href="\/s\/cpcb\/1558"[^>]*>Anand Vihar<\/a> 412/);
});
