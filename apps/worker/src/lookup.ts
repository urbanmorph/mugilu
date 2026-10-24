import type { Env } from "./index";
import type { Conditions } from "./types";
import type { Persona } from "./score";
import { buildConditions } from "./conditions";
import { loadFires, loadSnapshot } from "./snapshot";
import { recordEvent, recordLookup, recordReferrer } from "./metrics";

// The one conditions pipeline every surface runs (the /c page and its .json/.md/.png
// siblings, the kiosk, /embed, the MCP conditions_at tool): load the snapshots, build
// the conditions, name the place, and record usage the same way everywhere.

/** Which surface served the lookup. Also the format recorded in the usage metrics. */
export type LookupFormat = "html" | "kiosk" | "json" | "md" | "png" | "embed" | "mcp";

interface LookupInput {
  lat: number;
  lon: number;
  persona: Persona;
  fmt: LookupFormat;
  ua: string | null;
  /** A named place owns its label (so /c/bengaluru reads "Bengaluru", not a ward). */
  label?: string;
  /** The web request, for the referrer of a "build on it" surface (API formats, /embed). */
  req?: Request;
  url?: URL;
}

/** The adoption surface a format counts under, or none (our own pages, kiosk, MCP:
 *  MCP clients are counted once, at initialize). */
const REFERRER_SURFACE: Partial<Record<LookupFormat, string>> = {
  json: "api",
  md: "api",
  png: "api",
  embed: "embed",
};

export async function lookupConditions(env: Env, ctx: ExecutionContext, q: LookupInput): Promise<Conditions> {
  const [snap, fires] = await Promise.all([loadSnapshot(env), loadFires(env)]);
  const conditions = await buildConditions(snap, q.lat, q.lon, fires);
  if (q.label) conditions.place = q.label;
  recordUsage(env, ctx, conditions, q);
  return conditions;
}

/** Usage for one lookup: the place heatmap (D1), the adopter (D1) and the anonymous
 *  behaviour event (Analytics Engine). All best-effort, off the response path. */
function recordUsage(env: Env, ctx: ExecutionContext, c: Conditions, q: LookupInput): void {
  // A kiosk is one persistent display refreshing itself, not demand: keep it out of
  // the D1 place heatmap (and its write budget). The event still counts it.
  if (q.fmt !== "kiosk") ctx.waitUntil(recordLookup(env, q.lat, q.lon, c.place, q.fmt, q.ua));
  const surface = REFERRER_SURFACE[q.fmt];
  if (surface && q.req && q.url) ctx.waitUntil(recordReferrer(env, surface, q.req, q.url));
  recordEvent(env, c, q.persona, q.fmt, q.ua);
}
