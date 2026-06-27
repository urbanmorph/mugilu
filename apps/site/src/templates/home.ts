import type { Snapshot, NormalizedStation, CityGroup } from "../types";
import { BAND_LABELS } from "../types";
import { esc, fmtNum, formatUpdated, groupByCity } from "../util";
import { layout } from "./layout";
import { lifeYearsLost } from "../aqli";

// Absolute (not quantile) yll bands so colors are stable day-to-day.
// Thresholds: 1, 2, 3, 4 yr — aligned with WHO → India NAAQS range.
function yllBucket(y: number): 1 | 2 | 3 | 4 | 5 {
  if (y <= 1) return 1;
  if (y <= 2) return 2;
  if (y <= 3) return 3;
  if (y <= 4) return 4;
  return 5;
}

function yllCell(s: NormalizedStation): string {
  const y = lifeYearsLost(s.pollutants.pm25);
  if (y === null) return `<td class="num"><span class="band unknown">—</span></td>`;
  return `<td class="num"><span class="yll yll-${yllBucket(y)}" title="AQLI: ${y.toFixed(2)} years of life expectancy lost vs WHO 5 µg/m³ baseline">${y.toFixed(1)} yr</span></td>`;
}

function stationCell(s: NormalizedStation): string {
  const href = `/s/${encodeURIComponent(s.provider)}/${encodeURIComponent(s.raw_id)}`;
  return `<a href="${esc(href)}">${esc(s.name)}</a> <span class="provider-pill p-${esc(s.provider)}">${esc(s.provider)}</span>`;
}

function bandCell(s: NormalizedStation): string {
  return `<td><span class="band ${esc(s.band)}">${esc(BAND_LABELS[s.band])}</span></td>`;
}

function rowNumbered(n: number, s: NormalizedStation): string {
  return `<tr>
<td class="num">${n}</td>
<td class="trunc">${stationCell(s)}</td>
<td class="trunc">${esc(s.city)}</td>
<td class="num">${fmtNum(s.pollutants.pm25, 0)}</td>
<td class="num"><strong>${fmtNum(s.aqi, 0)}</strong></td>
${bandCell(s)}
${yllCell(s)}
</tr>`;
}

function row(s: NormalizedStation): string {
  return `<tr>
<td class="trunc">${stationCell(s)}</td>
<td class="num">${fmtNum(s.pollutants.pm25, 0)}</td>
<td class="num"><strong>${fmtNum(s.aqi, 0)}</strong></td>
${bandCell(s)}
${yllCell(s)}
</tr>`;
}

// Every column has an explicit width so the Station column doesn't absorb
// all remaining space. Table sizes to the sum of these widths (max ≈ 58rem),
// not the full 72rem container — leaves natural margin around the data.
const COLGROUP_NUMBERED = `<colgroup>
<col style="width:2.5rem" />
<col style="width:22rem" />
<col style="width:11rem" />
<col style="width:5rem" />
<col style="width:5rem" />
<col style="width:7rem" />
<col style="width:5.5rem" />
</colgroup>`;

const COLGROUP_CITY = `<colgroup>
<col style="width:24rem" />
<col style="width:5rem" />
<col style="width:5rem" />
<col style="width:7rem" />
<col style="width:5.5rem" />
</colgroup>`;

const YLL_TH = `<th class="num" title="Years of life expectancy lost if this PM2.5 level persisted annually (AQLI vs WHO 5 µg/m³ guideline)">Yrs lost</th>`;
const HEAD_NUMBERED = `<th class="num">#</th><th>Station</th><th>City</th><th class="num">PM2.5</th><th class="num">AQI</th><th>Band</th>${YLL_TH}`;
const HEAD_CITY = `<th>Station</th><th class="num">PM2.5</th><th class="num">AQI</th><th>Band</th>${YLL_TH}`;

function table(header: string, body: string, colgroup: string): string {
  return `<table class="lb">
${colgroup}
<thead><tr>${header}</tr></thead>
<tbody>${body}</tbody>
</table>`;
}

