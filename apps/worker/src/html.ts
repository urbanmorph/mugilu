// HTML escaping shared by every renderer (page.ts, og.ts).

const ENTITY: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Safe in text AND in quoted attribute values (upstream names, warning text). */
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ENTITY[c]);
}
