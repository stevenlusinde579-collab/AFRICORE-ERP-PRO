import express from "express";
import crypto from "node:crypto";
import { promisify } from "node:util";
import { supabase } from "../config/supabase.js";
import { authenticateUser } from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/permissionMiddleware.js";


const router = express.Router();
const loginAttempts = new Map();
// Process-local presence with a short lease. A client is online only while it
// continues sending authenticated heartbeats; stale records expire quickly.
const parentPortalPresence = new Map();
const PRESENCE_TTL_MS = 45000;
function presenceKey(schoolId, classId, memberType, memberId) {
  return [schoolId, classId, memberType, memberId].join(":");
}
function recordPresence({ schoolId, classId, memberType, memberId, name }) {
  const now = Date.now();
  for (const [key, value] of parentPortalPresence) {
    if (value.expiresAt <= now) parentPortalPresence.delete(key);
  }
  parentPortalPresence.set(presenceKey(schoolId, classId, memberType, memberId), {
    schoolId: Number(schoolId), classId: Number(classId), memberType,
    memberId: String(memberId), name: String(name || ""), expiresAt: now + PRESENCE_TTL_MS,
  });
}
function presenceForClass(schoolId, classId) {
  const now = Date.now();
  const result = new Map();
  for (const [key, value] of parentPortalPresence) {
    if (value.expiresAt <= now) { parentPortalPresence.delete(key); continue; }
    if (value.schoolId === Number(schoolId) && value.classId === Number(classId)) {
      result.set(value.memberType + ":" + value.memberId, true);
    }
  }
  return result;
}
function withPresence(members, schoolId, classId) {
  const online = presenceForClass(schoolId, classId);
  return (members || []).map((member) => ({
    ...member,
    online: member.member_type === "staff"
      ? online.has("staff:" + String(member.user_id))
      : online.has("parent:" + String(member.student_id)),
  }));
}
const scrypt = promisify(crypto.scrypt);


const PARENT_MEETING_PROVIDER = "AfriCore WebRTC";
function parentMeetingRoomId(meeting) {
  const match = String(meeting?.meeting_url || "").match(/\/communication\/meeting\/(\d+)/);
  return match ? Number(match[1]) : null;
}

function canAdministerParentMeetings(req) {
  const roleNames = (req.access?.roles || []).map((role) => String(role.role_name || "").trim().toLowerCase());
  return req.access?.isSuperAdmin === true || roleNames.some((name) => [
    "super admin", "headmaster", "deputy headmaster", "academic master", "school admin", "admin",
  ].includes(name));
}

const FRONTEND_URL = String(process.env.FRONTEND_URL || "https://africorepro.vercel.app").replace(/\/$/, "");
const TOKEN_SECRET = process.env.PARENT_PORTAL_JWT_SECRET || process.env.SUPABASE_SERVICE_KEY;

function fullName(student) {
  return [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ").trim();
}
function normalizePhone(value) {
  let phone = String(value || "").replace(/\D/g, "");
  if (phone.startsWith("255")) return phone;
  if (phone.startsWith("0")) return "255" + phone.slice(1);
  if (phone.startsWith("6") || phone.startsWith("7")) return "255" + phone;
  return phone;
}
function tokenFor(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const unsigned = header + "." + body;
  const signature = crypto.createHmac("sha256", TOKEN_SECRET).update(unsigned).digest("base64url");
  return unsigned + "." + signature;
}
function verifyToken(token) {
  if (!TOKEN_SECRET || !token) return null;
  const parts = String(token).split(".");
  if (parts.length !== 3) return null;
  const unsigned = parts[0] + "." + parts[1];
  const expected = crypto.createHmac("sha256", TOKEN_SECRET).update(unsigned).digest();
  let supplied;
  try { supplied = Buffer.from(parts[2], "base64url"); } catch { return null; }
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}
async function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const derived = await scrypt(String(password), salt, 64);
  return { salt, hash: derived.toString("hex") };
}
async function passwordMatches(password, salt, storedHash) {
  const derived = await scrypt(String(password), salt, 64);
  const stored = Buffer.from(String(storedHash || ""), "hex");
  return stored.length === derived.length && crypto.timingSafeEqual(stored, derived);
}
async function loadStudent(studentId, schoolId) {
  const { data, error } = await supabase.from("students")
    .select("id,school_id,admission_number,admission_no,first_name,middle_name,last_name,parent_name,parent_phone,parent_email,guardian_name,guardian_phone,current_class_id,academic_year_id,student_status,status,class_name")
    .eq("id", studentId).eq("school_id", schoolId).maybeSingle();
  if (error) throw error;
  return data;
}

async function loadClassParentMembers(schoolId, classId) {
  if (!schoolId || !classId) return [];
  const { data: students, error: studentsError } = await supabase.from("students")
    .select("id,first_name,middle_name,last_name,parent_name,guardian_name,current_class_id")
    .eq("school_id", schoolId).eq("current_class_id", classId).order("first_name");
  if (studentsError) throw studentsError;
  const studentRows = students || [];
  if (!studentRows.length) return [];
  const ids = studentRows.map((row) => row.id);
  const { data: accounts, error: accountsError } = await supabase.from("parent_portal_accounts")
    .select("student_id,username,is_active").eq("school_id", schoolId).eq("is_active", true).in("student_id", ids);
  if (accountsError) throw accountsError;
  const accountMap = new Map((accounts || []).map((row) => [String(row.student_id), row]));
  const parentMembers = studentRows.filter((row) => accountMap.has(String(row.id))).map((row) => {
    const account = accountMap.get(String(row.id));
    const studentName = fullName(row);
    return {
      member_type: "parent",
      student_id: row.id,
      student_name: studentName,
      parent_name: row.parent_name || row.guardian_name || ("Mzazi wa " + studentName),
      member_name: row.parent_name || row.guardian_name || ("Mzazi wa " + studentName),
      username: account.username,
      online: false,
    };
  });

  // Include only staff explicitly assigned to this class, never every staff
  // member in the school. Parent-facing membership is subsequently scoped to
  // the current parent plus these assigned staff members.
  const { data: assignments, error: assignmentError } = await supabase.from("teacher_assignments")
    .select("teacher_id").eq("school_id", schoolId).eq("class_id", classId);
  if (assignmentError) throw assignmentError;
  const teacherIds = [...new Set((assignments || []).map((row) => Number(row.teacher_id)).filter(Number.isInteger))];
  if (!teacherIds.length) return parentMembers;
  const { data: teachers, error: teachersError } = await supabase.from("teachers")
    .select("id,user_id,first_name,middle_name,last_name,photo_url,staff_type")
    .eq("school_id", schoolId).in("id", teacherIds).eq("status", "Active");
  if (teachersError) throw teachersError;
  const staffMembers = (teachers || []).map((teacher) => ({
    member_type: "staff",
    user_id: teacher.user_id,
    teacher_id: teacher.id,
    member_name: [teacher.first_name, teacher.middle_name, teacher.last_name].filter(Boolean).join(" ") || "School Staff",
    role_label: teacher.staff_type === "Non-Staff" ? "School staff" : "Teacher",
    photo_url: teacher.photo_url || null,
    online: false,
  }));
  return [...parentMembers, ...staffMembers];
}

const FULL_PARENT_PORTAL_ROLES = new Set([
  "super admin", "headmaster", "deputy headmaster", "academic master", "secretary", "accountant",
]);

async function parentPortalStaffAccess(req, res, next) {
  try {
    const roleNames = (req.access?.roles || []).map((role) => String(role.role_name || "").trim().toLowerCase());
    const fullAccess = req.access?.isSuperAdmin === true || roleNames.some((name) => FULL_PARENT_PORTAL_ROLES.has(name));
    if (fullAccess) {
      req.parentPortalScope = { fullAccess: true, classIds: null, studentIds: null };
      return next();
    }
    if (!roleNames.includes("class teacher") || !req.profile?.teacher_id || !req.profile?.school_id) {
      return res.status(403).json({ success: false, message: "Huna ruhusa ya kusimamia Parent Portal." });
    }
    const { data: assignments, error: assignmentError } = await supabase.from("teacher_assignments")
      .select("class_id").eq("school_id", Number(req.profile.school_id)).eq("teacher_id", Number(req.profile.teacher_id));
    if (assignmentError) throw assignmentError;
    const classIds = [...new Set((assignments || []).map((row) => Number(row.class_id)).filter(Number.isInteger))];
    if (!classIds.length) {
      req.parentPortalScope = { fullAccess: false, classIds: [], studentIds: [] };
      return next();
    }
    const { data: students, error: studentsError } = await supabase.from("students")
      .select("id").eq("school_id", Number(req.profile.school_id)).in("current_class_id", classIds);
    if (studentsError) throw studentsError;
    req.parentPortalScope = {
      fullAccess: false,
      classIds,
      studentIds: (students || []).map((row) => row.id),
    };
    return next();
  } catch (error) {
    console.error("PARENT PORTAL STAFF ACCESS ERROR:", error);
    return res.status(500).json({ success: false, message: "Imeshindikana kuthibitisha ruhusa za Parent Portal." });
  }
}

