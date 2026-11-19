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
