import { supabase } from "../config/supabase.js";

export const reserveGeminiAiSlot = async ({ schoolId, examId, examPaperId, actorUserId }) => {
    const { data, error } = await supabase.rpc("reserve_gemini_ai_analysis_slot", {
        p_school_id: Number(schoolId),
        p_exam_id: Number(examId),
        p_exam_paper_id: Number(examPaperId),
        p_actor_user_id: actorUserId || null,
    });
    if (error) throw new Error(`Unable to enforce AI usage policy: ${error.message}`);
    return data || { allowed: false, code: "USAGE_POLICY_UNAVAILABLE" };
};

export const updateGeminiReservationStatus = async ({ schoolId, examPaperId, status }) => {
    const { error } = await supabase
        .from("gemini_ai_usage_reservations")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("school_id", Number(schoolId))
        .eq("exam_paper_id", Number(examPaperId));
    if (error) console.error("AI USAGE RESERVATION STATUS UPDATE FAILED:", error.message);
};
