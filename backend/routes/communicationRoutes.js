import "dotenv/config";
import express from "express";
import twilio from "twilio";
import nodemailer from "nodemailer";
import { supabase } from "../config/supabase.js";
import { authenticateUser } from "../middleware/authMiddleware.js";

const router = express.Router();

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_FROM,
  GMAIL_USER,
  GMAIL_APP_PASSWORD,
  GMAIL_FROM_EMAIL,
} = process.env;

const twilioClient =
  TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN
    ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    : null;

const emailTransporter =
  GMAIL_USER && GMAIL_APP_PASSWORD
    ? nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: GMAIL_USER,
          pass: GMAIL_APP_PASSWORD,
        },
      })
    : null;

// SMS credentials are managed per school in Supabase Vault and sent through NewHope.
const SMS_ENABLED = true;
const WHATSAPP_ENABLED = true;
const EMAIL_ENABLED = true;

/* =========================================================
   HELPERS
========================================================= */

function normalizeTanzaniaPhone(value) {
  if (!value) return "";

  let phone = String(value).trim();

  phone = phone.replace(/[^0-9]/g, "");

  if (phone.startsWith("255")) {
    return phone;
  }

  if (phone.startsWith("0")) {
    return `255${phone.substring(1)}`;
  }

  if (phone.startsWith("7") || phone.startsWith("6")) {
    return `255${phone}`;
  }

  return phone;
}

function normalizeWhatsAppNumber(value) {
  const phone = normalizeTanzaniaPhone(value);

  if (!phone) return "";

  return `whatsapp:+${phone}`;
}

function normalizeWhatsAppFrom(value) {
  if (!value) return "";

  const cleaned = String(value).trim();

  if (cleaned.startsWith("whatsapp:")) {
    return cleaned;
  }

  if (cleaned.startsWith("+")) {
    return `whatsapp:${cleaned}`;
  }

  const phone = normalizeTanzaniaPhone(cleaned);

  if (!phone) return "";

  return `whatsapp:+${phone}`;
}

function isValidEmail(value) {
  if (!value) return false;

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(value).trim()
  );
}

