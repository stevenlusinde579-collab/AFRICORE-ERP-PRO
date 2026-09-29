import { supabase } from "../config/supabase.js";

import {
    getUserAccess,
    getUserPermission,
} from "./permissionService.js";

/**
 * ============================================================
 * AFRICORE ERP
 * ACCESS SCOPE SERVICE
 * ============================================================
 *
 * Central service for resolving DATA ACCESS SCOPE.
 *
 * Authentication answers:
 *
 *     "Who is this user?"
 *
 * Permission answers:
 *
 *     "What can this user do?"
 *
 * Scope answers:
 *
 *     "Which records can this user access?"
 *
 * Architecture:
 *
 * Supabase Auth
 *       ↓
 * profiles
 *       ↓
 * profile_roles
 *       ↓
 * roles
 *       ↓
 * role_permissions
 *       ↓
 * permissions
 *       ↓
 * role_permission_scopes
 *       ↓
 * ACCESS SCOPE SERVICE
 *
 * IMPORTANT:
 *
 * We are NOT applying scopes directly to modules yet.
 *
 * This service first resolves the user's access rules.
 *
 * Existing modules will be connected later one by one.
 *
 * ============================================================
 */


/**
 * ============================================================
 * SUPPORTED SCOPE TYPES
 * ============================================================
 */

export const SCOPE_TYPES = {
    ALL_SCHOOL:
        "ALL_SCHOOL",

    ASSIGNED_CLASS:
        "ASSIGNED_CLASS",

    ASSIGNED_SUBJECT:
        "ASSIGNED_SUBJECT",

    ASSIGNED_SUBJECT_CLASS:
        "ASSIGNED_SUBJECT_CLASS",

    OWN_RECORDS:
        "OWN_RECORDS",

    LINKED_STUDENT:
        "LINKED_STUDENT",

    OWN_DEPARTMENT:
        "OWN_DEPARTMENT",

    OWN_EMPLOYEE_RECORD:
        "OWN_EMPLOYEE_RECORD",

    ASSIGNED_DUTY:
        "ASSIGNED_DUTY",

    ASSIGNED_HOSTEL:
        "ASSIGNED_HOSTEL",

    ASSIGNED_ACTIVITY:
        "ASSIGNED_ACTIVITY",
};


/**
 * ============================================================
 * getUserProfile
 * ============================================================
 *
 * Loads the AfriCore profile belonging to the authenticated
 * Supabase user.
 *
 * We intentionally use profiles.id = authenticated user ID.
 *
 * ============================================================
 */

export const getUserProfile = async (
    userId
) => {
    if (!userId) {
        throw new Error(
            "User ID is required."
        );
    }

    const {
        data,
        error,
    } = await supabase
        .from("profiles")
        .select(`
            id,
            full_name,
            phone,
            role_id,
            school_id,
            teacher_id,
            employee_id,
            created_at
        `)
        .eq(
            "id",
            userId
        )
        .maybeSingle();

    if (error) {
        throw new Error(
            `Unable to load user profile: ${error.message}`
        );
    }

    return data || null;
};


/**
 * ============================================================
 * getUserScopeDefinitions
 * ============================================================
 *
 * Returns all active scopes belonging to all active roles of
 * the authenticated user.
 *
 * We use permissionService as the central role/permission
 * resolver.
 *
 * ============================================================
 */

export const getUserScopeDefinitions =
    async (
        userId
    ) => {

        if (!userId) {
            throw new Error(
                "User ID is required."
            );
        }

        const access =
            await getUserAccess(
                userId
            );

        return {
            profile:
                access.profile ||
                null,

            roles:
                access.roles ||
                [],

            permissions:
                access.permissions ||
                [],

            role_permissions:
                access.role_permissions ||
                [],

            scopes:
                access.scopes ||
                [],

            isSuperAdmin:
                Boolean(
                    access.isSuperAdmin
                ),
        };
    };


/**
 * ============================================================
 * getScopesForPermission
 * ============================================================
 *
 * Returns only the scopes associated with one permission.
 *
 * Example:
 *
 * EXAM_ENTER_MARKS
 *
 * may resolve to:
 *
 * ASSIGNED_SUBJECT_CLASS
 *
 * ============================================================
 */

