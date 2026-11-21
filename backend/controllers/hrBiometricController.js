import crypto from "node:crypto";
import { supabase } from "../config/supabase.js";

const TOKEN_BYTES = 32;
const DEBOUNCE_SECONDS = 90;
const TZ = "Africa/Dar_es_Salaam";

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const safeEqual = (a, b) => {
  const left = Buffer.from(String(a || ""), "hex");
  const right = Buffer.from(String(b || ""), "hex");
  return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
};
const localDate = (value) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(value));
const validId = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0;

export async function pairBiometricDevice(req, res) {
  try {
    const schoolId = Number(req.profile?.school_id);
    const deviceId = Number(req.params.deviceId);
    if (!validId(schoolId) || !validId(deviceId)) {
      return res.status(400).json({ success: false, message: "Invalid school or device." });
    }
    const { data: device, error } = await supabase.from("hr_biometric_devices")
      .select("id,school_id,device_model,bridge_status")
      .eq("id", deviceId).eq("school_id", schoolId).maybeSingle();
    if (error) throw error;
    if (!device) return res.status(404).json({ success: false, message: "Biometric device not found in your school." });
    if (String(device.device_model || "").toUpperCase() !== "ZK9500") {
      return res.status(400).json({ success: false, message: "This agent pairing flow currently supports ZKTeco ZK9500 only." });
    }
    const agentToken = crypto.randomBytes(TOKEN_BYTES).toString("base64url");
    const { error: updateError } = await supabase.from("hr_biometric_devices").update({
      agent_token_hash: sha256(agentToken),
      paired_at: new Date().toISOString(),
      bridge_status: "not_connected",
      last_error: null
    }).eq("id", deviceId).eq("school_id", schoolId);
    if (updateError) throw updateError;
    return res.status(201).json({
      success: true,
      device_id: deviceId,
      agent_token: agentToken,
      token_notice: "Copy this token into the AfriCore Windows Agent once. It will not be shown again.",
      biometric_templates_stored_in_cloud: false
    });
  } catch (error) {
    console.error("HR DEVICE PAIR ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to pair biometric device." });
  }
}

export async function revokeBiometricPairing(req, res) {
  try {
    const schoolId = Number(req.profile?.school_id);
    const deviceId = Number(req.params.deviceId);
    const { error } = await supabase.from("hr_biometric_devices").update({
      agent_token_hash: null, paired_at: null, bridge_status: "disabled"
    }).eq("id", deviceId).eq("school_id", schoolId);
    if (error) throw error;
    return res.json({ success: true, message: "Device pairing revoked." });
  } catch (error) {
    console.error("HR DEVICE REVOKE ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to revoke device pairing." });
  }
}

export async function authenticateBiometricAgent(req, res, next) {
  try {
    const authorization = req.headers.authorization || "";
    if (!authorization.startsWith("Bearer ")) return res.status(401).json({ success: false, message: "Agent token required." });
    const token = authorization.slice(7).trim();
    if (token.length < 32) return res.status(401).json({ success: false, message: "Invalid agent token." });
    const hash = sha256(token);
    const { data: devices, error } = await supabase.from("hr_biometric_devices")
      .select("id,school_id,device_model,bridge_status")
      .eq("agent_token_hash", hash).limit(2);
    if (error) throw error;
    if (!devices || devices.length !== 1) return res.status(401).json({ success: false, message: "Agent is not paired or pairing is revoked." });
    req.biometricDevice = devices[0];
    return next();
  } catch (error) {
    console.error("BIOMETRIC AGENT AUTH ERROR:", error);
    return res.status(503).json({ success: false, message: "Unable to verify agent credentials." });
  }
}

export async function biometricAgentHeartbeat(req, res) {
  try {
    const device = req.biometricDevice;
    const now = new Date().toISOString();
    const version = typeof req.body?.agent_version === "string" ? req.body.agent_version.slice(0, 40) : null;
    const { error } = await supabase.from("hr_biometric_devices").update({
      bridge_status: "connected", last_seen_at: now, agent_version: version, last_error: null
    }).eq("id", device.id).eq("school_id", device.school_id);
    if (error) throw error;
    return res.json({ success: true, server_time: now, device_id: device.id, school_id: device.school_id });
  } catch (error) {
    console.error("BIOMETRIC HEARTBEAT ERROR:", error);
    return res.status(500).json({ success: false, message: "Heartbeat could not be saved." });
  }
}

export async function getAgentEnrollmentRoster(req, res) {
  try {
    const device = req.biometricDevice;
    const { data: employees, error: employeeError } = await supabase.from("employees")
      .select("id,employee_number,first_name,middle_name,last_name,status")
      .eq("school_id", device.school_id)
      .order("first_name", { ascending: true });
    if (employeeError) throw employeeError;
    const { data: enrolled, error: enrollmentError } = await supabase.from("hr_biometric_enrollments")
      .select("employee_id,finger_slot,status,enrolled_at")
      .eq("school_id", device.school_id).eq("device_id", device.id);
    if (enrollmentError) throw enrollmentError;
    return res.json({
      success: true,
      device_id: device.id,
      employees: (employees || []).filter((person) => !["inactive", "terminated", "left"].includes(String(person.status || "").toLowerCase())),
      enrollment_metadata: enrolled || [],
      templates_location: "local_windows_agent_only"
    });
  } catch (error) {
    console.error("BIOMETRIC ENROLLMENT ROSTER ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to load enrollment roster." });
  }
}

