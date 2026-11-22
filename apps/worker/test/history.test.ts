import { test } from "node:test";
import assert from "node:assert/strict";
import { historyPanel } from "../src/ui/history";
import type { PlaceTrend } from "../src/placedaily";

// The place page's "Last 30 days": the air a day at a time (a bar a day, filled by its level, the
// level edges drawn), then every other hazard in a line: how often it was raised and how far.

const days = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 9, 21 + i)).toISOString().slice(0, 10));
const flat = (v: number | null) => Array<number | null>(30).fill(v);
function trend(o: Partial<PlaceTrend> = {}): PlaceTrend {
  return {
    days,
    stations: 12,
    air: flat(150),
    fires: flat(0),
    feels_max: flat(30),
    feels_min: flat(15),
    rain_mm: flat(0),
    gust_kmh: flat(20),
    uv_max: flat(5),
    vis_min_m: flat(5000),
    dust_max: flat(40),
    ...o,
  };
}
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

test("historyPanel: the air's worst days lead, counted over the days with a reading", () => {
  const air = flat(150);
  air[3] = 420;
  air[4] = 320;
  air[5] = 250;
  air[6] = null;
  const html = historyPanel(trend({ air }), "en");
  assert.match(html, /<h2[^>]*id="last30"/);
  assert.match(text(html), /Air was very poor or severe on 2 of 29 days\./);
  assert.match(text(html), /No reading on 1 day\./);
  assert.match(text(html), /the worst AQI of the middle station of 12 within 25 km/);
});

test("historyPanel: milder months say how bad it got, never more", () => {
  const poor = flat(150);
  poor[0] = 250;
  assert.match(text(historyPanel(trend({ air: poor }), "en")), /Air was poor on 1 of 30 days, never worse\./);
  assert.match(text(historyPanel(trend(), "en")), /Air was moderate on 30 of 30 days, never worse\./);
  assert.match(
    text(historyPanel(trend({ air: flat(60) }), "en")),
    /Air was good or satisfactory on every one of 30 days\./,
  );
});

