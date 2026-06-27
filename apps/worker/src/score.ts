import type { Conditions, Warning } from "./types";

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
const SENSITIVE: Record<Persona, string[]> = {
  everyone: [],
  asthma: ["Air", "Dust"],
  elderly: ["Heat", "Air"],
  child: ["UV", "Air", "Heat"],
  outdoor: ["Heat", "UV"],
  heart: ["Heat", "Air"],
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

function heatLevel(c: Conditions): number | null {
  const wb = c.heat?.wet_bulb_c;
  const ap = c.heat?.apparent_c;
  if (wb == null && ap == null) return null;
  let lvl = 0;
  if (wb != null) lvl = Math.max(lvl, wb >= 31 ? 3 : wb >= 28 ? 2 : wb >= 26 ? 1 : 0);
  if (ap != null) lvl = Math.max(lvl, ap >= 45 ? 3 : ap >= 40 ? 2 : ap >= 35 ? 1 : 0);
  return lvl;
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
    ["Heat", heatLevel(c)],
    ["UV", uvLevel(c)],
    ["Dust", dustLevel(c)],
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
