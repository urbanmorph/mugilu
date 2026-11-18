import { test } from "node:test";
import assert from "node:assert/strict";
import { handleMcp } from "../src/mcp";
import { TOOLS } from "../src/mcptools";
import { renderMcpPage } from "../src/page";
import type { Env } from "../src/index";

const env = {} as Env;
const ctx = { waitUntil() {} } as unknown as ExecutionContext;
const get = (accept?: string) =>
  handleMcp(new Request("https://mugilu.live/mcp", { method: "GET", headers: accept ? { accept } : {} }), env, ctx);

test("/mcp in a browser: a page on how to connect, not a bare 405 (the about page links it)", async () => {
  const res = await get("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /^text\/html/);
  assert.match(await res.text(), /<h1[^>]*>[^<]*MCP/);
});

test("/mcp GET from an MCP client (no text/html) stays 405: the server is stateless, POST only", async () => {
  assert.equal((await get()).status, 405);
  assert.equal((await get("text/event-stream")).status, 405);
  assert.equal((await get("application/json, text/event-stream")).status, 405);
});

test("renderMcpPage: the endpoint, setup for Claude and Claude Code, every tool, canonical and WebAPI data", () => {
  const html = renderMcpPage();
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<title>MCP server for AI assistants: mugilu<\/title>/);
  assert.match(html, /https:\/\/mugilu\.live\/mcp/);
  assert.match(html, /claude mcp add --transport http mugilu https:\/\/mugilu\.live\/mcp/);
  for (const tool of TOOLS) assert.ok(html.includes(`<code>${tool.name}</code>`), tool.name);
  // each tool a card: its name, then its description as a whole phrase, not one cut off at a bracket
  assert.match(
    html,
    /<code>nearest_stations<\/code><\/p><p>The nearest real \(measured\) air-quality monitoring stations to a place/,
  );
  assert.match(
    html,
    /<code>national_now<\/code><\/p><p>The national picture right now: the worst-air, hottest, and dustiest spots in India\./,
  );
  assert.match(html, /<link rel="canonical" href="https:\/\/mugilu\.live\/mcp">/);
  assert.match(html, /"@type":"WebAPI"/);
  assert.match(html, /href="\/llms\.txt"/);
  assert.match(html, /href="\/\.well-known\/mcp\.json"/);
  assert.match(html, /not for medical/i);
});
