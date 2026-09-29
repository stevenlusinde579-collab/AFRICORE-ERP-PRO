import { supabase } from "../config/supabase.js";


// =====================================================
// HELPER: NORMALIZE ROLE
// =====================================================

const normalizeRole = (role) => {
    return String(role || "")
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ");
};


// =====================================================
// HELPER: GET APPROVAL STATUS
// =====================================================

const buildApprovalStatus = (examSubject) => {

    const academicApproved =
        Boolean(examSubject?.approved_by_academic);

    const deputyApproved =
        Boolean(examSubject?.approved_by_deputy);

    const headmasterApproved =
        Boolean(examSubject?.approved_by_headmaster);


    let status = "Pending";


    if (examSubject?.approval_status) {
        status = examSubject.approval_status;
    }


    // -------------------------------------------------
    // Calculate status from approval chain when possible
    // -------------------------------------------------

    if (headmasterApproved) {

        status = "Approved";

    } else if (deputyApproved) {

        status = "Pending Headmaster";

    } else if (academicApproved) {

        status = "Pending Deputy";

    } else if (
        examSubject?.approval_status === "Rejected"
    ) {

        status = "Rejected";

    } else {

        status = "Pending";
    }


    return {
        status,
        academic_approved: academicApproved,
        deputy_approved: deputyApproved,
        headmaster_approved: headmasterApproved,
        approved_by_academic:
            examSubject?.approved_by_academic || null,
        approved_by_deputy:
            examSubject?.approved_by_deputy || null,
        approved_by_headmaster:
            examSubject?.approved_by_headmaster || null,
        approved_at:
            examSubject?.approved_at || null,
        rejection_reason:
            examSubject?.rejection_reason || null,
        rejected_by:
            examSubject?.rejected_by || null,
        rejected_at:
            examSubject?.rejected_at || null,
    };
};


// =====================================================
// GET APPROVAL STATUS FOR ONE EXAM SUBJECT
//
// GET /api/exams/exam-subject/:examSubjectId/approval
//
// IMPORTANT:
// Approval belongs to exam_subjects.
// It does NOT read exams.status.
// =====================================================

export const getExamSubjectApproval = async (
    req,
    res
) => {

    try {

        const {
            examSubjectId
        } = req.params;


        if (!examSubjectId) {

            return res.status(400).json({

                success: false,

                message:
                    "Exam subject ID is required."

            });

        }


        const {
            data,
            error
        } = await supabase

            .from("exam_subjects")

            .select(`
                id,
                exam_id,
                subject_id,
                class_id,
                full_marks,
                pass_marks,
                question_selection_type,
                questions_to_answer,
                created_at,
                approval_status,
                approved_by_academic,
                approved_by_deputy,
                approved_by_headmaster,
                approved_at,
                rejection_reason,
                rejected_by,
                rejected_at
            `)

            .eq(
                "id",
                examSubjectId
            )

            .single();


        if (error) {

            console.error(
                "GET EXAM SUBJECT APPROVAL ERROR:",
                error
            );


            return res.status(404).json({

                success: false,

                message:
                    "Examination subject was not found.",

                error:
                    error.message

            });

        }


        const approval =
            buildApprovalStatus(data);


        return res.json({

            success: true,

            exam_subject: data,

            approval

        });

    } catch (error) {

        console.error(
            "GET EXAM SUBJECT APPROVAL EXCEPTION:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to load examination subject approval status.",

            error:
                error.message

        });

    }

};


// =====================================================
// GET ALL APPROVAL STATUSES FOR AN EXAMINATION
//
// GET /api/exams/:examId/approval-statuses
//
// IMPORTANT:
// Returns one independent status for every exam_subject.
// =====================================================

