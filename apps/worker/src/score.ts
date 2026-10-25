import type { Conditions, SmokeConditions, Warning } from "./types";

// The Ambient risk, mugilu's signature read. The WORST active hazard, never an
// average (so it can't be diluted and isn't air-biased), with the dominant
// hazard named. Personas bump the hazards they're sensitive to up one level.
// Informational only. The disclaimer rides with every response.

export type Persona = "everyone" | "asthma" | "elderly" | "child" | "outdoor" | "heart";
export const PERSONAS: Persona[] = ["everyone", "asthma", "elderly", "child", "outdoor", "heart"];

/** Validate a ?as= value against the known personas; default to everyone. */
export function parsePersona(s: string | null | undefined): Persona {
  return s && (PERSONAS as string[]).includes(s) ? (s as Persona) : "everyone";
}

/** Plain-language persona labels, no jargon on the visible site. */
export const PERSONA_LABEL: Record<Persona, string> = {
  everyone: "Everyone",
  asthma: "Asthma & lungs",
  elderly: "Older adults",
  child: "Children",
  outdoor: "Outdoor workers",
  heart: "Heart condition",
};

export type RiskBand = "low" | "moderate" | "high" | "severe";
export const RISK_BANDS: RiskBand[] = ["low", "moderate", "high", "severe"];
const SCORE: Record<number, number> = { 0: 15, 1: 45, 2: 72, 3: 95 };

// Hazards each persona is extra-sensitive to (bumped one level if already risky).
// Heat and Cold are separate identities: cold, dry air is an asthma trigger, but
// asthma isn't heat-sensitive; the elderly/very young/exposed feel both extremes.
// Outdoor workers breathe air and dust for hours while exerting, the "prolonged
// exposure" CPCB's health statements are written for; children feel dust too.
export const SENSITIVE: Record<Persona, string[]> = {
  everyone: [],
  asthma: ["Air", "Dust", "Smoke", "Cold"],
  elderly: ["Heat", "Cold", "Air", "Smoke"],
  child: ["UV", "Air", "Dust", "Heat", "Cold", "Smoke"],
  outdoor: ["Heat", "Cold", "UV", "Air", "Dust", "Smoke"],
  heart: ["Heat", "Cold", "Air", "Smoke"],
};

export interface HazardRisk {
  hazard: string;
  band: RiskBand;
  level: number;
  /** Level before the persona bump: what the hazard itself is (e.g. CPCB moderate). */
  base: number;
}
export interface AmbientRisk {
  band: RiskBand;
  level: number; // 0–3, the worst hazard's level (band as an integer)
  /** The driver's level before the persona bump: what the hazard itself is. */
  base: number;
  score: number; // 0–100 proxy of the worst hazard (band midpoint)
  driver: string; // the dominant hazard
  persona: Persona;
  hazards: HazardRisk[];
}

/** Air's level from its CPCB band: moderate / poor / very poor and severe. */
export function airLevelOf(band: string | undefined): number | null {
  switch (band) {
    case "good":
    case "satisfactory":
      return 0;
    case "moderate":
      return 1;
    case "poor":
      return 2;
    case "vpoor":
    case "severe":
      return 3;
    default:
      return null;
  }
}

// ── The thresholds: the ONE source for every hazard cutoff ─────────────────────
// Each list holds the caution / high / severe edges (levels 1, 2, 3). Rising
// hazards count a value at or above an edge; falling ones (cold, fog) at or below
// / below it. The page words, the home hero and both methodology tables read these.
export const THRESHOLDS = {
  /** °C feels-like; IMD heat-wave territory. */
  apparent: [35, 40, 45],
  /** °C wet-bulb; ~31 is the survivability limit. */
  wetBulb: [26, 28, 31],
  /** °C WBGT (simplified shade estimate; runs hot in dry heat), aligned to BoM's
   *  categories (30-31 high, 32-34 very high, 35+ extreme) so it contributes
   *  without over-escalating past the wet-bulb survivability read. */
  wbgt: [30, 32, 35],
  /** °C feels-like, at or below; IMD cold-wave territory for the plains, severe sub-zero. */
  cold: [10, 5, 0],
  /** km/h gusts; IMD squall + high-wind thresholds. */
  wind: [40, 62, 88],
  /** metres of visibility, below. */
  fog: [1000, 500, 200],
  /** µg/m³ dust. */
  dust: [80, 150, 500],
  /** UV index. Real but mitigable (shade/sunscreen/timing) and chronic, not acute-fatal,
   *  so it caps at high: very-high 6-10 is a sun-care nudge, extreme 11+ is high. */
  uv: [6, 11],
  /** Active fires within 100 km in 24h, or their summed fire power (MW). */
  smokeCount: [3, 25, 60],
  smokeFrp: [20, 120, 350],
} as const;

