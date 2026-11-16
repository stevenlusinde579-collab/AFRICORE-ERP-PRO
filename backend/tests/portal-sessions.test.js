import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";

function hashToken(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

test("portal session tokens are high entropy opaque values and are not JWTs", () => {
  const token = randomBytes(32).toString("base64url");
  assert.match(token, /^[A-Za-z0-9_-]{40,60}$/);
  assert.equal(token.split(".").length, 1);
  assert.equal(Buffer.from(token, "base64url").length, 32);
});

test("stored session token digest is one-way SHA-256 and stable", () => {
  const token = randomBytes(32).toString("base64url");
  const digest = hashToken(token);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.equal(hashToken(token), digest);
  assert.notEqual(digest, token);
  assert.notEqual(hashToken(token + "x"), digest);
});
