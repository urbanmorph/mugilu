import type { Conditions, ConditionsPoint, NormalizedStation } from "./types";
import type { Cyclone } from "./cyclones";
import type { Env } from "./index";
import { airLevelOf, ambientRisk, heatLevelOf, rainLevelOf, RISK_BANDS } from "./score";
import { isPlausible } from "./plausible";
import { inIndia, type Ring } from "./india";
import { loadCyclones, loadGrid, loadJson, loadSnapshot, loadWarningsSnapshot, putJson } from "./snapshot";
import { loadWarnAreas, severityBand, type WarnArea } from "./warnareas";
import { simplifyPath } from "./simplify-path";
import { reason } from "./logs";

/** Append to a list in a map of lists. */
const push = <K, V>(m: Map<K, V[]>, k: K, v: V) => (m.get(k) ?? m.set(k, []).get(k)!).push(v);
import outline from "../data/india.json";
import states from "../data/state-lines.json";
import { r1 } from "./num";

// The home page's map of India now: one-degree squares (about 100 km), each
// coloured by what is worst in it (air, heat or cold), scored by the same
// ambientRisk as a place's page so the two can never disagree. A Rain layer shows
// the next 24 hours' forecast, for a cyclone. Built from what the crons already collect
// (the district grid and the air stations), so it costs no extra upstream
// call. The official warnings in force are a layer of their own, their areas fetched once
// per alert from SACHET (warnareas.ts). Inline SVG, no map library, no tiles. This module is
// the data and the projection; ui/map.ts draws it (home and /places).

/** What a square's worst read is, in three groups a map can tell apart: dust is air. UV is left out, since it follows the time of day everywhere. */
export type MapHazard = "air" | "heat" | "cold";
const GROUP: Record<string, MapHazard> = { Air: "air", Dust: "air", Heat: "heat", Cold: "cold" };
/** The order equal levels are named in. */
const ORDER: MapHazard[] = ["air", "heat", "cold"];

export interface MapCell {
  /** The square's south-west corner, whole degrees. */
  lon: number;
  lat: number;
  /** The worst hazard level in the square (0-3), as on /c for everyone, UV aside. */
  worst: number;
  /** Which hazard that is, when there is one. */
  what?: MapHazard;
  /** Hot-side heat alone (0-3), for the Heat layer. */
  heat: number;
  /** Rain in the next 24 hours as IMD's class (0-3); absent until the grid has a forecast. */
  rain?: number;
  /** The district behind the square's heat and its rain: the map's worst places, as links. */
  heatAt?: MapPlace;
  rainAt?: MapPlace;
}
/** A district point, named so a reader can place it. */
export interface MapPlace {
  name: string;
  state?: string;
  lat: number;
  lon: number;
}
type Worst = Pick<MapCell, "worst" | "what">;
const beats = (a: Worst, b: Worst) =>
  a.worst > b.worst || (a.worst === b.worst && ORDER.indexOf(a.what!) < ORDER.indexOf(b.what!));
export interface MapDot {
  lat: number;
  lon: number;
  band: NormalizedStation["band"];
}
export interface IndiaMap {
  cells: MapCell[];
  dots: MapDot[];
  cyclones: Cyclone[];
  gridAsOf?: string;
  airAsOf?: string;
  /** Measured stations by AQI band, for the Air layer's summary. */
  airCounts?: Partial<Record<NormalizedStation["band"], number>>;
  /** The official warnings with an area, in force when composed, lowest level first (so the
   *  highest draws on top). Absent when the areas could not be read. */
  warnings?: MapWarning[];
  /** The national warnings feed's time. */
  warningsAsOf?: string;
  /** Each feed alert's end (ISO), from its CAP file, in force or not: the feed lists ended
   *  alerts too (sachet.ts inForce). */
  ends?: Record<string, string>;
}
/** An official warning on the map: its level (0-3, the risk bands), until when, and its area as
 *  a relative SVG path in the map's pixels. */
export interface MapWarning {
  id: string;
  level: number;
  expires: string;
  d: string;
}

const key = (lon: number, lat: number) => `${Math.floor(lon)},${Math.floor(lat)}`;

/** The worst read per square: each district point scored with its square's measured
 *  air, the square taking its worst point (and its most rain). Squares of
 *  India with no point borrow the nearest one's read (they sit inside big districts). */