/** How many edges a value reaches: 0 (none) to edges.length. */
const atOrAbove = (v: number, edges: readonly number[]) => edges.filter((e) => v >= e).length;
const atOrBelow = (v: number, edges: readonly number[]) => edges.filter((e) => v <= e).length;
const below = (v: number, edges: readonly number[]) => edges.filter((e) => v < e).length;

export const dustLevelOf = (ug: number) => atOrAbove(ug, THRESHOLDS.dust);

/** Hot-side thermal stress (0-3): the worst of wet-bulb, feels-like and WBGT. */
export function heatLevelOf(h: { apparent_c?: number; wet_bulb_c?: number; wbgt_c?: number }): number {
  return Math.max(
    h.wet_bulb_c != null ? atOrAbove(h.wet_bulb_c, THRESHOLDS.wetBulb) : 0,
    h.apparent_c != null ? atOrAbove(h.apparent_c, THRESHOLDS.apparent) : 0,
    h.wbgt_c != null ? atOrAbove(h.wbgt_c, THRESHOLDS.wbgt) : 0,
  );
}

/** Cold-side stress (0-3) from feels-like (wind chill is already in apparent_c). */
export const coldLevelOf = (apparent: number) => atOrBelow(apparent, THRESHOLDS.cold);
export const windLevelOf = (gust: number) => atOrAbove(gust, THRESHOLDS.wind);
export const fogLevelOf = (meters: number) => below(meters, THRESHOLDS.fog);

/** The methodology table (caution / high / severe), built from THRESHOLDS so the
 *  published numbers can never drift from the ones the code applies. Hazard labels
 *  are i18n keys. */
export const THRESHOLD_ROWS: { hazard: string; cells: [string, string, string] }[] = (() => {
  const T = THRESHOLDS;
  const deg = (e: readonly number[]) => e.map((x) => `${x}°`) as [string, string, string];
  const plain = (e: readonly number[], pre = "", post = "") =>
    e.map((x) => `${pre}${x}${post}`) as [string, string, string];
  return [
    // CPCB's own bands (airLevelOf): moderate / poor / very poor and severe.
    { hazard: "Air (AQI)", cells: ["101–200", "201–300", "301+"] },
    { hazard: "Heat (feels-like)", cells: deg(T.apparent) },
    { hazard: "Heat (wet-bulb)", cells: deg(T.wetBulb) },
    { hazard: "Heat (WBGT)", cells: deg(T.wbgt) },
    { hazard: "Cold (feels-like)", cells: T.cold.map((x) => `≤${x}°`) as [string, string, string] },
    { hazard: "Wind (gusts, km/h)", cells: plain(T.wind) },
    { hazard: "Fog (visibility, m)", cells: plain(T.fog, "<") },
    { hazard: "Smoke (fires <100 km)", cells: plain(T.smokeCount, "", "+") },
    { hazard: "UV (index)", cells: [`${T.uv[0]}–${T.uv[1] - 1}`, `${T.uv[1]}+`, "-"] },
    { hazard: "Dust (µg/m³)", cells: plain(T.dust) },
  ];
})();

function heatLevel(c: Conditions): number {
  return c.heat ? heatLevelOf(c.heat) : 0;
}

function coldLevel(c: Conditions): number {
  const ap = c.heat?.apparent_c;
  return ap == null ? 0 : coldLevelOf(ap);
}

/** Thermal stress as ONE directional hazard. A point right now is either too hot
 *  or too cold, never both, so heat and cold share a slot but report distinct
 *  drivers ("Heat" / "Cold"), with their own persona-sensitivity and advice. */
