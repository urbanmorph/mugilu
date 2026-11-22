// "Install app": the web app manifest, the head tags that link it, and a small
// header button (the offline worker is separate: sw.ts). Behaviour by platform:
//   Chrome / Edge / Samsung Internet / Android -> the browser fires
//     `beforeinstallprompt`; we keep it and call prompt() on tap.
//   iPhone / iPad Safari -> no install API; the button opens a short
//     "Share -> Add to Home Screen" guide (a server-rendered, translated <dialog>).
//   Already installed (standalone) or anything else (e.g. Firefox desktop) -> hidden.
// Not rendered on the chromeless kiosk display or the embed card.

import { esc } from "./html";
import { lp, t, type Lang } from "./i18n";
import { SITE_DESC } from "./hazards";
import { NEUTRAL } from "./palette";

/** The browser and app chrome take the header bar's colour (it meets the top of every
 *  page); the launch screen takes the page's. From palette.ts, the one source. */
const BAR_LIGHT = NEUTRAL.light.bar;
const BAR_DARK = NEUTRAL.dark.bar;

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

/** The manifest for one language (/hi/manifest.webmanifest for Hindi). The id and
 *  scope are the same in every language, so it is one app; it opens in the language
 *  it was installed from. */
export function webManifest(lang: Lang = "en") {
  return {
    name: "mugilu: India's open sky",
    short_name: "mugilu",
    id: "/",
    // ?src=pwa marks a launch of the installed app (metrics: entry:pwa). The server and
    // the edge cache ignore it, and the offline worker saves the page without it.
    start_url: `${lp("/", lang)}?src=pwa`,
    scope: "/",
    display: "standalone",
    description: t(SITE_DESC, lang),
    theme_color: BAR_LIGHT,
    background_color: NEUTRAL.light.bg,
    lang,
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

/** <head> tags for every page: the page language's manifest, and theme colours. */
export const installHead = (lang: Lang) =>
  `<link rel="manifest" href="${lp(MANIFEST_PATH, lang)}">` +
  `<meta name="theme-color" media="(prefers-color-scheme: light)" content="${BAR_LIGHT}">` +
  `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${BAR_DARK}">`;

/** Header button (hidden until the script decides) + the iOS guide dialog. The classes
 *  default to the old pages'; the signage pages pass the standard's (btn, isheet). */
export function installButton(lang: Lang, cls = { button: "install", dialog: "install-guide" }): string {
  return (
    `<button type="button" class="${cls.button}" id="install-app" hidden>${esc(t("Install app", lang))}</button>` +
    `<dialog class="${cls.dialog}" id="install-guide" aria-labelledby="install-guide-title">` +
    // The sheet's title labels the dialog; not a heading, so it stays out of the page outline.
    `<p class="ihead" id="install-guide-title">${esc(t("Add mugilu to your Home Screen", lang))}</p><ol>` +
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
