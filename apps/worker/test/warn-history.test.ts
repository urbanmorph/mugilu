import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HISTORY_PREFIX,
  colourOf,
  loadHistory,
  warnedDays,
  mergeHistory,
  pastAlert,
  placesInArea,
  recordHistory,
  type PastAlert,
} from "../src/warnhistory";
import { pastWarningsText } from "../src/phrases";
import { renderConditionsPage } from "../src/pages/place";
import { renderWarningHistoryPage } from "../src/pages/warnhistory";
import { placeBySlug } from "../src/slugs";
import type { WarnArea } from "../src/warnareas";
import type { Conditions } from "../src/types";
import { testWorker } from "./helpers/worker";

// Each place's official warnings since the archive began (27 Jun 2026): the alerts whose area
// covered its centre, kept per place in R2 by the hourly job (and once, for the backlog, by
// scripts/build-warn-history.ts), and told on its page under the warnings now.

const UDUPI = placeBySlug("udupi")!;
const square = (lon: number, lat: number, d: number) => [
  [
    [lon - d, lat - d],
    [lon + d, lat - d],
    [lon + d, lat + d],
    [lon - d, lat + d],
    [lon - d, lat - d],
  ] as [number, number][],
];
const area = (id: string, severity: string, o: Partial<WarnArea> = {}): WarnArea => ({
  identifier: id,
  event: "Heavy Rain",
  severity,
  sent: "2026-11-18T05:30:00+05:30",
  effective: "2026-11-18T06:00:00+05:30",
  onset: "",
  expires: "2026-11-18T21:00:00+05:30",
  issuer: "controlroom@ndma.gov.in (IMD Bengaluru)",
  headline: "Heavy rain likely over Udupi and Dakshina Kannada.",
  areaDesc: "Udupi",
  rings: square(UDUPI.lon, UDUPI.lat, 0.1),
  ...o,
});

test("colourOf: CAP's severity as IMD's colour (SACHET pairs Moderate with yellow, Severe with orange)", () => {
  assert.equal(colourOf("Moderate"), "yellow");
  assert.equal(colourOf("Severe"), "orange");
  assert.equal(colourOf("Extreme"), "red");
  assert.equal(colourOf("Minor"), "green");
  assert.equal(colourOf(""), "yellow", "unknown: an official warning still counts, at yellow");
});

test("placesInArea: the places whose centre is inside the area; none for an alert with no area", () => {
  assert.deepEqual(placesInArea(square(UDUPI.lon, UDUPI.lat, 0.05)), ["udupi"]);
  assert.deepEqual(placesInArea([]), []);
});

test("pastAlert: the times, colour, office and kind, from the archived alert", () => {
  assert.deepEqual(pastAlert(area("1", "Severe")), {
    id: "1",
    from: "2026-11-18T06:00:00+05:30",
    until: "2026-11-18T21:00:00+05:30",
    colour: "orange",
    office: "IMD Bengaluru",
    headline: "Heavy rain likely over Udupi and Dakshina Kannada.",
  });
  assert.equal(pastAlert(area("2", "Moderate", { effective: "" })).from, "2026-11-18T05:30:00+05:30", "else sent");
});

test("mergeHistory: each alert once, newest first", () => {
  const a = pastAlert(area("1", "Severe"));
  const b = pastAlert(area("2", "Moderate", { effective: "2026-11-20T06:00:00+05:30" }));
  assert.deepEqual(
    mergeHistory([a], [b, a]).map((x) => x.id),
    ["2", "1"],
  );
  assert.equal(mergeHistory([a, b], [a]), null, "nothing new: no write");
});