export const getExamApprovalStatuses = async (
    req,
    res
) => {

    try {

        const {
            examId
        } = req.params;


        if (!examId) {

            return res.status(400).json({

                success: false,

                message:
                    "Exam ID is required."

            });

        }


        const {
            data,
            error
        } = await supabase

            .from("exam_subjects")

            .select(`
                id,
                exam_id,
                subject_id,
                class_id,
                full_marks,
                pass_marks,
                question_selection_type,
                questions_to_answer,
                created_at,
                approval_status,
                approved_by_academic,
                approved_by_deputy,
                approved_by_headmaster,
                approved_at,
                rejection_reason,
                rejected_by,
                rejected_at,
                subjects (
                    id,
                    name
                ),
                classes (
                    id,
                    name
                )
            `)

            .eq(
                "exam_id",
                examId
            )

            .order(
                "id",
                {
                    ascending: true
                }
            );


        if (error) {

            console.error(
                "GET EXAM APPROVAL STATUSES ERROR:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to load examination approval statuses.",

                error:
                    error.message

            });

        }


        const subjects =
            (data || []).map(
                (item) => ({

                    ...item,

                    approval:
                        buildApprovalStatus(item)

                })
            );


        return res.json({

            success: true,

            exam_id: examId,

            count:
                subjects.length,

            exam_subjects:
                subjects

        });

    } catch (error) {

        console.error(
            "GET EXAM APPROVAL STATUSES EXCEPTION:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to load examination approval statuses.",

            error:
                error.message

        });

    }

};


// =====================================================
// APPROVE ONE EXAM SUBJECT
//
// POST /api/exams/exam-subject/:examSubjectId/approve
//
// BODY:
// {
//     type: "academic"
// }
//
// OR
//
// {
//     type: "deputy"
// }
//
// OR
//
// {
//     type: "headmaster"
// }
//
// IMPORTANT:
// This updates ONLY the selected exam_subject.
// It NEVER updates exams.status.
// =====================================================

