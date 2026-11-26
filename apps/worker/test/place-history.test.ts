import { test } from "node:test";
import assert from "node:assert/strict";
import { testWorker } from "./helpers/worker";
import { handleMcp } from "../src/mcp";
import { placeBySlug } from "../src/slugs";
import { trendKey, PLACE_DAILY_START, type PlaceTrend } from "../src/placedaily";

// The daily record the trends page shows, for agents: a place_history MCP tool and
// /c/<slug>/trends.json. Asked 26 Nov 2026: an agent read "mugilu only gives current
// conditions" because nothing outside the page said the record exists.

const DAYS = ["2026-11-23", "2026-11-24", "2026-11-25"];
const delhi = placeBySlug("delhi")!;
const TREND: Omit<PlaceTrend, "days"> = {
  air: [250, 420, null],
  fires: [12, 30, 8],
  feels_max: [27, 26, 25],
  feels_min: [9, 8, 7],
  rain_mm: [0, 0, 0],
  gust_kmh: [14, 20, 18],
  uv_max: [5, 5, 4],
  vis_min_m: [900, 400, 1500],
  dust_max: [40, 60, 30],
  stations: 38,
};

function seeded() {
  const w = testWorker();
  const file = JSON.stringify({ days: DAYS, places: { delhi: TREND } });
  (w.env.OAQ_R2 as any).store.set(trendKey(delhi, 30), file);
  (w.env.OAQ_R2 as any).store.set(trendKey(delhi, 90), file);
  return w;
}

test("placeHistory: each day's figures, each hazard's days at each level, and where it comes from", async () => {
  const { placeHistory } = await import("../src/placehistory");
  const h = placeHistory(delhi, { days: DAYS, ...TREND }, 30);
  assert.equal(h.place.slug, "delhi");
  assert.equal(h.record_starts, PLACE_DAILY_START);
  assert.deepEqual([h.from, h.to], ["2026-11-23", "2026-11-25"]);
  assert.deepEqual(h.days[1], {
    date: "2026-11-24",
    air: 420,
    fires: 30,
    feels_max: 26,
    feels_min: 8,
    rain_mm: 0,
    gust_kmh: 20,
    uv_max: 5,
    vis_min_m: 400,
    dust_max: 60,
  });
  assert.equal(h.days[2].air, null, "no data is null, never 0");
  const air = h.hazards[0];
  assert.equal(air.hazard, "air", "the hazard that reached the highest level most often leads");
  assert.deepEqual(air.days_at_level, { low: 0, moderate: 0, high: 1, severe: 1 });
  assert.equal(air.days_with_data, 2);
  assert.deepEqual(air.peak, { value: 420, date: "2026-11-24" });
  assert.equal(air.kind, "measured");
  assert.match(air.what, /25 km/);
  assert.match(h.attribution, /CPCB/);
  assert.match(h.attribution, /Open-Meteo/);
  assert.match(h.attribution, /FIRMS/);
  assert.ok(h.disclaimer.length > 20);
});

test("/c/<slug>/trends.json: the same record, 30 days by default, 7 or 90 asked", async () => {
  const w = seeded();
  const res = await w.get("/c/delhi/trends.json");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /application\/json/);
  const j = (await res.json()) as any;
  assert.equal(j.place.slug, "delhi");
  assert.equal(j.span_days, 30);
  assert.equal(j.days.length, 3);
  const seven = (await (await w.get("/c/delhi/trends.json?days=7")).json()) as any;
  assert.equal(seven.span_days, 7);
  assert.equal((await w.get("/c/nowhere-at-all/trends.json")).status, 404);
});

async function tool(env: any, args: Record<string, unknown>) {
  const req = new Request("https://mugilu.live/mcp", {
    method: "POST",
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "place_history", arguments: args },
    }),
    headers: { "content-type": "application/json" },
  });
  const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;
  return ((await (await handleMcp(req, env, ctx)).json()) as any).result;
}

test("place_history (MCP): a named place's days, said in short, with the full record structured", async () => {
  const w = seeded();
  const r = await tool(w.env, { place: "Delhi", days: 30 });
  assert.notEqual(r.isError, true);
  assert.equal(r.structuredContent.place.slug, "delhi");
  assert.match(r.content[0].text, /Delhi, last 30 days/);
  assert.match(r.content[0].text, /Air: 1 day severe, 1 high \(of 2\); peak AQI 420 on 2026-11-24\./);
  assert.match(r.content[0].text, /Cold: .*peak 7 °C/);
  assert.match(r.content[0].text, /record starts 22 Aug 2026/i);
  // A point borrows the nearest named place's record, within 25 km, and says so.
  const pt = await tool(w.env, { place: "28.65,77.25" });
  assert.equal(pt.structuredContent.place.slug, "delhi");
  assert.ok(pt.structuredContent.borrowed_km < 25);
  // Outside India, and far from any named place.
  assert.match((await tool(w.env, { place: "27.7172,85.324" })).content[0].text, /outside India/);
});

test("the MCP tells agents the history exists", async () => {
  const { INSTRUCTIONS } = await import("../src/mcp");
  const { TOOLS } = await import("../src/mcptools");
  assert.match(INSTRUCTIONS, /place_history/);
  const c = TOOLS.find((t) => t.name === "conditions_at")!;
  assert.match(c.description, /place_history/);
  const h = TOOLS.find((t) => t.name === "place_history")!;
  assert.match(h.description, /22 Aug 2026/);
  assert.match(h.description, /90 days/);
});