export const getScopesForPermission =
    async (
        userId,
        permissionName
    ) => {

        if (
            !userId ||
            !permissionName
        ) {
            return [];
        }

        const permission =
            await getUserPermission(
                userId,
                permissionName
            );

        if (!permission) {
            return [];
        }

        if (
            permission.isSuperAdmin
        ) {
            return [
                {
                    scope_type:
                        SCOPE_TYPES.ALL_SCHOOL,

                    is_active:
                        true,
                },
            ];
        }

        return (
            permission.scopes ||
            []
        );
    };


/**
 * ============================================================
 * hasScope
 * ============================================================
 *
 * Checks whether the user has a particular scope for a
 * permission.
 *
 * Super Admin automatically passes ALL_SCHOOL.
 *
 * ============================================================
 */

export const hasScope = async (
    userId,
    permissionName,
    scopeType
) => {

    if (
        !userId ||
        !permissionName ||
        !scopeType
    ) {
        return false;
    }

    const permission =
        await getUserPermission(
            userId,
            permissionName
        );

    if (!permission) {
        return false;
    }

    if (
        permission.isSuperAdmin
    ) {
        return true;
    }

    const scopes =
        permission.scopes ||
        [];

    return scopes.some(
        (scope) =>
            scope.scope_type ===
                scopeType &&
            scope.is_active === true
    );
};


/**
 * ============================================================
 * getTeacherAssignments
 * ============================================================
 *
 * IMPORTANT:
 *
 * teacher_assignments is the verified source we currently use
 * for teacher subject/class assignment.
 *
 * We do NOT assume teacher_subjects or teacher_classes here.
 *
 * ============================================================
 */

export const getTeacherAssignments =
    async (
        teacherId
    ) => {

        if (!teacherId) {
            return [];
        }

        const {
            data,
            error,
        } = await supabase
            .from(
                "teacher_assignments"
            )
            .select(`
                id,
                school_id,
                teacher_id,
                subject_id,
                class_id,
                created_at
            `)
            .eq(
                "teacher_id",
                teacherId
            )
            .order(
                "id",
                {
                    ascending:
                        true,
                }
            );

        if (error) {
            throw new Error(
                `Unable to load teacher assignments: ${error.message}`
            );
        }

        return data || [];
    };


/**
 * ============================================================
 * resolveAssignedSubjectClassScope
 * ============================================================
 *
 * Resolves ASSIGNED_SUBJECT_CLASS.
 *
 * Example:
 *
 * Teacher:
 *     teacher_id = 3
 *
 * Assignments:
 *
 *     Physics     → Form 1
 *     Mathematics → Form 2
 *
 * Result:
 *
 * [
 *     {
 *         subject_id: 21,
 *         class_id: 29
 *     },
 *     {
 *         subject_id: 16,
 *         class_id: 30
 *     }
 * ]
 *
 * ============================================================
 */

export const resolveAssignedSubjectClassScope =
    async (
        userId
    ) => {

        const profile =
            await getUserProfile(
                userId
            );

        if (!profile) {
            return {
                allowed:
                    false,

                scope_type:
                    SCOPE_TYPES
                        .ASSIGNED_SUBJECT_CLASS,

                teacher_id:
                    null,

                assignments: [],
            };
        }

        if (!profile.teacher_id) {
            return {
                allowed:
                    false,

                scope_type:
                    SCOPE_TYPES
                        .ASSIGNED_SUBJECT_CLASS,

                teacher_id:
                    null,

                assignments: [],
            };
        }

        const assignments =
            await getTeacherAssignments(
                profile.teacher_id
            );

        return {
            allowed:
                assignments.length >
                0,

            scope_type:
                SCOPE_TYPES
                    .ASSIGNED_SUBJECT_CLASS,

            teacher_id:
                profile.teacher_id,

            assignments,
        };
    };


/**
 * ============================================================
 * assignmentMatches
 * ============================================================
 *
 * Checks whether a particular subject/class combination is
 * assigned to a teacher.
 *
 * This is intentionally reusable by future modules.
 *
 * ============================================================
 */

export const assignmentMatches =
    (
        assignments,
        subjectId,
        classId
    ) => {

        if (
            !Array.isArray(
                assignments
            )
        ) {
            return false;
        }

        if (
            subjectId === null ||
            subjectId === undefined ||
            classId === null ||
            classId === undefined
        ) {
            return false;
        }

        return assignments.some(
            (assignment) =>
                Number(
                    assignment.subject_id
                ) ===
                    Number(
                        subjectId
                    ) &&
                Number(
                    assignment.class_id
                ) ===
                    Number(
                        classId
                    )
        );
    };


