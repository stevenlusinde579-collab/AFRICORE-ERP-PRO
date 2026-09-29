import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

import { supabase } from "../services/supabase";


// ============================================================
// ROLE CONTEXT
// ============================================================

const RoleContext = createContext(null);

const ROLE_STORAGE_KEY = "africore_selected_role";


// ============================================================
// HELPERS
// ============================================================

const normalizeRole = (row) => {
    if (!row) return null;

    const role = row.role || row.roles || {};

    return {
        id:
            row.role_id ??
            role.id ??
            null,

        role_id:
            row.role_id ??
            role.id ??
            null,

        name:
            role.name ??
            row.role_name ??
            "",

        description:
            role.description ??
            row.description ??
            "",

        module:
            role.module ??
            row.module ??
            "",

        profileRoleId:
            row.id ??
            row.profile_role_id ??
            null,

        profile_role_id:
            row.id ??
            row.profile_role_id ??
            null,

        school_id:
            row.school_id ??
            null,

        is_primary:
            row.is_primary === true,

        is_active:
            row.is_active !== false,

        raw:
            row,
    };
};


const getStoredRole = () => {
    try {
        const raw = localStorage.getItem(
            ROLE_STORAGE_KEY
        );

        if (!raw) return null;

        return JSON.parse(raw);
    } catch (error) {
        console.warn(
            "ROLE STORAGE READ ERROR:",
            error
        );

        return null;
    }
};


const saveStoredRole = (role) => {
    try {
        if (!role) {
            localStorage.removeItem(
                ROLE_STORAGE_KEY
            );

            return;
        }

        localStorage.setItem(
            ROLE_STORAGE_KEY,
            JSON.stringify({
                id: role.id ?? null,
                role_id:
                    role.role_id ??
                    role.id ??
                    null,
                profileRoleId:
                    role.profileRoleId ??
                    role.profile_role_id ??
                    null,
                profile_role_id:
                    role.profile_role_id ??
                    role.profileRoleId ??
                    null,
                school_id:
                    role.school_id ??
                    null,
                name:
                    role.name ??
                    "",
            })
        );
    } catch (error) {
        console.warn(
            "ROLE STORAGE WRITE ERROR:",
            error
        );
    }
};


// ============================================================
// ROLE PROVIDER
// ============================================================

