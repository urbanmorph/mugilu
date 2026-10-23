import { test } from "node:test";
import assert from "node:assert/strict";
import { renderConditionsPage, renderEmbed, renderKioskPage, renderWarningsPage } from "../src/page";
import type { WarningsSnapshot } from "../src/sachet";
import type { Conditions } from "../src/types";

function conditions(overrides: Partial<Conditions> = {}): Conditions {
  return {
    location: { lat: 12.97, lon: 77.59 },
    as_of: "2026-06-26T14:05:00.000Z",
    air: {
      aqi: 57,
      band: "satisfactory",
      pollutants: { pm25: 25 },
      yll: 1.96,
      station: { id: "airnet-x", name: "Kumarapark", city: "Bengaluru", distance_km: 2.29 },
      source: "airnet",
    },
    heat: { temp_c: 22, humidity_pct: 80, apparent_c: 24, wet_bulb_c: 20, source: "open-meteo" },
    rain: { precipitation_mm: 0, source: "open-meteo" },
    uv: { index: 0, source: "open-meteo" },
    dust: { dust_ug_m3: 3, aod: 0.16, source: "open-meteo" },
    attribution: "Sources: Airnet / CSTEP via OAQ · Open-Meteo (CC-BY 4.0) — via mugilu",
    disclaimer: "Informational only — not for medical, emergency, or safety-critical decisions.",
    ...overrides,
  };
}

test("renderConditionsPage: a valid HTML document with the brand and place", () => {
  const html = renderConditionsPage(conditions());
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /mugilu/);
  assert.match(html, /Bengaluru/);
});

test("renderConditionsPage: has a back-to-search link (consistent with other pages)", () => {
  const html = renderConditionsPage(conditions());
  assert.match(html, /class="cxback"/);
  assert.match(html, /Look up another place/);
});

test("renderConditionsPage: a sub-zero reading renders as Cold (directional thermal)", () => {
  const c = conditions({ heat: { temp_c: 2, apparent_c: -1, humidity_pct: 70, source: "open-meteo" }, air: null });
  const html = renderConditionsPage(c);
  assert.match(html, /cold/i); // headline + advice are cold, not "warm"/"heat"
  assert.doesNotMatch(html, /Severe heat|dangerous heat/i);
});

