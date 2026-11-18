import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveQuery } from "../src/resolve";

// resolveQuery is the one resolver behind /go?q= and the MCP conditions_at tool.
test("resolveQuery (/go?q=, conditions_at): the 24 Parganas districts by their common names reach their slugs", async () => {
  for (const [q, slug] of [
    ["north 24 parganas", "24-paraganas-north"],
    ["North 24-Parganas", "24-paraganas-north"],
    ["24 Parganas North", "24-paraganas-north"],
    ["south 24 parganas", "24-paraganas-south"],
    ["24 Parganas South", "24-paraganas-south"],
  ]) {
    const r = await resolveQuery(q);
    assert.equal(r?.slug, slug, q);
  }
  assert.equal((await resolveQuery("North 24 Parganas"))?.label, "24 Paraganas North, West Bengal");
});
