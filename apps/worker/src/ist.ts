// Times in India Standard Time, one module for every surface. Each formatter takes a Date, an
// ISO string or epoch milliseconds, and returns "" for anything that is not a time.

type When = Date | string | number;
const toDate = (w: When): Date => (w instanceof Date ? w : new Date(w));

const IST_HM = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const IST_DM = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
const IST_SHORT = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const IST_YEAR = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** A page stamp: "14:32 IST · 27 Jun". */
export function istTime(w: When): string {
  const d = toDate(w);
  return isNaN(d.getTime()) ? "" : `${IST_HM.format(d)} IST · ${IST_DM.format(d)}`;
}

/** The day alone: "27 Jun". */
export function istDay(w: When): string {
  const d = toDate(w);
  return isNaN(d.getTime()) ? "" : IST_DM.format(d);
}

/** The clock time alone: "08:45 IST" (for a sentence that already says the day). */
export function istClock(w: When): string {
  const d = toDate(w);
  return isNaN(d.getTime()) ? "" : `${IST_HM.format(d)} IST`;
}

/** An IST stamp for images and Markdown: "25 Oct, 12:29 IST" (or "25 Oct 2026, 12:29 IST"). */
export function istStamp(w: When, withYear = false): string {
  const d = toDate(w);
  return isNaN(d.getTime()) ? "" : (withYear ? IST_YEAR : IST_SHORT).format(d) + " IST";
}

/** The ISO form of a time ("" when it is not one), for a datetime attribute. */
export function isoOf(w: When): string {
  const d = toDate(w);
  return isNaN(d.getTime()) ? "" : d.toISOString();
}

// India's calendar day as YYYY-MM-DD: the daily files, the trends and the warning history
// count days the way India does. IST has no daylight saving, so a day is always 24 hours.
const IST_OFFSET_MS = 5.5 * 3_600_000;
const DAY_MS = 86_400_000;

/** The India day (YYYY-MM-DD) a moment falls on. */
export const istIsoDay = (ms: number): string => new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);

/** The moment an India day (YYYY-MM-DD) begins. */
export const istDayStart = (day: string): number => Date.parse(`${day}T00:00:00+05:30`);

/** The India day `n` days after `day` (before it, when `n` is negative). */
export const istDayAdd = (day: string, n: number): string => istIsoDay(istDayStart(day) + (n + 0.5) * DAY_MS);
