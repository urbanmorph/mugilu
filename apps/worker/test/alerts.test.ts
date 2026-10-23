// Opt-in alerts: a browser turns alerts on for a place, and the hourly check
// sends each new official warning over that place once.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  handleSubscribe,
  handleUnsubscribe,
  runAlerts,
  MAX_PLACES,
  POINTS_PER_RUN,
  type AlertDeps,
} from "../src/alerts";
import type { Env } from "../src/index";
import type { Warning } from "../src/types";
import { testD1 } from "./d1";

const SITE = "https://mugilu.live";
const KAVALI = { lat: 14.9132, lon: 79.9931 };

function env(): Env {
  return { METRICS: testD1() } as unknown as Env;
}

const warning = (identifier: string, over: Partial<Warning> = {}): Warning => ({
  event: "Lightning",
  severity: "Severe",
  color: "orange",
  certainty: "Likely",
  area: "nlr-kavali Mandal",
  issuer: "APSDMA",
  until: "Thu Oct 23, 10:50",
  identifier,
  headline: "",
  ...over,
});

/** Fake SACHET and push service: warnings by "lat,lon", and every message sent. */
function fakes(statusFor: (endpoint: string) => number = () => 201) {
  const active = new Map<string, Warning[]>();
  const lookups: string[] = [];
  const sent: { endpoint: string; message: Record<string, string> }[] = [];
  const deps: AlertDeps = {
    alertsAt: async (lat, lon) => {
      lookups.push(`${lat},${lon}`);
      return active.get(`${lat},${lon}`) ?? [];
    },
    send: async (target, message) => {
      const status = statusFor(target.endpoint);
      if (status < 300) sent.push({ endpoint: target.endpoint, message: message as Record<string, string> });
      return status;
    },
  };
  return { active, lookups, sent, deps };
}

let n = 0;
const subscription = (host = "fcm.googleapis.com") => ({
  endpoint: `https://${host}/fcm/send/device-${++n}`,
  keys: { p256dh: "B" + "A".repeat(86), auth: "A".repeat(22) },
});

