// Workers Logs keep what the code prints, so nothing printed or thrown may carry
// request-derived or secret data: no URLs (they hold visitor coordinates, the OAQ
// broker signature or a browser's push address), no response bodies, no signatures.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { reason } from "../src/logs";
import { getOpenMeteo } from "../src/openmeteo";
import { getSignature } from "../src/handshake";
import { parseFirmsCsv } from "../src/firms";
import type { Env } from "../src/index";

test("reason: the error's kind and message, with any URL removed, cut short", () => {
  const e = new TypeError("Fetch API cannot load: https://oaq.example/v1/x.json?Signature=abc&Expires=1 (timeout)");
  const r = reason(e);
  assert.match(r, /^TypeError: Fetch API cannot load: <url>/);
  assert.ok(!r.includes("Signature") && !r.includes("oaq.example"), r);
  assert.ok(reason(new Error("x".repeat(1000))).length <= 160);
  assert.equal(reason("plain"), "plain");
});

test("no console call in src logs a raw error object (it would print its URL or body)", () => {
  const dir = new URL("../src/", import.meta.url);
  const raw: string[] = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
    readFileSync(new URL(f, dir), "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (/console\.\w+\(.*,\s*(e|err|error|[\w.]+\.reason)\s*\)/.test(line)) raw.push(`${f}:${i + 1}`);
      });
  }
  assert.deepEqual(raw, []);
});

async function withFetch<T>(impl: typeof fetch, fn: () => Promise<T>): Promise<T> {
  const real = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = real;
  }
}

test("open-meteo: a failed call logs the layer and status, never the URL with the visitor's coordinate", async () => {
  const logged: string[] = [];
  const realError = console.error;
  console.error = (...a: unknown[]) => void logged.push(a.map(String).join(" "));
  try {
    await withFetch((async () => new Response("down", { status: 503 })) as unknown as typeof fetch, () =>
      getOpenMeteo(12.9716, 77.5946),
    );
  } finally {
    console.error = realError;
  }
  assert.ok(logged.length >= 1);
  for (const l of logged) {
    assert.ok(!/12\.97|77\.59|https?:/.test(l), l);
    assert.match(l, /503/);
  }
});

test("handshake: a failure never puts the broker's signature or response body in the error", async () => {
  const env = {
    OAQ_KV: { get: async () => null, put: async () => {} },
    OAQ_BROKER_URL: "https://broker.example/x",
    OAQ_API_KEY: "TOKEN-123",
  } as unknown as Env;
  const bodies = [
    () => new Response("SECRET-BODY token=TOKEN-123", { status: 500 }),
    () => Response.json({ baseUrl: "https://b/", signature: "Key-Pair-Id=SECRET-SIG&Signature=zzz" }),
  ];
  for (const body of bodies) {
    const err = await withFetch((async () => body()) as unknown as typeof fetch, () =>
      getSignature(env).then(
        () => null,
        (e: Error) => e,
      ),
    );
    assert.ok(err, "the handshake fails");
    assert.ok(!/SECRET|TOKEN|Signature=/.test(err.message), err.message);
  }
});

test("firms: a body that is not FIRMS CSV is reported without echoing the body", () => {
  assert.throws(
    () => parseFirmsCsv("Invalid MAP_KEY: abcdef0123456789"),
    (e: Error) => !e.message.includes("abcdef") && /not a FIRMS CSV/.test(e.message),
  );
});
