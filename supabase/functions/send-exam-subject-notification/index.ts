import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey =
  Deno.env.get("SUPABASE_ANON_KEY") ||
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const userClient = createClient(
  supabaseUrl,
  anonKey
);

const adminClient = createClient(
  supabaseUrl,
  serviceRoleKey
);

const normalizePhone = (value: string) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/[^0-9]/g, "");
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("255")) return `+${digits}`;
  if (digits.startsWith("0")) return `+255${digits.slice(1)}`;
  return `+${digits}`;
};

const sendEmail = async (
  to: string,
  subject: string,
  message: string
) => {
  const apiKey =
    Deno.env.get("RESEND_API_KEY");
  const from =
    Deno.env.get("RESEND_FROM_EMAIL");

  if (!apiKey || !from) {
    return {
      status: "failed",
      skipped: true,
      error: "Resend credentials are not configured. Email was not sent.",
    };
  }

  const html = message
    .split("\n")
    .map(
      line =>
        `<p>${line || "&nbsp;"}</p>`
    )
    .join("");

  const response = await fetch(
    "https://api.resend.com/emails",
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${apiKey}`,
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: message,
        html,
      }),
    }
  );

  const data =
    await response.json().catch(
      () => ({})
    );

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Resend HTTP ${response.status}`
    );
  }

  return {
    skipped: false,
    provider: "Resend",
    provider_message_id:
      data?.id || null,
    status: "sent",
  };
};

const sendWhatsApp = async (
  to: string,
  message: string
) => {
  const accountSid =
    Deno.env.get(
      "TWILIO_ACCOUNT_SID"
    );
  const authToken =
    Deno.env.get(
      "TWILIO_AUTH_TOKEN"
    );
  const from =
    Deno.env.get(
      "TWILIO_WHATSAPP_FROM"
    );

  if (
    !accountSid ||
    !authToken ||
    !from
  ) {
    return {
      status: "failed",
      skipped: true,
      error: "Twilio WhatsApp credentials are not configured. WhatsApp was not sent.",
    };
  }

  const params =
    new URLSearchParams();

  params.set(
    "To",
    `whatsapp:${normalizePhone(to)}`
  );
  params.set("From", from);

  const contentSid =
    Deno.env.get(
      "TWILIO_WHATSAPP_CONTENT_SID"
    ) || "";

  if (contentSid) {
    params.set(
      "ContentSid",
      contentSid
    );

    params.set(
      "ContentVariables",
      JSON.stringify({
        [
          Deno.env.get(
            "TWILIO_WHATSAPP_MESSAGE_VARIABLE"
          ) || "1"
        ]: message,
      })
    );
  } else {
    params.set("Body", message);
  }

  const auth = btoa(
    `${accountSid}:${authToken}`
  );

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization:
          `Basic ${auth}`,
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    }
  );

  const data =
    await response.json().catch(
      () => ({})
    );

  if (!response.ok) {
    throw new Error(
      data?.message ||
        `Twilio HTTP ${response.status}`
    );
  }

  return {
    skipped: false,
    provider:
      "Twilio WhatsApp",
    provider_message_id:
      data?.sid || null,
    status:
      data?.status || "queued",
  };
};

const cleanChannels = (
  value: unknown
) => {
  // SMS remains disabled until AfriCore funds its SMS provider.
  const allowed = new Set([
    "whatsapp",
    "email",
  ]);

  const raw = Array.isArray(value)
    ? value
    : [];

  return [
    ...new Set(
      raw
        .map(item =>
          String(item)
            .trim()
            .toLowerCase()
        )
        .filter(item =>
          allowed.has(item)
        )
    ),
  ];
};

