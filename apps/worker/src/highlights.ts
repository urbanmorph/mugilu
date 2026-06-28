import type { ConditionsPoint, NormalizedStation } from "./types";
import type { Env } from "./index";
import { loadGrid, loadSnapshot } from "./snapshot";
import { stateAt } from "./place";

// The national multi-hazard "right now" picture, drives the landing hero.
// Deliberately NOT air-led: heat and dust first (per the whole-sky framing).

export interface NationalHighlights {
  hottest?: { name: string; state?: string; lat: number; lon: number; apparent_c: number; wet_bulb_c?: number };
  dustiest?: { name: string; state?: string; lat: number; lon: number; dust_ug_m3: number };
  /** Worst-AQI station from the hourly air snapshot — fresher than the grid. */
  worstAir?: { name: string; state?: string; lat: number; lon: number; aqi: number; band: NormalizedStation["band"] };
}

/** The single most extreme heat + dust point across the national grid. */
export function nationalHighlights(points: ConditionsPoint[]): NationalHighlights {
  const out: NationalHighlights = {};
  for (const p of points) {
    const feels = p.wx.apparent_c;
    if (feels != null && (!out.hottest || feels > out.hottest.apparent_c)) {
      out.hottest = {
        name: p.name,
        state: p.state,
        lat: p.lat,
        lon: p.lon,
        apparent_c: feels,
        wet_bulb_c: p.wx.wet_bulb_c,
      };
    }
    const dust = p.wx.dust_ug_m3;
    if (dust != null && (!out.dustiest || dust > out.dustiest.dust_ug_m3)) {
      out.dustiest = { name: p.name, state: p.state, lat: p.lat, lon: p.lon, dust_ug_m3: dust };
    }
  }
  return out;
}

/** The single worst-AQI station with coordinates, from the hourly air snapshot.
 *  Sourced separately from the 4-hourly weather grid, so the home hero can show
 *  a genuinely fresher air row beside the heat/dust ones. */
export function worstAirStation(stations: NormalizedStation[]): NationalHighlights["worstAir"] {
  let worst: NationalHighlights["worstAir"];
  for (const s of stations) {
    if (s.aqi != null && s.lat != null && s.lon != null && (!worst || s.aqi > worst.aqi)) {
      worst = { name: s.city || s.name, lat: s.lat, lon: s.lon, aqi: s.aqi, band: s.band };
    }
  }
  return worst;
}

/** The national picture composed from R2: heat/dust from the 4-hourly grid, the
 *  worst-air row from the fresher hourly snapshot (state-enriched). Shared by the
 *  home hero and the MCP national_now tool so they can't drift. */
export async function composeHighlights(
  env: Env,
): Promise<{ highlights: NationalHighlights; gridAsOf?: string; airAsOf?: string }> {
  const [grid, snap] = await Promise.all([loadGrid(env), loadSnapshot(env)]);
  const highlights: NationalHighlights = grid ? nationalHighlights(grid.points) : {};
  if (snap) {
    const worst = worstAirStation(snap.stations);
    if (worst) {
      worst.state = stateAt(worst.lat, worst.lon);
      highlights.worstAir = worst;
    }
  }
  return { highlights, gridAsOf: grid?.generated_at, airAsOf: snap?.generated_at };
}
