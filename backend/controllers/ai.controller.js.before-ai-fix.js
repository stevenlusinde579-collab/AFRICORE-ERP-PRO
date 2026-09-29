/*
 * Once examPaperId exists, the PDF has already been
 * stored successfully. Gemini/provider/parsing errors
 * must NOT turn the upload request into HTTP 500.
 *
 * HTTP 200 keeps Axios from producing:
 * "Request failed with status code 500".
 */
if (examPaperId) {
    return res.status(200).json({
        success: false,
        ai_failed: true,

        code:
            error?.code ||
            "AI_ANALYSIS_FAILED",

        message:
            "Examination paper uploaded successfully, but AI analysis could not be completed.",

        user_message:
            "Paper imehifadhiwa kikamilifu. AI analysis haikukamilika; unaweza kuendelea manually au kujaribu tena.",

        technical_error:
            process.env.NODE_ENV === "development"
                ? error?.message || null
                : null,

        exam_id:
            examId,

        exam_subject_id:
            examSubjectId,

        exam_paper_id:
            examPaperId,
    });
}