test("renderConditionsPage: records the visit into the browser 'Your places' store", () => {
  const html = renderConditionsPage(conditions());
  assert.match(html, /mugilu:places/); // localStorage recorder present
  assert.match(html, /h1\.loc/); // reads the reverse-geocoded label off the page
  // the coordinate is exposed so NAMED slug pages (/c/bengaluru, no comma) record too
  assert.match(html, /data-ll="12\.97,77\.59"/);
  // a native-script search term (passed via #q=) is honoured as the recents label
  assert.match(html, /\[#&\]q=/);
});

test("renderConditionsPage: emits a canonical link when given one (named-URL SEO)", () => {
  const html = renderConditionsPage(conditions(), "everyone", "https://mugilu.live/c/bengaluru");
  assert.match(html, /<link rel="canonical" href="https:\/\/mugilu\.live\/c\/bengaluru">/);
});

test("renderConditionsPage: schema.org Dataset JSON-LD (credits + machine-readable distributions)", () => {
  const html = renderConditionsPage(conditions(), "everyone", "https://mugilu.live/c/bengaluru");
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /"Dataset"/);
  assert.match(html, /c\/bengaluru\.json/); // distribution points at the JSON sibling
  assert.match(html, /mugilu\.live\/terms/); // licence
  // a BreadcrumbList rides in the same @graph (mugilu -> place)
  assert.match(html, /"BreadcrumbList"/);
  assert.match(html, /"ListItem"/);
  assert.match(html, /"position":2/);
});

test("renderConditionsPage: og:image is the page's own share snapshot", () => {
  const html = renderConditionsPage(conditions(), "everyone", "https://mugilu.live/c/bengaluru");
  assert.match(html, /property="og:image" content="https:\/\/mugilu\.live\/c\/bengaluru\.png"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
});

test("renderConditionsPage: has a meta description (SEO) naming the place", () => {
  const html = renderConditionsPage(conditions());
  assert.match(html, /<meta name="description" content="[^"]+">/);
  assert.match(html, /<meta name="description" content="[^"]*Bengaluru/);
});

test("renderConditionsPage: stamps freshness as a relative <time> (absolute fallback + upgrade script)", () => {
  const html = renderConditionsPage(conditions());
  // server renders the absolute IST time inside a data-rel <time> (the no-JS fallback)
  assert.match(html, /<time[^>]*data-rel[^>]*datetime="[^"]+"[^>]*>[^<]*IST/);
  // and the shell ships the tiny upgrade script that rewrites it to "X ago" at view-time
  assert.match(html, /time\[data-rel\]\[datetime\]/);
  assert.doesNotMatch(html, /this spot, right now/); // the bare "right now" is gone
});

test("renderConditionsPage: shows the air, heat and disclaimer", () => {
  const html = renderConditionsPage(conditions());
  assert.match(html, /57/); // AQI value
  assert.match(html, /AQI/);
  assert.match(html, /24°/); // feels-like
  assert.match(html, /not for medical/);
});

test("renderConditionsPage: surfaces wet-bulb and the pollutant breakdown", () => {
  const html = renderConditionsPage(conditions());
  // wet-bulb is surfaced with a plain survivability tag
  assert.match(html, /wet.?bulb/i);
  assert.match(html, /safe|caution|severe|dangerous/i);
  // the pollutant breakdown is now shown on the air row (gases surfaced)
  assert.match(html, /PM2\.5/);
  // ...but the dust internals stay in the .json/.md siblings only
  assert.doesNotMatch(html, /aerosol|\baod\b/i);
});

test("renderConditionsPage: verdict escalates for severe air", () => {
  const c = conditions();
  const html = renderConditionsPage({ ...c, air: { ...c.air!, band: "severe", aqi: 420 } });
  assert.match(html, /care|avoid|dangerous/i);
});

test("renderConditionsPage: falls back to coords when no station/air", () => {
  const html = renderConditionsPage(conditions({ air: null }));
  assert.match(html, /12\.97/);
});

test("renderConditionsPage: cross-links nearby places in the same state (internal linking)", () => {
  const html = renderConditionsPage(conditions(), "everyone", "https://mugilu.live/c/bengaluru");
  assert.match(html, /class="nearby"/);
  assert.match(html, /Nearby:/);
  assert.match(html, /<a href="\/c\/[a-z][a-z0-9-]*">/); // links to other named pages, not coords
  assert.match(html, /href="\/places"/); // and a path to the full directory
});

test("renderConditionsPage: no nearby block on a bare-coordinate page (no state anchor)", () => {
  const html = renderConditionsPage(conditions(), "everyone", "https://mugilu.live/c/12.97,77.59");
  assert.doesNotMatch(html, /class="nearby"/);
});

test("renderConditionsPage: shows the persona's own step when its trigger drives the read", () => {
  const moderateAir = conditions({ air: { ...conditions().air!, aqi: 150, band: "moderate" } });
  assert.match(renderConditionsPage(moderateAir, "asthma"), /class="amb-act">[^<]*hard exercise/);
  assert.doesNotMatch(renderConditionsPage(moderateAir, "everyone"), /class="amb-act"/);
});

test("renderEmbed: a persona card carries that group's own step", () => {
  const moderateAir = conditions({ air: { ...conditions().air!, aqi: 150, band: "moderate" } });
  assert.match(renderEmbed(moderateAir, "asthma", "https://mugilu.live"), /class="eact">[^<]*hard exercise/);
  assert.doesNotMatch(renderEmbed(moderateAir, "everyone", "https://mugilu.live"), /class="eact"/);
});

test("kiosk + embed carry a not-medical-advice disclaimer (no room for the full one)", () => {
  const c = conditions();
  assert.match(
    renderEmbed(c, "asthma", "https://mugilu.live"),
    /class="edisc">Informational only, not medical advice\./,
  );
  assert.match(
    renderKioskPage(c, "asthma", "https://mugilu.live/c/12.97,77.59", "<svg></svg>"),
    /class="kdisc">Informational only, not medical advice\./,
  );
  assert.match(renderEmbed(c, "asthma", "https://mugilu.live", "hi"), /चिकित्सीय सलाह नहीं/);
});

test("titles are escaped exactly once (og:title showed '&amp;amp;')", () => {
  const html = renderConditionsPage(
    conditions({ place: "Daman & Diu" }),
    "everyone",
    "https://mugilu.live/c/20.4,72.8",
  );
  assert.match(html, /<title>Daman &amp; Diu: /);
  assert.match(html, /<meta property="og:title" content="Daman &amp; Diu: /);
  assert.doesNotMatch(html, /&amp;amp;/);
});

test("attribute values escape quotes, so upstream text can't break out of an attribute", () => {
  const html = renderConditionsPage(
    conditions({ place: 'Foo" onmouseover="x' }),
    "everyone",
    "https://mugilu.live/c/12.97,77.59",
  );
  assert.doesNotMatch(html, /onmouseover="x/);
  assert.match(html, /Foo&quot; onmouseover=&quot;x/);
});

test("renderWarningsPage: a CAP link is only linked when it is http(s)", () => {
  const alert = (link: string) => ({
    identifier: "1",
    headline: "Heavy rain",
    category: "Met",
    issuer: "IMD",
    sent: "",
    link,
  });
  const snap = (link: string) => ({ generated_at: "", count: 1, alerts: [alert(link)] }) as unknown as WarningsSnapshot;
  assert.match(
    renderWarningsPage(snap("https://sachet.ndma.gov.in/cap/1.xml")),
    /href="https:\/\/sachet\.ndma\.gov\.in\/cap\/1\.xml"/,
  );
  assert.doesNotMatch(renderWarningsPage(snap("javascript:alert(1)")), /javascript:/);
});

test("renderConditionsPage: a missing feels-like is not read as 0° 'dangerous cold'", () => {
  const html = renderConditionsPage(
    conditions({ heat: { temp_c: 31, apparent_c: undefined, wet_bulb_c: 22, source: "open-meteo" } }),
    "everyone",
  );
  assert.doesNotMatch(html, /dangerous cold/i);
});

test("renderConditionsPage: warnings over the spot stand out; nearby ones get one quiet line, marked as not over it", () => {
  const w = (event: string, covers: boolean) => ({
    event,
    severity: "Severe",
    color: "orange",
    certainty: "",
    area: "nlr-kavali Mandal",
    issuer: "APSDMA",
    until: "Fri Oct 23, 10:20",
    identifier: event,
    headline: "",
    covers,
  });
  const html = renderConditionsPage(
    conditions({ warnings: [w("Lightning", true)], nearby_warnings: [w("Heavy Rain", false)] }),
  );
  assert.match(html, /class="warn"[^>]*>[\s\S]*?Lightning/);
  const nearby = html.match(/<p class="near-warn">([\s\S]*?)<\/p>/);
  assert.ok(nearby, "a nearby line");
  assert.match(nearby[1], /Nearby, not over this spot/);
  assert.match(nearby[1], /Heavy Rain/);
  const boxes = [...html.matchAll(/<div class="warn"[\s\S]*?<\/div><\/div>/g)].map((m) => m[0]);
  assert.equal(boxes.length, 1, "one warning box: the one over the spot");
  assert.doesNotMatch(boxes[0], /Heavy Rain/);
  assert.doesNotMatch(renderConditionsPage(conditions()), /class="near-warn"/);
});

test("renderConditionsPage: many nearby warnings of one kind are counted, not repeated", () => {
  const w = (identifier: string, event: string) => ({
    event,
    severity: "",
    color: "yellow",
    certainty: "",
    area: "",
    issuer: "",
    until: "Fri Oct 23, 15:10",
    identifier,
    headline: "",
    covers: false,
  });
  const html = renderConditionsPage(
    conditions({
      nearby_warnings: [w("1", "Lightning"), w("2", "Lightning"), w("3", "Lightning"), w("4", "Heavy Rain")],
    }),
  );
  const line = html.match(/<p class="near-warn">([\s\S]*?)<\/p>/)![1];
  assert.match(line, /Lightning \(3\)/);
  assert.match(line, /Heavy Rain \(until Fri Oct 23, 15:10\)/);
  assert.equal(line.match(/Lightning/g)!.length, 1);
});
