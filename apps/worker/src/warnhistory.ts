import type { Env } from "./index";
import type { Ring } from "./india";
import { inAnyRing } from "./india";
import { allSlugPlaces } from "./slugs";
import { loadJson, putJson } from "./snapshot";
import { issuerName } from "./sachet";
import type { WarnArea } from "./warnareas";
import { istDayAdd, istIsoDay } from "./ist";

// Each place's official warnings since the archive began: the alerts whose area covered the
// place's centre (the rule /places and the state pages use for "under a warning now"), kept
// per place at history/warnings/<slug>.json, newest first. The hourly job adds each alert as
// it archives it (warnareas.ts); scripts/build-warn-history.ts did the backlog once. Nobody
// else keeps this: SACHET shows only what is in force.

export const HISTORY_PREFIX = "history/warnings/";
/** The first alert in the archive (archive/sachet/ begins on 27 Jun 2026). */
export const HISTORY_FROM = "2026-06-27T00:00:00+05:30";

export type Colour = "green" | "yellow" | "orange" | "red";
/** One past warning over a place, as its page tells it. */
export interface PastAlert {
  id: string;
  /** When it took effect (else when it was sent), and when it ended: ISO, as issued. */
  from: string;
  until: string;
  colour: Colour;
  office: string;
  headline: string;
}

/** CAP's severity as IMD's colour. SACHET pairs them: Moderate is yellow, Severe orange (checked
 *  on its location API, 23 Nov 2026); Extreme red and Minor green by the same scale. */
const COLOURS: Record<string, Colour> = { minor: "green", moderate: "yellow", severe: "orange", extreme: "red" };
export const colourOf = (severity: string): Colour => COLOURS[severity.toLowerCase()] ?? "yellow";

/** An archived alert as a place's history keeps it. */
export const pastAlert = (a: WarnArea): PastAlert => ({
  id: a.identifier,
  from: a.effective || a.sent || "",
  until: a.expires,
  colour: colourOf(a.severity),
  office: issuerName(a.issuer),
  headline: a.headline,
});

/** The named places whose centre is inside the area (lon/lat rings), A to Z. */
export function placesInArea(rings: Ring[]): string[] {
  if (!rings.length) return [];
  const inside = inAnyRing(rings);
  return allSlugPlaces()
    .filter((p) => inside(p.lon, p.lat))
    .map((p) => p.slug)
    .sort();
}

/** The history with `add` in it, each alert once, newest first; null when nothing is new. */
export function mergeHistory(prev: PastAlert[], add: PastAlert[]): PastAlert[] | null {
  const have = new Set(prev.map((a) => a.id));
  const fresh = add.filter((a) => !have.has(a.id) && (have.add(a.id), true));
  if (!fresh.length) return null;
  return [...prev, ...fresh].sort((x, y) => (Date.parse(y.from) || 0) - (Date.parse(x.from) || 0));
}

const keyOf = (slug: string) => `${HISTORY_PREFIX}${slug}.json`;

/** Everything kept for a place, as stored; null when nothing is. */
const loadKept = (env: Env, slug: string) => loadJson<PastAlert[]>(env, keyOf(slug));

/** A place's past warnings since HISTORY_FROM, newest first; null when none has been kept for
 *  it. Kept but not told: alerts already in force when the archive began (from 21 Jun), whose
 *  days are not complete; and green alerts, which on IMD's scale mean no warning (they are
 *  notices, such as a state authority's traffic advisory). */
export const loadHistory = async (env: Env, slug: string): Promise<PastAlert[] | null> => {
  const all = await loadKept(env, slug);
  return all && all.filter((a) => a.colour !== "green" && (Date.parse(a.from) || 0) >= Date.parse(HISTORY_FROM));
};

const RANK: Colour[] = ["green", "yellow", "orange", "red"];

/** Each IST day (YYYY-MM-DD) one of the alerts was in force, up to today, at the worst colour
 *  in force that day. Alerts come every few hours (IMD's 3-hour nowcasts), so days, not
 *  alerts, say how often a place was warned. */
export function warnedDays(list: PastAlert[], now = Date.now()): Map<string, Colour> {
  const days = new Map<string, Colour>();
  for (const a of list) {
    const from = Date.parse(a.from);
    if (!from || from > now) continue;
    const end = istIsoDay(Math.min(Math.max(Date.parse(a.until) || from, from), now));
    for (let d = istIsoDay(from); d <= end; d = istDayAdd(d, 1)) {
      const had = days.get(d);
      if (!had || RANK.indexOf(a.colour) > RANK.indexOf(had)) days.set(d, a.colour);
    }
  }
  return days;
}

/** Add archived alerts to the history of every place each covered: one read and at most one
 *  write per place. An alert with no area covers no place. Idempotent. */
export async function recordHistory(env: Env, areas: WarnArea[]): Promise<{ places: number }> {
  const by = new Map<string, PastAlert[]>();
  for (const a of areas)
    for (const slug of placesInArea(a.rings)) by.set(slug, [...(by.get(slug) ?? []), pastAlert(a)]);
  let places = 0;
  for (const [slug, add] of by) {
    const next = mergeHistory((await loadKept(env, slug)) ?? [], add);
    if (!next) continue;
    await putJson(env, keyOf(slug), JSON.stringify(next), "no-store");
    places++;
  }
  return { places };
}
