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
const BANDS: RiskBand[] = ["low", "moderate", "high", "severe"];
const SCORE: Record<number, number> = { 0: 15, 1: 45, 2: 72, 3: 95 };

// Hazards each persona is extra-sensitive to (bumped one level if already risky).
// Heat and Cold are separate identities: cold, dry air is an asthma trigger, but
// asthma isn't heat-sensitive; the elderly/very young/exposed feel both extremes.
const SENSITIVE: Record<Persona, string[]> = {
  everyone: [],
  asthma: ["Air", "Dust", "Smoke", "Cold"],
  elderly: ["Heat", "Cold", "Air", "Smoke"],
  child: ["UV", "Air", "Heat", "Cold", "Smoke"],
  outdoor: ["Heat", "Cold", "UV", "Smoke"],
  heart: ["Heat", "Cold", "Air", "Smoke"],
};

export interface HazardRisk {
  hazard: string;
  band: RiskBand;
  level: number;
}
export interface AmbientRisk {
  band: RiskBand;
  score: number; // 0–100 proxy of the worst hazard (band midpoint)
  driver: string; // the dominant hazard
  persona: Persona;
  hazards: HazardRisk[];
}

function airLevel(c: Conditions): number | null {
  switch (c.air?.band) {
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

/** Hot-side thermal stress (0-3) from wet-bulb, feels-like and WBGT. */
function heatLevel(c: Conditions): number {
  const wb = c.heat?.wet_bulb_c;
  const ap = c.heat?.apparent_c;
  const wbgt = c.heat?.wbgt_c;
  let lvl = 0;
  if (wb != null) lvl = Math.max(lvl, wb >= 31 ? 3 : wb >= 28 ? 2 : wb >= 26 ? 1 : 0);
  if (ap != null) lvl = Math.max(lvl, ap >= 45 ? 3 : ap >= 40 ? 2 : ap >= 35 ? 1 : 0);
  // WBGT (simplified shade estimate; runs hot in dry heat) — aligned to BoM's
  // categories (35+ extreme, 32-34 very high, 30-31 high) so it contributes
  // without over-escalating past the wet-bulb survivability read.
  if (wbgt != null) lvl = Math.max(lvl, wbgt >= 35 ? 3 : wbgt >= 32 ? 2 : wbgt >= 30 ? 1 : 0);
  return lvl;
}

/** Cold-side stress (0-3) from feels-like (wind chill is already in apparent_c).
 *  Calibrated to IMD cold-wave territory for the plains; severe at sub-zero. */
function coldLevel(c: Conditions): number {
  const ap = c.heat?.apparent_c;
  if (ap == null) return 0;
  return ap <= 0 ? 3 : ap <= 5 ? 2 : ap <= 10 ? 1 : 0;
}

/** Thermal stress as ONE directional hazard. A point right now is either too hot
 *  or too cold, never both, so heat and cold share a slot but report distinct
 *  drivers ("Heat" / "Cold") — with their own persona-sensitivity and advice. */
function thermalRisk(c: Conditions): [string, number] | null {
  if (c.heat?.wet_bulb_c == null && c.heat?.apparent_c == null && c.heat?.wbgt_c == null) return null;
  const hot = heatLevel(c);
  const cold = coldLevel(c);
  return cold > hot ? ["Cold", cold] : ["Heat", hot];
}

function uvLevel(c: Conditions): number | null {
  const u = c.uv?.index;
  if (u == null) return null;
  // UV is real but mitigable (shade/sunscreen/timing) and chronic, not acute-
  // fatal. So for the general population it caps at "high" only when extreme
  // (11+); very-high 6–10 is "moderate", a sun-care nudge, not an emergency.
  // Persona amplification escalates it for children / outdoor workers.
  return u >= 11 ? 2 : u >= 6 ? 1 : 0;
}

function dustLevel(c: Conditions): number | null {
  const d = c.dust?.dust_ug_m3;
  if (d == null) return null;
  return d >= 500 ? 3 : d >= 150 ? 2 : d >= 80 ? 1 : 0;
}

// Fire/crop-burn smoke: active FIRMS detections (VIIRS) within 100km, last 24h.
// Bands benchmarked against multi-season India archive data — local density at
// populated points: peak-Nov Punjab belt 72-93, pre-monsoon-Apr central forest
// ~90, max land-grid 147-385; shoulder/off-peak 25-60; metros single digits.
// Severe is reserved for the genuine burning belt; below 3 fires is negligible.
// Exported as the single source for both "worth showing" (null) and the band,
// so the renderers don't re-encode these literals.
export function smokeLevel(s: SmokeConditions | null | undefined): number | null {
  if (!s || (s.count < 3 && s.frp_sum < 20)) return null;
  if (s.count >= 60 || s.frp_sum >= 350) return 3;
  if (s.count >= 25 || s.frp_sum >= 120) return 2;
  return 1;
}
/** Plain word for a smoke level (1/2/3); index 0 is unused. */
export const SMOKE_WORD = ["", "some", "notable", "heavy"];

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
    ["Air", airLevel(c)],
    thermalRisk(c) ?? ["Heat", null],
    ["UV", uvLevel(c)],
    ["Dust", dustLevel(c)],
    ["Smoke", smokeLevel(c.smoke)],
    ["Warning", warnLevel(c)],
  ];

  const hazards: HazardRisk[] = [];
  for (const [hazard, level] of checks) {
    if (level == null) continue;
    const amped = sensitive.includes(hazard) && level >= 1 ? Math.min(3, level + 1) : level;
    hazards.push({ hazard, level: amped, band: BANDS[amped] });
  }

  if (hazards.length === 0) {
    return { band: "low", score: 0, driver: "none", persona, hazards };
  }
  const worst = hazards.reduce((a, b) => (b.level > a.level ? b : a));
  return { band: worst.band, score: SCORE[worst.level], driver: worst.hazard, persona, hazards };
}

