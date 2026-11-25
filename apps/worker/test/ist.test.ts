import { test } from "node:test";
import assert from "node:assert/strict";
import { earliestIso, istDayAdd, istDayStart, istIsoDay } from "../src/ist";
import { median, r1 } from "../src/num";

// India's calendar day, in one place: the daily files, the trends and the warning history
// all count days the way India does, not UTC's.

test("istIsoDay: the India day a moment falls on, not UTC's", () => {
  assert.equal(istIsoDay(Date.parse("2026-11-24T18:29:59Z")), "2026-11-24");
  assert.equal(istIsoDay(Date.parse("2026-11-24T18:30:00Z")), "2026-11-25", "midnight in India");
});

test("istDayStart: the moment an India day begins", () => {
  assert.equal(istDayStart("2026-11-25"), Date.parse("2026-11-24T18:30:00Z"));
});

test("istDayAdd: days forward and back, across a month and a year", () => {
  assert.equal(istDayAdd("2026-11-30", 1), "2026-12-01");
  assert.equal(istDayAdd("2027-01-01", -1), "2026-12-31");
  assert.equal(istDayAdd("2026-11-24", 0), "2026-11-24");
  assert.equal(istDayAdd("2026-11-24", -30), "2026-10-25");
});

test("median: the middle value, or the mean of the middle two; the input is left as it was", () => {
  const v = [5, 1, 3];
  assert.equal(median(v), 3);
  assert.deepEqual(v, [5, 1, 3]);
  assert.equal(median([4, 1, 3, 2]), 2.5);
});

test("r1: one decimal place", () => {
  assert.equal(r1(12.345), 12.3);
  assert.equal(r1(72), 72);
  assert.equal(r1(0.05), 0.1);
});

test("earliestIso: the oldest of the times given, ignoring absent ones", () => {
  assert.equal(
    earliestIso("2026-11-25T03:00:00.000Z", undefined, "2026-11-25T01:00:00.000Z"),
    "2026-11-25T01:00:00.000Z",
  );
  assert.equal(earliestIso(undefined, undefined), undefined);
});
