// The share images (1200x630) as markup, kept apart from og.ts so they can be tested
// without the image renderer. The standard's ShareImage: light only (the image is the light
// set), a black bar on top, the level as a plate in its fill with its shape and word, the
// readings that matter most on gauges, and the full disclaimer at the foot.
//
// Layout rules (Satori is strict): every div sets display:flex (a div with more than one
// child must), text sits in its own div, sizes are pixels.

import type { Conditions, NormalizedStation } from "./types";
import { ambientRisk, ambientMeaning, headline, RISK_BANDS } from "./score";
import type { Persona } from "./score";
import { BAND_COLOR, BAND_ON_FILL, NEUTRAL, ON_FILL, RISK_COLOR } from "./palette";
import { briefs, gaugePos, type Brief } from "./readings";
import { placeLabel } from "./readings";
import { istStamp } from "./html";
import { heatVsNormalLine, heatVsNormalShown } from "./heatnormals";
import { AQI_BAND_LABEL } from "./aqi";
import { BAND_SHAPE, LEVEL_SHAPE, SHAPE, DISCLAIMER_FULL, type ShapeName } from "./ui/components";

/** Text for the image. Satori draws text as written and never decodes HTML
 *  entities, so `esc()` would show "&amp;" ("Asthma &amp; lungs"); only the angle
 *  brackets that could open a tag are dropped. */
export const ogText = (s: string) => s.replace(/[<>]/g, "");

const N = NEUTRAL.light;
const FONT = "font-family:sans-serif;";

/** A flex box (Satori needs display:flex on any div with more than one child). */
const box = (style: string, ...children: string[]) => `<div style="display:flex;${style}">${children.join("")}</div>`;
/** A line of text. */
const txt = (style: string, s: string) => box(style, ogText(s));

