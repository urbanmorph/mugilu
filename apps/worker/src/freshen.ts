// Pages that show the sky now never sit stale. Back on screen (a tab or the
// installed app returning from the background, or a back/forward restore) once
// the reading is REFRESH_AFTER_SECONDS old, or left open that long, the page
// reloads to a fresh reading. Offline it keeps what it shows (the service worker's
// saved reading) instead of reloading into nothing.
//
// The installed app also gets pull-to-refresh: its standalone window has no
// browser pull-to-refresh on Android or iOS. A plain tab keeps the browser's own.
// The marker is an icon that turns as you pull, so it needs no words.

import { REFRESH_AFTER_SECONDS } from "./conditions";

/** How far (px) to pull before letting go refreshes. */
const PULL = 70;

export const FRESHEN_JS = `(function(){
var T=Date.now(),MS=${REFRESH_AFTER_SECONDS * 1000};
function go(){if(document.visibilityState==='visible'&&Date.now()-T>=MS&&navigator.onLine!==false)location.reload();}
document.addEventListener('visibilitychange',go);
addEventListener('pageshow',function(e){if(e&&e.persisted)go();});
setInterval(go,60000);
var sa=(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true;
if(!sa)return;
var y0=null,d=0,el=document.getElementById('ptr');
function draw(){if(el){el.style.transform='translate(-50%,'+(Math.min(d,${PULL + 20})-48)+'px) rotate('+Math.round(d*3)+'deg)';el.className=d>${PULL}?'go':'';}}
addEventListener('touchstart',function(e){y0=(window.scrollY||0)<=0?e.touches[0].clientY:null;d=0;},{passive:true});
addEventListener('touchmove',function(e){if(y0===null)return;d=Math.max(0,e.touches[0].clientY-y0);draw();},{passive:true});
addEventListener('touchend',function(){if(y0===null)return;if(d>${PULL}){if(el)el.className='go spin';location.reload();}else{d=0;draw();if(el)el.style.transform='';}y0=null;},{passive:true});
})();`;

const PTR_CSS = `#ptr{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px));z-index:60;width:36px;height:36px;margin-top:0;display:grid;place-items:center;border-radius:50%;background:var(--card,#fff);color:var(--muted,#64748b);box-shadow:0 2px 10px rgba(0,0,0,.18);transform:translate(-50%,-48px);pointer-events:none}
#ptr.go{color:var(--sky,#0284c7)}
#ptr.spin svg{animation:ptrspin .8s linear infinite}
@keyframes ptrspin{to{transform:rotate(360deg)}}`;

/** The refresh marker, its style and the script, for a page that shows the sky now. */
export const FRESHEN = `<div id="ptr" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg></div><style>${PTR_CSS}</style><script>${FRESHEN_JS}</script>`;
