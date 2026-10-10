import { getUserAccess } from "../services/permissionService.js";
import { supabase } from "../config/supabase.js";

/**
 * Resolve school ownership from the authenticated database profile.
 * Never trust a school_id supplied by a non-Super-Admin request.
 */
export const requireSchoolContext = async (req, res, next) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });
        }

        const access = await getUserAccess(req.user.id);
        const profile = access?.profile;

        if (!profile) {
            return res.status(403).json({
                success: false,
                message: "Your system profile could not be found."
            });
        }

        const isSuperAdmin = access.isSuperAdmin === true;
        const schoolId = profile.school_id == null
            ? null
            : Number(profile.school_id);

        if (!isSuperAdmin && (!Number.isInteger(schoolId) || schoolId <= 0)) {
            return res.status(403).json({
                success: false,
                message: "Your account is not assigned to a valid school."
            });
        }

        const requestedIds = [
            req.query?.school_id,
            req.body?.school_id
        ].filter(value => value !== undefined && value !== null && value !== "");

        if (!isSuperAdmin && requestedIds.some(value => Number(value) !== schoolId)) {
            return res.status(403).json({
                success: false,
                message: "You can only access data belonging to your own school."
            });
        }

        // Controllers must use this profile-derived value, not client metadata.
        req.user.school_id = isSuperAdmin ? null : schoolId;
        req.schoolContext = {
            schoolId,
            isSuperAdmin,
            profileId: profile.id
        };

        return next();
    } catch (error) {
        console.error("SCHOOL CONTEXT MIDDLEWARE ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to verify your school access."
        });
    }
};


/**
 * Validate ownership of exam-related route parameters and request IDs.
 * This is needed because backend Supabase access uses a service key.
 */
export const requireExamSchoolScope = async (req, res, next) => {
    try {
        if (req.schoolContext?.isSuperAdmin) {
            return next();
        }

        const schoolId = Number(req.schoolContext?.schoolId);
        if (!Number.isInteger(schoolId) || schoolId <= 0) {
            return res.status(403).json({
                success: false,
                message: "A verified school is required."
            });
        }

        let examId = null;

        if (req.params?.examSubjectId) {
            const { data: subject, error } = await supabase
                .from("exam_subjects")
                .select("id, exam_id")
                .eq("id", Number(req.params.examSubjectId))
                .maybeSingle();

            if (error) throw error;
            if (!subject) {
                return res.status(404).json({
                    success: false,
                    message: "Exam subject was not found."
                });
            }
            examId = Number(subject.exam_id);
        } else if (req.params?.paperId) {
            const { data: paper, error } = await supabase
                .from("exam_papers")
                .select("id, exam_id")
                .eq("id", Number(req.params.paperId))
                .maybeSingle();

            if (error) throw error;
            if (!paper) {
                return res.status(404).json({
                    success: false,
                    message: "Examination paper was not found."
                });
            }
            examId = Number(paper.exam_id);
        } else {
            const candidate = req.params?.examId
                ?? req.params?.id
                ?? req.body?.exam_id
                ?? req.query?.exam_id;

            if (candidate !== undefined && candidate !== null && candidate !== "") {
                examId = Number(candidate);
            }
        }

        if (examId === null) {
            if (req.body?.exam_subject_id) {
                const { data: subject, error } = await supabase
                    .from("exam_subjects")
                    .select("id, exam_id")
                    .eq("id", Number(req.body.exam_subject_id))
                    .maybeSingle();

                if (error) throw error;
                if (!subject) {
                    return res.status(404).json({
                        success: false,
                        message: "Exam subject was not found."
                    });
                }
                examId = Number(subject.exam_id);
            } else {
                return next();
            }
        }

        if (!Number.isInteger(examId) || examId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid examination ID."
            });
        }

        const { data: exam, error: examError } = await supabase
            .from("exams")
            .select("id, school_id")
            .eq("id", examId)
            .eq("school_id", schoolId)
            .maybeSingle();

        if (examError) throw examError;
        if (!exam) {
            return res.status(404).json({
                success: false,
                message: "Examination not found in your school."
            });
        }

        return next();
    } catch (error) {
        console.error("EXAM SCHOOL SCOPE ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to verify examination ownership."
        });
    }
};
