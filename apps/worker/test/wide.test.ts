import { test } from "node:test";
import assert from "node:assert/strict";
import {
  renderAbout,
  renderConditionsPage,
  renderDisplayBuilder,
  renderHome,
  renderMcpPage,
  renderNotFound,
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

const WIDE = [
  ["/warnings", renderWarningsPage(SNAP)],
  ["/places", renderPlaces()],
  ["/s/…", renderStationPage(st(), near, true)],
  ["/about", renderAbout()],
  ["/methodology", renderMethodology()],
  ["/terms", renderTerms()],
  ["/display", renderDisplayBuilder()],
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
  for (const html of [renderConditionsPage(c), renderHome(), renderMcpPage(), renderNotFound()]) {
    assert.match(html, /<nav class="topnav"[^>]*>[\s\S]*href="\/warnings"/);
    assert.match(html, /@media\(min-width:960px\)\{:is\(\.foot,\.langsw\)\{max-width:1180px\}/);
  }
  for (const html of [renderConditionsPage(c), renderHome()]) assert.doesNotMatch(html, /<body class="wide">/);
  for (const html of [renderMcpPage(), renderNotFound()]) assert.match(html, /<body class="wide">/);
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

test("/warnings: filters by type and office, cards carry what the filters read, long headlines wrap", () => {
  const html = renderWarningsPage(SNAP);
  assert.match(html, /<aside class="wfilter"/);
  assert.match(html, /<input type="checkbox" name="type" value="storm" checked>[^<]*<\/span><span class="wc">2</);
  assert.match(
    html,
    /<input type="checkbox" name="issuer" value="IMD Guwahati" checked>[^<]*<\/span><span class="wc">2</,
  );
  assert.match(html, /<li data-type="storm" data-issuer="IMD Srinagar">/);
  assert.match(html, /\.whead\{[^}]*overflow-wrap:anywhere/); // the sideways-scroll fix
  assert.match(html, /\.wlist\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test("/places: a state index and a search, each state an anchor", () => {
  const html = renderPlaces();
  assert.match(html, /<nav class="pindex" aria-label="States">[\s\S]*href="#st-delhi">Delhi</);
  assert.match(html, /<section class="st" id="st-delhi">/);
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
    const toc = html.match(/<nav class="toc" aria-label="On this page">([\s\S]*?)<\/nav>/)?.[1] ?? "";
    const links = [...toc.matchAll(/href="#([a-z0-9-]+)"/g)].map((m) => m[1]);
    assert.ok(links.length >= 3, `only ${links.length} contents links`);
    for (const id of links) assert.match(html, new RegExp(`id="${id}"`), id);
  }
});

test("/display: the preview and the setup sit side by side", () => {
  const html = renderDisplayBuilder();
  assert.match(html, /<div class="dleft">[\s\S]*class="dprev"[\s\S]*<div class="dright">[\s\S]*action="\/go"/);
});

// The backdrop says what the data says, by the canonical rule (palette.ts tintOf), as on /c.
test("tinted backdrops: a station by its air band, /warnings by its warnings, calm sky when quiet", () => {
  const body = /body\{background:linear-gradient\(180deg,color-mix\(in srgb,var\(--tint\) var\(--tk\),var\(--bg\)\)/;
  const vpoor = renderStationPage(st({ aqi: 344, band: "vpoor" }), near, true);
  assert.match(vpoor, /:root\{--tint:#a0785a;--tk:34%\}/); // the air hue, severe strength
  assert.match(vpoor, body);
  assert.match(renderStationPage(st(), near, true), /:root\{--tint:#a0785a;--tk:20%\}/); // moderate
  assert.match(renderStationPage(st(), near, false), /:root\{--tint:#38bdf8;--tk:16%\}/); // no recent reading: calm
  assert.match(renderWarningsPage(SNAP), /:root\{--tint:#ef4444;--tk:20%\}/); // 4 warnings
  assert.match(renderWarningsPage(SNAP), body);
  const many = {
    ...SNAP,
    alerts: Array.from({ length: 30 }, (_, i) => ({ ...SNAP.alerts[0], identifier: String(i) })),
  };
  assert.match(renderWarningsPage(many as WarningsSnapshot), /:root\{--tint:#ef4444;--tk:26%\}/);
  assert.match(renderWarningsPage({ ...SNAP, alerts: [] } as WarningsSnapshot), /:root\{--tint:#38bdf8;--tk:16%\}/);
  // the explainer pages stay neutral
  assert.doesNotMatch(renderAbout(), /--tint:/);
});

test("text pages: long inline code (the MCP inspector command) wraps instead of pushing the page sideways", () => {
  assert.match(renderMcpPage(), /\.ax code\{overflow-wrap:anywhere\}/);
  // each list item's text in one cell (.t), so the row's label, code and words don't split into columns
  assert.doesNotMatch(renderMcpPage(), /<li><(b|code)>/);
});
