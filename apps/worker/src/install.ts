// "Install app": the web app manifest, the head tags that link it, and a small
// header button (no service worker). Behaviour by platform:
//   Chrome / Edge / Samsung Internet / Android -> the browser fires
//     `beforeinstallprompt`; we keep it and call prompt() on tap.
//   iPhone / iPad Safari -> no install API; the button opens a short
//     "Share -> Add to Home Screen" guide (a server-rendered, translated <dialog>).
//   Already installed (standalone) or anything else (e.g. Firefox desktop) -> hidden.
// Not rendered on the chromeless kiosk display or the embed card.

import { esc } from "./html";
import { t, type Lang } from "./i18n";

/** Page backgrounds (BASE_CSS --bg), so the browser/app chrome blends with the page. */
const BG_LIGHT = "#f8fafc";
const BG_DARK = "#0b1220";

export const MANIFEST_PATH = "/manifest.webmanifest";

/** PNG icon routes (rendered in icon.ts). The maskable one keeps the cloud
 *  inside the 80% safe zone so launcher masks never crop it. */
export const ICONS = {
  "/icon-192.png": { size: 192, maskable: false },
  "/icon-512.png": { size: 512, maskable: false },
  "/icon-maskable-512.png": { size: 512, maskable: true },
} as const;

/** Install-dialog screenshots of the home page (static files in public/, served by
 *  Workers Static Assets). Only the browser's install UI fetches them. */
const SCREENSHOTS = {
  "/screenshot-narrow.webp": { sizes: "824x1830", form_factor: "narrow" },
  "/screenshot-wide.webp": { sizes: "1280x800", form_factor: "wide" },
} as const;

export function webManifest() {
  return {
    name: "mugilu: India's open sky",
    short_name: "mugilu",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    description:
      "Air, heat, rain, UV, dust and the official warning over any point in India, the single worst hazard named for you.",
    theme_color: BG_LIGHT,
    background_color: BG_LIGHT,
    lang: "en",
    icons: Object.entries(ICONS).map(([src, { size, maskable }]) => ({
      src,
      sizes: `${size}x${size}`,
      type: "image/png",
      purpose: maskable ? "maskable" : "any",
    })),
    screenshots: Object.entries(SCREENSHOTS).map(([src, shot]) => ({
      src,
      ...shot,
      type: "image/webp",
      label: "Look up the sky over any place in India",
    })),
  };
}

/** <head> tags for every shell() page. */
export const INSTALL_HEAD =
  `<link rel="manifest" href="${MANIFEST_PATH}">` +
  `<meta name="theme-color" media="(prefers-color-scheme: light)" content="${BG_LIGHT}">` +
  `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${BG_DARK}">`;

export const INSTALL_CSS = `
.install{margin-left:auto;font:500 .82rem/1 var(--sans);color:var(--sky);background:transparent;border:1px solid color-mix(in srgb,var(--sky) 40%,transparent);border-radius:999px;padding:7px 13px;cursor:pointer}
.install:hover{border-color:var(--sky)}
.install-guide{max-width:22rem;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink);padding:18px 20px}
.install-guide::backdrop{background:rgb(0 0 0/.45)}
.install-guide h2{font-size:1.05rem;margin:0 0 .6rem}
.install-guide ol{margin:0 0 1rem;padding-left:1.2rem;line-height:1.55}
.install-guide form{text-align:right}
.install-guide button{font:600 .9rem var(--sans);color:#fff;background:var(--sky);border:0;border-radius:8px;padding:8px 18px;cursor:pointer}
`;

/** Header button (hidden until the script decides) + the iOS guide dialog. */
export function installButton(lang: Lang): string {
  return (
    `<button type="button" class="install" id="install-app" hidden>${esc(t("Install app", lang))}</button>` +
    `<dialog class="install-guide" id="install-guide" aria-labelledby="install-guide-title">` +
    `<h2 id="install-guide-title">${esc(t("Add mugilu to your Home Screen", lang))}</h2><ol>` +
    `<li>${esc(t("Tap the Share button (the square with an arrow) in Safari's toolbar.", lang))}</li>` +
    `<li>${esc(t("Scroll down and tap Add to Home Screen.", lang))}</li>` +
    `<li>${esc(t("Tap Add.", lang))}</li></ol>` +
    `<form method="dialog"><button>${esc(t("OK", lang))}</button></form></dialog>`
  );
}

// iPadOS 13+ reports itself as a Mac; tell it apart by touch support. Chrome,
// Firefox, Edge and Opera on iOS (CriOS/FxiOS/EdgiOS/OPiOS) are excluded.
export const INSTALL_JS =
  `(function(w,d){var b=d.getElementById('install-app'),g=d.getElementById('install-guide'),n=w.navigator,ua=n.userAgent||'';` +
  `if(!b||(w.matchMedia&&w.matchMedia('(display-mode: standalone)').matches)||n.standalone===true)return;` +
  `var ios=(/iPhone|iPad|iPod/.test(ua)||(/Macintosh/.test(ua)&&(n.maxTouchPoints||0)>1))&&!/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua),ev=null;` +
  `w.addEventListener('beforeinstallprompt',function(e){e.preventDefault();ev=e;b.hidden=false;});` +
  `w.addEventListener('appinstalled',function(){ev=null;b.hidden=true;});` +
  `if(ios)b.hidden=false;` +
  `b.addEventListener('click',function(){if(ev){var e=ev;ev=null;e.prompt();e.userChoice.then(function(c){if(c.outcome==='accepted')b.hidden=true;});return;}if(ios&&g)g.showModal();});` +
  `})(window,document);`;
