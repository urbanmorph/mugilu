import { type NationalHighlights } from "../highlights";
import { esc } from "../html";
import { slugForName } from "../slugs";
import { lp, t, type Lang } from "../i18n";
import { FRESHEN } from "../freshen";
import { HAZARDS_SHORT, SITE_DESC } from "../hazards";
import { MAP_CSS, MAP_JS, type IndiaMap } from "../indiamap";
import { icon, renderHero } from "./read";
import { AC_CSS, CLIENT_ESC, HOME_OG, NEARME_CSS, SITE, ld, nearMeJs, shell, typeaheadJs } from "../ui/shell";

export const HOME_CSS = `
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
  ${nearMeJs("nearme", "''", lang)}
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
    description: t(SITE_DESC, lang),
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
  return shell(t(`mugilu: ${HAZARDS_SHORT} anywhere in India`, lang), body, HOME_CSS + MAP_CSS + NEARME_CSS, {
    desc: t(SITE_DESC, lang),
    canonical: SITE,
    jsonLd: site,
    ogImage: HOME_OG,
    lang,
  });
}