test("recordHistory: each alert under every place it covered, one write per place; a rerun writes nothing", async () => {
  const { env } = testWorker();
  const r = await recordHistory(env, [area("1", "Severe"), area("2", "Moderate", { rings: [] })]);
  assert.equal(r.places, 1);
  assert.deepEqual(
    (await loadHistory(env, "udupi"))!.map((x) => x.id),
    ["1"],
  );
  assert.ok(await env.OAQ_R2.get(`${HISTORY_PREFIX}udupi.json`));
  assert.equal((await recordHistory(env, [area("1", "Severe")])).places, 0);
  assert.equal(await loadHistory(env, "almora"), null);
  // An alert already in force when the archive began, and a green notice (a traffic advisory,
  // not a warning), are kept but not told; a later write keeps them.
  await recordHistory(env, [area("0", "Moderate", { effective: "2026-06-21T06:00:00+05:30" })]);
  await recordHistory(env, [area("g", "Minor", { effective: "2026-07-25T11:05:00+05:30" })]);
  await recordHistory(env, [area("5", "Moderate", { effective: "2026-11-20T06:00:00+05:30" })]);
  assert.deepEqual(
    (await loadHistory(env, "udupi"))!.map((x) => x.id),
    ["5", "1"],
  );
  const kept = (await (await env.OAQ_R2.get(`${HISTORY_PREFIX}udupi.json`))!.json()) as PastAlert[];
  assert.deepEqual(kept.map((x) => x.id).sort(), ["0", "1", "5", "g"]);
});

test("warnedDays: each IST day an alert was in force, at the worst colour that day; none after today", () => {
  const at = (id: string, sev: string, from: string, until: string) =>
    pastAlert(area(id, sev, { effective: from, expires: until }));
  const days = warnedDays(
    [
      at("1", "Moderate", "2026-11-01T13:00:00+05:30", "2026-11-02T13:00:00+05:30"), // two days
      at("2", "Moderate", "2026-11-01T15:00:00+05:30", "2026-11-01T18:00:00+05:30"), // same day: no new day
      at("3", "Severe", "2026-11-02T09:00:00+05:30", "2026-11-02T12:00:00+05:30"), // 2 Nov turns orange
      at("4", "Moderate", "2026-11-23T20:00:00+05:30", "2026-11-26T20:00:00+05:30"), // ends after today
    ],
    Date.parse("2026-11-23T22:00:00+05:30"),
  );
  assert.deepEqual(Object.fromEntries(days), {
    "2026-11-01": "yellow",
    "2026-11-02": "orange",
    "2026-11-23": "yellow",
  });
});

const LIST: PastAlert[] = [
  pastAlert(area("3", "Moderate", { effective: "2026-11-18T06:00:00+05:30" })),
  pastAlert(area("2", "Severe", { effective: "2026-10-02T06:00:00+05:30", expires: "2026-10-02T21:00:00+05:30" })),
  pastAlert(area("1", "Moderate", { effective: "2026-08-12T06:00:00+05:30", expires: "2026-08-12T21:00:00+05:30" })),
];

const NOW = Date.parse("2026-11-23T12:00:00+05:30");

test("pastWarningsText: on how many days since the archive began, by worst colour, and the last one", () => {
  assert.equal(
    pastWarningsText(LIST, "Udupi", "en", NOW),
    "Since 27 Jun, official warnings covered Udupi on 3 days: orange on 1, yellow on 2. The last was a yellow warning on 18 Nov: rain, snow, from IMD Bengaluru.",
  );
  assert.equal(
    pastWarningsText(LIST.slice(1, 2), "Udupi", "en", NOW),
    "Since 27 Jun, official warnings covered Udupi on 1 day: orange on 1. The last was an orange warning on 2 Oct: rain, snow, from IMD Bengaluru.",
  );
  assert.equal(pastWarningsText([], "Udupi", "en", NOW), "No official warning covered Udupi since 27 Jun.");
  for (const lang of ["hi", "kn"] as const) {
    const s = pastWarningsText(LIST, "उडुपी", lang, NOW);
    assert.match(s, /उडुपी/);
    assert.match(s, /3/);
    assert.doesNotMatch(s, /covered|Since|The last|heavy rain| on \d/);
  }
});

