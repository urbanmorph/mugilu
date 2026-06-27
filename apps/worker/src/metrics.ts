import type { Env } from "./index";

// First-party, aggregate usage metrics (D1). The whole point is to learn what
// India looks up and who builds on mugilu — WITHOUT tracking people: no IP, no
// cookies, no per-user rows. Coordinates are rounded to a ~11km grid, so the
// `lookups` table is a demand heatmap, never a trail. All writes are fire-and-
// forget (ctx.waitUntil) and best-effort; metrics never affect a response.

/** Round to a ~11km grid (1 decimal) so usage can't be a precise trail. */
function gridKey(lat: number, lon: number): { key: string; rlat: number; rlon: number } {
  const rlat = Math.round(lat * 10) / 10;
  const rlon = Math.round(lon * 10) / 10;
  return { key: `${rlat},${rlon}`, rlat, rlon };
}

/** Record one conditions lookup: bump the rounded place + the format counter. */
export async function recordLookup(
  env: Env,
  lat: number,
  lon: number,
  label: string | undefined,
  fmt: string,
): Promise<void> {
  const { key, rlat, rlon } = gridKey(lat, lon);
  try {
    await env.METRICS.batch([
      env.METRICS.prepare(
        "INSERT INTO lookups (key,label,lat,lon,n,last) VALUES (?,?,?,?,1,unixepoch()) " +
          "ON CONFLICT(key) DO UPDATE SET n=n+1, last=unixepoch(), label=COALESCE(excluded.label,label)",
      ).bind(key, label ?? null, rlat, rlon),
      env.METRICS.prepare("INSERT INTO counters (name,n) VALUES (?,1) ON CONFLICT(name) DO UPDATE SET n=n+1").bind(
        `fmt:${fmt}`,
      ),
    ]);
  } catch {
    // best-effort: a metrics failure must never surface to the visitor
  }
}

export interface TopPlace {
  label: string;
  lat: number;
  lon: number;
  n: number;
}

/** The most-looked-up places (drives the home "Popular" + /api/counts). */
export async function topPlaces(env: Env, limit = 8): Promise<TopPlace[]> {
  try {
    const r = await env.METRICS.prepare(
      "SELECT label, lat, lon, n FROM lookups WHERE label IS NOT NULL ORDER BY n DESC LIMIT ?",
    )
      .bind(limit)
      .all<TopPlace>();
    return r.results ?? [];
  } catch {
    return [];
  }
}

/** Format/embed/api tallies for /api/counts. */
export async function counters(env: Env): Promise<Record<string, number>> {
  try {
    const r = await env.METRICS.prepare("SELECT name, n FROM counters").all<{ name: string; n: number }>();
    const out: Record<string, number> = {};
    for (const row of r.results ?? []) out[row.name] = row.n;
    return out;
  } catch {
    return {};
  }
}
