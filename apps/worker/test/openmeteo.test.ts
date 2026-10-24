import { test } from "node:test";
import assert from "node:assert/strict";
import { getOpenMeteo, getOpenMeteoBulk } from "../src/openmeteo";

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

/** Serve FORECAST (or `forecast`) and AIR by URL, recording each URL fetched. */
function stubFetch(forecast: object = FORECAST): { urls: string[]; restore: () => void } {
  const realFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    urls.push(String(input));
    const body = String(input).includes("air-quality") ? AIR : forecast;
    return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { urls, restore: () => (globalThis.fetch = realFetch) };
}

test("getOpenMeteo: today's daily max, local date and elevation ride on the same forecast call", async () => {
  const stub = stubFetch({
    ...FORECAST,
    elevation: 914,
    daily: { time: ["2026-05-25"], temperature_2m_max: [33.4] },
  });
  try {
    const r = await getOpenMeteo(12.97, 77.59);
    assert.equal(stub.urls.length, 2, "no extra request");
    assert.match(
      stub.urls.find((u) => u.includes("/forecast"))!,
      /daily=temperature_2m_max&forecast_days=1/,
    );
    assert.deepEqual(r.todayMax, { date: "2026-05-25", max_c: 33.4, elevation_m: 914 });
  } finally {
    stub.restore();
  }
});

test("getOpenMeteo: no daily block means no todayMax", async () => {
  const stub = stubFetch();
  try {
    assert.equal((await getOpenMeteo(12.97, 77.59)).todayMax, null);
  } finally {
    stub.restore();
  }
});

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

// Bulk forecast + air-quality responses (arrays, one entry per coordinate).
const FC_BULK = [
  {
    current: {
      temperature_2m: 25,
      apparent_temperature: 28,
      wet_bulb_temperature_2m: 21,
      relative_humidity_2m: 70,
      precipitation: 0,
    },
  },
  {
    current: {
      temperature_2m: 37,
      apparent_temperature: 40,
      wet_bulb_temperature_2m: 25,
      relative_humidity_2m: 30,
      precipitation: 0,
    },
  },
];
const AQ_BULK = [{ current: { uv_index: 6, dust: 12 } }, { current: { uv_index: 4, dust: 409 } }];

test("getOpenMeteoBulk: maps bulk forecast + air-quality per coordinate, in order", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const body = String(input).includes("air-quality") ? AQ_BULK : FC_BULK;
    return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const out = await getOpenMeteoBulk([
      { lat: 12.97, lon: 77.59 },
      { lat: 28.61, lon: 77.21 },
    ]);
    assert.equal(out.length, 2);
    assert.equal(out[0].apparent_c, 28);
    assert.equal(out[1].apparent_c, 40);
    assert.equal(out[1].dust_ug_m3, 409);
    assert.equal(out[0].uv, 6);
  } finally {
    globalThis.fetch = realFetch;
  }
});
