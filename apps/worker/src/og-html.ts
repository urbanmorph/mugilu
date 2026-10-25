// The conditions image (/c/{place}.png) as markup, kept apart from og.ts so it can
// be tested without the image renderer. The same read as the page: the headline,
// one sentence, the high against normal when it stands out, and the four readings
// that matter most, each on a bar against its thresholds, over the hazard's tint.
//
// Layout rules (Satori is strict): every div sets display:flex (a div with more
// than one child must), and text sits in its own div.

import type { Conditions } from "./types";
import { ambientRisk, ambientMeaning, headline } from "./score";
import type { Persona } from "./score";
import { BAND_COLOR, RISK_COLOR, levelColor, tintOf } from "./palette";
import { briefs, gaugePos, isDriver, placeLabel, type Brief } from "./readings";
import { istStamp } from "./html";
import { heatVsNormalLine, heatVsNormalShown } from "./heatnormals";

/** Text for the image. Satori draws text as written and never decodes HTML
 *  entities, so `esc()` would show "&amp;" ("Asthma &amp; lungs"); only the angle
 *  brackets that could open a tag are dropped. */
export const ogText = (s: string) => s.replace(/[<>]/g, "");

/** "#f97316" at `a` (0-1) as rgba(), for the tint's gradient. */
function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${+a.toFixed(2)})`;
}

const pos = (v: number, g: Brief["gauge"]) => gaugePos(v, g.lo, g.hi, g.log);

function stat(b: Brief, c: Conditions, label: string): string {
  const fill =
    b.key === "air" ? (BAND_COLOR[c.air?.band ?? "unknown"] ?? BAND_COLOR.unknown) : levelColor(b.level, "#475569");
  const value = b.key === "heat" ? `feels ${b.value}` : b.value;
  const ticks = b.gauge.ticks
    .map(
      (x) =>
        `<div style="display:flex;position:absolute;top:-4px;bottom:-4px;left:${pos(x, b.gauge)}%;width:3px;background:#94a3b8;"></div>`,
    )
    .join("");
  return (
    `<div data-k="${b.key}" style="display:flex;flex-direction:column;flex:1;margin-right:28px;">` +
    `<div style="display:flex;font-size:21px;letter-spacing:2px;color:${label};">${ogText(b.label.toUpperCase())}</div>` +
    `<div style="display:flex;font-size:36px;font-weight:700;color:#e2e8f0;margin-top:6px;">${ogText(value)}</div>` +
    `<div style="display:flex;position:relative;height:10px;border-radius:5px;background:#1f2937;margin-top:10px;">` +
    `<div style="display:flex;position:absolute;top:0;bottom:0;left:0;width:${pos(b.gauge.v, b.gauge)}%;border-radius:5px;background:${fill};"></div>` +
    ticks +
    `</div>` +
    `</div>`
  );
}

/** The conditions image's markup (1200x630, sized in pixels: Satori resolves a
 *  percentage width against an unsized wrapper, and the card would shrink to its text). */
export function conditionsOgHtml(c: Conditions, persona: Persona): string {
  const risk = ambientRisk(c, persona);
  const { hue, strength } = tintOf(risk);
  const placeRaw = placeLabel(c);
  const place = placeRaw.length > 30 ? placeRaw.slice(0, 29) + "…" : placeRaw;
  const h = headline(risk);
  const head = h.noun ? `${h.word} ${h.noun}` : h.word;
  const updated = istStamp(c.as_of);
  const n = c.heat_vs_normal;
  const normal = heatVsNormalShown(n)
    ? `<div style="display:flex;font-size:26px;color:#cbd5e1;margin-top:14px;">${ogText(heatVsNormalLine(n, "en"))}</div>`
    : "";
  const stats = briefs(c, risk)
    .slice(0, 4)
    .map((b) => stat(b, c, isDriver(b.key, risk) ? RISK_COLOR[risk.band] : "#64748b"))
    .join("");

  return (
    `<div style="display:flex;flex-direction:column;width:1200px;height:630px;background-color:#0b1220;background-image:radial-gradient(circle at 100% 0%, ${rgba(hue, (strength * 1.1) / 100)}, ${rgba(hue, 0)} 70%);color:#e2e8f0;padding:56px 72px 48px;font-family:sans-serif;">` +
    `<div style="display:flex;justify-content:space-between;font-size:28px;color:#94a3b8;">` +
    `<div style="display:flex;">mugilu · the sky over ${ogText(place)}</div>` +
    `<div style="display:flex;color:#cbd5e1;">${ogText(updated)}</div>` +
    `</div>` +
    `<div style="display:flex;flex-direction:column;flex:1;justify-content:center;">` +
    `<div style="display:flex;font-size:112px;font-weight:800;line-height:1;color:${RISK_COLOR[risk.band]};">${ogText(head)}</div>` +
    `<div style="display:flex;font-size:34px;color:#cbd5e1;margin-top:18px;">${ogText(ambientMeaning(risk))}</div>` +
    normal +
    `</div>` +
    `<div style="display:flex;align-items:flex-end;border-top:1px solid #1f2937;padding-top:26px;">` +
    stats +
    `<div style="display:flex;font-size:26px;color:#64748b;">mugilu.live</div>` +
    `</div>` +
    `</div>`
  );
}