export async function syncEnrollmentMetadata(req, res) {
  try {
    const device = req.biometricDevice;
    const items = Array.isArray(req.body?.enrollments) ? req.body.enrollments : [];
    if (items.length > 100) return res.status(400).json({ success: false, message: "Maximum 100 enrollment updates per batch." });
    const rows = [];
    for (const item of items) {
      const employeeId = Number(item.employee_id);
      const fingerSlot = Number(item.finger_slot || 1);
      const status = item.status === "revoked" ? "revoked" : "active";
      if (!validId(employeeId) || !Number.isInteger(fingerSlot) || fingerSlot < 1 || fingerSlot > 10) {
        return res.status(400).json({ success: false, message: "Invalid employee or finger slot." });
      }
      const { data: employee, error } = await supabase.from("employees").select("id,status")
        .eq("id", employeeId).eq("school_id", device.school_id).maybeSingle();
      if (error) throw error;
      if (!employee) return res.status(403).json({ success: false, message: "Employee does not belong to the paired school." });
      rows.push({
        school_id: device.school_id, device_id: device.id, employee_id: employeeId,
        finger_slot: fingerSlot, status, enrolled_at: item.enrolled_at || new Date().toISOString(),
        revoked_at: status === "revoked" ? new Date().toISOString() : null
      });
    }
    if (rows.length) {
      const { error } = await supabase.from("hr_biometric_enrollments").upsert(rows, {
        onConflict: "school_id,device_id,employee_id,finger_slot"
      });
      if (error) throw error;
    }
    return res.json({ success: true, accepted: rows.length, templates_uploaded: false });
  } catch (error) {
    console.error("BIOMETRIC ENROLLMENT SYNC ERROR:", error);
    return res.status(500).json({ success: false, message: "Enrollment metadata sync failed." });
  }
}

export async function syncBiometricAttendance(req, res) {
  try {
    const device = req.biometricDevice;
    const events = Array.isArray(req.body?.events) ? req.body.events : [];
    if (!events.length) return res.json({ success: true, accepted: 0, duplicates: 0, rejected: [] });
    if (events.length > 200) return res.status(400).json({ success: false, message: "Maximum 200 events per batch." });
    let accepted = 0;
    let duplicates = 0;
    const rejected = [];
    for (const event of events) {
      const eventId = String(event?.event_id || "").trim();
      const employeeId = Number(event?.employee_id);
      const occurredAt = new Date(event?.occurred_at);
      if (!/^[a-zA-Z0-9_-]{12,100}$/.test(eventId) || !validId(employeeId) || Number.isNaN(occurredAt.getTime())) {
        rejected.push({ event_id: eventId || null, reason: "invalid_event" });
        continue;
      }
      if (occurredAt.getTime() > Date.now() + 5 * 60 * 1000 || occurredAt.getTime() < Date.now() - 14 * 86400000) {
        rejected.push({ event_id: eventId, reason: "timestamp_out_of_allowed_window" });
        continue;
      }
      const { data: employee, error: employeeError } = await supabase.from("employees")
        .select("id,status").eq("id", employeeId).eq("school_id", device.school_id).maybeSingle();
      if (employeeError) throw employeeError;
      if (!employee || ["inactive", "terminated", "left"].includes(String(employee?.status || "").toLowerCase())) {
        rejected.push({ event_id: eventId, reason: "employee_not_active_in_school" });
        continue;
      }
      const { data: existing, error: duplicateError } = await supabase.from("hr_attendance_events")
        .select("id").eq("school_id", device.school_id).eq("external_event_id", eventId).maybeSingle();
      if (duplicateError) throw duplicateError;
      if (existing) { duplicates += 1; continue; }

      const day = localDate(occurredAt);
      const dayStart = new Date(day + "T00:00:00+03:00").toISOString();
      const dayEnd = new Date(new Date(day + "T00:00:00+03:00").getTime() + 86400000).toISOString();
      const { data: latest, error: latestError } = await supabase.from("hr_attendance_events")
        .select("event_type,occurred_at").eq("school_id", device.school_id).eq("employee_id", employeeId)
        .gte("occurred_at", dayStart).lt("occurred_at", dayEnd)
        .order("occurred_at", { ascending: false }).limit(1).maybeSingle();
      if (latestError) throw latestError;
      if (latest && (occurredAt.getTime() - new Date(latest.occurred_at).getTime()) < DEBOUNCE_SECONDS * 1000) {
        rejected.push({ event_id: eventId, reason: "duplicate_scan_cooldown" });
        continue;
      }
      const eventType = !latest || latest.event_type === "check_out" ? "check_in" : "check_out";
      const { error: insertError } = await supabase.from("hr_attendance_events").insert({
        school_id: device.school_id, employee_id: employeeId, device_id: device.id,
        event_type: eventType, event_source: "usb_biometric",
        occurred_at: occurredAt.toISOString(), external_event_id: eventId
      });
      if (insertError?.code === "23505") { duplicates += 1; continue; }
      if (insertError) throw insertError;
      accepted += 1;
    }
    const now = new Date().toISOString();
    await supabase.from("hr_biometric_devices").update({ last_seen_at: now, bridge_status: "connected", last_error: null })
      .eq("id", device.id).eq("school_id", device.school_id);
    return res.json({ success: true, accepted, duplicates, rejected, event_type_policy: "server_alternates_check_in_check_out_per_employee_per_local_day" });
  } catch (error) {
    console.error("BIOMETRIC ATTENDANCE SYNC ERROR:", error);
    return res.status(500).json({ success: false, message: "Attendance sync failed. Agent should retain queued events and retry." });
  }
}