export function mapCells(points: ConditionsPoint[], stations: NormalizedStation[]): MapCell[] {
  const air = new Map<string, number>();
  for (const s of stations) {
    if (s.lat == null || s.lon == null) continue;
    const lvl = airLevelOf(s.band);
    const k = key(s.lon, s.lat);
    if (lvl != null && lvl > (air.get(k) ?? -1) && isPlausible(s, stations)) air.set(k, lvl);
  }
  const AIR_BAND = ["good", "moderate", "poor", "vpoor"];
  const scored = points.map((p) => {
    const k = key(p.lon, p.lat);
    const a = air.get(k);
    const c = {
      air: a == null ? null : { band: AIR_BAND[a] },
      heat: { apparent_c: p.wx.apparent_c, wet_bulb_c: p.wx.wet_bulb_c },
      uv: p.wx.uv == null ? null : { index: p.wx.uv },
      dust: p.wx.dust_ug_m3 == null ? null : { dust_ug_m3: p.wx.dust_ug_m3 },
    } as unknown as Conditions;
    let w: Worst = { worst: 0 };
    for (const h of ambientRisk(c).hazards) {
      const what = GROUP[h.hazard];
      if (what && h.level > 0 && beats({ worst: h.level, what }, w)) w = { worst: h.level, what };
    }
    const rain = p.wx.rain_24h_mm == null ? undefined : rainLevelOf(p.wx.rain_24h_mm);
    return { p, k, ...w, heat: heatLevelOf(p.wx), rain };
  });
  const at = ({ name, state, lat, lon }: ConditionsPoint): MapPlace => ({ name, state, lat, lon });
  const cellOf = ({ p, worst, what, heat, rain }: (typeof scored)[number], lon: number, lat: number): MapCell => ({
    lon,
    lat,
    worst,
    what,
    heat,
    rain,
    heatAt: at(p),
    rainAt: rain == null ? undefined : at(p),
  });
  const cells = new Map<string, MapCell>();
  for (const s of scored) {
    const c = cells.get(s.k);
    if (!c) cells.set(s.k, cellOf(s, Math.floor(s.p.lon), Math.floor(s.p.lat)));
    else {
      if (beats(s, c)) [c.worst, c.what] = [s.worst, s.what];
      if (s.heat > c.heat) [c.heat, c.heatAt] = [s.heat, at(s.p)];
      if (s.rain != null && (c.rain == null || s.rain > c.rain)) [c.rain, c.rainAt] = [s.rain, at(s.p)];
    }
  }
  if (scored.length)
    for (let lon = 68; lon < 98; lon++)
      for (let lat = 6; lat < 38; lat++) {
        if (cells.has(`${lon},${lat}`) || !inIndia(lat + 0.5, lon + 0.5)) continue;
        let best = scored[0];
        let bd = Infinity;
        for (const s of scored) {
          const d = (s.p.lon - lon - 0.5) ** 2 + (s.p.lat - lat - 0.5) ** 2;
          if (d < bd) [best, bd] = [s, d];
        }
        cells.set(`${lon},${lat}`, cellOf(best, lon, lat));
      }
  return [...cells.values()];
}

/** The air stations as dots: per half degree, the worst station that passes the
 *  plausibility check (measured readings only; no smoothing between them). */
export function airDots(stations: NormalizedStation[]): MapDot[] {
  const bins = new Map<string, NormalizedStation[]>();
  for (const s of stations) {
    if (s.lat == null || s.lon == null || s.aqi == null) continue;
    const k = `${Math.floor(s.lon * 2)},${Math.floor(s.lat * 2)}`;
    push(bins, k, s);
  }
  const dots: MapDot[] = [];
  for (const bin of bins.values()) {
    const s = bin.sort((a, b) => b.aqi! - a.aqi!).find((x) => isPlausible(x, stations));
    if (s) dots.push({ lat: s.lat!, lon: s.lon!, band: s.band });
  }
  return dots;
}

/** Measured stations by AQI band (stations with a reading). */
export function airCounts(stations: NormalizedStation[]): IndiaMap["airCounts"] {
  const n: NonNullable<IndiaMap["airCounts"]> = {};
  for (const s of stations) if (s.aqi != null) n[s.band] = (n[s.band] ?? 0) + 1;
  return n;
}

// The projection: plain longitude/latitude, longitude squeezed by cos 22° (India's
// middle) so the country keeps its shape. View box in px at S per degree.
export const LON0 = 67.5;
export const LAT1 = 37.6;
export const S = 12;
export const KX = Math.cos((22 * Math.PI) / 180);
export const VW = Math.round((98.2 - LON0) * KX * S);
export const VH = Math.round((LAT1 - 6) * S);
export const px = (lon: number) => (lon - LON0) * KX * S;
export const py = (lat: number) => (LAT1 - lat) * S;

/** Douglas-Peucker: drop points within `tol` px of the line they sit on. */
function simplify(pts: [number, number][], tol: number): [number, number][] {
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0];
  const [bx, by] = pts[pts.length - 1];
  const len = Math.hypot(bx - ax, by - ay) || 1;
  let far = 0;
  let at = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / len;
    if (d > far) [far, at] = [d, i];
  }
  if (far <= tol) return [pts[0], pts[pts.length - 1]];
  return [...simplify(pts.slice(0, at + 1), tol).slice(0, -1), ...simplify(pts.slice(at), tol)];
}