async function parentAuth(req, res, next) {
  try {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const claims = verifyToken(token);
    if (!claims?.school_id || !claims?.student_id) {
      return res.status(401).json({ success: false, message: "Parent Portal session expired. Please sign in again." });
    }

    let account;
    if (claims.sponsor_account_id && claims.sponsor_center_id) {
      const { data: sponsorAccount, error: sponsorError } = await supabase.from("sponsor_portal_accounts")
        .select("id,school_id,center_id,username,is_active")
        .eq("id", claims.sponsor_account_id).eq("school_id", claims.school_id)
        .eq("center_id", claims.sponsor_center_id).eq("is_active", true).maybeSingle();
      if (sponsorError || !sponsorAccount || !claims.sponsor_student_id || Number(claims.student_id) !== Number(claims.sponsor_student_id)) {
        return res.status(401).json({ success: false, message: "Sponsor session is unavailable." });
      }
      const { data: assignment, error: assignmentError } = await supabase.from("sponsor_center_students")
        .select("student_id").eq("school_id", sponsorAccount.school_id)
        .eq("center_id", sponsorAccount.center_id).eq("student_id", sponsorAccount && claims.student_id).maybeSingle();
      if (assignmentError || !assignment) return res.status(403).json({ success: false, message: "Mwanafunzi huyu hajapangiwa kituo chako." });
      const { data: center, error: centerError } = await supabase.from("sponsor_centers")
        .select("id,center_name,is_active").eq("id", sponsorAccount.center_id).eq("school_id", sponsorAccount.school_id).maybeSingle();
      if (centerError || !center || !center.is_active) return res.status(403).json({ success: false, message: "Kituo hiki hakitumiki." });
      account = { id: sponsorAccount.id, student_id: Number(claims.student_id), school_id: Number(claims.school_id), username: sponsorAccount.username, must_change_password: false, is_active: true, sponsor_center_id: center.id, sponsor_center_name: center.center_name, is_sponsor: true };
    } else {
      if (!claims.account_id) return res.status(401).json({ success: false, message: "Parent Portal session expired. Please sign in again." });
      const { data: parentAccount, error } = await supabase.from("parent_portal_accounts")
        .select("id,student_id,school_id,username,must_change_password,is_active")
        .eq("id", claims.account_id).eq("student_id", claims.student_id).eq("school_id", claims.school_id)
        .maybeSingle();
      if (error || !parentAccount || !parentAccount.is_active) return res.status(401).json({ success: false, message: "Parent Portal account is unavailable." });
      account = parentAccount;
    }

    const student = await loadStudent(account.student_id, account.school_id);
    if (!student) return res.status(403).json({ success: false, message: "Student is no longer available in this school." });
    const { data: school, error: schoolError } = await supabase.from("schools").select("id,school_name,is_active").eq("id", account.school_id).maybeSingle();
    if (schoolError || !school || school.is_active !== true) return res.status(403).json({ success: false, message: "This school is inactive. Please contact the school administrator." });
    if (String(student.status || student.student_status || "Active").toLowerCase() === "inactive") return res.status(403).json({ success: false, message: "Student account is inactive. Contact the school." });
    req.parent = { account, student, school };
    if (account.must_change_password && !["/change-password", "/logout"].includes(req.path)) {
      return res.status(403).json({ success: false, code: "PARENT_PASSWORD_CHANGE_REQUIRED", message: "Badilisha password yako ya awali kwanza." });
    }
    next();
  } catch (error) {
    console.error("PARENT PORTAL AUTH ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to verify Parent Portal session." });
  }
}
async function sendCredentialSms(student, account, sentBy = null) {
  const phone = normalizePhone(student.guardian_phone || student.parent_phone);
  let history;
  const { data: historyRow, error: historyError } = await supabase.from("parent_portal_credential_history")
    .insert({ school_id: student.school_id, student_id: student.id, recipient_phone: phone || null, status: "pending", sent_by: sentBy })
    .select("id").single();
  if (historyError) throw historyError;
  history = historyRow;
  const finish = async (updates) => {
    await supabase.from("parent_portal_credential_history").update(updates).eq("id", history.id);
  };
  try {
    if (!phone || phone.length < 10) throw new Error("Namba ya mzazi/mlezi haipo au si sahihi kwenye usajili.");
    const { data: credentials, error: credentialsError } = await supabase.rpc("get_school_sms_credentials", { p_school_id: Number(student.school_id) }).maybeSingle();
    if (credentialsError || !credentials?.api_key || !credentials?.secret_key || !credentials?.sender_id) throw new Error("NewHope SMS haijawekwa kikamilifu kwa shule hii.");
    if (String(credentials.approval_status || "").toLowerCase() !== "approved") throw new Error("Sender ID ya shule bado haijaidhinishwa.");
    const admission = String(student.admission_number || student.admission_no || "");
    const schoolInfo = await supabase.from("schools").select("school_name").eq("id", student.school_id).maybeSingle();
    const schoolName = schoolInfo.data?.school_name || "AfriCore School";
    const url = FRONTEND_URL + "/parent-portal?school=" + encodeURIComponent(student.school_id);
    const message = "AFRICORE PARENT PORTAL\nMwanafunzi: " + fullName(student) +
      "\nShule: " + schoolName +
      "\nUsername: " + account.username +
      "\nPassword ya awali: " + admission +
      "\nIngia: " + url +
      "\nBadilisha password baada ya kuingia kwa mara ya kwanza. Usimpe mtu mwingine taarifa hizi.";
    const response = await fetch("https://sms.newhope.co.tz/v1/sms/send/", {
      method: "POST",
      headers: { Authorization: "ApiKey " + credentials.api_key + ":" + credentials.secret_key, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ recipient: "+" + phone, message, sender_id: "NewHope" }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result?.message || result?.detail || result?.error || "NewHope SMS HTTP " + response.status);
    const rawStatus = String(result?.status || "sent").toLowerCase();
    const providerStatus = rawStatus.includes("fail") ? "failed" : (rawStatus.includes("queue") || rawStatus.includes("pending") ? "queued" : (rawStatus.includes("deliver") ? "delivered" : "sent"));
    await finish({ status: providerStatus, provider: "NewHope SMS", provider_message_id: result?.id || result?.message_id || result?.messageId || null });
    return { success: providerStatus !== "failed", status: providerStatus, history_id: history.id };
  } catch (error) {
    await finish({ status: "failed", provider: "NewHope SMS", error_message: String(error?.message || error).slice(0, 1000) });
    return { success: false, status: "failed", history_id: history.id, error: String(error?.message || error) };
  }
}

// Public active school list used only to scope the parent login form.
router.get("/schools", async (_req, res) => {
  const { data, error } = await supabase.from("schools").select("id,school_name").eq("is_active", true).order("school_name");
  if (error) return res.status(500).json({ success: false, message: "Unable to load schools." });
  return res.json({ success: true, schools: data || [] });
});

// Staff-only: create a per-student portal account after registration has committed.
router.post("/provision", authenticateUser, requirePermission("create_students"), async (req, res) => {
  const schoolId = Number(req.profile?.school_id);
  const studentId = Number(req.body?.student_id);
  if (!Number.isInteger(schoolId) || !Number.isInteger(studentId)) return res.status(400).json({ success: false, message: "Valid student_id is required." });
  try {
    const student = await loadStudent(studentId, schoolId);
    if (!student) return res.status(404).json({ success: false, message: "Student not found in your school." });
    const username = fullName(student);
    const admission = String(student.admission_number || student.admission_no || "").trim();
    if (!username || !admission) return res.status(400).json({ success: false, message: "Student full name and admission number are required for Parent Portal credentials." });
    let { data: account, error } = await supabase.from("parent_portal_accounts").select("*").eq("student_id", student.id).eq("school_id", schoolId).maybeSingle();
    if (error) throw error;
    let accountCreated = false;
    if (!account) {
      const password = await hashPassword(admission);
      const { data, error: insertError } = await supabase.from("parent_portal_accounts").insert({
        student_id: student.id, school_id: schoolId, username, password_hash: password.hash, password_salt: password.salt, must_change_password: true,
      }).select("*").single();
      if (insertError) throw insertError;
      account = data;
      accountCreated = true;
    } else {
      // Provisioning is idempotent: never overwrite a password that the parent
      // has already changed. A staff-initiated resend is the explicit reset flow.
      const { error: updateError } = await supabase.from("parent_portal_accounts")
        .update({ username, updated_at: new Date().toISOString() }).eq("id", account.id);
      if (updateError) throw updateError;
      account = { ...account, username };
    }
    const schoolInfo = await supabase.from("schools").select("school_name").eq("id", schoolId).single();
    if (!account.must_change_password) {
      return res.json({ success: true, account_created: false, sms: { success: false, status: "skipped", error: "Parent has already changed the initial password. Use the staff resend action to reset access securely." } });
    }
    const delivery = await sendCredentialSms({ ...student, school_name: schoolInfo.data?.school_name }, account, req.user.id);
    return res.json({ success: true, account_created: accountCreated, sms: delivery });
  } catch (error) {
    console.error("PARENT PORTAL PROVISION ERROR:", error);
    return res.status(500).json({ success: false, account_created: false, message: error?.message || "Unable to create Parent Portal account." });
  }
});

// Staff-only resend. Reissues the initial admission-number password and forces a change at next login.
router.post("/resend/:studentId", authenticateUser, requirePermission("view_students"), async (req, res) => {
  const schoolId = Number(req.profile?.school_id);
  const studentId = Number(req.params.studentId);
  try {
    const student = await loadStudent(studentId, schoolId);
    if (!student) return res.status(404).json({ success: false, message: "Student not found in your school." });
    const admission = String(student.admission_number || student.admission_no || "").trim();
    if (!admission) return res.status(400).json({ success: false, message: "Student admission number is missing." });
    let { data: account, error } = await supabase.from("parent_portal_accounts").select("*").eq("student_id", studentId).eq("school_id", schoolId).maybeSingle();
    if (error) throw error;
    if (!account) {
      const initial = await hashPassword(admission);
      const result = await supabase.from("parent_portal_accounts").insert({ student_id: studentId, school_id: schoolId, username: fullName(student), password_hash: initial.hash, password_salt: initial.salt, must_change_password: true }).select("*").single();
      if (result.error) throw result.error;
      account = result.data;
    } else {
      const reset = await hashPassword(admission);
      const result = await supabase.from("parent_portal_accounts").update({ username: fullName(student), password_hash: reset.hash, password_salt: reset.salt, must_change_password: true, updated_at: new Date().toISOString() }).eq("id", account.id).select("*").single();
      if (result.error) throw result.error;
      account = result.data;
    }
    const school = await supabase.from("schools").select("school_name").eq("id", schoolId).single();
    const delivery = await sendCredentialSms({ ...student, school_name: school.data?.school_name }, account, req.user.id);
    return res.json({ success: true, sms: delivery, message: delivery.success ? "Parent Portal credentials sent." : "Account is ready, but SMS delivery failed." });
  } catch (error) {
    console.error("PARENT PORTAL RESEND ERROR:", error);
    return res.status(500).json({ success: false, message: error?.message || "Unable to resend credentials." });
  }
});

router.get("/credential-history/:studentId", authenticateUser, requirePermission("view_students"), async (req, res) => {
  const schoolId = Number(req.profile?.school_id);
  const studentId = Number(req.params.studentId);
  const { data, error } = await supabase.from("parent_portal_credential_history")
    .select("id,recipient_phone,status,provider,provider_message_id,error_message,created_at")
    .eq("school_id", schoolId).eq("student_id", studentId).order("created_at", { ascending: false }).limit(20);
  if (error) return res.status(500).json({ success: false, message: "Unable to load SMS history." });
  let history = data || [];
  // Refresh recent NewHope delivery receipts so the staff history distinguishes
  // accepted/sent messages from messages actually delivered to the handset.
  const pendingReceipts = history.filter(item => item.provider_message_id && ["sent","queued","pending"].includes(String(item.status).toLowerCase()));
  if (pendingReceipts.length) {
    try {
      const { data: credentials } = await supabase.rpc("get_school_sms_credentials", { p_school_id: schoolId }).maybeSingle();
      if (credentials?.api_key && credentials?.secret_key) {
        await Promise.all(pendingReceipts.map(async item => {
          try {
            const receiptResponse = await fetch("https://sms.newhope.co.tz/v1/sms/" + encodeURIComponent(item.provider_message_id) + "/status/", {
              headers: { Authorization: "ApiKey " + credentials.api_key + ":" + credentials.secret_key, Accept: "application/json" },
            });
            if (!receiptResponse.ok) return;
            const receipt = await receiptResponse.json().catch(() => ({}));
            const providerStatus = String(receipt?.status || "").toLowerCase();
            const status = providerStatus.includes("deliver") ? "delivered" : (providerStatus.includes("fail") ? "failed" : (providerStatus.includes("pending") ? "queued" : item.status));
            if (status !== item.status) {
              await supabase.from("parent_portal_credential_history").update({ status, error_message: status === "failed" ? (receipt?.error || receipt?.message || "NewHope delivery failed") : null }).eq("id", item.id).eq("school_id", schoolId);
              item.status = status;
            }
          } catch (receiptError) { console.warn("PARENT PORTAL SMS RECEIPT CHECK FAILED:", receiptError?.message || receiptError); }
        }));
      }
    } catch (receiptError) { console.warn("PARENT PORTAL SMS RECEIPT CREDENTIALS UNAVAILABLE:", receiptError?.message || receiptError); }
  }
  return res.json({ success: true, history });
});

router.post("/login", async (req, res) => {
  const schoolId = Number(req.body?.school_id);
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  if (!Number.isInteger(schoolId) || !username || !password) return res.status(400).json({ success: false, message: "Choose your school and enter student username and admission number." });
  try {
    const { data: school, error: schoolError } = await supabase.from("schools").select("id,is_active").eq("id", schoolId).maybeSingle();
    if (schoolError || !school || school.is_active !== true) return res.status(403).json({ success: false, message: "School not found or inactive." });
    const attemptKey = String(req.ip || "unknown") + ":" + schoolId + ":" + username.toLowerCase();
    const now = Date.now();
    const prior = loginAttempts.get(attemptKey);
    if (prior && prior.blockedUntil > now) return res.status(429).json({ success: false, message: "Umejaribu mara nyingi. Subiri dakika 15 kisha ujaribu tena." });
    const { data: matches, error } = await supabase.from("parent_portal_accounts")
      .select("id,student_id,school_id,username,password_hash,password_salt,must_change_password,is_active")
      .eq("school_id", schoolId).eq("username", username).eq("is_active", true).limit(100);
    if (error) throw error;
    if (!matches?.length) {
      const failed = (prior?.count || 0) + 1;
      loginAttempts.set(attemptKey, { count: failed, blockedUntil: failed >= 10 ? now + 15 * 60 * 1000 : 0 });
      return res.status(401).json({ success: false, message: "Username or password is incorrect." });
    }
    let account = null;
    for (const candidate of matches) if (await passwordMatches(password, candidate.password_salt, candidate.password_hash)) { account = candidate; break; }
    if (!account) {
      const failed = (prior?.count || 0) + 1;
      loginAttempts.set(attemptKey, { count: failed, blockedUntil: failed >= 10 ? now + 15 * 60 * 1000 : 0 });
      return res.status(401).json({ success: false, message: "Username or password is incorrect." });
    }
    loginAttempts.delete(attemptKey);
    const student = await loadStudent(account.student_id, schoolId);
    if (!student || String(student.status || student.student_status || "Active").toLowerCase() === "inactive") return res.status(403).json({ success: false, message: "Student account is inactive. Contact the school." });
    await supabase.from("parent_portal_accounts").update({ last_login_at: new Date().toISOString() }).eq("id", account.id);
    const token = tokenFor({ account_id: account.id, student_id: student.id, school_id: schoolId, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12 });
    const schoolName = await supabase.from("schools").select("school_name").eq("id", schoolId).single();
    const classRow = student.current_class_id ? await supabase.from("classes").select("class_name").eq("id", student.current_class_id).eq("school_id", schoolId).maybeSingle() : { data: null };
    return res.json({ success: true, token, must_change_password: account.must_change_password, student: { id: student.id, name: fullName(student), admission_number: student.admission_number || student.admission_no, school_name: schoolName.data?.school_name || "", class_name: classRow.data?.class_name || student.class_name || "" } });
  } catch (error) {
    console.error("PARENT PORTAL LOGIN ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to sign in to Parent Portal." });
  }
});


