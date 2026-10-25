// The conditions image (/c/{place}.png) as markup, kept apart from og.ts so it can
// be tested without the image renderer. The same read as the page: the headline,
// one sentence, the high against normal when it stands out, and the four readings
// that matter most, each on a bar against its thresholds, over the hazard's tint.
//
// Layout rules (Satori is strict): every div sets display:flex (a div with more
// than one child must), and text sits in its own div.

import type { Conditions } from "./types";
import { ambientRisk, ambientMeaning, COND_NOUN, RISK_LABEL } from "./score";
import type { Persona } from "./score";
import { BAND_COLOR, RISK_COLOR, tintOf } from "./palette";
import { briefs, isDriver, type Brief } from "./readings";
import { heatVsNormalLine, heatVsNormalShown } from "./heatnormals";
import { esc } from "./html";

/** Bar colour per level (0-3) on the dark card; level 0 is a quiet slate. */
const LEVEL_FILL = ["#475569", RISK_COLOR.moderate, RISK_COLOR.high, RISK_COLOR.severe];

/** "#f97316" at `a` (0-1) as rgba(), for the tint's gradient. */
function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${+a.toFixed(2)})`;
}

function pos(v: number, g: Brief["gauge"]): number {
  const p = g.log ? Math.log(v / g.lo) / Math.log(g.hi / g.lo) : (v - g.lo) / (g.hi - g.lo);
  return +(Math.max(0, Math.min(1, p)) * 100).toFixed(1);
}

function stat(b: Brief, c: Conditions, driver: boolean): string {
  const fill = b.key === "air" ? (BAND_COLOR[c.air?.band ?? "unknown"] ?? BAND_COLOR.unknown) : LEVEL_FILL[b.level];
  const value = b.key === "heat" ? `feels ${b.value}` : b.value;
  const ticks = b.gauge.ticks
    .map(
      (x) =>
        `<div style="display:flex;position:absolute;top:-4px;bottom:-4px;left:${pos(x, b.gauge)}%;width:3px;background:#94a3b8;"></div>`,
    )
    .join("");
  return (
    `<div data-k="${b.key}" style="display:flex;flex-direction:column;flex:1;margin-right:28px;">` +
    `<div style="display:flex;font-size:21px;letter-spacing:2px;color:${driver ? "#f87171" : "#64748b"};">${esc(b.label.toUpperCase())}</div>` +
    `<div style="display:flex;font-size:36px;font-weight:700;color:#e2e8f0;margin-top:6px;">${esc(value)}</div>` +
    `<div style="display:flex;position:relative;height:10px;border-radius:5px;background:#1f2937;margin-top:10px;">` +
    `<div style="display:flex;position:absolute;top:0;bottom:0;left:0;width:${pos(b.gauge.v, b.gauge)}%;border-radius:5px;background:${fill};"></div>` +
    ticks +
    `</div>` +
    `</div>`
  );
}

/** The conditions image's markup (1200x630). */
export function conditionsOgHtml(c: Conditions, persona: Persona): string {
  const risk = ambientRisk(c, persona);
  const { hue, strength } = tintOf(risk);
  const placeRaw = c.place || c.air?.station?.city || `${c.location.lat}, ${c.location.lon}`;
  const place = placeRaw.length > 30 ? placeRaw.slice(0, 29) + "…" : placeRaw;
  const head = risk.band === "low" ? "All clear" : `${RISK_LABEL[risk.band]} ${COND_NOUN[risk.driver] ?? "sky"}`;
  const updated =
    new Date(c.as_of).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }) + " IST";
  const n = c.heat_vs_normal;
  const normal = heatVsNormalShown(n)
    ? `<div style="display:flex;font-size:26px;color:#cbd5e1;margin-top:14px;">${esc(heatVsNormalLine(n, "en"))}</div>`
    : "";
  const stats = briefs(c, risk)
    .slice(0, 4)
    .map((b) => stat(b, c, isDriver(b.key, risk)))
    .join("");

  return (
    `<div style="display:flex;flex-direction:column;height:100%;width:100%;background-color:#0b1220;background-image:radial-gradient(circle at 100% 0%, ${rgba(hue, (strength * 1.1) / 100)}, ${rgba(hue, 0)} 70%);color:#e2e8f0;padding:56px 72px 48px;font-family:sans-serif;">` +
    `<div style="display:flex;justify-content:space-between;font-size:28px;color:#94a3b8;">` +
    `<div style="display:flex;">mugilu · the sky over ${esc(place)}</div>` +
    `<div style="display:flex;color:#cbd5e1;">${esc(updated)}</div>` +
    `</div>` +
    `<div style="display:flex;flex-direction:column;flex:1;justify-content:center;">` +
    `<div style="display:flex;font-size:112px;font-weight:800;line-height:1;color:${RISK_COLOR[risk.band]};">${esc(head)}</div>` +
    `<div style="display:flex;font-size:34px;color:#cbd5e1;margin-top:18px;">${esc(ambientMeaning(risk))}</div>` +
    normal +
    `</div>` +
    `<div style="display:flex;align-items:flex-end;border-top:1px solid #1f2937;padding-top:26px;">` +
    stats +
    `<div style="display:flex;font-size:26px;color:#64748b;">mugilu.live</div>` +
    `</div>` +
    `</div>`
  );
}
