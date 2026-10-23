import { test } from "node:test";
import assert from "node:assert/strict";
import {
  collectWarnings,
  getLocationAlerts,
  parseSachetRss,
  renderWarningsMarkdown,
  splitWarnings,
} from "../src/sachet";

test("renderWarningsMarkdown: lists active alerts, empty state when none", () => {
  const md = renderWarningsMarkdown({
    generated_at: "2026-06-27T10:00:00Z",
    count: 1,
    alerts: [
      {
        identifier: "1",
        headline: "Heatwave warning",
        category: "Met",
        issuer: "IMD",
        link: "https://x/cap",
        sent: "Fri 27 Jun",
      },
    ],
  });
  assert.match(md, /# Active warnings across India/);
  assert.match(md, /## Heatwave warning/);
  assert.match(md, /Issuer: IMD/);
  assert.match(md, /CAP: https:\/\/x\/cap/);
  assert.match(renderWarningsMarkdown(null), /No active national alerts right now\./);
});

// Mirrors a real FetchLocationWiseAlerts alert (Dehradun, live).
const RESP = {
  responseMessage: "Success",
  alerts: [
    {
      severity: "WATCH",
      identifier: 1782462910006009,
      effective_start_time: "Fri Jun 26 14:00:00 IST 2026",
      effective_end_time: "Sat Jun 27 14:00:00 IST 2026",
      disaster_type: "Thunderstorm with Lightning",
      area_description: "11 districts of Uttarakhand",
      severity_level: "Likely",
      severity_color: "yellow",
      warning_message: "उत्तराखंड राज्य के पर्वतीय जनपदों में …",
      alert_source: "Uttarakhand SDMA",
      area_json: '{"type":"MultiPolygon","coordinates":[]}',
    },
  ],
};

test("getLocationAlerts: normalizes FetchLocationWiseAlerts into warnings", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify(RESP))) as typeof fetch;
  try {
    const ws = await getLocationAlerts(30.32, 78.03);
    assert.equal(ws.length, 1);
    assert.equal(ws[0].event, "Thunderstorm with Lightning");
    assert.equal(ws[0].severity, "WATCH");
    assert.equal(ws[0].color, "yellow");
    assert.equal(ws[0].issuer, "Uttarakhand SDMA");
    assert.match(ws[0].until, /Jun 27/);
    assert.equal(ws[0].identifier, "1782462910006009");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("parseSachetRss: parses the national feed into alerts", () => {
  const xml = `<?xml version="1.0"?><rss><channel><title>All India: CAP Feeds</title>
  <item><title>Heavy rain over Idukki</title><description/><category>Met</category>
  <link>https://sachet.ndma.gov.in/cap_public_website/FetchXMLFile?identifier=111</link>
  <author>controlroom@ndma.gov.in (IMD Thiruvananthapuram)</author>
  <guid isPermaLink="false">111</guid><pubDate>Mon, 22 Jun 2026 05:46:11 GMT</pubDate></item>
  <item><title>Thunderstorm over Delhi</title><category>Met</category>
  <link>https://sachet.ndma.gov.in/cap_public_website/FetchXMLFile?identifier=222</link>
  <author>(IMD Delhi)</author><guid isPermaLink="false">222</guid><pubDate>x</pubDate></item>
  </channel></rss>`;
  const alerts = parseSachetRss(xml);
  assert.equal(alerts.length, 2);
  assert.equal(alerts[0].identifier, "111");
  assert.equal(alerts[0].headline, "Heavy rain over Idukki");
  assert.equal(alerts[0].category, "Met");
  assert.match(alerts[0].issuer, /Thiruvananthapuram/);
  assert.match(alerts[0].link, /FetchXMLFile/);
  assert.equal(alerts[1].identifier, "222");
});

test("parseSachetRss: empty or garbage feed → []", () => {
  assert.deepEqual(parseSachetRss("<rss></rss>"), []);
  assert.deepEqual(parseSachetRss(""), []);
});

test("getLocationAlerts: empty list and upstream errors both → []", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ alerts: [], responseMessage: "Success" }))) as typeof fetch;
  try {
    assert.deepEqual(await getLocationAlerts(0, 0), []);
  } finally {
    globalThis.fetch = realFetch;
  }
  globalThis.fetch = (async () => new Response("err", { status: 500 })) as typeof fetch;
  try {
    assert.deepEqual(await getLocationAlerts(0, 0), []);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("collectWarnings: the ETag is only remembered once the snapshot is written", async () => {
  // If the R2 write fails after the ETag was saved, every later poll gets a 304
  // and the warnings stay stale until the feed changes. Save it last.
  const kv = new Map<string, string>();
  const env = {
    OAQ_KV: { get: async (k: string) => kv.get(k) ?? null, put: async (k: string, v: string) => void kv.set(k, v) },
    OAQ_R2: {
      put: async () => {
        throw new Error("r2 down");
      },
    },
  } as unknown as Parameters<typeof collectWarnings>[0];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response("<rss><channel></channel></rss>", { headers: { etag: '"v2"' } })) as unknown as typeof fetch;
  try {
    await assert.rejects(collectWarnings(env));
    assert.equal(kv.get("sachet:etag"), undefined);
  } finally {
    globalThis.fetch = realFetch;
  }
});

