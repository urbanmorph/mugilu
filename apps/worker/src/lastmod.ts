import type { Env } from "./index";
import { pickStation, STATION_MAX_KM } from "./conditions";
import { allSlugPlaces, type SlugPlace } from "./slugs";
import { allHubs } from "./states";
import { trendKey } from "./placedaily";
import { loadJson, loadSnapshot, loadWarningsSnapshot, putJson } from "./snapshot";
import { loadMap } from "./indiamap";
import { warnedSlugs } from "./pages/places";
import type { NormalizedStation } from "./types";

// Honest sitemap lastmod (supporting-docs/reports/mugilu search discovery plan.md). Google uses
// lastmod only when it is "consistently and verifiably" accurate, and only for significant
// changes. A place page's readings move every hour, but its headline changes when its air band
// changes or an official warning over it comes or goes: that day is its lastmod. A trend page
// changes when a day is added to its state's trend file: the file's upload day is its lastmod.
// The hourly run keeps each place's headline in R2 (HEADS_KEY); the sitemap reads it.

export const HEADS_KEY = "meta/place-heads.json";
const WARNED = "|warned";
/** Each place's headline, the day it last changed ("" until a change is seen), and the day a
 *  warning over it last came or went (w), which dates its state's warnings page. */
export type Heads = Record<string, { s: string; d: string; w?: string }>;

/** A place's headline: its station's air band (none beyond STATION_MAX_KM) and whether an
 *  official warning covers it. */
export function headOf(p: SlugPlace, stations: NormalizedStation[], warned: Set<string>): string {
  const s = stations.length ? pickStation(stations, p.lat, p.lon) : undefined;
  const band = s && s.distance_km <= STATION_MAX_KM ? s.band : "-";
  return warned.has(p.slug) ? band + WARNED : band;
}

/** The heads after this run: a changed headline takes today's date; a place seen for the first
 *  time has none yet (its page keeps the sitemap's fixed date). */
export function nextHeads(
  prev: Heads | null,
  now: Record<string, string>,
  day: string,
): { heads: Heads; changed: boolean } {
  const heads: Heads = {};
  let changed = !prev;
  for (const [slug, s] of Object.entries(now)) {
    const was = prev?.[slug];
    const warnedMoved = was && was.s.endsWith(WARNED) !== s.endsWith(WARNED);
    const w = warnedMoved ? day : was?.w;
    heads[slug] = was ? (was.s === s ? was : { s, d: day, ...(w ? { w } : {}) }) : { s, d: "" };
    if (!was || was.s !== s) changed = true;
  }
  return { heads, changed };
}

/** Record each place's headline (hourly, after the map). No air snapshot: nothing is recorded,
 *  so a failed refresh never reads as every place changing. */
export async function updateHeads(env: Env, now = Date.now()): Promise<string> {
  const [snap, { map }, warnings, prev] = await Promise.all([
    loadSnapshot(env),
    loadMap(env),
    loadWarningsSnapshot(env).catch(() => null),
    loadJson<Heads>(env, HEADS_KEY).catch(() => null),
  ]);
  if (!snap?.stations?.length) return "no air snapshot";
  const warned = new Set(warnedSlugs(map, warnings, now));
  const cur = Object.fromEntries(allSlugPlaces().map((p) => [p.slug, headOf(p, snap.stations, warned)]));
  const day = new Date(now).toISOString().slice(0, 10);
  const { heads, changed } = nextHeads(prev, cur, day);
  if (!changed) return "unchanged";
  await putJson(env, HEADS_KEY, JSON.stringify(heads), "no-store");
  return `${Object.values(heads).filter((h) => h.d === day).length} places changed today`;
}

const trendStem = (p: SlugPlace) => trendKey(p).slice("trends/30/".length, -".json".length);

/** The sitemap's dates by path: each place page from its heads, each trend page from its
 *  state's trend file, each state's warnings page from the last warning to come or go over one
 *  of its places. A path with no known date is left out (the fixed date stands). */
export function placeLastmods(heads: Heads | null, trends: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of allSlugPlaces()) {
    const d = heads?.[p.slug]?.d;
    if (d) out[`/c/${p.slug}`] = d;
    const t = trends[trendStem(p)];
    if (t) out[`/c/${p.slug}/trends`] = t;
  }
  for (const st of allHubs()) {
    const w = st.places.map((p) => heads?.[p.slug]?.w ?? "").reduce((a, b) => (b > a ? b : a), "");
    if (w) out[`/state/${st.slug}/warnings`] = w;
  }
  return out;
}

/** Read the dates for the sitemap: the heads, and the upload day of each 30-day trend file. */
export async function loadLastmods(env: Env): Promise<Record<string, string>> {
  const [heads, list] = await Promise.all([
    loadJson<Heads>(env, HEADS_KEY).catch(() => null),
    env.OAQ_R2.list({ prefix: "trends/30/" }).catch(() => null),
  ]);
  const trends: Record<string, string> = {};
  for (const o of list?.objects ?? [])
    trends[o.key.slice("trends/30/".length, -".json".length)] = o.uploaded.toISOString().slice(0, 10);
  return placeLastmods(heads, trends);
}
