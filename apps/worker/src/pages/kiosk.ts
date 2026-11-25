import { coordKey, withPersona } from "../links";
import { type Conditions } from "../types";
import { briefs, placeLabel } from "../readings";
import { esc } from "../html";
import { ambientRisk, type Persona } from "../score";
import { t, type Lang } from "../i18n";
import { pageShell } from "../ui/page-shell";
import { DISCLAIMER_FULL, ico, qrBlock, stamp } from "../ui/components";
import { relTime } from "../ui/shell";
import { ambientPlate, nearbyWarnings, readRows, warningIcon, warningTitle, type ReadRow } from "./read";

// ── The screen display (?kiosk) ─────────────────────────────────────────────────────
// Full screen, read from across a room, self-refreshing: the place and the clock, the
// Ambient plate beside the readings that matter most, the disclaimer and a QR that sends
// passers-by to the same place on their phone. Always dark; the kiosk type steps are sized
// by the screen's height (tokens.ts), and portrait stacks the plate over the readings.

/** The loading verbs the display cycles through while it refreshes. */
const KIOSK_VERBS = [
  "Reading the sky",
  "Checking the air",
  "Gauging the heat",
  "Watching for warnings",
  "Catching the wind",
  "Looking up",
];

/** The display refreshes its data every 14 minutes, and reloads the whole page every 20th time. */
const REFRESH_MS = 14 * 60_000;
const RELOAD_EVERY = 20;

/** The display's script, with its words in the page's language (X is the number). */
export const kioskJs = (lang: Lang) => {
  const s = (en: string) => JSON.stringify(t(en, lang)).replace(/</g, "\\u003c");
  return `(function(){
var clkI,agoI,refT,vbT,n=0;
var verbs=[${KIOSK_VERBS.map(s).join(",")}];
function rel(){if(window.mgRel)mgRel();}
function p(x){return x<10?'0'+x:''+x}
function clock(){var c=document.getElementById('clk');if(c){var d=new Date();c.textContent=p(d.getHours())+':'+p(d.getMinutes());}}
function tfit(){var tl=document.querySelector('.kio .ktiles');if(!tl)return;function tov(){return tl.scrollHeight-tl.clientHeight;}var c=[].concat.apply([],['.plate .knorm','.plate .also','.kt>p.qa','.kt>.bars'].map(function(q){return[].slice.call(document.querySelectorAll('.kio '+q)).reverse();}));for(var i=0;i<c.length&&tov()>1;i++){if(c[i].hidden)continue;var b=tov();c[i].hidden=true;if(tov()>=b)c[i].hidden=false;}}
function fit(){document.querySelectorAll('.kio .kt>p.qa,.kio .kt>.bars').forEach(function(e){e.hidden=false;});var pl=document.querySelector('.kio .plate'),hd=pl&&pl.querySelector('.t-plate');if(!hd)return;hd.style.fontSize='';var drop=[].slice.call(pl.querySelectorAll('.also,.knorm'));drop.forEach(function(e){e.hidden=false;});var tl=document.querySelector('.kio .ktiles'),st=tl&&tl.getBoundingClientRect().top>=pl.getBoundingClientRect().bottom-1;function tov(){return tl?tl.scrollHeight-tl.clientHeight:0;}var s0=parseFloat(getComputedStyle(hd).fontSize),s=s0;function over(){return pl.scrollHeight>pl.clientHeight+1||(st&&tov()>1);}function shrink(to){var g=0;while(over()&&s>to&&g++<8){s=Math.max(to,Math.floor(s*Math.min(.96,pl.clientHeight/pl.scrollHeight,st?pl.clientHeight/(pl.clientHeight+tov()):1)));hd.style.fontSize=s+'px';}}shrink(s0*.6);while(over()&&drop.length)drop.pop().hidden=true;tfit();shrink(24);}
function veil(){return document.querySelector('.kveil');}
function showLoad(){clearTimeout(vbT);var v=veil();if(!v)return;var w=v.querySelector('.t-title'),i=0;(function nx(){if(w)w.textContent=verbs[i++%verbs.length]+'…';vbT=setTimeout(nx,1500);})();v.classList.add('on');}
function hideLoad(){clearTimeout(vbT);var v=veil();if(v)v.classList.remove('on');}
function refresh(){showLoad();if(++n%${RELOAD_EVERY}===0){setTimeout(function(){location.reload();},500);return;}fetch(location.href,{cache:'no-cache'}).then(function(r){return r.ok?r.text():Promise.reject();}).then(function(h){var d=new DOMParser().parseFromString(h,'text/html'),nk=d.querySelector('.kio'),ck=document.querySelector('.kio');if(!nk||!ck)throw 0;ck.parentNode.replaceChild(document.importNode(nk,true),ck);hideLoad();start();}).catch(function(){hideLoad();refT=setTimeout(refresh,60000);});}
function start(){clearInterval(clkI);clearInterval(agoI);clearTimeout(refT);clock();rel();fit();clkI=setInterval(clock,15000);agoI=setInterval(rel,30000);refT=setTimeout(refresh,${REFRESH_MS});}
// Burn-in (F2): the screen never changes layout, so every 6 minutes the whole display moves a
// few pixels round a small loop; too little to see, enough that no pixel holds one colour all day.
var oi=0,O=[[0,0],[2,1],[4,2],[3,4],[1,3]];
function orbit(){var k=document.querySelector('.kio');if(!k)return;var o=O[oi++%O.length];k.style.transform='translate('+o[0]+'px,'+o[1]+'px)';}
setInterval(orbit,360000);
function lock(){try{if('wakeLock'in navigator)navigator.wakeLock.request('screen').catch(function(){});}catch(e){}}
lock();document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')lock();});
var rz=0;window.addEventListener('resize',function(){if(!rz)rz=requestAnimationFrame(function(){rz=0;fit();});});setTimeout(fit,300);
start();
})();`;
};

