import { test } from "node:test";
import assert from "node:assert/strict";
import { renderHome } from "../src/page";

test("renderHome: a valid HTML doc with the brand and a search form to /go", () => {
  const html = renderHome();
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /mugilu/);
  assert.match(html, /action="\/go"/);
  assert.match(html, /method="get"/i);
  assert.match(html, /name="q"/);
});

test("renderHome: city quick-links use the canonical /c/{slug}, not the coordinate", () => {
  const html = renderHome();
  // Link the page that actually indexes, not a coordinate URL that canonicalises to it.
  assert.match(html, /<a href="\/c\/bengaluru">Bengaluru<\/a>/);
  assert.match(html, /<a href="\/c\/delhi">Delhi<\/a>/);
  assert.doesNotMatch(html, /\/c\/12\.97,77\.59/); // no coordinate link for a place that has a slug
});

test("renderHome: 'Popular' leads with real top-lookups (D1), padded by seed cities", () => {
  const html = renderHome(undefined, undefined, {
    popular: [{ label: "Ludhiana, Punjab", lat: 30.9, lon: 75.85 }],
  });
  assert.match(html, /Popular:\s*<a href="\/c\/ludhiana">Ludhiana<\/a>/); // real lookup leads, canonical slug
  assert.match(html, /Mumbai/); // seed cities fill the rest so it's never sparse
  assert.match(renderHome(), /Delhi/); // with no data, all seed cities
});

test("renderHome: hero shows state-qualified places, the worst-air row, and per-row ages", () => {
  const html = renderHome(
    undefined,
    {
      hottest: { name: "Lucknow", state: "Uttar Pradesh", lat: 26.85, lon: 80.95, apparent_c: 44 },
      worstAir: { name: "Byrnihat", state: "Meghalaya", lat: 26.0, lon: 91.8, aqi: 312, band: "severe" },
    },
    { gridAsOf: "2026-06-27T12:00:00Z", airAsOf: "2026-06-27T15:00:00Z" },
  );
  assert.match(html, /Lucknow, Uttar Pradesh/); // state-qualified so it's placeable
  assert.match(html, /Worst air/); // the fresher hourly-air row
  assert.match(html, /Byrnihat, Meghalaya/);
  assert.match(html, /AQI 312/);
  assert.match(html, /<time[^>]*data-rel/); // each row stamped with its own age
});

test("renderHome: near-me is progressive enhancement (geolocation)", () => {
  assert.match(renderHome(), /geolocation/);
});

test("renderHome: search sets expectations (a sky lookup, not a map) + multilingual", () => {
  const html = renderHome();
  assert.match(html, /not a map/i); // dispels the Google-Maps assumption
  assert.match(html, /lat,lon/); // placeholder signals coordinates work
  assert.match(html, /any language/i); // invites native-script input
  assert.match(html, /[ಀ-೿]/); // a Kannada example is shown (ಬೆಂಗಳೂರು)
});

test("renderHome: schema.org WebSite + SearchAction JSON-LD", () => {
  const html = renderHome();
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /"SearchAction"/);
  assert.match(html, /go\?q=\{search_term_string\}/);
  // publisher entity is grounded with sameAs + logo (AEO / knowledge-graph)
  assert.match(html, /"sameAs":\["https:\/\/github\.com\/urbanmorph"\]/);
  assert.match(html, /"logo":"https:\/\/mugilu\.live\/apple-touch-icon\.png"/);
});

test("renderHome: social share card (Open Graph + Twitter, large image)", () => {
  const html = renderHome();
  assert.match(html, /property="og:image" content="https:\/\/mugilu\.live\/og\.png"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /property="og:title"/);
});

test("renderHome: has the 'Your places' list (localStorage recents/favourites) + prefetch", () => {
  const html = renderHome();
  assert.match(html, /id="yp"/); // the Your-places mount
  assert.match(html, /mugilu:places/); // reads the localStorage store
  assert.match(html, /Your places/);
  assert.match(html, /rel='prefetch'/); // warms the top places
  assert.match(html, /speculationrules/); // prerenders the top one
});

test("renderHome: near-me resets on bfcache restore (pageshow), not stuck on 'Locating…'", () => {
  assert.match(renderHome(), /pageshow/);
});

test("renderHome: shows a not-found notice for a failed search", () => {
  assert.match(renderHome("zzzxx"), /zzzxx/);
  assert.doesNotMatch(renderHome(), /zzzxx/);
});

test("renderHome: search box wired to the /suggest typeahead", () => {
  const html = renderHome();
  assert.match(html, /\/suggest/);
  assert.match(html, /id="ac"/);
  assert.match(html, /id="q"/);
});

test("renderHome: minimal footer (about, terms, commons → PDGI scorecard)", () => {
  const html = renderHome();
  assert.match(html, /digital commons/i);
  assert.match(html, /PDGI\.md/); // the commons link points at the scorecard
  assert.match(html, /\/terms/);
});
