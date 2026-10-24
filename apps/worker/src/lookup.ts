import type { Env } from "./index";
import type { Conditions, Snapshot } from "./types";
import type { FiresSnapshot } from "./firms";
import type { Persona } from "./score";
import type { Served } from "./edge";
import { buildConditions } from "./conditions";
import { loadFires, loadSnapshot } from "./snapshot";
import {
  recordEvent,
  recordLookup,
  recordReferrer,
  upstreamFailed,
  usageFacts,
  type Caller,
  type UsageFacts,
} from "./metrics";

// The one conditions pipeline every surface runs (the /c page and its .json/.md/.png
// siblings, the kiosk, /embed, the MCP conditions_at tool): load the snapshots, build
// the conditions, name the place. Each surface then records usage once it knows how
// the response was served (recordUsage; MCP tool calls in mcptools).

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
  /** A named place owns its label (so /c/bengaluru reads "Bengaluru", not a ward). */
  label?: string;
  /** Snapshot reads already started for this request (conditionsData). */
  data?: ConditionsData;
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

/** Builds the conditions and the usage facts to record for them (kept with an
 *  edge-cached copy so a cache hit records the same). Upstreams that failed or timed
 *  out are counted here, once per build (a cache hit built nothing). */
export async function lookupConditions(
  env: Env,
  ctx: ExecutionContext,
  q: LookupInput,
): Promise<{ conditions: Conditions; usage: UsageFacts }> {
  const d = q.data ?? conditionsData(env);
  let conditions: Conditions;
  try {
    conditions = await buildConditions(d.snapshot, q.lat, q.lon, d.fires);
  } catch (e) {
    // Only the R2 reads can reject here: the weather and warning calls report failure.
    ctx.waitUntil(upstreamFailed(env, ["r2"]));
    throw e;
  }
  if (conditions.degraded) ctx.waitUntil(upstreamFailed(env, conditions.degraded));
  if (q.label) conditions.place = q.label;
  return { conditions, usage: usageFacts(conditions, q.persona) };
}

/** Usage for one lookup served on the web: the place heatmap (D1), the adopter (D1)
 *  and the anonymous behaviour event (Analytics Engine). All best-effort, off the
 *  response path. `served` says how (edge.ts): built (with its time) or a cache hit. */
export function recordUsage(
  env: Env,
  ctx: ExecutionContext,
  u: UsageFacts,
  q: { fmt: LookupFormat; caller: Caller; req: Request; url: URL; served?: Served },
): void {
  // A kiosk is one persistent display refreshing itself, not demand: keep it out of
  // the D1 place heatmap (and its write budget). The event still counts it, with the
  // browser flag that tells a real screen from a bot loading ?kiosk.
  if (q.fmt !== "kiosk") ctx.waitUntil(recordLookup(env, u, q.fmt, q.caller));
  const surface = REFERRER_SURFACE[q.fmt];
  if (surface) ctx.waitUntil(recordReferrer(env, surface, q.req, q.url));
  recordEvent(env, u, { format: q.fmt, caller: q.caller, ...q.served });
}
