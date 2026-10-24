// Workers Logs keep only what the code prints (scrubbed, see logs.test.ts), never an
// automatic per-request log: that would store every request URL, typed searches
// (/go?q=, /suggest?q=) and exact coordinates included.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const toml = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");

/** The `key = value` lines of one [table], comments dropped. */
function table(name: string): Record<string, string> {
  const out: Record<string, string> = {};
  let inside = false;
  for (const raw of toml.split("\n")) {
    const line = raw.replace(/#.*$/, "").trim();
    if (/^\[.*\]$/.test(line)) {
      inside = line === `[${name}]`;
      continue;
    }
    const m = inside && line.match(/^([a-z_]+)\s*=\s*(.+)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

test("wrangler.toml: Workers Logs keep console output only, never invocation (request) logs", () => {
  assert.equal(table("observability").enabled, "true");
  assert.equal(table("observability.logs").invocation_logs, "false");
  // no tracing either: spans carry the request URL too
  assert.notEqual(table("observability.traces").enabled, "true");
});

test("wrangler.toml: the observability keys are ones this wrangler version knows", () => {
  const schema = JSON.parse(
    readFileSync(new URL("../node_modules/wrangler/config-schema.json", import.meta.url), "utf8"),
  );
  const obs = schema.definitions.Observability.properties;
  for (const k of Object.keys(table("observability"))) assert.ok(k in obs, `[observability] ${k}`);
  for (const k of Object.keys(table("observability.logs")))
    assert.ok(k in obs.logs.properties, `[observability.logs] ${k}`);
});
