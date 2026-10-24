import type { Env } from "./index";
import type { NormalizedStation } from "./types";
import { renderConditionsMarkdown, serializeConditionsV1 } from "./conditions";
import { conditionsData, lookupConditions } from "./lookup";
import { bump, recordEvent, recordLookup, type Caller, type UsageFacts } from "./metrics";
import { parsePersona } from "./score";
import { buildSuggestions } from "./suggest";
import { geocodeList } from "./geocode";
import { findNearest } from "./near";
import { composeHighlights } from "./highlights";
import { resolveQuery } from "./resolve";
import { loadGazetteer } from "./gazetteer";
import { loadSnapshot, loadWarningsSnapshot } from "./snapshot";

// The MCP tool surface (Phase 2). Each tool is a thin adapter over an existing
// internal function, no new data logic. Read-only; all live/India-only.

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: unknown;
  isError?: boolean;
}

const PERSONA_ENUM = ["everyone", "asthma", "elderly", "child", "outdoor", "heart"];
const READ_ONLY = { readOnlyHint: true, openWorldHint: true, idempotentHint: true } as const;

export const TOOLS = [
  {
    name: "conditions_at",
    description:
      "What the sky is doing at a place in India RIGHT NOW (not a forecast): air quality (CPCB AQI + pollutants + AQLI years-of-life-lost), heat (feels-like, wet-bulb, WBGT), cold, wind, fog/visibility, dust, fire-smoke, UV, and any official NDMA warning over that spot, plus an Ambient read naming the single worst hazard. Pass `persona` to weight it for a vulnerable person. To target a specific ward, hospital, forest, river or boundary, resolve it with a geo source (e.g. the bharatlas MCP) first, then pass the coordinate here. Surface the returned `attribution` and `disclaimer`.",
    inputSchema: {
      type: "object",
      properties: {
        place: {
          type: "string",
          description: 'A place in India: a name ("Bengaluru", "Indiranagar") or a coordinate "lat,lon".',
        },
        persona: {
          type: "string",
          enum: PERSONA_ENUM,
          description: "Weight the read for who is affected (default everyone).",
        },
      },
      required: ["place"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "search_place",
    description:
      "Resolve an Indian place name to candidates (name, detail, coordinate). Use to disambiguate before conditions_at. Covers cities, districts and air-monitoring stations. For sub-city wards, hospitals, forests, rivers or boundaries, use a geo source like the bharatlas MCP instead.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "A place name or partial name in India." } },
      required: ["query"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "nearest_stations",
    description:
      "The nearest real (measured) air-quality monitoring stations to a place, with distance and current AQI. Use to judge how close hard measurement is. Conditions can be modelled when no station is near.",
    inputSchema: {
      type: "object",
      properties: {
        place: { type: "string", description: 'A place name or "lat,lon" in India.' },
        n: { type: "integer", minimum: 1, maximum: 20, description: "How many stations (default 5)." },
      },
      required: ["place"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "active_warnings",
    description:
      "Official NDMA/IMD hazard warnings currently active across India (the authoritative channel). Optionally filter by a region/state name (matched against the headline).",
    inputSchema: {
      type: "object",
      properties: { region: { type: "string", description: "Optional state/region name to filter by." } },
    },
    annotations: READ_ONLY,
  },
  {
    name: "national_now",
    description:
      "The national picture right now: the worst-air, hottest, and dustiest spots in India. Filter with `kind` (air | heat | dust).",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["all", "air", "heat", "dust"], description: "Which leaderboard (default all)." },
      },
    },
    annotations: READ_ONLY,
  },
];

function err(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}
function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function listText<T>(items: T[], fmt: (x: T) => string, empty: string): string {
  return items.length ? items.map(fmt).join("\n") : empty;
}

async function conditionsAt(
  args: Record<string, unknown>,
  env: Env,
  ctx: ExecutionContext,
  onUsage: (u: UsageFacts) => void,
): Promise<ToolResult> {
  const place = str(args.place);
  if (!place) return err('`place` is required (a name or "lat,lon").');
  const persona = parsePersona(str(args.persona) || null);
  const data = conditionsData(env); // the lookup below needs them: read while we resolve
  const loc = await resolveQuery(place, await loadGazetteer(env));
  if (!loc) return err(`Could not find a place in India matching "${place}". Try search_place first.`);
  // A named place owns its label (parity with /c/{slug}).
  const { conditions, usage } = await lookupConditions(env, ctx, {
    lat: loc.lat,
    lon: loc.lon,
    persona,
    fmt: "mcp",
    label: loc.label,
    data,
  });
  onUsage(usage);
  return {
    content: [{ type: "text", text: renderConditionsMarkdown(conditions, persona) }],
    structuredContent: serializeConditionsV1(conditions, persona),
  };
}

async function searchPlace(args: Record<string, unknown>, env: Env): Promise<ToolResult> {
  const q = str(args.query);
  if (!q) return err("`query` is required.");
  const [snap, gaz] = await Promise.all([loadSnapshot(env), loadGazetteer(env)]);
  const hits = await buildSuggestions(snap?.stations ?? [], q, geocodeList, 8, gaz);
  const places = hits.map((s) => ({ name: s.label, detail: s.sublabel ?? null, lat: s.lat, lon: s.lon, kind: s.kind }));
  const text = listText(
    places,
    (p) => `- ${p.name}${p.detail ? ` (${p.detail})` : ""} - ${p.lat},${p.lon}`,
    `No places found for "${q}".`,
  );
  return { content: [{ type: "text", text }], structuredContent: { places } };
}

async function nearestStations(args: Record<string, unknown>, env: Env): Promise<ToolResult> {
  const place = str(args.place);
  if (!place) return err('`place` is required (a name or "lat,lon").');
  const snapshot = loadSnapshot(env); // read it while we resolve the place
  snapshot.catch(() => {}); // awaited below; this only covers an early return
  const loc = await resolveQuery(place, await loadGazetteer(env));
  if (!loc) return err(`Could not resolve "${place}".`);
  const nRaw = Number(args.n ?? 5);
  const n = Number.isFinite(nRaw) ? Math.min(Math.max(1, Math.trunc(nRaw)), 20) : 5;
  const snap = await snapshot;
  if (!snap) return err("No air snapshot available yet.");
  const stations = findNearest(snap.stations, loc.lat, loc.lon, n);
  const text = listText(
    stations,
    (s: NormalizedStation & { distance_km?: number }) => {
      const d = typeof s.distance_km === "number" ? ` - ${s.distance_km.toFixed(1)} km` : "";
      return `- ${s.name}${s.city ? `, ${s.city}` : ""}${d}, AQI ${s.aqi ?? "n/a"}`;
    },
    "No stations found nearby.",
  );
  return { content: [{ type: "text", text }], structuredContent: { query: loc, count: stations.length, stations } };
}

async function activeWarnings(args: Record<string, unknown>, env: Env): Promise<ToolResult> {
  const region = str(args.region).toLowerCase();
  const snap = await loadWarningsSnapshot(env);
  let alerts = snap?.alerts ?? [];
  if (region) alerts = alerts.filter((a) => `${a.headline} ${a.category} ${a.issuer}`.toLowerCase().includes(region));
  const text = listText(
    alerts,
    (a) => `- [${a.category}] ${a.headline} - ${a.issuer}`,
    region ? `No active warnings matching "${region}".` : "No active warnings nationally.",
  );
  return {
    content: [{ type: "text", text }],
    structuredContent: { generated_at: snap?.generated_at ?? null, count: alerts.length, alerts },
  };
}

async function nationalNow(args: Record<string, unknown>, env: Env): Promise<ToolResult> {
  const kind = str(args.kind) || "all";
  const want = (k: string) => kind === "all" || kind === k;
  const { highlights: h } = await composeHighlights(env);
  const place = (p: { name: string; state?: string }) => `${p.name}${p.state ? `, ${p.state}` : ""}`;
  const out: Record<string, unknown> = {};
  const lines: string[] = [];
  if (want("air") && h.worstAir) {
    out.worstAir = h.worstAir;
    lines.push(`Worst air: ${place(h.worstAir)} - AQI ${h.worstAir.aqi} (${h.worstAir.band})`);
  }
  if (want("heat") && h.hottest) {
    out.hottest = h.hottest;
    lines.push(`Hottest: ${place(h.hottest)} - feels ${Math.round(h.hottest.apparent_c)}°`);
  }
  if (want("dust") && h.dustiest) {
    out.dustiest = h.dustiest;
    lines.push(`Dustiest: ${place(h.dustiest)} - ${Math.round(h.dustiest.dust_ug_m3)} µg/m³`);
  }
  return { content: [{ type: "text", text: lines.join("\n") || "No national snapshot yet." }], structuredContent: out };
}

type Run = (
  args: Record<string, unknown>,
  env: Env,
  ctx: ExecutionContext,
  onUsage: (u: UsageFacts) => void,
) => Promise<ToolResult>;

/** Each tool's handler. Its keys are the only names a usage counter can carry. */
const RUN: Record<string, Run> = {
  conditions_at: conditionsAt,
  search_place: (args, env) => searchPlace(args, env),
  nearest_stations: (args, env) => nearestStations(args, env),
  active_warnings: (args, env) => activeWarnings(args, env),
  national_now: (args, env) => nationalNow(args, env),
};

/** Dispatch a tools/call and record it: a counter per tool and one for errors (D1),
 *  plus one anonymous event naming the tool (with the reading's facts for
 *  conditions_at). Returns undefined for an unknown tool name, which records nothing. */
export async function callTool(
  name: string,
  args: Record<string, unknown>,
  env: Env,
  ctx: ExecutionContext,
  caller: Caller,
): Promise<ToolResult | undefined> {
  if (!Object.hasOwn(RUN, name)) return undefined;
  let usage: UsageFacts | undefined;
  let failed = true; // until the tool returns a result that is not an error
  try {
    const result = await RUN[name](args, env, ctx, (u) => (usage = u));
    failed = !!result.isError;
    return result;
  } finally {
    const counts = { [`mcp:tool:${name}`]: 1, "mcp:err": failed ? 1 : 0 };
    // A reading also counts by client class, in the same write.
    ctx.waitUntil(usage ? recordLookup(env, usage, "mcp", caller, counts) : bump(env, counts));
    recordEvent(env, usage ?? null, { format: "mcp", caller, tool: name });
  }
}
