import type { Conditions, Warning, AirPollutants } from "./types";
import type { NationalHighlights } from "./highlights";
import type { WarningsSnapshot } from "./sachet";
import { pollutantParts } from "./formats";
import { ambientRisk, ambientMeaning, personaAlso, smokeLevel, SMOKE_WORD, PERSONAS, PERSONA_LABEL } from "./score";
import type { Persona, RiskBand } from "./score";
import { RISK_COLOR, BAND_COLOR } from "./palette";

// The worker-rendered HTML pages. Layperson-first, mobile-first, self-contained
// (inline CSS, no framework). All pages share chrome via shell().
//
// ── Design language (one set, applied to EVERY page) ────────────────────────
// Editorial serif display (--serif) for headlines/leads; system sans (--sans)
// for data and labels; mono (--mono) for coordinate/format stamps; hairline
// rules (--hair); a condition- or sky-tinted atmospheric backdrop; and the
// inline Lucide-style line icons in ICON/icon(), never emoji. Tokens live in
// BASE_CSS :root and reach home, /c, about, terms and 404 alike.

const BAND_LABEL: Record<string, string> = {
  good: "Good",
  satisfactory: "Fine",
  moderate: "Moderate",
  poor: "Poor",
  vpoor: "Very poor",
  severe: "Severe",
  unknown: "n/a",
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

function dustWord(ug: number | undefined): string {
  if (ug == null) return "n/a";
  if (ug < 20) return "low";
  if (ug < 50) return "moderate";
  return "high";
}

function windWord(gust: number): string {
  if (gust >= 88) return "storm-force";
  if (gust >= 62) return "gale";
  if (gust >= 40) return "strong";
  if (gust >= 20) return "breezy";
  return "calm";
}

/** 8-point compass label for the direction wind blows FROM. */
function compassDir(deg: number): string {
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(deg / 45) % 8];
}

function visWord(meters: number): string {
  if (meters < 200) return "dense fog";
  if (meters < 500) return "thick fog";
  if (meters < 1000) return "fog";
  if (meters < 2000) return "misty";
  if (meters < 5000) return "hazy";
  return "clear";
}

/** Compact pollutant breakdown for the air row (values only, rounded; precise
 *  units in the .json/.md siblings). Order/labels from the shared pollutantParts. */
function pollutantLine(p: AirPollutants): string {
  return pollutantParts(p)
    .map((x) => `${x.label} ${x.key === "co" ? x.value : Math.round(x.value)}`)
    .join(" · ");
}

function heatPhrase(apparent: number, wetBulb?: number): string {
  if (wetBulb != null && wetBulb >= 28) return "dangerous humid heat";
  if (apparent >= 45) return "extreme heat";
  if (apparent >= 40) return "severe heat";
  if (apparent >= 35) return "very hot";
  if (apparent <= 0) return "dangerous cold";
  if (apparent <= 5) return "very cold";
  if (apparent <= 10) return "cold";
  return "warm";
}

function dustPhrase(d: number): string {
  if (d >= 500) return "severe dust";
  if (d >= 150) return "high dust";
  if (d >= 50) return "moderate dust";
  return "light dust";
}

// Risk band of each highlight, so the hero can wear the severity of what it
// shows. Same cutoffs as score.ts (apparent/wet-bulb, dust µg/m³, CPCB band),
// mapped to the four-step risk palette the /c page uses.
const RISK_RANK: Record<RiskBand, number> = { low: 0, moderate: 1, high: 2, severe: 3 };
function heatBand(apparent?: number, wb?: number): RiskBand {
  if ((apparent != null && apparent >= 45) || (wb != null && wb >= 31)) return "severe";
  if ((apparent != null && apparent >= 40) || (wb != null && wb >= 28)) return "high";
  if ((apparent != null && apparent >= 35) || (wb != null && wb >= 26)) return "moderate";
  return "low";
}
function dustBand(d: number): RiskBand {
  return d >= 500 ? "severe" : d >= 150 ? "high" : d >= 80 ? "moderate" : "low";
}
function airBand(b: string): RiskBand {
  return b === "severe" || b === "vpoor" ? "severe" : b === "poor" ? "high" : b === "moderate" ? "moderate" : "low";
}

/** The "right now in India" hero. Heat- and dust-led from the 4-hourly grid,
 *  plus a worst-air row from the hourly snapshot, each row state-qualified (so
 *  the place is recognisable), stamped with its own freshness, and coloured by
 *  its severity; the whole card takes the tint of the worst extreme, like /c. */
