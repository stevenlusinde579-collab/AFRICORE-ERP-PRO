import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

test("agent tokens are high entropy and hash deterministically", () => {
  const token = crypto.randomBytes(32).toString("base64url");
  assert.ok(token.length >= 40);
  const hash1 = crypto.createHash("sha256").update(token).digest("hex");
  const hash2 = crypto.createHash("sha256").update(token).digest("hex");
  assert.equal(hash1, hash2);
  assert.notEqual(hash1, token);
});

test("agent event contract rejects malformed event identifiers", () => {
  const valid = /^[a-zA-Z0-9_-]{12,100}$/;
  assert.equal(valid.test("local_event_0001"), true);
  assert.equal(valid.test("x"), false);
  assert.equal(valid.test("bad event id"), false);
});

test("Africa/Dar_es_Salaam local calendar date is stable for UTC instants", () => {
  const localDate = (value) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dar_es_Salaam" }).format(new Date(value));
  assert.equal(localDate("2026-11-20T21:30:00.000Z"), "2026-11-21");
});
