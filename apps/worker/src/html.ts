// Small helpers shared by every renderer (page.ts, og.ts, formats.ts): HTML escaping
// and IST timestamps.

const ENTITY: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Safe in text AND in quoted attribute values (upstream names, warning text). */
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ENTITY[c]);
}

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

/** An IST stamp for images and Markdown: "25 Oct, 12:29 IST" (or "25 Oct 2026, 12:29 IST"). */
export function istStamp(iso: string, withYear = false): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : (withYear ? IST_YEAR : IST_SHORT).format(d) + " IST";
}
