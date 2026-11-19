import { esc } from "../html";
import { lp, quoted, t, type Lang } from "../i18n";
import { AQI_BAND_LABEL } from "../aqi";
import { allSlugPlaces } from "../slugs";
import { langPrefixJs, placeHref } from "../links";
import type { Cyclone } from "../cyclones";
import type { NormalizedStation } from "../types";
import {
  activeWarnings,
  cellPaths,
  cycloneGlyph,
  DIR_SENTENCE,
  KX,
  LAND_PATH,
  LAT1,
  LON0,
  px,
  py,
  r1,
  S,
  STATE_PATH,
  VH,
  VW,
  type IndiaMap,
  type MapCell,
  type MapPlace,
  type MapWarning,
} from "../indiamap";
import { relTime } from "./shell";
import { backLink, LEVEL_SHAPE, LEVEL_WORD, panel, segmented, SHAPE, stack, stamp, stamps } from "./components";
import { RISK_BANDS } from "../score";
import outlines from "../../data/states.json";

// IndiaMap: one component for home and /places (design standard §4). The squares are
// textures and outlines, never colour alone; every layer has a stamp of its age, a legend,
// a description that follows the switch, and a summary in words whose worst places are links
// (the keyboard and screen-reader path to what the map shows). Styles: standard.ts.

type Layer = "o" | "w" | "a" | "h" | "r";
const RAIN = ["", "Heavy", "Very heavy", "Extremely heavy"];
const LABEL: Record<Layer, string> = {
  o: "Map of India. Each coloured area is under an official warning now.",
  w: "Map of India. Each square is coloured by what is worst in it now.",
  a: "Map of India. Each dot is an air station, coloured by its reading.",
  h: "Map of India. Each square is coloured by its heat level.",
  r: "Map of India. Each square is coloured by the rain forecast for the next 24 hours.",
};
const NOTE: Record<Layer, string> = {
  o: "Areas under an official warning from NDMA or IMD, by the level it gives. Where warnings overlap, the higher level is on top. Select an area to see all warnings.",
  w: "Each square, about 100 km across, has the colour of what is worst in it, where that is high or severe. Air includes smoke and dust. Select a square, or pick a place from the list below.",
  a: "Each dot is an air station, with the colour of its reading.",
  h: "Heat is modelled for each district.",
  r: "Rain forecast for the next 24 hours, from a weather model. Models often underestimate the rain a cyclone brings.",
};
const BANDS: NormalizedStation["band"][] = ["severe", "vpoor", "poor", "moderate", "satisfactory", "good"];

/** The hazard textures, by id prefix `p` (one map per page): hatched for heat and high,
 *  dotted for cold, moderate and heavy rain, so no two hazards differ by hue alone. */
function patterns(p: string): string {
  const hatch = '<path class="s-bg" d="M-1 1l2-2M0 4l4-4M3 5l2-2"/>';
  const dots = '<circle class="f-bg" cx="2" cy="2" r=".9"/>';
  const pat = (id: string, fill: string, over: string) =>
    `<pattern id="${p}-${id}" patternUnits="userSpaceOnUse" width="4" height="4"><rect width="4" height="4" class="${fill}"/>${over}</pattern>`;
  return (
    pat("heat", "f-heat", hatch) +
    pat("cold", "f-cold", dots) +
    pat("lmod", "f-moderate", dots) +
    pat("lhigh", "f-high", hatch) +
    pat("r1", "f-r1", dots) +
    pat("r2", "f-r2", hatch)
  );
}

// A square's paint per layer: a token class (a plain fill) or a texture.
const url = (p: string, id: string) => `fill="url(#${p}-${id})"`;
const worstPaint = (p: string) => (c: MapCell) =>
  !c.what || c.worst < 2 ? undefined : c.what === "air" ? 'class="f-air"' : url(p, c.what);
/** High is a smaller square in the full paint: fading it toward the land blurred the hazards. */
const worstSize = (c: MapCell) => (c.worst < 3 ? 0.6 : 1);
const heatPaint = (p: string) => (c: MapCell) =>
  [undefined, url(p, "lmod"), url(p, "lhigh"), 'class="f-severe"'][c.heat];
