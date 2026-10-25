import { test } from "node:test";
import assert from "node:assert/strict";
import {
  noleapDay,
  weekCentre,
  seasonalValue,
  normalMaxAt,
  compareWithNormal,
  periodText,
  heatVsNormalLine,
  heatVsNormalShown,
  ANOMALY_NOTABLE_C,
} from "../src/heatnormals";
import type { NormalsFile } from "../src/heatnormals";

test("noleapDay: 0-based day in a 365-day year from a local date; Feb 29 folds onto Feb 28", () => {
  assert.equal(noleapDay("2026-01-01"), 0);
  assert.equal(noleapDay("2026-02-28"), 58);
  assert.equal(noleapDay("2028-02-29"), 58);
  assert.equal(noleapDay("2028-03-01"), 59);
  assert.equal(noleapDay("2026-12-31"), 364);
});

test("seasonalValue: returns the weekly sample at a week's centre and interpolates between", () => {
  const weeks = Array.from({ length: 52 }, (_, k) => k * 10);
  assert.equal(seasonalValue(weeks, weekCentre(5)), 50);
  const mid = (weekCentre(5) + weekCentre(6)) / 2;
  assert.ok(Math.abs(seasonalValue(weeks, mid) - 55) < 1e-9);
});

test("seasonalValue: wraps across the year end (late Dec blends into early Jan)", () => {
  const weeks = Array.from({ length: 52 }, (_, k) => (k === 0 ? 100 : k === 51 ? 200 : 0));
  const v = seasonalValue(weeks, 364);
  assert.ok(v > 100 && v < 200, `got ${v}`);
});

// A 1-degree grid with nodes on half degrees: values in tenths, [elevation_m, ...52 weeks].
function file(nodes: Record<string, number>, elev = 200): NormalsFile {
  return {
    step: 1,
    nodes: Object.fromEntries(Object.entries(nodes).map(([k, v]) => [k, [elev, ...Array(52).fill(v)]])),
  };
}
const MAY25 = "2026-05-25";

test("normalMaxAt: at a node returns that node's normal in °C", () => {
  assert.equal(normalMaxAt(28.5, 77.5, MAY25, undefined, file({ "28.5,77.5": 400 })), 40);
});

test("normalMaxAt: bilinear between the four surrounding nodes", () => {
  const f = file({ "28.5,77.5": 400, "28.5,78.5": 380, "29.5,77.5": 400, "29.5,78.5": 380 });
  assert.equal(normalMaxAt(29, 78, MAY25, undefined, f), 39);
});

test("normalMaxAt: renormalises over the nodes that exist; null when the point is off the built grid", () => {
  const f = file({ "28.5,77.5": 400 });
  assert.equal(normalMaxAt(28.7, 77.7, MAY25, undefined, f), 40);
  assert.equal(normalMaxAt(29.4, 78.4, MAY25, undefined, f), null); // only a far corner is built
  assert.equal(normalMaxAt(12.9, 77.6, MAY25, undefined, f), null);
});

test("normalMaxAt: corrects each node to the place's elevation (6.5 °C per km)", () => {
  assert.equal(normalMaxAt(12.5, 77.5, MAY25, 1000, file({ "12.5,77.5": 300 }, 0)), 23.5);
});

test("compareWithNormal: whole-degree numbers that subtract to the shown difference", () => {
  const f = file({ "28.5,77.5": 360 }, 217);
  const hot = compareWithNormal(28.5, 77.5, { date: MAY25, max_c: 41.4, elevation_m: 217 }, f)!;
  assert.deepEqual(hot, {
    today_max_c: 41,
    normal_max_c: 36,
    anomaly_c: 5,
    notable: true,
    date: MAY25,
    period: "late May",
    baseline: "1991-2020 normals",
    source: "era5",
  });
  const at = (max_c: number) => compareWithNormal(28.5, 77.5, { date: MAY25, max_c }, f)!;
  assert.equal(at(37).notable, false);
  assert.equal(at(30).anomaly_c, -6);
  assert.equal(at(30).notable, true);
  assert.equal(at(36 + ANOMALY_NOTABLE_C).notable, true);
  assert.equal(at(36 + ANOMALY_NOTABLE_C - 0.6).notable, false);
});

