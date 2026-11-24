// Finds blocks of code repeated across (or within) source files: `window` consecutive lines,
// each a real line (comments, imports and short lines such as `}` skipped), together at least
// `minChars` long. Whitespace is ignored. W17 in supporting-docs/platform-audit-tracker-2026-11-24.md.

export interface Source {
  path: string;
  text: string;
}

export function repeatedBlocks(files: Source[], window = 4, minLine = 13, minChars = 140): string[][] {
  const seen = new Map<string, string[]>();
  for (const { path, text } of files) {
    const lines = text
      .split("\n")
      .map((l, i) => [i + 1, l.replace(/\s+/g, " ").trim()] as const)
      .filter(([, l]) => l.length >= minLine && !/^(\/\/|\*|\/\*\*|import )/.test(l));
    for (let k = 0; k + window <= lines.length; k++) {
      const block = lines.slice(k, k + window);
      const key = block.map(([, l]) => l).join("\n");
      if (key.length < minChars) continue;
      const at = seen.get(key) ?? [];
      at.push(`${path}:${block[0][0]}`);
      seen.set(key, at);
    }
  }
  // One entry per repeat: overlapping windows of the same copy collapse to its first line.
  const out: string[][] = [];
  let last: string[] | undefined;
  for (const at of [...seen.values()].filter((a) => a.length > 1)) {
    const files = at.map((x) => x.split(":")[0]).join();
    const near =
      last &&
      last.map((x) => x.split(":")[0]).join() === files &&
      at.every((x, i) => Math.abs(+x.split(":")[1] - +last![i].split(":")[1]) <= window + 2);
    if (!near) out.push(at);
    last = at;
  }
  return out;
}
