import express from "express";
import crypto from "node:crypto";
import { promisify } from "node:util";
import { supabase } from "../config/supabase.js";
import { authenticateUser } from "../middleware/authMiddleware.js";

const router = express.Router();
const scrypt = promisify(crypto.scrypt);
const SECRET = process.env.PARENT_PORTAL_JWT_SECRET || process.env.SUPABASE_SERVICE_KEY;
const FRONTEND_URL = String(process.env.FRONTEND_URL || "https://africorepro.vercel.app").replace(/\/$/, "");
const attempts = new Map();

const fullName = (s) => [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" ").trim();
const normalizePhone = (value) => {
  let p = String(value || "").replace(/\D/g, "");
  if (p.startsWith("255")) return "+" + p;
  if (p.startsWith("0")) return "+255" + p.slice(1);
  if (/^[67]/.test(p)) return "+255" + p;
  return null;
};
async function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  return { salt, hash: (await scrypt(String(password), salt, 64)).toString("hex") };
}
async function passwordMatches(password, salt, hash) {
  const actual = await scrypt(String(password), salt, 64);
  const expected = Buffer.from(String(hash || ""), "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
}
function tokenFor(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const unsigned = header + "." + body;
  return unsigned + "." + crypto.createHmac("sha256", SECRET).update(unsigned).digest("base64url");
}
async function sendSupervisorSms(schoolId, phoneValue, username, password, centerName) {
  const phone = normalizePhone(phoneValue);
  if (!phone) throw new Error("Namba ya msimamizi si sahihi.");
  const { data: sms, error } = await supabase.rpc("get_school_sms_credentials", { p_school_id: Number(schoolId) }).maybeSingle();
  if (error || !sms?.api_key || !sms?.secret_key || !sms?.sender_id) throw new Error("NewHope SMS haijawekwa kikamilifu kwa shule hii.");
  if (String(sms.approval_status || "").toLowerCase() !== "approved") throw new Error("Sender ID ya shule bado haijaidhinishwa.");
  const school = await supabase.from("schools").select("school_name").eq("id", schoolId).maybeSingle();
  const message = "AFRICORE SPONSOR PORTAL\nShule: " + (school.data?.school_name || "") +
    "\nKituo: " + centerName + "\nUsername: " + username + "\nPassword ya muda: " + password +
    "\nIngia: " + FRONTEND_URL + "/parent-portal?school=" + encodeURIComponent(schoolId) +
    "\nHifadhi taarifa hizi kwa siri.";
  const response = await fetch("https://sms.newhope.co.tz/v1/sms/send/", {
    method: "POST",
    headers: { Authorization: "ApiKey " + sms.api_key + ":" + sms.secret_key, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ recipient: phone, message, sender_id: "NewHope" }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || String(result?.status || "").toLowerCase().includes("fail")) {
    throw new Error(result?.message || result?.detail || result?.error || "NewHope imeshindwa kutuma SMS.");
  }
  return { status: result?.status || "sent", provider_message_id: result?.id || result?.message_id || null };
}
function staffScope(req, res, next) {
  const roleNames = (req.access?.roles || []).map((role) => String(role.role_name || "").trim().toLowerCase());
  const canManageSponsors = req.access?.isSuperAdmin === true || roleNames.some((name) =>
    ["super admin", "headmaster", "deputy headmaster", "academic master", "accountant"].includes(name)
  );
  if (!canManageSponsors) return res.status(403).json({ success: false, message: "Huna ruhusa ya kusimamia Sponsor Centres." });
  const schoolId = Number(req.profile?.school_id);
  if (!Number.isInteger(schoolId) || schoolId <= 0) return res.status(403).json({ success: false, message: "Akaunti haina shule iliyochaguliwa." });
  req.sponsorSchoolId = schoolId;
  next();
}

router.use("/management", authenticateUser, staffScope);

router.get("/management/students", async (req, res) => {
  try {
    const { data, error } = await supabase.from("students")
      .select("id,first_name,middle_name,last_name,admission_number,admission_no,current_class_id")
      .eq("school_id", req.sponsorSchoolId).order("first_name").limit(5000);
    if (error) throw error;
    const classIds = [...new Set((data || []).map(s => s.current_class_id).filter(Boolean))];
    const classes = classIds.length ? await supabase.from("classes").select("id,class_name").eq("school_id", req.sponsorSchoolId).in("id", classIds) : { data: [] };
    const classMap = new Map((classes.data || []).map(c => [String(c.id), c.class_name]));
    return res.json({ success: true, students: (data || []).map(s => ({ id: s.id, name: fullName(s), admission_number: s.admission_number || s.admission_no, class_name: classMap.get(String(s.current_class_id)) || "—" })) });
  } catch (e) { return res.status(500).json({ success: false, message: e.message || "Imeshindikana kupakia wanafunzi." }); }
});

router.get("/management/centers", async (req, res) => {
  try {
    const { data: centers, error } = await supabase.from("sponsor_centers")
      .select("id,sponsor_id,center_name,supervisor_name,supervisor_phone,supervisor_email,is_active,created_at")
      .eq("school_id", req.sponsorSchoolId).order("center_name");
    if (error) throw error;
    const ids = (centers || []).map(c => c.id);
    const [sponsors, assignments, accounts] = await Promise.all([
      supabase.from("sponsor_organizations").select("id,sponsor_name,sponsor_phone").eq("school_id", req.sponsorSchoolId),
      ids.length ? supabase.from("sponsor_center_students").select("center_id,student_id").eq("school_id", req.sponsorSchoolId).in("center_id", ids) : Promise.resolve({ data: [] }),
      ids.length ? supabase.from("sponsor_portal_accounts").select("center_id,username,is_active,last_login_at").eq("school_id", req.sponsorSchoolId).in("center_id", ids) : Promise.resolve({ data: [] }),
    ]);
    for (const r of [sponsors, assignments, accounts]) if (r.error) throw r.error;
    const assignedRows = assignments.data || [];
    const studentIds = [...new Set(assignedRows.map(a => Number(a.student_id)).filter(Number.isInteger))];
    const [students, classes] = await Promise.all([
      studentIds.length ? supabase.from("students").select("id,first_name,middle_name,last_name,admission_number,admission_no,current_class_id").eq("school_id", req.sponsorSchoolId).in("id", studentIds) : Promise.resolve({ data: [] }),
      Promise.resolve(null),
    ]);
    if (students.error) throw students.error;
    const classIds = [...new Set((students.data || []).map(s => s.current_class_id).filter(Boolean))];
    const classResult = classIds.length ? await supabase.from("classes").select("id,class_name").eq("school_id", req.sponsorSchoolId).in("id", classIds) : { data: [] };
    if (classResult.error) throw classResult.error;
    const classMap = new Map((classResult.data || []).map(row => [String(row.id), row.class_name]));
    const studentMap = new Map((students.data || []).map(s => [Number(s.id), {
      id: s.id, name: fullName(s), admission_number: s.admission_number || s.admission_no || "—",
      class_name: classMap.get(String(s.current_class_id)) || "—",
    }]));
    const sponsorMap = new Map((sponsors.data || []).map(s => [s.id, s]));
    const accountMap = new Map((accounts.data || []).map(a => [a.center_id, a]));
    const assignmentMap = new Map();
    for (const row of assignedRows) {
      if (!assignmentMap.has(row.center_id)) assignmentMap.set(row.center_id, []);
      const student = studentMap.get(Number(row.student_id));
      if (student) assignmentMap.get(row.center_id).push(student);
    }
    return res.json({ success: true, centers: (centers || []).map(center => {
      const assignedStudents = (assignmentMap.get(center.id) || []).sort((a,b) => a.name.localeCompare(b.name));
      return { ...center, sponsor: sponsorMap.get(center.sponsor_id) || null, student_count: assignedStudents.length,
        students: assignedStudents, account: accountMap.get(center.id) || null };
    }) });
  } catch (e) { return res.status(500).json({ success: false, message: e.message || "Imeshindikana kupakia vituo." }); }
});
router.post("/management/centers", async (req, res) => {
  const schoolId = req.sponsorSchoolId;
  const sponsorName = String(req.body?.sponsor_name || "").trim();
  const sponsorPhone = String(req.body?.sponsor_phone || "").trim();
  const centerName = String(req.body?.center_name || "").trim();
  const supervisorName = String(req.body?.supervisor_name || "").trim();
  const supervisorPhone = String(req.body?.supervisor_phone || "").trim();
  const email = String(req.body?.supervisor_email || "").trim().toLowerCase();
  const studentIds = [...new Set((Array.isArray(req.body?.student_ids) ? req.body.student_ids : []).map(Number).filter(n => Number.isInteger(n) && n > 0))];
  if (!sponsorName || !sponsorPhone || !centerName || !supervisorName || !normalizePhone(supervisorPhone) || !/^\S+@\S+\.\S+$/.test(email) || !studentIds.length) {
    return res.status(400).json({ success: false, message: "Jaza taarifa zote za Sponsor, kituo, msimamizi, email, simu na uchague angalau mwanafunzi mmoja." });
  }
  try {
    const valid = await supabase.from("students").select("id").eq("school_id", schoolId).in("id", studentIds);
    if (valid.error) throw valid.error;
    if ((valid.data || []).length !== studentIds.length) return res.status(400).json({ success: false, message: "Baadhi ya wanafunzi hawapo kwenye shule hii." });
    let sponsor = await supabase.from("sponsor_organizations").select("id").eq("school_id", schoolId).eq("sponsor_name", sponsorName).maybeSingle();
    if (sponsor.error) throw sponsor.error;
    let sponsorId = sponsor.data?.id;
    if (!sponsorId) {
      const createdSponsor = await supabase.from("sponsor_organizations").insert({ school_id: schoolId, sponsor_name: sponsorName, sponsor_phone: normalizePhone(sponsorPhone) }).select("id").single();
      if (createdSponsor.error) throw createdSponsor.error;
      sponsorId = createdSponsor.data.id;
    } else {
      const changed = await supabase.from("sponsor_organizations").update({ sponsor_phone: normalizePhone(sponsorPhone), updated_at: new Date().toISOString() }).eq("id", sponsorId).eq("school_id", schoolId);
      if (changed.error) throw changed.error;
    }
    const created = await supabase.from("sponsor_centers").insert({ school_id: schoolId, sponsor_id: sponsorId, center_name: centerName, supervisor_name: supervisorName, supervisor_phone: normalizePhone(supervisorPhone), supervisor_email: email }).select("id").single();
    if (created.error) throw created.error;
    const assigned = await supabase.from("sponsor_center_students").insert(studentIds.map(student_id => ({ school_id: schoolId, center_id: created.data.id, student_id, assigned_by: req.user.id })));
    if (assigned.error) throw assigned.error;
    const temporaryPassword = "AfriCore@" + crypto.randomInt(100000, 1000000) + "!";
    const password = await hashPassword(temporaryPassword);
    const account = await supabase.from("sponsor_portal_accounts").insert({ school_id: schoolId, center_id: created.data.id, username: email, password_hash: password.hash, password_salt: password.salt }).select("id,username").single();
    if (account.error) throw account.error;
    let sms;
    try { sms = await sendSupervisorSms(schoolId, supervisorPhone, email, temporaryPassword, centerName); }
    catch (smsError) { sms = { status: "failed", error: smsError.message }; }
    return res.status(201).json({ success: true, center_id: created.data.id, username: email, temporary_password: temporaryPassword, sms, message: sms.status === "failed" ? "Kituo na akaunti vimeundwa lakini SMS haikutumwa. Tumia View → Resend Credentials." : "Kituo kimeundwa na credentials zimetumwa kwa SMS." });
  } catch (e) {
    console.error("SPONSOR CENTER CREATE ERROR:", e);
    return res.status(500).json({ success: false, message: e.message || "Imeshindikana kuunda kituo." });
  }
});

router.patch("/management/centers/:centerId", async (req, res) => {
  const schoolId = req.sponsorSchoolId;
  const centerId = String(req.params.centerId || "");
  const sponsorName = String(req.body?.sponsor_name || "").trim();
  const sponsorPhone = normalizePhone(req.body?.sponsor_phone);
  const centerName = String(req.body?.center_name || "").trim();
  const supervisorName = String(req.body?.supervisor_name || "").trim();
  const supervisorPhoneRaw = String(req.body?.supervisor_phone || "").trim();
  const supervisorPhone = normalizePhone(supervisorPhoneRaw);
  const email = String(req.body?.supervisor_email || "").trim().toLowerCase();
  const studentIds = [...new Set((Array.isArray(req.body?.student_ids) ? req.body.student_ids : []).map(Number).filter(n => Number.isInteger(n) && n > 0))];
  if (!centerId || !sponsorName || !sponsorPhone || !centerName || !supervisorName || !supervisorPhone || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ success: false, message: "Jaza jina na simu ya Sponsor, jina la kituo, jina/simu/email ya Manager kwa usahihi." });
  }
  try {
    const { data: center, error: centerError } = await supabase.from("sponsor_centers")
      .select("id,sponsor_id,center_name,supervisor_name,supervisor_phone,supervisor_email")
      .eq("id", centerId).eq("school_id", schoolId).maybeSingle();
    if (centerError) throw centerError;
    if (!center) return res.status(404).json({ success: false, message: "Kituo hakipo kwenye shule hii." });

    const [accountResult, validStudents, duplicateCenter, duplicateAccount] = await Promise.all([
      supabase.from("sponsor_portal_accounts").select("id,username").eq("school_id", schoolId).eq("center_id", centerId).maybeSingle(),
      studentIds.length ? supabase.from("students").select("id").eq("school_id", schoolId).in("id", studentIds) : Promise.resolve({ data: [] }),
      supabase.from("sponsor_centers").select("id").eq("school_id", schoolId).eq("supervisor_email", email).neq("id", centerId).maybeSingle(),
      supabase.from("sponsor_portal_accounts").select("id").eq("school_id", schoolId).eq("username", email).neq("center_id", centerId).maybeSingle(),
    ]);
    for (const result of [accountResult, validStudents, duplicateCenter, duplicateAccount]) if (result.error) throw result.error;
    if (!accountResult.data) return res.status(409).json({ success: false, message: "Akaunti ya Sponsor Manager haipo kwa kituo hiki." });
    if ((validStudents.data || []).length !== studentIds.length) return res.status(400).json({ success: false, message: "Baadhi ya wanafunzi hawapo kwenye shule hii." });
    if (duplicateCenter.data || duplicateAccount.data) return res.status(409).json({ success: false, message: "Email hii tayari inatumika na Sponsor Manager mwingine kwenye shule hii." });

    const managerChanged =
      supervisorName !== center.supervisor_name ||
      supervisorPhone !== center.supervisor_phone ||
      email !== String(center.supervisor_email || "").toLowerCase();
    let temporaryPassword = null;
    let sms = null;
    if (managerChanged) temporaryPassword = "AfriCore@" + crypto.randomInt(100000, 1000000) + "!";
    const sponsorUpdate = await supabase.from("sponsor_organizations")
      .update({ sponsor_name: sponsorName, sponsor_phone: sponsorPhone, updated_at: new Date().toISOString() })
      .eq("id", center.sponsor_id).eq("school_id", schoolId);
    if (sponsorUpdate.error) throw sponsorUpdate.error;

    const centerUpdate = await supabase.from("sponsor_centers").update({
      center_name: centerName, supervisor_name: supervisorName, supervisor_phone: supervisorPhone,
      supervisor_email: email, updated_at: new Date().toISOString(),
    }).eq("id", centerId).eq("school_id", schoolId);
    if (centerUpdate.error) throw centerUpdate.error;

    if (managerChanged) {
      const hashed = await hashPassword(temporaryPassword);
      const accountUpdate = await supabase.from("sponsor_portal_accounts").update({
        username: email, password_hash: hashed.hash, password_salt: hashed.salt, updated_at: new Date().toISOString(),
      }).eq("id", accountResult.data.id).eq("school_id", schoolId);
      if (accountUpdate.error) throw accountUpdate.error;
      try {
        sms = await sendSupervisorSms(schoolId, supervisorPhoneRaw, email, temporaryPassword, centerName);
      } catch (smsError) {
        sms = { status: "failed", error: smsError.message };
      }
    }

    const existingResult = await supabase.from("sponsor_center_students").select("student_id")
      .eq("school_id", schoolId).eq("center_id", centerId);
    if (existingResult.error) throw existingResult.error;
    const existingIds = new Set((existingResult.data || []).map(row => Number(row.student_id)));
    const nextIds = new Set(studentIds);
    const toAdd = studentIds.filter(id => !existingIds.has(id));
    const toRemove = [...existingIds].filter(id => !nextIds.has(id));
    if (toAdd.length) {
      const inserted = await supabase.from("sponsor_center_students").insert(toAdd.map(student_id => ({
        school_id: schoolId, center_id: centerId, student_id, assigned_by: req.user.id,
      })));
      if (inserted.error) throw inserted.error;
    }
    if (toRemove.length) {
      const removed = await supabase.from("sponsor_center_students").delete()
        .eq("school_id", schoolId).eq("center_id", centerId).in("student_id", toRemove);
      if (removed.error) throw removed.error;
    }
    return res.json({
      success: true, manager_credentials_reset: managerChanged,
      username: managerChanged ? email : null, temporary_password: temporaryPassword, sms,
      message: managerChanged
        ? (sms?.status === "failed" ? "Taarifa zimehifadhiwa na credentials mpya zimetengenezwa, lakini SMS haikutumwa. Nakili password mpya au tumia Resend Credentials." : "Taarifa zimehifadhiwa. Kwa sababu taarifa za Manager zimebadilika, credentials mpya zimetengenezwa na kutumwa kwa SMS.")
        : "Mabadiliko yamehifadhiwa. Credentials za Sponsor Manager hazijabadilishwa.",
    });
  } catch (e) {
    console.error("SPONSOR CENTER UPDATE ERROR:", e);
    return res.status(500).json({ success: false, message: e.message || "Imeshindikana kusasisha Sponsor Centre." });
  }
});

