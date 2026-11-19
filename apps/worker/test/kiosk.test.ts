import { test } from "node:test";
import assert from "node:assert/strict";
import { renderKioskPage } from "../src/pages/kiosk";
import { renderDisplayBuilder } from "../src/pages/display";
import { renderConditionsPage } from "../src/pages/place";
import type { Conditions } from "../src/types";
import { kioskJs } from "../src/pages/kiosk";

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
  assert.match(html, /\/c\/bengaluru\?kiosk&amp;as=elderly/);
  assert.match(html, /<input type="hidden" name="as" value="elderly">/);
  assert.match(html, /value="elderly" checked/); // the persona is selected
});

test("renderKioskPage: a persona display shows that group's own step", () => {
  const c = conditions();
  const hot = { ...c, heat: { ...c.heat!, apparent_c: 42 } };
  assert.match(renderKioskPage(hot, "outdoor", "https://mugilu.live/c/delhi"), /class="t-lead act">[^<]*shade/);
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
  assert.match(tile("heat"), /<p class="qa">wet-bulb 27° <b class="ql">caution<\/b><\/p>/);
  assert.doesNotMatch(tile("heat"), /class="gauge/, "lines only: a screen read from across a room");
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
  assert.match(
    html,
    /<button type="button" class="btn" id="dhere" hidden>[\s\S]*Use this screen&#39;s location<\/button>/,
  );
  // where the screen stands becomes the place (the preview and the link follow, persona kept)
  assert.match(html, /DSP\.here=function\(a,o\)\{place=a\+','\+o;set\(\);\}[\s\S]*getElementById\('dhere'\)/);
  assert.match(html, /function url\(\)\{return LP\+'\/c\/'\+place\+'\?kiosk'\+q\(\);\}/);
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

test("kiosk fit: the level word keeps 60% of its size before the also-watch and normal lines go", () => {
  const js = kioskJs("en");
  assert.match(js, /shrink\(s0\*\.6\);while\(over\(\)&&drop\.length\)drop\.pop\(\)\.hidden=true;shrink\(24\);/);
  assert.match(js, /querySelectorAll\('\.also,\.knorm'\)/);
});

test("kiosk refresh: one loading loop at a time, stopped on success and on failure", async () => {
  const { kioskJs } = await import("../src/pages/kiosk");
  const js = kioskJs("en");
  assert.match(js, /function showLoad\(\)\{clearTimeout\(vbT\);/);
  assert.match(js, /function hideLoad\(\)\{clearTimeout\(vbT\);/);
  assert.match(js, /replaceChild\([^)]*\)[^;]*;hideLoad\(\);start\(\);/);
});

test("display: every reading tile carries its hazard icon, as the place page's rows do", () => {
  const html = renderKioskPage(conditions(), "everyone", "https://mugilu.live/c/delhi");
  const tiles = [...html.matchAll(/<div class="ktile" data-k="(\w+)">([\s\S]*?)<\/div>/g)];
  assert.ok(tiles.length >= 2);
  for (const [, key, body] of tiles) assert.match(body, /^<svg class="ico[^"]*" aria-hidden="true"/, key);
  const place = renderConditionsPage(conditions(), "everyone", "https://mugilu.live/c/delhi");
  for (const [, key, body] of tiles) {
    const icon = body.match(/<path d="([^"]+)"/)![1];
    assert.ok(place.includes(icon), `${key}: the same icon as the place page`);
  }
});

test("display: the quiet line's readings carry their icons too", () => {
  const html = renderKioskPage(conditions(), "everyone", "https://mugilu.live/c/delhi");
  const quiet = html.match(/<p class="kquiet">([\s\S]*?)<\/p>/)?.[1] ?? "";
  const items = [...quiet.matchAll(/<span class="qi">([\s\S]*?)<\/span><\/span>|<span class="qi">([\s\S]*?)<\/span>/g)];
  assert.ok(items.length >= 1, "the quiet line has readings");
  for (const m of quiet.split('<span class="qi">').slice(1)) assert.match(m, /^<svg class="ico/);
});

test("display: every official warning over the place, each with its icon, and the ones nearby", () => {
  const c = conditions({
    warnings: [
      { event: "Heat Wave", severity: "Severe", color: "red", until: "27 Jun 18:00", area: "Delhi", issuer: "IMD" },
      {
        event: "Cyclone",
        headline: "Severe Cyclonic Storm Akvan over the Bay of Bengal",
        severity: "Severe",
        color: "red",
        area: "Delhi",
        issuer: "IMD",
      },
    ],
    nearby_warnings: [
      { event: "Thunderstorm", severity: "Moderate", color: "yellow", until: "27 Jun 20:00", area: "X", issuer: "IMD" },
    ],
  } as Partial<Conditions>);
  const html = renderKioskPage(c, "everyone", "https://mugilu.live/c/delhi");
  assert.match(html, /Heat Wave/);
  assert.match(html, /Severe Cyclonic Storm Akvan/);
  assert.doesNotMatch(html, /\+1 more/);
  const kw = html.match(/<ul class="kwarn">([\s\S]*?)<\/ul>/)?.[1] ?? "";
  assert.equal((kw.match(/<li class="t-lead"/g) ?? []).length, 2);
  assert.match(kw, /<li class="near"><svg class="ico[\s\S]*Thunderstorm/);
  assert.match(kw, /<li[^>]*><svg class="ico[^>]*><path d="[^"]+"\/><\/svg>[\s\S]*Severe Cyclonic Storm Akvan/);
  assert.match(html, /Thunderstorm/);
});