async function sendWhatsAppProviderMessage(recipient, message) {
  const whatsappTo = normalizeTanzaniaPhone(recipient);

  if (!whatsappTo || whatsappTo.length < 10) {
    throw new Error("Enter a valid WhatsApp number with country code or a local number.");
  }

  // Prefer Meta Cloud API; use Twilio only when Meta is not configured.
  const metaToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
  const metaPhoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const metaApiVersion = process.env.META_WHATSAPP_API_VERSION || "v23.0";

  if (metaToken && metaPhoneNumberId) {
    const response = await fetch(
      `https://graph.facebook.com/${metaApiVersion}/${metaPhoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${metaToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: whatsappTo,
          type: "text",
          text: { preview_url: false, body: message },
        }),
      }
    );

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        result?.error?.message ||
        result?.message ||
        `Meta WhatsApp API returned HTTP ${response.status}.`
      );
    }

    return {
      provider: "Meta WhatsApp Cloud API",
      status: "queued",
      providerMessageId: result?.messages?.[0]?.id || null,
      providerStatus: null,
    };
  }

  if (twilioClient && TWILIO_WHATSAPP_FROM) {
    const twilioMessage = await twilioClient.messages.create({
      body: message,
      from: normalizeWhatsAppFrom(TWILIO_WHATSAPP_FROM),
      to: `whatsapp:+${whatsappTo}`,
    });

    return {
      provider: "Twilio",
      status: normalizeProviderStatus(twilioMessage?.status),
      providerMessageId: twilioMessage?.sid || null,
      providerStatus: twilioMessage?.status || null,
    };
  }

  throw new Error(
    "WhatsApp is not configured. Set META_WHATSAPP_ACCESS_TOKEN and META_WHATSAPP_PHONE_NUMBER_ID in the backend environment."
  );
}

function cleanMessage(value) {
  return String(value || "").trim();
}

function cleanSubject(value) {
  return String(value || "").trim();
}

function getProviderError(error) {
  if (!error) {
    return "Unknown provider error";
  }

  if (typeof error === "string") {
    return error;
  }

  if (error.message) {
    return error.message;
  }

  if (error.error?.message) {
    return error.error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown provider error";
  }
}

function normalizeProviderStatus(status) {
  const value = String(status || "")
    .trim()
    .toLowerCase();

  if (
    value.includes("deliver") ||
    value === "delivered"
  ) {
    return "delivered";
  }

  if (
    value.includes("sent") ||
    value === "success" ||
    value === "successful"
  ) {
    return "sent";
  }

  if (
    value.includes("queue") ||
    value === "accepted" ||
    value === "processing" ||
    value === "pending"
  ) {
    return "queued";
  }

  if (
    value.includes("fail") ||
    value.includes("error") ||
    value === "rejected"
  ) {
    return "failed";
  }

  return "queued";
}

/* =========================================================
   NEWHOPE SMS
========================================================= */

async function getSchoolNewHopeCredentials(schoolId) {
  const { data, error } = await supabase
    .rpc("get_school_sms_credentials", { p_school_id: Number(schoolId) })
    .maybeSingle();

  if (error) {
    throw new Error("Unable to retrieve this school's NewHope SMS configuration.");
  }
  if (!data?.api_key || !data?.secret_key || !data?.sender_id) {
    throw new Error("SMS haijatumwa: shule hii haijaweka NewHope Sender ID na API credentials zake.");
  }
  if (String(data.approval_status || "").toLowerCase() !== "approved") {
    throw new Error("SMS haijatumwa: Sender ID ya shule hii bado haijaidhinishwa.");
  }
  return data;
}

async function sendNewHopeSmsWithCredentials(credentials, recipient, message) {
  const normalized = normalizeTanzaniaPhone(recipient);
  if (!normalized || normalized.length < 10) {
    throw new Error("Namba ya simu si sahihi.");
  }

  const response = await fetch("https://sms.newhope.co.tz/v1/sms/send/", {
    method: "POST",
    headers: {
      Authorization: `ApiKey ${credentials.api_key}:${credentials.secret_key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      recipient: `+${normalized}`,
      message,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof data?.message === "string"
      ? data.message
      : typeof data?.detail === "string"
        ? data.detail
        : typeof data?.error === "string"
          ? data.error
          : JSON.stringify(data);
    throw new Error(detail || `NewHope SMS HTTP ${response.status}`);
  }

  const providerStatus = normalizeProviderStatus(data?.status || "sent");
  return {
    provider: "NewHope SMS",
    provider_message_id: data?.id || data?.message_id || data?.messageId || null,
    status: providerStatus,
    segments: data?.segments ?? null,
    cost: data?.cost ?? null,
  };
}

async function sendNewHopeSms(schoolId, recipient, message) {
  const credentials = await getSchoolNewHopeCredentials(schoolId);
  return sendNewHopeSmsWithCredentials(credentials, recipient, message);
}

/* =========================================================
   DATABASE HISTORY
========================================================= */

async function createCommunicationHistory({
  school_id,
  student_id,
  exam_id,
  parent_name,
  recipient,
  channel,
  subject,
  message,
}) {
  const payload = {
    school_id: school_id || null,
    student_id,
    exam_id,
    parent_name: parent_name || null,
    recipient,
    channel,
    subject: subject || null,
    message,
    status: "pending",
  };

  const { data, error } = await supabase
    .from("parent_result_communications")
    .insert(payload)
    .select(
      "id,school_id,student_id,exam_id,parent_name,recipient,channel,subject,message,status,provider_message_id,error_message,sent_at,created_at"
    )
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function updateCommunicationHistory(
  historyId,
  updates
) {
  if (!historyId) return;

  const { error } = await supabase
    .from("parent_result_communications")
    .update(updates)
    .eq("id", historyId);

  if (error) {
    console.error(
      "Communication history update error:",
      error
    );
  }
}

/* =========================================================
   GET PROVIDER STATUS
========================================================= */

router.get("/", async (req, res) => {
  return res.json({
    success: true,
    module: "Communication",
    providers: {
      sms: {
        provider: "NewHope",
        configured: null,
        enabled: SMS_ENABLED,
        message: "NewHope credentials and approved Sender ID are configured separately for each school.",
      },

      whatsapp: {
        provider: "Twilio",
        configured: Boolean(
          twilioClient && TWILIO_WHATSAPP_FROM
        ),
        enabled: WHATSAPP_ENABLED,
      },

      email: {
        provider: "Gmail SMTP",
        configured: Boolean(
          emailTransporter && GMAIL_USER && GMAIL_APP_PASSWORD
        ),
        enabled: EMAIL_ENABLED,
      },
    },
  });
});

/* =========================================================
   SEND PARENT RESULT COMMUNICATION
========================================================= */

router.post("/parent-result", authenticateUser, async (req, res) => {
  const {
    school_id,
    student_id,
    exam_id,
    parent_name,
    recipient,
    channel,
    subject,
    message,
  } = req.body || {};

  const normalizedChannel = String(channel || "")
    .trim()
    .toLowerCase();

  const cleanRecipient = String(recipient || "").trim();
  const cleanMsg = cleanMessage(message);
  const cleanSub = cleanSubject(subject);
  const authenticatedSchoolId = Number(req.profile?.school_id);

  if (!Number.isInteger(authenticatedSchoolId) || authenticatedSchoolId <= 0) {
    return res.status(403).json({
      success: false,
      message: "Your account is not assigned to an active school.",
    });
  }
  if (school_id && String(school_id) !== String(authenticatedSchoolId)) {
    return res.status(403).json({
      success: false,
      message: "You cannot send a result communication outside your assigned school.",
    });
  }

  /* =======================================================
     BASIC VALIDATION
  ======================================================= */

  if (!student_id) {
    return res.status(400).json({
      success: false,
      message: "student_id is required.",
    });
  }

  if (!exam_id) {
    return res.status(400).json({
      success: false,
      message: "exam_id is required.",
    });
  }

  if (!cleanRecipient) {
    return res.status(400).json({
      success: false,
      message: "Recipient is required.",
    });
  }

  if (!cleanMsg) {
    return res.status(400).json({
      success: false,
      message: "Message is required.",
    });
  }

  if (
    !["sms", "whatsapp", "email"].includes(
      normalizedChannel
    )
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Invalid communication channel. Use sms, whatsapp or email.",
    });
  }

  /* =======================================================
     USE THE PARENT/GUARDIAN CONTACT SAVED IN STUDENT REGISTRATION
     Never send to a recipient typed or supplied by the client.
  ======================================================= */

  let registeredStudent;

  try {
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, school_id, parent_name, parent_phone, parent_email")
      .eq("id", student_id)
      .maybeSingle();

    if (studentError) {
      console.error("Student recipient lookup failed:", studentError);
      return res.status(500).json({
        success: false,
        message: "Could not verify the student's registered parent/guardian contact.",
      });
    }

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student was not found. Check the Student ID.",
      });
    }

    if (
      String(student.school_id) !== String(authenticatedSchoolId)
    ) {
      return res.status(403).json({
        success: false,
        message: "Student does not belong to the selected school.",
      });
    }

    registeredStudent = student;
  } catch (lookupError) {
    console.error("Student recipient lookup exception:", lookupError);
    return res.status(500).json({
      success: false,
      message: "Could not verify the student's registered parent/guardian contact.",
    });
  }

  const registeredRecipient =
    normalizedChannel === "email"
      ? String(registeredStudent.parent_email || "").trim()
      : String(registeredStudent.parent_phone || "").trim();

  if (!registeredRecipient) {
    return res.status(400).json({
      success: false,
      channel: normalizedChannel,
      message:
        normalizedChannel === "email"
          ? "This student has no parent/guardian email in Student Registration. Update the student's details first."
          : "This student has no parent/guardian phone number in Student Registration. Update the student's details first.",
      code: "REGISTERED_PARENT_CONTACT_MISSING",
    });
  }

  const verifiedRecipient = registeredRecipient;
  const verifiedParentName =
    String(registeredStudent.parent_name || "").trim() ||
    String(parent_name || "").trim() ||
    "Parent/Guardian";
  const verifiedSchoolId = registeredStudent.school_id;

  const { data: verifiedExam, error: verifiedExamError } = await supabase
    .from("exams")
    .select("id, school_id")
    .eq("id", exam_id)
    .maybeSingle();

  if (verifiedExamError || !verifiedExam) {
    return res.status(404).json({
      success: false,
      message: "Examination was not found.",
    });
  }
  if (String(verifiedExam.school_id) !== String(authenticatedSchoolId)) {
    return res.status(403).json({
      success: false,
      message: "Examination does not belong to your assigned school.",
    });
  }

  /* =======================================================
     CREATE HISTORY RECORD FIRST
  ======================================================= */

  let history = null;

  try {
    history = await createCommunicationHistory({
      school_id: verifiedSchoolId,
      student_id,
      exam_id,
      parent_name: verifiedParentName,
      recipient: verifiedRecipient,
      channel: normalizedChannel,
      subject: cleanSub,
      message: cleanMsg,
    });
  } catch (historyError) {
    console.error(
      "Failed to create communication history:",
      historyError
    );

    return res.status(500).json({
      success: false,
      message:
        "Communication history could not be created. Message was not sent.",
      error: getProviderError(historyError),
    });
  }

  /* =======================================================
     SMS - NEWHOPE (SCHOOL-SPECIFIC CREDENTIALS)
  ======================================================= */

  if (normalizedChannel === "sms") {
    try {
      const delivery = await sendNewHopeSms(
        verifiedSchoolId,
        verifiedRecipient,
        cleanMsg
      );

      await updateCommunicationHistory(history.id, {
        status: delivery.status,
        provider_message_id: delivery.provider_message_id
          ? String(delivery.provider_message_id)
          : null,
        error_message: delivery.status === "failed" ? "NewHope reported a failed delivery." : null,
        sent_at: delivery.status === "failed" ? null : new Date().toISOString(),
      });

      if (delivery.status === "failed") {
        return res.status(502).json({
          success: false,
          message: "NewHope imekataa kutuma SMS.",
          history_id: history.id,
          provider: delivery.provider,
          provider_status: delivery.status,
          provider_message_id: delivery.provider_message_id,
          segments: delivery.segments,
          cost: delivery.cost,
        });
      }

      return res.json({
        success: true,
        message: "SMS imepokelewa na NewHope kwa ajili ya kutumwa.",
        history_id: history.id,
        channel: "sms",
        provider: delivery.provider,
        provider_status: delivery.status,
        provider_message_id: delivery.provider_message_id,
        segments: delivery.segments,
        cost: delivery.cost,
      });
    } catch (error) {
      const errorMessage = getProviderError(error);
      await updateCommunicationHistory(history.id, {
        status: "failed",
        error_message: errorMessage,
      });

      return res.status(502).json({
        success: false,
        message: "Imeshindikana kutuma SMS kupitia NewHope.",
        history_id: history.id,
        provider: "NewHope SMS",
        provider_status: "failed",
        error: errorMessage,
      });
    }
  }

  /* =======================================================
     WHATSAPP - META CLOUD API, WITH TWILIO FALLBACK
  ======================================================= */

  if (normalizedChannel === "whatsapp") {
    try {
      const delivery = await sendWhatsAppProviderMessage(
        verifiedRecipient,
        cleanMsg
      );

      await updateCommunicationHistory(history.id, {
        status: delivery.status,
        provider_message_id: delivery.providerMessageId,
        error_message: null,
        sent_at:
          delivery.status === "sent" || delivery.status === "delivered"
            ? new Date().toISOString()
            : null,
      });

      return res.json({
        success: true,
        message: `WhatsApp message accepted by ${delivery.provider}.`,
        history_id: history.id,
        channel: "whatsapp",
        status: delivery.status,
        provider: delivery.provider,
        provider_message_id: delivery.providerMessageId,
        provider_status: delivery.providerStatus,
      });
    } catch (error) {
      const errorMessage = getProviderError(error);

      await updateCommunicationHistory(history.id, {
        status: "failed",
        error_message: errorMessage,
      });

      return res.status(502).json({
        success: false,
        message: "Failed to send WhatsApp message.",
        history_id: history.id,
        error: errorMessage,
      });
    }
  }

  /* =======================================================
     EMAIL - GMAIL SMTP
  ======================================================= */

  if (normalizedChannel === "email") {
    try {
      if (!emailTransporter || !GMAIL_USER || !GMAIL_APP_PASSWORD) {
        throw new Error(
          "Gmail email is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in the backend environment."
        );
      }

      if (!isValidEmail(verifiedRecipient)) {
        throw new Error(
          "Invalid email address."
        );
      }

      const emailResult = await emailTransporter.sendMail({
        from: GMAIL_FROM_EMAIL || GMAIL_USER,
        to: verifiedRecipient,
        subject: cleanSub || "Student Examination Results",
        text: cleanMsg,
      });

      const providerMessageId = emailResult?.messageId || null;

      await updateCommunicationHistory(
        history.id,
        {
          status: "queued",

          provider_message_id:
            providerMessageId
              ? String(providerMessageId)
              : null,

          error_message: null,

          sent_at: null,
        }
      );

      return res.json({
        success: true,
        message:
          "Email accepted by Gmail SMTP.",
        history_id: history.id,
        channel: "email",
        status: "queued",
        provider: "Gmail SMTP",
        provider_message_id:
          providerMessageId,
      });
    } catch (error) {
      const errorMessage =
        getProviderError(error);

      await updateCommunicationHistory(
        history.id,
        {
          status: "failed",
          error_message: errorMessage,
        }
      );

      return res.status(502).json({
        success: false,
        message:
          "Failed to send email.",
        history_id: history.id,
        error: errorMessage,
      });
    }
  }

  return res.status(400).json({
    success: false,
    message: "Unsupported communication channel.",
  });
});

