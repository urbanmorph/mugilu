import { test } from "node:test";
import assert from "node:assert/strict";
import { openApiSpec, llmsTxt } from "../src/meta";

test("openApiSpec: a valid 3.1 spec covering the read endpoints", () => {
  const s = openApiSpec("https://mugilu.live") as any;
  assert.equal(s.openapi, "3.1.0");
  assert.equal(s.servers[0].url, "https://mugilu.live");
  assert.equal(s.paths["/c/{coord}.json"].get.operationId, "conditionsAt");
  assert.ok(s.paths["/near"] && s.paths["/suggest"] && s.paths["/warnings.json"] && s.paths["/index.json"]);
  const params = s.paths["/c/{coord}.json"].get.parameters.map((p: any) => p.name);
  assert.ok(params.includes("coord") && params.includes("as") && params.includes("ref"));
});

test("llms.txt: advertises the MCP server + the OpenAPI spec", () => {
  const t = llmsTxt("https://mugilu.live");
  assert.match(t, /MCP server.*\/mcp/);
  assert.match(t, /openapi\.json/);
});
