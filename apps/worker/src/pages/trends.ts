import { esc, trusted } from "../html";
import { lp, t, type Lang } from "../i18n";
import { SERIES, type PlaceTrend } from "../placedaily";
import { RISK_BANDS } from "../score";
import { localName, titleName, type SlugPlace } from "../slugs";
import { DESCRIPTION_MAX } from "../phrases";
import { breadcrumb, ld, SITE } from "../ui/shell";
import { pageShell } from "../ui/page-shell";
import {
  band,
  dataTable,
  LEVEL_SHAPE,
  LEVEL_WORD,
  levelChip,
  linkRow,
  notice,
  pageHead,
  panel,
  plate,
  segLinks,
  shape,
  wrap,
} from "../ui/components";
import { airLead, dayChart, dayLabel, fill, HAZARD_DEFS, type HazardDef } from "../ui/history";

// A named place's trend page, /c/{slug}/trends: every hazard mugilu reads, a day at a time over
// the last 7, 30 or 90 days (placedaily.ts keeps the record), in the order of the risk it
// brought: the period in one line, the days at each level, then a chart for each hazard that
// was raised (with its days in a table) and the calm ones together.

export const TREND_SPANS = [7, 30, 90] as const;
export type TrendSpan = (typeof TREND_SPANS)[number];

interface Read {
  h: HazardDef;
  vals: (number | null)[];
  /** Days at each level, low to severe. */
  counts: number[];
  /** Days with data. */
  d: number;
  worst: number;
  peak: { v: number; day: string } | null;
}

function read(h: HazardDef, tr: PlaceTrend): Read {
  const vals = tr[h.series];
  const counts = [0, 0, 0, 0];
  let peak: Read["peak"] = null;
  vals.forEach((v, i) => {
    if (v == null) return;
    counts[h.level(v)]++;
    if (!peak || (h.falling ? v < peak.v : v > peak.v)) peak = { v, day: tr.days[i] };
  });
  const d = counts.reduce((a, b) => a + b, 0);
  return { h, vals, counts, d, worst: d ? Math.max(...counts.map((c, l) => (c ? l : 0))) : -1, peak };
}

/** The hazard's period in a sentence, then its peak. */
function summary(r: Read, lang: Lang): { line: string; peak: string } {
  const [, mod, high, sev] = r.counts;
  const d = r.d;
  const line =
    r.h.key === "air"
      ? fill("Poor or worse on {h} of {d} days, very poor or severe on {s}.", lang, { h: high + sev, d, s: sev })
      : high + sev
        ? fill("High or severe on {h} of {d} days.", lang, { h: high + sev, d })
        : mod
          ? fill("Moderate on {n} of {d} days, never higher.", lang, { n: mod, d })
          : fill("Low on every one of {d} days.", lang, { d });
  const peak = r.peak
    ? fill(r.h.falling ? "Lowest: {v} on {day}." : "Highest: {v} on {day}.", lang, {
        v: r.h.say(r.peak.v, lang),
        day: dayLabel(r.peak.day, lang),
      })
    : "";
  return { line, peak };
}

function chartOf(r: Read, tr: PlaceTrend, lang: Lang): string {
  return dayChart({
    days: tr.days,
    lang,
    invert: r.h.falling,
    label: `${t(r.h.name, lang)}: ${t(r.h.what, lang)}`,
    lines: r.h.lines(lang),
    bars: r.vals.map((v, i) =>
      v == null
        ? null
        : {
            segs: [{ v, cls: RISK_BANDS[r.h.level(v)] }],
            title: `${dayLabel(tr.days[i], lang)}: ${r.h.say(v, lang)}, ${t(LEVEL_WORD[RISK_BANDS[r.h.level(v)]], lang)}`,
          },
    ),
  });
}

const source = (h: HazardDef, lang: Lang) =>
  `<p class="t-meta row-c tsrc"><span class="kind">${esc(t(h.kind, lang))}</span><span>${esc(h.source)}</span></p>`;

