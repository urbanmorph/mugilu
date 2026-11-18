import { esc } from "../html";
import { type AmbientRisk } from "../score";
import { paletteCss, tintOf } from "../palette";
import { LANGS, LANG_NAME, langCss, langUrl, lp, t, type Lang } from "../i18n";
import { INSTALL_CSS, INSTALL_JS, installButton, installHead } from "../install";
import { SW_REGISTER } from "../sw";
import { SITE_DESC } from "../hazards";

export const CLOUD =
  '<svg width="22" height="22" viewBox="0 0 64 64" aria-hidden="true" style="vertical-align:-4px">' +
  '<g fill="var(--sky)"><rect x="14" y="35" width="36" height="13" rx="6.5"/>' +
  '<circle cx="24" cy="33" r="9"/><circle cx="37" cy="30" r="11"/><circle cx="46" cy="37" r="6.5"/></g></svg>';

// GitHub mark for the footer star CTA, and the UrbanMorph brand icon inlined as
// a tiny data URI (self-contained: no external request, no dependency on their site).
export const GH_MARK =
  '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>';
export const UM_ICON =
  "data:image/webp;base64,UklGRoQDAABXRUJQVlA4WAoAAAAQAAAAQgAASgAAQUxQSGABAAABkJNtW6U5rwQcLBIQsEk+CSMBCSOBLu0vAQcZCZ+DIIEuZai2fXPiTJkiIiYAAAL/HRD4b8FP/lMx2N1RCwMal3OvzH/u4xPru1yZrXtYZfsWV+F2gd0bRO4XuV/kfp77OR4gHSBwP1sOELmf4QHCCfIBHA8QTqAn4AHsCeQE/gThvzgPfCXg2y4KqSS870KgQsH3xaTmkCoJ+FjAD7lxVxjx9mOetKCWYWsMwNePWaYpVSiINT4GeHufUtAcawpbaiwvC0x52q4aBXcDyeyn+DbTkA20iWGKaUOsMcKkVR50SgM9TFrk6oE20MPoEhnd0kIP3GUB3wdtYTSwcZpioG1iFsDcOseNwN1EqgCAXDIsYKy2kTk4/D0oYbBJHX/rI4OyGQVX+sgwpjiMd2WR4jDTpiWyw1zzLKAG0+8yK2BFq1PUYlHRYSpY2MUyoETB6tcrNaXXhU2deIF4cTg/VlA4IP4BAAAwDwCdASpDAEsAPmEqkEYkIiGhLhLpIIAMCWgAxy4m3X55/Wfx452bgrvdh4X5LpYeJF0gPMB+wHrTehb0AP2K6zf0AP1G9MH9u/go/cT0gMwl/AD9KwRtq39DJthRE7/H373TUAJXNuytPYhPi8MfLHkJV50C4PGrb5fSD4WgzSjQAPh3RT0GeeeTA4yz+jQX+ee18m/jZVpp8lpybn+Tp/c4H/9Dg1zVx+/8YsvIDz27eD4nJgnR/9mGT7GBUr+atMN5idp9vfkv/dxusODKkUfkm7dc9OORlMEkdLOWb95Mv6Sr/FT3ky/pKm868ItysJf5pVPbP2/zTP/+tG4+lPY+QR2MaFA5FKAhAphAgPngo3P448Pg3dlyT5sgQ/DC2XOncFEuTYcuTY8vnDQY0Z4F1AgRwfuAqdKLE6QHZgBK6Xw5g1byAH3cLsY1KMv/d542Q73UdTBEWLf3/Vj9Q4amKbTs1XoUXRzBWE+Atwe+00idWo9294h0q/eZjD5I1GANDkIne1SB0Qb+NiQO8cRp1I4Hxjf4gQaeaqez9KoIlJhW4Bvg1IOxIx0IuWGi3qRnpMMGvfIzDdWPHD0t8m8/yhT42IhbFj3rfFDvvfGNMr/2Mo/BWrIvf9NccHkg6U8jqDPvuT7cTvc7S2vkJcs8etluA1LbC+AAAAA=";

