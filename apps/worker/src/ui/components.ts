import { langPrefixJs } from "../links";
import { esc, textOrHtml, type Html } from "../html";
import { LANGS, LANG_NAME, langAttr, lp, quoted, t, type Lang } from "../i18n";
import type { RiskBand } from "../score";
import { installButton } from "../install";
import { qrSvg } from "../qr";
import { CLIENT_ESC } from "./shell";

// The design standard's components (supporting-docs/redesign/design-standard.md §4), one
// function each, returning markup for the classes in standard.ts. Pages compose these and
// carry no styles of their own. Every visible string goes through t(); every value from
// data goes through esc().

// ── Shapes and level chips ──────────────────────────────────────────────────────────
// A level is never colour alone: shape + word + colour. Severe is an octagon with a
// knocked-out bar (a no-entry sign), so it never reads as Low's circle at chip size.
export const SHAPE = {
  circle: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z",
  diamond: "M12 1 23 12 12 23 1 12z",
  triangle: "M12 2 23 21H1z",
  octagon: "M8 1h8l7 7v8l-7 7H8l-7-7V8zM5.5 10.25v3.5h13v-3.5z",
  dash: "M3 10.5h18v3H3z",
} as const;
export type ShapeName = keyof typeof SHAPE;
export const LEVEL_SHAPE: Record<RiskBand, ShapeName> = {
  low: "circle",
  moderate: "diamond",
  high: "triangle",
  severe: "octagon",
};
export const BAND_SHAPE: Record<string, ShapeName> = {
  good: "circle",
  satisfactory: "circle",
  moderate: "diamond",
  poor: "triangle",
  vpoor: "octagon",
  severe: "octagon",
  unknown: "dash",
};
export const LEVEL_WORD: Record<RiskBand, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  severe: "Severe",
};

export function shape(kind: ShapeName, cls = "shape"): string {
  return `<svg class="${cls}" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd"><path d="${SHAPE[kind]}"/></svg>`;
}

/** LevelChip for a hazard level (a no-hazard reading is Low). */
export function levelChip(level: RiskBand, lang: Lang): string {
  return `<span class="chip ${level}">${shape(LEVEL_SHAPE[level])}${esc(t(LEVEL_WORD[level], lang))}</span>`;
}

/** LevelChip for a CPCB AQI band, with the band's own word (already localised by the caller). */
export function bandChip(band: string, word: string): string {
  const b = band in BAND_SHAPE ? band : "unknown";
  return `<span class="chip b-${b}">${shape(BAND_SHAPE[b])}${esc(word)}</span>`;
}

// ── Header and footer ───────────────────────────────────────────────────────────────
const CLOUD = "M7 19a5 5 0 0 1-.9-9.9A6 6 0 0 1 17.6 10 4.5 4.5 0 0 1 17 19z";

/** The main nav: the screen page is named by the live "Put this on a screen". */
export const NAV: [path: string, label: string][] = [
  ["/places", "Places"],
  ["/warnings", "Warnings"],
  ["/display", "Put this on a screen"],
  ["/methodology", "How it works"],
  ["/about", "About"],
];

const current = (on: boolean) => (on ? ' aria-current="page"' : "");

/** The language switch: each language in its own script, the current one bold. A landmark
 *  once (the header); in the footer a plain group. Links are path-only, so they work on any host. */
/** Pages with no counterpart in another language (the 404 and offline pages) switch to home. */
const NO_COUNTERPART = new Set(["/404", "/offline"]);

/** The language links: this page (and its query, such as ?as=asthma) in each language. */
export function langSwitch(path: string, lang: Lang, where: "header" | "footer", query = ""): string {
  const to = NO_COUNTERPART.has(path) ? "/" : path;
  const q = NO_COUNTERPART.has(path) ? "" : query;
  const items = LANGS.map((L) =>
    L === lang
      ? `<b>${LANG_NAME[L]}</b>`
      : `<a href="${esc(lp(to, L) + q)}" lang="${L}" hreflang="${L}">${LANG_NAME[L]}</a>`,
  ).join(" · ");
  const label = esc(t("Language", lang));
  return where === "header"
    ? `<nav class="langs" aria-label="${label}">${items}</nav>`
    : `<div class="flangs" role="group" aria-label="${label}">${items}</div>`;
}

/** SiteHeader. DOM order is the reading order at every width: skip link, brand, Install app,
 *  nav, language. `path` is the language-agnostic path of this page. */
export function siteHeader(path: string, lang: Lang, query = ""): string {
  const nav = NAV.map(([p, en]) => `<a href="${lp(p, lang)}"${current(p === path)}>${esc(t(en, lang))}</a>`).join("");
  return (
    `<header class="sh"><a class="skip" href="#main">${esc(t("Skip to content", lang))}</a><div class="wrap">` +
    `<a class="brand" href="${lp("/", lang)}">${wordmark()}</a>` +
    installButton(lang, { button: "btn", dialog: "isheet" }) +
    `<button type="button" class="btn mtog" aria-expanded="false" aria-controls="mnav" hidden>${ico("list")}${esc(t("Menu", lang))}</button>` +
    `<nav class="nav" id="mnav" aria-label="${esc(t("Main", lang))}">${nav}</nav>${langSwitch(path, lang, "header", query)}</div></header>`
  );
}

/** Phones: the script shows the Menu button and folds the nav (and the languages) behind
 *  it; without the script the nav stays the scrolling row. Escape closes it, back to the button. */
export const MENU_JS = `(function(){var h=document.querySelector('.sh'),b=h&&h.querySelector('.mtog');if(!b)return;h.classList.add('mjs');b.hidden=false;
function set(o){h.classList.toggle('open',o);b.setAttribute('aria-expanded',o?'true':'false');}
b.addEventListener('click',function(){set(b.getAttribute('aria-expanded')!=='true');});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&h.classList.contains('open')){set(false);b.focus();}});})();`;

