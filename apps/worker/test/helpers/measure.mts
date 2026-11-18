// Not a test: prints raw/gz sizes of rendered pages for the perf round.
import { gzipSync } from "node:zlib";
import { testWorker } from "./worker.ts";
const w = testWorker();
const paths = [
  "/",
  "/c/delhi",
  "/places",
  "/warnings",
  "/hi/c/delhi",
  "/c/delhi?kiosk",
  "/embed/28.61,77.21",
  "/sw.js",
  "/about",
];
const rows: string[] = [];
for (const p of paths) {
  const r = await w.get(p, { headers: { Accept: "text/html" } });
  const b = Buffer.from(await r.arrayBuffer());
  rows.push(`${p}\t${r.status}\t${b.length}\t${gzipSync(b).length}`);
}
console.log(rows.join("\n"));
