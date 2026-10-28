import type { Conditions, Warning, NormalizedStation } from "./types";
import type { NationalHighlights } from "./highlights";
import type { WarningsSnapshot } from "./sachet";
import { AQI_BAND_LABEL } from "./aqi";
import { compass, drops, gauge, GLYPH_CSS, lifeBlocks, pollutantBars, uvSteps, worstPollutant } from "./glyphs";
import { briefs, forPersona, isDriver, km, orderByRisk, placeLabel } from "./readings";
import { SOURCES } from "./sources";
import { esc } from "./html";
import {
  airLevelOf,
  ambientRisk,
  ambientSummary,
  coldLevelOf,
  dustLevelOf,
  fogLevelOf,
  heatLevelOf,
  smokeLevel,
  windLevelOf,
  PERSONAS,
  PERSONA_LABEL,
  RISK_BANDS,
  headline,
  SENSITIVE,
  THRESHOLD_ROWS,
  THRESHOLDS,
} from "./score";
import type { AmbientRisk, Persona, RiskBand } from "./score";
import { RISK_COLOR, BAND_COLOR, levelColor, tintOf } from "./palette";
import { slugForName, siblingPlaces, slugPlacesByState } from "./slugs";
import type { Lang } from "./i18n";
import { LANGS, LANG_NAME, langCss, langUrl, lp, t } from "./i18n";
import { INSTALL_CSS, INSTALL_JS, installButton, installHead } from "./install";
import { OFFLINE_NOTE_ID, SW_REGISTER } from "./sw";
import { FRESHEN } from "./freshen";
import { MAP_CSS, MAP_JS, renderIndiaMap, type IndiaMap } from "./indiamap";
import { ALERTS_CSS, ALERTS_JS, renderAlertsBox } from "./alerts-ui";
import { heatVsNormalLine, heatVsNormalShown, NORMALS_LABEL } from "./heatnormals";

// The worker-rendered HTML pages. Layperson-first, mobile-first, self-contained
// (inline CSS, no framework). All pages share chrome via shell().
//
// ── Design language (one set, applied to EVERY page) ────────────────────────
// Editorial serif display (--serif) for headlines/leads; system sans (--sans)
// for data and labels; mono (--mono) for coordinate/format stamps; hairline
// rules (--hair); a condition- or sky-tinted atmospheric backdrop; and the
// inline Lucide-style line icons in ICON/icon(), never emoji. Tokens live in
// BASE_CSS :root and reach home, /c, about, terms and 404 alike.

/** Whether an upstream URL is fit for an href: http(s) only (no javascript: etc.). */
function isHttpUrl(u: string): boolean {
  return /^https?:\/\//i.test(u);
}

function round(n: number | undefined): string {
  return n == null ? "n/a" : String(Math.round(n));
}

function uvWord(index: number | undefined): string {
  if (index == null) return "n/a";
  if (index < 1) return "none";
  if (index < 3) return "low";
  if (index < 6) return "moderate";
  if (index < 8) return "high";
  if (index < 11) return "very high";
  return "extreme";
}

// The words below name the same levels the Ambient read uses (score.ts THRESHOLDS),
// so a tile can never call dust "high" while the read says it is fine.

/** Dust's risk band (low / moderate / high / severe), the word on its tile and hero. */
const dustBand = (ug: number): RiskBand => RISK_BANDS[dustLevelOf(ug)];

/** Wind word: the hazard levels, plus "breezy" for a sub-hazard 20+ km/h. */
function windWord(gust: number): string {
  const level = windLevelOf(gust);
  if (level) return ["strong", "gale", "storm-force"][level - 1];
  return gust >= 20 ? "breezy" : "calm";
}

/** 8-point compass label for the direction wind blows FROM. */
function compassDir(deg: number): string {
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(deg / 45) % 8];
}

/** Visibility word: the fog levels, then the sub-hazard haze below 5 km. */
function visWord(meters: number): string {
  const level = fogLevelOf(meters);
  if (level) return ["fog", "thick fog", "dense fog"][level - 1];
  if (meters < 2000) return "misty";
  if (meters < 5000) return "hazy";
  return "clear";
}

function heatPhrase(apparent: number, wetBulb?: number): string {
  if (wetBulb != null && heatLevelOf({ wet_bulb_c: wetBulb }) >= 2) return "dangerous humid heat";
  const hot = heatLevelOf({ apparent_c: apparent });
  if (hot) return ["very hot", "severe heat", "extreme heat"][hot - 1];
  const cold = coldLevelOf(apparent);
  if (cold) return ["cold", "very cold", "dangerous cold"][cold - 1];
  return "warm";
}

/** Fire activity nearby per smoke level (1-3); index 0 is unused. */
const SMOKE_PHRASE = ["", "some burning", "notable burning", "heavy burning"];

const DUST_PHRASE: Record<RiskBand, string> = {
  low: "light dust",
  moderate: "moderate dust",
  high: "high dust",
  severe: "severe dust",
};

// Risk band of each highlight, so the hero can wear the severity of what it
// shows, mapped to the four-step risk palette the /c page uses.
const heatBand = (apparent?: number, wb?: number): RiskBand =>
  RISK_BANDS[heatLevelOf({ apparent_c: apparent, wet_bulb_c: wb })];
const airBand = (b: NormalizedStation["band"]): RiskBand => RISK_BANDS[airLevelOf(b) ?? 0];

/** The "right now in India" hero. Heat- and dust-led from the 4-hourly grid,
 *  plus a worst-air row from the hourly snapshot, each row state-qualified (so
 *  the place is recognisable), stamped with its own freshness, and coloured by
 *  its severity; the whole card takes the tint of the worst extreme, like /c. */
function renderHero(
  h: NationalHighlights | undefined,
  meta?: { gridAsOf?: string; airAsOf?: string; map?: IndiaMap },
  lang: Lang = "en",
): string {
  const rows: string[] = [];
  let worst: RiskBand = "low";
  // Place + state names are proper nouns from the gazetteer: kept as-is (English)
  // in every language; transliterating them would be unreliable.
  const place = (name: string, state?: string) => esc(state ? `${name}, ${state}` : name);
  const age = (iso?: string) => (iso ? ` <span class="age">· ${relTime(iso)}</span>` : "");
  // "feels 41°": in Kannada/Hindi the verb follows the number ("41° ಅನಿಸುತ್ತದೆ").
  const feels = (c: number) =>
    lang === "en" ? `feels like ${Math.round(c)}°` : `${Math.round(c)}° ${t("feels", lang)}`;
  const row = (band: RiskBand, lat: number, lon: number, body: string, iso?: string) => {
    if (RISK_BANDS.indexOf(band) > RISK_BANDS.indexOf(worst)) worst = band;
    return `<a class="hl" style="--hue:${RISK_COLOR[band]}" href="${lp(`/c/${lat},${lon}`, lang)}">${body}${age(iso)}</a>`;
  };
  if (h?.hottest) {
    rows.push(
      row(
        heatBand(h.hottest.apparent_c, h.hottest.wet_bulb_c),
        h.hottest.lat,
        h.hottest.lon,
        `${icon("heat")}${t("Hottest", lang)}: <b>${place(h.hottest.name, h.hottest.state)}</b>, ${feels(h.hottest.apparent_c)}, ${t(heatPhrase(h.hottest.apparent_c, h.hottest.wet_bulb_c), lang)}`,
        meta?.gridAsOf,
      ),
    );
  }
  if (h?.dustiest) {
    rows.push(
      row(
        dustBand(h.dustiest.dust_ug_m3),
        h.dustiest.lat,
        h.dustiest.lon,
        `${icon("dust")}${t("Dustiest", lang)}: <b>${place(h.dustiest.name, h.dustiest.state)}</b>, ${t(DUST_PHRASE[dustBand(h.dustiest.dust_ug_m3)], lang)}`,
        meta?.gridAsOf,
      ),
    );
  }
  if (h?.worstAir) {
    rows.push(
      row(
        airBand(h.worstAir.band),
        h.worstAir.lat,
        h.worstAir.lon,
        `${icon("air")}${t("Worst air", lang)}: <b>${place([h.worstAir.station, h.worstAir.name].filter(Boolean).join(", "), h.worstAir.state)}</b>, AQI ${h.worstAir.aqi} ${t(AQI_BAND_LABEL[h.worstAir.band] ?? "", lang)}`,
        meta?.airAsOf,
      ),
    );
  }
  const map = meta?.map ? renderIndiaMap(meta.map, lang, relTime) : "";
  return rows.length || map
    ? `<section class="hero-now" style="--cond:${RISK_COLOR[worst]}"><h2>${t("India now", lang)}</h2>${map}${rows.join("")}</section>`
    : "";
}

const CLOUD =
  '<svg width="22" height="22" viewBox="0 0 64 64" aria-hidden="true" style="vertical-align:-4px">' +
  '<g fill="var(--sky)"><rect x="14" y="35" width="36" height="13" rx="6.5"/>' +
  '<circle cx="24" cy="33" r="9"/><circle cx="37" cy="30" r="11"/><circle cx="46" cy="37" r="6.5"/></g></svg>';

// GitHub mark for the footer star CTA, and the UrbanMorph brand icon inlined as
// a tiny data URI (self-contained: no external request, no dependency on their site).
const GH_MARK =
  '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>';
const UM_ICON =
  "data:image/webp;base64,UklGRoQDAABXRUJQVlA4WAoAAAAQAAAAQgAASgAAQUxQSGABAAABkJNtW6U5rwQcLBIQsEk+CSMBCSOBLu0vAQcZCZ+DIIEuZai2fXPiTJkiIiYAAAL/HRD4b8FP/lMx2N1RCwMal3OvzH/u4xPru1yZrXtYZfsWV+F2gd0bRO4XuV/kfp77OR4gHSBwP1sOELmf4QHCCfIBHA8QTqAn4AHsCeQE/gThvzgPfCXg2y4KqSS870KgQsH3xaTmkCoJ+FjAD7lxVxjx9mOetKCWYWsMwNePWaYpVSiINT4GeHufUtAcawpbaiwvC0x52q4aBXcDyeyn+DbTkA20iWGKaUOsMcKkVR50SgM9TFrk6oE20MPoEhnd0kIP3GUB3wdtYTSwcZpioG1iFsDcOseNwN1EqgCAXDIsYKy2kTk4/D0oYbBJHX/rI4OyGQVX+sgwpjiMd2WR4jDTpiWyw1zzLKAG0+8yK2BFq1PUYlHRYSpY2MUyoETB6tcrNaXXhU2deIF4cTg/VlA4IP4BAAAwDwCdASpDAEsAPmEqkEYkIiGhLhLpIIAMCWgAxy4m3X55/Wfx452bgrvdh4X5LpYeJF0gPMB+wHrTehb0AP2K6zf0AP1G9MH9u/go/cT0gMwl/AD9KwRtq39DJthRE7/H373TUAJXNuytPYhPi8MfLHkJV50C4PGrb5fSD4WgzSjQAPh3RT0GeeeTA4yz+jQX+ee18m/jZVpp8lpybn+Tp/c4H/9Dg1zVx+/8YsvIDz27eD4nJgnR/9mGT7GBUr+atMN5idp9vfkv/dxusODKkUfkm7dc9OORlMEkdLOWb95Mv6Sr/FT3ky/pKm868ItysJf5pVPbP2/zTP/+tG4+lPY+QR2MaFA5FKAhAphAgPngo3P448Pg3dlyT5sgQ/DC2XOncFEuTYcuTY8vnDQY0Z4F1AgRwfuAqdKLE6QHZgBK6Xw5g1byAH3cLsY1KMv/d542Q73UdTBEWLf3/Vj9Q4amKbTs1XoUXRzBWE+Atwe+00idWo9294h0q/eZjD5I1GANDkIne1SB0Qb+NiQO8cRp1I4Hxjf4gQaeaqez9KoIlJhW4Bvg1IOxIx0IuWGi3qRnpMMGvfIzDdWPHD0t8m8/yhT42IhbFj3rfFDvvfGNMr/2Mo/BWrIvf9NccHkg6U8jqDPvuT7cTvc7S2vkJcs8etluA1LbC+AAAAA=";

// Notched phones: pages opt into the full screen (viewport-fit=cover) and pad
// whatever meets a screen edge by the notch/home-bar inset. env() is 0 on other
// screens, so the "+ inset" leaves their layout unchanged.
const VIEWPORT = `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`;

/** `padding` of `y` (top/bottom) and `x` (left/right), each plus that side's safe-area inset. */
function safePad(y: string, x: string): string {
  const side = (s: string, v: string) => `calc(${v} + env(safe-area-inset-${s}))`;
  return `padding:${side("top", y)} ${side("right", x)} ${side("bottom", y)} ${side("left", x)}`;
}

const BASE_CSS = `
:root{--sky:#0284c7;--ink:#0f172a;--muted:#64748b;--bg:#f8fafc;--card:#fff;--line:#e2e8f0;--warn-text:#b45309;--serif:Georgia,'Iowan Old Style','Palatino Linotype',Palatino,Cambria,serif;--sans:ui-sans-serif,-apple-system,system-ui,sans-serif;--mono:ui-monospace,SFMono-Regular,Menlo,monospace;--hair:color-mix(in srgb,var(--ink) 12%,transparent)}
@media(prefers-color-scheme:dark){:root{--ink:#e2e8f0;--muted:#94a3b8;--bg:#0b1220;--card:#111827;--line:#1f2937;--warn-text:#fbbf24}}
*{box-sizing:border-box}html,body{margin:0}
body{font:16px/1.5 var(--sans);color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased;padding-bottom:env(safe-area-inset-bottom)}
.bar{display:flex;align-items:center;padding:calc(14px + env(safe-area-inset-top)) calc(18px + env(safe-area-inset-right)) 14px calc(18px + env(safe-area-inset-left));border-bottom:1px solid var(--line)}
.brand{font-weight:700;letter-spacing:-.02em;color:var(--ink);text-decoration:none;font-size:1.1rem}
main{max-width:560px;margin:0 auto;padding:20px 18px 32px}
.foot{max-width:560px;margin:0 auto;padding:18px;color:var(--muted);font-size:.78rem;border-top:1px solid var(--line)}
.foot a{color:var(--muted)}
.langsw{max-width:560px;margin:0 auto;padding:0 18px 22px;font-size:.82rem;color:var(--muted)}
.langsw a{color:var(--muted);text-decoration:none;border-bottom:1px solid transparent}
.langsw a:hover{border-color:var(--muted)}
.langsw b{color:var(--ink);font-weight:600}
.ic{width:18px;height:18px;flex:none;vertical-align:-.18em}
`;

const DEFAULT_DESC =
  "mugilu: the open sky of India. Air, heat, rain, UV, dust and the official warning over any point, the single worst hazard named for you.";
const SITE = "https://mugilu.live";
/** Where there is no room for the full disclaimer (kiosk, embed card). */
const SHORT_DISCLAIMER = "Informational only, not medical advice.";
const HOME_OG = `${SITE}/og.png`; // the branded social-share card

/** schema.org JSON-LD, safe to embed in a <script> (escapes the `<` that could
 *  otherwise break out of the tag). */
function ld(obj: object): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

// Cloudflare Web Analytics (RUM) beacon token. PUBLIC (it ships in every page's
// HTML), so it is safe to commit. Cookieless, no PII, no cross-site tracking, no
// fingerprinting; complements the first-party D1/AE pipeline with real referrers,
// unique visitors and Core Web Vitals. Empty = beacon off (renders nothing).
const CF_BEACON_TOKEN = "f2e28ec9892741889c2fb81ec96ff4dd";

// Footer nav: localized labels, language-prefixed internal links. The two GitHub
// links stay external (labels localized). "a digital commons" is a single phrase
// in hi/kn, so it renders as one localized link.
function footerNav(lang: Lang): string {
  const nav = (path: string, en: string) => `<a href="${lp(path, lang)}">${t(en, lang)}</a>`;
  return (
    `${nav("/about", "about")} · ${nav("/methodology", "how it works")} · ` +
    `${nav("/places", "all places")} · ${nav("/about#build", "build on it")} · ${nav("/terms", "terms")} · ` +
    `<a href="https://github.com/urbanmorph/mugilu">${t("code", lang)}</a> · ` +
    `<a href="https://github.com/urbanmorph/mugilu/blob/main/PDGI.md">${t("a digital commons", lang)}</a>`
  );
}