/** The cloud mark (64-unit grid), shared with the favicon and app icons. */
export const CLOUD_PATHS =
  '<rect x="13" y="34" width="38" height="14" rx="7"/>' +
  '<circle cx="24" cy="32" r="10"/><circle cx="38" cy="29" r="12"/><circle cx="47" cy="37" r="7"/>';

/** The wordmark: the blue cloud and "mugilu" in its fixed font. Never translated or
 *  restyled by the type roles (lang="en" keeps the Indic font swap off it). */
export function wordmark(): string {
  return (
    `<svg class="bm" aria-hidden="true" viewBox="0 0 64 64"><g fill="var(--brand)">${CLOUD_PATHS}</g></svg>` +
    `<span class="wm" lang="en" translate="no">mugilu</span>`
  );
}

/** The disclaimer, the live wording, on every surface. */
export const DISCLAIMER_FULL =
  "Informational only, not for medical, emergency, or safety-critical decisions. For official warnings, consult NDMA and IMD.";
/** The short live line: only the embed card below 400px wide uses it (rule 6). */
export const DISCLAIMER_SHORT = "Informational only, not medical advice.";

const FOOT_LINKS: [href: string, label: string, external?: boolean][] = [
  ["/about", "about"],
  ["/methodology", "how it works"],
  ["/places", "all places"],
  ["/warnings", "warnings"],
  ["/display", "put this on a screen"],
  ["/about#build", "build on it"],
  ["/mcp", "MCP server"],
  ["/terms", "terms"],
  ["https://github.com/urbanmorph/mugilu", "code", true],
  ["https://github.com/urbanmorph/mugilu/blob/main/PDGI.md", "a digital commons", true],
];

/** SiteFooter: site links, the language switch, the theme switch, the disclaimer. */
export function siteFooter(path: string, lang: Lang, extra = "", query = ""): string {
  const links = FOOT_LINKS.map(
    ([h, en, ext]) => `<a href="${ext ? h : lp(h, lang)}"${current(!ext && h === path)}>${esc(t(en, lang))}</a>`,
  ).join(" · ");
  return (
    `<footer class="sf"><div class="wrap"><nav class="flinks" aria-label="${esc(t("Site", lang))}">${links}</nav>` +
    `<div class="frow">${langSwitch(path, lang, "footer", query)}${themeSwitch(lang)}</div>${extra}` +
    `<p class="disc">${esc(t(DISCLAIMER_FULL, lang))}</p></div></footer>`
  );
}

// ── Segmented (one choice of several, native radios) and the theme switch ───────────
export interface SegOption {
  value: string;
  label: string;
  checked?: boolean;
}

/** Segmented: native radios in a fieldset, so keyboard, screen readers and forced colours
 *  work without script. Options with an href navigate on change (SEGMENTED_JS). */
export function segmented(
  name: string,
  legend: string,
  options: SegOption[],
  /** legendClass: "vh" hides the legend; segClass lays out the options ("grid2 d3"). */
  { legendClass = "t-kicker", segClass = "" }: { legendClass?: string; segClass?: string } = {},
): string {
  const opts = options
    .map(
      (o) =>
        `<label><input type="radio" name="${esc(name)}" value="${esc(o.value)}"${o.checked ? " checked" : ""}>` +
        `${esc(o.label)}</label>`,
    )
    .join("");
  return `<fieldset class="segf"><legend class="${legendClass}">${esc(legend)}</legend><div class="seg${segClass ? ` ${segClass}` : ""}">${opts}</div></fieldset>`;
}

/** Segmented links: the segmented look for a choice that opens another page (the persona
 *  switch), so it works without script, each choice is a crawlable link, and arrow keys
 *  never navigate. The current one carries aria-current="page". */
export function segLinks(
  id: string,
  label: string,
  links: { label: string; href: string; current?: boolean }[],
  o: { labelClass?: string; segClass?: string } = {},
): string {
  const items = links
    .map((l) => `<a href="${esc(l.href)}"${l.current ? ' aria-current="page"' : ""}>${esc(l.label)}</a>`)
    .join("");
  return `<nav class="segf" aria-labelledby="${esc(id)}"><p class="${o.labelClass ?? "t-kicker"}" id="${esc(id)}">${esc(label)}</p><div class="seg${o.segClass ? ` ${o.segClass}` : ""}">${items}</div></nav>`;
}

const THEME_KEY = "mugilu-theme";

/** The footer theme switch: Light, Dark, System (default). */
function themeSwitch(lang: Lang): string {
  return segmented(
    "theme",
    t("Theme", lang),
    [
      { value: "light", label: t("Light", lang) },
      { value: "dark", label: t("Dark", lang) },
      { value: "system", label: t("System", lang), checked: true },
    ],
    { legendClass: "flabel" },
  );
}

/** In <head>, before paint: apply a stored theme so a pinned page never flashes the other one. */
export const THEME_HEAD_JS = `(function(){try{var v=localStorage.getItem('${THEME_KEY}');if(v==='light'||v==='dark')document.documentElement.setAttribute('data-theme',v);}catch(e){}})();`;

/** After the footer: reflect the stored choice in the switch and store a new one. */
export const THEME_JS = `(function(){var r=document.documentElement,v='system';try{v=localStorage.getItem('${THEME_KEY}')||'system';}catch(e){}
document.querySelectorAll('input[name=theme]').forEach(function(i){i.checked=i.value===v;i.addEventListener('change',function(){if(!i.checked)return;if(i.value==='system')r.removeAttribute('data-theme');else r.setAttribute('data-theme',i.value);try{i.value==='system'?localStorage.removeItem('${THEME_KEY}'):localStorage.setItem('${THEME_KEY}',i.value);}catch(e){}});});})();`;

// ── Search (ARIA combobox) ───────────────────────────────────────────────────────────

