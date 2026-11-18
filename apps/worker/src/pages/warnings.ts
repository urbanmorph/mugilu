import { type WarningsSnapshot } from "../sachet";
import { esc } from "../html";
import { headline } from "../score";
import { lp, t, type Lang } from "../i18n";
import { isHttpUrl } from "./read";
import { HOME_OG, SITE, TINT_BODY_CSS, istTime, shell, tintVars } from "../ui/shell";
import { ABOUT_CSS } from "./about";

export const WLIST_CSS = `
.wgen{font:500 .78rem var(--mono);color:var(--muted);margin:.3rem 0 1.5rem}
.wlist{list-style:none;margin:0;padding:0}
.wlist li{border-top:1px solid var(--hair);padding:1rem 0}
.wcat{display:inline-block;font:600 .7rem var(--sans);letter-spacing:.06em;text-transform:uppercase;color:var(--sky);margin:0 0 .25rem}
.whead{font-size:1.02rem;line-height:1.4;font-weight:600;margin:0 0 .3rem;overflow-wrap:anywhere}
.wmeta{color:var(--muted);font-size:.82rem}.wmeta a{color:var(--sky)}
.wempty{color:var(--muted);font-size:1.05rem;margin:1.2rem 0}
.wsec{margin:0 0 1.4rem}
.wgrp{display:flex;align-items:center;gap:.5rem;font:700 1rem/1.3 var(--sans);margin:1.6rem 0 .2rem}
.wgrp .wn{font:600 .72rem/1 var(--sans);color:var(--muted);background:var(--line);border-radius:999px;padding:.2rem .5rem}
.wfilter{display:none}
@media(min-width:960px){
.wwrap{display:grid;grid-template-columns:minmax(0,15rem) minmax(0,1fr);gap:2.6rem;align-items:start}
.wfilter{display:flex;flex-direction:column;gap:1.3rem;position:sticky;top:1.2rem;font-size:.92rem}
.wfilter[hidden]{display:none}
.wfilter fieldset{border:0;margin:0;padding:0;display:flex;flex-direction:column;gap:.45rem}
.wfilter legend{font:600 .72rem/1 var(--sans);letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin-bottom:.5rem}
.wfilter label{display:flex;justify-content:space-between;gap:.5rem;cursor:pointer}
.wfilter .wc{color:var(--muted);font-variant-numeric:tabular-nums}
.wfilter input[type=search]{width:100%;padding:.55rem .7rem;border:1px solid var(--line);border-radius:.6rem;background:var(--card);color:var(--ink);font:inherit}
.wlist{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.9rem}
.wlist li{border:1px solid var(--line);border-radius:12px;padding:.85rem 1rem;background:var(--card)}
}
`;

/** The national active-warnings list: surfaces the SACHET feed mugilu polls
 *  and archives, so the warning "moat" is readable, not just point-queried on /c. */
/** The issuing office from a SACHET issuer field: "controlroom@ndma.gov.in (IMD
 *  Chennai)" -> "IMD Chennai"; the control-room address is the same on every alert. */
export function issuerName(issuer: string): string {
  const named = issuer.match(/\(([^)]+)\)\s*$/)?.[1];
  return (named ?? issuer.replace(/\S+@\S+/g, "")).trim() || "NDMA";
}

// What a warning is about, read from its headline (every SACHET alert carries the same
// category, "Met"). The first that matches wins: "thunderstorm and rain" is a storm.
// English, Hindi and Kannada words, as offices write in all three.
export const WARNING_TYPES: [string, string, RegExp][] = [
  ["storm", "Thunderstorm, lightning", /thunder|lightning|squall|hail|गरज|बिजली|वज्रपात|आंधी|ಗುಡುಗು|ಸಿಡಿಲು|ಮಿಂಚು/i],
  ["flood", "Flood, river level", /flood|river|danger level|water level|बाढ़|नदी|ಪ್ರವಾಹ/i],
  ["rain", "Rain, snow", /rain|snow|वर्षा|बारिश|ಮಳೆ/i],
  ["wind", "Wind, cyclone", /wind|gale|cyclone|dust storm|हवा|चक्रवात|ಗಾಳಿ|ಚಂಡಮಾರುತ/i],
  ["heat", "Heat", /heat|hot|लू|गर्मी|ಬಿಸಿ/i],
  ["cold", "Cold, frost", /cold|frost|शीत|ठंड|ಚಳಿ/i],
  ["fog", "Fog", /fog|कोहरा|ಮಂಜು/i],
];

/** The kind of hazard a warning is about, from its headline ("other" when none matches). */
export function warningType(headline: string): string {
  return WARNING_TYPES.find(([, , re]) => re.test(headline))?.[0] ?? "other";
}

/** The filters on /warnings (wide screens): kind and issuing office, each with its count,
 *  and a text search. Hidden until the script runs, so without it every warning shows. */