// Staff class group chat: limited to staff with student-view access in their own school.

// Build one option per logical class for every Parent Portal class selector.
// Historical class rows may repeat the same class name for different academic years.
async function loadParentPortalClassOptions(schoolId, allowedClassIds, { requireActive = false } = {}) {
  let classQuery = supabase.from("classes")
    .select("id,class_name,academic_year_id,is_active")
    .eq("school_id", schoolId).order("class_name");
  if (requireActive) classQuery = classQuery.eq("is_active", true);
  if (Array.isArray(allowedClassIds)) classQuery = classQuery.in("id", allowedClassIds.length ? allowedClassIds : [-1]);

  const { data: classRows, error: classError } = await classQuery;
  if (classError) throw classError;
  if (!classRows?.length) return [];

  const classIds = classRows.map((row) => row.id);
  const [studentsResult, yearsResult] = await Promise.all([
    supabase.from("students").select("current_class_id").eq("school_id", schoolId).in("current_class_id", classIds).limit(10000),
    supabase.from("academic_years").select("id,year_name,is_active").eq("school_id", schoolId),
  ]);
  if (studentsResult.error) throw studentsResult.error;
  if (yearsResult.error) throw yearsResult.error;

  const studentCounts = new Map();
  (studentsResult.data || []).forEach((student) => {
    const id = String(student.current_class_id);
    studentCounts.set(id, (studentCounts.get(id) || 0) + 1);
  });
  const years = new Map((yearsResult.data || []).map((year) => [String(year.id), year]));
  const activeYearIds = new Set((yearsResult.data || []).filter((year) => year.is_active === true).map((year) => String(year.id)));

  let candidates = classRows.filter((row) => (studentCounts.get(String(row.id)) || 0) > 0);
  const hasOccupiedActiveYear = candidates.some((row) => activeYearIds.has(String(row.academic_year_id)));
  if (activeYearIds.size && hasOccupiedActiveYear) {
    candidates = candidates.filter((row) => activeYearIds.has(String(row.academic_year_id)) || !row.academic_year_id);
  }

  const romanToNumber = (value) => ({ i: "1", ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7" }[value] || value);
  const labelKey = (value) => String(value || "").normalize("NFKC").toLowerCase()
    .replace(/\b(standard|std|form)\s+(vii|vi|iv|iii|ii|i)\b/g, (_match, level, roman) => level + " " + romanToNumber(roman))
    .replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

  const preferred = (candidate, current) => {
    const candidateYear = activeYearIds.has(String(candidate.academic_year_id)) ? 1 : 0;
    const currentYear = activeYearIds.has(String(current.academic_year_id)) ? 1 : 0;
    if (candidateYear !== currentYear) return candidateYear > currentYear;
    const candidateActive = candidate.is_active === true ? 1 : 0;
    const currentActive = current.is_active === true ? 1 : 0;
    if (candidateActive !== currentActive) return candidateActive > currentActive;
    const candidateCount = studentCounts.get(String(candidate.id)) || 0;
    const currentCount = studentCounts.get(String(current.id)) || 0;
    if (candidateCount !== currentCount) return candidateCount > currentCount;
    const candidateYearName = String(years.get(String(candidate.academic_year_id))?.year_name || "");
    const currentYearName = String(years.get(String(current.academic_year_id))?.year_name || "");
    if (candidateYearName !== currentYearName) return candidateYearName.localeCompare(currentYearName) > 0;
    return Number(candidate.id) > Number(current.id);
  };

  const unique = new Map();
  candidates.forEach((row) => {
    const key = labelKey(row.class_name) || "class-id:" + String(row.id);
    const existing = unique.get(key);
    if (!existing || preferred(row, existing)) unique.set(key, row);
  });
  return [...unique.entries()].map(([key, row]) => ({
    ...row,
    source_class_ids: candidates.filter((candidate) => labelKey(candidate.class_name) === key).map((candidate) => candidate.id),
    academic_year_name: years.get(String(row.academic_year_id))?.year_name || null,
    student_count: candidates.filter((candidate) => labelKey(candidate.class_name) === key)
      .reduce((total, candidate) => total + (studentCounts.get(String(candidate.id)) || 0), 0),
  })).sort((a, b) => String(a.class_name || "").localeCompare(String(b.class_name || "")));
}

router.get("/staff/classes", authenticateUser, parentPortalStaffAccess, async (req, res) => {
  const schoolId = Number(req.profile?.school_id);
  if (!Number.isInteger(schoolId) || schoolId <= 0) return res.status(403).json({ success: false, message: "School access is required." });
  try {
    const classes = await loadParentPortalClassOptions(schoolId, req.parentPortalScope.fullAccess ? null : req.parentPortalScope.classIds);
    return res.json({ success: true, classes });
  } catch (error) {
    console.error("PARENT PORTAL CLASS LIST ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to load authorized classes." });
  }
});

router.get("/staff/meeting-classes", authenticateUser, parentPortalStaffAccess, async (req, res) => {
  const schoolId = Number(req.profile?.school_id);
  if (!Number.isInteger(schoolId) || schoolId <= 0) return res.status(403).json({ success: false, message: "School access is required." });
  try {
    const classes = await loadParentPortalClassOptions(schoolId, req.parentPortalScope.fullAccess ? null : req.parentPortalScope.classIds, { requireActive: true });
    return res.json({ success: true, classes });
  } catch (error) {
    console.error("PARENT MEETING CLASS LIST ERROR:", error);
    return res.status(500).json({ success: false, message: "Imeshindikana kupakia madarasa yenye wanafunzi." });
  }
});

router.get("/staff/parents", authenticateUser, parentPortalStaffAccess, async (req, res) => {
  const schoolId = Number(req.profile?.school_id);
  try {
    const authorizedClasses = await loadParentPortalClassOptions(schoolId, req.parentPortalScope.fullAccess ? null : req.parentPortalScope.classIds);
    const visibleClassIds = [...new Set(authorizedClasses.flatMap((row) => row.source_class_ids || [row.id]))];
    if (!visibleClassIds.length) return res.json({ success: true, parents: [] });
    const { data: students, error } = await supabase.from("students")
      .select("id,first_name,middle_name,last_name,admission_number,parent_name,parent_phone,parent_email,guardian_name,guardian_phone,current_class_id")
      .eq("school_id", schoolId).in("current_class_id", visibleClassIds).order("first_name").limit(2000);
    if (error) throw error;
    const classMap = new Map();
    authorizedClasses.forEach((row) => (row.source_class_ids || [row.id]).forEach((id) => {
      classMap.set(String(id), { id: row.id, name: row.class_name });
    }));
    return res.json({ success: true, parents: (students || []).map((row) => {
      const canonicalClass = classMap.get(String(row.current_class_id));
      return {
        student_id: row.id, student_name: fullName(row), admission_number: row.admission_number,
        parent_name: row.parent_name || row.guardian_name || "Not provided",
        phone: row.parent_phone || row.guardian_phone || "", email: row.parent_email || "",
        class_id: canonicalClass?.id || row.current_class_id || null,
        class_name: canonicalClass?.name || "Unassigned",
      };
    }) });
  } catch (error) {
    console.error("PARENT PORTAL PARENT DIRECTORY ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to load parent contacts." });
  }
});
router.post("/staff/presence/heartbeat", authenticateUser, parentPortalStaffAccess, async (req, res) => {
  const schoolId = Number(req.profile?.school_id);
  const classId = Number(req.body?.class_id);
  if (!Number.isInteger(schoolId) || !Number.isInteger(classId) || classId <= 0) return res.status(400).json({ success: false, message: "Invalid class." });
  const classRow = await supabase.from("classes").select("id").eq("id", classId).eq("school_id", schoolId).maybeSingle();
  if (classRow.error || !classRow.data) return res.status(404).json({ success: false, message: "Class not found in your school." });
  if (!req.parentPortalScope.fullAccess && !req.parentPortalScope.classIds.includes(classId)) return res.status(403).json({ success: false, message: "Huruhusiwi kwenye kundi hili." });
  recordPresence({ schoolId, classId, memberType: "staff", memberId: req.user.id, name: req.profile.full_name });
  return res.json({ success: true, expires_in_seconds: PRESENCE_TTL_MS / 1000 });
});