export interface SearchOpts {
  id: string;
  /** The accessible name (also the visible label when showLabel). */
  label: string;
  placeholder?: string;
  showLabel?: boolean;
  /** A submit button's text; none when empty. */
  button?: string;
  /** Help under the box (markup, already escaped). */
  hint?: string;
  /** The form's action: the place lookup. */
  action: string;
  /** Fields the form sends along (e.g. kiosk=1 on the display setup). */
  hidden?: [name: string, value: string][];
  /** Show the submit button as this pictogram, `button` becoming its accessible name. */
  buttonIcon?: IconName;
}

/** Search with autocomplete as the ARIA combobox pattern: the input controls a listbox; arrow
 *  keys move aria-activedescendant; the status line is a polite live region. */
export function searchBox(o: SearchOpts): string {
  const id = esc(o.id);
  const label = esc(o.label);
  return (
    `<form class="search" role="search" aria-label="${label}" action="${esc(o.action)}" method="get">` +
    (o.showLabel ? `<label for="${id}">${label}</label>` : "") +
    (o.hidden ?? []).map(([n, v]) => `<input type="hidden" name="${esc(n)}" value="${esc(v)}">`).join("") +
    `<div class="sbox">${ico("search")}` +
    `<input type="search" name="q" id="${id}" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-list"` +
    `${o.showLabel ? "" : ` aria-label="${label}"`}${o.placeholder ? ` placeholder="${esc(o.placeholder)}"` : ""} autocomplete="off" required>` +
    (o.button
      ? o.buttonIcon
        ? `<button class="btn primary" type="submit" aria-label="${esc(o.button)}">${ico(o.buttonIcon)}</button>`
        : `<button class="btn primary" type="submit">${esc(o.button)}</button>`
      : "") +
    `</div><ul class="ac" role="listbox" id="${id}-list" aria-label="${label}" hidden></ul>` +
    `<p class="vh" aria-live="polite" id="${id}-status"></p>${o.hint ?? ""}</form>`
  );
}

// ── Icons: the signage pictograms, one set ───────────────────────────────────────────
// Stroked 24x24 paths (the stroke comes from standard.ts .ico); a few filled (.f).
const STROKE: Record<string, string> = {
  air: "M3 8c3-2 5 2 8 0s5-2 7 0M3 13c3-2 5 2 8 0s5-2 7 0M3 18c3-2 5 2 8 0s5-2 7 0",
  smoke: "M12 3c2 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-8z",
  heat: "M10 14V5a2 2 0 0 1 4 0v9M12 21a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  cold: "M12 2v20M4 7l16 10M4 17 20 7M9 3.5l3 2 3-2M9 20.5l3-2 3 2",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8",
  drop: "M12 2s7 8 7 13a7 7 0 0 1-14 0c0-5 7-13 7-13z",
  rain: "M7 14a4.5 4.5 0 0 1-.8-8.9A5.5 5.5 0 0 1 16.8 6 4 4 0 0 1 17 14M8 17l-1 3M12 17l-1 3M16 17l-1 3",
  wind: "M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8",
  dust: "M5 7h.01M10 5h.01M15 8h.01M19 5h.01M7 12h.01M12 11h.01M17 13h.01M5 17h.01M10 18h.01M15 17h.01M19 19h.01",
  fog: "M3 8h18M5 12h14M3 16h18M7 20h10",
  storm: "M7 15a4.5 4.5 0 0 1-.8-8.9A5.5 5.5 0 0 1 16.8 7 4 4 0 0 1 17 15M12.5 12l-2.5 4.5h4L11.5 21",
  flood:
    "M3 9c2-1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0M3 14c2-1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0M3 19c2-1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0",
  snow: "M2 20 9 8l3.5 5L15 9.5 22 20zM6 4l1 1M10 3v1.5M14 4l-1 1",
  cyclone:
    "M12 4a8 8 0 0 1 8 8M12 20a8 8 0 0 1-8-8M17 5.5A9 9 0 0 0 5 9M7 18.5A9 9 0 0 0 19 15M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  warn: "M12 3 22 20H2zM12 10v4M12 17v.5",
  search: "M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM16 16l5 5",
  screen: "M3 4h18v12H3zM8 20h8M12 16v4",
  bell: "M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21a2 2 0 0 0 4 0",
  station: "M12 21V11M8 21h8M7 7a7 7 0 0 1 10 0M4.5 4.5a10.5 10.5 0 0 1 15 0",
  offline: "M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01M3 3l18 18",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  back: "M10 6l-6 6 6 6M4 12h16",
  arrow: "M5 12h14M13 6l6 6-6 6",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  turn: "M9 7 4 12l5 5M4 12h10a5 5 0 0 1 5 5",
  filter: "M3 5h18l-7 8v6l-4 2v-8z",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.5M3 12h.5M3 18h.5",
  code: "m8 6-6 6 6 6M16 6l6 6-6 6",
  stack: "M12 3 2 8l10 5 10-5zM2 13l10 5 10-5M2 18l10 5 10-5",
  commons:
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.8 5.6 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.6-3.8-9S9.5 5.5 12 3z",
  question: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.6 2.6 0 0 1 5 1c0 1.7-2.5 2-2.5 3.5M12 17h.01",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01",
  person: "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4.4 3.6-8 8-8s8 3.6 8 8",
  ruler: "M3 21V10M9 21V4M15 21v-8M21 21V7",
  doc: "M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h8",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  plug: "M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0zM12 17v5",
  tool: "M14.7 6.3a4 4 0 0 0 5 5L22 13.5 13.5 22l-2.3-2.3a4 4 0 0 0-5-5L2 10.5 10.5 2z",
  ai: "M12 2v3M5 7h14v12H5zM9 12h.01M15 12h.01M9 16h6M2 12h3M19 12h3",
  embed: "M4 4h16v16H4zM9 9l-2.5 3L9 15M15 9l2.5 3L15 15",
};
const FILLED: Record<string, string> = {
  cloud: CLOUD,
  pin: "M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z",
  people:
    "M9 3.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM2 20c0-4 3-7 7-7s7 3 7 7zM17 5.4a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2zM15.5 13.2c3.6-.7 6.5 2 6.5 5.8h-4.5c0-2.3-.7-4.3-2-5.8z",
};
export type IconName = keyof typeof STROKE | keyof typeof FILLED;

