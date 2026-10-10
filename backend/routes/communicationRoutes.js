import "dotenv/config";
import express from "express";
import twilio from "twilio";
import { Resend } from "resend";
import { supabase } from "../config/supabase.js";
import { authenticateUser } from "../middleware/authMiddleware.js";
import { requireSchoolContext } from "../middleware/schoolContextMiddleware.js";

const router = express.Router();

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_FROM,
  RESEND_API_KEY,
  RESEND_FROM_EMAIL,
  ESMS_API_KEY,
} = process.env;

const twilioClient =
  TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN
    ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    : null;

const resend = RESEND_API_KEY
  ? new Resend(RESEND_API_KEY)
  : null;

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
        provider: "eSMS Africa",
        configured: Boolean(ESMS_API_KEY),
      },

      whatsapp: {
        provider: "Twilio",
        configured: Boolean(
          twilioClient && TWILIO_WHATSAPP_FROM
        ),
      },

      email: {
        provider: "Resend",
        configured: Boolean(
          resend && RESEND_FROM_EMAIL
        ),
      },
    },
  });
});

/* =========================================================
   SEND PARENT RESULT COMMUNICATION
========================================================= */

router.post("/parent-result", authenticateUser, requireSchoolContext, async (req, res) => {
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

  const verifiedSchoolId = req.schoolContext?.isSuperAdmin
    ? Number(school_id)
    : Number(req.schoolContext?.schoolId);

  if (!Number.isInteger(verifiedSchoolId) || verifiedSchoolId <= 0) {
    return res.status(400).json({
      success: false,
      message: "A valid school is required."
    });
  }

  const studentIdNumber = Number(student_id);
  const examIdNumber = Number(exam_id);
  if (!Number.isInteger(studentIdNumber) || studentIdNumber <= 0 ||
      !Number.isInteger(examIdNumber) || examIdNumber <= 0) {
    return res.status(400).json({
      success: false,
      message: "Valid student and examination IDs are required."
    });
  }

  try {
    const [
      studentResult,
      examResult
    ] = await Promise.all([
      supabase
        .from("students")
        .select("id, school_id")
        .eq("id", studentIdNumber)
        .eq("school_id", verifiedSchoolId)
        .maybeSingle(),
      supabase
        .from("exams")
        .select("id, school_id")
        .eq("id", examIdNumber)
        .eq("school_id", verifiedSchoolId)
        .maybeSingle()
    ]);

    if (studentResult.error) throw studentResult.error;
    if (examResult.error) throw examResult.error;

    if (!studentResult.data || !examResult.data) {
      return res.status(404).json({
        success: false,
        message: "Student or examination was not found in your school."
      });
    }
  } catch (ownershipError) {
    console.error("COMMUNICATION SCHOOL OWNERSHIP CHECK ERROR:", ownershipError);
    return res.status(500).json({
      success: false,
      message: "Unable to verify student and examination ownership."
    });
  }

  const normalizedChannel = String(channel || "")
    .trim()
    .toLowerCase();

  const cleanRecipient = String(recipient || "").trim();
  const cleanMsg = cleanMessage(message);
  const cleanSub = cleanSubject(subject);

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
     CREATE HISTORY RECORD FIRST
  ======================================================= */

  let history = null;

  try {
    history = await createCommunicationHistory({
      school_id: verifiedSchoolId,
      student_id: studentIdNumber,
      exam_id: examIdNumber,
      parent_name,
      recipient: cleanRecipient,
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
     SMS - eSMS AFRICA
  ======================================================= */

  if (normalizedChannel === "sms") {
    try {
      if (!ESMS_API_KEY) {
        throw new Error(
          "ESMS_API_KEY is not configured."
        );
      }

      const phone = normalizeTanzaniaPhone(
        cleanRecipient
      );

      if (!phone) {
        throw new Error(
          "Invalid Tanzania phone number."
        );
      }

      const response = await fetch(
        "https://sms.esmsafrica.io/api/messages/send",
        {
          method: "POST",

          headers: {
            Authorization: `Bearer ${ESMS_API_KEY}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },

          body: JSON.stringify({
            to: phone,
            text: cleanMsg,
          }),
        }
      );

      let result = null;

      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.error ||
            `eSMS request failed with HTTP ${response.status}.`
        );
      }

      const providerMessageId =
        result?.message_id ||
        result?.messageId ||
        result?.id ||
        result?.data?.message_id ||
        result?.data?.messageId ||
        null;

      const providerStatus =
        result?.status ||
        result?.data?.status ||
        "queued";

      const normalizedStatus =
        normalizeProviderStatus(providerStatus);

      const finalStatus =
        normalizedStatus === "failed"
          ? "failed"
          : normalizedStatus;

      await updateCommunicationHistory(
        history.id,
        {
          status: finalStatus,

          provider_message_id:
            providerMessageId
              ? String(providerMessageId)
              : null,

          error_message:
            finalStatus === "failed"
              ? String(
                  result?.message ||
                    result?.error ||
                    ""
                )
              : null,

          sent_at:
            finalStatus === "sent" ||
            finalStatus === "delivered"
              ? new Date().toISOString()
              : null,
        }
      );

      if (finalStatus === "failed") {
        return res.status(502).json({
          success: false,
          message:
            "SMS provider rejected the message.",
          history_id: history.id,
          provider_message_id:
            providerMessageId,
          provider_response: result,
        });
      }

      return res.json({
        success: true,
        message: "SMS accepted by eSMS Africa.",
        history_id: history.id,
        channel: "sms",
        status: finalStatus,
        provider: "eSMS Africa",
        provider_message_id:
          providerMessageId,
        provider_response: result,
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
        message: "Failed to send SMS.",
        history_id: history.id,
        error: errorMessage,
      });
    }
  }

  /* =======================================================
     WHATSAPP - TWILIO
  ======================================================= */

  if (normalizedChannel === "whatsapp") {
    try {
      if (
        !twilioClient ||
        !TWILIO_WHATSAPP_FROM
      ) {
        throw new Error(
          "Twilio WhatsApp configuration is incomplete."
        );
      }

      const whatsappTo =
        normalizeWhatsAppNumber(cleanRecipient);

      const whatsappFrom =
        normalizeWhatsAppFrom(
          TWILIO_WHATSAPP_FROM
        );

      if (!whatsappTo) {
        throw new Error(
          "Invalid WhatsApp recipient number."
        );
      }

      if (!whatsappFrom) {
        throw new Error(
          "Invalid Twilio WhatsApp sender."
        );
      }

      const twilioMessage =
        await twilioClient.messages.create({
          body: cleanMsg,
          from: whatsappFrom,
          to: whatsappTo,
        });

      const providerStatus =
        normalizeProviderStatus(
          twilioMessage?.status
        );

      await updateCommunicationHistory(
        history.id,
        {
          status: providerStatus,

          provider_message_id:
            twilioMessage?.sid || null,

          error_message: null,

          sent_at:
            providerStatus === "sent" ||
            providerStatus === "delivered"
              ? new Date().toISOString()
              : null,
        }
      );

      return res.json({
        success: true,
        message:
          "WhatsApp message accepted by Twilio.",
        history_id: history.id,
        channel: "whatsapp",
        status: providerStatus,
        provider: "Twilio",
        provider_message_id:
          twilioMessage?.sid || null,
        provider_status:
          twilioMessage?.status || null,
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
          "Failed to send WhatsApp message.",
        history_id: history.id,
        error: errorMessage,
      });
    }
  }

  /* =======================================================
     EMAIL - RESEND
  ======================================================= */

  if (normalizedChannel === "email") {
    try {
      if (!resend || !RESEND_FROM_EMAIL) {
        throw new Error(
          "Resend email configuration is incomplete."
        );
      }

      if (!isValidEmail(cleanRecipient)) {
        throw new Error(
          "Invalid email address."
        );
      }

      const emailResult =
        await resend.emails.send({
          from: RESEND_FROM_EMAIL,
          to: [cleanRecipient],
          subject:
            cleanSub ||
            "Student Examination Results",
          text: cleanMsg,
        });

      if (emailResult?.error) {
        throw new Error(
          emailResult.error.message ||
            "Resend rejected the email."
        );
      }

      const providerMessageId =
        emailResult?.data?.id ||
        emailResult?.id ||
        null;

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
          "Email accepted by Resend.",
        history_id: history.id,
        channel: "email",
        status: "queued",
        provider: "Resend",
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
   EXPORT
========================================================= */

export default router;