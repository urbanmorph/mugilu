import { test } from "node:test";
import assert from "node:assert/strict";
import { renderConditionsPage, renderEmbed, renderKioskPage } from "../src/page";
import { personaAlso } from "../src/score";
import { ambientRisk } from "../src/score";
import type { Conditions } from "../src/types";
import type { Lang } from "../src/i18n";

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
  /falling now/,
  /MW total/,
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
    kiosk: renderKioskPage(c, "asthma", "https://mugilu.live/c/new-delhi", "<svg></svg>", lang),
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
  assert.match(kn, /class="amb-also"/);
});

test("English pages keep their English wording", () => {
  const text = visible(renderConditionsPage(c, "asthma", undefined, "en"));
  for (const re of [/also watch: smoke is severe/, /% humidity/, /km\/h steady/, /from W/, /MW total/])
    assert.match(text, re);
});
