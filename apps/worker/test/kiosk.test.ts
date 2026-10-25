import { test } from "node:test";
import assert from "node:assert/strict";
import { renderKioskPage, renderDisplayBuilder } from "../src/page";
import type { Conditions } from "../src/types";

function conditions(overrides: Partial<Conditions> = {}): Conditions {
  return {
    location: { lat: 28.61, lon: 77.21 },
    as_of: "2026-06-28T11:00:00.000Z",
    air_as_of: "2026-06-28T11:00:00.000Z",
    place: "Delhi, Delhi",
    air: {
      aqi: 140,
      band: "moderate",
      pollutants: { pm25: 14 },
      station: { id: "x", name: "X", city: "Delhi", distance_km: 2 },
      source: "cpcb",
    },
    heat: { temp_c: 41, humidity_pct: 31, apparent_c: 46, wet_bulb_c: 27, source: "open-meteo" },
    uv: { index: 7, source: "open-meteo" },
    dust: { dust_ug_m3: 232, source: "open-meteo" },
    rain: { precipitation_mm: 0, probability_pct: 43, source: "open-meteo" },
    attribution: "Sources: CPCB via OAQ, Open-Meteo (CC-BY 4.0), via mugilu",
    disclaimer: "Informational only, not for medical, emergency, or safety-critical decisions.",
    ...overrides,
  };
}

test("renderKioskPage: full-bleed display with the QR, self-refresh and wake lock", () => {
  const html = renderKioskPage(conditions(), "everyone", "https://mugilu.live/c/delhi", "<svg>QR</svg>");
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /Delhi, Delhi/); // place
  assert.match(html, /Ambient/); // the headline read
  assert.match(html, /<svg>QR<\/svg>/); // the QR is injected for the phone hand-off
  assert.match(html, /scan to see this/i);
  assert.match(html, /wakeLock/); // keeps the screen awake (tablets/phones)
  // self-refresh: a soft fetch-and-swap (no white flash) with a periodic hard-reload backstop
  assert.match(html, /DOMParser/);
  assert.match(html, /location\.reload/);
  assert.match(html, /class="kload"/); // the blur + spinner loading overlay
  assert.match(html, /Reading the sky/); // creative loading verbs while it fetches
  assert.match(html, /\.bar,\.foot\{display:none\}/); // no site chrome on a wall display
  assert.match(html, /Air/);
  assert.match(html, /Heat/);
});

test("renderKioskPage: canonical points at the plain /c page (dedup, not indexed twice)", () => {
  const html = renderKioskPage(conditions(), "elderly", "https://mugilu.live/c/delhi", "<svg/>");
  assert.match(html, /<link rel="canonical" href="https:\/\/mugilu\.live\/c\/delhi">/);
});

test("renderDisplayBuilder: pick a place, weight it, open the kiosk", () => {
  const html = renderDisplayBuilder("everyone");
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /Put mugilu/);
  assert.match(html, /\/c\/bengaluru\?kiosk/); // a popular tile opens the kiosk
  assert.match(html, /action="\/go"/); // search routes through /go
  assert.match(html, /name="kiosk" value="1"/); // ...carrying the kiosk flag
  assert.match(html, /Fully Kiosk/); // the unattended how-to
});

test("renderDisplayBuilder: a chosen persona carries into the tiles and the search", () => {
  const html = renderDisplayBuilder("elderly");
  assert.match(html, /\/c\/bengaluru\?kiosk&as=elderly/);
  assert.match(html, /name="as" value="elderly"/);
  assert.match(html, /class="on"/); // the persona pill is selected
});

test("renderKioskPage: a persona display shows that group's own step", () => {
  const c = conditions();
  const hot = { ...c, heat: { ...c.heat!, apparent_c: 42 } };
  assert.match(
    renderKioskPage(hot, "outdoor", "https://mugilu.live/c/delhi", "<svg>QR</svg>"),
    /class="kact"[^>]*>[^<]*shade/,
  );
});

// The display, rebuilt: tiles in the order they matter, each drawn; the rest in one quiet line.
const tiles = (html: string) => [...html.matchAll(/<div class="kt[^"]*" data-k="([a-z]+)"/g)].map((m) => m[1]);
const quiet = (html: string) => html.match(/<p class="kquiet">([\s\S]*?)<\/p>/)?.[1] ?? "";

test("renderKioskPage: up to four tiles in order of risk, the headline first; the rest in a quiet line", () => {
  const html = renderKioskPage(conditions(), "everyone", "https://mugilu.live/c/delhi", "<svg/>");
  assert.deepEqual(tiles(html), ["heat", "dust", "air", "sun"]);
  assert.match(quiet(html), /Rain <b>43%<\/b>/);
  assert.match(html, /<div class="kt on" data-k="heat"/);
});

test("renderKioskPage: each tile carries its graphic, drawn against the limits", () => {
  const html = renderKioskPage(conditions(), "everyone", "https://mugilu.live/c/delhi", "<svg/>");
  const tile = (k: string) => html.match(new RegExp(`data-k="${k}">[\\s\\S]*?(?=data-k=|</section>)`))?.[0] ?? "";
  assert.match(tile("heat"), /class="g"/);
  assert.match(tile("sun"), /class="uv"/);
  assert.match(tile("air"), /class="prs"/);
});

test("renderKioskPage: the backdrop takes the hazard's tint", () => {
  const html = renderKioskPage(conditions(), "everyone", "https://mugilu.live/c/delhi", "<svg/>");
  assert.match(html, /<div class="k" style="--cond:#dc2626;--tint:#f97316;--tk:34%">/);
});

test("renderKioskPage: a notable high vs normal sits beside the read", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-06-28T09:00:00Z") });
  const hvn = {
    today_max_c: 45,
    normal_max_c: 40,
    anomaly_c: 5,
    notable: true,
    date: "2026-06-28",
    period: "late June",
    baseline: "1991-2020 normals",
    source: "era5",
  };
  const html = renderKioskPage(
    conditions({ heat_vs_normal: hvn } as Partial<Conditions>),
    "everyone",
    "https://mugilu.live/c/x",
    "<svg/>",
  );
  assert.match(html, /<div class="knorm">[\s\S]*?5°C above normal/);
});

test("renderKioskPage: a calm day still fills four tiles, and a persona gets their own step", () => {
  const calm = conditions({
    air: { aqi: 30, band: "good", pollutants: { pm25: 12 }, station: null, source: "cpcb" },
    heat: { temp_c: 24, humidity_pct: 60, apparent_c: 24, wet_bulb_c: 19, source: "open-meteo" },
    uv: { index: 4, source: "open-meteo" },
    dust: { dust_ug_m3: 5, source: "open-meteo" },
    rain: { precipitation_mm: 0, probability_pct: 20, source: "open-meteo" },
    wind: { speed_kmh: 9, gust_kmh: 16, direction_deg: 250, source: "open-meteo" },
  } as Partial<Conditions>);
  const html = renderKioskPage(calm, "everyone", "https://mugilu.live/c/x", "<svg/>");
  assert.deepEqual(tiles(html), ["air", "heat", "sun", "rain"]);
  assert.match(quiet(html), /Wind <b>16 km\/h<\/b>[\s\S]*Dust <b>5 µg\/m³<\/b>/);
  assert.match(html, /--tint:#38bdf8/);
  const outdoor = renderKioskPage(conditions(), "outdoor", "https://mugilu.live/c/x", "<svg/>");
  assert.match(outdoor, /class="kact"/);
});
