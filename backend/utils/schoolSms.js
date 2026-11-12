import { supabase } from "../config/supabase.js";

function normalizeTanzaniaPhone(value) {
    let phone = String(value || "").trim().replace(/[\s().-]/g, "");
    if (phone.startsWith("+")) phone = phone.slice(1);
    if (phone.startsWith("0")) phone = `255${phone.slice(1)}`;
    if (/^[678]\d{8}$/.test(phone)) phone = `255${phone}`;
    if (!/^255[678]\d{8}$/.test(phone)) {
        throw new Error("Namba ya simu si sahihi.");
    }
    return `+${phone}`;
}

/** Send SMS only with the supplied school's approved NewHope Sender ID. */
export async function sendSchoolSms({ schoolId, recipient, message }) {
    const id = Number(schoolId);
    if (!Number.isInteger(id) || id <= 0) {
        throw new Error("School ID halali inahitajika kutuma SMS.");
    }
    if (!String(message || "").trim()) {
        throw new Error("Ujumbe wa SMS hauwezi kuwa tupu.");
    }

    const { data, error } = await supabase
        .rpc("get_school_sms_credentials", { p_school_id: id })
        .maybeSingle();

    if (error) throw new Error("Imeshindikana kupata mipangilio ya SMS ya shule hii.");
    if (!data?.api_key || !data?.secret_key || !data?.sender_id) {
        throw new Error("SMS haijatumwa: shule haijaweka NewHope API credentials na Sender ID.");
    }
    if (String(data.approval_status || "").toLowerCase() !== "approved") {
        throw new Error("SMS haijatumwa: Sender ID ya shule bado haijaidhinishwa.");
    }

    const phone = normalizeTanzaniaPhone(recipient);
    const response = await fetch("https://sms.newhope.co.tz/v1/sms/send/", {
        method: "POST",
        headers: {
            Authorization: `ApiKey ${data.api_key}:${data.secret_key}`,
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify({
            recipient: phone,
            message: String(message).trim(),
            // NewHope Demo credentials require the provider demo sender label exactly as documented.
            // Live API keys are bound to their approved Sender ID by NewHope and ignore this field.
            sender_id: "NewHope",
        }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        const detail = result?.message || result?.detail || result?.error || `NewHope SMS HTTP ${response.status}`;
        throw new Error(String(detail));
    }

    return {
        provider: "NewHope SMS",
        sender_id: data.sender_id,
        provider_message_id: result?.id || result?.message_id || result?.messageId || null,
        status: result?.status || "sent",
        segments: result?.segments ?? null,
        cost: result?.cost ?? null,
    };
}
