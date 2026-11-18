// Client-side scripts that put stored or URL-borne text into the page: one escape for
// every attribute and text position, and the place recorder never stores raw input.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CLIENT_ESC } from "../src/ui/shell";
import { comboboxJs } from "../src/ui/components";
import { PLACE_RECORDER } from "../src/pages/read";

const esc: (s: unknown) => string = new Function(`${CLIENT_ESC};return esc;`)();

test("the client escape covers every character that can leave an attribute or open a tag", () => {
  assert.equal(esc(`<a href="x" onclick='y'>&`), "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;");
  // The exact payload a crafted #q= label carried into an aria-label on home.
  const label = `Favourite ä" autofocus onfocus="alert(1)`;
  assert.ok(!esc(label).includes('"'));
});

test("the combobox uses the one shared escape, not a private copy", () => {
  const js = comboboxJs("q", "en");
  assert.ok(js.includes(CLIENT_ESC), "comboboxJs embeds CLIENT_ESC");
  assert.equal(js.match(/function esc\(/g)?.length, 1);
});

/** Run PLACE_RECORDER against a fake page and return what it stored. */
function record(path: string, hash: string, h1 = "Delhi", ll = "28.61,77.21") {
  const store = new Map<string, string>();
  const src = PLACE_RECORDER.replace(/^<script>|<\/script>$/g, "");
  const env = {
    location: { pathname: path, hash, search: "" },
    document: { querySelector: () => ({ getAttribute: () => ll, textContent: h1 }) },
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) },
    history: { replaceState() {} },
  };
  new Function(...Object.keys(env), src)(...Object.values(env));
  return JSON.parse(store.get("mugilu:places") ?? "[]");
}

test("the place recorder strips control characters and caps a #q= label", () => {
  const evil = encodeURIComponent("ä" + "\u0000\u001b" + "x".repeat(500));
  const [p] = record("/c/delhi", "#q=" + evil);
  assert.ok(!/[\u0000-\u001f]/.test(p.label));
  assert.ok(p.label.length <= 80, `label is ${p.label.length} characters`);
});

test("the place recorder keeps only numeric coordinates", () => {
  assert.deepEqual(record("/c/delhi", "", "Delhi", `28.6,77"><x`), []);
  const [p] = record("/c/28.6,77.2", "", "Somewhere", "28.6,77.2");
  assert.equal(typeof p.lat, "number");
});
