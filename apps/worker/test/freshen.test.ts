// Pages that show the sky now never sit stale: back on screen (or left open) after
// the refresh interval, they fetch a fresh reading.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { FRESHEN_JS } from "../src/freshen";
import { renderConditionsPage, renderHome, renderKioskPage, renderEmbed } from "../src/page";
import type { Conditions } from "../src/types";

function page(o: { online?: boolean; standalone?: boolean; scrollY?: number } = {}) {
  let now = 1_000_000;
  const listeners: Record<string, ((e?: unknown) => void)[]> = {};
  const intervals: (() => void)[] = [];
  const doc = {
    visibilityState: "visible",
    getElementById: () => null,
    addEventListener: (t: string, f: () => void) => (listeners[t] ??= []).push(f),
  };
  let reloads = 0;
  const win: Record<string, unknown> = {
    Date: { now: () => now },
    document: doc,
    navigator: { onLine: o.online ?? true },
    location: { reload: () => reloads++ },
    addEventListener: (t: string, f: () => void) => (listeners[t] ??= []).push(f),
    setInterval: (f: () => void) => intervals.push(f),
    matchMedia: () => ({ matches: !!o.standalone }),
    scrollY: o.scrollY ?? 0,
  };
  win.window = win;
  runInNewContext(FRESHEN_JS, win);
  return {
    advance: (min: number) => (now += min * 60_000),
    fire: (t: string, e?: unknown) => (listeners[t] ?? []).forEach((f) => f(e)),
    tick: () => intervals.forEach((f) => f()),
    hide: () => (doc.visibilityState = "hidden"),
    show: () => (doc.visibilityState = "visible"),
    reloads: () => reloads,
    /** A finger pulling down from y=100 to y=100+px, then lifting. */
    pull: (px: number) => {
      (listeners.touchstart ?? []).forEach((f) => f({ touches: [{ clientY: 100 }] }));
      (listeners.touchmove ?? []).forEach((f) => f({ touches: [{ clientY: 100 + px }] }));
      (listeners.touchend ?? []).forEach((f) => f({}));
    },
  };
}

test("coming back to the screen after 15 minutes fetches a fresh reading; sooner does not", () => {
  const p = page();
  p.hide();
  p.advance(10);
  p.show();
  p.fire("visibilitychange");
  assert.equal(p.reloads(), 0);
  p.hide();
  p.advance(6);
  p.show();
  p.fire("visibilitychange");
  assert.equal(p.reloads(), 1);
});

test("left open on screen, it refreshes once the reading is 15 minutes old; hidden, it waits", () => {
  const p = page();
  p.advance(14);
  p.tick();
  assert.equal(p.reloads(), 0);
  p.hide();
  p.advance(5);
  p.tick();
  assert.equal(p.reloads(), 0, "not while hidden");
  p.show();
  p.tick();
  assert.equal(p.reloads(), 1);
});

test("a page restored from the back/forward cache counts as coming back", () => {
  const p = page();
  p.advance(20);
  p.fire("pageshow", { persisted: true });
  assert.equal(p.reloads(), 1);
});

test("offline it keeps the saved reading instead of reloading into nothing", () => {
  const p = page({ online: false });
  p.advance(30);
  p.tick();
  assert.equal(p.reloads(), 0);
});

test("in the installed app, pulling down from the top refreshes; a short pull or a pull mid-page does not", () => {
  const p = page({ standalone: true });
  p.pull(40);
  assert.equal(p.reloads(), 0);
  p.pull(90);
  assert.equal(p.reloads(), 1);
  const mid = page({ standalone: true, scrollY: 300 });
  mid.pull(120);
  assert.equal(mid.reloads(), 0);
});

test("in a browser tab, the browser's own pull-to-refresh is left alone", () => {
  const p = page({ standalone: false });
  p.pull(120);
  assert.equal(p.reloads(), 0);
});

const C = {
  location: { lat: 12.97, lon: 77.59 },
  as_of: "2026-10-25T06:00:00.000Z",
  heat: { temp_c: 26, humidity_pct: 60, apparent_c: 27, source: "om" },
  attribution: "",
  disclaimer: "",
} as unknown as Conditions;

test("the place page and the home page (where the installed app opens) carry it; the display and embed do not", () => {
  assert.ok(renderConditionsPage(C).includes(FRESHEN_JS));
  assert.ok(renderHome().includes(FRESHEN_JS));
  assert.ok(
    !renderKioskPage(C, "everyone", "https://mugilu.live/c/x", "<svg/>").includes(FRESHEN_JS),
    "the display has its own refresh",
  );
  assert.ok(!renderEmbed(C, "everyone", "https://mugilu.live").includes(FRESHEN_JS));
});
