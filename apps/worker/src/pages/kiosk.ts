import { type Conditions } from "../types";
import { GLYPH_CSS } from "../glyphs";
import { briefs, isDriver, orderByRisk, placeLabel } from "../readings";
import { esc } from "../html";
import { PERSONA_LABEL, ambientRisk, ambientSummary, type Persona } from "../score";
import { paletteCss } from "../palette";
import { t, type Lang } from "../i18n";
import { SHORT_DISCLAIMER, safePad, shell } from "../ui/shell";
import { DRIVER_KEY, headHtml, icon, layerData, readVars } from "./read";

// ── Wall-display / kiosk view ──────────────────────────────────────────────
// Full-bleed, glanceable, self-refreshing. `?kiosk` on any /c URL renders this
// instead of the normal page, reusing the same Ambient + layer data. One fluid
// layout (vmin-sized; the one color-mix tint has a plain fallback for older TV browsers) scales 720p to 4K
// in both landscape and portrait. A venue just opens the URL on a screen and
// full-screens it; a corner QR sends passers-by to the same place on their phone.
export const KIOSK_CSS = `
html,body{height:100%;overflow:hidden;background:#080d18}
.k{${paletteCss("dark")}--ink:#e7ecf3;--muted:#8b97a8;--line:#1c2740;--bg:#080d18;position:fixed;inset:0;display:flex;flex-direction:column;gap:2.4vmin;${safePad("4.4vmin", "4.8vmin")};color:#e7ecf3;font-family:var(--sans),system-ui,sans-serif}
.k::before{content:"";position:absolute;inset:0;background:radial-gradient(130% 110% at 100% 0%,var(--tint),transparent 64%);opacity:.3;pointer-events:none}
@supports (color:color-mix(in srgb,red,blue)){.k::before{background:radial-gradient(130% 110% at 100% 0%,color-mix(in srgb,var(--tint) calc(var(--tk) * 1.6),transparent),transparent 64%);opacity:1}}
.k>*{position:relative;z-index:1}
.ktop{display:flex;justify-content:space-between;align-items:flex-start;gap:3vmin}
.kname{display:block;font-family:var(--serif),Georgia,serif;font-weight:700;font-size:6.2vmin;line-height:1.02}
.kcoord{display:block;margin-top:.7vmin;font-size:2.1vmin;letter-spacing:.06em;color:#7c899c}
.kclock{text-align:right;flex:none}
.kclock #clk{display:block;font-size:5.4vmin;font-weight:700;line-height:1}
.kago{display:block;margin-top:.7vmin;font-size:2.1vmin;color:#7c899c}
.kwarn{display:flex;align-items:center;gap:1.4vmin;padding:1.6vmin 2.2vmin;border-radius:1.4vmin;background:#3a0f12;color:#fecaca;font-size:2.6vmin;font-weight:600}
.kwarn svg{width:3.2vmin;height:3.2vmin;flex:none}
.kamb{flex:1;display:flex;flex-direction:column;justify-content:center;min-height:0;overflow:hidden}
.keye{display:flex;align-items:center;gap:1.2vmin;font-size:2.4vmin;letter-spacing:.12em;text-transform:uppercase;color:#8b97a8}
.keye svg{width:3vmin;height:3vmin}
.khead{font-family:var(--serif),Georgia,serif;font-weight:700;font-size:12vmin;line-height:1;letter-spacing:-.01em;margin:1.1vmin 0 .9vmin}
.khead .b{color:var(--cond-text)}
.ksay{font-size:4.2vmin;line-height:1.2;color:#cfd7e2;max-width:42ch}
.kact{font-size:2.8vmin;font-weight:600;line-height:1.25;margin-top:1.2vmin;max-width:60ch}
.kamb:has(.kact) .ksay{font-size:3.4vmin}
.kbody{flex:1;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:4vmin;min-height:0}
.ktiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.8vmin;align-content:center;min-height:0}
.kt{display:flex;flex-direction:column;gap:.4vmin;padding:1.8vmin 2.2vmin;border-radius:1.6vmin;background:rgba(15,22,38,.82);border:.3vmin solid #1c2740;min-width:0}
.kquiet{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:.6vmin 3vmin;margin:.4vmin .4vmin 0;font-size:2.2vmin;color:#8b97a8}
.kquiet b{color:#cfd7e2;font-weight:600}
.knorm{margin-top:2vmin;max-width:46vmin}
.kt.on{border-color:var(--cond)}
.kt.on .kt-n{color:var(--cond-text)}
.kt-l{font-size:2vmin;letter-spacing:.1em;text-transform:uppercase;color:#8b97a8}
.kt-n{font-size:6.2vmin;font-weight:700;line-height:1}
.kt-w{font-size:2.2vmin;color:#aeb9c8}
.kt-w .qa{font-size:1.7vmin;letter-spacing:.08em;text-transform:uppercase;color:#8b97a8}
.kt-w .qa.nu{text-transform:none;letter-spacing:.02em}
.kfoot{display:flex;justify-content:space-between;align-items:flex-end;gap:2vmin}
.kbrand{font-size:3vmin;font-weight:700;color:#38bdf8}
.kdisc{font-size:1.7vmin;color:#8b97a8;margin-top:.5vmin}
.kqr{display:flex;align-items:center;gap:1.6vmin}
.kqr svg{width:11vmin;height:11vmin;background:#fff;border-radius:1vmin;padding:.7vmin}
.kqrl{font-size:1.9vmin;line-height:1.2;color:#8b97a8;text-align:right}
@media (orientation:portrait){
  .k{gap:2.6vmin;${safePad("5.5vmin", "5vmin")}}
  .kname{font-size:7vmin}.kclock #clk{font-size:6vmin}
  .khead{font-size:10vmin}.ksay{font-size:4.6vmin;max-width:24ch}
  .kbody{grid-template-columns:minmax(0,1fr);gap:2.6vmin}.ktiles{gap:1.6vmin}.kt{padding:1.8vmin 2vmin}.kt-n{font-size:6vmin}
  .kqr svg{width:15vmin;height:15vmin}
}
@media (orientation:portrait) and (min-aspect-ratio:2/3){
  .kt{padding:1.3vmin 1.7vmin}.kt-n{font-size:4.6vmin}.ktiles{gap:1.3vmin}
  .kqr svg{width:12vmin;height:12vmin}
}
.kload{position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3vmin;background:rgba(8,13,24,.5);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);opacity:0;transition:opacity .4s ease;pointer-events:none}
.kload.on{opacity:1}
.kspin{width:7vmin;height:7vmin;border:.7vmin solid rgba(148,163,184,.25);border-top-color:#7dd3fc;border-radius:50%;animation:kspin 1s linear infinite}
.kverb{font-size:3.2vmin;color:#cbd5e1;letter-spacing:.01em}
@keyframes kspin{to{transform:rotate(360deg)}}`;

