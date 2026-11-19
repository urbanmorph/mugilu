import {
  BAND_COLOR,
  BAND_ON_FILL,
  BAND_TEXT,
  HAZARD_TINT,
  MAP_HUE,
  NEUTRAL,
  ON_FILL,
  BRAND,
  QR_INK,
  QR_PAPER,
  RISK_COLOR,
  RISK_TEXT,
  WASH_STRENGTH,
} from "../palette";

// The first of the two stylesheets every page loads (tokens, then the components in
// standard.ts). Generated from palette.ts, so a colour changes in one place. Light is
// the default; dark follows the system setting unless the page is pinned with
// <html data-theme="light|dark"> (the footer's theme switch). The page root is
// <body class="mg" data-tint=".." data-level="..">.

type Mode = "light" | "dark";
const decl = (vars: Record<string, string>) =>
  Object.entries(vars)
    .map(([k, v]) => `--${k}:${v};`)
    .join("");

/** The colour variables that change with the theme. */
function themed(m: Mode): Record<string, string> {
  const n = NEUTRAL[m];
  const i = m === "light" ? 0 : 1;
  const map = MAP_HUE[m];
  return {
    bg: n.bg,
    ink: n.ink,
    muted: n.muted,
    placeholder: n.placeholder,
    line: n.line,
    soft: n.soft,
    track: n.track,
    focus: n.focus,
    bar: n.bar,
    "on-bar": n.onBar,
    "bar-rule": n.barRule,
    ...Object.fromEntries(Object.entries(RISK_TEXT).map(([k, v]) => [`rt-${k}`, v[i]])),
    ...Object.fromEntries(Object.entries(BAND_TEXT).map(([k, v]) => [`bt-${k}`, v[i]])),
    mair: map.air,
    mheat: map.heat,
    mcold: map.cold,
    mrain1: map.rain1,
    mrain2: map.rain2,
    mrain3: map.rain3,
    mland: map.land,
    m0: map.calm,
  };
}

/** The variables that are the same in both themes. */
const FIXED: Record<string, string> = {
  ...Object.fromEntries(Object.entries(RISK_COLOR).map(([k, v]) => [k, v])),
  ...Object.fromEntries(Object.entries(ON_FILL).map(([k, v]) => [`on-${k}`, v])),
  ...Object.fromEntries(Object.entries(BAND_COLOR).map(([k, v]) => [`b-${k}`, v])),
  ...Object.fromEntries(Object.entries(BAND_ON_FILL).map(([k, v]) => [`on-b-${k}`, v])),
  brand: BRAND,
  "qr-ink": QR_INK,
  "qr-paper": QR_PAPER,
  hue: HAZARD_TINT.none,
  s: "0%",
  // Type: four fixed steps, four fluid between 390 and 1280 wide.
  "t-xs": "13px",
  "t-sm": "15px",
  "t-base": "18px",
  "t-lg": "21px",
  "t-xl": "clamp(24px,calc(24px + (100vw - 390px) * 2 / 890),26px)",
  "t-2xl": "clamp(28px,calc(28px + (100vw - 390px) * 6 / 890),34px)",
  "t-3xl": "clamp(42px,calc(42px + (100vw - 390px) * 26 / 890),68px)",
  "t-4xl": "clamp(56px,calc(56px + (100vw - 390px) * 36 / 890),92px)",
  // Kiosk steps by viewport height: 24/32/64/120 at 720p (24 is the 3 m floor).
  k1: "3.333vh",
  k2: "4.444vh",
  k3: "8.889vh",
  k4: "16.667vh",
  sp1: "4px",
  sp2: "8px",
  sp3: "12px",
  sp4: "16px",
  sp5: "24px",
  sp6: "32px",
  sp7: "48px",
  sp8: "64px",
  gut: "clamp(16px,calc(16px + (100vw - 390px) * 34 / 890),50px)",
  col: "1180px",
  r: "4px",
  hit: "44px",
};

const DARK_SYS = `:root:not([data-theme="light"])`;
const DARK_PIN = `:root[data-theme="dark"]`;
const WASH_ON = `.mg[data-tint]:not([data-tint="off"])`;

