import type { Env } from "./index";
import type { Conditions } from "./types";
import { ambientRisk } from "./score";
import type { Persona } from "./score";
import { stateAt } from "./place";
import type { Lang } from "./i18n";

// First-party, aggregate usage metrics (D1). The whole point is to learn what
// India looks up and who builds on mugilu, WITHOUT tracking people: no IP, no
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
 *  distinct from both humans and dumb crawlers, so the LLM bucket stands alone.
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

// Named agents we recognise: LLM/AI first, then search/SEO/other. Longer tokens
// before their substrings (applebot-extended before applebot).
const KNOWN_AGENTS = [
  "gptbot",
  "oai-searchbot",
  "chatgpt-user",
  "claudebot",
  "claude-user",
  "claude-web",
  "anthropic-ai",
  "perplexitybot",
  "perplexity-user",
  "google-extended",
  "bytespider",
  "amazonbot",
  "applebot-extended",
  "meta-externalagent",
  "meta-externalfetcher",
  "cohere-ai",
  "youbot",
  "ccbot",
  "diffbot",
  "timpibot",
  "omgilibot",
  "imagesiftbot",
  "googlebot",
  "bingbot",
  "applebot",
  "yandexbot",
  "duckduckbot",
  "baiduspider",
  "ahrefsbot",
  "semrushbot",
  "mj12bot",
  "dotbot",
  "petalbot",
  "facebookexternalhit",
];

/** The specific named agent behind a hit ("gptbot", "claudebot", …) so the LLM
 *  bucket can be broken down by who exactly is crawling. Falls back to capturing
 *  an unrecognised *bot/crawler/-user token; "" for humans and unknown browsers. */
export function agentName(ua: string | null | undefined): string {
  const s = (ua ?? "").toLowerCase();
  if (!s) return "";
  for (const a of KNOWN_AGENTS) if (s.includes(a)) return a;
  const m = s.match(/([a-z][a-z0-9._-]*(?:bot|crawler|spider|-user|-agent|-fetcher))/);
  return m ? m[1].slice(0, 40) : "";
}

/** Whether a request carries what a real browser sends when a person opens a page:
 *  an Accept-Language, plus Fetch Metadata saying it is a page load (a navigation, or
 *  a document / embed frame) or a script on our own page (the kiosk's refresh). A
 *  crawler that copies a browser's User-Agent rarely sends these, so it stops
 *  counting as a person. Read from the request only; nothing is stored. */
export function browserSignal(h: Headers): boolean {
  if (!h.get("accept-language")) return false;
  const dest = h.get("sec-fetch-dest");
  return (
    h.get("sec-fetch-mode") === "navigate" ||
    dest === "document" ||
    dest === "iframe" ||
    h.get("sec-fetch-site") === "same-origin"
  );
}

/** Who a request is from, by kind only (never who): the User-Agent's class and named
 *  agent, whether it looks like a real browser, and the page language it asked for. */
export interface Caller {
  cls: ClientClass;
  agent: string;
  browser: boolean;
  lang: Lang;
}

export function requestCaller(req: Request, lang: Lang = "en"): Caller {
  const ua = req.headers.get("user-agent");
  return { cls: clientClass(ua), agent: agentName(ua), browser: browserSignal(req.headers), lang };
}

/** A person reading in a browser: the gate for every "human" count in D1. */
export const isPerson = (c: Caller) => c.cls === "human" && c.browser;

const BUMP = "INSERT INTO counters (name,n) VALUES (?,?) ON CONFLICT(name) DO UPDATE SET n=n+excluded.n";

/** A statement adding `by` to a counter, for a batch that already writes. Names come
 *  from fixed sets in code (formats, languages, tool names, sources), never input. */
export const bumpStmt = (db: D1Database, name: string, by = 1) => db.prepare(BUMP).bind(name, by);

/** Add to several counters in one write (zeros skipped). Best-effort. */
export async function bump(env: Env, counts: Record<string, number>): Promise<void> {
  const names = Object.keys(counts).filter((k) => counts[k] > 0);
  if (!names.length) return;
  try {
    await env.METRICS.batch(names.map((k) => bumpStmt(env.METRICS, k, counts[k])));
  } catch {
    // best-effort: a metrics failure must never surface
  }
}

