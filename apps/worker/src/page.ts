import type { Conditions, Warning } from "./types";
import type { NationalHighlights } from "./highlights";
import { ambientRisk, ambientMeaning, PERSONAS, PERSONA_LABEL } from "./score";
import type { Persona, RiskBand } from "./score";

// The worker-rendered HTML pages (Phase B): the location page and the lookup
// home page. Layperson-first, mobile-first, self-contained (inline CSS + cloud),
// jargon-free. Raw pollutant/wet-bulb numbers live in the .json/.md siblings.
// Both pages share chrome via shell().

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
      `<a class="hl" href="/c/${h.hottest.lat},${h.hottest.lon}"><span>🔥</span> Hottest: <b>${esc(h.hottest.name)}</b>, feels ${Math.round(h.hottest.apparent_c)}°, ${heatPhrase(h.hottest.apparent_c, h.hottest.wet_bulb_c)}</a>`,
    );
  }
  if (h.dustiest) {
    rows.push(
      `<a class="hl" href="/c/${h.dustiest.lat},${h.dustiest.lon}"><span>🌫️</span> Dustiest: <b>${esc(h.dustiest.name)}</b>, ${dustPhrase(h.dustiest.dust_ug_m3)}</a>`,
    );
  }
  return rows.length ? `<section class="hero-now"><h2>Right now in India</h2>${rows.join("")}</section>` : "";
}

const CLOUD =
  '<svg width="22" height="22" viewBox="0 0 64 64" aria-hidden="true" style="vertical-align:-4px">' +
  '<g fill="#0284c7"><rect x="14" y="35" width="36" height="13" rx="6.5"/>' +
  '<circle cx="24" cy="33" r="9"/><circle cx="37" cy="30" r="11"/><circle cx="46" cy="37" r="6.5"/></g></svg>';

const BASE_CSS = `
:root{--sky:#0284c7;--ink:#0f172a;--muted:#64748b;--bg:#f8fafc;--card:#fff;--line:#e2e8f0}
@media(prefers-color-scheme:dark){:root{--ink:#e2e8f0;--muted:#94a3b8;--bg:#0b1220;--card:#111827;--line:#1f2937}}
*{box-sizing:border-box}html,body{margin:0}
body{font:16px/1.5 ui-sans-serif,-apple-system,system-ui,sans-serif;color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased}
.bar{display:flex;align-items:center;padding:14px 18px;border-bottom:1px solid var(--line)}
.brand{font-weight:700;letter-spacing:-.02em;color:var(--ink);text-decoration:none;font-size:1.1rem}
main{max-width:560px;margin:0 auto;padding:20px 18px 32px}
.foot{max-width:560px;margin:0 auto;padding:18px;color:var(--muted);font-size:.78rem;border-top:1px solid var(--line)}
.foot a{color:var(--muted)}
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
<footer class="foot"><a href="/about">about</a> · <a href="/terms">terms</a> · <a href="https://github.com/urbanmorph/mugilu">code</a> · made by <a href="https://urbanmorph.com">urbanmorph</a> · a digital commons · <a href="https://pdgi.org">pdgi.org</a></footer>
</body>
</html>`;
}

