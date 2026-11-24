import { test } from "node:test";
import assert from "node:assert/strict";
import { TOOLS } from "../src/mcptools";

// W24: a reviewer found no "today's high against the normal" in mugilu's answers; it was there,
// in `heat_vs_normal` and in the temperature sentence. The tool description now says where.

test("conditions_at says where the normal comparison is: the field, its flag and the sentence", () => {
  const d = TOOLS.find((t) => t.name === "conditions_at")!.description;
  assert.match(d, /`heat_vs_normal`/);
  assert.match(d, /`notable`/);
  assert.match(d, /`text\.readings\.temp`/);
  assert.doesNotMatch(d, /Separately, where it stands out/, "it is in every answer that has a normal");
});
