import { test } from "node:test";
import assert from "node:assert/strict";
import { adminGate, isAdmin } from "../src/admin";

const req = (headers: Record<string, string> = {}, qs = "") =>
  new Request(`https://mugilu.live/refresh${qs}`, { headers });

test("isAdmin: a Bearer ADMIN_KEY header is let in", () => {
  assert.equal(isAdmin(req({ authorization: "Bearer s3cret-admin" }), { ADMIN_KEY: "s3cret-admin" }), true);
});

test("isAdmin: wrong, missing, or near-miss keys are refused", () => {
  const env = { ADMIN_KEY: "s3cret-admin" };
  assert.equal(isAdmin(req({ authorization: "Bearer s3cret-admiN" }), env), false);
  assert.equal(isAdmin(req({ authorization: "Bearer s3cret" }), env), false);
  assert.equal(isAdmin(req({ authorization: "s3cret-admin" }), env), false);
  assert.equal(isAdmin(req(), env), false);
});

test("isAdmin: the key in the URL is never accepted (URLs land in logs and history)", () => {
  assert.equal(isAdmin(req({}, "?key=s3cret-admin"), { ADMIN_KEY: "s3cret-admin" }), false);
});

test("isAdmin: fails closed when ADMIN_KEY is unset (never matches an empty bearer)", () => {
  assert.equal(isAdmin(req({ authorization: "Bearer " }), {}), false);
  assert.equal(isAdmin(req({ authorization: "Bearer undefined" }), {}), false);
});

test("adminGate: every admin route is refused without the key; other paths pass through", () => {
  const env = { ADMIN_KEY: "s3cret-admin" };
  for (const p of ["/refresh", "/collect", "/api/counts", "/sig", "/warnings/collect", "/fires/collect"])
    assert.equal(adminGate(p, req(), env)?.status, 401, p);
  assert.equal(adminGate("/refresh", req({ authorization: "Bearer s3cret-admin" }), env), null);
  assert.equal(adminGate("/c/bengaluru", req(), env), null);
});
