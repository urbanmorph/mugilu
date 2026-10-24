import { test } from "node:test";
import assert from "node:assert/strict";
import { buildConditions, pickStation, renderConditionsMarkdown, serializeConditionsV1 } from "../src/conditions";
import type { NormalizedStation, Snapshot } from "../src/types";
import type { HeatVsNormal } from "../src/heatnormals";

test("serializeConditionsV1: a stable, self-describing /c v1 contract", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = mockFetch();
  try {
    const c = await buildConditions(snap(), 12.9716, 77.5946);
    const v1 = serializeConditionsV1(c, "everyone") as Record<string, any>;
    assert.equal(v1.schema, "mugilu/conditions");
    assert.equal(v1.version, 1); // a version handle exists
    assert.equal(v1.refresh_after_seconds, 900); // self-describes its refresh cadence
    assert.equal(v1.units.pollutants.co, "mg/m3"); // CO mg/m³ vs the rest is discoverable
    assert.ok(Array.isArray(v1.warnings)); // one null convention: always a list
    assert.equal(v1.air.kind, "measured"); // provenance always present
    assert.equal(v1.air.yll_years, 1.96); // renamed from cryptic `yll`
    assert.ok("as_of" in v1.air); // per-layer freshness
    assert.equal(v1.heat.kind, "modelled");
    assert.ok("risk_band" in v1.ambient && !("band" in v1.ambient)); // no enum clash with air.band
    assert.equal(v1.ambient.driver, v1.ambient.driver.toLowerCase()); // matches the layer keys
    assert.equal(typeof v1.ambient.summary, "string");
  } finally {
    globalThis.fetch = realFetch;
  }
});

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

