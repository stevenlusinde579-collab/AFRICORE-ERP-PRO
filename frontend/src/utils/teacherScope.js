import { supabase } from "../services/supabase";

/**
 * ============================================================
 * AFRICORE ERP
 * TEACHER DATA SCOPE
 * ============================================================
 *
 * Purpose:
 * Determine which subjects and classes belong to the
 * currently logged-in teacher.
 *
 * Database relationship confirmed from existing application:
 *
 * profiles.teacher_id
 *        ↓
 * teacher_assignments.teacher_id
 *        ↓
 * teacher_assignments.subject_id
 * teacher_assignments.class_id
 *
 * IMPORTANT:
 * This helper does NOT create or modify any database records.
 *
 * It only reads the existing teacher assignment structure.
 * ============================================================
 */

export const getCurrentTeacherScope = async () => {
    try {
        // ----------------------------------------------------
        // 1. Get currently logged-in Supabase user
        // ----------------------------------------------------

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
            console.error(
                "TEACHER SCOPE AUTH ERROR:",
                authError
            );

            return {
                success: false,
                error: authError,
                user: null,
                profile: null,
                teacherId: null,
                assignments: [],
                subjectIds: [],
                classIds: [],
            };
        }

        if (!user) {
            return {
                success: false,
                error: new Error("No authenticated user found"),
                user: null,
                profile: null,
                teacherId: null,
                assignments: [],
                subjectIds: [],
                classIds: [],
            };
        }

        // ----------------------------------------------------
        // 2. Get user's profile
        //
        // Confirmed profile fields:
        // id
        // role_id
        // employee_id
        // teacher_id
        // school_id
        // ----------------------------------------------------

        const {
            data: profile,
            error: profileError,
        } = await supabase
            .from("profiles")
            .select(`
                id,
                role_id,
                employee_id,
                teacher_id,
                school_id
            `)
            .eq("id", user.id)
            .single();

        if (profileError) {
            console.error(
                "TEACHER SCOPE PROFILE ERROR:",
                profileError
            );

            return {
                success: false,
                error: profileError,
                user,
                profile: null,
                teacherId: null,
                assignments: [],
                subjectIds: [],
                classIds: [],
            };
        }

        // ----------------------------------------------------
        // 3. Make sure this profile is connected to a teacher
        // ----------------------------------------------------

        if (!profile?.teacher_id) {
            console.warn(
                "TEACHER SCOPE: Profile has no teacher_id"
            );

            return {
                success: true,
                error: null,
                user,
                profile,
                teacherId: null,
                assignments: [],
                subjectIds: [],
                classIds: [],
            };
        }

        const teacherId = profile.teacher_id;

        // ----------------------------------------------------
        // 4. Get teacher assignments
        //
        // Confirmed columns:
        // teacher_id
        // subject_id
        // class_id
        // ----------------------------------------------------

        const {
            data: assignments,
            error: assignmentError,
        } = await supabase
            .from("teacher_assignments")
            .select(`
                id,
                teacher_id,
                subject_id,
                class_id
            `)
            .eq("teacher_id", teacherId);

        if (assignmentError) {
            console.error(
                "TEACHER SCOPE ASSIGNMENT ERROR:",
                assignmentError
            );

            return {
                success: false,
                error: assignmentError,
                user,
                profile,
                teacherId,
                assignments: [],
                subjectIds: [],
                classIds: [],
            };
        }

        const safeAssignments = assignments || [];

        // ----------------------------------------------------
        // 5. Extract unique subject IDs
        // ----------------------------------------------------

        const subjectIds = [
            ...new Set(
                safeAssignments
                    .map((item) => item.subject_id)
                    .filter(
                        (id) =>
                            id !== null &&
                            id !== undefined &&
                            id !== ""
                    )
            ),
        ];

        // ----------------------------------------------------
        // 6. Extract unique class IDs
        // ----------------------------------------------------

        const classIds = [
            ...new Set(
                safeAssignments
                    .map((item) => item.class_id)
                    .filter(
                        (id) =>
                            id !== null &&
                            id !== undefined &&
                            id !== ""
                    )
            ),
        ];

        // ----------------------------------------------------
        // 7. Return complete scope
        // ----------------------------------------------------

        return {
            success: true,
            error: null,

            user,

            profile,

            teacherId,

            assignments: safeAssignments,

            subjectIds,

            classIds,
        };

    } catch (error) {
        console.error(
            "TEACHER SCOPE UNEXPECTED ERROR:",
            error
        );

        return {
            success: false,
            error,

            user: null,

            profile: null,

            teacherId: null,

            assignments: [],

            subjectIds: [],

            classIds: [],
        };
    }
};


/**
 * ============================================================
 * CHECK WHETHER A SUBJECT BELONGS TO THE CURRENT TEACHER
 * ============================================================
 */

export const teacherHasSubject = async (subjectId) => {

    const scope = await getCurrentTeacherScope();

    if (!scope.success) {
        return false;
    }

    if (!subjectId) {
        return false;
    }

    return scope.subjectIds.some(
        (id) => String(id) === String(subjectId)
    );
};


/**
 * ============================================================
 * CHECK WHETHER A CLASS BELONGS TO THE CURRENT TEACHER
 * ============================================================
 */

export const teacherHasClass = async (classId) => {

    const scope = await getCurrentTeacherScope();

    if (!scope.success) {
        return false;
    }

    if (!classId) {
        return false;
    }

    return scope.classIds.some(
        (id) => String(id) === String(classId)
    );
};


/**
 * ============================================================
 * CHECK EXACT SUBJECT + CLASS ASSIGNMENT
 * ============================================================
 *
 * This is more important than checking subject or class
 * independently.
 *
 * Example:
 *
 * Teacher teaches Chemistry in Form 2.
 *
 * An unrelated Chemistry assignment in Form 4 should NOT
 * automatically be treated as allowed.
 * ============================================================
 */

export const teacherHasAssignment = async (
    subjectId,
    classId
) => {

    const scope = await getCurrentTeacherScope();

    if (!scope.success) {
        return false;
    }

    if (!subjectId || !classId) {
        return false;
    }

    return scope.assignments.some(
        (assignment) =>
            String(assignment.subject_id) === String(subjectId) &&
            String(assignment.class_id) === String(classId)
    );
};