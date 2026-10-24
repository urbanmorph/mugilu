// Build apps/worker/data/heat-normals.json: the 1991-2020 normal daily maximum
// temperature for each calendar week on a 1° grid over India, from ERA5
// reanalysis via Open-Meteo's historical archive. The worker compares today's
// modelled high with it ("5°C above normal for late May here").
//
// Run once a day until every cell is built (from apps/worker):
//   npx tsx scripts/build-heat-normals.ts
// The cache lives in ~/.cache/mugilu/heat-normals (outside git and /tmp), one file
// per cell plus usage.json, the calls spent per UTC day.
// Options: --cache DIR, --out FILE, --max-minutes N (default 100), --budget N
// (Open-Meteo calls to spend per UTC day, default 9000), --step DEG (default 1).
//
// Budget (Open-Meteo free tier: 600/min, 5,000/hour, 10,000/day, 300,000/month;
// a request weighs nLocations x nDays/14 x nVariables/10): one cell of 1991-2020
// daily max = 10,958 days x 1 variable = 78.3 calls, so ~115 cells a day within a
// 9,000 budget, paced to stay under the hourly cap. The 1° grid over India is 398
// cells (31,200 calls, about 3.5 days); the run is resumable and spends the budget
// on the cells nearest the most-used places first. Adding the daily minimum would
// double that, and a 0.5° grid (1,408 cells) would take about 12 days.
//
// Data-extraction rules this follows:
// - Cache: every cell's answer is written to its own file in --cache the moment it
//   arrives (atomic rename), and the output is rebuilt every 10 minutes and on exit,
//   including on failure or a signal.
// - Restart: cached cells are skipped, so a killed run resumes where it stopped.
//   --max-minutes stops it cleanly inside any host's job limit.
// - Idempotency: a second run with the same cache fetches nothing and rewrites the
//   output only when its checksum changes.
// - Logs: unbuffered progress lines (fs.writeSync), with back-off on 429/5xx.
// Durable copy: upload --cache to object storage between runs when running in CI
// (not done here; that is a production write).

import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  renameSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inIndia } from "../src/india";
import { haversineKm } from "../src/near";
import { WEEKS, noleapDay, nodeKey, weekCentre } from "../src/heatnormals";

const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
const START = "1991-01-01";
const END = "2020-12-31";
const N_DAYS = 10958;
const SMOOTH_DAYS = 21; // circular moving mean of the daily climatology
const HOURLY_CAP = 4500; // stay under Open-Meteo's 5,000 calls/hour
const SAVE_EVERY_MS = 10 * 60_000;
const MAX_ATTEMPTS = 6; // per cell per run, with doubling back-off (rate limits wait longer)

// Built first: the cells around the most-used places.
const PRIORITY = [
  { name: "Bengaluru", lat: 12.97, lon: 77.59 },
  { name: "Mumbai", lat: 19.08, lon: 72.88 },
  { name: "Delhi", lat: 28.61, lon: 77.21 },
  { name: "Chennai", lat: 13.08, lon: 80.27 },
  { name: "Hyderabad", lat: 17.39, lon: 78.49 },
  { name: "Kolkata", lat: 22.57, lon: 88.36 },
  { name: "Jaisalmer", lat: 26.91, lon: 70.91 },
];

type Pt = { lat: number; lon: number };
export interface Cell extends Pt {
  elevation: number;
  weeks: number[];
}

/** Open-Meteo's documented request weight, in calls. */
export function requestWeight(nDays: number, nVariables: number, nLocations = 1): number {
  return nLocations * (nDays / 14) * (nVariables / 10);
}

/** A grid node and the point its normal is fetched for. */
export interface Node extends Pt {
  sample: Pt;
}

const round2 = (x: number) => +x.toFixed(2);
type Inside = (lat: number, lon: number) => boolean;

