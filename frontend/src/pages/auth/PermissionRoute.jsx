import React, {
    useEffect,
    useState,
} from "react";

import {
    Navigate,
    Outlet,
} from "react-router-dom";

import { supabase } from "../services/supabase";


// =====================================================
// PERMISSION CACHE
// =====================================================
//
// Browser memory cache.
// Inazuia permission query kurudiwa bila sababu.
// =====================================================

const permissionCache = new Map();


// =====================================================
// IN-FLIGHT REQUEST CACHE
// =====================================================
//
// Kama PermissionRoute mbili zinaomba check ileile
// kwa wakati mmoja, zinatumia request moja.
// =====================================================

const permissionRequests = new Map();


// =====================================================
// NORMALIZE PERMISSIONS
// =====================================================

const normalizePermissions = (
    permission,
    permissions
) => {

    const result = [];


    // -------------------------------------------------
    // SINGLE PERMISSION
    // -------------------------------------------------

    if (
        typeof permission === "string" &&
        permission.trim()
    ) {

        result.push(
            permission.trim()
        );

    }


    // -------------------------------------------------
    // MULTIPLE PERMISSIONS
    // -------------------------------------------------

    if (
        Array.isArray(permissions)
    ) {

        permissions.forEach(
            (item) => {

                if (
                    typeof item === "string" &&
                    item.trim()
                ) {

                    result.push(
                        item.trim()
                    );

                }

            }
        );

    }


    // -------------------------------------------------
    // REMOVE DUPLICATES
    // -------------------------------------------------

    return [
        ...new Set(result)
    ];

};


// =====================================================
// CHECK PERMISSION FROM DATABASE
// =====================================================