/** A pictogram (decorative: the text beside it carries the meaning). */
export function ico(name: IconName): string {
  if (name in FILLED)
    return `<svg class="ico f" aria-hidden="true" viewBox="0 0 24 24"><path d="${FILLED[name]}"/></svg>`;
  return `<svg class="ico" aria-hidden="true" viewBox="0 0 24 24"><path d="${STROKE[name] ?? STROKE.warn}"/></svg>`;
}

// ── Layout: bands and lanes ─────────────────────────────────────────────────────────
// A page is a stack of full-width bands; things sit side by side only inside one lane,
// which shares its row height. The one exception is a sticky aside (a live preview, a map).
export type LaneKind = "l2" | "l3" | "l4" | "l57" | "l75" | "la";

/** A band: full width, optionally named for assistive tech. */
export function band(body: string, label?: string): string {
  return `<section class="band"${label ? ` aria-label="${esc(label)}"` : ""}>${body}</section>`;
}
/** A lane: the items side by side on wide screens, stacked in order on phones. */
export function lane(kind: LaneKind, items: string[]): string {
  return `<div class="lane ${kind}">${items.join("")}</div>`;
}
/** A lane of whatever items are present (empty ones dropped): one item fills the row. */
export function autoLane(items: string[]): string {
  const xs = items.filter(Boolean);
  return xs.length > 1 ? lane(xs.length === 2 ? "l2" : "l3", xs) : (xs[0] ?? "");
}
/** The page's content column. */
export const wrap = (body: string) => `<div class="wrap">${body}</div>`;
/** Children spaced vertically. */
export const stack = (body: string, tag = "div") => `<${tag} class="stack">${body}</${tag}>`;

// ── Panel, Notice, Stamp ──────────────────────────────────────────────────────────────
export interface PanelOpts {
  /** The black title bar (a heading). */
  title?: string;
  icon?: IconName;
  /** A count at the bar's right end. */
  count?: number | string;
  /** The heading's id (aria-labelledby). */
  id?: string;
  strong?: boolean;
  /** Body without the default padding (a table that runs to the edges). */
  flush?: boolean;
  tag?: "section" | "div" | "nav";
  /** The panel's accessible name when it has no title bar. */
  label?: string;
  /** Markup at the bar's right end, beside the heading but not in its name (the map's stamps). */
  end?: string;
}
export function panel(body: string, o: PanelOpts = {}): string {
  const tag = o.tag ?? "section";
  const lab = o.title && o.id ? ` aria-labelledby="${esc(o.id)}"` : o.label ? ` aria-label="${esc(o.label)}"` : "";
  const bar = o.end
    ? `<div class="bar"><h2${o.id ? ` id="${esc(o.id)}"` : ""}>${o.icon ? ico(o.icon) : ""}${esc(o.title ?? "")}</h2>${o.end}</div>`
    : o.title
      ? `<h2 class="bar"${o.id ? ` id="${esc(o.id)}"` : ""}>${o.icon ? ico(o.icon) : ""}<span>${esc(o.title)}</span>` +
        `${o.count != null ? `<span class="n">${esc(String(o.count))}</span>` : ""}</h2>`
      : "";
  return `<${tag} class="panel${o.strong ? " strong" : ""}"${lab}>${bar}${o.flush ? body : `<div class="in">${body}</div>`}</${tag}>`;
}

export type NoticeKind = "info" | "quiet" | "stale" | "err" | "empty";
/** Notice: info, stale, offline, error, empty. `html` is already escaped markup. */
export function notice(kind: NoticeKind, html: string, icon?: IconName, id?: string, hidden = false): string {
  const cls = kind === "info" ? "notice" : `notice ${kind}`;
  return `<p class="${cls}"${id ? ` id="${esc(id)}"` : ""}${hidden ? " hidden" : ""}${kind === "err" ? ' role="alert"' : ""}>${icon ? `${ico(icon)}<span>${html}</span>` : html}</p>`;
}

export interface StampOpts {
  plain?: boolean;
  off?: boolean;
  stale?: boolean;
  /** The map layers (their letters) this stamp dates; the others dim it (MAP_JS). */
  layers?: string;
}
/** Stamp: when the data is from, one per data layer, never hidden in a note. `value` is markup. */
export function stamp(label: string, value: string, o: StampOpts = {}): string {
  const mods = [o.plain && "plain", o.off && "off", o.stale && "stale"].filter(Boolean).join(" ");
  const layers = o.layers ? ` data-layers="${esc(o.layers)}"` : "";
  return `<span class="stamp${mods ? ` ${mods}` : ""}"${layers}><span class="k">${esc(label)}</span><span class="v">${value}</span></span>`;
}
export const stamps = (items: string[]) => `<div class="stamps">${items.join("")}</div>`;

