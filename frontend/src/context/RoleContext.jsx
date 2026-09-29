import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

import { supabase } from "../services/supabase";


// =====================================================
// ROLE CONTEXT
// =====================================================
//
// GLOBAL SOURCE OF TRUTH FOR:
//
// - Available user roles
// - Selected role
// - Selected profile role
// - Selected school
//
// IMPORTANT:
// The actual roles table uses:
//
// roles.id
// roles.role_name
// roles.description
// roles.created_at
//
// There is NO `roles.name` column.
// There is NO `roles.module` column.
//
// =====================================================


const RoleContext = createContext(null);


// =====================================================
// STORAGE KEY
// =====================================================

const ROLE_STORAGE_KEY =
    "africore_selected_role";


// =====================================================
// NORMALIZE ROLE
// =====================================================

const normalizeRole = (row) => {

    if (!row) {
        return null;
    }


    const role =
        row.role ||
        row.roles ||
        {};


    const roleName =
        role.role_name ??
        role.name ??
        row.role_name ??
        row.name ??
        "";


    return {

        // ---------------------------------------------
        // ROLE ID
        // ---------------------------------------------

        id:
            row.role_id ??
            role.id ??
            null,

        role_id:
            row.role_id ??
            role.id ??
            null,


        // ---------------------------------------------
        // ROLE NAME
        // ---------------------------------------------

        name:
            roleName,

        role_name:
            roleName,


        // ---------------------------------------------
        // DESCRIPTION
        // ---------------------------------------------

        description:
            role.description ??
            row.description ??
            "",


        // ---------------------------------------------
        // MODULE
        // ---------------------------------------------
        //
        // Older parts of AfriCore may read `module`.
        // The current database does not have a module
        // column, therefore keep it safely empty.
        //
        // ---------------------------------------------

        module:
            role.module ??
            row.module ??
            "",


        // ---------------------------------------------
        // PROFILE ROLE
        // ---------------------------------------------

        profileRoleId:
            row.id ??
            row.profile_role_id ??
            null,

        profile_role_id:
            row.id ??
            row.profile_role_id ??
            null,


        // ---------------------------------------------
        // SCHOOL
        // ---------------------------------------------

        school_id:
            row.school_id ??
            null,


        // ---------------------------------------------
        // FLAGS
        // ---------------------------------------------

        is_primary:
            row.is_primary === true,

        is_active:
            row.is_active !== false,


        // ---------------------------------------------
        // RAW
        // ---------------------------------------------

        raw:
            row,
    };

};


// =====================================================
// GET STORED ROLE
// =====================================================

const getStoredRole = () => {

    try {

        const raw =
            localStorage.getItem(
                ROLE_STORAGE_KEY
            );


        if (!raw) {
            return null;
        }


        return JSON.parse(raw);

    } catch (error) {

        console.warn(
            "ROLE STORAGE READ ERROR:",
            error
        );

        return null;

    }

};


// =====================================================
// SAVE STORED ROLE
// =====================================================

