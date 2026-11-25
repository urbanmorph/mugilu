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

// ---- W26: a stalled or refused call asks once more; a failed call falls back to this
// point's last good answer (the same exact point, so no accuracy cost), dated.

/** caches.default stand-in, keyed by URL. */
function memStore() {
  const m = new Map<string, Response>();
  return {
    m,
    match: async (r: Request) => m.get(r.url)?.clone(),
    put: async (r: Request, res: Response) => void m.set(r.url, res),
  };
}

const FAST = { hedgeMs: 30, budgetMs: 300 };
const json = (b: object) => new Response(JSON.stringify(b), { headers: { "content-type": "application/json" } });

/** Answer each call with the next of `plan` for its endpoint: an object (200), a status
 *  number, or "stall" (never answers until aborted). Counts calls per endpoint. */
function planFetch(plan: { fc: Array<object | number | "stall">; aq: Array<object | number | "stall"> }) {
  const realFetch = globalThis.fetch;
  const calls = { fc: 0, aq: 0 };
  const cached: boolean[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const k = String(input).includes("air-quality") ? "aq" : "fc";
    if (k === "fc") cached.push(!!(init as { cf?: { cacheEverything?: boolean } })?.cf?.cacheEverything);
    const step = plan[k][Math.min(calls[k]++, plan[k].length - 1)];
    if (step === "stall")
      return new Promise<Response>((_, reject) =>
        init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)),
      );
    return typeof step === "number" ? new Response("err", { status: step }) : json(step);
  }) as typeof fetch;
  return { calls, cached, restore: () => (globalThis.fetch = realFetch) };
}

test("getOpenMeteo: a call that stalls past the hedge is asked again, and the second answer is used", async () => {
  const f = planFetch({ fc: ["stall", FORECAST], aq: [AIR] });
  try {
    const r = await getOpenMeteo(12.97, 77.59, { ...FAST, store: memStore() });
    assert.equal(f.calls.fc, 2);
    assert.deepEqual(
      f.cached,
      [true, false],
      "the second call goes past the edge cache, so it never waits on the first",
    );
    assert.equal(r.heat?.temp_c, 23.2);
    assert.equal(r.failed, false);
  } finally {
    f.restore();
  }
});

test("getOpenMeteo: a 429 or 503 is asked once more at once; a 400 is not", async () => {
  for (const code of [429, 503]) {
    const f = planFetch({ fc: [code, FORECAST], aq: [AIR] });
    try {
      const r = await getOpenMeteo(12.97, 77.59, { ...FAST, hedgeMs: 10_000, store: memStore() });
      assert.equal(f.calls.fc, 2, `retried ${code}`);
      assert.equal(r.heat?.temp_c, 23.2);
    } finally {
      f.restore();
    }
  }
  const f = planFetch({ fc: [400, FORECAST], aq: [AIR] });
  try {
    const r = await getOpenMeteo(12.97, 77.59, { ...FAST, hedgeMs: 10_000, store: memStore() });
    assert.equal(f.calls.fc, 1, "a bad request is not repeated");
    assert.equal(r.heat, null);
  } finally {
    f.restore();
  }
});

test("getOpenMeteo: never more than two calls per endpoint, and the budget still holds", async () => {
  const f = planFetch({ fc: ["stall"], aq: ["stall"] });
  const t0 = Date.now();
  try {
    const r = await getOpenMeteo(12.97, 77.59, { ...FAST, store: memStore() });
    assert.deepEqual(f.calls, { fc: 2, aq: 2 });
    assert.ok(Date.now() - t0 < FAST.budgetMs + 200, "gave up at the budget");
    assert.equal(r.failed, true);
    assert.equal(r.heat, null);
  } finally {
    f.restore();
  }
});

test("getOpenMeteo: a failed call is filled from this point's last good answer, dated, without today's high", async () => {
  const store = memStore();
  const ok = planFetch({
    fc: [{ ...FORECAST, daily: { time: ["2026-11-25"], temperature_2m_max: [30] } }],
    aq: [{ current: { ...AIR.current, pm2_5: 40, pm10: 80 } }],
  });
  try {
    await getOpenMeteo(12.97, 77.59, { ...FAST, store });
  } finally {
    ok.restore();
  }
  assert.equal(store.m.size, 2, "each endpoint's good answer kept");
  const down = planFetch({ fc: [500], aq: ["stall"] });
  try {
    const r = await getOpenMeteo(12.97, 77.59, { ...FAST, store });
    assert.equal(r.failed, true, "still marked: the live call failed, so the page is not cached as whole");
    assert.equal(r.heat?.temp_c, 23.2);
    assert.ok(r.staleAt, "the age of the stand-in");
    assert.equal(r.heat?.as_of, r.staleAt);
    assert.equal(r.wind?.as_of, r.staleAt);
    assert.equal(r.uv?.as_of, r.staleAt);
    assert.equal(r.airModel?.pm25, 40);
    assert.equal(r.airModelAt, r.staleAt);
    assert.equal(r.todayMax, null, "an old copy's high may be another day's");
  } finally {
    down.restore();
  }
  // A different point never borrows it.
  const other = planFetch({ fc: [500], aq: [500] });
  try {
    const r = await getOpenMeteo(13.5, 77.59, { ...FAST, store });
    assert.equal(r.heat, null);
    assert.equal(r.staleAt, undefined);
  } finally {
    other.restore();
  }
});

test("getOpenMeteo: a kept answer older than three hours is not used", async () => {
  const store = memStore();
  const ok = planFetch({ fc: [FORECAST], aq: [AIR] });
  try {
    await getOpenMeteo(12.97, 77.59, { ...FAST, store, now: Date.now() - 3 * 3600_000 - 60_000 });
  } finally {
    ok.restore();
  }
  const down = planFetch({ fc: [500], aq: [500] });
  try {
    const r = await getOpenMeteo(12.97, 77.59, { ...FAST, store });
    assert.equal(r.heat, null);
    assert.equal(r.staleAt, undefined);
  } finally {
    down.restore();
  }
});