// Footer language switcher: each language named in its own script, current one
// bold (not a link). Links are RELATIVE (path-only) so they work on any host,
// localhost in dev and the apex in prod; the absolute hreflang/canonical/og
// above stay absolute for SEO. `canonical` carries the language-agnostic path.
function langSwitcher(canonical: string, lang: Lang): string {
  const path = new URL(canonical).pathname;
  const items = LANGS.map((L) =>
    L === lang ? `<b>${LANG_NAME[L]}</b>` : `<a href="${esc(lp(path, L))}" hreflang="${L}">${LANG_NAME[L]}</a>`,
  ).join(" · ");
  return `<nav class="langsw" aria-label="Language">${items}</nav>`;
}

/** Optional page settings for shell(). */
interface ShellOpts {
  desc?: string;
  canonical?: string;
  jsonLd?: string;
  ogImage?: string;
  noBeacon?: boolean;
  lang?: Lang;
  /** Chromeless: no header bar, footer nav or language switcher (kiosk/display). */
  bare?: boolean;
}

function shell(
  title: string,
  body: string,
  css: string,
  { desc = DEFAULT_DESC, canonical, jsonLd, ogImage, noBeacon, lang = "en", bare }: ShellOpts = {},
): string {
  const cur = canonical ? langUrl(canonical, lang) : undefined;
  // hreflang alternates for every language + x-default (English) so search
  // engines pair the versions and serve the right one.
  const alts = canonical
    ? LANGS.map((L) => `<link rel="alternate" hreflang="${L}" href="${esc(langUrl(canonical, L))}">`).join("") +
      `<link rel="alternate" hreflang="x-default" href="${esc(canonical)}">`
    : "";
  // og:locale for the current language + alternates for the others (India variants).
  const ogLoc: Record<Lang, string> = { en: "en_IN", hi: "hi_IN", kn: "kn_IN" };
  const localeTags =
    `<meta property="og:locale" content="${ogLoc[lang]}">` +
    LANGS.filter((L) => L !== lang)
      .map((L) => `<meta property="og:locale:alternate" content="${ogLoc[L]}">`)
      .join("");
  // Client-side relative time. English keeps singular/plural; other languages use
  // the reviewed "X … ago" templates (the X slot survives translation).
  const relFn =
    lang === "en"
      ? `function r(ms){var m=Math.round(ms/6e4);if(m<1)return'just now';if(m<60)return m+' min ago';var h=Math.round(m/60);if(h<24)return h+(h===1?' hour ago':' hours ago');var d=Math.round(h/24);return d+(d===1?' day ago':' days ago');}`
      : `function r(ms){var m=Math.round(ms/6e4);if(m<1)return ${JSON.stringify(t("just now", lang))};if(m<60)return ${JSON.stringify(t("X min ago", lang))}.replace('X',m);var h=Math.round(m/60);if(h<24)return ${JSON.stringify(t("X hours ago", lang))}.replace('X',h);var d=Math.round(h/24);return ${JSON.stringify(t("X days ago", lang))}.replace('X',d);}`;
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
${VIEWPORT}
<meta name="color-scheme" content="light dark">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
${installHead(lang)}
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${cur ? `<link rel="canonical" href="${esc(cur)}">` : ""}${alts}
<meta property="og:type" content="website">
<meta property="og:site_name" content="mugilu">
${localeTags}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
${cur ? `<meta property="og:url" content="${esc(cur)}">` : ""}
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">` : ""}
<meta name="twitter:card" content="${ogImage ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
${ogImage ? `<meta name="twitter:image" content="${esc(ogImage)}">` : ""}
${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ""}
${CF_BEACON_TOKEN && !noBeacon ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${CF_BEACON_TOKEN}"}'></script>` : ""}
<style>${BASE_CSS}${bare ? "" : INSTALL_CSS}${css}${langCss(lang)}</style>
</head>
<body>
${
  bare
    ? body
    : `<header class="bar"><a class="brand" href="${lp("/", lang)}">${CLOUD} mugilu</a>${installButton(lang)}</header>
<main>${body}</main>
<footer class="foot">${footerNav(lang)}</footer>
${canonical ? langSwitcher(canonical, lang) : ""}
<script>${INSTALL_JS}${SW_REGISTER}</script>`
}
<script>
(function(){${relFn}var n=Date.now();document.querySelectorAll('time[data-rel][datetime]').forEach(function(t){var d=new Date(t.getAttribute('datetime')).getTime();if(!isNaN(d))t.textContent=r(n-d);});})();
</script>
</body>
</html>`;
}

// The conditions page as an "atmospheric almanac": a sky-tinted backdrop whose hue
// names the dominant hazard and whose strength its band (--tint/--tk from tintOf;
// clear-sky blue when calm), the headline word in the severity colour (--cond), an
// editorial serif Ambient statement, and the readings as hairline-ruled strata
// (not cards). Inline-SVG line icons, currentColor so the driver layer glows.
const CONDITIONS_CSS = `
body{background:linear-gradient(180deg,color-mix(in srgb,var(--tint) var(--tk),var(--bg)),color-mix(in srgb,var(--tint) 8%,var(--bg)) 22%,var(--bg) 55%) var(--bg) no-repeat}
.coord{font:500 .78rem/1.4 var(--mono);letter-spacing:.04em;color:var(--muted);margin:.4rem 0 0}
.loc{font-family:var(--serif);font-weight:600;font-size:clamp(1.7rem,6.5vw,2.15rem);line-height:1.05;letter-spacing:-.01em;margin:.35rem 0 0}
.when{color:var(--muted);font-size:.9rem;margin:.3rem 0 0}
.near-warn{color:var(--muted);font-size:.85rem;margin:.6rem 0 0}
.stale{margin:.8rem 0 0;padding:.6rem .8rem;border-radius:10px;background:color-mix(in srgb,var(--muted) 14%,transparent);font-size:.9rem}
.warn{display:flex;gap:.65rem;align-items:flex-start;margin:1.3rem 0 0;padding:.8rem .95rem;background:color-mix(in srgb,var(--wc) 14%,var(--bg));border-left:3px solid var(--wc);border-radius:0 7px 7px 0}
.warn .ic{color:var(--wc);flex:none;margin-top:1px}
.warn b{font-weight:700;font-size:.95rem;line-height:1.35}
.warn .wsrc{display:block;margin-top:2px;color:var(--muted);font-size:.76rem;font-weight:500}
.amb{margin:1.7rem 0 .2rem}
.amb-eye{display:flex;align-items:center;gap:.45rem;font:600 .76rem/1 var(--sans);letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin:0 0 .55rem}
.amb-eye .ic{width:15px;height:15px;color:var(--cond)}
.amb-head{font-family:var(--serif);font-weight:600;font-size:clamp(2.6rem,12vw,3.7rem);line-height:.95;letter-spacing:-.025em;margin:0;color:var(--ink)}
.amb-head .b{color:var(--cond)}
.amb-say{font-family:var(--serif);font-size:1.18rem;line-height:1.42;margin:.65rem 0 0;color:var(--ink);max-width:32ch}
.amb-act{font:600 1rem/1.4 var(--sans);margin:.5rem 0 0;max-width:34ch}
.amb-also{display:flex;align-items:flex-start;gap:.4rem;font:500 .92rem/1.4 var(--sans);color:var(--cond);margin:.7rem 0 0;max-width:34ch}
.amb-also .ic{width:16px;height:16px;flex:none;margin-top:.1rem}
.who{display:flex;flex-wrap:wrap;gap:.35rem 1rem;margin:1.2rem 0 0;padding:0}
.who a{font:500 .9rem var(--sans);color:var(--muted);text-decoration:none;padding-bottom:2px;border-bottom:2px solid transparent}
.who a.on{color:var(--ink);border-color:var(--cond)}
.strata{margin:1.8rem 0 0;border-top:1px solid var(--hair)}
.lyr{display:grid;grid-template-columns:5.4rem 1fr;gap:0 1rem;padding:1.05rem .1rem;border-bottom:1px solid var(--hair)}
.lyr dt{display:flex;flex-wrap:wrap;align-items:center;align-self:start;gap:.3rem .5rem;font:600 .8rem/1.2 var(--sans);letter-spacing:.04em;text-transform:uppercase;color:var(--muted);padding-top:.6rem}
.lyr dt .ic{flex:none}
.lyr.on dt{color:var(--cond)}
.lyr .fy{white-space:nowrap;margin-left:.1rem;padding:.1rem .4rem;border-radius:999px;font:600 .66rem/1.3 var(--sans);letter-spacing:.03em;text-transform:none;color:var(--ink);background:color-mix(in srgb,var(--cond) 18%,transparent)}
.lyr.quiet .num,.lyr.quiet .q{color:var(--muted)}
.lyr dd{margin:0;display:flex;flex-direction:column;gap:.16rem;min-width:0}
.lyr .num{font:700 2.2rem/1 var(--sans);letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:var(--ink)}
.lyr .q{font-size:.95rem;color:var(--ink)}
.lyr .q b{font-weight:700}
.lyr .q .qa{color:var(--muted);text-transform:uppercase;font-size:.72rem;letter-spacing:.05em}
.lyr .q .qa.nu{text-transform:none;letter-spacing:.01em}
.lyr .sub{color:var(--muted);font-size:.82rem;line-height:1.5}
.dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:.35rem;vertical-align:.06em}
.dot.meas{background:var(--ink)}
.dot.mod{background:transparent;border:1.5px solid var(--muted)}
.cx footer{margin:2.1rem 0 0;border-top:1px solid var(--hair);padding-top:1.1rem}
.attr{color:var(--muted);font-size:.8rem;margin:0 0 .3rem}
.disc{color:var(--muted);font-size:.76rem;line-height:1.5;margin:0}
.raw{margin:.95rem 0 0;font:500 .82rem var(--mono);letter-spacing:.02em}
.raw a{color:var(--cond);text-decoration:none}
.raw a:hover{text-decoration:underline}
.nearby{margin:1.1rem 0 0;font-size:.9rem;line-height:1.9;color:var(--muted)}.nearby a{color:var(--cond);text-decoration:none}.nearby a:hover{text-decoration:underline}
.cxback{margin:1.1rem 0 0;font-size:.9rem}.cxback a{color:var(--muted);text-decoration:none}.cxback a:hover{color:var(--ink)}
@media(min-width:960px){
main:has(>.cx){max-width:1120px;padding-top:28px}
.cx{display:grid;grid-template-columns:minmax(0,23rem) minmax(0,1fr);column-gap:3.5rem;align-items:start}

.cx-r .strata{margin-top:.5rem;display:block;column-count:2;column-gap:2.2rem;border-top:0}
.cx-r .lyr{break-inside:avoid}
.cx-r .lyr{grid-template-columns:1fr;align-content:start;border-top:1px solid var(--hair);border-bottom:0;padding:1rem .1rem 1.15rem}
.cx-r .lyr dt{padding-top:0;margin-bottom:.5rem}
.cx footer{grid-column:1/-1}
}
/* The left rail (place, read, alerts) stays in view while the layers scroll, when it fits. */
@media(min-width:960px) and (min-height:820px){.cx-l{position:sticky;top:1.5rem}}
@media(prefers-reduced-motion:no-preference){
.coord,.loc,.when,.warn,.amb,.lyr{animation:rise .55s both cubic-bezier(.2,.7,.2,1)}
.loc{animation-delay:.03s}.when{animation-delay:.06s}.warn{animation-delay:.09s}.amb{animation-delay:.12s}
.strata .lyr:nth-child(1){animation-delay:.2s}.strata .lyr:nth-child(2){animation-delay:.26s}.strata .lyr:nth-child(3){animation-delay:.32s}.strata .lyr:nth-child(4){animation-delay:.38s}.strata .lyr:nth-child(5){animation-delay:.44s}
}
/* Phones: one column, the alerts box after the layers (it sits in the left rail on laptops). */
@media(max-width:959px){.cx{display:flex;flex-direction:column}.cx-l{display:contents}.cx-r{order:1}.cx .alerts{order:2}.cx footer{order:3}}
@keyframes rise{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:none}}
`;

function warnColor(color: string): string {
  switch (color.toLowerCase()) {
    case "red":
      return RISK_COLOR.severe;
    case "orange":
      return RISK_COLOR.high;
    case "yellow":
      return RISK_COLOR.moderate;
    default:
      return "#64748b";
  }
}

// Inline Lucide-style line icons (MIT). currentColor + one stroke weight, so each
// inherits its context colour (muted by default, the condition hue on the driver).
const ICON: Record<string, string> = {
  air: '<path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>',
  heat: '<path d="M14 4v10.5a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>',
  cold: '<path d="M2 12h20M12 2v20M20 16l-4-4 4-4M4 8l4 4-4 4M16 4l-4 4-4-4M8 20l4-4 4 4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  dust: '<path d="M5.2 6.2 6.6 7.6M2 13h2M20 13h2M17.4 7.6l1.4-1.4M22 17H2M22 21H2"/><path d="M16 13a4 4 0 0 0-8 0"/>',
  smoke:
    '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  rain: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  warn: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
  compass: '<circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z"/>',
  wind: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22V15"/>',
  fog: '<path d="M4 8h16M6 12h14M4 16h12M8 20h10"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
  layers:
    '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  heart:
    '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
};
ICON.clear = ICON.sun;

function icon(name: string): string {
  return `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] ?? ""}</svg>`;
}

// Ambient driver -> icon key, and the noun for the headline ("High heat.").
const DRIVER_KEY: Record<string, string> = {
  Air: "air",
  Heat: "heat",
  Cold: "cold",
  UV: "sun",
  Dust: "dust",
  Wind: "wind",
  Fog: "fog",
  Smoke: "smoke",
  Warning: "warn",
  none: "clear",
};

/** Wet-bulb survivability read (~31 is the theoretical limit): word + colour per level. */
const WET_BULB = ["safe", "caution", "severe", "dangerous"];
const wetBulb = (wb: number): [string, string] => {
  const level = heatLevelOf({ wet_bulb_c: wb });
  return [WET_BULB[level], levelColor(level)];
};

/** One reading as a hairline-ruled stratum: icon + label, a big figure, a tail,
 *  and an optional inline scale showing where it sits on the good->severe range. */
interface Layer {
  key: string;
  html: string;
}

/** What every layer needs to know about the read: whose it is, and the words for
 *  the persona's tag in the page's language. */
interface LayerCtx {
  risk: AmbientRisk;
  forYou: string;
}

function lyr(key: string, label: string, ctx: LayerCtx, num: string, q: string, sub: string, bar = ""): Layer {
  const { risk } = ctx;
  // For a persona: their own layers tagged, the rest quieter, except the headline
  // hazard, which stays at full strength (everyone: neither).
  const own = risk.persona === "everyone" ? "" : forPersona(key, risk) ? " mine" : isDriver(key, risk) ? "" : " quiet";
  const tag = own === " mine" ? `<span class="fy">${ctx.forYou}</span>` : "";
  const html = `<div class="lyr${isDriver(key, risk) ? " on" : ""}${own}" data-k="${key}"><dt>${icon(key)}<span>${label}</span>${tag}</dt><dd><span class="num">${num}</span><span class="q">${q}</span>${bar}${sub ? `<span class="sub">${sub}</span>` : ""}</dd></div>`;
  return { key, html };
}

/** The reading inside a layer each persona should look at first: the fine
 *  particles that reach the lungs and heart (PM2.5; PM10 too for the airways),
 *  wet-bulb for bodies that cool less well, and WBGT, the measure made for work
 *  in the heat. */
const KEY_READING: Record<Persona, { pollutants: string[]; heat?: "wbgt" | "wetbulb" }> = {
  everyone: { pollutants: [] },
  asthma: { pollutants: ["pm25", "pm10"] },
  elderly: { pollutants: ["pm25"], heat: "wetbulb" },
  child: { pollutants: ["pm25"] },
  outdoor: { pollutants: ["pm25"], heat: "wbgt" },
  heart: { pollutants: ["pm25"], heat: "wetbulb" },
};

/** The persona toggles (understated text links), the current one marked. */
function personaLinks(href: (p: Persona) => string, current: Persona, lang: Lang): string {
  return PERSONAS.map(
    (p) => `<a${p === current ? ' class="on"' : ""} href="${href(p)}">${esc(t(PERSONA_LABEL[p], lang))}</a>`,
  ).join("");
}

/** The editorial headline, "High heat." with the band word coloured, or "All clear." */
function headHtml(risk: AmbientRisk, lang: Lang): string {
  const h = headline(risk, (en) => t(en, lang));
  return h.noun ? `<span class="b">${h.word}</span> ${h.noun}.` : `<span class="b">${h.word}.</span>`;
}

/** Whether the air reading is older than the page by half an hour or more (stations
 *  report on their own clock, often an hour or two behind), so it is named apart. */
function airLag(c: Conditions): boolean {
  return !!c.air_as_of && Date.parse(c.as_of) - Date.parse(c.air_as_of) >= 30 * 60_000;
}

/** CSS custom properties for a read's colours: --cond (severity, the headline word)
 *  and --tint/--tk (the backdrop: the hazard's hue at the band's strength). */
function readVars(risk: AmbientRisk): string {
  const { hue, strength } = tintOf(risk);
  return `--cond:${RISK_COLOR[risk.band]};--tint:${hue};--tk:${strength}%`;
}

/** A pinned official warning, the most urgent thing on the page. */
function renderWarning(w: Warning, lang: Lang): string {
  const meta = [w.severity, w.until ? t("until X", lang).replace("X", w.until) : ""].filter(Boolean).join(" · ");
  return `<div class="warn" style="--wc:${warnColor(w.color)}">${icon("warn")}<div><b>${esc(w.event)}</b>${meta ? ` · ${esc(meta)}` : ""}<span class="wsrc">${t("Official warning", lang)} · ${esc(w.issuer)}</span></div></div>`;
}

/** Warnings active nearby whose areas do not cover this spot: one quiet line, never the red box. */
function renderNearbyWarnings(ws: Warning[], lang: Lang): string {
  // One entry per kind: a count when several areas nearby have it, else its end time.
  const byEvent = new Map<string, Warning[]>();
  for (const w of ws) byEvent.set(w.event, [...(byEvent.get(w.event) ?? []), w]);
  const items = [...byEvent]
    .map(([event, list]) => {
      const one = list.length === 1 ? list[0] : undefined;
      const detail = one ? (one.until ? t("until X", lang).replace("X", one.until) : "") : String(list.length);
      return `${esc(event)}${detail ? ` (${esc(detail)})` : ""}`;
    })
    .join(" · ");
  return `<p class="near-warn">${t("Near this point, but not at it:", lang)} ${items}</p>`;
}

// Records this /c visit into the browser's "Your places" list (first-party,
// localStorage; no login, no server). The reverse-geocoded label is read from
// the page so "use my location" shows a name, not raw coordinates.
const PLACE_RECORDER = `<script>
(function(){try{
var pp=location.pathname.split('/');
if(pp[1]!=='c'||!pp[2])return;
var id=decodeURIComponent(pp[2]),el=document.querySelector('h1.loc');
// Coordinate comes from the URL (/c/lat,lon) or the page (named /c/slug pages).
var ll=(el&&el.getAttribute('data-ll'))||id,c=ll.split(',');
if(c.length<2||isNaN(+c[0]))return;
var label=el?el.textContent.trim():id;
// If they searched in a native script, remember it in that script (passed via #q=).
var h=location.hash.match(/[#&]q=([^&]+)/);
if(h){var q=decodeURIComponent(h[1]);if(/[^\\x00-\\x7F]/.test(q))label=q;}
var K='mugilu:places',L;try{L=JSON.parse(localStorage.getItem(K))||[]}catch(e){L=[]}
var p=L.filter(function(x){return x.id===id})[0];
if(p){p.n=(p.n||0)+1;p.t=Date.now();if(!p.name)p.label=label}
else{L.push({id:id,lat:c[0],lon:c[1],label:label,n:1,t:Date.now(),fav:false})}
L.sort(function(a,b){return (b.fav?1:0)-(a.fav?1:0)||b.n-a.n||b.t-a.t});
var f=L.filter(function(x){return x.fav}),r=L.filter(function(x){return !x.fav}).slice(0,Math.max(0,12-f.length));
localStorage.setItem(K,JSON.stringify(f.concat(r)));
if(location.hash)try{history.replaceState(null,'',location.pathname+location.search)}catch(e){}
}catch(e){}})();
</script>`;

/** One layer's content, rendered as a /c stratum or a display tile. `mini` is the
 *  tile's compact graphic (default: `bar`); `normal` is the heat-vs-normal ruler,
 *  which the /c page puts in the heat layer and the display beside the read. */
interface LayerData {
  key: string;
  label: string;
  num: string;
  q: string;
  sub: string;
  bar: string;
  mini?: string;
  normal?: string;
}

/** Every reading present, as layers (unordered: see orderByRisk). */
function layerData(c: Conditions, risk: AmbientRisk, lang: Lang): LayerData[] {
  const out: LayerData[] = [];
  const keyReading = KEY_READING[risk.persona];
  const L = (key: string, label: string, num: string, q: string, sub: string, bar = ""): LayerData => ({
    key,
    label,
    num,
    q,
    sub,
    bar,
  });
  const band = c.air?.band ?? "unknown";
  const bandColor = BAND_COLOR[band] ?? BAND_COLOR.unknown;
  const bandLabel = AQI_BAND_LABEL[band] ?? "n/a";
  // The readings, as strata. Each renders only when it has a value; the Ambient
  // driver's stratum is highlighted (icon + label in the condition colour).
  if (c.air) {
    const marker = c.air.station
      ? `<i class="dot meas"></i>${t("measured", lang)} · ${c.air.station.distance_km} km`
      : `<i class="dot mod"></i>${t("modelled", lang)}`;
    const aqli = c.air.yll != null ? `<br>${lifeBlocks(c.air.yll)}~${c.air.yll} ${t("years of life lost", lang)}` : "";
    const bars = pollutantBars(c.air.pollutants, keyReading.pollutants);
    const worst = worstPollutant(c.air.pollutants, keyReading.pollutants);
    out.push({
      ...L(
        "air",
        t("Air", lang),
        c.air.aqi != null ? String(c.air.aqi) : "n/a",
        `<span class="qa">AQI</span> <b style="color:${bandColor}">${t(bandLabel, lang)}</b>`,
        `${marker}${aqli}`,
        bars
          ? `<div class="prs">${bars}<span class="prk">${t("The dashed line is the CPCB limit.", lang)}</span></div>`
          : "",
      ),
      mini: worst ? `<div class="prs">${pollutantBars(worst, keyReading.pollutants)}</div>` : "",
    });
  }
  if (c.heat) {
    const h = c.heat;
    const cold = h.apparent_c != null && coldLevelOf(h.apparent_c) > 0;
    let bar = "";
    // Cold: a dot for how cold it feels among the cold thresholds. Hot or mild:
    // the two heat-stress reads against theirs.
    if (cold) {
      const a = h.apparent_c!;
      bar += gauge(a, -10, 30, { from: a, ticks: THRESHOLDS.cold, level: coldLevelOf(a), marker: true });
    } else {
      if (h.wet_bulb_c != null) {
        const [wn, wc] = wetBulb(h.wet_bulb_c);
        bar += `<span class="gl${keyReading.heat === "wetbulb" ? " key" : ""}">${t("wet-bulb", lang)} ${round(h.wet_bulb_c)}° <b style="color:${wc}">${t(wn, lang)}</b></span>`;
        bar += gauge(h.wet_bulb_c, 10, 35, {
          ticks: THRESHOLDS.wetBulb,
          level: heatLevelOf({ wet_bulb_c: h.wet_bulb_c }),
        });
      }
      if (h.wbgt_c != null) {
        bar += `<span class="gl${keyReading.heat === "wbgt" ? " key" : ""}">WBGT ${round(h.wbgt_c)}°</span>`;
        bar += gauge(h.wbgt_c, 15, 40, { ticks: THRESHOLDS.wbgt, level: heatLevelOf({ wbgt_c: h.wbgt_c }) });
      }
    }
    // Today's high against the normal here: drawn only when it stands out (and is
    // still today's, in IST), always labelled.
    const n = c.heat_vs_normal;
    let normal = "";
    if (heatVsNormalShown(n)) {
      normal += `<span class="gl">${heatVsNormalLine(n, lang)}</span>`;
      normal += gauge(n.today_max_c, n.normal_max_c - 10, n.normal_max_c + 10, {
        from: n.normal_max_c,
        ticks: [n.normal_max_c],
        marker: true,
        colour: n.anomaly_c >= 0 ? RISK_COLOR.high : "var(--sky)",
      });
      normal += `<small class="prk">${t(NORMALS_LABEL, lang)}</small>`;
    }
    out.push({
      ...L(
        "heat",
        t("Heat", lang),
        `${round(h.apparent_c)}°`,
        // No feels-like, no phrase (never read a missing value as 0°, "dangerous cold").
        h.apparent_c != null
          ? `<span class="qa">${t("feels like", lang)}</span> <b>${t(heatPhrase(h.apparent_c, h.wet_bulb_c), lang)}</b>`
          : "",
        "",
        `<span class="sub">${round(h.temp_c)}° ${t("actual", lang)} · ${round(h.humidity_pct)}% ${t("humidity", lang)}</span>${bar}`,
      ),
      mini: bar,
      normal,
    });
  }
  if (c.uv?.index != null) {
    out.push(
      L(
        "sun",
        t("Sun", lang),
        String(Math.round(c.uv.index)),
        `<span class="qa">${t("UV index", lang)}</span> <b>${t(uvWord(c.uv.index), lang)}</b>`,
        "",
        uvSteps(c.uv.index),
      ),
    );
  }
  if (c.dust?.dust_ug_m3 != null) {
    out.push(
      L(
        "dust",
        t("Dust", lang),
        String(Math.round(c.dust.dust_ug_m3)),
        `<span class="qa nu">µg/m³</span> <b>${t(dustBand(c.dust.dust_ug_m3), lang)}</b>`,
        "",
        gauge(c.dust.dust_ug_m3, 0, 600, { ticks: THRESHOLDS.dust, level: dustLevelOf(c.dust.dust_ug_m3) }),
      ),
    );
  }
  if (c.wind && (c.wind.gust_kmh != null || c.wind.speed_kmh != null)) {
    const gust = c.wind.gust_kmh ?? c.wind.speed_kmh!;
    const dirParts: string[] = [];
    if (c.wind.direction_deg != null) dirParts.push(t("from X", lang).replace("X", compassDir(c.wind.direction_deg)));
    if (c.wind.speed_kmh != null)
      dirParts.push(t("X km/h steady", lang).replace("X", String(Math.round(c.wind.speed_kmh))));
    out.push(
      L(
        "wind",
        t("Wind", lang),
        String(Math.round(gust)),
        `<span class="qa nu">km/h ${t("gusts", lang)}</span> <b>${t(windWord(gust), lang)}</b>`,
        dirParts.join(" · "),
        `<div class="wrow">${c.wind.direction_deg != null ? compass(c.wind.direction_deg, windLevelOf(gust)) : ""}${gauge(gust, 0, 100, { under: c.wind.speed_kmh, ticks: THRESHOLDS.wind, level: windLevelOf(gust) })}</div>`,
      ),
    );
  }
  // Visibility only surfaces when reduced (hazy/fog); clear skies aren't news.
  if (c.visibility?.meters != null && c.visibility.meters < 5000) {
    const m = c.visibility.meters;
    const val = km(m);
    out.push(
      L(
        "fog",
        t("Visibility", lang),
        val,
        `<b>${t(visWord(m), lang)}</b>`,
        "",
        gauge(m, 100, 10000, { log: true, ticks: [...THRESHOLDS.fog, 5000], level: fogLevelOf(m) }),
      ),
    );
  }
  const smokeLvl = smokeLevel(c.smoke);
  if (c.smoke && smokeLvl != null) {
    const sub =
      c.smoke.nearest_km != null
        ? `${t("nearest X km", lang).replace("X", String(c.smoke.nearest_km))} · ${t("X MW of fire power", lang).replace("X", String(c.smoke.frp_sum))}`
        : `${c.smoke.frp_sum} MW`;
    out.push(
      L(
        "smoke",
        t("Smoke", lang),
        String(c.smoke.count),
        `<span class="qa nu">${t("fires within 100 km", lang)}</span> <b>${t(SMOKE_PHRASE[smokeLvl], lang)}</b>`,
        sub,
        c.smoke.nearest_km != null
          ? gauge(c.smoke.nearest_km, 0, c.smoke.radius_km ?? 100, {
              from: c.smoke.nearest_km,
              marker: true,
              level: smokeLvl,
            })
          : "",
      ),
    );
  }
  if (c.rain && (c.rain.probability_pct != null || c.rain.precipitation_mm != null)) {
    const mm = c.rain.precipitation_mm;
    if (c.rain.probability_pct != null) {
      out.push(
        L(
          "rain",
          t("Rain", lang),
          `${c.rain.probability_pct}%`,
          `<span class="qa">${t("chance of rain", lang)}</span>`,
          mm ? t("X mm of rain now", lang).replace("X", String(mm)) : "",
          drops(c.rain.probability_pct),
        ),
      );
    } else {
      out.push(L("rain", t("Rain", lang), String(mm), `<span class="qa nu">mm</span> <b>${t("now", lang)}</b>`, ""));
    }
  }

  return out;
}

export function renderConditionsPage(
  c: Conditions,
  persona: Persona = "everyone",
  canonical?: string,
  lang: Lang = "en",
  /** mugilu's VAPID public key, when alerts are set up: shows the "alert me" box. */
  alertsKey?: string,
): string {
  const risk = ambientRisk(c, persona);
  const say = ambientSummary(risk, (en) => t(en, lang));
  const { meaning } = say;
  const slug = `${c.location.lat},${c.location.lon}`;
  const placeName = placeLabel(c); // raw: shell() escapes the title
  const place = esc(placeName);

  // Persona toggles (understated text, not chips).
  const base = lp(`/c/${slug}`, lang);
  const pills = personaLinks((p) => (p === "everyone" ? base : `${base}?as=${p}`), risk.persona, lang);

  const head = headHtml(risk, lang);

  // The readings, as strata, in the order they matter now; the Ambient driver's
  // stratum is highlighted (icon + label in the condition colour).
  const ctx: LayerCtx = { risk, forYou: t("for you", lang) };
  const strata = layerData(c, risk, lang).map((d) =>
    lyr(d.key, d.label, ctx, d.num, d.q, d.sub, d.bar + (d.normal ?? "")),
  );

  // Cross-links to nearby named places in the same state. Turns the ~800 /c/{slug}
  // pages from sitemap-only orphans into a connected graph a crawler can walk, the
  // fix for their sitting in "Discovered - currently not indexed". Only on a named
  // page (canonical is /c/{slug}); arbitrary-coordinate pages have no state anchor.
  let nearby = "";
  if (canonical) {
    const m = new URL(canonical).pathname.match(/^\/c\/([a-z][a-z0-9-]*)$/);
    const sibs = m ? siblingPlaces(m[1]) : [];
    if (sibs.length) {
      const near = sibs.map((s) => `<a href="${lp(`/c/${s.slug}`, lang)}">${esc(s.name)}</a>`).join(" · ");
      nearby = `<nav class="nearby" aria-label="${esc(t("Nearby places", lang))}">${t("Nearby:", lang)} ${near}</nav>`;
    }
  }

  const body = `
  <article class="cx">
    <div class="cx-l">
    <p class="coord">${c.location.lat}°N&nbsp;&nbsp;${c.location.lon}°E</p>
    <h1 class="loc" data-ll="${c.location.lat},${c.location.lon}">${place}</h1>
    <p class="when">${t("the sky at this point", lang)} · ${t("updated", lang)} ${relTime(c.as_of)}${airLag(c) ? ` · ${t("air reading", lang)} ${relTime(c.air_as_of!)}` : ""}</p>
    <p class="stale" id="${OFFLINE_NOTE_ID}" hidden>${t("No connection. This is the last reading on this device, from X. The conditions and warnings can be different now.", lang).replace("X", esc(istTime(c.air_as_of ?? c.as_of)))}</p>
    ${c.warnings?.length ? c.warnings.map((w) => renderWarning(w, lang)).join("") : ""}
    ${c.nearby_warnings?.length ? renderNearbyWarnings(c.nearby_warnings, lang) : ""}
    <section class="amb">
      <p class="amb-eye">${icon(DRIVER_KEY[risk.driver] ?? "clear")}<span>Ambient · ${esc(t(PERSONA_LABEL[risk.persona], lang))}</span></p>
      <p class="amb-head">${head}</p>
      <p class="amb-say">${esc(meaning)}</p>
      ${say.action ? `<p class="amb-act">${esc(say.action)}</p>` : ""}
      ${say.also ? `<p class="amb-also">${icon("users")}${esc(say.also)}</p>` : ""}
      <nav class="who" aria-label="${esc(t("Who is this for", lang))}">${pills}</nav>
    </section>
    ${alertsKey ? renderAlertsBox(alertsKey, lang) : ""}
    </div>
    <div class="cx-r">
    <dl class="strata">${orderByRisk(strata, risk, c)
      .map((l) => l.html)
      .join("")}</dl>
    </div>
    <footer>
      <p class="attr">${esc(lang === "en" ? c.attribution : c.attribution.replace(/^Sources:/, `${t("Sources", lang)}:`))}</p>
      <p class="disc">${esc(t(c.disclaimer, lang))}</p>
      <p class="raw"><a href="/c/${slug}.json">${t("JSON", lang)}</a> · <a href="/c/${slug}.md">${t("Markdown", lang)}</a> · <a href="/c/${slug}.png">${t("PNG", lang)}</a> · <a href="/embed/${slug}">${t("Embed", lang)}</a> · <a href="${lp(`/c/${slug}?kiosk`, lang)}">${t("Display", lang)}</a></p>
      ${nearby}
      <p class="cxback"><a href="${lp("/", lang)}">← ${t("Look up another place", lang)}</a> · <a href="${lp("/places", lang)}">${t("all places", lang)}</a></p>
    </footer>
  </article>`;

  const css = CONDITIONS_CSS + GLYPH_CSS + (alertsKey ? ALERTS_CSS : "") + `\n:root{${readVars(risk)}}`;
  const desc = `${placeName}: ${meaning} ${t("Air, heat, rain, UV, dust, smoke and any official warning over this spot, with the single worst hazard named for you.", lang)}`;
  // schema.org Dataset: credits mugilu + the licence, points at the machine-readable
  // siblings (the "built on it" signal in structured data; aids answer-engine pickup).
  const dataset = canonical
    ? ld({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Dataset",
            name: `Sky conditions at ${placeName}`,
            description: `Air, heat, rain, dust, UV and official warnings at ${placeName}, India - right now.`,
            url: canonical,
            isAccessibleForFree: true,
            creator: { "@type": "Organization", name: "mugilu", url: SITE },
            license: "https://mugilu.live/terms",
            temporalCoverage: c.as_of,
            spatialCoverage: {
              "@type": "Place",
              name: c.place ?? undefined,
              geo: { "@type": "GeoCoordinates", latitude: c.location.lat, longitude: c.location.lon },
            },
            distribution: [
              { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${canonical}.json` },
              { "@type": "DataDownload", encodingFormat: "text/markdown", contentUrl: `${canonical}.md` },
            ],
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "mugilu", item: SITE },
              { "@type": "ListItem", position: 2, name: placeName, item: canonical },
            ],
          },
        ],
      })
    : undefined;
  return shell(
    `${placeName}: ${t("air, heat, rain and warnings right now", lang)} · mugilu`,
    body + PLACE_RECORDER + FRESHEN + (alertsKey ? `<script>${ALERTS_JS}</script>` : ""),
    css,
    { desc, canonical, jsonLd: dataset, ogImage: canonical ? `${canonical}.png` : HOME_OG, lang },
  );
}