test("buildConditions: measured air is dated by the station's own reading, not the snapshot run", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = mockFetch();
  try {
    const s = snap();
    s.stations[0].ts = "2026-06-26T19:15:00+05:30";
    const c = await buildConditions(s, 12.9716, 77.5946);
    assert.equal(c.air_as_of, "2026-06-26T13:45:00.000Z");
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

test("buildConditions: today's high is compared with Bengaluru's late-May normal (real bundled normals)", async () => {
  const realFetch = globalThis.fetch;
  const forecast = { ...FORECAST, elevation: 914, daily: { time: ["2026-05-25"], temperature_2m_max: [36.2] } };
  globalThis.fetch = (async (input: RequestInfo | URL) =>
    new Response(JSON.stringify(String(input).includes("air-quality") ? AIR : forecast), {
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
  try {
    const c = await buildConditions(null, 12.97, 77.59);
    const h = c.heat_vs_normal!;
    assert.equal(h.today_max_c, 36);
    assert.ok(h.normal_max_c >= 29 && h.normal_max_c <= 35, `Bengaluru late-May normal ${h.normal_max_c}`);
    assert.equal(h.anomaly_c, 36 - h.normal_max_c);
    assert.equal(h.period, "late May");
    assert.match(c.attribution, /ERA5 \(Copernicus C3S\)/, "ERA5's licence asks for a Copernicus credit");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("buildConditions: no daily max from the forecast, no comparison", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = mockFetch();
  try {
    const c = await buildConditions(null, 12.97, 77.59);
    assert.equal(c.heat_vs_normal, null);
    assert.doesNotMatch(c.attribution, /ERA5/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

const HOT: HeatVsNormal = {
  today_max_c: 41,
  normal_max_c: 36,
  anomaly_c: 5,
  notable: true,
  date: "2026-05-25",
  period: "late May",
  baseline: "1991-2020 normals",
  source: "era5",
};

test("serializeConditionsV1: heat_vs_normal is an additive, modelled layer (null when absent)", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = mockFetch();
  try {
    const c = await buildConditions(null, 12.97, 77.59);
    assert.equal((serializeConditionsV1(c, "everyone") as Record<string, any>).heat_vs_normal, null);
    const v1 = serializeConditionsV1({ ...c, heat_vs_normal: HOT }, "everyone") as Record<string, any>;
    assert.deepEqual(v1.heat_vs_normal, { kind: "modelled", ...HOT, as_of: c.as_of });
    assert.equal(v1.units.anomaly_c, "C");
    assert.equal(v1.heat.kind, "modelled", "the heat layer is unchanged");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("renderConditionsMarkdown: a notable difference from normal is said, labelled as modelled; a small one stays quiet", async (t) => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = mockFetch();
  try {
    const c = await buildConditions(null, 12.97, 77.59);
    t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-05-25T06:00:00Z") }); // the high's own day, IST
    const md = renderConditionsMarkdown({ ...c, heat_vs_normal: HOT });
    assert.match(md, /Today's modelled high of 41°C is 5°C above normal for late May here/);
    assert.match(md, /Today's high is modelled \(Open-Meteo\); the normal is 1991-2020 ERA5 reanalysis\./);
    assert.doesNotMatch(md, /heatwave|heat wave/i);
    assert.doesNotMatch(md, /—/);
    const cool = renderConditionsMarkdown({ ...c, heat_vs_normal: { ...HOT, today_max_c: 31, anomaly_c: -5 } });
    assert.match(cool, /Today's modelled high of 31°C is 5°C below normal for late May here/);
    const quiet = renderConditionsMarkdown({ ...c, heat_vs_normal: { ...HOT, anomaly_c: 1, notable: false } });
    t.mock.timers.setTime(new Date("2026-05-25T18:40:00Z").getTime()); // 00:10 IST, the next day
    assert.doesNotMatch(
      renderConditionsMarkdown({ ...c, heat_vs_normal: HOT }),
      /normal/,
      "yesterday's high is not today's",
    );
    assert.doesNotMatch(quiet, /normal/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

function st(id: string, provider: NormalizedStation["provider"], lat: number, aqi: number | null): NormalizedStation {
  return {
    id,
    raw_id: id,
    provider,
    name: id,
    city: "X",
    state: "",
    lat,
    lon: 77,
    pollutants: aqi == null ? {} : { pm25: 40 },
    aqi,
    band: aqi == null ? "unknown" : "satisfactory",
    ts: null,
  };
}

// 0.01° of latitude ≈ 1.1 km.
test("pickStation: the nearest station wins when no CPCB is about as near", () => {
  const s = [st("a", "airview", 12.001, 80), st("c", "cpcb", 12.05, 90)];
  assert.equal(pickStation(s, 12, 77)?.id, "a");
});

test("pickStation: a CPCB station within the near-tie band beats a nearer sensor", () => {
  const s = [st("a", "airview", 12.001, 80), st("n", "airnet", 12.005, 85), st("c", "cpcb", 12.01, 90)];
  assert.equal(pickStation(s, 12, 77)?.id, "c");
});

test("pickStation: a nearest CPCB stays, and stations without a reading are skipped", () => {
  assert.equal(pickStation([st("c", "cpcb", 12.001, 90), st("a", "airview", 12.0005, null)], 12, 77)?.id, "c");
  assert.equal(pickStation([], 12, 77), undefined);
});

test("serializeConditionsV1 + markdown: carry the persona's own step", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = mockFetch();
  try {
    const c = await buildConditions(snap(), 12.9716, 77.5946);
    c.air = { ...c.air!, aqi: 150, band: "moderate" };
    const asthma = serializeConditionsV1(c, "asthma") as Record<string, any>;
    assert.match(asthma.ambient.persona_action, /hard exercise/);
    assert.equal((serializeConditionsV1(c, "everyone") as Record<string, any>).ambient.persona_action, null);
    assert.match(renderConditionsMarkdown(c, "asthma"), /hard exercise/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

/** The same mocks, plus SACHET answering with these alerts. */
function mockFetchWithAlerts(alerts: object[]): typeof fetch {
  const base = mockFetch();
  return (async (input: RequestInfo | URL) =>
    String(input).includes("FetchLocationWiseAlerts")
      ? new Response(JSON.stringify({ alerts }))
      : base(input)) as typeof fetch;
}
const redAlert = (identifier: number, lat: number, lon: number) => ({
  identifier,
  disaster_type: "Heavy Rain",
  severity: "WARNING",
  severity_color: "red",
  area_description: "a mandal",
  alert_source: "IMD",
  effective_end_time: "Fri Oct 23 18:00:00 IST 2026",
  area_json: JSON.stringify({
    type: "MultiPolygon",
    coordinates: [
      [
        [
          [lon - 0.05, lat - 0.05],
          [lon + 0.05, lat - 0.05],
          [lon + 0.05, lat + 0.05],
          [lon - 0.05, lat + 0.05],
          [lon - 0.05, lat - 0.05],
        ],
      ],
    ],
  }),
});

test("buildConditions: a warning over a neighbouring area is listed as nearby, and never raises the spot's risk", async () => {
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = mockFetch();
    const calm = await buildConditions(snap(), 12.9716, 77.5946);
    globalThis.fetch = mockFetchWithAlerts([redAlert(7, 13.2, 77.6)]); // ~25 km north
    const c = await buildConditions(snap(), 12.9716, 77.5946);
    assert.equal(c.warnings, undefined);
    assert.equal(c.nearby_warnings?.length, 1);
    const v1 = serializeConditionsV1(c, "everyone") as Record<string, any>;
    assert.deepEqual(v1.warnings, []);
    assert.equal(v1.nearby_warnings.length, 1);
    assert.equal(v1.nearby_warnings[0].source, "sachet");
    assert.ok(!("covers" in v1.nearby_warnings[0]), "the internal flag is not part of the API");
    assert.equal(
      v1.ambient.risk_band,
      (serializeConditionsV1(calm, "everyone") as Record<string, any>).ambient.risk_band,
    );
    const md = renderConditionsMarkdown(c);
    assert.match(md, /## Nearby official warnings/);
    assert.doesNotMatch(md, /## ⚠ Official warnings/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("buildConditions: a warning whose area covers the spot is the spot's warning", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = mockFetchWithAlerts([redAlert(8, 12.9716, 77.5946)]);
  try {
    const c = await buildConditions(snap(), 12.9716, 77.5946);
    assert.equal(c.warnings?.length, 1);
    assert.equal(c.nearby_warnings, undefined);
    const v1 = serializeConditionsV1(c, "everyone") as Record<string, any>;
    assert.equal(v1.warnings[0].event, "Heavy Rain");
    assert.ok(!("covers" in v1.warnings[0]));
    assert.deepEqual(v1.nearby_warnings, []);
  } finally {
    globalThis.fetch = realFetch;
  }
});

// A reading built while an upstream failed must say so, so it is never cached as
// if complete (a SACHET timeout would otherwise hide a warning for every viewer).
async function degradedWith(fail: "none" | "open-meteo" | "sachet", snapshot: Snapshot | null = snap()) {
  const realFetch = globalThis.fetch;
  const ok = mockFetch();
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const u = String(input);
    if (fail === "sachet" && u.includes("sachet")) return new Response("down", { status: 503 });
    if (fail === "open-meteo" && u.includes("open-meteo")) throw new Error("timeout");
    if (u.includes("sachet")) return Response.json({ alerts: [] });
    return ok(input);
  }) as typeof fetch;
  try {
    return (await buildConditions(snapshot, 12.9716, 77.5946)).degraded;
  } finally {
    globalThis.fetch = realFetch;
  }
}

test("buildConditions: degraded, naming the source, when an upstream fails or the air snapshot is missing", async () => {
  assert.equal(await degradedWith("none"), undefined);
  assert.deepEqual(await degradedWith("open-meteo"), ["openmeteo"]);
  assert.deepEqual(await degradedWith("sachet"), ["sachet"]);
  assert.deepEqual(await degradedWith("none", null), ["r2"]);
});

test("buildConditions: a place with no normal yet is complete, not degraded (so it can be edge-cached)", async () => {
  const realFetch = globalThis.fetch;
  const forecast = { ...FORECAST, elevation: 16, daily: { time: ["2026-05-25"], temperature_2m_max: [31] } };
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const u = String(input);
    if (u.includes("sachet")) return Response.json({ alerts: [] });
    return Response.json(u.includes("air-quality") ? AIR : forecast);
  }) as typeof fetch;
  try {
    const c = await buildConditions(snap(), 11.67, 92.73); // Port Blair: off the built grid
    assert.equal(c.heat_vs_normal, null);
    assert.equal(c.degraded, undefined);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("serializeConditionsV1: the internal degraded flag never reaches the API", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = mockFetch();
  try {
    const c = await buildConditions(null, 12.9716, 77.5946);
    assert.ok(!("degraded" in serializeConditionsV1(c, "everyone")));
  } finally {
    globalThis.fetch = realFetch;
  }
});