const rainPaint = (p: string) => (c: MapCell) =>
  c.rain ? [undefined, url(p, "r1"), url(p, "r2"), 'class="f-r3"'][c.rain] : undefined;
/** A warning's paint by level, the Heat layer's textures: plain low, dotted moderate, hatched high, solid severe. */
const levelPaint = (p: string, level: number) =>
  ['class="f-low"', url(p, "lmod"), url(p, "lhigh"), 'class="f-severe"'][level];

/** The warned areas, one path per level, lowest first so the highest is on top. */
function warningsLayer(ws: MapWarning[], p: string): string {
  const by = new Map<number, string>();
  for (const w of ws) by.set(w.level, (by.get(w.level) ?? "") + w.d);
  return [...by]
    .sort(([a], [b]) => a - b)
    .map(([l, d]) => `<path ${levelPaint(p, l)} d="${d}"/>`)
    .join("");
}

/** A legend square in the same paint as the map (a class or a texture), outlined like the squares. */
/** A paint (a class or a texture) outlined like the map's squares. */
const outlined = (paint: string) =>
  paint.startsWith("class") ? paint.replace('class="', 'class="sq ') : `${paint} class="sq"`;
const swatch = (paint: string) =>
  `<svg aria-hidden="true" viewBox="0 0 18 18"><rect x=".6" y=".6" width="16.8" height="16.8" ${outlined(paint)}/></svg>`;
const key = (paint: string, label: string, lang: Lang) => `<span>${swatch(paint)}${esc(t(label, lang))}</span>`;

function legends(p: string, lang: Lang, rain: boolean, warned: boolean): string {
  const lg = (l: Layer, body: string) => `<p class="mlg L L${l}">${body}</p>`;
  // A level's shape in its paint, and its word: a warned area is never read by colour alone.
  const level = (l: number) =>
    `<span><svg aria-hidden="true" viewBox="0 0 24 24"><path d="${SHAPE[LEVEL_SHAPE[RISK_BANDS[l]]]}" ${outlined(levelPaint(p, l))}/></svg>${esc(t(LEVEL_WORD[RISK_BANDS[l]], lang))}</span>`;
  const dot = (b: NormalizedStation["band"]) =>
    `<span><svg aria-hidden="true" viewBox="0 0 18 18"><circle class="lvf b-${b}" cx="9" cy="9" r="7"/></svg>${esc(t(AQI_BAND_LABEL[b], lang))}</span>`;
  return (
    (warned ? lg("o", [0, 1, 2, 3].map(level).join("")) : "") +
    lg(
      "w",
      key('class="f-air"', "Air", lang) +
        key(url(p, "heat"), "Heat", lang) +
        key(url(p, "cold"), "Cold", lang) +
        `<span>${esc(t("Small: high. Full: severe.", lang))}</span>`,
    ) +
    lg("a", [...BANDS].reverse().map(dot).join("")) +
    lg(
      "h",
      key(url(p, "lmod"), "Moderate", lang) +
        key(url(p, "lhigh"), "High", lang) +
        key('class="f-severe"', "Severe", lang),
    ) +
    (rain
      ? lg(
          "r",
          key(url(p, "r1"), RAIN[1], lang) + key(url(p, "r2"), RAIN[2], lang) + key('class="f-r3"', RAIN[3], lang),
        )
      : "")
  );
}

/** The air stations: a halo, then one path per band (the band class gives the colour). */
function airDotsLayer(m: IndiaMap): string {
  const by = new Map<string, string>();
  for (const d of m.dots) by.set(d.band, (by.get(d.band) ?? "") + `M${r1(px(d.lon))} ${r1(py(d.lat))}h0`);
  if (!by.size) return "";
  return (
    `<path d="${[...by.values()].join("")}" stroke="var(--bg)" stroke-width="7" stroke-linecap="round"/>` +
    [...by].map(([b, d]) => `<path d="${d}" class="lvs b-${b}" stroke-width="5" stroke-linecap="round"/>`).join("")
  );
}

