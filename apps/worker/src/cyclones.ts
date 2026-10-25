import type { Env } from "./index";
import { CYCLONES_KEY, putJson } from "./snapshot";
import { counted } from "./metrics";

// Cyclones over the North Indian Ocean, from the Joint Typhoon Warning Center (US
// Navy / Air Force; US government work, public domain). IMD is the official voice
// for India's seas but publishes no machine-readable track; JTWC does, for every
// basin. So JTWC gives the position and the track, and the pages send people to
// IMD for the warnings. JTWC's intensity (one-minute winds) differs from IMD's
// (three-minute), so its categories are never shown: position and motion only.

const FEED = "https://www.metoc.navy.mil/jtwc/rss/jtwc.rss";
const UA = { "user-agent": "mugilu.live (+https://mugilu.live/about)" };

export type Basin = "bay" | "arabian";
type Point = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

export interface Cyclone {
  /** A formation alert (it may form) or a numbered warning (it has formed). */
  kind: "alert" | "warning";
  /** JTWC's number: "98B" for an invest, "03B" for a cyclone. */
  id: string;
  /** The storm's name, once it has one ("Montha"). */
  name?: string;
  lat: number;
  lon: number;
  /** Where it is heading; absent when it is near stationary. */
  moving?: Point;
  /** Forecast centres, nearest first (warnings only). */
  track: { lat: number; lon: number }[];
  /** JTWC's issue time, DDHHMMZ. */
  issued: string;
  basin?: Basin;
}

export interface CyclonesSnapshot {
  generated_at: string;
  systems: Cyclone[];
}

/** The North Indian Ocean product texts the feed links (io + number + web.txt). */
export function jtwcProducts(rss: string): string[] {
  const urls = rss.match(/https:\/\/www\.metoc\.navy\.mil\/jtwc\/products\/io\d{4}web\.txt/g) ?? [];
  return [...new Set(urls)];
}

const POINTS: Point[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
/** Degrees (the way it moves) to the nearest of the eight points. */
export const compass = (deg: number): Point => POINTS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

// JTWC words for a heading ("WEST-NORTHWEST"), as degrees.
const HEADING: Record<string, number> = {
  NORTH: 0,
  "NORTH-NORTHEAST": 22.5,
  NORTHEAST: 45,
  "EAST-NORTHEAST": 67.5,
  EAST: 90,
  "EAST-SOUTHEAST": 112.5,
  SOUTHEAST: 135,
  "SOUTH-SOUTHEAST": 157.5,
  SOUTH: 180,
  "SOUTH-SOUTHWEST": 202.5,
  SOUTHWEST: 225,
  "WEST-SOUTHWEST": 247.5,
  WEST: 270,
  "WEST-NORTHWEST": 292.5,
  NORTHWEST: 315,
  "NORTH-NORTHWEST": 337.5,
};

const coord = (v: string, hemi: string) => (hemi === "S" || hemi === "W" ? -Number(v) : Number(v));
const title = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/** One JTWC formation alert or warning text, or null when it is not one. */
export function parseJtwcText(txt: string): Cyclone | null {
  const header = txt.match(/^WT\w+ \w+ (\d{6})/m);
  const alert = txt.match(/FORMATION ALERT \(INVEST (\d{2}[A-Z])\)/);
  const warn = txt.match(/SUBJ\/[A-Z ]+?(\d{2}[A-Z])(?: \(([^)]+)\))? WARNING/);
  if (!header || !(alert || warn)) return null;
  const issued = `${header[1]}Z`;
  if (alert) {
    const c = txt.match(/CENTER IS LOCATED\s+NEAR\s+(\d+(?:\.\d)?)([NS])\s+(\d+(?:\.\d)?)([EW])/);
    if (!c) return null;
    const m = txt.match(/MOVING\s+([A-Z-]+?)WARD/);
    const deg = m ? HEADING[m[1]] : undefined;
    return {
      kind: "alert",
      id: alert[1],
      lat: coord(c[1], c[2]),
      lon: coord(c[3], c[4]),
      ...(deg !== undefined ? { moving: compass(deg) } : {}),
      track: [],
      issued,
    };
  }
  const fixes = [...txt.matchAll(/\d{6}Z\s+---\s+(?:NEAR\s+)?(\d+(?:\.\d)?)([NS])\s+(\d+(?:\.\d)?)([EW])/g)].map(
    (f) => ({ lat: coord(f[1], f[2]), lon: coord(f[3], f[4]) }),
  );
  if (!fixes.length) return null;
  const mv = txt.match(/MOVEMENT PAST SIX HOURS - (\d{3}) DEGREES AT (\d+) KTS/);
  return {
    kind: "warning",
    id: warn![1],
    ...(warn![2] ? { name: title(warn![2]) } : {}),
    ...fixes[0],
    ...(mv && Number(mv[2]) > 0 ? { moving: compass(Number(mv[1])) } : {}),
    track: fixes.slice(1),
    issued,
  };
}

/** Which of India's seas a centre is in: the Arabian Sea west of the peninsula's
 *  tip, the Bay of Bengal (with the Andaman Sea) east of it; null outside the North
 *  Indian Ocean. */
export function basinOf(lat: number, lon: number): Basin | null {
  if (lat < 0 || lat > 32 || lon < 40 || lon > 100) return null;
  return lon < 77.5 ? "arabian" : "bay";
}

async function getText(url: string): Promise<string> {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`jtwc ${res.status}`);
  return res.text();
}

/** Poll JTWC (hourly): the North Indian Ocean systems, written to R2 even when there
 *  are none (so readers know the answer is fresh), plus a daily archive of the tracks.
 *  A failed feed keeps the previous snapshot and counts as err:upstream:jtwc. */
export async function collectCyclones(env: Env): Promise<CyclonesSnapshot> {
  const systems = await counted(env, "jtwc", async () => {
    const urls = jtwcProducts(await getText(FEED));
    const out: Cyclone[] = [];
    for (const u of urls) {
      const c = parseJtwcText(await getText(u));
      const basin = c && basinOf(c.lat, c.lon);
      if (c && basin) out.push({ ...c, basin });
    }
    return out;
  });
  const snapshot: CyclonesSnapshot = { generated_at: new Date().toISOString(), systems };
  await putJson(env, CYCLONES_KEY, JSON.stringify(snapshot), "public, max-age=900");
  if (systems.length)
    await env.OAQ_R2.put(`archive/cyclones/${snapshot.generated_at.slice(0, 10)}.json`, JSON.stringify(snapshot), {
      httpMetadata: { contentType: "application/json" },
    });
  return snapshot;
}
