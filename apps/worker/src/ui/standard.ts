// The second of the two stylesheets every page loads (after tokens.ts): one definition per
// component of the design standard, tokens only (no literal colours or sizes). Ported from the
// standard's board stylesheet: the boards' size pins became media queries (desktop from 1000px,
// the kiosk's portrait by orientation). This is the only stylesheet source: pages never carry
// their own CSS, and a new component is added to the standard first.

/** The display preview frames a real screen display drawn at this size, then scales it down. */
export const PREVIEW_W = 1280;
export const PREVIEW_H = 720;

/** The desktop breakpoint, for page scripts that follow the same layout switch as the CSS. */
export const DESKTOP = "(min-width:1000px)";
export const MOBILE = "(max-width:999.98px)";

/** The components of design-standard.md section 4, and the layouts of section 3a. */
const COMPONENTS_CSS = `
body{margin:0}
.mg *,.mg *::before,.mg *::after{box-sizing:border-box}
.mg{position:relative;padding:0 0 var(--sp6)}
.mg p,.mg h1,.mg h2,.mg h3,.mg h4,.mg ul,.mg ol,.mg dl,.mg dd,.mg figure,.mg fieldset,.mg blockquote,.mg pre{margin:0}
.mg ul,.mg ol{padding:0;list-style:none}
.mg fieldset{border:0;padding:0;min-width:0}
.mg a{color:inherit;text-underline-offset:3px}
.mg :focus-visible{outline:3px solid var(--focus);outline-offset:2px}
.mg input{font:inherit;color:var(--ink);background:transparent}
.mg ::placeholder{color:var(--muted);opacity:1}
.mg .vh{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.mg .skip{position:absolute;left:var(--sp2);top:var(--sp2);z-index:5;transform:translateY(-200%);background:var(--bg);color:var(--ink);padding:var(--sp2) var(--sp3);border:2px solid var(--ink);border-radius:var(--r);font-weight:600}
.mg .skip:focus{transform:none}
.mg .sh a.skip{color:var(--ink)}
.mg .links a,.mg .back a,.mg a.back,.mg .flinks a,.mg .langs a,.mg .flangs a{display:inline-flex;align-items:center;justify-content:center;min-height:var(--hit);padding-inline:var(--sp1)}
.mg .links a,.mg .flinks a,.mg .langs a,.mg .flangs a{min-width:var(--hit)}
.mg .links{display:flex;flex-wrap:wrap;align-items:center;gap:0 var(--sp1)}
.mg code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.88em;overflow-wrap:anywhere}
.mg b,.mg strong{font-weight:600}
.mg .ico{width:1.2em;height:1.2em;flex:none}
.mg svg.ico:not(.f):not([fill]){fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.mg svg.ico.f{fill:currentColor;stroke:none}
.mg svg.shape{fill:currentColor;flex:none}
.mg .wrap{width:min(100%,calc(var(--col) + 2 * var(--gut)));margin:0 auto;padding:0 var(--gut)}
.mg .pad{padding-top:var(--sp5)}
.mg .stack>*+*{margin-top:var(--sp4)}
.mg .act{display:flex;flex-direction:column;gap:var(--sp4)}
.mg .act>.btn{align-self:flex-start}
.mg .act>*{margin-top:0}
.mg .row-c{display:flex;flex-wrap:wrap;align-items:center;gap:var(--sp2) var(--sp3)}
.mg .band{padding-top:var(--sp5)}
.mg .lane{display:grid;gap:var(--sp4);align-items:stretch}
.mg .lane>*{min-width:0}
.mg .lane>*>.panel:only-child,.mg .lane>*>.card:only-child{height:100%}
.mg .col{display:flex;flex-direction:column;gap:var(--sp4)}
.mg .col>.grow{flex:1 1 auto}
.mg .flow>*{break-inside:avoid;margin:0 0 var(--sp4)}
.mg .fill{background:var(--lv);color:var(--on)}
.mg .sh{background:var(--bar);color:var(--on-bar);border-bottom:1px solid var(--bar-rule)}
.mg .sh .wrap{display:flex;flex-wrap:wrap;align-items:center;gap:var(--sp1) var(--sp4);padding-top:var(--sp2);padding-bottom:0}
.mg .sh a{color:var(--on-bar);text-decoration:none}
.mg .brand{display:inline-flex;align-items:center;gap:var(--sp2);min-height:var(--hit);font-size:var(--t-xl);text-decoration:none}
.mg .wm{font-family:'Anek Latin',system-ui,sans-serif;font-weight:700;font-stretch:100%;letter-spacing:-.02em;text-transform:none;line-height:1}
.mg .bm{width:1.25em;height:1.25em;flex:none}
.mg .sh .btn{border-color:var(--on-bar);color:var(--on-bar);padding:0 var(--sp3);font-size:var(--t-sm);margin-left:auto}
.mg .nav{display:flex;flex-wrap:nowrap;gap:0 var(--sp2);flex-basis:100%;overflow-x:auto;scrollbar-width:none;font-size:var(--t-sm);font-weight:600;font-stretch:85%;mask-image:linear-gradient(90deg,var(--ink) 88%,transparent)}
.mg .nav a{display:inline-flex;align-items:center;justify-content:center;flex:none;min-height:var(--hit);min-width:var(--hit);padding:0 var(--sp1);white-space:nowrap}
.mg .nav a[aria-current]{text-decoration:underline;text-underline-offset:6px;text-decoration-thickness:3px}
.mg .langs{display:flex;align-items:center;gap:var(--sp1);font-size:var(--t-sm);font-weight:600}
.mg .sh .langs{display:none}
.mg .sh .mtog{display:none;gap:var(--sp2)}
.mg .sf{margin-top:var(--sp7);border-top:3px solid var(--ink)}
.mg .sf .wrap{display:grid;gap:var(--sp4);padding-top:var(--sp5)}
.mg .flinks{display:flex;flex-wrap:wrap;gap:0 var(--sp3);font-size:var(--t-sm);font-weight:600}
.mg .flangs{display:flex;flex-wrap:wrap;align-items:center;gap:0 var(--sp1);font-size:var(--t-sm);font-weight:600}
.mg .flinks a[aria-current]{text-decoration-thickness:3px}
.mg .frow{display:flex;flex-wrap:wrap;align-items:center;gap:var(--sp3) var(--sp5)}
.mg .flabel{font-size:var(--t-sm);font-weight:600;letter-spacing:.1em;text-transform:uppercase;margin-right:var(--sp2)}
.mg .disc{grid-column:1/-1;max-width:80ch;font-size:var(--t-sm);color:var(--muted);line-height:1.45}
.mg .btn{display:inline-flex;align-items:center;justify-content:center;gap:var(--sp2);min-height:var(--hit);padding:0 var(--sp4);border:2px solid var(--ink);border-radius:var(--r);font:inherit;font-weight:600;text-decoration:none;background:transparent;color:var(--ink);cursor:pointer}
.mg .btn.primary{background:var(--ink);color:var(--bg)}
.mg .btn[aria-pressed="true"]{background:var(--ink);color:var(--bg)}
.mg .btn[disabled]{border-style:dashed;border-color:var(--muted);color:var(--muted);cursor:not-allowed}
.mg .segf{display:grid;gap:var(--sp2)}
.mg .segf>legend{padding:0;margin-bottom:var(--sp2)}
.mg .segf>.seg:not(.grid2,.fit){justify-self:start}
.mg .seg{display:inline-flex;flex-wrap:wrap;border:2px solid var(--ink);border-radius:var(--r);overflow:hidden}
.mg .seg :is(label,a){position:relative;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:var(--hit);padding:0 var(--sp3);border-left:2px solid var(--ink);background:var(--bg);color:var(--ink);font-size:var(--t-sm);font-weight:600;text-align:center;line-height:1.2;cursor:pointer}
.mg .seg :is(label,a):first-child{border-left:0}
.mg .seg input{position:absolute;opacity:0;width:1px;height:1px;margin:0;pointer-events:none}
.mg .seg :is(label:has(input:checked),a[aria-current]){background:var(--ink);color:var(--bg)}
.mg .seg :is(label:has(input:checked),a[aria-current])::before{content:"";flex:none;width:.4em;height:.75em;margin-top:-.2em;border:solid currentColor;border-width:0 3px 3px 0;transform:rotate(45deg)}
.mg .seg :is(label:has(input:focus-visible),a:focus-visible){outline:3px solid var(--focus);outline-offset:-6px}
.mg .seg.grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px;background:var(--ink);overflow:visible}
.mg .seg.grid2 :is(label,a){border:0;padding:var(--sp1) var(--sp2)}
.mg .seg.fit{display:flex;flex-wrap:wrap;gap:2px;background:var(--ink)}
.mg .seg.fit>label{flex:1 1 auto;border:0;padding:0 var(--sp1)}
.mg .chip{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:var(--r);border:2px solid var(--lv,var(--ink));background:var(--lv,transparent);color:var(--on,var(--ink));font-size:var(--t-xs);font-weight:600;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}
.mg .chip svg{width:16px;height:16px}
.mg .lkey{display:flex;flex-wrap:wrap;gap:var(--sp2)}
.mg .plate{background:var(--lv);color:var(--on);padding:var(--sp5) var(--gut)}
.mg .plate .row{display:flex;align-items:center;gap:var(--sp4)}
.mg .plate .shape{width:64px;height:64px}
.mg .plate .say{margin-top:var(--sp3)}
.mg .lane>.plate:not(.inline){display:flex;flex-direction:column;justify-content:center}
.mg .plate.inline{display:flex;align-items:center;gap:var(--sp4);padding:var(--sp4)}
.mg .plate.inline>.ico,.mg .plate.inline>.shape{width:64px;height:64px}
.mg .plate .big{display:flex;align-items:baseline;gap:var(--sp3);flex-wrap:wrap}
.mg .stamp{display:inline-flex;flex-direction:column;padding:var(--sp1) var(--sp3);border-left:4px solid var(--ink);background:var(--soft);font-size:var(--t-sm);font-weight:600;font-variant-numeric:tabular-nums;width:fit-content;max-width:100%}
.mg .stamp .k{font-size:var(--t-xs);font-weight:400;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.mg .stamp .v{font-size:var(--t-sm);font-weight:600}
.mg .stamp.plain .k{text-transform:none;letter-spacing:0;font-size:var(--t-sm);font-weight:600;color:var(--ink)}
.mg .stamp.off{border-left-color:var(--line);background:transparent}
.mg .stamp.off .v{color:var(--muted);font-weight:600}
.mg .stamp.stale{border-left-style:dashed}
.mg .stamps{display:flex;flex-wrap:wrap;gap:var(--sp2)}
.mg .panel{border:2px solid var(--ink);border-radius:var(--r);background:var(--bg)}
.mg .panel.strong{border-width:3px}
.mg .panel>.bar{display:flex;align-items:center;gap:var(--sp2);margin:0;padding:var(--sp2) var(--sp3);background:var(--bar);color:var(--on-bar);font-size:var(--t-sm);font-weight:600;letter-spacing:.1em;text-transform:uppercase}
.mg .panel>.bar .n{margin-left:auto;font-variant-numeric:tabular-nums}
.mg .panel>.bar a{color:inherit}
.mg .panel>.in{padding:var(--sp3) var(--sp4)}
.mg .panel>.in.grid{display:grid;gap:var(--sp3)}
.mg .notice{display:block;border:2px solid var(--ink);border-left-width:8px;border-radius:var(--r);padding:var(--sp3) var(--sp4);background:var(--bg);font-weight:600}
.mg .notice:has(>svg.ico){display:flex;gap:var(--sp3);align-items:flex-start}
.mg .notice>.ico{width:var(--t-xl);height:var(--t-xl)}
.mg .notice.quiet{border-color:var(--line);border-left-color:var(--muted);background:var(--soft)}
.mg .notice.stale{border-left-style:dashed}
.mg .notice.err{border-left-color:var(--severe)}
.mg .notice.empty{align-items:center;padding:var(--sp5);font-size:var(--t-lg);font-weight:400}
.mg .notice.empty>.ico{width:40px;height:40px}
.mg .wplate{border:3px solid var(--ink);border-radius:var(--r);background:var(--bg)}
.mg .wplate>.bar{display:flex;flex-wrap:wrap;gap:var(--sp1) var(--sp3);align-items:center;padding:var(--sp2) var(--sp4);background:var(--severe);color:var(--on-severe);font-size:var(--t-sm);font-weight:600;letter-spacing:.08em;text-transform:uppercase}
.mg .wplate>.bar a{color:inherit;display:inline-flex;align-items:center;justify-content:center;min-height:var(--hit);min-width:var(--hit)}
.mg .wplate>.in{padding:var(--sp4)}
.mg .wgrp{display:flex;align-items:center;gap:var(--sp2);padding:var(--sp5) 0 var(--sp2);border-bottom:3px solid var(--ink);font-size:var(--t-xl);font-weight:600;font-stretch:80%;text-transform:uppercase}
.mg .wgrp .n{margin-left:auto;font-size:var(--t-sm);font-variant-numeric:tabular-nums}
.mg .wrow{display:grid;grid-template-columns:44px minmax(0,1fr);gap:var(--sp1) var(--sp3);padding:var(--sp3) 0;border-bottom:2px solid var(--ink)}
.mg .wrow>.ico{grid-row:span 3;width:40px;height:40px;margin-top:2px}
.mg .wrow .kind{font-size:var(--t-xs);font-weight:600;letter-spacing:.1em;text-transform:uppercase}
.mg .wrow .head{font-size:var(--t-base);line-height:1.45;overflow-wrap:anywhere}
.mg .wrow .meta{font-size:var(--t-sm);color:var(--muted)}
.mg .checks{display:grid;gap:0}
.mg .checks legend{font-size:var(--t-sm);font-weight:600;letter-spacing:.1em;text-transform:uppercase;padding:var(--sp3) 0 var(--sp1)}
.mg .check{display:flex;align-items:center;gap:var(--sp2);min-height:var(--hit);border-top:1px solid var(--line);font-size:var(--t-sm);cursor:pointer}
.mg .check input{width:20px;height:20px;accent-color:var(--ink);margin:0}
.mg .check .c{margin-left:auto;font-weight:600;font-variant-numeric:tabular-nums}
.mg .check.off{color:var(--muted)}
.mg details.fold{border:2px solid var(--ink);border-radius:var(--r);background:var(--bg)}
.mg details.fold>summary{display:flex;align-items:center;gap:var(--sp2);min-height:var(--hit);padding:0 var(--sp4);font-size:var(--t-sm);font-weight:600;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;list-style:none}
.mg details.fold>summary::-webkit-details-marker{display:none}
.mg details.fold>summary .n{margin-left:auto;font-variant-numeric:tabular-nums}
.mg details.fold>summary::after{content:"+";font-size:var(--t-xl);line-height:1}
.mg details.fold[open]>summary::after{content:"\\2212"}
.mg details.fold>.in{padding:0 var(--sp4) var(--sp3)}
.mg .search{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--sp2)}
.mg .search label{font-size:var(--t-sm);font-weight:600;letter-spacing:.1em;text-transform:uppercase}
.mg .sbox{display:flex;align-items:center;gap:var(--sp2);border:3px solid var(--ink);border-radius:var(--r);padding:0 0 0 var(--sp3);background:var(--bg)}
.mg .sbox input{flex:1 1 0;width:100%;min-width:0;border:0;min-height:48px;font-size:var(--t-base)}
.mg .sbox input:focus-visible{outline:0}
.mg .sbox:focus-within{outline:3px solid var(--focus);outline-offset:2px}
.mg .sbox>.ico{flex:none}
.mg .sbox .btn{flex:none;border:0;border-left:3px solid var(--ink);border-radius:0;min-height:48px;background:var(--ink);color:var(--bg)}
.mg .ac{border:2px solid var(--ink);border-radius:var(--r);background:var(--bg)}
.mg .ac[hidden]{display:none}
.mg .ac li{display:flex;justify-content:space-between;gap:var(--sp3);min-height:var(--hit);align-items:center;padding:0 var(--sp3);border-top:1px solid var(--line)}
.mg .ac li:first-child{border-top:0}
.mg .ac li span{color:var(--muted);font-size:var(--t-sm)}
.mg .ac li[aria-selected="true"]{background:var(--ink);color:var(--bg)}
.mg .ac li[aria-selected="true"] span{color:var(--bg)}
.mg .sel{display:block;width:100%;min-height:var(--hit);border:3px solid var(--ink);border-radius:var(--r);background:var(--bg);color:var(--ink);font:inherit;padding:0 var(--sp3)}
.mg .covers{display:flex;flex-wrap:wrap;gap:var(--sp2) var(--sp4);font-size:var(--t-sm);font-weight:400}
.mg .covers span{display:inline-flex;align-items:center;gap:5px}
.mg .rrow{display:grid;grid-template-columns:40px minmax(0,1fr) auto;gap:var(--sp1) var(--sp3);align-items:start;padding:var(--sp4) 0;border-top:2px solid var(--ink)}
.mg .rrow .ico{width:36px;height:36px;margin-top:4px}
.mg .rrow .lab{font-size:var(--t-sm);font-weight:400;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.mg .rrow .val{display:flex;flex-wrap:wrap;align-items:baseline;gap:var(--sp2)}
.mg .rrow .num{font-size:var(--t-2xl);font-weight:800;font-stretch:80%;line-height:1;font-variant-numeric:tabular-nums}
.mg .rrow .qa{font-size:var(--t-sm);color:var(--muted)}
.mg .rrow .more{grid-column:2/-1}
.mg .rrow .chip{margin-top:6px}
.mg .hl{display:grid;grid-template-columns:36px minmax(0,1fr);gap:var(--sp1) var(--sp3);padding:var(--sp3) 0;border-top:2px solid var(--ink);text-decoration:none}
.mg .hl .ico{width:32px;height:32px}
.mg .srow{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:var(--sp3);align-items:center;min-height:var(--hit);padding:var(--sp2) 0;border-top:1px solid var(--line);text-decoration:none}
.mg .srow:first-child{border-top:0}
.mg .srow .n{font-weight:400;font-stretch:90%}
.mg .srow .a{font-variant-numeric:tabular-nums;font-weight:600}
.mg .bars{display:grid;grid-template-columns:4.2rem minmax(0,1fr) auto;border-top:2px solid var(--ink)}
.mg .brow{grid-column:1/-1;display:grid;grid-template-columns:subgrid;align-items:center;gap:var(--sp3);padding:var(--sp2) 0;border-bottom:1px solid var(--line);font-size:var(--t-sm)}
.mg .brow>:first-child{font-weight:400;font-size:var(--t-base)}
.mg .brow>:last-child{margin:0;min-width:3rem;text-align:right;font-variant-numeric:tabular-nums}
.mg .track{position:relative;height:14px;background:var(--track)}
.mg .track>.f{position:absolute;left:0;top:0;bottom:0;background:var(--lv,var(--muted))}
.mg .track>.lim{position:absolute;top:-4px;bottom:-4px;left:var(--lim,20%);border-left:2px dashed var(--ink)}
.mg .gauge{position:relative;height:10px;background:var(--track);margin:6px 0}
.mg .gauge .f{position:absolute;top:0;bottom:0;background:var(--lv,var(--muted))}
.mg .gauge .tk{position:absolute;top:-4px;bottom:-4px;width:2px;background:var(--ink)}
.mg .gauge .mk{position:absolute;top:-6px;bottom:-6px;width:4px;background:var(--lv,var(--ink))}
.mg .uvs{display:flex;gap:2px}
.mg .uvs i{display:block;width:18px;height:10px;background:var(--lv)}
.mg .tbl{width:100%;border-collapse:collapse;border:2px solid var(--ink);font-variant-numeric:tabular-nums}
.mg .tbl th,.mg .tbl td{padding:var(--sp2) var(--sp3);text-align:left;border-bottom:1px solid var(--line)}
.mg .tbl thead th{font-size:var(--t-sm);font-weight:600;letter-spacing:.06em;text-transform:uppercase;border-bottom:2px solid var(--ink)}
.mg .tbl tbody th{font-weight:400}
.mg .tbl .r{text-align:right}
.mg .tbl :is(td,th)>a:first-child{display:flex;align-items:center;min-height:var(--hit)}
.mg .tscroll{overflow-x:auto;max-width:100%}
.mg .tscroll:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
.mg .tbl th svg{width:14px;height:14px;vertical-align:-2px;margin-right:4px}
.mg .ptiles{display:flex;flex-wrap:wrap;gap:var(--sp2)}
.mg .tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--sp2)}
.mg .ptile,.mg .tiles a{display:inline-flex;align-items:center;justify-content:center;gap:var(--sp2);min-height:var(--hit);padding:0 var(--sp3);border:2px solid var(--ink);border-radius:var(--r);font-weight:400;text-decoration:none}
.mg .ptile.warn,.mg .tiles a.warn{background:var(--ink);color:var(--bg);font-weight:400}
.mg .idx{display:flex;flex-wrap:wrap;gap:var(--sp1)}
.mg .idx a{display:inline-flex;align-items:center;justify-content:center;min-width:var(--hit);min-height:var(--hit);padding:0 var(--sp2);border:2px solid var(--ink);border-radius:var(--r);font-size:var(--t-sm);font-weight:400;text-decoration:none}
.mg .plist{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 var(--sp3)}
.mg .plist a{display:flex;align-items:center;min-height:var(--hit);border-bottom:1px solid var(--line);font-size:var(--t-sm);text-decoration:none}
.mg .ph{padding:var(--sp5) 0 var(--sp4);display:grid;gap:var(--sp3)}
.mg .ph .t-lead{max-width:60ch}
.mg .back{font-weight:400;font-size:var(--t-sm)}
.mg .cnum{display:inline-flex;flex:none;width:28px;height:28px;align-items:center;justify-content:center;border-radius:50%;border:2px solid var(--ink);font-size:var(--t-xs);font-weight:800;font-stretch:100%}
.mg .cnum.solid{width:36px;height:36px;background:var(--ink);color:var(--bg);font-size:var(--t-lg)}
.mg .step{display:grid;gap:var(--sp3)}
.mg .step>h2{display:flex;align-items:center;gap:var(--sp3)}
.mg .howto{display:grid;gap:0;counter-reset:h}
.mg .howto li{display:grid;grid-template-columns:32px minmax(0,1fr);gap:var(--sp3);padding:var(--sp3) 0;border-top:1px solid var(--line);counter-increment:h}
.mg .howto li::before{content:counter(h);display:inline-flex;width:28px;height:28px;align-items:center;justify-content:center;border:2px solid var(--ink);border-radius:50%;font-size:var(--t-xs);font-weight:600}
.mg .nf{border:3px solid var(--ink);border-radius:var(--r);padding:var(--sp5);display:grid;grid-template-columns:minmax(0,1fr);gap:var(--sp4);margin-top:var(--sp5);background:var(--bg)}
.mg .nf>.ico{width:72px;height:72px}
.mg .sheet{margin-top:var(--sp5)}
.mg .hero{display:grid;gap:var(--sp5);padding-bottom:var(--sp6)}
.mg .hero .t-kicker{color:var(--muted)}
.mg .hero .t-title{margin-top:var(--sp2)}
.mg .hero .t-lead{margin-top:var(--sp4);max-width:40ch}
.mg .hero .lead2{margin-top:var(--sp3);max-width:60ch}
.mg .toc a{display:flex;align-items:center;gap:var(--sp3);min-height:var(--hit);padding:0 var(--sp3);border-top:1px solid var(--line);font-size:var(--t-base);font-weight:600;text-decoration:none}
.mg .tsec{display:grid;gap:var(--sp4);padding:var(--sp6) 0;border-top:3px solid var(--ink)}
.mg .rail{display:flex;align-items:center;gap:var(--sp3)}
.mg .rail .sn{font-size:var(--t-sm);font-weight:600;letter-spacing:.12em;color:var(--muted)}
.mg .rail svg{width:28px;height:28px;flex:none}
.mg .sbody{display:grid;gap:var(--sp4);min-width:0}
.mg .sbody>p{max-width:70ch}
.mg .cards{display:grid;gap:var(--sp3)}
.mg .card{border:2px solid var(--ink);border-radius:var(--r);padding:var(--sp4)}
.mg .card .code{margin-top:var(--sp2)}
.mg .sheet .back{padding-top:var(--sp5)}
.mg .card.quiet{background:var(--soft);border-color:var(--soft)}
.mg .card .t-value{display:flex;align-items:center;gap:var(--sp2);margin-bottom:var(--sp2)}
.mg .card .t-value svg{width:26px;height:26px;flex:none}
.mg .pairs{border-top:2px solid var(--ink)}
.mg .pairs>div{display:grid;gap:var(--sp1) var(--sp4);padding:var(--sp3) 0;border-bottom:1px solid var(--line)}
.mg .pairs dt{font-size:var(--t-sm);font-weight:400;letter-spacing:.1em;text-transform:uppercase}
.mg .faq{border-top:2px solid var(--ink)}
.mg .faq>div{display:grid;gap:var(--sp2) var(--sp5);padding:var(--sp4) 0;border-bottom:2px solid var(--ink)}
.mg .faq dt{font-size:var(--t-lg);font-weight:400;font-stretch:85%;line-height:1.2}
.mg .faq dd{color:var(--muted)}
.mg .pull{border-left:8px solid var(--ink);background:var(--soft);padding:var(--sp4) var(--sp5);font-size:var(--t-lg);font-weight:400;line-height:1.35}
.mg .warnbox{border:4px solid var(--ink);border-radius:var(--r);padding:var(--sp5);display:grid;gap:var(--sp3)}
.mg .warnbox .head{display:flex;gap:var(--sp3);align-items:flex-start;font-size:var(--t-lg);font-weight:600;line-height:1.3}
.mg .warnbox svg{width:40px;height:40px;flex:none}
.mg .levels{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--sp1)}
.mg .levels>div{padding:var(--sp3);border-radius:var(--r);font-weight:600;text-transform:uppercase;font-size:var(--t-sm);letter-spacing:.06em}
.mg .levels .n{display:block;font-size:var(--t-2xl);font-stretch:75%;line-height:1}
.mg .levels svg{width:18px;height:18px;vertical-align:-3px;margin-right:4px}
.mg .addr{display:flex;flex-wrap:wrap;align-items:center;gap:var(--sp3);background:var(--bar);color:var(--on-bar);border-radius:var(--r);padding:var(--sp3) var(--sp4)}
.mg .addr code{font-size:var(--t-lg);font-weight:400}
.mg .addr .btn{margin-left:auto;border-color:var(--on-bar);color:var(--on-bar)}
.mg .code{display:block;white-space:pre-wrap;overflow-wrap:anywhere;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:var(--t-sm);background:var(--soft);border-radius:var(--r);padding:var(--sp2) var(--sp3)}
.mg .credit{display:flex;align-items:center;gap:var(--sp4);border:2px solid var(--ink);border-radius:var(--r);padding:var(--sp4)}
.mg .credit img{flex:none}
.mg .yp li{display:grid;grid-template-columns:var(--hit) minmax(0,1fr) var(--hit) var(--hit);align-items:center;border-top:1px solid var(--line)}
.mg .yp li:first-child{border-top:0}
.mg .yp button{min-height:var(--hit);border:0;background:transparent;color:var(--ink);font:inherit;font-size:var(--t-lg);cursor:pointer}
.mg .yp a{display:flex;align-items:center;min-height:var(--hit);font-weight:400;text-decoration:none}
.mg dialog.isheet{position:static;display:block;border:3px solid var(--ink);border-radius:var(--r);background:var(--bg);color:var(--ink);padding:var(--sp4);max-width:100%}
.mg .isheet ol{list-style:decimal;padding-left:var(--sp5)}
.mg .imap svg.msvg{display:block;width:100%;height:auto}
.mg .msvg{--card:var(--bg)}
.mg .msvg .mland{fill:var(--mland)}
.mg .msvg .mstates{fill:none;stroke:var(--muted);stroke-width:.5;opacity:.6}
.mg .msvg .mline{fill:none;stroke:var(--ink);stroke-width:1.2}
.mg .lvf{fill:var(--lv)}
.mg .msvg .lvs{stroke:var(--lv)}
.mg .imap[data-layer="o"] .L:not(.Lo),.mg .imap[data-layer="w"] .L:not(.Lw),.mg .imap[data-layer="a"] .L:not(.La),.mg .imap[data-layer="h"] .L:not(.Lh),.mg .imap[data-layer="r"] .L:not(.Lr){display:none}
.mg .mlg{display:flex;flex-wrap:wrap;gap:var(--sp2) var(--sp4);font-size:var(--t-sm)}
.mg .mlg span{display:inline-flex;align-items:center;gap:6px}
.mg .mlg svg{width:18px;height:18px;flex:none}
.mg .mlg .sq{stroke:var(--ink);stroke-width:1.2}
.mg .msvg .mcells path{stroke:var(--ink);stroke-width:.7;stroke-linejoin:round}
.mg .msvg .mwarn path{stroke:var(--ink);stroke-width:.6;stroke-linejoin:round;cursor:pointer}
.mg .f-air{fill:var(--mair)}
.mg .f-heat{fill:var(--mheat)}
.mg .f-cold{fill:var(--mcold)}
.mg .f-r1{fill:var(--mrain1)}
.mg .f-r2{fill:var(--mrain2)}
.mg .f-r3{fill:var(--mrain3)}
.mg .f-low{fill:var(--low)}
.mg .f-moderate{fill:var(--moderate)}
.mg .f-high{fill:var(--high)}
.mg .f-severe{fill:var(--severe)}
.mg .f-bg{fill:var(--bg)}
.mg .f-ink{fill:var(--ink)}
.mg .s-bg{stroke:var(--bg);stroke-width:1;fill:none}
.mg .msum{border-top:2px solid var(--ink)}
.mg .msum a{display:flex;align-items:center;justify-content:space-between;gap:var(--sp3);min-height:var(--hit);border-bottom:1px solid var(--line);text-decoration:none;font-weight:400}
.mg .msum a span{font-weight:400;color:var(--muted);font-size:var(--t-sm)}
.mg .imap.places .mcells{opacity:.45}
.mg .msvg .mstate{fill:transparent;stroke:var(--muted);stroke-width:.5;stroke-opacity:.6;cursor:pointer}
.mg .msvg .mstate:hover{fill:color-mix(in srgb,var(--ink) 10%,transparent);stroke:var(--ink);stroke-width:.8}
.mg .msvg .pdots{pointer-events:none}
.mg .msvg .pdot{fill:none;stroke:var(--ink);stroke-width:2.4;stroke-linecap:round}
.mg .msvg .pdot-halo{fill:none;stroke:var(--bg);stroke-width:3.8;stroke-linecap:round}
.mg .msvg .wm-bg{fill:var(--ink);stroke:var(--bg);stroke-width:2}
.mg .msvg .wm-fg{stroke:var(--bg);stroke-width:3;stroke-linecap:round}
.mg .mkey{display:flex;flex-wrap:wrap;gap:var(--sp2) var(--sp4);font-size:var(--t-sm)}
.mg .mkey span{display:inline-flex;align-items:center;gap:6px}
.mg .mkey svg{width:16px;height:16px;flex:none}
.mg .mempty{min-height:220px;display:grid;place-items:center;background:var(--mland);border:2px dashed var(--muted);border-radius:var(--r);padding:var(--sp5);text-align:center}
.mg .qr{display:flex;align-items:center;gap:var(--sp3);font-size:var(--t-xs);font-weight:400}
.mg .qr .qrimg{width:120px;height:120px;flex:none;background:var(--qr-paper);color:var(--qr-ink);padding:6px}
.mg .qr>span{flex:0 1 auto;min-width:8em;max-width:16em}
.mg .kio{display:grid;grid-template-rows:auto minmax(0,1fr) auto;height:100%}
.mg .kio .ktop{display:flex;justify-content:space-between;align-items:baseline;gap:var(--sp4);padding:var(--sp3) var(--gut);border-bottom:2px solid var(--line)}
.mg .kio h1.kname{margin:0}
.mg .kio .kname,.mg .kio .kclock{font-size:var(--t-xl);font-weight:800;font-stretch:80%;text-transform:uppercase;font-variant-numeric:tabular-nums}
.mg .kio .kb{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-rows:minmax(0,1fr);min-height:0}
.mg .kio .plate{display:flex;flex-direction:column;justify-content:center;padding:var(--sp5) var(--gut)}
.mg .kio .plate .shape{width:1.2em;height:1.2em;font-size:var(--t-3xl)}
.mg .kio .ktiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-content:start;padding:0 var(--sp5)}
.mg .kio .ktile{position:relative;padding:var(--sp2);border-bottom:2px solid var(--line)}
.mg .kio .ktile>.ico{position:absolute;top:var(--sp2);left:var(--sp2);width:var(--k2);height:var(--k2)}
.mg .kio .ktile .lab{padding-left:calc(var(--k2) + var(--sp2))}
.mg .kio .ktile .row-c{gap:var(--sp1) var(--sp3)}
.mg .kio .ktile .lab{font-size:var(--t-sm);font-weight:400;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.mg .kio .ktile .num{font-size:var(--t-2xl);font-weight:800;font-stretch:80%;line-height:1;font-variant-numeric:tabular-nums}
.mg .kio .ktile .qa{font-size:var(--t-sm);color:var(--muted)}
.mg .kio .kquiet{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:var(--sp1) var(--sp5);padding:var(--sp2) var(--sp2);font-size:var(--t-sm)}
.mg .kio .kquiet .qi{display:inline-flex;align-items:center;gap:var(--sp2)}
.mg .kio .kwarn{list-style:none;margin:0;padding:0;display:grid;gap:var(--sp2)}
.mg .kio .kwarn li{display:flex;align-items:flex-start;gap:var(--sp3)}
.mg .kio .kwarn .ico{width:1.3em;height:1.3em;margin-top:.1em}
.mg .kio .kwarn .near{font-size:var(--t-sm)}
.mg .kio .kf{display:flex;justify-content:space-between;align-items:center;gap:var(--sp5);padding:var(--sp2) var(--gut);border-top:2px solid var(--line)}
.mg .kio .kbrand{font-size:var(--t-lg)}
.mg .kio .chip svg{width:.9em;height:.9em}
.mg .kio .bars{grid-template-columns:4em minmax(0,1fr) auto}
.mg .kio .brow{font-size:var(--t-xs)}
.mg .ecard{container-type:inline-size;display:flex;flex-direction:column;gap:4px;border:2px solid var(--ink);border-radius:var(--r);padding:10px 12px;line-height:1.3;overflow:hidden;text-decoration:none;color:var(--ink)}
.mg .ecard .etop{display:flex;justify-content:space-between;align-items:center;font-weight:600}
.mg .ecard .eplace{font-size:var(--t-lg);font-stretch:80%;text-transform:uppercase}
.mg .ecard .ebrand{display:inline-flex;align-items:center;gap:4px;font-size:var(--t-sm)}
.mg .ecard .eamb{display:flex;align-items:center;gap:var(--sp2);font-size:var(--t-base);font-weight:800}
.mg .ecard .eamb svg{width:20px;height:20px;color:var(--lv)}
.mg .ecard .esay{font-size:var(--t-sm)}
.mg .ecard .ereads{display:none;flex-wrap:wrap;gap:var(--sp1) var(--sp4);max-height:calc(var(--t-lg) + var(--t-xs) * 1.3);overflow:hidden}
.mg .ecard .eread b{display:block;font-size:var(--t-lg);font-stretch:85%;line-height:1}
.mg .ecard .eread span{display:block;font-size:var(--t-xs);white-space:nowrap;line-height:1.3;color:var(--muted)}
.mg .ecard .efoot{display:flex;justify-content:space-between;font-size:var(--t-xs);font-weight:400;margin-top:auto}
.mg .ecard .t-legal{line-height:1.25}
.mg .ecard .disc-long{display:none}
@media (min-width:1000px){
.mg .band{padding-top:var(--sp6)}
.mg .lane>div:has(>.act)+div{order:-1}
.mg .act>.btn{order:1}
.mg .lane{gap:var(--sp5)}
.mg .lane.l2{grid-template-columns:repeat(2,minmax(0,1fr))}
.mg .lane.l3{grid-template-columns:repeat(3,minmax(0,1fr))}
.mg .lane.l4{grid-template-columns:repeat(4,minmax(0,1fr))}
.mg .lane.l57{grid-template-columns:minmax(0,5fr) minmax(0,7fr)}
.mg .lane.l75{grid-template-columns:minmax(0,7fr) minmax(0,5fr)}
.mg .lane.la{grid-template-columns:minmax(0,5fr) minmax(0,7fr);align-items:start}
.mg .aside{position:sticky;top:var(--sp4);max-height:calc(100vh - var(--sp6));overflow:auto}
.mg .flow{columns:2;column-gap:var(--sp5)}
.mg .flow>.span{column-span:all}
.mg .sh .wrap{flex-wrap:nowrap;gap:var(--sp5);padding-top:var(--sp2);padding-bottom:var(--sp2)}
.mg .sh .btn{margin-left:0}
.mg .sh .nav{flex-basis:auto;overflow:visible;mask-image:none;font-size:var(--t-base);gap:0 var(--sp3)}
.mg .sh .langs{display:flex;margin-left:auto}
.mg .sf .wrap{grid-template-columns:minmax(0,1fr) auto;align-items:start}
.mg .seg.grid2.d3{grid-template-columns:repeat(3,minmax(0,1fr))}
.mg .plate{padding:var(--sp6)}
.mg .plate .shape{width:110px;height:110px}
.mg .plate.inline{padding:var(--sp5) var(--sp6)}
.mg .plate.inline>.ico,.mg .plate.inline>.shape{width:96px;height:96px}
.mg .wrow{grid-template-columns:56px minmax(0,1fr) 190px;padding:var(--sp4) 0}
.mg .wrow>.ico{width:48px;height:48px}
.mg .wrow .meta{grid-column:3;grid-row:1/span 2;text-align:right}
.mg .fbar .checks{display:flex;flex-wrap:wrap;align-content:flex-start;align-items:center;gap:var(--sp2)}
.mg .fbar .checks legend{width:100%}
.mg .fbar .check{border:2px solid var(--ink);border-radius:var(--r);padding:0 var(--sp3)}
.mg .fbar .check .c{margin-left:var(--sp2)}
.mg .flow>.rrow{border:2px solid var(--ink);border-radius:var(--r);padding:var(--sp4);background:var(--bg)}
.mg .tiles{grid-template-columns:repeat(4,minmax(0,1fr))}
.mg .ph{padding:var(--sp7) 0 var(--sp5)}
.mg .howto.cards4{grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--sp4)}
.mg .howto.cards4 li{grid-template-columns:minmax(0,1fr);align-content:start;border:2px solid var(--ink);border-radius:var(--r);padding:var(--sp4)}
.mg .nf{width:760px;margin:var(--sp8) auto 0;padding:var(--sp7)}
.mg .sheet{border:3px solid var(--ink);border-radius:var(--r);background:var(--bg);padding:var(--sp7) var(--sp7) var(--sp4)}
.mg .hero{grid-template-columns:minmax(0,1fr);gap:var(--sp5)}
.mg .hero .toc{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}
.mg .hero .toc>.bar{grid-column:1/-1}
.mg .tsec{grid-template-columns:200px minmax(0,1fr);gap:0 var(--sp6)}
.mg .rail{display:block;position:sticky;top:var(--sp4);align-self:start}
.mg .rail svg{display:block;width:40px;height:40px;margin:var(--sp3) 0 var(--sp2)}
.mg .cards.c2{grid-template-columns:repeat(2,minmax(0,1fr))}
.mg .cards.c3{grid-template-columns:repeat(3,minmax(0,1fr))}
.mg .cards.c1 .card .code{margin-top:0}
.mg .cards.c1 .card{display:grid;grid-template-columns:180px minmax(0,1fr);gap:var(--sp3);align-items:center}
.mg .pairs>div{grid-template-columns:180px minmax(0,1fr)}
.mg .faq>div{grid-template-columns:260px minmax(0,1fr)}
.mg .levels{grid-template-columns:repeat(4,minmax(0,1fr))}
}
@media (max-width:999.98px){
.mg .tbl{font-size:var(--t-sm)}
.mg .tbl th,.mg .tbl td{padding:var(--sp2)}
.mg .sh.mjs .nav{display:none}
.mg .sh.mjs .mtog{display:inline-flex;margin-left:auto}
.mg .sh.mjs .btn:not([hidden]):not(.mtog)~.mtog{margin-left:var(--sp2)}
.mg .sh.mjs.open :is(.nav,.langs){display:flex;flex-basis:100%;overflow:visible;mask-image:none;font-size:var(--t-base)}
.mg .sh.mjs.open .nav{flex-direction:column;align-items:stretch;margin-top:var(--sp2)}
.mg .sh.mjs.open .nav a{justify-content:flex-start;border-top:1px solid color-mix(in srgb,var(--on-bar) 25%,var(--bar))}
.mg .sh.mjs.open .langs{gap:var(--sp3);padding-block:var(--sp2) var(--sp3);border-top:1px solid color-mix(in srgb,var(--on-bar) 25%,var(--bar))}
.mg .tbl.rows thead{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
.mg .tbl.rows tr{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:var(--sp3);align-items:center;border-bottom:1px solid var(--line)}
.mg .tbl.rows :is(th,td){border:0}
.mg .tbl.rows tbody th{grid-column:1;grid-row:1;padding-bottom:0}
.mg .tbl.rows td:nth-child(2){grid-column:2;grid-row:1/span 2}
.mg .tbl.rows td:nth-child(3){grid-column:1;grid-row:2;padding-top:0;text-align:left;color:var(--muted)}
}
@media (orientation:portrait){
.mg .kio .ktile{display:grid;grid-template-columns:auto minmax(0,1fr);column-gap:var(--sp4);align-items:start}
.mg .kio .ktile>.ico{position:static;width:var(--k3);height:var(--k3)}
.mg .kio .ktile .lab{padding-left:0}
.mg[data-kiosk] .qr .qrimg{width:calc(var(--k4) * 1.31);height:calc(var(--k4) * 1.31)}
.mg .kio .kb{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr)}
.mg .kio .plate{justify-content:flex-start;gap:var(--sp4);padding:var(--k2) var(--gut)}
.mg .kio .ktiles{grid-template-columns:1fr;gap:0}
.mg .kio .ktile{padding:calc(var(--k1) * .8) 0}
.mg .kio .ktile .lab,.mg .kio .ktile .qa,.mg .kio .kquiet{font-size:var(--k2)}
.mg .kio .ktile .num{font-size:var(--k3)}
.mg .kio .ktiles{padding:calc(var(--k1) * .5) var(--k1)}
}
@media (forced-colors:active){.mg .seg :is(label:has(input:checked),a[aria-current]){forced-color-adjust:none;background:Highlight;color:HighlightText}}
@media (forced-colors:active){.mg .msvg .pdot,.mg .msvg .wm-bg{stroke:CanvasText}.mg .msvg .wm-bg{fill:CanvasText}}
@container (min-width:372px){.mg .ecard .disc-long{display:block}.mg .ecard .disc-short{display:none}.mg .ecard .ereads{display:flex}}
`;