/** Short IST stamp, e.g. "14:32 IST · 27 Jun". The time travels on embeds/PNGs. */
const IST_HM = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const IST_DM = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
function istTime(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : `${IST_HM.format(d)} IST · ${IST_DM.format(d)}`;
}

/** A relative-time element: the worker renders the absolute IST time (the no-JS /
 *  crawler fallback); the shell script upgrades it to "X ago" at view-time, so a
 *  cached page never shows a stale "N min ago" baked in at render time. */
function relTime(iso: string): string {
  return `<time data-rel datetime="${iso}">${istTime(iso)}</time>`;
}

// The embeddable widget (A "build on it" surface): a compact, self-contained
// conditions card others drop into an <iframe>. The whole card links back to the
// full page (attribution + traffic). A collapsed "Embed this" block carries the
// snippet, hidden by a one-liner when the widget is itself being framed.
const EMBED_CSS = `
*{box-sizing:border-box}html,body{margin:0}
:root{--sky:#0284c7;--ink:#0f172a;--muted:#64748b;--bg:#f8fafc;--card:#fff;--line:#e2e8f0;--serif:Georgia,'Iowan Old Style','Palatino Linotype',Palatino,Cambria,serif;--sans:ui-sans-serif,-apple-system,system-ui,sans-serif}
@media(prefers-color-scheme:dark){:root{--ink:#e2e8f0;--muted:#94a3b8;--bg:#0b1220;--card:#111827;--line:#1f2937}}
body{font:14px/1.5 var(--sans);color:var(--ink);background:transparent;${safePad("8px", "8px")}}
.card{display:block;text-decoration:none;color:var(--ink);background:linear-gradient(160deg,color-mix(in srgb,var(--tint) var(--tk),var(--card)),var(--card) 72%);border:1px solid color-mix(in srgb,var(--cond) 30%,var(--line));border-radius:16px;padding:16px 18px;max-width:460px;margin:0 auto}
.etop{display:flex;justify-content:space-between;align-items:center;margin:0 0 .6rem}
.eplace{font-weight:700;font-size:1.05rem;letter-spacing:-.01em}
.ebrand{color:var(--muted);font-size:.8rem;font-weight:600;display:flex;align-items:center;gap:.3rem}
.ebrand svg{width:15px;height:15px;vertical-align:-2px}
.eamb{display:flex;align-items:center;gap:.5rem;font-family:var(--serif);font-size:1.35rem;font-weight:600;letter-spacing:-.01em;color:var(--cond);margin:0 0 .15rem}
.eamb .dot{width:10px;height:10px;border-radius:50%;background:var(--cond);flex:none}
.esay{color:var(--ink);font-size:.92rem;margin:0 0 .85rem}
.eact{color:var(--ink);font-size:.85rem;font-weight:600;margin:-.45rem 0 .85rem}
.ereads{display:flex;gap:18px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:.75rem}
.eread{display:flex;flex-direction:column}
.eread b{font-size:1.2rem;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.eread span{font-size:.66rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.efoot{display:flex;justify-content:space-between;color:var(--muted);font-size:.74rem;margin:.85rem 0 0}
.edisc{color:var(--muted);font-size:.68rem;margin:.3rem 0 0}
.ecode{max-width:460px;margin:14px auto 0;font-size:.82rem;color:var(--muted)}
.ecode summary{cursor:pointer;font-weight:600;color:var(--ink)}
.ecode pre{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px;overflow:auto;font-size:.72rem;white-space:pre-wrap;word-break:break-all}
.framed .ecode{display:none}
`;