const hasRain = (m: IndiaMap) => m.cells.some((c) => c.rain != null);

/** The map's SVG: land, the squares of every layer, state lines, outline, air dots, cyclones.
 *  `extra` draws on top (the /places states and dots); `defs` adds to the definitions. */
/** `worstOnly`: the /places backdrop, the "what's worst" squares alone (no layer switch there),
 *  and no state lines, since the clickable state outlines draw them. */
function mapSvg(
  m: IndiaMap | undefined,
  p: string,
  label: string,
  lang: Lang,
  extra = "",
  defs = "",
  worstOnly = false,
  warned: MapWarning[] = [],
): string {
  const labels = m
    ? (Object.keys(LABEL) as Layer[]).map((l) => ` data-label-${l}="${esc(t(LABEL[l], lang))}"`).join("")
    : "";
  const others = (mm: IndiaMap) =>
    worstOnly
      ? ""
      : `<g class="L Lh">${cellPaths(mm.cells, heatPaint(p))}</g>${hasRain(mm) ? `<g class="L Lr">${cellPaths(mm.cells, rainPaint(p))}</g>` : ""}`;
  const cells = m
    ? `<g clip-path="url(#mclip)" class="mcells"><g class="L Lw">${cellPaths(m.cells, worstPaint(p), worstSize)}</g>${others(m)}</g>`
    : "";
  return (
    `<svg class="msvg" viewBox="0 0 ${VW} ${VH}" role="img" aria-label="${esc(label)}"${labels}>` +
    `<defs>${defs}${patterns(p)}<path id="mland" d="${LAND_PATH}"/><clipPath id="mclip"><use href="#mland"/></clipPath></defs>` +
    `<use href="#mland" class="mland"/>${cells}` +
    // Not clipped to the land: a warning can be for the sea off a coast.
    (warned.length ? `<g class="L Lo mwarn">${warningsLayer(warned, p)}</g>` : "") +
    `${worstOnly ? "" : `<path class="mstates" d="${STATE_PATH}"/>`}<use href="#mland" class="mline"/>` +
    (m && !worstOnly
      ? `<g class="L La">${airDotsLayer(m)}</g>${m.cyclones
          .filter((c) => c.basin)
          .map(cycloneGlyph)
          .join("")}`
      : "") +
    extra +
    `</svg>`
  );
}

// ── Words: the stamps, the summaries, the cyclone ──────────────────────────────────
const asOf = (iso: string, lang: Lang) => esc(t("as of X", lang)).replace("X", relTime(iso));
const squares = (n: number, lang: Lang) =>
  n === 1 ? t("1 square", lang) : t("X squares", lang).replace("X", String(n));
const sentence = (en: string, n: number, lang: Lang) => esc(t(en, lang)).replace("X", esc(squares(n, lang)));
const andList = (parts: string[], lang: Lang) =>
  parts.length < 2 ? parts.join("") : `${parts.slice(0, -1).join(", ")} ${t("and", lang)} ${parts[parts.length - 1]}`;

/** How much newer one stamp is than the other, said once they are an hour or more apart. */
function gapLine(m: IndiaMap, lang: Lang): string {
  if (!m.gridAsOf || !m.airAsOf) return "";
  const h = Math.round((Date.parse(m.airAsOf) - Date.parse(m.gridAsOf)) / 3.6e6);
  if (Math.abs(h) < 1) return "";
  const en =
    h > 0
      ? h === 1
        ? "The air dots are about an hour newer than the squares."
        : "The air dots are about X hours newer than the squares."
      : h === -1
        ? "The squares are about an hour newer than the air dots."
        : "The squares are about X hours newer than the air dots.";
  return `<p class="t-meta"><b>${esc(t(en, lang)).replace("X", String(Math.abs(h)))}</b></p>`;
}