function hazardPanel(r: Read, tr: PlaceTrend, lang: Lang): string {
  const s = summary(r, lang);
  const rows = r.vals.map((v, i) => [
    esc(dayLabel(tr.days[i], lang)),
    v == null ? esc(t("no data", lang)) : esc(r.h.say(v, lang)),
    v == null ? "-" : levelChip(RISK_BANDS[r.h.level(v)], lang),
  ]);
  const table = dataTable(
    [{ label: t("Day", lang) }, { label: t(r.h.what, lang) }, { label: t("Level", lang) }],
    rows,
    `${t(r.h.name, lang)}, ${t("day by day", lang)}`,
  );
  return panel(
    `<p class="t-lead">${esc(s.line)} ${esc(s.peak)}</p>` +
      `<p class="t-meta">${esc(t(r.h.what, lang))}.${r.h.note ? ` ${esc(t(r.h.note, lang))}` : ""}</p>` +
      chartOf(r, tr, lang) +
      source(r.h, lang) +
      `<details class="tdays"><summary>${esc(t("Day by day", lang))}</summary>${table}</details>`,
    { title: t(r.h.name, lang), icon: r.h.icon, tag: "section", id: `t-${r.h.key}` },
  );
}

function calmPanel(calm: Read[], tr: PlaceTrend, lang: Lang): string {
  if (!calm.length) return "";
  const table = dataTable(
    [{ label: t("Hazard", lang) }, { label: t("Its peak", lang) }, { label: "" }],
    calm.map((r) => [
      esc(t(r.h.name, lang)),
      esc(summary(r, lang).peak),
      `<span class="kind">${esc(t(r.h.kind, lang))}</span>`,
    ]),
    t("Low on every day", lang),
  );
  const charts = calm
    .map(
      (r) =>
        `<details class="tdays"><summary>${esc(`${t(r.h.name, lang)}: ${t(r.h.what, lang)}`)}</summary>${chartOf(r, tr, lang)}${source(r.h, lang)}</details>`,
    )
    .join("");
  return panel(
    `<p class="t-lead">${esc(fill("These stayed low on every one of the {n} days.", lang, { n: tr.days.length }))}</p>` +
      table +
      charts,
    { title: t("Low on every day", lang), icon: "good", tag: "section", id: "t-calm" },
  );
}