// ── Wall-display / kiosk view ──────────────────────────────────────────────
// Full-bleed, glanceable, self-refreshing. `?kiosk` on any /c URL renders this
// instead of the normal page, reusing the same Ambient + layer data. One fluid
// layout (vmin-sized; the one color-mix tint has a plain fallback for older TV browsers) scales 720p to 4K
// in both landscape and portrait. A venue just opens the URL on a screen and
// full-screens it; a corner QR sends passers-by to the same place on their phone.
const KIOSK_CSS = `
html,body{height:100%;overflow:hidden;background:#080d18}
.k{--ink:#e7ecf3;--muted:#8b97a8;--line:#1c2740;--bg:#080d18;position:fixed;inset:0;display:flex;flex-direction:column;gap:2.4vmin;${safePad("4.4vmin", "4.8vmin")};color:#e7ecf3;font-family:var(--sans),system-ui,sans-serif}
.k::before{content:"";position:absolute;inset:0;background:radial-gradient(130% 110% at 100% 0%,var(--tint),transparent 64%);opacity:.3;pointer-events:none}
@supports (color:color-mix(in srgb,red,blue)){.k::before{background:radial-gradient(130% 110% at 100% 0%,color-mix(in srgb,var(--tint) calc(var(--tk) * 1.6),transparent),transparent 64%);opacity:1}}
.k>*{position:relative;z-index:1}
.ktop{display:flex;justify-content:space-between;align-items:flex-start;gap:3vmin}
.kname{display:block;font-family:var(--serif),Georgia,serif;font-weight:700;font-size:6.2vmin;line-height:1.02}
.kcoord{display:block;margin-top:.7vmin;font-size:2.1vmin;letter-spacing:.06em;color:#7c899c}
.kclock{text-align:right;flex:none}
.kclock #clk{display:block;font-size:5.4vmin;font-weight:700;line-height:1}
.kago{display:block;margin-top:.7vmin;font-size:2.1vmin;color:#7c899c}
.kwarn{display:flex;align-items:center;gap:1.4vmin;padding:1.6vmin 2.2vmin;border-radius:1.4vmin;background:#3a0f12;color:#fecaca;font-size:2.6vmin;font-weight:600}
.kwarn svg{width:3.2vmin;height:3.2vmin;flex:none}
.kamb{flex:1;display:flex;flex-direction:column;justify-content:center;min-height:0;overflow:hidden}
.keye{display:flex;align-items:center;gap:1.2vmin;font-size:2.4vmin;letter-spacing:.12em;text-transform:uppercase;color:#8b97a8}
.keye svg{width:3vmin;height:3vmin}
.khead{font-family:var(--serif),Georgia,serif;font-weight:700;font-size:12vmin;line-height:1;letter-spacing:-.01em;margin:1.1vmin 0 .9vmin}
.khead .b{color:var(--cond)}
.ksay{font-size:4.2vmin;line-height:1.2;color:#cfd7e2;max-width:42ch}
.kact{font-size:2.8vmin;font-weight:600;line-height:1.25;margin-top:1.2vmin;max-width:60ch}
.kamb:has(.kact) .ksay{font-size:3.4vmin}
.kbody{flex:1;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:4vmin;min-height:0}
.ktiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.8vmin;align-content:center;min-height:0}
.kt{display:flex;flex-direction:column;gap:.4vmin;padding:1.8vmin 2.2vmin;border-radius:1.6vmin;background:rgba(15,22,38,.82);border:.3vmin solid #1c2740;min-width:0}
.kquiet{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:.6vmin 3vmin;margin:.4vmin .4vmin 0;font-size:2.2vmin;color:#8b97a8}
.kquiet b{color:#cfd7e2;font-weight:600}
.knorm{margin-top:2vmin;max-width:46vmin}
.kt.on{border-color:var(--cond)}
.kt.on .kt-n{color:var(--cond)}
.kt-l{font-size:2vmin;letter-spacing:.1em;text-transform:uppercase;color:#8b97a8}
.kt-n{font-size:6.2vmin;font-weight:700;line-height:1}
.kt-w{font-size:2.2vmin;color:#aeb9c8}
.kt-w .qa{font-size:1.7vmin;letter-spacing:.08em;text-transform:uppercase;color:#8b97a8}
.kt-w .qa.nu{text-transform:none;letter-spacing:.02em}
.kfoot{display:flex;justify-content:space-between;align-items:flex-end;gap:2vmin}
.kbrand{font-size:3vmin;font-weight:700;color:#38bdf8}
.kdisc{font-size:1.7vmin;color:#8b97a8;margin-top:.5vmin}
.kqr{display:flex;align-items:center;gap:1.6vmin}
.kqr svg{width:11vmin;height:11vmin;background:#fff;border-radius:1vmin;padding:.7vmin}
.kqrl{font-size:1.9vmin;line-height:1.2;color:#8b97a8;text-align:right}
@media (orientation:portrait){
  .k{gap:2.6vmin;${safePad("5.5vmin", "5vmin")}}
  .kname{font-size:7vmin}.kclock #clk{font-size:6vmin}
  .khead{font-size:10vmin}.ksay{font-size:4.6vmin;max-width:24ch}
  .kbody{grid-template-columns:minmax(0,1fr);gap:2.6vmin}.ktiles{gap:1.6vmin}.kt{padding:1.8vmin 2vmin}.kt-n{font-size:6vmin}
  .kqr svg{width:15vmin;height:15vmin}
}
@media (orientation:portrait) and (min-aspect-ratio:2/3){
  .kt{padding:1.3vmin 1.7vmin}.kt-n{font-size:4.6vmin}.ktiles{gap:1.3vmin}
  .kqr svg{width:12vmin;height:12vmin}
}
.kload{position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3vmin;background:rgba(8,13,24,.5);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);opacity:0;transition:opacity .4s ease;pointer-events:none}
.kload.on{opacity:1}
.kspin{width:7vmin;height:7vmin;border:.7vmin solid rgba(148,163,184,.25);border-top-color:#7dd3fc;border-radius:50%;animation:kspin 1s linear infinite}
.kverb{font-size:3.2vmin;color:#cbd5e1;letter-spacing:.01em}
@keyframes kspin{to{transform:rotate(360deg)}}`;

/** The layer graphics (GLYPH_CSS) scaled for a screen read from across a room. */
const KIOSK_GLYPH_CSS = `
.k .g{height:1vmin;max-width:none;margin:1vmin 0 .3vmin}
.k .g .gt{top:-.5vmin;bottom:-.5vmin}
.k .g .gm{width:1.8vmin;height:1.8vmin}
.k .gl{font-size:1.9vmin;margin-top:.8vmin}
.k .prk{font-size:1.6vmin}
.k .uv{max-width:none;gap:.4vmin;margin-top:1vmin}.k .uv i{height:1.8vmin}
.k .prs{max-width:none;margin-top:1vmin}.k .pr{font-size:2vmin;grid-template-columns:8vmin 1fr 6vmin}.k .pt{height:1.2vmin}
.k .wrow{max-width:none}.k .cmp{width:7vmin;height:7vmin}
.k .drops{width:100%;height:auto;margin-top:1vmin}
.k .sub{display:none}`;

/** The loading verbs the kiosk cycles through while it refreshes. */
const KIOSK_VERBS = [
  "Reading the sky",
  "Checking the air",
  "Gauging the heat",
  "Watching for warnings",
  "Catching the wind",
  "Looking up",
];

/** The kiosk's script, with its words in the page's language (X is the number). */
const kioskJs = (lang: Lang) => {
  const s = (en: string) => JSON.stringify(t(en, lang)).replace(/</g, "\\u003c");
  return `(function(){
var clkI,agoI,refT,vbT,n=0;
var verbs=[${KIOSK_VERBS.map(s).join(",")}];
var W={now:${s("just now")},min:${s("X min ago")},h:${s("X hours ago")},d:${s("X days ago")}};
function ago(){var a=document.getElementById('ago');if(!a)return;var t=a.getAttribute('data-t');if(!t)return;var s=Math.max(0,(Date.now()-new Date(t).getTime())/1000);a.textContent=s<90?W.now:(s<3600?W.min.replace('X',Math.round(s/60)):s<86400?W.h.replace('X',Math.round(s/3600)):W.d.replace('X',Math.round(s/86400)));}
function p(x){return x<10?'0'+x:''+x}
function clock(){var c=document.getElementById('clk');if(c){var d=new Date();c.textContent=p(d.getHours())+':'+p(d.getMinutes());}}
function fit(){var amb=document.querySelector('.kamb'),hd=amb&&amb.querySelector('.khead');if(!amb||!hd)return;hd.style.fontSize='';var s=parseFloat(getComputedStyle(hd).fontSize),g=0;while(amb.scrollHeight>amb.clientHeight+1&&s>24&&g++<40){s-=4;hd.style.fontSize=s+'px';}}
var load=document.querySelector('.kload'),vb=load&&load.querySelector('.kverb');
function showLoad(){if(!load)return;var i=0;(function nx(){if(vb)vb.textContent=verbs[i++%verbs.length]+'…';vbT=setTimeout(nx,1500);})();load.classList.add('on');}
function hideLoad(){if(!load)return;load.classList.remove('on');clearTimeout(vbT);}
function refresh(){showLoad();if(++n%20===0){setTimeout(function(){location.reload();},500);return;}fetch(location.href,{cache:'no-store'}).then(function(r){return r.ok?r.text():Promise.reject();}).then(function(h){var d=new DOMParser().parseFromString(h,'text/html'),nk=d.querySelector('.k'),ck=document.querySelector('.k');if(!nk||!ck)throw 0;ck.parentNode.replaceChild(document.importNode(nk,true),ck);setTimeout(hideLoad,200);start();}).catch(function(){hideLoad();refT=setTimeout(refresh,60000);});}
function start(){clearInterval(clkI);clearInterval(agoI);clearTimeout(refT);clock();ago();fit();clkI=setInterval(clock,15000);agoI=setInterval(ago,30000);refT=setTimeout(refresh,840000);}
function lock(){try{if('wakeLock'in navigator)navigator.wakeLock.request('screen').catch(function(){});}catch(e){}}
lock();document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')lock();});
window.addEventListener('resize',fit);setTimeout(fit,300);
start();
})();`;
};