/** Record one conditions lookup. Always bump the human/llm/bot class counter; the
 *  per-place, per-format and per-language detail is written ONLY for a person in a
 *  browser (isPerson), so the demand heatmap reflects real people (not crawlers
 *  walking the sitemap, even ones posing as browsers) and a burst of bot/LLM traffic
 *  can't burn the D1 write budget. MCP calls are agents by definition: never detail.
 *  Bot/LLM detail lives in Analytics Engine instead, cheap and built for the volume.
 *  `also` adds other counters to the same write. */
export async function recordLookup(
  env: Env,
  u: Pick<UsageFacts, "lat" | "lon" | "place">,
  fmt: string,
  caller: Caller,
  also: string[] = [],
): Promise<void> {
  const db = env.METRICS;
  try {
    const stmts = [`class:${caller.cls}`, ...also].map((k) => bumpStmt(db, k));
    if (isPerson(caller) && fmt !== "mcp") {
      const { key, rlat, rlon } = gridKey(u.lat, u.lon);
      stmts.push(
        db
          .prepare(
            "INSERT INTO lookups (key,label,lat,lon,n,last) VALUES (?,?,?,?,1,unixepoch()) " +
              "ON CONFLICT(key) DO UPDATE SET n=n+1, last=unixepoch(), label=COALESCE(excluded.label,label)",
          )
          .bind(key, u.place ?? null, rlat, rlon),
        bumpStmt(db, `fmt:${fmt}`),
        bumpStmt(db, `lang:${caller.lang}`),
      );
    }
    await db.batch(stmts);
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

/** Lowercase + strip to a safe host/name token (no www), or "" if nothing's left. */
function sanitizeHost(s: string): string {
  return s
    .replace(/^www\./i, "")
    .toLowerCase()
    .replace(/[^a-z0-9.\-]/g, "")
    .slice(0, 60);
}

// Two-label public suffixes we see in practice (India first). A host under one of
// these keeps the name in front of it (paper.co.in), not just "co.in".
const TWO_LEVEL_SUFFIXES = new Set([
  "co.in",
  "gov.in",
  "nic.in",
  "ac.in",
  "edu.in",
  "res.in",
  "org.in",
  "net.in",
  "gen.in",
  "firm.in",
  "ind.in",
  "co.uk",
  "org.uk",
  "ac.uk",
  "gov.uk",
  "com.au",
  "org.au",
  "co.nz",
  "co.jp",
  "com.sg",
  "com.br",
]);

// Hosting platforms where each app gets its own subdomain: the adopter is that app,
// so one label below the platform is kept (my-app.vercel.app, not vercel.app).
const PLATFORM_SUFFIXES = new Set([
  "lovable.app",
  "lovableproject.com",
  "github.io",
  "pages.dev",
  "vercel.app",
  "netlify.app",
  "workers.dev",
  "web.app",
  "firebaseapp.com",
  "onrender.com",
  "herokuapp.com",
]);

/** The adopter a host stands for, so the many preview / per-branch subdomains of one
 *  site count once: the registrable domain (news.example.com -> example.com), or on a
 *  hosting platform the app's own subdomain. Lovable's preview and project hosts of
 *  one app (id-preview--<id>.lovable.app, id-preview-<hash>--<id>.lovable.app,
 *  preview--<name>.lovable.app, <id>.lovableproject.com) all become <id>.lovable.app.
 *  Values that are not domain names (localhost, an IP, a ?ref= or MCP client name)
 *  stay as-is. */
export function registrableHost(host: string): string {
  if (!host.includes(".") || /^[\d.]+$/.test(host)) return host;
  const labels = host.split(".").filter(Boolean);
  const suffix = labels.slice(-2).join(".");
  if (PLATFORM_SUFFIXES.has(suffix) && labels.length > 2) {
    const app = labels[labels.length - 3].replace(/^(?:id-)?preview(?:-[a-z0-9]+)?--/, "");
    return `${app}.${suffix === "lovableproject.com" ? "lovable.app" : suffix}`;
  }
  const keep = TWO_LEVEL_SUFFIXES.has(suffix) ? 3 : 2;
  return labels.slice(-keep).join(".");
}

/** The referring site, or a sanitised ?ref= value. Null if there's none, or it's
 *  one of our own pages (not external adoption). */
function referrerHost(req: Request, url: URL): string | null {
  const ref = url.searchParams.get("ref");
  const raw = ref ? null : req.headers.get("referer") || req.headers.get("origin");
  let host: string;
  try {
    host = ref ? sanitizeHost(ref) : raw ? sanitizeHost(new URL(raw).hostname) : "";
  } catch {
    return null;
  }
  const site = host && registrableHost(host);
  return !site || site === "mugilu.live" ? null : site;
}

/** Bump the per-surface, per-host adoption counter (best-effort, domain-level). */
async function bumpReferrer(env: Env, surface: string, host: string): Promise<void> {
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

/** Record who built on us: the referring site/app for an /embed or API hit. */
export async function recordReferrer(env: Env, surface: string, req: Request, url: URL): Promise<void> {
  const host = referrerHost(req, url);
  if (host) await bumpReferrer(env, surface, host);
}

/** Record which MCP client connected (the adoption metric for the agent door). */
export async function recordMcpClient(env: Env, name: string): Promise<void> {
  const host = sanitizeHost(name);
  if (host) await bumpReferrer(env, "mcp", host);
}

/** Most referrer rows kept. Adoption is a long tail; past this the smallest go. */
export const REFERRER_CAP = 1000;
/** A row idle this long with fewer than REFERRER_KEEP_N hits is a one-off: dropped. */
const REFERRER_IDLE_DAYS = 180;
const REFERRER_KEEP_N = 10;

/** Bound the referrers table (daily): it gained a row per new host forever. Drops
 *  long-idle one-offs, then caps the table at the REFERRER_CAP biggest adopters. */
export async function pruneReferrers(env: Env, now = Math.floor(Date.now() / 1000)): Promise<void> {
  await env.METRICS.batch([
    env.METRICS.prepare("DELETE FROM referrers WHERE last < ? AND n < ?").bind(
      now - REFERRER_IDLE_DAYS * 86_400,
      REFERRER_KEEP_N,
    ),
    env.METRICS.prepare(
      "DELETE FROM referrers WHERE key NOT IN (SELECT key FROM referrers ORDER BY n DESC, last DESC LIMIT ?)",
    ).bind(REFERRER_CAP),
  ]);
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

/** What the usage metrics take from one lookup: the point and its place label (the
 *  D1 heatmap rounds the point), and the read's dimensions for the behaviour event.
 *  Nothing about the person. Kept with an edge-cached copy so a hit records the same. */
export interface UsageFacts {
  lat: number;
  lon: number;
  place: string | null;
  persona: Persona;
  driver: string;
  band: string;
  level: number;
  state: string;
  air: "measured" | "modelled" | "none";
  aqi: number;
  apparent: number;
}

export function usageFacts(c: Conditions, persona: Persona): UsageFacts {
  const risk = ambientRisk(c, persona);
  return {
    lat: c.location.lat,
    lon: c.location.lon,
    place: c.place ?? null,
    persona,
    driver: risk.driver.toLowerCase(),
    band: risk.band,
    level: risk.level,
    state: stateAt(c.location.lat, c.location.lon) ?? "",
    air: c.air ? (c.air.station ? "measured" : "modelled") : "none",
    aqi: c.air?.aqi ?? -1,
    apparent: c.heat?.apparent_c ?? -999,
  };
}

/** What an event adds to a lookup's facts: the surface, the caller, and (on a fresh
 *  render) how long it took and its status; an MCP tool call names its tool. */
export interface EventDims {
  format: string;
  caller: Caller;
  tool?: string;
  /** Milliseconds to build the response; absent on an edge-cache hit. */
  ms?: number;
  status?: number;
}

/** One anonymous behaviour event per lookup or MCP tool call: dimensions only, no IP
 *  and no user id. Goes to Analytics Engine for time-series + breakdowns (queried via
 *  the AE SQL API). Synchronous + best-effort; the binding is optional. Positions are
 *  fixed (ops queries read them): blob1 format, 2 persona, 3 driver, 4 band, 5 state,
 *  6 air, 7 class, 8 agent, 9 browser ("1"/"0"), 10 language, 11 MCP tool;
 *  double1 level, 2 AQI, 3 feels-like, 4 build ms (-1 on a cache hit), 5 status. */
export function recordEvent(env: Env, u: UsageFacts | null, e: EventDims): void {
  if (!env.EVENTS) return;
  const c = e.caller;
  try {
    env.EVENTS.writeDataPoint({
      blobs: [
        e.format,
        u?.persona ?? "",
        u?.driver ?? "",
        u?.band ?? "",
        u?.state ?? "",
        u?.air ?? "",
        c.cls,
        c.agent,
        c.browser ? "1" : "0",
        c.lang,
        e.tool ?? "",
      ],
      doubles: [u?.level ?? -1, u?.aqi ?? -1, u?.apparent ?? -999, e.ms ?? -1, e.status ?? 0],
      indexes: [e.format],
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
