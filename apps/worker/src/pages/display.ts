import { esc } from "../html";
import { PERSONAS, PERSONA_LABEL, type Persona } from "../score";
import { lp, t, type Lang } from "../i18n";
import { HOME_OG, SITE } from "../ui/shell";
import { pageShell } from "../ui/page-shell";
import {
  backLink,
  band,
  button,
  comboboxJs,
  ico,
  lane,
  panel,
  searchBox,
  segmented,
  stack,
  wrap,
} from "../ui/components";

// The cities offered as a start (the live list), by slug.
const CITIES: [slug: string, name: string][] = [
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
/** The place the preview starts on. */
const FIRST = CITIES[0][0];

// The builder in the page: picking a city, a searched place or this screen's location, or a
// persona, updates the live preview, the Open display link and the shown link, with no
// reload. Without script the city tiles open their display and the search goes through /go.
function displayJs(persona: Persona, lang: Lang): string {
  const LP = JSON.stringify(lang === "en" ? "" : "/" + lang);
  return `(function(){var LP=${LP},place=${JSON.stringify(FIRST)},as=${JSON.stringify(persona)};
var fr=document.querySelector('.pvframe'),f=fr&&fr.querySelector('iframe'),open=document.getElementById('dopen'),code=document.getElementById('dlink'),form=document.querySelector('form.search'),tiles=[].slice.call(document.querySelectorAll('.tiles a[data-slug]'));
function fit(){if(f)f.style.transform='scale('+fr.clientWidth/1280+')';}fit();addEventListener('resize',fit);
function q(){return as==='everyone'?'':'&as='+as;}
function url(){return LP+'/c/'+place+'?kiosk'+q();}
function set(){var u=url();if(f&&f.getAttribute('src')!==u)f.setAttribute('src',u);open.href=u;code.textContent=u;
tiles.forEach(function(a){a.href=LP+'/c/'+a.getAttribute('data-slug')+'?kiosk'+q();if(a.getAttribute('data-slug')===place)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current');});
var h=form&&form.querySelector('input[name=as]');if(as==='everyone'){if(h)h.remove();}else{if(!h&&form){h=document.createElement('input');h.type='hidden';h.name='as';form.prepend(h);}if(h)h.value=as;}}
window.DSP={pick:function(x){place=x.lat+','+x.lon;set();}};
tiles.forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();place=a.getAttribute('data-slug');set();});});
var seg=document.getElementById('dpers');if(seg)seg.addEventListener('change',function(e){var i=e.target;if(!i||i.name!=='as')return;e.stopPropagation();as=i.value;set();try{history.replaceState(null,'',LP+'/display'+(as==='everyone'?'':'?as='+as));}catch(_){}},true);
var b=document.getElementById('dhere');if(b&&navigator.geolocation){var label=b.innerHTML;b.hidden=false;b.onclick=function(){b.textContent=${JSON.stringify(t("Finding your location…", lang))};navigator.geolocation.getCurrentPosition(function(p){place=p.coords.latitude.toFixed(4)+','+p.coords.longitude.toFixed(4);set();b.innerHTML=label;},function(){b.textContent=${JSON.stringify(t("Your location is not available.", lang))};});};}
})();`;
}

/** A numbered setup step. */
const step = (n: number, title: string, body: string, grow = false) =>
  `<section class="panel${grow ? " grow" : ""}"><div class="in step"><h2 class="t-h2"><span class="cnum solid">${n}</span>${title}</h2>${body}</div></section>`;

// The "put it on a screen" builder: pick a place (+ who it's for), open the self-refreshing
// screen display. The preview is the real display of the chosen place, scaled down.
export function renderDisplayBuilder(persona: Persona = "everyone", lang: Lang = "en"): string {
  const T = (s: string) => esc(t(s, lang));
  const asQ = persona !== "everyone" ? `&as=${persona}` : "";
  const kiosk = (slug: string) => lp(`/c/${slug}?kiosk${asQ}`, lang);

  const head =
    `<div class="ph"><h1 class="t-title">${T("Put mugilu on a screen.")}</h1>` +
    `<p class="t-lead">${T("Turn any display into a live, self-updating read of the sky. Pick a place, open it on the screen, press full-screen. It refreshes itself, and a corner QR sends passers-by to the same place on their phone.")}</p></div>`;
  const preview =
    `<figure class="stack" aria-labelledby="pvk"><p class="t-kicker" id="pvk">${T("Preview")}</p>` +
    `<div class="pvframe" aria-hidden="true"><iframe src="${esc(kiosk(FIRST))}" title="${T("Preview")}" tabindex="-1" loading="lazy"></iframe></div></figure>`;

  const s1 = step(
    1,
    T("Pick a place"),
    searchBox({
      id: "dq",
      label: t("A city, area or address", lang),
      placeholder: t("A city, area or address", lang),
      action: lp("/go", lang),
      hidden: [["kiosk", "1"], ...(persona !== "everyone" ? ([["as", persona]] as [string, string][]) : [])],
    }) +
      button(t("Use this screen's location", lang), { id: "dhere", icon: "pin", hidden: true }) +
      `<p class="t-meta">${T("A display can show a city, a neighbourhood or an exact point. Search for it above, or use where this screen stands.")}</p>` +
      `<div class="tiles">${CITIES.map(
        ([s, n]) =>
          `<a href="${esc(kiosk(s))}" data-slug="${s}"${s === FIRST ? ' aria-current="true"' : ""}>${esc(n)}</a>`,
      ).join("")}</div>`,
  );
  const s2 =
    `<section class="panel"><div class="in step" id="dpers"><h2 class="t-h2"><span class="cnum solid">2</span>${T("Weight it for who is nearby")}</h2>` +
    segmented(
      "as",
      t("Weight it for who is nearby", lang),
      PERSONAS.map((p) => ({
        value: p,
        label: t(PERSONA_LABEL[p], lang),
        checked: p === persona,
        href: lp(p === "everyone" ? "/display" : `/display?as=${p}`, lang),
      })),
      "vh",
    ) +
    `</div></section>`;
  const s3 = step(
    3,
    T("Open display"),
    `<a class="btn primary" id="dopen" href="${esc(kiosk(FIRST))}">${ico("screen")}${T("Open display")}</a>` +
      `<p class="t-meta"><code id="dlink">${esc(kiosk(FIRST))}</code></p>`,
    true,
  );
  const step4 =
    lang === "en"
      ? "For an always-on unattended screen, point a kiosk-browser app (for example Fully Kiosk on Android) at the same link so it auto-starts."
      : t("For an always-on unattended screen, point a kiosk-browser app at the same link so it auto-starts.", lang);
  const how = panel(
    stack(
      `<ol class="howto cards4">${[
        T(
          "Open the display link in the screen's browser: a smart TV, a cheap streaming stick, or an old tablet in a stand.",
        ),
        T("Press full-screen (F11 with a keyboard, or the browser's full-screen control)."),
        T(
          "Leave it. It refreshes on its own, keeps the screen awake, and if the network blips it holds the last reading and recovers.",
        ),
        esc(step4),
      ]
        .map((s) => `<li><span>${s}</span></li>`)
        .join("")}</ol>` +
        `<p class="t-meta">The display link is just <code>/c/{place}?kiosk</code>, so you can bookmark or script it. Add <code>?as=elderly</code> (or asthma, child, outdoor, heart) to weight the read for a clinic, school or worksite.</p>`,
    ),
    { title: t("How it runs", lang) },
  );

  const body = wrap(
    band(lane("l57", [head, preview])) +
      band(lane("l2", [s1, `<div class="col">${s2}${s3}</div>`])) +
      band(how) +
      band(backLink(lp("/", lang), `← ${t("back to mugilu", lang)}`)),
  );
  return pageShell("Put mugilu on a screen: mugilu", body, {
    path: "/display",
    desc: "Turn any wall display or kiosk into a live, self-refreshing read of India's sky. Pick a place, open it on the screen, full-screen it. It updates itself.",
    canonical: `${SITE}/display`,
    ogImage: HOME_OG,
    lang,
    js: displayJs(persona, lang) + comboboxJs("dq", lang, { onPick: "function(x){q.value=x.label;DSP.pick(x);}" }),
  });
}