/** A place on the map as a link to its page, with the word for how bad it is. */
function placeLink(at: MapPlace, word: string, lang: Lang): string {
  return `<a href="${placeHref(at.name, at, lang)}">${esc(at.state ? `${at.name}, ${at.state}` : at.name)}<span>${esc(t(word, lang))}</span></a>`;
}
/** The worst places of a layer, up to five, one per name. */
function worstLinks(
  cells: MapCell[],
  level: (c: MapCell) => number,
  at: (c: MapCell) => MapPlace | undefined,
  words: string[],
  lang: Lang,
): string {
  const seen = new Set<string>();
  const rows = cells
    .filter((c) => level(c) > 0 && at(c))
    .sort((a, b) => level(b) - level(a))
    .filter((c) => !seen.has(at(c)!.name) && !!seen.add(at(c)!.name))
    .slice(0, 5)
    .map((c) => placeLink(at(c)!, words[level(c)], lang));
  return rows.length ? `<div class="msum">${rows.join("")}</div>` : "";
}

/** "N official warnings are in force." */
export const inForce = (n: number, lang: Lang) =>
  n === 1
    ? esc(t("1 official warning is in force.", lang))
    : esc(t("X official warnings are in force.", lang)).replace("X", String(n));

/** The way to every warning, map or not. */
export const allWarningsLink = (lang: Lang) => backLink(lp("/warnings", lang), `${t("Active warnings", lang)} →`);

function summaries(m: IndiaMap, warned: MapWarning[], lang: Lang): string {
  const sum = (l: Layer, body: string) => `<div class="L L${l} stack">${body}</div>`;
  const b = (s: string) => `<p><b>${s}</b></p>`;
  // What's worst: how many squares each hazard is high or severe in.
  const worst = (["air", "heat", "cold"] as const)
    .map((h) => [h, m.cells.filter((c) => c.what === h && c.worst >= 2).length] as const)
    .filter(([, n]) => n > 0)
    .map(([h, n]) => sentence(`${h[0].toUpperCase()}${h.slice(1)} is high or severe in X.`, n, lang));
  // Air: the stations by band.
  const counts = BANDS.filter((x) => m.airCounts?.[x]).map(
    (x) => `${m.airCounts![x]} ${esc(t(AQI_BAND_LABEL[x], lang).toLowerCase())}`,
  );
  const total = BANDS.reduce((n, x) => n + (m.airCounts?.[x] ?? 0), 0);
  // Heat: the squares at each level above low.
  const heat = [3, 2, 1]
    .map((l) => [l, m.cells.filter((c) => c.heat === l).length] as const)
    .filter(([, n]) => n > 0)
    .map(([l, n]) => sentence(`Heat is ${LEVEL_WORD[RISK_BANDS[l]].toLowerCase()} in X.`, n, lang));
  const rainy = m.cells.filter((c) => c.rain).length;
  return (
    (warned.length ? sum("o", b(inForce(warned.length, lang)) + allWarningsLink(lang)) : "") +
    sum("w", b(worst.length ? worst.join(" ") : esc(t("Nothing is high or severe anywhere right now.", lang)))) +
    (total
      ? sum("a", b(`${esc(t("X air stations:", lang)).replace("X", String(total))} ${andList(counts, lang)}.`))
      : "") +
    sum(
      "h",
      b(
        heat.length
          ? `${heat.join(" ")} ${esc(t("Everywhere else it is low.", lang))}`
          : esc(t("Heat is low everywhere.", lang)),
      ) +
        worstLinks(
          m.cells,
          (c) => c.heat,
          (c) => c.heatAt,
          RISK_BANDS.map((b) => LEVEL_WORD[b]),
          lang,
        ),
    ) +
    (hasRain(m)
      ? sum(
          "r",
          b(
            rainy
              ? sentence("Heavy rain is forecast in X in the next 24 hours.", rainy, lang)
              : esc(t("No heavy rain is forecast in the next 24 hours.", lang)),
          ) +
            worstLinks(
              m.cells,
              (c) => c.rain ?? 0,
              (c) => c.rainAt,
              RAIN,
              lang,
            ),
        )
      : "")
  );
}

