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

test("mcp skeleton: tools/resources/prompts lists are present but empty (filled in later phases)", async () => {
  for (const [m, key] of [
    ["tools/list", "tools"],
    ["resources/list", "resources"],
    ["prompts/list", "prompts"],
  ]) {
    const j = (await (await call({ jsonrpc: "2.0", id: 9, method: m })).json()) as any;
    assert.deepEqual(j.result[key], []);
  }
});
