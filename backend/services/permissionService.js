import { supabase } from "../config/supabase.js";

/**
 * ============================================================
 * AFRICORE ERP - PERMISSION SERVICE
 * ============================================================
 *
 * ACCESS MODEL
 *
 * Super Admin
 *  -> Full access to all schools
 *
 * Headmaster
 *  -> Full access to his/her own school
 *
 * Other roles
 *  -> Access according to assigned permissions
 *
 * IMPORTANT:
 * - profiles.role_id remains for backward compatibility.
 * - profile_roles is the canonical role source.
 * - Only active profile_roles are used.
 * - Headmaster does not need individual permissions.
 * - Headmaster is NOT treated as global Super Admin.
 * - Headmaster remains restricted to profile.school_id.
 * ============================================================
 */

const SUPER_ADMIN_ROLE = "Super Admin";
const HEADMASTER_ROLE = "Headmaster";

/**
 * ------------------------------------------------------------
 * GET PROFILE
 * ------------------------------------------------------------
 */
export const getProfileByUserId = async (userId) => {

    if (!userId) {
        throw new Error("User ID is required.");
    }

    const {
        data,
        error
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
        .eq("id", userId)
        .maybeSingle();

    if (error) {
        throw new Error(
            `Unable to load profile: ${error.message}`
        );
    }

    if (!data) {
        return null;
    }

    return data;
};


/**
 * ------------------------------------------------------------
 * GET ACTIVE PROFILE ROLES
 * ------------------------------------------------------------
 */
export const getProfileRoles = async (profileId) => {

    if (!profileId) {
        throw new Error("Profile ID is required.");
    }

    const {
        data,
        error
    } = await supabase
        .from("profile_roles")
        .select(`
            id,
            profile_id,
            role_id,
            school_id,
            is_primary,
            is_active,
            created_at
        `)
        .eq("profile_id", profileId)
        .eq("is_active", true)
        .order("is_primary", {
            ascending: false
        })
        .order("id", {
            ascending: true
        });

    if (error) {
        throw new Error(
            `Unable to load profile roles: ${error.message}`
        );
    }

    return data || [];
};


/**
 * ------------------------------------------------------------
 * GET ROLES
 * ------------------------------------------------------------
 */
export const getRolesByIds = async (roleIds) => {

    if (
        !Array.isArray(roleIds) ||
        roleIds.length === 0
    ) {
        return [];
    }

    const {
        data,
        error
    } = await supabase
        .from("roles")
        .select(`
            id,
            role_name,
            description,
            created_at
        `)
        .in("id", roleIds);

    if (error) {
        throw new Error(
            `Unable to load roles: ${error.message}`
        );
    }

    return data || [];
};


/**
 * ------------------------------------------------------------
 * GET ROLE PERMISSIONS
 * ------------------------------------------------------------
 */
export const getRolePermissions = async (roleIds) => {

    if (
        !Array.isArray(roleIds) ||
        roleIds.length === 0
    ) {
        return [];
    }

    const {
        data,
        error
    } = await supabase
        .from("role_permissions")
        .select(`
            id,
            role_id,
            permission_id,
            created_at
        `)
        .in("role_id", roleIds);

    if (error) {
        throw new Error(
            `Unable to load role permissions: ${error.message}`
        );
    }

    return data || [];
};


/**
 * ------------------------------------------------------------
 * GET PERMISSIONS
 * ------------------------------------------------------------
 */
export const getPermissionsByIds = async (permissionIds) => {

    if (
        !Array.isArray(permissionIds) ||
        permissionIds.length === 0
    ) {
        return [];
    }

    const {
        data,
        error
    } = await supabase
        .from("permissions")
        .select(`
            id,
            permission_name,
            module,
            created_at
        `)
        .in("id", permissionIds);

    if (error) {
        throw new Error(
            `Unable to load permissions: ${error.message}`
        );
    }

    return data || [];
};


/**
 * ------------------------------------------------------------
 * GET PERMISSION SCOPES
 * ------------------------------------------------------------
 */
export const getPermissionScopes = async (
    rolePermissionIds
) => {

    if (
        !Array.isArray(rolePermissionIds) ||
        rolePermissionIds.length === 0
    ) {
        return [];
    }

    const {
        data,
        error
    } = await supabase
        .from("role_permission_scopes")
        .select(`
            id,
            role_permission_id,
            scope_type,
            is_active,
            created_at
        `)
        .in("role_permission_id", rolePermissionIds)
        .eq("is_active", true);

    if (error) {
        throw new Error(
            `Unable to load permission scopes: ${error.message}`
        );
    }

    return data || [];
};


/**
 * ============================================================
 * GET USER ACCESS
 * ============================================================
 */
export const getUserAccess = async (userId) => {

    if (!userId) {
        throw new Error("User ID is required.");
    }


    /**
     * --------------------------------------------------------
     * 1. PROFILE
     * --------------------------------------------------------
     */
    const profile =
        await getProfileByUserId(userId);


    if (!profile) {

        return {
            profile: null,
            profile_roles: [],
            roles: [],
            permissions: [],
            scopes: [],
            role_permissions: [],
            permissionMap: {},
            roleMap: {},
            isSuperAdmin: false,
            isHeadmaster: false,
            isSchoolAdmin: false,
            schoolId: null
        };

    }


    /**
     * --------------------------------------------------------
     * 2. ACTIVE PROFILE ROLES
     * --------------------------------------------------------
     */
    const profileRoles =
        await getProfileRoles(profile.id);


    let effectiveRoleIds =
        profileRoles
            .map((item) => item.role_id)
            .filter(Boolean);


    /**
     * Backward compatibility
     */
    if (
        effectiveRoleIds.length === 0 &&
        profile.role_id
    ) {

        effectiveRoleIds = [
            profile.role_id
        ];

    }


    effectiveRoleIds = [
        ...new Set(effectiveRoleIds)
    ];


    /**
     * --------------------------------------------------------
     * 3. ROLES
     * --------------------------------------------------------
     */
    const roles =
        await getRolesByIds(
            effectiveRoleIds
        );


    /**
     * --------------------------------------------------------
     * 4. ROLE PERMISSIONS
     * --------------------------------------------------------
     */
    const rolePermissions =
        await getRolePermissions(
            effectiveRoleIds
        );


    /**
     * --------------------------------------------------------
     * 5. PERMISSIONS
     * --------------------------------------------------------
     */
    const permissionIds =
        rolePermissions
            .map((item) => item.permission_id)
            .filter(Boolean);


    const uniquePermissionIds = [
        ...new Set(permissionIds)
    ];


    const permissions =
        await getPermissionsByIds(
            uniquePermissionIds
        );


    /**
     * --------------------------------------------------------
     * 6. SCOPES
     * --------------------------------------------------------
     */
    const rolePermissionIds =
        rolePermissions
            .map((item) => item.id)
            .filter(Boolean);


    const scopes =
        await getPermissionScopes(
            rolePermissionIds
        );


    /**
     * --------------------------------------------------------
     * 7. ROLE MAP
     * --------------------------------------------------------
     */
    const roleMap = {};

    for (const role of roles) {

        roleMap[role.id] = role;

    }


    /**
     * --------------------------------------------------------
     * 8. PERMISSION MAP
     * --------------------------------------------------------
     */
    const permissionMap = {};


    for (const permission of permissions) {

        const relatedRolePermissions =
            rolePermissions.filter(
                (rolePermission) =>
                    rolePermission.permission_id ===
                    permission.id
            );


        const relatedScopes =
            scopes.filter(
                (scope) =>
                    relatedRolePermissions.some(
                        (rolePermission) =>
                            rolePermission.id ===
                            scope.role_permission_id
                    )
            );


        const relatedRoles =
            relatedRolePermissions
                .map(
                    (rolePermission) =>
                        roleMap[rolePermission.role_id]
                )
                .filter(Boolean);


        permissionMap[
            permission.permission_name
        ] = {

            id:
                permission.id,

            permission_name:
                permission.permission_name,

            module:
                permission.module,

            roles:
                relatedRoles.map((role) => ({
                    id: role.id,
                    role_name: role.role_name
                })),

            role_permission_ids:
                relatedRolePermissions.map(
                    (item) => item.id
                ),

            scopes:
                relatedScopes.map((scope) => ({
                    id: scope.id,
                    role_permission_id:
                        scope.role_permission_id,
                    scope_type:
                        scope.scope_type,
                    is_active:
                        scope.is_active
                }))
        };

    }


    /**
     * --------------------------------------------------------
     * 9. ACCESS LEVEL
     * --------------------------------------------------------
     */
    const isSuperAdmin =
        roles.some(
            (role) =>
                role.role_name ===
                SUPER_ADMIN_ROLE
        );


    const isHeadmaster =
        roles.some(
            (role) =>
                role.role_name ===
                HEADMASTER_ROLE
        );


    const isSchoolAdmin =
        isSuperAdmin ||
        isHeadmaster;


    /**
     * --------------------------------------------------------
     * 10. RETURN
     * --------------------------------------------------------
     */
    return {

        profile,

        profile_roles:
            profileRoles,

        roles,

        permissions,

        scopes,

        role_permissions:
            rolePermissions,

        permissionMap,

        roleMap,

        isSuperAdmin,

        isHeadmaster,

        isSchoolAdmin,

        schoolId:
            profile.school_id
    };
};


/**
 * ============================================================
 * HAS PERMISSION
 * ============================================================
 */
export const userHasPermission = async (
    userId,
    permissionName
) => {

    if (
        !userId ||
        !permissionName
    ) {
        return false;
    }


    const access =
        await getUserAccess(userId);


    /**
     * Super Admin = everything
     *
     * Headmaster = everything within own school
     */
    if (
        access.isSuperAdmin ||
        access.isHeadmaster
    ) {

        return true;

    }


    return Boolean(
        access.permissionMap[
            permissionName
        ]
    );
};


/**
 * ============================================================
 * GET PERMISSION DETAILS
 * ============================================================
 */
export const getUserPermission = async (
    userId,
    permissionName
) => {

    if (
        !userId ||
        !permissionName
    ) {
        return null;
    }


    const access =
        await getUserAccess(userId);


    /**
     * --------------------------------------------------------
     * SUPER ADMIN
     * --------------------------------------------------------
     */
    if (
        access.isSuperAdmin
    ) {

        return {

            permission_name:
                permissionName,

            module:
                null,

            roles:
                access.roles.map((role) => ({
                    id: role.id,
                    role_name: role.role_name
                })),

            scopes: [
                {
                    scope_type:
                        "ALL_SCHOOL",

                    is_active:
                        true
                }
            ],

            isSuperAdmin:
                true,

            isHeadmaster:
                false,

            isSchoolAdmin:
                true,

            school_id:
                null
        };

    }


    /**
     * --------------------------------------------------------
     * HEADMASTER
     * --------------------------------------------------------
     *
     * Headmaster gets every permission automatically.
     *
     * Scope remains the Headmaster's school.
     */
    if (
        access.isHeadmaster
    ) {

        return {

            permission_name:
                permissionName,

            module:
                null,

            roles:
                access.roles.map((role) => ({
                    id: role.id,
                    role_name: role.role_name
                })),

            scopes: [
                {
                    scope_type:
                        "SCHOOL",

                    is_active:
                        true,

                    school_id:
                        access.schoolId
                }
            ],

            isSuperAdmin:
                false,

            isHeadmaster:
                true,

            isSchoolAdmin:
                true,

            school_id:
                access.schoolId
        };

    }


    /**
     * --------------------------------------------------------
     * NORMAL USER
     * --------------------------------------------------------
     */
    return (
        access.permissionMap[
            permissionName
        ] ||
        null
    );
};


/**
 * ------------------------------------------------------------
 * GET USER ROLES
 * ------------------------------------------------------------
 */
export const getUserRoles = async (userId) => {

    const access =
        await getUserAccess(userId);

    return access.roles || [];
};


/**
 * ------------------------------------------------------------
 * GET USER PERMISSIONS
 * ------------------------------------------------------------
 */
export const getUserPermissions = async (userId) => {

    const access =
        await getUserAccess(userId);

    return access.permissions || [];
};


/**
 * ------------------------------------------------------------
 * GET USER SCOPES
 * ------------------------------------------------------------
 */
export const getUserScopes = async (userId) => {

    const access =
        await getUserAccess(userId);


    /**
     * Headmaster:
     * own school only.
     */
    if (
        access.isHeadmaster &&
        !access.isSuperAdmin
    ) {

        return [
            {
                scope_type:
                    "SCHOOL",

                is_active:
                    true,

                school_id:
                    access.schoolId
            }
        ];

    }


    return access.scopes || [];
};