export function renderTrendsPage(place: SlugPlace, tr: PlaceTrend | null, span: TrendSpan, lang: Lang): string {
  const name = place.name;
  const base = `/c/${place.slug}/trends`;
  // The words people search ("almora aqi last 30 days"), the same name rule as the place page.
  // On hi/kn pages the native name leads, and the Latin one follows in the title tag.
  const native = localName(place, lang) !== place.name ? localName(place, lang) : undefined;
  const title = fill("{place} AQI and weather: last {n} days", lang, { place: native ?? titleName(place), n: span });
  const period = segLinks(
    "per",
    t("Period", lang),
    TREND_SPANS.map((n) => ({
      label: fill("{n} days", lang, { n }),
      href: lp(n === 30 ? base : `${base}?days=${n}`, lang),
      current: n === span,
    })),
  );
  const back = linkRow(
    [[lp(`/c/${place.slug}`, lang), `← ${fill("{place} now", lang, { place: name })}`]],
    "t-meta back",
  );
  const reads = tr ? HAZARD_DEFS.map((h) => read(h, tr)).filter((r) => r.d > 0) : [];
  // The order of risk: the hazards that reached the highest levels most often first.
  reads.sort(
    (a, b) =>
      b.counts[3] - a.counts[3] ||
      b.counts[2] - a.counts[2] ||
      b.counts[1] - a.counts[1] ||
      a.h.key.localeCompare(b.h.key),
  );
  const raised = reads.filter((r) => r.worst > 0);
  const calm = reads.filter((r) => r.worst <= 0);
  const top = raised[0];
  const topLevel = top ? RISK_BANDS[top.worst] : "low";
  const s = top && summary(top, lang);
  // The hazard as the headline (a long sentence at that size runs off a phone), then the
  // period's sentence, which says the level in words, and its peak.
  const sentence = top
    ? top.h.key === "air"
      ? airLead(top.vals.filter((v): v is number => v != null).map(top.h.level), lang)
      : `${t(top.h.name, lang)}: ${s!.line}`
    : "";
  // The snippet says what this period was like, so each page's is its own; the hazard list
  // when the record is calm or the sentence will not fit.
  const opener = fill("{place}, last {n} days:", lang, { place: titleName(place), n: span });
  const desc =
    [`${opener} ${sentence} ${s ? s.peak : ""}`.trim(), `${opener} ${sentence}`].find(
      (d) => top && d.length <= DESCRIPTION_MAX,
    ) ??
    fill(
      "{place}, India: air, heat, cold, rain, wind, fog, smoke and UV, a day at a time over the last {n} days.",
      lang,
      { place: name, n: span },
    );
  const shell = (body: string) =>
    pageShell(`${title}${native ? ` | ${titleName(place)}` : ""} | mugilu`, wrap(body), {
      path: base,
      query: span === 30 ? "" : `?days=${span}`,
      lang,
      desc,
      // No record yet: the page has nothing of its own, so it stays out of the index.
      noindex: !reads.length,
      canonical: `${SITE}${base}${span === 30 ? "" : `?days=${span}`}`,
      jsonLd: ld({
        "@context": "https://schema.org",
        "@graph": [breadcrumb([name, `${SITE}/c/${place.slug}`], [title, `${SITE}${base}`])],
      }),
    });
  const head = (lead: string) =>
    pageHead(title, {
      kicker: { icon: "clock", text: t("Trends", lang) },
      extra: `<p class="t-lead">${esc(lead)}</p>`,
    });

  if (!tr || !reads.length)
    return shell(band(head(t("No record for this place yet. It fills in each night.", lang)) + period) + band(back));

  const finding = plate({
    fill: topLevel,
    shape: LEVEL_SHAPE[topLevel],
    kicker: fill("The {n} days in one line", lang, { n: span }),
    word: esc(top ? t(top.h.name, lang) : t("Every hazard stayed low.", lang)),
    say: top ? esc(`${sentence} ${s!.peak}`) : undefined,
    label: fill("The {n} days in one line", lang, { n: span }),
  });
  const heads = RISK_BANDS.map((k) => ({
    label: trusted(shape(LEVEL_SHAPE[k]) + esc(t(LEVEL_WORD[k], lang))),
    cls: `fill ${k}`,
    num: true,
  }));
  const overview = panel(
    dataTable(
      [{ label: t("Hazard", lang) }, ...heads],
      reads.map((r) => [
        `<a href="#t-${r.worst > 0 ? r.h.key : "calm"}">${esc(t(r.h.name, lang))}</a>`,
        ...r.counts.map((n) => (n ? String(n) : "-")),
      ]),
      t("Days at each level, by hazard", lang),
    ),
    { title: t("Days at each level", lang), icon: "list", tag: "section", flush: true },
  );
  const lead = fill(
    "{from} to {to}. Every hazard mugilu reads, a day at a time, in the order of the risk it brought.",
    lang,
    {
      from: dayLabel(tr.days[0], lang),
      to: dayLabel(tr.days.at(-1)!, lang),
    },
  );
  const warnings = notice(
    "info",
    esc(
      t(
        "Official warnings will show here too: the days this place was under an NDMA or IMD warning. mugilu is filling that record now.",
        lang,
      ),
    ),
    "warn",
  );
  return shell(
    band(head(lead) + period) +
      band(finding) +
      band(overview) +
      band(
        `<div class="tgrid">${raised.map((r) => hazardPanel(r, tr, lang)).join("")}${calmPanel(calm, tr, lang)}</div>`,
      ) +
      band(warnings) +
      band(back),
  );
}

/** The days a ?days= asks for (30 unless 7 or 90). */
export const spanOf = (q: string | null): TrendSpan => (q === "7" ? 7 : q === "90" ? 90 : 30);

/** The slice of a 30- or 90-day trend for the span. */
export function sliceTrend(tr: PlaceTrend, span: TrendSpan): PlaceTrend {
  const from = Math.max(0, tr.days.length - span);
  const out = { ...tr, days: tr.days.slice(from) } as PlaceTrend;
  for (const k of SERIES) out[k] = tr[k].slice(from);
  return out;
}
