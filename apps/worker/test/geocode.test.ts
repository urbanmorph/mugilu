import { test } from "node:test";
import assert from "node:assert/strict";
import { geocode } from "../src/geocode";

// Mirrors the real Open-Meteo geocoding response for Bengaluru.
const BENGALURU = {
  results: [{ name: "Bengaluru", admin1: "Karnataka", country_code: "IN", latitude: 12.97194, longitude: 77.59369 }],
};
const NO_RESULTS = {}; // Open-Meteo omits `results` entirely when nothing matches

function mockFetch(body: unknown, ok = true): typeof fetch {
  return (async () => new Response(JSON.stringify(body), { status: ok ? 200 : 500 })) as typeof fetch;
}

test("geocode: resolves a place name to coordinates", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = mockFetch(BENGALURU);
  try {
    const r = await geocode("Bengaluru");
    assert.equal(r?.lat, 12.97194);
    assert.equal(r?.lon, 77.59369);
    assert.equal(r?.name, "Bengaluru");
    assert.equal(r?.admin1, "Karnataka");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("geocode: returns null when nothing matches (e.g. a pincode)", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = mockFetch(NO_RESULTS);
  try {
    assert.equal(await geocode("560038"), null);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("geocode: returns null on an empty query without calling fetch", async () => {
  const realFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    return new Response("{}");
  }) as typeof fetch;
  try {
    assert.equal(await geocode("   "), null);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("geocode: returns null on an upstream error", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = mockFetch({}, false);
  try {
    assert.equal(await geocode("Mumbai"), null);
  } finally {
    globalThis.fetch = realFetch;
  }
});
