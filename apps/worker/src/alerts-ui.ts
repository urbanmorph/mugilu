// The "alert me" box on a place's page (alerts.ts holds the server side). Its
// messages are rendered here, translated and hidden; the script only shows the
// right ones: the note on what is kept while alerts are off, the note on what is
// deleted once they are on, and neither on an iPhone that must install first. Hidden until the script runs: shown where the browser can receive
// alerts, or on an iPhone or iPad not yet installed (Safari allows web push only
// to an app on the Home Screen), with the steps to install first.

import { esc } from "./html";
import { t, type Lang } from "./i18n";

export function renderAlertsBox(publicKey: string, lang: Lang): string {
  return `<section class="alerts" id="alerts" hidden data-key="${esc(publicKey)}" data-lang="${lang}" aria-label="${esc(t("Send me official warnings for this place", lang))}">
  <button type="button" class="alerts-btn" id="alerts-on">${t("Send me official warnings for this place", lang)}</button>
  <p id="alerts-state" hidden>${t("Alerts are on for this place.", lang)} <button type="button" class="alerts-link" id="alerts-off">${t("Turn off", lang)}</button></p>
  <p class="alerts-msg" id="alerts-denied" hidden>${t("Your browser blocks notifications from mugilu. Allow them in the site settings of your browser. Then try again.", lang)}</p>
  <p class="alerts-msg" id="alerts-full" hidden>${t("Alerts are on for 12 places. That is the limit. Turn off alerts for one place first.", lang)}</p>
  <p class="alerts-msg" id="alerts-failed" hidden>${t("Alerts could not be turned on. Try again.", lang)}</p>
  <p class="alerts-msg" id="alerts-ios" hidden>${t("On iPhone and iPad, first add mugilu to your Home Screen (Share, then Add to Home Screen). Open mugilu from the Home Screen. Then turn on alerts here.", lang)}</p>
  <p class="alerts-note" id="alerts-note-off" hidden>${t("Alerts are opt-in. When you turn on alerts, mugilu keeps this place (to approximately 1 km) and the push address of your browser. mugilu uses them only to send you official NDMA/IMD warnings for this place.", lang)}</p>
  <p class="alerts-note" id="alerts-note-on" hidden>${t("When you turn off alerts, mugilu deletes this place and the push address of your browser.", lang)}</p>
</section>`;
}

export const ALERTS_CSS = `.alerts{margin:1.6rem 0 0;padding:1rem 1.1rem;border:1px solid var(--line,rgba(127,127,127,.25));border-radius:12px}
.alerts-btn{font:inherit;padding:.55rem .9rem;border-radius:999px;border:1px solid currentColor;background:transparent;color:inherit;cursor:pointer}
.alerts-link{font:inherit;background:none;border:0;padding:0;color:inherit;text-decoration:underline;cursor:pointer}
.alerts-msg{margin:.6rem 0 0}
.alerts-note{color:var(--muted);font-size:.85rem;margin:.7rem 0 0}`;

export const ALERTS_JS = `(function(){
var box=document.getElementById('alerts'),h=document.querySelector('h1.loc');if(!box||!h)return;
var $=function(id){return document.getElementById(id)},ll=(h.getAttribute('data-ll')||'').split(','),lat=+ll[0],lon=+ll[1];
var here=lat.toFixed(2)+','+lon.toFixed(2),K='mugilu:alerts';
var list=function(){try{return JSON.parse(localStorage.getItem(K))||[]}catch(e){return[]}};
var keep=function(L){try{localStorage.setItem(K,JSON.stringify(L))}catch(e){}};
var ua=navigator.userAgent,ios=/iPhone|iPad|iPod/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1);
var installed=navigator.standalone===true||matchMedia('(display-mode: standalone)').matches;
if(!('serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window)){
if(ios&&!installed){box.hidden=false;$('alerts-on').hidden=true;$('alerts-ios').hidden=false}return}
box.hidden=false;
var say=function(id){['alerts-denied','alerts-full','alerts-failed'].forEach(function(m){$(m).hidden=m!==id})};
var show=function(){var on=list().indexOf(here)>=0;$('alerts-on').hidden=on;$('alerts-state').hidden=!on;$('alerts-note-off').hidden=on;$('alerts-note-on').hidden=!on};
var post=function(path,body){return fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(function(r){if(!r.ok)throw r.status})};
var key=function(s){var b=atob(s.replace(/-/g,'+').replace(/_/g,'/')),a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a};
$('alerts-on').addEventListener('click',function(){say();
return Notification.requestPermission().then(function(p){if(p!=='granted'){say('alerts-denied');return}
return navigator.serviceWorker.ready.then(function(reg){return reg.pushManager.getSubscription().then(function(s){return s||reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key(box.getAttribute('data-key'))})})})
.then(function(s){return post('/push/subscribe',{subscription:s.toJSON(),lat:lat,lon:lon,label:h.textContent.trim(),lang:box.getAttribute('data-lang')})})
.then(function(){var L=list();if(L.indexOf(here)<0)L.push(here);keep(L);show()})}).catch(function(e){say(e===409?'alerts-full':'alerts-failed')})});
$('alerts-off').addEventListener('click',function(){say();var L=list().filter(function(k){return k!==here});
return navigator.serviceWorker.ready.then(function(reg){return reg.pushManager.getSubscription()}).then(function(s){if(!s)return;
return post('/push/unsubscribe',L.length?{endpoint:s.endpoint,lat:lat,lon:lon}:{endpoint:s.endpoint}).then(function(){if(!L.length)return s.unsubscribe()})})
.then(function(){keep(L);show()}).catch(function(){say('alerts-failed')})});
show();if(Notification.permission==='denied')say('alerts-denied')})();`;
