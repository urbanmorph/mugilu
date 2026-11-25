// The audit's minor findings (24 Nov 2026, M1-M5): each as it was found, then fixed.
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index";
import type { Env } from "../src/index";
import { renderStationPage } from "../src/pages/station";
import { cleanStationName } from "../src/refresh";
import { distinctStations } from "../src/near";
import { STANDARD_CSS } from "../src/ui/standard";
import type { NearStation, NormalizedStation } from "../src/types";

const st = (over: Partial<NormalizedStation> = {}): NormalizedStation => ({
  id: "airview-12069",
  raw_id: "12069",
  provider: "airview",
  name: "Akola - Chhoti Umari",
  city: "Akola",
  state: "",
  lat: 20.71,
  lon: 77.02,
  pollutants: {},
  aqi: null,
  band: "unknown",
  ts: "2026-11-25T19:45:00+05:30",
  ...over,
});

test("M1: a station that reported lately with no pollutant the AQI uses says that, not 'no recent reading'", () => {
  const en = renderStationPage(st(), [], true, "en");
  assert.doesNotMatch(en, /No recent reading/);
  assert.match(
    en,
    /The last report from this station, <time[^>]*>[^<]*<\/time>, has no pollutant reading that goes into the AQI\./,
  );
  assert.match(renderStationPage(st(), [], true, "hi"), /AQI में गिने जाने वाले किसी प्रदूषक की रीडिंग नहीं है/);
  assert.match(renderStationPage(st(), [], true, "kn"), /AQI ಗೆ ಸೇರುವ ಯಾವುದೇ ಮಾಲಿನ್ಯಕಾರಕದ ಅಳತೆ ಇಲ್ಲ/);
  // A station not seen within the window still says so.
  assert.match(renderStationPage(st(), [], false, "en"), /No recent reading from this station/);
});

test("M2: a station named only by an ID takes its city in front; a real name is kept", () => {
  assert.equal(cleanStationName("2415_18", "Bhubaneswar"), "Bhubaneswar 2415_18");
  assert.equal(cleanStationName("9311_71", "Bhubaneswar"), "Bhubaneswar 9311_71");
  assert.equal(cleanStationName("2415_18", ""), "2415_18", "no city: nothing to add, nothing invented");
  assert.equal(cleanStationName("Sector-125", "Noida"), "Sector-125");
  assert.equal(cleanStationName("Sector 62", "Noida"), "Sector 62");
});

const near = (id: string, name: string, lat: number, lon: number, d: number): NearStation =>
  ({ ...st({ id, raw_id: id, name, lat, lon, aqi: 100, band: "satisfactory" }), distance_km: d }) as NearStation;

test("M3: co-located sensors with one name are one row, and the page's own station is not listed again", () => {
  const self = st({ id: "cpcb-5670", name: "Meher Colony", lat: 21.941841, lon: 86.728318 });
  const list = [
    near("airview-10172", "Meher Colony", 21.941782, 86.728226, 0.01),
    near("airview-10173", "Meher Colony", 21.941782, 86.728226, 0.01),
    near("airview-10171", "Meher Colony", 21.9417819, 86.7282258, 0.01),
    near("cpcb-9", "Meher colony", 21.95, 86.74, 1.5), // the same name 1.5 km off: a different place
    near("cpcb-8", "Station Road", 21.94, 86.73, 0.2),
  ];
  assert.deepEqual(
    distinctStations(list, self).map((s) => s.id),
    ["cpcb-9", "cpcb-8"],
  );
  // Without a page station (the place page's list), the first of a co-located set stays.
  assert.deepEqual(
    distinctStations(list).map((s) => s.id),
    ["airview-10172", "cpcb-9", "cpcb-8"],
  );
});

test("M3: the station page names its nearby list once (the panel title), not twice", () => {
  const html = renderStationPage(
    st({ aqi: 120, band: "moderate", pollutants: { pm25: 50 } }),
    [near("cpcb-8", "Station Road", 20.72, 77.03, 1.2)],
    true,
  );
  assert.equal(html.match(/Air stations near here/g)?.length, 1);
  assert.match(html, /<table[^>]*aria-labelledby="/);
});

const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;
const get = (path: string) => worker.fetch(new Request(`https://mugilu.live${path}`), {} as Env, ctx);

test("M4: a point outside India in a browser gets a page in the site's shell (400), in en/hi/kn", async () => {
  for (const [path, words] of [
    ["/c/51.5,-0.12", /mugilu covers India only/],
    ["/hi/c/51.5,-0.12", /mugilu केवल भारत/],
    ["/kn/c/51.5,-0.12", /mugilu ಭಾರತವನ್ನು ಮಾತ್ರ/],
    ["/embed/51.5,-0.12", /mugilu covers India only/],
  ] as const) {
    const res = await get(path);
    assert.equal(res.status, 400, path);
    assert.match(res.headers.get("content-type") ?? "", /text\/html/, path);
    const html = await res.text();
    assert.match(html, /<html/, path);
    assert.match(html, words, path);
  }
  // The data formats keep the API's JSON error.
  for (const path of ["/c/51.5,-0.12.json", "/c/51.5,-0.12.md"]) {
    const res = await get(path);
    assert.equal(res.status, 400, path);
    assert.match(res.headers.get("content-type") ?? "", /application\/json/, path);
  }
});

test("M5: a tall, narrow frame shows the readings and the full note instead of a blank middle", () => {
  assert.match(
    STANDARD_CSS,
    /@media \(max-width:371\.98px\) and \(min-height:300px\)\{[^@]*\.framed \.mg\[data-embed\] \.ecard \.ereads\{display:flex;max-height:none\}/,
  );
  // In any tall frame the body sits between the top line and the footer, not under the top.
  assert.match(
    STANDARD_CSS,
    /@media \(min-height:300px\)\{\.framed \.mg\[data-embed\] \.ecard \.eamb\{margin-top:auto\}\}/,
  );
});
