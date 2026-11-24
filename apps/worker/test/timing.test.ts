import { test } from "node:test";
import assert from "node:assert/strict";
import { Timings } from "../src/timing";
import { testWorker } from "./helpers/worker";

// W5 (supporting-docs/platform-audit-tracker-2026-11-24.md): how long each load holds up a
// place page that was not in the edge cache, as Server-Timing and one Workers Logs line.

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("Timings: each load's finish time since the build began; results and failures pass through", async () => {
  const tm = new Timings();
  const a = await tm.track(
    "fast",
    wait(5).then(() => 1),
  );
  await assert.rejects(
    tm.track(
      "broken",
      wait(15).then(() => Promise.reject(new Error("x"))),
    ),
  );
  tm.mark("render");
  assert.equal(a, 1);
  const line = tm.line();
  assert.deepEqual(Object.keys(line), ["fast", "broken", "render"]);
  assert.ok(line.fast >= 4 && line.broken >= line.fast && line.render >= line.broken, JSON.stringify(line));
  assert.match(tm.header("MRS"), /^fast;dur=\d+, broken;dur=\d+;desc="failed", render;dur=\d+, edge;desc="MRS"$/);
});

test("Timings: a value that is not a promise is noted at once", async () => {
  const tm = new Timings();
  assert.equal(await tm.track("none", null), null);
  assert.ok(tm.line().none >= 0);
});

test("place page: a built page says how long each load took, and logs it once", async () => {
  const w = testWorker();
  const logs: string[] = [];
  const log = console.log;
  console.log = (...a: unknown[]) => void logs.push(a.join(" "));
  try {
    const first = (await w.get("/c/delhi")).headers.get("server-timing") ?? "";
    for (const name of ["snapshot", "fires", "open-meteo", "sachet", "trend", "history", "render"])
      assert.match(first, new RegExp(`(^|, )${name};dur=\\d+`), `${name} in: ${first}`);
    // The test worker's edge cache never hits; a hit is tested in edge.test.ts.
    assert.match(first, /cache;desc="miss"/);
  } finally {
    console.log = log;
  }
  const line = logs.find((l) => l.startsWith("[timing] "));
  assert.ok(line, "one log line for the built page");
  const facts = JSON.parse(line!.slice("[timing] ".length));
  assert.equal(facts.path, "/c/delhi");
  assert.equal(typeof facts["open-meteo"], "number");
});
