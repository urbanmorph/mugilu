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
const WIDE = [["/s/…", renderStationPage(st(), near, true)]] as const;

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
  // in Hindi the nav links carry the prefix and the labels are Hindi (the signage header, /places)
  const hi = renderPlaces("hi").match(/<nav class="nav"[^>]*>([\s\S]*?)<\/nav>/)![1];
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
  const c0 = renderConditionsPage(c);
  assert.match(c0, /<nav class="topnav"[^>]*>[\s\S]*href="\/warnings"/);
  assert.match(c0, /@media\(min-width:960px\)\{:is\(\.foot,\.langsw\)\{max-width:1180px\}/);
  assert.doesNotMatch(c0, /<body class="wide">/);
  // phones: the nav is a second row under the logo, scrolling sideways if it must
  assert.match(renderConditionsPage(c), /\.topnav\{[^}]*order:3[^}]*overflow-x:auto/);
  // the signage pages (home first) carry the signage header's nav instead
  assert.match(renderHome(), /<nav class="nav" aria-label="Main">[\s\S]*href="\/warnings"/);
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

test("/places: a state picker and a search, each state an anchor", () => {
  const html = renderPlaces();
  assert.match(html, /<option value="st-delhi">Delhi<\/option>/);
  assert.match(html, /<details class="fold" open id="st-delhi">/);
  assert.match(html, /<input[^>]*id="pq"/);
});

test("station page: pollutant bars on CPCB's scale, a map and table of the stations around it, the source once", () => {
  const html = renderStationPage(st(), near, true);
  assert.match(html, /PM2\.5[\s\S]*?class="pbar"[^>]*style="width:[\d.]+%;background:/);
  const map = html.match(/<svg class="smap"[\s\S]*?<\/svg>/)?.[0] ?? "";
  assert.equal((map.match(/<circle /g) ?? []).length, 3); // itself and two neighbours
  assert.match(html, /<table class="snear">[\s\S]*Vivek Vihar[\s\S]*2\.1 km/);
  assert.equal((html.match(/Measured by Central Pollution Control Board/g) ?? []).length, 1);
});

test("text pages: a contents list linking each section", () => {
  for (const html of [renderAbout(), renderMethodology(), renderTerms()]) {
    const toc = html.match(/<nav class="panel toc" aria-label="On this page">([\s\S]*?)<\/nav>/)?.[1] ?? "";
    const links = [...toc.matchAll(/href="#([a-z0-9-]+)"/g)].map((m) => m[1]);
    assert.ok(links.length >= 3, `only ${links.length} contents links`);
    for (const id of links) assert.match(html, new RegExp(`id="${id}"`), id);
  }
});

// The backdrop says what the data says, by the canonical rule (palette.ts tintOf), as on /c.
test("tinted backdrops: a station by its air band, /warnings by its warnings, calm sky when quiet", () => {
  const body = /body\{background:linear-gradient\(180deg,color-mix\(in srgb,var\(--tint\) var\(--tk\),var\(--bg\)\)/;
  const vpoor = renderStationPage(st({ aqi: 344, band: "vpoor" }), near, true);
  assert.match(vpoor, /:root\{--tint:#a0785a;--tk:34%\}/); // the air hue, severe strength
  assert.match(vpoor, body);
  assert.match(renderStationPage(st(), near, true), /:root\{--tint:#a0785a;--tk:20%\}/); // moderate
  assert.match(renderStationPage(st(), near, false), /:root\{--tint:#38bdf8;--tk:16%\}/); // no recent reading: calm
  // /warnings: the warning wash at high while any warning is active, none when quiet (signage shell)
  assert.match(renderWarningsPage(SNAP), /<body class="mg" data-tint="Warning" data-level="high">/);
  assert.match(renderWarningsPage({ ...SNAP, alerts: [] } as WarningsSnapshot), /<body class="mg">/);
  // the explainer pages stay neutral
  assert.doesNotMatch(renderAbout(), /--tint:/);
});

test("text pages: long inline code (the MCP inspector command) wraps instead of pushing the page sideways", () => {
  const html = renderMcpPage();
  assert.match(html, /\.mg code\{[^}]*overflow-wrap:anywhere/);
  assert.match(html, /\.mg \.code\{[^}]*white-space:pre-wrap;overflow-wrap:anywhere/);
  assert.match(html, /<code class="code">npx @modelcontextprotocol\/inspector/);
});