// Notched phones: pages opt into the full screen (viewport-fit=cover) and pad
// whatever meets a screen edge by the notch/home-bar inset. env() is 0 on other
// screens, so the "+ inset" leaves their layout unchanged.
export const VIEWPORT = `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`;

/** `padding` of `y` (top/bottom) and `x` (left/right), each plus that side's safe-area inset. */
export function safePad(y: string, x: string): string {
  const side = (s: string, v: string) => `calc(${v} + env(safe-area-inset-${s}))`;
  return `padding:${side("top", y)} ${side("right", x)} ${side("bottom", y)} ${side("left", x)}`;
}

export const BASE_CSS = `
${paletteCss()}
:root{--sky:#0284c7;--ink:#0f172a;--muted:#64748b;--bg:#f8fafc;--card:#fff;--line:#e2e8f0;--warn-text:#b45309;--serif:Georgia,'Iowan Old Style','Palatino Linotype',Palatino,Cambria,serif;--sans:ui-sans-serif,-apple-system,system-ui,sans-serif;--mono:ui-monospace,SFMono-Regular,Menlo,monospace;--hair:color-mix(in srgb,var(--ink) 12%,transparent)}
@media(prefers-color-scheme:dark){:root{--ink:#e2e8f0;--muted:#94a3b8;--bg:#0b1220;--card:#111827;--line:#1f2937;--warn-text:#fbbf24}}
*{box-sizing:border-box}html,body{margin:0}
body{font:16px/1.5 var(--sans);color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased;padding-bottom:env(safe-area-inset-bottom)}
.bar{display:flex;flex-wrap:wrap;row-gap:10px;align-items:center;padding:calc(14px + env(safe-area-inset-top)) calc(18px + env(safe-area-inset-right)) 14px calc(18px + env(safe-area-inset-left));border-bottom:1px solid var(--line)}
.brand{font-weight:700;letter-spacing:-.02em;color:var(--ink);text-decoration:none;font-size:1.1rem}
main{max-width:560px;margin:0 auto;padding:20px 18px 32px}
.foot{max-width:560px;margin:0 auto;padding:18px;color:var(--muted);font-size:.78rem;border-top:1px solid var(--line)}
.foot a{color:var(--muted)}
.langsw{max-width:560px;margin:0 auto;padding:0 18px 22px;font-size:.82rem;color:var(--muted)}
.langsw a{color:var(--muted);text-decoration:none;border-bottom:1px solid transparent}
.langsw a:hover{border-color:var(--muted)}
.langsw b{color:var(--ink);font-weight:600}
.ic{width:18px;height:18px;flex:none;vertical-align:-.18em}
.topnav{order:3;flex-basis:100%;display:flex;gap:1.1rem;overflow-x:auto;white-space:nowrap;scrollbar-width:none;font-size:.88rem}
.topnav a{color:var(--ink);text-decoration:none}.topnav a:hover,.topnav a[aria-current]{text-decoration:underline;text-underline-offset:.3em}
@media(min-width:960px){:is(.foot,.langsw){max-width:1180px}body.wide main{max-width:1180px;padding-top:28px}.topnav{order:0;flex-basis:auto;overflow:visible;gap:1.6rem;margin:0 1.4rem 0 auto;font-size:.95rem}}
`;

export const SITE = "https://mugilu.live";
/** Where there is no room for the full disclaimer (kiosk, embed card). */
export const SHORT_DISCLAIMER = "Informational only, not medical advice.";
export const HOME_OG = `${SITE}/og.png`; // the branded social-share card

export /** schema.org JSON-LD, safe to embed in a <script> (escapes the `<` that could
 *  otherwise break out of the tag). */
function ld(obj: object): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

