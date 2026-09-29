import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

import { supabase } from "../services/supabase";
import { useAuth } from "./AuthContext";


// =====================================================
// ROLE CONTEXT
// =====================================================
//
// GLOBAL SOURCE FOR CURRENT USER ROLES.
//
// Important:
//
// profile_roles is the primary source.
//
// Each role contains:
//
// - profileRoleId
// - profileId
// - roleId
// - schoolId
// - isPrimary
// - isActive
// - roleName
//
// The selected profile role is persisted in localStorage.
//
// When the selected role changes, a custom event is
// dispatched so SchoolContext can immediately reload
// the corresponding school and academic year.
//
// =====================================================


const RoleContext = createContext(null);


// =====================================================
// STORAGE
// =====================================================

const STORAGE_KEY =
    "africore_selected_role";


// =====================================================
// ROLE CHANGE EVENT
// =====================================================

const ROLE_CHANGED_EVENT =
    "africore-role-changed";


// =====================================================
// ROLE NORMALIZER
// =====================================================

const normalizeRoleName = (
    roleName
) => {

    if (!roleName) {
        return "";
    }

    return String(
        roleName
    )
        .trim()
        .toLowerCase()
        .replace(
            /\s+/g,
            " "
        );

};


// =====================================================
// ROLE PROVIDER
// =====================================================