test("compareWithNormal: notable is decided on the unrounded difference; the shown numbers still add up", () => {
  const f = file({ "28.5,77.5": 384 }); // 38.4
  const near = compareWithNormal(28.5, 77.5, { date: MAY25, max_c: 41.3 }, f)!; // 2.9 apart
  assert.deepEqual([near.today_max_c, near.normal_max_c, near.anomaly_c, near.notable], [41, 38, 3, false]);
  const edge = compareWithNormal(28.5, 77.5, { date: MAY25, max_c: 40.51 }, file({ "28.5,77.5": 375 }))!; // 3.01
  assert.deepEqual([edge.today_max_c, edge.normal_max_c, edge.anomaly_c, edge.notable], [41, 38, 3, true]);
});

test("normalMaxAt: a node with a gap in its year is treated as missing, never read as 0 °C", () => {
  const f: NormalsFile = { step: 1, nodes: { "28.5,77.5": [200, ...Array(51).fill(400), null as unknown as number] } };
  assert.equal(normalMaxAt(28.5, 77.5, "2026-12-30", undefined, f), null);
  assert.equal(normalMaxAt(28.5, 77.5, "2026-06-15", undefined, f), 40, "the rest of its year still reads");
});

test("heatVsNormalShown: only notable, and only on the local (IST) day the high is for", () => {
  const h = compareWithNormal(28.5, 77.5, { date: MAY25, max_c: 41 }, file({ "28.5,77.5": 360 }))!;
  assert.equal(heatVsNormalShown(h, new Date("2026-05-25T18:20:00Z")), true); // 23:50 IST
  assert.equal(heatVsNormalShown(h, new Date("2026-05-25T18:40:00Z")), false); // 00:10 IST next day
  assert.equal(heatVsNormalShown({ ...h, notable: false }, new Date("2026-05-25T06:00:00Z")), false);
  assert.equal(heatVsNormalShown(null, new Date("2026-05-25T06:00:00Z")), false);
});

test("compareWithNormal: null without a forecast high or without a normal here", () => {
  const f = file({ "28.5,77.5": 400 });
  assert.equal(compareWithNormal(28.5, 77.5, null, f), null);
  assert.equal(compareWithNormal(12.9, 77.6, { date: MAY25, max_c: 33 }, f), null);
});

test("periodText: early (1-10), mid (11-20), late (21+) month, localised month names", () => {
  assert.equal(periodText("2026-05-01", "en"), "early May");
  assert.equal(periodText("2026-05-15", "en"), "mid May");
  assert.equal(periodText("2026-05-31", "en"), "late May");
  assert.match(periodText("2026-05-31", "hi"), /मई/);
  assert.match(periodText("2026-05-31", "kn"), /ಮೇ/);
});

test("heatVsNormalLine: above / below in plain words, no em-dash, never 'heatwave'", () => {
  const f = file({ "28.5,77.5": 360 });
  const hot = compareWithNormal(28.5, 77.5, { date: MAY25, max_c: 41 }, f)!;
  assert.equal(heatVsNormalLine(hot, "en"), "The high today is 41°C. That is 5°C above normal for late May.");
  const cool = compareWithNormal(28.5, 77.5, { date: MAY25, max_c: 31 }, f)!;
  assert.equal(heatVsNormalLine(cool, "en"), "The high today is 31°C. That is 5°C below normal for late May.");
  for (const lang of ["hi", "kn"] as const) {
    const s = heatVsNormalLine(hot, lang);
    assert.match(s, /41/);
    assert.match(s, /5/);
    assert.doesNotMatch(s, /high today/, `${lang} is translated`);
  }
  for (const s of [heatVsNormalLine(hot, "en"), heatVsNormalLine(cool, "en")]) {
    assert.doesNotMatch(s, /—|heat ?wave/i);
  }
});
