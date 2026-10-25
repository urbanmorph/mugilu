import type { Conditions, ConditionsPoint, NormalizedStation } from "./types";
import type { FireDetection } from "./firms";
import type { Cyclone } from "./cyclones";
import type { Env } from "./index";
import { airLevelOf, ambientRisk, heatLevelOf, rainLevelOf } from "./score";
import { BAND_COLOR, RISK_COLOR } from "./palette";
import { AQI_BAND_LABEL } from "./aqi";
import { isPlausible } from "./plausible";
import { inIndia, type Ring } from "./india";
import { loadCyclones, loadFires, loadGrid, loadSnapshot } from "./snapshot";
import { esc } from "./html";

/** Append to a list in a map of lists. */
const push = <K, V>(m: Map<K, V[]>, k: K, v: V) => (m.get(k) ?? m.set(k, []).get(k)!).push(v);
import { lp, t, type Lang } from "./i18n";
import outline from "../data/india.json";
import states from "../data/state-lines.json";

// The home page's map of India now: one-degree squares (about 100 km), each
// coloured by what is worst in it (air, heat or cold), scored by the same
// ambientRisk as a place's page so the two can never disagree. A Rain layer shows
// the next 24 hours' forecast, for a cyclone. Built from what the crons already collect
// (the district grid, the air stations, the fires), so it costs no extra upstream
// call. Official warnings are not on it: the national feed carries no areas, so a
// place's page is where they show. Inline SVG, no map library, no tiles.

/** What a square's worst read is, in three groups a map can tell apart: smoke and
 *  dust are air. UV is left out, since it follows the time of day everywhere. */
export type MapHazard = "air" | "heat" | "cold";
const GROUP: Record<string, MapHazard> = { Air: "air", Smoke: "air", Dust: "air", Heat: "heat", Cold: "cold" };
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
}
type Worst = Pick<MapCell, "worst" | "what">;
const beats = (a: Worst, b: Worst) =>
  a.worst > b.worst || (a.worst === b.worst && ORDER.indexOf(a.what!) < ORDER.indexOf(b.what!));
const maxOf = (a?: number, b?: number) => (a == null ? b : b == null ? a : Math.max(a, b));
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
}

const key = (lon: number, lat: number) => `${Math.floor(lon)},${Math.floor(lat)}`;

/** The worst read per square: each district point scored with its square's measured
 *  air and fires, the square taking its worst point (and its most rain). Squares of
 *  India with no point borrow the nearest one's read (they sit inside big districts). */