// India's outline is grown ~5 km so coasts count as India; for sampling that buffer
// is sea, and the simplified outline wanders a few km more. A point ~11 km inside it
// in all four directions is taken as land (the archive's elevation then confirms it).
const COAST_BUFFER_DEG = 0.1;
const wellInside = (p: Pt, inside: Inside) =>
  [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].every(([dy, dx]) => inside(p.lat + dy * COAST_BUFFER_DEG, p.lon + dx * COAST_BUFFER_DEG));

/**
 * The point to fetch for a node, so a coastal node is read over land, not sea (sea
 * runs ~1.5-2 °C cooler by day in summer). `known` is the archive's elevation at
 * points already fetched (0: sea level, so sea). In order: the nearest point of the
 * cell the archive already found on land; the node itself, if well inside the
 * outline; the nearest point of the cell's 0.05° lattice well inside; else the
 * nearest point inside at all. A point found at sea is never chosen again.
 */
function samplePoint(lat: number, lon: number, step: number, inside: Inside, known: Map<string, number>): Pt | null {
  const half = step / 2;
  const d2 = (p: Pt) => (p.lat - lat) ** 2 + (p.lon - lon) ** 2;
  const nearest = (ps: Pt[]) => ps.reduce<Pt | null>((b, p) => (!b || d2(p) < d2(b) ? p : b), null);
  const land = [...known]
    .filter(([, elev]) => elev > 0)
    .map(([k]) => k.split(",").map(Number))
    .filter(([a, o]) => Math.abs(a - lat) <= half && Math.abs(o - lon) <= half)
    .map(([a, o]) => ({ lat: a, lon: o }));
  if (land.length) return nearest(land);
  const node = { lat, lon };
  if (wellInside(node, inside)) return node;
  const lattice: Pt[] = [];
  const n = Math.round(step / 0.05);
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= n; j++) {
      const p = { lat: round2(lat - half + i * 0.05), lon: round2(lon - half + j * 0.05) };
      if (inside(p.lat, p.lon) && !((known.get(nodeKey(p.lat, p.lon)) ?? 1) <= 0)) lattice.push(p);
    }
  return nearest(lattice.filter((p) => wellInside(p, inside))) ?? nearest(lattice);
}

/** Grid nodes on half steps whose cell has any part inside, each with its sample point. */
export function gridNodes(
  step: number,
  inside: Inside,
  box = { minLat: 6, maxLat: 38, minLon: 68, maxLon: 98 },
  known = new Map<string, number>(),
): Node[] {
  const out: Node[] = [];
  for (let lat = box.minLat + step / 2; lat < box.maxLat; lat += step) {
    for (let lon = box.minLon + step / 2; lon < box.maxLon; lon += step) {
      const sample = samplePoint(lat, lon, step, inside, known);
      if (sample) out.push({ lat, lon, sample });
    }
  }
  return out;
}

/** Nodes ordered by distance to the nearest priority place. */
export function byPriority<T extends Pt>(nodes: T[], places: Pt[]): T[] {
  const d = (n: Pt) => Math.min(...places.map((p) => haversineKm(n.lat, n.lon, p.lat, p.lon)));
  return nodes
    .map((n) => ({ n, d: d(n) }))
    .sort((a, b) => a.d - b.d)
    .map((x) => x.n);
}

/** Mean daily maximum per day of a 365-day year (Feb 29 dropped, gaps skipped),
 *  then a circular `window`-day moving mean so the curve is not noisy. */
export function dailyClimatology(times: string[], values: (number | null)[], window = SMOOTH_DAYS): number[] {
  const sum = new Array(365).fill(0);
  const n = new Array(365).fill(0);
  times.forEach((t, i) => {
    const v = values[i];
    if (v == null || t.endsWith("-02-29")) return;
    const doy = noleapDay(t);
    sum[doy] += v;
    n[doy]++;
  });
  const mean = sum.map((s, i) => s / n[i]);
  const half = (window - 1) / 2;
  return mean.map((_, i) => {
    let s = 0;
    for (let k = -half; k <= half; k++) s += mean[(i + k + 365) % 365];
    return s / window;
  });
}