function renderHero(h: NationalHighlights, meta?: { gridAsOf?: string; airAsOf?: string }): string {
  const rows: string[] = [];
  let worst: RiskBand = "low";
  const place = (name: string, state?: string) => esc(state ? `${name}, ${state}` : name);
  const age = (iso?: string) => (iso ? ` <span class="age">· ${relTime(iso)}</span>` : "");
  const row = (band: RiskBand, lat: number, lon: number, body: string, iso?: string) => {
    if (RISK_RANK[band] > RISK_RANK[worst]) worst = band;
    return `<a class="hl" style="--hue:${RISK_COLOR[band]}" href="/c/${lat},${lon}">${body}${age(iso)}</a>`;
  };
  if (h.hottest) {
    rows.push(
      row(
        heatBand(h.hottest.apparent_c, h.hottest.wet_bulb_c),
        h.hottest.lat,
        h.hottest.lon,
        `${icon("heat")}Hottest: <b>${place(h.hottest.name, h.hottest.state)}</b>, feels ${Math.round(h.hottest.apparent_c)}°, ${heatPhrase(h.hottest.apparent_c, h.hottest.wet_bulb_c)}`,
        meta?.gridAsOf,
      ),
    );
  }
  if (h.dustiest) {
    rows.push(
      row(
        dustBand(h.dustiest.dust_ug_m3),
        h.dustiest.lat,
        h.dustiest.lon,
        `${icon("dust")}Dustiest: <b>${place(h.dustiest.name, h.dustiest.state)}</b>, ${dustPhrase(h.dustiest.dust_ug_m3)}`,
        meta?.gridAsOf,
      ),
    );
  }
  if (h.worstAir) {
    rows.push(
      row(
        airBand(h.worstAir.band),
        h.worstAir.lat,
        h.worstAir.lon,
        `${icon("air")}Worst air: <b>${place(h.worstAir.name, h.worstAir.state)}</b>, AQI ${h.worstAir.aqi} ${BAND_LABEL[h.worstAir.band] ?? ""}`,
        meta?.airAsOf,
      ),
    );
  }
  return rows.length
    ? `<section class="hero-now" style="--cond:${RISK_COLOR[worst]}"><h2>Right now in India</h2>${rows.join("")}</section>`
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

const BASE_CSS = `
:root{--sky:#0284c7;--ink:#0f172a;--muted:#64748b;--bg:#f8fafc;--card:#fff;--line:#e2e8f0;--warn-text:#b45309;--serif:Georgia,'Iowan Old Style','Palatino Linotype',Palatino,Cambria,serif;--sans:ui-sans-serif,-apple-system,system-ui,sans-serif;--mono:ui-monospace,SFMono-Regular,Menlo,monospace;--hair:color-mix(in srgb,var(--ink) 12%,transparent)}
@media(prefers-color-scheme:dark){:root{--ink:#e2e8f0;--muted:#94a3b8;--bg:#0b1220;--card:#111827;--line:#1f2937;--warn-text:#fbbf24}}
*{box-sizing:border-box}html,body{margin:0}
body{font:16px/1.5 var(--sans);color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased}
.bar{display:flex;align-items:center;padding:14px 18px;border-bottom:1px solid var(--line)}
.brand{font-weight:700;letter-spacing:-.02em;color:var(--ink);text-decoration:none;font-size:1.1rem}
main{max-width:560px;margin:0 auto;padding:20px 18px 32px}
.foot{max-width:560px;margin:0 auto;padding:18px;color:var(--muted);font-size:.78rem;border-top:1px solid var(--line)}
.foot a{color:var(--muted)}
.ic{width:18px;height:18px;flex:none;vertical-align:-.18em}
`;

const DEFAULT_DESC =
  "mugilu: the open sky of India. Air, heat, rain, UV, dust and the official warning over any point, the single worst hazard named for you.";
const SITE = "https://mugilu.live";
const HOME_OG = `${SITE}/og.png`; // the branded social-share card

/** schema.org JSON-LD, safe to embed in a <script> (escapes the `<` that could
 *  otherwise break out of the tag). */
function ld(obj: object): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

function shell(
  title: string,
  body: string,
  css: string,
  desc: string = DEFAULT_DESC,
  canonical?: string,
  jsonLd?: string,
  ogImage?: string,
): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<title>${title}</title>
<meta name="description" content="${esc(desc)}">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ""}
<meta property="og:type" content="website">
<meta property="og:site_name" content="mugilu">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
${canonical ? `<meta property="og:url" content="${esc(canonical)}">` : ""}
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">` : ""}
<meta name="twitter:card" content="${ogImage ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
${ogImage ? `<meta name="twitter:image" content="${esc(ogImage)}">` : ""}
${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ""}
<style>${BASE_CSS}${css}</style>
</head>
<body>
<header class="bar"><a class="brand" href="/">${CLOUD} mugilu</a></header>
<main>${body}</main>
<footer class="foot"><a href="/about">about</a> · <a href="/methodology">how it works</a> · <a href="/about#build">build on it</a> · <a href="/terms">terms</a> · <a href="https://github.com/urbanmorph/mugilu">code</a> · a <a href="https://github.com/urbanmorph/mugilu/blob/main/PDGI.md">digital commons</a></footer>
<script>
(function(){function r(ms){var m=Math.round(ms/6e4);if(m<1)return'just now';if(m<60)return m+' min ago';var h=Math.round(m/60);if(h<24)return h+(h===1?' hour ago':' hours ago');var d=Math.round(h/24);return d+(d===1?' day ago':' days ago');}var n=Date.now();document.querySelectorAll('time[data-rel][datetime]').forEach(function(t){var d=new Date(t.getAttribute('datetime')).getTime();if(!isNaN(d))t.textContent=r(n-d);});})();
</script>
</body>
</html>`;
}

// The conditions page as an "atmospheric almanac": a sky-tinted backdrop that
// takes its hue from the live dominant hazard (--cond, set per request), an
// editorial serif Ambient statement, and the readings as hairline-ruled strata
// (not cards). Inline-SVG line icons, currentColor so the driver layer glows.
const CONDITIONS_CSS = `
body{background:linear-gradient(180deg,color-mix(in srgb,var(--cond) 22%,var(--bg)),color-mix(in srgb,var(--cond) 7%,var(--bg)) 18%,var(--bg) 50%) var(--bg) no-repeat}
.coord{font:500 .78rem/1.4 var(--mono);letter-spacing:.04em;color:var(--muted);margin:.4rem 0 0}
.loc{font-family:var(--serif);font-weight:600;font-size:clamp(1.7rem,6.5vw,2.15rem);line-height:1.05;letter-spacing:-.01em;margin:.35rem 0 0}
.when{color:var(--muted);font-size:.9rem;margin:.3rem 0 0}
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
.amb-also{display:flex;align-items:flex-start;gap:.4rem;font:500 .92rem/1.4 var(--sans);color:var(--cond);margin:.7rem 0 0;max-width:34ch}
.amb-also .ic{width:16px;height:16px;flex:none;margin-top:.1rem}
.who{display:flex;flex-wrap:wrap;gap:.35rem 1rem;margin:1.2rem 0 0;padding:0}
.who a{font:500 .9rem var(--sans);color:var(--muted);text-decoration:none;padding-bottom:2px;border-bottom:2px solid transparent}
.who a.on{color:var(--ink);border-color:var(--cond)}
.strata{margin:1.8rem 0 0;border-top:1px solid var(--hair)}
.lyr{display:grid;grid-template-columns:5.4rem 1fr;gap:0 1rem;padding:1.05rem .1rem;border-bottom:1px solid var(--hair)}
.lyr dt{display:flex;align-items:center;gap:.5rem;font:600 .8rem/1.2 var(--sans);letter-spacing:.04em;text-transform:uppercase;color:var(--muted);padding-top:.6rem}
.lyr dt .ic{flex:none}
.lyr.on dt{color:var(--cond)}
.lyr dd{margin:0;display:flex;flex-direction:column;gap:.16rem;min-width:0}
.lyr .num{font:700 2.2rem/1 var(--sans);letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:var(--ink)}
.lyr .q{font-size:.95rem;color:var(--ink)}
.lyr .q b{font-weight:700}
.lyr .q .qa{color:var(--muted);text-transform:uppercase;font-size:.72rem;letter-spacing:.05em}
.lyr .q .qa.nu{text-transform:none;letter-spacing:.01em}
.lyr .sub{color:var(--muted);font-size:.82rem;line-height:1.5}
.lyr .sub .poll{display:inline-block;margin-top:.15rem;font-size:.78rem;opacity:.82;font-variant-numeric:tabular-nums}
.lyr .scale{position:relative;height:5px;border-radius:3px;margin:.55rem 0 .15rem;max-width:14rem;background:linear-gradient(90deg,#16a34a,#84cc16 22%,#eab308 45%,#f97316 70%,#dc2626);opacity:.85}
.lyr .scale.calm{background:color-mix(in srgb,var(--sky) 50%,var(--line));opacity:1}
.lyr .scale i{position:absolute;top:50%;width:11px;height:11px;border-radius:50%;background:var(--ink);box-shadow:0 0 0 2.5px var(--bg);transform:translate(-50%,-50%)}
.dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:.35rem;vertical-align:.06em}
.dot.meas{background:var(--ink)}
.dot.mod{background:transparent;border:1.5px solid var(--muted)}
.cx footer{margin:2.1rem 0 0;border-top:1px solid var(--hair);padding-top:1.1rem}
.attr{color:var(--muted);font-size:.8rem;margin:0 0 .3rem}
.disc{color:var(--muted);font-size:.76rem;line-height:1.5;margin:0}
.raw{margin:.95rem 0 0;font:500 .82rem var(--mono);letter-spacing:.02em}
.raw a{color:var(--cond);text-decoration:none}
.raw a:hover{text-decoration:underline}
.cxback{margin:1.1rem 0 0;font-size:.9rem}.cxback a{color:var(--muted);text-decoration:none}.cxback a:hover{color:var(--ink)}
@media(prefers-reduced-motion:no-preference){
.coord,.loc,.when,.warn,.amb,.lyr{animation:rise .55s both cubic-bezier(.2,.7,.2,1)}
.loc{animation-delay:.03s}.when{animation-delay:.06s}.warn{animation-delay:.09s}.amb{animation-delay:.12s}
.strata .lyr:nth-child(1){animation-delay:.2s}.strata .lyr:nth-child(2){animation-delay:.26s}.strata .lyr:nth-child(3){animation-delay:.32s}.strata .lyr:nth-child(4){animation-delay:.38s}.strata .lyr:nth-child(5){animation-delay:.44s}
}
@keyframes rise{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:none}}
`;

function warnColor(color: string): string {
  switch (color.toLowerCase()) {
    case "red":
      return "#dc2626";
    case "orange":
      return "#f97316";
    case "yellow":
      return "#ca8a04";
    default:
      return "#64748b";
  }
}

const RISK_LABEL: Record<RiskBand, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  severe: "Severe",
};

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
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
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
const COND_NOUN: Record<string, string> = {
  Air: "air",
  Heat: "heat",
  Cold: "cold",
  UV: "sun",
  Dust: "dust",
  Wind: "wind",
  Fog: "fog",
  Smoke: "smoke",
  Warning: "alert",
  none: "sky",
};

/** Wet-bulb survivability read: ~31 is the theoretical limit, >=28 is severe. */
function wetBulb(wb: number): [string, string] {
  if (wb >= 31) return ["dangerous", RISK_COLOR.severe];
  if (wb >= 28) return ["severe", RISK_COLOR.high];
  if (wb >= 26) return ["caution", RISK_COLOR.moderate];
  return ["safe", "var(--muted)"];
}

/** An inline good->severe scale with a marker at the reading's position (0..1).
 *  `calm` swaps the gradient for a neutral sky track (for non-hazard rows). */
function scaleBar(p: number, calm = false): string {
  const pct = Math.max(3, Math.min(97, p * 100));
  return `<div class="scale${calm ? " calm" : ""}"><i style="left:${pct}%"></i></div>`;
}

/** One reading as a hairline-ruled stratum: icon + label, a big figure, a tail,
 *  and an optional inline scale showing where it sits on the good->severe range. */
function lyr(key: string, label: string, on: boolean, num: string, q: string, sub: string, bar = ""): string {
  return `<div class="lyr${on ? " on" : ""}"><dt>${icon(key)}<span>${label}</span></dt><dd><span class="num">${num}</span><span class="q">${q}</span>${bar}${sub ? `<span class="sub">${sub}</span>` : ""}</dd></div>`;
}

/** A pinned official warning, the most urgent thing on the page. */
function renderWarning(w: Warning): string {
  const meta = [w.severity, w.until ? `until ${w.until}` : ""].filter(Boolean).join(" · ");
  return `<div class="warn" style="--wc:${warnColor(w.color)}">${icon("warn")}<div><b>${esc(w.event)}</b>${meta ? ` · ${esc(meta)}` : ""}<span class="wsrc">Official warning · ${esc(w.issuer)}</span></div></div>`;
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

export function renderConditionsPage(c: Conditions, persona: Persona = "everyone", canonical?: string): string {
  const risk = ambientRisk(c, persona);
  const also = personaAlso(risk);
  const slug = `${c.location.lat},${c.location.lon}`;
  const stationCity = c.air?.station?.city;
  const place = c.place ? esc(c.place) : stationCity ? esc(stationCity) : slug;
  const band = c.air?.band ?? "unknown";
  const bandColor = BAND_COLOR[band] ?? BAND_COLOR.unknown;
  const bandLabel = BAND_LABEL[band] ?? "n/a";
  const condColor = RISK_COLOR[risk.band];

  // Persona toggles (understated text, not chips).
  const base = `/c/${slug}`;
  const pills = PERSONAS.map((p) => {
    const href = p === "everyone" ? base : `${base}?as=${p}`;
    return `<a${p === risk.persona ? ' class="on"' : ""} href="${href}">${esc(PERSONA_LABEL[p])}</a>`;
  }).join("");

  // Editorial headline: "High heat." (band coloured) or "All clear." when calm.
  const head =
    risk.band === "low"
      ? '<span class="b">All clear.</span>'
      : `<span class="b">${RISK_LABEL[risk.band]}</span> ${COND_NOUN[risk.driver] ?? "sky"}.`;

  // The readings, as strata. Each renders only when it has a value; the Ambient
  // driver's stratum is highlighted (icon + label in the condition colour).
  const strata: string[] = [];
  if (c.air) {
    const marker = c.air.station
      ? `<i class="dot meas"></i>measured · ${c.air.station.distance_km} km`
      : '<i class="dot mod"></i>modelled here';
    const aqli = c.air.yll != null ? ` · ~${c.air.yll} yrs life lost` : "";
    const poll = pollutantLine(c.air.pollutants);
    strata.push(
      lyr(
        "air",
        "Air",
        risk.driver === "Air",
        c.air.aqi != null ? String(c.air.aqi) : "n/a",
        `<span class="qa">AQI</span> <b style="color:${bandColor}">${bandLabel}</b>`,
        `${marker}${aqli}${poll ? `<br><span class="poll">${poll}</span>` : ""}`,
        c.air.aqi != null ? scaleBar(Math.min(c.air.aqi, 400) / 400) : "",
      ),
    );
  }
  if (c.heat) {
    let sub = `${round(c.heat.temp_c)}° actual · ${round(c.heat.humidity_pct)}% humidity`;
    if (c.heat.wet_bulb_c != null) {
      const [wn, wc] = wetBulb(c.heat.wet_bulb_c);
      sub += ` · wet-bulb ${round(c.heat.wet_bulb_c)}° <b style="color:${wc}">${wn}</b>`;
    }
    if (c.heat.wbgt_c != null) sub += ` · WBGT ${round(c.heat.wbgt_c)}°`;
    strata.push(
      lyr(
        "heat",
        "Heat",
        risk.driver === "Heat",
        `${round(c.heat.apparent_c)}°`,
        `<span class="qa">feels like</span> <b>${heatPhrase(c.heat.apparent_c ?? 0, c.heat.wet_bulb_c)}</b>`,
        sub,
        c.heat.apparent_c != null ? scaleBar((c.heat.apparent_c - 25) / 25) : "",
      ),
    );
  }
  if (c.uv?.index != null) {
    strata.push(
      lyr(
        "sun",
        "Sun",
        risk.driver === "UV",
        String(Math.round(c.uv.index)),
        `<span class="qa">UV index</span> <b>${uvWord(c.uv.index)}</b>`,
        "",
        scaleBar(Math.min(c.uv.index, 11) / 11),
      ),
    );
  }
  if (c.dust?.dust_ug_m3 != null) {
    strata.push(
      lyr(
        "dust",
        "Dust",
        risk.driver === "Dust",
        String(Math.round(c.dust.dust_ug_m3)),
        `<span class="qa nu">µg/m³</span> <b>${dustWord(c.dust.dust_ug_m3)}</b>`,
        "",
        scaleBar(Math.min(c.dust.dust_ug_m3, 500) / 500),
      ),
    );
  }
  if (c.wind && (c.wind.gust_kmh != null || c.wind.speed_kmh != null)) {
    const gust = c.wind.gust_kmh ?? c.wind.speed_kmh!;
    const dirParts: string[] = [];
    if (c.wind.direction_deg != null) dirParts.push(`from ${compassDir(c.wind.direction_deg)}`);
    if (c.wind.speed_kmh != null) dirParts.push(`${Math.round(c.wind.speed_kmh)} km/h steady`);
    strata.push(
      lyr(
        "wind",
        "Wind",
        risk.driver === "Wind",
        String(Math.round(gust)),
        `<span class="qa nu">km/h gusts</span> <b>${windWord(gust)}</b>`,
        dirParts.join(" · "),
        scaleBar(Math.min(gust, 100) / 100),
      ),
    );
  }
  // Visibility only surfaces when reduced (hazy/fog); clear skies aren't news.
  if (c.visibility?.meters != null && c.visibility.meters < 5000) {
    const m = c.visibility.meters;
    const val = m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
    strata.push(
      lyr(
        "fog",
        "Visibility",
        risk.driver === "Fog",
        val,
        `<b>${visWord(m)}</b>`,
        "",
        scaleBar(1 - Math.min(m, 5000) / 5000),
      ),
    );
  }
  const smokeLvl = smokeLevel(c.smoke);
  if (c.smoke && smokeLvl != null) {
    const sub =
      c.smoke.nearest_km != null
        ? `nearest ${c.smoke.nearest_km} km · ${c.smoke.frp_sum} MW total`
        : `${c.smoke.frp_sum} MW`;
    strata.push(
      lyr(
        "smoke",
        "Smoke",
        risk.driver === "Smoke",
        String(c.smoke.count),
        `<span class="qa nu">fires &lt;100 km</span> <b>${SMOKE_WORD[smokeLvl]} burning</b>`,
        sub,
        scaleBar(Math.min(c.smoke.count, 100) / 100),
      ),
    );
  }
  if (c.rain && (c.rain.probability_pct != null || c.rain.precipitation_mm != null)) {
    const mm = c.rain.precipitation_mm;
    if (c.rain.probability_pct != null) {
      strata.push(
        lyr(
          "rain",
          "Rain",
          false,
          `${c.rain.probability_pct}%`,
          '<span class="qa">chance of rain</span>',
          mm ? `${mm} mm falling now` : "",
          scaleBar(c.rain.probability_pct / 100, true),
        ),
      );
    } else {
      strata.push(lyr("rain", "Rain", false, String(mm), '<span class="qa nu">mm</span> <b>now</b>', ""));
    }
  }

  const body = `
  <article class="cx">
    <p class="coord">${c.location.lat}°N&nbsp;&nbsp;${c.location.lon}°E</p>
    <h1 class="loc" data-ll="${c.location.lat},${c.location.lon}">${place}</h1>
    <p class="when">the sky over this spot · updated ${relTime(c.air_as_of ?? c.as_of)}</p>
    ${c.warnings?.length ? c.warnings.map(renderWarning).join("") : ""}
    <section class="amb">
      <p class="amb-eye">${icon(DRIVER_KEY[risk.driver] ?? "clear")}<span>Ambient · for ${esc(PERSONA_LABEL[risk.persona])}</span></p>
      <p class="amb-head">${head}</p>
      <p class="amb-say">${esc(ambientMeaning(risk))}</p>
      ${also ? `<p class="amb-also">${icon("users")}${esc(also)}</p>` : ""}
      <nav class="who" aria-label="Who is this for">${pills}</nav>
    </section>
    <dl class="strata">${strata.join("")}</dl>
    <footer>
      <p class="attr">${esc(c.attribution)}</p>
      <p class="disc">${esc(c.disclaimer)}</p>
      <p class="raw"><a href="/c/${slug}.json">JSON</a> · <a href="/c/${slug}.md">Markdown</a> · <a href="/c/${slug}.png">PNG</a> · <a href="/embed/${slug}">Embed</a> · <a href="/c/${slug}?kiosk">Display</a></p>
      <p class="cxback"><a href="/">← Look up another place</a></p>
    </footer>
  </article>`;

  const css = CONDITIONS_CSS + `\n:root{--cond:${condColor}}`;
  const desc = `${c.place ?? stationCity ?? slug}: ${ambientMeaning(risk)} Air, heat, rain, UV, dust, smoke and any official warning over this spot, with the single worst hazard named for you.`;
  // schema.org Dataset: credits mugilu + the licence, points at the machine-readable
  // siblings (the "built on it" signal in structured data; aids answer-engine pickup).
  const placeName = c.place ?? stationCity ?? slug;
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
            creator: { "@type": "Organization", name: "mugilu", url: "https://mugilu.live" },
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
              { "@type": "ListItem", position: 1, name: "mugilu", item: "https://mugilu.live" },
              { "@type": "ListItem", position: 2, name: placeName, item: canonical },
            ],
          },
        ],
      })
    : undefined;
  return shell(
    `${place}: mugilu`,
    body + PLACE_RECORDER,
    css,
    desc,
    canonical,
    dataset,
    canonical ? `${canonical}.png` : HOME_OG,
  );
}

/** Short IST stamp, e.g. "14:32 IST · 27 Jun". The time travels on embeds/PNGs. */
function istTime(iso: string): string {
  return (
    new Date(iso).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }) +
    " IST · " +
    new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })
  );
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
:root{--ink:#0f172a;--muted:#64748b;--bg:#f8fafc;--card:#fff;--line:#e2e8f0;--serif:Georgia,'Iowan Old Style','Palatino Linotype',Palatino,Cambria,serif;--sans:ui-sans-serif,-apple-system,system-ui,sans-serif}
@media(prefers-color-scheme:dark){:root{--ink:#e2e8f0;--muted:#94a3b8;--bg:#0b1220;--card:#111827;--line:#1f2937}}
body{font:14px/1.5 var(--sans);color:var(--ink);background:transparent;padding:8px}
.card{display:block;text-decoration:none;color:var(--ink);background:linear-gradient(160deg,color-mix(in srgb,var(--cond) 20%,var(--card)),var(--card) 72%);border:1px solid color-mix(in srgb,var(--cond) 30%,var(--line));border-radius:16px;padding:16px 18px;max-width:460px;margin:0 auto}
.etop{display:flex;justify-content:space-between;align-items:center;margin:0 0 .6rem}
.eplace{font-weight:700;font-size:1.05rem;letter-spacing:-.01em}
.ebrand{color:var(--muted);font-size:.8rem;font-weight:600;display:flex;align-items:center;gap:.3rem}
.ebrand svg{width:15px;height:15px;vertical-align:-2px}
.eamb{display:flex;align-items:center;gap:.5rem;font-family:var(--serif);font-size:1.35rem;font-weight:600;letter-spacing:-.01em;color:var(--cond);margin:0 0 .15rem}
.eamb .dot{width:10px;height:10px;border-radius:50%;background:var(--cond);flex:none}
.esay{color:var(--ink);font-size:.92rem;margin:0 0 .85rem}
.ereads{display:flex;gap:18px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:.75rem}
.eread{display:flex;flex-direction:column}
.eread b{font-size:1.2rem;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.eread span{font-size:.66rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.efoot{display:flex;justify-content:space-between;color:var(--muted);font-size:.74rem;margin:.85rem 0 0}
.ecode{max-width:460px;margin:14px auto 0;font-size:.82rem;color:var(--muted)}
.ecode summary{cursor:pointer;font-weight:600;color:var(--ink)}
.ecode pre{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px;overflow:auto;font-size:.72rem;white-space:pre-wrap;word-break:break-all}
.framed .ecode{display:none}
`;

