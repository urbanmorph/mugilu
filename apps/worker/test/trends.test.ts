import { test } from "node:test";
import assert from "node:assert/strict";
import { renderTrendsPage, sliceTrend, spanOf } from "../src/pages/trends";
import { trendKey, type PlaceTrend } from "../src/placedaily";
import { placeBySlug } from "../src/slugs";
import { testWorker } from "./helpers/worker";

// A named place's trend page: every hazard a day at a time over 7, 30 or 90 days, in the order
// of the risk it brought.

const DELHI = placeBySlug("delhi")!;
const days = (n: number) =>
  Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 10, 20 - n + 1 + i)).toISOString().slice(0, 10));
function trend(n = 30, o: Partial<PlaceTrend> = {}): PlaceTrend {
  const flat = (v: number | null) => Array<number | null>(n).fill(v);
  return {
    days: days(n),
    stations: 20,
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

test("trends page: the period in one line, then days at each level, the raised hazards before the calm", () => {
  const air = Array<number | null>(30).fill(350);
  air[4] = 480;
  const vis = Array<number | null>(30).fill(5000);
  vis[2] = 400; // fog high once
  const html = renderTrendsPage(DELHI, trend(30, { air, vis_min_m: vis }), 30, "en");
  const s = text(html);
  assert.match(s, /Delhi: the last 30 days/);
  assert.match(s, /Air was very poor or severe on 30 of 30 days\. Highest: AQI 480 Severe on 26 Oct\./);
  assert.match(html, /class="plate severe/);
  assert.ok(html.indexOf('id="t-air"') < html.indexOf('id="t-fog"'), "air (severe every day) before fog");
  assert.ok(html.indexOf('id="t-fog"') < html.indexOf('id="t-calm"'), "the calm ones last");
  assert.match(s, /Lowest: 400 m on 24 Oct\./);
  assert.match(s, /These stayed low on every one of the 30 days\./);
  assert.equal((html.match(/<svg class="tchart"/g) ?? []).length, 9, "a chart for every hazard");
});

test("trends page: the period switch links 7, 30 and 90 days; 30 is the page itself", () => {
  const html = renderTrendsPage(DELHI, trend(7), 7, "hi");
  assert.match(html, /href="\/hi\/c\/delhi\/trends\?days=7"[^>]*aria-current/);
  assert.match(html, /href="\/hi\/c\/delhi\/trends"/);
  assert.match(html, /href="\/hi\/c\/delhi\/trends\?days=90"/);
  assert.match(html, /<link rel="canonical" href="https:\/\/mugilu\.live\/hi\/c\/delhi\/trends\?days=7"/);
});

test("trends page: no record yet says so", () => {
  assert.match(
    text(renderTrendsPage(DELHI, null, 30, "en")),
    /No record for this place yet\. It fills in each night\./,
  );
});

test("trends page: in Hindi and Kannada no English sentence shows", () => {
  const air = Array<number | null>(30).fill(350);
  for (const lang of ["hi", "kn"] as const) {
    const s = text(renderTrendsPage(DELHI, trend(30, { air }), 30, lang));
    for (const en of [
      /the last \d+ days/,
      /Poor or worse/,
      /Highest:/,
      /Days at each level/,
      /stayed low/,
      /Day by day/,
      /Official warnings/,
      /in one line/,
    ])
      assert.doesNotMatch(s, en, `${lang}: ${en}`);
  }
});

test("spanOf and sliceTrend: 30 unless 7 or 90; the last days of the record", () => {
  assert.equal(spanOf("7"), 7);
  assert.equal(spanOf("90"), 90);
  assert.equal(spanOf("x"), 30);
  assert.equal(spanOf(null), 30);
  const s = sliceTrend(trend(30), 7);
  assert.equal(s.days.length, 7);
  assert.equal(s.air.length, 7);
  assert.equal(s.days.at(-1), "2026-11-20");
});

test("/c/delhi/trends reads the 30- or 90-day file; an unknown place is 404; the place panel links here", async () => {
  const w = testWorker();
  const put = async (span: 30 | 90) => {
    const { days: d, ...series } = trend(span);
    await w.env.OAQ_R2.put(trendKey(DELHI, span), JSON.stringify({ days: d, places: { delhi: series } }));
  };
  await put(30);
  await put(90);
  const thirty = await (await w.get("/c/delhi/trends")).text();
  assert.match(thirty, /Delhi: the last 30 days/);
  const ninety = await (await w.get("/c/delhi/trends?days=90")).text();
  assert.match(ninety, /Delhi: the last 90 days/);
  assert.equal((await w.get("/c/nowhere-at-all/trends")).status, 404);
  const place = await (await w.get("/c/delhi")).text();
  assert.match(place, /href="\/c\/delhi\/trends"/);
});

test("trends page: fog and cold grow their bars as the value falls, so the worst day is the tallest", () => {
  const vis = Array<number | null>(30).fill(5000);
  vis[3] = 150;
  const html = renderTrendsPage(DELHI, trend(30, { vis_min_m: vis }), 30, "en");
  const fog = html.slice(html.indexOf('id="t-fog"'));
  const svg = fog.match(/<svg class="tchart"[\s\S]*?<\/svg>/)![0];
  const heights = [...svg.matchAll(/class="tbar [a-z]+"[^>]*height="([\d.]+)"/g)].map((m) => +m[1]);
  assert.equal(heights.length, 30, "a day with good visibility is still a sliver, not a gap");
  assert.equal(Math.max(...heights), heights[3], "the 150 m day is the tallest bar");
  assert.match(text(fog), /A taller bar is a thicker fog/);
});
