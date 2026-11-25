import { test } from "node:test";
import assert from "node:assert/strict";
import type { AirPollutants, NormalizedStation } from "../src/types";
import type { NearStation } from "../src/types";

// From ops, 25 Nov 2026: Shimla town (about 2,200 m) read "poor, AQI 245", measured at Baddi,
// 40 km away in the industrial plains about 1,500 m lower. A station more than 500 m above or
// below a place is in different air: the place gets the model, and the station is named apart.

const baddi = {
  id: "cpcb-1",
  raw_id: "1",
  provider: "cpcb",
  name: "HIMUDA Complex Phase-1",
  city: "Baddi",
  state: "Himachal Pradesh",
  lat: 30.95,
  lon: 76.79,
  pollutants: { pm25: 120 },
  aqi: 245,
  band: "poor",
  ts: "2026-11-25T15:00:00.000Z",
  elev_m: 420,
  distance_km: 39.7,
} as NormalizedStation & NearStation;
const model: AirPollutants = { pm25: 18, pm10: 30 };

test("stationApart: more than 500 m above or below; unknown heights never count", async () => {
  const { stationApart, HEIGHT_APART_M } = await import("../src/conditions");
  assert.equal(HEIGHT_APART_M, 500);
  assert.equal(stationApart(420, 2200), true);
  assert.equal(stationApart(2700, 2100), true);
  assert.equal(stationApart(420, 800), false);
  assert.equal(stationApart(undefined, 2200), false);
  assert.equal(stationApart(420, undefined), false);
});

test("chooseAir: a station in different air gives way to the model, and is named apart", async () => {
  const { chooseAir } = await import("../src/conditions");
  const air = chooseAir(baddi, model, 2200)!;
  assert.equal(air.station, null);
  assert.equal(air.modelled, true);
  assert.deepEqual(air.station_apart, {
    name: "HIMUDA Complex Phase-1",
    city: "Baddi",
    distance_km: 39.7,
    height_m: -1780,
    aqi: 245,
  });
  // Same height band: the station speaks for the place, as before.
  assert.equal(chooseAir(baddi, model, 600)!.station?.name, "HIMUDA Complex Phase-1");
  // Height unknown (an older snapshot, or no forecast): as before.
  assert.equal(chooseAir(baddi, model, undefined)!.station?.name, "HIMUDA Complex Phase-1");
  // No model to give way to: the station still beats nothing.
  assert.equal(chooseAir(baddi, null, 2200)!.station?.name, "HIMUDA Complex Phase-1");
});

test("the air sentence names the station apart, in en, hi and kn", async () => {
  const { chooseAir } = await import("../src/conditions");
  const { facts } = await import("../src/facts");
  const { factText } = await import("../src/phrases");
  const c = {
    location: { lat: 31.1048, lon: 77.1734 },
    as_of: "2026-11-25T16:00:00.000Z",
    air: { ...chooseAir(baddi, model, 2200)!, aqi: 60, band: "satisfactory" },
    attribution: "",
    disclaimer: "",
  } as any;
  const air = facts(c).find((f) => f.key === "air")!;
  assert.equal(
    factText(air, "en"),
    "The air quality is satisfactory, AQI 60. Open-Meteo models this value. The nearest air station, HIMUDA Complex Phase-1, Baddi, is 40 km away and 1,780 m lower, in different air; it reads AQI 245.",
  );
  assert.match(factText(air, "hi"), /HIMUDA Complex Phase-1, Baddi.*40 km.*1,780 m नीचे.*AQI 245/);
  assert.match(factText(air, "kn"), /HIMUDA Complex Phase-1, Baddi.*40 km.*1,780 m ಕೆಳಗೆ.*AQI 245/);
});

test("named places: state pages and the sitemap dates apply the same rule", async () => {
  const { speaksFor } = await import("../src/conditions");
  const { placeElevation } = await import("../src/slugs");
  const shimla = placeElevation("shimla");
  assert.ok(shimla != null && shimla > 1500, `Shimla ${shimla}`);
  assert.equal(speaksFor({ ...baddi, distance_km: 30 }, shimla), false);
  assert.equal(speaksFor({ ...baddi, distance_km: 30 }, placeElevation("ludhiana")), true);
  assert.equal(speaksFor({ ...baddi, distance_km: 60 }, 400), false, "beyond 50 km, as before");
});

test("withElevations: fetches only stations it has not seen, keeps them, and never fails the refresh", async () => {
  const { withElevations, STATION_ELEV_KEY } = await import("../src/elevation");
  const store = new Map<string, string>();
  const r2 = {
    get: async (k: string) => (store.has(k) ? { json: async () => JSON.parse(store.get(k)!) } : null),
    put: async (k: string, v: string) => void store.set(k, v),
  };
  const env = { OAQ_R2: r2 } as any;
  const st = (id: string, lat: number, lon: number) => ({ ...baddi, id, lat, lon, elev_m: undefined });
  let calls = 0;
  const fetchFn = (async (url: string) => {
    calls++;
    const n = new URL(url).searchParams.get("latitude")!.split(",").length;
    return new Response(JSON.stringify({ elevation: Array.from({ length: n }, (_, i) => 100 + i) }));
  }) as typeof fetch;
  const a = await withElevations(env, [st("a", 30.95, 76.79), st("b", 31.1, 77.17)], fetchFn);
  assert.deepEqual(
    a.map((s) => s.elev_m),
    [100, 101],
  );
  assert.equal(calls, 1);
  assert.ok(store.has(STATION_ELEV_KEY));
  const again = await withElevations(env, [st("a", 30.95, 76.79), st("b", 31.1, 77.17)], fetchFn);
  assert.equal(calls, 1, "a second run fetches nothing");
  assert.deepEqual(
    again.map((s) => s.elev_m),
    [100, 101],
  );
  const failing = (async () => new Response("{}", { status: 429 })) as unknown as typeof fetch;
  const c = await withElevations(env, [st("c", 12.9, 77.5)], failing);
  assert.equal(c[0].elev_m, undefined, "a failed lookup leaves the height unknown");
});

test("the API and the Markdown name the station apart", async () => {
  const { chooseAir, serializeConditionsV1, renderConditionsMarkdown } = await import("../src/conditions");
  const c = {
    location: { lat: 31.1048, lon: 77.1734 },
    as_of: "2026-11-25T16:00:00.000Z",
    air: chooseAir(baddi, model, 2200),
    attribution: "",
    disclaimer: "",
  } as any;
  const v1 = serializeConditionsV1(c, "everyone") as any;
  assert.equal(v1.air.kind, "modelled");
  assert.equal(v1.air.station_apart.name, "HIMUDA Complex Phase-1");
  assert.match(
    renderConditionsMarkdown(c),
    /nearest station, HIMUDA Complex Phase-1, Baddi \(39\.7 km, 1,780 m lower\), is in different air/,
  );
});
