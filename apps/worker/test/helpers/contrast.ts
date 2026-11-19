// WCAG contrast arithmetic for the colour tests: one copy for every test that checks it.

export const hex = (h: string): number[] => (h.match(/\w\w/g) ?? []).map((x) => parseInt(x, 16));

const lum = (c: number[]) => {
  const v = c.map((x) => x / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};

/** The contrast ratio of two colours, each a hex string or an [r,g,b] triple. */
export const contrast = (a: string | number[], b: string | number[]): number => {
  const [x, y] = [lum(typeof a === "string" ? hex(a) : a), lum(typeof b === "string" ? hex(b) : b)].sort(
    (p, q) => q - p,
  );
  return (x + 0.05) / (y + 0.05);
};

/** `p` (0-1) of hue `h` mixed into ground `g`, as color-mix(in srgb) does. */
export const mix = (h: string, g: string, p: number): number[] => hex(h).map((v, i) => v * p + hex(g)[i] * (1 - p));
