import { test } from "node:test";
import assert from "node:assert/strict";
import { sentences, splitAs } from "../src/pages/text";

test("sentences: splits at sentence ends, never inside brackets or a quote in brackets", () => {
  assert.deepEqual(sentences("One. Two? Three!"), ["One.", "Two?", "Three!"]);
  assert.deepEqual(sentences('It says ("The air is moderate. For asthma, treat it as high."), then more. Next.'), [
    'It says ("The air is moderate. For asthma, treat it as high."), then more.',
    "Next.",
  ]);
  // Devanagari full stop
  assert.deepEqual(sentences("पहला वाक्य। दूसरा वाक्य।"), ["पहला वाक्य।", "दूसरा वाक्य।"]);
  // a decimal or a version number is not a sentence end
  assert.deepEqual(sentences("Version 2.0 of it. Done."), ["Version 2.0 of it.", "Done."]);
});

test("splitAs: the English markup and the translation split alike, or the paragraph stays whole", () => {
  const key = "First one. Second one.";
  // English: the markup version, split
  assert.deepEqual(splitAs("<b>First</b> one. Second one.", key, "en", 2), ["<b>First</b> one.", "Second one."]);
  // a translation that splits into the same count is used sentence by sentence
  const tr = { [key]: { hi: "पहला। दूसरा।" } };
  assert.deepEqual(splitAs("", key, "hi", 2, tr), ["पहला।", "दूसरा।"]);
  // a translation that does not split cleanly is kept whole (null: render the paragraph)
  const bad = { [key]: { hi: "एक ही वाक्य।" } };
  assert.equal(splitAs("", key, "hi", 2, bad), null);
});
