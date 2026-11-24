import { test } from "node:test";
import assert from "node:assert/strict";
import { testWorker } from "./helpers/worker";

// A station's JSON, Markdown and share image read the latest snapshot: 503 before the first one,
// 404 for a station not in it (one helper in index.ts, W17).

test("station routes: found, unknown (404) and no snapshot yet (503), for JSON, Markdown and the image", async () => {
  const w = testWorker();
  const json = await w.get("/s/cpcb/100413.json");
  assert.equal(json.status, 200);
  assert.equal((await json.json()).station.raw_id, "100413");
  for (const path of ["/s/cpcb/nope.json", "/s/cpcb/nope.md", "/og/s/cpcb/nope.png"]) {
    const r = await w.get(path);
    assert.equal(r.status, 404, path);
    assert.equal(await r.text(), "station not found", path);
  }
  // A fresh worker (the snapshot is held in memory per R2 binding), its snapshot never written.
  const empty = testWorker();
  (empty.env.OAQ_R2 as unknown as { store: Map<string, unknown> }).store.delete("data/latest.json");
  for (const path of ["/s/cpcb/100413.json", "/s/cpcb/100413.md", "/og/s/cpcb/100413.png", "/index.json"]) {
    const r = await empty.get(path);
    assert.equal(r.status, 503, path);
    assert.equal(await r.text(), "no snapshot yet", path);
  }
});
