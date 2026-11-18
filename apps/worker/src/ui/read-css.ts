// The standard's components for a place's read (design-standard.md §4: ReadingRow, the place
// hero, the persona tag, the UV steps, the screen display's loading veil). Tokens only;
// imported once into standard.ts.

export const READ_CSS = `
.mg .fy{display:inline-block;white-space:nowrap;margin-left:var(--sp2);padding:0 6px;border:2px solid currentColor;border-radius:var(--r);font-size:var(--t-xs);font-weight:800;letter-spacing:.06em;color:var(--ink);vertical-align:.1em}
.mg .rrow.on .lab{color:var(--ink)}
.mg .rrow .more .key{font-weight:800}
.mg .uvs i.off{opacity:.25}
.mg .uvs i.now{outline:2px solid var(--ink);outline-offset:1px}
.mg .phero{display:grid;gap:var(--sp4)}
.mg .ptitle h1{overflow-wrap:anywhere}
@media (min-width:1000px){
.mg .phero{grid-template-columns:minmax(0,5fr) minmax(0,7fr);grid-template-areas:"t p" "w p";column-gap:var(--sp5);align-items:start}
.mg .phero>.ptitle{grid-area:t}
.mg .phero>.plate{grid-area:p;align-self:stretch;display:flex;flex-direction:column;justify-content:center}
.mg .phero>.pwho{grid-area:w}
}
.mg[data-embed]{padding:calc(var(--sp2) + env(safe-area-inset-top)) calc(var(--sp2) + env(safe-area-inset-right)) calc(var(--sp2) + env(safe-area-inset-bottom)) calc(var(--sp2) + env(safe-area-inset-left))}
.mg[data-embed] .ecard{max-width:480px;height:240px}
.mg[data-embed] .ecode{max-width:480px;margin-top:var(--sp4)}
.framed .mg[data-embed]{padding:0}
.framed .mg[data-embed] .ecard{max-width:none;height:100vh}
.framed .mg[data-embed] .ecode{display:none}
.mg[data-kiosk] main{height:100vh;height:100dvh;overflow:hidden}
.mg .kio{position:relative;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
.mg .kio .kveil{position:absolute;inset:0;z-index:2;display:grid;place-items:center;align-content:center;gap:var(--sp4);background:var(--bg);opacity:0;pointer-events:none}
.mg .kio .kveil.on{opacity:.94}
@media (prefers-reduced-motion:no-preference){.mg .kio .kveil{transition:opacity .3s}}
`;