/** Display preview: a live screen display scaled into a 16:9 frame; the chosen place tile. The install sheet shows only when opened, as a centred dialog. */
const PREVIEW_CSS = `
.mg .pvframe{position:relative;aspect-ratio:16/9;overflow:hidden;border:2px solid var(--ink);border-radius:var(--r);background:var(--ink)}
.mg .pvframe iframe{position:absolute;top:0;left:0;width:${PREVIEW_W}px;height:${PREVIEW_H}px;border:0;transform-origin:0 0;pointer-events:none}
.mg .tiles a[aria-current]{background:var(--ink);color:var(--bg)}
@media (forced-colors:active){.mg .tiles a[aria-current]{forced-color-adjust:none;background:Highlight;color:HighlightText}}
.mg dialog.isheet:not([open]){display:none}
.mg dialog.isheet[open]{position:fixed;inset:0;margin:auto;max-width:min(30rem,calc(100% - 2 * var(--gut)));height:max-content;z-index:10}
`;

/** A place's read: ReadingRow, the place hero, the persona tag, the UV steps, the embed card, the screen display and its loading veil. The landscape kiosk hides the heat tile's wet-bulb and WBGT lines: at 720p they do not fit at the 24px floor; portrait shows them. */
const READ_CSS = `
.mg .fy{display:inline-block;white-space:nowrap;margin-left:var(--sp2);padding:0 6px;border:2px solid currentColor;border-radius:var(--r);font-size:var(--t-xs);font-weight:600;letter-spacing:.06em;color:var(--ink);vertical-align:.1em}
.mg .rrow.on .lab{color:var(--ink)}
.mg .rrow .more .key{font-weight:600}
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
.mg .kio .kb{overflow:hidden}
@media (orientation:landscape){.mg .kio .kt>p.qa{display:none}}
.mg .kio .kveil{position:absolute;inset:0;z-index:2;display:grid;place-items:center;align-content:center;gap:var(--sp4);background:var(--bg);opacity:0;pointer-events:none}
.mg .kio .kveil.on{opacity:.94}
@media (prefers-reduced-motion:no-preference){.mg .kio .kveil{transition:opacity .3s}}
`;