/** A level's shape, filled. */
const shapeSvg = (kind: ShapeName, size: number, colour: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><path d="${SHAPE[kind]}" fill="${colour}" fill-rule="evenodd"/></svg>`;

/** The frame: the black bar, the middle, the foot. */
function frame(top: [string, string], mid: string, foot: [string, string]): string {
  return box(
    `flex-direction:column;width:1200px;height:630px;background:${N.bg};color:${N.ink};${FONT}`,
    box(
      `justify-content:space-between;align-items:center;background:${N.bar};color:${N.onBar};padding:24px 48px;font-size:26px;font-weight:800;`,
      txt("", top[0]),
      txt("", top[1]),
    ),
    mid,
    box(
      `justify-content:space-between;align-items:center;padding:18px 48px;border-top:2px solid ${N.ink};font-size:18px;color:${N.muted};`,
      txt("max-width:860px;", foot[0]),
      txt(`font-weight:800;color:${N.ink};`, foot[1]),
    ),
  );
}

const pos = (v: number, g: Brief["gauge"]) => gaugePos(v, g.lo, g.hi, g.log);

/** A reading under the plate: its label, value and gauge (fill in its level, ticks in ink). */
function stat(b: Brief, c: Conditions): string {
  const fill =
    b.key === "air"
      ? (BAND_COLOR[c.air?.band ?? "unknown"] ?? BAND_COLOR.unknown)
      : b.level
        ? RISK_COLOR[RISK_BANDS[b.level]]
        : N.muted;
  const value = b.key === "heat" ? `feels ${b.value}` : b.value;
  const ticks = b.gauge.ticks
    .map(
      (x) =>
        `<div style="display:flex;position:absolute;top:-4px;bottom:-4px;left:${pos(x, b.gauge)}%;width:3px;background:${N.ink};"></div>`,
    )
    .join("");
  return (
    `<div data-k="${b.key}" style="display:flex;flex-direction:column;flex:1;margin-right:28px;">` +
    txt(`font-size:20px;font-weight:700;letter-spacing:2px;color:${N.muted};`, b.label.toUpperCase()) +
    txt("font-size:36px;font-weight:800;margin-top:4px;", value) +
    box(
      `position:relative;height:12px;background:${N.track};margin-top:10px;`,
      `<div style="display:flex;position:absolute;top:0;bottom:0;left:0;width:${pos(b.gauge.v, b.gauge)}%;background:${fill};"></div>`,
      ticks,
    ) +
    `</div>`
  );
}

/** /c/{place}.png: the place's read, when it was built, the four readings that matter most. */
export function conditionsOgHtml(c: Conditions, persona: Persona): string {
  const risk = ambientRisk(c, persona);
  const placeRaw = placeLabel(c);
  const place = placeRaw.length > 30 ? placeRaw.slice(0, 29) + "…" : placeRaw;
  const h = headline(risk);
  const head = h.noun ? `${h.word} ${h.noun}.` : `${h.word}.`;
  const on = ON_FILL[risk.band];
  const n = c.heat_vs_normal;
  const normal = heatVsNormalShown(n)
    ? txt(`font-size:26px;margin-top:12px;color:${on};`, heatVsNormalLine(n, "en"))
    : "";
  const plate = box(
    `flex-direction:column;justify-content:center;flex:1;padding:0 48px;background:${RISK_COLOR[risk.band]};color:${on};`,
    box(
      "align-items:center;",
      shapeSvg(LEVEL_SHAPE[risk.band], 96, on),
      txt("font-size:104px;font-weight:800;line-height:1;margin-left:24px;", head.toUpperCase()),
    ),
    txt("font-size:32px;font-weight:600;margin-top:14px;", ambientMeaning(risk)),
    normal,
  );
  const stats = box(
    "padding:20px 48px;align-items:flex-start;",
    ...briefs(c, risk)
      .slice(0, 4)
      .map((b) => stat(b, c)),
  );
  return frame(
    [`mugilu · the sky over ${place}`, istStamp(c.as_of)],
    box("flex-direction:column;flex:1;", plate, stats),
    [DISCLAIMER_FULL, "mugilu.live"],
  );
}

/** /og/s/{provider}/{id}.png: one station, its AQI on its band's plate. */
export function stationOgHtml(s: NormalizedStation, generatedAt: string): string {
  const name = s.name.length > 34 ? s.name.slice(0, 32) + "…" : s.name;
  const band = s.band in BAND_COLOR ? s.band : "unknown";
  const on = BAND_ON_FILL[band];
  const plate = box(
    `flex-direction:column;justify-content:center;width:440px;padding:0 48px;background:${BAND_COLOR[band]};color:${on};`,
    txt("font-size:180px;font-weight:800;line-height:.9;", s.aqi != null ? String(s.aqi) : "n/a"),
    box(
      "align-items:center;margin-top:12px;",
      shapeSvg(BAND_SHAPE[band], 36, on),
      txt("font-size:32px;font-weight:700;margin-left:12px;", `AQI (${AQI_BAND_LABEL[band] ?? "n/a"})`),
    ),
  );
  const who = box(
    "flex-direction:column;justify-content:center;flex:1;padding:48px;",
    txt("font-size:64px;font-weight:800;line-height:1;", name.toUpperCase()),
    txt(`font-size:34px;color:${N.muted};margin-top:12px;`, s.city || "India"),
  );
  return frame(["mugilu · India air quality", istStamp(generatedAt)], box("flex:1;", plate, who), [
    `${s.provider.toUpperCase()} via oaq.notf.in · urbanmorph/mugilu · ${DISCLAIMER_FULL}`,
    "mugilu.live",
  ]);
}

/** /og.png: the brand card for the home page and the content pages. */
export function homeOgHtml(): string {
  const covers = ["air", "heat", "rain", "UV", "dust", "warnings"];
  return frame(
    ["MUGILU", "mugilu.live"],
    box(
      "flex-direction:column;justify-content:center;flex:1;padding:0 48px;",
      txt("font-size:128px;font-weight:800;line-height:1;", "MUGILU"),
      txt("font-size:42px;font-weight:600;margin-top:20px;", "The open sky of India, one coordinate at a time."),
      box(
        `margin-top:32px;font-size:28px;font-weight:700;color:${N.muted};`,
        ...covers.map((w, i) => txt(i ? "margin-left:28px;" : "", w)),
      ),
    ),
    ["open · free · built to be built on", "mugilu.live"],
  );
}
