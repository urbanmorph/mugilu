import { test } from "node:test";
import assert from "node:assert/strict";
import { inForce, renderWarningsMarkdown, type WarningsSnapshot } from "../src/sachet";
import { renderWarningsPage } from "../src/pages/warnings";
import type { IndiaMap } from "../src/indiamap";

// SACHET's national feed is its last 100 alerts, ended or not (four days of them, some days).
// Only the alerts still in force are "now": each alert's end comes from its CAP file, which the
// hourly map carries for every alert in the feed (map.ends).

const alert = (id: string, headline: string) => ({
  identifier: id,
  headline,
  category: "Met",
  issuer: "controlroom@ndma.gov.in (IMD Bhubaneswar)",
  link: "",
  sent: "Sun, 22 Nov 2026 01:08:14 GMT",
});
const SNAP: WarningsSnapshot = {
  generated_at: "2026-11-22T02:05:00.000Z",
  count: 3,
  alerts: [alert("1", "Rain over Puri."), alert("2", "Rain over Khordha."), alert("3", "Rain over Cuttack.")],
};
const MAP = {
  cells: [],
  dots: [],
  cyclones: [],
  ends: { "1": "2026-11-22T12:00:00.000Z", "2": "2026-11-22T06:00:00.000Z" },
} as IndiaMap;
const NOW = Date.parse("2026-11-22T09:00:00Z");
const text = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

test("inForce: an alert past its end is dropped; one whose end is unknown stays; each carries its end", () => {
  const now = inForce(SNAP, MAP, NOW)!;
  assert.deepEqual(
    now.alerts.map((a) => a.identifier),
    ["1", "3"],
  );
  assert.equal(now.count, 2);
  assert.equal(now.alerts[0].expires, "2026-11-22T12:00:00.000Z");
  assert.equal(now.alerts[1].expires, undefined);
  assert.equal(now.generated_at, SNAP.generated_at);
});

test("inForce: no ends known (no map) leaves the feed as it is; no feed stays none", () => {
  assert.equal(inForce(SNAP, undefined, NOW), SNAP);
  assert.equal(inForce(null, MAP, NOW), null);
});

test("/warnings: only the alerts in force, each with until when", () => {
  const s = text(renderWarningsPage(inForce(SNAP, MAP, NOW), "en", MAP, NOW));
  assert.match(s, /over Puri/);
  assert.doesNotMatch(s, /over Khordha/);
  assert.match(s, /until 17:30/);
  assert.match(text(renderWarningsPage(inForce(SNAP, MAP, NOW), "hi", MAP, NOW)), /17:30 IST · 22 Nov तक/);
  assert.doesNotMatch(renderWarningsMarkdown(inForce(SNAP, MAP, NOW)), /Khordha/);
  assert.match(renderWarningsMarkdown(inForce(SNAP, MAP, NOW)), /- Until: 2026-11-22T12:00:00.000Z/);
});