/** Pull-to-refresh (the installed app only): a marker that turns as you pull. */
const PULL_CSS = `
#ptr{position:fixed;left:50%;top:env(safe-area-inset-top,0px);z-index:60;width:36px;height:36px;display:grid;place-items:center;border-radius:50%;background:var(--bg);color:var(--muted);border:2px solid var(--line);transform:translate(-50%,-48px);pointer-events:none}
#ptr.go{color:var(--ink);border-color:var(--ink)}
@media (prefers-reduced-motion: no-preference){#ptr.spin svg{animation:ptrspin .8s linear infinite}@keyframes ptrspin{to{transform:rotate(360deg)}}}
`;

/** Text marked as another language than the page's (a quoted alert headline, a sample word,
 *  the language names) uses the system face, so an English page never downloads an Indic
 *  font. Text in the page's own language has no lang attribute of its own and takes Anek. */
const LANG_NAMES_CSS = `
.mg [lang]:not([lang="en"]){font-family:system-ui,sans-serif}
`;

/** Safe areas (every page opts into viewport-fit=cover); the hidden attribute wins over a component's display. */
const SAFE_AREA_CSS = `
.mg .sh{padding-top:env(safe-area-inset-top);padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)}
body{padding-bottom:env(safe-area-inset-bottom)}
.mg [hidden]{display:none!important}
`;

export const STANDARD_CSS = COMPONENTS_CSS + PREVIEW_CSS + READ_CSS + PULL_CSS + LANG_NAMES_CSS + SAFE_AREA_CSS;
