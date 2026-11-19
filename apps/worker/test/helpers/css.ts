import { SITE_CSS, SITE_CSS_LINK } from "../../src/ui/assets";

/** A page with its linked site stylesheet put back inline, for tests that check which CSS
 *  rules a page gets (the page itself links the one cached file). */
export const withCss = (html: string): string => html.replace(SITE_CSS_LINK, () => `<style>${SITE_CSS}</style>`);
