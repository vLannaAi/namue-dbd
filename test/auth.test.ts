import { test } from "node:test";
import assert from "node:assert/strict";
import { parseJwtForTest, fromBase64UrlForTest } from "../src/dw/auth.ts";

test("parseJwt extracts exp and encKey from a DBD-shaped JWT", () => {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const payload = btoa(JSON.stringify({ encKey: "abcd-_AA", exp: 1700000000 }))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const token = `${header}.${payload}.sig`;
  const out = parseJwtForTest(token);
  assert.equal(out.exp, 1700000000);
  assert.equal(out.encKey, "abcd-_AA");
});

test("fromBase64Url decodes URL-safe base64 to bytes", () => {
  const u = fromBase64UrlForTest("SGVsbG8");
  assert.deepEqual(Array.from(u), [72, 101, 108, 108, 111]);
});

test("fromBase64Url handles URL-safe chars (- and _)", () => {
  const u = fromBase64UrlForTest("-_8");
  assert.deepEqual(Array.from(u), [0xfb, 0xff]);
});
