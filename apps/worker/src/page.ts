import type { Conditions, Warning } from "./types";
import type { NationalHighlights } from "./highlights";
import { ambientRisk, ambientMeaning, PERSONAS, PERSONA_LABEL } from "./score";
import type { Persona, RiskBand } from "./score";

// The worker-rendered HTML pages. Layperson-first, mobile-first, self-contained
// (inline CSS, no framework). All pages share chrome via shell().
//
// ── Design language (one set, applied to EVERY page) ────────────────────────
// Editorial serif display (--serif) for headlines/leads; system sans (--sans)
// for data and labels; mono (--mono) for coordinate/format stamps; hairline
// rules (--hair); a condition- or sky-tinted atmospheric backdrop; and the
// inline Lucide-style line icons in ICON/icon() — never emoji. Tokens live in
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

const BAND_COLOR: Record<string, string> = {
  good: "#16a34a",
  satisfactory: "#84cc16",
  moderate: "#eab308",
  poor: "#f97316",
  vpoor: "#dc2626",
  severe: "#7f1d1d",
  unknown: "#9ca3af",
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

function heatPhrase(apparent: number, wetBulb?: number): string {
  if (wetBulb != null && wetBulb >= 28) return "dangerous humid heat";
  if (apparent >= 45) return "extreme heat";
  if (apparent >= 40) return "severe heat";
  if (apparent >= 35) return "very hot";
  return "warm";
}

function dustPhrase(d: number): string {
  if (d >= 500) return "severe dust";
  if (d >= 150) return "high dust";
  if (d >= 50) return "moderate dust";
  return "light dust";
}

/** The "right now in India" hero, heat- and dust-led (never air-led). */
function renderHero(h: NationalHighlights): string {
  const rows: string[] = [];
  if (h.hottest) {
    rows.push(
      `<a class="hl" href="/c/${h.hottest.lat},${h.hottest.lon}">${icon("heat")}Hottest: <b>${esc(h.hottest.name)}</b>, feels ${Math.round(h.hottest.apparent_c)}°, ${heatPhrase(h.hottest.apparent_c, h.hottest.wet_bulb_c)}</a>`,
    );
  }
  if (h.dustiest) {
    rows.push(
      `<a class="hl" href="/c/${h.dustiest.lat},${h.dustiest.lon}">${icon("dust")}Dustiest: <b>${esc(h.dustiest.name)}</b>, ${dustPhrase(h.dustiest.dust_ug_m3)}</a>`,
    );
  }
  return rows.length ? `<section class="hero-now"><h2>Right now in India</h2>${rows.join("")}</section>` : "";
}

const CLOUD =
  '<svg width="22" height="22" viewBox="0 0 64 64" aria-hidden="true" style="vertical-align:-4px">' +
  '<g fill="#0284c7"><rect x="14" y="35" width="36" height="13" rx="6.5"/>' +
  '<circle cx="24" cy="33" r="9"/><circle cx="37" cy="30" r="11"/><circle cx="46" cy="37" r="6.5"/></g></svg>';

// GitHub mark for the footer star CTA, and the UrbanMorph brand icon inlined as
// a tiny data URI (self-contained: no external request, no dependency on their site).
const GH_MARK =
  '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>';
const UM_ICON =
  "data:image/webp;base64,UklGRoQDAABXRUJQVlA4WAoAAAAQAAAAQgAASgAAQUxQSGABAAABkJNtW6U5rwQcLBIQsEk+CSMBCSOBLu0vAQcZCZ+DIIEuZai2fXPiTJkiIiYAAAL/HRD4b8FP/lMx2N1RCwMal3OvzH/u4xPru1yZrXtYZfsWV+F2gd0bRO4XuV/kfp77OR4gHSBwP1sOELmf4QHCCfIBHA8QTqAn4AHsCeQE/gThvzgPfCXg2y4KqSS870KgQsH3xaTmkCoJ+FjAD7lxVxjx9mOetKCWYWsMwNePWaYpVSiINT4GeHufUtAcawpbaiwvC0x52q4aBXcDyeyn+DbTkA20iWGKaUOsMcKkVR50SgM9TFrk6oE20MPoEhnd0kIP3GUB3wdtYTSwcZpioG1iFsDcOseNwN1EqgCAXDIsYKy2kTk4/D0oYbBJHX/rI4OyGQVX+sgwpjiMd2WR4jDTpiWyw1zzLKAG0+8yK2BFq1PUYlHRYSpY2MUyoETB6tcrNaXXhU2deIF4cTg/VlA4IP4BAAAwDwCdASpDAEsAPmEqkEYkIiGhLhLpIIAMCWgAxy4m3X55/Wfx452bgrvdh4X5LpYeJF0gPMB+wHrTehb0AP2K6zf0AP1G9MH9u/go/cT0gMwl/AD9KwRtq39DJthRE7/H373TUAJXNuytPYhPi8MfLHkJV50C4PGrb5fSD4WgzSjQAPh3RT0GeeeTA4yz+jQX+ee18m/jZVpp8lpybn+Tp/c4H/9Dg1zVx+/8YsvIDz27eD4nJgnR/9mGT7GBUr+atMN5idp9vfkv/dxusODKkUfkm7dc9OORlMEkdLOWb95Mv6Sr/FT3ky/pKm868ItysJf5pVPbP2/zTP/+tG4+lPY+QR2MaFA5FKAhAphAgPngo3P448Pg3dlyT5sgQ/DC2XOncFEuTYcuTY8vnDQY0Z4F1AgRwfuAqdKLE6QHZgBK6Xw5g1byAH3cLsY1KMv/d542Q73UdTBEWLf3/Vj9Q4amKbTs1XoUXRzBWE+Atwe+00idWo9294h0q/eZjD5I1GANDkIne1SB0Qb+NiQO8cRp1I4Hxjf4gQaeaqez9KoIlJhW4Bvg1IOxIx0IuWGi3qRnpMMGvfIzDdWPHD0t8m8/yhT42IhbFj3rfFDvvfGNMr/2Mo/BWrIvf9NccHkg6U8jqDPvuT7cTvc7S2vkJcs8etluA1LbC+AAAAA=";

const BASE_CSS = `
:root{--sky:#0284c7;--ink:#0f172a;--muted:#64748b;--bg:#f8fafc;--card:#fff;--line:#e2e8f0;--serif:Georgia,'Iowan Old Style','Palatino Linotype',Palatino,Cambria,serif;--sans:ui-sans-serif,-apple-system,system-ui,sans-serif;--mono:ui-monospace,SFMono-Regular,Menlo,monospace;--hair:color-mix(in srgb,var(--ink) 12%,transparent)}
@media(prefers-color-scheme:dark){:root{--ink:#e2e8f0;--muted:#94a3b8;--bg:#0b1220;--card:#111827;--line:#1f2937}}
*{box-sizing:border-box}html,body{margin:0}
body{font:16px/1.5 ui-sans-serif,-apple-system,system-ui,sans-serif;color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased}
.bar{display:flex;align-items:center;padding:14px 18px;border-bottom:1px solid var(--line)}
.brand{font-weight:700;letter-spacing:-.02em;color:var(--ink);text-decoration:none;font-size:1.1rem}
main{max-width:560px;margin:0 auto;padding:20px 18px 32px}
.foot{max-width:560px;margin:0 auto;padding:18px;color:var(--muted);font-size:.78rem;border-top:1px solid var(--line)}
.foot a{color:var(--muted)}
.ic{width:18px;height:18px;flex:none;vertical-align:-.18em}
`;

function shell(title: string, body: string, css: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<title>${title}</title>
<style>${BASE_CSS}${css}</style>
</head>
<body>
<header class="bar"><a class="brand" href="/">${CLOUD} mugilu</a></header>
<main>${body}</main>
<footer class="foot"><a href="/about">about</a> · <a href="/terms">terms</a> · a <a href="https://github.com/urbanmorph/mugilu/blob/main/PDGI.md">digital commons</a></footer>
</body>
</html>`;
}

// The conditions page as an "atmospheric almanac": a sky-tinted backdrop that
// takes its hue from the live dominant hazard (--cond, set per request), an
// editorial serif Ambient statement, and the readings as hairline-ruled strata
// (not cards). Inline-SVG line icons, currentColor so the driver layer glows.
const CONDITIONS_CSS = `
body{background:linear-gradient(180deg,color-mix(in srgb,var(--cond) 22%,var(--bg)),color-mix(in srgb,var(--cond) 7%,var(--bg)) 18%,var(--bg) 50%) var(--bg) no-repeat}
.ic{width:18px;height:18px}
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

const RISK_COLOR: Record<RiskBand, string> = {
  low: "#16a34a",
  moderate: "#ca8a04",
  high: "#f97316",
  severe: "#dc2626",
};
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
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  dust: '<path d="M5.2 6.2 6.6 7.6M2 13h2M20 13h2M17.4 7.6l1.4-1.4M22 17H2M22 21H2"/><path d="M16 13a4 4 0 0 0-8 0"/>',
  smoke: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  rain: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  warn: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
  compass: '<circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
  layers: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
};
ICON.clear = ICON.sun;

function icon(name: string): string {
  return `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] ?? ""}</svg>`;
}

// Ambient driver -> icon key, and the noun for the headline ("High heat.").
const DRIVER_KEY: Record<string, string> = { Air: "air", Heat: "heat", UV: "sun", Dust: "dust", Smoke: "smoke", Warning: "warn", none: "clear" };
const COND_NOUN: Record<string, string> = { Air: "air", Heat: "heat", UV: "sun", Dust: "dust", Smoke: "smoke", Warning: "alert", none: "sky" };

/** Wet-bulb survivability read: ~31 is the theoretical limit, >=28 is severe. */
function wetBulb(wb: number): [string, string] {
  if (wb >= 31) return ["dangerous", "#dc2626"];
  if (wb >= 28) return ["severe", "#ea580c"];
  if (wb >= 26) return ["caution", "#ca8a04"];
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

export function renderConditionsPage(c: Conditions, persona: Persona = "everyone"): string {
  const risk = ambientRisk(c, persona);
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
    strata.push(
      lyr(
        "air",
        "Air",
        risk.driver === "Air",
        c.air.aqi != null ? String(c.air.aqi) : "n/a",
        `<span class="qa">AQI</span> <b style="color:${bandColor}">${bandLabel}</b>`,
        `${marker}${aqli}`,
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
      lyr("sun", "Sun", risk.driver === "UV", String(Math.round(c.uv.index)), `<span class="qa">UV index</span> <b>${uvWord(c.uv.index)}</b>`, "", scaleBar(Math.min(c.uv.index, 11) / 11)),
    );
  }
  if (c.dust?.dust_ug_m3 != null) {
    strata.push(
      lyr("dust", "Dust", risk.driver === "Dust", String(Math.round(c.dust.dust_ug_m3)), `<span class="qa nu">µg/m³</span> <b>${dustWord(c.dust.dust_ug_m3)}</b>`, "", scaleBar(Math.min(c.dust.dust_ug_m3, 500) / 500)),
    );
  }
  if (c.smoke && (c.smoke.count >= 3 || c.smoke.frp_sum >= 20)) {
    const word =
      c.smoke.count >= 60 || c.smoke.frp_sum >= 350 ? "heavy" : c.smoke.count >= 25 || c.smoke.frp_sum >= 120 ? "notable" : "some";
    const sub =
      c.smoke.nearest_km != null ? `nearest ${c.smoke.nearest_km} km · ${c.smoke.frp_sum} MW total` : `${c.smoke.frp_sum} MW`;
    strata.push(
      lyr("smoke", "Smoke", risk.driver === "Smoke", String(c.smoke.count), `<span class="qa nu">fires &lt;100 km</span> <b>${word} burning</b>`, sub, scaleBar(Math.min(c.smoke.count, 100) / 100)),
    );
  }
  if (c.rain && (c.rain.probability_pct != null || c.rain.precipitation_mm != null)) {
    const mm = c.rain.precipitation_mm;
    if (c.rain.probability_pct != null) {
      strata.push(
        lyr("rain", "Rain", false, `${c.rain.probability_pct}%`, '<span class="qa">chance of rain</span>', mm ? `${mm} mm falling now` : "", scaleBar(c.rain.probability_pct / 100, true)),
      );
    } else {
      strata.push(lyr("rain", "Rain", false, String(mm), '<span class="qa nu">mm</span> <b>now</b>', ""));
    }
  }

  const body = `
  <article class="cx">
    <p class="coord">${c.location.lat}°N&nbsp;&nbsp;${c.location.lon}°E</p>
    <h1 class="loc">${place}</h1>
    <p class="when">the sky over this spot, right now</p>
    ${c.warnings?.length ? c.warnings.map(renderWarning).join("") : ""}
    <section class="amb">
      <p class="amb-eye">${icon(DRIVER_KEY[risk.driver] ?? "clear")}<span>Ambient · for ${esc(PERSONA_LABEL[risk.persona])}</span></p>
      <p class="amb-head">${head}</p>
      <p class="amb-say">${esc(ambientMeaning(risk))}</p>
      <nav class="who" aria-label="Who is this for">${pills}</nav>
    </section>
    <dl class="strata">${strata.join("")}</dl>
    <footer>
      <p class="attr">${esc(c.attribution)}</p>
      <p class="disc">${esc(c.disclaimer)}</p>
      <p class="raw"><a href="/c/${slug}.json">JSON</a> · <a href="/c/${slug}.md">Markdown</a> · <a href="/c/${slug}.png">PNG</a> · <a href="/embed/${slug}">Embed</a></p>
    </footer>
  </article>`;

  const css = CONDITIONS_CSS + `\n:root{--cond:${condColor}}`;
  return shell(`${place}: mugilu`, body, css);
}

/** Short IST stamp, e.g. "14:32 IST · 27 Jun" — the time travels on embeds/PNGs. */
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

// The embeddable widget (A "build on it" surface): a compact, self-contained
// conditions card others drop into an <iframe>. The whole card links back to the
// full page (attribution + traffic). A collapsed "Embed this" block carries the
// snippet, hidden by a one-liner when the widget is itself being framed.
const EMBED_CSS = `
*{box-sizing:border-box}html,body{margin:0}
:root{--ink:#0f172a;--muted:#64748b;--bg:#f8fafc;--card:#fff;--line:#e2e8f0}
@media(prefers-color-scheme:dark){:root{--ink:#e2e8f0;--muted:#94a3b8;--bg:#0b1220;--card:#111827;--line:#1f2937}}
body{font:14px/1.5 ui-sans-serif,-apple-system,system-ui,sans-serif;color:var(--ink);background:transparent;padding:8px}
.card{display:block;text-decoration:none;color:var(--ink);background:linear-gradient(160deg,color-mix(in srgb,var(--cond) 20%,var(--card)),var(--card) 72%);border:1px solid color-mix(in srgb,var(--cond) 30%,var(--line));border-radius:16px;padding:16px 18px;max-width:460px;margin:0 auto}
.etop{display:flex;justify-content:space-between;align-items:center;margin:0 0 .6rem}
.eplace{font-weight:700;font-size:1.05rem;letter-spacing:-.01em}
.ebrand{color:var(--muted);font-size:.8rem;font-weight:600;display:flex;align-items:center;gap:.3rem}
.ebrand svg{width:15px;height:15px;vertical-align:-2px}
.eamb{display:flex;align-items:center;gap:.5rem;font-size:1.3rem;font-weight:800;letter-spacing:-.02em;color:var(--cond);margin:0 0 .15rem}
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

export function renderEmbed(c: Conditions, persona: Persona, siteUrl: string): string {
  const risk = ambientRisk(c, persona);
  const condColor = RISK_COLOR[risk.band];
  const slug = `${c.location.lat},${c.location.lon}`;
  const stationCity = c.air?.station?.city;
  const place = c.place ? esc(c.place) : stationCity ? esc(stationCity) : slug;
  const head =
    risk.band === "low" ? "All clear" : `${RISK_LABEL[risk.band]} ${COND_NOUN[risk.driver] ?? "sky"}`;

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
    reads.push(`<div class="eread"><b>${Math.round(c.dust.dust_ug_m3)}</b><span>dust ${dustWord(c.dust.dust_ug_m3)}</span></div>`);
  if (c.smoke && (c.smoke.count >= 3 || c.smoke.frp_sum >= 20))
    reads.push(`<div class="eread"><b>${c.smoke.count}</b><span>fires &lt;100km</span></div>`);

  const iframe = `<iframe src="${siteUrl}/embed/${slug}" width="480" height="240" style="border:0;border-radius:16px" title="mugilu — conditions at ${place}" loading="lazy"></iframe>`;
  const imgtag = `<img src="${siteUrl}/c/${slug}.png" alt="mugilu — conditions at ${place}" width="600">`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${place} — mugilu</title><style>${EMBED_CSS}\n:root{--cond:${condColor}}</style></head><body>
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
.alist li span{font-size:1.2rem;flex:none;width:1.6rem;text-align:center;line-height:1.3}
.alist li .ic{margin-top:2px;color:var(--sky)}
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

  <p class="ah">${icon("code")}<span>Build on it</span></p>
  <p class="atext">mugilu is meant to be built on, not just looked at. Every reading is also open, machine-readable data, so you can put the whole sky behind your own map, story, dashboard or alert, and spend your time on the part that matters: the telling, and the action.</p>
  <p class="abuild">Today, every page has a JSON and a Markdown twin. Next: a documented API and an MCP server, so apps and AI assistants can ask "what is the sky doing here?" directly. This section will grow as those land.</p>

  <p class="ah">${icon("layers")}<span>Where it comes from</span></p>
  <p class="atext">mugilu owns no sensors and runs no forecasts. It stands on others' work and credits them: <b>CPCB</b> and <b>OpenAQ</b> for air, <b>Open-Meteo</b> for weather, <b>NDMA / IMD</b> (via SACHET) for warnings, and <b>bharatlas</b> for the map of India. The code is open under the MIT licence; the data keeps each source's own terms.</p>

  <p class="ah">${icon("heart")}<span>Why it's free</span></p>
  <p class="atext">The sky over you is a commons. Knowing it shouldn't cost money or sit locked inside someone's app. mugilu is <b>non-commercial, for good</b>, the third in a small set of public tools alongside <a href="https://bharatlas.com">bharatlas</a> and <a href="https://mdshare.live">mdshare</a>.</p>

  <div class="builtby">
    <a href="https://urbanmorph.com" aria-label="Urban Morph"><img src="${UM_ICON}" alt="Urban Morph" width="54" height="60"></a>
    <div>
      <p class="bb-by">Built by <a href="https://urbanmorph.com">urbanmorph</a>, led by <a href="https://www.sathyasankaran.com">Sathya Sankaran</a>.</p>
      <a class="star" href="https://github.com/urbanmorph/mugilu">${GH_MARK} Source on GitHub — drop a star if it's useful</a>
    </div>
  </div>

  <p class="adisc">Informational only, not for medical, emergency, or safety-critical decisions. For official warnings, consult NDMA and IMD.</p>
  <p class="aback"><a href="/">← back to mugilu</a></p>
  </article>`;
  return shell("About: mugilu", body, ABOUT_CSS);
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
    <li>${icon("air")} <b>Air</b> - CPCB (Govt. of India), Airnet (CSTEP), and Aurassure, via the <a href="https://oaq.notf.in">OAQ</a> broker; plus OpenAQ.</li>
    <li>${icon("heat")} <b>Heat, rain, UV, dust</b> - <a href="https://open-meteo.com">Open-Meteo</a>, licensed CC-BY 4.0.</li>
    <li>${icon("warn")} <b>Official warnings</b> - NDMA / IMD via SACHET.</li>
    <li>${icon("pin")} <b>Geography &amp; place names</b> - <a href="https://bharatlas.com">bharatlas</a>.</li>
    <li>${icon("heart")} <b>Health impact</b> - years of life lost uses the <a href="https://aqli.epic.uchicago.edu">AQLI</a> methodology (U Chicago EPIC).</li>
  </ul>
  <p class="alead2">Each reading carries its own attribution line inline, so credit travels with the data wherever it goes.</p>

  <p class="adisc">A digital commons by <a href="https://urbanmorph.com">urbanmorph</a>, alongside <a href="https://bharatlas.com">bharatlas</a> and <a href="https://mdshare.live">mdshare</a>.</p>
  <p class="aback"><a href="/">← back to mugilu</a></p>`;
  return shell("Terms & attribution: mugilu", body, ABOUT_CSS);
}

/** A real 404 page (the catch-all used to return 200 with a debug string). */
export function renderNotFound(): string {
  const body = `
  <h1 class="ahero">Not here.</h1>
  <p class="alead">That page doesn't exist on mugilu. Look up a place instead, or give it a coordinate like <a href="/c/12.97,77.59">/c/12.97,77.59</a>.</p>
  <p class="aback"><a href="/">← back to mugilu</a></p>`;
  return shell("Not found: mugilu", body, ABOUT_CSS);
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
.search button{font-size:1rem;font-weight:600;padding:12px 18px;border:0;border-radius:12px;background:var(--sky);color:#fff;cursor:pointer}
.acwrap{position:relative}
.ac{list-style:none;margin:4px 0 0;padding:4px;position:absolute;left:0;right:0;z-index:9;background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.14)}
.ac:empty{display:none}
.ac li{padding:9px 10px;border-radius:8px;cursor:pointer;font-size:.95rem}
.ac li span{color:var(--muted);font-size:.85rem}
.ac li.on,.ac li:hover{background:var(--bg)}
.nearme{display:inline-flex;align-items:center;gap:.4rem;font-size:.95rem;padding:10px 14px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink);cursor:pointer;margin:0 0 1rem}
.nearme .ic{width:16px;height:16px;color:var(--sky)}
.notice{color:#b45309;font-size:.9rem;margin:.2rem 0 1rem}
.cities{color:var(--muted);font-size:.9rem;line-height:1.9}.cities a{color:var(--sky);text-decoration:none}
.hero-now{margin:0 0 1.4rem;border:1px solid var(--line);border-radius:14px;padding:14px 16px;background:var(--card)}
.hero-now h2{margin:0 0 .5rem;font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.hero-now .hl{display:block;text-decoration:none;color:var(--ink);padding:5px 0;font-size:.98rem;line-height:1.35}
.hero-now .hl b{font-weight:700}
.hero-now .hl .ic{width:18px;height:18px;color:var(--sky);margin-right:8px;vertical-align:-.2em}
`;

export const CITIES = [
  { name: "Delhi", lat: 28.61, lon: 77.21 },
  { name: "Mumbai", lat: 19.07, lon: 72.88 },
  { name: "Bengaluru", lat: 12.97, lon: 77.59 },
  { name: "Kolkata", lat: 22.57, lon: 88.36 },
  { name: "Chennai", lat: 13.08, lon: 80.27 },
  { name: "Hyderabad", lat: 17.39, lon: 78.49 },
];

export function renderHome(notFound?: string, highlights?: NationalHighlights): string {
  const cityLinks = CITIES.map((c) => `<a href="/c/${c.lat},${c.lon}">${c.name}</a>`).join(" · ");
  const notice = notFound
    ? `<p class="notice">Couldn't find "${esc(notFound)}". Try a city or place name.</p>`
    : "";

  const body = `
  <h1 class="hero">What's it like outside, right now?</h1>
  <p class="tagline">The open sky of India, one coordinate at a time.</p>
  <p class="covers"><span>${icon("air")} air</span><span>${icon("heat")} heat</span><span>${icon("rain")} rain</span><span>${icon("sun")} UV</span><span>${icon("dust")} dust</span><span>${icon("warn")} warnings</span></p>
  <div class="acwrap">
    <form class="search" action="/go" method="get" role="search">
      <input id="q" name="q" type="search" placeholder="Search a city or place…" autocomplete="off" autofocus aria-label="Search a place">
      <button type="submit">Go</button>
    </form>
    <ul id="ac" class="ac" role="listbox"></ul>
  </div>
  <button id="nearme" class="nearme" type="button" hidden>${icon("pin")} Use my location</button>
  ${notice}
  ${highlights ? renderHero(highlights) : ""}
  <p class="cities">Popular: ${cityLinks}</p>
  <script>
  var b=document.getElementById('nearme'),label=b.textContent;
  if(navigator.geolocation){b.hidden=false;b.onclick=function(){b.textContent='Locating…';navigator.geolocation.getCurrentPosition(function(p){location.href='/c/'+p.coords.latitude.toFixed(4)+','+p.coords.longitude.toFixed(4);},function(){b.textContent='Location unavailable';});};}
  addEventListener('pageshow',function(){b.textContent=label;});
  var q=document.getElementById('q'),ac=document.getElementById('ac'),items=[],ix=-1,t,seq=0;
  function esc(s){return String(s).replace(/[<&>]/g,function(c){return c==='<'?'&lt;':c==='>'?'&gt;':'&amp;';});}
  function hide(){ac.innerHTML='';items=[];ix=-1;}
  function paint(){for(var i=0;i<ac.children.length;i++)ac.children[i].className=i===ix?'on':'';}
  function go(i){var x=items[i];if(x)location.href='/c/'+x.lat+','+x.lon;}
  q.addEventListener('input',function(){var v=q.value.trim();clearTimeout(t);if(v.length<2){hide();return;}var s=++seq;t=setTimeout(function(){fetch('/suggest?q='+encodeURIComponent(v)).then(function(r){return r.json();}).then(function(d){if(s!==seq)return;items=d.suggestions||[];ix=-1;ac.innerHTML=items.map(function(x,i){return '<li role="option" data-i="'+i+'"><b>'+esc(x.label)+'</b>'+(x.sublabel?' <span>'+esc(x.sublabel)+'</span>':'')+'</li>';}).join('');}).catch(function(){if(s===seq)hide();});},150);});
  q.addEventListener('keydown',function(e){if(!items.length)return;if(e.key==='ArrowDown'){ix=(ix+1)%items.length;e.preventDefault();paint();}else if(e.key==='ArrowUp'){ix=(ix-1+items.length)%items.length;e.preventDefault();paint();}else if(e.key==='Enter'&&ix>=0){e.preventDefault();go(ix);}else if(e.key==='Escape'){hide();}});
  ac.addEventListener('mousedown',function(e){var li=e.target.closest('li');if(li)go(+li.getAttribute('data-i'));});
  q.addEventListener('blur',function(){setTimeout(hide,150);});
  </script>`;

  return shell("mugilu: India's open sky", body, HOME_CSS);
}
