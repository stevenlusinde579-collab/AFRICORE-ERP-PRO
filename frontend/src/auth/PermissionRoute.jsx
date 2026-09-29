import React, {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    Navigate,
    Outlet,
    useLocation,
} from "react-router-dom";

import { supabase } from "../services/supabase";

import { useRole } from "../context/RoleContext";


const SUPER_ADMIN_ROLE_ID = 1;


/**
 * =========================================================
 * PERMISSION ROUTE
 * =========================================================
 *
 * Responsibilities:
 *
 * 1. Wait for RoleContext.
 * 2. Confirm authenticated user.
 * 3. Use selected RoleContext role as the primary source.
 * 4. If RoleContext has finished loading but selectedRoleId
 *    is temporarily null, safely recover the role from
 *    profiles.role_id.
 * 5. Super Admin (role_id = 1) bypasses permissions.
 * 6. Other roles are checked against role_permissions.
 *
 * IMPORTANT:
 * We never combine permissions from multiple roles.
 * Only the currently selected role is checked.
 * =========================================================
 */

const PermissionRoute = ({
    permission = null,
    permissions = [],
    requireAny = false,
    requireAll = false,
}) => {

    // =====================================================
    // ROLE CONTEXT
    // =====================================================

    const {
        loading: roleLoading,
        selectedRoleId,
        selectedProfileRoleId,
    } = useRole();


    const location = useLocation();


    // =====================================================
    // LOCAL STATE
    // =====================================================

    const [loading, setLoading] =
        useState(true);

    const [allowed, setAllowed] =
        useState(false);

    const [authenticated, setAuthenticated] =
        useState(false);


    // =====================================================
    // NORMALIZE REQUIRED PERMISSIONS
    // =====================================================

    const permissionsKey = useMemo(() => {

        const list = [];


        if (
            typeof permission === "string" &&
            permission.trim()
        ) {

            list.push(
                permission.trim()
            );

        }


        if (
            Array.isArray(permissions)
        ) {

            permissions.forEach(
                (item) => {

                    if (
                        typeof item === "string" &&
                        item.trim()
                    ) {

                        list.push(
                            item.trim()
                        );

                    }

                }
            );

        }


        return [
            ...new Set(list),
        ].join("|");

    }, [
        permission,
        permissions,
    ]);


    const requiredPermissions = useMemo(() => {

        if (!permissionsKey) {
            return [];
        }


        return permissionsKey
            .split("|")
            .filter(Boolean);

    }, [
        permissionsKey,
    ]);


    // =====================================================
    // SELECTED ROLE FROM ROLE CONTEXT
    // =====================================================

    const selectedRole =
        selectedRoleId === null ||
        selectedRoleId === undefined
            ? null
            : Number(selectedRoleId);


    const selectedProfileRole =
        selectedProfileRoleId === null ||
        selectedProfileRoleId === undefined
            ? null
            : Number(selectedProfileRoleId);


    // =====================================================
    // STABLE ROLE KEY
    // =====================================================

    const roleKey = useMemo(() => {

        return [
            selectedRole ?? "",
            selectedProfileRole ?? "",
        ].join(":");

    }, [
        selectedRole,
        selectedProfileRole,
    ]);


    // =====================================================
    // PERMISSION CHECK
    // =====================================================

    useEffect(() => {

        let mounted = true;


        const checkPermission =
            async () => {

                try {

                    // =================================================
                    // 1. WAIT FOR ROLE CONTEXT
                    // =================================================

                    if (roleLoading) {

                        if (mounted) {

                            setLoading(true);

                        }

                        return;
                    }


                    // =================================================
                    // 2. RESET LOCAL ACCESS STATE
                    // =================================================

                    if (mounted) {

                        setLoading(true);

                        setAllowed(false);

                    }


                    // =================================================
                    // 3. AUTHENTICATION
                    // =================================================

                    const {
                        data: {
                            user
                        },
                        error: userError,
                    } =
                        await supabase.auth.getUser();


                    if (
                        userError ||
                        !user
                    ) {

                        console.error(
                            "PermissionRoute authentication error:",
                            userError
                        );


                        if (mounted) {

                            setAuthenticated(
                                false
                            );

                            setAllowed(
                                false
                            );

                            setLoading(
                                false
                            );

                        }

                        return;
                    }


                    // User is authenticated.

                    if (mounted) {

                        setAuthenticated(
                            true
                        );

                    }


                    // =================================================
                    // 4. NO PERMISSION REQUIRED
                    // =================================================
                    //
                    // Some routes only need authentication.
                    //
                    // =================================================

                    if (
                        requiredPermissions.length === 0
                    ) {

                        if (mounted) {

                            setAllowed(
                                true
                            );

                            setLoading(
                                false
                            );

                        }

                        return;
                    }


                    // =================================================
                    // 5. DETERMINE EFFECTIVE ROLE
                    // =================================================
                    //
                    // RoleContext remains the primary source.
                    //
                    // BUT:
                    //
                    // During the first render after login/session
                    // restoration, RoleContext can temporarily have:
                    //
                    // roleLoading = false
                    // selectedRoleId = null
                    //
                    // while the selected role is being restored.
                    //
                    // Instead of immediately denying access, recover
                    // the profile role from public.profiles.
                    //
                    // This fixes:
                    //
                    // "PermissionRoute: No selected role"
                    //
                    // without combining multiple roles.
                    // =================================================

                    let effectiveRole =
                        selectedRole;


                    let effectiveProfileRole =
                        selectedProfileRole;


                    // -------------------------------------------------
                    // FALLBACK ONLY WHEN ROLE CONTEXT HAS NO ROLE
                    // -------------------------------------------------

                    if (
                        effectiveRole === null ||
                        Number.isNaN(
                            effectiveRole
                        )
                    ) {

                        console.log(
                            "PermissionRoute: RoleContext has no selected role yet. Loading profile fallback...",
                            {
                                path:
                                    location.pathname,
                                roleLoading,
                                selectedRoleId,
                                selectedProfileRoleId,
                            }
                        );


                        const {
                            data: profile,
                            error: profileError,
                        } =
                            await supabase
                                .from("profiles")
                                .select(`
                                    id,
                                    role_id
                                `)
                                .eq(
                                    "id",
                                    user.id
                                )
                                .maybeSingle();


                        if (
                            profileError
                        ) {

                            console.error(
                                "PermissionRoute profile fallback error:",
                                profileError
                            );

                        }


                        const profileRoleId =
                            profile?.role_id === null ||
                            profile?.role_id === undefined
                                ? null
                                : Number(
                                    profile.role_id
                                );


                        if (
                            profileRoleId !== null &&
                            !Number.isNaN(
                                profileRoleId
                            )
                        ) {

                            effectiveRole =
                                profileRoleId;


                            console.log(
                                "PermissionRoute: PROFILE ROLE FALLBACK USED",
                                {
                                    path:
                                        location.pathname,
                                    role:
                                        effectiveRole,
                                }
                            );

                        }

                    }


                    // =================================================
                    // 6. STILL NO ROLE
                    // =================================================
                    //
                    // Only deny after both:
                    //
                    // RoleContext
                    // AND
                    // profiles.role_id
                    //
                    // have failed to provide a role.
                    // =================================================

                    if (
                        effectiveRole === null ||
                        effectiveRole === undefined ||
                        Number.isNaN(
                            effectiveRole
                        )
                    ) {

                        console.error(
                            "PermissionRoute: No usable role found.",
                            {
                                path:
                                    location.pathname,
                                selectedRoleId,
                                selectedProfileRoleId,
                            }
                        );


                        if (mounted) {

                            setAllowed(
                                false
                            );

                            setLoading(
                                false
                            );

                        }

                        return;
                    }


                    // =================================================
                    // 7. SUPER ADMIN
                    // =================================================
                    //
                    // Super Admin does not need individual
                    // permission rows.
                    // =================================================

                    if (
                        effectiveRole ===
                        SUPER_ADMIN_ROLE_ID
                    ) {

                        console.log(
                            "PermissionRoute: SUPER ADMIN ACCESS GRANTED",
                            {
                                path:
                                    location.pathname,

                                role:
                                    effectiveRole,

                                required:
                                    requiredPermissions,
                            }
                        );


                        if (mounted) {

                            setAllowed(
                                true
                            );

                            setLoading(
                                false
                            );

                        }

                        return;
                    }


                    // =================================================
                    // 8. LOAD PERMISSIONS FOR SELECTED ROLE ONLY
                    // =================================================

                    const {
                        data:
                            rolePermissions,
                        error:
                            rolePermissionsError,
                    } =
                        await supabase
                            .from(
                                "role_permissions"
                            )
                            .select(`
                                role_id,
                                permissions (
                                    id,
                                    permission_name
                                )
                            `)
                            .eq(
                                "role_id",
                                effectiveRole
                            );


                    if (
                        rolePermissionsError
                    ) {

                        console.error(
                            "PermissionRoute role_permissions error:",
                            rolePermissionsError
                        );


                        if (mounted) {

                            setAllowed(
                                false
                            );

                            setLoading(
                                false
                            );

                        }

                        return;
                    }


                    // =================================================
                    // 9. BUILD USER PERMISSION SET
                    // =================================================

                    const userPermissions =
                        new Set();


                    if (
                        Array.isArray(
                            rolePermissions
                        )
                    ) {

                        rolePermissions.forEach(
                            (row) => {

                                const data =
                                    row?.permissions;


                                // -------------------------------------------------
                                // Supabase can return relation as object
                                // or array depending on relationship shape.
                                // -------------------------------------------------

                                if (
                                    Array.isArray(
                                        data
                                    )
                                ) {

                                    data.forEach(
                                        (
                                            permissionRow
                                        ) => {

                                            if (
                                                typeof permissionRow?.permission_name ===
                                                "string"
                                            ) {

                                                userPermissions.add(
                                                    permissionRow
                                                        .permission_name
                                                        .trim()
                                                );

                                            }

                                        }
                                    );

                                }

                                else if (
                                    data &&
                                    typeof data.permission_name ===
                                    "string"
                                ) {

                                    userPermissions.add(
                                        data.permission_name
                                            .trim()
                                    );

                                }

                            }
                        );

                    }


                    // =================================================
                    // 10. CHECK REQUIRED PERMISSIONS
                    // =================================================

                    let permissionAllowed =
                        false;


                    // -------------------------------------------------
                    // REQUIRE ALL
                    // -------------------------------------------------

                    if (
                        requireAll
                    ) {

                        permissionAllowed =
                            requiredPermissions.every(
                                (
                                    requiredPermission
                                ) =>
                                    userPermissions.has(
                                        requiredPermission
                                    )
                            );

                    }


                    // -------------------------------------------------
                    // REQUIRE ANY
                    // -------------------------------------------------

                    else if (
                        requireAny
                    ) {

                        permissionAllowed =
                            requiredPermissions.some(
                                (
                                    requiredPermission
                                ) =>
                                    userPermissions.has(
                                        requiredPermission
                                    )
                            );

                    }


                    // -------------------------------------------------
                    // DEFAULT
                    // -------------------------------------------------
                    //
                    // Existing behavior remains ANY.
                    // -------------------------------------------------

                    else {

                        permissionAllowed =
                            requiredPermissions.some(
                                (
                                    requiredPermission
                                ) =>
                                    userPermissions.has(
                                        requiredPermission
                                    )
                            );

                    }


                    // =================================================
                    // 11. DEBUG
                    // =================================================

                    console.log(
                        "PermissionRoute CHECK:",
                        {
                            path:
                                location.pathname,

                            selectedRole:
                                selectedRole,

                            effectiveRole:
                                effectiveRole,

                            selectedProfileRole:
                                selectedProfileRole,

                            required:
                                requiredPermissions,

                            permissions:
                                Array.from(
                                    userPermissions
                                ),

                            allowed:
                                permissionAllowed,
                        }
                    );


                    // =================================================
                    // 12. FINAL STATE
                    // =================================================

                    if (mounted) {

                        setAllowed(
                            permissionAllowed
                        );

                        setLoading(
                            false
                        );

                    }

                }

                catch (
                    error
                ) {

                    console.error(
                        "PermissionRoute unexpected error:",
                        error
                    );


                    if (mounted) {

                        setAllowed(
                            false
                        );

                        setLoading(
                            false
                        );

                    }

                }

            };


        checkPermission();


        return () => {

            mounted = false;

        };

    }, [
        roleLoading,
        roleKey,
        permissionsKey,
        requireAny,
        requireAll,
        location.pathname,
        selectedRole,
        selectedProfileRole,
        requiredPermissions,
        selectedRoleId,
        selectedProfileRoleId,
    ]);


    // =====================================================
    // CHECKING PERMISSIONS
    // =====================================================

    if (loading) {

        return (

            <div
                style={{
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#f8fafc",
                    color: "#334155",
                    fontSize: "15px",
                    fontWeight: 600,
                }}
            >

                Checking permissions...

            </div>

        );

    }


    // =====================================================
    // NOT AUTHENTICATED
    // =====================================================

    if (!authenticated) {

        return (

            <Navigate
                to="/login"
                replace
            />

        );

    }


    // =====================================================
    // NOT ALLOWED
    // =====================================================

    if (!allowed) {

        return (

            <Navigate
                to="/access-denied"
                replace
            />

        );

    }


    // =====================================================
    // ALLOWED
    // =====================================================

    return <Outlet />;

};


export default PermissionRoute;