// Cloudflare Web Analytics (RUM) beacon token. PUBLIC (it ships in every page's
// HTML), so it is safe to commit. Cookieless, no PII, no cross-site tracking, no
// fingerprinting; complements the first-party D1/AE pipeline with real referrers,
// unique visitors and Core Web Vitals. Empty = beacon off (renders nothing).
export const CF_BEACON_TOKEN = "f2e28ec9892741889c2fb81ec96ff4dd";

// Footer nav: localized labels, language-prefixed internal links. The two GitHub
// links stay external (labels localized). "a digital commons" is a single phrase
// in hi/kn, so it renders as one localized link.
export function footerNav(lang: Lang): string {
  const nav = (path: string, en: string) => `<a href="${lp(path, lang)}">${t(en, lang)}</a>`;
  return (
    `${nav("/about", "about")} · ${nav("/methodology", "how it works")} · ` +
    `${nav("/places", "all places")} · ${nav("/about#build", "build on it")} · ${nav("/mcp", "MCP server")} · ` +
    `${nav("/terms", "terms")} · ` +
    `<a href="https://github.com/urbanmorph/mugilu">${t("code", lang)}</a> · ` +
    `<a href="https://github.com/urbanmorph/mugilu/blob/main/PDGI.md">${t("a digital commons", lang)}</a>`
  );
}

// Footer language switcher: each language named in its own script, current one
// bold (not a link). Links are RELATIVE (path-only) so they work on any host,
// localhost in dev and the apex in prod; the absolute hreflang/canonical/og
// above stay absolute for SEO. `canonical` carries the language-agnostic path.
export function langSwitcher(canonical: string, lang: Lang): string {
  const path = new URL(canonical).pathname;
  const items = LANGS.map((L) =>
    L === lang ? `<b>${LANG_NAME[L]}</b>` : `<a href="${esc(lp(path, L))}" hreflang="${L}">${LANG_NAME[L]}</a>`,
  ).join(" · ");
  return `<nav class="langsw" aria-label="Language">${items}</nav>`;
}

// The header nav on the wide pages: the places, warnings, display and explainer pages,
// the current one marked. Shown from 960 px; phones keep the plain header.
export const TOP_NAV: [string, string][] = [
  ["/places", "Places"],
  ["/warnings", "Warnings"],
  ["/display", "Display"],
  ["/methodology", "How it works"],
  ["/about", "About"],
];
export function topNav(canonical: string | undefined, lang: Lang): string {
  const here = canonical ? new URL(canonical).pathname : "";
  const links = TOP_NAV.map(
    ([p, en]) => `<a href="${lp(p, lang)}"${p === here ? ' aria-current="page"' : ""}>${t(en, lang)}</a>`,
  ).join("");
  return `<nav class="topnav" aria-label="${esc(t("Main", lang))}">${links}</nav>`;
}

/** Optional page settings for shell(). */
export interface ShellOpts {
  desc?: string;
  canonical?: string;
  jsonLd?: string;
  ogImage?: string;
  noBeacon?: boolean;
  lang?: Lang;
  /** Chromeless: no header bar, footer nav or language switcher (kiosk/display). */
  bare?: boolean;
  /** Keep the page out of search indexes while its links are still followed (thin, endless pages). */
  noindex?: boolean;
  /** The wide layout (960 px and up) with a header nav: the directory, warnings, display,
   *  station and text pages. Home and the place pages keep their own layouts. */
  wide?: boolean;
}

/** The head tags every page shares: icons, install meta, title, description, canonical and
 *  hreflang alternates, Open Graph and Twitter cards, JSON-LD and the analytics beacon. */
