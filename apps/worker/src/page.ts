import type { Conditions, Warning } from "./types";
import type { NationalHighlights } from "./highlights";

// The worker-rendered HTML pages (Phase B): the location page and the lookup
// home page. Layperson-first, mobile-first, self-contained (inline CSS + cloud),
// jargon-free — raw pollutant/wet-bulb numbers live in the .json/.md siblings.
// Both pages share chrome via shell().

const BAND_LABEL: Record<string, string> = {
  good: "Good",
  satisfactory: "Fine",
  moderate: "Moderate",
  poor: "Poor",
  vpoor: "Very poor",
  severe: "Severe",
  unknown: "—",
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
  return n == null ? "—" : String(Math.round(n));
}

/** Plain one-line verdict from the data (no persona weighting yet — that's later). */
function verdict(c: Conditions): string {
  const band = c.air?.band;
  const feels = c.heat?.apparent_c;
  const airBad = band === "poor" || band === "vpoor" || band === "severe";
  const airSevere = band === "vpoor" || band === "severe";
  const hot = feels != null && feels >= 40;
  const warm = feels != null && feels >= 35;
  if (airSevere) return "Air is unhealthy — avoid being outside if you can.";
  if (airBad && (hot || warm)) return "Both the air and the heat need care today.";
  if (airBad) return "The air needs care today.";
  if (hot) return "It's dangerously hot — limit time outdoors.";
  if (warm) return "It's hot — take it easy outdoors.";
  if (band === "moderate") return "Air is so-so today; the heat is fine.";
  return "Conditions are mild right now.";
}

function uvWord(index: number | undefined): string {
  if (index == null) return "—";
  if (index < 1) return "none";
  if (index < 3) return "low";
  if (index < 6) return "moderate";
  if (index < 8) return "high";
  if (index < 11) return "very high";
  return "extreme";
}

function dustWord(ug: number | undefined): string {
  if (ug == null) return "—";
  if (ug < 20) return "low";
  if (ug < 50) return "moderate";
  return "high";
}