test("historyPanel: a bar a day, filled by its level; a day with no reading is an empty outline", () => {
  const air = flat(150);
  air[0] = 450;
  air[1] = null;
  const html = historyPanel(trend({ air }), "en");
  const svg = html.match(/<svg class="tchart"[\s\S]*?<\/svg>/)![0];
  assert.equal((svg.match(/class="tbar /g) ?? []).length, 29);
  assert.equal((svg.match(/class="tnone"/g) ?? []).length, 1);
  assert.match(svg, /<g><title>21 Oct: AQI 450, Severe<\/title><rect class="tbar severe"/);
  assert.match(svg, /class="tbar moderate"/);
  assert.match(svg, /role="img" aria-label="[^"]+"/);
  assert.match(svg, />Poor\u00a0<\/tspan>201</, "the level edges are labelled");
});

test("historyPanel: each other hazard in a line, the raised first; the calm ones share one", () => {
  const feels_max = flat(30);
  feels_max[2] = 41; // high
  feels_max[3] = 36; // moderate
  const vis = flat(5000);
  vis[9] = 150; // severe fog
  const html = text(historyPanel(trend({ feels_max, vis_min_m: vis }), "en"));
  const fog = html.indexOf("Fog: raised on 1 of 30 days, up to severe.");
  const heat = html.indexOf("Heat: raised on 2 of 30 days, up to high.");
  assert.ok(fog > 0 && heat > fog, "the worst level first");
  assert.match(html, /Cold, Rain, Wind, Smoke and UV: low on every day\./);
});

test("historyPanel: modelled dust is not part of the record, however high it ran", () => {
  const html = text(historyPanel(trend({ dust_max: flat(900) }), "en"));
  assert.doesNotMatch(html, /Dust|dust/);
});

test("historyPanel: a hazard with no data is left out of the lines", () => {
  const html = text(historyPanel(trend({ fires: flat(null) }), "en"));
  assert.doesNotMatch(html, /Smoke/);
});

test("historyPanel: no air station near, the other hazards still show", () => {
  const html = historyPanel(trend({ air: flat(null), stations: 0 }), "en");
  assert.doesNotMatch(html, /tchart/);
  assert.match(
    text(html),
    /This record has no air quality\. It uses only the stations within 25 km, and none is that close\./,
  );
  assert.match(text(html), /low on every day/);
});

test("historyPanel: nothing to show is no panel", () => {
  const none = trend(
    Object.fromEntries(
      ["air", "fires", "feels_max", "feels_min", "rain_mm", "gust_kmh", "uv_max", "vis_min_m", "dust_max"].map((k) => [
        k,
        flat(null),
      ]),
    ) as Partial<PlaceTrend>,
  );
  assert.equal(historyPanel(none, "en"), "");
  assert.equal(historyPanel(null, "en"), "");
});

test("historyPanel: in Hindi and Kannada, no English sentence reaches the reader", () => {
  const air = flat(150);
  air[0] = 420;
  const feels_max = flat(30);
  feels_max[2] = 41;
  for (const lang of ["hi", "kn"] as const) {
    const html = text(historyPanel(trend({ air, feels_max }), lang));
    for (const en of [
      /Last 30 days/,
      /very poor or severe/,
      /raised on/,
      /low on every day/,
      /The other hazards/,
      /middle station/,
      /Measured/,
    ])
      assert.doesNotMatch(html, en, `${lang}: ${en}`);
  }
});

// ── On the place page ──────────────────────────────────────────────────────────────
import { renderConditionsPage } from "../src/pages/place";
import { trendKey } from "../src/placedaily";
import { placeBySlug } from "../src/slugs";
import { testWorker } from "./helpers/worker";
import type { Conditions } from "../src/types";

const conditions = {
  location: { lat: 28.61, lon: 77.21 },
  place: "Delhi",
  as_of: "2026-11-20T10:05:00.000Z",
  air: {
    aqi: 320,
    band: "vpoor",
    pollutants: { pm25: 180 },
    station: { id: "x", name: "y", city: "Delhi", distance_km: 2 },
    source: "cpcb",
  },
  attribution: "Sources: CPCB",
  disclaimer: "Informational only.",
} as unknown as Conditions;

test("place page: the last 30 days come after the readings, before the stations and the screen button", () => {
  const html = renderConditionsPage(
    conditions,
    "everyone",
    "https://mugilu.live/c/delhi",
    "en",
    undefined,
    false,
    trend(),
  );
  const at = html.indexOf('id="last30"');
  assert.ok(at > html.indexOf('class="flow"'), "after the readings");
  assert.ok(at < html.indexOf('class="stack act"'), "before the secondary lane");
  assert.doesNotMatch(renderConditionsPage(conditions, "everyone", "https://mugilu.live/c/delhi"), /id="last30"/);
});

test("/c/delhi reads its state's 30-day file; a coordinate page shows none", async () => {
  const w = testWorker();
  const delhi = placeBySlug("delhi")!;
  const { days: d, ...series } = trend();
  await w.env.OAQ_R2.put(trendKey(delhi), JSON.stringify({ days: d, places: { delhi: series } }));
  const named = await (await w.get("/c/delhi")).text();
  assert.match(named, /id="last30"/);
  assert.match(named, /Air was moderate on 30 of 30 days, never worse\./);
  const point = await (await w.get("/c/28.5,77.3")).text();
  assert.doesNotMatch(point, /id="last30"/);
});

test("/c/delhi with no 30-day file yet is the page as before", async () => {
  const w = testWorker();
  const html = await (await w.get("/c/delhi")).text();
  assert.match(html, /<h1/);
  assert.doesNotMatch(html, /id="last30"/);
});

// ── India, the last 30 days (the home page) ─────────────────────────────────────────
import { indiaPanel } from "../src/ui/history";
import type { IndiaTrend } from "../src/placedaily";

const days90 = Array.from({ length: 90 }, (_, i) => new Date(Date.UTC(2026, 7, 23 + i)).toISOString().slice(0, 10));
function india(o: Partial<IndiaTrend> = {}): IndiaTrend {
  const n = (v: number | null) => Array<number | null>(90).fill(v);
  return { days: days90, cities: n(250), poor: n(40), very: n(10), fires: n(3000), ...o };
}

test("indiaPanel: the last of the 30 days leads, with the peak when it was another day", () => {
  const poor = Array<number | null>(90).fill(40);
  poor[70] = 150; // inside the last 30
  poor[20] = 400; // before them: not the peak of these 30
  const html = text(indiaPanel(india({ poor }), "en"));
  assert.match(html, /India, the last 30 days/);
  assert.match(html, /Poor or worse air in 50 of 250 cities on 20 Nov\. At the peak, 1 Nov, it was 160\./);
});

test("indiaPanel: two charts, cities stacked by level and fires; a day with no fire record is an outline", () => {
  const fires = Array<number | null>(90).fill(3000);
  fires[80] = null;
  const html = indiaPanel(india({ fires }), "en");
  const charts = html.match(/<svg class="tchart"[\s\S]*?<\/svg>/g)!;
  assert.equal(charts.length, 2);
  assert.equal((charts[0].match(/class="tbar severe"/g) ?? []).length, 30);
  assert.equal((charts[0].match(/class="tbar high"/g) ?? []).length, 30);
  assert.match(charts[0], /<title>20 Nov: 50 cities poor or worse, 10 very poor or severe<\/title>/);
  assert.equal((charts[1].match(/class="tnone"/g) ?? []).length, 1);
  assert.match(text(html), /No fire record on 1 day\./);
});

test("indiaPanel: no record yet is no panel; in Hindi and Kannada no English sentence shows", () => {
  assert.equal(indiaPanel(null, "en"), "");
  assert.equal(indiaPanel(india({ cities: Array(90).fill(null) }), "en"), "");
  for (const lang of ["hi", "kn"] as const) {
    const html = text(indiaPanel(india(), lang));
    for (const en of [/the last 30 days/i, /cities/, /Fires seen/, /Pick a place/, /Measured/])
      assert.doesNotMatch(html, en, `${lang}: ${en}`);
  }
});

test("home: India's 30 days after the map, before your places; none before the first file", async () => {
  const w = testWorker();
  const before = await (await w.get("/")).text();
  assert.doesNotMatch(before, /id="india30"/);
  await w.env.OAQ_R2.put("trends/india.json", JSON.stringify(india()));
  const html = await (await w.get("/")).text();
  const at = html.indexOf('id="india30"');
  assert.ok(at > 0);
  assert.ok(at > html.indexOf('id="mland"'), "after the map");
  assert.ok(at < html.indexOf('id="yp"'), "before your places");
});