export function renderKioskPage(
  c: Conditions,
  persona: Persona,
  canonical: string,
  qr: string,
  lang: Lang = "en",
): string {
  const risk = ambientRisk(c, persona);
  const say = ambientSummary(risk, (en) => t(en, lang));
  const slug = `${c.location.lat},${c.location.lon}`;
  const placeName = placeLabel(c); // raw: shell() escapes the title
  const place = esc(placeName);
  const head = headHtml(risk, lang);

  // Up to four tiles in the order the readings matter now, each with its graphic;
  // every other reading in one quiet line (label and value only).
  const layers = orderByRisk(layerData(c, risk, lang), risk, c);
  const shown = layers.slice(0, 4);
  const tiles = shown.map(
    (d) =>
      `<div class="kt${isDriver(d.key, risk) ? " on" : ""}" data-k="${d.key}"><span class="kt-l">${d.label}</span><span class="kt-n">${d.num}</span><span class="kt-w">${d.q}</span>${d.mini ?? d.bar}</div>`,
  );
  const rest = briefs(c, risk).filter((b) => !shown.some((d) => d.key === b.key));
  const quietLine = rest.length
    ? `<p class="kquiet">${rest.map((b) => `<span>${t(b.label, lang)} <b>${esc(b.value)}</b></span>`).join("")}</p>`
    : "";
  const normal = layers.find((d) => d.key === "heat")?.normal;

  const w0 = c.warnings?.[0];
  const warn = w0
    ? `<div class="kwarn">${icon("warn")}<span><b>${esc(w0.event)}</b>${w0.until ? ` · ${t("until X", lang).replace("X", esc(w0.until))}` : ""} · ${esc(w0.issuer)}${c.warnings!.length > 1 ? ` · ${t("+X more", lang).replace("X", String(c.warnings!.length - 1))}` : ""}</span></div>`
    : "";

  const body = `
  <div class="k" style="${readVars(risk)}">
    <header class="ktop">
      <div><span class="kname">${place}</span><span class="kcoord">${c.location.lat}°N&nbsp;&nbsp;${c.location.lon}°E</span></div>
      <div class="kclock"><span id="clk">--:--</span><span class="kago">${t("updated", lang)} <span id="ago" data-t="${c.as_of}">${t("just now", lang)}</span></span></div>
    </header>
    ${warn}
    <div class="kbody">
      <main class="kamb">
        <p class="keye">${icon(DRIVER_KEY[risk.driver] ?? "clear")}<span>Ambient · ${esc(t(PERSONA_LABEL[risk.persona], lang))}</span></p>
        <p class="khead">${head}</p>
        <p class="ksay">${esc(say.meaning)}</p>
        ${say.action ? `<p class="kact">${esc(say.action)}</p>` : ""}
        ${normal ? `<div class="knorm">${normal}</div>` : ""}
      </main>
      <section class="ktiles">${tiles.join("")}${quietLine}</section>
    </div>
    <footer class="kfoot">
      <div><span class="kbrand">mugilu.live</span><p class="kdisc">${esc(t(SHORT_DISCLAIMER, lang))}</p></div>
      <div class="kqr">${qr}<span class="kqrl">${lang === "en" ? "scan to see this<br>on your phone" : t("scan to see this on your phone", lang)}</span></div>
    </footer>
  </div>
  <div class="kload" aria-hidden="true"><div class="kspin"></div><p class="kverb">${t(KIOSK_VERBS[0], lang)}…</p></div>
  <script>${kioskJs(lang)}</script>`;

  const css = KIOSK_CSS + GLYPH_CSS + KIOSK_GLYPH_CSS;
  const desc = `${c.place ?? slug}: a live wall-display of the whole sky over this spot, self-refreshing.`;
  // noBeacon: a kiosk is one persistent display auto-reloading every ~14 min; it would
  // inflate visitor counts and skew Core Web Vitals, so keep the RUM beacon off here.
  return shell(`${placeName} on a screen: mugilu`, body, css, {
    desc,
    canonical,
    ogImage: `${canonical}.png`,
    noBeacon: true,
    lang,
    bare: true,
  });
}

const DISPLAY_CSS = `
.dpers{display:flex;flex-wrap:wrap;gap:.5rem;margin:.1rem 0 .2rem}
.dpers a{padding:.34rem .8rem;border:1px solid var(--line);border-radius:999px;color:var(--muted);text-decoration:none;font-size:.92rem}
.dpers a.on{border-color:var(--ink);color:var(--ink);font-weight:600}
.dsearch{display:flex;gap:.5rem;margin:.2rem 0 .7rem;flex-wrap:wrap}
.dsearch input[name=q]{flex:1;min-width:12rem;padding:.6rem .8rem;border:1px solid var(--line);border-radius:.6rem;background:var(--card);color:var(--ink);font-size:1rem}
.dsearch button{padding:.6rem 1.1rem;border:0;border-radius:.6rem;background:var(--ink);color:var(--bg);font-weight:600;font-size:1rem;cursor:pointer}
.dgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(8rem,1fr));gap:.55rem;margin:.1rem 0 .3rem}
.dtile{padding:.7rem .9rem;border:1px solid var(--line);border-radius:.6rem;background:var(--card);color:var(--ink);text-decoration:none;font-weight:600;text-align:center}
.dtile:hover{border-color:var(--ink)}
.dhow{margin:.1rem 0 .5rem 1.1rem}.dhow li{margin:.35rem 0;line-height:1.5}
.dprev{position:relative;aspect-ratio:16/9;max-width:100%;overflow:hidden;border-radius:12px;border:1px solid var(--line);background:#080d18;margin:.4rem 0 1.4rem}
.dprev iframe{position:absolute;top:0;left:0;width:1280px;height:720px;border:0;transform-origin:0 0;pointer-events:none}`;

// The "put it on a screen" builder: pick a place (+ who it's for), open the
// self-refreshing kiosk view. Search routes through /go?kiosk=1 (zero JS).
export function renderDisplayBuilder(persona: Persona = "everyone", lang: Lang = "en"): string {
  const popular: [string, string][] = [
    ["bengaluru", "Bengaluru"],
    ["delhi", "Delhi"],
    ["mumbai", "Mumbai"],
    ["chennai", "Chennai"],
    ["kolkata", "Kolkata"],
    ["hyderabad", "Hyderabad"],
    ["pune", "Pune"],
    ["ahmedabad", "Ahmedabad"],
    ["lucknow", "Lucknow"],
    ["jaipur", "Jaipur"],
    ["patna", "Patna"],
    ["guwahati", "Guwahati"],
  ];
  const asQ = persona !== "everyone" ? `&as=${persona}` : "";
  const pills = personaLinks((p) => lp(p === "everyone" ? "/display" : `/display?as=${p}`, lang), persona, lang);
  const tiles = popular
    .map(([s, n]) => `<a class="dtile" href="${lp(`/c/${s}?kiosk${asQ}`, lang)}">${esc(n)}</a>`)
    .join("");
  const heading = lang === "en" ? "Put mugilu<br>on a screen." : t("Put mugilu on a screen.", lang);
  const step4 =
    lang === "en"
      ? "For an always-on unattended screen, point a kiosk-browser app (for example Fully Kiosk on Android) at the same link so it auto-starts."
      : t("For an always-on unattended screen, point a kiosk-browser app at the same link so it auto-starts.", lang);
  const body = `
  <article class="ax">
    <h1 class="ahero">${heading}</h1>
    <p class="alead">${t("Turn any display into a live, self-updating read of the sky. Pick a place, open it on the screen, press full-screen. It refreshes itself, and a corner QR sends passers-by to the same place on their phone.", lang)}</p>

    <div class="dprev" aria-hidden="true"><iframe src="${esc(lp(`/c/bengaluru?kiosk${asQ}`, lang))}" title="${esc(t("Put mugilu on a screen.", lang))}" tabindex="-1" loading="lazy"></iframe></div>

    <p class="ah">${icon("users")}<span>${t("Weight it for who is nearby", lang)}</span></p>
    <nav class="dpers" aria-label="Persona">${pills}</nav>

    <p class="ah">${icon("pin")}<span>${t("Pick a place", lang)}</span></p>
    <div class="acwrap">
    <form class="dsearch" action="${lp("/go", lang)}" method="get">
      <input type="hidden" name="kiosk" value="1">
      ${persona !== "everyone" ? `<input type="hidden" name="as" value="${persona}">` : ""}
      <input id="dq" name="q" placeholder="${esc(t("Any place in India", lang))}" autocomplete="off" autocapitalize="off" aria-label="${esc(t("Any place in India", lang))}">
      <button type="submit">${t("Open display", lang)}</button>
    </form>
    <ul id="dac" class="ac" role="listbox"></ul>
    </div>
    <div class="dgrid">${tiles}</div>

    <p class="ah">${icon("layers")}<span>${t("How it runs", lang)}</span></p>
    <ol class="dhow">
      <li>${t("Open the display link in the screen's browser: a smart TV, a cheap streaming stick, or an old tablet in a stand.", lang)}</li>
      <li>${t("Press full-screen (F11 with a keyboard, or the browser's full-screen control).", lang)}</li>
      <li>${t("Leave it. It refreshes on its own, keeps the screen awake, and if the network blips it holds the last reading and recovers.", lang)}</li>
      <li>${step4}</li>
    </ol>
    <p class="abuild">The display link is just <b>/c/{place}?kiosk</b>, so you can bookmark or script it. Add <b>?as=elderly</b> (or asthma, child, outdoor, heart) to weight the read for a clinic, school or worksite.</p>
    <p class="aback"><a href="${lp("/", lang)}">← ${t("back to mugilu", lang)}</a></p>
  </article>
  <script>var LP=${JSON.stringify(lang === "en" ? "" : "/" + lang)};${typeaheadJs("dq", "dac", `'?kiosk'+${JSON.stringify(asQ)}`)}
  (function(){var b=document.querySelector('.dprev'),f=b&&b.querySelector('iframe');if(!f)return;function fit(){f.style.transform='scale('+b.clientWidth/1280+')';}fit();addEventListener('resize',fit);})();</script>`;
  return shell("Put mugilu on a screen: mugilu", body, ABOUT_CSS + DISPLAY_CSS + AC_CSS, {
    desc: "Turn any wall display or kiosk into a live, self-refreshing read of India's sky. Pick a place, open it on the screen, full-screen it. It updates itself.",
    canonical: `${SITE}/display`,
    ogImage: HOME_OG,
    lang,
  });
}

