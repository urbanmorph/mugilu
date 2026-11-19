// One-off: the live English text of the text pages as sentences, for test/fixtures/live-text.json.
// Run: npx tsx scripts/live-text.ts <dir with about.html methodology.html terms.html mcp.html>
// The redesign test asserts every one of these sentences is still on the new page.
import { readFileSync, writeFileSync } from "node:fs";
import { sentences } from "../src/pages/text";

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");

const out: Record<string, string[]> = {};
for (const page of ["about", "methodology", "terms", "mcp"]) {
  const html = readFileSync(`${process.argv[2]}/${page}.html`, "utf8");
  const from = html.indexOf("<h1");
  const to = html.indexOf('class="aback"');
  const region = html
    .slice(from, to)
    .replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/g, "")
    .replace(/<br\s*\/?>/g, " ")
    .replace(/<\/(p|li|h\d|th|td|tr|div)>/g, "\n");
  const text = decode(region.replace(/<[^>]+>/g, ""));
  out[page] = text
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => /[a-z]{3}/i.test(l))
    .flatMap((l) => sentences(l));
}
writeFileSync("test/fixtures/live-text.json", JSON.stringify(out, null, 1) + "\n");
console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])));