/** What a cyclone is doing, in words: IMD's category and name when IMD has named this storm. */
function cycloneSentence(c: Cyclone, lang: Lang, official?: string): string {
  const sea = c.basin === "arabian" ? "Arabian Sea" : "Bay of Bengal";
  const named = official && c.name && official.toLowerCase().includes(c.name.toLowerCase());
  const where =
    c.kind === "alert"
      ? esc(t(`A cyclone can form in the ${sea}.`, lang))
      : named
        ? esc(t(`X is in the ${sea}.`, lang)).replace("X", quoted(official, lang))
        : c.name
          ? esc(t(`Cyclone X is in the ${sea}.`, lang)).replace("X", esc(c.name))
          : esc(t(`A cyclone is in the ${sea}.`, lang));
  return c.moving ? `${where} ${esc(t(DIR_SENTENCE[c.moving], lang))}` : where;
}

function cycloneNotes(m: IndiaMap, lang: Lang, official?: string): string {
  const track = esc(t("Track: JTWC (US Navy). For official warnings, follow IMD.", lang)).replace(
    /IMD\.$/,
    '<a href="https://mausam.imd.gov.in/" rel="noopener">IMD</a>.',
  );
  return m.cyclones
    .filter((c) => c.basin)
    .map(
      (c) =>
        `<div class="notice stack"><p class="row-c"><b>${cycloneSentence(c, lang, official)}</b></p>` +
        (c.at ? stamp("JTWC", asOf(c.at, lang)) : "") +
        `<p class="t-meta">${track}</p>` +
        (hasRain(m)
          ? `<button type="button" class="btn" data-layer-to="r">${esc(t("See the rain", lang))}</button>`
          : "") +
        `</div>`,
    )
    .join("");
}

export interface IndiaMapOpts {
  /** IMD's title for the storm on the map ("Severe Cyclonic Storm Akvan"), from its warning. */
  cyclone?: string;
  /** More beside the map, under its words (the national highlights). Markup. */
  aside?: string;
  /** The time the warnings are judged in force at (now). */
  now?: number;
}

/** The home map: the switch and the map in a panel, its stamps, words and summaries beside it. */
export function indiaMap(m: IndiaMap | undefined, lang: Lang, o: IndiaMapOpts = {}): string {
  const offMap = `<p class="t-meta">${esc(t("Official warnings are not on this map. Look up a place to see them.", lang))}</p>`;
  if (!m) {
    const empty = `<div class="mempty"><p><b>${esc(t("The map is not ready yet.", lang))}</b><br>${esc(t("It appears once the first readings are in. Look up a place to see its sky now.", lang))}</p></div>`;
    return `<div class="imap" data-layer="w"><div class="lane l75">${panel(empty, { title: t("India now", lang), tag: "div" })}${stack(offMap + (o.aside ?? ""))}</div></div>`;
  }
  const rain = hasRain(m);
  // Official warnings in force: their layer comes first and the map opens on it. Otherwise the
  // map opens on What's worst (IMD issues no air-quality warning, so that is the usual case).
  const warned = activeWarnings(m, o.now);
  const first: Layer = warned.length ? "o" : "w";
  const layers: [Layer, string][] = [
    ...(warned.length ? ([["o", "Warnings"]] as [Layer, string][]) : []),
    ["w", "What's worst"],
    ["a", "Air"],
    ["h", "Heat"],
    ...(rain ? ([["r", "Rain"]] as [Layer, string][]) : []),
  ];
  const seg = segmented(
    "layer",
    t("Map layer", lang),
    layers.map(([v, l]) => ({ value: v, label: t(l, lang), checked: v === first })),
    { legendClass: "vh", segClass: "fit" },
  );
  const svg = mapSvg(m, "m", t(LABEL[first], lang), lang, "", "", false, warned);
  const box = stack(seg + svg + legends("m", lang, rain, warned.length > 0));
  // Each stamp dates its layers. They sit in the map's bar, the selected layer's alone: the
  // switch's script marks the others off as the tab changes.
  const dated = (label: string, iso: string, layers: string) =>
    stamp(t(label, lang), asOf(iso, lang), { layers, off: !layers.includes(first) });
  const st = stamps([
    ...(warned.length && m.warningsAsOf ? [dated("Official warnings", m.warningsAsOf, "o")] : []),
    ...(m.gridAsOf ? [dated("Squares, heat and rain", m.gridAsOf, "whr")] : []),
    ...(m.airAsOf ? [dated("Air station dots", m.airAsOf, "a")] : []),
  ]);
  const notes = (Object.keys(NOTE) as Layer[])
    .filter((l) => (l !== "r" || rain) && (l !== "o" || warned.length))
    .map((l) => `<p class="t-meta L L${l}">${esc(t(NOTE[l], lang))}</p>`)
    .join("");
  // With no warning on the map, say so (when the areas were read) and point to the full list.
  const offNote = warned.length
    ? ""
    : m.warnings
      ? `<p class="t-meta">${esc(t("No official warnings are on the map now.", lang))}</p>${allWarningsLink(lang)}`
      : offMap;
  const side = stack(
    gapLine(m, lang) +
      notes +
      summaries(m, warned, lang) +
      offNote +
      cycloneNotes(m, lang, o.cyclone) +
      (o.aside ?? ""),
  );
  return `<div class="imap" data-layer="${first}"><div class="lane l75">${panel(box, { title: t("India now", lang), tag: "div", end: st })}${side}</div></div>`;
}

