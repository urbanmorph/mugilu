// The "alert me" box on a place's page: its script, run against a fake browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { ALERTS_JS, renderAlertsBox } from "../src/alerts-ui";
import { renderConditionsPage, renderTerms } from "../src/page";
import type { Conditions } from "../src/types";

const KEY = "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8";
const IDS = [
  "alerts",
  "alerts-on",
  "alerts-off",
  "alerts-state",
  "alerts-ios",
  "alerts-denied",
  "alerts-failed",
  "alerts-full",
];
const UA = {
  android: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36",
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
};

type El = { hidden: boolean; click?: () => unknown; addEventListener: (t: string, f: () => unknown) => void };

function browser(
  o: { ua?: string; push?: boolean; permission?: string; standalone?: boolean; status?: number; saved?: string[] } = {},
) {
  const els: Record<string, El & { attrs?: Record<string, string> }> = {};
  for (const id of IDS)
    els[id] = {
      hidden: id !== "alerts-on" && id !== "alerts-off",
      addEventListener(type, fn) {
        if (type === "click") this.click = fn;
      },
    };
  els.alerts.attrs = { "data-key": KEY, "data-lang": "hi" };
  (els.alerts as unknown as { getAttribute: (k: string) => string }).getAttribute = (k) => els.alerts.attrs![k];
  const store = new Map<string, string>(o.saved ? [["mugilu:alerts", JSON.stringify(o.saved)]] : []);
  const posts: { path: string; body: Record<string, unknown> }[] = [];
  let subscribed: { endpoint: string; unsubscribed: boolean; key?: Uint8Array } | null = null;
  const sub = () => ({
    endpoint: subscribed!.endpoint,
    toJSON: () => ({ endpoint: subscribed!.endpoint, keys: { p256dh: "p", auth: "a" } }),
    unsubscribe: async () => ((subscribed!.unsubscribed = true), true),
  });
  const reg = {
    pushManager: {
      getSubscription: async () => (subscribed && !subscribed.unsubscribed ? sub() : null),
      subscribe: async (opts: { applicationServerKey: Uint8Array }) => {
        subscribed = {
          endpoint: "https://fcm.googleapis.com/fcm/send/x",
          unsubscribed: false,
          key: opts.applicationServerKey,
        };
        return sub();
      },
    },
  };
  const window: Record<string, unknown> = {
    navigator: {
      userAgent: o.ua ?? UA.android,
      maxTouchPoints: 5,
      standalone: o.standalone,
      serviceWorker: { ready: Promise.resolve(reg) },
    },
    matchMedia: () => ({ matches: !!o.standalone }),
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    },
    fetch: async (path: string, init: { body: string }) => {
      posts.push({ path, body: JSON.parse(init.body) });
      return { ok: (o.status ?? 200) < 300, status: o.status ?? 200 };
    },
    atob,
    document: {
      getElementById: (id: string) => els[id] ?? null,
      querySelector: (s: string) =>
        s === "h1.loc" ? { getAttribute: () => "14.9132,79.9931", textContent: " Kavali, Andhra Pradesh " } : null,
    },
  };
  if (o.push !== false) {
    window.PushManager = function () {};
    window.Notification = { requestPermission: async () => o.permission ?? "granted" };
  }
  window.window = window;
  runInNewContext(ALERTS_JS, window);
  const settle = () => new Promise((r) => setTimeout(r, 0));
  const tap = async (id: string) => {
    await els[id].click!();
    for (let i = 0; i < 10; i++) await settle();
  };
  return { els, posts, store, tap, subscription: () => subscribed };
}

/** What the person sees: nothing while the box is hidden, else the parts shown in it. */
const shown = (b: ReturnType<typeof browser>) =>
  b.els.alerts.hidden ? [] : IDS.filter((id) => id !== "alerts-off" && !b.els[id].hidden);

test("where the browser can receive alerts, the box offers to turn them on", () => {
  assert.deepEqual(shown(browser()), ["alerts", "alerts-on"]);
});

test("turning alerts on asks permission, subscribes with mugilu's key, and sends the place", async () => {
  const b = browser();
  await b.tap("alerts-on");
  assert.equal(b.subscription()!.key!.length, 65, "the VAPID public key, decoded");
  assert.deepEqual(b.posts, [
    {
      path: "/push/subscribe",
      body: {
        subscription: { endpoint: "https://fcm.googleapis.com/fcm/send/x", keys: { p256dh: "p", auth: "a" } },
        lat: 14.9132,
        lon: 79.9931,
        label: "Kavali, Andhra Pradesh",
        lang: "hi",
      },
    },
  ]);
  assert.deepEqual(shown(b), ["alerts", "alerts-state"]);
  assert.deepEqual(JSON.parse(b.store.get("mugilu:alerts")!), ["14.91,79.99"]);
});

