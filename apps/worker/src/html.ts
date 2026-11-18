// Small helpers shared by every renderer (page.ts, og.ts, formats.ts): HTML escaping
// and IST timestamps.

const ENTITY: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Safe in text AND in quoted attribute values (upstream names, warning text). */
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ENTITY[c]);
}

/** Markup a component may place as is. Only code that built it from escaped parts and its own
 *  tags wraps a string so (`trusted`); a plain string given where Html is allowed is escaped. */
export class Html {
  constructor(readonly markup: string) {}
  toString(): string {
    return this.markup;
  }
}
export const trusted = (markup: string): Html => new Html(markup);
/** A label that is text (escaped) or trusted markup (kept as is). */
export const textOrHtml = (s: string | Html): string => (s instanceof Html ? s.markup : esc(s));
