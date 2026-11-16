import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { hashPortalSessionToken, isValidPortalSessionToken } from "../utils/portalSessionCrypto.js";

test("portal session tokens are high entropy opaque values and are not JWTs", () => {
  const token = randomBytes(32).toString("base64url");
  assert.equal(isValidPortalSessionToken(token), true);
  assert.equal(token.split(".").length, 1);
  assert.equal(Buffer.from(token, "base64url").length, 32);
});

test("stored session token digest is one-way SHA-256 and stable", () => {
  const token = randomBytes(32).toString("base64url");
  const digest = hashPortalSessionToken(token);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.equal(hashPortalSessionToken(token), digest);
  assert.notEqual(digest, token);
  assert.notEqual(hashPortalSessionToken(token + "x"), digest);
});

test("malformed tokens are rejected before database lookup", () => {
  for (const token of ["", "abc", "a.b.c", "x".repeat(100), null, undefined]) {
    assert.equal(isValidPortalSessionToken(token), false);
  }
});
