// Web Push without a library: the message encryption (RFC 8291, aes128gcm) and
// the sender's signed identity (VAPID, RFC 8292), checked against the RFC's own
// worked example and by verifying the signature.
import { test } from "node:test";
import assert from "node:assert/strict";
import { b64url, fromB64url, encryptPayload, vapidHeaders } from "../src/webpush";

// RFC 8291, section 5 and Appendix A.
const RFC = {
  plaintext: "When I grow up, I want to be a watermelon",
  asPublic: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  uaPublic: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  body:
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml" +
    "mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT" +
    "pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

/** The RFC's sender key pair, as WebCrypto keys. */
async function rfcSenderKeys(): Promise<CryptoKeyPair> {
  const pub = fromB64url(RFC.asPublic);
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: b64url(pub.slice(1, 33)),
    y: b64url(pub.slice(33, 65)),
    d: RFC.asPrivate,
  };
  const privateKey = await crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  const publicKey = await crypto.subtle.importKey("raw", pub, { name: "ECDH", namedCurve: "P-256" }, true, []);
  return { privateKey, publicKey };
}

test("encrypts a message exactly as RFC 8291's worked example", async () => {
  const body = await encryptPayload(
    new TextEncoder().encode(RFC.plaintext),
    { p256dh: RFC.uaPublic, auth: RFC.auth },
    { salt: fromB64url(RFC.salt), senderKeys: await rfcSenderKeys() },
  );
  assert.equal(b64url(body), RFC.body);
});

test("a fresh message decrypts on the receiving side, and never repeats its salt or key", async () => {
  // The receiver: a browser's push key pair and auth secret.
  const ua = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  const uaPublic = new Uint8Array(await crypto.subtle.exportKey("raw", ua.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const sub = { p256dh: b64url(uaPublic), auth: b64url(auth) };
  const message = new TextEncoder().encode('{"title":"Lightning · Severe"}');
  const a = await encryptPayload(message, sub);
  const b = await encryptPayload(message, sub);
  assert.notEqual(b64url(a), b64url(b));
  assert.deepEqual(await decrypt(a, ua.privateKey, uaPublic, auth), message);
});

/** The receiver's side of RFC 8291, written out from the RFC independently of the sender's code. */
async function decrypt(body: Uint8Array, uaPrivate: CryptoKey, uaPublic: Uint8Array, auth: Uint8Array) {
  const salt = body.slice(0, 16);
  const idlen = body[20];
  const asPublic = body.slice(21, 21 + idlen);
  const ciphertext = body.slice(21 + idlen);
  const asKey = await crypto.subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, uaPrivate, 256));
  const hkdf = async (salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) => {
    const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
    return new Uint8Array(
      await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8),
    );
  };
  const enc = (s: string) => new TextEncoder().encode(s);
  const keyInfo = new Uint8Array([...enc("WebPush: info"), 0, ...uaPublic, ...asPublic]);
  const ikm = await hkdf(auth, ecdh, keyInfo, 32);
  const cek = await hkdf(salt, ikm, new Uint8Array([...enc("Content-Encoding: aes128gcm"), 0]), 16);
  const nonce = await hkdf(salt, ikm, new Uint8Array([...enc("Content-Encoding: nonce"), 0]), 12);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const padded = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, aes, ciphertext));
  assert.equal(padded[padded.length - 1], 2, "the last record ends with the 0x02 delimiter");
  return padded.slice(0, -1);
}

test("signs the sender's identity (VAPID) for the push service, verifiable with the public key", async () => {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const publicKey = b64url(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)));
  const privateJwk = JSON.stringify(await crypto.subtle.exportKey("jwk", pair.privateKey));
  const now = Date.UTC(2026, 9, 23, 3, 0, 0);
  const headers = await vapidHeaders("https://fcm.googleapis.com/fcm/send/abc:def", { publicKey, privateJwk }, now);

  const m = headers.Authorization.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.ok(m, headers.Authorization);
  assert.equal(m[2], publicKey);
  const [h, c, s] = m[1].split(".");
  assert.deepEqual(JSON.parse(new TextDecoder().decode(fromB64url(h))), { typ: "JWT", alg: "ES256" });
  const claims = JSON.parse(new TextDecoder().decode(fromB64url(c)));
  // The push service's origin, an expiry within 24 hours, and who to contact.
  assert.equal(claims.aud, "https://fcm.googleapis.com");
  assert.equal(claims.exp, now / 1000 + 12 * 3600);
  assert.equal(claims.sub, "https://mugilu.live");
  const ok = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    pair.publicKey,
    fromB64url(s),
    new TextEncoder().encode(`${h}.${c}`),
  );
  assert.ok(ok, "the signature verifies");
});
