import type { ConditionsPoint } from "./types";

// The national multi-hazard "right now" picture, drives the landing hero.
// Deliberately NOT air-led: heat and dust first (per the whole-sky framing).

export interface NationalHighlights {
  hottest?: { name: string; lat: number; lon: number; apparent_c: number; wet_bulb_c?: number };
  dustiest?: { name: string; lat: number; lon: number; dust_ug_m3: number };
}

/** The single most extreme heat + dust point across the national grid. */
export function nationalHighlights(points: ConditionsPoint[]): NationalHighlights {
  const out: NationalHighlights = {};
  for (const p of points) {
    const feels = p.wx.apparent_c;
    if (feels != null && (!out.hottest || feels > out.hottest.apparent_c)) {
      out.hottest = { name: p.name, lat: p.lat, lon: p.lon, apparent_c: feels, wet_bulb_c: p.wx.wet_bulb_c };
    }
    const dust = p.wx.dust_ug_m3;
    if (dust != null && (!out.dustiest || dust > out.dustiest.dust_ug_m3)) {
      out.dustiest = { name: p.name, lat: p.lat, lon: p.lon, dust_ug_m3: dust };
    }
  }
  return out;
}
