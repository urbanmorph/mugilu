// Douglas-Peucker for SVG ring paths (M…L…Z), written back with relative commands.
// Used by scripts/build_state_shapes.ts (the /places outlines) and the official warning areas
// (warnareas.ts, indiamap.ts): they only need the detail the map can show (about 0.4 px at
// its size), and relative steps are shorter than absolute points.

export type Pt = [number, number];

/** The rings of an absolute M/L/Z path. */
export function parseRings(d: string): Pt[][] {
  return d
    .split(/Z/i)
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) =>
      r
        .replace(/^M/i, "")
        .split(/L/i)
        .map(
          (p) =>
            p
              .trim()
              .split(/[\s,]+/)
              .map(Number) as Pt,
        ),
    );
}

/** The rings of an M + relative l path (the output of simplifyPath), as absolute points. */
export function ringsOf(d: string): Pt[][] {
  return (d.match(/M[^M]*/g) ?? []).map((ring) => {
    const nums = (ring.match(/-?\d*\.?\d+/g) ?? []).map(Number);
    const pts: Pt[] = [[nums[0], nums[1]]];
    // Relative steps are rounded per step, so rebuild from the integer tenths.
    let x = Math.round(nums[0] * 10);
    let y = Math.round(nums[1] * 10);
    for (let i = 2; i + 1 < nums.length; i += 2) {
      x += Math.round(nums[i] * 10);
      y += Math.round(nums[i + 1] * 10);
      pts.push([x / 10, y / 10]);
    }
    return pts;
  });
}

function dist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (!len) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
}

function dp(pts: Pt[], tol: number): Pt[] {
  if (pts.length < 3) return pts;
  let max = 0;
  let at = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = dist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > max) [max, at] = [d, i];
  }
  if (max <= tol) return [pts[0], pts[pts.length - 1]];
  return [...dp(pts.slice(0, at + 1), tol).slice(0, -1), ...dp(pts.slice(at), tol)];
}

/** A closed ring keeps at least a triangle, so a tiny island never disappears. The ring comes
 *  back open (no repeat of the first point). */
export function simplifyRing(ring: Pt[], tol: number): Pt[] {
  const open =
    ring.length > 1 && ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1] ? ring.slice(0, -1) : ring;
  if (open.length <= 3) return open;
  // Split the ring at its farthest point from the start so both halves have fixed ends.
  let far = 1;
  for (let i = 1; i < open.length; i++)
    if (
      Math.hypot(open[i][0] - open[0][0], open[i][1] - open[0][1]) >
      Math.hypot(open[far][0] - open[0][0], open[far][1] - open[0][1])
    )
      far = i;
  const a = dp(open.slice(0, far + 1), tol);
  const b = dp([...open.slice(far), open[0]], tol);
  const out = [...a.slice(0, -1), ...b.slice(0, -1)];
  return out.length >= 3 ? out : open.slice(0, 3);
}

const tenth = (v: number) => Math.round(v * 10);
const num = (t: number) => {
  const s = (t / 10).toString();
  return s.startsWith("0.") ? s.slice(1) : s.startsWith("-0.") ? "-" + s.slice(2) : s;
};

/** Simplify every ring of an absolute M/L/Z path to `tol` and write it as M + relative l steps. */
export function simplifyPath(d: string, tol: number): string {
  return parseRings(d)
    .map((ring) => {
      const pts = simplifyRing(ring, tol);
      let [x, y] = [tenth(pts[0][0]), tenth(pts[0][1])];
      let s = `M${num(x)} ${num(y)}l`;
      const steps: string[] = [];
      for (const p of pts.slice(1)) {
        const [nx, ny] = [tenth(p[0]), tenth(p[1])];
        const dy = num(ny - y);
        steps.push(num(nx - x) + (dy.startsWith("-") ? dy : " " + dy));
        [x, y] = [nx, ny];
      }
      return s + steps.join(" ") + "z";
    })
    .join("");
}