// ── Plate: the level hero ────────────────────────────────────────────────────────────
export interface PlateOpts {
  /** The fill: a risk level, a CPCB band ("b-poor") or "nolevel" (stale, unknown). */
  fill: RiskBand | `b-${string}` | "nolevel";
  /** The shape beside the word; none for nolevel. */
  shape?: ShapeName;
  kicker?: string;
  /** The level word as shown (e.g. "High air."), markup. */
  word: string;
  /** The advice line, markup. */
  say?: string;
  /** Lines after the advice (e.g. the second-language line), markup. */
  extra?: string;
  /** The accessible name of the region. */
  label: string;
  /** The one-row form (station). */
  inline?: boolean;
}
export function plate(o: PlateOpts): string {
  const sh = o.shape ? shape(o.shape) : "";
  if (o.inline)
    return `<section class="plate inline ${o.fill}" aria-label="${esc(o.label)}">${sh}<div>${o.word}${o.say ? `<p class="t-lead">${o.say}</p>` : ""}${o.extra ?? ""}</div></section>`;
  return (
    `<section class="plate ${o.fill} stack" aria-label="${esc(o.label)}">` +
    (o.kicker ? `<p class="t-kicker row-c">${ico("eye")}<span>${esc(o.kicker)}</span></p>` : "") +
    `<div class="row">${sh}<p class="t-plate">${o.word}</p></div>` +
    (o.say ? `<p class="t-lead say">${o.say}</p>` : "") +
    (o.extra ?? "") +
    `</section>`
  );
}

// ── BarRow, DataTable ─────────────────────────────────────────────────────────────────
export interface BarRowItem {
  label: string;
  /** The shown value, markup. */
  value: string;
  /** Width of the fill, 0-100 (percent of the scale). */
  pct: number;
  /** The band class for the fill (e.g. "poor"), none for a quiet bar. */
  band?: string;
}
/** BarRow list: each pollutant on one 0-500 scale; the dashed line is the CPCB limit at `limPct`.
 *  With `lang`, the list carries its own key line saying so. */
export function barRows(items: BarRowItem[], limPct: number, lang?: Lang): string {
  const rows = items
    .map(
      (b) =>
        `<div class="brow${b.band ? ` b-${b.band}` : ""}"><span>${esc(b.label)}</span><span class="track" aria-hidden="true">` +
        `<i class="f" style="width:${Math.max(0, Math.min(100, b.pct)).toFixed(1)}%"></i><i class="lim"></i></span><b>${b.value}</b></div>`,
    )
    .join("");
  const key = lang ? `<p class="t-legal">${esc(t("The dashed line is the CPCB limit.", lang))}</p>` : "";
  return `<div class="bars" style="--lim:${limPct.toFixed(1)}%">${rows}</div>${key}`;
}

export interface Column {
  /** Text, or trusted markup (a level shape beside its word). */
  label: string | Html;
  /** Right-aligned (numbers). */
  num?: boolean;
  /** Classes for the header cell (a level fill). */
  cls?: string;
}
/** DataTable: a real table with scoped headers, scrolling inside its own region when wide. */
/** `stackOnPhone`: a name, a value and a detail (three columns). On phones each row becomes
 *  the name with the detail under it and the value on the right, instead of a table that
 *  scrolls sideways. */
export function dataTable(
  cols: Column[],
  rows: string[][],
  caption?: string,
  o: { stackOnPhone?: boolean } = {},
): string {
  const th = cols
    .map((c) => {
      const cls = [c.num && "r", c.cls].filter(Boolean).join(" ");
      return `<th scope="col"${cls ? ` class="${cls}"` : ""}>${textOrHtml(c.label)}</th>`;
    })
    .join("");
  const body = rows
    .map(
      (r) =>
        `<tr>${r.map((cell, i) => (i === 0 ? `<th scope="row">${cell}</th>` : `<td${cols[i]?.num ? ' class="r"' : ""}>${cell}</td>`)).join("")}</tr>`,
    )
    .join("");
  return `<div class="tscroll" role="region" tabindex="0"${caption ? ` aria-label="${esc(caption)}"` : ""}><table class="tbl${o.stackOnPhone ? " rows" : ""}">${caption ? `<caption class="vh">${esc(caption)}</caption>` : ""}<thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div>`;
}

// ── CardGrid, Pairs, FAQ, pull quote, Sheet ──────────────────────────────────────────
/** CardGrid: 2, 3 or 4 up on wide screens. Items are markup. */
export function cards(items: string[], o: { cols?: 1 | 2 | 3 | 4; quiet?: boolean } = {}): string {
  const cls = o.cols ? ` c${o.cols}` : "";
  return `<div class="cards${cls}">${items.map((x) => `<div class="card${o.quiet ? " quiet" : ""}">${x}</div>`).join("")}</div>`;
}
/** A card's title line with its pictogram, then its body (markup). */
export const cardBody = (title: string, body: string, icon?: IconName) =>
  `<p class="t-value">${icon ? ico(icon) : ""}${esc(title)}</p>${body}`;
/** A term / description list (text terms, markup descriptions) in one of the standard's looks. */
function dl(cls: "pairs" | "faq", rows: [term: string, desc: string][]): string {
  return `<dl class="${cls}">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join("")}</dl>`;
}
/** Pairs: key / value rows. Values are markup. */
export const pairs = (rows: [key: string, value: string][]) => dl("pairs", rows);
/** FAQ: question / answer grid. Answers are markup. */
export const faq = (rows: [q: string, a: string][]) => dl("faq", rows);
export const pull = (html: string) => `<p class="pull">${html}</p>`;

export interface SheetSection {
  id: string;
  title: string;
  icon: IconName;
  /** The section's body: whole sentences, in boxes (markup). */
  body: string;
}
export interface SheetOpts {
  kicker: string;
  /** Text, or trusted markup (a deliberate line break). */
  title: string | Html;
  /** Markup. */
  lead: string;
  lead2?: string;
  sections: SheetSection[];
  /** The back link under the sheet. */
  back?: { href: string; label: string };
}
/** Sheet: a text page. Each section is a row with a numbered rail (wide) or stacked (phone);
 *  an "On this page" box when there are three sections or more. */
