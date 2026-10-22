import { test } from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { INSTALL_JS, webManifest } from "../src/install";
import { renderHome, renderKioskPage, renderEmbed, renderAbout } from "../src/page";
import type { Conditions } from "../src/types";

// --- the client script, run against a fake browser -------------------------------

const UA = {
  chrome: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36",
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  ipadAsMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1",
  firefox: "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
};

type Handler = (e?: unknown) => unknown;
function fakeBrowser(opts: { ua: string; touch?: number; standalone?: boolean; iosStandalone?: boolean }) {
  const winHandlers: Record<string, Handler> = {};
  let clickHandler: Handler | undefined;
  const button = {
    hidden: true,
    addEventListener: (type: string, fn: Handler) => {
      if (type === "click") clickHandler = fn;
    },
  };
  const guide = { opened: 0, showModal: () => guide.opened++ };
  const window = {
    navigator: { userAgent: opts.ua, maxTouchPoints: opts.touch ?? 0, standalone: opts.iosStandalone },
    matchMedia: (q: string) => ({ matches: q === "(display-mode: standalone)" && !!opts.standalone }),
    addEventListener: (type: string, fn: Handler) => (winHandlers[type] = fn),
  };
  const document = {
    getElementById: (id: string) => (id === "install-app" ? button : id === "install-guide" ? guide : null),
  };
  runInNewContext(INSTALL_JS, { window, document });
  return {
    button,
    guide,
    fire: (type: string, e?: unknown) => winHandlers[type]?.(e),
    listens: (type: string) => type in winHandlers,
    click: () => clickHandler?.(),
  };
}

function promptEvent(outcome: "accepted" | "dismissed") {
  const ev = {
    prevented: false,
    prompted: 0,
    preventDefault: () => (ev.prevented = true),
    prompt: () => ev.prompted++,
    userChoice: Promise.resolve({ outcome }),
  };
  return ev;
}

test("install: Chrome/Android stays hidden until beforeinstallprompt, then prompt() on tap", async () => {
  const b = fakeBrowser({ ua: UA.chrome });
  assert.equal(b.button.hidden, true);
  const ev = promptEvent("accepted");
  b.fire("beforeinstallprompt", ev);
  assert.equal(ev.prevented, true, "the browser's own mini-infobar is suppressed");
  assert.equal(b.button.hidden, false);
  b.click();
  assert.equal(ev.prompted, 1);
  await ev.userChoice;
  await Promise.resolve();
  assert.equal(b.button.hidden, true, "accepted install hides the button");
  b.click(); // the event is single-use
  assert.equal(ev.prompted, 1);
  assert.equal(b.guide.opened, 0);
});

test("install: a dismissed prompt leaves the button visible", async () => {
  const b = fakeBrowser({ ua: UA.chrome });
  const ev = promptEvent("dismissed");
  b.fire("beforeinstallprompt", ev);
  b.click();
  await ev.userChoice;
  await Promise.resolve();
  assert.equal(b.button.hidden, false);
});

test("install: appinstalled hides the button", () => {
  const b = fakeBrowser({ ua: UA.chrome });
  b.fire("beforeinstallprompt", promptEvent("accepted"));
  b.fire("appinstalled");
  assert.equal(b.button.hidden, true);
});

test("install: iPhone Safari shows the button and opens the Add to Home Screen guide", () => {
  const b = fakeBrowser({ ua: UA.iphone });
  assert.equal(b.button.hidden, false);
  b.click();
  assert.equal(b.guide.opened, 1);
});

test("install: iPadOS (reports as Mac, has touch) counts as iOS Safari; a real Mac does not", () => {
  assert.equal(fakeBrowser({ ua: UA.ipadAsMac, touch: 5 }).button.hidden, false);
  assert.equal(fakeBrowser({ ua: UA.ipadAsMac, touch: 0 }).button.hidden, true);
});

