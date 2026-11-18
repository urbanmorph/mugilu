import { test } from "node:test";
import assert from "node:assert/strict";
import {
  renderAbout,
  renderConditionsPage,
  renderHome,
  renderMcpPage,
  renderMethodology,
  renderPlaces,
  renderStationPage,
  renderTerms,
  renderWarningsPage,
  warningType,
} from "../src/page";
import type { Conditions, NormalizedStation } from "../src/types";
import type { WarningsSnapshot } from "../src/sachet";

// Wide layouts (960 px and up) for the pages that sat in a 560 px column: a header nav
// and room for filters, indexes, maps and tables. The place pages (/c) and the home page
// keep their own layouts; phones keep the one column everywhere.

const st = (over: Partial<NormalizedStation> = {}): NormalizedStation => ({
  id: "cpcb-301",
  raw_id: "301",
  provider: "cpcb",
  name: "Anand Vihar",
  city: "Delhi",
  state: "",
  lat: 28.6469,
  lon: 77.3152,
  pollutants: { pm25: 70, pm10: 144, co: 2.2 },
  aqi: 132,
  band: "moderate",
  ts: "2026-11-18T13:45:00+05:30",
  ...over,
});
const near = [
  { ...st({ id: "cpcb-1", raw_id: "1", name: "Vivek Vihar", aqi: 142, lat: 28.67, lon: 77.31 }), distance_km: 2.1 },
  {
    ...st({ id: "cpcb-2", raw_id: "2", name: "Patparganj", aqi: 200, band: "poor", lat: 28.62, lon: 77.29 }),
    distance_km: 3.4,
  },
];
const SNAP: WarningsSnapshot = {
  generated_at: "2026-11-18T11:05:00.000Z",
  count: 4,
  alerts: [
    {
      identifier: "1",
      headline: "Thunderstorm with lightning very likely over Kamrup in the next 3 hours.",
      category: "Met",
      issuer: "controlroom@ndma.gov.in (IMD Guwahati)",
      link: "https://sachet.ndma.gov.in/cap/1",
      sent: "2026-11-16T17:42:00+05:30",
    },
    {
      identifier: "2",
      headline: "Lightning/Thunderstorms/Rainfall is Likely to occur over 17 districts of Jammu and Kashmir",
      category: "Met",
      issuer: "controlroom@ndma.gov.in (IMD Srinagar)",
      link: "",
      sent: "2026-11-17T09:40:00+05:30",
    },
    {
      identifier: "3",
      headline: "Moderate rain likely at isolated places over Cachar.",
      category: "Met",
      issuer: "controlroom@ndma.gov.in (IMD Guwahati)",
      link: "",
      sent: "2026-11-16T16:02:00+05:30",
    },
    {
      identifier: "4",
      headline: "River Brahmaputra flowing above danger level at Dhubri.",
      category: "Met",
      issuer: "controlroom@ndma.gov.in (CWC)",
      link: "",
      sent: "2026-11-16T10:00:00+05:30",
    },
  ],
} as WarningsSnapshot;

// /warnings, /display and 404 are on the signage shell (test/redesign-warnings.test.ts).
const WIDE = [
  ["/places", renderPlaces()],
  ["/about", renderAbout()],
  ["/methodology", renderMethodology()],
  ["/terms", renderTerms()],
] as const;