/** Rules that hold only in dark: under the system setting and when pinned. */
const darkRules = (rules: (scope: string) => string) =>
  `@media (prefers-color-scheme:dark){${rules(DARK_SYS)}}${rules(DARK_PIN)}`;

const wash = (m: Mode, scope = "") =>
  Object.entries(WASH_STRENGTH[m])
    .map(([lv, s]) => `${scope}${scope ? " " : ""}${WASH_ON}[data-level="${lv}"]{--s:${s}%}`)
    .join("");

/** Level and band modifiers: --lv is the fill, --on the text on it. */
const MODIFIERS =
  Object.keys(RISK_COLOR)
    .map((k) => `.mg .${k}{--lv:var(--${k});--on:var(--on-${k})}`)
    .join("") +
  Object.keys(BAND_COLOR)
    .map((k) => `.mg .b-${k}{--lv:var(--b-${k});--on:var(--on-b-${k})}`)
    .join("") +
  `.mg .nolevel{--lv:var(--soft);--on:var(--ink)}`;

const TYPE_ROLES =
  `.mg .t-kicker{font-size:var(--t-sm);font-weight:600;letter-spacing:.12em;text-transform:uppercase}` +
  `.mg .t-title{font-size:var(--t-3xl);font-weight:800;font-stretch:75%;line-height:.95;text-transform:uppercase;margin:0}` +
  `.mg .t-h2{font-size:var(--t-2xl);font-weight:800;font-stretch:78%;line-height:1;text-transform:uppercase;margin:0}` +
  `.mg .t-value{font-size:var(--t-xl);font-weight:600;font-stretch:85%;line-height:1.15}` +
  `.mg .t-lead{font-size:var(--t-lg);font-weight:600;line-height:1.35}` +
  `.mg .t-meta{font-size:var(--t-sm);color:var(--muted);line-height:1.4}` +
  `.mg .t-legal{font-size:var(--t-xs);color:var(--muted);line-height:1.35}` +
  `.mg .t-plate{font-size:var(--t-4xl);font-weight:800;font-stretch:75%;line-height:.88;text-transform:uppercase}` +
  `.mg :lang(hi),.mg :lang(kn),.mg :lang(te),.mg :lang(bn){letter-spacing:0;text-transform:none;font-stretch:100%;line-height:1.5}` +
  `.mg :lang(hi){font-family:'Anek Devanagari',sans-serif}.mg :lang(kn){font-family:'Anek Kannada',sans-serif}` +
  `.mg :lang(te){font-family:'Anek Telugu',sans-serif}.mg :lang(bn){font-family:'Anek Bangla',sans-serif}`;

const KIOSK =
  `.mg[data-kiosk]{--t-xs:var(--k1);--t-sm:var(--k1);--t-base:var(--k2);--t-lg:var(--k2);--t-xl:var(--k2);--t-2xl:var(--k3);--t-3xl:var(--k3);--t-4xl:var(--k4);padding:0}` +
  `@media (orientation:portrait){.mg[data-kiosk]{--k1:1.5625vh;--k2:1.979vh;--k3:4.167vh;--k4:8.75vh}}`;

const FORCED =
  `@media (forced-colors:active){.mg .chip,.mg .plate,.mg .fill{border:3px solid CanvasText}` +
  `.mg .chip,.mg .plate,.mg .fill,.mg .track,.mg .gauge,.mg .uvs,.mg .msvg,.mg .mlg svg,.mg .levels>div{forced-color-adjust:none}` +
  `.mg .t-plate{line-height:.95;margin-top:.08em}}`;

/** The tokens stylesheet (built once, at module load: every input is a constant). */
export const TOKENS_CSS =
  `.mg{${decl({ ...themed("light"), ...FIXED })}` +
  `font-family:'Anek Latin',system-ui,sans-serif;font-size:var(--t-base);line-height:1.5;color:var(--ink);` +
  `background:color-mix(in srgb,var(--hue) var(--s),var(--bg));box-sizing:border-box}` +
  Object.entries(HAZARD_TINT)
    .map(([k, h]) => `.mg[data-tint="${k}"]{--hue:${h}}`)
    .join("") +
  wash("light") +
  darkRules((scope) => `${scope} .mg{${decl(themed("dark"))}}` + wash("dark", scope)) +
  MODIFIERS +
  TYPE_ROLES +
  KIOSK +
  FORCED;