function cityDetails(g: CityGroup, open: boolean): string {
  const rows = g.stations.map(row).join("\n");
  const avg = g.avgAqi !== null ? `avg AQI ${g.avgAqi}` : "no AQI data";
  const stationWord = g.stations.length === 1 ? "station" : "stations";
  return `<details id="${esc(g.slug)}"${open ? " open" : ""}>
<summary><h3>${esc(g.name)} — ${g.stations.length} ${stationWord} · ${esc(avg)}</h3></summary>
${table(HEAD_CITY, rows, COLGROUP_CITY)}
</details>`;
}

export function renderHome(snap: Snapshot, siteUrl: string): string {
  const groups = groupByCity(snap.stations);
  const withAqi = snap.stations.filter((s) => s.aqi !== null) as (NormalizedStation & { aqi: number })[];
  const N = 20;
  const worst = withAqi.slice(0, N); // already sorted worst first
  const best = [...withAqi].sort((a, b) => a.aqi - b.aqi).slice(0, N);
  const updated = formatUpdated(snap.generated_at);

  const top5Worst = worst.slice(0, 5);
  const description = `India air quality leaderboard. ${snap.station_count} stations ranked live. Worst right now: ${
    top5Worst.map((s) => `${s.name}, ${s.city} (AQI ${s.aqi})`).join("; ") || "—"
  }. Updated ${updated.absolute}.`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "India air quality — worst 20 stations",
    dateModified: snap.generated_at,
    numberOfItems: worst.length,
    itemListElement: worst.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${s.name}, ${s.city}`,
      url: `${siteUrl}/s/${s.provider}/${s.raw_id}`,
      description: `AQI ${s.aqi} (${BAND_LABELS[s.band]}) · PM2.5 ${s.pollutants.pm25 ?? "—"} µg/m³`,
    })),
  };

  const body = `
<header class="hero">
  <h1>India air quality, ranked.</h1>
  <p class="muted">
    ${snap.station_count} stations · ${snap.providers.join(" · ")}<br />
    Updated ${esc(updated.absolute)} · ${esc(updated.relative)}
  </p>
  <p class="muted">
    Formats: <a href="/index.json">/index.json</a> · <a href="/index.md">/index.md</a>
  </p>
</header>

<p class="muted small">
  <strong>AQI vs Yrs lost</strong> — AQI is the worst sub-index across 7 pollutants
  (PM2.5, PM10, NO₂, SO₂, CO, O₃, NH₃), so a station can be "Very Poor" from ozone
  alone. <strong>Yrs lost</strong> is based only on PM2.5 (the
  <a href="https://aqli.epic.uchicago.edu/about/the-index/">Air Quality Life Index</a>
  from Greenstone et al. / Ebenstein et al. 2017 PNAS studies PM2.5 specifically).
  A station can be "Poor" by AQI yet have higher Yrs lost than a "Very Poor" one when
  its PM2.5 dominates. Both are reported here so you can see the gap.
  <a href="/docs/data-sources#health-impact">Methodology &amp; caveats →</a>
</p>

<section id="worst">
  <h2>Worst 20</h2>
  ${table(HEAD_NUMBERED, worst.map((s, i) => rowNumbered(i + 1, s)).join("\n"), COLGROUP_NUMBERED)}
</section>

<section id="best">
  <h2>Best 20</h2>
  ${table(HEAD_NUMBERED, best.map((s, i) => rowNumbered(i + 1, s)).join("\n"), COLGROUP_NUMBERED)}
</section>

<section id="all">
  <h2>All stations by city</h2>
  <p>
    <input type="search" id="city-filter" placeholder="search your city…  (try &quot;delhi&quot;, &quot;ghazi&quot;, &quot;bengal&quot;)" autocomplete="off" />
  </p>
  ${groups.map((g, i) => cityDetails(g, i < 5)).join("\n")}
</section>

<script src="/filter.js" defer></script>
`;

  return layout({
    title: `India Air Quality Leaderboard — ${snap.station_count} stations ranked live | mugilu`,
    description,
    canonical: siteUrl + "/",
    siteUrl,
    body,
    jsonLd,
  });
}
