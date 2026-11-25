import type { Env } from "./index";
import type { NormalizedStation } from "./types";
import { reason } from "./logs";

// Each air station's ground height, so a station in different air by height (a hill town over
// a station in the plains) is not read as the place's own air (conditions.ts stationApart).
// Heights come from Open-Meteo's elevation model (Copernicus DEM, 90 m) and never change, so
// each station position is looked up once and kept in R2 at STATION_ELEV_KEY, saved as soon as
// a batch arrives; the hourly refresh then looks up only stations it has not seen. The lookup
// is time-boxed and never throws: a failure leaves heights unknown, and an unknown height
// never moves a station off a place.

export const STATION_ELEV_KEY = "data/station-elev.json";
const ELEVATION_URL = "https://api.open-meteo.com/v1/elevation";
const BATCH = 100; // the API's limit per call
const BUDGET_MS = 4000;

/** A station position as the cache keys it (about 11 m). */
const posKey = (lat: number, lon: number) => `${lat.toFixed(4)},${lon.toFixed(4)}`;

/** The stations with their heights: kept ones from the cache, new ones looked up. */
export async function withElevations(
  env: Pick<Env, "OAQ_R2">,
  stations: NormalizedStation[],
  fetchFn: typeof fetch = fetch,
): Promise<NormalizedStation[]> {
  const kept: Record<string, number> =
    ((await (await env.OAQ_R2.get(STATION_ELEV_KEY).catch(() => null))?.json().catch(() => null)) as Record<
      string,
      number
    > | null) ?? {};
  const todo = [
    ...new Set(stations.filter((s) => s.lat != null && s.lon != null).map((s) => posKey(s.lat!, s.lon!))),
  ].filter((k) => kept[k] == null);
  const until = Date.now() + BUDGET_MS;
  let added = 0;
  for (let i = 0; i < todo.length && Date.now() < until; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    try {
      const lat = batch.map((k) => k.split(",")[0]).join(",");
      const lon = batch.map((k) => k.split(",")[1]).join(",");
      const r = await fetchFn(`${ELEVATION_URL}?latitude=${lat}&longitude=${lon}`, {
        signal: AbortSignal.timeout(Math.max(500, until - Date.now())),
      });
      if (!r.ok) throw new Error(`elevation ${r.status}`);
      const { elevation } = (await r.json()) as { elevation?: number[] };
      if (!elevation || elevation.length !== batch.length) throw new Error("elevation: unexpected answer");
      batch.forEach((k, j) => Number.isFinite(elevation[j]) && (kept[k] = Math.round(elevation[j])));
      added += batch.length;
      await env.OAQ_R2.put(STATION_ELEV_KEY, JSON.stringify(kept));
    } catch (e) {
      console.error(`[elevation] ${added} looked up, ${todo.length - added} left: ${reason(e)}`);
      break;
    }
  }
  return stations.map((s) => {
    const m = s.lat != null && s.lon != null ? kept[posKey(s.lat, s.lon)] : undefined;
    return m != null ? { ...s, elev_m: m } : s;
  });
}