/** A closed ring, simplified: split at the point farthest from the start, since a
 *  ring's two ends are the same point and give no line to measure against. */
function simplifyRing(pts: [number, number][], tol: number): [number, number][] {
  let at = 0;
  let far = -1;
  pts.forEach(([x, y], i) => {
    const d = Math.hypot(x - pts[0][0], y - pts[0][1]);
    if (d > far) [far, at] = [d, i];
  });
  return [...simplify(pts.slice(0, at + 1), tol).slice(0, -1), ...simplify(pts.slice(at), tol)];
}

/** India's outline (the LGD boundary india.ts checks coordinates against), as one
 *  SVG path in the map's pixels: mainland and islands, each ring closed. */
export const LAND_PATH = (outline as unknown as { polygons: Ring[][] }).polygons
  .map(([ring]) => {
    const pts = simplifyRing(
      ring.map(([lon, lat]) => [px(lon), py(lat)] as [number, number]),
      0.45,
    );
    return pts.length < 3 ? "" : "M" + pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join("L") + "Z";
  })
  .join("");

/** The borders between states and Union Territories (LGD, scripts/build_state_lines.py),
 *  as open lines in the map's pixels: drawn on every layer so a square can be placed. */
export const STATE_PATH = (states as unknown as { lines: [number, number][][] }).lines
  .map((line) => {
    const pts = simplify(
      line.map(([lon, lat]) => [px(lon), py(lat)] as [number, number]),
      0.9,
    );
    return "M" + pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join("L");
  })
  .join("");

/** The squares of one layer, one path per fill; `fill` gives a square's fill
 *  attributes, or nothing to leave it as land. */
export function cellPaths(
  cells: MapCell[],
  fill: (c: MapCell) => string | undefined,
  size = (_c: MapCell) => 1,
): string {
  const by = new Map<string, string[]>();
  for (const c of cells) {
    const f = fill(c);
    if (!f) continue;
    // A square scaled about its centre (size 1 fills the cell).
    const k = size(c);
    const w = KX * S * k;
    const h = S * k;
    const x = px(c.lon) + (KX * S - w) / 2;
    const y = py(c.lat + 1) + (S - h) / 2;
    push(by, f, `M${r1(x)} ${r1(y)}h${r1(w)}v${r1(h)}h-${r1(w)}z`);
  }
  return [...by].map(([f, d]) => `<path ${f} d="${d.join("")}"/>`).join("");
}

/** The way a cyclone moves, in words. */
export const DIR_SENTENCE: Record<string, string> = {
  N: "It moves north.",
  NE: "It moves north-east.",
  E: "It moves east.",
  SE: "It moves south-east.",
  S: "It moves south.",
  SW: "It moves south-west.",
  W: "It moves west.",
  NW: "It moves north-west.",
};
const STEP: Record<string, [number, number]> = {
  N: [0, 1],
  NE: [0.7, 0.7],
  E: [1, 0],
  SE: [0.7, -0.7],
  S: [0, -1],
  SW: [-0.7, -0.7],
  W: [-1, 0],
  NW: [-0.7, 0.7],
};

