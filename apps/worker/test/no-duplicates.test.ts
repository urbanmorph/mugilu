import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { repeatedBlocks, type Source } from "./helpers/duplicates";

// No block of code is written twice in src: a repeat becomes a shared helper (W17). The scan
// is the one from the 24 Nov cleanup audit. A deliberate repeat goes in ALLOWED, with a reason.

const ALLOWED: string[] = [];

function sources(dir: string): Source[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return name.endsWith(".ts") ? [{ path, text: readFileSync(path, "utf8") }] : [];
  });
}

test("src: no block of code is repeated (make it a helper)", () => {
  const src = sources(new URL("../src", import.meta.url).pathname).map((f) => ({
    ...f,
    path: f.path.slice(f.path.indexOf("src/")),
  }));
  const repeats = repeatedBlocks(src).filter((at) => !at.some((x) => ALLOWED.includes(x)));
  assert.deepEqual(repeats, []);
});

const body = (name: string) => `export function ${name}(env: Env) {
  const snap = await loadSnapshot(env);
  if (!snap) return new Response("no snapshot yet", { status: 503 });
  const station = snap.stations.find((s) => s.provider === provider && s.raw_id === rawId);
  if (!station) return new Response("station not found", { status: 404 });
  return station;
}`;

test("repeatedBlocks: a planted copy is caught, once, at both places", () => {
  const found = repeatedBlocks([
    { path: "a.ts", text: body("one") },
    { path: "b.ts", text: `const x = 1;\n${body("two")}` },
  ]);
  assert.deepEqual(found, [["a.ts:2", "b.ts:3"]]);
});

test("repeatedBlocks: comments, imports and short lines are not code to repeat", () => {
  const notes = `// The same long explanatory comment line, written out in two separate files here.
// The same long explanatory comment line, written out in two separate files again.
import { something, somethingElse, andAnother } from "./a-module-with-a-long-name";
import { anotherThing, yetAnotherThing } from "./another-module-with-a-long-name";
}
)`;
  assert.deepEqual(
    repeatedBlocks([
      { path: "a.ts", text: notes },
      { path: "b.ts", text: notes },
    ]),
    [],
  );
});