export function renderEmbed(c: Conditions, persona: Persona, siteUrl: string, lang: Lang = "en"): string {
  const risk = ambientRisk(c, persona);
  const say = ambientSummary(risk, (en) => t(en, lang));
  const slug = `${c.location.lat},${c.location.lon}`;
  const place = esc(placeLabel(c));
  const h = headline(risk, (en) => t(en, lang));
  const head = h.noun ? `${h.word} ${h.noun}` : h.word;

  // The card's readings, each in its own words, in the order every surface uses.
  const read: Record<string, string> = {};
  if (c.air?.aqi != null)
    read.air = `<div class="eread"><b style="color:${BAND_COLOR[c.air.band] ?? BAND_COLOR.unknown}">${c.air.aqi}</b><span>AQI ${t(AQI_BAND_LABEL[c.air.band] ?? "", lang)}</span></div>`;
  if (c.heat?.apparent_c != null)
    read.heat = `<div class="eread"><b>${round(c.heat.apparent_c)}°</b><span>${t("feels like", lang)}</span></div>`;
  if (c.uv?.index != null)
    read.sun = `<div class="eread"><b>${Math.round(c.uv.index)}</b><span>UV ${t(uvWord(c.uv.index), lang)}</span></div>`;
  if (c.dust?.dust_ug_m3 != null)
    read.dust = `<div class="eread"><b>${Math.round(c.dust.dust_ug_m3)}</b><span>${t("dust", lang)} ${t(dustBand(c.dust.dust_ug_m3), lang)}</span></div>`;
  if (c.smoke && smokeLevel(c.smoke) != null)
    read.smoke = `<div class="eread"><b>${c.smoke.count}</b><span>${t("fires within 100 km", lang)}</span></div>`;
  const reads = briefs(c, risk)
    .map((b) => read[b.key])
    .filter(Boolean);

  const iframe = `<iframe src="${siteUrl}/embed/${slug}" width="480" height="240" style="border:0;border-radius:16px" title="mugilu: conditions at ${place}" loading="lazy"></iframe>`;
  const imgtag = `<img src="${siteUrl}/c/${slug}.png" alt="mugilu: conditions at ${place}" width="600">`;

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">${VIEWPORT}<meta name="color-scheme" content="light dark"><title>${place}: mugilu</title><style>${EMBED_CSS}\n:root{${readVars(risk)}}</style></head><body>
  <a class="card" href="${siteUrl}/c/${slug}" target="_blank" rel="noopener">
    <div class="etop"><span class="eplace">${place}</span><span class="ebrand">${CLOUD} mugilu</span></div>
    <div class="eamb"><i class="dot"></i>${esc(head)}</div>
    <div class="esay">${esc(say.meaning)}</div>
    ${say.action ? `<div class="eact">${esc(say.action)}</div>` : ""}
    <div class="ereads">${reads.join("")}</div>
    <div class="efoot"><span>${t("as of X", lang).replace("X", esc(istTime(c.as_of)))}</span><span>mugilu.live →</span></div>
    <div class="edisc">${esc(t(SHORT_DISCLAIMER, lang))}</div>
  </a>
  <details class="ecode"><summary>${t("Embed this", lang)}</summary>
    <p>${t("Live widget (iframe):", lang)}</p><pre>${esc(iframe)}</pre>
    <p>${t("Or an image with the time on it:", lang)}</p><pre>${esc(imgtag)}</pre>
  </details>
  <script>if(window.self!==window.top)document.documentElement.classList.add('framed')</script>
  </body></html>`;
}

// Shared chrome for the long-form pages (about, terms, 404): editorial serif
// headlines + a calm sky-tinted backdrop, matching the /c language. Keeps the
// .alead2/.amuted/.alist classes /terms still uses.
const ABOUT_CSS = `
body{background:linear-gradient(180deg,color-mix(in srgb,var(--sky) 13%,var(--bg)),var(--bg) 42%) var(--bg) no-repeat}
.ahero{font-family:var(--serif);font-weight:600;font-size:clamp(2.1rem,8.5vw,3rem);line-height:1.05;letter-spacing:-.02em;margin:1.3rem 0 .6rem}
.alead{font-family:var(--serif);font-size:1.22rem;line-height:1.42;margin:0 0 .4rem;max-width:34ch}
.alead2{line-height:1.55;margin:0 0 1rem}.alead2 a{color:var(--sky)}
.ah{display:flex;align-items:center;gap:.45rem;font:600 .76rem/1 var(--sans);letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin:2.1rem 0 .7rem}
.ah .ic{width:15px;height:15px;color:var(--sky);flex:none}
.atext{font-size:1.04rem;line-height:1.62;margin:0 0 .9rem}.atext a{color:var(--sky)}.atext b{font-weight:700}
.abuild{font-size:.96rem;line-height:1.55;color:var(--muted);border-left:3px solid color-mix(in srgb,var(--sky) 45%,var(--line));padding:.15rem 0 .15rem 1rem;margin:.2rem 0 .9rem}
.amuted{color:var(--muted);margin:0 0 .6rem}
.alist{list-style:none;margin:0 0 1rem;padding:0}
.alist li{display:flex;gap:11px;align-items:flex-start;padding:7px 0;line-height:1.45}
.alist li .ic{margin-top:2px;color:var(--sky);flex:none}
.alist li .t{flex:1;min-width:0}
.alist.on{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:4px 14px}
.builtby{display:flex;gap:15px;align-items:center;margin:2.3rem 0 0}
.builtby>a{flex:none}.builtby img{border-radius:10px;display:block}
.bb-by{margin:0 0 .6rem;font-size:1rem}.bb-by a{color:var(--sky)}
.builtby .star{display:inline-flex;align-items:center;gap:.45rem;border:1px solid var(--line);border-radius:999px;padding:6px 13px;color:var(--ink);font-weight:600;text-decoration:none;font-size:.84rem}
.builtby .star:hover{border-color:var(--muted);background:color-mix(in srgb,var(--ink) 5%,transparent)}
.builtby .star svg{width:15px;height:15px}
.adisc{color:var(--muted);font-size:.82rem;line-height:1.5;border-top:1px solid var(--hair);padding-top:1.1rem;margin-top:2.3rem}
.aback{margin:1.3rem 0 0}.aback a{color:var(--sky);text-decoration:none;font-weight:600;font-family:var(--mono);font-size:.85rem;letter-spacing:.02em}
`;

/** The About page: the origin story + the dual nature (for people, and as
 *  infrastructure). Person-first, jargon-free. The "Build on it" section is a
 *  stub that grows as the API / MCP land. */
// The hand-written source credits on /about (its FAQ and "where it comes from"): translated
// prose, so not built from sources.ts SOURCES, but a test fails if either leaves one out.
export const SOURCES_FAQ =
  "Air from CPCB, Airnet (CSTEP), Aurassure and Google AirView+ via the Open Air Quality (OAQ) broker; weather, heat, UV and dust from Open-Meteo, and the 1991-2020 heat normals from ERA5 reanalysis (Copernicus) via Open-Meteo; official warnings from NDMA and IMD via SACHET; fire smoke from NASA FIRMS; cyclone tracks from JTWC; place search from OpenStreetMap and GeoNames, and boundaries from bharatlas; years of life lost from the AQLI method. Each source keeps its own licence, and mugilu credits all of them.";
export const SOURCES_ABOUT =
  "mugilu owns no sensors and runs no forecasts. It stands on others' work and credits them: CPCB, Airnet, Aurassure and Google AirView+ (via the OAQ broker) for air, Open-Meteo for weather, ERA5 reanalysis (Copernicus) for the heat normals, NDMA and IMD (via SACHET) for warnings, NASA FIRMS for fire smoke, JTWC for cyclone tracks, OpenStreetMap, GeoNames and bharatlas for places and the map of India, and the AQLI method for years of life lost. The code is open under the MIT licence; the data keeps each source's own terms.";

/** English prose with each source name from SOURCES in bold. */
const boldSourceNames = (text: string) =>
  SOURCES.flatMap((s) => s.names).reduce((out, n) => out.split(n).join(`<b>${n}</b>`), esc(text));

export function renderAbout(lang: Lang = "en"): string {
  // Q&A that ALSO ships as FAQPage structured data (answer-engine + SERP pickup);
  // the visible copy below and the schema are generated from this one list.
  const faqs = [
    {
      q: "Is it safe to go outside right now?",
      a: "mugilu names the single worst hazard over your exact location and says plainly what to do, weighted for who you are: asthma, older adults, children, outdoor workers, or a heart condition. It is informational, not medical or safety advice; for official warnings, consult NDMA and IMD.",
    },
    {
      q: "What is wet-bulb temperature, and why does mugilu show it?",
      a: "Wet-bulb is the temperature a wet thermometer settles at: it folds heat and humidity into the one number that decides whether your body can still cool itself. Above about 32°C wet-bulb, even resting in shade turns dangerous. Ordinary feels-like numbers hide this, so mugilu surfaces it.",
    },
    {
      q: "Where does mugilu's data come from?",
      a: SOURCES_FAQ,
    },
    {
      q: "Is mugilu free?",
      a: "Yes. It is free, open source (MIT) and non-commercial, with no sign-up. Every reading is also available as JSON, Markdown, an embeddable card, an OpenAPI spec, and an MCP server for AI agents.",
    },
    {
      q: "How current are the readings?",
      a: "Air refreshes hourly, the national heat, rain, UV and dust grid every few hours, and official warnings hourly. Every reading is timestamped with how long ago it was measured.",
    },
  ];
  // Prose: English keeps its inline markup; hi/kn render the reviewed translated text
  // (proper nouns already Latin). Precomputed to avoid nested template literals.
  const heroH1 =
    lang === "en"
      ? "The open sky of India,<br>one coordinate at a time."
      : t("The open sky of India, one coordinate at a time.", lang);
  const sathya =
    lang === "en"
      ? `<a href="https://www.sathyasankaran.com">Sathya Sankaran</a> wanted to stop starting from scratch each time: to pull the whole sky together into one view, every hazard over any point in India, and then hand that out as infrastructure, so the next map, story or alert doesn't have to begin from nothing.`
      : t(
          "Sathya Sankaran wanted to stop starting from scratch each time: to pull the whole sky together into one view, every hazard over any point in India, and then hand that out as infrastructure, so the next map, story or alert doesn't have to begin from nothing.",
          lang,
        );
  const refPara =
    lang === "en"
      ? `Add <b>?ref=your-app</b> to any API or embed URL to identify your app (aggregate, domain-level). It's all free and keyless.`
      : t(
          "Add ?ref=your-app to any API or embed URL to identify your app (aggregate, domain-level). It's all free and keyless.",
          lang,
        );
  const wherePara = lang === "en" ? boldSourceNames(SOURCES_ABOUT) : t(SOURCES_ABOUT, lang);
  const freePara =
    lang === "en"
      ? `The sky over you is a commons. Knowing it shouldn't cost money or sit locked inside someone's app. mugilu is <b>non-commercial, for good</b>, the third in a small set of public tools alongside <a href="https://bharatlas.com">bharatlas</a> and <a href="https://mdshare.live">mdshare</a>.`
      : t(
          "The sky over you is a commons. Knowing it shouldn't cost money or sit locked inside someone's app. mugilu is non-commercial, for good, the third in a small set of public tools alongside bharatlas and mdshare.",
          lang,
        );
  const builtBy =
    lang === "en"
      ? `Built by <a href="https://urbanmorph.com">urbanmorph</a>, led by <a href="https://www.sathyasankaran.com">Sathya Sankaran</a>.`
      : t("Built by urbanmorph, led by Sathya Sankaran.", lang);
  // Descriptive link texts in the "Build on it" list (format tokens like JSON/Markdown
  // stay Latin; these two are prose, so they localise).
  const aboutOpenapi = lang === "en" ? "OpenAPI spec" : t("OpenAPI spec", lang);
  const aboutSnapshot = lang === "en" ? "snapshot image" : t("snapshot image", lang);
  const body = `
  <article class="ax">
  <h1 class="ahero">${heroH1}</h1>
  <p class="alead">${t("A whole-sky view for people, and shared infrastructure for anyone building on top of it.", lang)}</p>

  <p class="ah">${icon("compass")}<span>${t("Why mugilu", lang)}</span></p>
  <p class="atext">${t("For years, people across India have made the sky legible one piece at a time: a map of one city's air, a thread about a heatwave, a chart of last year's monsoon. Brilliant work, but scattered, and easy to lose by the next season.", lang)}</p>
  <p class="atext">${sathya}</p>
  <p class="atext">${t("That is mugilu.", lang)}</p>
  <p class="atext amuted">${t("mugilu is the Kannada word for the open sky.", lang)}</p>

  <p class="ah">${icon("users")}<span>${t("For people", lang)}</span></p>
  <p class="atext">${t("Type a place. See what the sky is doing to you right now: air, heat (and how survivable it really is), rain, sun and dust, alongside any official warning over that spot. Then one plain line, the single worst thing for you, whether you have asthma, work outdoors, or are minding a child or an older parent. No sign-up, no jargon.", lang)}</p>

  <p class="ah" id="build">${icon("code")}<span>${t("Build on it", lang)}</span></p>
  <p class="atext">${t("mugilu is meant to be built on, not just looked at. Every reading is also open, machine-readable data, so you can put the whole sky behind your own map, story, dashboard or alert, and spend your time on the part that matters: the telling, and the action.", lang)}</p>
  <ul class="alist">
    <li>${icon("code")}<span class="t"><b>${t("For AI agents", lang)}</b>: ${t("an MCP server at {mcp} (tools for conditions, place search, nearest stations, warnings and the national picture; plus resources and prompts). Listed in {llms}.", lang).replace("{mcp}", `<a href="/mcp">/mcp</a>`).replace("{llms}", `<a href="/llms.txt">llms.txt</a>`)}</span></li>
    <li>${icon("layers")}<span class="t"><b>${t("For developers", lang)}</b>: ${t("a documented {openapi}, and every reading as {json} or {md}.", lang).replace("{openapi}", `<a href="/openapi.json">${aboutOpenapi}</a>`).replace("{json}", `<a href="/c/12.97,77.59.json">JSON</a>`).replace("{md}", `<a href="/c/12.97,77.59.md">Markdown</a>`)}</span></li>
    <li>${icon("pin")}<span class="t"><b>${t("Embed it", lang)}</b>: ${t("a live card in one line of HTML ({embed}), or a {png}.", lang).replace("{embed}", `<a href="/embed/12.97,77.59">/embed/{lat},{lon}</a>`).replace("{png}", `<a href="/c/12.97,77.59.png">${aboutSnapshot}</a>`)}</span></li>
    <li>${icon("sun")}<span class="t"><b>${t("Put it on a screen", lang)}</b>: ${t("a self-refreshing wall display or kiosk for a clinic, school or lobby, set up at {display}.", lang).replace("{display}", `<a href="/display">/display</a>`)}</span></li>
  </ul>
  <p class="abuild">${refPara}</p>

  <p class="ah">${icon("layers")}<span>${t("Where it comes from", lang)}</span></p>
  <p class="atext">${wherePara}</p>

  <p class="ah">${icon("heart")}<span>${t("Why it's free", lang)}</span></p>
  <p class="atext">${freePara}</p>

  <p class="ah">${icon("compass")}<span>${t("Common questions", lang)}</span></p>
  ${faqs.map((f) => `<p class="atext"><b>${t(f.q, lang)}</b><br>${t(f.a, lang)}</p>`).join("\n  ")}

  <div class="builtby">
    <a href="https://urbanmorph.com" aria-label="Urban Morph"><img src="${UM_ICON}" alt="Urban Morph" width="54" height="60"></a>
    <div>
      <p class="bb-by">${builtBy}</p>
      <a class="star" href="https://github.com/urbanmorph/mugilu">${GH_MARK} ${t("Source on GitHub, drop a star if it's useful", lang)}</a>
    </div>
  </div>

  <p class="adisc">${t("Informational only, not for medical, emergency, or safety-critical decisions. For official warnings, consult NDMA and IMD.", lang)}</p>
  <p class="aback"><a href="${lp("/", lang)}">← ${t("back to mugilu", lang)}</a></p>
  </article>`;
  return shell(t("About mugilu: the open sky of India", lang), body, ABOUT_CSS, {
    desc: t(
      "mugilu shows the air, heat, rain, sun, dust and official warnings over any point in India right now, and names the single worst hazard for you. About the project, its open data sources, and how to build on it.",
      lang,
    ),
    canonical: `${SITE}/about`,
    jsonLd: ld({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: t(f.q, lang),
        acceptedAnswer: { "@type": "Answer", text: t(f.a, lang) },
      })),
    }),
    ogImage: HOME_OG,
    lang,
  });
}

/** Terms & attribution: the disclaimer in full, plus per-source credit/licence.
 *  The disclaimer that ships in every API response points here. */
export function renderTerms(lang: Lang = "en"): string {
  // Prose: English keeps its inline markup; hi/kn render the translated text (proper
  // nouns/acronyms + source names Latin, source-detail lines kept English like /about's
  // list). Paragraphs with inline links keep {slot}s filled after lookup, word-order-safe.
  const warranty =
    lang === "en"
      ? `<b>Informational and educational only, not for medical, emergency, or safety-critical decisions.</b> Readings are a mix of measured and modelled values and may be wrong, stale, or missing. There is no accuracy or availability guarantee. For official hazard warnings, consult <b>NDMA</b> and <b>IMD</b> directly.`
      : t(
          "Informational and educational only, not for medical, emergency, or safety-critical decisions. Readings are a mix of measured and modelled values and may be wrong, stale, or missing. There is no accuracy or availability guarantee. For official hazard warnings, consult NDMA and IMD directly.",
          lang,
        );
  const repoText = lang === "en" ? "repository" : t("repository", lang);
  const repoLink = `<a href="https://github.com/urbanmorph/mugilu">${repoText}</a>`;
  const licence =
    lang === "en"
      ? `The mugilu <b>code is MIT</b> (see the ${repoLink}). The <b>data is not relicensed</b>: each upstream source keeps its own licence and attribution. mugilu is <b>non-commercial, for individuals</b>, and is not affiliated with any data provider.`
      : t(
          "The mugilu code is MIT (see the {repo}). The data is not relicensed: each upstream source keeps its own licence and attribution. mugilu is non-commercial, for individuals, and is not affiliated with any data provider.",
          lang,
        ).replace("{repo}", repoLink);
  const privacy =
    lang === "en"
      ? `No accounts, no sign-up, no ad networks. Usage counts are first-party and aggregate (rounded coordinates, no IP, no per-person data). For visitor numbers and page performance, mugilu uses <b>Cloudflare Web Analytics</b>, which is cookieless, collects no personal data, and does no cross-site tracking or fingerprinting. Your saved places live only in your own browser.`
      : t(
          "No accounts, no sign-up, no ad networks. Usage counts are first-party and aggregate (rounded coordinates, no IP, no per-person data). For visitor numbers and page performance, mugilu uses Cloudflare Web Analytics, which is cookieless, collects no personal data, and does no cross-site tracking or fingerprinting. Your saved places live only in your own browser.",
          lang,
        );
  const commonsDisc = t("A digital commons by {um}, alongside {bl} and {md}.", lang)
    .replace("{um}", `<a href="https://urbanmorph.com">urbanmorph</a>`)
    .replace("{bl}", `<a href="https://bharatlas.com">bharatlas</a>`)
    .replace("{md}", `<a href="https://mdshare.live">mdshare</a>`);
  const body = `
  <h1 class="ahero">${t("Terms &amp; attribution", lang)}</h1>
  <p class="alead">${t("mugilu stitches together others' open data for any point in India. The stitch and the code are ours; the data is theirs, and stays under their terms.", lang)}</p>

  <h2 class="ah">${t("No warranty", lang)}</h2>
  <p class="amuted">${warranty}</p>

  <h2 class="ah">${t("Licence", lang)}</h2>
  <p class="alead2">${licence}</p>

  <h2 class="ah">${t("Sources &amp; credit", lang)}</h2>
  <ul class="alist on">
    <li>${icon("air")}<span class="t"><b>${t("Air", lang)}</b>: ${t("CPCB (Govt. of India), Airnet (CSTEP), Aurassure, and Google AirView+, via the {oaq} broker.", lang).replace("{oaq}", `<a href="https://oaq.notf.in">OAQ</a>`)}</span></li>
    <li>${icon("heat")}<span class="t"><b>${t("Modelled air, heat, rain, UV, dust, wind", lang)}</b>: ${t("{ometeo}, licensed CC-BY 4.0.", lang).replace("{ometeo}", `<a href="https://open-meteo.com">Open-Meteo</a>`)}</span></li>
    <li>${icon("heat")}<span class="t"><b>${t("Heat compared with normal", lang)}</b>: ${t("1991-2020 normals from {era5} reanalysis (Copernicus Climate Change Service), via Open-Meteo.", lang).replace("{era5}", `<a href="https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels">ERA5</a>`)}</span></li>
    <li>${icon("warn")}<span class="t"><b>${t("Official warnings", lang)}</b>: ${t("NDMA / IMD via SACHET.", lang)}</span></li>
    <li>${icon("smoke")}<span class="t"><b>${t("Fire / crop-burn smoke", lang)}</b>: NASA FIRMS (VIIRS).</span></li>
    <li>${icon("wind")}<span class="t"><b>${t("Cyclone tracks", lang)}</b>: <a href="https://www.metoc.navy.mil/jtwc/jtwc.html">JTWC</a> (US Navy and Air Force).</span></li>
    <li>${icon("pin")}<span class="t"><b>${t("Geography &amp; place names", lang)}</b>: ${t("place search from {osm} contributors (ODbL) and {geonames} (CC-BY 4.0); admin boundaries from {bharatlas}.", lang).replace("{osm}", `<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>`).replace("{geonames}", `<a href="https://www.geonames.org">GeoNames</a>`).replace("{bharatlas}", `<a href="https://bharatlas.com">bharatlas</a>`)}</span></li>
    <li>${icon("heart")}<span class="t"><b>${t("Health impact", lang)}</b>: ${t("years of life lost uses the {aqli} methodology (U Chicago EPIC).", lang).replace("{aqli}", `<a href="https://aqli.epic.uchicago.edu">AQLI</a>`)}</span></li>
  </ul>
  <p class="alead2">${t("Each reading carries its own attribution line inline, so credit travels with the data wherever it goes.", lang)}</p>

  <h2 class="ah">${t("Privacy", lang)}</h2>
  <p class="amuted">${privacy} ${t("If you turn on alerts for a place, mugilu keeps that place (to about 1 km) and your browser's push address, only to send you official warnings for it, and deletes them when you turn alerts off.", lang)}</p>

  <p class="adisc">${commonsDisc}</p>
  <p class="aback"><a href="${lp("/", lang)}">← ${t("back to mugilu", lang)}</a></p>`;
  return shell(t("mugilu: terms, sources and attribution", lang), body, ABOUT_CSS, {
    desc: t(
      "mugilu's sources, licences and attribution: open data from CPCB, Open-Meteo, NDMA/IMD and NASA FIRMS, each keeping its own terms. Informational only, not for safety-critical use.",
      lang,
    ),
    canonical: `${SITE}/terms`,
    ogImage: HOME_OG,
    lang,
  });
}

