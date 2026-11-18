import { type NearStation, type NormalizedStation } from "../types";
import { AQI_BAND_LABEL, aqiBand, subIndex } from "../aqi";
import { providerName } from "../sources";
import { pollutantParts } from "../formats";
import { esc } from "../html";
import { RISK_BANDS, airLevelOf } from "../score";
import { BAND_COLOR } from "../palette";
import { lp, t, type Lang } from "../i18n";
import { FRESHEN } from "../freshen";
import { HOME_OG, SHORT_DISCLAIMER, SITE, TINT_BODY_CSS, ld, relTime, shell, tintVars } from "../ui/shell";

export const STATION_CSS = `
.sx{max-width:44rem}
.sx h1{font-family:var(--serif);font-size:clamp(2rem,6vw,3rem);line-height:1.1;margin:.2rem 0 .3rem}
.sx .where{color:var(--muted);margin:0 0 1.2rem}
.sx .aqi{display:flex;align-items:baseline;gap:.6rem;flex-wrap:wrap;margin:.4rem 0 .2rem}
.sx .aqi b{font-size:clamp(2.6rem,9vw,4rem);line-height:1;color:var(--sband)}
.sx .aqi span{font-weight:600;color:var(--sband)}
.sx .when{color:var(--muted);font-size:.9rem;margin:0 0 1.2rem}
.sx dl{display:grid;grid-template-columns:auto 1fr;gap:.3rem 1.2rem;margin:.6rem 0 1.4rem}
.sx dt{color:var(--muted)}.sx dd{margin:0;font-variant-numeric:tabular-nums}
.sx .full a,.sx .nearby a{color:var(--sky)}
.sx .nearby{font-size:.95rem;line-height:1.9;color:var(--muted);margin:1rem 0}
.sx .stale{border-left:3px solid var(--line);padding:.2rem 0 .2rem .9rem;color:var(--muted)}
.sx footer{margin-top:2rem;border-top:1px solid var(--line);padding-top:1rem;font-size:.85rem;color:var(--muted)}
.sx footer a{color:var(--muted)}
.sx .pol{display:grid;grid-template-columns:4.2rem minmax(0,1fr) 7.5rem;gap:.55rem .8rem;align-items:center;margin:.6rem 0 .4rem;font-size:.95rem}
.sx .pol dt{color:var(--muted)}.sx .pol dd{margin:0;text-align:right;font-variant-numeric:tabular-nums}
.sx .ptrack{height:9px;border-radius:5px;background:var(--line);overflow:hidden}
.sx .pbar{display:block;height:100%;border-radius:5px}
.sx .pnote{color:var(--muted);font-size:.8rem;margin:0 0 1.2rem}
.sx .sxr{margin:1.4rem 0 0}
.sx .sxr h2{font:600 .74rem/1 var(--sans);letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin:0 0 .7rem}
.sx .smap{display:block;width:100%;height:auto;border-radius:12px;background:var(--card);border:1px solid var(--line)}
.sx .snear{width:100%;border-collapse:collapse;font-size:.95rem;margin:.8rem 0 0}
.sx .snear th{text-align:left;font-weight:500;color:var(--muted);font-size:.8rem;padding:.3rem 0}
.sx .snear td{border-top:1px solid var(--line);padding:.45rem 0}.sx .snear td+td,.sx .snear th+th{text-align:right}
.sx .snear a{color:var(--sky);text-decoration:none}.sx .snear i{display:inline-block;width:.6rem;height:.6rem;border-radius:50%;margin-right:.4rem}
@media(min-width:960px){.sx{max-width:none;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 3.5rem;align-items:start}.sx .sxr{margin:3.4rem 0 0}.sx footer{grid-column:1/-1}}`;

/** One pollutant as a bar on CPCB's 0-500 scale (its sub-index), in its band's colour. */
export function pollutantBar(p: { key: string; label: string; value: number; unit: string }): string {
  const si = subIndex(p.key as Parameters<typeof subIndex>[0], p.value);
  const bar =
    si == null
      ? ""
      : `<span class="pbar" style="width:${Math.max(2, Math.min(100, (si / 500) * 100)).toFixed(1)}%;background:${BAND_COLOR[aqiBand(si)] ?? BAND_COLOR.unknown}"></span>`;
  return `<dt>${esc(p.label)}</dt><span class="ptrack" aria-hidden="true">${bar}</span><dd>${p.value} ${esc(p.unit)}</dd>`;
}

/** The stations around one, at their true offsets (north up), each dot in its band's colour;
 *  the station itself ringed. Scaled so the farthest fits. */
export function stationMap(s: NormalizedStation, nearby: NearStation[]): string {
  if (s.lat == null || s.lon == null) return "";
  const [w, h, pad] = [520, 300, 26];
  const k = Math.cos((s.lat * Math.PI) / 180);
  const off = (lat: number, lon: number) => [(lon - s.lon!) * k, lat - s.lat!];
  const pts = nearby.filter((n) => n.lat != null && n.lon != null).map((n) => ({ n, xy: off(n.lat!, n.lon!) }));
  const reach = Math.max(
    1e-6,
    ...pts.map((p) => Math.abs(p.xy[0]) / (w / 2 - pad)),
    ...pts.map((p) => Math.abs(p.xy[1]) / (h / 2 - pad)),
  );
  const at = ([x, y]: number[]) => [w / 2 + x / reach, h / 2 - y / reach].map((v) => v.toFixed(1));
  const dot = (cx: string, cy: string, band: string, title: string, self = false) =>
    `<circle cx="${cx}" cy="${cy}" r="${self ? 11 : 8}" fill="${BAND_COLOR[band] ?? BAND_COLOR.unknown}"${self ? ' stroke="var(--ink)" stroke-width="3"' : ' style="stroke:color-mix(in srgb,var(--ink) 40%,transparent);stroke-width:1.5"'}><title>${esc(title)}</title></circle>`;
  const dots = pts
    .map(({ n, xy }) => dot(...(at(xy) as [string, string]), n.band, `${n.name}: AQI ${n.aqi ?? "n/a"}`))
    .join("");
  return `<svg class="smap" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(`Map of the air stations around ${s.name}, coloured by AQI`)}">${dots}${dot(String(w / 2), String(h / 2), s.band, `${s.name}: AQI ${s.aqi ?? "n/a"}`, true)}</svg>`;
}

