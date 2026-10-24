import type { Env } from "./index";
import { GRID_KEY, putJson } from "./snapshot";
import type { Centroid, ConditionsPoint, ConditionsSnapshot } from "./types";
import { getOpenMeteoBulk } from "./openmeteo";
import { counted } from "./metrics";
import centroids from "../data/centroids.json";

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

/**
 * Collect modelled conditions (heat/rain/UV/dust) over the national grid and
 * write the snapshot to R2. This is what makes heat etc. national, rankable and
 * archivable, first-class alongside the air-station snapshot, not air-biased.
 */
export async function collectConditions(env: Env): Promise<ConditionsSnapshot> {
  // Throttle ~12s/batch to keep any 60s window under Open-Meteo's minute limit.
  // A failed bulk call, or too few points answered, counts as err:upstream:openmeteo.
  const points = await counted(env, "openmeteo", async () => {
    const wx = await getOpenMeteoBulk(
      GRID.map((c) => ({ lat: c.lat, lon: c.lon })),
      12_000,
    );
    const pts: ConditionsPoint[] = GRID.map((c, i) => ({ ...c, wx: wx[i] ?? {} }));
    if (!hasCoverage(pts)) throw new Error("[collect] too few grid points came back; kept the previous grid");
    return pts;
  });

  const snapshot: ConditionsSnapshot = {
    generated_at: new Date().toISOString(),
    point_count: points.length,
    points,
  };

  await putJson(env, GRID_KEY, JSON.stringify(snapshot), "public, max-age=300");
  return snapshot;
}