test("a place with alerts on says so when the page opens", () => {
  assert.deepEqual(shown(browser({ saved: ["14.91,79.99"] })), ["alerts", "alerts-state"]);
});

test("if notifications are refused, it says how to allow them and sends nothing", async () => {
  const b = browser({ permission: "denied" });
  await b.tap("alerts-on");
  assert.deepEqual(b.posts, []);
  assert.deepEqual(shown(b), ["alerts", "alerts-on", "alerts-denied"]);
});

test("too many places, or a failure, is said plainly and leaves alerts off", async () => {
  let b = browser({ status: 409 });
  await b.tap("alerts-on");
  assert.deepEqual(shown(b), ["alerts", "alerts-on", "alerts-full"]);
  b = browser({ status: 500 });
  await b.tap("alerts-on");
  assert.deepEqual(shown(b), ["alerts", "alerts-on", "alerts-failed"]);
  assert.equal(b.store.get("mugilu:alerts"), undefined);
});

test("turning off the last place unsubscribes the browser; with others left, only this place goes", async () => {
  let b = browser();
  await b.tap("alerts-on");
  await b.tap("alerts-off");
  assert.deepEqual(b.posts[1], {
    path: "/push/unsubscribe",
    body: { endpoint: "https://fcm.googleapis.com/fcm/send/x" },
  });
  assert.equal(b.subscription()!.unsubscribed, true);
  assert.deepEqual(shown(b), ["alerts", "alerts-on"]);

  b = browser({ saved: ["13.00,77.60"] });
  await b.tap("alerts-on");
  await b.tap("alerts-off");
  assert.deepEqual(b.posts[1], {
    path: "/push/unsubscribe",
    body: { endpoint: "https://fcm.googleapis.com/fcm/send/x", lat: 14.9132, lon: 79.9931 },
  });
  assert.equal(b.subscription()!.unsubscribed, false);
  assert.deepEqual(JSON.parse(b.store.get("mugilu:alerts")!), ["13.00,77.60"]);
});

test("on an iPhone not yet installed, it explains to install mugilu first; elsewhere without push, nothing shows", () => {
  assert.deepEqual(shown(browser({ ua: UA.iphone, push: false })), ["alerts", "alerts-ios"]);
  assert.deepEqual(shown(browser({ push: false })), []);
});

// --- the page ----------------------------------------------------------------------

const C = {
  location: { lat: 14.91, lon: 79.99 },
  as_of: "2026-10-23T08:35:00.000Z",
  air: null,
  heat: { temp_c: 30, humidity_pct: 70, apparent_c: 34, source: "open-meteo" },
  rain: { precipitation_mm: 0, source: "open-meteo" },
  uv: { index: 3, source: "open-meteo" },
  dust: { dust_ug_m3: 3, aod: 0.1, source: "open-meteo" },
  attribution: "",
  disclaimer: "",
} as unknown as Conditions;

test("a place's page carries the box, hidden until the script decides, with the opt-in notice; only when alerts are set up", () => {
  const box = renderAlertsBox(KEY, "en");
  assert.match(box, /<section class="alerts" id="alerts" hidden data-key="BP4z9/);
  assert.match(box, /data-lang="en"/);
  assert.match(box, /about 1 km/);
  for (const id of IDS) assert.ok(box.includes(`id="${id}"`), id);
  const on = renderConditionsPage(C, "everyone", "https://mugilu.live/c/14.91,79.99", "en", KEY);
  assert.ok(on.includes(box) && on.includes(ALERTS_JS));
  const off = renderConditionsPage(C, "everyone", "https://mugilu.live/c/14.91,79.99", "en");
  assert.ok(!off.includes('id="alerts"'));
});

test("the Terms page's privacy section says what turning alerts on keeps", () => {
  assert.match(renderTerms("en"), /If you turn on alerts for a place, mugilu keeps that place \(to about 1 km\)/);
  assert.match(renderTerms("hi"), /अगर आप किसी जगह के लिए अलर्ट चालू करते हैं/);
});
