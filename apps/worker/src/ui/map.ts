import { esc } from "../html";
import { lp, t, type Lang } from "../i18n";
import { AQI_BAND_LABEL } from "../aqi";
import { allSlugPlaces, slugForName } from "../slugs";
import type { Cyclone } from "../cyclones";
import type { NormalizedStation } from "../types";
import {
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
} from "../indiamap";
import { relTime } from "./shell";
import { panel, segmented, stack, stamp, stamps } from "./components";
import outlines from "../../data/states.json";

// IndiaMap: one component for home and /places (design standard §4). The squares are
// textures and outlines, never colour alone; every layer has a stamp of its age, a legend,
// a description that follows the switch, and a summary in words whose worst places are links
// (the keyboard and screen-reader path to what the map shows). Styles: standard.ts.

type Layer = "w" | "a" | "h" | "r";
const LEVEL = ["Low", "Moderate", "High", "Severe"];
const RAIN = ["", "Heavy", "Very heavy", "Extremely heavy"];
const LABEL: Record<Layer, string> = {
  w: "Map of India. Each square is coloured by what is worst in it now.",
  a: "Map of India. Each dot is an air station, coloured by its reading.",
  h: "Map of India. Each square is coloured by its heat level.",
  r: "Map of India. Each square is coloured by the rain forecast for the next 24 hours.",
};
const NOTE: Record<Layer, string> = {
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

/** A legend square in the same paint as the map (a class or a texture), outlined like the squares. */
const swatch = (paint: string) => {
  const p = paint.startsWith("class") ? paint.replace('class="', 'class="sq ') : `${paint} class="sq"`;
  return `<svg aria-hidden="true" viewBox="0 0 18 18"><rect x=".6" y=".6" width="16.8" height="16.8" ${p}/></svg>`;
};
const key = (paint: string, label: string, lang: Lang) => `<span>${swatch(paint)}${esc(t(label, lang))}</span>`;

function legends(p: string, lang: Lang, rain: boolean): string {
  const lg = (l: Layer, body: string) => `<p class="mlg L L${l}">${body}</p>`;
  const dot = (b: NormalizedStation["band"]) =>
    `<span><svg aria-hidden="true" viewBox="0 0 18 18"><circle class="lvf b-${b}" cx="9" cy="9" r="7"/></svg>${esc(t(AQI_BAND_LABEL[b], lang))}</span>`;
  return (
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
    `<path d="${[...by.values()].join("")}" stroke="var(--card)" stroke-width="7" stroke-linecap="round"/>` +
    [...by].map(([b, d]) => `<path d="${d}" class="lvs b-${b}" stroke-width="5" stroke-linecap="round"/>`).join("")
  );
}

const hasRain = (m: IndiaMap) => m.cells.some((c) => c.rain != null);

/** The map's SVG: land, the squares of every layer, state lines, outline, air dots, cyclones.
 *  `extra` draws on top (the /places states and dots); `defs` adds to the definitions. */
function mapSvg(m: IndiaMap | undefined, p: string, label: string, lang: Lang, extra = "", defs = ""): string {
  const labels = m
    ? (Object.keys(LABEL) as Layer[]).map((l) => ` data-label-${l}="${esc(t(LABEL[l], lang))}"`).join("")
    : "";
  const cells = m
    ? `<g clip-path="url(#mclip)" class="mcells"><g class="L Lw">${cellPaths(m.cells, worstPaint(p), worstSize)}</g>` +
      `<g class="L Lh">${cellPaths(m.cells, heatPaint(p))}</g>${hasRain(m) ? `<g class="L Lr">${cellPaths(m.cells, rainPaint(p))}</g>` : ""}</g>`
    : "";
  return (
    `<svg class="msvg" viewBox="0 0 ${VW} ${VH}" role="img" aria-label="${esc(label)}"${labels}>` +
    `<defs>${defs}${patterns(p)}<path id="mland" d="${LAND_PATH}"/><clipPath id="mclip"><use href="#mland"/></clipPath></defs>` +
    `<use href="#mland" class="mland"/>${cells}<path class="mstates" d="${STATE_PATH}"/><use href="#mland" class="mline"/>` +
    (m
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
  const slug = slugForName(at.name);
  const href = lp(slug ? `/c/${slug}` : `/c/${at.lat},${at.lon}`, lang);
  return `<a href="${href}">${esc(at.state ? `${at.name}, ${at.state}` : at.name)}<span>${esc(t(word, lang))}</span></a>`;
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

function summaries(m: IndiaMap, lang: Lang): string {
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
    .map(([l, n]) => sentence(`Heat is ${LEVEL[l].toLowerCase()} in X.`, n, lang));
  const rainy = m.cells.filter((c) => c.rain).length;
  return (
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
          LEVEL,
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
export function cycloneSentence(c: Cyclone, lang: Lang, official?: string): string {
  const sea = c.basin === "arabian" ? "Arabian Sea" : "Bay of Bengal";
  const named = official && c.name && official.toLowerCase().includes(c.name.toLowerCase());
  const where =
    c.kind === "alert"
      ? esc(t(`A cyclone can form in the ${sea}.`, lang))
      : named
        ? esc(t(`X is in the ${sea}.`, lang)).replace("X", esc(official))
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
}

/** The home map: the switch and the map in a panel, its stamps, words and summaries beside it. */
export function indiaMap(m: IndiaMap | undefined, lang: Lang, o: IndiaMapOpts = {}): string {
  const offMap = `<p class="t-meta">${esc(t("Official warnings are not on this map. Look up a place to see them.", lang))}</p>`;
  if (!m) {
    const empty = `<div class="mempty"><p><b>${esc(t("The map is not ready yet.", lang))}</b><br>${esc(t("It appears once the first readings are in. Look up a place to see its sky now.", lang))}</p></div>`;
    return `<div class="imap" data-layer="w"><div class="lane l75">${panel(empty, { title: t("India now", lang), tag: "div" })}${stack(offMap + (o.aside ?? ""))}</div></div>`;
  }
  const rain = hasRain(m);
  const layers: [Layer, string][] = [
    ["w", "What's worst"],
    ["a", "Air"],
    ["h", "Heat"],
    ...(rain ? ([["r", "Rain"]] as [Layer, string][]) : []),
  ];
  const seg = segmented(
    "layer",
    t("Map layer", lang),
    layers.map(([v, l]) => ({ value: v, label: t(l, lang), checked: v === "w" })),
    "vh",
  );
  const box = stack(seg + mapSvg(m, "m", t(LABEL.w, lang), lang) + legends("m", lang, rain));
  const st = stamps([
    ...(m.gridAsOf ? [stamp(t("Squares, heat and rain", lang), asOf(m.gridAsOf, lang))] : []),
    ...(m.airAsOf ? [stamp(t("Air station dots", lang), asOf(m.airAsOf, lang), { off: true })] : []),
  ]);
  const notes = (Object.keys(NOTE) as Layer[])
    .filter((l) => l !== "r" || rain)
    .map((l) => `<p class="t-meta L L${l}">${esc(t(NOTE[l], lang))}</p>`)
    .join("");
  const side = stack(
    st + gapLine(m, lang) + notes + summaries(m, lang) + offMap + cycloneNotes(m, lang, o.cyclone) + (o.aside ?? ""),
  );
  return `<div class="imap" data-layer="w"><div class="lane l75">${panel(box, { title: t("India now", lang), tag: "div" })}${side}</div></div>`;
}

// ── /places: the states to click, a dot per place ──────────────────────────────────
/** A state's anchor on /places (its fold's id), shared by the map and the list. */
export const stateAnchor = (state: string) =>
  `st-${state
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;

const WMARK =
  '<symbol id="wmark" viewBox="0 0 24 24"><path class="wm-bg" d="M12 2 23 21H1z"/><path class="wm-fg" d="M12 9v5M12 17.5v.5" fill="none"/></symbol>';

/** The /places map: the What's-worst squares faint behind (when the grid is in), every state an
 *  outline to select (LGD via bharatlas), every place a neutral dot, warned places marked. The
 *  states and dots are aria-hidden: the state picker and the list are the same path by keyboard.
 *  `dots` ([x, y, slug]) lets a click open the place under the pointer. */
export function placesMap(
  m: IndiaMap | undefined,
  warned: string[],
  lang: Lang,
): { svg: string; dots: [number, number, string][] } {
  const warn = new Set(warned);
  const dots = allSlugPlaces().map((p) => [r1(px(p.lon)), r1(py(p.lat)), p.slug] as [number, number, string]);
  const plain = dots
    .filter(([, , s]) => !warn.has(s))
    .map(([x, y]) => `M${x} ${y}h0`)
    .join("");
  const marks = dots
    .filter(([, , s]) => warn.has(s))
    .map(([x, y]) => `<use href="#wmark" x="${r1(x - 3.5)}" y="${r1(y - 3.5)}" width="7" height="7"/>`)
    .join("");
  const states = Object.entries(outlines as Record<string, string>)
    .map(([st, d]) => `<path class="mstate" data-st="${stateAnchor(st)}" d="${d}"/>`)
    .join("");
  const extra =
    `<g class="mstates-hit" aria-hidden="true">${states}</g>` +
    `<g class="pdots" aria-hidden="true"><path class="pdot-halo" d="${plain}"/><path class="pdot" d="${plain}"/>${marks}</g>`;
  const label = t("Map of India with every place on mugilu. Select a state to see its places.", lang);
  return { svg: mapSvg(m && { ...m, cyclones: [] }, "pl", label, lang, extra, WMARK), dots };
}

/** The map's behaviour: the layer switch (and its stamps and description), "See the rain", and a
 *  click: on home it opens the place under the pointer; on /places the nearest place dot, or
 *  else the state (scrolls to its list, via the page's `openState`). */
export const MAP_JS = (lang: Lang) =>
  `(function(){var LP=${JSON.stringify(lang === "en" ? "" : "/" + lang)};document.querySelectorAll('.imap').forEach(function(im){var sv=im.querySelector('svg.msvg');
function set(v){im.setAttribute('data-layer',v);var l=sv&&sv.getAttribute('data-label-'+v);if(l)sv.setAttribute('aria-label',l);var ss=im.querySelectorAll('.stamps .stamp');if(ss.length>1){ss[0].classList.toggle('off',v==='a');ss[1].classList.toggle('off',v!=='a');}}
im.addEventListener('change',function(e){if(e.target.name==='layer')set(e.target.value);});
im.addEventListener('click',function(e){var b=e.target.closest('[data-layer-to]');if(!b)return;var r=im.querySelector('input[name=layer][value='+b.getAttribute('data-layer-to')+']');if(r){r.checked=true;set(r.value);r.focus();}});
if(!sv)return;var D=im.querySelector('script[type="application/json"]');D=D?JSON.parse(D.textContent):null;
sv.addEventListener('click',function(e){var p=sv.createSVGPoint();p.x=e.clientX;p.y=e.clientY;var q=p.matrixTransform(sv.getScreenCTM().inverse());
if(D){var best=null,bd=36;D.forEach(function(d){var k=(d[0]-q.x)*(d[0]-q.x)+(d[1]-q.y)*(d[1]-q.y);if(k<bd){bd=k;best=d;}});if(best){location.href=LP+'/c/'+best[2];return;}var s=e.target.closest('.mstate');if(s&&window.openState)openState(s.getAttribute('data-st'));return;}
if(e.target.closest('.mland,.mcells,.La'))location.href=LP+'/c/'+(${LAT1}-q.y/${S}).toFixed(2)+','+(${LON0}+q.x/${r1(KX * S * 1e4) / 1e4}).toFixed(2);});});})();`;

/** The /places map's keys: what a dot is, what a warned mark is. */
export function placesKey(lang: Lang, warned: boolean): string {
  return (
    `<p class="mkey"><span><svg viewBox="0 0 24 24" aria-hidden="true"><circle class="f-ink" cx="12" cy="12" r="5"/></svg>${esc(t("Each dot is a place on mugilu. Select a state to see its places.", lang))}</span>` +
    (warned
      ? `<span><svg viewBox="0 0 24 24" aria-hidden="true"><path class="f-ink" d="M12 2 23 21H1z"/></svg>${esc(t("Under an official warning now", lang))}</span>`
      : "") +
    `</p>`
  );
}

/** The grid's stamp and the squares' note under the /places map. */
export function placesMapNote(m: IndiaMap | undefined, lang: Lang): string {
  if (!m?.gridAsOf) return "";
  return (
    stamp(t("Squares, heat and rain", lang), asOf(m.gridAsOf, lang)) +
    `<p class="t-meta">${esc(t("Each square, about 100 km across, has the colour of what is worst in it, where that is high or severe. Air includes smoke and dust.", lang))}</p>`
  );
}
