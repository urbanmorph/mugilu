import { isoOf, istTime } from "../ist";
import { esc } from "../html";
import { LANGS, langUrl, t, type Lang } from "../i18n";
import { installHead } from "../install";
import { SITE_DESC } from "../hazards";

// The UrbanMorph brand icon, inlined as a tiny data URI (no external request).
export const UM_ICON =
  "data:image/webp;base64,UklGRoQDAABXRUJQVlA4WAoAAAAQAAAAQgAASgAAQUxQSGABAAABkJNtW6U5rwQcLBIQsEk+CSMBCSOBLu0vAQcZCZ+DIIEuZai2fXPiTJkiIiYAAAL/HRD4b8FP/lMx2N1RCwMal3OvzH/u4xPru1yZrXtYZfsWV+F2gd0bRO4XuV/kfp77OR4gHSBwP1sOELmf4QHCCfIBHA8QTqAn4AHsCeQE/gThvzgPfCXg2y4KqSS870KgQsH3xaTmkCoJ+FjAD7lxVxjx9mOetKCWYWsMwNePWaYpVSiINT4GeHufUtAcawpbaiwvC0x52q4aBXcDyeyn+DbTkA20iWGKaUOsMcKkVR50SgM9TFrk6oE20MPoEhnd0kIP3GUB3wdtYTSwcZpioG1iFsDcOseNwN1EqgCAXDIsYKy2kTk4/D0oYbBJHX/rI4OyGQVX+sgwpjiMd2WR4jDTpiWyw1zzLKAG0+8yK2BFq1PUYlHRYSpY2MUyoETB6tcrNaXXhU2deIF4cTg/VlA4IP4BAAAwDwCdASpDAEsAPmEqkEYkIiGhLhLpIIAMCWgAxy4m3X55/Wfx452bgrvdh4X5LpYeJF0gPMB+wHrTehb0AP2K6zf0AP1G9MH9u/go/cT0gMwl/AD9KwRtq39DJthRE7/H373TUAJXNuytPYhPi8MfLHkJV50C4PGrb5fSD4WgzSjQAPh3RT0GeeeTA4yz+jQX+ee18m/jZVpp8lpybn+Tp/c4H/9Dg1zVx+/8YsvIDz27eD4nJgnR/9mGT7GBUr+atMN5idp9vfkv/dxusODKkUfkm7dc9OORlMEkdLOWb95Mv6Sr/FT3ky/pKm868ItysJf5pVPbP2/zTP/+tG4+lPY+QR2MaFA5FKAhAphAgPngo3P448Pg3dlyT5sgQ/DC2XOncFEuTYcuTY8vnDQY0Z4F1AgRwfuAqdKLE6QHZgBK6Xw5g1byAH3cLsY1KMv/d542Q73UdTBEWLf3/Vj9Q4amKbTs1XoUXRzBWE+Atwe+00idWo9294h0q/eZjD5I1GANDkIne1SB0Qb+NiQO8cRp1I4Hxjf4gQaeaqez9KoIlJhW4Bvg1IOxIx0IuWGi3qRnpMMGvfIzDdWPHD0t8m8/yhT42IhbFj3rfFDvvfGNMr/2Mo/BWrIvf9NccHkg6U8jqDPvuT7cTvc7S2vkJcs8etluA1LbC+AAAAA=";

// Notched phones: pages opt into the full screen (viewport-fit=cover) and pad
// whatever meets a screen edge by the notch/home-bar inset. env() is 0 on other
// screens, so the "+ inset" leaves their layout unchanged.
export const VIEWPORT = `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`;

export const SITE = "https://mugilu.live";

/** schema.org JSON-LD, safe to embed in a <script> (escapes the `<` that could
 *  otherwise break out of the tag). */
export function ld(obj: object): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

/** A schema.org BreadcrumbList from the site's home down to this page. */
export function breadcrumb(...items: [name: string, url: string][]): object {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [["mugilu", SITE], ...items].map(([name, item], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item,
    })),
  };
}

// Cloudflare Web Analytics (RUM) beacon token. PUBLIC (it ships in every page's
// HTML), so it is safe to commit. Cookieless, no PII, no cross-site tracking, no
// fingerprinting; complements the first-party D1/AE pipeline with real referrers,
// unique visitors and Core Web Vitals. Empty = beacon off (renders nothing).
const CF_BEACON_TOKEN = "f2e28ec9892741889c2fb81ec96ff4dd";

/** Page settings for the head tags (pageShell). */
export interface ShellOpts {
  desc?: string;
  canonical?: string;
  jsonLd?: string;
  ogImage?: string;
  noBeacon?: boolean;
  lang?: Lang;
  /** Keep the page out of search indexes while its links are still followed (thin, endless pages). */
  noindex?: boolean;
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
      : `function r(ms){var m=Math.round(ms/6e4);if(m<1)return ${JSON.stringify(t("just now", lang))};if(m<60)return ${JSON.stringify(t("{n} min ago", lang))}.replace('{n}',m);var h=Math.round(m/60);if(h<24)return ${JSON.stringify(t("{n} hours ago", lang))}.replace('{n}',h);var d=Math.round(h/24);return ${JSON.stringify(t("{n} days ago", lang))}.replace('{n}',d);}`;
  // window.mgRel re-runs it: the screen display calls it on its interval and after a data swap.
  return `(function(){${relFn}window.mgRel=function(){var n=Date.now();document.querySelectorAll('time[data-rel][datetime]').forEach(function(t){var d=new Date(t.getAttribute('datetime')).getTime();if(!isNaN(d))t.textContent=r(n-d);});};mgRel();})();`;
}

/** A relative-time element: the worker renders the absolute IST time (the no-JS /
 *  crawler fallback); the shell script upgrades it to "X ago" at view-time, so a
 *  cached page never shows a stale "N min ago" baked in at render time. */
export function relTime(w: Date | string | number): string {
  return `<time data-rel datetime="${esc(typeof w === "string" ? w : isoOf(w))}">${istTime(w)}</time>`;
}

/** The one client-side escape, for text and attribute positions alike (& < > " '). */
export const CLIENT_ESC = `function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}`;
