// An official warning's title, in IMD's own words: the category and the storm's name.
import { test } from "node:test";
import assert from "node:assert/strict";
import { warningTitle } from "../src/pages/read";
import type { Warning } from "../src/types";

const w = (headline: string | undefined, event = "Cyclone") => ({ event, headline }) as unknown as Warning;

test("warningTitle: IMD's category and the storm's name, from the message", () => {
  const akvan =
    "The SEVERE CYCLONIC STORM AKVAN with maximum wind speed of 90-100 gusting to 110 Kmph lays centred at 1130 IST";
  assert.equal(warningTitle(w(akvan)), "Severe Cyclonic Storm Akvan");
  assert.equal(warningTitle(w("VERY SEVERE CYCLONIC STORM MONTHA over the Bay")), "Very Severe Cyclonic Storm Montha");
});

test("warningTitle: no name in the message, or no message: the warning's own type", () => {
  assert.equal(warningTitle(w("A Cyclonic Storm with gusts over the sea")), "Cyclone");
  assert.equal(warningTitle(w(undefined, "Lightning")), "Lightning");
  assert.equal(warningTitle(w("Heavy rain likely", "Heavy Rain")), "Heavy Rain");
});