/** The cyclone on the map: its centre, its forecast track and an arrowhead. */
export function cycloneGlyph(c: Cyclone): string {
  const x = px(c.lon);
  const y = py(c.lat);
  if (x < 0 || x > VW || y < 0 || y > VH) return "";
  const pts = [{ lat: c.lat, lon: c.lon }, ...c.track];
  if (pts.length === 1 && c.moving) {
    const [dx, dy] = STEP[c.moving];
    pts.push({ lon: c.lon + dx * 1.6, lat: c.lat + dy * 1.6 });
  }
  const line =
    pts.length > 1
      ? `<path d="M${pts.map((p) => `${r1(px(p.lon))} ${r1(py(p.lat))}`).join("L")}" fill="none" stroke="var(--ink)" stroke-width="1.6" stroke-dasharray="4 3" stroke-linecap="round"/>`
      : "";
  // An arrowhead at the end, so the way it moves reads as a direction.
  const [a, b] = pts.slice(-2).map((p) => [px(p.lon), py(p.lat)]);
  let head = "";
  if (b) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const [ux, uy] = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    const side = (k: number) => `${r1(b[0] - 5 * ux + k * 3.5 * uy)} ${r1(b[1] - 5 * uy - k * 3.5 * ux)}`;
    head = `<path d="M${side(1)}L${r1(b[0])} ${r1(b[1])}L${side(-1)}" fill="none" stroke="var(--ink)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  const spiral = `M${r1(x - 4)} ${r1(y + 0.6)}a4 4 0 0 1 6-3.4M${r1(x + 4)} ${r1(y - 0.6)}a4 4 0 0 1-6 3.4`;
  return `<g class="mcy">${line}${head}<circle cx="${r1(x)}" cy="${r1(y)}" r="7.5" fill="var(--card)" stroke="var(--ink)" stroke-width="1.6"/><path d="${spiral}" fill="none" stroke="var(--ink)" stroke-width="1.6" stroke-linecap="round"/></g>`;
}

/** Map pixels: the detail the map can show (as for the /places state outlines). */
const AREA_TOLERANCE = 0.4;

/** An area's rings as one path: projected, each ring turned the same way round (so overlapping
 *  rings of one level fill as one under the nonzero rule), simplified to the map's detail. */
function areaPath(rings: WarnArea["rings"]): string {
  return simplifyPath(
    rings
      .map((ring) => {
        const pts = ring.map(([lon, lat]) => [px(lon), py(lat)] as [number, number]);
        const twice = pts.reduce((a, [x, y], i) => {
          const [nx, ny] = pts[(i + 1) % pts.length];
          return a + x * ny - nx * y;
        }, 0);
        if (twice < 0) pts.reverse();
        return "M" + pts.map(([x, y]) => `${x} ${y}`).join("L") + "Z";
      })
      .join(""),
    AREA_TOLERANCE,
  );
}

/** The areas as the map stores them, lowest level first. */
export function mapWarnings(areas: WarnArea[]): MapWarning[] {
  return areas
    .map((a) => ({
      id: a.identifier,
      level: RISK_BANDS.indexOf(severityBand(a.severity)),
      expires: a.expires,
      d: areaPath(a.rings),
    }))
    .sort((a, b) => a.level - b.level || a.id.localeCompare(b.id));
}

/** The warnings still in force at `now` (the stored map is up to an hour old). */
export const activeWarnings = (m: IndiaMap | undefined, now = Date.now()): MapWarning[] =>
  (m?.warnings ?? []).filter((w) => Date.parse(w.expires) > now);

/** The map's data, from the snapshots the crons write (each read is memoised). A failure to
 *  read the warning areas leaves them off; it never stops the map. */
export async function composeMap(env: Env, now = Date.now()): Promise<IndiaMap | undefined> {
  const [grid, snap, cy, warned, areas] = await Promise.all([
    loadGrid(env),
    loadSnapshot(env),
    loadCyclones(env),
    loadWarningsSnapshot(env).catch(() => null),
    loadWarnAreas(env, now).catch((e) => {
      console.error(`[map] warning areas unread: ${reason(e)}`);
      return undefined;
    }),
  ]);
  if (!grid) return undefined;
  const stations = snap?.stations ?? [];
  return {
    cells: mapCells(grid.points, stations),
    dots: airDots(stations),
    cyclones: cy?.systems ?? [],
    gridAsOf: grid.generated_at,
    airAsOf: snap?.generated_at,
    airCounts: airCounts(stations),
    ...(areas && {
      warnings: mapWarnings(areas.areas),
      warningsAsOf: warned?.generated_at,
      ends: areas.ends,
    }),
  };
}

/** The composed map, written by the crons so a page reads ~30 KB instead of parsing the
 *  grid and the air snapshot (~1.2 MB) on every cache miss. */
export const MAP_KEY = "data/map.json";
interface StoredMap extends IndiaMap {
  generated_at: string;
  hash: string;
}

async function sha1(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compose the map from the snapshots and store it, unless it is unchanged (same hash):
 *  a second run with the same inputs writes nothing. */
export async function writeMap(env: Env, now = Date.now()): Promise<"written" | "unchanged" | "no grid"> {
  const map = await composeMap(env, now);
  if (!map) return "no grid";
  const hash = await sha1(JSON.stringify(map));
  const prev = await loadJson<StoredMap>(env, MAP_KEY);
  if (prev?.hash === hash) return "unchanged";
  const stored: StoredMap = { ...map, generated_at: new Date(now).toISOString(), hash };
  await putJson(env, MAP_KEY, JSON.stringify(stored), "public, max-age=300");
  return "written";
}

/** The map for a page: the stored one when there is one, else composed here (and then the
 *  page should not be kept at the edge, `stored: false`, so it picks up the stored map soon). */
export async function loadMap(env: Env): Promise<{ map: IndiaMap | undefined; stored: boolean }> {
  const stored = await loadJson<StoredMap>(env, MAP_KEY).catch(() => null);
  if (stored?.cells?.length) return { map: stored, stored: true };
  return { map: await composeMap(env), stored: false };
}