export function mapCells(points: ConditionsPoint[], stations: NormalizedStation[], fires: FireDetection[]): MapCell[] {
  const air = new Map<string, number>();
  for (const s of stations) {
    if (s.lat == null || s.lon == null) continue;
    const lvl = airLevelOf(s.band);
    const k = key(s.lon, s.lat);
    if (lvl != null && lvl > (air.get(k) ?? -1) && isPlausible(s, stations)) air.set(k, lvl);
  }
  const smoke = new Map<string, { count: number; frp_sum: number }>();
  for (const f of fires) {
    const k = key(f.lon, f.lat);
    const s = smoke.get(k) ?? { count: 0, frp_sum: 0 };
    s.count++;
    s.frp_sum += f.frp;
    smoke.set(k, s);
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
      smoke: smoke.get(k) ?? null,
    } as unknown as Conditions;
    let w: Worst = { worst: 0 };
    for (const h of ambientRisk(c).hazards) {
      const what = GROUP[h.hazard];
      if (what && h.level > 0 && beats({ worst: h.level, what }, w)) w = { worst: h.level, what };
    }
    const rain = p.wx.rain_24h_mm == null ? undefined : rainLevelOf(p.wx.rain_24h_mm);
    return { p, k, ...w, heat: heatLevelOf(p.wx), rain };
  });
  const cellOf = ({ worst, what, heat, rain }: (typeof scored)[number], lon: number, lat: number): MapCell => ({
    lon,
    lat,
    worst,
    what,
    heat,
    rain,
  });
  const cells = new Map<string, MapCell>();
  for (const s of scored) {
    const c = cells.get(s.k);
    if (!c) cells.set(s.k, cellOf(s, Math.floor(s.p.lon), Math.floor(s.p.lat)));
    else {
      if (beats(s, c)) [c.worst, c.what] = [s.worst, s.what];
      c.heat = Math.max(c.heat, s.heat);
      c.rain = maxOf(c.rain, s.rain);
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

// The projection: plain longitude/latitude, longitude squeezed by cos 22° (India's
// middle) so the country keeps its shape. View box in px at S per degree.
const LON0 = 67.5;
const LAT1 = 37.6;
const S = 12;
const KX = Math.cos((22 * Math.PI) / 180);
const VW = Math.round((98.2 - LON0) * KX * S);
const VH = Math.round((LAT1 - 6) * S);
const px = (lon: number) => (lon - LON0) * KX * S;
const py = (lat: number) => (LAT1 - lat) * S;
const r1 = (n: number) => Math.round(n * 10) / 10;

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
function cellPaths(cells: MapCell[], fill: (c: MapCell) => string | undefined): string {
  const by = new Map<string, string[]>();
  const w = r1(KX * S);
  for (const c of cells) {
    const f = fill(c);
    if (f) push(by, f, `M${r1(px(c.lon))} ${r1(py(c.lat + 1))}h${w}v${S}h-${w}z`);
  }
  return [...by].map(([f, d]) => `<path ${f} d="${d.join("")}"/>`).join("");
}
const HIGH_OPACITY = ".5";
/** What's worst: the hazard's colour where high (lighter) or severe; calmer squares stay land. */
const worstFill = (c: MapCell) =>
  c.what && c.worst >= 2
    ? `fill="var(--m${c.what})"${c.worst < 3 ? ` fill-opacity="${HIGH_OPACITY}"` : ""}`
    : undefined;
const heatFill = (c: MapCell) =>
  `fill="${c.heat ? RISK_COLOR[(["low", "moderate", "high", "severe"] as const)[c.heat]] : "var(--m0)"}"`;
const rainFill = (c: MapCell) => (c.rain ? `fill="var(--mrain${c.rain})"` : undefined);

const DIR_SENTENCE: Record<string, string> = {
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

/** What a cyclone is doing, in words. */
export function cycloneSentence(c: Cyclone, lang: Lang): string {
  const sea = c.basin === "arabian" ? "Arabian Sea" : "Bay of Bengal";
  const where =
    c.kind === "alert"
      ? t(`A cyclone can form in the ${sea}.`, lang)
      : c.name
        ? t(`Cyclone X is in the ${sea}.`, lang).replace("X", esc(c.name))
        : t(`A cyclone is in the ${sea}.`, lang);
  return c.moving ? `${where} ${t(DIR_SENTENCE[c.moving], lang)}` : where;
}

function cycloneGlyph(c: Cyclone): string {
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

/** The map block: four layers switched by radio buttons (CSS only; Rain only once the
 *  grid has a forecast), a legend and a note per layer, the cyclone drawn and told in
 *  words. `stamp` renders a snapshot's time the way the page does. */
export function renderIndiaMap(m: IndiaMap, lang: Lang = "en", stamp: (iso: string) => string = esc): string {
  const age = (iso?: string) => (iso ? ` <span class="age">· ${stamp(iso)}</span>` : "");
  const chip = (color: string, label: string, opacity = "") =>
    `<span><i style="background:${color}${opacity && `;opacity:${opacity}`}"></i>${esc(t(label, lang))}</span>`;
  const what = [
    chip("var(--mair)", "Air"),
    chip("var(--mheat)", "Heat"),
    chip("var(--mcold)", "Cold"),
    chip("var(--ink)", "High", HIGH_OPACITY),
    chip("var(--ink)", "Severe"),
  ].join("");
  const hasRain = m.cells.some((c) => c.rain != null);
  const rainy = m.cells.some((c) => c.rain);
  const rainLg = ["Heavy", "Very heavy", "Extremely heavy"].map((l, i) => chip(`var(--mrain${i + 1})`, l)).join("");
  const risk = [
    chip("var(--m0)", "Low"),
    chip(RISK_COLOR.moderate, "Moderate"),
    chip(RISK_COLOR.high, "High"),
    chip(RISK_COLOR.severe, "Severe"),
  ].join("");
  const bands = (["good", "satisfactory", "moderate", "poor", "vpoor", "severe"] as const)
    .map((b) => chip(BAND_COLOR[b], AQI_BAND_LABEL[b]))
    .join("");
  const dotsBy = new Map<string, string[]>();
  for (const d of m.dots) push(dotsBy, d.band, `M${r1(px(d.lon))} ${r1(py(d.lat))}h0`);
  const allDots = [...dotsBy.values()].flat().join("");
  const dots = allDots
    ? `<path d="${allDots}" stroke="var(--card)" stroke-width="7" stroke-linecap="round"/>` +
      [...dotsBy]
        .map(
          ([b, d]) =>
            `<path d="${d.join("")}" stroke="${BAND_COLOR[b] ?? BAND_COLOR.unknown}" stroke-width="5" stroke-linecap="round"/>`,
        )
        .join("")
    : "";
  const cys = m.cyclones.filter((c) => c.basin);
  const cyText = cys.length
    ? `<div class="mcard">${cys.map((c) => `<p><b>${cycloneSentence(c, lang)}</b></p>`).join("")}<p class="msrc">${esc(
        t("Track: JTWC (US Navy). For official warnings, follow IMD.", lang),
      ).replace("IMD", '<a href="https://mausam.imd.gov.in/" rel="noopener">IMD</a>')}</p>${
        hasRain ? `<p><label for="ml-r" class="mto">${esc(t("See the rain", lang))}</label></p>` : ""
      }</div>`
    : "";
  return `<div class="imap">
<input type="radio" name="ml" id="ml-w" checked><input type="radio" name="ml" id="ml-a"><input type="radio" name="ml" id="ml-h">${hasRain ? '<input type="radio" name="ml" id="ml-r">' : ""}
<div class="mseg"><label for="ml-w">${esc(t("What's worst", lang))}</label><label for="ml-a">${esc(t("Air", lang))}</label><label for="ml-h">${esc(t("Heat", lang))}</label>${hasRain ? `<label for="ml-r">${esc(t("Rain", lang))}</label>` : ""}</div>
<svg class="msvg" viewBox="0 0 ${VW} ${VH}" role="img" aria-label="${esc(t("Map of India. Each square is coloured by what is worst in it now.", lang))}">
<defs><path id="mland" d="${LAND_PATH}"/><clipPath id="mclip"><use href="#mland"/></clipPath></defs>
<use href="#mland" class="mland"/>
<g clip-path="url(#mclip)" class="mcells"><g class="L Lw">${cellPaths(m.cells, worstFill)}</g><g class="L Lh">${cellPaths(m.cells, heatFill)}</g>${hasRain ? `<g class="L Lr">${cellPaths(m.cells, rainFill)}</g>` : ""}</g>
<path class="mstates" d="${STATE_PATH}"/>
<use href="#mland" class="mline"/>
<g class="L La">${dots}</g>
${cys.map(cycloneGlyph).join("")}
</svg>
<p class="mlg Lw">${what}</p><p class="mlg La">${bands}</p><p class="mlg Lh">${risk}</p>${hasRain ? `<p class="mlg Lr">${rainLg}</p>` : ""}
<p class="mnote Lw">${esc(t("Each square, about 100 km across, has the colour of what is worst in it, where that is high or severe. Air includes smoke and dust. Select a square to see that place.", lang))}${age(m.gridAsOf)}</p>
<p class="mnote La">${esc(t("Each dot is an air station, with the colour of its reading.", lang))}${age(m.airAsOf)}</p>
<p class="mnote Lh">${esc(t("Heat is modelled for each district.", lang))}${age(m.gridAsOf)}</p>${
    hasRain
      ? `${rainy ? "" : `<p class="mnote Lr"><b>${esc(t("No heavy rain is forecast in the next 24 hours.", lang))}</b></p>`}<p class="mnote Lr">${esc(t("Rain forecast for the next 24 hours, from a weather model. Models often underestimate the rain a cyclone brings.", lang))}${age(m.gridAsOf)}</p>`
      : ""
  }
<p class="mnote">${esc(t("Official warnings are not on this map. Look up a place to see them.", lang))}</p>
${cyText}
</div>`;
}

/** Select a square: open that place's page (the clicked coordinate, so a coastal
 *  square lands on land). The squares are clipped to India, so a click is always in it. */
export const MAP_JS = (lang: Lang) =>
  `(function(){var s=document.querySelector('.msvg');if(!s)return;s.addEventListener('click',function(e){if(!e.target.closest('.mland,.mcells,.La'))return;var p=s.createSVGPoint();p.x=e.clientX;p.y=e.clientY;var q=p.matrixTransform(s.getScreenCTM().inverse());location.href=${JSON.stringify(lp("/c/", lang))}+(${LAT1}-q.y/${S}).toFixed(2)+','+(${LON0}+q.x/${r1(KX * S * 1e4) / 1e4}).toFixed(2);});})();`;

export const MAP_CSS = `
:root{--m0:#e0f2fe;--mland:#eef2f6;--mair:#8b4513;--mheat:#e34948;--mcold:#2a78d6;--mrain1:#93c5fd;--mrain2:#3b82f6;--mrain3:#1e3a8a}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--m0:#16324a;--mland:#172033;--mair:#a0612e;--mheat:#e8606a;--mcold:#3987e5;--mrain1:#1d4ed8;--mrain2:#3b82f6;--mrain3:#bfdbfe}}
:root[data-theme="dark"]{--m0:#16324a;--mland:#172033;--mair:#a0612e;--mheat:#e8606a;--mcold:#3987e5;--mrain1:#1d4ed8;--mrain2:#3b82f6;--mrain3:#bfdbfe}
.imap{position:relative;margin:.2rem 0 .8rem}
.imap input{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}
.mseg{display:inline-flex;max-width:100%;overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin:0 0 .6rem}
.mseg label{min-height:40px;display:flex;align-items:center;padding:0 13px;white-space:nowrap;font-size:.88rem;font-weight:600;color:var(--muted);cursor:pointer;border-left:1px solid var(--line)}
.mseg label:first-child{border-left:0}
@media(max-width:360px){.mseg label{padding:0 9px;font-size:.82rem}}
#ml-w:checked~.mseg [for=ml-w],#ml-a:checked~.mseg [for=ml-a],#ml-h:checked~.mseg [for=ml-h],#ml-r:checked~.mseg [for=ml-r]{background:var(--ink);color:var(--bg)}
#ml-w:focus-visible~.mseg [for=ml-w],#ml-a:focus-visible~.mseg [for=ml-a],#ml-h:focus-visible~.mseg [for=ml-h],#ml-r:focus-visible~.mseg [for=ml-r]{outline:2px solid var(--sky);outline-offset:-2px}
.msvg{display:block;width:100%;max-width:440px;height:auto;cursor:pointer}
.mland{fill:var(--mland)}.mline{fill:none;stroke:var(--muted);stroke-width:.8;stroke-linejoin:round}
.mstates{fill:none;stroke:var(--ink);stroke-opacity:.6;stroke-width:.75;stroke-linejoin:round;stroke-linecap:round}
.mcells path{stroke:var(--card);stroke-width:.6}
.imap .L,.imap .mlg,.imap .mnote.Lw,.imap .mnote.La,.imap .mnote.Lh,.imap .mnote.Lr{display:none}
#ml-w:checked~.mnote.Lw,#ml-a:checked~.mnote.La,#ml-h:checked~.mnote.Lh,#ml-r:checked~.mnote.Lr{display:block}
#ml-w:checked~svg .Lw,#ml-a:checked~svg .La,#ml-h:checked~svg .Lh,#ml-r:checked~svg .Lr{display:inline}
#ml-w:checked~.Lw,#ml-a:checked~.La,#ml-h:checked~.Lh,#ml-r:checked~.Lr{display:flex}
.mlg{flex-wrap:wrap;gap:.3rem .8rem;margin:.5rem 0 0;font-size:.8rem;color:var(--muted)}
.mlg span{display:inline-flex;align-items:center;gap:.35rem}
.mlg i{width:12px;height:12px;border-radius:3px;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ink) 12%,transparent)}
.mnote{margin:.4rem 0 0;font-size:.8rem;color:var(--muted)}
.mcard{margin:.8rem 0 0;padding:10px 14px;border:1px solid var(--ink);border-radius:12px;background:var(--card)}
.mcard p{margin:0;line-height:1.45}.mcard p+p{margin-top:.3rem}
.mcard .msrc{font-size:.8rem;color:var(--muted)}
.mcard .mto{color:var(--sky);font-weight:600;text-decoration:underline;cursor:pointer}
`;

/** The map's data, from the snapshots the crons write (each read is memoised). */
export async function composeMap(env: Env): Promise<IndiaMap | undefined> {
  const [grid, snap, fires, cy] = await Promise.all([
    loadGrid(env),
    loadSnapshot(env),
    loadFires(env),
    loadCyclones(env),
  ]);
  if (!grid) return undefined;
  const stations = snap?.stations ?? [];
  return {
    cells: mapCells(grid.points, stations, fires?.fires ?? []),
    dots: airDots(stations),
    cyclones: cy?.systems ?? [],
    gridAsOf: grid.generated_at,
    airAsOf: snap?.generated_at,
  };
}