Deno.serve(
  async req => {
    if (req.method === "OPTIONS") {
      return new Response(
        "ok",
        {
          headers:
            corsHeaders,
        }
      );
    }

    try {
      const authHeader =
        req.headers.get(
          "Authorization"
        );

      if (!authHeader) {
        throw new Error(
          "Authorization header is required."
        );
      }

      const token =
        authHeader.replace(
          "Bearer ",
          ""
        );

      const {
        data: {
          user,
        },
        error: userError,
      } =
        await userClient.auth.getUser(
          token
        );

      if (userError || !user) {
        throw new Error(
          "Unauthorized."
        );
      }

      const body =
        await req.json();

      const examSubjectId =
        Number(
          body?.exam_subject_id
        );

      const type =
        String(
          body?.type || ""
        )
          .trim()
          .toLowerCase();

      const channels =
        cleanChannels(
          body?.channels ??
            body?.notification_channels
        );

      const reason =
        String(
          body?.reason || ""
        ).trim();

      if (
        !Number.isFinite(
          examSubjectId
        ) ||
        examSubjectId <= 0
      ) {
        throw new Error(
          "exam_subject_id is required."
        );
      }

      if (
        type !== "rejected" &&
        type !== "approved"
      ) {
        throw new Error(
          "Notification type must be approved or rejected."
        );
      }

      if (!channels.length) {
        throw new Error(
          "Chagua WhatsApp au Email. SMS is temporarily disabled until its provider is funded."
        );
      }

      const {
        data: examSubject,
        error:
          examSubjectError,
      } =
        await adminClient
          .from("exam_subjects")
          .select(
            "id, exam_id, subject_id, class_id, approval_status, rejection_reason"
          )
          .eq(
            "id",
            examSubjectId
          )
          .single();

      if (examSubjectError) {
        throw examSubjectError;
      }

      const {
        data: exam,
        error: examError,
      } =
        await adminClient
          .from("exams")
          .select(
            "id, school_id, exam_name, status"
          )
          .eq(
            "id",
            examSubject.exam_id
          )
          .single();

      if (examError) {
        throw examError;
      }

      // ExamApproval.jsx completes the approval/rejection state on the
      // examination record. Validate the same authoritative exam status.
      const approvalStatus = String(
        examSubject.approval_status || ""
      ).trim().toLowerCase();

      if (
        type === "approved" &&
        approvalStatus !== "approved"
      ) {
        throw new Error(
          "Examination subject is not fully approved."
        );
      }

      if (
        type === "rejected" &&
        approvalStatus !== "rejected"
      ) {
        throw new Error(
          "Examination subject is not rejected."
        );
      }

const {
        data: subject,
        error: subjectError,
      } =
        await adminClient
          .from("subjects")
          .select(
            "id, subject_name"
          )
          .eq(
            "id",
            examSubject.subject_id
          )
          .maybeSingle();

      if (subjectError) {
        throw subjectError;
      }

      const {
        data: classRow,
        error: classError,
      } =
        await adminClient
          .from("classes")
          .select(
            "id, class_name"
          )
          .eq(
            "id",
            examSubject.class_id
          )
          .maybeSingle();

      if (classError) {
        throw classError;
      }

      const {
        data: assignments,
        error:
          assignmentError,
      } =
        await adminClient
          .from(
            "teacher_assignments"
          )
          .select(
            "teacher_id, subject_id, class_id, school_id"
          )
          .eq("school_id", exam.school_id)
          .eq(
            "subject_id",
            examSubject.subject_id
          )
          .eq(
            "class_id",
            examSubject.class_id
          );

      if (assignmentError) {
        throw assignmentError;
      }

      const teacherIds = [
        ...new Set(
          (assignments || [])
            .map(row =>
              row.teacher_id
            )
            .filter(Boolean)
        ),
      ];

      if (!teacherIds.length) {
        return new Response(
          JSON.stringify({
            success: true,
            exam_subject_id:
              examSubjectId,
            teachers_notified: 0,
            channels,
            message:
              "Hakuna teacher assignment iliyopatikana kwa subject/class hii.",
            results: [],
          }),
          {
            headers:
              corsHeaders,
          }
        );
      }

      const {
        data: teachers,
        error: teacherError,
      } =
        await adminClient
          .from("teachers")
          .select(
            "id, first_name, middle_name, last_name, phone, email, user_id, status"
          )
          .in(
            "id",
            teacherIds
          );

      if (teacherError) {
        throw teacherError;
      }

      const subjectName =
        subject?.subject_name ||
        `Subject ${examSubject.subject_id}`;

      const className =
        classRow?.class_name ||
        `Class ${examSubject.class_id}`;

      const rejectionText =
        reason ||
        examSubject.rejection_reason ||
        "No rejection reason recorded.";

      const title =
        type === "approved"
          ? `Examination Approved - ${subjectName}`
          : `Examination Rejected - ${subjectName}`;

      const subjectLine =
        type === "approved"
          ? `Your examination paper for ${subjectName} - ${className} has received final Headmaster approval.`
          : `Your examination paper for ${subjectName} - ${className} has been rejected.`;

      const results: any[] = [];

      for (
        const teacher of
        teachers || []
      ) {
        if (
          String(
            teacher.status ||
              "Active"
          ).toLowerCase() ===
          "inactive"
        ) {
          continue;
        }

        const teacherName =
          [
            teacher.first_name,
            teacher.middle_name,
            teacher.last_name,
          ]
            .filter(Boolean)
            .join(" ") ||
          "Teacher";

        const message =
          type === "approved"
            ? [
                `Dear ${teacherName},`,
                "",
                `Examination "${exam.exam_name || "Examination"}" - ${subjectName} (${className}) has been FULLY APPROVED by the Headmaster.`,
                "",
                "You may proceed with the next examination process in AfriCore ERP.",
                "",
                "AfriCore School Management System",
              ].join("\n")
            : [
                `Dear ${teacherName},`,
                "",
                `Examination "${exam.exam_name || "Examination"}" - ${subjectName} (${className}) has been REJECTED.`,
                `Reason: ${rejectionText}`,
                "",
                "Please review and correct the examination paper in AfriCore ERP.",
                "",
                "AfriCore School Management System",
              ].join("\n");

        if (teacher.user_id) {
          const {
            error:
              notificationError,
          } =
            await adminClient
              .from(
                "notifications"
              )
              .insert({
                school_id:
                  exam.school_id,
                user_id:
                  teacher.user_id,
                title,
                message,
                notification_type:
                  type ===
                  "approved"
                    ? "exam_approval"
                    : "exam_rejection",
                is_read: false,
              });

          if (
            notificationError
          ) {
            results.push({
              teacher_id:
                teacher.id,
              channel:
                "system",
              status:
                "failed",
              error:
                notificationError.message,
            });
          } else {
            results.push({
              teacher_id:
                teacher.id,
              channel:
                "system",
              status: "created",
            });
          }
        }

        if (channels.includes("email")) {
          if (!teacher.email) {
            results.push({
              teacher_id: teacher.id,
              channel: "email",
              status: "failed",
              error: "Teacher email address is missing.",
            });
          } else {
          try {
            results.push({
              teacher_id:
                teacher.id,
              channel:
                "email",
              ...(await sendEmail(
                teacher.email,
                title,
                message
              )),
            });
          } catch (error) {
            results.push({
              teacher_id:
                teacher.id,
              channel:
                "email",
              status:
                "failed",
              error:
                error?.message ||
                String(error),
            });
          }
          }
        }

        if (channels.includes("whatsapp")) {
          if (!teacher.phone) {
            results.push({
              teacher_id: teacher.id,
              channel: "whatsapp",
              status: "failed",
              error: "Teacher phone number is missing.",
            });
          } else {
          try {
            results.push({
              teacher_id:
                teacher.id,
              channel:
                "whatsapp",
              ...(await sendWhatsApp(
                teacher.phone,
                message
              )),
            });
          } catch (error) {
            results.push({
              teacher_id:
                teacher.id,
              channel:
                "whatsapp",
              status:
                "failed",
              error:
                error?.message ||
                String(error),
            });
          }
          }
        }
      }

      const failedCount = results.filter(
        item => item.status === "failed" || item.skipped === true
      ).length;
      const successfulCount = results.filter(
        item => ["created", "sent", "queued", "delivered", "accepted"].includes(
          String(item.status || "").toLowerCase()
        )
      ).length;
      const allSucceeded = failedCount === 0 && successfulCount > 0;

      return new Response(
        JSON.stringify({
          success: allSucceeded,
          message: allSucceeded
            ? "Notification delivered to configured channels."
            : "Some notifications failed or were not sent. Check the per-channel results.",
          exam_subject_id:
            examSubjectId,
          type,
          channels,
          subject:
            subjectName,
          class:
            className,
          teachers_notified:
            teacherIds.length,
          results,
        }),
        {
          headers:
            corsHeaders,
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          message:
            error?.message ||
            "Notification failed.",
        }),
        {
          status: 400,
          headers:
            corsHeaders,
        }
      );
    }
  }
);