const PLACES_CSS = `
.places h1{font-family:var(--serif);font-weight:600;font-size:clamp(1.7rem,6vw,2.2rem);line-height:1.1;margin:.2rem 0 .35rem}
.places .lede{color:var(--muted);font-size:.98rem;line-height:1.5;margin:0 0 .3rem;max-width:54ch}
.places .count{color:var(--muted);font-size:.86rem;margin:0 0 1.7rem}
.places .st{margin:0 0 1.6rem;break-inside:avoid}
.places .st h2{font-size:.82rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:0 0 .55rem;padding-bottom:.3rem;border-bottom:1px solid var(--hair)}
.places .st ul{list-style:none;margin:0;padding:0;columns:2;column-gap:1.5rem}
@media(min-width:620px){.places .st ul{columns:3}}
@media(min-width:900px){.places .st ul{columns:4}}
.places .st li{padding:2px 0;break-inside:avoid}
.places .st a{color:var(--sky);text-decoration:none;font-size:.93rem}
.places .st a:hover{text-decoration:underline}
`;

/** The place directory: every named /c/{slug} page, grouped by state. This is the
 *  crawlable index that links all ~800 place pages, so search engines have a path
 *  to them (and readers can browse) instead of the pages being sitemap-only. */
export function renderPlaces(lang: Lang = "en"): string {
  const groups = slugPlacesByState();
  const total = groups.reduce((n, g) => n + g.places.length, 0);
  const sections = groups
    .map(
      (g) =>
        `<section class="st"><h2>${esc(g.state)}</h2><ul>${g.places
          .map((p) => `<li><a href="${lp(`/c/${p.slug}`, lang)}">${esc(p.name)}</a></li>`)
          .join("")}</ul></section>`,
    )
    .join("");
  const canonical = "https://mugilu.live/places";
  const title = t("Every place in India: air, heat and warnings by district · mugilu", lang);
  const desc = t(
    "Browse the sky over every district and major city in India: air quality, heat, rain, UV, dust and any official warning, one page each.",
    lang,
  );
  const crumb = ld({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "mugilu", item: SITE },
      { "@type": "ListItem", position: 2, name: "Places", item: canonical },
    ],
  });
  const body = `
  <div class="places">
    <h1>${t("Every place, by state", lang)}</h1>
    <p class="lede">${t("The sky over every district and major city in India, one page each. Pick a place to see its air, heat, rain, UV, dust and any official warning, right now.", lang)}</p>
    <p class="count">${total} ${t("places across India", lang)}</p>
    ${sections}
  </div>`;
  return shell(title, body, PLACES_CSS, { desc, canonical, jsonLd: crumb, ogImage: HOME_OG, lang });
}

/** A real 404 page (the catch-all used to return 200 with a debug string). */
export function renderNotFound(lang: Lang = "en"): string {
  const gone = "That page doesn't exist on mugilu. Look up a place instead, or give it a coordinate.";
  const lead =
    lang === "en"
      ? `That page doesn't exist on mugilu. Look up a place instead, or give it a coordinate like <a href="/c/12.97,77.59">/c/12.97,77.59</a>.`
      : `${t(gone, lang)} <a href="${lp("/c/12.97,77.59", lang)}">/c/12.97,77.59</a>`;
  const body = `
  <h1 class="ahero">${t("Not here.", lang)}</h1>
  <p class="alead">${lead}</p>
  <p class="aback"><a href="${lp("/", lang)}">← ${t("back to mugilu", lang)}</a></p>`;
  return shell("Not found: mugilu", body, ABOUT_CSS, { desc: DEFAULT_DESC, ogImage: HOME_OG, lang });
}

const METHOD_CSS = `
.mtab-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:.6rem 0 1.2rem;border:1px solid var(--hair);border-radius:8px}
.mtab{width:100%;border-collapse:collapse;font-size:.9rem}
.mtab th,.mtab td{text-align:left;padding:.5rem .65rem;border-bottom:1px solid var(--hair);vertical-align:top}
.mtab tr:last-child td{border-bottom:0}
.mtab th{font:600 .74rem var(--sans);text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.mtab td:first-child{font-weight:600}
`;

/** Glass-box methodology: how the Ambient read is computed, with the public
 *  thresholds (the "Algorithmic transparency" PDGI commitment, made auditable). */
export function renderMethodology(lang: Lang = "en"): string {
  const row = (...cells: string[]) => `<tr>${cells.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`;
  // Prose: English keeps its inline markup; hi/kn render the reviewed translated text
  // (proper nouns + acronyms Latin). Precomputed to avoid nested template literals.
  const onePara =
    lang === "en"
      ? `Each hazard is scored 0–3 (low · moderate · high · severe). We surface the <b>worst</b> one, named in plain words ("Severe smoke", "High heat"), with one sentence on what to do. The other readings follow in order of risk. Averaging would hide the thing that matters, so we never average.`
      : t(
          `Each hazard is scored 0 to 3 (low, moderate, high, severe). We surface the worst one, named in plain words ("Severe smoke", "High heat"), with one sentence on what to do. The other readings follow in order of risk. Averaging would hide the thing that matters, so we never average.`,
          lang,
        );
  const whoPara =
    lang === "en"
      ? `Pick a vulnerability (asthma, older adults, children, outdoor workers, heart) and the hazards that group feels more keenly are bumped up one level (so an asthmatic sees moderate air as "high"). The read then says how that group should take it ("The air is moderate. For asthma &amp; lungs, treat it as high."), and the readings that matter to that group are tagged "for you". When your trigger isn't the headline but is still elevated, a second line surfaces it ("also watch: air is high"). The persona is a toggle <b>you</b> choose: never inferred, never stored.`
      : t(
          `Pick a vulnerability (asthma, older adults, children, outdoor workers, heart) and the hazards that group feels more keenly are bumped up one level (so an asthmatic sees moderate air as "high"). The read then says how that group should take it ("The air is moderate. For asthma & lungs, treat it as high."), and the readings that matter to that group are tagged "for you". When your trigger isn't the headline but is still elevated, a second line surfaces it ("also watch: air is high"). The persona is a toggle you choose: never inferred, never stored.`,
          lang,
        );
  // The thresholds note carries two inline links; word order differs across languages,
  // so the translated string keeps {score}/{terms} slots we fill after lookup.
  const scoreLink = `<a href="https://github.com/urbanmorph/mugilu/blob/main/apps/worker/src/score.ts">score.ts</a>`;
  const termsText = lang === "en" ? "terms &amp; attribution" : t("terms & attribution", lang);
  const termsLink = `<a href="${lp("/terms", lang)}">${termsText}</a>`;
  const threshNote = t(
    "Heat takes the worst of feels-like, wet-bulb and WBGT. The persona toggle then bumps a sensitive hazard up one level. Bands come from CPCB (air), IMD and the Australian BoM (heat / cold / wind), WHO (UV) and NASA FIRMS (smoke); the full logic is the open {score}, and every layer's source and licence is on {terms}.",
    lang,
  )
    .replace("{score}", scoreLink)
    .replace("{terms}", termsLink);
  const body = `
  <article class="ax">
  <h1 class="ahero">${t("How the Ambient read works", lang)}</h1>
  <p class="alead">${t("mugilu names the single worst thing the sky is doing to you right now, weighted for who you are. It's a glass box: the thresholds below are public and come from CPCB, IMD, WHO, NASA, the Australian BoM and the AQLI. Informational only, never medical or safety advice.", lang)}</p>

  <h2 class="ah">${t("One read, never an average", lang)}</h2>
  <p class="atext">${onePara}</p>

  <h2 class="ah">${t("For who you are", lang)}</h2>
  <p class="atext">${whoPara}</p>

  <h2 class="ah">${t("The thresholds", lang)}</h2>
  <div class="mtab-wrap">
  <table class="mtab">
  <thead><tr><th>${t("Hazard", lang)}</th><th>${t("Moderate", lang)}</th><th>${t("High", lang)}</th><th>${t("Severe", lang)}</th></tr></thead>
  <tbody>
  ${THRESHOLD_ROWS.map((r) => row(t(r.hazard, lang), ...r.cells)).join("\n  ")}
  </tbody>
  </table>
  </div>
  <p class="atext">${threshNote}</p>

  <h2 class="ah">${t("Today against normal", lang)}</h2>
  <p class="atext">${t("On days when it stands out, the heat layer compares today's modelled high with the normal high for that place and time of year, from 1991-2020 ERA5 reanalysis (Copernicus) via Open-Meteo. It shows only when the two are 3 °C or more apart. It is not a heatwave declaration, which only IMD makes.", lang)}</p>

  <p class="adisc">${t("Informational only, not for medical, emergency, or safety-critical decisions. For official warnings, consult NDMA and IMD.", lang)}</p>
  <p class="aback"><a href="${lp("/", lang)}">← ${t("back to mugilu", lang)}</a></p>
  </article>`;
  return shell(t("How mugilu works: the Ambient read explained", lang), body, ABOUT_CSS + METHOD_CSS, {
    desc: t(
      "How mugilu's Ambient read is computed: the public, auditable thresholds for air, heat, cold, wind, fog, smoke, UV and dust, and how the persona weighting works.",
      lang,
    ),
    canonical: `${SITE}/methodology`,
    ogImage: HOME_OG,
    lang,
  });
}

const WLIST_CSS = `
.wgen{font:500 .78rem var(--mono);color:var(--muted);margin:.3rem 0 1.5rem}
.wlist{list-style:none;margin:0;padding:0}
.wlist li{border-top:1px solid var(--hair);padding:1rem 0}
.wcat{display:inline-block;font:600 .7rem var(--sans);letter-spacing:.06em;text-transform:uppercase;color:var(--sky);margin:0 0 .25rem}
.whead{font-size:1.02rem;line-height:1.4;font-weight:600;margin:0 0 .3rem}
.wmeta{color:var(--muted);font-size:.82rem}.wmeta a{color:var(--sky)}
.wempty{color:var(--muted);font-size:1.05rem;margin:1.2rem 0}
.wsec{margin:0 0 1.4rem}
.wgrp{display:flex;align-items:center;gap:.5rem;font:700 1rem/1.3 var(--sans);margin:1.6rem 0 .2rem}
.wgrp .wn{font:600 .72rem/1 var(--sans);color:var(--muted);background:var(--line);border-radius:999px;padding:.2rem .5rem}
`;

/** The national active-warnings list: surfaces the SACHET feed mugilu polls
 *  and archives, so the warning "moat" is readable, not just point-queried on /c. */
/** The issuing office from a SACHET issuer field: "controlroom@ndma.gov.in (IMD
 *  Chennai)" -> "IMD Chennai"; the control-room address is the same on every alert. */
export function issuerName(issuer: string): string {
  const named = issuer.match(/\(([^)]+)\)\s*$/)?.[1];
  return (named ?? issuer.replace(/\S+@\S+/g, "")).trim() || "NDMA";
}

export function renderWarningsPage(snap: WarningsSnapshot | null, lang: Lang = "en"): string {
  // Grouped by issuing office (a state SDMA or an IMD centre), the office with the
  // newest alert first, and newest first within it; times in IST like every page.
  const when = (sent: string) => Date.parse(sent) || 0;
  const groups = new Map<string, WarningsSnapshot["alerts"]>();
  for (const a of [...(snap?.alerts ?? [])].sort((x, y) => when(y.sent) - when(x.sent))) {
    const k = issuerName(a.issuer || "");
    groups.set(k, [...(groups.get(k) ?? []), a]);
  }
  const items = groups.size
    ? [...groups]
        .map(
          ([name, list]) =>
            `<section class="wsec"><h2 class="wgrp">${esc(name)}<span class="wn">${list.length}</span></h2><ul class="wlist">${list
              .map((a) => {
                const at = when(a.sent) ? istTime(new Date(when(a.sent)).toISOString()) : "";
                const meta = [at && esc(at), isHttpUrl(a.link) ? `<a href="${esc(a.link)}" rel="noopener">CAP</a>` : ""]
                  .filter(Boolean)
                  .join(" · ");
                return `<li><div class="wcat">${esc(a.category || "Alert")}</div><div class="whead">${esc(a.headline || "Warning")}</div>${meta ? `<div class="wmeta">${meta}</div>` : ""}</li>`;
              })
              .join("")}</ul></section>`,
        )
        .join("")
    : `<p class="wempty">${t("No active national alerts right now.", lang)}</p>`;
  const disc =
    lang === "en"
      ? "Informational only, not for medical, emergency, or safety-critical decisions. For official warnings, consult NDMA and IMD directly. mugilu mirrors the SACHET feed and keeps an archive of every alert."
      : `${t("Informational only, not for medical, emergency, or safety-critical decisions. For official hazard warnings consult NDMA / IMD.", lang)} ${t("mugilu mirrors the SACHET feed and keeps an archive of every alert.", lang)}`;
  const body = `
  <article class="ax">
    <h1 class="ahero">${t("Active warnings", lang)}</h1>
    <p class="alead">${t("The latest {n} official NDMA / IMD alerts across India.", lang).replace("{n}", String(snap?.alerts.length ?? 0))}</p>
    <p class="wgen">${snap ? `${t("as of X", lang).replace("X", esc(istTime(snap.generated_at)))} · via SACHET` : ""}</p>
    ${items}
    <p class="adisc">${disc}</p>
    <p class="aback"><a href="${lp("/", lang)}">← ${t("back to mugilu", lang)}</a></p>
  </article>`;
  return shell("Active warnings: mugilu", body, ABOUT_CSS + WLIST_CSS, {
    desc: "Active NDMA / IMD warnings across India right now, mirrored from the SACHET feed. Available as HTML, JSON and Markdown.",
    canonical: `${SITE}/warnings`,
    ogImage: HOME_OG,
    lang,
  });
}

/** The suggestion list's style (home and the display setup page). */
const AC_CSS = `.acwrap{position:relative}
.ac{list-style:none;margin:4px 0 0;padding:4px;position:absolute;left:0;right:0;z-index:9;background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.14)}
.ac:empty{display:none}
.ac li{padding:9px 10px;border-radius:8px;cursor:pointer;font-size:.95rem}
.ac li span{color:var(--muted);font-size:.85rem}
.ac li.on,.ac li:hover{background:var(--bg)}
`;