router.post("/management/centers/:centerId/resend", async (req, res) => {
  try {
    const center = await supabase.from("sponsor_centers").select("id,center_name,supervisor_phone,supervisor_email").eq("id", req.params.centerId).eq("school_id", req.sponsorSchoolId).maybeSingle();
    if (center.error) throw center.error;
    if (!center.data) return res.status(404).json({ success: false, message: "Kituo hakipo kwenye shule hii." });
    const temporaryPassword = "AfriCore@" + crypto.randomInt(100000, 1000000) + "!";
    const hashed = await hashPassword(temporaryPassword);
    const saved = await supabase.from("sponsor_portal_accounts").update({ password_hash: hashed.hash, password_salt: hashed.salt, updated_at: new Date().toISOString() }).eq("school_id", req.sponsorSchoolId).eq("center_id", center.data.id);
    if (saved.error) throw saved.error;
    const sms = await sendSupervisorSms(req.sponsorSchoolId, center.data.supervisor_phone, center.data.supervisor_email, temporaryPassword, center.data.center_name);
    return res.json({ success: true, sms, message: "Password mpya imetumwa kwa msimamizi." });
  } catch (e) { return res.status(500).json({ success: false, message: e.message || "Imeshindikana kutuma credentials." }); }
});

router.post("/login", async (req, res) => {
  const schoolId = Number(req.body?.school_id);
  const username = String(req.body?.username || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!Number.isInteger(schoolId) || !username || !password) return res.status(400).json({ success: false, message: "Chagua shule na weka email pamoja na password." });
  const key = String(req.ip || "") + ":" + schoolId + ":" + username;
  const prior = attempts.get(key);
  if (prior?.until > Date.now()) return res.status(429).json({ success: false, message: "Umejaribu mara nyingi. Subiri dakika 15." });
  try {
    const school = await supabase.from("schools").select("id,is_active").eq("id", schoolId).maybeSingle();
    if (school.error || !school.data || school.data.is_active !== true) return res.status(403).json({ success: false, message: "Shule haipo au haijawezeshwa." });
    const result = await supabase.from("sponsor_portal_accounts").select("id,school_id,center_id,username,password_hash,password_salt,is_active").eq("school_id", schoolId).eq("username", username).eq("is_active", true).limit(2);
    if (result.error) throw result.error;
    let account = null;
    for (const candidate of result.data || []) if (await passwordMatches(password, candidate.password_salt, candidate.password_hash)) { account = candidate; break; }
    if (!account) {
      const count = (prior?.count || 0) + 1;
      attempts.set(key, { count, until: count >= 10 ? Date.now() + 15 * 60 * 1000 : 0 });
      return res.status(401).json({ success: false, message: "Email au password si sahihi." });
    }
    attempts.delete(key);
    const center = await supabase.from("sponsor_centers").select("id,school_id,center_name,is_active").eq("id", account.center_id).eq("school_id", schoolId).maybeSingle();
    if (center.error || !center.data || !center.data.is_active) return res.status(403).json({ success: false, message: "Kituo hakitumiki kwa sasa." });
    const assigned = await supabase.from("sponsor_center_students").select("student_id").eq("school_id", schoolId).eq("center_id", center.data.id);
    if (assigned.error) throw assigned.error;
    const studentIds = (assigned.data || []).map(a => a.student_id);
    if (!studentIds.length) return res.status(403).json({ success: false, message: "Hakuna wanafunzi waliopangiwa kituo hiki." });
    const students = await supabase.from("students").select("id,first_name,middle_name,last_name,admission_number,admission_no,current_class_id").eq("school_id", schoolId).in("id", studentIds).order("first_name");
    if (students.error) throw students.error;
    const classIds = [...new Set((students.data || []).map(s => s.current_class_id).filter(Boolean))];
    const classes = classIds.length ? await supabase.from("classes").select("id,class_name").eq("school_id", schoolId).in("id", classIds) : { data: [] };
    const classMap = new Map((classes.data || []).map(c => [String(c.id), c.class_name]));
    await supabase.from("sponsor_portal_accounts").update({ last_login_at: new Date().toISOString() }).eq("id", account.id).eq("school_id", schoolId);
    const token = tokenFor({ sponsor_account_id: account.id, sponsor_center_id: center.data.id, school_id: schoolId, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12 });
    return res.json({ success: true, token, center: { id: center.data.id, name: center.data.center_name }, students: (students.data || []).map(s => ({ id: s.id, name: fullName(s), admission_number: s.admission_number || s.admission_no, class_name: classMap.get(String(s.current_class_id)) || "—" })) });
  } catch (e) {
    console.error("SPONSOR LOGIN ERROR:", e);
    return res.status(500).json({ success: false, message: "Imeshindikana kuingia Sponsor Portal." });
  }
});

