import { test } from "node:test";
import assert from "node:assert/strict";
import { buildConditions, renderConditionsMarkdown } from "../src/conditions";
import type { Snapshot } from "../src/types";

const FORECAST = {
  current: {
    temperature_2m: 22,
    relative_humidity_2m: 80,
    apparent_temperature: 24,
    wet_bulb_temperature_2m: 20,
    precipitation: 0,
  },
};
const AIR = { current: { uv_index: 1, dust: 2, aerosol_optical_depth: 0.1 } };

function mockFetch(): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const body = String(input).includes("air-quality") ? AIR : FORECAST;
    return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

function snap(): Snapshot {
  return {
    generated_at: "2026-06-26T14:00:00Z",
    station_count: 1,
    providers: ["cpcb"],
    stations: [
      {
        id: "cpcb-1",
        raw_id: "1",
        provider: "cpcb",
        name: "Test Station",
        city: "Bengaluru",
        state: "KA",
        lat: 12.98,
        lon: 77.6,
        pollutants: { pm25: 25 },
        aqi: 57,
        band: "satisfactory",
        ts: null,
        yll: 1.96,
      },
    ],
  };
}

test("buildConditions: composes air + open-meteo + attribution + disclaimer", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = mockFetch();
  try {
    const c = await buildConditions(snap(), 12.9716, 77.5946);
    assert.equal(c.air?.aqi, 57);
    assert.equal(c.air?.station.name, "Test Station");
    assert.ok((c.air?.station.distance_km ?? 99) < 5);
    assert.equal(c.heat?.wet_bulb_c, 20);
    assert.equal(c.uv?.index, 1);
    assert.match(c.attribution, /CPCB/);
    assert.match(c.attribution, /Open-Meteo/);
    assert.ok(c.disclaimer.length > 0);
    assert.ok(c.as_of);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("buildConditions: null snapshot → air null, weather still present", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = mockFetch();
  try {
    const c = await buildConditions(null, 12.97, 77.59);
    assert.equal(c.air, null);
    assert.ok(c.heat, "heat present even without an air snapshot");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("renderConditionsMarkdown: includes air, heat, attribution and disclaimer", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = mockFetch();
  try {
    const md = renderConditionsMarkdown(await buildConditions(snap(), 12.9716, 77.5946));
    assert.match(md, /## Air/);
    assert.match(md, /## Heat/);
    assert.match(md, /Wet-bulb: 20/);
    assert.match(md, /not for medical/);
  } finally {
    globalThis.fetch = realFetch;
  }
});
