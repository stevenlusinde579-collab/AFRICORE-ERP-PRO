import crypto from "node:crypto";
import { supabase } from "../config/supabase.js";
import { hashPortalSessionToken, isValidPortalSessionToken } from "./portalSessionCrypto.js";

export async function createPortalSession({ accountType, accountId, schoolId, studentId = null, centerId = null, req }) {
  const token = crypto.randomBytes(32).toString("base64url");
  const { data, error } = await supabase.from("portal_sessions").insert({
    account_type: accountType,
    account_id: accountId,
    school_id: Number(schoolId),
    student_id: studentId == null ? null : Number(studentId),
    center_id: centerId || null,
    token_hash: hashPortalSessionToken(token),
    user_agent: String(req?.headers?.["user-agent"] || "").slice(0, 500) || null,
    ip_address: req?.ip || null,
  }).select("id").single();
  if (error) throw error;
  return { token, sessionId: data.id };
}

export async function getPortalSession(token) {
  const value = String(token || "");
  if (!isValidPortalSessionToken(value)) return null;
  const { data, error } = await supabase.from("portal_sessions")
    .select("id,account_type,account_id,school_id,student_id,center_id,revoked_at")
    .eq("token_hash", hashPortalSessionToken(value))
    .is("revoked_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const touch = await supabase.from("portal_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", data.id).is("revoked_at", null)
    .lt("last_seen_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());
  if (touch.error) throw touch.error;
  return data;
}

export async function setPortalSessionStudent(sessionId, studentId) {
  const { data, error } = await supabase.from("portal_sessions")
    .update({ student_id: Number(studentId), last_seen_at: new Date().toISOString() })
    .eq("id", sessionId).eq("account_type", "sponsor").is("revoked_at", null)
    .select("id").maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function revokePortalSession(token) {
  const value = String(token || "");
  if (!isValidPortalSessionToken(value)) return false;
  const { data, error } = await supabase.from("portal_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_hash", hashPortalSessionToken(value)).is("revoked_at", null)
    .select("id").maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function revokePortalAccountSessions(accountType, accountId) {
  const { error } = await supabase.from("portal_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("account_type", accountType).eq("account_id", accountId).is("revoked_at", null);
  if (error) throw error;
}
