import type { Conditions, Warning } from "./types";
import type { NationalHighlights } from "./highlights";
import { ambientRisk, ambientMeaning, PERSONAS, PERSONA_LABEL } from "./score";
import type { AmbientRisk, Persona, RiskBand } from "./score";

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

function heatNote(h: Conditions["heat"]): string {
  if (!h) return "";
  if ((h.humidity_pct ?? 0) >= 70 && (h.apparent_c ?? 0) >= 30) return "Humid. Drink water.";
  if ((h.apparent_c ?? 0) >= 40) return "Stay in the shade.";
  return "";
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

const CONDITIONS_CSS = `
.crumbs{font-size:.8rem;color:var(--muted);margin:.2rem 0 .5rem}
.crumbs a{color:var(--muted);text-decoration:none}
.crumbs a:hover{color:var(--sky)}
.crumbs span{margin:0 .3rem;opacity:.5}
.place{font-size:1.5rem;font-weight:700;letter-spacing:-.02em;margin:.2rem 0 0}
.also{margin:.9rem 0 0;color:var(--muted);font-size:.92rem}
.asof{color:var(--muted);font-size:.85rem;margin:.1rem 0 1rem}
.verdict{font-size:1.15rem;line-height:1.35;margin:0 0 1.2rem}
.warn{border-left:5px solid var(--wc,#64748b);background:var(--card);border:1px solid var(--line);border-radius:12px;padding:11px 14px;margin:0 0 1rem;font-weight:600;line-height:1.4}
.warn .wsrc{display:block;margin-top:3px;color:var(--muted);font-size:.78rem;font-weight:400}
.ambient{display:flex;gap:14px;align-items:flex-start;border:1px solid color-mix(in srgb,var(--rc,var(--sky)) 32%,var(--line));border-radius:16px;padding:18px;margin:0 0 .7rem;background:linear-gradient(140deg,color-mix(in srgb,var(--rc,var(--sky)) 22%,var(--card)),var(--card) 72%)}
.ambient .aicon{font-size:2.6rem;line-height:1;flex:none}
.ambient .abody{min-width:0}
.ambient .alabel{margin:0;font-size:.74rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.ambient .aband{margin:.12rem 0 .2rem;font-size:2.2rem;font-weight:800;letter-spacing:-.03em;line-height:1;color:var(--rc,var(--ink))}
.ambient .adriver{margin:0;font-weight:600;line-height:1.35}
.personas{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 1.2rem;padding:0}
.personas .pill{font-size:.82rem;text-decoration:none;color:var(--ink);border:1px solid var(--line);border-radius:999px;padding:5px 11px}
.personas .pill.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.cards{display:grid;gap:12px;grid-template-columns:1fr}
@media(min-width:480px){.cards{grid-template-columns:1fr 1fr}}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px}
.card h2{margin:0;font-size:.8rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.card h2 .ci{font-size:1.05rem;margin-right:.1rem}
.card.air{border-left:5px solid var(--band,var(--sky))}
.big{font-size:1.8rem;font-weight:700;margin:.3rem 0 .1rem;letter-spacing:-.02em}
.tag{margin:0;font-weight:600}
.note{margin:.4rem 0 0;color:var(--sky);font-weight:600;font-size:.92rem}
.src{margin:.5rem 0 0;color:var(--muted);font-size:.8rem}
.more{margin:1.2rem 0 0}.more summary{cursor:pointer;color:var(--muted);font-weight:600}
.more ul{margin:.6rem 0 0;padding-left:1.1rem}
.attr{margin:1.6rem 0 .3rem;color:var(--muted);font-size:.8rem}
.disclaimer{margin:.2rem 0;color:var(--muted);font-size:.78rem;line-height:1.4}
.data{margin:1rem 0 0;font-size:.8rem}.data a{color:var(--sky)}
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

/** A pinned official-warning banner, the most urgent thing on the page. */
function renderWarning(w: Warning): string {
  const meta = [w.severity, w.until ? `until ${w.until}` : ""].filter(Boolean).join(" · ");
  return `<div class="warn" style="--wc:${warnColor(w.color)}">⚠ <b>${esc(w.event)}</b>${meta ? ` · ${esc(meta)}` : ""}<span class="wsrc">Official warning · ${esc(w.issuer)}</span></div>`;
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

const DRIVER_ICON: Record<string, string> = {
  Air: "💨",
  Heat: "🔥",
  UV: "☀️",
  Dust: "🌫️",
  Warning: "⚠️",
  none: "🌤️",
};

/** The Ambient read: state first (big icon + band in the live condition colour) + persona toggle. */
function renderAmbient(c: Conditions, risk: AmbientRisk): string {
  const base = `/c/${c.location.lat},${c.location.lon}`;
  const pills = PERSONAS.map((p) => {
    const href = p === "everyone" ? base : `${base}?as=${p}`;
    return `<a class="pill${p === risk.persona ? " on" : ""}" href="${href}">${esc(PERSONA_LABEL[p])}</a>`;
  }).join("");
  return `
  <section class="ambient" style="--rc:${RISK_COLOR[risk.band]}">
    <span class="aicon" aria-hidden="true">${DRIVER_ICON[risk.driver] ?? "🌤️"}</span>
    <div class="abody">
      <p class="alabel">Ambient · for ${esc(PERSONA_LABEL[risk.persona])}</p>
      <p class="aband">${RISK_LABEL[risk.band]}</p>
      <p class="adriver">${esc(ambientMeaning(risk))}</p>
    </div>
  </section>
  <nav class="personas" aria-label="Who is this for">${pills}</nav>`;
}

export function renderConditionsPage(c: Conditions, persona: Persona = "everyone"): string {
  const risk = ambientRisk(c, persona);
  const coords = `${c.location.lat}, ${c.location.lon}`;
  const slug = coords.replace(", ", ",");
  const stationCity = c.air?.station?.city;
  const place = c.place ? esc(c.place) : stationCity ? esc(stationCity) : coords;
  const band = c.air?.band ?? "unknown";
  const bandColor = BAND_COLOR[band] ?? BAND_COLOR.unknown;
  const bandLabel = BAND_LABEL[band] ?? "n/a";

  const airCard = c.air
    ? `<section class="card air" style="--band:${bandColor}">
        <h2><span class="ci" aria-hidden="true">💨</span> Air</h2>
        <p class="big">AQI ${c.air.aqi ?? "n/a"}</p>
        <p class="tag">${bandLabel}</p>
        <p class="src">${c.air.station ? `measured nearby · ${c.air.station.distance_km} km` : "modelled (no station nearby)"}</p>
      </section>`
    : `<section class="card air"><h2><span class="ci" aria-hidden="true">💨</span> Air</h2><p class="big">n/a</p><p class="src">no station nearby</p></section>`;

  const heatCard = c.heat
    ? `<section class="card heat">
        <h2><span class="ci" aria-hidden="true">🔥</span> Heat</h2>
        <p class="big">Feels ${round(c.heat.apparent_c)}°</p>
        <p class="tag">${round(c.heat.temp_c)}° · ${round(c.heat.humidity_pct)}% humidity</p>
        ${heatNote(c.heat) ? `<p class="note">${heatNote(c.heat)}</p>` : ""}
        <p class="src">estimated</p>
      </section>`
    : "";

  const also: string[] = [];
  if (c.uv?.index != null) also.push(`☀️ Sun ${uvWord(c.uv.index)}`);
  if (c.dust?.dust_ug_m3 != null) also.push(`🌫️ Dust ${dustWord(c.dust.dust_ug_m3)}`);
  if (c.rain?.precipitation_mm) also.push(`🌧️ Rain ${c.rain.precipitation_mm} mm`);

  const body = `
  <nav class="crumbs"><a href="/">mugilu</a> <span>/</span> ${place}</nav>
  <p class="place">${place}</p>
  <p class="asof">updated just now</p>
  ${renderAmbient(c, risk)}
  ${c.warnings?.length ? c.warnings.map(renderWarning).join("") : ""}
  <div class="cards">${airCard}${heatCard}</div>
  ${also.length ? `<p class="also">${also.map((a) => esc(a)).join(" · ")}</p>` : ""}
  <p class="attr">${esc(c.attribution)}</p>
  <p class="disclaimer">${esc(c.disclaimer)}</p>
  <p class="data"><a href="/c/${slug}.json">data (JSON)</a> · <a href="/c/${slug}.md">markdown</a></p>`;

  return shell(`${place}: mugilu`, body, CONDITIONS_CSS);
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