/** The smoothed daily curve sampled at the 52 week centres, in integer tenths of °C. */
export function weeklyTenths(daily: number[]): number[] {
  return Array.from({ length: WEEKS }, (_, k) => {
    const c = weekCentre(k);
    const i = Math.floor(c);
    const f = c - i;
    return Math.round((daily[i] * (1 - f) + daily[(i + 1) % 365] * f) * 10);
  });
}

/** The normals file: deterministic (nodes sorted), one node per line for readable diffs. */
export function renderNormals(step: number, cells: Cell[]): string {
  const rows = cells
    .map((c) => `${JSON.stringify(nodeKey(c.lat, c.lon))}:${JSON.stringify([c.elevation, ...c.weeks])}`)
    .sort();
  const meta = {
    source:
      "ERA5 reanalysis (contains modified Copernicus Climate Change Service information) via Open-Meteo " +
      "(archive-api, models=era5, CC-BY 4.0), daily maximum 2 m temperature",
    baseline: "1991-2020",
    smoothing: `${SMOOTH_DAYS}-day circular mean, sampled at ${WEEKS} week centres`,
    format: "node 'lat,lon' -> [elevation_m, 52 weekly normals in tenths of °C]",
    step,
  };
  return `${JSON.stringify(meta).slice(0, -1)},"nodes":{\n${rows.join(",\n")}\n}}\n`;
}

// ---------------------------------------------------------------- the run

const log = (s: string) => writeSync(1, `${new Date().toISOString().slice(11, 19)} ${s}\n`);
/** Wait, or stop waiting early when the run is stopped (no listener left behind). */
const sleep = (ms: number, signal: AbortSignal) => wait(ms, undefined, { signal }).catch(() => {});

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function writeAtomic(path: string, body: string) {
  writeFileSync(`${path}.tmp`, body);
  renameSync(`${path}.tmp`, path);
}

/** One cache file per fetched point (a node's sample point). */
const cellFile = (cache: string, n: Node) => join(cache, `era5_tmax_${n.sample.lat}_${n.sample.lon}.json`);

interface Archive {
  elevation: number;
  daily: { time: string[]; temperature_2m_max: (number | null)[] };
}

/** Rebuild the output from every cached cell; write only when the checksum changes. */
function saveOutput(cache: string, out: string, step: number, nodes: Node[]): void {
  const cells: Cell[] = [];
  for (const n of nodes) {
    const f = cellFile(cache, n);
    if (!existsSync(f)) continue;
    const a = JSON.parse(readFileSync(f, "utf8")) as Archive;
    // Never ship a sea-level (offshore) sample or a year with a hole in it.
    if (a.elevation <= 0 || !complete(a)) continue;
    const weeks = weeklyTenths(dailyClimatology(a.daily.time, a.daily.temperature_2m_max));
    cells.push({ lat: n.lat, lon: n.lon, elevation: Math.round(a.elevation), weeks });
  }
  const body = renderNormals(step, cells);
  const sha = (s: string) => createHash("sha256").update(s).digest("hex");
  if (existsSync(out) && sha(readFileSync(out, "utf8")) === sha(body)) {
    log(`output unchanged (${cells.length} cells)`);
    return;
  }
  writeAtomic(out, body);
  log(`wrote ${out}: ${cells.length} cells, ${Buffer.byteLength(body)} bytes`);
}

/** One archive request's outcome: cache it, retry after `wait`, skip this cell for
 *  this run, or stop the run. `spent` marks an answer Open-Meteo counted (a 200). */
type Fetched =
  | { kind: "ok"; body: string; elevation: number; spent: true }
  | { kind: "retry" | "skip" | "stop"; why: string; wait: number; spent: boolean };

/** A full 1991-2020 answer: every day there, and every day of the year with data
 *  (a day of year with none would leave a hole in the normals). */
