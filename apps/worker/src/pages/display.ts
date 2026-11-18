import { esc } from "../html";
import { type Persona } from "../score";
import { lp, t, type Lang } from "../i18n";
import { AC_CSS, HOME_OG, NEARME_CSS, SITE, nearMeJs, shell, typeaheadJs } from "../ui/shell";
import { icon, personaLinks } from "./read";
import { ABOUT_CSS } from "./about";

export const DISPLAY_CSS = `
.dpers{display:flex;flex-wrap:wrap;gap:.5rem;margin:.1rem 0 .2rem}
.dpers a{padding:.34rem .8rem;border:1px solid var(--line);border-radius:999px;color:var(--muted);text-decoration:none;font-size:.92rem}
.dpers a.on{border-color:var(--ink);color:var(--ink);font-weight:600}
.dsearch{display:flex;gap:.5rem;margin:.2rem 0 .7rem;flex-wrap:wrap}
.dsearch input[name=q]{flex:1;min-width:12rem;padding:.6rem .8rem;border:1px solid var(--line);border-radius:.6rem;background:var(--card);color:var(--ink);font-size:1rem}
.dsearch button{padding:.6rem 1.1rem;border:0;border-radius:.6rem;background:var(--ink);color:var(--bg);font-weight:600;font-size:1rem;cursor:pointer}
.dgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(8rem,1fr));gap:.55rem;margin:.1rem 0 .3rem}
.dtile{padding:.7rem .9rem;border:1px solid var(--line);border-radius:.6rem;background:var(--card);color:var(--ink);text-decoration:none;font-weight:600;text-align:center}
.dtile:hover{border-color:var(--ink)}
.dnote{color:var(--muted);font-size:.92rem;line-height:1.5;margin:.6rem 0 .7rem}
.dhow{margin:.1rem 0 .5rem 1.1rem}.dhow li{margin:.35rem 0;line-height:1.5}
.dprev{position:relative;aspect-ratio:16/9;max-width:100%;overflow:hidden;border-radius:12px;border:1px solid var(--line);background:#080d18;margin:.4rem 0 1.4rem}
.dprev iframe{position:absolute;top:0;left:0;width:1280px;height:720px;border:0;transform-origin:0 0;pointer-events:none}
@media(min-width:960px){.dcols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,25rem);gap:0 3rem;align-items:start}.dright>.ah:first-child{margin-top:1.4rem}}`;

// The "put it on a screen" builder: pick a place (+ who it's for), open the
// self-refreshing kiosk view. Search routes through /go?kiosk=1 (zero JS).
export function renderDisplayBuilder(persona: Persona = "everyone", lang: Lang = "en"): string {
  const popular: [string, string][] = [
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
  const asQ = persona !== "everyone" ? `&as=${persona}` : "";
  const pills = personaLinks((p) => lp(p === "everyone" ? "/display" : `/display?as=${p}`, lang), persona, lang);
  const tiles = popular
    .map(([s, n]) => `<a class="dtile" href="${lp(`/c/${s}?kiosk${asQ}`, lang)}">${esc(n)}</a>`)
    .join("");
  const heading = lang === "en" ? "Put mugilu<br>on a screen." : t("Put mugilu on a screen.", lang);
  const step4 =
    lang === "en"
      ? "For an always-on unattended screen, point a kiosk-browser app (for example Fully Kiosk on Android) at the same link so it auto-starts."
      : t("For an always-on unattended screen, point a kiosk-browser app at the same link so it auto-starts.", lang);
  const body = `
  <article class="ax">
    <div class="dcols"><div class="dleft">
    <h1 class="ahero">${heading}</h1>
    <p class="alead">${t("Turn any display into a live, self-updating read of the sky. Pick a place, open it on the screen, press full-screen. It refreshes itself, and a corner QR sends passers-by to the same place on their phone.", lang)}</p>

    <div class="dprev" aria-hidden="true"><iframe src="${esc(lp(`/c/bengaluru?kiosk${asQ}`, lang))}" title="${esc(t("Put mugilu on a screen.", lang))}" tabindex="-1" loading="lazy"></iframe></div>
    </div><div class="dright">

    <p class="ah">${icon("users")}<span>${t("Weight it for who is nearby", lang)}</span></p>
    <nav class="dpers" aria-label="Persona">${pills}</nav>

    <p class="ah">${icon("pin")}<span>${t("Pick a place", lang)}</span></p>
    <div class="acwrap">
    <form class="dsearch" action="${lp("/go", lang)}" method="get">
      <input type="hidden" name="kiosk" value="1">
      ${persona !== "everyone" ? `<input type="hidden" name="as" value="${persona}">` : ""}
      <input id="dq" name="q" placeholder="${esc(t("A city, area or address", lang))}" autocomplete="off" autocapitalize="off" aria-label="${esc(t("A city, area or address", lang))}">
      <button type="submit">${t("Open display", lang)}</button>
    </form>
    <ul id="dac" class="ac" role="listbox"></ul>
    </div>
    <p class="dnote">${t("A display can show a city, a neighbourhood or an exact point. Search for it above, or use where this screen stands.", lang)}</p>
    <button id="dhere" class="nearme" type="button" hidden>${icon("pin")} ${esc(t("Use this screen's location", lang))}</button>
    <div class="dgrid">${tiles}</div>

    <p class="ah">${icon("layers")}<span>${t("How it runs", lang)}</span></p>
    <ol class="dhow">
      <li>${t("Open the display link in the screen's browser: a smart TV, a cheap streaming stick, or an old tablet in a stand.", lang)}</li>
      <li>${t("Press full-screen (F11 with a keyboard, or the browser's full-screen control).", lang)}</li>
      <li>${t("Leave it. It refreshes on its own, keeps the screen awake, and if the network blips it holds the last reading and recovers.", lang)}</li>
      <li>${step4}</li>
    </ol>
    <p class="abuild">The display link is just <b>/c/{place}?kiosk</b>, so you can bookmark or script it. Add <b>?as=elderly</b> (or asthma, child, outdoor, heart) to weight the read for a clinic, school or worksite.</p>
    </div></div>
    <p class="aback"><a href="${lp("/", lang)}">← ${t("back to mugilu", lang)}</a></p>
  </article>
  <script>var LP=${JSON.stringify(lang === "en" ? "" : "/" + lang)};${typeaheadJs("dq", "dac", `'?kiosk'+${JSON.stringify(asQ)}`)}
  ${nearMeJs("dhere", `'?kiosk'+${JSON.stringify(asQ)}`, lang)}
  (function(){var b=document.querySelector('.dprev'),f=b&&b.querySelector('iframe');if(!f)return;function fit(){f.style.transform='scale('+b.clientWidth/1280+')';}fit();addEventListener('resize',fit);})();</script>`;
  return shell("Put mugilu on a screen: mugilu", body, ABOUT_CSS + DISPLAY_CSS + AC_CSS + NEARME_CSS, {
    desc: "Turn any wall display or kiosk into a live, self-refreshing read of India's sky. Pick a place, open it on the screen, full-screen it. It updates itself.",
    canonical: `${SITE}/display`,
    ogImage: HOME_OG,
    lang,
    wide: true,
  });
}
