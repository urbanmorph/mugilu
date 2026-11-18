// Every page in Hindi and Kannada: an English sentence a reader sees is either a translation
// key (so the language pass can fill it) or marked lang="en" (so a screen reader switches
// voice). Nothing English reaches a hi/kn page unplumbed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { testWorker } from "./helpers/worker";
import { TR } from "../src/i18n";
import { readFileSync, readdirSync } from "node:fs";

const w = testWorker();
const PAGES = [
  "/",
  "/c/delhi",
  "/c/delhi?kiosk",
  "/embed/28.61,77.21",
  "/s/cpcb/6081",
  "/places",
  "/warnings",
  "/display",
  "/about",
  "/methodology",
  "/terms",
  "/mcp",
  "/no-such-page",
];

// A text run reads as English when it has two or more of these words.
const FUNCTION = new Set(
  "the of and is a an in to for with your you this on at from by not are be or it its that it's here now".split(" "),
);
const words = (s: string) => s.toLowerCase().match(/[a-z']+/g) ?? [];
const norm = (s: string) => words(s.replace(/\{[^}]*\}|\bX\b/g, " ").replace(/\d+/g, " ")).filter((x) => x.length > 1);
const KEYS = Object.keys(TR).map((k) => new Set(norm(k.replace(/<[^>]+>/g, " "))));

/** A run belongs to some key when most of its words are in that key (data such as place
 *  names and numbers fill the key's slots, so it is never an exact match). */
function isKey(run: string): boolean {
  const ws = norm(run);
  if (!ws.length) return true;
  return KEYS.some((k) => ws.filter((x) => k.has(x)).length / ws.length >= 0.75);
}

/** The visible text runs outside any element marked with a language other than the page's. */
function runs(html: string): string[] {
  const body = html
    .replace(/<(script|style|svg|template)\b[\s\S]*?<\/\1>/g, " ")
    // Drop elements that declare their own language (lang="en", "te", …), innermost first.
    .replace(/<(\w+)[^>]*\blang="(?!hi|kn)[a-z-]+"[^>]*>[\s\S]*?<\/\1>/g, " ");
  return body
    .split(/<[^>]+>/)
    .map((s) =>
      s
        .replace(/&[a-z#0-9]+;/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((s) => words(s).filter((x) => FUNCTION.has(x)).length >= 2);
}

for (const lang of ["hi", "kn"] as const) {
  test(`${lang}: no unplumbed English on any page`, async () => {
    const leaks: string[] = [];
    for (const p of PAGES) {
      const res = await w.get(`/${lang}${p === "/" ? "" : p}`, { headers: { accept: "text/html" } });
      const html = await res.text();
      for (const r of runs(html)) if (!isKey(r)) leaks.push(`${p}: ${r.slice(0, 90)}`);
    }
    assert.deepEqual(leaks, []);
  });
}

test("every literal t() key in the source is in the translation table", () => {
  const dir = new URL("../src/", import.meta.url);
  const files = (d: URL): URL[] =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? files(new URL(e.name + "/", d)) : e.name.endsWith(".ts") ? [new URL(e.name, d)] : [],
    );
  const missing = new Set<string>();
  for (const f of files(dir)) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)+)"\s*[,)]/g)) {
      const key = JSON.parse(`"${m[1]}"`);
      if (!(key in TR)) missing.add(`${f.pathname.split("/src/")[1]}: ${key}`);
    }
  }
  assert.deepEqual([...missing].sort(), []);
});