// What each band means in plain language, per dominant hazard, so the score
// explains itself and never just says "High" with no context.
const ADVICE: Record<string, Partial<Record<RiskBand, string>>> = {
  Air: {
    moderate: "Air is so-so, fine for most people.",
    high: "Air is poor. Sensitive groups, take it easy.",
    severe: "Air is dangerous. Stay indoors if you can.",
  },
  Heat: {
    moderate: "It's warm, so keep water handy.",
    high: "Heat is high. Slow down, hydrate, find shade.",
    severe: "Dangerous heat. Avoid being outdoors.",
  },
  Cold: {
    moderate: "It's cold out. Layer up.",
    high: "Cold conditions. Cover up and limit time outside.",
    severe: "Dangerous cold. Stay warm indoors if you can.",
  },
  UV: {
    moderate: "Strong sun, a hat or sunscreen helps.",
    high: "The sun is very strong. Limit midday hours.",
    severe: "Extreme sun. Cover up and skip the midday hours.",
  },
  Dust: {
    moderate: "Some dust in the air.",
    high: "Dusty. Mask up if you're sensitive.",
    severe: "Heavy dust. Limit time outdoors.",
  },
  Smoke: {
    moderate: "Fires burning nearby. Sensitive groups, watch the air.",
    high: "Heavy burning nearby. Keep windows shut, limit time outdoors.",
    severe: "Intense fires nearby. Treat the air as hazardous; stay indoors.",
  },
  Warning: {
    moderate: "An official advisory is in effect.",
    high: "An official warning is active. Stay alert.",
    severe: "A serious warning is active. Follow official guidance.",
  },
};

/** One plain sentence explaining the band and what to do (replaces the old verdict). */
export function ambientMeaning(risk: AmbientRisk): string {
  if (risk.band === "low") return "Conditions are good right now.";
  return ADVICE[risk.driver]?.[risk.band] ?? "Take some care outdoors.";
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
 *  it's elevated (high+) but isn't the headline driver — so an asthmatic on a
 *  severe-heat day still hears the air is bad, without the heat being buried.
 *  Returns null for "everyone" or when the driver already is their concern. */
export function personaAlso(risk: AmbientRisk): string | null {
  if (risk.persona === "everyone") return null;
  const sensitive = SENSITIVE[risk.persona] ?? [];
  const top = risk.hazards
    .filter((h) => sensitive.includes(h.hazard) && h.hazard !== risk.driver && h.level >= 2)
    .sort((a, b) => b.level - a.level)[0];
  if (!top) return null;
  return `For ${PERSONA_LABEL[risk.persona].toLowerCase()}, also watch: ${HAZARD_NOUN[top.hazard] ?? top.hazard.toLowerCase()} is ${top.band}.`;
}
