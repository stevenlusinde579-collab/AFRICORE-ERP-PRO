import crypto from "node:crypto";

export function hashPortalSessionToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

export function isValidPortalSessionToken(token) {
  return /^[A-Za-z0-9_-]{40,60}$/.test(String(token || ""));
}
