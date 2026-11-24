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
  assert.match(s, /Delhi AQI and weather: last 30 days/);
  assert.match(s, /Air was very poor or severe on 30 of 30 days\. Highest: AQI 480 Severe on 26 Oct\./);
  assert.match(html, /class="plate severe/);
  assert.ok(html.indexOf('id="t-air"') < html.indexOf('id="t-fog"'), "air (severe every day) before fog");
  assert.ok(html.indexOf('id="t-fog"') < html.indexOf('id="t-calm"'), "the calm ones last");
  assert.match(s, /Lowest: 400 m on 24 Oct\./);
  assert.match(s, /These stayed low on every one of the 30 days\./);
  assert.equal(
    (html.match(/<svg class="tchart"/g) ?? []).length,
    7,
    "a chart for every hazard (fires are context, not one)",
  );
});

test("trends page: modelled dust is left out, from the charts, the table and the description", () => {
  const html = renderTrendsPage(DELHI, trend(30, { dust_max: Array<number | null>(30).fill(900) }), 30, "en");
  assert.doesNotMatch(html, /id="t-dust"/);
  assert.doesNotMatch(text(html), /Dust|dust/);
});

test("trends page: the period switch links 7, 30 and 90 days; 30 is the page itself", () => {
  const html = renderTrendsPage(DELHI, trend(7), 7, "hi");
  assert.match(html, /href="\/hi\/c\/delhi\/trends\?days=7"[^>]*aria-current/);
  assert.match(html, /href="\/hi\/c\/delhi\/trends"/);
  assert.match(html, /href="\/hi\/c\/delhi\/trends\?days=90"/);
  assert.match(html, /<link rel="canonical" href="https:\/\/mugilu\.live\/hi\/c\/delhi\/trends\?days=7"/);
});

test("trends page: no record yet says so, and asks search engines not to index it", () => {
  const html = renderTrendsPage(DELHI, null, 30, "en");
  assert.match(text(html), /No record for this place yet\. It fills in each night\./);
  assert.match(html, /<meta name="robots" content="noindex, follow">/);
  assert.doesNotMatch(renderTrendsPage(DELHI, trend(30), 30, "en"), /noindex/);
});

// Search: people type "[city] aqi last 30 days" and "[city] pollution history" (supporting-docs/
// reports/mugilu search discovery plan.md). The title says those words; the description says
// what the period was like, so each page's snippet is its own.
test("trends page: the title says AQI and weather; the description is the period in one line", () => {
  const air = Array<number | null>(30).fill(350);
  air[4] = 480;
  const html = renderTrendsPage(DELHI, trend(30, { air }), 30, "en");
  assert.equal(html.match(/<title>([^<]*)<\/title>/)![1], "Delhi AQI and weather: last 30 days | mugilu");
  const desc = html.match(/<meta name="description" content="([^"]*)"/)![1];
  assert.match(
    desc,
    /^Delhi, last 30 days: Air was very poor or severe on 30 of 30 days\. Highest: AQI 480 Severe on 26 Oct\.$/,
  );
  assert.ok(desc.length <= 160, desc);
  const hi = renderTrendsPage(DELHI, trend(30, { air }), 30, "hi");
  assert.match(hi, /<title>दिल्ली AQI और मौसम: पिछले 30 दिन \| Delhi \| mugilu<\/title>/);
  const kn = renderTrendsPage(DELHI, trend(30, { air }), 30, "kn");
  assert.match(kn, /<title>ದೆಹಲಿ AQI ಮತ್ತು ಹವಾಮಾನ: ಕಳೆದ 30 ದಿನಗಳು \| Delhi \| mugilu<\/title>/);
});

test("trends page: a name two districts share keeps its state in the title", () => {
  const aur = placeBySlug("aurangabad-bihar")!;
  assert.match(renderTrendsPage(aur, trend(30), 30, "en"), /<title>Aurangabad, Bihar AQI and weather: last 30 days/);
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
  assert.equal(s.dust_max.length, 7, "every series, shown or not");
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
  assert.match(thirty, /Delhi AQI and weather: last 30 days/);
  const ninety = await (await w.get("/c/delhi/trends?days=90")).text();
  assert.match(ninety, /Delhi AQI and weather: last 90 days/);
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
