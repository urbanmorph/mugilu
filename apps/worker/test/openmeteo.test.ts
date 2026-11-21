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
    hourly: { precipitation: [1.5, 2, null, 4.25] },
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
    assert.equal(out[0].rain_24h_mm, undefined); // no hourly forecast, no sum
    assert.equal(out[1].rain_24h_mm, 7.8); // the next 24 hours, summed
  } finally {
    globalThis.fetch = realFetch;
  }
});

// The day just ended, on the same bulk calls: Open-Meteo's daily figures for yesterday (past_days=1)
// and the day's highest hourly dust, so the history panel has a daily record of every modelled hazard.
test("getOpenMeteoBulk pastDay: yesterday's daily figures and its highest dust ride on the same two calls", async () => {
  const realFetch = globalThis.fetch;
  const urls: string[] = [];
  const day = {
    time: ["2026-11-20", "2026-11-21"],
    apparent_temperature_max: [25.4, 24.8],
    apparent_temperature_min: [14, 15],
    precipitation_sum: [3.2, 0],
    wind_gusts_10m_max: [41.8, 15.8],
    uv_index_max: [4.2, 4.15],
    visibility_min: [380, 5560],
  };
  const hours = (d: string) => Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, "0")}:00`);
  const dust = {
    time: [...hours("2026-11-20"), ...hours("2026-11-21")],
    dust: [...Array(24).fill(10), 600, ...Array(23).fill(1)],
  };
  dust.dust[5] = 95;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    urls.push(String(input));
    const body = String(input).includes("air-quality")
      ? [{ ...AQ_BULK[0], hourly: dust }]
      : [{ ...FC_BULK[0], daily: day }];
    return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const [out] = await getOpenMeteoBulk([{ lat: 28.61, lon: 77.21 }], 0, { pastDay: true });
    assert.equal(out.apparent_c, 28, "the current reading is unchanged");
    assert.deepEqual(out.day, {
      date: "2026-11-20",
      feels_max: 25.4,
      feels_min: 14,
      rain_mm: 3.2,
      gust_kmh: 41.8,
      uv_max: 4.2,
      vis_min_m: 380,
      dust_max: 95,
    });
    const [fc, aq] = [urls.find((u) => !u.includes("air-quality"))!, urls.find((u) => u.includes("air-quality"))!];
    for (const u of [fc, aq]) assert.match(u, /past_days=1&forecast_days=1/);
    assert.match(
      fc,
      /daily=apparent_temperature_max,apparent_temperature_min,precipitation_sum,wind_gusts_10m_max,uv_index_max,visibility_min/,
    );
    assert.match(aq, /hourly=dust/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("getOpenMeteoBulk: without pastDay, no daily figures and no extra variables are asked for", async () => {
  const realFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    urls.push(String(input));
    return new Response(JSON.stringify(String(input).includes("air-quality") ? AQ_BULK : FC_BULK));
  }) as typeof fetch;
  try {
    const out = await getOpenMeteoBulk([
      { lat: 12.97, lon: 77.59 },
      { lat: 28.61, lon: 77.21 },
    ]);
    assert.equal(out[0].day, undefined);
    assert.ok(urls.every((u) => !u.includes("past_days") && !u.includes("daily=")));
  } finally {
    globalThis.fetch = realFetch;
  }
});
