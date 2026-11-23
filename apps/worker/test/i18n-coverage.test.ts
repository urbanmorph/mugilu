import { test } from "node:test";
import assert from "node:assert/strict";
import { renderConditionsPage } from "../src/pages/place";
import { renderEmbed } from "../src/pages/embed";
import { renderKioskPage } from "../src/pages/kiosk";
import { personaAlso } from "../src/score";
import { ambientRisk } from "../src/score";
import type { Conditions } from "../src/types";
import { TR, type Lang } from "../src/i18n";
import { FIXTURE_NOW, testWorker } from "./helpers/worker";
import { storeWarnArea } from "../src/warnareas";

// Every layer present, an official warning over the spot, more nearby, and an
// asthma persona whose own trigger (air) is elevated but is not the headline (heat).
const c = {
  location: { lat: 28.61, lon: 77.21 },
  place: "New Delhi, Delhi",
  as_of: "2026-06-26T14:05:00.000Z",
  air: {
    aqi: 180,
    band: "moderate",
    pollutants: { pm25: 70 },
    yll: 6.4,
    station: { id: "x", name: "y", city: "Delhi", distance_km: 2 },
    source: "cpcb",
  },
  heat: { temp_c: 44, humidity_pct: 30, apparent_c: 47, wet_bulb_c: 27, wbgt_c: 33, source: "open-meteo" },
  rain: { precipitation_mm: 2, probability_pct: 40, source: "open-meteo" },
  uv: { index: 9, source: "open-meteo" },
  dust: { dust_ug_m3: 120, source: "open-meteo" },
  wind: { speed_kmh: 20, gust_kmh: 45, direction_deg: 270, source: "open-meteo" },
  visibility: { meters: 800, source: "open-meteo" },
  smoke: { count: 30, frp_sum: 150, nearest_km: 12, radius_km: 100, source: "firms" },
  warnings: [
    { event: "Heat Wave", severity: "Severe", color: "red", until: "27 Jun 18:00", area: "Delhi", issuer: "IMD" },
    { event: "Dust Storm", severity: "Moderate", color: "orange", area: "Delhi", issuer: "IMD" },
  ],
  nearby_warnings: [
    { event: "Thunderstorm", severity: "Moderate", color: "yellow", until: "27 Jun 20:00", area: "X", issuer: "IMD" },
  ],
  attribution: "Sources: CPCB (Govt. of India) via OAQ · Open-Meteo (CC-BY 4.0), via mugilu",
  disclaimer:
    "Informational only, not for medical, emergency, or safety-critical decisions. For official hazard warnings consult NDMA / IMD.",
} as unknown as Conditions;

/** The text a reader sees (scripts that run in the page included: the kiosk's
 *  strings are in its script), without styles and structured data. */
function visible(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ");
}

// English fragments that must not reach a hi/kn reader.
const LEAKS = [
  /also watch/,
  /\bactual\b/,
  /\bhumidity\b/,
  /wet-bulb/,
  /km\/h steady/,
  /\bfrom (N|NE|E|SE|S|SW|W|NW)\b/,
  /of rain now/,
  /MW of fire power/,
  /\bnearest \d/,
  /burning/,
  /fires &lt;100/,
  /\buntil\b/,
  /Official warning/,
  /\bmore\b/,
  /\bas of\b/,
  /Embed this/,
  /Live widget/,
  /timestamped image/,
  /feels like/,
  /Reading the sky/,
  /Checking the air/,
  /min ago/,
  /yrs life lost/,
  /\bAQI (Moderate|Poor|Severe)/,
  /\b(High|Severe|Moderate) (heat|air|dust)\b/,
];

for (const lang of ["hi", "kn"] as Lang[]) {
  const pages = {
    page: renderConditionsPage(c, "asthma", "https://mugilu.live/c/new-delhi", lang),
    kiosk: renderKioskPage(c, "asthma", "https://mugilu.live/c/new-delhi", lang),
    embed: renderEmbed(c, "asthma", "https://mugilu.live", lang),
  };
  for (const [name, html] of Object.entries(pages)) {
    test(`${name} (${lang}): no English UI text leaks through`, () => {
      const text = visible(html);
      for (const re of LEAKS) assert.doesNotMatch(text, re, `${name} ${lang}: ${re}`);
    });
  }
}

test("the persona 'also watch' line is localised, not an English sentence looked up whole", () => {
  assert.match(personaAlso(ambientRisk(c, "asthma"))!, /^For asthma & lungs, also watch: smoke is severe\.$/);
  const kn = renderConditionsPage(c, "asthma", undefined, "kn");
  assert.match(kn, /class="row-c also"/);
});