// The conditions page as an "atmospheric almanac": a sky-tinted backdrop that
// takes its hue from the live dominant hazard (--cond, set per request), an
// editorial serif Ambient statement, and the readings as hairline-ruled strata
// (not cards). Inline-SVG line icons, currentColor so the driver layer glows.
const CONDITIONS_CSS = `
:root{--serif:Georgia,'Iowan Old Style','Palatino Linotype',Palatino,Cambria,serif;--sans:ui-sans-serif,-apple-system,system-ui,sans-serif;--mono:ui-monospace,SFMono-Regular,Menlo,monospace;--hair:color-mix(in srgb,var(--ink) 12%,transparent)}
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
  rain: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  warn: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
};
ICON.clear = ICON.sun;

function icon(name: string): string {
  return `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] ?? ""}</svg>`;
}

// Ambient driver -> icon key, and the noun for the headline ("High heat.").
const DRIVER_KEY: Record<string, string> = { Air: "air", Heat: "heat", UV: "sun", Dust: "dust", Warning: "warn", none: "clear" };
const COND_NOUN: Record<string, string> = { Air: "air", Heat: "heat", UV: "sun", Dust: "dust", Warning: "alert", none: "sky" };

/** Wet-bulb survivability read: ~31 is the theoretical limit, >=28 is severe. */
function wetBulb(wb: number): [string, string] {
  if (wb >= 31) return ["dangerous", "#dc2626"];
  if (wb >= 28) return ["severe", "#ea580c"];
  if (wb >= 26) return ["caution", "#ca8a04"];
  return ["safe", "var(--muted)"];
}

/** One reading as a hairline-ruled stratum: icon + label, a big figure, a tail. */
function lyr(key: string, label: string, on: boolean, num: string, q: string, sub: string): string {
  return `<div class="lyr${on ? " on" : ""}"><dt>${icon(key)}<span>${label}</span></dt><dd><span class="num">${num}</span><span class="q">${q}</span>${sub ? `<span class="sub">${sub}</span>` : ""}</dd></div>`;
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
      ),
    );
  }
  if (c.uv?.index != null) {
    strata.push(
      lyr("sun", "Sun", risk.driver === "UV", String(Math.round(c.uv.index)), `<span class="qa">UV index</span> <b>${uvWord(c.uv.index)}</b>`, ""),
    );
  }
  if (c.dust?.dust_ug_m3 != null) {
    strata.push(
      lyr("dust", "Dust", risk.driver === "Dust", String(Math.round(c.dust.dust_ug_m3)), `<span class="qa nu">µg/m³</span> <b>${dustWord(c.dust.dust_ug_m3)}</b>`, ""),
    );
  }
  if (c.rain && (c.rain.probability_pct != null || c.rain.precipitation_mm != null)) {
    const mm = c.rain.precipitation_mm;
    if (c.rain.probability_pct != null) {
      strata.push(
        lyr("rain", "Rain", false, `${c.rain.probability_pct}%`, '<span class="qa">chance of rain</span>', mm ? `${mm} mm falling now` : ""),
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
      <p class="raw"><a href="/c/${slug}.json">JSON</a> · <a href="/c/${slug}.md">Markdown</a></p>
    </footer>
  </article>`;

  const css = CONDITIONS_CSS + `\n:root{--cond:${condColor}}`;
  return shell(`${place}: mugilu`, body, css);
}

const ABOUT_CSS = `
.ahero{font-size:1.9rem;font-weight:800;letter-spacing:-.03em;line-height:1.15;margin:1.2rem 0 .8rem}
.alead{font-size:1.1rem;line-height:1.45;margin:0 0 1.4rem}
.alead2{line-height:1.5;margin:0 0 1rem}.alead2 a{color:var(--sky)}
.ah{font-size:.8rem;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin:1.9rem 0 .5rem}
.amuted{color:var(--muted);margin:0 0 .6rem}
.alist{list-style:none;margin:0 0 1rem;padding:0}
.alist li{display:flex;gap:11px;align-items:flex-start;padding:7px 0;line-height:1.4}
.alist li span{font-size:1.35rem;flex:none;width:1.7rem;text-align:center;line-height:1.2}
.alist.on{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:4px 14px}
.adisc{color:var(--muted);font-size:.82rem;line-height:1.45;border-top:1px solid var(--line);padding-top:1rem;margin-top:1.9rem}
.aback{margin:1.1rem 0 0}.aback a{color:var(--sky);text-decoration:none;font-weight:600}
`;

