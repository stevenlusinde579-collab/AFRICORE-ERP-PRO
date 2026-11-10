import express from "express";
import crypto from "node:crypto";
import { promisify } from "node:util";
import { supabase } from "../config/supabase.js";
import { authenticateUser } from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/permissionMiddleware.js";

const router = express.Router();
const scrypt = promisify(crypto.scrypt);
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
async function parentAuth(req, res, next) {
  try {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const claims = verifyToken(token);
    if (!claims?.account_id || !claims?.student_id || !claims?.school_id) {
      return res.status(401).json({ success: false, message: "Parent Portal session expired. Please sign in again." });
    }
    const { data: account, error } = await supabase.from("parent_portal_accounts")
      .select("id,student_id,school_id,username,must_change_password,is_active")
      .eq("id", claims.account_id).eq("student_id", claims.student_id).eq("school_id", claims.school_id)
      .maybeSingle();
    if (error || !account || !account.is_active) return res.status(401).json({ success: false, message: "Parent Portal account is unavailable." });
    const student = await loadStudent(account.student_id, account.school_id);
    if (!student) return res.status(403).json({ success: false, message: "Student is no longer available in this school." });
    const { data: school, error: schoolError } = await supabase.from("schools").select("id,school_name,is_active").eq("id", account.school_id).maybeSingle();
    if (schoolError || !school || school.is_active !== true) return res.status(403).json({ success: false, message: "This school is inactive. Please contact the school administrator." });
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
    const url = FRONTEND_URL + "/parent-portal?school=" + encodeURIComponent(student.school_id);
    const message = "AFR ICORE PARENT PORTAL\nMwanafunzi: " + fullName(student) +
      "\nShule: " + (student.school_name || "") +
      "\nUsername: " + account.username +
      "\nPassword ya awali: " + admission +
      "\nIngia: " + url +
      "\nBadilisha password baada ya kuingia kwa mara ya kwanza. Usimpe mtu mwingine taarifa hizi.";
    const response = await fetch("https://sms.newhope.co.tz/v1/sms/send/", {
      method: "POST",
      headers: { Authorization: "ApiKey " + credentials.api_key + ":" + credentials.secret_key, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ recipient: "+" + phone, message }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result?.message || result?.detail || result?.error || "NewHope SMS HTTP " + response.status);
    const providerStatus = String(result?.status || "sent").toLowerCase().includes("fail") ? "failed" : (String(result?.status || "sent").toLowerCase().includes("queue") ? "queued" : "sent");
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
    if (!account) {
      const password = await hashPassword(admission);
      const { data, error: insertError } = await supabase.from("parent_portal_accounts").insert({
        student_id: student.id, school_id: schoolId, username, password_hash: password.hash, password_salt: password.salt, must_change_password: true,
      }).select("*").single();
      if (insertError) throw insertError;
      account = data;
    } else {
      const { error: updateError } = await supabase.from("parent_portal_accounts").update({ username, updated_at: new Date().toISOString() }).eq("id", account.id);
      if (updateError) throw updateError;
    }
    const delivery = await sendCredentialSms({ ...student, school_name: (await supabase.from("schools").select("school_name").eq("id", schoolId).single()).data?.school_name }, account, req.user.id);
    return res.json({ success: true, account_created: true, sms: delivery });
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
  return res.json({ success: true, history: data || [] });
});

router.post("/login", async (req, res) => {
  const schoolId = Number(req.body?.school_id);
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  if (!Number.isInteger(schoolId) || !username || !password) return res.status(400).json({ success: false, message: "Choose your school and enter student username and admission number." });
  try {
    const { data: school, error: schoolError } = await supabase.from("schools").select("id,is_active").eq("id", schoolId).maybeSingle();
    if (schoolError || !school || school.is_active !== true) return res.status(403).json({ success: false, message: "School not found or inactive." });
    const { data: matches, error } = await supabase.from("parent_portal_accounts")
      .select("id,student_id,school_id,username,password_hash,password_salt,must_change_password,is_active")
      .eq("school_id", schoolId).ilike("username", username).eq("is_active", true).limit(5);
    if (error) throw error;
    if (!matches?.length) return res.status(401).json({ success: false, message: "Username or password is incorrect." });
    let account = null;
    for (const candidate of matches) if (await passwordMatches(password, candidate.password_salt, candidate.password_hash)) { account = candidate; break; }
    if (!account) return res.status(401).json({ success: false, message: "Username or password is incorrect." });
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
router.get("/staff/chat/:classId", authenticateUser, requirePermission("view_students"), async (req, res) => {
  const schoolId = Number(req.profile?.school_id);
  const classId = Number(req.params.classId);
  if (!Number.isInteger(schoolId) || !Number.isInteger(classId)) return res.status(400).json({ success: false, message: "Invalid class." });
  const classRow = await supabase.from("classes").select("id,school_id,class_name").eq("id", classId).eq("school_id", schoolId).maybeSingle();
  if (classRow.error || !classRow.data) return res.status(404).json({ success: false, message: "Class not found in your school." });
  const { data, error } = await supabase.from("parent_portal_chat_messages").select("id,sender_type,sender_name,message,created_at").eq("school_id", schoolId).eq("class_id", classId).order("created_at", { ascending: true }).limit(300);
  if (error) return res.status(500).json({ success: false, message: "Unable to load class group chat." });
  return res.json({ success: true, class: classRow.data, messages: data || [] });
});
router.post("/staff/chat/:classId", authenticateUser, requirePermission("view_students"), async (req, res) => {
  const schoolId = Number(req.profile?.school_id);
  const classId = Number(req.params.classId);
  const message = String(req.body?.message || "").trim();
  if (!Number.isInteger(schoolId) || !Number.isInteger(classId) || !message || message.length > 4000) return res.status(400).json({ success: false, message: "Invalid class or message." });
  const classRow = await supabase.from("classes").select("id").eq("id", classId).eq("school_id", schoolId).maybeSingle();
  if (classRow.error || !classRow.data) return res.status(404).json({ success: false, message: "Class not found in your school." });
  const { data, error } = await supabase.from("parent_portal_chat_messages").insert({
    school_id: schoolId, class_id: classId, sender_user_id: req.user.id,
    sender_type: "staff", sender_name: req.profile.full_name || "School Staff", message,
  }).select("id,sender_type,sender_name,message,created_at").single();
  if (error) return res.status(500).json({ success: false, message: "Unable to send class message." });
  return res.json({ success: true, message: data });
});

router.use(parentAuth);

router.get("/dashboard", async (req, res) => {
  const { student, school } = req.parent;
  const classId = student.current_class_id;
  try {
    const [classResult, charges, payments, communications, announcements, exams, attendance] = await Promise.all([
      classId ? supabase.from("classes").select("id,class_name,short_name").eq("id", classId).eq("school_id", school.id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.schema("finance").from("student_charges").select("id,description,amount,paid_amount,balance,due_date,status,term_number,created_at").eq("school_id", school.id).eq("student_id", student.id).order("created_at", { ascending: false }).limit(100),
      supabase.schema("finance").from("student_payments").select("id,payment_number,payment_date,amount,payment_method,reference_number,description,status").eq("school_id", school.id).eq("student_id", student.id).order("payment_date", { ascending: false }).limit(100),
      supabase.from("parent_result_communications").select("id,channel,subject,message,status,sent_at,created_at").eq("school_id", school.id).eq("student_id", student.id).order("created_at", { ascending: false }).limit(100),
      supabase.from("announcements").select("id,title,content,created_at").eq("school_id", school.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("exams").select("id,exam_name,exam_type,term,start_date,end_date,status").eq("school_id", school.id).order("start_date", { ascending: false }).limit(100),
      supabase.from("class_attendance").select("id,attendance_date,status,remarks").eq("school_id", school.id).eq("student_id", student.id).order("attendance_date", { ascending: false }).limit(60),
    ]);
    for (const result of [charges,payments,communications,announcements,exams,attendance]) if (result.error) throw result.error;
    const chargeRows = charges.data || [];
    const totalCharged = chargeRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const totalPaid = chargeRows.reduce((sum, row) => sum + Number(row.paid_amount || 0), 0);
    const totalBalance = chargeRows.reduce((sum, row) => sum + Number(row.balance || 0), 0);
    const chat = classId ? await supabase.from("parent_portal_chat_messages").select("id,sender_type,sender_name,message,created_at").eq("school_id", school.id).eq("class_id", classId).order("created_at", { ascending: true }).limit(200) : { data: [] };
    if (chat.error) throw chat.error;
    return res.json({
      success: true,
      student: { id: student.id, name: fullName(student), admission_number: student.admission_number || student.admission_no, class_name: classResult.data?.class_name || student.class_name || "-", school_name: school.school_name, academic_year_id: student.academic_year_id, status: student.status || student.student_status },
      finance: { total_charged: totalCharged, total_paid: totalPaid, balance: totalBalance, charges: chargeRows, payments: payments.data || [] },
      communications: communications.data || [], announcements: announcements.data || [], meetings: [],
      exams: exams.data || [], attendance: attendance.data || [], chat: chat.data || [],
      must_change_password: req.parent.account.must_change_password,
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
    const { data: exam, error: examError } = await supabase.from("exams").select("id,exam_name,school_id,status").eq("id", examId).eq("school_id", school.id).maybeSingle();
    if (examError || !exam) return res.status(404).json({ success: false, message: "Examination not found." });
    const [result, marks] = await Promise.all([
      supabase.from("results").select("id,total_marks,average_marks,grade,division,position,remarks,approved").eq("student_id", student.id).eq("exam_id", examId).maybeSingle(),
      supabase.from("student_marks").select("id,subject_id,marks,grade,remarks,status").eq("student_id", student.id).eq("exam_id", examId).order("subject_id"),
    ]);
    if (result.error || marks.error) throw result.error || marks.error;
    if (result.data?.approved !== true) return res.json({ success: true, exam, result: null, marks: [] });
    return res.json({ success: true, exam, result: result.data, marks: marks.data || [] });
  } catch (error) {
    console.error("PARENT RESULTS ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to load examination results." });
  }
});

router.post("/change-password", async (req, res) => {
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
  const suggestion = String(req.body?.suggestion || "").trim();
  const category = String(req.body?.category || "General").trim().slice(0, 80);
  if (suggestion.length < 5 || suggestion.length > 4000) return res.status(400).json({ success: false, message: "Suggestion must contain between 5 and 4000 characters." });
  const { student, school } = req.parent;
  const tagged = "[Parent Portal | " + fullName(student) + " | Admission: " + (student.admission_number || student.admission_no || "") + "]\n" + suggestion;
  const { data, error } = await supabase.from("suggestions").insert({ school_id: school.id, category, suggestion: tagged, status: "Pending" }).select("id,category,status,created_at").single();
  if (error) return res.status(500).json({ success: false, message: "Unable to submit suggestion." });
  return res.json({ success: true, suggestion: data });
});

router.post("/chat", async (req, res) => {
  const message = String(req.body?.message || "").trim();
  const { student, school } = req.parent;
  if (!student.current_class_id) return res.status(400).json({ success: false, message: "Student has no active class for group chat." });
  if (!message || message.length > 4000) return res.status(400).json({ success: false, message: "Message must be between 1 and 4000 characters." });
  const { data, error } = await supabase.from("parent_portal_chat_messages").insert({
    school_id: school.id, class_id: student.current_class_id, student_id: student.id,
    parent_account_id: req.parent.account.id, sender_type: "parent", sender_name: "Mzazi wa " + fullName(student), message,
  }).select("id,sender_type,sender_name,message,created_at").single();
  if (error) return res.status(500).json({ success: false, message: "Unable to send class message." });
  return res.json({ success: true, message: data });
});

router.post("/logout", (_req, res) => res.json({ success: true, message: "Signed out." }));

export default router;