/**
 * ============================================================
 * canAccessAssignedSubjectClass
 * ============================================================
 *
 * Complete permission + scope check for:
 *
 * ASSIGNED_SUBJECT_CLASS
 *
 * Example:
 *
 * canAccessAssignedSubjectClass(
 *     userId,
 *     "EXAM_ENTER_MARKS",
 *     21,
 *     29
 * )
 *
 * ============================================================
 */

export const canAccessAssignedSubjectClass =
    async (
        userId,
        permissionName,
        subjectId,
        classId
    ) => {

        if (
            !userId ||
            !permissionName ||
            subjectId ===
                undefined ||
            subjectId === null ||
            classId ===
                undefined ||
            classId === null
        ) {
            return {
                allowed:
                    false,

                reason:
                    "Missing access information.",
            };
        }

        const permission =
            await getUserPermission(
                userId,
                permissionName
            );

        if (!permission) {
            return {
                allowed:
                    false,

                reason:
                    "User does not have the required permission.",
            };
        }

        if (
            permission.isSuperAdmin
        ) {
            return {
                allowed:
                    true,

                reason:
                    "Super Admin has full system access.",

                scope_type:
                    SCOPE_TYPES
                        .ALL_SCHOOL,
            };
        }

        const hasAssignedScope =
            (
                permission.scopes ||
                []
            ).some(
                (scope) =>
                    scope.scope_type ===
                        SCOPE_TYPES
                            .ASSIGNED_SUBJECT_CLASS &&
                    scope.is_active ===
                        true
            );

        if (!hasAssignedScope) {
            return {
                allowed:
                    false,

                reason:
                    "User does not have ASSIGNED_SUBJECT_CLASS scope for this permission.",
            };
        }

        const scopeResult =
            await resolveAssignedSubjectClassScope(
                userId
            );

        if (
            !scopeResult.allowed
        ) {
            return {
                allowed:
                    false,

                reason:
                    "Teacher has no active subject/class assignments.",
            };
        }

        const matches =
            assignmentMatches(
                scopeResult.assignments,
                subjectId,
                classId
            );

        if (!matches) {
            return {
                allowed:
                    false,

                reason:
                    "The requested subject/class is not assigned to this teacher.",
            };
        }

        return {
            allowed:
                true,

            reason:
                "Subject/class is assigned to this teacher.",

            scope_type:
                SCOPE_TYPES
                    .ASSIGNED_SUBJECT_CLASS,

            teacher_id:
                scopeResult.teacher_id,

            subject_id:
                subjectId,

            class_id:
                classId,
        };
    };


/**
 * ============================================================
 * resolveUserScopes
 * ============================================================
 *
 * Returns a complete high-level access description.
 *
 * This function is useful for:
 *
 * - AuthContext
 * - Permission Management UI
 * - Access diagnostics
 * - Future API middleware
 *
 * ============================================================
 */

export const resolveUserScopes =
    async (
        userId
    ) => {

        if (!userId) {
            throw new Error(
                "User ID is required."
            );
        }

        const access =
            await getUserScopeDefinitions(
                userId
            );

        if (!access.profile) {
            return {
                userId,
                profile:
                    null,
                roles: [],
                permissions: [],
                scopes: [],
                isSuperAdmin:
                    false,
                resolvedScopes: [],
            };
        }

        const resolvedScopes =
            [];

        /**
         * --------------------------------------------------------
         * SUPER ADMIN
         * --------------------------------------------------------
         */

        if (
            access.isSuperAdmin
        ) {
            resolvedScopes.push({
                scope_type:
                    SCOPE_TYPES
                        .ALL_SCHOOL,

                applies_to:
                    "ALL_SCHOOL",

                resolved:
                    true,
            });

            return {
                userId,

                profile:
                    access.profile,

                roles:
                    access.roles,

                permissions:
                    access.permissions,

                scopes:
                    access.scopes,

                isSuperAdmin:
                    true,

                resolvedScopes,
            };
        }

        /**
         * --------------------------------------------------------
         * NORMAL USER SCOPES
         * --------------------------------------------------------
         */

        const uniqueScopes =
            [
                ...new Set(
                    (
                        access.scopes ||
                        []
                    )
                        .filter(
                            (
                                scope
                            ) =>
                                scope.is_active ===
                                true
                        )
                        .map(
                            (
                                scope
                            ) =>
                                scope.scope_type
                        )
                ),
            ];

        for (
            const scopeType of
            uniqueScopes
        ) {

            resolvedScopes.push({
                scope_type:
                    scopeType,

                resolved:
                    true,
            });
        }

        /**
         * --------------------------------------------------------
         * ASSIGNED SUBJECT CLASS
         * --------------------------------------------------------
         */

        if (
            uniqueScopes.includes(
                SCOPE_TYPES
                    .ASSIGNED_SUBJECT_CLASS
            )
        ) {

            const assignedScope =
                await resolveAssignedSubjectClassScope(
                    userId
                );

            resolvedScopes.push({
                scope_type:
                    SCOPE_TYPES
                        .ASSIGNED_SUBJECT_CLASS,

                resolved:
                    assignedScope
                        .allowed,

                teacher_id:
                    assignedScope
                        .teacher_id,

                assignments:
                    assignedScope
                        .assignments,
            });
        }

        return {
            userId,

            profile:
                access.profile,

            roles:
                access.roles,

            permissions:
                access.permissions,

            scopes:
                access.scopes,

            isSuperAdmin:
                access.isSuperAdmin,

            resolvedScopes,
        };
    };