test("wide pages: a header nav to the main pages, and the wide layout from 960 px", () => {
  for (const [name, html] of WIDE) {
    assert.match(html, /<body class="wide">/, name);
    const nav = html.match(/<nav class="topnav"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? "";
    for (const p of ["/places", "/warnings", "/display", "/methodology", "/about"])
      assert.match(nav, new RegExp(`href="${p}"`), `${name} nav ${p}`);
    assert.match(
      html,
      /@media\(min-width:960px\)\{:is\(\.foot,\.langsw\)\{max-width:1180px\}body\.wide main\{max-width:1180px/,
      name,
    );
  }
  // in Hindi the nav links carry the prefix and the labels are Hindi
  const hi = renderPlaces("hi").match(/<nav class="topnav"[^>]*>([\s\S]*?)<\/nav>/)![1];
  assert.match(hi, /href="\/hi\/warnings">चेतावनियाँ</);
});

test("every page shares the header nav and the footer width; home and /c keep their own body layouts", () => {
  const c = {
    location: { lat: 28.61, lon: 77.21 },
    as_of: "2026-11-18T11:05:00.000Z",
    air: null,
    heat: null,
    rain: null,
    uv: null,
    dust: null,
    wind: null,
    visibility: null,
    smoke: null,
    attribution: "x",
    disclaimer: "y",
  } as unknown as Conditions;
  for (const html of [renderHome(), renderMcpPage()]) {
    assert.match(html, /<nav class="topnav"[^>]*>[\s\S]*href="\/warnings"/);
    assert.match(html, /@media\(min-width:960px\)\{:is\(\.foot,\.langsw\)\{max-width:1180px\}/);
  }
  for (const html of [renderHome()]) assert.doesNotMatch(html, /<body class="wide">/);
  for (const html of [renderMcpPage()]) assert.match(html, /<body class="wide">/);
  // phones: the nav is a second row under the logo, scrolling sideways if it must
  assert.match(renderHome(), /\.topnav\{[^}]*order:3[^}]*overflow-x:auto/);
});

test("warningType: the kind of hazard, from the headline", () => {
  assert.equal(warningType("Thunderstorm with lightning very likely over Kamrup"), "storm");
  assert.equal(warningType("Lightning/Thunderstorms/Rainfall is Likely"), "storm");
  assert.equal(warningType("Moderate rain likely at isolated places"), "rain");
  assert.equal(warningType("River Brahmaputra flowing above danger level"), "flood");
  assert.equal(warningType("Dense fog likely over Punjab"), "fog");
  assert.equal(warningType("Heat wave conditions likely"), "heat");
  assert.equal(warningType("Something else entirely"), "other");
});

test("/warnings: filters by type and office, rows carry what the filters read", () => {
  const html = renderWarningsPage(SNAP);
  assert.match(html, /name="type" value="storm" checked><span>Thunderstorm, lightning<\/span><span class="c">2</);
  assert.match(html, /name="issuer" value="IMD Guwahati" checked><span>IMD Guwahati<\/span><span class="c">2</);
  assert.match(html, /<li class="wrow" data-type="storm" data-issuer="IMD Srinagar">/);
});

test("/places: a state index and a search, each state an anchor", () => {
  const html = renderPlaces();
  assert.match(html, /<nav class="pindex" aria-label="States">[\s\S]*href="#st-delhi">Delhi</);
  assert.match(html, /<section class="st" id="st-delhi">/);
  assert.match(html, /<input[^>]*id="pq"/);
});

test("station page: pollutant bars on CPCB's scale with the limit, a table of the stations around it, the source once", () => {
  const html = renderStationPage(st(), near, true);
  assert.match(html, /<div class="bars" style="--lim:20\.0%">[\s\S]*?<span>PM2\.5<\/span>/);
  assert.match(html, /<table class="tbl">[\s\S]*Vivek Vihar[\s\S]*2\.1 km/);
  assert.equal((html.match(/Measured by Central Pollution Control Board/g) ?? []).length, 1);
  assert.match(html, /<header class="sh">[\s\S]*<main id="main"[\s\S]*<footer class="sf">/, "the standard's shell");
});

test("text pages: a contents list linking each section", () => {
  for (const html of [renderAbout(), renderMethodology(), renderTerms()]) {
    const toc = html.match(/<nav class="toc" aria-label="On this page">([\s\S]*?)<\/nav>/)?.[1] ?? "";
    const links = [...toc.matchAll(/href="#([a-z0-9-]+)"/g)].map((m) => m[1]);
    assert.ok(links.length >= 3, `only ${links.length} contents links`);
    for (const id of links) assert.match(html, new RegExp(`id="${id}"`), id);
  }
});

// The backdrop says what the data says, by the canonical rule (palette.ts tintOf), as on /c.
test("tinted backdrops: a station by its air band, /warnings by its warnings, calm sky when quiet", () => {
  const body = (html: string) => html.match(/<body class="mg"[^>]*>/)![0];
  assert.match(body(renderStationPage(st({ aqi: 344, band: "vpoor" }), near, true)), /data-tint="Air" data-level="severe"/);
  assert.match(body(renderStationPage(st(), near, true)), /data-tint="Air" data-level="moderate"/);
  assert.match(body(renderStationPage(st(), near, false)), /data-tint="none" data-level="low"/, "no recent reading: calm");
  assert.match(body(renderWarningsPage(SNAP)), /data-tint="Warning" data-level="high"/);
  assert.doesNotMatch(body(renderWarningsPage({ ...SNAP, alerts: [] } as WarningsSnapshot)), /data-tint/);
  // the explainer pages stay neutral
  assert.doesNotMatch(renderAbout(), /data-tint=|--tint:/);
});

test("text pages: long inline code (the MCP inspector command) wraps instead of pushing the page sideways", () => {
  assert.match(renderMcpPage(), /\.ax code\{overflow-wrap:anywhere\}/);
  // each list item's text in one cell (.t), so the row's label, code and words don't split into columns
  assert.doesNotMatch(renderMcpPage(), /<li><(b|code)>/);
});