function heatNote(h: Conditions["heat"]): string {
  if (!h) return "";
  if ((h.humidity_pct ?? 0) >= 70 && (h.apparent_c ?? 0) >= 30) return "Humid — drink water.";
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

/** The "right now in India" hero — heat- and dust-led (never air-led). */
function renderHero(h: NationalHighlights): string {
  const rows: string[] = [];
  if (h.hottest) {
    rows.push(
      `<a class="hl" href="/c/${h.hottest.lat},${h.hottest.lon}"><span>🔥</span> Hottest: <b>${esc(h.hottest.name)}</b> — feels ${Math.round(h.hottest.apparent_c)}°, ${heatPhrase(h.hottest.apparent_c, h.hottest.wet_bulb_c)}</a>`,
    );
  }
  if (h.dustiest) {
    rows.push(
      `<a class="hl" href="/c/${h.dustiest.lat},${h.dustiest.lon}"><span>🌫️</span> Dustiest: <b>${esc(h.dustiest.name)}</b> — ${dustPhrase(h.dustiest.dust_ug_m3)}</a>`,
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
<title>${title}</title>
<style>${BASE_CSS}${css}</style>
</head>
<body>
<header class="bar"><a class="brand" href="/">${CLOUD} mugilu</a></header>
<main>${body}</main>
<footer class="foot">privacy · terms · <a href="https://github.com/urbanmorph/mugilu">code</a> · made by <a href="https://urbanmorph.com">urbanmorph</a> · a digital commons · <a href="https://pdgi.org">pdgi.org</a></footer>
</body>
</html>`;
}

const CONDITIONS_CSS = `
.place{font-size:1.5rem;font-weight:700;letter-spacing:-.02em;margin:.2rem 0 0}
.asof{color:var(--muted);font-size:.85rem;margin:.1rem 0 1rem}
.verdict{font-size:1.15rem;line-height:1.35;margin:0 0 1.2rem}
.warn{border-left:5px solid var(--wc,#64748b);background:var(--card);border:1px solid var(--line);border-radius:12px;padding:11px 14px;margin:0 0 1rem;font-weight:600;line-height:1.4}
.warn .wsrc{display:block;margin-top:3px;color:var(--muted);font-size:.78rem;font-weight:400}
.cards{display:grid;gap:12px;grid-template-columns:1fr}
@media(min-width:480px){.cards{grid-template-columns:1fr 1fr}}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px}
.card h2{margin:0;font-size:.8rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
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

/** A pinned official-warning banner — the most urgent thing on the page. */
function renderWarning(w: Warning): string {
  const meta = [w.severity, w.until ? `until ${w.until}` : ""].filter(Boolean).join(" · ");
  return `<div class="warn" style="--wc:${warnColor(w.color)}">⚠ <b>${esc(w.event)}</b>${meta ? ` · ${esc(meta)}` : ""}<span class="wsrc">Official warning · ${esc(w.issuer)}</span></div>`;
}

export function renderConditionsPage(c: Conditions): string {
  const coords = `${c.location.lat}, ${c.location.lon}`;
  const slug = coords.replace(", ", ",");
  const place = c.place ? esc(c.place) : c.air?.station.city ? esc(c.air.station.city) : coords;
  const band = c.air?.band ?? "unknown";
  const bandColor = BAND_COLOR[band] ?? BAND_COLOR.unknown;
  const bandLabel = BAND_LABEL[band] ?? "—";

  const airCard = c.air
    ? `<section class="card air" style="--band:${bandColor}">
        <h2>Air</h2>
        <p class="big">AQI ${c.air.aqi ?? "—"}</p>
        <p class="tag">${bandLabel}</p>
        <p class="src">measured nearby · ${c.air.station.distance_km} km</p>
      </section>`
    : `<section class="card air"><h2>Air</h2><p class="big">—</p><p class="src">no station nearby</p></section>`;

  const heatCard = c.heat
    ? `<section class="card heat">
        <h2>Heat</h2>
        <p class="big">Feels ${round(c.heat.apparent_c)}°</p>
        <p class="tag">${round(c.heat.temp_c)}° · ${round(c.heat.humidity_pct)}% humidity</p>
        ${heatNote(c.heat) ? `<p class="note">${heatNote(c.heat)}</p>` : ""}
        <p class="src">estimated</p>
      </section>`
    : "";

  const more: string[] = [];
  if (c.rain?.precipitation_mm != null) more.push(`Rain: ${c.rain.precipitation_mm} mm`);
  if (c.uv?.index != null) more.push(`Sun: ${uvWord(c.uv.index)}`);
  if (c.dust?.dust_ug_m3 != null) more.push(`Dust: ${dustWord(c.dust.dust_ug_m3)}`);

  const body = `
  <p class="place">${place}</p>
  <p class="asof">updated just now</p>
  ${c.warnings?.length ? c.warnings.map(renderWarning).join("") : ""}
  <p class="verdict">${esc(verdict(c))}</p>
  <div class="cards">${airCard}${heatCard}</div>
  ${more.length ? `<details class="more"><summary>more</summary><ul>${more.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></details>` : ""}
  <p class="attr">${esc(c.attribution)}</p>
  <p class="disclaimer">${esc(c.disclaimer)}</p>
  <p class="data"><a href="/c/${slug}.json">data (JSON)</a> · <a href="/c/${slug}.md">markdown</a></p>`;

  return shell(`${place} — mugilu`, body, CONDITIONS_CSS);
}

const HOME_CSS = `
.hero{font-size:1.6rem;font-weight:700;letter-spacing:-.02em;line-height:1.25;margin:1.4rem 0 1.2rem}
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
.browse{margin:1.4rem 0 0;font-size:.85rem}.browse a{color:var(--muted)}
.hero-now{margin:0 0 1.4rem;border:1px solid var(--line);border-radius:14px;padding:14px 16px;background:var(--card)}
.hero-now h2{margin:0 0 .5rem;font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.hero-now .hl{display:block;text-decoration:none;color:var(--ink);padding:5px 0;font-size:.98rem;line-height:1.35}
.hero-now .hl b{font-weight:700}.hero-now .hl span{margin-right:6px}
`;

const CITIES = [
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
    ? `<p class="notice">Couldn't find "${esc(notFound)}" — try a city or place name.</p>`
    : "";

  const body = `
  <h1 class="hero">What's in the air &amp; heat where you are?</h1>
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
  <p class="browse"><a href="/index.json">Browse all stations</a></p>
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

  return shell("mugilu — India's open sky", body, HOME_CSS);
}