const fetchPermissionResult = async ({
    user,
    requiredPermissions,
    requireAny,
    requireAll,
}) => {


    // =================================================
    // NO PERMISSION REQUIRED
    // =================================================

    if (
        requiredPermissions.length === 0
    ) {

        return true;

    }


    // =================================================
    // GET PROFILE
    // =================================================

    const {
        data: profile,
        error: profileError,
    } = await supabase
        .from("profiles")
        .select(
            "id, role_id, school_id"
        )
        .eq(
            "id",
            user.id
        )
        .maybeSingle();


    // =================================================
    // PROFILE ERROR
    // =================================================

    if (
        profileError
    ) {

        console.error(
            "PermissionRoute profile error:",
            profileError
        );

        return false;

    }


    // =================================================
    // PROFILE NOT FOUND
    // =================================================

    if (
        !profile
    ) {

        console.error(
            "PermissionRoute: profile not found:",
            user.id
        );

        return false;

    }


    // =================================================
    // BUILD ROLE IDS
    // =================================================

    const roleIds = new Set();


    // =================================================
    // LEGACY ROLE
    // =================================================

    if (
        profile.role_id !== null &&
        profile.role_id !== undefined
    ) {

        const roleId =
            Number(
                profile.role_id
            );


        if (
            Number.isFinite(
                roleId
            )
        ) {

            roleIds.add(
                roleId
            );

        }

    }


    // =================================================
    // MULTIPLE ACTIVE ROLES
    // =================================================

    const {
        data: profileRoles,
        error: profileRolesError,
    } = await supabase
        .from("profile_roles")
        .select(
            "role_id, is_active"
        )
        .eq(
            "profile_id",
            user.id
        )
        .eq(
            "is_active",
            true
        );


    // =================================================
    // PROFILE ROLES ERROR
    // =================================================

    if (
        profileRolesError
    ) {

        console.warn(
            "PermissionRoute profile_roles error:",
            profileRolesError
        );

    }


    // =================================================
    // ADD MULTIPLE ROLES
    // =================================================

    if (
        Array.isArray(
            profileRoles
        )
    ) {

        profileRoles.forEach(
            (row) => {

                if (
                    row?.role_id !== null &&
                    row?.role_id !== undefined
                ) {

                    const roleId =
                        Number(
                            row.role_id
                        );


                    if (
                        Number.isFinite(
                            roleId
                        )
                    ) {

                        roleIds.add(
                            roleId
                        );

                    }

                }

            }
        );

    }


    // =================================================
    // FINAL ROLE IDS
    // =================================================

    const activeRoleIds =
        Array.from(
            roleIds
        )
            .sort(
                (a, b) => a - b
            );


    // =================================================
    // FULL ACCESS ROLES
    // =================================================
    //
    // ROLE 1 = SUPER ADMIN
    // ROLE 2 = HEADMASTER
    //
    // Both roles have full system access.
    //
    // IMPORTANT:
    // Hakuna sababu ya ku-query role_permissions
    // wala permissions kwa roles hizi.
    // =================================================

    if (
        activeRoleIds.includes(1) ||
        activeRoleIds.includes(2)
    ) {

        if (
            activeRoleIds.includes(1)
        ) {

            console.log(
                "PermissionRoute: SUPER ADMIN ACCESS GRANTED",
                user.email
            );

        }
        else {

            console.log(
                "PermissionRoute: HEADMASTER FULL ACCESS GRANTED",
                user.email
            );

        }

        return true;

    }


    // =================================================
    // NO ACTIVE ROLES
    // =================================================

    if (
        activeRoleIds.length === 0
    ) {

        console.warn(
            "PermissionRoute: User has no active roles."
        );

        return false;

    }


    // =================================================
    // GET ROLE PERMISSIONS
    // =================================================

    const {
        data: rolePermissionRows,
        error: rolePermissionError,
    } = await supabase
        .from("role_permissions")
        .select(
            "role_id, permission_id"
        )
        .in(
            "role_id",
            activeRoleIds
        );


    // =================================================
    // ROLE PERMISSIONS ERROR
    // =================================================

    if (
        rolePermissionError
    ) {

        console.error(
            "PermissionRoute role_permissions error:",
            rolePermissionError
        );

        return false;

    }


    // =================================================
    // BUILD PERMISSION IDS
    // =================================================

    const permissionIds = [
        ...new Set(
            (
                rolePermissionRows || []
            )
                .map(
                    (row) =>
                        Number(
                            row.permission_id
                        )
                )
                .filter(
                    (id) =>
                        Number.isFinite(
                            id
                        )
                )
        )
    ];


    // =================================================
    // NO PERMISSION IDS
    // =================================================

    if (
        permissionIds.length === 0
    ) {

        return false;

    }


    // =================================================
    // GET PERMISSION NAMES
    // =================================================

    const {
        data: permissionRows,
        error: permissionError,
    } = await supabase
        .from("permissions")
        .select(
            "id, permission_name"
        )
        .in(
            "id",
            permissionIds
        );


    // =================================================
    // PERMISSION QUERY ERROR
    // =================================================

    if (
        permissionError
    ) {

        console.error(
            "PermissionRoute permissions error:",
            permissionError
        );

        return false;

    }


    // =================================================
    // BUILD USER PERMISSIONS
    // =================================================

    const userPermissions =
        new Set(
            (
                permissionRows || []
            )
                .map(
                    (row) => {

                        if (
                            typeof row?.permission_name ===
                            "string"
                        ) {

                            return row.permission_name.trim();

                        }

                        return "";

                    }
                )
                .filter(
                    Boolean
                )
        );


    // =================================================
    // REQUIRE ALL
    // =================================================

    if (
        requireAll
    ) {

        return requiredPermissions.every(
            (required) =>
                userPermissions.has(
                    required
                )
        );

    }


    // =================================================
    // REQUIRE ANY
    // =================================================

    if (
        requireAny
    ) {

        return requiredPermissions.some(
            (required) =>
                userPermissions.has(
                    required
                )
        );

    }


    // =================================================
    // DEFAULT
    // =================================================
    //
    // Default behaviour = ANY
    // =================================================

    return requiredPermissions.some(
        (required) =>
            userPermissions.has(
                required
            )
    );

};


// =====================================================
// PERMISSION ROUTE
// =====================================================