router.post("/select-student", async (req, res) => {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const parts = token.split(".");
  if (parts.length !== 3 || !SECRET) return res.status(401).json({ success: false, message: "Sponsor session haipo." });
  let claims;
  try {
    const expected = crypto.createHmac("sha256", SECRET).update(parts[0] + "." + parts[1]).digest();
    const signature = Buffer.from(parts[2], "base64url");
    if (signature.length !== expected.length || !crypto.timingSafeEqual(signature, expected)) throw new Error("signature");
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch { return res.status(401).json({ success: false, message: "Sponsor session si sahihi." }); }
  if (!claims?.sponsor_account_id || claims.exp <= Math.floor(Date.now() / 1000)) return res.status(401).json({ success: false, message: "Sponsor session imeisha." });
  const account = await supabase.from("sponsor_portal_accounts").select("id,school_id,center_id,is_active").eq("id", claims.sponsor_account_id).eq("school_id", claims.school_id).eq("center_id", claims.sponsor_center_id).eq("is_active", true).maybeSingle();
  if (account.error || !account.data) return res.status(401).json({ success: false, message: "Sponsor account haipo." });
  const studentId = Number(req.body?.student_id);
  const assignment = await supabase.from("sponsor_center_students").select("student_id").eq("school_id", claims.school_id).eq("center_id", claims.sponsor_center_id).eq("student_id", studentId).maybeSingle();
  if (assignment.error || !assignment.data) return res.status(403).json({ success: false, message: "Mwanafunzi huyu hajapangiwa kituo chako." });
  const student = await supabase.from("students").select("id,school_id,first_name,middle_name,last_name,admission_number,admission_no,current_class_id").eq("id", studentId).eq("school_id", claims.school_id).maybeSingle();
  if (student.error || !student.data) return res.status(404).json({ success: false, message: "Mwanafunzi hayupo." });
  const school = await supabase.from("schools").select("id,school_name,is_active").eq("id", claims.school_id).maybeSingle();
  if (school.error || !school.data || school.data.is_active !== true) return res.status(403).json({ success: false, message: "Shule haijawezeshwa." });
  const parentToken = tokenFor({ sponsor_account_id: claims.sponsor_account_id, sponsor_center_id: claims.sponsor_center_id, sponsor_student_id: studentId, student_id: studentId, school_id: Number(claims.school_id), exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12 });
  return res.json({ success: true, token: parentToken, student: { id: studentId, name: fullName(student.data), school_name: school.data.school_name, admission_number: student.data.admission_number || student.data.admission_no } });
});

export default router;
