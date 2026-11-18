import { test } from "node:test";
import assert from "node:assert/strict";
import { renderHome } from "../src/pages/home";
import type { WarningsSnapshot } from "../src/sachet";

test("renderHome: a valid HTML doc on the signage shell, with a search form to /go", () => {
  const html = renderHome();
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /<body class="mg">/); // the token root; home has no tint
  assert.match(html, /<main id="main"/);
  assert.match(html, /action="\/go"/);
  assert.match(html, /method="get"/i);
  assert.match(html, /name="q"/);
});

test("renderHome: no page CSS, only the shell's two stylesheets", () => {
  const html = renderHome();
  assert.equal((html.match(/<link rel="stylesheet" href="\/assets\/site-/g) ?? []).length, 1);
  assert.doesNotMatch(html, /<style>/); // the shell's, nothing per page
  assert.doesNotMatch(html, /class="hm"|class="hero-now"/); // the old layout is gone
});

test("renderHome: the live title, tagline and what a lookup covers", () => {
  const html = renderHome();
  assert.match(html, /<h1 class="t-title">What is it like outside now\?<\/h1>/);
  assert.match(html, /<p class="t-lead">The open sky of India, one coordinate at a time\.<\/p>/);
  assert.match(html, /<p class="covers">/);
});

test("renderHome: Popular are tiles to the canonical /c/{slug}, not the coordinate", () => {
  const html = renderHome();
  assert.match(html, /<p class="t-kicker">Popular:<\/p>/);
  assert.match(html, /<a class="ptile" href="\/c\/bengaluru">Bengaluru<\/a>/);
  assert.match(html, /<a class="ptile" href="\/c\/delhi">Delhi<\/a>/);
  assert.doesNotMatch(html, /\/c\/12\.97,77\.59/);
});

test("renderHome: 'Popular' leads with real top-lookups (D1), padded by seed cities", () => {
  const html = renderHome(undefined, undefined, { popular: [{ label: "Ludhiana, Punjab", lat: 30.9, lon: 75.85 }] });
  assert.match(html, /Popular:<\/p><div class="ptiles"><a class="ptile" href="\/c\/ludhiana">Ludhiana<\/a>/);
  assert.match(html, /Mumbai/);
});

test("renderHome: the national highlights, state-qualified, each with a level chip and its own time", () => {
  const html = renderHome(
    undefined,
    {
      hottest: { name: "Lucknow", state: "Uttar Pradesh", lat: 26.85, lon: 80.95, apparent_c: 44 },
      worstAir: { name: "Byrnihat", state: "Meghalaya", lat: 26.0, lon: 91.8, aqi: 312, band: "severe" },
    },
    { gridAsOf: "2026-06-27T12:00:00Z", airAsOf: "2026-06-27T15:00:00Z" },
  );
  assert.match(html, /<a class="hl" href="\/c\/26\.85,80\.95">/);
  assert.match(html, /Hottest:<\/span> <b class="t-value">Lucknow, Uttar Pradesh<\/b>/);
  assert.match(html, /Worst air:<\/span> <b class="t-value">Byrnihat, Meghalaya<\/b>/);
  assert.match(html, /AQI 312 Severe/);
  assert.match(html, /<span class="chip severe">/);
  assert.match(html, /<time data-rel datetime="2026-06-27T15:00:00Z">/);
});

test("renderHome: the worst-air row names the monitor before its city", () => {
  const html = renderHome(undefined, {
    worstAir: {
      name: "Bengaluru",
      station: "Silk Board",
      state: "Karnataka",
      lat: 12.9,
      lon: 77.6,
      aqi: 500,
      band: "severe",
    },
  });
  assert.match(html, /<b class="t-value">Silk Board, Bengaluru, Karnataka<\/b>/);
});

test("renderHome: the search is a combobox wired to /suggest, with the live help and placeholder", () => {
  const html = renderHome();
  assert.match(html, /<input type="search" name="q" id="q" role="combobox"/);
  assert.match(html, /aria-controls="q-list"/);
  assert.match(html, /placeholder="A place in India, or lat,lon"/);
  assert.match(html, /\/suggest\?q=/);
  assert.match(html, /aria-activedescendant/);
  assert.match(html, /any language/i);
  assert.match(html, /You then see <b>its sky<\/b>/);
  assert.match(html, /<span lang="kn">ಬೆಂಗಳೂರು<\/span>/);
});

test("renderHome: near-me is progressive enhancement and resets on bfcache restore", () => {
  const html = renderHome();
  assert.match(html, /<button type="button" class="btn" id="nearme" hidden>/);
  assert.match(html, /geolocation/);
  assert.match(html, /pageshow/);
});

test("renderHome: schema.org WebSite + SearchAction JSON-LD, and the share card", () => {
  const html = renderHome();
  assert.match(html, /"SearchAction"/);
  assert.match(html, /go\?q=\{search_term_string\}/);
  assert.match(html, /"sameAs":\["https:\/\/github\.com\/urbanmorph"\]/);
  assert.match(html, /property="og:image" content="https:\/\/mugilu\.live\/og\.png"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
});

test("renderHome: Your places is a panel the script fills from this browser, with named buttons", () => {
  const html = renderHome();
  assert.match(html, /<section class="panel" id="yp" hidden/);
  assert.match(html, /mugilu:places/);
  assert.match(html, /rel='prefetch'/);
  assert.match(html, /speculationrules/);
  assert.match(html, /"Favourite X"/);
  assert.match(html, /"Rename X"/);
  assert.match(html, /"Remove X"/);
  const yp = html.slice(html.indexOf("var PS={K:'mugilu:places'"));
  assert.match(yp.slice(0, yp.indexOf("})();")), /function esc\(/);
});

test("renderHome: a failed search says so, and only then", () => {
  assert.match(renderHome("zzzxx"), /<p class="notice err" role="alert">No place found for &quot;zzzxx&quot;/);
  assert.doesNotMatch(renderHome(), /zzzxx/);
});

test("renderHome: the map of India stays, with its own stamps; without data it says it is not ready", () => {
  assert.match(renderHome(), /The map is not ready yet\./);
});

test("renderHome: an official cyclone warning is a plate under the search, IMD's category and the name", () => {
  const warnings: WarningsSnapshot = {
    generated_at: "2026-11-18T12:05:00Z",
    count: 1,
    alerts: [
      {
        identifier: "1",
        headline: "SEVERE CYCLONIC STORM AKVAN lays centred, Cyclone Warning for Anakapalli, Visakhapatnam.",
        category: "Met",
        issuer: "controlroom@ndma.gov.in (IMD Visakhapatnam)",
        link: "https://sachet.ndma.gov.in/cap_public_website/FetchXMLFile?identifier=1",
        sent: "Wed, 18 Nov 2026 11:17:00 GMT",
      },
    ],
  };
  const html = renderHome(undefined, undefined, { warnings });
  assert.match(html, /<section class="wplate" aria-label="Active warnings">/);
  assert.match(
    html,
    /<a href="\/warnings">Active warnings<\/a><span>IMD Visakhapatnam<\/span><span>16:47 IST · 18 Nov<\/span>/,
  );
  assert.match(html, /aria-label="Original alert \(CAP\): IMD Visakhapatnam, 16:47 IST · 18 Nov">CAP<\/a>/);
  assert.match(html, />Severe Cyclonic Storm Akvan<\/h2>/);
  assert.doesNotMatch(renderHome(), /class="wplate"/);
});

test("renderHome: the shape key, the put-on-a-screen link and the shell's footer", () => {
  const html = renderHome();
  assert.match(html, /<div class="lkey">/);
  assert.match(html, /href="\/display">[\s\S]{0,400}Put this on a screen<\/a>/);
  assert.match(html, /PDGI\.md/);
  assert.match(html, /\/terms/);
});

test("renderHome: the location button and rename prompt speak the page's language", () => {
  const kn = renderHome(undefined, undefined, undefined, "kn");
  assert.match(kn, /ನಿಮ್ಮ ಸ್ಥಳವನ್ನು ಹುಡುಕಲಾಗುತ್ತಿದೆ/);
  assert.doesNotMatch(kn, /Locating|Location unavailable|Name this place/);
  assert.match(renderHome(), /"Finding your location…"/);
});