export function RoleProvider({
    children
}) {

    const {
        user
    } = useAuth();


    const [roles, setRoles] =
        useState([]);


    const [selectedRole, setSelectedRole] =
        useState(null);


    const [loadingRoles, setLoadingRoles] =
        useState(true);


    // =================================================
    // LOAD ROLES
    // =================================================

    useEffect(() => {

        let cancelled = false;


        const loadRoles = async () => {

            // -----------------------------------------
            // NO USER
            // -----------------------------------------

            if (!user?.id) {

                if (!cancelled) {

                    setRoles([]);

                    setSelectedRole(null);

                    setLoadingRoles(false);

                }

                return;

            }


            if (!cancelled) {

                setLoadingRoles(true);

            }


            try {

                // =================================================
                // STEP 1
                // LOAD ACTIVE PROFILE ROLES
                // =================================================

                const {
                    data: profileRoles,
                    error: profileRolesError,
                } = await supabase
                    .from("profile_roles")
                    .select(`
                        id,
                        profile_id,
                        role_id,
                        school_id,
                        is_primary,
                        is_active
                    `)
                    .eq(
                        "profile_id",
                        user.id
                    )
                    .eq(
                        "is_active",
                        true
                    )
                    .order(
                        "is_primary",
                        {
                            ascending: false,
                        }
                    )
                    .order(
                        "id",
                        {
                            ascending: true,
                        }
                    );


                if (profileRolesError) {

                    throw profileRolesError;

                }


                // =================================================
                // FALLBACK TO LEGACY PROFILE ROLE
                // =================================================

                if (
                    !Array.isArray(
                        profileRoles
                    ) ||
                    profileRoles.length === 0
                ) {

                    console.warn(
                        "ROLE CONTEXT - NO ACTIVE PROFILE ROLES FOUND"
                    );


                    const {
                        data: profile,
                        error: profileError,
                    } = await supabase
                        .from("profiles")
                        .select(`
                            id,
                            role_id,
                            school_id
                        `)
                        .eq(
                            "id",
                            user.id
                        )
                        .maybeSingle();


                    if (profileError) {
                        throw profileError;
                    }


                    if (!profile?.role_id) {

                        if (!cancelled) {

                            setRoles([]);

                            setSelectedRole(null);

                        }

                        return;

                    }


                    const {
                        data: legacyRole,
                        error: legacyRoleError,
                    } = await supabase
                        .from("roles")
                        .select(`
                            id,
                            role_name
                        `)
                        .eq(
                            "id",
                            profile.role_id
                        )
                        .maybeSingle();


                    if (legacyRoleError) {
                        throw legacyRoleError;
                    }


                    if (!legacyRole) {

                        if (!cancelled) {

                            setRoles([]);

                            setSelectedRole(null);

                        }

                        return;

                    }


                    const fallbackRole = {

                        profileRoleId:
                            `legacy-${legacyRole.id}`,

                        profileId:
                            user.id,

                        roleId:
                            legacyRole.id,

                        schoolId:
                            profile.school_id,

                        isPrimary:
                            true,

                        isActive:
                            true,

                        roleName:
                            legacyRole.role_name,

                        role: {

                            id:
                                legacyRole.id,

                            name:
                                legacyRole.role_name,

                        },

                    };


                    if (cancelled) {
                        return;
                    }


                    setRoles([
                        fallbackRole
                    ]);

                    setSelectedRole(
                        fallbackRole
                    );


                    localStorage.setItem(
                        STORAGE_KEY,
                        JSON.stringify({
                            roleId:
                                fallbackRole.roleId,

                            profileRoleId:
                                fallbackRole.profileRoleId,
                        })
                    );


                    window.dispatchEvent(
                        new Event(
                            ROLE_CHANGED_EVENT
                        )
                    );


                    return;

                }


                // =================================================
                // STEP 2
                // UNIQUE ROLE IDS
                // =================================================

                const roleIds = [
                    ...new Set(
                        profileRoles
                            .map(
                                (item) =>
                                    item.role_id
                            )
                            .filter(
                                (roleId) =>
                                    roleId !==
                                        null &&
                                    roleId !==
                                        undefined
                            )
                    ),
                ];


                if (
                    roleIds.length === 0
                ) {

                    if (!cancelled) {

                        setRoles([]);

                        setSelectedRole(null);

                    }

                    return;

                }


                // =================================================
                // STEP 3
                // LOAD ROLE NAMES
                // =================================================

                const {
                    data: roleRows,
                    error: rolesError,
                } = await supabase
                    .from("roles")
                    .select(`
                        id,
                        role_name
                    `)
                    .in(
                        "id",
                        roleIds
                    );


                if (rolesError) {
                    throw rolesError;
                }


                const normalizedRoleRows =
                    Array.isArray(
                        roleRows
                    )
                        ? roleRows
                        : [];


                // =================================================
                // STEP 4
                // COMBINE PROFILE ROLES + ROLE NAMES
                // =================================================

                const loadedRoles =
                    profileRoles
                        .map(
                            (
                                profileRole
                            ) => {

                                const role =
                                    normalizedRoleRows.find(
                                        (
                                            roleRow
                                        ) =>
                                            String(
                                                roleRow.id
                                            ) ===
                                            String(
                                                profileRole.role_id
                                            )
                                    );


                                return {

                                    profileRoleId:
                                        profileRole.id,

                                    profileId:
                                        profileRole.profile_id,

                                    roleId:
                                        profileRole.role_id,

                                    schoolId:
                                        profileRole.school_id,

                                    isPrimary:
                                        Boolean(
                                            profileRole.is_primary
                                        ),

                                    isActive:
                                        Boolean(
                                            profileRole.is_active
                                        ),

                                    roleName:
                                        role?.role_name ||
                                        "",

                                    role: {

                                        id:
                                            role?.id ??
                                            profileRole.role_id,

                                        name:
                                            role?.role_name ||
                                            "",

                                    },

                                };

                            }
                        )
                        .filter(
                            (
                                item
                            ) =>
                                item.roleId !==
                                    null &&
                                item.roleId !==
                                    undefined
                        );


                console.log(
                    "========================================"
                );

                console.log(
                    "ROLE CONTEXT - LOADED ROLES:",
                    loadedRoles
                );

                console.log(
                    "ROLE CONTEXT - ROLE COUNT:",
                    loadedRoles.length
                );

                console.log(
                    "ROLE CONTEXT - PRIMARY ROLES:",
                    loadedRoles.filter(
                        (item) =>
                            item.isPrimary
                    )
                );

                console.log(
                    "ROLE CONTEXT - ROLE SCHOOLS:",
                    loadedRoles.map(
                        (item) => ({
                            roleId:
                                item.roleId,

                            profileRoleId:
                                item.profileRoleId,

                            roleName:
                                item.roleName,

                            schoolId:
                                item.schoolId,

                            isPrimary:
                                item.isPrimary,
                        })
                    )
                );

                console.log(
                    "========================================"
                );


                if (
                    loadedRoles.length === 0
                ) {

                    if (!cancelled) {

                        setRoles([]);

                        setSelectedRole(null);

                    }

                    return;

                }


                if (cancelled) {
                    return;
                }


                // =================================================
                // SAVE ROLES
                // =================================================

                setRoles(
                    loadedRoles
                );


                // =================================================
                // READ SAVED ROLE
                // =================================================

                let savedRole = null;


                try {

                    const saved =
                        localStorage.getItem(
                            STORAGE_KEY
                        );


                    if (saved) {

                        savedRole =
                            JSON.parse(
                                saved
                            );

                    }

                } catch (error) {

                    console.warn(
                        "ROLE CONTEXT - INVALID SAVED ROLE:",
                        error
                    );


                    localStorage.removeItem(
                        STORAGE_KEY
                    );

                }


                let nextRole = null;


                // =================================================
                // MATCH SAVED PROFILE ROLE
                // =================================================

                if (
                    savedRole?.profileRoleId
                ) {

                    nextRole =
                        loadedRoles.find(
                            (
                                item
                            ) =>
                                String(
                                    item.profileRoleId
                                ) ===
                                String(
                                    savedRole.profileRoleId
                                )
                        );

                }


                // =================================================
                // MATCH SAVED ROLE ID
                // =================================================

                if (
                    !nextRole &&
                    savedRole?.roleId
                ) {

                    nextRole =
                        loadedRoles.find(
                            (
                                item
                            ) =>
                                String(
                                    item.roleId
                                ) ===
                                String(
                                    savedRole.roleId
                                )
                        );

                }


                // =================================================
                // PRIMARY ROLE
                // =================================================

                if (!nextRole) {

                    nextRole =
                        loadedRoles.find(
                            (
                                item
                            ) =>
                                item.isPrimary ===
                                true
                        );

                }


                // =================================================
                // FIRST ACTIVE ROLE
                // =================================================

                if (!nextRole) {

                    nextRole =
                        loadedRoles[0] ||
                        null;

                }


                // =================================================
                // SAVE SELECTED ROLE
                // =================================================

                if (nextRole) {

                    setSelectedRole(
                        nextRole
                    );


                    localStorage.setItem(
                        STORAGE_KEY,
                        JSON.stringify({
                            roleId:
                                nextRole.roleId,

                            profileRoleId:
                                nextRole.profileRoleId,
                        })
                    );


                    console.log(
                        "ROLE CONTEXT - SELECTED ROLE:",
                        nextRole
                    );

                } else {

                    setSelectedRole(
                        null
                    );

                }

            } catch (error) {

                console.error(
                    "========================================"
                );

                console.error(
                    "ROLE CONTEXT - LOAD ERROR:",
                    error
                );

                console.error(
                    "========================================"
                );


                if (!cancelled) {

                    setRoles([]);

                    setSelectedRole(null);

                }

            } finally {

                if (!cancelled) {

                    setLoadingRoles(
                        false
                    );

                }

            }

        };


        loadRoles();


        return () => {

            cancelled = true;

        };

    }, [
        user?.id,
    ]);


    // =====================================================
    // SELECT ROLE
    // =====================================================

    const selectRole = (
        roleIdOrProfileRoleId
    ) => {

        const value =
            String(
                roleIdOrProfileRoleId
            );


        const nextRole =
            roles.find(
                (
                    item
                ) =>
                    String(
                        item.roleId
                    ) ===
                        value ||
                    String(
                        item.profileRoleId
                    ) ===
                        value
            );


        if (!nextRole) {

            console.warn(
                "ROLE CONTEXT - ROLE NOT FOUND:",
                roleIdOrProfileRoleId
            );

            return false;

        }


        // -----------------------------------------
        // ONLY ACTIVE ROLE
        // -----------------------------------------

        if (
            nextRole.isActive === false
        ) {

            console.warn(
                "ROLE CONTEXT - ROLE IS NOT ACTIVE:",
                nextRole
            );

            return false;

        }


        // -----------------------------------------
        // SET ROLE
        // -----------------------------------------

        setSelectedRole(
            nextRole
        );


        // -----------------------------------------
        // SAVE ROLE
        // -----------------------------------------

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                roleId:
                    nextRole.roleId,

                profileRoleId:
                    nextRole.profileRoleId,
            })
        );


        // -----------------------------------------
        // IMPORTANT:
        // NOTIFY SCHOOL CONTEXT
        // -----------------------------------------

        window.dispatchEvent(
            new Event(
                ROLE_CHANGED_EVENT
            )
        );


        console.log(
            "========================================"
        );

        console.log(
            "ROLE CONTEXT - ROLE CHANGED"
        );

        console.log(
            "ROLE:",
            nextRole.roleName
        );

        console.log(
            "ROLE ID:",
            nextRole.roleId
        );

        console.log(
            "PROFILE ROLE ID:",
            nextRole.profileRoleId
        );

        console.log(
            "SCHOOL ID:",
            nextRole.schoolId
        );

        console.log(
            "========================================"
        );


        return true;

    };


    // =====================================================
    // CLEAR SELECTED ROLE
    // =====================================================

    const clearSelectedRole = () => {

        setSelectedRole(
            null
        );


        localStorage.removeItem(
            STORAGE_KEY
        );


        window.dispatchEvent(
            new Event(
                ROLE_CHANGED_EVENT
            )
        );

    };


    // =====================================================
    // DERIVED VALUES
    // =====================================================

    const selectedRoleId =
        selectedRole?.roleId ??
        null;


    const selectedProfileRoleId =
        selectedRole?.profileRoleId ??
        null;


    const selectedSchoolId =
        selectedRole?.schoolId ??
        null;


    const selectedRoleName =
        selectedRole?.roleName ||
        selectedRole?.role?.name ||
        "";


    const hasMultipleRoles =
        roles.length > 1;


    // =====================================================
    // HAS ROLE
    // =====================================================

    const hasRole = (
        roleName
    ) => {

        if (!roleName) {
            return false;
        }


        const target =
            normalizeRoleName(
                roleName
            );


        return roles.some(
            (
                item
            ) =>
                normalizeRoleName(
                    item.roleName
                ) ===
                target
        );

    };


    // =====================================================
    // SELECTED ROLE IS
    // =====================================================

    const selectedRoleIs = (
        roleName
    ) => {

        if (
            !roleName ||
            !selectedRoleName
        ) {

            return false;

        }


        return (
            normalizeRoleName(
                selectedRoleName
            ) ===
            normalizeRoleName(
                roleName
            )
        );

    };


    // =====================================================
    // CONTEXT VALUE
    // =====================================================

    const value = useMemo(
        () => ({

            // -----------------------------------------
            // ALL ROLES
            // -----------------------------------------

            roles,


            // -----------------------------------------
            // SELECTED ROLE
            // -----------------------------------------

            selectedRole,

            selectedRoleId,

            selectedProfileRoleId,

            selectedSchoolId,

            selectedRoleName,


            // -----------------------------------------
            // LOADING
            // -----------------------------------------

            loadingRoles,


            // -----------------------------------------
            // MULTI ROLE
            // -----------------------------------------

            hasMultipleRoles,


            // -----------------------------------------
            // ACTIONS
            // -----------------------------------------

            selectRole,

            clearSelectedRole,


            // -----------------------------------------
            // HELPERS
            // -----------------------------------------

            hasRole,

            selectedRoleIs,

        }),
        [
            roles,

            selectedRole,

            selectedRoleId,

            selectedProfileRoleId,

            selectedSchoolId,

            selectedRoleName,

            loadingRoles,

            hasMultipleRoles,
        ]
    );


    // =====================================================
    // PROVIDER
    // =====================================================

    return (

        <RoleContext.Provider
            value={value}
        >

            {children}

        </RoleContext.Provider>

    );

}


// =====================================================
// USE ROLE
// =====================================================

export function useRole() {

    const context =
        useContext(
            RoleContext
        );


    if (!context) {

        throw new Error(
            "useRole must be used inside RoleProvider"
        );

    }


    return context;

}


// =====================================================
// DEFAULT EXPORT
// =====================================================

export default RoleContext;