function thermalRisk(c: Conditions): [string, number] | null {
  if (c.heat?.wet_bulb_c == null && c.heat?.apparent_c == null && c.heat?.wbgt_c == null) return null;
  const hot = heatLevel(c);
  const cold = coldLevel(c);
  return cold > hot ? ["Cold", cold] : ["Heat", hot];
}

function uvLevel(c: Conditions): number | null {
  const u = c.uv?.index;
  // Persona amplification escalates UV for children / outdoor workers.
  return u == null ? null : atOrAbove(u, THRESHOLDS.uv);
}

function dustLevel(c: Conditions): number | null {
  const d = c.dust?.dust_ug_m3;
  return d == null ? null : dustLevelOf(d);
}

/** Wind hazard from gusts: strong / gale-squall / storm-cyclonic. Drives dust
 *  storms and falling hazards. */
function windLevel(c: Conditions): number | null {
  const g = c.wind?.gust_kmh ?? c.wind?.speed_kmh;
  return g == null ? null : windLevelOf(g);
}

/** Fog / low visibility: a major driving + health hazard in north-India winters. */
function fogLevel(c: Conditions): number | null {
  const v = c.visibility?.meters;
  return v == null ? null : fogLevelOf(v);
}

// Fire/crop-burn smoke: active FIRMS detections (VIIRS) within 100km, last 24h.
// Bands benchmarked against multi-season India archive data: local density at
// populated points: peak-Nov Punjab belt 72-93, pre-monsoon-Apr central forest
// ~90, max land-grid 147-385; shoulder/off-peak 25-60; metros single digits.
// Severe is reserved for the genuine burning belt; below 3 fires is negligible.
// Exported as the single source for both "worth showing" (null) and the band,
// so the renderers don't re-encode these literals.
export function smokeLevel(s: SmokeConditions | null | undefined): number | null {
  if (!s) return null;
  const level = Math.max(atOrAbove(s.count, THRESHOLDS.smokeCount), atOrAbove(s.frp_sum, THRESHOLDS.smokeFrp));
  return level || null;
}

function warnLevel(c: Conditions): number | null {
  if (!c.warnings?.length) return null;
  const colors = c.warnings.map((w: Warning) => w.color.toLowerCase());
  if (colors.includes("red")) return 3;
  if (colors.includes("orange")) return 2;
  if (colors.includes("yellow")) return 1;
  return 1; // a warning with no colour is at least moderate
}

export function ambientRisk(c: Conditions, persona: Persona = "everyone"): AmbientRisk {
  const sensitive = SENSITIVE[persona] ?? [];
  const checks: Array<[string, number | null]> = [
    ["Air", airLevelOf(c.air?.band)],
    thermalRisk(c) ?? ["Heat", null],
    ["UV", uvLevel(c)],
    ["Dust", dustLevel(c)],
    ["Wind", windLevel(c)],
    ["Fog", fogLevel(c)],
    ["Smoke", smokeLevel(c.smoke)],
    ["Warning", warnLevel(c)],
  ];

  const hazards: HazardRisk[] = [];
  for (const [hazard, level] of checks) {
    if (level == null) continue;
    const amped = sensitive.includes(hazard) && level >= 1 ? Math.min(3, level + 1) : level;
    hazards.push({ hazard, level: amped, band: RISK_BANDS[amped], base: level });
  }

  if (hazards.length === 0) {
    return { band: "low", level: 0, base: 0, score: 0, driver: "none", persona, hazards };
  }
  const worst = hazards.reduce((a, b) => (b.level > a.level ? b : a));
  return {
    band: worst.band,
    level: worst.level,
    base: worst.base,
    score: SCORE[worst.level],
    driver: worst.hazard,
    persona,
    hazards,
  };
}

// The headline's words: the band ("Severe") and the hazard's noun ("heat"), as in
// "Severe heat." on every surface (the page, the display, the image).
export const RISK_LABEL: Record<RiskBand, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  severe: "Severe",
};
export const COND_NOUN: Record<string, string> = {
  Air: "air",
  Heat: "heat",
  Cold: "cold",
  UV: "sun",
  Dust: "dust",
  Wind: "wind",
  Fog: "fog",
  Smoke: "smoke",
  Warning: "alert",
  none: "sky",
};