// A square area around (lat 14.9, lon 80.0), as SACHET's area_json (GeoJSON, [lon, lat]).
const square = (lat: number, lon: number, d = 0.1) =>
  JSON.stringify({
    type: "MultiPolygon",
    coordinates: [
      [
        [
          [lon - d, lat - d],
          [lon + d, lat - d],
          [lon + d, lat + d],
          [lon - d, lat + d],
          [lon - d, lat - d],
        ],
      ],
    ],
  });
const alert = (identifier: number, area_json?: string) => ({ ...RESP.alerts[0], identifier, area_json });

test("getLocationAlerts: says whether each warning's own area covers the point", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        alerts: [
          alert(1, square(14.9, 80.0)), // over the point
          alert(2, square(15.2, 80.0)), // ~33 km north: nearby, not over it
          alert(3, undefined), // no area given
          alert(4, '{"type":"MultiPolygon","coordinates":[]}'), // empty area
          alert(5, "not json"),
        ],
      }),
    )) as typeof fetch;
  try {
    const ws = await getLocationAlerts(14.9, 80.0);
    assert.deepEqual(
      ws.map((w) => [w.identifier, w.covers]),
      [
        ["1", true],
        ["2", false],
        ["3", undefined],
        ["4", undefined],
        ["5", undefined],
      ],
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("getLocationAlerts: a hole in the area (an excluded district) is not covered", async () => {
  const outer = [
    [79.8, 14.7],
    [80.2, 14.7],
    [80.2, 15.1],
    [79.8, 15.1],
    [79.8, 14.7],
  ];
  const hole = [
    [79.95, 14.85],
    [80.05, 14.85],
    [80.05, 14.95],
    [79.95, 14.95],
    [79.95, 14.85],
  ];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({ alerts: [alert(1, JSON.stringify({ type: "Polygon", coordinates: [outer, hole] }))] }),
    )) as typeof fetch;
  try {
    assert.equal((await getLocationAlerts(14.9, 80.0))[0].covers, false);
    assert.equal((await getLocationAlerts(15.0, 79.9))[0].covers, true);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("splitWarnings: over the spot (or area unknown, to be safe) vs nearby", () => {
  const w = (identifier: string, covers?: boolean) =>
    ({ identifier, covers }) as Parameters<typeof splitWarnings>[0][number];
  const { here, nearby } = splitWarnings([w("a", true), w("b", false), w("c", undefined)]);
  assert.deepEqual(
    here.map((x) => x.identifier),
    ["a", "c"],
  );
  assert.deepEqual(
    nearby.map((x) => x.identifier),
    ["b"],
  );
});