test("English pages keep their English wording", () => {
  const text = visible(renderConditionsPage(c, "asthma", undefined, "en"));
  for (const re of [/also watch: smoke is severe/, /% humidity/, /km\/h steady/, /from W/, /MW of fire power/])
    assert.match(text, re);
});

// ── Every page in hi and kn, through the real worker: no English fallback a reader sees,
// in the text or in the words a screen reader or a search result shows (aria-label, title,
// alt, placeholder, the page title and description). Latin that stays Latin on purpose is
// listed here: brand and source names, acronyms, units, and the data the fixtures carry
// (place and office names, which are proper nouns).
const PAGES = [
  "/",
  "/c/delhi",
  "/c/delhi?kiosk",
  "/embed/28.61,77.21",
  "/s/cpcb/6081",
  "/places",
  "/warnings",
  "/display",
  "/about",
  "/methodology",
  "/terms",
  "/no-such-page",
];
const LATIN_OK = new Set(
  (
    "mugilu bharatlas mdshare yellide urbanmorph via km kmph mm mg min h ref your-site com iframe " +
    // the persona values typed into a display link (?as=asthma)
    "asthma child outdoor heart elderly"
  ).split(" "),
);
// Data the fixtures carry, as written: names with a lowercase word, and source credits.
const DATA =
  /Jammu and Kashmir|Itanagar capital complex|Central Pollution Control Board, Government of India|Govt\. of India|ERA5 \(Copernicus C3S\) normals|mugilu\.live|(?:^|\s)\/[a-z/{},.?=]+/g;

/** What a hi/kn reader is shown, as text runs: text nodes, the attributes read aloud or shown,
 *  the title and description. Quoted text marked with its own language, code samples and
 *  scripts are left out (scripts get their strings through t()). */
function shown(html: string): string[] {
  const b = html
    .replace(/<(script|style|svg|template|code|pre|textarea)\b[\s\S]*?<\/\1>/g, " ")
    .replace(/<(\w+)[^>]*\blang="(?!hi|kn)[a-z-]+"[^>]*>[\s\S]*?<\/\1>/g, " ");
  const attrs = [...b.matchAll(/\b(?:aria-label|title|alt|placeholder)="([^"]*)"/g)].map((m) => m[1]);
  const meta = [
    ...b.matchAll(/<meta (?:name|property)="(?:description|og:title|og:description)" content="([^"]*)"/g),
  ].map((m) => m[1]);
  const text = b.replace(/<(meta|link)\b[^>]*>/g, " ").split(/<[^>]+>/);
  return [...meta, ...attrs, ...text]
    .map((s) =>
      s
        .replace(/&[a-z#0-9]+;/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

for (const lang of ["hi", "kn"] as const) {
  test(`${lang}: no English fallback on any page (text, labels, title, description)`, async () => {
    const w = testWorker();
    // An official warning in force, so home opens on the Warnings layer and /places marks places.
    await storeWarnArea(w.env, {
      identifier: "1",
      event: "Heat Wave",
      severity: "Severe",
      expires: new Date(FIXTURE_NOW + 6 * 3_600_000).toISOString(),
      issuer: "controlroom@ndma.gov.in (IMD Delhi)",
      headline: "Heat wave",
      areaDesc: "Delhi",
      rings: [
        [
          [76.8, 28.4],
          [77.4, 28.4],
          [77.4, 28.9],
          [76.8, 28.9],
        ],
      ],
    });
    const leaks = new Set<string>();
    for (const p of PAGES) {
      const res = await w.get(`/${lang}${p === "/" ? "" : p}`, { headers: { accept: "text/html" } });
      for (const run of shown(await res.text())) {
        const rest = run.replace(/https?:\/\/\S+|\S+\.(?:ts|txt)\b/g, " ").replace(DATA, " ");
        const english = (rest.match(/\b[a-z][a-z'-]+\b/g) ?? []).filter((x) => !LATIN_OK.has(x));
        // A key shown as itself is a missing translation, unless its translation is the same Latin (JSON).
        const untranslated = run in TR && TR[run][lang] !== run;
        if (untranslated || english.length) leaks.add(`${p}: ${run.slice(0, 100)}`);
      }
    }
    assert.deepEqual([...leaks], []);
  });
}

test("every entry in the translation table has its hi and kn", () => {
  const empty = Object.entries(TR)
    .filter(([, v]) => !v.hi || !v.kn)
    .map(([k]) => k);
  assert.deepEqual(empty, []);
});
