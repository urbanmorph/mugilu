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

const HOT_VS_NORMAL = {
  today_max_c: 41,
  normal_max_c: 36,
  anomaly_c: 5,
  notable: true,
  date: "2026-05-25",
  period: "late May",
  baseline: "1991-2020 normals",
  source: "era5",
};

test("renderConditionsPage: a notable high vs normal is said on the heat layer, labelled as modelled", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-05-25T06:00:00Z") }); // the high's own day, IST
  const html = renderConditionsPage(conditions({ heat_vs_normal: HOT_VS_NORMAL }));
  assert.match(html, /The high today is 41°C\. That is 5°C above normal for late May\./);
  assert.match(html, /Today's high is a model value \(Open-Meteo\)\. The normal is from ERA5 data for 1991-2020\./);
  const hi = renderConditionsPage(conditions({ heat_vs_normal: HOT_VS_NORMAL }), "everyone", undefined, "hi");
  assert.match(hi, /आज का अनुमानित अधिकतम तापमान 41°C है, जो मई के अंत में सामान्य से 5°C अधिक है/);
  assert.doesNotMatch(hi, /Today.s high/);
  const kn = renderConditionsPage(conditions({ heat_vs_normal: HOT_VS_NORMAL }), "everyone", undefined, "kn");
  assert.match(kn, /ಇಂದಿನ ಅಂದಾಜು ಗರಿಷ್ಠ ತಾಪಮಾನ 41°C, ಈ ಸ್ಥಳದಲ್ಲಿ ಮೇ ತಿಂಗಳ ಕೊನೆಯಲ್ಲಿ ಸಾಮಾನ್ಯಕ್ಕಿಂತ 5°C ಹೆಚ್ಚು/);
});

test("renderConditionsPage: a notable high from yesterday (cached past IST midnight) is not shown", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-05-25T18:40:00Z") }); // 00:10 IST on the 26th
  assert.doesNotMatch(renderConditionsPage(conditions({ heat_vs_normal: HOT_VS_NORMAL })), /above normal/);
});

test("renderConditionsPage: a small difference from normal stays quiet", () => {
  const html = renderConditionsPage(
    conditions({ heat_vs_normal: { ...HOT_VS_NORMAL, today_max_c: 37, anomaly_c: 1, notable: false } }),
  );
  assert.doesNotMatch(html, /above normal|1991-2020/);
});

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
  assert.match(renderConditionsPage(moderateAir, "asthma"), /class="amb-act">[^<]*exercise hard/);
  assert.doesNotMatch(renderConditionsPage(moderateAir, "everyone"), /class="amb-act"/);
});

