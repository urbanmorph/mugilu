import type { Env } from "./index";
import { recordMcpClient } from "./metrics";
import { TOOLS, callTool } from "./mcptools";
import { RESOURCES, readResource, PROMPTS, getPrompt } from "./mcpcontent";

// mugilu's MCP server — a hand-rolled JSON-RPC 2.0 endpoint over Streamable HTTP
// (MCP 2025-06-18), stateless (fits Workers). Phase 1: the skeleton — initialize,
// ping, capability declaration, client capture. Tools/resources/prompts follow.

const PROTOCOL_VERSION = "2025-06-18";
const SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

const SERVER_INFO = { name: "mugilu", version: "1", title: "mugilu — the open sky of India" };

// Single source of truth for how an agent should understand + credit mugilu. This
// rides the initialize handshake so the scope, the limits, and the attribution
// reach the model before any tool is called (the "humans in the loop" commitment).
export const INSTRUCTIONS = `mugilu — the open sky of India. Give any place in India and get what the sky is doing to you right now: air quality (CPCB AQI + the pollutant breakdown + AQLI years-of-life-lost), heat (temperature, feels-like, wet-bulb, WBGT), cold, wind, fog and visibility, dust, fire/crop-burn smoke (NASA FIRMS), UV, and any official NDMA/IMD warning over that spot — plus an "Ambient" read that names the single worst hazard for you in plain words.

Scope and limits: India only. Readings are CURRENT, not a forecast. Informational only — not for medical, emergency, or safety-critical decisions; for official hazard warnings, NDMA and IMD are the authoritative channels.

For a vulnerable person: pass persona (one of asthma, elderly, child, outdoor, heart) to weight the Ambient read for who is actually affected — e.g. an asthmatic sees poor air rank above heat.

Attribution: every response carries "attribution" and "disclaimer" fields — please surface them. Data: air from CPCB / Airnet (CSTEP) / Aurassure via the OAQ broker plus OpenAQ; weather, heat, UV, dust and wind from Open-Meteo (CC-BY 4.0); warnings from NDMA/IMD (SACHET); smoke from NASA FIRMS; life-expectancy impact from the AQLI methodology. Code is MIT; each source keeps its own licence.

Tools: use conditions_at for the sky at a place (by name or coordinate); search_place to disambiguate a name; nearest_stations to see how close real measurement is; active_warnings for official alerts; national_now for the worst-air or hottest picture across India.

Composing with geography: mugilu tells you what the sky is doing — it does not resolve sub-city wards, hospitals, forests, rivers, highways, or administrative/zone boundaries. For those, pair mugilu with the bharatlas MCP (India's open geo data): let bharatlas find the place or feature and its coordinate, then ask mugilu for the sky over it.`;

// JSON-RPC 2.0 error codes
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, mcp-session-id, mcp-protocol-version, authorization",
};

type Id = string | number | null;
const ok = (id: Id, result: unknown) => rpc({ jsonrpc: "2.0", id, result });
const err = (id: Id, code: number, message: string) => rpc({ jsonrpc: "2.0", id, error: { code, message } });
function rpc(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS },
  });
}

/** The /mcp endpoint. POST a single JSON-RPC request; get a single JSON response.
 *  Stateless: no session id, no server-initiated stream (so GET is not offered). */
export async function handleMcp(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST")
    return new Response("Method Not Allowed", { status: 405, headers: { allow: "POST, OPTIONS" } });

  let msg: { jsonrpc?: string; id?: Id; method?: string; params?: Record<string, unknown> };
  try {
    msg = (await req.json()) as typeof msg;
  } catch {
    return err(null, PARSE_ERROR, "Parse error");
  }
  if (Array.isArray(msg)) return err(null, INVALID_REQUEST, "Batched requests are not supported");
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string")
    return err(msg?.id ?? null, INVALID_REQUEST, "Invalid Request");

  const { id, method, params = {} } = msg;
  // Notifications (no id) — accept and acknowledge with 202, no body.
  if (id === undefined) return new Response(null, { status: 202, headers: CORS });

  try {
    switch (method) {
      case "initialize":
        return ok(id, initialize(params, env, ctx));
      case "ping":
        return ok(id, {});
      case "tools/list":
        return ok(id, { tools: TOOLS });
      case "tools/call": {
        const name = typeof params.name === "string" ? params.name : "";
        const args = (params.arguments as Record<string, unknown>) ?? {};
        try {
          const result = await callTool(name, args, env, ctx, req.headers.get("user-agent"));
          if (!result) return err(id, INVALID_PARAMS, `Unknown tool: ${name}`);
          return ok(id, result);
        } catch {
          // A tool that ran-and-failed (e.g. a data-source blip) returns a result
          // with isError so the model sees it and can react — not a protocol error
          // (which clients surface as a hard transport fault).
          const text = `The ${name} tool failed — a data source may be temporarily unavailable. Try again shortly.`;
          return ok(id, { content: [{ type: "text", text }], isError: true });
        }
      }
      case "resources/list":
        return ok(id, { resources: RESOURCES });
      case "resources/read": {
        const uri = typeof params.uri === "string" ? params.uri : "";
        const res = readResource(uri);
        return res ? ok(id, res) : err(id, INVALID_PARAMS, `Unknown resource: ${uri}`);
      }
      case "prompts/list":
        return ok(id, { prompts: PROMPTS });
      case "prompts/get": {
        const name = typeof params.name === "string" ? params.name : "";
        const got = getPrompt(name, (params.arguments as Record<string, unknown>) ?? {});
        return got ? ok(id, got) : err(id, INVALID_PARAMS, `Unknown prompt: ${name}`);
      }
      default:
        return err(id, METHOD_NOT_FOUND, `Method not found: ${method}`);
    }
  } catch {
    return err(id, INTERNAL_ERROR, "Internal error");
  }
}

function initialize(params: Record<string, unknown>, env: Env, ctx: ExecutionContext) {
  // Adoption metric: record which client connected (name only, like ?ref=).
  const client = params.clientInfo as { name?: string; version?: string } | undefined;
  if (client?.name) ctx.waitUntil(recordMcpClient(env, client.name));
  // Echo the client's protocol version if we support it, else our latest.
  const requested = params.protocolVersion as string | undefined;
  const protocolVersion = requested && SUPPORTED_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSION;
  return {
    protocolVersion,
    capabilities: { tools: {}, resources: {}, prompts: {} },
    serverInfo: SERVER_INFO,
    instructions: INSTRUCTIONS,
  };
}