/** /s/{provider}/{id}: one air station, titled the way people search ("Anand Vihar AQI
 *  today: 412 Severe"). `fresh` false: the station has not reported within the snapshot's
 *  window, so its last reading is shown as that, with no number in the title. */
export function renderStationPage(
  s: NormalizedStation,
  nearby: NearStation[],
  fresh: boolean,
  lang: Lang = "en",
): string {
  const band = t(AQI_BAND_LABEL[s.band] ?? "", lang);
  const live = fresh && s.aqi != null;
  const path = `/s/${s.provider}/${s.raw_id}`;
  const canonical = `${SITE}${path}`;
  const where = [s.city, s.state].filter(Boolean).join(", ");
  const tail = `${where ? `${where} · ` : ""}${t("air quality station", lang)} · mugilu`;
  const fill = (x: string) =>
    x
      .replace("{place}", s.name)
      .replace("{station}", s.name)
      .replace("{city}", s.city || s.name)
      .replace("{aqi}", String(s.aqi))
      .replace("{band}", band)
      .replace("{provider}", providerName(s.provider));
  const title = live ? `${fill(t("{place} AQI today: {aqi} {band}", lang))} · ${tail}` : `${s.name} · ${tail}`;
  const desc = live
    ? fill(t("{station} ({city}) AQI {aqi} ({band}) right now, measured by {provider}.", lang))
    : `${s.name}${where ? ` (${where})` : ""}: ${t("air quality station", lang)}, ${providerName(s.provider)}.`;
  const reading = live
    ? `<p class="aqi"><b>${s.aqi}</b><span>AQI · ${esc(band)}</span></p>
    <p class="when">${esc(fill(t("Measured by {provider}.", lang)))} ${s.ts ? relTime(new Date(s.ts).toISOString()) : ""}</p>
    <dl class="pol">${pollutantParts(s.pollutants).map(pollutantBar).join("")}</dl>
    <p class="pnote">${t("Each bar is the pollutant on CPCB's 0-500 AQI scale, in its band's colour.", lang)}</p>`
    : `<p class="stale">${t("No recent reading from this station. Last reading: X", lang).replace("X", s.ts ? relTime(new Date(s.ts).toISOString()) : "n/a")}</p>`;
  const near = nearby.length
    ? `<section class="sxr" aria-label="${esc(t("Air stations near here", lang))}"><h2>${t("Air stations near here", lang)}</h2>${stationMap(s, nearby)}
    <table class="snear"><thead><tr><th>${t("Station", lang)}</th><th>AQI</th><th>${t("Distance", lang)}</th></tr></thead><tbody>${nearby
      .map(
        (n) =>
          `<tr><td><i style="background:${BAND_COLOR[n.band] ?? BAND_COLOR.unknown}"></i><a href="${lp(`/s/${n.provider}/${n.raw_id}`, lang)}">${esc(n.name)}</a></td><td>${n.aqi ?? ""}</td><td>${n.distance_km != null ? `${n.distance_km.toFixed(1)} km` : ""}</td></tr>`,
      )
      .join("")}</tbody></table></section>`
    : "";
  const body = `
  <article class="sx" style="--band:${BAND_COLOR[s.band] ?? BAND_COLOR.unknown};--sband:var(--bt-${s.band})">
    <div class="sxl">
    <h1>${esc(s.name)}</h1>
    <p class="where">${esc(where || "India")} · ${esc(providerName(s.provider))}</p>
    ${reading}
    ${s.lat != null && s.lon != null ? `<p class="full"><a href="${lp(`/c/${s.lat},${s.lon}`, lang)}">${t("The full sky here: heat, rain, warnings and what to do", lang)} →</a></p>` : ""}
    </div>
    ${near}
    <footer>
      <p>${esc(t("Sources", lang))}: ${esc(providerName(s.provider))} via OAQ, via mugilu.</p>
      <p>${esc(t(SHORT_DISCLAIMER, lang))}</p>
      <p><a href="${path}.json">JSON</a> · <a href="${path}.md">Markdown</a> · <a href="${lp("/", lang)}">← ${t("Look up another place", lang)}</a></p>
    </footer>
  </article>`;
  const jsonLd = ld({
    "@context": "https://schema.org",
    "@type": "Place",
    name: `${s.name} air quality station`,
    url: canonical,
    geo: { "@type": "GeoCoordinates", latitude: s.lat, longitude: s.lon },
    address: { "@type": "PostalAddress", addressLocality: s.city || undefined, addressCountry: "IN" },
  });
  // Station pages are thin and Google never crawled them: they stay for people, out of the index.
  // The air hue at the station's band level; calm sky when it has no recent reading.
  const tint = tintVars({ band: RISK_BANDS[live ? (airLevelOf(s.band) ?? 0) : 0], driver: "Air" });
  return shell(title, body + FRESHEN, STATION_CSS + TINT_BODY_CSS + tint, {
    desc,
    canonical,
    jsonLd,
    ogImage: HOME_OG,
    lang,
    noindex: true,
    wide: true,
  });
}