export function sheet(o: SheetOpts, lang: Lang): string {
  const toc =
    o.sections.length >= 3
      ? `<nav class="panel toc" aria-label="${esc(t("On this page", lang))}"><p class="bar">${esc(t("On this page", lang))}</p>` +
        o.sections
          .map((s, i) => `<a href="#${esc(s.id)}"><span class="cnum">${i + 1}</span>${esc(s.title)}</a>`)
          .join("") +
        `</nav>`
      : "";
  const secs = o.sections
    .map(
      (s, i) =>
        `<section class="tsec" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-h"><div class="rail"><span class="sn">§${i + 1}</span>${ico(s.icon)}` +
        `<h2 class="t-h2" id="${esc(s.id)}-h">${esc(s.title)}</h2></div><div class="sbody">${s.body}</div></section>`,
    )
    .join("");
  return (
    `<div class="wrap"><article class="sheet"><div class="hero"><div><p class="t-kicker">${esc(o.kicker)}</p>` +
    `<h1 class="t-title">${textOrHtml(o.title)}</h1><p class="t-lead">${o.lead}</p>${o.lead2 ? `<p class="t-meta lead2">${o.lead2}</p>` : ""}</div>${toc}</div>` +
    secs +
    (o.back ? backLink(o.back.href, o.back.label) : "") +
    `</article></div>`
  );
}

// ── Buttons and links ─────────────────────────────────────────────────────────────────
/** A link styled as a button (primary: filled). */
export function linkButton(href: string, label: string, primary = false, icon?: IconName, id?: string): string {
  return `<a class="btn${primary ? " primary" : ""}"${id ? ` id="${esc(id)}"` : ""} href="${esc(href)}">${icon ? ico(icon) : ""}${esc(label)}</a>`;
}
/** A button (primary: filled). */
export function button(
  label: string,
  o: { primary?: boolean; icon?: IconName; id?: string; hidden?: boolean } = {},
): string {
  return `<button type="button" class="btn${o.primary ? " primary" : ""}"${o.id ? ` id="${esc(o.id)}"` : ""}${o.hidden ? " hidden" : ""}>${o.icon ? ico(o.icon) : ""}${esc(label)}</button>`;
}
/** The "← back" link on its own line (a 44px target). `label` includes the arrow. */
export const backLink = (href: string, label: string) => `<p class="back"><a href="${esc(href)}">${esc(label)}</a></p>`;
/** A row of small links (exports), each a 44px target. Items: [href, label]. */
export function linkRow(items: [string, string][], cls = "t-meta"): string {
  return `<p class="links ${cls}">${items.map(([h, l]) => `<a href="${esc(h)}">${esc(l)}</a>`).join(" · ")}</p>`;
}

// ── WarningPlate, WarningRow, FilterBar, Fold ────────────────────────────────────────
export interface WarningPlateOpts {
  /** The bar's items (markup), e.g. a link to all warnings, the issuer, the time, CAP. */
  bar: string[];
  /** IMD's category and the storm's name, e.g. "Severe Cyclonic Storm Akvan". */
  title?: string;
  icon?: IconName;
  /** Markup. */
  body: string;
  label: string;
  /** The page's language: a title quoted in another language is marked with its own. */
  lang: Lang;
}
/** WarningPlate: an official warning. Warnings carry no severity, so no level colour. */
export function warningPlate(o: WarningPlateOpts): string {
  return (
    `<section class="wplate" aria-label="${esc(o.label)}"><div class="bar">${ico("warn")}${o.bar.join("")}</div>` +
    `<div class="in stack">${o.title ? `<h2 class="t-h2 row-c">${o.icon ? ico(o.icon) : ""}${quoted(o.title, o.lang)}</h2>` : ""}${o.body}</div></section>`
  );
}

export interface WarningRowOpts {
  icon: IconName;
  /** The hazard type label. */
  kind: string;
  /** The headline as issued (plain text; escaped here). */
  head: string;
  /** The page's language: a headline issued in another language is marked with its own. */
  lang: Lang;
  /** Issuer, area, time (markup). */
  meta: string;
  /** data-* for filtering. */
  type: string;
  issuer: string;
}
export function warningRow(o: WarningRowOpts): string {
  return (
    `<li class="wrow" data-type="${esc(o.type)}" data-issuer="${esc(o.issuer)}">${ico(o.icon)}` +
    `<p class="kind">${esc(o.kind)}</p><p class="head"${langAttr(o.head, o.lang)}>${esc(o.head)}</p>` +
    `<p class="meta">${o.meta}</p></li>`
  );
}

export interface CheckItem {
  value: string;
  label: string;
  count: number;
  checked?: boolean;
}
/** A filter group: checkboxes with counts in a fieldset (a FilterBar holds several). */
export function checkGroup(name: string, legend: string, items: CheckItem[]): string {
  return (
    `<fieldset class="checks"><legend>${esc(legend)}</legend>` +
    items
      .map(
        (i) =>
          `<label class="check"><input type="checkbox" name="${esc(name)}" value="${esc(i.value)}"${i.checked === false ? "" : " checked"}>` +
          `<span>${esc(i.label)}</span><span class="c">${i.count}</span></label>`,
      )
      .join("") +
    `</fieldset>`
  );
}
/** FilterBar: the filter groups across the top of a list (a Fold on phones). */
export const filterBar = (groups: string[], label: string) =>
  `<div class="fbar" role="group" aria-label="${esc(label)}">${groups.join("")}</div>`;

/** Fold: a disclosure (mobile filters, a state's places). */
export function fold(summary: string, body: string, o: { count?: number; open?: boolean; id?: string } = {}): string {
  return (
    `<details class="fold"${o.open ? " open" : ""}${o.id ? ` id="${esc(o.id)}"` : ""}><summary>${esc(summary)}` +
    `${o.count != null ? `<span class="n">${o.count}</span>` : ""}</summary><div class="in">${body}</div></details>`
  );
}

