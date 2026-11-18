import { type Conditions } from "../types";
import { briefs, placeLabel } from "../readings";
import { esc } from "../html";
import { ambientRisk, type Persona } from "../score";
import { t, type Lang } from "../i18n";
import { pageShell } from "../ui/page-shell";
import { DISCLAIMER_FULL, ico, qrBlock } from "../ui/components";
import { ambientPlate, readRows, warningTitle, type ReadRow } from "./read";

// ── The screen display (?kiosk) ─────────────────────────────────────────────────────
// Full screen, read from across a room, self-refreshing: the place and the clock, the
// Ambient plate beside the readings that matter most, the disclaimer and a QR that sends
// passers-by to the same place on their phone. Always dark; the kiosk type steps are sized
// by the screen's height (tokens.ts), and portrait stacks the plate over the readings.

/** The loading verbs the display cycles through while it refreshes. */
export const KIOSK_VERBS = [
  "Reading the sky",
  "Checking the air",
  "Gauging the heat",
  "Watching for warnings",
  "Catching the wind",
  "Looking up",
];

/** The display's script, with its words in the page's language (X is the number). */
export const kioskJs = (lang: Lang) => {
  const s = (en: string) => JSON.stringify(t(en, lang)).replace(/</g, "\\u003c");
  return `(function(){
var clkI,agoI,refT,vbT,n=0;
var verbs=[${KIOSK_VERBS.map(s).join(",")}];
var W={now:${s("just now")},min:${s("X min ago")},h:${s("X hours ago")},d:${s("X days ago")}};
function ago(){var a=document.getElementById('ago');if(!a)return;var t=a.getAttribute('data-t');if(!t)return;var s=Math.max(0,(Date.now()-new Date(t).getTime())/1000);a.textContent=s<90?W.now:(s<3600?W.min.replace('X',Math.round(s/60)):s<86400?W.h.replace('X',Math.round(s/3600)):W.d.replace('X',Math.round(s/86400)));}
function p(x){return x<10?'0'+x:''+x}
function clock(){var c=document.getElementById('clk');if(c){var d=new Date();c.textContent=p(d.getHours())+':'+p(d.getMinutes());}}
function fit(){var pl=document.querySelector('.kio .plate'),hd=pl&&pl.querySelector('.t-plate');if(!hd)return;hd.style.fontSize='';var s=parseFloat(getComputedStyle(hd).fontSize),g=0;while(pl.scrollHeight>pl.clientHeight+1&&s>24&&g++<40){s-=4;hd.style.fontSize=s+'px';}}
function veil(){return document.querySelector('.kveil');}
function showLoad(){var v=veil();if(!v)return;var w=v.querySelector('.t-title'),i=0;(function nx(){if(w)w.textContent=verbs[i++%verbs.length]+'…';vbT=setTimeout(nx,1500);})();v.classList.add('on');}
function hideLoad(){var v=veil();if(!v)return;v.classList.remove('on');clearTimeout(vbT);}
function refresh(){showLoad();if(++n%20===0){setTimeout(function(){location.reload();},500);return;}fetch(location.href,{cache:'no-store'}).then(function(r){return r.ok?r.text():Promise.reject();}).then(function(h){var d=new DOMParser().parseFromString(h,'text/html'),nk=d.querySelector('.kio'),ck=document.querySelector('.kio');if(!nk||!ck)throw 0;ck.parentNode.replaceChild(document.importNode(nk,true),ck);start();}).catch(function(){hideLoad();refT=setTimeout(refresh,60000);});}
function start(){clearInterval(clkI);clearInterval(agoI);clearTimeout(refT);clock();ago();fit();clkI=setInterval(clock,15000);agoI=setInterval(ago,30000);refT=setTimeout(refresh,840000);}
function lock(){try{if('wakeLock'in navigator)navigator.wakeLock.request('screen').catch(function(){});}catch(e){}}
lock();document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')lock();});
window.addEventListener('resize',fit);setTimeout(fit,300);
start();
})();`;
};

