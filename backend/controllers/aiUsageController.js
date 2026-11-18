import { supabase } from "../config/supabase.js";

const sendError = (res, error, fallback) => res.status(500).json({
    success: false,
    message: fallback,
    detail: process.env.NODE_ENV === "production" ? undefined : error?.message,
});

export const getAiUsageOverview = async (req, res) => {
    try {
        const year = Number(req.query.year) || null;
        const { data, error } = await supabase.rpc("get_ai_usage_admin_overview", { p_year: year });
        if (error) throw error;
        return res.json({ success: true, year: year || new Date().getFullYear(), schools: data || [] });
    } catch (error) {
        console.error("AI USAGE OVERVIEW ERROR:", error);
        return sendError(res, error, "Unable to load AI usage overview.");
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
