// Local place gazetteer: India's cities, towns and sub-city localities extracted
// from OpenStreetMap (c) OpenStreetMap contributors (ODbL). Resolves a typed place
// name to a coordinate in-memory, with no upstream call, so the search bar is instant
// and not subject to the geocoder's flakiness or spelling gaps. The data is DATA
// (refreshed from OSM into R2 out of band), not hardcoded place-by-place in source.
//
// A row is compact on purpose (the file holds ~24k of them):
//   [name, lat, lon, type, state?, alts?]
// type is one of city | town | suburb | neighbourhood; alts are alternate/native
// names (Paradeep for Paradip, a Devanagari/Odia form, an old name) used for matching.

import type { Env } from "./index";

export type GazRow = [string, number, number, string, (string | undefined)?, (string[] | undefined)?];

export interface GazHit {
  name: string;
  state?: string;
  lat: number;
  lon: number;
  type: string;
}

// type code -> sort weight (cities rank above towns above localities).
// Codes keep the data file compact: c=city, t=town, s=suburb, n=neighbourhood.
const TYPE_RANK: Record<string, number> = { c: 0, t: 1, s: 2, n: 3 };

/** Fold a string to a match key: lowercase + strip Latin diacritics + collapse
 *  whitespace. Native scripts pass through unchanged (no Latin diacritics), so a
 *  Devanagari/Tamil/etc. query still matches a native-script key. */
export function gazNorm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** A consonant skeleton: lowercase, strip diacritics, keep the first letter, then
 *  drop vowels and spaces and collapse repeated letters. It folds transliteration
 *  variants onto one key, so "Paradeep" and "Paradip" both become "prdp" (OSM does
 *  not tag every spelling, so exact matching alone misses these). Used only as a
 *  fallback when exact matching finds nothing, to avoid false positives. */
export function gazSkeleton(s: string): string {
  const n = gazNorm(s);
  if (!n) return "";
  let out = n[0];
  for (let i = 1; i < n.length; i++) {
    const ch = n[i];
    if (ch === "a" || ch === "e" || ch === "i" || ch === "o" || ch === "u" || ch === " ") continue;
    if (ch === out[out.length - 1]) continue;
    out += ch;
  }
  return out;
}

/** Pre-normalize every row's search keys once (name + alternates), so a query
 *  scan does no per-row normalization. Built once per isolate at load time.
 *  `skel` maps a consonant skeleton to the row indices that share it (fuzzy fallback). */
export interface GazIndex {
  rows: GazRow[];
  keys: string[][];
  skel: Map<string, number[]>;
}

export function buildGazIndex(rows: GazRow[]): GazIndex {
  const keys: string[][] = new Array(rows.length);
  const skel = new Map<string, number[]>();
  for (let i = 0; i < rows.length; i++) {
    const [name, , , , , alts] = rows[i];
    const set = new Set<string>();
    set.add(gazNorm(name));
    if (alts) for (const a of alts) set.add(gazNorm(a));
    keys[i] = [...set];
    for (const k of keys[i]) {
      const sk = gazSkeleton(k);
      if (sk.length < 3) continue; // too short to be a useful fuzzy key
      const bucket = skel.get(sk);
      if (bucket) {
        if (bucket[bucket.length - 1] !== i) bucket.push(i);
      } else {
        skel.set(sk, [i]);
      }
    }
  }
  return { rows, keys, skel };
}

/** Match a query against the gazetteer: prefix hits first, then substring, ranked
 *  by place type then name length (a tighter match wins). In-memory, no upstream. */
export function matchGazetteer(idx: GazIndex, q: string, limit = 5): GazHit[] {
  const needle = gazNorm(q);
  if (needle.length < 2) return [];
  const { rows, keys } = idx;
  const out: { row: GazRow; score: number }[] = [];
  const seen = new Set<number>();

  for (const prefixPass of [true, false]) {
    for (let i = 0; i < rows.length; i++) {
      if (seen.has(i)) continue;
      let matched = false;
      for (const k of keys[i]) {
        if (prefixPass ? k.startsWith(needle) : k.includes(needle)) {
          matched = true;
          break;
        }
      }
      if (!matched) continue;
      seen.add(i);
      const row = rows[i];
      const typeRank = TYPE_RANK[row[3]] ?? 9;
      // prefix matches sort ahead of substring; then by type; then shorter name.
      const score = (prefixPass ? 0 : 1000) + typeRank * 50 + Math.min(row[0].length, 49);
      out.push({ row, score });
    }
    if (out.length >= limit * 4) break; // enough candidates to rank well
  }

  // Fuzzy fallback: only when exact matching found nothing, match the query's
  // consonant skeleton (so "Paradeep" still finds "Paradip"). Ranked below exact.
  if (out.length === 0) {
    const bucket = idx.skel.get(gazSkeleton(needle));
    if (bucket) {
      for (const i of bucket) {
        const row = rows[i];
        out.push({ row, score: 2000 + (TYPE_RANK[row[3]] ?? 9) * 50 + Math.min(row[0].length, 49) });
      }
    }
  }

  out.sort((a, b) => a.score - b.score);
  return out.slice(0, limit).map(({ row }) => ({
    name: row[0],
    lat: row[1],
    lon: row[2],
    type: row[3],
    state: row[4] || undefined,
  }));
}

// ── R2 loader ──────────────────────────────────────────────────────────────
// The gazetteer is DATA (refreshed from OSM into R2 out of band), so the worker
// loads it from R2 once per isolate and holds the built index in module scope.
// First lookup in a cold isolate pays the fetch + parse (~tens of ms); every
// lookup after is in-memory. A load failure returns null (callers fall back to
// the geocoder), so a missing/broken file never breaks search.
const GAZ_KEY = "data/gazetteer.json";
let GAZ_INDEX: GazIndex | null = null;
let GAZ_PENDING: Promise<GazIndex | null> | null = null;

export async function loadGazetteer(env: Env): Promise<GazIndex | null> {
  if (GAZ_INDEX) return GAZ_INDEX;
  if (GAZ_PENDING) return GAZ_PENDING;
  GAZ_PENDING = (async () => {
    try {
      const obj = await env.OAQ_R2.get(GAZ_KEY);
      if (!obj) return null;
      const rows = JSON.parse(await obj.text()) as GazRow[];
      GAZ_INDEX = buildGazIndex(rows);
      return GAZ_INDEX;
    } catch {
      return null;
    } finally {
      GAZ_PENDING = null;
    }
  })();
  return GAZ_PENDING;
}
