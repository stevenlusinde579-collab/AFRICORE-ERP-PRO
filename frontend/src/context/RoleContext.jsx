import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

import { supabase } from "../services/supabase";
import { useAuth } from "./AuthContext";

const RoleContext = createContext(null);

const STORAGE_KEY = "africore_selected_role";


// =====================================================
// ROLE PROVIDER
// =====================================================

export function RoleProvider({ children }) {

    const { user } = useAuth();

    const [roles, setRoles] = useState([]);

    const [selectedRole, setSelectedRole] =
        useState(null);

    const [loadingRoles, setLoadingRoles] =
        useState(true);


    // =====================================================
    // LOAD ALL ACTIVE ROLES FOR CURRENT USER
    // =====================================================

    useEffect(() => {

        let cancelled = false;


        const loadRoles = async () => {

            // -------------------------------------------------
            // NO USER
            // -------------------------------------------------

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
                // READ PROFILE ROLES
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

                    console.error(
                        "ROLE CONTEXT - PROFILE ROLES ERROR:",
                        profileRolesError
                    );


                    if (!cancelled) {

                        setRoles([]);

                        setSelectedRole(null);

                    }

                    return;

                }


                // =================================================
                // NO PROFILE ROLE RECORDS
                // =================================================

                if (
                    !Array.isArray(
                        profileRoles
                    ) ||
                    profileRoles.length === 0
                ) {

                    console.warn(
                        "ROLE CONTEXT - NO ACTIVE PROFILE ROLES FOUND FOR USER:",
                        user.id
                    );


                    // ------------------------------------------------
                    // FALLBACK:
                    // READ LEGACY profiles.role_id
                    // ------------------------------------------------

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

                        console.error(
                            "ROLE CONTEXT - PROFILE FALLBACK ERROR:",
                            profileError
                        );


                        if (!cancelled) {

                            setRoles([]);

                            setSelectedRole(null);

                        }

                        return;

                    }


                    if (
                        !profile?.role_id
                    ) {

                        if (!cancelled) {

                            setRoles([]);

                            setSelectedRole(null);

                        }

                        return;

                    }


                    // =================================================
                    // GET LEGACY ROLE
                    // =================================================

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

                        console.error(
                            "ROLE CONTEXT - LEGACY ROLE ERROR:",
                            legacyRoleError
                        );


                        if (!cancelled) {

                            setRoles([]);

                            setSelectedRole(null);

                        }

                        return;

                    }


                    if (
                        !legacyRole
                    ) {

                        if (!cancelled) {

                            setRoles([]);

                            setSelectedRole(null);

                        }

                        return;

                    }


                    const fallbackRole = {

                        profileRoleId:
                            `legacy-${profile.role_id}`,

                        profileId:
                            user.id,

                        roleId:
                            profile.role_id,

                        schoolId:
                            profile.school_id,

                        isPrimary:
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


                    if (!cancelled) {

                        setRoles([
                            fallbackRole,
                        ]);

                        setSelectedRole(
                            fallbackRole
                        );

                    }


                    localStorage.setItem(
                        STORAGE_KEY,
                        JSON.stringify({
                            roleId:
                                fallbackRole.roleId,
                            profileRoleId:
                                fallbackRole.profileRoleId,
                        })
                    );


                    return;

                }


                // =================================================
                // STEP 2
                // GET UNIQUE ROLE IDS
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

                    console.error(
                        "ROLE CONTEXT - ROLES ERROR:",
                        rolesError
                    );


                    if (!cancelled) {

                        setRoles([]);

                        setSelectedRole(null);

                    }

                    return;

                }


                // =================================================
                // STEP 4
                // COMBINE profile_roles + roles
                // =================================================

                const loadedRoles =
                    profileRoles
                        .map(
                            (
                                profileRole
                            ) => {

                                const role =
                                    (
                                        Array.isArray(
                                            roleRows
                                        )
                                            ? roleRows
                                            : []
                                    ).find(
                                        (
                                            item
                                        ) =>
                                            String(
                                                item.id
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


                // =================================================
                // DEBUG
                // =================================================

                console.log(
                    "ROLE CONTEXT - LOADED ROLES:",
                    loadedRoles
                );


                console.log(
                    "ROLE CONTEXT - ROLE COUNT:",
                    loadedRoles.length
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
                // STEP 5
                // SAVE ROLES
                // =================================================

                setRoles(
                    loadedRoles
                );


                // =================================================
                // STEP 6
                // RESTORE SAVED ROLE
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

                } catch (
                    error
                ) {

                    console.warn(
                        "ROLE CONTEXT - INVALID SAVED ROLE:",
                        error
                    );


                    localStorage.removeItem(
                        STORAGE_KEY
                    );

                }


                let nextRole = null;


                // -------------------------------------------------
                // MATCH BY PROFILE ROLE ID FIRST
                // -------------------------------------------------

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


                // -------------------------------------------------
                // MATCH BY ROLE ID
                // -------------------------------------------------

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


                // -------------------------------------------------
                // PRIMARY ROLE
                // -------------------------------------------------

                if (!nextRole) {

                    nextRole =
                        loadedRoles.find(
                            (
                                item
                            ) =>
                                item.isPrimary
                        );

                }


                // -------------------------------------------------
                // FIRST ROLE
                // -------------------------------------------------

                if (!nextRole) {

                    nextRole =
                        loadedRoles[0] ||
                        null;

                }


                setSelectedRole(
                    nextRole
                );


                // =================================================
                // SAVE CURRENT SELECTION
                // =================================================

                if (nextRole) {

                    localStorage.setItem(
                        STORAGE_KEY,
                        JSON.stringify({
                            roleId:
                                nextRole.roleId,

                            profileRoleId:
                                nextRole.profileRoleId,
                        })
                    );

                }

            } catch (
                error
            ) {

                console.error(
                    "ROLE CONTEXT - UNEXPECTED ERROR:",
                    error
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

    }, [user?.id]);


    // =====================================================
    // SELECT ROLE
    // =====================================================

    const selectRole = (
        roleIdOrProfileRoleId
    ) => {

        const nextRole =
            roles.find(
                (
                    item
                ) =>
                    String(
                        item.roleId
                    ) ===
                        String(
                            roleIdOrProfileRoleId
                        ) ||
                    String(
                        item.profileRoleId
                    ) ===
                        String(
                            roleIdOrProfileRoleId
                        )
            );


        if (!nextRole) {

            console.warn(
                "ROLE CONTEXT - ROLE NOT FOUND:",
                roleIdOrProfileRoleId
            );

            return;

        }


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

    };


    // =====================================================
    // CLEAR SELECTED ROLE
    // =====================================================

    const clearSelectedRole =
        () => {

            setSelectedRole(
                null
            );

            localStorage.removeItem(
                STORAGE_KEY
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


    const selectedRoleName =
        selectedRole?.roleName ||
        selectedRole?.role?.name ||
        "";


    const hasMultipleRoles =
        roles.length > 1;


    // =====================================================
    // CHECK WHETHER USER HAS A ROLE
    // =====================================================

    const hasRole = (
        roleName
    ) => {

        if (!roleName) {
            return false;
        }


        const target =
            String(
                roleName
            )
                .trim()
                .toLowerCase();


        return roles.some(
            (
                item
            ) =>
                String(
                    item.roleName ||
                    ""
                )
                    .trim()
                    .toLowerCase() ===
                target
        );

    };


    // =====================================================
    // CHECK CURRENT SELECTED ROLE
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
            String(
                selectedRoleName
            )
                .trim()
                .toLowerCase() ===
            String(
                roleName
            )
                .trim()
                .toLowerCase()
        );

    };


    // =====================================================
    // CONTEXT VALUE
    // =====================================================

    const value = useMemo(
        () => ({

            roles,

            selectedRole,

            selectedRoleId,

            selectedProfileRoleId,

            selectedRoleName,

            loadingRoles,

            hasMultipleRoles,

            selectRole,

            clearSelectedRole,

            hasRole,

            selectedRoleIs,

        }),
        [
            roles,

            selectedRole,

            selectedRoleId,

            selectedProfileRoleId,

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


export default RoleContext;