router.get("/staff/chat/:classId", authenticateUser, parentPortalStaffAccess, async (req, res) => {
  const schoolId = Number(req.profile?.school_id);
  const classId = Number(req.params.classId);
  if (!Number.isInteger(schoolId) || !Number.isInteger(classId)) return res.status(400).json({ success: false, message: "Invalid class." });
  const classRow = await supabase.from("classes").select("id,school_id,class_name").eq("id", classId).eq("school_id", schoolId).maybeSingle();
  if (classRow.error || !classRow.data) return res.status(404).json({ success: false, message: "Class not found in your school." });
  if (!req.parentPortalScope.fullAccess && !req.parentPortalScope.classIds.includes(classId)) return res.status(403).json({ success: false, message: "Huruhusiwi kuona kundi la darasa hili." });
  const { data, error } = await supabase.from("parent_portal_chat_messages").select("id,sender_type,sender_name,message,created_at").eq("school_id", schoolId).eq("class_id", classId).order("created_at", { ascending: true }).limit(300);
  if (error) return res.status(500).json({ success: false, message: "Unable to load class group chat." });
  const groupMembers = withPresence(await loadClassParentMembers(schoolId, classId), schoolId, classId);
  return res.json({ success: true, class: classRow.data, messages: data || [], group_members: groupMembers });
});
router.post("/staff/chat/:classId", authenticateUser, parentPortalStaffAccess, async (req, res) => {
  const schoolId = Number(req.profile?.school_id);
  const classId = Number(req.params.classId);
  const message = String(req.body?.message || "").trim();
  if (!Number.isInteger(schoolId) || !Number.isInteger(classId) || !message || message.length > 4000) return res.status(400).json({ success: false, message: "Invalid class or message." });
  const classRow = await supabase.from("classes").select("id").eq("id", classId).eq("school_id", schoolId).maybeSingle();
  if (classRow.error || !classRow.data) return res.status(404).json({ success: false, message: "Class not found in your school." });
  if (!req.parentPortalScope.fullAccess && !req.parentPortalScope.classIds.includes(classId)) return res.status(403).json({ success: false, message: "Huruhusiwi kutuma ujumbe kwenye kundi hili." });
  const { data, error } = await supabase.from("parent_portal_chat_messages").insert({
    school_id: schoolId, class_id: classId, sender_user_id: req.user.id,
    sender_type: "staff", sender_name: req.profile.full_name || "School Staff", message,
  }).select("id,sender_type,sender_name,message,created_at").single();
  if (error) return res.status(500).json({ success: false, message: "Unable to send class message." });
  return res.json({ success: true, message: data });
});