/** A reading as a display tile: label, figure, its word and level, its one graphic. */
function tile(r: ReadRow): string {
  return (
    `<div class="ktile" data-k="${r.key}"><p class="lab">${esc(r.label)}</p>` +
    `<p class="row-c"><span class="num">${esc(r.num)}</span>${r.unit ? `<span class="qa">${esc(r.unit)}</span>` : ""}` +
    `${r.qual ? ` <b class="ql">${esc(r.qual)}</b>` : ""}${r.chip}</p>${r.mini}</div>`
  );
}

export function renderKioskPage(c: Conditions, persona: Persona, canonical: string, lang: Lang = "en"): string {
  const risk = ambientRisk(c, persona);
  const slug = `${c.location.lat},${c.location.lon}`;
  const placeName = placeLabel(c);
  // Up to four tiles in the order the readings matter now; every other reading in one quiet line.
  const rows = readRows(c, risk, lang);
  const shown = rows.slice(0, 4);
  const rest = briefs(c, risk).filter((b) => !shown.some((r) => r.key === b.key));
  const quiet = rest.length
    ? `<p class="kquiet">${rest.map((b) => `<span>${esc(t(b.label, lang))} <b>${esc(b.value)}</b></span>`).join("")}</p>`
    : "";
  // An official warning over the point leads the plate: IMD's words, the end time, the issuer.
  const w0 = c.warnings?.[0];
  const warn = w0
    ? `<p class="t-lead row-c">${ico("warn")}<span><b>${esc(warningTitle(w0))}</b>${w0.until ? ` · ${esc(t("until X", lang).replace("X", w0.until))}` : ""} · ${esc(w0.issuer)}${
        c.warnings!.length > 1 ? ` · ${esc(t("+X more", lang).replace("X", String(c.warnings!.length - 1)))}` : ""
      }</span></p>`
    : "";
  // Today's high against the normal, when it stands out, sits with the read.
  const normal = rows.find((r) => r.key === "heat")?.normal;
  const qrTarget = persona === "everyone" ? canonical : `${canonical}?as=${persona}`;
  const body =
    `<div class="kio">` +
    `<header class="ktop"><div class="row-c"><h1 class="kname">${esc(placeName)}</h1><span class="t-meta">${c.location.lat}°N&nbsp;&nbsp;${c.location.lon}°E</span></div>` +
    `<div class="row-c"><span class="kclock" id="clk">--:--</span><span class="stamp"><span class="k">${esc(t("updated", lang))}</span>` +
    `<span class="v" id="ago" data-t="${esc(c.as_of)}">${esc(t("just now", lang))}</span></span></div></header>` +
    `<div class="kb">${ambientPlate(risk, lang, warn + (normal ? `<div class="knorm stack">${normal}</div>` : ""))}` +
    `<section class="ktiles" aria-label="${esc(t("Readings", lang))}">${shown.map(tile).join("")}${quiet}</section></div>` +
    `<footer class="kf"><div class="stack"><span class="kbrand">mugilu.live</span><p class="t-legal">${esc(t(DISCLAIMER_FULL, lang))}</p></div>` +
    `${qrBlock(qrTarget, t("scan to see this on your phone", lang))}</footer>` +
    `<div class="kveil" aria-hidden="true"><p class="t-title">${esc(t(KIOSK_VERBS[0], lang))}…</p></div></div>`;

  return pageShell(`${placeName} on a screen: mugilu`, body, {
    path: `/c/${slug}`,
    desc: `${c.place ?? slug}: a live wall-display of the whole sky over this spot, self-refreshing.`,
    canonical,
    ogImage: `${canonical}.png`,
    // A screen reloads every ~14 min all day: it would inflate visitor counts and skew Core Web Vitals.
    noBeacon: true,
    lang,
    kiosk: true,
    js: kioskJs(lang),
  });
}
