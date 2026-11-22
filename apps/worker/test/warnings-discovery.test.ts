import { test } from "node:test";
import assert from "node:assert/strict";
import { renderWarningsPage } from "../src/pages/warnings";
import { mapWarnings, type IndiaMap } from "../src/indiamap";
import type { WarningsSnapshot } from "../src/sachet";
import type { WarnArea } from "../src/warnareas";

// /warnings in the words people search ("weather warning today", "orange alert meaning"), with
// text of its own that outlives any one alert (supporting-docs/reports/mugilu search discovery
// plan.md, "Making /warnings indexable"): a fixed title and heading, the warnings in one line,
// the places under a warning by state (links to their pages), and what the colours mean.

const alert = (id: string, headline: string, office: string) => ({
  identifier: id,
  headline,
  category: "Met",
  issuer: `controlroom@ndma.gov.in (${office})`,
  link: "",
  sent: "2026-11-22T06:38:12+05:30",
});
const SNAP = {
  generated_at: "2026-11-22T03:15:00.000Z",
  count: 3,
  alerts: [
    alert("1", "Thunderstorm with lightning likely over Almora.", "IMD Dehradun"),
    alert("2", "Light to moderate thunderstorm and lightning over Bengaluru.", "IMD Bengaluru"),
    alert("3", "Heavy rain likely over Bengaluru Urban.", "Karnataka SDMA"),
  ],
} as unknown as WarningsSnapshot;
const square = (id: string, lon: number, lat: number, d: number): WarnArea => ({
  identifier: id,
  event: "Thunderstorm",
  severity: "Moderate",
  expires: "2026-11-22T12:00:00+05:30",
  issuer: "IMD",
  headline: "",
  areaDesc: "",
  rings: [
    [
      [lon - d, lat - d],
      [lon + d, lat - d],
      [lon + d, lat + d],
      [lon - d, lat + d],
      [lon - d, lat - d],
    ],
  ],
});
const AREAS = mapWarnings([square("1", 79.504, 29.6908, 0.08), square("2", 77.59, 12.97, 0.15)]);
const map = (warnings = AREAS) => ({ warnings }) as IndiaMap;
const NOW = Date.parse("2026-11-22T09:00:00+05:30");
const page = (snap: WarningsSnapshot | null, lang: "en" | "hi" | "kn" = "en", m = map()) =>
  renderWarningsPage(snap, lang, m, NOW);
const text = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");

test("/warnings: a fixed title and heading in the searched words, in three languages", () => {
  const en = page(SNAP);
  assert.equal(
    en.match(/<title>([^<]*)<\/title>/)![1],
    "Weather warnings in India today: IMD and NDMA alerts by state | mugilu",
  );
  assert.match(en, /<h1 class="t-title">Official weather warnings across India now<\/h1>/);
  assert.match(renderWarningsPage(null, "hi"), /<title>भारत में आज मौसम की चेतावनी: राज्यवार IMD और NDMA अलर्ट/);
  assert.match(renderWarningsPage(null, "kn"), /<h1 class="t-title">ಭಾರತದಲ್ಲಿ ಈಗಿನ ಅಧಿಕೃತ ಹವಾಮಾನ ಎಚ್ಚರಿಕೆಗಳು<\/h1>/);
});

test("/warnings: the warnings in one line: how many, where, and the most common type", () => {
  const s = text(page(SNAP));
  assert.match(s, /The latest 3 official NDMA \/ IMD alerts across India\./);
  assert.match(s, /The warnings in force now cover \d+ places in 2 states\./);
  assert.match(s, /Most common type: Thunderstorm, lightning\./);
  const desc = page(SNAP).match(/<meta name="description" content="([^"]*)"/)![1];
  assert.match(desc, /^The latest 3 official NDMA \/ IMD alerts across India\. The warnings in force now cover/);
  assert.ok(desc.length <= 160, desc);
});

test("/warnings: one place in one state is said in the singular", () => {
  const one = map(mapWarnings([square("1", 79.504, 29.6908, 0.08)]));
  assert.match(text(page(SNAP, "en", one)), /The warnings in force now cover 1 place in 1 state\./);
});