// Live parent meetings: one school-wide live room at a time. Only school
// leadership can start/end; class teachers and other scoped staff cannot.
// Parent meetings use the same video_rooms + Supabase Realtime/WebRTC room
// protocol as Communication > Meetings. Parent identities are scoped by the
// Parent Portal bearer token and never inserted into auth-backed participant rows.
router.post("/staff/meetings/start", authenticateUser, parentPortalStaffAccess, async (req, res) => {
  const schoolId = Number(req.profile?.school_id);
  const title = String(req.body?.title || "").trim().slice(0, 180);
  const classId = Number(req.body?.class_id);
  const description = String(req.body?.description || "").trim().slice(0, 2000);
  if (!Number.isInteger(schoolId) || !title || !Number.isInteger(classId) || classId <= 0) return res.status(400).json({ success: false, message: "Weka kichwa cha mkutano na uchague darasa." });
  if (!canAdministerParentMeetings(req)) return res.status(403).json({ success: false, message: "Ni uongozi wa shule pekee unaoweza kuanzisha mkutano wa wazazi." });
  if (!req.parentPortalScope.fullAccess && !req.parentPortalScope.classIds.includes(classId)) return res.status(403).json({ success: false, message: "Huna ruhusa ya kuanzisha mkutano kwa darasa hili." });
  let roomId = null;
  let meetingId = null;
  try {
    const classCheck = await supabase.from("classes").select("id,is_active,academic_year_id").eq("id", classId).eq("school_id", schoolId).maybeSingle();
    if (classCheck.error) throw classCheck.error;
    if (!classCheck.data) return res.status(404).json({ success: false, message: "Darasa ulilochagua halipo kwenye shule yako." });
    if (classCheck.data.is_active === false) return res.status(409).json({ success: false, message: "Darasa hili halijawezeshwa kwa sasa." });
    const activeYears = await supabase.from("academic_years").select("id").eq("school_id", schoolId).eq("is_active", true);
    if (activeYears.error) throw activeYears.error;
    if ((activeYears.data || []).length && !(activeYears.data || []).some((year) => String(year.id) === String(classCheck.data.academic_year_id))) {
      return res.status(409).json({ success: false, message: "Chagua darasa la mwaka wa masomo unaotumika sasa." });
    }
    const assignedStudents = await supabase.from("students").select("id").eq("school_id", schoolId).eq("current_class_id", classId).limit(1);
    if (assignedStudents.error) throw assignedStudents.error;
    if (!assignedStudents.data?.length) return res.status(422).json({ success: false, message: "Hakuna mwanafunzi aliyepangiwa darasa hili. Chagua darasa lenye wanafunzi ili mkutano uwafikie wazazi." });
    const current = await supabase.from("parent_portal_meetings")
      .select("id,title,status").eq("school_id", schoolId).eq("class_id", classId).eq("status", "scheduled").eq("meeting_provider", PARENT_MEETING_PROVIDER).is("ends_at", null)
      .lte("starts_at", new Date().toISOString()).order("starts_at", { ascending: false }).limit(1).maybeSingle();
    if (current.error) throw current.error;
    if (current.data) return res.status(409).json({ success: false, message: "Kuna mkutano mwingine ambao bado uko LIVE. Maliza mkutano huo kwanza.", meeting: current.data });

    const now = new Date().toISOString();
    const roomCode = "PP-" + crypto.randomBytes(12).toString("hex").toUpperCase();
    const roomResult = await supabase.from("video_rooms").insert({
      school_id: schoolId, room_code: roomCode, title,
      description: description || null, created_by: req.user.id,
      status: "live", scheduled_start: now, scheduled_end: null,
    }).select("id,school_id,room_code,title,description,created_by,status,scheduled_start,scheduled_end,created_at,updated_at").single();
    if (roomResult.error) throw roomResult.error;
    roomId = roomResult.data.id;

    const meetingResult = await supabase.from("parent_portal_meetings").insert({
      school_id: schoolId, class_id: classId, title, description: description || null,
      starts_at: now, ends_at: null,
      meeting_url: FRONTEND_URL + "/communication/meeting/" + roomId,
      meeting_provider: PARENT_MEETING_PROVIDER, status: "scheduled", created_by: req.user.id,
    }).select("id,title,description,class_id,starts_at,ends_at,status,meeting_provider,meeting_url").single();
    if (meetingResult.error) throw meetingResult.error;
    meetingId = meetingResult.data.id;
    return res.json({
      success: true, meeting: { ...meetingResult.data, room_id: roomId },
      roomId, roomCode: roomResult.data.room_code, identity: "staff-" + req.user.id,
      displayName: req.profile?.full_name || "School Admin",
    });
  } catch (error) {
    if (meetingId) await supabase.from("parent_portal_meetings").update({ status: "completed", ends_at: new Date().toISOString() }).eq("id", meetingId).eq("school_id", schoolId);
    if (roomId) await supabase.from("video_rooms").update({ status: "ended", updated_at: new Date().toISOString() }).eq("id", roomId).eq("school_id", schoolId);
    console.error("PARENT WEBRTC MEETING START ERROR:", error);
    return res.status(500).json({ success: false, message: error.message || "Imeshindikana kuanzisha mkutano." });
  }
});

router.post("/staff/meetings/:id/token", authenticateUser, parentPortalStaffAccess, async (req, res) => {
  const schoolId = Number(req.profile?.school_id);
  if (!canAdministerParentMeetings(req)) return res.status(403).json({ success: false, message: "Huna ruhusa ya kuingia kama msimamizi wa mkutano." });
  try {
    const found = await supabase.from("parent_portal_meetings")
      .select("id,title,description,starts_at,status,meeting_url,meeting_provider")
      .eq("id", req.params.id).eq("school_id", schoolId).eq("status", "scheduled").eq("meeting_provider", PARENT_MEETING_PROVIDER).is("ends_at", null).lte("starts_at", new Date().toISOString()).maybeSingle();
    if (found.error) throw found.error;
    const roomId = parentMeetingRoomId(found.data);
    if (!found.data || !roomId) return res.status(404).json({ success: false, message: "Mkutano haupo LIVE kwa sasa." });
    const room = await supabase.from("video_rooms").select("id,school_id,room_code,created_by,status").eq("id", roomId).eq("school_id", schoolId).maybeSingle();
    if (room.error) throw room.error;
    if (!room.data || ["ended","cancelled","canceled"].includes(String(room.data.status).toLowerCase())) return res.status(404).json({ success: false, message: "Chumba cha mkutano hakipo tena." });
    return res.json({ success: true, meeting: { ...found.data, room_id: roomId }, roomId, roomCode: room.data.room_code, identity: "staff-" + req.user.id, displayName: req.profile?.full_name || "School Admin" });
  } catch (error) {
    console.error("PARENT WEBRTC MEETING STAFF ACCESS ERROR:", error);
    return res.status(500).json({ success: false, message: error.message || "Imeshindikana kuingia kwenye mkutano." });
  }
});

router.patch("/staff/meetings/:id/end", authenticateUser, parentPortalStaffAccess, async (req, res) => {
  const schoolId = Number(req.profile?.school_id);
  if (!canAdministerParentMeetings(req)) return res.status(403).json({ success: false, message: "Ni uongozi wa shule pekee unaoweza kumaliza mkutano." });
  try {
    const current = await supabase.from("parent_portal_meetings").select("id,meeting_url")
      .eq("id", req.params.id).eq("school_id", schoolId).eq("status", "scheduled").eq("meeting_provider", PARENT_MEETING_PROVIDER).maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) return res.status(404).json({ success: false, message: "Mkutano huu haupo LIVE au tayari umemalizika." });
    const endedAt = new Date().toISOString();
    const roomId = parentMeetingRoomId(current.data);
    if (roomId) {
      const roomUpdate = await supabase.from("video_rooms").update({ status: "ended", updated_at: endedAt }).eq("id", roomId).eq("school_id", schoolId);
      if (roomUpdate.error) throw roomUpdate.error;
    }
    const updated = await supabase.from("parent_portal_meetings").update({ status: "completed", ends_at: endedAt })
      .eq("id", req.params.id).eq("school_id", schoolId).eq("status", "scheduled").eq("meeting_provider", PARENT_MEETING_PROVIDER)
      .select("id,title,status,ends_at").maybeSingle();
    if (updated.error) throw updated.error;
    if (!updated.data) return res.status(409).json({ success: false, message: "Mkutano umebadilika. Refresh taarifa za mkutano." });
    return res.json({ success: true, meeting: updated.data, message: "Mkutano umemalizika." });
  } catch (error) {
    console.error("PARENT WEBRTC MEETING END ERROR:", error);
    return res.status(500).json({ success: false, message: error.message || "Imeshindikana kumaliza mkutano." });
  }
});

router.get("/staff/meetings", authenticateUser, parentPortalStaffAccess, async (req, res) => {
  const schoolId = Number(req.profile?.school_id);
  if (!Number.isInteger(schoolId)) return res.status(403).json({ success: false, message: "School access is required." });
  let meetingsQuery = supabase.from("parent_portal_meetings")
    .select("id,title,description,class_id,starts_at,ends_at,meeting_url,meeting_provider,status")
    .eq("school_id", schoolId).order("starts_at", { ascending: true }).limit(100);
  if (!req.parentPortalScope.fullAccess) meetingsQuery = meetingsQuery.in("class_id", req.parentPortalScope.classIds.length ? req.parentPortalScope.classIds : [-1]);
  const { data, error } = await meetingsQuery;
  if (error) return res.status(500).json({ success: false, message: "Unable to load parent meetings." });
  return res.json({ success: true, meetings: data || [] });
});