/** The layer graphics (GLYPH_CSS) scaled for a screen read from across a room. */
export const KIOSK_GLYPH_CSS = `
.k .g{height:1vmin;max-width:none;margin:1vmin 0 .3vmin}
.k .g .gt{top:-.5vmin;bottom:-.5vmin}
.k .g .gm{width:1.8vmin;height:1.8vmin}
.k .gl{font-size:1.9vmin;margin-top:.8vmin}
.k .prk{font-size:1.6vmin}
.k .uv{max-width:none;gap:.4vmin;margin-top:1vmin}.k .uv i{height:1.8vmin}
.k .prs{max-width:none;margin-top:1vmin}.k .pr{font-size:2vmin;grid-template-columns:8vmin 1fr 6vmin}.k .pt{height:1.2vmin}
.k .wrow{max-width:none}.k .cmp{width:7vmin;height:7vmin}
.k .drops{width:100%;height:auto;margin-top:1vmin}
.k .sub{display:none}`;

/** The loading verbs the kiosk cycles through while it refreshes. */
export const KIOSK_VERBS = [
  "Reading the sky",
  "Checking the air",
  "Gauging the heat",
  "Watching for warnings",
  "Catching the wind",
  "Looking up",
];

/** The kiosk's script, with its words in the page's language (X is the number). */
export const kioskJs = (lang: Lang) => {
  const s = (en: string) => JSON.stringify(t(en, lang)).replace(/</g, "\\u003c");
  return `(function(){
var clkI,agoI,refT,vbT,n=0;
var verbs=[${KIOSK_VERBS.map(s).join(",")}];
var W={now:${s("just now")},min:${s("X min ago")},h:${s("X hours ago")},d:${s("X days ago")}};
function ago(){var a=document.getElementById('ago');if(!a)return;var t=a.getAttribute('data-t');if(!t)return;var s=Math.max(0,(Date.now()-new Date(t).getTime())/1000);a.textContent=s<90?W.now:(s<3600?W.min.replace('X',Math.round(s/60)):s<86400?W.h.replace('X',Math.round(s/3600)):W.d.replace('X',Math.round(s/86400)));}
function p(x){return x<10?'0'+x:''+x}
function clock(){var c=document.getElementById('clk');if(c){var d=new Date();c.textContent=p(d.getHours())+':'+p(d.getMinutes());}}
function fit(){var amb=document.querySelector('.kamb'),hd=amb&&amb.querySelector('.khead');if(!amb||!hd)return;hd.style.fontSize='';var s=parseFloat(getComputedStyle(hd).fontSize),g=0;while(amb.scrollHeight>amb.clientHeight+1&&s>24&&g++<40){s-=4;hd.style.fontSize=s+'px';}}
var load=document.querySelector('.kload'),vb=load&&load.querySelector('.kverb');
function showLoad(){if(!load)return;var i=0;(function nx(){if(vb)vb.textContent=verbs[i++%verbs.length]+'…';vbT=setTimeout(nx,1500);})();load.classList.add('on');}
function hideLoad(){if(!load)return;load.classList.remove('on');clearTimeout(vbT);}
function refresh(){showLoad();if(++n%20===0){setTimeout(function(){location.reload();},500);return;}fetch(location.href,{cache:'no-store'}).then(function(r){return r.ok?r.text():Promise.reject();}).then(function(h){var d=new DOMParser().parseFromString(h,'text/html'),nk=d.querySelector('.k'),ck=document.querySelector('.k');if(!nk||!ck)throw 0;ck.parentNode.replaceChild(document.importNode(nk,true),ck);setTimeout(hideLoad,200);start();}).catch(function(){hideLoad();refT=setTimeout(refresh,60000);});}
function start(){clearInterval(clkI);clearInterval(agoI);clearTimeout(refT);clock();ago();fit();clkI=setInterval(clock,15000);agoI=setInterval(ago,30000);refT=setTimeout(refresh,840000);}
function lock(){try{if('wakeLock'in navigator)navigator.wakeLock.request('screen').catch(function(){});}catch(e){}}
lock();document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')lock();});
window.addEventListener('resize',fit);setTimeout(fit,300);
start();
})();`;
};

