import { test } from "node:test";
import assert from "node:assert/strict";
import { getLocationAlerts } from "../src/sachet";

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
