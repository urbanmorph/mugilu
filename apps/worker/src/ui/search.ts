import { t, type Lang } from "../i18n";
import { CLIENT_ESC } from "./shell";

// The behaviour of every searchBox (components.ts): the ARIA combobox pattern (WAI-ARIA APG,
// list autocomplete). Typing two letters asks /suggest; the input controls the listbox, arrow
// keys move aria-activedescendant, Enter or a click opens the place, Escape closes the list,
// and a polite status line says how many places matched. Without script the form still posts
// to the place lookup. An input's data-suffix (e.g. "?kiosk") is added to the place's URL.

/** The search script for the page's language (the place URLs carry its prefix). */
export function searchJs(lang: Lang): string {
  const S = (s: string) => JSON.stringify(t(s, lang));
  return `(function(){var LP=${JSON.stringify(lang === "en" ? "" : "/" + lang)},ONE=${S("1 place")},MANY=${S("X places")},NONE=${S("No place in India matches that. Try another spelling, or a lat,lon.")};${CLIENT_ESC}
function pf(u){pf.s=pf.s||{};if(pf.s[u])return;pf.s[u]=1;var l=document.createElement('link');l.rel='prefetch';l.href=u;document.head.appendChild(l);}
document.querySelectorAll('form.search input[role=combobox]').forEach(function(q){var ac=document.getElementById(q.getAttribute('aria-controls')),st=document.getElementById(q.id+'-status');if(!ac)return;
var items=[],ix=-1,tm,seq=0,SUF=q.getAttribute('data-suffix')||'';
function url(x){return LP+'/c/'+x.lat+','+x.lon+SUF;}
function say(s){if(st)st.textContent=s;}
function close(){ac.hidden=true;ac.innerHTML='';items=[];ix=-1;q.setAttribute('aria-expanded','false');q.removeAttribute('aria-activedescendant');}
function mark(){for(var i=0;i<ac.children.length;i++)ac.children[i].setAttribute('aria-selected',i===ix?'true':'false');if(ix>=0){q.setAttribute('aria-activedescendant',q.id+'-o'+ix);pf(url(items[ix]));}else q.removeAttribute('aria-activedescendant');}
function go(i){var x=items[i];if(x)location.href=url(x);}
q.addEventListener('input',function(){var v=q.value.trim();clearTimeout(tm);if(v.length<2){close();say('');return;}var s=++seq;tm=setTimeout(function(){fetch('/suggest?q='+encodeURIComponent(v)).then(function(r){return r.json();}).then(function(d){if(s!==seq)return;items=d.suggestions||[];ix=-1;
if(!items.length){close();say(NONE);return;}
ac.innerHTML=items.map(function(x,i){return '<li role="option" id="'+q.id+'-o'+i+'" aria-selected="false" data-i="'+i+'"><b>'+esc(x.label)+'</b>'+(x.sublabel?'<span>'+esc(x.sublabel)+'</span>':'')+'</li>';}).join('');
ac.hidden=false;q.setAttribute('aria-expanded','true');say(items.length===1?ONE:MANY.replace('X',items.length));pf(url(items[0]));}).catch(function(){if(s===seq)close();});},150);});
q.addEventListener('keydown',function(e){if(!items.length)return;if(e.key==='ArrowDown'){ix=(ix+1)%items.length;e.preventDefault();mark();}else if(e.key==='ArrowUp'){ix=(ix-1+items.length)%items.length;e.preventDefault();mark();}else if(e.key==='Enter'&&ix>=0){e.preventDefault();go(ix);}else if(e.key==='Escape'){e.preventDefault();close();}});
ac.addEventListener('mousedown',function(e){var li=e.target.closest('li');if(li){e.preventDefault();go(+li.getAttribute('data-i'));}});
q.addEventListener('blur',function(){setTimeout(close,150);});});})();`;
}
