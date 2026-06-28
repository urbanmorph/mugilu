import type { Env } from "./index";
import type { Conditions } from "./types";
import { ambientRisk } from "./score";
import type { Persona } from "./score";
import { stateAt } from "./place";

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

/** Classify the caller from its User-Agent: a real person, an AI/LLM agent, or a
 *  plain bot/crawler/script. With the API + MCP live, "who is building on us"
 *  (answer engines, model crawlers, MCP clients) is first-class adoption signal,
 *  distinct from both humans and dumb crawlers — so the LLM bucket stands alone.
 *  Check LLM patterns first: many AI agents (GPTBot, ClaudeBot) also match /bot/. */
export type ClientClass = "human" | "llm" | "bot";
export function clientClass(ua: string | null | undefined): ClientClass {
  const s = (ua ?? "").toLowerCase();
  if (!s) return "bot"; // no User-Agent is almost always a script or scanner
  if (
    /gptbot|chatgpt|oai-searchbot|openai|claudebot|claude-user|claude-web|anthropic|perplexity|google-extended|bytespider|amazonbot|applebot-extended|meta-externalagent|meta-externalfetcher|cohere-ai|youbot|ccbot|diffbot|mcp|modelcontextprotocol/.test(
      s,
    )
  )
    return "llm";
  if (
    /bot|crawl|spider|slurp|curl|wget|python|http-client|go-http|java\/|okhttp|libwww|headless|scan|monitor|facebookexternalhit|whatsapp|telegram|embedly|preview/.test(
      s,
    )
  )
    return "bot";
  return "human";
}

/** Record one conditions lookup: bump the rounded place + format + client-class. */
export async function recordLookup(
  env: Env,
  lat: number,
  lon: number,
  label: string | undefined,
  fmt: string,
  ua: string | null,
): Promise<void> {
  const { key, rlat, rlon } = gridKey(lat, lon);
  const bump = "INSERT INTO counters (name,n) VALUES (?,1) ON CONFLICT(name) DO UPDATE SET n=n+1";
  try {
    await env.METRICS.batch([
      env.METRICS.prepare(
        "INSERT INTO lookups (key,label,lat,lon,n,last) VALUES (?,?,?,?,1,unixepoch()) " +
          "ON CONFLICT(key) DO UPDATE SET n=n+1, last=unixepoch(), label=COALESCE(excluded.label,label)",
      ).bind(key, label ?? null, rlat, rlon),
      env.METRICS.prepare(bump).bind(`fmt:${fmt}`),
      env.METRICS.prepare(bump).bind(`class:${clientClass(ua)}`),
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

/** Minimum cumulative lookups before a place is shown PUBLICLY as "popular".
 *  Below this it's noise (or our own testing); the home falls back to seed cities.
 *  The private /api/counts ignores it (minN=0) so the team sees everything. */
export const POPULAR_MIN = 25;

/** The most-looked-up places. `minN` gates the public "Popular" by a decent
 *  cumulative threshold; the private read passes 0 to see the full picture. */
export async function topPlaces(env: Env, limit = 8, minN = 0): Promise<TopPlace[]> {
  try {
    const r = await env.METRICS.prepare(
      "SELECT label, lat, lon, n FROM lookups WHERE label IS NOT NULL AND n >= ? ORDER BY n DESC LIMIT ?",
    )
      .bind(minN, limit)
      .all<TopPlace>();
    return r.results ?? [];
  } catch {
    return [];
  }
}

/** The referring host (no www, lowercased), or a sanitised ?ref= value. Null if
 *  there's none, or it's one of our own pages (not external adoption). */
function referrerHost(req: Request, url: URL): string | null {
  const ref = url.searchParams.get("ref");
  if (ref)
    return (
      ref
        .toLowerCase()
        .replace(/[^a-z0-9.\-]/g, "")
        .slice(0, 60) || null
    );
  const raw = req.headers.get("referer") || req.headers.get("origin");
  if (!raw) return null;
  try {
    const host = new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
    if (!host || host === "mugilu.live") return null;
    return host;
  } catch {
    return null;
  }
}

/** Record who built on us: the referring site/app for an /embed or API hit.
 *  Domain-level, not user-level; our own pages and empty referrers are skipped. */
export async function recordReferrer(env: Env, surface: string, req: Request, url: URL): Promise<void> {
  const host = referrerHost(req, url);
  if (!host) return;
  try {
    await env.METRICS.prepare(
      "INSERT INTO referrers (key,host,surface,n,last) VALUES (?,?,?,1,unixepoch()) " +
        "ON CONFLICT(key) DO UPDATE SET n=n+1, last=unixepoch()",
    )
      .bind(`${surface}|${host}`, host, surface)
      .run();
  } catch {
    // best-effort
  }
}

export interface Referrer {
  host: string;
  surface: string;
  n: number;
}

/** The top adopters (sites/apps building on the embed + API). */
export async function topReferrers(env: Env, limit = 25): Promise<Referrer[]> {
  try {
    const r = await env.METRICS.prepare("SELECT host, surface, n FROM referrers ORDER BY n DESC LIMIT ?")
      .bind(limit)
      .all<Referrer>();
    return r.results ?? [];
  } catch {
    return [];
  }
}

/** One anonymous behaviour event per /c lookup — dimensions only (format, persona,
 *  the Ambient driver + band, region/state, air kind), no IP and no user id. Goes
 *  to Analytics Engine for time-series + breakdowns (queried via the AE SQL API).
 *  Synchronous + best-effort; the binding is optional. */
export function recordEvent(env: Env, c: Conditions, persona: Persona, format: string, ua: string | null): void {
  if (!env.EVENTS) return;
  try {
    const risk = ambientRisk(c, persona);
    const state = stateAt(c.location.lat, c.location.lon) ?? "";
    const airKind = c.air ? (c.air.station ? "measured" : "modelled") : "none";
    env.EVENTS.writeDataPoint({
      blobs: [format, persona, risk.driver.toLowerCase(), risk.band, state, airKind, clientClass(ua)],
      doubles: [risk.level, c.air?.aqi ?? -1, c.heat?.apparent_c ?? -999],
      indexes: [format],
    });
  } catch {
    // best-effort: events must never affect a response
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
