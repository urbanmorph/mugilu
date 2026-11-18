import { test } from "node:test";
import assert from "node:assert/strict";
import { sentences, splitAs } from "../src/pages/text";
import { TR } from "../src/i18n";

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

test("sentences: an abbreviation's full stop does not end a sentence", () => {
  assert.deepEqual(sentences("Air from CPCB, e.g. Delhi. Then more."), ["Air from CPCB, e.g. Delhi.", "Then more."]);
  assert.deepEqual(sentences("Run by the Govt. of India. Done."), ["Run by the Govt. of India.", "Done."]);
});

// Every live paragraph a text page lays out over boxes (its English opening, and how many
// sentences it splits into). A translation must split the same way, sentence for sentence.
const SPLIT: [opening: string, n: number][] = [
  ["Type a place.", 4],
  ["mugilu owns no sensors", 3],
  ["The sky over you is a commons.", 3],
  ["Each hazard is scored 0", 4],
  ["Pick a vulnerability", 4],
  ["Heat takes the worst", 3],
  ["On days when it stands out", 3],
  ["Informational and educational only", 4],
  ["The mugilu code is MIT", 3],
  ["No accounts, no sign-up", 4],
];

test("split paragraphs: each translated sentence lines up with its English one (slots, numbers, acronyms)", () => {
  // What must travel with its sentence: {slots}, numbers, and Latin acronyms (NDMA, CPCB, MIT).
  const marks = (s: string) => new Set(s.match(/\{\w+\}|\d+(?:[.,]\d+)?|\b[A-Z]{2,}\b/g) ?? []);
  for (const [opening, n] of SPLIT) {
    const key = Object.keys(TR).find((k) => k.startsWith(opening));
    assert.ok(key, `no live paragraph starts "${opening}"`);
    const en = sentences(key);
    assert.equal(en.length, n, `English "${opening}" splits into ${en.length}`);
    for (const lang of ["hi", "kn"] as const) {
      const parts = splitAs(key, key, lang, n);
      assert.ok(parts, `${lang} "${opening}" does not split into ${n}`);
      parts.forEach((p, i) => {
        assert.ok(p.trim(), `${lang} "${opening}" part ${i} is empty`);
        for (const m of marks(en[i])) assert.ok(p.includes(m), `${lang} "${opening}" part ${i} lacks ${m}`);
      });
    }
  }
});
