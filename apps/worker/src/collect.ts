import type { Env } from "./index";
import { GRID_KEY, putJson } from "./snapshot";
import type { Centroid, ConditionsPoint, ConditionsSnapshot } from "./types";
import { getOpenMeteoBulk, type WxDay } from "./openmeteo";
import { counted } from "./metrics";
import centroids from "../data/centroids.json";
import { gzip } from "./gzip";

// Districts only for the national weather grid (785 points), the right grain
// for a national ranking, and it respects Open-Meteo's free quota (collecting
// all 2,690 points would blow past the 10k/day limit). City wards stay as
// geography for labels/warnings; hyperlocal /c fetches the exact point live.
const GRID = (centroids as Centroid[]).filter((c) => c.level === "district");

// Below this share of points with any reading, the run failed (Open-Meteo down
// or rate-limited) and the previous grid is kept rather than overwritten.
const MIN_COVERAGE = 0.9;

/** Whether enough grid points came back with data to be worth writing. */
export function hasCoverage(points: ConditionsPoint[]): boolean {
  const filled = points.filter((p) => Object.values(p.wx).some((v) => v != null)).length;
  return points.length > 0 && filled / points.length >= MIN_COVERAGE;
}

/** Where a grid snapshot is kept: archive/conditions/{YYYY-MM-DD}/{HH}.json.gz, off its UTC hour (as the air
 *  archive, refresh.ts). */
export function conditionsArchiveKey(generatedAt: string): string {
  return `archive/conditions/${generatedAt.slice(0, 10)}/${generatedAt.slice(11, 13)}.json.gz`;
}

const DAY = 86_400_000;
const IST = 19_800_000;
/** Each India day's modelled figures by grid point: archive/wx-daily/{YYYY-MM-DD}.json.gz. */
export const WX_DAILY_PREFIX = "archive/wx-daily/";

/** One day's figures for every grid point (WxDay without its date), by point id. */
export interface WxDailyFile {
  date: string;
  points: Record<string, Omit<WxDay, "date">>;
}

/** Keep the day's figures, when Open-Meteo gave them for that day at enough points (its day can
 *  lag a few minutes past midnight; the next run asks again). */
async function keepDay(env: Env, date: string, days: (WxDay | undefined)[]): Promise<void> {
  const points: WxDailyFile["points"] = {};
  GRID.forEach((c, i) => {
    const d = days[i];
    if (d?.date !== date) return;
    const { date: _, ...figures } = d;
    if (Object.keys(figures).length) points[c.id] = figures;
  });
  if (Object.keys(points).length < GRID.length * MIN_COVERAGE) {
    console.log(
      `[collect] ${date}: daily figures for ${Object.keys(points).length} points only; asking again next run`,
    );
    return;
  }
  const file: WxDailyFile = { date, points };
  await env.OAQ_R2.put(`${WX_DAILY_PREFIX}${date}.json.gz`, await gzip(JSON.stringify(file)), {
    httpMetadata: { contentType: "application/json", contentEncoding: "gzip" },
  });
  console.log(`[collect] ${date}: daily figures for ${Object.keys(points).length} points`);
}

/**
 * Collect modelled conditions (heat/rain/UV/dust) over the national grid and
 * write the snapshot to R2. This is what makes heat etc. national, rankable and
 * archivable, first-class alongside the air-station snapshot, not air-biased.
 * Each run's grid is also kept, gzipped, in the archive: mugilu's own record of what
 * it already fetches (about 26 KB a run), instead of overwriting it. `delayMs` paces
 * the Open-Meteo batches (tests pass 0).
 */
export async function collectConditions(env: Env, delayMs = 12_000, now = Date.now()): Promise<ConditionsSnapshot> {
  // The day just ended in India, asked for once: by the first run that finds it missing.
  const yesterday = new Date(now + IST - DAY).toISOString().slice(0, 10);
  const dayKey = `${WX_DAILY_PREFIX}${yesterday}.json.gz`;
  const pastDay = !(await env.OAQ_R2.head(dayKey));
  // Throttle ~12s/batch to keep any 60s window under Open-Meteo's minute limit.
  // A failed bulk call, or too few points answered, counts as err:upstream:openmeteo.
  const { points, days } = await counted(env, "openmeteo", async () => {
    const wx = await getOpenMeteoBulk(
      GRID.map((c) => ({ lat: c.lat, lon: c.lon })),
      delayMs,
      { pastDay },
    );
    const pts: ConditionsPoint[] = GRID.map((c, i) => {
      const { day: _, ...current } = wx[i] ?? {};
      return { ...c, wx: current };
    });
    if (!hasCoverage(pts)) throw new Error("[collect] too few grid points came back; kept the previous grid");
    return { points: pts, days: wx.map((w) => w?.day) };
  });

  const snapshot: ConditionsSnapshot = {
    generated_at: new Date().toISOString(),
    point_count: points.length,
    points,
  };

  if (pastDay) await keepDay(env, yesterday, days);
  const body = JSON.stringify(snapshot);
  const gz = await gzip(body);
  await Promise.all([
    putJson(env, GRID_KEY, body, "public, max-age=300"),
    env.OAQ_R2.put(conditionsArchiveKey(snapshot.generated_at), gz, {
      httpMetadata: { contentType: "application/json", contentEncoding: "gzip" },
    }),
  ]);
  return snapshot;
}