const saveStoredRole = (
    role
) => {

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

                id:
                    role.id ??
                    null,

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
                    role.role_name ??
                    "",

                role_name:
                    role.role_name ??
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


// =====================================================
// ROLE PROVIDER
// =====================================================

export function RoleProvider({
    children,
}) {

    const [
        roles,
        setRoles,
    ] = useState([]);


    const [
        selectedRole,
        setSelectedRole,
    ] = useState(null);


    const [
        loadingRoles,
        setLoadingRoles,
    ] = useState(true);


    // =================================================
    // LOAD ROLES
    // =================================================

    const loadRoles = useCallback(
        async () => {

            try {

                setLoadingRoles(true);


                // =====================================
                // CURRENT AUTH USER
                // =====================================

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


                // =====================================
                // NO USER
                // =====================================

                if (!user) {

                    setRoles([]);

                    setSelectedRole(null);

                    return;

                }


                console.log(
                    "ROLE CONTEXT - LOADING ROLES FOR USER:",
                    user.id
                );


                // =====================================
                // LOAD PROFILE ROLES
                // =====================================
                //
                // IMPORTANT:
                //
                // roles.role_name is the actual
                // database column.
                //
                // Do NOT request:
                // roles.name
                // roles.module
                //
                // =====================================

                const {
                    data,
                    error,
                } =
                    await supabase
                        .from(
                            "profile_roles"
                        )
                        .select(`
                            id,
                            profile_id,
                            role_id,
                            school_id,
                            is_primary,
                            is_active,
                            roles (
                                id,
                                role_name,
                                description
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

                    console.error(
                        "ROLE CONTEXT - SUPABASE QUERY ERROR:",
                        error
                    );

                    throw error;

                }


                // =====================================
                // NORMALIZE
                // =====================================

                const normalized =
                    (
                        data || []
                    )
                        .map(
                            normalizeRole
                        )
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


                setRoles(
                    normalized
                );


                // =====================================
                // NO ROLES
                // =====================================

                if (
                    normalized.length === 0
                ) {

                    setSelectedRole(
                        null
                    );

                    saveStoredRole(
                        null
                    );

                    return;

                }


                // =====================================
                // GET STORED ROLE
                // =====================================

                const stored =
                    getStoredRole();


                let nextRole =
                    null;


                // =====================================
                // TRY STORED PROFILE ROLE
                // =====================================

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
                        ) ||
                        null;

                }


                // =====================================
                // TRY STORED PROFILE ROLE ID
                // =====================================

                if (
                    !nextRole &&
                    stored?.profile_role_id
                ) {

                    nextRole =
                        normalized.find(
                            (role) =>
                                String(
                                    role.profile_role_id
                                ) ===
                                String(
                                    stored.profile_role_id
                                )
                        ) ||
                        null;

                }


                // =====================================
                // TRY STORED ROLE ID
                // =====================================

                if (
                    !nextRole &&
                    (
                        stored?.role_id ||
                        stored?.id
                    )
                ) {

                    const storedRoleId =
                        stored.role_id ??
                        stored.id;


                    nextRole =
                        normalized.find(
                            (role) =>
                                String(
                                    role.role_id
                                ) ===
                                String(
                                    storedRoleId
                                )
                        ) ||
                        null;

                }


                // =====================================
                // PRIMARY ROLE
                // =====================================

                if (!nextRole) {

                    nextRole =
                        normalized.find(
                            (role) =>
                                role.is_primary
                        ) ||
                        null;

                }


                // =====================================
                // FIRST ROLE
                // =====================================

                if (!nextRole) {

                    nextRole =
                        normalized[0];

                }


                // =====================================
                // SAVE SELECTED ROLE
                // =====================================

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


                // =====================================
                // EVENT
                // =====================================

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

                setSelectedRole(
                    null
                );

            } finally {

                setLoadingRoles(
                    false
                );

            }

        },
        []
    );


    // =================================================
    // INITIAL LOAD
    // =================================================

    useEffect(() => {

        loadRoles();

    }, [
        loadRoles,
    ]);


    // =================================================
    // AUTH STATE LISTENER
    // =================================================

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


    // =================================================
    // ROLE CHANGED EVENT
    // =================================================

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


    // =================================================
    // SELECT ROLE
    // =================================================

    const selectRole = useCallback(
        (
            roleOrId
        ) => {

            let nextRole =
                null;


            // =========================================
            // OBJECT
            // =========================================

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


            // =========================================
            // ID
            // =========================================

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
                    ) ||
                    null;

            }


            // =========================================
            // NOT FOUND
            // =========================================

            if (!nextRole) {

                console.warn(
                    "ROLE CONTEXT - ROLE NOT FOUND:",
                    roleOrId
                );

                return;

            }


            // =========================================
            // SAVE
            // =========================================

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


    // =================================================
    // CLEAR SELECTED ROLE
    // =================================================

    const clearSelectedRole =
        useCallback(
            () => {

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
                            detail:
                                null,
                        }
                    )
                );

            },
            []
        );


    // =================================================
    // HAS ROLE
    // =================================================

    const hasRole = useCallback(
        (
            roleNameOrId
        ) => {

            if (
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


            return roles.some(
                (role) => {

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
                            role.role_name ||
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


    // =================================================
    // SELECTED ROLE IS
    // =================================================

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
                    ) ===
                        target ||
                    String(
                        selectedRole.role_id
                    ) ===
                        target ||
                    String(
                        selectedRole.name ||
                        selectedRole.role_name ||
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


    // =================================================
    // DERIVED VALUES
    // =================================================

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
        selectedRole?.role_name ??
        "";


    const hasMultipleRoles =
        roles.length > 1;


    // =================================================
    // CONTEXT VALUE
    // =================================================

    const value = useMemo(
        () => ({

            // -----------------------------------------
            // ROLES
            // -----------------------------------------

            roles,

            selectedRole,

            selectedRoleId,

            selectedProfileRoleId,

            selectedSchoolId,

            selectedRoleName,

            loadingRoles,

            hasMultipleRoles,


            // -----------------------------------------
            // ACTIONS
            // -----------------------------------------

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


    // =================================================
    // PROVIDER
    // =================================================

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