test("/warnings: the places under a warning, by state, the state with the most first; each links its page", () => {
  const html = page(SNAP);
  assert.match(html, /<h2 class="bar"[^>]*>[^]*?<span>Places under a warning now, by state<\/span><\/h2>/);
  const states = [
    ...html.matchAll(
      /<h3 class="wgrp">(?:<a href="\/state\/[a-z-]+">)?([^<]+)(?:<\/a>)?<span class="n">(\d+)<\/span><\/h3>/g,
    ),
  ];
  assert.deepEqual(states.map((m) => m[1]).sort(), ["Karnataka", "Uttarakhand"]);
  assert.ok(+states[0][2] >= +states[1][2], "the state with more places first");
  assert.match(html, /href="\/c\/almora"/);
  assert.doesNotMatch(html, /href="\/c\/nainital"/);
  assert.match(page(SNAP, "hi"), /href="\/hi\/c\/almora"/);
});

test("/warnings: what yellow, orange and red mean, also when there is no warning", () => {
  for (const snap of [SNAP, null, { ...SNAP, alerts: [] } as WarningsSnapshot]) {
    const html = renderWarningsPage(snap);
    const s = text(html);
    assert.match(html, /<h2 class="bar"[^>]*>[^]*?<span>Yellow, orange and red: what they mean<\/span><\/h2>/);
    assert.match(s, /Green No warning\. No action is needed\./);
    assert.match(s, /Yellow Be updated\./);
    assert.match(s, /Orange Be prepared\./);
    assert.match(s, /Red Take action\./);
    assert.match(s, /IMD says a red warning does not mean a "red alert"\. It means "take action"\./);
    assert.match(s, /Where the warnings come from/);
  }
  const hi = text(renderWarningsPage(null, "hi"));
  const kn = text(renderWarningsPage(null, "kn"));
  for (const s of [hi, kn])
    for (const en of [/what they mean/, /Be prepared/, /Take action/, /Where the warnings come from/])
      assert.doesNotMatch(s, en);
});

test("/warnings: a named cyclone whose alert has no area marks the places it names, as /places does", () => {
  const akvan =
    "The SEVERE CYCLONIC STORM AKVAN with maximum wind speed of 90-100 gusting to 110 Kmph lays centred at 1130 IST of 18.11.26 near latitude 13.1N and longitude 85.4E, 540 Km southeast of Narsapur, Andhra Pradesh. Cyclone Warning for Alluri Sitharama Raju, Anakapalli, Srikakulam, Visakhapatnam, Vizianagaram.";
  const snap = { ...SNAP, alerts: [alert("9", akvan, "IMD Visakhapatnam")] } as unknown as WarningsSnapshot;
  const html = page(snap, "en", map([]));
  assert.match(
    html,
    /<h3 class="wgrp"><a href="\/state\/andhra-pradesh">Andhra Pradesh<\/a><span class="n">5<\/span><\/h3>/,
  );
  assert.match(html, /href="\/c\/srikakulam"/);
});

test("/warnings: no map areas leaves out the places line and the by-state panel", () => {
  const html = renderWarningsPage(SNAP, "en");
  assert.doesNotMatch(text(html), /in force now cover/);
  assert.doesNotMatch(html, /by state<\/span>/);
});

test("/warnings route: names the places under the stored map's warnings", async () => {
  const { testWorker } = await import("./helpers/worker");
  const { MAP_KEY } = await import("../src/indiamap");
  const w = testWorker();
  const { WARNINGS_KEY } = await import("../src/snapshot");
  await w.env.OAQ_R2.put(WARNINGS_KEY, JSON.stringify(SNAP));
  const far = "2099-01-01T00:00:00+05:30";
  await w.env.OAQ_R2.put(
    MAP_KEY,
    JSON.stringify({
      cells: [{ x: 0 }],
      dots: [],
      cyclones: [],
      warnings: AREAS.map((a) => ({ ...a, expires: far })),
      generated_at: "2026-11-22T03:00:00Z",
      hash: "x",
    }),
  );
  const res = await w.get("/warnings");
  assert.equal(res.status, 200);
  assert.match(await res.text(), /href="\/c\/almora"/);
});
