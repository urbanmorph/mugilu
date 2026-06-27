import type { Env } from "./index";
import type { Centroid, ConditionsPoint, ConditionsSnapshot } from "./types";
import { getOpenMeteoBulk } from "./openmeteo";
import centroids from "../data/centroids.json";

// Districts only for the national weather grid (785 points) — the right grain
// for a national ranking, and it respects Open-Meteo's free quota (collecting
// all 2,690 points would blow past the 10k/day limit). City wards stay as
// geography for labels/warnings; hyperlocal /c fetches the exact point live.
const GRID = (centroids as Centroid[]).filter((c) => c.level === "district");

/**
 * Collect modelled conditions (heat/rain/UV/dust) over the national grid and
 * write the snapshot to R2. This is what makes heat etc. national, rankable and
 * archivable — first-class alongside the air-station snapshot, not air-biased.
 */
export async function collectConditions(env: Env): Promise<ConditionsSnapshot> {
  // Throttle ~12s/batch to keep any 60s window under Open-Meteo's minute limit.
  const wx = await getOpenMeteoBulk(GRID.map((c) => ({ lat: c.lat, lon: c.lon })), 12_000);
  const points: ConditionsPoint[] = GRID.map((c, i) => ({ ...c, wx: wx[i] ?? {} }));

  const snapshot: ConditionsSnapshot = {
    generated_at: new Date().toISOString(),
    point_count: points.length,
    points,
  };

  await env.OAQ_R2.put("data/conditions.json", JSON.stringify(snapshot), {
    httpMetadata: { contentType: "application/json", cacheControl: "public, max-age=300" },
  });
  return snapshot;
}
