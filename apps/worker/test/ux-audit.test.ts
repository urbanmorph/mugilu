// The 2026-10 UI/UX audit, one test (or more) per finding.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ambientMeaning, ambientRisk } from "../src/score";
import { renderConditionsPage, renderDisplayBuilder, renderEmbed, renderWarningsPage } from "../src/page";
import { buildSuggestions } from "../src/suggest";
import { buildGazIndex, type GazRow } from "../src/gazetteer";
import type { Conditions, NormalizedStation } from "../src/types";
import type { WarningsSnapshot } from "../src/sachet";

const c = (o: Partial<Conditions> = {}) =>
  ({
    location: { lat: 19.07, lon: 72.87 },
    place: "Mumbai, Maharashtra",
    as_of: "2026-10-25T07:00:00.000Z",
    heat: { temp_c: 36, humidity_pct: 32, apparent_c: 38, wet_bulb_c: 23, source: "om" },
    attribution: "a",
    disclaimer: "d",
    ...o,
  }) as Conditions;

test("1. moderate heat is described in the layer's own word (very hot), not 'warm'", () => {
  const m = ambientMeaning(ambientRisk(c()));
  assert.match(m, /^It is very hot\./);
  assert.match(ambientMeaning(ambientRisk(c(), "child")), /^It is very hot\. For children, treat it as high\./);
});

test("2. the page says when it was built; an older air reading is named separately", () => {
  const air = {
    aqi: 91,
    band: "satisfactory",
    pollutants: { pm25: 42 },
    station: { id: "x", name: "y", city: "Mumbai", distance_km: 1.7 },
    source: "cpcb",
  };
  const old = renderConditionsPage(c({ air, air_as_of: "2026-10-25T05:00:00.000Z" } as Partial<Conditions>));
  const when = old.match(/<p class="when">([\s\S]*?)<\/p>/)![1];
  assert.match(when, /updated <time data-rel datetime="2026-10-25T07:00:00.000Z"/);
  assert.match(when, /air reading <time data-rel datetime="2026-10-25T05:00:00.000Z"/);
  const fresh = renderConditionsPage(c({ air, air_as_of: "2026-10-25T06:50:00.000Z" } as Partial<Conditions>));
  assert.doesNotMatch(fresh.match(/<p class="when">([\s\S]*?)<\/p>/)![1], /air reading/);
});

test("3. warnings: an honest count, grouped by issuer with a readable name, newest first, times in IST", () => {
  const a = (id: string, issuer: string, sent: string) => ({
    identifier: id,
    headline: "h" + id,
    category: "Met",
    issuer,
    link: "",
    sent,
  });
  const snap = {
    generated_at: "2026-10-25T07:05:00.000Z",
    count: 3,
    alerts: [
      a("1", "controlroom@ndma.gov.in (IMD Chennai)", "Sun, 25 Oct 2026 04:32:22 GMT"),
      a("2", "controlroom@ndma.gov.in (Andhra Pradesh SDMA)", "Sun, 25 Oct 2026 06:46:07 GMT"),
      a("3", "controlroom@ndma.gov.in (IMD Chennai)", "Sun, 25 Oct 2026 06:00:00 GMT"),
    ],
  } as unknown as WarningsSnapshot;
  const html = renderWarningsPage(snap);
  assert.match(html, /The latest 3 official NDMA \/ IMD alerts across India\./);
  const groups = [...html.matchAll(/<h2 class="wgrp">([^<]+)<span[^>]*>(\d+)<\/span><\/h2>/g)].map((m) => [
    m[1].trim(),
    m[2],
  ]);
  assert.deepEqual(groups, [
    ["Andhra Pradesh SDMA", "1"],
    ["IMD Chennai", "2"],
  ]);
  assert.doesNotMatch(html, /controlroom@|GMT/);
  assert.match(html, /12:16 IST · 25 Oct/); // 06:46 GMT
  assert.ok(html.indexOf(">h3<") < html.indexOf(">h1<"), "newest first within a group");
});

test("4. the 'for you' tag never breaks inside, and wraps under the label instead of squeezing it", () => {
  const html = renderConditionsPage(c(), "child");
  assert.match(html, /\.lyr \.fy\{[^}]*white-space:nowrap/);
  assert.match(html, /\.lyr dt\{[^}]*flex-wrap:wrap/);
});

test("5. Kannada and Hindi /c pages carry no English 'Nearby:' or 'all places'", () => {
  for (const lang of ["hi", "kn"] as const) {
    const html = renderConditionsPage(c(), "everyone", "https://mugilu.live/c/mumbai", lang);
    assert.doesNotMatch(html, />Nearby:|>all places</, lang);
  }
});

test("6. search: a place whose name starts with the query ranks above stations that only contain it", async () => {
  const st = (name: string, city: string): NormalizedStation =>
    ({
      id: name,
      raw_id: name,
      provider: "cpcb",
      name,
      city,
      state: "",
      lat: 20,
      lon: 75,
      pollutants: {},
      aqi: null,
      band: "unknown",
      ts: null,
    }) as NormalizedStation;
  const stations = [
    st("Deesa-Rijment Rd ,Indira Nagar", "Deesa"),
    st("Nagpur - Indira Nagar", "Nagpur"),
    st("Indira Colony Vistar", "Pali"),
  ];
  const gaz = buildGazIndex([["Indiranagar", 12.97, 77.64, "s", "Karnataka", undefined]] as GazRow[]);
  const out = await buildSuggestions(stations, "indira", async () => [], 6, gaz);
  assert.equal(out[0].label, "Indiranagar");
  assert.ok(
    out.some((s) => s.label === "Deesa-Rijment Rd, Indira Nagar"),
    "station labels tidied",
  );
});

test("7. the embed card's cloud mark has its sky colour", () => {
  assert.match(renderEmbed(c(), "everyone", "https://mugilu.live"), /--sky:/);
});

test("8. the display setup page previews a live display and suggests places as you type", () => {
  const html = renderDisplayBuilder("elderly");
  assert.match(html, /<iframe[^>]+src="\/c\/bengaluru\?kiosk&amp;as=elderly"[^>]+tabindex="-1"/);
  assert.match(html, /id="dac"/);
  assert.match(html, /'\?kiosk'/);
});

test("9. on laptops the layers flow in two balanced columns (no gaps under short tiles)", () => {
  assert.match(renderConditionsPage(c()), /\.cx-r \.strata\{[^}]*column-count:2/);
});
