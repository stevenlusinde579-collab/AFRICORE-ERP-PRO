import { supabase } from "../config/supabase.js";

const sendError = (res, error, fallback) => res.status(500).json({
    success: false,
    message: fallback,
    detail: process.env.NODE_ENV === "production" ? undefined : error?.message,
});

export const getAiUsageOverview = async (req, res) => {
    try {
        const year = Number(req.query.year) || null;
        const [{ data, error }, { data: budget, error: budgetError }] = await Promise.all([
            supabase.rpc("get_ai_usage_admin_overview", { p_year: year }),
            supabase.rpc("get_gemini_ai_credit_budget"),
        ]);
        if (error) throw error;
        if (budgetError) throw budgetError;
        return res.json({
            success: true,
            year: year || new Date().getFullYear(),
            schools: data || [],
            budget: budget || {},
        });
    } catch (error) {
        console.error("AI USAGE OVERVIEW ERROR:", error);
        return sendError(res, error, "Unable to load AI usage and credit budget overview.");
    }
};

export const getAiUsageSchoolDetail = async (req, res) => {
    try {
        const schoolId = Number(req.params.schoolId);
        const year = Number(req.query.year) || null;
        if (!Number.isInteger(schoolId) || schoolId <= 0) {
            return res.status(400).json({ success: false, message: "Invalid school ID." });
        }
        const { data, error } = await supabase.rpc("get_ai_usage_school_detail", {
            p_school_id: schoolId,
            p_year: year,
        });
        if (error) throw error;
        if (!data?.school) return res.status(404).json({ success: false, message: "School not found." });
        return res.json({ success: true, detail: data });
    } catch (error) {
        console.error("AI USAGE SCHOOL DETAIL ERROR:", error);
        return sendError(res, error, "Unable to load school AI usage details.");
    }
};

export const updateAiUsagePolicy = async (req, res) => {
    try {
        const schoolId = Number(req.params.schoolId);
        const { is_enabled, annual_upload_limit, exams_per_upload_limit, admin_note } = req.body || {};
        if (!Number.isInteger(schoolId) || schoolId <= 0) {
            return res.status(400).json({ success: false, message: "Invalid school ID." });
        }
        if (typeof is_enabled !== "boolean" ||
            !Number.isInteger(Number(annual_upload_limit)) || Number(annual_upload_limit) < 0 || Number(annual_upload_limit) > 10000 ||
            !Number.isInteger(Number(exams_per_upload_limit)) || Number(exams_per_upload_limit) < 0 || Number(exams_per_upload_limit) > 1000) {
            return res.status(400).json({ success: false, message: "Provide valid AI status, annual upload limit and exams-per-upload limit." });
        }

        const { data, error } = await supabase.rpc("set_gemini_ai_usage_policy", {
            p_school_id: schoolId,
            p_is_enabled: is_enabled,
            p_annual_upload_limit: Number(annual_upload_limit),
            p_exams_per_upload_limit: Number(exams_per_upload_limit),
            p_admin_note: String(admin_note || "").trim().slice(0, 1000) || null,
            p_actor_user_id: req.user.id,
        });
        if (error) throw error;
        return res.json({ success: true, message: "AI usage policy updated.", policy: data });
    } catch (error) {
        console.error("AI USAGE POLICY UPDATE ERROR:", error);
        return sendError(res, error, "Unable to update AI usage policy.");
    }
};

export const recordAiCreditPurchase = async (req, res) => {
    try {
        const { amount_usd, exchange_rate_tzs, paid_amount_tzs, payment_reference, admin_note } = req.body || {};
        const amount = Number(amount_usd);
        const rate = exchange_rate_tzs === "" || exchange_rate_tzs == null ? null : Number(exchange_rate_tzs);
        const paid = paid_amount_tzs === "" || paid_amount_tzs == null ? null : Number(paid_amount_tzs);
        if (!Number.isFinite(amount) || amount <= 0 ||
            (rate !== null && (!Number.isFinite(rate) || rate <= 0)) ||
            (paid !== null && (!Number.isFinite(paid) || paid < 0))) {
            return res.status(400).json({ success: false, message: "Enter a valid credit amount in USD and optional valid TZS amounts." });
        }
        const { data, error } = await supabase.rpc("record_gemini_ai_credit_purchase", {
            p_amount_usd: amount,
            p_exchange_rate_tzs: rate,
            p_paid_amount_tzs: paid,
            p_payment_reference: String(payment_reference || "").trim().slice(0, 120) || null,
            p_admin_note: String(admin_note || "").trim().slice(0, 500) || null,
            p_recorded_by: req.user.id,
        });
        if (error) throw error;
        return res.status(201).json({ success: true, message: "Gemini credit purchase recorded.", purchase_id: data });
    } catch (error) {
        console.error("GEMINI CREDIT PURCHASE ERROR:", error);
        return sendError(res, error, "Unable to record Gemini credit purchase.");
    }
};
