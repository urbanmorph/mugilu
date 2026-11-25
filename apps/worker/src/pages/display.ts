import { PREVIEW_W } from "../ui/standard";
import { START_CITIES } from "../slugs";
import { langPrefixJs, withPersona } from "../links";
import { esc } from "../html";
import { PERSONAS, PERSONA_LABEL, type Persona } from "../score";
import { lp, t, tHtml, type Lang } from "../i18n";
import { SITE } from "../ui/shell";
import { HOME_OG } from "../og-html";
import { pageShell } from "../ui/page-shell";
import {
  backLink,
  band,
  button,
  comboboxJs,
  lane,
  linkButton,
  locateJs,
  pageHead,
  panel,
  searchBox,
  segmented,
  stack,
  step,
  wrap,
} from "../ui/components";

/** The place the preview starts on. */
const FIRST = START_CITIES[0].slug;

// The builder in the page: picking a city, a searched place or this screen's location, or a
// persona, updates the live preview, the Open display link and the shown link, with no
// reload. Without script the city tiles open their display and the search goes through /go.
/** The display builder's own script, for the persona it opened with. */
export const displayPageJs = (persona: Persona, lang: Lang) =>
  displayJs(persona, lang) +
  locateJs("dhere", lang, "DSP.here") +
  comboboxJs("dq", lang, { onPick: "function(x){q.value=x.label;DSP.pick(x);}" });

function displayJs(persona: Persona, lang: Lang): string {
  const LP = langPrefixJs(lang);
  return `(function(){var LP=${LP},place=${JSON.stringify(FIRST)},as=${JSON.stringify(persona)};
var fr=document.querySelector('.pvframe'),f=fr&&fr.querySelector('iframe'),open=document.getElementById('dopen'),code=document.getElementById('dlink'),form=document.querySelector('form.search'),tiles=[].slice.call(document.querySelectorAll('.tiles a[data-slug]'));
function fit(){if(f)f.style.transform='scale('+fr.clientWidth/${PREVIEW_W}+')';}fit();addEventListener('resize',fit);
function q(){return as==='everyone'?'':'&as='+as;}
function url(){return LP+'/c/'+place+'?kiosk'+q();}
function set(){var u=url();if(f&&f.getAttribute('src')!==u)f.setAttribute('src',u);open.href=u;code.textContent=u;
tiles.forEach(function(a){a.href=LP+'/c/'+a.getAttribute('data-slug')+'?kiosk'+q();if(a.getAttribute('data-slug')===place)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current');});
var h=form&&form.querySelector('input[name=as]');if(as==='everyone'){if(h)h.remove();}else{if(!h&&form){h=document.createElement('input');h.type='hidden';h.name='as';form.prepend(h);}if(h)h.value=as;}}
window.DSP={pick:function(x){place=x.lat+','+x.lon;set();}};
tiles.forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();place=a.getAttribute('data-slug');set();});});
var seg=document.getElementById('dpers');if(seg)seg.addEventListener('change',function(e){var i=e.target;if(!i||i.name!=='as')return;e.stopPropagation();as=i.value;set();try{history.replaceState(null,'',LP+'/display'+(as==='everyone'?'':'?as='+as));}catch(_){}},true);
window.DSP.here=function(a,o){place=a+','+o;set();};
})();`;
}

// The "put it on a screen" builder: pick a place (+ who it's for), open the self-refreshing
// screen display. The preview is the real display of the chosen place, scaled down.
export function renderDisplayBuilder(persona: Persona = "everyone", lang: Lang = "en"): string {
  const T = (s: string) => esc(t(s, lang));
  const kiosk = (slug: string) => lp(withPersona(`/c/${slug}?kiosk`, persona), lang);

  const head = pageHead(t("Put mugilu on a screen.", lang), {
    extra: `<p class="t-lead">${T("Turn any display into a live, self-updating read of the sky. Pick a place, open it on the screen, press full-screen. It refreshes itself, and a corner QR sends passers-by to the same place on their phone.")}</p>`,
  });
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
      `<div class="tiles">${START_CITIES.map(
        ({ slug: s, name: n }) =>
          `<a href="${esc(kiosk(s))}" data-slug="${s}"${s === FIRST ? ' aria-current="true"' : ""}>${esc(n)}</a>`,
      ).join("")}</div>`,
  );
  const s2 = step(
    2,
    T("Weight it for who is nearby"),
    segmented(
      "as",
      t("Weight it for who is nearby", lang),
      PERSONAS.map((p) => ({
        value: p,
        label: t(PERSONA_LABEL[p], lang),
        checked: p === persona,
      })),
      { legendClass: "vh" },
    ),
    { id: "dpers" },
  );
  const s3 = step(
    3,
    T("Open display"),
    linkButton(kiosk(FIRST), t("Open display", lang), true, "screen", "dopen") +
      `<p class="t-meta"><code id="dlink">${esc(kiosk(FIRST))}</code></p>`,
    { grow: true },
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
        `<p class="t-meta">${tHtml(
          "The display link is just {link}, so you can bookmark or script it. Add {as} (or asthma, child, outdoor, heart) to weight the read for a clinic, school or worksite.",
          lang,
          { link: "<code>/c/{place}?kiosk</code>", as: "<code>&amp;as=elderly</code>" },
        )}</p>`,
    ),
    { title: t("How it runs", lang) },
  );

  const body = wrap(
    band(lane("l57", [head, preview])) +
      band(lane("l2", [s1, `<div class="col">${s2}${s3}</div>`])) +
      band(how) +
      band(backLink(lp("/", lang), `← ${t("back to mugilu", lang)}`)),
  );
  return pageShell(`${t("Put mugilu on a screen.", lang).replace(/\.$/, "")}: mugilu`, body, {
    path: "/display",
    desc: t(
      "Turn any wall display or kiosk into a live, self-refreshing read of India's sky. Pick a place, open it on the screen, full-screen it. It updates itself.",
      lang,
    ),
    canonical: `${SITE}/display`,
    ogImage: HOME_OG,
    lang,
    script: { key: `display.${persona}`, js: displayPageJs(persona, lang) },
  });
}