router.post("/staff/meetings", authenticateUser, parentPortalStaffAccess, async (req, res) => {
  const schoolId = Number(req.profile?.school_id);
  const classId = req.body?.class_id ? Number(req.body.class_id) : null;
  const title = String(req.body?.title || "").trim();
  const description = String(req.body?.description || "").trim();
  const startsAt = new Date(req.body?.starts_at);
  const endsAt = req.body?.ends_at ? new Date(req.body.ends_at) : null;
  const meetingUrl = String(req.body?.meeting_url || "").trim();
  if (meetingUrl && !/^https?:\/\//i.test(meetingUrl)) return res.status(400).json({ success: false, message: "Video meeting link must start with https:// or http://." });
  if (classId !== null && (!Number.isInteger(classId) || classId <= 0)) return res.status(400).json({ success: false, message: "Invalid class selection." });
  if (!Number.isInteger(schoolId) || !title || Number.isNaN(startsAt.getTime()) || (endsAt && (Number.isNaN(endsAt.getTime()) || endsAt <= startsAt))) return res.status(400).json({ success: false, message: "Enter a title and valid meeting start/end times." });
  if (!req.parentPortalScope.fullAccess && (!classId || !req.parentPortalScope.classIds.includes(classId))) return res.status(403).json({ success: false, message: "Mwalimu wa darasa anaweza kuratibu mikutano ya darasa lake tu." });
  if (classId) {
    const classRow = await supabase.from("classes").select("id").eq("id", classId).eq("school_id", schoolId).maybeSingle();
    if (classRow.error || !classRow.data) return res.status(404).json({ success: false, message: "Class not found in your school." });
  }
  const { data, error } = await supabase.from("parent_portal_meetings").insert({
    school_id: schoolId, class_id: classId, title, description: description || null,
    starts_at: startsAt.toISOString(), ends_at: endsAt?.toISOString() || null,
    meeting_url: meetingUrl || null, meeting_provider: String(req.body?.meeting_provider || "").trim() || null,
    created_by: req.user.id,
  }).select("*").single();
  if (error) return res.status(500).json({ success: false, message: "Unable to schedule parent meeting." });
  return res.json({ success: true, meeting: data });
});


// Staff review and reply to Parent Portal suggestions in their own school.
router.get("/staff/suggestions", authenticateUser, parentPortalStaffAccess, async (req, res) => {
  const schoolId = Number(req.profile?.school_id);
  if (!Number.isInteger(schoolId)) return res.status(403).json({ success: false, message: "School access is required." });
  const { data, error } = await supabase.from("parent_portal_suggestions")
    .select("id,student_id,category,message,status,staff_reply,replied_at,created_at")
    .eq("school_id", schoolId).order("created_at", { ascending: false }).limit(200);
  if (error) return res.status(500).json({ success: false, message: "Unable to load parent suggestions." });
  const scopedRows = req.parentPortalScope.fullAccess ? (data || []) : (data || []).filter((item) => req.parentPortalScope.studentIds.includes(item.student_id));
  const studentIds = [...new Set(scopedRows.map(x => x.student_id))];
  const students = studentIds.length ? await supabase.from("students").select("id,first_name,middle_name,last_name,admission_number").eq("school_id", schoolId).in("id", studentIds) : { data: [] };
  if (students.error) return res.status(500).json({ success: false, message: "Unable to load student names." });
  const studentMap = new Map((students.data || []).map(s => [String(s.id), { name: [s.first_name,s.middle_name,s.last_name].filter(Boolean).join(" "), admission_number: s.admission_number }]));
  return res.json({ success: true, suggestions: scopedRows.map(x => ({ ...x, student: studentMap.get(String(x.student_id)) || null })) });
});
router.patch("/staff/suggestions/:id", authenticateUser, parentPortalStaffAccess, async (req, res) => {
  const schoolId = Number(req.profile?.school_id);
  const id = String(req.params.id || "");
  const reply = String(req.body?.staff_reply || "").trim();
  const status = String(req.body?.status || (reply ? "responded" : "under_review"));
  if (!Number.isInteger(schoolId) || !/^[0-9a-f-]{36}$/i.test(id) || !["pending","under_review","responded","closed"].includes(status) || reply.length > 4000) return res.status(400).json({ success: false, message: "Invalid suggestion update." });
  let suggestionUpdate = supabase.from("parent_portal_suggestions").update({
    status, staff_reply: reply || null, replied_by: reply ? req.user.id : null,
    replied_at: reply ? new Date().toISOString() : null, updated_at: new Date().toISOString(),
  }).eq("id", id).eq("school_id", schoolId);
  if (!req.parentPortalScope.fullAccess) suggestionUpdate = suggestionUpdate.in("student_id", req.parentPortalScope.studentIds.length ? req.parentPortalScope.studentIds : [-1]);
  const { data, error } = await suggestionUpdate.select("id,status,staff_reply,replied_at").maybeSingle();
  if (error) return res.status(500).json({ success: false, message: "Unable to update parent suggestion." });
  if (!data) return res.status(404).json({ success: false, message: "Suggestion not found in your school." });
  return res.json({ success: true, suggestion: data });
});

// Publish immutable, student-scoped result copies for Parent Portal.
// Snapshots intentionally do not reference exams/students with foreign keys.
router.post("/staff/exams/:examId/publish-results", authenticateUser, requirePermission("EXAM_VIEW"), async (req, res) => {
  const examId = Number(req.params.examId);
  const schoolId = Number(req.profile?.school_id);
  const offset = Math.max(0, Number.parseInt(req.body?.offset, 10) || 0);
  const requestedReports = Array.isArray(req.body?.report_snapshots) ? req.body.report_snapshots : [];
  const requestedTotal = Math.max(0, Number.parseInt(req.body?.total_count, 10) || 0);
  if (!Number.isInteger(examId) || examId <= 0 || !Number.isInteger(schoolId) || schoolId <= 0) return res.status(400).json({ success: false, message: "Invalid exam or school context." });
  if (!requestedReports.length || requestedReports.length > 25) return res.status(400).json({ success: false, message: "Tuma kundi halali la ripoti za wanafunzi 1 hadi 25." });
  try {
    const examQuery = await supabase.from("exams").select("id,school_id,exam_name,exam_type,term,start_date,end_date,academic_year_id,status").eq("id", examId).eq("school_id", schoolId).is("deleted_at", null).maybeSingle();
    if (examQuery.error) throw examQuery.error;
    if (!examQuery.data) return res.status(404).json({ success: false, message: "Examination not found in your school." });
    // Result Analysis uses exam_question_marks first and exam_marks as its legacy fallback.
    // results.approved is not the source of truth for these report forms.
    const reportEntries = requestedReports.map(item => ({ studentId: Number(item?.student_id), report: item?.report }));
    const studentIds = reportEntries.map(item => item.studentId);
    if (studentIds.some(id => !Number.isInteger(id) || id <= 0) || new Set(studentIds).size !== studentIds.length) return res.status(422).json({ success: false, message: "Orodha ya wanafunzi ina ID isiyo sahihi au inayojirudia." });
    const reportsValid = reportEntries.every(({ studentId, report }) => report && Number(report.id) === studentId && Array.isArray(report.subjects) && report.subjects.length > 0 && report.subjects.every(subject => subject && typeof subject.subject_name === "string" && subject.subject_name.trim()));
    if (!reportsValid) return res.status(422).json({ success: false, message: "Report form data haijakamilika. Refresh Result Analysis kisha ujaribu tena." });
    const [studentsQuery, questionMarksQuery, legacyMarksQuery, examSubjectsQuery] = await Promise.all([
      supabase.from("students").select("id,school_id").eq("school_id", schoolId).in("id", studentIds),
      supabase.from("exam_question_marks").select("id,exam_id,exam_subject_id,question_id,student_id,marks_obtained,is_selected,created_at").eq("exam_id", examId).in("student_id", studentIds),
      supabase.from("exam_marks").select("id,exam_id,exam_subject_id,student_id,marks_obtained,grade,remark,created_at").eq("exam_id", examId).in("student_id", studentIds),
      supabase.from("exam_subjects").select("id,subject_id,full_marks,pass_marks,class_id").eq("exam_id", examId),
    ]);
    for (const result of [studentsQuery, questionMarksQuery, legacyMarksQuery, examSubjectsQuery]) if (result.error) throw result.error;
    const validStudentIds = new Set((studentsQuery.data || []).map(row => Number(row.id)));
    const examSubjectIds = new Set((examSubjectsQuery.data || []).map(row => Number(row.id)));
    const subjectIds = [...new Set((examSubjectsQuery.data || []).map(row => Number(row.subject_id)).filter(Number.isInteger))];
    const subjectsQuery = subjectIds.length ? await supabase.from("subjects").select("id,subject_name").in("id", subjectIds) : { data: [], error: null };
    if (subjectsQuery.error) throw subjectsQuery.error;
    const subjectMap = new Map((subjectsQuery.data || []).map(row => [String(row.id), row.subject_name]));
    const examSubjectMap = new Map((examSubjectsQuery.data || []).map(row => [Number(row.id), row]));
    const marksByStudent = new Map();
    const appendMark = (mark, source) => {
      const studentId = Number(mark.student_id);
      const examSubject = examSubjectMap.get(Number(mark.exam_subject_id));
      if (!validStudentIds.has(studentId) || !examSubject) return;
      if (!marksByStudent.has(studentId)) marksByStudent.set(studentId, []);
      marksByStudent.get(studentId).push({ ...mark, source, subject_id: examSubject.subject_id, subject_name: subjectMap.get(String(examSubject.subject_id)) || "Subject" });
    };
    const hasQuestionMarks = (questionMarksQuery.data || []).length > 0;
    if (hasQuestionMarks) {
      (questionMarksQuery.data || []).forEach(mark => appendMark(mark, "question"));
    } else {
      // Match Result Analysis exactly: legacy marks are a fallback, never merged
      // with question-level marks, otherwise marks could be counted twice.
      (legacyMarksQuery.data || []).forEach(mark => appendMark(mark, "legacy"));
    }
    const invalidStudent = studentIds.find(id => !validStudentIds.has(id));
    if (invalidStudent) return res.status(403).json({ success: false, message: "Mwanafunzi mmoja au zaidi hayupo kwenye shule hii. Hakuna matokeo yaliyochapishwa." });
    const withoutMarks = studentIds.filter(id => !(marksByStudent.get(id) || []).length);
    if (withoutMarks.length && req.body?.allow_missing_marks !== true) {
      return res.status(409).json({
        success: false,
        code: "MISSING_STUDENT_MARKS",
        message: "Baadhi ya wanafunzi hawana alama zilizohifadhiwa kwa mtihani huu. Unaweza kuendelea kuchapisha matokeo yaliyopo.",
        students_without_marks: withoutMarks,
      });
    }
    const publishedAt = new Date().toISOString();
    const rows = reportEntries.map(({ studentId, report }) => ({
      school_id: schoolId, exam_id: examId, student_id: studentId, exam_snapshot: examQuery.data,
      result_snapshot: { report_form: report }, marks_snapshot: marksByStudent.get(studentId) || [],
      subjects_snapshot: (examSubjectsQuery.data || []).map(subject => ({ id: subject.subject_id, exam_subject_id: subject.id, subject_name: subjectMap.get(String(subject.subject_id)) || "Subject", full_marks: subject.full_marks, pass_marks: subject.pass_marks })),
      published_at: publishedAt, published_by: req.user.id,
    }));
    const saved = await supabase.from("parent_portal_result_snapshots").upsert(rows, { onConflict: "school_id,exam_id,student_id" });
    if (saved.error) throw saved.error;
    const totalCount = Math.max(requestedTotal, offset + rows.length);
    const nextOffset = offset + rows.length;
    return res.json({ success: true, published_count: rows.length, total_count: totalCount, has_more: nextOffset < totalCount, next_offset: nextOffset, published_at: publishedAt, missing_marks_count: withoutMarks.length, students_without_marks: withoutMarks, message: "Matokeo yaliyotengenezwa kwenye Result Analysis yamechapishwa kwenye Parent Portal." });
  } catch (error) {
    console.error("PARENT PORTAL RESULT PUBLISH ERROR:", error);
    return res.status(500).json({ success: false, message: error.message || "Unable to publish results to Parent Portal." });
  }
});

router.use(parentAuth);



router.get("/meetings/active", async (req, res) => {
  const { student, school } = req.parent;
  try {
    const classId = Number(student.current_class_id || 0);
    if (!Number.isInteger(classId) || classId <= 0) return res.json({ success: true, meeting: null });
    const result = await supabase.from("parent_portal_meetings")
      .select("id,title,description,starts_at,status,class_id,meeting_url,meeting_provider")
      .eq("school_id", school.id).eq("status", "scheduled").eq("meeting_provider", PARENT_MEETING_PROVIDER).is("ends_at", null)
      .lte("starts_at", new Date().toISOString()).eq("class_id", classId)
      .order("starts_at", { ascending: false }).limit(1).maybeSingle();
    if (result.error) throw result.error;
    const meeting = result.data;
    const roomId = parentMeetingRoomId(meeting);
    if (!meeting || !roomId) return res.json({ success: true, meeting: null });
    const room = await supabase.from("video_rooms").select("id,room_code,status").eq("id", roomId).eq("school_id", school.id).maybeSingle();
    if (room.error) throw room.error;
    if (!room.data || ["ended","cancelled","canceled"].includes(String(room.data.status).toLowerCase())) return res.json({ success: true, meeting: null });
    return res.json({ success: true, meeting: { id: meeting.id, title: meeting.title, description: meeting.description, starts_at: meeting.starts_at, status: meeting.status, class_id: meeting.class_id } });
  } catch (error) {
    console.error("PARENT ACTIVE WEBRTC MEETING LOOKUP ERROR:", error);
    return res.status(500).json({ success: false, message: "Imeshindikana kuangalia mkutano LIVE." });
  }
});

router.post("/meetings/:id/token", async (req, res) => {
  const { student, school, account } = req.parent;
  try {
    const classId = Number(student.current_class_id || 0);
    if (!Number.isInteger(classId) || classId <= 0) return res.status(403).json({ success: false, message: "Mwanafunzi hajapangiwa darasa." });
    const found = await supabase.from("parent_portal_meetings")
      .select("id,title,description,starts_at,status,class_id,meeting_url")
      .eq("id", req.params.id).eq("school_id", school.id).eq("status", "scheduled").eq("meeting_provider", PARENT_MEETING_PROVIDER).is("ends_at", null)
      .lte("starts_at", new Date().toISOString()).eq("class_id", classId).maybeSingle();
    if (found.error) throw found.error;
    const roomId = parentMeetingRoomId(found.data);
    if (!found.data || !roomId) return res.status(404).json({ success: false, message: "Mkutano haupo LIVE. Tafadhali refresh Parent Portal." });
    const room = await supabase.from("video_rooms").select("id,room_code,status").eq("id", roomId).eq("school_id", school.id).maybeSingle();
    if (room.error) throw room.error;
    if (!room.data || ["ended","cancelled","canceled"].includes(String(room.data.status).toLowerCase())) return res.status(404).json({ success: false, message: "Mkutano huu umemalizika." });
    if (!String(room.data.room_code || "").trim()) return res.status(409).json({ success: false, message: "Chumba hiki hakina room code. Tafadhali anzisha mkutano upya." });
    const name = account.username || fullName(student) || "Mzazi";
    return res.json({
      success: true,
      meeting: { id: found.data.id, title: found.data.title, description: found.data.description, starts_at: found.data.starts_at, status: found.data.status, class_id: found.data.class_id },
      roomId, roomCode: room.data.room_code, identity: "parent-" + account.id, displayName: name,
    });
  } catch (error) {
    console.error("PARENT WEBRTC MEETING ACCESS ERROR:", error);
    return res.status(500).json({ success: false, message: error.message || "Imeshindikana kujiunga na mkutano." });
  }
});

router.post("/presence/heartbeat", async (req, res) => {
  const { student, school, account } = req.parent;
  const classId = Number(student.current_class_id);
  if (!Number.isInteger(classId) || classId <= 0) return res.status(400).json({ success: false, message: "Student is not assigned to a class." });
  recordPresence({ schoolId: school.id, classId, memberType: "parent", memberId: student.id, name: account.username });
  return res.json({ success: true, expires_in_seconds: PRESENCE_TTL_MS / 1000 });
});

router.get("/presence", async (req, res) => {
  const { student, school } = req.parent;
  const classId = Number(student.current_class_id);
  const online = Number.isInteger(classId) ? presenceForClass(school.id, classId) : new Map();
  return res.json({ success: true, online_staff: [...online.keys()].filter((key) => key.startsWith("staff:")).map((key) => key.slice(6)) });
});

router.get("/finance", async (req, res) => {
  const { student, school } = req.parent;
  try {
    const [charges, payments] = await Promise.all([
      supabase.schema("finance").from("student_charges")
        .select("id,description,amount,paid_amount,balance,due_date,status,term_number,created_at")
        .eq("school_id", school.id).eq("student_id", student.id)
        .order("created_at", { ascending: false }).limit(100),
      supabase.schema("finance").from("student_payments")
        .select("id,payment_number,payment_date,amount,payment_method,reference_number,description,status")
        .eq("school_id", school.id).eq("student_id", student.id)
        .order("payment_date", { ascending: false }).limit(100),
    ]);
    if (charges.error || payments.error) throw charges.error || payments.error;
    const chargeRows = charges.data || [];
    return res.json({
      success: true,
      finance: {
        total_charged: chargeRows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
        total_paid: chargeRows.reduce((sum, row) => sum + Number(row.paid_amount || 0), 0),
        balance: chargeRows.reduce((sum, row) => sum + Number(row.balance || 0), 0),
        charges: chargeRows,
        payments: payments.data || [],
      },
    });
  } catch (error) {
    console.error("PARENT FINANCE REFRESH ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to refresh student finance information." });
  }
});