const complete = (a: Archive) =>
  a.daily?.temperature_2m_max?.length === N_DAYS &&
  dailyClimatology(a.daily.time, a.daily.temperature_2m_max, 1).every(Number.isFinite);

export async function fetchCell(p: Pt, signal: AbortSignal): Promise<Fetched> {
  const url =
    `${ARCHIVE_URL}?latitude=${p.lat}&longitude=${p.lon}&start_date=${START}&end_date=${END}` +
    "&daily=temperature_2m_max&timezone=Asia%2FKolkata&models=era5";
  try {
    const res = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(180_000)]) });
    const body = await res.text();
    if (res.ok) {
      const a = JSON.parse(body) as Archive;
      if (complete(a)) return { kind: "ok", body, elevation: a.elevation, spent: true };
      return { kind: "retry", why: SHORT, wait: 60_000, spent: true };
    }
    const reason = (() => {
      try {
        return String((JSON.parse(body) as { reason?: string }).reason ?? body);
      } catch {
        return body.slice(0, 200);
      }
    })();
    const why = `${res.status} ${reason}`;
    // A daily or monthly cap will not lift by waiting inside this run; a minutely or
    // hourly one will. Any other 4xx is about this cell's request, so move on.
    if (res.status === 429)
      return { kind: /daily|monthly/i.test(reason) ? "stop" : "retry", why, wait: 120_000, spent: false };
    return { kind: res.status < 500 ? "skip" : "retry", why, wait: 60_000, spent: false };
  } catch (e) {
    // Cut off by our own stop (time limit, signal): assume Open-Meteo counted it.
    return { kind: "retry", why: String(e), wait: 60_000, spent: signal.aborted };
  }
}

const SHORT = "short answer";
const OFFSHORE = "offshore";

/** The first bytes of a cached answer, where its elevation sits. */
function head(file: string): string {
  const fd = openSync(file, "r");
  try {
    const buf = Buffer.alloc(400);
    return buf.toString("utf8", 0, readSync(fd, buf, 0, 400, 0));
  } finally {
    closeSync(fd);
  }
}

/** The archive's elevation at each point already fetched, from the cache (land) and
 *  its offshore/ folder (answers at sea level, kept but never used). */
function knownElevations(cache: string): Map<string, number> {
  const known = new Map<string, number>();
  for (const dir of [cache, join(cache, OFFSHORE)]) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      const m = /^era5_tmax_(-?[\d.]+)_(-?[\d.]+)\.json$/.exec(f);
      const e = m && /"elevation":(-?[\d.]+)/.exec(head(join(dir, f)));
      if (m && e) known.set(nodeKey(+m[1], +m[2]), +e[1]);
    }
  }
  return known;
}