/* =========================================================
   SIMPLE DIRECT COMMUNICATION
   Does not require student_id or exam_id.
========================================================= */

router.post("/send", async (req, res) => {
  const channel = String(req.body?.channel || "").trim().toLowerCase();
  const recipient = String(req.body?.recipient || "").trim();
  const message = cleanMessage(req.body?.message);
  const subject = cleanSubject(req.body?.subject);

  if (!["whatsapp", "email"].includes(channel)) {
    return res.status(400).json({
      success: false,
      message: "Choose WhatsApp or Email.",
    });
  }

  if (!recipient) {
    return res.status(400).json({
      success: false,
      message: "Recipient is required.",
    });
  }

  if (!message) {
    return res.status(400).json({
      success: false,
      message: "Message is required.",
    });
  }

  if (channel === "email" && !isValidEmail(recipient)) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid email address.",
    });
  }

  if (channel === "email" && !subject) {
    return res.status(400).json({
      success: false,
      message: "Email subject is required.",
    });
  }

  try {
    if (channel === "email") {
      if (!emailTransporter || !GMAIL_USER || !GMAIL_APP_PASSWORD) {
        return res.status(503).json({
          success: false,
          message: "Gmail is not configured yet. Set GMAIL_USER and GMAIL_APP_PASSWORD in the backend environment.",
          code: "EMAIL_PROVIDER_NOT_CONFIGURED",
        });
      }

      const result = await emailTransporter.sendMail({
        from: GMAIL_FROM_EMAIL || GMAIL_USER,
        to: recipient,
        subject,
        text: message,
      });

      return res.json({
        success: true,
        message: "Email accepted by Gmail SMTP.",
        channel: "email",
        provider: "Gmail SMTP",
        status: "queued",
        provider_message_id: result?.messageId || null,
      });
    }

    const delivery = await sendWhatsAppProviderMessage(recipient, message);

    return res.json({
      success: true,
      message: `WhatsApp message accepted by ${delivery.provider}.`,
      channel: "whatsapp",
      provider: delivery.provider,
      status: delivery.status,
      provider_message_id: delivery.providerMessageId,
      provider_status: delivery.providerStatus,
    });
  } catch (error) {
    console.error("DIRECT COMMUNICATION SEND ERROR:", error);
    return res.status(502).json({
      success: false,
      message: channel === "whatsapp" ? "Failed to send WhatsApp message." : "Failed to send email.",
      error: getProviderError(error),
    });
  }
});