export function RoleProvider({
    children,
}) {

    const [roles, setRoles] = useState([]);

    const [selectedRole, setSelectedRole] =
        useState(null);

    const [loadingRoles, setLoadingRoles] =
        useState(true);


    // ========================================================
    // LOAD ROLES
    // ========================================================

    const loadRoles = useCallback(
        async () => {

            try {

                setLoadingRoles(true);


                // ------------------------------------------------
                // CURRENT AUTH USER
                // ------------------------------------------------

                const {
                    data: {
                        user,
                    },
                    error: userError,
                } =
                    await supabase.auth.getUser();


                if (userError) {
                    throw userError;
                }


                if (!user) {

                    setRoles([]);

                    setSelectedRole(null);

                    return;
                }


                console.log(
                    "ROLE CONTEXT - LOADING ROLES FOR USER:",
                    user.id
                );


                // ------------------------------------------------
                // PROFILE ROLES
                // ------------------------------------------------

                const {
                    data,
                    error,
                } =
                    await supabase
                        .from("profile_roles")
                        .select(`
                            id,
                            profile_id,
                            role_id,
                            school_id,
                            is_primary,
                            is_active,
                            roles (
                                id,
                                name,
                                description,
                                module
                            )
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
                        );


                if (error) {
                    throw error;
                }


                const normalized =
                    (data || [])
                        .map(normalizeRole)
                        .filter(
                            (role) =>
                                role &&
                                role.id != null
                        );


                console.log(
                    "ROLE CONTEXT - LOADED ROLES:",
                    normalized
                );

                console.log(
                    "ROLE CONTEXT - ROLE COUNT:",
                    normalized.length
                );


                setRoles(normalized);


                // ------------------------------------------------
                // NO ROLES
                // ------------------------------------------------

                if (
                    normalized.length ===
                    0
                ) {

                    setSelectedRole(null);

                    saveStoredRole(null);

                    return;
                }


                // ------------------------------------------------
                // STORED ROLE
                // ------------------------------------------------

                const stored =
                    getStoredRole();


                let nextRole = null;


                // ------------------------------------------------
                // 1. MATCH PROFILE ROLE ID
                // ------------------------------------------------

                if (
                    stored?.profileRoleId
                ) {

                    nextRole =
                        normalized.find(
                            (role) =>
                                String(
                                    role.profileRoleId
                                ) ===
                                String(
                                    stored.profileRoleId
                                )
                        ) || null;
                }


                // ------------------------------------------------
                // 2. MATCH ROLE ID
                // ------------------------------------------------

                if (
                    !nextRole &&
                    stored?.role_id
                ) {

                    nextRole =
                        normalized.find(
                            (role) =>
                                String(
                                    role.role_id
                                ) ===
                                String(
                                    stored.role_id
                                )
                        ) || null;
                }


                // ------------------------------------------------
                // 3. PRIMARY ROLE
                // ------------------------------------------------

                if (!nextRole) {

                    nextRole =
                        normalized.find(
                            (role) =>
                                role.is_primary
                        ) || null;
                }


                // ------------------------------------------------
                // 4. FIRST ACTIVE ROLE
                // ------------------------------------------------

                if (!nextRole) {

                    nextRole =
                        normalized[0];
                }


                setSelectedRole(
                    nextRole
                );

                saveStoredRole(
                    nextRole
                );


                // ------------------------------------------------
                // NOTIFY OTHER CONTEXTS
                // ------------------------------------------------

                window.dispatchEvent(
                    new CustomEvent(
                        "africore-role-loaded",
                        {
                            detail:
                                nextRole,
                        }
                    )
                );

            } catch (error) {

                console.error(
                    "ROLE CONTEXT - LOAD ERROR:",
                    error
                );

                setRoles([]);

                setSelectedRole(null);

            } finally {

                setLoadingRoles(false);
            }
        },
        []
    );


    // ========================================================
    // INITIAL LOAD
    // ========================================================

    useEffect(() => {

        loadRoles();

    }, [
        loadRoles,
    ]);


    // ========================================================
    // AUTH STATE
    // ========================================================

    useEffect(() => {

        const {
            data: {
                subscription,
            },
        } =
            supabase.auth.onAuthStateChange(
                async (
                    event
                ) => {

                    console.log(
                        "ROLE CONTEXT AUTH EVENT:",
                        event
                    );


                    if (
                        event ===
                            "SIGNED_IN" ||
                        event ===
                            "USER_UPDATED" ||
                        event ===
                            "TOKEN_REFRESHED"
                    ) {

                        await loadRoles();

                    }


                    if (
                        event ===
                        "SIGNED_OUT"
                    ) {

                        setRoles([]);

                        setSelectedRole(
                            null
                        );

                        saveStoredRole(
                            null
                        );
                    }
                }
            );


        return () => {

            subscription?.unsubscribe();

        };

    }, [
        loadRoles,
    ]);


    // ========================================================
    // ROLE CHANGE EVENT
    // ========================================================

    useEffect(() => {

        const handleRoleChanged =
            () => {

                loadRoles();
            };


        window.addEventListener(
            "africore-role-changed",
            handleRoleChanged
        );


        return () => {

            window.removeEventListener(
                "africore-role-changed",
                handleRoleChanged
            );
        };

    }, [
        loadRoles,
    ]);


    // ========================================================
    // SELECT ROLE
    // ========================================================

    const selectRole =
        useCallback(
            (roleOrId) => {

                let nextRole = null;


                // ------------------------------------------------
                // ROLE OBJECT
                // ------------------------------------------------

                if (
                    roleOrId &&
                    typeof roleOrId ===
                        "object"
                ) {

                    nextRole =
                        roles.find(
                            (role) =>
                                String(
                                    role.profileRoleId
                                ) ===
                                String(
                                    roleOrId.profileRoleId ??
                                    roleOrId.profile_role_id
                                )
                        ) ||
                        roles.find(
                            (role) =>
                                String(
                                    role.id
                                ) ===
                                String(
                                    roleOrId.id ??
                                    roleOrId.role_id
                                )
                        ) ||
                        null;

                }

                // ------------------------------------------------
                // ROLE ID
                // ------------------------------------------------

                else if (
                    roleOrId != null
                ) {

                    nextRole =
                        roles.find(
                            (role) =>
                                String(
                                    role.id
                                ) ===
                                String(
                                    roleOrId
                                ) ||
                                String(
                                    role.role_id
                                ) ===
                                String(
                                    roleOrId
                                ) ||
                                String(
                                    role.profileRoleId
                                ) ===
                                String(
                                    roleOrId
                                )
                        ) || null;
                }


                if (!nextRole) {

                    console.warn(
                        "ROLE CONTEXT - ROLE NOT FOUND:",
                        roleOrId
                    );

                    return;
                }


                setSelectedRole(
                    nextRole
                );


                saveStoredRole(
                    nextRole
                );


                console.log(
                    "ROLE CONTEXT - SELECTED ROLE:",
                    nextRole
                );


                // ------------------------------------------------
                // IMPORTANT:
                // SCHOOL CONTEXT listens to this event.
                // ------------------------------------------------

                window.dispatchEvent(
                    new CustomEvent(
                        "africore-role-changed",
                        {
                            detail:
                                nextRole,
                        }
                    )
                );
            },
            [
                roles,
            ]
        );


    // ========================================================
    // CLEAR SELECTED ROLE
    // ========================================================

    const clearSelectedRole =
        useCallback(() => {

            setSelectedRole(
                null
            );

            saveStoredRole(
                null
            );


            window.dispatchEvent(
                new CustomEvent(
                    "africore-role-changed",
                    {
                        detail: null,
                    }
                )
            );

        }, []);


    // ========================================================
    // HAS ROLE
    // ========================================================

    const hasRole =
        useCallback(
            (
                roleNameOrId
            ) => {

                if (
                    roleNameOrId ==
                    null
                ) {
                    return false;
                }


                return roles.some(
                    (role) => {

                        const target =
                            String(
                                roleNameOrId
                            )
                                .trim()
                                .toLowerCase();


                        const idMatch =
                            String(
                                role.id
                            ) ===
                                target ||
                            String(
                                role.role_id
                            ) ===
                                target;


                        const nameMatch =
                            String(
                                role.name ||
                                ""
                            )
                                .trim()
                                .toLowerCase() ===
                            target;


                        return (
                            idMatch ||
                            nameMatch
                        );
                    }
                );
            },
            [
                roles,
            ]
        );


    // ========================================================
    // SELECTED ROLE CHECK
    // ========================================================

    const selectedRoleIs =
        useCallback(
            (
                roleNameOrId
            ) => {

                if (
                    !selectedRole ||
                    roleNameOrId ==
                        null
                ) {
                    return false;
                }


                const target =
                    String(
                        roleNameOrId
                    )
                        .trim()
                        .toLowerCase();


                return (
                    String(
                        selectedRole.id
                    ) === target ||
                    String(
                        selectedRole.role_id
                    ) === target ||
                    String(
                        selectedRole.name ||
                        ""
                    )
                        .trim()
                        .toLowerCase() ===
                        target
                );
            },
            [
                selectedRole,
            ]
        );


    // ========================================================
    // DERIVED VALUES
    // ========================================================

    const selectedRoleId =
        selectedRole?.role_id ??
        selectedRole?.id ??
        null;


    const selectedProfileRoleId =
        selectedRole?.profileRoleId ??
        selectedRole?.profile_role_id ??
        null;


    const selectedSchoolId =
        selectedRole?.school_id ??
        null;


    const selectedRoleName =
        selectedRole?.name ??
        "";


    const hasMultipleRoles =
        roles.length > 1;


    // ========================================================
    // CONTEXT VALUE
    // ========================================================

    const value =
        useMemo(
            () => ({
                roles,

                selectedRole,

                selectedRoleId,

                selectedProfileRoleId,

                selectedSchoolId,

                selectedRoleName,

                loadingRoles,

                hasMultipleRoles,

                selectRole,

                clearSelectedRole,

                hasRole,

                selectedRoleIs,

                loadRoles,
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
                selectRole,
                clearSelectedRole,
                hasRole,
                selectedRoleIs,
                loadRoles,
            ]
        );


    // ========================================================
    // PROVIDER
    // ========================================================

    return (
        <RoleContext.Provider
            value={value}
        >
            {children}
        </RoleContext.Provider>
    );
}


// ============================================================
// USE ROLE
// ============================================================

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


// ============================================================
// DEFAULT EXPORT
// ============================================================

export default RoleContext;