/** The headline's two parts in the reader's language: the band word ("Severe") and
 *  the hazard noun ("heat"), or "All clear" with no noun when the read is calm. */
export function headline(
  risk: Pick<AmbientRisk, "band" | "driver">,
  tr: (en: string) => string = (en) => en,
): { word: string; noun: string | null } {
  if (risk.band === "low") return { word: tr("All clear"), noun: null };
  return { word: tr(RISK_LABEL[risk.band]), noun: tr(COND_NOUN[risk.driver] ?? "sky") };
}

// What each band means in plain language, per dominant hazard, so the score
// explains itself and never just says "High" with no context.
export const ADVICE: Record<string, Partial<Record<RiskBand, string>>> = {
  Air: {
    moderate: "The air is moderate. Most people can be outdoors as usual.",
    high: "The air is poor. If you are sensitive, do less outdoors.",
    severe: "The air is dangerous. Stay indoors if possible.",
  },
  Heat: {
    moderate: "It is very hot. Keep water with you.",
    high: "The heat is high. Do less, drink water and stay in the shade.",
    severe: "The heat is dangerous. Go to a cool place out of the sun. Drink water.",
  },
  Cold: {
    moderate: "It is cold outside. Wear layers of clothes.",
    high: "It is very cold. Cover your body and spend less time outside.",
    severe: "The cold is dangerous. Stay warm indoors if possible.",
  },
  UV: {
    moderate: "The sun is strong. Use a hat or sunscreen.",
    high: "The sun is very strong. Spend less time in the sun at midday.",
    severe: "The sun is extreme. Cover your skin. Stay out of the sun at midday.",
  },
  Dust: {
    moderate: "There is some dust in the air.",
    high: "There is a lot of dust. If you are sensitive, cover your nose and mouth.",
    severe: "There is heavy dust. Spend less time outdoors.",
  },
  Wind: {
    moderate: "It is windy. Tie down or bring in loose items.",
    high: "The wind is strong. Be careful outdoors. Expect dust in the air.",
    severe: "The wind can cause damage. Stay indoors, away from trees and hoardings.",
  },
  Fog: {
    moderate: "Visibility is low in some areas. Drive carefully.",
    high: "There is dense fog. Drive slowly with low beams. Give yourself more time.",
    severe: "There is very dense fog. Do not drive if possible.",
  },
  Smoke: {
    moderate: "There are fires near here. If you are sensitive, watch the air.",
    high: "There is a lot of burning near here. Keep windows closed. Spend less time outdoors.",
    severe: "There are large fires near here. The air can be dangerous. Stay indoors.",
  },
  Warning: {
    moderate: "An official advisory is active.",
    high: "An official warning is active. Be alert.",
    severe: "A serious warning is active. Do what the officials tell you.",
  },
};

/** One plain sentence explaining the band and what to do (replaces the old verdict).
 *  Describes the hazard as it is (its unbumped level), so a persona bump never
 *  renames CPCB moderate air "poor". When the persona's own trigger is raised for
 *  them, the advice for most people would contradict their headline, so the read
 *  keeps the hazard's first sentence and says how this group should take it; their
 *  own step is personaAction. `tr` translates each piece for a page. */
export function ambientMeaning(risk: AmbientRisk, tr: (en: string) => string = (en) => en): string {
  if (risk.band === "low") return tr("Conditions are good now.");
  const advice = ADVICE[risk.driver]?.[RISK_BANDS[risk.base]];
  if (!advice) return tr("Be careful outdoors.");
  if (risk.persona === "everyone" || risk.level === risk.base) return tr(advice);
  return `${tr(advice.slice(0, advice.indexOf(". ") + 1) || advice)} ${tr("For {persona}, treat it as {band}.")
    .replace("{persona}", tr(PERSONA_LABEL[risk.persona]).toLowerCase())
    .replace("{band}", tr(risk.band))}`;
}

