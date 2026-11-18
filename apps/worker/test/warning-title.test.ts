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
  assert.equal(warningTitle(w("A Cyclonic Storm with gusts over the sea")), "Cyclonic Storm");
  assert.equal(warningTitle(w(undefined, "Lightning")), "Lightning");
  assert.equal(warningTitle(w("Heavy rain likely", "Heavy Rain")), "Heavy Rain");
});

import { cycloneIn } from "../src/sachet";

test("cycloneIn: ordinary words after the category are not storm names", () => {
  const cat = (h: string) => cycloneIn(h)?.title;
  assert.equal(cat("Cyclonic Storm Warning for Puri, Ganjam and Khordha"), "Cyclonic Storm");
  assert.equal(
    cat("The depression is likely to intensify into a Cyclonic Storm during the next 12 hours"),
    "Cyclonic Storm",
  );
  assert.equal(cat("Severe Cyclonic Storm weakened into a Cyclonic Storm over the Bay"), "Severe Cyclonic Storm");
  assert.equal(cat("SEVERE CYCLONIC STORM INTENSIFIED FURTHER"), "Severe Cyclonic Storm");
  assert.equal(cat("Cyclonic Storm Alert for coastal Odisha"), "Cyclonic Storm");
  assert.equal(cat("Very Severe Cyclonic Storm The system lay centred"), "Very Severe Cyclonic Storm");
});

test("cycloneIn: a name is a capitalised word that is not a common word", () => {
  assert.deepEqual(cycloneIn("The SEVERE CYCLONIC STORM AKVAN with maximum wind speed"), {
    title: "Severe Cyclonic Storm Akvan",
    name: "Akvan",
  });
  assert.deepEqual(cycloneIn('Cyclonic Storm "Montha" over the west central Bay'), {
    title: "Cyclonic Storm Montha",
    name: "Montha",
  });
  assert.equal(cycloneIn("Heavy rain likely over Kerala"), undefined);
});