// ── PlaceTile ────────────────────────────────────────────────────────────────────────
/** A place as a tile; a warned place is marked with the warning symbol (never a level colour). */
export function placeTile(href: string, name: string, warned = false, lang: Lang = "en"): string {
  return `<a class="ptile${warned ? " warn" : ""}" href="${esc(href)}">${warned ? `${ico("warn")}<span class="vh">${esc(t("Under an official warning now", lang))}: </span>` : ""}${esc(name)}</a>`;
}
export const placeTiles = (tiles: string[]) => `<div class="ptiles">${tiles.join("")}</div>`;

// ── QR ───────────────────────────────────────────────────────────────────────────────
/** The QR code for a URL: always black on white (tokens --qr-*), so every phone can read it. */
export function qrBlock(url: string, caption: string): string {
  const svg = qrSvg(url, { dark: "currentColor", light: "none" });
  return `<div class="qr">${svg.replace(/<svg\b/, '<svg class="qrimg" aria-hidden="true"')}<span>${esc(caption)}</span></div>`;
}

// ── AlertsBox, YourPlaces ─────────────────────────────────────────────────────────────
/** AlertsBox: opt-in push alerts for this place, every state in the markup (ALERTS_JS from
 *  alerts-ui.ts shows one; it reads the place from h1[data-ll]). The ids are its contract. */
export function alertsBox(publicKey: string, lang: Lang): string {
  const T = (s: string) => esc(t(s, lang));
  return (
    `<section class="panel" id="alerts" hidden data-key="${esc(publicKey)}" data-lang="${lang}" aria-label="${T("Send me official warnings for this place")}"><div class="in stack">` +
    `<button type="button" class="btn primary" id="alerts-on">${ico("bell")}${T("Send me official warnings for this place")}</button>` +
    `<div class="notice stack" id="alerts-state" hidden><p>${T("Alerts are on for this place.")} <button type="button" class="btn" id="alerts-off">${T("Turn off")}</button></p>` +
    `<p class="t-meta" id="alerts-note-on" hidden>${T("When you turn off alerts, mugilu deletes this place and the push address of your browser.")}</p></div>` +
    `<div class="stack" role="status">` +
    `<p class="notice err" id="alerts-denied" hidden>${T("Your browser blocks notifications from mugilu. Allow them in the site settings of your browser. Then try again.")}</p>` +
    `<p class="notice err" id="alerts-full" hidden>${T("Alerts are on for 12 places. That is the limit. Turn off alerts for one place first.")}</p>` +
    `<p class="notice err" id="alerts-failed" hidden>${T("Alerts could not be turned on. Try again.")}</p>` +
    `<p class="notice quiet" id="alerts-ios" hidden>${T("On iPhone and iPad, first add mugilu to your Home Screen (Share, then Add to Home Screen). Open mugilu from the Home Screen. Then turn on alerts here.")}</p></div>` +
    `<p class="t-meta" id="alerts-note-off" hidden>${T("Alerts are opt-in. When you turn on alerts, mugilu keeps this place (to approximately 1 km) and the push address of your browser. mugilu uses them only to send you official NDMA/IMD warnings for this place.")}</p>` +
    `</div></section>`
  );
}

/** YourPlaces: recents and saved places from this browser (first-party, no login), filled by
 *  the page script into a .yp list; hidden until there is one. */
export function yourPlacesSlot(lang: Lang): string {
  return `<section class="panel" id="yp" hidden aria-labelledby="yp-h"><h2 class="bar" id="yp-h">${ico("pin")}<span>${esc(t("Your places", lang))}</span></h2><ul class="yp in"></ul></section>`;
}

// ── EmbedCard ─────────────────────────────────────────────────────────────────────────
export interface EmbedCardOpts {
  href: string;
  place: string;
  /** The Ambient level and its words. */
  level: RiskBand;
  headline: string;
  say: string;
  /** Up to five readings: [big, small]. Hidden below 400px wide. */
  reads: [string, string][];
  /** "as of …" markup. */
  asOf: string;
}
/** EmbedCard: the whole card links to the place. The full disclaimer shows at 400px and wider,
 *  the short live line below (a container query); both are in the markup (rule 6). */
