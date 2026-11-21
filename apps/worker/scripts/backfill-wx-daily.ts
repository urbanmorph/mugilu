// Fill archive/wx-daily/<date>.json.gz (collect.ts keeps one a day from now on) for past India
// days, from Open-Meteo's archives: the historical forecast for the six daily figures, the air
// quality archive for the day's highest hourly dust. The same grid points, the same figures.
//
//   CLOUDFLARE_API_TOKEN=... npx tsx scripts/backfill-wx-daily.ts --from 2026-10-21 --to 2026-11-20 [--state DIR]
//
// - Open-Meteo weighs a call by its points and days (100 points over 31 days is about 220 of
//   its 10,000 a day and 600 a minute), so calls are 40 s apart and a run is best kept to a
//   month: two calls for each of 8 batches.
// - Caching: each answer is saved to DIR as it arrives; a rerun reads it instead of asking again.
// - Idempotent: a day already in archive/wx-daily is never rewritten (the 4-hourly job's own
//   record wins); a rerun with every day there fetches and writes nothing.
// - Logs: one line per call and per day written, unbuffered.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import centroids from "../data/centroids.json";
import { WX_DAILY_PREFIX, type WxDailyFile } from "../src/collect";
import type { Centroid } from "../src/types";

const ACCOUNT = "6ba72cdd965276a57d19bf0aadc4d551";
const BUCKET = "oaq-data";
const TOKEN = process.env.CLOUDFLARE_API_TOKEN ?? "";
if (!TOKEN) throw new Error("set CLOUDFLARE_API_TOKEN");
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const FROM = arg("--from");
const TO = arg("--to");
if (!FROM || !TO || !/^\d{4}-\d{2}-\d{2}$/.test(FROM + "") || TO < FROM) throw new Error("--from and --to, YYYY-MM-DD");
const STATE = arg("--state") ?? "wx-backfill-state";
mkdirSync(STATE, { recursive: true });
const log = (s: string) => process.stdout.write(`${new Date().toISOString().slice(11, 19)} ${s}\n`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const GRID = (centroids as Centroid[]).filter((c) => c.level === "district");
const BATCH = 100;
const GAP_MS = 40_000;
const DAILY = {
  feels_max: "apparent_temperature_max",
  feels_min: "apparent_temperature_min",
  rain_mm: "precipitation_sum",
  gust_kmh: "wind_gusts_10m_max",
  uv_max: "uv_index_max",
  vis_min_m: "visibility_min",
} as const;

// ── Cloudflare's R2 API ─────────────────────────────────────────────────────────────
const R2 = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/r2/buckets/${BUCKET}/objects`;
async function r2(path: string, init: RequestInit = {}): Promise<Response> {
  for (let i = 1; ; i++) {
    await sleep(300); // about 3 a second, under the API's 4
    const res = await fetch(`${R2}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${TOKEN}`, ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(60_000),
    }).catch((e) => new Response(String(e), { status: 599 }));
    if (res.ok || res.status === 404 || i >= 4 || (res.status < 500 && res.status !== 429)) return res;
    await sleep(2000 * 2 ** i);
  }
}
async function existing(): Promise<Set<string>> {
  const res = await r2(`?prefix=${encodeURIComponent(WX_DAILY_PREFIX)}&per_page=1000`);
  const d = (await res.json()) as { result: { key: string }[] };
  return new Set(d.result.map((o) => o.key.slice(WX_DAILY_PREFIX.length, -".json.gz".length)));
}

// ── Open-Meteo, one answer per batch and archive, cached on disk ─────────────────────
let lastCall = 0;
type Om = { daily?: Record<string, unknown[]> & { time: string[] }; hourly?: { time: string[]; dust: unknown[] } };
async function om(name: string, url: string): Promise<Om[]> {
  const file = `${STATE}/${name}.json`;
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  for (let i = 1; ; i++) {
    await sleep(Math.max(0, lastCall + GAP_MS - Date.now()));
    lastCall = Date.now();
    const res = await fetch(url, { signal: AbortSignal.timeout(120_000) }).catch(
      (e) => new Response(String(e), { status: 599 }),
    );
    if (res.ok) {
      const body = await res.json();
      const arr = (Array.isArray(body) ? body : [body]) as Om[];
      writeFileSync(file, JSON.stringify(arr));
      log(`${name}: ${arr.length} points`);
      return arr;
    }
    log(`${name}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    if (i >= 4) throw new Error(`${name}: gave up`);
    await sleep(res.status === 429 ? 10 * 60_000 : 30_000 * i);
  }
}

const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : undefined);

async function main(): Promise<void> {
  const have = await existing();
  const days: string[] = [];
  for (let d = FROM!; d <= TO!; d = new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10))
    days.push(d);
  const todo = days.filter((d) => !have.has(d));
  log(`${days.length} days, ${days.length - todo.length} already kept; ${todo.length} to fill`);
  if (!todo.length) return;
  const [from, to] = [todo[0], todo.at(-1)!];
  const files = new Map<string, WxDailyFile>(todo.map((d) => [d, { date: d, points: {} }]));
  for (let i = 0; i < GRID.length; i += BATCH) {
    const chunk = GRID.slice(i, i + BATCH);
    const q =
      `latitude=${chunk.map((c) => c.lat.toFixed(3)).join(",")}&longitude=${chunk.map((c) => c.lon.toFixed(3)).join(",")}` +
      `&timezone=auto&start_date=${from}&end_date=${to}`;
    const fc = await om(
      `fc-${from}-${to}-${i}`,
      `https://historical-forecast-api.open-meteo.com/v1/forecast?${q}&daily=${Object.values(DAILY).join(",")}`,
    );
    const aq = await om(
      `aq-${from}-${to}-${i}`,
      `https://air-quality-api.open-meteo.com/v1/air-quality?${q}&hourly=dust`,
    );
    chunk.forEach((c, j) => {
      const daily = fc[j]?.daily;
      const hourly = aq[j]?.hourly;
      for (const [k, day] of (daily?.time ?? []).entries()) {
        const f = files.get(day);
        if (!f) continue;
        const p: WxDailyFile["points"][string] = {};
        for (const [field, v] of Object.entries(DAILY)) {
          const n = num(daily![v]?.[k]);
          if (n != null) p[field as keyof typeof DAILY] = n;
        }
        const dust = (hourly?.dust ?? [])
          .filter((_, h) => hourly!.time[h]?.startsWith(day))
          .map(num)
          .filter((n): n is number => n != null);
        if (dust.length) p.dust_max = Math.max(...dust);
        if (Object.keys(p).length) f.points[c.id] = p;
      }
    });
  }
  for (const f of files.values()) {
    const n = Object.keys(f.points).length;
    if (n < GRID.length * 0.9) {
      log(`${f.date}: figures for ${n} of ${GRID.length} points only; not kept`);
      continue;
    }
    const res = await r2(`/${WX_DAILY_PREFIX}${f.date}.json.gz`, {
      method: "PUT",
      headers: { "content-type": "application/json", "content-encoding": "gzip" },
      body: gzipSync(JSON.stringify(f)),
    });
    log(`${f.date}: ${n} points ${res.ok ? "kept" : `NOT kept (HTTP ${res.status})`}`);
  }
  log("finished");
}

main().catch((e) => {
  log(`stopped: ${e instanceof Error ? e.stack : String(e)}`);
  process.exit(1);
});