export function renderKioskPage(
  c: Conditions,
  persona: Persona,
  canonical: string,
  qr: string,
  lang: Lang = "en",
): string {
  const risk = ambientRisk(c, persona);
  const say = ambientSummary(risk, (en) => t(en, lang));
  const slug = `${c.location.lat},${c.location.lon}`;
  const placeName = placeLabel(c); // raw: shell() escapes the title
  const place = esc(placeName);
  const head = headHtml(risk, lang);

  // Up to four tiles in the order the readings matter now, each with its graphic;
  // every other reading in one quiet line (label and value only).
  const layers = orderByRisk(layerData(c, risk, lang), risk, c);
  const shown = layers.slice(0, 4);
  const tiles = shown.map(
    (d) =>
      `<div class="kt${isDriver(d.key, risk) ? " on" : ""}" data-k="${d.key}"><span class="kt-l">${d.label}</span><span class="kt-n">${d.num}</span><span class="kt-w">${d.q}</span>${d.mini ?? d.bar}</div>`,
  );
  const rest = briefs(c, risk).filter((b) => !shown.some((d) => d.key === b.key));
  const quietLine = rest.length
    ? `<p class="kquiet">${rest.map((b) => `<span>${t(b.label, lang)} <b>${esc(b.value)}</b></span>`).join("")}</p>`
    : "";
  const normal = layers.find((d) => d.key === "heat")?.normal;

  const w0 = c.warnings?.[0];
  const warn = w0
    ? `<div class="kwarn">${icon("warn")}<span><b>${esc(w0.event)}</b>${w0.until ? ` · ${t("until X", lang).replace("X", esc(w0.until))}` : ""} · ${esc(w0.issuer)}${c.warnings!.length > 1 ? ` · ${t("+X more", lang).replace("X", String(c.warnings!.length - 1))}` : ""}</span></div>`
    : "";

  const body = `
  <div class="k" style="${readVars(risk)}">
    <header class="ktop">
      <div><span class="kname">${place}</span><span class="kcoord">${c.location.lat}°N&nbsp;&nbsp;${c.location.lon}°E</span></div>
      <div class="kclock"><span id="clk">--:--</span><span class="kago">${t("updated", lang)} <span id="ago" data-t="${c.as_of}">${t("just now", lang)}</span></span></div>
    </header>
    ${warn}
    <div class="kbody">
      <main class="kamb">
        <p class="keye">${icon(DRIVER_KEY[risk.driver] ?? "clear")}<span>Ambient · ${esc(t(PERSONA_LABEL[risk.persona], lang))}</span></p>
        <p class="khead">${head}</p>
        <p class="ksay">${esc(say.meaning)}</p>
        ${say.action ? `<p class="kact">${esc(say.action)}</p>` : ""}
        ${normal ? `<div class="knorm">${normal}</div>` : ""}
      </main>
      <section class="ktiles">${tiles.join("")}${quietLine}</section>
    </div>
    <footer class="kfoot">
      <div><span class="kbrand">mugilu.live</span><p class="kdisc">${esc(t(SHORT_DISCLAIMER, lang))}</p></div>
      <div class="kqr">${qr}<span class="kqrl">${lang === "en" ? "scan to see this<br>on your phone" : t("scan to see this on your phone", lang)}</span></div>
    </footer>
  </div>
  <div class="kload" aria-hidden="true"><div class="kspin"></div><p class="kverb">${t(KIOSK_VERBS[0], lang)}…</p></div>
  <script>${kioskJs(lang)}</script>`;

  const css = KIOSK_CSS + GLYPH_CSS + KIOSK_GLYPH_CSS;
  const desc = `${c.place ?? slug}: a live wall-display of the whole sky over this spot, self-refreshing.`;
  // noBeacon: a kiosk is one persistent display auto-reloading every ~14 min; it would
  // inflate visitor counts and skew Core Web Vitals, so keep the RUM beacon off here.
  return shell(`${placeName} on a screen: mugilu`, body, css, {
    desc,
    canonical,
    ogImage: `${canonical}.png`,
    noBeacon: true,
    lang,
    bare: true,
  });
}