export function embedCard(o: EmbedCardOpts, lang: Lang): string {
  return (
    `<a class="ecard ${o.level}" href="${esc(o.href)}" target="_blank" rel="noopener">` +
    `<div class="etop"><p class="eplace">${esc(o.place)}</p><span class="ebrand">${wordmark()}</span></div>` +
    `<div class="eamb">${shape(LEVEL_SHAPE[o.level])}${esc(o.headline)}</div><div class="esay">${esc(o.say)}</div>` +
    `<div class="ereads">${o.reads.map(([b, s]) => `<div class="eread"><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join("")}</div>` +
    `<div class="efoot"><span>${o.asOf}</span><span>mugilu.live →</span></div>` +
    `<div class="t-legal disc-long">${esc(t(DISCLAIMER_FULL, lang))}</div><div class="t-legal disc-short">${esc(t(DISCLAIMER_SHORT, lang))}</div></a>`
  );
}

// Full-width cards (text pages).
/** WarnBox: a bordered caution (Terms' "No warranty"): a bold first line with the warning
 *  symbol, then paragraphs. All markup. */
export function warnBox(head: string, paras: string[]): string {
  return `<div class="warnbox"><p class="head">${ico("warn")}${head}</p>${paras.map((p) => `<p>${p}</p>`).join("")}</div>`;
}

// The Search combobox's behaviour.
/** The "use my location" button `id` (rendered hidden): shown only where the browser can
 *  locate; a fix calls `onFix(lat, lon)` (the name of a page function, given 4-decimal
 *  strings), a refusal says so, and the label (icon included) comes back after either. */
export function locateJs(id: string, lang: Lang, onFix: string): string {
  return `(function(){var b=document.getElementById('${id}');if(!b||!navigator.geolocation)return;var label=b.innerHTML;b.hidden=false;
b.onclick=function(){b.textContent=${JSON.stringify(t("Finding your location…", lang))};navigator.geolocation.getCurrentPosition(function(p){b.innerHTML=label;${onFix}(p.coords.latitude.toFixed(4),p.coords.longitude.toFixed(4));},function(){b.textContent=${JSON.stringify(t("Your location is not available.", lang))};});};
addEventListener('pageshow',function(){b.innerHTML=label;});})();`;
}

/** The ARIA combobox for a searchBox: suggestions from /suggest as options, arrow keys move
 *  aria-activedescendant, Enter or a click picks, Escape closes, the status line says how many
 *  places match. Picking opens that place's page (plus `suffix`, a JS string expression), or
 *  calls `onPick` (a JS function expression taking {label, sublabel, lat, lon}). */
export function comboboxJs(inputId: string, lang: Lang, o: { suffix?: string; onPick?: string } = {}): string {
  const LP = langPrefixJs(lang);
  const N = JSON.stringify(t("{n} places", lang));
  const NONE = JSON.stringify(t("No place in India matches that. Try another spelling, or a lat,lon.", lang));
  return `(function(){var ID=${JSON.stringify(inputId)},q=document.getElementById(ID),ac=document.getElementById(ID+'-list'),st=document.getElementById(ID+'-status');if(!q||!ac)return;
var items=[],ix=-1,tm,seq=0,SUF=${o.suffix ?? "''"};
${CLIENT_ESC}
var pick=${o.onPick ?? `function(x){location.href=${LP}+'/c/'+x.lat+','+x.lon+SUF;}`};
function show(b){q.setAttribute('aria-expanded',b?'true':'false');ac.hidden=!b;}
function paint(){for(var i=0;i<ac.children.length;i++)ac.children[i].setAttribute('aria-selected',i===ix?'true':'false');if(ix>=0)q.setAttribute('aria-activedescendant',ID+'-o'+ix);else q.removeAttribute('aria-activedescendant');}
function hide(){ac.innerHTML='';items=[];ix=-1;show(false);paint();}
function go(i){var x=items[i];if(x){hide();pick(x);}}
q.addEventListener('input',function(){var v=q.value.trim();clearTimeout(tm);if(v.length<2){hide();if(st)st.textContent='';return;}var s=++seq;tm=setTimeout(function(){fetch('/suggest?q='+encodeURIComponent(v)).then(function(r){return r.json();}).then(function(d){if(s!==seq)return;items=d.suggestions||[];ix=-1;ac.innerHTML=items.map(function(x,i){return '<li role="option" id="'+ID+'-o'+i+'" aria-selected="false" data-i="'+i+'">'+esc(x.label)+(x.sublabel?'<span>'+esc(x.sublabel)+'</span>':'')+'</li>';}).join('');show(items.length>0);if(st)st.textContent=items.length?${N}.replace('{n}',items.length):${NONE};}).catch(function(){if(s===seq)hide();});},150);});
q.addEventListener('keydown',function(e){if(e.key==='Escape'){hide();return;}if(!items.length)return;if(e.key==='ArrowDown'){ix=(ix+1)%items.length;e.preventDefault();paint();}else if(e.key==='ArrowUp'){ix=(ix-1+items.length)%items.length;e.preventDefault();paint();}else if(e.key==='Enter'&&ix>=0){e.preventDefault();go(ix);}});
ac.addEventListener('mousedown',function(e){var li=e.target.closest('li');if(li){e.preventDefault();go(+li.getAttribute('data-i'));}});
q.addEventListener('blur',function(){setTimeout(hide,150);});})();`;
}

// ── Page head, filters, steps ───────────────────────────────────────────────────────

/** A page's head: an optional kicker (pictogram and words), the h1, then `extra` markup
 *  (a lead, a stamp). `title` and the kicker's text are plain. */
export function pageHead(title: string, o: { kicker?: { icon: IconName; text: string }; extra?: string } = {}): string {
  const k = o.kicker ? `<p class="t-kicker row-c">${ico(o.kicker.icon)}<span>${esc(o.kicker.text)}</span></p>` : "";
  return `<div class="ph">${k}<h1 class="t-title">${esc(title)}</h1>${o.extra ?? ""}</div>`;
}

/** A filter box over a list on the page (not the place search, which is searchBox). */
export function filterInput(id: string, label: string): string {
  return `<div class="search"><label for="${esc(id)}">${esc(label)}</label><div class="sbox">${ico("search")}<input type="search" id="${esc(id)}" autocomplete="off"></div></div>`;
}

/** The client side of a list filter: mgMatch(el, s) (its text has s), mgFilter(items, keep)
 *  (hide what keep() rejects) and mgEmpty(groups, itemSel) (hide a group left empty). */
export const LIST_FILTER_JS = `function mgMatch(el,s){if(!s)return true;var k=el.mgKey;if(k===undefined)k=el.mgKey=el.textContent.toLowerCase();return k.indexOf(s)>-1}
function mgDebounce(fn,ms){var t;return function(){var a=this,b=arguments;clearTimeout(t);t=setTimeout(function(){fn.apply(a,b)},ms)}}
function mgFilter(items,keep){[].forEach.call(items,function(el){el.hidden=!keep(el)})}
function mgEmpty(groups,item){[].forEach.call(groups,function(g){g.hidden=!g.querySelector(item+':not([hidden])')})}`;

/** A numbered setup step (the display builder). `title` is markup. */
export function step(n: number, title: string, body: string, o: { id?: string; grow?: boolean } = {}): string {
  return (
    `<section class="panel${o.grow ? " grow" : ""}"><div class="in step"${o.id ? ` id="${esc(o.id)}"` : ""}>` +
    `<h2 class="t-h2"><span class="cnum solid">${n}</span>${title}</h2>${body}</div></section>`
  );
}
