import { test } from "node:test";
import assert from "node:assert/strict";
import { qrSvg } from "../src/qr";

test("qrSvg: returns a scalable svg with a path and a viewBox", () => {
  const svg = qrSvg("hello");
  assert.ok(svg.startsWith("<svg"), "should start with <svg");
  assert.ok(svg.includes("viewBox="), "should declare a viewBox");
  assert.ok(svg.includes("<path"), "should contain a combined path");
  assert.ok(svg.includes('width="100%"'), "should scale to 100% width");
  assert.ok(svg.includes('height="100%"'), "should scale to 100% height");
  assert.ok(svg.includes('shape-rendering="crispEdges"'), "should render crisp edges");
  assert.ok(svg.includes("<rect"), "should have a background rect");
  assert.ok(svg.endsWith("</svg>"), "should be a complete svg element");
});

test("qrSvg: a known short input does not throw", () => {
  assert.doesNotThrow(() => qrSvg("https://mugilu.live/c/bengaluru"));
});

test("qrSvg: a roughly 100-char URL encodes without throwing", () => {
  const url = "https://mugilu.live/c/bengaluru?ref=kiosk&utm_source=walldisplay&utm_medium=qr&utm_campaign=launch-2026";
  assert.ok(url.length >= 100, "fixture URL should be at least 100 chars");
  assert.doesNotThrow(() => {
    const svg = qrSvg(url);
    assert.ok(svg.includes("<path"), "long input still produces a path");
  });
});

test("qrSvg: custom border and colours are honoured", () => {
  const svg = qrSvg("test", { border: 2, dark: "#000000", light: "#eeeeee" });
  assert.ok(svg.includes('fill="#000000"'), "uses the custom dark colour");
  assert.ok(svg.includes('fill="#eeeeee"'), "uses the custom light colour");
});

test("qrSvg: a negative border is rejected", () => {
  assert.throws(() => qrSvg("x", { border: -1 }));
});

test("qrSvg: handles non-ASCII (UTF-8 byte mode)", () => {
  assert.doesNotThrow(() => qrSvg("Bengaluru namma ooru, mannu maleya naadu"));
  assert.doesNotThrow(() => qrSvg("emoji and accents: cafe resume"));
});