// ── /places: the states to click, a dot per place ──────────────────────────────────
/** A state's anchor on /places (its fold's id), shared by the map and the list. */
export const stateAnchor = (state: string) =>
  `st-${state
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;

const WMARK = `<symbol id="wmark" viewBox="0 0 24 24"><path class="wm-bg" d="${SHAPE.triangle}"/><path class="wm-fg" d="M12 9v5M12 17.5v.5" fill="none"/></symbol>`;

/** The /places map: the What's-worst squares faint behind (when the grid is in), every state an
 *  outline to select (LGD via bharatlas), every place a neutral dot, warned places marked. The
 *  states and dots are aria-hidden: the state picker and the list are the same path by keyboard.
 *  `dots` ([x, y, slug]) lets a click open the place under the pointer. */
export function placesMap(m: IndiaMap | undefined, warned: string[], lang: Lang): { svg: string; dots: PlaceDots } {
  const warn = new Set(warned);
  const all = allSlugPlaces().map((p) => [r1(px(p.lon)), r1(py(p.lat)), p.slug] as const);
  const plain = all
    .filter(([, , s]) => !warn.has(s))
    .map(([x, y]) => `M${x} ${y}h0`)
    .join("");
  const marks = all
    .filter(([, , s]) => warn.has(s))
    .map(([x, y]) => `<use href="#wmark" x="${r1(x - 3.5)}" y="${r1(y - 3.5)}" width="7" height="7"/>`)
    .join("");
  const extra =
    `<g class="mstates-hit" aria-hidden="true">${STATE_OUTLINES}</g>` +
    `<g class="pdots" aria-hidden="true"><use href="#pdp" class="pdot-halo"/><use href="#pdp" class="pdot"/>${marks}</g>`;
  const label = t("Map of India with every place on mugilu. Select a state to see its places.", lang);
  const dots = { s: all.map(([, , s]) => s).join(" "), p: all.flatMap(([x, y]) => [x, y]) };
  return {
    svg: mapSvg(m && { ...m, cyclones: [] }, "pl", label, lang, extra, WMARK + `<path id="pdp" d="${plain}"/>`, true),
    dots,
  };
}

/** The /places dots for the click handler, compact: the slugs space-separated, and their
 *  x, y pairs in the same order (the page parses them on the first click). */
export interface PlaceDots {
  s: string;
  p: number[];
}

/** The 36 clickable state outlines: the same for every request, built once. */
const STATE_OUTLINES = Object.entries(outlines as Record<string, string>)
  .map(([st, d]) => `<path class="mstate" data-st="${stateAnchor(st)}" d="${d}"/>`)
  .join("");

/** A place dot's hit radius on /places, in map units: its drawn radius (the 2.4 stroke's
 *  round cap, 1.2) plus 1. Further out, a click belongs to the state under it. */
export const DOT_HIT = 2.2;

/** The place dot a click at (x, y) lands on, or null: the nearest within `r`. Shipped to the
 *  browser as source (MAP_JS), so it must stay plain, self-contained JavaScript. */
export function nearestDot(dots: [number, number, string][], x: number, y: number, r: number): string | null {
  let best: string | null = null;
  let bd = r * r;
  for (const d of dots) {
    const k = (d[0] - x) * (d[0] - x) + (d[1] - y) * (d[1] - y);
    if (k <= bd) {
      bd = k;
      best = d[2];
    }
  }
  return best;
}

/** The map's behaviour: the layer switch (and its stamps and description), "See the rain", and a
 *  click: on home a warned area opens the warnings, anywhere else the place under the pointer; on /places the nearest place dot, or
 *  else the state (scrolls to its list, via the page's `openState`). */
export const MAP_JS = (lang: Lang) =>
  `(function(){var LP=${langPrefixJs(lang)};var nearestDot=${nearestDot.toString()};document.querySelectorAll('.imap').forEach(function(im){var sv=im.querySelector('svg.msvg');
function set(v){im.setAttribute('data-layer',v);var l=sv&&sv.getAttribute('data-label-'+v);if(l)sv.setAttribute('aria-label',l);im.querySelectorAll('.stamp[data-layers]').forEach(function(s){s.classList.toggle('off',s.getAttribute('data-layers').indexOf(v)<0);});}
im.addEventListener('change',function(e){if(e.target.name==='layer')set(e.target.value);});
im.addEventListener('click',function(e){var b=e.target.closest('[data-layer-to]');if(!b)return;var r=im.querySelector('input[name=layer][value='+b.getAttribute('data-layer-to')+']');if(r){r.checked=true;set(r.value);r.focus();}});
if(!sv)return;var J=im.querySelector('script[type="application/json"]'),D=null;
function dots(){if(!D){var o=JSON.parse(J.textContent),s=o.s.split(' ');D=s.map(function(k,i){return[o.p[2*i],o.p[2*i+1],k];});}return D;}
sv.addEventListener('click',function(e){var p=sv.createSVGPoint();p.x=e.clientX;p.y=e.clientY;var q=p.matrixTransform(sv.getScreenCTM().inverse());
if(J){var D=dots();var best=nearestDot(D,q.x,q.y,${DOT_HIT});if(best){location.href=LP+'/c/'+best;return;}var s=e.target.closest('.mstate');if(s&&window.openState)openState(s.getAttribute('data-st'));return;}
if(e.target.closest('.mwarn')){location.href=LP+'/warnings';return;}
if(e.target.closest('.mland,.mcells,.La'))location.href=LP+'/c/'+(${LAT1}-q.y/${S}).toFixed(2)+','+(${LON0}+q.x/${r1(KX * S * 1e4) / 1e4}).toFixed(2);});});})();`;

/** The /places map's keys: what a dot is, what a warned mark is. */
export function placesKey(lang: Lang, warned: boolean): string {
  return (
    `<p class="mkey"><span><svg viewBox="0 0 24 24" aria-hidden="true"><circle class="f-ink" cx="12" cy="12" r="5"/></svg>${esc(t("Each dot is a place on mugilu. Select a state to see its places.", lang))}</span>` +
    (warned
      ? `<span><svg viewBox="0 0 24 24" aria-hidden="true"><path class="f-ink" d="${SHAPE.triangle}"/></svg>${esc(t("Under an official warning now", lang))}</span>`
      : "") +
    `</p>`
  );
}

/** What a "What's worst" square shows: under the /places map and on /methodology. */
export const SQUARES_NOTE =
  "Each square, about 100 km across, has the colour of what is worst in it, where that is high or severe. Air includes smoke and dust.";

/** The grid's stamp and the squares' note under the /places map. */
export function placesMapNote(m: IndiaMap | undefined, lang: Lang): string {
  if (!m?.gridAsOf) return "";
  return (
    stamp(t("Squares, heat and rain", lang), asOf(m.gridAsOf, lang)) +
    `<p class="t-meta">${esc(t(SQUARES_NOTE, lang))}</p>`
  );
}