export function warningFilters(alerts: WarningsSnapshot["alerts"], lang: Lang): string {
  const count = (key: (a: WarningsSnapshot["alerts"][number]) => string) => {
    const m = new Map<string, number>();
    for (const a of alerts) m.set(key(a), (m.get(key(a)) ?? 0) + 1);
    return m;
  };
  const types = count((a) => warningType(a.headline || ""));
  const offices = [...count((a) => issuerName(a.issuer || ""))].sort((x, y) => y[1] - x[1]);
  const box = (name: string, value: string, label: string, n: number) =>
    `<label><span><input type="checkbox" name="${name}" value="${esc(value)}" checked> ${esc(label)}</span><span class="wc">${n}</span></label>`;
  const kinds = [...WARNING_TYPES.map(([k, en]) => [k, en] as const), ["other", "Other"] as const]
    .filter(([k]) => types.has(k))
    .map(([k, en]) => box("type", k, t(en, lang), types.get(k)!))
    .join("");
  return `<aside class="wfilter" aria-label="${esc(t("Filter warnings", lang))}" hidden>
    <label for="wq" style="display:block">${t("Find a place or district", lang)}</label>
    <input type="search" id="wq" autocomplete="off">
    <fieldset><legend>${t("Type", lang)}</legend>${kinds}</fieldset>
    <fieldset><legend>${t("Issued by", lang)}</legend>${offices.map(([o, n]) => box("issuer", o, o, n)).join("")}</fieldset>
  </aside>`;
}

// Shows the filters and applies them: a card stays when its kind and office are ticked
// and it holds the search text; an office's heading hides when none of its cards show.
export const WARNINGS_FILTER_JS = `(function(){var f=document.querySelector('.wfilter');if(!f)return;f.hidden=false;
var q=document.getElementById('wq');function on(n){return [].slice.call(f.querySelectorAll('input[name='+n+']:checked')).map(function(i){return i.value})}
function go(){var ty=on('type'),of=on('issuer'),s=(q.value||'').trim().toLowerCase();
document.querySelectorAll('.wsec').forEach(function(sec){var any=false;sec.querySelectorAll('li[data-type]').forEach(function(li){
var ok=ty.indexOf(li.getAttribute('data-type'))>-1&&of.indexOf(li.getAttribute('data-issuer'))>-1&&(!s||li.textContent.toLowerCase().indexOf(s)>-1);li.hidden=!ok;if(ok)any=true});sec.hidden=!any})}
f.addEventListener('change',go);q.addEventListener('input',go)})();`;

export function renderWarningsPage(snap: WarningsSnapshot | null, lang: Lang = "en"): string {
  // Grouped by issuing office (a state SDMA or an IMD centre), the office with the
  // newest alert first, and newest first within it; times in IST like every page.
  const when = (sent: string) => Date.parse(sent) || 0;
  const groups = new Map<string, WarningsSnapshot["alerts"]>();
  for (const a of [...(snap?.alerts ?? [])].sort((x, y) => when(y.sent) - when(x.sent))) {
    const k = issuerName(a.issuer || "");
    groups.set(k, [...(groups.get(k) ?? []), a]);
  }
  const items = groups.size
    ? [...groups]
        .map(
          ([name, list]) =>
            `<section class="wsec"><h2 class="wgrp">${esc(name)}<span class="wn">${list.length}</span></h2><ul class="wlist">${list
              .map((a) => {
                const at = when(a.sent) ? istTime(new Date(when(a.sent)).toISOString()) : "";
                const meta = [at && esc(at), isHttpUrl(a.link) ? `<a href="${esc(a.link)}" rel="noopener">CAP</a>` : ""]
                  .filter(Boolean)
                  .join(" · ");
                return `<li data-type="${warningType(a.headline || "")}" data-issuer="${esc(name)}"><div class="wcat">${esc(a.category || "Alert")}</div><div class="whead">${esc(a.headline || "Warning")}</div>${meta ? `<div class="wmeta">${meta}</div>` : ""}</li>`;
              })
              .join("")}</ul></section>`,
        )
        .join("")
    : `<p class="wempty">${t("No active national alerts right now.", lang)}</p>`;
  const disc =
    lang === "en"
      ? "Informational only, not for medical, emergency, or safety-critical decisions. For official warnings, consult NDMA and IMD directly. mugilu mirrors the SACHET feed and keeps an archive of every alert."
      : `${t("Informational only, not for medical, emergency, or safety-critical decisions. For official hazard warnings consult NDMA / IMD.", lang)} ${t("mugilu mirrors the SACHET feed and keeps an archive of every alert.", lang)}`;
  const body = `
  <article class="ax">
    <h1 class="ahero">${t("Active warnings", lang)}</h1>
    <p class="alead">${t("The latest {n} official NDMA / IMD alerts across India.", lang).replace("{n}", String(snap?.alerts.length ?? 0))}</p>
    <p class="wgen">${snap ? `${t("as of X", lang).replace("X", esc(istTime(snap.generated_at)))} · via SACHET` : ""}</p>
    <div class="wwrap">${snap?.alerts.length ? warningFilters(snap.alerts, lang) : ""}<div>${items}</div></div>
    <p class="adisc">${disc}</p>
    <p class="aback"><a href="${lp("/", lang)}">← ${t("back to mugilu", lang)}</a></p>
  </article>
  <script>${WARNINGS_FILTER_JS}</script>`;
  // Any official warning active tints the page in the warning hue, at moderate strength,
  // high at 25 or more; none active is the calm sky.
  const n = snap?.alerts.length ?? 0;
  const tint = tintVars(
    n ? { band: n >= 25 ? "high" : "moderate", driver: "Warning" } : { band: "low", driver: "none" },
  );
  return shell("Active warnings: mugilu", body, ABOUT_CSS + WLIST_CSS + TINT_BODY_CSS + tint, {
    desc: "Active NDMA / IMD warnings across India right now, mirrored from the SACHET feed. Available as HTML, JSON and Markdown.",
    canonical: `${SITE}/warnings`,
    ogImage: HOME_OG,
    lang,
    wide: true,
  });
}
