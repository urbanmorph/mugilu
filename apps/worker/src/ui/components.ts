import { esc } from "../html";
import { LANGS, LANG_NAME, lp, t, type Lang } from "../i18n";
import type { RiskBand } from "../score";
import { installButton } from "../install";

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
export function langSwitch(path: string, lang: Lang, where: "header" | "footer"): string {
  const items = LANGS.map((L) =>
    L === lang
      ? `<b>${LANG_NAME[L]}</b>`
      : `<a href="${esc(lp(path, L))}" lang="${L}" hreflang="${L}">${LANG_NAME[L]}</a>`,
  ).join(" · ");
  const label = esc(t("Language", lang));
  return where === "header"
    ? `<nav class="langs" aria-label="${label}">${items}</nav>`
    : `<div class="flangs" role="group" aria-label="${label}">${items}</div>`;
}

/** SiteHeader. DOM order is the reading order at every width: skip link, brand, Install app,
 *  nav, language. `path` is the language-agnostic path of this page. */
export function siteHeader(path: string, lang: Lang): string {
  const nav = NAV.map(([p, en]) => `<a href="${lp(p, lang)}"${current(p === path)}>${esc(t(en, lang))}</a>`).join("");
  return (
    `<header class="sh"><a class="skip" href="#main">${esc(t("Skip to content", lang))}</a><div class="wrap">` +
    `<a class="brand" href="${lp("/", lang)}"><svg class="ico f" aria-hidden="true" viewBox="0 0 24 24"><path d="${CLOUD}"/></svg>mugilu</a>` +
    installButton(lang, { button: "btn", dialog: "isheet" }) +
    `<nav class="nav" aria-label="${esc(t("Main", lang))}">${nav}</nav>${langSwitch(path, lang, "header")}</div></header>`
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
  ["/about#build", "build on it"],
  ["/mcp", "MCP server"],
  ["/terms", "terms"],
  ["https://github.com/urbanmorph/mugilu", "code", true],
  ["https://github.com/urbanmorph/mugilu/blob/main/PDGI.md", "a digital commons", true],
];

/** SiteFooter: site links, the language switch, the theme switch, the disclaimer. */
export function siteFooter(path: string, lang: Lang, extra = ""): string {
  const links = FOOT_LINKS.map(
    ([h, en, ext]) => `<a href="${ext ? h : lp(h, lang)}"${current(!ext && h === path)}>${esc(t(en, lang))}</a>`,
  ).join(" · ");
  return (
    `<footer class="sf"><div class="wrap"><nav class="flinks" aria-label="${esc(t("Site", lang))}">${links}</nav>` +
    `<div class="frow">${langSwitch(path, lang, "footer")}${themeSwitch(lang)}</div>${extra}` +
    `<p class="disc">${esc(t(DISCLAIMER_FULL, lang))}</p></div></footer>`
  );
}

// ── Segmented (one choice of several, native radios) and the theme switch ───────────
export interface SegOption {
  value: string;
  label: string;
  checked?: boolean;
  /** When set, choosing this option opens this URL (the persona switch). */
  href?: string;
}

/** Segmented: native radios in a fieldset, so keyboard, screen readers and forced colours
 *  work without script. Options with an href navigate on change (SEGMENTED_JS). */
export function segmented(name: string, legend: string, options: SegOption[], legendClass = "t-kicker"): string {
  const opts = options
    .map(
      (o) =>
        `<label><input type="radio" name="${esc(name)}" value="${esc(o.value)}"${o.checked ? " checked" : ""}` +
        `${o.href ? ` data-href="${esc(o.href)}"` : ""}>${esc(o.label)}</label>`,
    )
    .join("");
  return `<fieldset class="segf"><legend class="${legendClass}">${esc(legend)}</legend><div class="seg">${opts}</div></fieldset>`;
}

/** Radios that carry an href open it when chosen. */
export const SEGMENTED_JS = `document.addEventListener('change',function(e){var i=e.target;if(i&&i.matches&&i.matches('.seg input[data-href]')&&i.checked)location.href=i.getAttribute('data-href');});`;

const THEME_KEY = "mugilu-theme";

/** The footer theme switch: Light, Dark, System (default). */
export function themeSwitch(lang: Lang): string {
  return segmented(
    "theme",
    t("Theme", lang),
    [
      { value: "light", label: t("Light", lang) },
      { value: "dark", label: t("Dark", lang) },
      { value: "system", label: t("System", lang), checked: true },
    ],
    "flabel",
  );
}

/** In <head>, before paint: apply a stored theme so a pinned page never flashes the other one. */
export const THEME_HEAD_JS = `(function(){try{var v=localStorage.getItem('${THEME_KEY}');if(v==='light'||v==='dark')document.documentElement.setAttribute('data-theme',v);}catch(e){}})();`;

/** After the footer: reflect the stored choice in the switch and store a new one. */
export const THEME_JS = `(function(){var r=document.documentElement,v='system';try{v=localStorage.getItem('${THEME_KEY}')||'system';}catch(e){}
document.querySelectorAll('input[name=theme]').forEach(function(i){i.checked=i.value===v;i.addEventListener('change',function(){if(!i.checked)return;if(i.value==='system')r.removeAttribute('data-theme');else r.setAttribute('data-theme',i.value);try{i.value==='system'?localStorage.removeItem('${THEME_KEY}'):localStorage.setItem('${THEME_KEY}',i.value);}catch(e){}});});})();`;

// ── Search (ARIA combobox) ───────────────────────────────────────────────────────────
const SEARCH_ICON = "M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM16 16l5 5";

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
}

/** Search with autocomplete as the ARIA combobox pattern: the input controls a listbox; arrow
 *  keys move aria-activedescendant; the status line is a polite live region. */
export function searchBox(o: SearchOpts): string {
  const id = esc(o.id);
  const label = esc(o.label);
  return (
    `<form class="search" role="search" aria-label="${label}" action="${esc(o.action)}" method="get">` +
    (o.showLabel ? `<label for="${id}">${label}</label>` : "") +
    `<div class="sbox"><svg class="ico" aria-hidden="true" viewBox="0 0 24 24"><path d="${SEARCH_ICON}"/></svg>` +
    `<input type="search" name="q" id="${id}" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-list"` +
    `${o.showLabel ? "" : ` aria-label="${label}"`}${o.placeholder ? ` placeholder="${esc(o.placeholder)}"` : ""} autocomplete="off" required>` +
    (o.button ? `<button class="btn primary" type="submit">${esc(o.button)}</button>` : "") +
    `</div><ul class="ac" role="listbox" id="${id}-list" aria-label="${label}" hidden></ul>` +
    `<p class="vh" aria-live="polite" id="${id}-status"></p>${o.hint ?? ""}</form>`
  );
}
