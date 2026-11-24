import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { serializeConditionsV1, renderConditionsMarkdown } from "../src/conditions";
import { renderConditionsPage } from "../src/pages/place";
import { renderStationMarkdown } from "../src/formats";
import { INSTRUCTIONS } from "../src/mcp";
import { TOOLS } from "../src/mcptools";
import { llmsTxt } from "../src/meta";
import type { Conditions, NormalizedStation } from "../src/types";

// W22 (supporting-docs/reports/Fire smoke and life years.md): AQLI's figures "should not be used
// to infer hourly or daily conditions" (aqli-epic/aqli-update README). mugilu no longer turns an
// hourly PM2.5 reading into years of life. The v1 field stays, always null, documented as withdrawn.

const air = {
  aqi: 182,
  band: "moderate",
  pollutants: { pm25: 84.86 },
  yll: 7.83, // an old stored value must not come back out
  station: { id: "cpcb-6081", name: "Talkatora Garden", city: "Delhi", distance_km: 2 },
  source: "cpcb",
};
const c = {
  location: { lat: 28.61, lon: 77.21 },
  as_of: "2026-11-24T14:05:00.000Z",
  air,
  attribution: "x",
  disclaimer: "Informational only.",
} as unknown as Conditions;

test("API v1: yll_years is always null, even from a stored value", () => {
  assert.equal(serializeConditionsV1(c, "everyone").air?.yll_years, null);
});

test("page, markdown and station markdown: no years of life from a reading", () => {
  assert.doesNotMatch(renderConditionsPage(c), /years of life|life lost/i);
  assert.doesNotMatch(renderConditionsMarkdown(c), /life-expectancy|AQLI|years/i);
  const s = {
    provider: "cpcb",
    raw_id: "6081",
    id: "cpcb-6081",
    name: "T",
    city: "Delhi",
    lat: 28.6,
    lon: 77.2,
    aqi: 182,
    band: "moderate",
    pollutants: { pm25: 84.86 },
    yll: 7.83,
    ts: "2026-11-24T13:15:00Z",
  } as unknown as NormalizedStation;
  const md = renderStationMarkdown(s, "2026-11-24T13:20:00Z", "https://mugilu.live");
  assert.match(md, /yll_years: null/);
  assert.doesNotMatch(md, /Air Quality Life Index|persisted as the annual average/);
});

test("MCP, llms.txt and README: no promise of years of life lost", () => {
  const tools = JSON.stringify(TOOLS);
  for (const [name, text] of [
    ["MCP instructions", INSTRUCTIONS],
    ["MCP tools", tools],
    ["llms.txt", llmsTxt("https://mugilu.live")],
    ["README", readFileSync(new URL("../../../README.md", import.meta.url), "utf8")],
  ] as const)
    assert.doesNotMatch(text, /years[- ]of[- ]life[- ]lost|life lost|AQLI/i, name);
});
