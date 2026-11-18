import { test } from "node:test";
import assert from "node:assert/strict";
import { renderKioskPage, renderDisplayBuilder, renderConditionsPage } from "../src/page";
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
  const html = renderKioskPage(conditions(), "everyone", "https://mugilu.live/c/delhi");
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /Delhi, Delhi/); // place
  assert.match(html, /Ambient/); // the headline read
  assert.match(html, /<div class="qr"><svg class="qrimg" aria-hidden="true"/); // the phone hand-off
  assert.match(html, /scan to see this/i);
  assert.match(html, /wakeLock/); // keeps the screen awake (tablets/phones)
  // self-refresh: a soft fetch-and-swap (no white flash) with a periodic hard-reload backstop
  assert.match(html, /DOMParser/);
  assert.match(html, /location\.reload/);
  assert.match(html, /<div class="kveil" aria-hidden="true">/); // the veil while it refreshes
  assert.match(html, /Reading the sky…/); // the loading verbs while it fetches
  assert.doesNotMatch(html, /<header class="sh"|<footer class="sf"/); // no site chrome on a wall display
  assert.match(html, /<body class="mg" data-kiosk>/); // always dark, kiosk type steps
  assert.match(html, /<h1 class="kname">Delhi, Delhi<\/h1>/); // the place is the page's heading
  assert.match(html, /Informational only, not for medical, emergency, or safety-critical decisions\./);
  assert.match(html, /Air/);
  assert.match(html, /Heat/);
});

test("renderKioskPage: canonical points at the plain /c page (dedup, not indexed twice)", () => {
  const html = renderKioskPage(conditions(), "elderly", "https://mugilu.live/c/delhi");
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
    renderKioskPage(hot, "outdoor", "https://mugilu.live/c/delhi"),
    /class="t-lead act">[^<]*shade/,
  );
});

// The display, rebuilt: tiles in the order they matter, each drawn; the rest in one quiet line.
const tiles = (html: string) => [...html.matchAll(/<div class="ktile" data-k="([a-z]+)"/g)].map((m) => m[1]);
const quiet = (html: string) => html.match(/<p class="kquiet">([\s\S]*?)<\/p>/)?.[1] ?? "";

test("renderKioskPage: up to four tiles in order of risk, the headline first; the rest in a quiet line", () => {
  const html = renderKioskPage(conditions(), "everyone", "https://mugilu.live/c/delhi");
  assert.deepEqual(tiles(html), ["heat", "dust", "air", "sun"]);
  assert.match(quiet(html), /Rain <b>43%<\/b>/);
  assert.match(html, /<section class="plate severe stack" aria-label="Severe heat\.">/, "the headline is the plate");
});

test("renderKioskPage: each tile carries its graphic, drawn against the limits", () => {
  const html = renderKioskPage(conditions(), "everyone", "https://mugilu.live/c/delhi");
  const tile = (k: string) => html.match(new RegExp(`data-k="${k}">[\\s\\S]*?(?=data-k=|</section>)`))?.[0] ?? "";
  assert.match(tile("heat"), /class="gauge[^"]*"/);
  assert.match(tile("air"), /class="bars"/);
  assert.match(tile("dust"), /class="chip high"/, "each tile carries its own level (232 µg/m³: high)");
});

test("renderKioskPage: the level is the plate's fill, never a wash", () => {
  const html = renderKioskPage(conditions(), "everyone", "https://mugilu.live/c/delhi");
  // The screen display has no wash: the plate is full-bleed in the level's fill instead.
  assert.match(html, /<section class="plate severe stack"/);
  assert.doesNotMatch(html, /<body[^>]*data-tint/);
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
  );
  assert.match(html, /<div class="knorm stack">[\s\S]*?5°C above normal/);
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
  const html = renderKioskPage(calm, "everyone", "https://mugilu.live/c/x");
  assert.deepEqual(tiles(html), ["air", "heat", "sun", "rain"]);
  assert.match(quiet(html), /Wind <b>16 km\/h<\/b>[\s\S]*Dust <b>5 µg\/m³<\/b>/);
  assert.match(html, /<section class="plate low stack"/);
  const outdoor = renderKioskPage(conditions(), "outdoor", "https://mugilu.live/c/x");
  assert.match(outdoor, /class="t-lead act"/);
});

// A display can be any place: a city, a neighbourhood, an exact point, or wherever the
// screen stands. /display says so, and every place page offers its own display.
test("renderDisplayBuilder: any place, not only cities, and a button for where the screen is", () => {
  const html = renderDisplayBuilder("everyone");
  assert.match(html, /placeholder="A city, area or address"/);
  assert.match(html, /A display can show a city, a neighbourhood or an exact point/);
  assert.match(html, /<button id="dhere"[^>]*hidden>[\s\S]*Use this screen&#39;s location<\/button>/);
  assert.match(html, /getCurrentPosition[\s\S]*'\/c\/'\+p\.coords\.latitude\.toFixed\(4\)[\s\S]*\?kiosk/);
  // a chosen persona carries into the located display too
  assert.match(renderDisplayBuilder("elderly"), /'\?kiosk'\+"&as=elderly"/);
});

test("renderConditionsPage: a visible 'Put this on a screen' for this exact point and persona", () => {
  const c = conditions();
  const html = renderConditionsPage(c, "elderly", "https://mugilu.live/c/delhi");
  const slug = `${c.location.lat},${c.location.lon}`;
  assert.match(
    html,
    new RegExp(
      `<a class="btn" href="/c/${slug.replace(".", "\\.")}\\?kiosk&amp;as=elderly">[\\s\\S]*?Put this on a screen</a>`,
    ),
  );
  // a button of its own beside the alerts, not only in the format row
  assert.ok(html.indexOf('class="btn" href="/c/') < html.indexOf('class="links t-meta"'));
});
