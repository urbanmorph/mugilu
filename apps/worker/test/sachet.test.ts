import { test } from "node:test";
import assert from "node:assert/strict";
import { getLocationAlerts, parseSachetRss, renderWarningsMarkdown } from "../src/sachet";

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
