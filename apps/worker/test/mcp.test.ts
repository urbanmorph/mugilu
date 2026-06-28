import { test } from "node:test";
import assert from "node:assert/strict";
import { handleMcp } from "../src/mcp";
import type { Env } from "../src/index";

const env = {} as Env;
const ctx = { waitUntil() {} } as unknown as ExecutionContext;

function call(body: unknown): Promise<Response> {
  const req = new Request("https://mugilu.live/mcp", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
  return handleMcp(req, env, ctx);
}

test("mcp initialize: protocol version, capabilities, serverInfo, instructions", async () => {
  const res = await call({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test-client", version: "1" } },
  });
  assert.equal(res.status, 200);
  const j = (await res.json()) as any;
  assert.equal(j.jsonrpc, "2.0");
  assert.equal(j.id, 1);
  assert.equal(j.result.protocolVersion, "2025-06-18");
  assert.ok(j.result.capabilities.tools && j.result.capabilities.resources && j.result.capabilities.prompts);
  assert.equal(j.result.serverInfo.name, "mugilu");
  // the instructions carry scope, the persona concept, and the bharatlas nudge
  assert.match(j.result.instructions, /not a forecast/i);
  assert.match(j.result.instructions, /persona/i);
  assert.match(j.result.instructions, /bharatlas/i);
  assert.match(j.result.instructions, /attribution/i);
});

test("mcp initialize: echoes a supported older protocol version", async () => {
  const j = (await (
    await call({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05" } })
  ).json()) as any;
  assert.equal(j.result.protocolVersion, "2024-11-05");
});

test("mcp ping: empty result", async () => {
  const j = (await (await call({ jsonrpc: "2.0", id: 2, method: "ping" })).json()) as any;
  assert.deepEqual(j.result, {});
});

test("mcp notification (no id): accepted with 202, no body", async () => {
  const res = await call({ jsonrpc: "2.0", method: "notifications/initialized" });
  assert.equal(res.status, 202);
});

test("mcp unknown method: JSON-RPC method-not-found (-32601)", async () => {
  const j = (await (await call({ jsonrpc: "2.0", id: 3, method: "does/notexist" })).json()) as any;
  assert.equal(j.error.code, -32601);
});

test("mcp invalid: batch rejected (-32600)", async () => {
  const j = (await (await call([{ jsonrpc: "2.0", id: 1, method: "ping" }])).json()) as any;
  assert.equal(j.error.code, -32600);
});

test("mcp GET: not allowed (stateless, no server-initiated stream)", async () => {
  const res = await handleMcp(new Request("https://mugilu.live/mcp", { method: "GET" }), env, ctx);
  assert.equal(res.status, 405);
});

test("mcp OPTIONS: CORS preflight ok", async () => {
  const res = await handleMcp(new Request("https://mugilu.live/mcp", { method: "OPTIONS" }), env, ctx);
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
});

test("mcp resources/list + read: methodology / license / schema", async () => {
  const list = (await (await call({ jsonrpc: "2.0", id: 20, method: "resources/list" })).json()) as any;
  const uris = list.result.resources.map((r: any) => r.uri).sort();
  assert.deepEqual(uris, ["mugilu://compose", "mugilu://license", "mugilu://methodology", "mugilu://schema"]);
  const read = (await (
    await call({ jsonrpc: "2.0", id: 21, method: "resources/read", params: { uri: "mugilu://methodology" } })
  ).json()) as any;
  assert.equal(read.result.contents[0].uri, "mugilu://methodology");
  assert.match(read.result.contents[0].text, /thresholds/i);
});

test("mcp resources/read: unknown uri → invalid params (-32602)", async () => {
  const j = (await (
    await call({ jsonrpc: "2.0", id: 22, method: "resources/read", params: { uri: "mugilu://nope" } })
  ).json()) as any;
  assert.equal(j.error.code, -32602);
});

test("mcp prompts/list + get: the templated workflow guides the tools", async () => {
  const list = (await (await call({ jsonrpc: "2.0", id: 23, method: "prompts/list" })).json()) as any;
  const names = list.result.prompts.map((p: any) => p.name).sort();
  assert.deepEqual(names, ["safe-to-go-out", "sky-check", "warnings-digest", "worst-air-now"]);
  const got = (await (
    await call({
      jsonrpc: "2.0",
      id: 24,
      method: "prompts/get",
      params: { name: "sky-check", arguments: { place: "Delhi" } },
    })
  ).json()) as any;
  assert.equal(got.result.messages[0].role, "user");
  assert.match(got.result.messages[0].content.text, /Delhi/);
  assert.match(got.result.messages[0].content.text, /conditions_at/);
});

test("mcp prompts/get: unknown prompt → invalid params (-32602)", async () => {
  const j = (await (
    await call({ jsonrpc: "2.0", id: 25, method: "prompts/get", params: { name: "nope", arguments: {} } })
  ).json()) as any;
  assert.equal(j.error.code, -32602);
});

function callEnv(body: unknown, mockEnv: Env): Promise<Response> {
  const req = new Request("https://mugilu.live/mcp", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
  return handleMcp(req, mockEnv, ctx);
}

test("mcp tools/list: the five tools, with schemas + annotations", async () => {
  const j = (await (await call({ jsonrpc: "2.0", id: 10, method: "tools/list" })).json()) as any;
  const names = j.result.tools.map((t: any) => t.name).sort();
  assert.deepEqual(names, ["active_warnings", "conditions_at", "national_now", "nearest_stations", "search_place"]);
  const c = j.result.tools.find((t: any) => t.name === "conditions_at");
  assert.deepEqual(c.inputSchema.required, ["place"]);
  assert.equal(c.annotations.readOnlyHint, true);
  assert.match(c.description, /not a forecast/i);
});

test("mcp tools/call: unknown tool → invalid params (-32602)", async () => {
  const j = (await (
    await call({ jsonrpc: "2.0", id: 11, method: "tools/call", params: { name: "nope", arguments: {} } })
  ).json()) as any;
  assert.equal(j.error.code, -32602);
});

test("mcp tools/call: conditions_at without place → isError result (graceful, not a crash)", async () => {
  const j = (await (
    await call({ jsonrpc: "2.0", id: 12, method: "tools/call", params: { name: "conditions_at", arguments: {} } })
  ).json()) as any;
  assert.equal(j.result.isError, true);
  assert.match(j.result.content[0].text, /place/i);
});

test("mcp tools/call: search_place with a coordinate resolves with no network", async () => {
  const mockEnv = { OAQ_R2: { get: async () => null } } as unknown as Env;
  const j = (await (
    await callEnv(
      {
        jsonrpc: "2.0",
        id: 13,
        method: "tools/call",
        params: { name: "search_place", arguments: { query: "12.97,77.59" } },
      },
      mockEnv,
    )
  ).json()) as any;
  assert.notEqual(j.result.isError, true);
  assert.equal(j.result.structuredContent.places[0].lat, 12.97);
  assert.match(j.result.content[0].text, /12\.97/);
});
