import { test } from "node:test";
import assert from "node:assert/strict";
import { callTool } from "../src/mcptools";
import type { Env } from "../src/index";

// The place lookup (gazetteer) and the data the tool needs next (snapshot, fires)
// are independent R2 reads: the second must not wait for the first.
test("conditions_at / nearest_stations: the snapshot read starts while the place resolves", async () => {
  for (const tool of ["conditions_at", "nearest_stations"]) {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const startedBeforeGaz: string[] = [];
    let gazDone = false;
    const env = {
      OAQ_R2: {
        get: async (key: string) => {
          if (key.includes("gazetteer")) {
            await gate;
            gazDone = true;
          } else if (!gazDone) startedBeforeGaz.push(key);
          return null;
        },
      },
    } as unknown as Env;
    const real = globalThis.fetch;
    globalThis.fetch = (async () => Response.json({ current: {} })) as unknown as typeof fetch;
    try {
      const p = callTool(tool, { place: "12.97,77.59" }, env, { waitUntil() {} } as unknown as ExecutionContext, null);
      await new Promise((r) => setTimeout(r, 10));
      release();
      await p;
    } finally {
      globalThis.fetch = real;
    }
    assert.ok(startedBeforeGaz.includes("data/latest.json"), `${tool}: ${startedBeforeGaz}`);
  }
});