export function headTags(
  title: string,
  { desc = SITE_DESC, canonical, jsonLd, ogImage, noBeacon, lang = "en", noindex }: ShellOpts = {},
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
  return `<meta charset="utf-8">
${VIEWPORT}
<meta name="color-scheme" content="light dark">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
${installHead(lang)}
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? `<meta name="robots" content="noindex, follow">\n` : ""}${cur ? `<link rel="canonical" href="${esc(cur)}">` : ""}${alts}
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
${CF_BEACON_TOKEN && !noBeacon ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${CF_BEACON_TOKEN}"}'></script>` : ""}`;
}

/** Client-side relative time for every <time data-rel>. English keeps singular/plural; other
 *  languages use the reviewed "X … ago" templates (the X slot survives translation). */
export function relTimeJs(lang: Lang): string {
  const relFn =
    lang === "en"
      ? `function r(ms){var m=Math.round(ms/6e4);if(m<1)return'just now';if(m<60)return m+' min ago';var h=Math.round(m/60);if(h<24)return h+(h===1?' hour ago':' hours ago');var d=Math.round(h/24);return d+(d===1?' day ago':' days ago');}`
      : `function r(ms){var m=Math.round(ms/6e4);if(m<1)return ${JSON.stringify(t("just now", lang))};if(m<60)return ${JSON.stringify(t("X min ago", lang))}.replace('X',m);var h=Math.round(m/60);if(h<24)return ${JSON.stringify(t("X hours ago", lang))}.replace('X',h);var d=Math.round(h/24);return ${JSON.stringify(t("X days ago", lang))}.replace('X',d);}`;
  return `(function(){${relFn}var n=Date.now();document.querySelectorAll('time[data-rel][datetime]').forEach(function(t){var d=new Date(t.getAttribute('datetime')).getTime();if(!isNaN(d))t.textContent=r(n-d);});})();`;
}

export function shell(title: string, body: string, css: string, opts: ShellOpts = {}): string {
  const { canonical, lang = "en", bare, wide } = opts;
  return `<!doctype html>