/* fit(): the level word is what a screen is read for, so when the plate overflows it gives
   up to 40% of its size first, then today-vs-normal and the also-watch line go, and only then
   does the word shrink further (to the 24px floor).
   On a portrait screen the readings sit under the plate, so their overflow counts too.
   tfit(): then, while the readings overflow (a tall portrait screen: the plate sits above them),
   the extra lines go one at a time, today-vs-normal and also-watch first, then the tiles' extra
   lines and bars from the last tile up; a line whose going does not help stays. */

/** A reading as a display tile: its icon (as on the place page), then label, figure, its
 *  word and level, its one graphic. */
function tile(r: ReadRow): string {
  return (
    `<div class="ktile" data-k="${r.key}">${ico(r.icon)}<div class="kt"><p class="lab">${esc(r.label)}</p>` +
    `<p class="row-c"><span class="num">${esc(r.num)}</span>${r.unit ? `<span class="qa">${esc(r.unit)}</span>` : ""}` +
    `${r.qual ? ` <b class="ql">${esc(r.qual)}</b>` : ""}${r.chip}</p>${r.mini}</div></div>`
  );
}

export function renderKioskPage(c: Conditions, persona: Persona, canonical: string, lang: Lang = "en"): string {
  const risk = ambientRisk(c, persona);
  const slug = coordKey(c.location);
  const placeName = placeLabel(c);
  // Up to four tiles in the order the readings matter now; every other reading in one quiet line.
  const rows = readRows(c, risk, lang);
  const shown = rows.slice(0, 4);
  const rest = briefs(c, risk).filter((b) => !shown.some((r) => r.key === b.key));
  const iconOf = (key: string) => rows.find((r) => r.key === key)?.icon ?? "info";
  const quiet = rest.length
    ? `<p class="kquiet">${rest
        .map(
          (b) =>
            `<span class="qi">${ico(iconOf(b.key))}<span>${esc(t(b.label, lang))} <b>${esc(b.value)}</b></span></span>`,
        )
        .join("")}</p>`
    : "";
  // Every official warning over the point leads the plate, as on the place page: its icon,
  // IMD's words, the end time, the issuer; then one line for those near but not at it.
  const over = (c.warnings ?? [])
    .map(
      (w) =>
        `<li class="t-lead">${ico(warningIcon(w, lang))}<span><b>${esc(warningTitle(w, lang))}</b>${
          w.until ? ` · ${esc(t("until {time}", lang, { time: w.until }))}` : ""
        } · ${esc(w.issuer)}</span></li>`,
    )
    .join("");
  const near = c.nearby_warnings?.length
    ? `<li class="near">${ico("warn")}<span>${nearbyWarnings(c.nearby_warnings, lang)}</span></li>`
    : "";
  const warn = over || near ? `<ul class="kwarn">${over}${near}</ul>` : "";
  // Today's high against the normal, when it stands out, sits with the read.
  const normal = rows.find((r) => r.key === "heat")?.normal;
  const qrTarget = withPersona(canonical, persona);
  const body =
    `<div class="kio">` +
    `<header class="ktop"><div class="row-c"><h1 class="kname">${esc(placeName)}</h1><span class="t-meta">${c.location.lat}°N&nbsp;&nbsp;${c.location.lon}°E</span></div>` +
    `<div class="row-c"><span class="kclock" id="clk">--:--</span>${stamp(t("updated", lang), relTime(c.as_of))}</div></header>` +
    `<div class="kb">${ambientPlate(risk, lang, warn + (normal ? `<div class="knorm stack">${normal}</div>` : ""))}` +
    `<section class="ktiles" aria-label="${esc(t("Readings", lang))}">${shown.map(tile).join("")}${quiet}</section></div>` +
    `<footer class="kf"><div class="stack"><span class="kbrand wm" lang="en" translate="no">mugilu.live</span><p class="t-legal">${esc(t(DISCLAIMER_FULL, lang))}</p></div>` +
    `${qrBlock(qrTarget, t("scan to see this on your phone", lang))}</footer>` +
    `<div class="kveil" aria-hidden="true"><p class="t-title">${esc(t(KIOSK_VERBS[0], lang))}…</p></div></div>`;

  return pageShell(`${t("{place} on a screen", lang, { place: placeName })}: mugilu`, body, {
    path: `/c/${slug}`,
    desc: t("{place}: a live wall-display of the whole sky over this spot, self-refreshing.", lang).replace(
      "{place}",
      c.place ?? slug,
    ),
    canonical,
    ogImage: `${canonical}.png`,
    // A screen reloads every ~14 min all day: it would inflate visitor counts and skew Core Web Vitals.
    noBeacon: true,
    lang,
    variant: "kiosk",
    script: { key: "kiosk", js: kioskJs(lang) },
  });
}