export const approveExamSubject = async (
    req,
    res
) => {

    try {

        const {
            examSubjectId
        } = req.params;


        const {
            type,
            user_id,
            role
        } = req.body || {};


        if (!examSubjectId) {

            return res.status(400).json({

                success: false,

                message:
                    "Exam subject ID is required."

            });

        }


        const approvalType =
            String(type || "")
                .trim()
                .toLowerCase();


        if (
            ![
                "academic",
                "deputy",
                "headmaster"
            ].includes(approvalType)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid approval type. Use academic, deputy, or headmaster."

            });

        }


        // -------------------------------------------------
        // Get current subject approval state
        // -------------------------------------------------

        const {
            data: examSubject,
            error: subjectError
        } = await supabase

            .from("exam_subjects")

            .select(`
                id,
                exam_id,
                subject_id,
                class_id,
                approval_status,
                approved_by_academic,
                approved_by_deputy,
                approved_by_headmaster,
                approved_at,
                rejection_reason,
                rejected_by,
                rejected_at
            `)

            .eq(
                "id",
                examSubjectId
            )

            .single();


        if (subjectError || !examSubject) {

            return res.status(404).json({

                success: false,

                message:
                    "Examination subject was not found."

            });

        }


        // -------------------------------------------------
        // Do not allow approval after rejection until
        // the rejection has been cleared/restarted.
        // -------------------------------------------------

        if (
            String(
                examSubject.approval_status || ""
            ).toLowerCase() === "rejected"
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "This examination subject has been rejected. It must be restarted before approval."

            });

        }


        const academicApproved =
            Boolean(
                examSubject.approved_by_academic
            );

        const deputyApproved =
            Boolean(
                examSubject.approved_by_deputy
            );

        const headmasterApproved =
            Boolean(
                examSubject.approved_by_headmaster
            );


        // -------------------------------------------------
        // Determine current logged-in role if supplied.
        // -------------------------------------------------

        const normalizedRole =
            normalizeRole(role);


        // -------------------------------------------------
        // ACADEMIC
        // -------------------------------------------------

        if (
            approvalType === "academic"
        ) {

            if (
                academicApproved
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Academic approval has already been completed for this examination subject."

                });

            }


            const {
                data: updated,
                error: updateError
            } = await supabase

                .from("exam_subjects")

                .update({

                    approval_status:
                        "Pending Deputy",

                    approved_by_academic:
                        user_id || null,

                    rejection_reason:
                        null,

                    rejected_by:
                        null,

                    rejected_at:
                        null

                })

                .eq(
                    "id",
                    examSubjectId
                )

                .select(`
                    id,
                    exam_id,
                    subject_id,
                    class_id,
                    approval_status,
                    approved_by_academic,
                    approved_by_deputy,
                    approved_by_headmaster,
                    approved_at,
                    rejection_reason,
                    rejected_by,
                    rejected_at
                `)

                .single();


            if (updateError) {

                console.error(
                    "ACADEMIC APPROVAL ERROR:",
                    updateError
                );


                return res.status(500).json({

                    success: false,

                    message:
                        "Failed to save Academic approval.",

                    error:
                        updateError.message

                });

            }


            return res.json({

                success: true,

                message:
                    "Academic approval completed successfully.",

                approval:
                    buildApprovalStatus(updated)

            });

        }


        // -------------------------------------------------
        // DEPUTY / SECOND MASTER
        // -------------------------------------------------

        if (
            approvalType === "deputy"
        ) {

            if (
                !academicApproved
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Academic approval must be completed before Deputy approval."

                });

            }


            if (
                deputyApproved
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Deputy approval has already been completed for this examination subject."

                });

            }


            const {
                data: updated,
                error: updateError
            } = await supabase

                .from("exam_subjects")

                .update({

                    approval_status:
                        "Pending Headmaster",

                    approved_by_deputy:
                        user_id || null,

                    rejection_reason:
                        null,

                    rejected_by:
                        null,

                    rejected_at:
                        null

                })

                .eq(
                    "id",
                    examSubjectId
                )

                .select(`
                    id,
                    exam_id,
                    subject_id,
                    class_id,
                    approval_status,
                    approved_by_academic,
                    approved_by_deputy,
                    approved_by_headmaster,
                    approved_at,
                    rejection_reason,
                    rejected_by,
                    rejected_at
                `)

                .single();


            if (updateError) {

                console.error(
                    "DEPUTY APPROVAL ERROR:",
                    updateError
                );


                return res.status(500).json({

                    success: false,

                    message:
                        "Failed to save Deputy approval.",

                    error:
                        updateError.message

                });

            }


            return res.json({

                success: true,

                message:
                    "Deputy approval completed successfully.",

                approval:
                    buildApprovalStatus(updated)

            });

        }


        // -------------------------------------------------
        // HEADMASTER
        // -------------------------------------------------

        if (
            approvalType === "headmaster"
        ) {

            if (
                !academicApproved
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Academic approval must be completed first."

                });

            }


            if (
                !deputyApproved
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Deputy approval must be completed before Headmaster approval."

                });

            }


            if (
                headmasterApproved
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Headmaster approval has already been completed for this examination subject."

                });

            }


            const {
                data: updated,
                error: updateError
            } = await supabase

                .from("exam_subjects")

                .update({

                    approval_status:
                        "Approved",

                    approved_by_headmaster:
                        user_id || null,

                    approved_at:
                        new Date().toISOString(),

                    rejection_reason:
                        null,

                    rejected_by:
                        null,

                    rejected_at:
                        null

                })

                .eq(
                    "id",
                    examSubjectId
                )

                .select(`
                    id,
                    exam_id,
                    subject_id,
                    class_id,
                    approval_status,
                    approved_by_academic,
                    approved_by_deputy,
                    approved_by_headmaster,
                    approved_at,
                    rejection_reason,
                    rejected_by,
                    rejected_at
                `)

                .single();


            if (updateError) {

                console.error(
                    "HEADMASTER APPROVAL ERROR:",
                    updateError
                );


                return res.status(500).json({

                    success: false,

                    message:
                        "Failed to save Headmaster approval.",

                    error:
                        updateError.message

                });

            }


            return res.json({

                success: true,

                message:
                    "Examination subject has been fully approved.",

                approval:
                    buildApprovalStatus(updated)

            });

        }


        return res.status(400).json({

            success: false,

            message:
                "Unsupported approval action."

        });

    } catch (error) {

        console.error(
            "APPROVE EXAM SUBJECT EXCEPTION:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to approve examination subject.",

            error:
                error.message

        });

    }

};