<html lang="${lang}">
<head>
${headTags(title, opts)}
<style>${BASE_CSS}${bare ? "" : INSTALL_CSS}${css}${langCss(lang)}</style>
</head>
<body${wide ? ' class="wide"' : ""}>
${
  bare
    ? body
    : `<header class="bar"><a class="brand" href="${lp("/", lang)}">${CLOUD} mugilu</a>${topNav(canonical, lang)}${installButton(lang)}</header>
<main>${body}</main>
<footer class="foot">${footerNav(lang)}</footer>
${canonical ? langSwitcher(canonical, lang) : ""}
<script>${INSTALL_JS}${SW_REGISTER}</script>`
}
<script>
${relTimeJs(lang)}
</script>
</body>
</html>`;
}

// The conditions page as an "atmospheric almanac": a sky-tinted backdrop whose hue
// names the dominant hazard and whose strength its band (--tint/--tk from tintOf;
// clear-sky blue when calm), the headline word in the severity colour (--cond), an
// editorial serif Ambient statement, and the readings as hairline-ruled strata
// (not cards). Inline-SVG line icons, currentColor so the driver layer glows.
// The backdrop that says what the data says: the hazard's hue at its level's strength
// (--tint/--tk, from palette.ts tintOf), fading down the page. One rule for every page
// that has a read: /c, a station, /warnings.
export const TINT_BODY_CSS = `body{background:linear-gradient(180deg,color-mix(in srgb,var(--tint) var(--tk),var(--bg)),color-mix(in srgb,var(--tint) 8%,var(--bg)) 22%,var(--bg) 55%) var(--bg) no-repeat}`;

/** The --tint/--tk variables for a read, by the canonical rule. */
export function tintVars(risk: Pick<AmbientRisk, "band" | "driver">): string {
  const { hue, strength } = tintOf(risk);
  return `:root{--tint:${hue};--tk:${strength}%}`;
}

/** Short IST stamp, e.g. "14:32 IST · 27 Jun". The time travels on embeds/PNGs. */
export const IST_HM = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
export const IST_DM = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
export function istTime(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : `${IST_HM.format(d)} IST · ${IST_DM.format(d)}`;
}

/** A relative-time element: the worker renders the absolute IST time (the no-JS /
 *  crawler fallback); the shell script upgrades it to "X ago" at view-time, so a
 *  cached page never shows a stale "N min ago" baked in at render time. */
export function relTime(iso: string): string {
  return `<time data-rel datetime="${iso}">${istTime(iso)}</time>`;
}

/** A text page with a contents list beside it (wide screens): one link per section
 *  heading (`class="ah"`), each heading given an anchor unless it has one (#build). */
export function withToc(body: string, lang: Lang): string {
  let n = 0;
  const links: string[] = [];
  const marked = body.replace(
    /<(p|h2) class="ah"(?: id="([^"]+)")?>([\s\S]*?)<\/\1>/g,
    (_m, tag: string, id: string | undefined, inner: string) => {
      const anchor = id ?? `s${++n}`;
      links.push(
        `<a href="#${anchor}">${inner
          .replace(/<svg[\s\S]*?<\/svg>/g, "")
          .replace(/<[^>]+>/g, "")
          .trim()}</a>`,
      );
      return `<${tag} class="ah" id="${anchor}">${inner}</${tag}>`;
    },
  );
  if (links.length < 3) return body;
  return `<div class="axw"><nav class="toc" aria-label="${esc(t("On this page", lang))}"><b>${t("On this page", lang)}</b>${links.join("")}</nav><div class="axb">${marked}</div></div>`;
}

// The "use my location" button (home, and the display setup): shown only where the
// browser can locate, it opens /c for the spot, plus `suffix` (a JS expression, e.g. the
// kiosk flag), and tells the reader if the location is off.
export const NEARME_CSS = `.nearme{display:inline-flex;align-items:center;gap:.4rem;font-size:.95rem;padding:10px 14px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink);cursor:pointer;margin:0 0 1rem}
.nearme .ic{width:16px;height:16px;color:var(--sky)}`;
export function nearMeJs(id: string, suffix: string, lang: Lang): string {
  const LP = JSON.stringify(lang === "en" ? "" : "/" + lang);
  return `(function(){var b=document.getElementById('${id}');if(!b||!navigator.geolocation)return;var label=b.textContent,LOC=${JSON.stringify(t("Finding your location…", lang))},NOLOC=${JSON.stringify(t("Your location is not available.", lang))};b.hidden=false;
b.onclick=function(){b.textContent=LOC;navigator.geolocation.getCurrentPosition(function(p){location.href=${LP}+'/c/'+p.coords.latitude.toFixed(4)+','+p.coords.longitude.toFixed(4)+${suffix};},function(){b.textContent=NOLOC;});};
addEventListener('pageshow',function(){b.textContent=label;});})();`;
}

/** The suggestion list's style (home and the display setup page). */
export const AC_CSS = `.acwrap{position:relative}
.ac{list-style:none;margin:4px 0 0;padding:4px;position:absolute;left:0;right:0;z-index:9;background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.14)}
.ac:empty{display:none}
.ac li{padding:9px 10px;border-radius:8px;cursor:pointer;font-size:.95rem}
.ac li span{color:var(--muted);font-size:.85rem}
.ac li.on,.ac li:hover{background:var(--bg)}
`;

/** Escapes text for innerHTML in a page script; each script scope that builds HTML defines it. */
export const CLIENT_ESC = `function esc(s){return String(s).replace(/[<&>]/g,function(c){return c==='<'?'&lt;':c==='>'?'&gt;':'&amp;';});}`;

/** Place suggestions as you type, for the input `inputId` and list `listId`: arrows
 *  and Enter pick one, which opens its /c page with `suffix` (a JS expression)
 *  appended. Needs `LP` (the language prefix) in scope; warms the page through `pf`
 *  when the page defines one. */
export function typeaheadJs(inputId: string, listId: string, suffix: string): string {
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
