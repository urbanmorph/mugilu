import { test } from "node:test";
import assert from "node:assert/strict";
import { grapRead } from "../src/grap";
import { renderConditionsPage } from "../src/page";
import type { Conditions, NormalizedStation } from "../src/types";

const st = (aqi: number | null, city = "Delhi", provider: NormalizedStation["provider"] = "cpcb") =>
  ({
    id: `${provider}-${aqi}`,
    raw_id: String(aqi),
    provider,
    name: "x",
    city,
    state: "",
    lat: 28.6,
    lon: 77.2,
    pollutants: {},
    aqi,
    band: "poor",
    ts: "",
  }) as NormalizedStation;

test("grapRead: Delhi's CPCB average and the GRAP stage range it falls in, for places in Delhi-NCR", () => {
  const delhi = [st(300), st(320), st(340), st(990, "Delhi", "airnet"), st(500, "Noida"), st(null)];
  // only Delhi's CPCB stations count: (300+320+340)/3 = 320, Stage II (301-400)
  assert.deepEqual(grapRead(delhi, 28.61, 77.21), { aqi: 320, stations: 3, stage: 2 });
  assert.equal(grapRead(delhi, 28.57, 77.32)?.stage, 2); // Noida is in NCR too
  assert.equal(grapRead(delhi, 12.97, 77.59), null); // Bengaluru is not
  const at = (aqi: number) => grapRead([st(aqi)], 28.61, 77.21)?.stage;
  assert.deepEqual([at(150), at(201), at(300), at(301), at(401), at(450), at(451)], [0, 1, 1, 2, 3, 3, 4]);
  assert.equal(grapRead([st(null)], 28.61, 77.21), null); // no reading, nothing said
});

const page = (grap: Conditions["grap"], lang: "en" | "hi" = "en") =>
  renderConditionsPage(
    {
      location: { lat: 28.61, lon: 77.21 },
      place: "Delhi",
      as_of: "2026-11-11T08:20:00.000Z",
      air: null,
      heat: null,
      rain: null,
      uv: null,
      dust: null,
      wind: null,
      visibility: null,
      smoke: null,
      grap,
      attribution: "Sources: CPCB via OAQ",
      disclaimer: "Informational only.",
    } as unknown as Conditions,
    "everyone",
    undefined,
    lang,
  );

test("renderConditionsPage: says the GRAP range for Delhi-NCR, and that CAQM sets the stage", () => {
  const html = page({ aqi: 312, stations: 38, stage: 2 });
  assert.match(
    html,
    /GRAP<\/b>: Delhi&#39;s AQI averages 312 across 38 CPCB stations now, in the Stage II range \(301-400\)\. The stage in force is set by <a href="https:\/\/caqm\.nic\.in\/"[^>]*>CAQM<\/a>\./,
  );
  assert.match(page({ aqi: 180, stations: 38, stage: 0 }), /below the Stage I range \(201-300\)/);
  assert.match(page({ aqi: 460, stations: 38, stage: 4 }), /in the Stage IV range \(above 450\)/);
  assert.match(
    page({ aqi: 312, stations: 38, stage: 2 }, "hi"),
    /GRAP<\/b>: अभी 38 CPCB स्टेशनों पर Delhi का औसत AQI 312 है/,
  );
  assert.doesNotMatch(page(undefined), /GRAP/);
});