function PermissionRoute({
    permission = null,
    permissions = [],
    requireAny = false,
    requireAll = false,
}) {


    // =================================================
    // STATUS
    // =================================================

    const [
        status,
        setStatus
    ] = useState(
        "loading"
    );


    // =================================================
    // NORMALIZE PERMISSIONS
    // =================================================

    const normalizedPermissions =
        normalizePermissions(
            permission,
            permissions
        );


    // =================================================
    // STABLE PERMISSION KEY
    // =================================================
    //
    // Sort tunasaidia:
    //
    // ["A", "B"]
    //
    // na
    //
    // ["B", "A"]
    //
    // ziwe permission set ileile.
    // =================================================

    const permissionKey =
        normalizedPermissions
            .slice()
            .sort()
            .join("|");


    // =================================================
    // STABLE CHECK KEY
    // =================================================

    const checkKey =
        [
            permissionKey,
            requireAny
                ? "ANY"
                : "NO_ANY",
            requireAll
                ? "ALL"
                : "NO_ALL"
        ].join("::");


    // =================================================
    // PERMISSION CHECK
    // =================================================

    useEffect(() => {

        let mounted = true;


        const checkPermission =
            async () => {

                try {


                    // =================================
                    // RESET LOADING
                    // =================================

                    setStatus(
                        "loading"
                    );


                    // =================================
                    // GET CURRENT USER
                    // =================================

                    const {
                        data: {
                            user
                        },
                        error: userError
                    } =
                        await supabase
                            .auth
                            .getUser();


                    // =================================
                    // COMPONENT UNMOUNTED
                    // =================================

                    if (
                        !mounted
                    ) {

                        return;

                    }


                    // =================================
                    // NOT AUTHENTICATED
                    // =================================

                    if (
                        userError ||
                        !user
                    ) {

                        console.warn(
                            "PermissionRoute: No authenticated user"
                        );

                        setStatus(
                            "unauthenticated"
                        );

                        return;

                    }


                    // =================================
                    // CACHE KEY
                    // =================================

                    const cacheKey =
                        [
                            user.id,
                            checkKey
                        ].join("::");


                    // =================================
                    // CACHE HIT
                    // =================================

                    if (
                        permissionCache.has(
                            cacheKey
                        )
                    ) {

                        const allowed =
                            permissionCache.get(
                                cacheKey
                            );


                        if (
                            mounted
                        ) {

                            setStatus(
                                allowed
                                    ? "allowed"
                                    : "denied"
                            );

                        }

                        return;

                    }


                    // =================================
                    // EXISTING REQUEST
                    // =================================

                    if (
                        permissionRequests.has(
                            cacheKey
                        )
                    ) {

                        const allowed =
                            await permissionRequests.get(
                                cacheKey
                            );


                        if (
                            mounted
                        ) {

                            setStatus(
                                allowed
                                    ? "allowed"
                                    : "denied"
                            );

                        }

                        return;

                    }


                    // =================================
                    // CREATE REQUEST
                    // =================================

                    const request =
                        fetchPermissionResult({
                            user,
                            requiredPermissions:
                                normalizedPermissions,
                            requireAny,
                            requireAll,
                        });


                    // =================================
                    // SAVE IN-FLIGHT REQUEST
                    // =================================

                    permissionRequests.set(
                        cacheKey,
                        request
                    );


                    let allowed;


                    try {

                        allowed =
                            await request;

                    }
                    finally {

                        permissionRequests.delete(
                            cacheKey
                        );

                    }


                    // =================================
                    // SAVE CACHE
                    // =================================

                    permissionCache.set(
                        cacheKey,
                        allowed
                    );


                    // =================================
                    // UPDATE STATUS
                    // =================================

                    if (
                        !mounted
                    ) {

                        return;

                    }


                    setStatus(
                        allowed
                            ? "allowed"
                            : "denied"
                    );


                }
                catch (error) {

                    console.error(
                        "PermissionRoute unexpected error:",
                        error
                    );


                    if (
                        mounted
                    ) {

                        setStatus(
                            "denied"
                        );

                    }

                }

            };


        checkPermission();


        // =============================================
        // CLEANUP
        // =============================================

        return () => {

            mounted = false;

        };


    }, [
        checkKey
    ]);


    // =================================================
    // LOADING
    // =================================================

    if (
        status === "loading"
    ) {

        return (
            <div
                className="
                    flex
                    items-center
                    justify-center
                    py-6
                    text-sm
                    text-slate-500
                "
            >
                Checking permissions...
            </div>
        );

    }


    // =================================================
    // UNAUTHENTICATED
    // =================================================

    if (
        status === "unauthenticated"
    ) {

        return (
            <Navigate
                to="/login"
                replace
            />
        );

    }


    // =================================================
    // DENIED
    // =================================================

    if (
        status === "denied"
    ) {

        return (
            <Navigate
                to="/access-denied"
                replace
            />
        );

    }


    // =================================================
    // ALLOWED
    // =================================================

    return (
        <Outlet />
    );

}


export default PermissionRoute;