// What a persona can do to cut its exposure when its own trigger drives the
// read. Exposure steps only (time outdoors, exertion, shade, water, windows,
// layers, someone checking in), the kind of public guidance NDMA/IMD give.
// Never medication, symptoms or diagnosis: mugilu is not medical advice (a test
// enforces this). Every SENSITIVE hazard has an entry (also enforced by a test).
export const PERSONA_ACTION: Record<Persona, Partial<Record<string, string>>> = {
  everyone: {},
  asthma: {
    Air: "Spend less time outdoors today. Do not exercise hard outside.",
    Dust: "Spend less time outdoors. Cover your nose and mouth when you go out.",
    Smoke: "Keep windows closed. Spend less time outdoors.",
    Cold: "Cover your nose and mouth when you go out in the cold.",
  },
  elderly: {
    Heat: "A hot home is also a risk. Stay in a cool place and drink water regularly. Ask someone to check on you.",
    Cold: "Keep your home warm and wear layers indoors. Ask someone to check on you.",
    Air: "Spend less time outdoors today. Avoid hard physical activity there.",
    Smoke: "Keep windows closed. Spend less time outdoors.",
  },
  child: {
    UV: "Use a hat, shade and sunscreen. Keep play short at midday.",
    Air: "Today, keep outdoor play short and easy.",
    Dust: "Today, keep outdoor play short.",
    Heat: "Give children more water and keep play in the shade. Never leave a child in a parked vehicle.",
    Cold: "Dress children in layers. Cover their head and hands.",
    Smoke: "Keep children indoors with the windows closed.",
  },
  outdoor: {
    Heat: "Drink water often and take breaks in the shade. Do not do heavy work from 12 to 3 pm.",
    Cold: "Wear layers and stay dry. Take breaks in a warm place.",
    UV: "Cover your skin and wear a hat. Take breaks in the shade at midday.",
    Air: "Do lighter work, not heavy work. Take breaks indoors.",
    Dust: "Cover your nose and mouth. Protect your eyes.",
    Smoke: "Take breaks indoors. Keep heavy work short.",
  },
  heart: {
    Heat: "Avoid hard physical activity. Stay in a cool place.",
    Cold: "Stay warm. Avoid sudden hard physical activity in the cold.",
    Air: "Avoid hard physical activity outdoors today.",
    Smoke: "Stay indoors with the windows closed. Avoid hard physical activity.",
  },
};

/** The persona's own step when the headline driver is one of its triggers;
 *  null for everyone, a low read, or a driver the persona isn't sensitive to
 *  (PERSONA_ACTION is keyed by exactly the SENSITIVE hazards). */
export function personaAction(risk: AmbientRisk): string | null {
  if (risk.band === "low") return null;
  return PERSONA_ACTION[risk.persona][risk.driver] ?? null;
}

const HAZARD_NOUN: Record<string, string> = {
  Air: "air",
  Heat: "heat",
  UV: "the sun",
  Dust: "dust",
  Smoke: "smoke",
  Warning: "the official warning",
};

/** The persona callout (option A): surface the persona's OWN top trigger when
 *  it's elevated (high+) but isn't the headline driver, so an asthmatic on a
 *  severe-heat day still hears the air is bad, without the heat being buried.
 *  Returns null for "everyone" or when the driver already is their concern.
 *  `tr` translates each piece (the template, persona, hazard and band) for a page. */
export function personaAlso(risk: AmbientRisk, tr: (en: string) => string = (en) => en): string | null {
  if (risk.persona === "everyone") return null;
  const sensitive = SENSITIVE[risk.persona] ?? [];
  const top = risk.hazards
    .filter((h) => sensitive.includes(h.hazard) && h.hazard !== risk.driver && h.level >= 2)
    .sort((a, b) => b.level - a.level)[0];
  if (!top) return null;
  return tr("For {persona}, also watch: {hazard} is {band}.")
    .replace("{persona}", tr(PERSONA_LABEL[risk.persona]).toLowerCase())
    .replace("{hazard}", tr(HAZARD_NOUN[top.hazard] ?? top.hazard.toLowerCase()))
    .replace("{band}", tr(top.band));
}

/** Everything a renderer says about the Ambient read (in English, or translated by
 *  `tr`): the hazard as it is, the persona's own step, and the persona's other
 *  elevated trigger. One place, so every surface tells personas the same. */
export function ambientSummary(
  risk: AmbientRisk,
  tr: (en: string) => string = (en) => en,
): { meaning: string; action: string | null; also: string | null } {
  const action = personaAction(risk);
  return { meaning: ambientMeaning(risk, tr), action: action && tr(action), also: personaAlso(risk, tr) };
}