router.get("/dashboard", async (req, res) => {
  const { student, school } = req.parent;
  const classId = student.current_class_id;
  try {
    const [classResult, charges, payments, communications, announcements, meetings, publishedSnapshots, attendance, suggestions] = await Promise.all([
      classId ? supabase.from("classes").select("id,class_name,short_name").eq("id", classId).eq("school_id", school.id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.schema("finance").from("student_charges").select("id,description,amount,paid_amount,balance,due_date,status,term_number,created_at").eq("school_id", school.id).eq("student_id", student.id).order("created_at", { ascending: false }).limit(100),
      supabase.schema("finance").from("student_payments").select("id,payment_number,payment_date,amount,payment_method,reference_number,description,status").eq("school_id", school.id).eq("student_id", student.id).order("payment_date", { ascending: false }).limit(100),
      supabase.from("parent_result_communications").select("id,channel,subject,message,status,sent_at,created_at").eq("school_id", school.id).eq("student_id", student.id).order("created_at", { ascending: false }).limit(100),
      supabase.from("announcements").select("id,title,content,created_at").eq("school_id", school.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("parent_portal_meetings").select("id,title,description,starts_at,ends_at,meeting_url,meeting_provider,status").eq("school_id", school.id).is("class_id", null).eq("status", "scheduled").eq("meeting_provider", PARENT_MEETING_PROVIDER).is("ends_at", null).lte("starts_at", new Date().toISOString()).order("starts_at", { ascending: true }).limit(1),
      // Only this authenticated student's published snapshots are eligible for the report dropdown.
      // Do not expose the school's general exam catalogue to parent accounts.
      supabase.from("parent_portal_result_snapshots").select("exam_id,exam_snapshot,result_snapshot,published_at").eq("school_id", school.id).eq("student_id", student.id).order("published_at", { ascending: false }).limit(100),
      supabase.from("class_attendance").select("id,attendance_date,status,remarks").eq("school_id", school.id).eq("student_id", student.id).order("attendance_date", { ascending: false }).limit(60),
      supabase.from("parent_portal_suggestions").select("id,category,message,status,staff_reply,replied_at,created_at").eq("school_id", school.id).eq("student_id", student.id).order("created_at", { ascending: false }).limit(50),
    ]);
    for (const result of [charges,payments,communications,announcements,meetings,publishedSnapshots,attendance,suggestions]) if (result.error) throw result.error;
    const parentExams = (publishedSnapshots.data || [])
      .filter(snapshot => {
        const report = snapshot.result_snapshot?.report_form;
        return Boolean(snapshot.exam_snapshot && report && Number(report.id) === Number(student.id) && Array.isArray(report.subjects) && report.subjects.length > 0);
      })
      .map(snapshot => ({ ...snapshot.exam_snapshot, id: snapshot.exam_id, published_at: snapshot.published_at, result_published: true }))
      .sort((a, b) => String(b.start_date || b.published_at || "").localeCompare(String(a.start_date || a.published_at || "")));
    const chargeRows = charges.data || [];
    const totalCharged = chargeRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const totalPaid = chargeRows.reduce((sum, row) => sum + Number(row.paid_amount || 0), 0);
    const totalBalance = chargeRows.reduce((sum, row) => sum + Number(row.balance || 0), 0);
    const chat = classId ? await supabase.from("parent_portal_chat_messages").select("id,sender_type,sender_name,message,created_at").eq("school_id", school.id).eq("class_id", classId).order("created_at", { ascending: true }).limit(200) : { data: [] };
    if (chat.error) throw chat.error;
    const allGroupMembers = classId ? await loadClassParentMembers(school.id, classId) : [];
    // Parent accounts may see their own identity and school staff only; never disclose other parents.
    const groupMembers = withPresence(allGroupMembers.filter((member) => member.member_type === "staff" || String(member.student_id) === String(student.id)), school.id, classId);
    return res.json({
      success: true,
      student: { id: student.id, name: fullName(student), admission_number: student.admission_number || student.admission_no, class_name: classResult.data?.class_name || student.class_name || "-", school_name: school.school_name, academic_year_id: student.academic_year_id, status: student.status || student.student_status },
      finance: { total_charged: totalCharged, total_paid: totalPaid, balance: totalBalance, charges: chargeRows, payments: payments.data || [] },
      communications: communications.data || [], announcements: announcements.data || [], meetings: meetings.data || [],
      exams: parentExams, attendance: attendance.data || [], suggestions: suggestions.data || [], chat: chat.data || [], group_members: groupMembers,
      must_change_password: req.parent.account.must_change_password,
      portal_type: req.parent.account.is_sponsor ? "Sponsor" : "Parent",
      sponsor_center_name: req.parent.account.sponsor_center_name || null,
    });
  } catch (error) {
    console.error("PARENT DASHBOARD ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to load student information." });
  }
});

router.get("/results/:examId", async (req, res) => {
  const examId = Number(req.params.examId);
  const { student, school } = req.parent;
  if (!Number.isInteger(examId)) return res.status(400).json({ success: false, message: "Invalid examination." });
  try {
    // Published result snapshots are the authoritative Parent Portal source.
    // They survive soft and permanent deletion of the original examination.
    const snapshotQuery = await supabase.from("parent_portal_result_snapshots")
      .select("exam_snapshot,result_snapshot,marks_snapshot,subjects_snapshot,published_at")
      .eq("school_id", school.id).eq("student_id", student.id).eq("exam_id", examId).maybeSingle();
    if (snapshotQuery.error) throw snapshotQuery.error;
    if (!snapshotQuery.data) return res.status(404).json({ success: false, message: "Matokeo ya mtihani huu bado hayajachapishwa kwa Parent Portal." });
    const snapshot = snapshotQuery.data;
    const subjectNames = new Map((snapshot.subjects_snapshot || []).map(subject => [String(subject.id), subject.subject_name]));
    return res.json({
      success: true,
      exam: snapshot.exam_snapshot,
      result: snapshot.result_snapshot,
      result_status: "published",
      published_at: snapshot.published_at,
      marks: (snapshot.marks_snapshot || []).map(mark => ({
        ...mark,
        subject_name: mark.subject_name || subjectNames.get(String(mark.subject_id)) || "Subject",
      })),
    });
  } catch (error) {
    console.error("PARENT RESULTS SNAPSHOT ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to load published examination results." });
  }
});

