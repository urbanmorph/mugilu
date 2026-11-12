// /health/archives: when the newest file of each R2 archive was written, so ops can tell when a record that
// can never be refilled stops growing. Reads only the listings of today's and yesterday's folders (UTC).
import { test } from "node:test";
import assert from "node:assert/strict";
import { archiveHealth } from "../src/archives";

function bucket(keys: string[]) {
  const asked: string[] = [];
  return {
    asked,
    list: async ({ prefix }: { prefix: string }) => {
      asked.push(prefix);
      return { objects: keys.filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false };
    },
  };
}
const NOW = Date.parse("2026-11-12T09:20:00Z");

test("the newest file of each archive, and how old it is", async () => {
  const b = bucket([
    "archive/air/2026-11-12/07.json.gz",
    "archive/air/2026-11-12/09.json.gz",
    "archive/air/2026-11-11/23.json.gz",
    "archive/conditions/2026-11-12/08.json.gz",
    "archive/conditions/2026-11-12/04.json.gz",
  ]);
  assert.deepEqual(await archiveHealth(b as never, NOW), {
    checked_at: "2026-11-12T09:20:00.000Z",
    air: { latest: "2026-11-12T09:00:00Z", age_hours: 0.3 },
    conditions: { latest: "2026-11-12T08:00:00Z", age_hours: 1.3 },
  });
});

test("just after midnight the newest file is in yesterday's folder", async () => {
  const b = bucket(["archive/conditions/2026-11-11/20.json.gz", "archive/air/2026-11-12/00.json.gz"]);
  const h = await archiveHealth(b as never, Date.parse("2026-11-12T00:30:00Z"));
  assert.equal(h.conditions.latest, "2026-11-11T20:00:00Z");
  assert.equal(h.conditions.age_hours, 4.5);
});

test("an archive with nothing in two days says so", async () => {
  const b = bucket([]);
  const h = await archiveHealth(b as never, NOW);
  assert.deepEqual(h.air, { latest: null, age_hours: null });
  assert.deepEqual(b.asked.sort(), [
    "archive/air/2026-11-11/",
    "archive/air/2026-11-12/",
    "archive/conditions/2026-11-11/",
    "archive/conditions/2026-11-12/",
  ]);
});
