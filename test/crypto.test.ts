import { test } from "node:test";
import assert from "node:assert/strict";
import { decrypt } from "../src/dw/crypto.ts";
import type { DwSession } from "../src/dw/auth.ts";
import { DecryptionError } from "../src/errors.ts";

test("decrypt rejects malformed envelope with DecryptionError", async () => {
  const session: DwSession = {
    idToken: "t",
    encKey: new Uint8Array(16),
    expiresAt: Date.now() + 60_000,
  };
  await assert.rejects(
    () => decrypt(
      { kid: 1, salt: "x", iv: "x", ct: "x" },
      "https://datawarehouse.dbd.go.th/api/v1/company-profiles/infos",
      session,
    ),
    (e: unknown) => e instanceof DecryptionError,
  );
});

test("decrypt accepts a properly-built AES-GCM + gzip envelope (roundtrip)", async () => {
  // Build a valid envelope ourselves and verify decrypt() recovers it.
  const session: DwSession = {
    idToken: "t",
    encKey: crypto.getRandomValues(new Uint8Array(32)),
    expiresAt: Date.now() + 60_000,
  };
  const url = "https://datawarehouse.dbd.go.th/api/v1/company-profiles/infos";
  const pathname = new URL(url).pathname;
  const kid = 7;
  const info = new TextEncoder().encode(`bdw|v${kid}|${pathname}`);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Compress { hello: "world" } with gzip, then encrypt
  const json = JSON.stringify({ hello: "world" });
  const cs = new CompressionStream("gzip");
  const compressed = new Uint8Array(await new Response(
    new Response(new TextEncoder().encode(json)).body!.pipeThrough(cs),
  ).arrayBuffer());

  const baseKey = await crypto.subtle.importKey("raw", session.encKey, { name: "HKDF" }, false, ["deriveKey"]);
  const derivedKey = await crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: info },
    derivedKey,
    compressed,
  ));

  const toB64Url = (b: Uint8Array) => {
    let s = "";
    for (const v of b) s += String.fromCharCode(v);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };

  const env = { kid, salt: toB64Url(salt), iv: toB64Url(iv), ct: toB64Url(ct) };
  const out = await decrypt(env, url, session);
  assert.deepEqual(out, { hello: "world" });
});