router.post("/change-password", async (req, res) => {
  if (req.parent?.account?.is_sponsor) return res.status(403).json({ success: false, message: "Sponsor password reset is managed by the school office." });
  const currentPassword = String(req.body?.current_password || "");
  const newPassword = String(req.body?.new_password || "");
  if (!currentPassword || newPassword.length < 8) return res.status(400).json({ success: false, message: "Enter your current password and a new password of at least 8 characters." });
  try {
    const { data: account, error } = await supabase.from("parent_portal_accounts").select("id,password_hash,password_salt").eq("id", req.parent.account.id).single();
    if (error || !await passwordMatches(currentPassword, account.password_salt, account.password_hash)) return res.status(400).json({ success: false, message: "Current password is incorrect." });
    const hashed = await hashPassword(newPassword);
    const update = await supabase.from("parent_portal_accounts").update({ password_hash: hashed.hash, password_salt: hashed.salt, must_change_password: false, updated_at: new Date().toISOString() }).eq("id", account.id);
    if (update.error) throw update.error;
    return res.json({ success: true, message: "Password changed successfully." });
  } catch (error) {
    console.error("PARENT PASSWORD CHANGE ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to change password." });
  }
});

router.post("/suggestions", async (req, res) => {
  if (req.parent?.account?.is_sponsor) return res.status(403).json({ success: false, message: "Sponsor accounts cannot submit parent-only suggestions." });
  const message = String(req.body?.suggestion || "").trim();
  const category = String(req.body?.category || "General").trim().slice(0, 80) || "General";
  if (message.length < 5 || message.length > 4000) return res.status(400).json({ success: false, message: "Suggestion must contain between 5 and 4000 characters." });
  const { student, school, account } = req.parent;
  const { data, error } = await supabase.from("parent_portal_suggestions").insert({
    school_id: school.id, student_id: student.id, parent_account_id: account.id, category, message,
  }).select("id,category,message,status,created_at").single();
  if (error) return res.status(500).json({ success: false, message: "Unable to submit suggestion." });
  return res.json({ success: true, suggestion: data });
});

router.post("/chat", async (req, res) => {
  const message = String(req.body?.message || "").trim();
  const { student, school } = req.parent;
  if (!student.current_class_id) return res.status(400).json({ success: false, message: "Student has no active class for group chat." });
  if (!message || message.length > 4000) return res.status(400).json({ success: false, message: "Message must be between 1 and 4000 characters." });
  const classRow = await supabase.from("classes").select("id").eq("id", student.current_class_id).eq("school_id", school.id).maybeSingle();
  if (classRow.error || !classRow.data) return res.status(403).json({ success: false, message: "Student's current class is not available in this school." });
  const { data, error } = await supabase.from("parent_portal_chat_messages").insert({
    school_id: school.id, class_id: student.current_class_id, student_id: student.id,
    parent_account_id: req.parent.account.is_sponsor ? null : req.parent.account.id, sender_type: "parent", sender_name: (req.parent.account.is_sponsor ? "Sponsor wa " : "Mzazi wa ") + fullName(student), message,
  }).select("id,sender_type,sender_name,message,created_at").single();
  if (error) return res.status(500).json({ success: false, message: "Unable to send class message." });
  return res.json({ success: true, message: data });
});

router.post("/logout", (_req, res) => res.json({ success: true, message: "Signed out." }));

export default router;