// =====================================================
// REJECT ONE EXAM SUBJECT
//
// POST /api/exams/exam-subject/:examSubjectId/reject
//
// BODY:
// {
//     reason: "...",
//     rejected_by: "uuid"
// }
//
// IMPORTANT:
// Only selected exam_subject is rejected.
// Parent exams.status is NOT touched.
// =====================================================

export const rejectExamSubject = async (
    req,
    res
) => {

    try {

        const {
            examSubjectId
        } = req.params;


        const {
            reason,
            rejected_by
        } = req.body || {};


        if (!examSubjectId) {

            return res.status(400).json({

                success: false,

                message:
                    "Exam subject ID is required."

            });

        }


        const cleanReason =
            String(reason || "")
                .trim();


        if (!cleanReason) {

            return res.status(400).json({

                success: false,

                message:
                    "A rejection reason is required."

            });

        }


        const {
            data: existing,
            error: existingError
        } = await supabase

            .from("exam_subjects")

            .select(`
                id,
                exam_id,
                subject_id,
                class_id,
                approval_status
            `)

            .eq(
                "id",
                examSubjectId
            )

            .single();


        if (
            existingError ||
            !existing
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Examination subject was not found."

            });

        }


        const {
            data: updated,
            error
        } = await supabase

            .from("exam_subjects")

            .update({

                approval_status:
                    "Rejected",

                rejection_reason:
                    cleanReason,

                rejected_by:
                    rejected_by || null,

                rejected_at:
                    new Date().toISOString()

            })

            .eq(
                "id",
                examSubjectId
            )

            .select(`
                id,
                exam_id,
                subject_id,
                class_id,
                approval_status,
                approved_by_academic,
                approved_by_deputy,
                approved_by_headmaster,
                approved_at,
                rejection_reason,
                rejected_by,
                rejected_at
            `)

            .single();


        if (error) {

            console.error(
                "REJECT EXAM SUBJECT ERROR:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to reject examination subject.",

                error:
                    error.message

            });

        }


        return res.json({

            success: true,

            message:
                "Examination subject rejected successfully.",

            approval:
                buildApprovalStatus(updated)

        });

    } catch (error) {

        console.error(
            "REJECT EXAM SUBJECT EXCEPTION:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to reject examination subject.",

            error:
                error.message

        });

    }

};


// =====================================================
// RESET / RESTART ONE EXAM SUBJECT APPROVAL
//
// POST /api/exams/exam-subject/:examSubjectId/reset-approval
//
// Used after a rejected paper needs to go through the
// approval chain again.
//
// IMPORTANT:
// Only the selected exam_subject is reset.
// =====================================================

export const resetExamSubjectApproval = async (
    req,
    res
) => {

    try {

        const {
            examSubjectId
        } = req.params;


        if (!examSubjectId) {

            return res.status(400).json({

                success: false,

                message:
                    "Exam subject ID is required."

            });

        }


        const {
            data,
            error
        } = await supabase

            .from("exam_subjects")

            .update({

                approval_status:
                    "Pending",

                approved_by_academic:
                    null,

                approved_by_deputy:
                    null,

                approved_by_headmaster:
                    null,

                approved_at:
                    null,

                rejection_reason:
                    null,

                rejected_by:
                    null,

                rejected_at:
                    null

            })

            .eq(
                "id",
                examSubjectId
            )

            .select(`
                id,
                exam_id,
                subject_id,
                class_id,
                approval_status,
                approved_by_academic,
                approved_by_deputy,
                approved_by_headmaster,
                approved_at,
                rejection_reason,
                rejected_by,
                rejected_at
            `)

            .single();


        if (error) {

            console.error(
                "RESET EXAM SUBJECT APPROVAL ERROR:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to reset examination subject approval.",

                error:
                    error.message

            });

        }


        return res.json({

            success: true,

            message:
                "Examination subject approval has been restarted.",

            approval:
                buildApprovalStatus(data)

        });

    } catch (error) {

        console.error(
            "RESET EXAM SUBJECT APPROVAL EXCEPTION:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to reset examination subject approval.",

            error:
                error.message

        });

    }

};