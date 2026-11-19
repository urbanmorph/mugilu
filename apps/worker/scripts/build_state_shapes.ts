// Build data/states.json: one clickable outline per state or Union Territory for the /places
// map, keyed by the state names the place directory uses (slugPlacesByState), as SVG path
// data in the India map's pixels (the projection in indiamap.ts).
//
// Source: bharatlas lgd_states (Local Government Directory, CC0 / CC-BY), already projected
// and simplified to about 1.5 km (supporting-docs/redesign/gen/states.json). Each outline is then
// simplified again to TOLERANCE map pixels (the detail the map can show) and written with
// relative steps; every ring is kept, so small islands stay clickable.
// Usage: npx tsx scripts/build_state_shapes.ts <lgd-projected.json>
import { readFileSync, writeFileSync } from "node:fs";
import { slugPlacesByState } from "../src/slugs";
import { simplifyPath } from "../src/simplify-path";

/** Map pixels: below this a bend is not visible at the /places map's size. */
const TOLERANCE = 0.4;

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z]/g, "");

/** Similarity of two names: the share of the shorter's letters found in order in the longer. */
function similar(a: string, b: string): number {
  const [x, y] = a.length <= b.length ? [a, b] : [b, a];
  let i = 0;
  for (const ch of y) if (ch === x[i]) i++;
  return i / Math.max(x.length, 1) - Math.abs(a.length - b.length) / 100;
}

const src = JSON.parse(readFileSync(process.argv[2], "utf8")) as Record<string, string>;
const names = slugPlacesByState().map((g) => g.state);
const out: Record<string, string> = {};
for (const [lgd, d] of Object.entries(src)) {
  const best = names.reduce((a, b) => (similar(norm(b), norm(lgd)) > similar(norm(a), norm(lgd)) ? b : a));
  out[best] = (out[best] ?? "") + d;
  console.log(`${lgd} -> ${best}`);
}
const missing = names.filter((n) => !out[n]);
if (missing.length) throw new Error(`no outline for: ${missing.join(", ")}`);
for (const k of Object.keys(out)) out[k] = simplifyPath(out[k], TOLERANCE);
writeFileSync(new URL("../data/states.json", import.meta.url), JSON.stringify(out));
console.log(`${Object.keys(out).length} states written`);