async function main() {
  const step = +arg("step", "1");
  const cache = arg("cache", join(homedir(), ".cache/mugilu/heat-normals"));
  const out = arg("out", join(dirname(fileURLToPath(import.meta.url)), "../data/heat-normals.json"));
  const maxMinutes = +arg("max-minutes", "100");
  const budget = +arg("budget", "9000");
  mkdirSync(cache, { recursive: true });

  const weight = requestWeight(N_DAYS, 1);
  const paceMs = Math.ceil((weight * 3_600_000) / HOURLY_CAP);
  const known = knownElevations(cache);
  const nodes = byPriority(gridNodes(step, inIndia, undefined, known), PRIORITY);
  const todo = nodes.filter((p) => !existsSync(cellFile(cache, p)));
  log(
    `grid ${step}°: ${nodes.length} cells, ${nodes.length - todo.length} cached, ${todo.length} to fetch; ` +
      `${weight.toFixed(1)} calls each (${(todo.length * weight).toFixed(0)} left), pace ${Math.round(paceMs / 1000)} s`,
  );

  // Calls spent per UTC day, kept beside the cache so a restart the same day respects it.
  const ledgerFile = join(cache, "usage.json");
  const ledger: Record<string, number> = existsSync(ledgerFile) ? JSON.parse(readFileSync(ledgerFile, "utf8")) : {};
  const today = () => new Date().toISOString().slice(0, 10);
  const spent = () => ledger[today()] ?? 0;

  const stop = new AbortController();
  const timer = setTimeout(() => {
    log(`time limit ${maxMinutes} min reached, stopping`);
    stop.abort();
  }, maxMinutes * 60_000);
  for (const sig of ["SIGINT", "SIGTERM"] as const)
    process.on(sig, () => {
      log(`${sig}: stopping after saving`);
      stop.abort();
    });

  let lastSave = Date.now();
  let fetched = 0;
  try {
    for (const p of todo) {
      if (stop.signal.aborted) break;
      if (spent() + weight > budget) {
        log(`daily budget ${budget} reached (${spent().toFixed(0)} spent), stopping`);
        break;
      }
      let backoff = 0;
      let attempts = 0;
      let shorts = 0;
      for (;;) {
        const t0 = Date.now();
        const r = await fetchCell(p.sample, stop.signal);
        if (r.spent) {
          ledger[today()] = spent() + weight;
          writeAtomic(ledgerFile, JSON.stringify(ledger));
        }
        if (stop.signal.aborted) break;
        if (r.kind === "ok" && r.elevation <= 0) {
          // At sea level, so at sea: keep the answer aside, never use the point again,
          // and try the next point inland (within this cell and the daily budget).
          mkdirSync(join(cache, OFFSHORE), { recursive: true });
          writeAtomic(join(cache, OFFSHORE, `era5_tmax_${p.sample.lat}_${p.sample.lon}.json`), r.body);
          known.set(nodeKey(p.sample.lat, p.sample.lon), r.elevation);
          const next = samplePoint(p.lat, p.lon, step, inIndia, known);
          log(
            `cell ${p.lat},${p.lon}: ${p.sample.lat},${p.sample.lon} is at sea; next ${next ? `${next.lat},${next.lon}` : "none"}`,
          );
          if (!next || ++attempts >= MAX_ATTEMPTS || spent() + weight > budget) break;
          p.sample = next;
          continue;
        }
        if (r.kind === "ok") {
          writeAtomic(cellFile(cache, p), r.body);
          fetched++;
          log(
            `cell ${p.lat},${p.lon} (at ${p.sample.lat},${p.sample.lon}) cached ` +
              `(${fetched}/${todo.length} this run, ${Date.now() - t0} ms, ${spent().toFixed(0)} calls today)`,
          );
          break;
        }
        if (r.kind === "stop") {
          log(`cell ${p.lat},${p.lon}: ${r.why}; stopping`);
          stop.abort();
          break;
        }
        // A short answer is retried once per run (it still costs the full weight).
        if (r.kind === "skip" || ++attempts >= MAX_ATTEMPTS || (r.why === SHORT && ++shorts > 1)) {
          log(`cell ${p.lat},${p.lon}: ${r.why}; skipped for this run (a later run retries it)`);
          break;
        }
        backoff = Math.min(backoff ? backoff * 2 : r.wait, 15 * 60_000);
        log(`cell ${p.lat},${p.lon}: ${r.why}; retry in ${Math.round(backoff / 1000)} s`);
        await sleep(backoff, stop.signal);
      }
      if (Date.now() - lastSave > SAVE_EVERY_MS) {
        saveOutput(cache, out, step, nodes);
        lastSave = Date.now();
      }
      await sleep(paceMs, stop.signal);
    }
  } finally {
    clearTimeout(timer);
    saveOutput(cache, out, step, nodes);
    const left = nodes.filter((p) => !existsSync(cellFile(cache, p))).length;
    log(`done: ${fetched} fetched this run, ${nodes.length - left}/${nodes.length} cells built, ${left} left`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    log(`failed: ${e instanceof Error ? e.stack : e}`);
    process.exit(1);
  });
}
