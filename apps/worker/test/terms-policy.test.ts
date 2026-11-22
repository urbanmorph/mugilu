import { test } from "node:test";
import assert from "node:assert/strict";
import { renderTerms } from "../src/pages/terms";

// /terms carries the policies the Digital Public Goods Standard asks for (indicators 3, 7, 9):
// who owns mugilu, the privacy policy in full (what is kept, for how long, any age, how to
// delete, whom to ask), the laws it follows, and how wrong or illegal content is reported.

const text = (h: string) =>
  h
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ");

test("/terms: ownership, said plainly", () => {
  const s = text(renderTerms("en"));
  assert.match(s, /mugilu is owned by Sathya and built by Urban Morph\./);
  assert.match(renderTerms("en"), /id="owner"/);
});

test("/terms: the privacy policy says how long data is kept, any age, and how to delete it", () => {
  const s = text(renderTerms("en"));
  assert.match(s, /Usage counts are kept as totals\. The detailed events are deleted after 3 months\./);
  assert.match(s, /mugilu has no accounts and asks for no personal data, so people of any age can use it safely\./);
  assert.match(s, /To delete your alert data, turn the alert off\./);
});

test("/terms: the laws, and how to report wrong, harmful or illegal content, with a response time", () => {
  const html = renderTerms("en");
  const s = text(html);
  assert.match(s, /Information Technology Act, 2000/);
  assert.match(s, /Digital Personal Data Protection Act, 2023/);
  assert.match(s, /mugilu has no user posts, comments or uploads\./);
  assert.match(s, /We answer within 7 days/);
  assert.match(html, /id="content"/);
  // The report route is the project's contact email.
  assert.match(html, /<a href="mailto:sathya@urbanmorph\.com" lang="en">sathya@urbanmorph\.com<\/a>/);
});

test("/terms (hi, kn): the new sections are translated", () => {
  for (const lang of ["hi", "kn"] as const) {
    const s = text(renderTerms(lang));
    for (const en of [/owned by/, /kept as totals/, /any age/, /no user posts/, /We answer within/])
      assert.doesNotMatch(s, en, `${lang}: ${en}`);
    assert.match(s, /Sathya/);
  }
});