const post = (path: string, body: unknown, origin = SITE) =>
  new Request(`${SITE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  });

async function subscribe(
  e: Env,
  deps: AlertDeps,
  sub = subscription(),
  place = { ...KAVALI, label: "Kavali", lang: "en" },
) {
  const res = await handleSubscribe(post("/push/subscribe", { subscription: sub, ...place }), e, deps);
  return { res, sub };
}

const rows = async (e: Env) =>
  (await e.METRICS.prepare("SELECT endpoint, lat, lon, label, lang FROM push_places ORDER BY lat, lon").all()).results;

test("turning alerts on keeps the browser's push address and the place, rounded to about 1 km", async () => {
  const e = env();
  const { res, sub } = await subscribe(e, fakes().deps);
  assert.equal(res.status, 200);
  assert.deepEqual(await rows(e), [{ endpoint: sub.endpoint, lat: 14.91, lon: 79.99, label: "Kavali", lang: "en" }]);
});

test("a new official warning over the place is sent once, in the place's language, linking to the place", async () => {
  const e = env();
  const f = fakes();
  const { sub } = await subscribe(e, f.deps, subscription(), { ...KAVALI, label: "Kavali", lang: "hi" });
  f.active.set("14.91,79.99", [warning("1792723707152008")]);
  await runAlerts(e, f.deps);
  assert.equal(f.sent.length, 1);
  const { endpoint, message } = f.sent[0];
  assert.equal(endpoint, sub.endpoint);
  assert.equal(message.title, "Lightning · Severe");
  assert.match(message.body, /Kavali/);
  assert.match(message.body, /Thu Oct 23, 10:50/);
  assert.match(message.body, /APSDMA/);
  assert.equal(message.url, "/hi/c/14.91,79.99");
  assert.equal(message.tag, "warning-1792723707152008");
  await runAlerts(e, f.deps);
  assert.equal(f.sent.length, 1, "not sent again");
});

test("a warning already over the place when alerts are turned on is not sent: the page showed it", async () => {
  const e = env();
  const f = fakes();
  f.active.set("14.91,79.99", [warning("already-on")]);
  await subscribe(e, f.deps);
  await runAlerts(e, f.deps);
  assert.equal(f.sent.length, 0);
});

test("one warnings check per place per run, shared by everyone who chose it", async () => {
  const e = env();
  const f = fakes();
  await subscribe(e, f.deps);
  await subscribe(e, f.deps);
  f.lookups.length = 0;
  f.active.set("14.91,79.99", [warning("w1")]);
  await runAlerts(e, f.deps);
  assert.deepEqual(f.lookups, ["14.91,79.99"]);
  assert.equal(f.sent.length, 2);
});

test("a browser whose push address is gone (404 or 410) is forgotten, with all its places", async () => {
  const e = env();
  const gone = subscription("updates.push.services.mozilla.com");
  const f = fakes((endpoint) => (endpoint === gone.endpoint ? 410 : 201));
  await subscribe(e, f.deps, gone);
  await subscribe(e, f.deps, gone, { lat: 13.0, lon: 77.6, label: "Bengaluru", lang: "en" });
  const kept = (await subscribe(e, f.deps)).sub;
  f.active.set("14.91,79.99", [warning("w1")]);
  await runAlerts(e, f.deps);
  assert.deepEqual(
    (await rows(e)).map((r) => r.endpoint),
    [kept.endpoint],
  );
});

test("a push service that is busy or down (429, 5xx) gets the warning again next run", async () => {
  const e = env();
  let status = 503;
  const f = fakes(() => status);
  await subscribe(e, f.deps);
  f.active.set("14.91,79.99", [warning("w1")]);
  assert.deepEqual(await runAlerts(e, f.deps), { points: 1, found: 1, sent: 0, failed: 1, gone: 0 });
  assert.equal(f.sent.length, 0);
  status = 201;
  assert.deepEqual(await runAlerts(e, f.deps), { points: 1, found: 1, sent: 1, failed: 0, gone: 0 });
});

test("checks a limited number of places per run, the longest-unchecked first, so every place is covered in turn", async () => {
  const e = env();
  const f = fakes();
  // Enough browsers that none reaches the places-per-browser cap.
  const subs = Array.from({ length: Math.ceil((POINTS_PER_RUN + 5) / MAX_PLACES) }, () => subscription());
  for (let i = 0; i < POINTS_PER_RUN + 5; i++) {
    await subscribe(e, f.deps, subs[Math.floor(i / MAX_PLACES)], {
      lat: 20 + i / 10,
      lon: 78,
      label: `P${i}`,
      lang: "en",
    });
  }
  f.lookups.length = 0;
  await runAlerts(e, f.deps, Date.UTC(2026, 9, 23, 4));
  assert.equal(f.lookups.length, POINTS_PER_RUN);
  const first = new Set(f.lookups);
  f.lookups.length = 0;
  await runAlerts(e, f.deps, Date.UTC(2026, 9, 23, 5));
  assert.equal(f.lookups.filter((p) => !first.has(p)).length, 5, "the 5 left over come next");
});

test("forgets which warnings were sent after 7 days", async () => {
  const e = env();
  const f = fakes();
  await subscribe(e, f.deps);
  f.active.set("14.91,79.99", [warning("w1")]);
  const now = Date.UTC(2026, 9, 23, 4);
  await runAlerts(e, f.deps, now);
  const count = () => e.METRICS.prepare("SELECT COUNT(*) AS n FROM push_sent").first("n");
  assert.equal(await count(), 1);
  f.active.clear(); // the warning has ended
  await runAlerts(e, f.deps, now + 6 * 86_400_000);
  assert.equal(await count(), 1, "kept for 7 days");
  await runAlerts(e, f.deps, now + 8 * 86_400_000);
  assert.equal(await count(), 0);
});

test("turning alerts off for one place keeps the others; turning off everything forgets the browser", async () => {
  const e = env();
  const f = fakes();
  const { sub } = await subscribe(e, f.deps);
  await subscribe(e, f.deps, sub, { lat: 13.0, lon: 77.6, label: "Bengaluru", lang: "en" });
  let res = await handleUnsubscribe(post("/push/unsubscribe", { endpoint: sub.endpoint, ...KAVALI }), e);
  assert.equal(res.status, 200);
  assert.deepEqual(
    (await rows(e)).map((r) => r.label),
    ["Bengaluru"],
  );
  res = await handleUnsubscribe(post("/push/unsubscribe", { endpoint: sub.endpoint }), e);
  assert.equal(res.status, 200);
  assert.deepEqual(await rows(e), []);
});

test("refuses what it should: other sites, unknown push services, places outside India, bad keys, too many places", async () => {
  const e = env();
  const f = fakes();
  const ok = { subscription: subscription(), ...KAVALI, label: "Kavali", lang: "en" };
  const status = async (req: Request) => (await handleSubscribe(req, e, f.deps)).status;

  assert.equal(await status(post("/push/subscribe", ok, "https://evil.example")), 403);
  assert.equal(await status(new Request(`${SITE}/push/subscribe`, { headers: { origin: SITE } })), 405);
  // The worker will POST to this address later: only the browsers' own push services.
  for (const endpoint of [
    "https://evil.example/x",
    "http://fcm.googleapis.com/x",
    "https://169.254.169.254/x",
    // Look-alikes of real push services.
    "https://fcm.googleapis.com.evil.example/x",
    "https://push.apple.com.evil.example/x",
    "https://evilpush.apple.com/x",
  ])
    assert.equal(
      await status(post("/push/subscribe", { ...ok, subscription: { ...ok.subscription, endpoint } })),
      400,
      endpoint,
    );
  assert.equal(await status(post("/push/subscribe", { ...ok, lat: 51.5, lon: -0.12 })), 400);
  assert.equal(
    await status(
      post("/push/subscribe", { ...ok, subscription: { ...ok.subscription, keys: { p256dh: "x", auth: "y" } } }),
    ),
    400,
  );
  assert.equal(await status(post("/push/subscribe", { ...ok, lang: "fr" })), 400);

  const sub = subscription("web.push.apple.com");
  for (let i = 0; i < MAX_PLACES; i++)
    assert.equal(await status(post("/push/subscribe", { ...ok, subscription: sub, lat: 20 + i / 10, lon: 78 })), 200);
  assert.equal(await status(post("/push/subscribe", { ...ok, subscription: sub, lat: 25, lon: 78 })), 409);
  // The same place again is not a new one.
  assert.equal(await status(post("/push/subscribe", { ...ok, subscription: sub, lat: 20, lon: 78 })), 200);
});

test("a long place name is cut short and stored as plain text", async () => {
  const e = env();
  await subscribe(e, fakes().deps, subscription(), { ...KAVALI, label: `  ${"x".repeat(200)}  `, lang: "en" });
  const [row] = await rows(e);
  assert.equal(String(row.label).length, 80);
});

test("a warning whose own area does not cover the place is not sent, even inside the lookup radius", async () => {
  const e = env();
  const f = fakes();
  await subscribe(e, f.deps);
  f.active.set("14.91,79.99", [warning("edge", { covers: false }), warning("over", { covers: true })]);
  await runAlerts(e, f.deps);
  assert.deepEqual(
    f.sent.map((s) => s.message.tag),
    ["warning-over"],
  );
});
