import { test } from "node:test";
import assert from "node:assert/strict";
import { getOpenMeteo } from "../src/openmeteo";

// Fixtures mirror the real Open-Meteo responses we probed for Bengaluru.
const FORECAST = {
  current: {
    temperature_2m: 23.2,
    relative_humidity_2m: 84,
    apparent_temperature: 25.7,
    wet_bulb_temperature_2m: 21.1,
    precipitation: 0,
  },
};
const AIR = { current: { uv_index: 0, dust: 3, aerosol_optical_depth: 0.16 } };

test("getOpenMeteo: parses forecast + air-quality into the schema", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const body = String(input).includes("air-quality") ? AIR : FORECAST;
    return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const r = await getOpenMeteo(12.9716, 77.5946);
    assert.equal(r.heat?.temp_c, 23.2);
    assert.equal(r.heat?.wet_bulb_c, 21.1);
    assert.equal(r.heat?.source, "open-meteo");
    assert.equal(r.rain?.precipitation_mm, 0);
    assert.equal(r.uv?.index, 0);
    assert.equal(r.dust?.dust_ug_m3, 3);
    assert.equal(r.dust?.aod, 0.16);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("getOpenMeteo: a failing endpoint nulls only its own layer", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (String(input).includes("air-quality")) return new Response("err", { status: 500 });
    return new Response(JSON.stringify(FORECAST), { headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const r = await getOpenMeteo(12.97, 77.59);
    assert.ok(r.heat, "heat should still be present");
    assert.equal(r.uv, null, "uv should be null when air-quality fails");
    assert.equal(r.dust, null);
  } finally {
    globalThis.fetch = realFetch;
  }
});