/* =========================================================
   BULK SMS CENTER - STAFF AND PARENTS
   Recipient contacts are always resolved server-side within
   the authenticated user's school. Never accept client phones.
========================================================= */

router.post("/bulk-sms", authenticateUser, async (req, res) => {
  const schoolId = Number(req.profile?.school_id);
  const audience = String(req.body?.audience || "").trim().toLowerCase();
  const messageTemplate = cleanMessage(req.body?.message);
  const rawIds = Array.isArray(req.body?.recipient_ids) ? req.body.recipient_ids : [];
  const recipientIds = [...new Set(rawIds.map((id) => String(id || "").trim()).filter(Boolean))];
  const classId = req.body?.class_id ? Number(req.body.class_id) : null;

  if (!Number.isInteger(schoolId) || schoolId <= 0) return res.status(403).json({ success: false, message: "Your account is not assigned to an active school." });
  if (!["staff", "parents"].includes(audience)) return res.status(400).json({ success: false, message: "Choose Staff or Parents as the SMS audience." });
  if (!recipientIds.length) return res.status(400).json({ success: false, message: "Select at least one recipient." });
  if (recipientIds.length > 100) return res.status(400).json({ success: false, message: "Send a maximum of 100 student/staff records per batch." });
  if (!messageTemplate) return res.status(400).json({ success: false, message: "Message is required." });
  if (classId && (!Number.isInteger(classId) || classId <= 0 || audience !== "parents")) return res.status(400).json({ success: false, message: "Invalid class selection." });

  try {
    const credentials = await getSchoolNewHopeCredentials(schoolId);
    let recipients = [];

    if (audience === "staff") {
      const { data, error } = await supabase.from("profiles")
        .select("id, full_name, phone, role_id, school_id")
        .eq("school_id", schoolId).in("id", recipientIds);
      if (error) throw error;
      if ((data || []).length !== recipientIds.length) return res.status(403).json({ success: false, message: "One or more selected staff members do not belong to your school." });
      if ((data || []).some((row) => Number(row.role_id) === 10)) return res.status(400).json({ success: false, message: "Student accounts cannot be selected as staff SMS recipients." });
      recipients = (data || []).map((row) => ({ profileId: row.id, studentId: null, name: row.full_name || "Staff member", phone: row.phone || "" }));
    } else {
      let query = supabase.from("students")
        .select("id, school_id, current_class_id, class_name, first_name, middle_name, last_name, admission_number, parent_name, parent_phone, guardian_name, guardian_phone")
        .eq("school_id", schoolId).in("id", recipientIds);
      if (classId) query = query.eq("current_class_id", classId);
      const { data, error } = await query;
      if (error) throw error;
      if ((data || []).length !== recipientIds.length) return res.status(403).json({ success: false, message: "One or more selected students are outside this school or selected class." });
      recipients = (data || []).map((row) => ({
        profileId: null,
        studentId: row.id,
        name: row.guardian_name || row.parent_name || "Parent/Guardian",
        studentName: [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(" "),
        className: row.class_name || "",
        admissionNumber: row.admission_number || "",
        phone: row.guardian_phone || row.parent_phone || "",
      }));
    }

    // Parents are intentionally NOT deduplicated by phone: one SMS per selected child.
    // Staff duplicate numbers remain deduplicated to avoid accidental repeat sends.
    const uniqueRecipients = [];
    const seenPhones = new Set();
    const results = [];
    for (const recipient of recipients) {
      const normalizedPhone = normalizeTanzaniaPhone(recipient.phone);
      if (!normalizedPhone || normalizedPhone.length < 10) {
        results.push({ recipient_name: recipient.name, student_name: recipient.studentName || null, status: "failed", error: "Namba ya mlezi/mzazi haipo au si sahihi kwenye taarifa za usajili." });
        continue;
      }
      if (audience === "staff" && seenPhones.has(normalizedPhone)) {
        results.push({ recipient_name: recipient.name, status: "skipped", error: "Duplicate staff phone number; sent once." });
        continue;
      }
      if (audience === "staff") seenPhones.add(normalizedPhone);
      const personalizedMessage = audience === "parents"
        ? messageTemplate
            .replace(/\{\{\s*student_name\s*\}\}/gi, recipient.studentName || "mwanafunzi")
            .replace(/\{\{\s*class_name\s*\}\}/gi, recipient.className || "darasa")
            .replace(/\{\{\s*admission_number\s*\}\}/gi, recipient.admissionNumber || "-")
        : messageTemplate;
      uniqueRecipients.push({ ...recipient, normalizedPhone, personalizedMessage });
    }

    for (const recipient of uniqueRecipients) {
      let history;
      try {
        const { data: inserted, error: insertError } = await supabase.from("school_sms_broadcast_history")
          .insert({
            school_id: schoolId, sender_user_id: req.user.id, audience,
            recipient_profile_id: recipient.profileId, student_id: recipient.studentId,
            recipient_name: recipient.name, recipient_phone: recipient.normalizedPhone,
            message: recipient.personalizedMessage, provider: "NewHope SMS", status: "pending",
          }).select("id").single();
        if (insertError) throw insertError;
        history = inserted;
        const delivery = await sendNewHopeSmsWithCredentials(credentials, recipient.normalizedPhone, recipient.personalizedMessage);
        await supabase.from("school_sms_broadcast_history").update({
          status: delivery.status, provider_message_id: delivery.provider_message_id,
          segments: delivery.segments, cost: delivery.cost,
          error_message: delivery.status === "failed" ? "NewHope reported a failed delivery." : null,
          sent_at: delivery.status === "failed" ? null : new Date().toISOString(),
        }).eq("id", history.id).eq("school_id", schoolId);
        results.push({
          recipient_name: recipient.name, student_name: recipient.studentName || null,
          phone: recipient.normalizedPhone, status: delivery.status, provider: delivery.provider,
          provider_message_id: delivery.provider_message_id, segments: delivery.segments, cost: delivery.cost,
        });
      } catch (sendError) {
        const errorMessage = getProviderError(sendError);
        if (history?.id) await supabase.from("school_sms_broadcast_history").update({ status: "failed", error_message: errorMessage }).eq("id", history.id).eq("school_id", schoolId);
        results.push({ recipient_name: recipient.name, student_name: recipient.studentName || null, phone: recipient.normalizedPhone, status: "failed", error: errorMessage });
      }
    }

    const sentCount = results.filter((row) => ["sent", "queued", "delivered"].includes(String(row.status).toLowerCase())).length;
    const failedCount = results.filter((row) => row.status === "failed").length;
    const skippedCount = results.filter((row) => row.status === "skipped").length;
    return res.json({
      success: sentCount > 0 && failedCount === 0,
      message: `NewHope SMS: ${sentCount} accepted, ${failedCount} failed, ${skippedCount} duplicate staff numbers skipped.`,
      provider: "NewHope SMS", audience, selected_count: recipientIds.length,
      sent_count: sentCount, failed_count: failedCount, skipped_count: skippedCount, results,
    });
  } catch (error) {
    console.error("BULK NEWHOPE SMS ERROR:", error);
    return res.status(502).json({ success: false, message: "Bulk SMS request failed.", provider: "NewHope SMS", error: getProviderError(error) });
  }
});

/* =========================================================
   EXPORT
========================================================= */

export default router;