/**
 * ============================================================
 * getAccessDecision
 * ============================================================
 *
 * Generic access decision helper.
 *
 * Currently supports:
 *
 * - ALL_SCHOOL
 * - ASSIGNED_SUBJECT_CLASS
 *
 * Other scope types are deliberately NOT guessed yet.
 *
 * They will be implemented after their real database
 * relationships are verified.
 *
 * ============================================================
 */

export const getAccessDecision =
    async (
        userId,
        permissionName,
        context = {}
    ) => {

        if (
            !userId ||
            !permissionName
        ) {
            return {
                allowed:
                    false,

                reason:
                    "User ID and permission are required.",
            };
        }

        const permission =
            await getUserPermission(
                userId,
                permissionName
            );

        if (!permission) {
            return {
                allowed:
                    false,

                reason:
                    "Required permission was not granted.",
            };
        }

        /**
         * --------------------------------------------------------
         * SUPER ADMIN
         * --------------------------------------------------------
         */

        if (
            permission.isSuperAdmin
        ) {
            return {
                allowed:
                    true,

                scope_type:
                    SCOPE_TYPES
                        .ALL_SCHOOL,

                reason:
                    "Super Admin has full system access.",
            };
        }

        const scopes =
            (
                permission.scopes ||
                []
            ).filter(
                (
                    scope
                ) =>
                    scope.is_active ===
                    true
            );

        /**
         * --------------------------------------------------------
         * ALL SCHOOL
         * --------------------------------------------------------
         */

        if (
            scopes.some(
                (
                    scope
                ) =>
                    scope.scope_type ===
                    SCOPE_TYPES
                        .ALL_SCHOOL
            )
        ) {
            return {
                allowed:
                    true,

                scope_type:
                    SCOPE_TYPES
                        .ALL_SCHOOL,

                reason:
                    "User has ALL_SCHOOL scope for this permission.",
            };
        }

        /**
         * --------------------------------------------------------
         * ASSIGNED SUBJECT CLASS
         * --------------------------------------------------------
         */

        if (
            scopes.some(
                (
                    scope
                ) =>
                    scope.scope_type ===
                    SCOPE_TYPES
                        .ASSIGNED_SUBJECT_CLASS
            )
        ) {

            const result =
                await canAccessAssignedSubjectClass(
                    userId,
                    permissionName,
                    context.subjectId,
                    context.classId
                );

            return result;
        }

        /**
         * --------------------------------------------------------
         * OTHER SCOPES
         * --------------------------------------------------------
         *
         * We deliberately do NOT guess how these scopes map to
         * database tables.
         *
         * They will be implemented when their relationships are
         * verified.
         * --------------------------------------------------------
         */

        return {
            allowed:
                false,

            reason:
                "Permission exists, but its data scope has not yet been resolved by the central scope engine.",

            available_scopes:
                scopes.map(
                    (
                        scope
                    ) =>
                        scope.scope_type
                ),
        };
    };


/**
 * ============================================================
 * DEFAULT EXPORT
 * ============================================================
 *
 * Named exports above are preferred.
 *
 * This default export makes the service convenient to import
 * as one object if needed later.
 *
 * ============================================================
 */

export default {
    SCOPE_TYPES,

    getUserProfile,

    getUserScopeDefinitions,

    getScopesForPermission,

    hasScope,

    getTeacherAssignments,

    resolveAssignedSubjectClassScope,

    assignmentMatches,

    canAccessAssignedSubjectClass,

    resolveUserScopes,

    getAccessDecision,
};