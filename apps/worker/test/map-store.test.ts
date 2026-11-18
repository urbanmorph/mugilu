import { test } from "node:test";
import assert from "node:assert/strict";
import { MAP_KEY, loadMap, writeMap } from "../src/indiamap";
import { testWorker } from "./helpers/worker";

test("writeMap stores the composed map once, and skips an unchanged rewrite", async () => {
  const { env } = testWorker();
  const puts: string[] = [];
  const put = env.OAQ_R2.put.bind(env.OAQ_R2);
  env.OAQ_R2.put = (async (k: string, ...rest: unknown[]) => {
    puts.push(k);
    return (put as (...a: unknown[]) => unknown)(k, ...rest);
  }) as typeof env.OAQ_R2.put;
  const first = await writeMap(env);
  assert.equal(first, "written");
  const stored = JSON.parse(await (await env.OAQ_R2.get(MAP_KEY))!.text());
  assert.ok(stored.cells.length > 0 && stored.dots.length > 0 && stored.generated_at && stored.hash);
  assert.equal(await writeMap(env), "unchanged");
  assert.deepEqual(
    puts.filter((k) => k === MAP_KEY),
    [MAP_KEY],
  );
});

test("loadMap reads the stored map, and says when it had to compose one instead", async () => {
  const { env } = testWorker();
  const composed = await loadMap(env);
  assert.equal(composed.stored, false);
  assert.ok(composed.map?.cells.length);
  await writeMap(env);
  const read = await loadMap(env);
  assert.equal(read.stored, true);
  assert.equal(JSON.stringify(read.map?.cells), JSON.stringify(composed.map?.cells));
});