/** The About page: person/health-led positioning, the differentiation made plain. */
export function renderAbout(): string {
  const body = `
  <h1 class="ahero">The open sky of India,<br>one coordinate at a time.</h1>
  <p class="alead">mugilu tells you what the air, heat, rain, UV and dust are doing at any point in India, and whether there's an official warning over it, <b>right now</b>. Free, open, no sign-up.</p>

  <h2 class="ah">Why mugilu</h2>
  <p class="amuted">Everywhere else, the sky is split up and locked away:</p>
  <ul class="alist">
    <li><span>🌬️</span> Air apps show air. Weather apps show weather. Neither shows both.</li>
    <li><span>🏛️</span> Government data is real and trustworthy, but scattered across separate apps (CPCB for air, IMD for weather, SACHET for warnings) that don't talk to each other.</li>
    <li><span>💳</span> The tools that <i>do</i> combine things are paywalled, closed, and modelled. Not real measurements, and not built for India.</li>
    <li><span>🧍</span> None of them tell you what it means for <b>you</b>.</li>
  </ul>
  <p class="amuted">mugilu stitches it back together:</p>
  <ul class="alist on">
    <li><span>🌡️</span> <b>One read, every hazard</b>: air + heat (with wet-bulb, the number that decides whether heat is survivable) + rain + UV + dust.</li>
    <li><span>⚠️</span> <b>Fused with the official warning</b>: the NDMA/IMD alert over your spot, right beside the conditions.</li>
    <li><span>📍</span> <b>For any point</b>: not just monitored cities. Give it a coordinate.</li>
    <li><span>❤️</span> <b>For you</b>, tuned to who's asking: asthma, older adults, children, outdoor workers.</li>
  </ul>

  <h2 class="ah">For people first, and anything built on top</h2>
  <ul class="alist">
    <li><span>👤</span> <b>People</b> → a plain page you read at a glance.</li>
    <li><span>🧑‍💻</span> <b>Developers</b> → the same data as JSON. No key, no sign-up.</li>
    <li><span>✍️</span> <b>Writers &amp; researchers</b> → clean Markdown.</li>
    <li><span>🤖</span> <b>AI agents</b> → an MCP server. The icing: your assistant can actually check "is it safe to run outside in Lucknow right now?"</li>
  </ul>

  <h2 class="ah">Where it comes from</h2>
  <p class="alead2">mugilu doesn't own sensors or run its own forecasts. It stands on others' work, and credits them: <b>CPCB</b> &amp; <b>OpenAQ</b> (air), <b>Open-Meteo</b> (weather), <b>NDMA / IMD</b> via SACHET (warnings), <b>bharatlas</b> (geography). The code is <b>MIT</b>; the data keeps each source's own terms.</p>

  <h2 class="ah">Why it exists</h2>
  <p class="alead2">Because the sky over you is a commons. Knowing it shouldn't cost money or sit locked in someone's app. mugilu is <b>non-commercial, forever</b>, the third in a series with <a href="https://bharatlas.com">bharatlas.com</a> and <a href="https://mdshare.live">mdshare.live</a>.</p>

  <p class="adisc">Informational only, not for medical, emergency, or safety-critical decisions. For official warnings, consult NDMA and IMD.</p>
  <p class="aback"><a href="/">← back to mugilu</a></p>`;
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
    <li><span>💨</span> <b>Air</b> - CPCB (Govt. of India), Airnet (CSTEP), and Aurassure, via the <a href="https://oaq.notf.in">OAQ</a> broker; plus OpenAQ.</li>
    <li><span>🌡️</span> <b>Heat, rain, UV, dust</b> - <a href="https://open-meteo.com">Open-Meteo</a>, licensed CC-BY 4.0.</li>
    <li><span>⚠️</span> <b>Official warnings</b> - NDMA / IMD via SACHET.</li>
    <li><span>🗺️</span> <b>Geography &amp; place names</b> - <a href="https://bharatlas.com">bharatlas</a>.</li>
    <li><span>❤️</span> <b>Health impact</b> - years of life lost uses the <a href="https://aqli.epic.uchicago.edu">AQLI</a> methodology (U Chicago EPIC).</li>
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
.hero{font-size:1.7rem;font-weight:800;letter-spacing:-.03em;line-height:1.2;margin:1.4rem 0 .5rem}
.tagline{font-size:1.05rem;margin:0 0 .7rem;font-weight:500}
.covers{margin:0 0 1.3rem;color:var(--muted);font-size:.92rem;line-height:1.8}
.search{display:flex;gap:8px;margin:0 0 .8rem}
.search input{flex:1;font-size:1rem;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink)}
.search button{font-size:1rem;font-weight:600;padding:12px 18px;border:0;border-radius:12px;background:var(--sky);color:#fff;cursor:pointer}
.acwrap{position:relative}
.ac{list-style:none;margin:4px 0 0;padding:4px;position:absolute;left:0;right:0;z-index:9;background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.14)}
.ac:empty{display:none}
.ac li{padding:9px 10px;border-radius:8px;cursor:pointer;font-size:.95rem}
.ac li span{color:var(--muted);font-size:.85rem}
.ac li.on,.ac li:hover{background:var(--bg)}
.nearme{font-size:.95rem;padding:10px 14px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink);cursor:pointer;margin:0 0 1rem}
.notice{color:#b45309;font-size:.9rem;margin:.2rem 0 1rem}
.cities{color:var(--muted);font-size:.9rem;line-height:1.9}.cities a{color:var(--sky);text-decoration:none}
.hero-now{margin:0 0 1.4rem;border:1px solid var(--line);border-radius:14px;padding:14px 16px;background:var(--card)}
.hero-now h2{margin:0 0 .5rem;font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.hero-now .hl{display:block;text-decoration:none;color:var(--ink);padding:5px 0;font-size:.98rem;line-height:1.35}
.hero-now .hl b{font-weight:700}.hero-now .hl span{margin-right:8px;font-size:1.2rem}
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
  <p class="covers">💨 air · 🔥 heat · 🌧️ rain · ☀️ UV · 🌫️ dust · ⚠️ warnings</p>
  <div class="acwrap">
    <form class="search" action="/go" method="get" role="search">
      <input id="q" name="q" type="search" placeholder="Search a city or place…" autocomplete="off" autofocus aria-label="Search a place">
      <button type="submit">Go</button>
    </form>
    <ul id="ac" class="ac" role="listbox"></ul>
  </div>
  <button id="nearme" class="nearme" type="button" hidden>📍 Use my location</button>
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