/** Escapes text for innerHTML in a page script; each script scope that builds HTML defines it. */
const CLIENT_ESC = `function esc(s){return String(s).replace(/[<&>]/g,function(c){return c==='<'?'&lt;':c==='>'?'&gt;':'&amp;';});}`;

/** Place suggestions as you type, for the input `inputId` and list `listId`: arrows
 *  and Enter pick one, which opens its /c page with `suffix` (a JS expression)
 *  appended. Needs `LP` (the language prefix) in scope; warms the page through `pf`
 *  when the page defines one. */
function typeaheadJs(inputId: string, listId: string, suffix: string): string {
  return `(function(){var q=document.getElementById('${inputId}'),ac=document.getElementById('${listId}');if(!q||!ac)return;var items=[],ix=-1,t,seq=0,SUF=${suffix};
function url(x){return LP+'/c/'+x.lat+','+x.lon+SUF;}
function warm(x){if(x&&typeof pf==='function')pf(url(x));}
${CLIENT_ESC}
function hide(){ac.innerHTML='';items=[];ix=-1;}
function paint(){for(var i=0;i<ac.children.length;i++)ac.children[i].className=i===ix?'on':'';warm(items[ix]);}
function go(i){var x=items[i];if(x)location.href=url(x);}
q.addEventListener('input',function(){var v=q.value.trim();clearTimeout(t);if(v.length<2){hide();return;}var s=++seq;t=setTimeout(function(){fetch('/suggest?q='+encodeURIComponent(v)).then(function(r){return r.json();}).then(function(d){if(s!==seq)return;items=d.suggestions||[];ix=-1;ac.innerHTML=items.map(function(x,i){return '<li role="option" data-i="'+i+'"><b>'+esc(x.label)+'</b>'+(x.sublabel?' <span>'+esc(x.sublabel)+'</span>':'')+'</li>';}).join('');warm(items[0]);}).catch(function(){if(s===seq)hide();});},150);});
q.addEventListener('keydown',function(e){if(!items.length)return;if(e.key==='ArrowDown'){ix=(ix+1)%items.length;e.preventDefault();paint();}else if(e.key==='ArrowUp'){ix=(ix-1+items.length)%items.length;e.preventDefault();paint();}else if(e.key==='Enter'&&ix>=0){e.preventDefault();go(ix);}else if(e.key==='Escape'){hide();}});
ac.addEventListener('mousedown',function(e){var li=e.target.closest('li');if(li)go(+li.getAttribute('data-i'));});
ac.addEventListener('mouseover',function(e){var li=e.target.closest('li');if(li)warm(items[+li.getAttribute('data-i')]);});
q.addEventListener('blur',function(){setTimeout(hide,150);});})();`;
}

const HOME_CSS = `
body{background:linear-gradient(180deg,color-mix(in srgb,var(--sky) 14%,var(--bg)),var(--bg) 44%) var(--bg) no-repeat}
.hero{font-family:var(--serif);font-weight:600;font-size:clamp(2rem,8vw,2.7rem);letter-spacing:-.02em;line-height:1.05;margin:1.4rem 0 .5rem}
.tagline{font-family:var(--serif);font-size:1.18rem;line-height:1.4;margin:0 0 .8rem;color:var(--ink)}
.covers{display:flex;flex-wrap:wrap;gap:.35rem 1rem;margin:0 0 1.4rem;color:var(--muted);font-size:.92rem}
.covers span{display:inline-flex;align-items:center;gap:.35rem}
.covers .ic{width:16px;height:16px;color:var(--sky)}
.search{display:flex;gap:8px;margin:0 0 .8rem}
.search input{flex:1;font-size:1rem;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink)}
.search button{font-size:1rem;font-weight:600;padding:12px 18px;border:0;border-radius:12px;background:color-mix(in srgb,var(--sky) 86%,#000);color:#fff;cursor:pointer}
${AC_CSS}.shint{color:var(--muted);font-size:.86rem;line-height:1.5;margin:-.2rem 0 .9rem;max-width:46ch}.shint b{color:var(--ink);font-weight:600}
.exq{color:var(--ink)}
.nearme{display:inline-flex;align-items:center;gap:.4rem;font-size:.95rem;padding:10px 14px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink);cursor:pointer;margin:0 0 1rem}
.nearme .ic{width:16px;height:16px;color:var(--sky)}
.notice{color:var(--warn-text);font-size:.9rem;margin:.2rem 0 1rem}
.cities{color:var(--muted);font-size:.9rem;line-height:1.9}.cities a{color:var(--sky);text-decoration:none}
.yourplaces{margin:0 0 1.2rem}
.yourplaces h2{margin:0 0 .4rem;font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.pl{display:flex;align-items:center;gap:.55rem;padding:3px 0}
.pl a{flex:1;color:var(--ink);text-decoration:none;font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pl .plfav{background:none;border:0;cursor:pointer;font-size:1.05rem;color:var(--muted);padding:0;line-height:1}
.pl .plfav.on{color:var(--sky)}
.pl .plx{background:none;border:0;cursor:pointer;color:var(--muted);font-size:.95rem;padding:0 .15rem;opacity:.45;line-height:1}
.pl .plx:hover{opacity:1}
.hero-now{margin:0 0 1.4rem;border:1px solid color-mix(in srgb,var(--cond,var(--sky)) 32%,var(--line));border-radius:14px;padding:14px 16px;background:linear-gradient(180deg,color-mix(in srgb,var(--cond,var(--sky)) 13%,var(--card)),var(--card))}
.hero-now h2{margin:0 0 .5rem;font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.hero-now .hl{display:block;text-decoration:none;color:var(--ink);padding:5px 0;font-size:.98rem;line-height:1.35}
.hero-now .hl b{font-weight:700}
.hero-now .age{color:var(--muted);font-weight:400;font-size:.85em}
.hero-now .hl .ic{width:18px;height:18px;color:var(--hue,var(--sky));margin-right:8px;vertical-align:-.2em}
/* iPads in portrait: one column, wider, so the map is bigger. */
@media(min-width:700px) and (max-width:959px){main:has(>.hm){max-width:720px}.hm .msvg{max-width:560px;margin:0 auto}}
/* Laptops and iPads in landscape: search, the India-now rows and places on the left, the map
   on the right. The India-now card opens up so its rows join the left column; the map takes
   the card's look. The last row (1fr) takes the map's height so the left rows stay packed.
   Only with a map, and only where :has() works; otherwise the one column stays. */
@supports selector(:has(a)){@media(min-width:960px){
main:has(>.hm .imap){max-width:1180px;padding-top:28px}
body:has(.hm .imap) :is(.foot,.langsw){max-width:1180px}
.hm:has(.imap){display:grid;grid-template-columns:minmax(0,26rem) minmax(0,1fr);grid-template-rows:repeat(14,auto) 1fr;column-gap:3.5rem;align-items:start}
.hm>*,.hero-now>*{grid-column:1}
.hm:has(.imap) .hero-now{display:contents}
.hero-now>.imap{grid-column:2;grid-row:1/-1;margin:0;border:1px solid color-mix(in srgb,var(--cond,var(--sky)) 32%,var(--line));border-radius:14px;padding:16px 20px;background:linear-gradient(180deg,color-mix(in srgb,var(--cond,var(--sky)) 13%,var(--card)),var(--card))}
.hm .msvg{max-width:min(100%,calc((100svh - 230px) * .9));margin:0 auto}
.hero{margin-top:.4rem}
.nearme{justify-self:start}
.hero-now>h2{margin:.4rem 0 .3rem}
.hero-now>.hl:last-of-type{margin-bottom:1.4rem}
}}
`;

export const CITIES = [
  { name: "Delhi", lat: 28.61, lon: 77.21 },
  { name: "Mumbai", lat: 19.07, lon: 72.88 },
  { name: "Bengaluru", lat: 12.97, lon: 77.59 },
  { name: "Kolkata", lat: 22.57, lon: 88.36 },
  { name: "Chennai", lat: 13.08, lon: 80.27 },
  { name: "Hyderabad", lat: 17.39, lon: 78.49 },
];

export function renderHome(
  notFound?: string,
  highlights?: NationalHighlights,
  meta?: {
    gridAsOf?: string;
    airAsOf?: string;
    popular?: { label: string; lat: number; lon: number }[];
    map?: IndiaMap;
  },
  lang: Lang = "en",
): string {
  // "Popular" = real top-lookups (D1) first, then seed cities to fill (deduped),
  // so it's useful from day one and grows into real data. Short, recognisable
  // label: the district/city, or the metro city when the first segment is a long
  // ward name ("Dharmaraya Swamy Temple Ward, Bengaluru").
  const shortPlace = (label: string) => {
    const seg = label.split(",").map((s) => s.trim());
    return seg[0].length > 14 && seg.length > 1 ? seg[seg.length - 1] : seg[0];
  };
  const seen = new Set<string>();
  const links: string[] = [];
  const addPlace = (name: string, lat: number, lon: number) => {
    const k = name.toLowerCase();
    if (seen.has(k) || links.length >= 8) return;
    seen.add(k);
    // Link the canonical /c/{slug} when the place has one (the metros, most districts)
    // so the internal link points at the page that actually indexes, not a coordinate
    // URL that just canonicalises to it. Wards and arbitrary points stay coordinate.
    const s = slugForName(name);
    const href = s ? `/c/${s}` : `/c/${lat},${lon}`;
    links.push(`<a href="${lp(href, lang)}">${esc(name)}</a>`);
  };
  for (const p of meta?.popular ?? []) addPlace(shortPlace(p.label), p.lat, p.lon);
  for (const c of CITIES) addPlace(c.name, c.lat, c.lon);
  const cityLinks = links.join(" · ");
  const noticeMsg =
    lang === "en"
      ? `No place found for "${esc(notFound ?? "")}". Type the name of a city or a place.`
      : esc(t('No place found for "X". Type the name of a city or a place.', lang)).replace("X", esc(notFound ?? ""));
  const notice = notFound ? `<p class="notice">${noticeMsg}</p>` : "";
  const cover = (ic: string, en: string) => `<span>${icon(ic)} ${t(en, lang)}</span>`;
  const shint =
    lang === "en"
      ? `Type the name of a place in India, in any language (<span class="exq">ಬೆಂಗಳೂರು · दिल्ली · சென்னை</span>). You then see <b>its sky</b>: air, heat, rain and dust.`
      : `${t("Type the name of a place in India, in any language", lang)} (<span class="exq">ಬೆಂಗಳೂರು · दिल्ली · சென்னை</span>). ${t("You then see its sky: air, heat, rain and dust.", lang)}`;

  const body = `<div class="hm">
  <h1 class="hero">${t("What is it like outside now?", lang)}</h1>
  <p class="tagline">${t("The open sky of India, one coordinate at a time.", lang)}</p>
  <p class="covers">${cover("air", "air")}${cover("heat", "heat")}${cover("rain", "rain")}${cover("sun", "UV")}${cover("dust", "dust")}${cover("warn", "warnings")}</p>
  <div class="acwrap">
    <form class="search" action="${lp("/go", lang)}" method="get" role="search">
      <input id="q" name="q" type="search" placeholder="${esc(t("A place in India, or lat,lon", lang))}" autocomplete="off" autofocus aria-label="${esc(t("Look up a place in India", lang))}">
      <button type="submit">${t("Go", lang)}</button>
    </form>
    <ul id="ac" class="ac" role="listbox"></ul>
  </div>
  <p class="shint">${shint}</p>
  <button id="nearme" class="nearme" type="button" hidden>${icon("pin")} ${t("Use my location", lang)}</button>
  ${notice}
  ${renderHero(highlights, meta, lang)}
  <div id="yp" class="yourplaces" hidden></div>
  <p class="cities">${t("Popular:", lang)} ${cityLinks}</p>
  </div>
  <script>
  var YP=${JSON.stringify(t("Your places", lang))};
  var LOC=${JSON.stringify(t("Finding your location…", lang))},NOLOC=${JSON.stringify(t("Your location is not available.", lang))},NAME=${JSON.stringify(t("Type a name for this place (for example, Home or Office)", lang))};
  var LP=${JSON.stringify(lang === "en" ? "" : "/" + lang)};
  var b=document.getElementById('nearme'),label=b.textContent;
  if(navigator.geolocation){b.hidden=false;b.onclick=function(){b.textContent=LOC;navigator.geolocation.getCurrentPosition(function(p){location.href=LP+'/c/'+p.coords.latitude.toFixed(4)+','+p.coords.longitude.toFixed(4);},function(){b.textContent=NOLOC;});};}
  addEventListener('pageshow',function(){b.textContent=label;});
  // Warm the edge + upstreams for a /c URL so the click lands instantly (dedup).
  function pf(u){pf.s=pf.s||{};if(pf.s[u])return;pf.s[u]=1;var l=document.createElement('link');l.rel='prefetch';l.href=u;document.head.appendChild(l);}
  ${typeaheadJs("q", "ac", "''")}
  ${MAP_JS(lang)}
  // Your places: recents + favourites from localStorage (first-party, no login).
  (function(){
    var K='mugilu:places',yp=document.getElementById('yp');if(!yp)return;
    ${CLIENT_ESC}
    function load(){try{return JSON.parse(localStorage.getItem(K))||[]}catch(e){return[]}}
    function save(L){try{localStorage.setItem(K,JSON.stringify(L))}catch(e){}}
    function nm(p){return p.name||p.label||(p.lat+', '+p.lon);}
    function ord(L){return L.slice().sort(function(a,b){return (b.fav?1:0)-(a.fav?1:0)||b.n-a.n||b.t-a.t});}
    function render(){
      var L=ord(load());
      if(!L.length){yp.hidden=true;return;}
      yp.hidden=false;
      yp.innerHTML='<h2>'+YP+'</h2>'+L.map(function(p){return '<div class="pl" data-id="'+esc(p.id)+'"><button class="plfav'+(p.fav?' on':'')+'" data-a="fav" type="button" aria-pressed="'+(p.fav?'true':'false')+'" title="Favourite">'+(p.fav?'\\u2605':'\\u2606')+'</button><a href="'+LP+'/c/'+esc(p.lat)+','+esc(p.lon)+'">'+esc(nm(p))+'</a><button class="plx" data-a="ren" type="button" title="Rename">\\u270e</button><button class="plx" data-a="del" type="button" title="Remove">\\u00d7</button></div>';}).join('');
      L.slice(0,4).forEach(function(p){pf(LP+'/c/'+p.lat+','+p.lon);});
      if(L[0]&&!render.sr){render.sr=1;try{var sr=document.createElement('script');sr.type='speculationrules';sr.textContent=JSON.stringify({prerender:[{source:'list',urls:[LP+'/c/'+L[0].lat+','+L[0].lon]}]});document.head.appendChild(sr);}catch(e){}}
    }
    yp.addEventListener('click',function(e){
      var btn=e.target.closest('button[data-a]');if(!btn)return;
      var id=btn.closest('.pl').getAttribute('data-id'),a=btn.getAttribute('data-a');
      var L=load(),p=L.filter(function(x){return x.id===id})[0];if(!p)return;
      if(a==='fav')p.fav=!p.fav;else if(a==='ren'){var n=prompt(NAME,p.name||p.label||'');if(n===null)return;p.name=(n.trim()||undefined);}else if(a==='del')L=L.filter(function(x){return x.id!==id;});
      save(L);render();
    });
    render();
  })();
  </script>
  ${FRESHEN}`;

  // schema.org WebSite + SearchAction (enables a search box in results; credits the publisher).
  const site = ld({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "mugilu",
    alternateName: "mugilu: the open sky of India",
    url: SITE,
    description: DEFAULT_DESC,
    publisher: {
      "@type": "Organization",
      name: "urbanmorph",
      url: "https://urbanmorph.com",
      logo: "https://mugilu.live/apple-touch-icon.png",
      sameAs: ["https://github.com/urbanmorph"],
    },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: "https://mugilu.live/go?q={search_term_string}" },
      "query-input": "required name=search_term_string",
    },
  });
  return shell(t("mugilu: air, heat, rain and warnings over any point in India", lang), body, HOME_CSS + MAP_CSS, {
    desc: t(DEFAULT_DESC, lang),
    canonical: SITE,
    jsonLd: site,
    ogImage: HOME_OG,
    lang,
  });
}