test("renderEmbed: a persona card carries that group's own step", () => {
  const moderateAir = conditions({ air: { ...conditions().air!, aqi: 150, band: "moderate" } });
  assert.match(renderEmbed(moderateAir, "asthma", "https://mugilu.live"), /class="eact">[^<]*exercise hard/);
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
  assert.match(nearby[1], /Near this point, but not at it/);
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

// The order the layers appear in, read from the rendered page.
const layerOrder = (html: string) => [...html.matchAll(/<div class="lyr[^"]*" data-k="([a-z]+)"/g)].map((m) => m[1]);

test("renderConditionsPage: on a calm day, layers follow what people check first, sun beside heat, then rain", () => {
  const html = renderConditionsPage(
    conditions({
      rain: { probability_pct: 20, precipitation_mm: 0, source: "open-meteo" },
      wind: { speed_kmh: 8, gust_kmh: 12, direction_deg: 90, source: "open-meteo" },
    }),
  );
  assert.deepEqual(layerOrder(html), ["air", "heat", "sun", "rain", "wind", "dust"]);
});

test("renderConditionsPage: the worst hazard comes first, then whatever else is elevated", () => {
  const html = renderConditionsPage(
    conditions({
      uv: { index: 11, source: "open-meteo" }, // high
      dust: { dust_ug_m3: 90, aod: 0.5, source: "open-meteo" }, // caution
    }),
  );
  assert.deepEqual(layerOrder(html).slice(0, 3), ["sun", "dust", "air"]);
  assert.match(html, /<div class="lyr on" data-k="sun"/);
});

test("renderConditionsPage: rain falling now moves up past calm layers", () => {
  const html = renderConditionsPage(
    conditions({
      dust: { dust_ug_m3: 90, aod: 0.5, source: "open-meteo" },
      rain: { probability_pct: 90, precipitation_mm: 4, source: "open-meteo" },
    }),
  );
  const o = layerOrder(html);
  assert.ok(o.indexOf("rain") < o.indexOf("air"), o.join(","));
});

test("renderConditionsPage: a 40% chance of rain is enough to move rain up; 39% is not", () => {
  const at = (pct: number) =>
    layerOrder(
      renderConditionsPage(conditions({ rain: { probability_pct: pct, precipitation_mm: 0, source: "open-meteo" } })),
    );
  assert.ok(at(40).indexOf("rain") < at(40).indexOf("heat"), at(40).join(","));
  assert.ok(at(39).indexOf("rain") > at(39).indexOf("heat"), at(39).join(","));
});

test("renderConditionsPage: a persona's own hazards come first among equals", () => {
  const html = renderConditionsPage(
    conditions({ rain: { probability_pct: 20, precipitation_mm: 0, source: "open-meteo" } }),
    "asthma",
  );
  assert.deepEqual(layerOrder(html), ["air", "dust", "heat", "sun", "rain"]);
});

test("renderConditionsPage: a cold driver lights the heat layer", () => {
  const html = renderConditionsPage(
    conditions({ heat: { temp_c: -2, humidity_pct: 60, apparent_c: -6, wet_bulb_c: -3, source: "open-meteo" } }),
  );
  assert.match(html, /<div class="lyr on" data-k="heat"/);
  assert.equal(layerOrder(html)[0], "heat");
});

test("renderConditionsPage: laptops get two columns, the reading pinned beside the layers", () => {
  const html = renderConditionsPage(conditions());
  assert.match(html, /<div class="cx-l">[\s\S]*class="amb"[\s\S]*<\/div>\s*<div class="cx-r">\s*<dl class="strata">/);
  assert.match(html, /@media\(min-width:960px\)\{[^}]*main:has\(>\.cx\)\{max-width:/);
});

// The graphics on each layer (glyphs.ts), drawn against the limits the read uses.
const layerHtml = (html: string, k: string) =>
  html.match(new RegExp(`<div class="lyr[^"]*" data-k="${k}">[\\s\\S]*?</dd></div>`))?.[0] ?? "";

test("renderConditionsPage: air shows a bar per pollutant against its CPCB limit, not a line of numbers", () => {
  const html = renderConditionsPage(conditions({ air: { ...conditions().air!, pollutants: { pm25: 64, pm10: 218 } } }));
  const air = layerHtml(html, "air");
  assert.match(air, /<div class="prs">/);
  assert.match(air, /<div class="pr over"><span>PM10<\/span>/);
  assert.doesNotMatch(air, /class="poll"/);
  assert.match(air, /class="lb"/, "years of life lost as blocks");
});

test("renderConditionsPage: hot heat shows wet-bulb and WBGT against their thresholds", () => {
  const html = renderConditionsPage(
    conditions({
      heat: { temp_c: 44, humidity_pct: 18, apparent_c: 47, wet_bulb_c: 24, wbgt_c: 33, source: "open-meteo" },
    }),
  );
  const heat = layerHtml(html, "heat");
  assert.equal([...heat.matchAll(/<div class="g"/g)].length, 2);
  assert.match(heat, /wet-bulb 24°/);
  assert.match(heat, /WBGT 33°/);
});

test("renderConditionsPage: cold heat shows feels-like against the cold thresholds instead", () => {
  const html = renderConditionsPage(
    conditions({ heat: { temp_c: 2, humidity_pct: 60, apparent_c: -1, wet_bulb_c: 0, source: "open-meteo" } }),
  );
  const heat = layerHtml(html, "heat");
  assert.equal([...heat.matchAll(/<div class="g"/g)].length, 1);
  assert.equal([...heat.matchAll(/class="gt"/g)].length, 3);
  assert.match(heat, /class="gf" style="left:22.5%;width:0%"/, "a dot, not a bar that reads as heat");
});

test("renderConditionsPage: a notable high vs normal draws today against the normal", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-05-25T08:00:00Z") });
  const html = renderConditionsPage(conditions({ heat_vs_normal: HOT_VS_NORMAL } as Partial<Conditions>));
  const heat = layerHtml(html, "heat");
  assert.match(heat, /class="gm" style="left:75%"/, "41 on a 26-46 ruler around the normal of 36");
});

test("renderConditionsPage: wind gets a compass, rain drops, sun the UV steps, visibility and smoke a ruler", () => {
  const html = renderConditionsPage(
    conditions({
      wind: { speed_kmh: 18, gust_kmh: 46, direction_deg: 270, source: "open-meteo" },
      rain: { probability_pct: 40, precipitation_mm: 0, source: "open-meteo" },
      uv: { index: 11, source: "open-meteo" },
      visibility: { meters: 1000, source: "open-meteo" },
      smoke: { count: 3, frp_sum: 12, nearest_km: 42, radius_km: 100, source: "firms" },
    } as Partial<Conditions>),
  );
  assert.match(layerHtml(html, "wind"), /<svg class="cmp"[\s\S]*rotate\(90 /);
  assert.match(layerHtml(html, "rain"), /<svg class="drops"/);
  assert.match(layerHtml(html, "sun"), /<span class="uv"/);
  assert.match(layerHtml(html, "fog"), /class="gf" style="left:0%;width:50%"/, "1 km halfway on 100 m-10 km");
  assert.match(layerHtml(html, "smoke"), /class="gm" style="left:42%"/);
  assert.doesNotMatch(html, /class="scale/, "the old gradient bars are gone");
});

// What each persona should look at on the right: their own layers tagged, the
// reading that matters most to them picked out, the rest quieter.
const tagged = (html: string) => layerOrder(html).filter((k) => /<span class="fy">/.test(layerHtml(html, k)));

test("renderConditionsPage: a persona's own layers carry a 'for you' tag; the others are quieter", () => {
  const c = conditions({ uv: { index: 7, source: "open-meteo" } });
  assert.deepEqual(tagged(renderConditionsPage(c, "asthma")), ["air", "dust"]);
  assert.deepEqual(tagged(renderConditionsPage(c, "child")).sort(), ["air", "dust", "heat", "sun"]);
  assert.deepEqual(tagged(renderConditionsPage(c)), [], "everyone: no tags");
  assert.match(
    renderConditionsPage(c, "asthma"),
    /<div class="lyr[^"]*\bquiet\b[^"]*" data-k="(fog|wind|rain)"|<div class="lyr quiet" data-k="heat"/,
  );
  assert.doesNotMatch(renderConditionsPage(c), /class="lyr[^"]*\bquiet\b/);
  // The headline hazard (UV 7 here) is never quiet, even when it is not the persona's trigger.
  assert.match(renderConditionsPage(c, "asthma"), /<div class="lyr on" data-k="sun"/);
});

test("renderConditionsPage: the reading that matters most to a persona is picked out", () => {
  const air = { ...conditions().air!, pollutants: { pm25: 40, pm10: 90, no2: 20 } };
  const heat = { temp_c: 38, humidity_pct: 40, apparent_c: 41, wet_bulb_c: 26, wbgt_c: 31, source: "open-meteo" };
  const keys = (html: string) => [...html.matchAll(/<div class="pr[^"]*\bkey\b[^"]*"><span>([^<]+)/g)].map((m) => m[1]);
  assert.deepEqual(keys(renderConditionsPage(conditions({ air }), "asthma")), ["PM2.5", "PM10"]);
  assert.deepEqual(keys(renderConditionsPage(conditions({ air }), "heart")), ["PM2.5"]);
  assert.deepEqual(keys(renderConditionsPage(conditions({ air }))), []);
  assert.match(renderConditionsPage(conditions({ heat }), "outdoor"), /<span class="gl key">WBGT 31°/);
  assert.match(renderConditionsPage(conditions({ heat }), "elderly"), /<span class="gl key">wet-bulb 26°/);
  assert.doesNotMatch(renderConditionsPage(conditions({ heat })), /class="gl key"/);
});

test("renderEmbed: the card's readings follow the order every surface uses", () => {
  const c = conditions({
    heat: { temp_c: 45, humidity_pct: 20, apparent_c: 48, wet_bulb_c: 26, source: "open-meteo" },
    uv: { index: 9, source: "open-meteo" },
  });
  const html = renderEmbed(c, "everyone", "https://mugilu.live");
  const order = [...html.matchAll(/<div class="eread"><b[^>]*>[^<]*<\/b><span>([^<]+)/g)].map((m) => m[1]);
  assert.match(order[0], /feels like/, order.join(" | "));
});
