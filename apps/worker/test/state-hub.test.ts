import { test } from "node:test";
import assert from "node:assert/strict";
import { renderStatePage, stateNow } from "../src/pages/state";
import { allStates, stateBySlug, stateName, stateOf } from "../src/states";
import { placeBySlug } from "../src/slugs";
import type { ConditionsSnapshot, NormalizedStation } from "../src/types";
import { sitemapPaths } from "../src/meta";

// A state's hub, /state/{slug}: its places now, the worst first, from the same data the place
// pages read (supporting-docs/reports/mugilu search discovery plan.md, "state hubs").

const KA = stateBySlug("karnataka")!;
const st = (id: string, lat: number, lon: number, aqi: number, band: NormalizedStation["band"]) =>
  ({
    id,
    raw_id: id,
    provider: "cpcb",
    name: id,
    city: "",
    state: "",
    lat,
    lon,
    aqi,
    band,
    pollutants: {},
    ts: "",
  }) as unknown as NormalizedStation;
const STATIONS = [
  st("blr", 12.97, 77.59, 180, "moderate"), // Bengaluru: city and urban district share it
  st("mys", 12.3, 76.65, 90, "satisfactory"),
  st("blg", 15.85, 74.5, 210, "poor"),
];
const grid = {
  generated_at: "2026-11-22T03:00:00Z",
  point_count: 3,
  points: [
    {
      id: "a",
      name: "Kalaburagi",
      level: "district",
      source_layer: "",
      state: "Karnataka",
      lat: 17.3,
      lon: 76.8,
      wx: { apparent_c: 31.4, rain_mm: 0 },
    },
    {
      id: "b",
      name: "Kodagu",
      level: "district",
      source_layer: "",
      state: "Karnataka",
      lat: 12.4,
      lon: 75.8,
      wx: { apparent_c: 14.2, rain_mm: 2.5 },
    },
    {
      id: "c",
      name: "Udupi",
      level: "district",
      source_layer: "",
      state: "Karnataka",
      lat: 13.5,
      lon: 74.9,
      wx: { apparent_c: 27, rain_mm: 0 },
    },
  ],
} as unknown as ConditionsSnapshot;
const NOW = stateNow(KA, { grid, stations: STATIONS, airAt: "2026-11-22T03:15:00Z" });
const text = (h: string) =>
  h
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

test("states: a hub for each state or UT with more than one place; names in three languages", () => {
  assert.ok(stateBySlug("uttar-pradesh"));
  assert.equal(stateOf("Jammu & Kashmir")?.slug, "jammu-kashmir");
  assert.equal(stateName("Karnataka", "kn"), "ಕರ್ನಾಟಕ");
  assert.equal(stateName("Uttar Pradesh", "hi"), "उत्तर प्रदेश");
  const hubs = sitemapPaths().filter((p) => /^\/state\/[a-z-]+$/.test(p));
  assert.equal(hubs.length, allStates().filter((s) => s.places.length > 1).length);
  assert.equal(hubs.length, 34);
  assert.ok(!hubs.includes("/state/chandigarh"), "one place: its own page is the hub");
});

test("stateNow: the worst air first, one row per station; hottest, coldest, rain from the district grid", () => {
  assert.deepEqual(
    NOW.air.map((r) => r.aqi),
    [210, 180, 90],
  );
  assert.equal(NOW.hot[0].p.slug, "kalaburagi");
  assert.equal(NOW.hot[0].feels, 31);
  assert.equal(NOW.cold[0].p.slug, "kodagu");
  assert.deepEqual(
    NOW.rain.map((r) => r.p.slug),
    ["kodagu"],
  );
});

test("hub page: searched title and heading, the state in one line, each place linking its page", () => {
  const html = renderStatePage(KA, NOW, "en");
  assert.equal(html.match(/<title>([^<]*)<\/title>/)![1], "Karnataka air quality, weather and warnings now | mugilu");
  assert.match(html, /<h1 class="t-title">Karnataka now: air, heat, rain and official warnings<\/h1>/);
  const s = text(html);
  assert.match(
    s,
    /Worst air now: Belagavi, AQI 210 \(Poor\)\. Feels hottest: Kalaburagi, 31°C\. Feels coldest: Kodagu, 14°C\. Rain now in 1 place\. No official warning covers a place here now\./,
  );
  assert.match(html, /<a href="\/c\/belagavi">Belagavi<\/a>/);
  assert.match(html, /href="\/c\/udupi"/, "every place is listed");
  assert.match(html, /<link rel="canonical" href="https:\/\/mugilu\.live\/state\/karnataka">/);
  assert.ok(html.match(/<meta name="description" content="([^"]*)"/)![1].length <= 160);
});

test("hub page (kn, hi): the state and its places by their native names; no English sentence", () => {
  const kn = renderStatePage(KA, NOW, "kn");
  assert.match(kn, /<h1 class="t-title">ಕರ್ನಾಟಕ /);
  assert.match(kn, /href="\/kn\/c\/belagavi">ಬೆಳಗಾವಿ</);
  const hi = renderStatePage(stateBySlug("uttarakhand")!, stateNow(stateBySlug("uttarakhand")!, {}), "hi");
  assert.match(hi, /<title>उत्तराखंड में अभी वायु गुणवत्ता, मौसम और चेतावनी/);
  assert.match(hi, />अल्मोड़ा</);
  for (const s of [text(kn), text(hi)])
    for (const en of [
      /Worst air now/,
      /Feels hottest/,
      /Every place in/,
      /No rain now/,
      /official warning/,
      /nearest air station/,
    ])
      assert.doesNotMatch(s, en);
});

test("hub page: no station and no grid still says so, in words", () => {
  const s = text(renderStatePage(KA, stateNow(KA, {}), "en"));
  assert.match(s, /No air station is within 50 km of a place here\./);
  assert.match(s, /No rain now\./);
});

test("place pages link their state hub; /places names each state's hub", async () => {
  const { renderPlaces } = await import("../src/pages/places");
  assert.match(renderPlaces("en"), /href="\/state\/karnataka"/);
  assert.ok(placeBySlug("udupi"));
});
