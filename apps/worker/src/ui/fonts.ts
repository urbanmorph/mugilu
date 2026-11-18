// The type faces, self-hosted (public/fonts, SIL OFL 1.1, Google Fonts' own subsets of Anek):
// no third-party request, nothing render-blocking. A face downloads only when a page shows its
// glyphs. Latin swaps in and is preloaded (the condensed headings need it); the Indic faces are
// optional, so a first view keeps the system face instead of repainting its largest text late
// (the next view has Anek from the cache). Non-Latin text is never condensed (tokens), so those
// faces carry the weight axis alone. The "-1" in a file name is its version: change the file,
// change the name (the files are cached as immutable, public/_headers).
export const LATIN_FONT = "/fonts/anek-latin-1.woff2";
export const FONT_FACES =
  "@font-face{font-family:'Anek Latin';src:url(/fonts/anek-latin-ext-1.woff2) format('woff2');font-weight:400 800;font-stretch:75% 100%;font-display:swap;unicode-range:U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF}" +
  "@font-face{font-family:'Anek Latin';src:url(/fonts/anek-latin-1.woff2) format('woff2');font-weight:400 800;font-stretch:75% 100%;font-display:swap;unicode-range:U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD}" +
  "@font-face{font-family:'Anek Devanagari';src:url(/fonts/anek-devanagari-1.woff2) format('woff2');font-weight:400 800;font-stretch:100%;font-display:optional;unicode-range:U+0900-097F, U+1CD0-1CF4, U+1CF7-1CF9, U+200C-200D, U+20A8, U+20B9, U+20F0, U+25CC, U+A830-A839, U+A8E0-A8FF, U+11B00-11B0A}" +
  "@font-face{font-family:'Anek Kannada';src:url(/fonts/anek-kannada-1.woff2) format('woff2');font-weight:400 800;font-stretch:100%;font-display:optional;unicode-range:U+0951-0952, U+0964-0965, U+0B83, U+0C80-0CF3, U+1CD0, U+1CD2-1CD3, U+1CDA, U+1CF2, U+1CF4, U+200C-200D, U+20B9, U+25CC, U+A830-A835}" +
  "@font-face{font-family:'Anek Telugu';src:url(/fonts/anek-telugu-1.woff2) format('woff2');font-weight:400 800;font-stretch:100%;font-display:optional;unicode-range:U+0951-0952, U+0964-0965, U+0B83, U+0C00-0C7F, U+1CD5-1CD6, U+1CD8, U+1CDA, U+1CF2, U+200C-200D, U+25CC}" +
  "@font-face{font-family:'Anek Bangla';src:url(/fonts/anek-bangla-1.woff2) format('woff2');font-weight:400 800;font-stretch:100%;font-display:optional;unicode-range:U+0951-0952, U+0964-0965, U+0980-09FE, U+1CD0, U+1CD2, U+1CD5-1CD6, U+1CD8, U+1CE1, U+1CEA, U+1CED, U+1CF2, U+1CF5-1CF7, U+200C-200D, U+20B9, U+25CC, U+A8F1, U+11DF0-11DF1}";
