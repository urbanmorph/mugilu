// Web Push with WebCrypto alone (no library runs in a Worker): the message is
// encrypted for the browser (RFC 8291, "aes128gcm", one record) and the request
// carries mugilu's signed identity (VAPID, RFC 8292), so the push service knows
// who is sending. test/webpush.test.ts checks this against the RFC's own example.

export const b64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export const fromB64url = (s: string): Uint8Array =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

const utf8 = (s: string) => new TextEncoder().encode(s);
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bytes * 8));
}

/** A browser's push keys, from PushSubscription.toJSON().keys. */
export interface PushKeys {
  p256dh: string;
  auth: string;
}

const RECORD_SIZE = 4096;

/**
 * The encrypted body for one push message. `salt` and `senderKeys` are fresh
 * for every message; they are parameters only so the RFC's example can be checked.
 */
export async function encryptPayload(
  plaintext: Uint8Array,
  keys: PushKeys,
  fixed: { salt?: Uint8Array; senderKeys?: CryptoKeyPair } = {},
): Promise<Uint8Array> {
  const salt = fixed.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const sender =
    fixed.senderKeys ??
    ((await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair);
  const asPublic = new Uint8Array((await crypto.subtle.exportKey("raw", sender.publicKey)) as ArrayBuffer);
  const uaPublic = fromB64url(keys.p256dh);
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  // The standard field is \`public\` (workers-types spells it \`$public\`); workerd takes \`public\`, checked in workerd itself.
  const ecdhParams = { name: "ECDH", public: uaKey } as unknown as SubtleCryptoDeriveKeyAlgorithm;
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits(ecdhParams, sender.privateKey, 256));

  const ikm = await hkdf(fromB64url(keys.auth), ecdh, concat(utf8("WebPush: info\0"), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, utf8("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, utf8("Content-Encoding: nonce\0"), 12);

  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  // One record: the message, then the 0x02 "last record" delimiter.
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, concat(plaintext, new Uint8Array([2]))),
  );
  const header = new Uint8Array(21);
  header.set(salt);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = asPublic.length;
  return concat(header, asPublic, ciphertext);
}

/** mugilu's VAPID key pair: the public key (base64url, uncompressed) and the private key as a JWK string. */
export interface Vapid {
  publicKey: string;
  privateJwk: string;
}

/** Who to contact about these pushes (RFC 8292 `sub`). */
const CONTACT = "https://mugilu.live";

/** The Authorization header for a push service: a JWT signed with the VAPID private key, valid 12 hours. */
export async function vapidHeaders(
  endpoint: string,
  vapid: Vapid,
  now = Date.now(),
): Promise<{ Authorization: string }> {
  const json = (o: object) => b64url(utf8(JSON.stringify(o)));
  const unsigned = `${json({ typ: "JWT", alg: "ES256" })}.${json({
    aud: new URL(endpoint).origin,
    exp: Math.floor(now / 1000) + 12 * 3600,
    sub: CONTACT,
  })}`;
  const key = await crypto.subtle.importKey(
    "jwk",
    { ...JSON.parse(vapid.privateJwk), key_ops: ["sign"] },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, utf8(unsigned)));
  return { Authorization: `vapid t=${unsigned}.${b64url(signature)}, k=${vapid.publicKey}` };
}

/** A stored browser subscription. */
export interface PushTarget extends PushKeys {
  endpoint: string;
}

/**
 * Sends one message; resolves with the push service's status (201 sent; 404/410
 * the subscription is gone). `ttl` is how long the service may hold it for an
 * offline phone, in seconds.
 */
export async function sendPush(target: PushTarget, message: object, vapid: Vapid, ttl: number): Promise<number> {
  const body = await encryptPayload(utf8(JSON.stringify(message)), target);
  const res = await fetch(target.endpoint, {
    method: "POST",
    headers: {
      ...(await vapidHeaders(target.endpoint, vapid)),
      TTL: String(ttl),
      Urgency: "high",
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  return res.status;
}
