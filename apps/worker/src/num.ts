// Small number helpers shared by the daily summaries, the trends and the graphics.

/** The middle value of a list (the mean of the middle two for an even count); the list is not
 *  changed. */
export const median = (v: number[]): number => {
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** A number to one decimal place. */
export const r1 = (n: number): number => Math.round(n * 10) / 10;