const conditions = (): Conditions =>
  ({
    location: { lat: UDUPI.lat, lon: UDUPI.lon },
    place: "Udupi, Karnataka",
    as_of: "2026-11-22T04:16:05.966Z",
    air: { aqi: 60, band: "satisfactory", pollutants: {}, station: null, source: "open-meteo", modelled: true },
    heat: { temp_c: 28, apparent_c: 30, humidity_pct: 70, wet_bulb_c: 24, wbgt_c: 27, source: "open-meteo" },
    rain: { precipitation_mm: 0, probability_pct: 0, source: "open-meteo" },
    warnings: [],
    nearby_warnings: [],
    attribution: "Sources: Open-Meteo, via mugilu",
    disclaimer: "Informational only.",
  }) as unknown as Conditions;
const page = (past: PastAlert[] | null, lang: "en" | "hi" = "en") =>
  renderConditionsPage(
    conditions(),
    "everyone",
    "https://mugilu.live/c/udupi",
    lang,
    undefined,
    false,
    null,
    undefined,
    past,
  );
const text = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

test("place page: the warnings panel tells the past under the present, with each warning listed", () => {
  const html = page(LIST);
  const s = text(html);
  assert.match(s, /No IMD or NDMA warning covers Udupi now\./);
  assert.match(s, /Since 27 Jun, official warnings covered Udupi on 3 days: orange on 1, yellow on 2\./);
  // three alerts: all of them, and no link to a longer list
  assert.match(s, /The last 3 warnings/);
  assert.doesNotMatch(html, /\/c\/udupi\/warnings/);
  assert.match(s, /06:00 IST · 18 Nov · until 21:00 IST · 18 Nov/);
  assert.match(s, /Heavy rain likely over Udupi and Dakshina Kannada\./);
  // No record kept for the place yet: the panel is as it was.
  assert.doesNotMatch(text(page(null)), /Since 27 Jun|No official warning covered/);
  assert.match(text(page([])), /No official warning covered Udupi since 27 Jun\./);
  assert.doesNotMatch(text(page(LIST, "hi")), /The last|warnings since/);
});

const MANY: PastAlert[] = Array.from({ length: 8 }, (_, i) =>
  pastAlert(
    area(String(i), "Moderate", {
      effective: `2026-11-${String(18 - i).padStart(2, "0")}T06:00:00+05:30`,
      expires: `2026-11-${String(18 - i).padStart(2, "0")}T21:00:00+05:30`,
      headline: `Alert number ${i}.`,
    }),
  ),
);

test("place page: only the last 5 warnings, then a link to the place's full list", () => {
  const html = page(MANY);
  const s = text(html);
  assert.match(s, /The last 5 warnings/);
  for (const i of [0, 4]) assert.match(s, new RegExp(`Alert number ${i}\\.`));
  for (const i of [5, 7]) assert.doesNotMatch(s, new RegExp(`Alert number ${i}\\.`));
  assert.match(html, /<a [^>]*href="\/c\/udupi\/warnings"[^>]*>[\s\S]*?All 8 alerts since 27 Jun/);
  assert.match(page(MANY, "hi"), /href="\/hi\/c\/udupi\/warnings"/);
});

test("the full list: every alert, kept out of search, back to the place", () => {
  const html = renderWarningHistoryPage(UDUPI, MANY, "en");
  const s = text(html);
  for (const i of [0, 7]) assert.match(s, new RegExp(`Alert number ${i}\\.`));
  assert.match(html, /<meta name="robots" content="noindex, follow">/);
  assert.match(html, /<title>Udupi: each warning since 27 Jun \| mugilu<\/title>/);
  assert.match(html, /href="\/c\/udupi"/);
  assert.match(s, /Since 27 Jun, official warnings covered Udupi on 8 days/);
  assert.doesNotMatch(text(renderWarningHistoryPage(UDUPI, MANY, "kn")), /each warning since|Since 27 Jun/);
});

test("GET /c/{slug}/warnings: the page for a named place; an unknown place is 404", async () => {
  const w = testWorker();
  await w.env.OAQ_R2.put(`${HISTORY_PREFIX}udupi.json`, JSON.stringify(MANY));
  const res = await w.get("/c/udupi/warnings");
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Alert number 7\./);
  assert.equal((await w.get("/c/nowhere-xyz/warnings")).status, 404);
});