// ── Wall-display / kiosk view ──────────────────────────────────────────────
// Full-bleed, glanceable, self-refreshing. `?kiosk` on any /c URL renders this
// instead of the normal page, reusing the same Ambient + layer data. One fluid
// layout (vmin-sized, no color-mix so older TV browsers cope) scales 720p to 4K
// in both landscape and portrait. A venue just opens the URL on a screen and
// full-screens it; a corner QR sends passers-by to the same place on their phone.
const KIOSK_CSS = `
.bar,.foot{display:none}
html,body{height:100%;overflow:hidden;background:#080d18}
.k{position:fixed;inset:0;display:flex;flex-direction:column;gap:2.4vmin;padding:4.4vmin 4.8vmin;color:#e7ecf3;font-family:var(--sans),system-ui,sans-serif}
.k::before{content:"";position:absolute;inset:0;background:radial-gradient(120% 90% at 100% 0%,var(--cond),transparent 62%);opacity:.16;pointer-events:none}
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
.kalso{display:flex;align-items:center;gap:1.2vmin;margin-top:1.8vmin;font-size:2.8vmin;color:var(--cond)}
.kalso svg{width:3vmin;height:3vmin;flex:none}
.ktiles{display:flex;gap:2vmin}
.kt{flex:1;display:flex;flex-direction:column;gap:.4vmin;padding:1.8vmin 2.2vmin;border-radius:1.6vmin;background:#0f1626;border:.3vmin solid #1c2740}
.kt.on{border-color:var(--cond)}
.kt.on .kt-n{color:var(--cond)}
.kt-l{font-size:2vmin;letter-spacing:.1em;text-transform:uppercase;color:#8b97a8}
.kt-n{font-size:6.2vmin;font-weight:700;line-height:1}
.kt-w{font-size:2.4vmin;color:#aeb9c8}
.kfoot{display:flex;justify-content:space-between;align-items:flex-end;gap:2vmin}
.kbrand{font-size:3vmin;font-weight:700;color:#38bdf8}
.kqr{display:flex;align-items:center;gap:1.6vmin}
.kqr svg{width:11vmin;height:11vmin;background:#fff;border-radius:1vmin;padding:.7vmin}
.kqrl{font-size:1.9vmin;line-height:1.2;color:#8b97a8;text-align:right}
@media (orientation:portrait){
  .k{gap:2.6vmin;padding:5.5vmin 5vmin}
  .kname{font-size:7vmin}.kclock #clk{font-size:6vmin}
  .khead{font-size:10vmin}.ksay{font-size:4.6vmin;max-width:24ch}
  .ktiles{flex-wrap:wrap;gap:1.6vmin}.kt{flex:1 1 42%;padding:1.8vmin 2vmin}.kt-n{font-size:6vmin}
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

const KIOSK_JS = `(function(){
var clkI,agoI,refT,vbT,n=0;
var verbs=['Reading the sky','Checking the air','Gauging the heat','Watching for warnings','Catching the wind','Looking up'];
function p(x){return x<10?'0'+x:''+x}
function clock(){var c=document.getElementById('clk');if(c){var d=new Date();c.textContent=p(d.getHours())+':'+p(d.getMinutes());}}
function ago(){var a=document.getElementById('ago');if(!a)return;var t=a.getAttribute('data-t');if(!t)return;var s=Math.max(0,(Date.now()-new Date(t).getTime())/1000);a.textContent=s<90?'just now':s<3600?Math.round(s/60)+' min ago':s<86400?Math.round(s/3600)+' h ago':Math.round(s/86400)+' d ago';}
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

export function renderKioskPage(c: Conditions, persona: Persona, canonical: string, qr: string): string {
  const risk = ambientRisk(c, persona);
  const slug = `${c.location.lat},${c.location.lon}`;
  const place = c.place ? esc(c.place) : c.air?.station?.city ? esc(c.air.station.city) : slug;
  const condColor = RISK_COLOR[risk.band];
  const head =
    risk.band === "low"
      ? '<span class="b">All clear.</span>'
      : `<span class="b">${RISK_LABEL[risk.band]}</span> ${COND_NOUN[risk.driver] ?? "sky"}.`;

  const tile = (label: string, value: string, word: string, on: boolean, color = "") =>
    `<div class="kt${on ? " on" : ""}"><span class="kt-l">${label}</span><span class="kt-n">${value}</span><span class="kt-w"${color ? ` style="color:${color}"` : ""}>${esc(word)}</span></div>`;
  const tiles: string[] = [];
  if (c.air?.aqi != null)
    tiles.push(
      tile(
        "Air",
        String(c.air.aqi),
        BAND_LABEL[c.air.band ?? "unknown"] ?? "n/a",
        risk.driver === "Air",
        BAND_COLOR[c.air.band ?? "unknown"] ?? BAND_COLOR.unknown,
      ),
    );
  if (c.heat?.apparent_c != null)
    tiles.push(
      tile(
        "Heat",
        `${round(c.heat.apparent_c)}°`,
        heatPhrase(c.heat.apparent_c, c.heat.wet_bulb_c),
        risk.driver === "Heat",
      ),
    );
  if (c.uv?.index != null)
    tiles.push(tile("UV", String(Math.round(c.uv.index)), uvWord(c.uv.index), risk.driver === "UV"));
  if (c.dust?.dust_ug_m3 != null)
    tiles.push(
      tile("Dust", String(Math.round(c.dust.dust_ug_m3)), dustWord(c.dust.dust_ug_m3), risk.driver === "Dust"),
    );
  if (c.rain?.probability_pct != null)
    tiles.push(tile("Rain", `${Math.round(c.rain.probability_pct)}%`, "rain chance", risk.driver === "Rain"));

  const w0 = c.warnings?.[0];
  const warn = w0
    ? `<div class="kwarn">${icon("warn")}<span><b>${esc(w0.event)}</b>${w0.until ? ` · until ${esc(w0.until)}` : ""} · ${esc(w0.issuer)}${c.warnings!.length > 1 ? ` · +${c.warnings!.length - 1} more` : ""}</span></div>`
    : "";

  const body = `
  <div class="k" style="--cond:${condColor}">
    <header class="ktop">
      <div><span class="kname">${place}</span><span class="kcoord">${c.location.lat}°N&nbsp;&nbsp;${c.location.lon}°E</span></div>
      <div class="kclock"><span id="clk">--:--</span><span class="kago">updated <span id="ago" data-t="${c.air_as_of ?? c.as_of}">just now</span></span></div>
    </header>
    ${warn}
    <main class="kamb">
      <p class="keye">${icon(DRIVER_KEY[risk.driver] ?? "clear")}<span>Ambient · for ${esc(PERSONA_LABEL[risk.persona])}</span></p>
      <p class="khead">${head}</p>
      <p class="ksay">${esc(ambientMeaning(risk))}</p>
    </main>
    <section class="ktiles">${tiles.join("")}</section>
    <footer class="kfoot">
      <span class="kbrand">mugilu.live</span>
      <div class="kqr">${qr}<span class="kqrl">scan for this<br>on your phone</span></div>
    </footer>
  </div>
  <div class="kload" aria-hidden="true"><div class="kspin"></div><p class="kverb">Reading the sky…</p></div>
  <script>${KIOSK_JS}</script>`;

  const css = KIOSK_CSS;
  const desc = `${c.place ?? slug}: a live wall-display of the whole sky over this spot, self-refreshing.`;
  return shell(`${place} on a screen: mugilu`, body, css, desc, canonical, undefined, `${canonical}.png`);
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
.dhow{margin:.1rem 0 .5rem 1.1rem}.dhow li{margin:.35rem 0;line-height:1.5}`;

// The "put it on a screen" builder: pick a place (+ who it's for), open the
// self-refreshing kiosk view. Search routes through /go?kiosk=1 (zero JS).
export function renderDisplayBuilder(persona: Persona = "everyone"): string {
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
  const pills = PERSONAS.map((p) => {
    const href = p === "everyone" ? "/display" : `/display?as=${p}`;
    return `<a${p === persona ? ' class="on"' : ""} href="${href}">${esc(PERSONA_LABEL[p])}</a>`;
  }).join("");
  const tiles = popular.map(([s, n]) => `<a class="dtile" href="/c/${s}?kiosk${asQ}">${esc(n)}</a>`).join("");
  const body = `
  <article class="ax">
    <h1 class="ahero">Put mugilu<br>on a screen.</h1>
    <p class="alead">Turn any display into a live, self-updating read of the sky. Pick a place, open it on the screen, press full-screen. It refreshes itself, and a corner QR sends passers-by to the same place on their phone.</p>

    <p class="ah">${icon("users")}<span>Weight it for who is nearby</span></p>
    <nav class="dpers" aria-label="Persona">${pills}</nav>

    <p class="ah">${icon("pin")}<span>Pick a place</span></p>
    <form class="dsearch" action="/go" method="get">
      <input type="hidden" name="kiosk" value="1">
      ${persona !== "everyone" ? `<input type="hidden" name="as" value="${persona}">` : ""}
      <input name="q" placeholder="Any place in India" autocomplete="off" autocapitalize="off">
      <button type="submit">Open display</button>
    </form>
    <div class="dgrid">${tiles}</div>

    <p class="ah">${icon("layers")}<span>How it runs</span></p>
    <ol class="dhow">
      <li>Open the display link in the screen's browser: a smart TV, a cheap streaming stick, or an old tablet in a stand.</li>
      <li>Press full-screen (F11 with a keyboard, or the browser's full-screen control).</li>
      <li>Leave it. It refreshes on its own, keeps the screen awake, and if the network blips it holds the last reading and recovers.</li>
      <li>For an always-on unattended screen, point a kiosk-browser app (for example Fully Kiosk on Android) at the same link so it auto-starts.</li>
    </ol>
    <p class="abuild">The display link is just <b>/c/{place}?kiosk</b>, so you can bookmark or script it. Add <b>?as=elderly</b> (or asthma, child, outdoor, heart) to weight the read for a clinic, school or worksite.</p>
    <p class="aback"><a href="/">← back to mugilu</a></p>
  </article>`;
  return shell(
    "Put mugilu on a screen: mugilu",
    body,
    ABOUT_CSS + DISPLAY_CSS,
    "Turn any wall display or kiosk into a live, self-refreshing read of India's sky. Pick a place, open it on the screen, full-screen it. It updates itself.",
    `${SITE}/display`,
    undefined,
    HOME_OG,
  );
}

export function renderEmbed(c: Conditions, persona: Persona, siteUrl: string): string {
  const risk = ambientRisk(c, persona);
  const condColor = RISK_COLOR[risk.band];
  const slug = `${c.location.lat},${c.location.lon}`;
  const stationCity = c.air?.station?.city;
  const place = c.place ? esc(c.place) : stationCity ? esc(stationCity) : slug;
  const head = risk.band === "low" ? "All clear" : `${RISK_LABEL[risk.band]} ${COND_NOUN[risk.driver] ?? "sky"}`;

  const reads: string[] = [];
  if (c.air?.aqi != null)
    reads.push(
      `<div class="eread"><b style="color:${BAND_COLOR[c.air.band] ?? BAND_COLOR.unknown}">${c.air.aqi}</b><span>AQI ${BAND_LABEL[c.air.band] ?? ""}</span></div>`,
    );
  if (c.heat?.apparent_c != null)
    reads.push(`<div class="eread"><b>${round(c.heat.apparent_c)}°</b><span>feels like</span></div>`);
  if (c.uv?.index != null)
    reads.push(`<div class="eread"><b>${Math.round(c.uv.index)}</b><span>UV ${uvWord(c.uv.index)}</span></div>`);
  if (c.dust?.dust_ug_m3 != null)
    reads.push(
      `<div class="eread"><b>${Math.round(c.dust.dust_ug_m3)}</b><span>dust ${dustWord(c.dust.dust_ug_m3)}</span></div>`,
    );
  if (c.smoke && smokeLevel(c.smoke) != null)
    reads.push(`<div class="eread"><b>${c.smoke.count}</b><span>fires &lt;100km</span></div>`);

  const iframe = `<iframe src="${siteUrl}/embed/${slug}" width="480" height="240" style="border:0;border-radius:16px" title="mugilu: conditions at ${place}" loading="lazy"></iframe>`;
  const imgtag = `<img src="${siteUrl}/c/${slug}.png" alt="mugilu: conditions at ${place}" width="600">`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${place}: mugilu</title><style>${EMBED_CSS}\n:root{--cond:${condColor}}</style></head><body>
  <a class="card" href="${siteUrl}/c/${slug}" target="_blank" rel="noopener">
    <div class="etop"><span class="eplace">${place}</span><span class="ebrand">${CLOUD} mugilu</span></div>
    <div class="eamb"><i class="dot"></i>${esc(head)}</div>
    <div class="esay">${esc(ambientMeaning(risk))}</div>
    <div class="ereads">${reads.join("")}</div>
    <div class="efoot"><span>as of ${esc(istTime(c.as_of))}</span><span>mugilu.live →</span></div>
  </a>
  <details class="ecode"><summary>Embed this</summary>
    <p>Live widget (iframe):</p><pre>${esc(iframe)}</pre>
    <p>Or a timestamped image:</p><pre>${esc(imgtag)}</pre>
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
export function renderAbout(): string {
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
      a: "Air from CPCB, Airnet (CSTEP) and Aurassure via the Open Air Quality broker and OpenAQ; weather, heat, UV and dust from Open-Meteo; official warnings from NDMA and IMD via SACHET; geography from bharatlas. Each source keeps its own licence, and mugilu credits all of them.",
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
  const body = `
  <article class="ax">
  <h1 class="ahero">The open sky of India,<br>one coordinate at a time.</h1>
  <p class="alead">A whole-sky view for people, and shared infrastructure for anyone building on top of it.</p>

  <p class="ah">${icon("compass")}<span>Why mugilu</span></p>
  <p class="atext">For years, people across India have made the sky legible one piece at a time: a map of one city's air, a thread about a heatwave, a chart of last year's monsoon. Brilliant work, but scattered, and easy to lose by the next season.</p>
  <p class="atext"><a href="https://www.sathyasankaran.com">Sathya Sankaran</a> wanted to stop starting from scratch each time: to pull the whole sky together into one view, every hazard over any point in India, and then hand that out as infrastructure, so the next map, story or alert doesn't have to begin from nothing.</p>
  <p class="atext">That is mugilu.</p>

  <p class="ah">${icon("users")}<span>For people</span></p>
  <p class="atext">Type a place. See what the sky is doing to you right now: air, heat (and how survivable it really is), rain, sun and dust, alongside any official warning over that spot. Then one plain line, the single worst thing for you, whether you have asthma, work outdoors, or are minding a child or an older parent. No sign-up, no jargon.</p>

  <p class="ah" id="build">${icon("code")}<span>Build on it</span></p>
  <p class="atext">mugilu is meant to be built on, not just looked at. Every reading is also open, machine-readable data, so you can put the whole sky behind your own map, story, dashboard or alert, and spend your time on the part that matters: the telling, and the action.</p>
  <ul class="alist">
    <li>${icon("code")}<span class="t"><b>For AI agents</b>: an MCP server at <a href="/mcp">/mcp</a> (tools for conditions, place search, nearest stations, warnings and the national picture; plus resources and prompts). Listed in <a href="/llms.txt">llms.txt</a>.</span></li>
    <li>${icon("layers")}<span class="t"><b>For developers</b>: a documented <a href="/openapi.json">OpenAPI spec</a>, and every reading as <a href="/c/12.97,77.59.json">JSON</a> or <a href="/c/12.97,77.59.md">Markdown</a>.</span></li>
    <li>${icon("pin")}<span class="t"><b>Embed it</b>: a live card in one line of HTML (<a href="/embed/12.97,77.59">/embed/{lat},{lon}</a>), or a <a href="/c/12.97,77.59.png">snapshot image</a>.</span></li>
    <li>${icon("sun")}<span class="t"><b>Put it on a screen</b>: a self-refreshing wall display or kiosk for a clinic, school or lobby, set up at <a href="/display">/display</a>.</span></li>
  </ul>
  <p class="abuild">Add <b>?ref=your-app</b> to any API or embed URL to identify your app (aggregate, domain-level). It's all free and keyless.</p>

  <p class="ah">${icon("layers")}<span>Where it comes from</span></p>
  <p class="atext">mugilu owns no sensors and runs no forecasts. It stands on others' work and credits them: <b>CPCB</b> and <b>OpenAQ</b> for air, <b>Open-Meteo</b> for weather, <b>NDMA / IMD</b> (via SACHET) for warnings, and <b>bharatlas</b> for the map of India. The code is open under the MIT licence; the data keeps each source's own terms.</p>

  <p class="ah">${icon("heart")}<span>Why it's free</span></p>
  <p class="atext">The sky over you is a commons. Knowing it shouldn't cost money or sit locked inside someone's app. mugilu is <b>non-commercial, for good</b>, the third in a small set of public tools alongside <a href="https://bharatlas.com">bharatlas</a> and <a href="https://mdshare.live">mdshare</a>.</p>

  <p class="ah">${icon("compass")}<span>Common questions</span></p>
  ${faqs.map((f) => `<p class="atext"><b>${f.q}</b><br>${f.a}</p>`).join("\n  ")}

  <div class="builtby">
    <a href="https://urbanmorph.com" aria-label="Urban Morph"><img src="${UM_ICON}" alt="Urban Morph" width="54" height="60"></a>
    <div>
      <p class="bb-by">Built by <a href="https://urbanmorph.com">urbanmorph</a>, led by <a href="https://www.sathyasankaran.com">Sathya Sankaran</a>.</p>
      <a class="star" href="https://github.com/urbanmorph/mugilu">${GH_MARK} Source on GitHub, drop a star if it's useful</a>
    </div>
  </div>

  <p class="adisc">Informational only, not for medical, emergency, or safety-critical decisions. For official warnings, consult NDMA and IMD.</p>
  <p class="aback"><a href="/">← back to mugilu</a></p>
  </article>`;
  return shell(
    "About: mugilu",
    body,
    ABOUT_CSS,
    "Why mugilu exists: one whole-sky view for any point in India, built as open infrastructure others can build on. The origin story, the sources, and how to use the data.",
    `${SITE}/about`,
    ld({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    }),
    HOME_OG,
  );
}

/** Terms & attribution: the disclaimer in full, plus per-source credit/licence.
 *  The disclaimer that ships in every API response points here. */
export function renderTerms(): string {
  const body = `
  <h1 class="ahero">Terms &amp; attribution</h1>
  <p class="alead">mugilu stitches together others' open data for any point in India. The stitch and the code are ours; the data is theirs, and stays under their terms.</p>

  <h2 class="ah">No warranty</h2>
  <p class="amuted"><b>Informational and educational only, not for medical, emergency, or safety-critical decisions.</b> Readings are a mix of measured and modelled values and may be wrong, stale, or missing. There is no accuracy or availability guarantee. For official hazard warnings, consult <b>NDMA</b> and <b>IMD</b> directly.</p>

  <h2 class="ah">Licence</h2>
  <p class="alead2">The mugilu <b>code is MIT</b> (see the <a href="https://github.com/urbanmorph/mugilu">repository</a>). The <b>data is not relicensed</b>: each upstream source keeps its own licence and attribution. mugilu is <b>non-commercial, for individuals</b>, and is not affiliated with any data provider.</p>

  <h2 class="ah">Sources &amp; credit</h2>
  <ul class="alist on">
    <li>${icon("air")}<span class="t"><b>Air</b>: CPCB (Govt. of India), Airnet (CSTEP), and Aurassure, via the <a href="https://oaq.notf.in">OAQ</a> broker; plus OpenAQ.</span></li>
    <li>${icon("heat")}<span class="t"><b>Heat, rain, UV, dust, wind</b>: <a href="https://open-meteo.com">Open-Meteo</a>, licensed CC-BY 4.0.</span></li>
    <li>${icon("warn")}<span class="t"><b>Official warnings</b>: NDMA / IMD via SACHET.</span></li>
    <li>${icon("smoke")}<span class="t"><b>Fire / crop-burn smoke</b>: NASA FIRMS (VIIRS).</span></li>
    <li>${icon("pin")}<span class="t"><b>Geography &amp; place names</b>: <a href="https://bharatlas.com">bharatlas</a>.</span></li>
    <li>${icon("heart")}<span class="t"><b>Health impact</b>: years of life lost uses the <a href="https://aqli.epic.uchicago.edu">AQLI</a> methodology (U Chicago EPIC).</span></li>
  </ul>
  <p class="alead2">Each reading carries its own attribution line inline, so credit travels with the data wherever it goes.</p>

  <p class="adisc">A digital commons by <a href="https://urbanmorph.com">urbanmorph</a>, alongside <a href="https://bharatlas.com">bharatlas</a> and <a href="https://mdshare.live">mdshare</a>.</p>
  <p class="aback"><a href="/">← back to mugilu</a></p>`;
  return shell(
    "Terms & attribution: mugilu",
    body,
    ABOUT_CSS,
    "mugilu's sources, licences and attribution: open data from CPCB, Open-Meteo, NDMA/IMD and NASA FIRMS, each keeping its own terms. Informational only, not for safety-critical use.",
    `${SITE}/terms`,
    undefined,
    HOME_OG,
  );
}

/** A real 404 page (the catch-all used to return 200 with a debug string). */
export function renderNotFound(): string {
  const body = `
  <h1 class="ahero">Not here.</h1>
  <p class="alead">That page doesn't exist on mugilu. Look up a place instead, or give it a coordinate like <a href="/c/12.97,77.59">/c/12.97,77.59</a>.</p>
  <p class="aback"><a href="/">← back to mugilu</a></p>`;
  return shell("Not found: mugilu", body, ABOUT_CSS, DEFAULT_DESC, undefined, undefined, HOME_OG);
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
export function renderMethodology(): string {
  const row = (h: string, c1: string, c2: string, c3: string) =>
    `<tr><td>${h}</td><td>${c1}</td><td>${c2}</td><td>${c3}</td></tr>`;
  const body = `
  <article class="ax">
  <h1 class="ahero">How the Ambient read works</h1>
  <p class="alead">mugilu names the single worst thing the sky is doing to you right now, weighted for who you are. It's a glass box: the thresholds below are public and come from CPCB, IMD, WHO, NASA, the Australian BoM and the AQLI. Informational only, never medical or safety advice.</p>

  <h2 class="ah">One read, never an average</h2>
  <p class="atext">Each hazard is scored 0–3 (none · caution · high · severe). We surface the <b>worst</b> one, named in plain words ("Severe smoke", "High heat"), with one sentence on what to do. Averaging would hide the thing that matters, so we never average.</p>

  <h2 class="ah">For who you are</h2>
  <p class="atext">Pick a vulnerability (asthma, older adults, children, outdoor workers, heart) and the hazards that group feels more keenly are bumped up one level (so an asthmatic sees moderate air as "high"). When your trigger isn't the headline but is still elevated, a second line surfaces it ("also watch: air is high"). The persona is a toggle <b>you</b> choose: never inferred, never stored.</p>

  <h2 class="ah">The thresholds</h2>
  <div class="mtab-wrap">
  <table class="mtab">
  <thead><tr><th>Hazard</th><th>Caution</th><th>High</th><th>Severe</th></tr></thead>
  <tbody>
  ${row("Air (AQI)", "101–200", "201–300", "301+")}
  ${row("Heat (feels-like)", "35°", "40°", "45°")}
  ${row("Heat (wet-bulb)", "26°", "28°", "31°")}
  ${row("Heat (WBGT)", "30°", "32°", "35°")}
  ${row("Cold (feels-like)", "≤10°", "≤5°", "≤0°")}
  ${row("Wind (gusts, km/h)", "40", "62", "88")}
  ${row("Fog (visibility, m)", "&lt;1000", "&lt;500", "&lt;200")}
  ${row("Smoke (fires &lt;100 km)", "3+", "25+", "60+")}
  ${row("UV (index)", "6–10", "-", "11+")}
  ${row("Dust (µg/m³)", "80", "150", "500")}
  </tbody>
  </table>
  </div>
  <p class="atext">Heat takes the worst of feels-like, wet-bulb and WBGT. The persona toggle then bumps a sensitive hazard up one level. Bands come from CPCB (air), IMD and the Australian BoM (heat / cold / wind), WHO (UV) and NASA FIRMS (smoke); the full logic is the open <a href="https://github.com/urbanmorph/mugilu/blob/main/apps/worker/src/score.ts">score.ts</a>, and every layer's source and licence is on <a href="/terms">terms &amp; attribution</a>.</p>

  <p class="adisc">Informational only, not for medical, emergency, or safety-critical decisions. For official warnings, consult NDMA and IMD.</p>
  <p class="aback"><a href="/">← back to mugilu</a></p>
  </article>`;
  return shell(
    "How it works: mugilu",
    body,
    ABOUT_CSS + METHOD_CSS,
    "How mugilu's Ambient read is computed: the public, auditable thresholds for air, heat, cold, wind, fog, smoke, UV and dust, and how the persona weighting works.",
    `${SITE}/methodology`,
    undefined,
    HOME_OG,
  );
}

const WLIST_CSS = `
.wgen{font:500 .78rem var(--mono);color:var(--muted);margin:.3rem 0 1.5rem}
.wlist{list-style:none;margin:0;padding:0}
.wlist li{border-top:1px solid var(--hair);padding:1rem 0}
.wcat{display:inline-block;font:600 .7rem var(--sans);letter-spacing:.06em;text-transform:uppercase;color:var(--sky);margin:0 0 .25rem}
.whead{font-size:1.02rem;line-height:1.4;font-weight:600;margin:0 0 .3rem}
.wmeta{color:var(--muted);font-size:.82rem}.wmeta a{color:var(--sky)}
.wempty{color:var(--muted);font-size:1.05rem;margin:1.2rem 0}
`;

/** The national active-warnings list: surfaces the SACHET feed mugilu polls
 *  and archives, so the warning "moat" is readable, not just point-queried on /c. */
export function renderWarningsPage(snap: WarningsSnapshot | null): string {
  const items =
    snap && snap.alerts.length
      ? `<ul class="wlist">${snap.alerts
          .map(
            (a) =>
              `<li><div class="wcat">${esc(a.category || "Alert")}</div><div class="whead">${esc(a.headline || "Warning")}</div><div class="wmeta">${esc(a.issuer || "")}${a.sent ? ` · ${esc(a.sent)}` : ""}${a.link ? ` · <a href="${esc(a.link)}" rel="noopener">CAP</a>` : ""}</div></li>`,
          )
          .join("")}</ul>`
      : `<p class="wempty">No active national alerts right now.</p>`;
  const body = `
  <article class="ax">
    <h1 class="ahero">Active warnings</h1>
    <p class="alead">${snap ? snap.count : 0} official NDMA / IMD alerts across India, right now.</p>
    <p class="wgen">${snap ? `as of ${esc(istTime(snap.generated_at))} · via SACHET` : ""}</p>
    ${items}
    <p class="adisc">Informational only, not for medical, emergency, or safety-critical decisions. For official warnings, consult NDMA and IMD directly. mugilu mirrors the SACHET feed and keeps an archive of every alert.</p>
    <p class="aback"><a href="/">← back to mugilu</a></p>
  </article>`;
  return shell(
    "Active warnings: mugilu",
    body,
    ABOUT_CSS + WLIST_CSS,
    "Active NDMA / IMD warnings across India right now, mirrored from the SACHET feed. Available as HTML, JSON and Markdown.",
    `${SITE}/warnings`,
    undefined,
    HOME_OG,
  );
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
.acwrap{position:relative}
.ac{list-style:none;margin:4px 0 0;padding:4px;position:absolute;left:0;right:0;z-index:9;background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.14)}
.ac:empty{display:none}
.ac li{padding:9px 10px;border-radius:8px;cursor:pointer;font-size:.95rem}
.ac li span{color:var(--muted);font-size:.85rem}
.ac li.on,.ac li:hover{background:var(--bg)}
.shint{color:var(--muted);font-size:.86rem;line-height:1.5;margin:-.2rem 0 .9rem;max-width:46ch}.shint b{color:var(--ink);font-weight:600}
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
  meta?: { gridAsOf?: string; airAsOf?: string; popular?: { label: string; lat: number; lon: number }[] },
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
    links.push(`<a href="/c/${lat},${lon}">${esc(name)}</a>`);
  };
  for (const p of meta?.popular ?? []) addPlace(shortPlace(p.label), p.lat, p.lon);
  for (const c of CITIES) addPlace(c.name, c.lat, c.lon);
  const cityLinks = links.join(" · ");
  const notice = notFound ? `<p class="notice">Couldn't find "${esc(notFound)}". Try a city or place name.</p>` : "";

  const body = `
  <h1 class="hero">What's it like outside, right now?</h1>
  <p class="tagline">The open sky of India, one coordinate at a time.</p>
  <p class="covers"><span>${icon("air")} air</span><span>${icon("heat")} heat</span><span>${icon("rain")} rain</span><span>${icon("sun")} UV</span><span>${icon("dust")} dust</span><span>${icon("warn")} warnings</span></p>
  <div class="acwrap">
    <form class="search" action="/go" method="get" role="search">
      <input id="q" name="q" type="search" placeholder="A place in India, or lat,lon" autocomplete="off" autofocus aria-label="Look up a place in India">
      <button type="submit">Go</button>
    </form>
    <ul id="ac" class="ac" role="listbox"></ul>
  </div>
  <p class="shint">Type any place in India, in any language (<span class="exq">ಬೆಂಗಳೂರು · दिल्ली · சென்னை</span>), to see <b>its sky</b>: air, heat, rain, dust. Not a map.</p>
  <button id="nearme" class="nearme" type="button" hidden>${icon("pin")} Use my location</button>
  ${notice}
  ${highlights ? renderHero(highlights, meta) : ""}
  <div id="yp" class="yourplaces" hidden></div>
  <p class="cities">Popular: ${cityLinks}</p>
  <script>
  var b=document.getElementById('nearme'),label=b.textContent;
  if(navigator.geolocation){b.hidden=false;b.onclick=function(){b.textContent='Locating…';navigator.geolocation.getCurrentPosition(function(p){location.href='/c/'+p.coords.latitude.toFixed(4)+','+p.coords.longitude.toFixed(4);},function(){b.textContent='Location unavailable';});};}
  addEventListener('pageshow',function(){b.textContent=label;});
  var q=document.getElementById('q'),ac=document.getElementById('ac'),items=[],ix=-1,t,seq=0;
  function esc(s){return String(s).replace(/[<&>]/g,function(c){return c==='<'?'&lt;':c==='>'?'&gt;':'&amp;';});}
  function hide(){ac.innerHTML='';items=[];ix=-1;}
  function paint(){for(var i=0;i<ac.children.length;i++)ac.children[i].className=i===ix?'on':'';if(items[ix])pf('/c/'+items[ix].lat+','+items[ix].lon);}
  function go(i){var x=items[i];if(x)location.href='/c/'+x.lat+','+x.lon;}
  q.addEventListener('input',function(){var v=q.value.trim();clearTimeout(t);if(v.length<2){hide();return;}var s=++seq;t=setTimeout(function(){fetch('/suggest?q='+encodeURIComponent(v)).then(function(r){return r.json();}).then(function(d){if(s!==seq)return;items=d.suggestions||[];ix=-1;ac.innerHTML=items.map(function(x,i){return '<li role="option" data-i="'+i+'"><b>'+esc(x.label)+'</b>'+(x.sublabel?' <span>'+esc(x.sublabel)+'</span>':'')+'</li>';}).join('');if(items[0])pf('/c/'+items[0].lat+','+items[0].lon);}).catch(function(){if(s===seq)hide();});},150);});
  q.addEventListener('keydown',function(e){if(!items.length)return;if(e.key==='ArrowDown'){ix=(ix+1)%items.length;e.preventDefault();paint();}else if(e.key==='ArrowUp'){ix=(ix-1+items.length)%items.length;e.preventDefault();paint();}else if(e.key==='Enter'&&ix>=0){e.preventDefault();go(ix);}else if(e.key==='Escape'){hide();}});
  ac.addEventListener('mousedown',function(e){var li=e.target.closest('li');if(li)go(+li.getAttribute('data-i'));});
  q.addEventListener('blur',function(){setTimeout(hide,150);});
  // Warm the edge + upstreams for a /c URL so the click lands instantly (dedup).
  function pf(u){pf.s=pf.s||{};if(pf.s[u])return;pf.s[u]=1;var l=document.createElement('link');l.rel='prefetch';l.href=u;document.head.appendChild(l);}
  ac.addEventListener('mouseover',function(e){var li=e.target.closest('li');if(li){var x=items[+li.getAttribute('data-i')];if(x)pf('/c/'+x.lat+','+x.lon);}});
  // Your places: recents + favourites from localStorage (first-party, no login).
  (function(){
    var K='mugilu:places',yp=document.getElementById('yp');if(!yp)return;
    function load(){try{return JSON.parse(localStorage.getItem(K))||[]}catch(e){return[]}}
    function save(L){try{localStorage.setItem(K,JSON.stringify(L))}catch(e){}}
    function nm(p){return p.name||p.label||(p.lat+', '+p.lon);}
    function ord(L){return L.slice().sort(function(a,b){return (b.fav?1:0)-(a.fav?1:0)||b.n-a.n||b.t-a.t});}
    function render(){
      var L=ord(load());
      if(!L.length){yp.hidden=true;return;}
      yp.hidden=false;
      yp.innerHTML='<h2>Your places</h2>'+L.map(function(p){return '<div class="pl" data-id="'+esc(p.id)+'"><button class="plfav'+(p.fav?' on':'')+'" data-a="fav" type="button" aria-pressed="'+(p.fav?'true':'false')+'" title="Favourite">'+(p.fav?'\\u2605':'\\u2606')+'</button><a href="/c/'+esc(p.lat)+','+esc(p.lon)+'">'+esc(nm(p))+'</a><button class="plx" data-a="ren" type="button" title="Rename">\\u270e</button><button class="plx" data-a="del" type="button" title="Remove">\\u00d7</button></div>';}).join('');
      L.slice(0,4).forEach(function(p){pf('/c/'+p.lat+','+p.lon);});
      if(L[0]&&!render.sr){render.sr=1;try{var sr=document.createElement('script');sr.type='speculationrules';sr.textContent=JSON.stringify({prerender:[{source:'list',urls:['/c/'+L[0].lat+','+L[0].lon]}]});document.head.appendChild(sr);}catch(e){}}
    }
    yp.addEventListener('click',function(e){
      var btn=e.target.closest('button[data-a]');if(!btn)return;
      var id=btn.closest('.pl').getAttribute('data-id'),a=btn.getAttribute('data-a');
      var L=load(),p=L.filter(function(x){return x.id===id})[0];if(!p)return;
      if(a==='fav')p.fav=!p.fav;else if(a==='ren'){var n=prompt('Name this place (e.g. Home, Office)',p.name||p.label||'');if(n===null)return;p.name=(n.trim()||undefined);}else if(a==='del')L=L.filter(function(x){return x.id!==id;});
      save(L);render();
    });
    render();
  })();
  </script>`;

  // schema.org WebSite + SearchAction (enables a search box in results; credits the publisher).
  const site = ld({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "mugilu",
    alternateName: "mugilu: the open sky of India",
    url: "https://mugilu.live",
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
  return shell("mugilu: India's open sky", body, HOME_CSS, DEFAULT_DESC, SITE, site, HOME_OG);
}
