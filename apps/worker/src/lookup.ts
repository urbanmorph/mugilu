import type { Env } from "./index";
import type { Conditions, Snapshot } from "./types";
import type { FiresSnapshot } from "./firms";
import type { Persona } from "./score";
import { buildConditions } from "./conditions";
import { loadFires, loadSnapshot } from "./snapshot";
import { recordEvent, recordLookup, recordReferrer, usageFacts, type UsageFacts } from "./metrics";

// The one conditions pipeline every surface runs (the /c page and its .json/.md/.png
// siblings, the kiosk, /embed, the MCP conditions_at tool): load the snapshots, build
// the conditions, name the place, and record usage the same way everywhere.

/** Which surface served the lookup. Also the format recorded in the usage metrics. */
export type LookupFormat = "html" | "kiosk" | "json" | "md" | "png" | "embed" | "mcp";

interface ConditionsData {
  snapshot: Promise<Snapshot | null>;
  fires: Promise<FiresSnapshot | null>;
}

interface LookupInput {
  lat: number;
  lon: number;
  persona: Persona;
  fmt: LookupFormat;
  ua: string | null;
  /** A named place owns its label (so /c/bengaluru reads "Bengaluru", not a ward). */
  label?: string;
  /** Snapshot reads already started for this request (conditionsData). */
  data?: ConditionsData;
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

/** The R2 snapshots a lookup reads. A caller with other work first (resolving a
 *  place) starts them here and passes them in, so the reads overlap that work. A
 *  failure surfaces where they are awaited; the no-op catch only keeps an early
 *  return from leaving a rejection unhandled. */
export function conditionsData(env: Env): ConditionsData {
  const d = { snapshot: loadSnapshot(env), fires: loadFires(env) };
  d.snapshot.catch(() => {});
  d.fires.catch(() => {});
  return d;
}

/** Builds the conditions and records the lookup. `usage` is what was recorded, kept
 *  with an edge-cached copy so a cache hit records the same (recordUsage). */
export async function lookupConditions(
  env: Env,
  ctx: ExecutionContext,
  q: LookupInput,
): Promise<{ conditions: Conditions; usage: UsageFacts }> {
  const d = q.data ?? conditionsData(env);
  const conditions = await buildConditions(d.snapshot, q.lat, q.lon, d.fires);
  if (q.label) conditions.place = q.label;
  const usage = usageFacts(conditions, q.persona);
  recordUsage(env, ctx, usage, q);
  return { conditions, usage };
}

/** Usage for one lookup: the place heatmap (D1), the adopter (D1) and the anonymous
 *  behaviour event (Analytics Engine). All best-effort, off the response path. */
export function recordUsage(
  env: Env,
  ctx: ExecutionContext,
  u: UsageFacts,
  q: Pick<LookupInput, "fmt" | "ua" | "req" | "url">,
): void {
  // A kiosk is one persistent display refreshing itself, not demand: keep it out of
  // the D1 place heatmap (and its write budget). The event still counts it.
  if (q.fmt !== "kiosk") ctx.waitUntil(recordLookup(env, u.lat, u.lon, u.place ?? undefined, q.fmt, q.ua));
  const surface = REFERRER_SURFACE[q.fmt];
  if (surface && q.req && q.url) ctx.waitUntil(recordReferrer(env, surface, q.req, q.url));
  recordEvent(env, u, q.fmt, q.ua);
}