test("install: other iOS browsers and Firefox desktop stay hidden", () => {
  assert.equal(fakeBrowser({ ua: UA.iphoneChrome }).button.hidden, true);
  assert.equal(fakeBrowser({ ua: UA.firefox }).button.hidden, true);
});

test("install: already installed (standalone) stays hidden and does not listen", () => {
  for (const b of [
    fakeBrowser({ ua: UA.chrome, standalone: true }),
    fakeBrowser({ ua: UA.iphone, iosStandalone: true }),
  ]) {
    assert.equal(b.button.hidden, true);
    assert.equal(b.listens("beforeinstallprompt"), false);
  }
});

// --- manifest ---------------------------------------------------------------------

test("webManifest: installable fields, 192 + 512 'any' icons and a separate maskable 512", () => {
  const m = webManifest();
  assert.equal(m.name.includes("mugilu"), true);
  assert.equal(m.short_name, "mugilu");
  assert.equal(m.id, "/");
  assert.equal(m.start_url, "/");
  assert.equal(m.scope, "/");
  assert.equal(m.display, "standalone");
  assert.ok(m.description.length > 20);
  assert.match(m.theme_color, /^#[0-9a-f]{6}$/);
  assert.match(m.background_color, /^#[0-9a-f]{6}$/);
  assert.equal(m.lang, "en");
  const any = m.icons.filter((i) => i.purpose === "any").map((i) => i.sizes);
  assert.deepEqual(any.sort(), ["192x192", "512x512"]);
  const mask = m.icons.filter((i) => i.purpose === "maskable");
  assert.equal(mask.length, 1);
  assert.equal(mask[0].sizes, "512x512");
  for (const i of m.icons) assert.equal(i.type, "image/png");
  assert.equal(new Set(m.icons.map((i) => i.src)).size, 3, "maskable is its own file");
});

// --- page wiring ------------------------------------------------------------------

function cond(): Conditions {
  return {
    location: { lat: 28.61, lon: 77.21 },
    as_of: "2026-06-28T11:00:00.000Z",
    place: "Delhi, Delhi",
    heat: { temp_c: 41, humidity_pct: 31, apparent_c: 46, wet_bulb_c: 27, source: "open-meteo" },
    attribution: "Sources: Open-Meteo, via mugilu",
    disclaimer: "Informational only.",
  } as Conditions;
}

test("pages: manifest + light/dark theme-color in the head; hidden install button + iOS guide + script", () => {
  for (const html of [renderHome(), renderAbout()]) {
    assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest">/);
    assert.match(html, /<meta name="theme-color" media="\(prefers-color-scheme: light\)" content="#[0-9a-f]{6}">/);
    assert.match(html, /<meta name="theme-color" media="\(prefers-color-scheme: dark\)" content="#[0-9a-f]{6}">/);
    assert.match(html, /<button[^>]*id="install-app"[^>]*hidden[^>]*>Install app<\/button>/);
    assert.match(html, /<dialog[^>]*id="install-guide"/);
    assert.ok(html.includes(INSTALL_JS));
  }
});

test("pages: install strings follow the page language", () => {
  const hi = renderHome(undefined, undefined, undefined, "hi");
  assert.doesNotMatch(hi, />Install app</);
  assert.doesNotMatch(hi, /Add mugilu to your Home Screen/);
  const kn = renderHome(undefined, undefined, undefined, "kn");
  assert.doesNotMatch(kn, />Install app</);
});

test("kiosk + embed: no install button (kiosk keeps the manifest link)", () => {
  const kiosk = renderKioskPage(cond(), "everyone", "https://mugilu.live/c/delhi", "<svg>QR</svg>");
  assert.match(kiosk, /rel="manifest"/);
  assert.doesNotMatch(kiosk, /id="install-app"/);
  assert.ok(!kiosk.includes(INSTALL_JS));
  const embed = renderEmbed(cond(), "everyone", "https://mugilu.live");
  assert.doesNotMatch(embed, /id="install-app"/);
  assert.ok(!embed.includes(INSTALL_JS));
});
