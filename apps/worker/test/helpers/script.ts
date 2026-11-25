import { scriptText } from "../../src/scripts";

/** A page's HTML with its script file's content after it, for tests that read what a page does
 *  (W20 moved each page's script out of the HTML into /assets/js/...). */
export function withScript(html: string): string {
  const src = html.match(/<script src="(\/assets\/js\/[^"]+)"/)?.[1];
  return src ? `${html}\n<script>${scriptText(src)}</script>` : html;
}
