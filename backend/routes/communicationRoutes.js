import "dotenv/config";
import express from "express";
import twilio from "twilio";
import nodemailer from "nodemailer";
import { supabase } from "../config/supabase.js";

const router = express.Router();

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_FROM,
  GMAIL_USER,
  GMAIL_APP_PASSWORD,
  GMAIL_FROM_EMAIL,
  ESMS_API_KEY,
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

// WhatsApp and Email remain enabled. SMS stays disabled until its provider is paid.
const SMS_ENABLED = false;
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
        enabled: SMS_ENABLED,
        message: "SMS is paused until its provider is funded.",
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

router.post("/parent-result", async (req, res) => {
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

  // Enforce the temporary SMS pause on the server, not just in the UI.
  if (normalizedChannel === "sms" && !SMS_ENABLED) {
    return res.status(503).json({
      success: false,
      channel: normalizedChannel,
      message: "SMS is temporarily paused until the SMS provider is funded.",
      code: "CHANNEL_TEMPORARILY_DISABLED",
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
      school_id &&
      String(student.school_id) !== String(school_id)
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
     EMAIL - RESEND
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
   EXPORT
========================================================= */

export default router;