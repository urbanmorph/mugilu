import { type Conditions } from "../types";
import { AQI_BAND_LABEL } from "../aqi";
import { briefs, placeLabel } from "../readings";
import { esc } from "../html";
import { ambientRisk, ambientSummary, headline, smokeLevel, type Persona } from "../score";
import { paletteCss } from "../palette";
import { t, type Lang } from "../i18n";
import { dustBand, readVars, round, uvWord } from "./read";
import { CLOUD, SHORT_DISCLAIMER, VIEWPORT, istTime, safePad } from "../ui/shell";

// The embeddable widget (A "build on it" surface): a compact, self-contained
// conditions card others drop into an <iframe>. The whole card links back to the
// full page (attribution + traffic). A collapsed "Embed this" block carries the
// snippet, hidden by a one-liner when the widget is itself being framed.
export const EMBED_CSS = `
*{box-sizing:border-box}html,body{margin:0}
:root{--sky:#0284c7;--ink:#0f172a;--muted:#64748b;--bg:#f8fafc;--card:#fff;--line:#e2e8f0;--serif:Georgia,'Iowan Old Style','Palatino Linotype',Palatino,Cambria,serif;--sans:ui-sans-serif,-apple-system,system-ui,sans-serif}
@media(prefers-color-scheme:dark){:root{--ink:#e2e8f0;--muted:#94a3b8;--bg:#0b1220;--card:#111827;--line:#1f2937}}
body{font:14px/1.5 var(--sans);color:var(--ink);background:transparent;${safePad("8px", "8px")}}
.card{display:block;text-decoration:none;color:var(--ink);background:linear-gradient(160deg,color-mix(in srgb,var(--tint) var(--tk),var(--card)),var(--card) 72%);border:1px solid color-mix(in srgb,var(--cond) 30%,var(--line));border-radius:16px;padding:16px 18px;max-width:460px;margin:0 auto}
.etop{display:flex;justify-content:space-between;align-items:center;margin:0 0 .6rem}
.eplace{font-weight:700;font-size:1.05rem;letter-spacing:-.01em}
.ebrand{color:var(--muted);font-size:.8rem;font-weight:600;display:flex;align-items:center;gap:.3rem}
.ebrand svg{width:15px;height:15px;vertical-align:-2px}
.eamb{display:flex;align-items:center;gap:.5rem;font-family:var(--serif);font-size:1.35rem;font-weight:600;letter-spacing:-.01em;color:var(--cond-text);margin:0 0 .15rem}
.eamb .dot{width:10px;height:10px;border-radius:50%;background:var(--cond);flex:none}
.esay{color:var(--ink);font-size:.92rem;margin:0 0 .85rem}
.eact{color:var(--ink);font-size:.85rem;font-weight:600;margin:-.45rem 0 .85rem}
.ereads{display:flex;gap:18px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:.75rem}
.eread{display:flex;flex-direction:column}
.eread b{font-size:1.2rem;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.eread span{font-size:.66rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.efoot{display:flex;justify-content:space-between;color:var(--muted);font-size:.74rem;margin:.85rem 0 0}
.edisc{color:var(--muted);font-size:.68rem;margin:.3rem 0 0}
.ecode{max-width:460px;margin:14px auto 0;font-size:.82rem;color:var(--muted)}
.ecode summary{cursor:pointer;font-weight:600;color:var(--ink)}
.ecode pre{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px;overflow:auto;font-size:.72rem;white-space:pre-wrap;word-break:break-all}
.framed .ecode{display:none}
`;

export function renderEmbed(c: Conditions, persona: Persona, siteUrl: string, lang: Lang = "en"): string {
  const risk = ambientRisk(c, persona);
  const say = ambientSummary(risk, (en) => t(en, lang));
  const slug = `${c.location.lat},${c.location.lon}`;
  const place = esc(placeLabel(c));
  const h = headline(risk, (en) => t(en, lang));
  const head = h.noun ? `${h.word} ${h.noun}` : h.word;

  // The card's readings, each in its own words, in the order every surface uses.
  const read: Record<string, string> = {};
  if (c.air?.aqi != null)
    read.air = `<div class="eread"><b style="color:var(--bt-${c.air.band})">${c.air.aqi}</b><span>AQI ${t(AQI_BAND_LABEL[c.air.band] ?? "", lang)}</span></div>`;
  if (c.heat?.apparent_c != null)
    read.heat = `<div class="eread"><b>${round(c.heat.apparent_c)}°</b><span>${t("feels like", lang)}</span></div>`;
  if (c.uv?.index != null)
    read.sun = `<div class="eread"><b>${Math.round(c.uv.index)}</b><span>UV ${t(uvWord(c.uv.index), lang)}</span></div>`;
  if (c.dust?.dust_ug_m3 != null)
    read.dust = `<div class="eread"><b>${Math.round(c.dust.dust_ug_m3)}</b><span>${t("dust", lang)} ${t(dustBand(c.dust.dust_ug_m3), lang)}</span></div>`;
  if (c.smoke && smokeLevel(c.smoke) != null)
    read.smoke = `<div class="eread"><b>${c.smoke.count}</b><span>${t("fires within 100 km", lang)}</span></div>`;
  const reads = briefs(c, risk)
    .map((b) => read[b.key])
    .filter(Boolean);

  const iframe = `<iframe src="${siteUrl}/embed/${slug}" width="480" height="240" style="border:0;border-radius:16px" title="mugilu: conditions at ${place}" loading="lazy"></iframe>`;
  const imgtag = `<img src="${siteUrl}/c/${slug}.png" alt="mugilu: conditions at ${place}" width="600">`;

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">${VIEWPORT}<meta name="color-scheme" content="light dark"><title>${place}: mugilu</title><style>${paletteCss()}${EMBED_CSS}\n:root{${readVars(risk)}}</style></head><body>
  <a class="card" href="${siteUrl}/c/${slug}" target="_blank" rel="noopener">
    <div class="etop"><span class="eplace">${place}</span><span class="ebrand">${CLOUD} mugilu</span></div>
    <div class="eamb"><i class="dot"></i>${esc(head)}</div>
    <div class="esay">${esc(say.meaning)}</div>
    ${say.action ? `<div class="eact">${esc(say.action)}</div>` : ""}
    <div class="ereads">${reads.join("")}</div>
    <div class="efoot"><span>${t("as of X", lang).replace("X", esc(istTime(c.as_of)))}</span><span>mugilu.live →</span></div>
    <div class="edisc">${esc(t(SHORT_DISCLAIMER, lang))}</div>
  </a>
  <details class="ecode"><summary>${t("Embed this", lang)}</summary>
    <p>${t("Live widget (iframe):", lang)}</p><pre>${esc(iframe)}</pre>
    <p>${t("Or an image with the time on it:", lang)}</p><pre>${esc(imgtag)}</pre>
  </details>
  <script>if(window.self!==window.top)document.documentElement.classList.add('framed')</script>
  </body></html>`;
}
