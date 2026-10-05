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
// SCHOOL CONTEXT
// =====================================================
//
// GLOBAL SOURCE OF TRUTH FOR:
//
// - Current School
// - Academic Years
// - Active Academic Year
//
// IMPORTANT:
//
// Super Admin:
//     selected role ID = 1 OR selected role name = Super Admin
//     => profiles.school_id is authoritative.
//
// Other roles:
//     selected profile role / saved role / primary role
//     may determine the school.
//
// This prevents Super Admin from being redirected to a
// different school because of a stale profile_roles record.
//
// =====================================================

const SchoolContext = createContext(null);

// =====================================================
// STORAGE KEY
// =====================================================

const ROLE_STORAGE_KEY = "africore_selected_role";

// =====================================================
// SCHOOL COLUMNS
// =====================================================

const SCHOOL_COLUMNS = `
    id,
    school_name,
    registration_number,
    address,
    phone,
    email,
    logo,
    created_at,
    show_school_name,
    show_logo,
    show_registration_number,
    show_address,
    show_phone,
    show_email
`;

// =====================================================
// PROVIDER
// =====================================================

export const SchoolProvider = ({ children }) => {

    // =================================================
    // SCHOOL STATE
    // =================================================

    const [school, setSchool] = useState(null);

    const [schoolId, setSchoolId] = useState(null);

    const [loading, setLoading] = useState(true);

    const [error, setError] = useState(null);

    // =================================================
    // ACADEMIC YEAR STATE
    // =================================================

    const [academicYears, setAcademicYears] = useState([]);

    const [activeAcademicYear, setActiveAcademicYear] =
        useState(null);

    const [academicYearLoading, setAcademicYearLoading] =
        useState(true);

    const [academicYearError, setAcademicYearError] =
        useState(null);

    // =================================================
    // GET SAVED ROLE
    // =================================================

    const getSavedRole = useCallback(() => {

        try {

            const saved =
                localStorage.getItem(
                    ROLE_STORAGE_KEY
                );

            if (!saved) {
                return null;
            }

            const parsed =
                JSON.parse(saved);

            if (
                !parsed ||
                typeof parsed !== "object"
            ) {
                return null;
            }

            return parsed;

        } catch (err) {

            console.warn(
                "SCHOOL CONTEXT - INVALID SAVED ROLE:",
                err
            );

            try {

                localStorage.removeItem(
                    ROLE_STORAGE_KEY
                );

            } catch {
                // Ignore localStorage errors
            }

            return null;
        }

    }, []);

    // =================================================
    // RESOLVE USER SCHOOL
    // =================================================

    const resolveUserSchoolId = useCallback(
        async (
            userId,
            profileSchoolId,
            profileRoleId
        ) => {

            if (!userId) {
                return null;
            }

            const numericProfileRoleId =
                Number(profileRoleId);

            const numericProfileSchoolId =
                Number(profileSchoolId);

            // =================================================
            // READ CURRENTLY SELECTED ROLE
            // =================================================

            const savedRole =
                getSavedRole();

            const selectedRoleId =
                Number(
                    savedRole?.roleId ??
                    savedRole?.role_id ??
                    savedRole?.selectedRoleId ??
                    savedRole?.selected_role_id
                );

            const selectedProfileRoleId =
                Number(
                    savedRole?.profileRoleId ??
                    savedRole?.profile_role_id ??
                    savedRole?.selectedProfileRoleId ??
                    savedRole?.selected_profile_role_id
                );

            const selectedRoleName =
                String(
                    savedRole?.roleName ??
                    savedRole?.role_name ??
                    savedRole?.selectedRoleName ??
                    savedRole?.selected_role_name ??
                    savedRole?.name ??
                    ""
                )
                    .trim()
                    .toLowerCase();

            const isSuperAdminBySelectedRole =
                selectedRoleId === 1 ||
                selectedRoleName === "super admin" ||
                selectedRoleName === "super administrator";

            const isSuperAdminByProfile =
                numericProfileRoleId === 1;

            // =================================================
            // SUPER ADMIN
            // =================================================
            //
            // IMPORTANT:
            //
            // The current logs show:
            //
            // selected role ID       = 1
            // selected role name     = Super Admin
            // profile role ID        = 2
            //
            // Therefore checking only profile.role_id is WRONG.
            //
            // Super Admin must be detected from either:
            //
            // 1. selected role
            // 2. profile role
            //
            // When Super Admin is selected, profiles.school_id
            // remains the authoritative school.
            //
            // =================================================

            if (
                isSuperAdminBySelectedRole ||
                isSuperAdminByProfile
            ) {

                if (
                    Number.isFinite(
                        numericProfileSchoolId
                    ) &&
                    numericProfileSchoolId > 0
                ) {

                    console.log(
                        "========================================"
                    );

                    console.log(
                        "SCHOOL CONTEXT - SUPER ADMIN SCHOOL SOURCE"
                    );

                    console.log(
                        "SELECTED ROLE ID:",
                        Number.isFinite(selectedRoleId)
                            ? selectedRoleId
                            : null
                    );

                    console.log(
                        "SELECTED ROLE NAME:",
                        selectedRoleName || null
                    );

                    console.log(
                        "SELECTED PROFILE ROLE ID:",
                        Number.isFinite(
                            selectedProfileRoleId
                        )
                            ? selectedProfileRoleId
                            : null
                    );

                    console.log(
                        "PROFILE ROLE ID:",
                        numericProfileRoleId
                    );

                    console.log(
                        "PROFILE SCHOOL ID:",
                        numericProfileSchoolId
                    );

                    console.log(
                        "SCHOOL CONTEXT - SUPER ADMIN USING profiles.school_id"
                    );

                    console.log(
                        "========================================"
                    );

                    return numericProfileSchoolId;
                }

                console.warn(
                    "SCHOOL CONTEXT - SUPER ADMIN HAS NO VALID profiles.school_id"
                );

                return null;
            }

            // =================================================
            // OTHER ROLES
            // =================================================

            // =================================================
            // STEP 1
            // SAVED PROFILE ROLE
            // =================================================

            if (
                savedRole?.profileRoleId ||
                savedRole?.profile_role_id
            ) {

                const savedProfileRoleId =
                    savedRole.profileRoleId ??
                    savedRole.profile_role_id;

                const {
                    data: selectedProfileRole,
                    error: selectedRoleError,
                } = await supabase
                    .from("profile_roles")
                    .select(`
                        id,
                        school_id,
                        role_id,
                        is_primary,
                        is_active
                    `)
                    .eq(
                        "id",
                        savedProfileRoleId
                    )
                    .eq(
                        "profile_id",
                        userId
                    )
                    .eq(
                        "is_active",
                        true
                    )
                    .maybeSingle();

                if (selectedRoleError) {

                    console.warn(
                        "SCHOOL CONTEXT - SELECTED PROFILE ROLE ERROR:",
                        selectedRoleError
                    );
                }

                if (
                    selectedProfileRole?.school_id
                ) {

                    console.log(
                        "SCHOOL CONTEXT - SCHOOL FROM SELECTED ROLE:",
                        selectedProfileRole.school_id
                    );

                    return selectedProfileRole.school_id;
                }
            }

            // =================================================
            // STEP 2
            // SAVED ROLE ID
            // =================================================

            if (
                savedRole?.roleId ||
                savedRole?.role_id
            ) {

                const savedRoleId =
                    savedRole.roleId ??
                    savedRole.role_id;

                const {
                    data: savedRoleRows,
                    error: savedRoleError,
                } = await supabase
                    .from("profile_roles")
                    .select(`
                        id,
                        school_id,
                        role_id,
                        is_primary,
                        is_active
                    `)
                    .eq(
                        "profile_id",
                        userId
                    )
                    .eq(
                        "role_id",
                        savedRoleId
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
                    )
                    .limit(1);

                if (savedRoleError) {

                    console.warn(
                        "SCHOOL CONTEXT - SAVED ROLE ID ERROR:",
                        savedRoleError
                    );
                }

                const savedRoleRow =
                    Array.isArray(
                        savedRoleRows
                    )
                        ? savedRoleRows[0]
                        : null;

                if (
                    savedRoleRow?.school_id
                ) {

                    console.log(
                        "SCHOOL CONTEXT - SCHOOL FROM SAVED ROLE ID:",
                        savedRoleRow.school_id
                    );

                    return savedRoleRow.school_id;
                }
            }

            // =================================================
            // STEP 3
            // PRIMARY ACTIVE PROFILE ROLE
            // =================================================

            const {
                data: primaryRoles,
                error: primaryRoleError,
            } = await supabase
                .from("profile_roles")
                .select(`
                    id,
                    school_id,
                    role_id,
                    is_primary,
                    is_active
                `)
                .eq(
                    "profile_id",
                    userId
                )
                .eq(
                    "is_active",
                    true
                )
                .eq(
                    "is_primary",
                    true
                )
                .order(
                    "id",
                    {
                        ascending: true,
                    }
                )
                .limit(1);

            if (primaryRoleError) {

                console.warn(
                    "SCHOOL CONTEXT - PRIMARY ROLE ERROR:",
                    primaryRoleError
                );
            }

            const primaryRole =
                Array.isArray(
                    primaryRoles
                )
                    ? primaryRoles[0]
                    : null;

            if (
                primaryRole?.school_id
            ) {

                console.log(
                    "SCHOOL CONTEXT - SCHOOL FROM PRIMARY ROLE:",
                    primaryRole.school_id
                );

                return primaryRole.school_id;
            }

            // =================================================
            // STEP 4
            // ANY ACTIVE PROFILE ROLE
            // =================================================

            const {
                data: activeRoles,
                error: activeRolesError,
            } = await supabase
                .from("profile_roles")
                .select(`
                    id,
                    school_id,
                    role_id,
                    is_primary,
                    is_active
                `)
                .eq(
                    "profile_id",
                    userId
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
                )
                .limit(1);

            if (activeRolesError) {

                console.warn(
                    "SCHOOL CONTEXT - ACTIVE ROLE ERROR:",
                    activeRolesError
                );
            }

            const activeRole =
                Array.isArray(
                    activeRoles
                )
                    ? activeRoles[0]
                    : null;

            if (
                activeRole?.school_id
            ) {

                console.log(
                    "SCHOOL CONTEXT - SCHOOL FROM ACTIVE ROLE:",
                    activeRole.school_id
                );

                return activeRole.school_id;
            }

            // =================================================
            // STEP 5
            // LEGACY PROFILE FALLBACK
            // =================================================

            if (
                Number.isFinite(
                    numericProfileSchoolId
                ) &&
                numericProfileSchoolId > 0
            ) {

                console.warn(
                    "SCHOOL CONTEXT - USING LEGACY profiles.school_id FALLBACK:",
                    numericProfileSchoolId
                );

                return numericProfileSchoolId;
            }

            return null;

        },
        [
            getSavedRole,
        ]
    );

    // =================================================
    // LOAD ACADEMIC YEARS
    // =================================================

    const loadAcademicYears = useCallback(
        async (
            currentSchoolId = null
        ) => {

            const targetSchoolId =
                currentSchoolId ??
                schoolId;

            if (!targetSchoolId) {

                setAcademicYears([]);

                setActiveAcademicYear(null);

                setAcademicYearError(
                    "No current school is available."
                );

                setAcademicYearLoading(
                    false
                );

                return [];
            }

            try {

                setAcademicYearLoading(
                    true
                );

                setAcademicYearError(
                    null
                );

                const {
                    data,
                    error: academicYearQueryError,
                } = await supabase
                    .from("academic_years")
                    .select(`
                        id,
                        school_id,
                        year_name,
                        term,
                        start_date,
                        end_date,
                        is_active,
                        created_at
                    `)
                    .eq(
                        "school_id",
                        targetSchoolId
                    )
                    .order(
                        "id",
                        {
                            ascending: false,
                        }
                    );

                if (
                    academicYearQueryError
                ) {

                    throw academicYearQueryError;
                }

                const normalizedYears =
                    Array.isArray(data)
                        ? data
                        : [];

                setAcademicYears(
                    normalizedYears
                );

                const currentYear =
                    normalizedYears.find(
                        (year) =>
                            year.is_active === true
                    ) ||
                    null;

                setActiveAcademicYear(
                    currentYear
                );

                if (!currentYear) {

                    setAcademicYearError(
                        "No active academic year has been configured for this school."
                    );

                } else {

                    setAcademicYearError(
                        null
                    );
                }

                console.log(
                    "SCHOOL CONTEXT ACADEMIC YEARS:",
                    normalizedYears
                );

                console.log(
                    "SCHOOL CONTEXT ACTIVE ACADEMIC YEAR:",
                    currentYear
                );

                return normalizedYears;

            } catch (err) {

                console.error(
                    "LOAD ACADEMIC YEARS ERROR:",
                    err
                );

                setAcademicYears([]);

                setActiveAcademicYear(
                    null
                );

                setAcademicYearError(
                    err?.message ||
                    "Failed to load academic years."
                );

                return [];

            } finally {

                setAcademicYearLoading(
                    false
                );
            }

        },
        [
            schoolId,
        ]
    );

    // =================================================
    // LOAD CURRENT USER SCHOOL
    // =================================================

    const loadSchool = useCallback(
        async () => {

            try {

                setLoading(true);

                setError(null);

                // =========================================
                // CURRENT AUTH USER
                // =========================================

                const {
                    data: {
                        user,
                    },
                    error: authError,
                } = await supabase.auth.getUser();

                if (authError) {
                    throw authError;
                }

                // =========================================
                // NO USER
                // =========================================

                if (!user) {

                    setSchool(null);

                    setSchoolId(null);

                    setAcademicYears([]);

                    setActiveAcademicYear(null);

                    setAcademicYearError(null);

                    return null;
                }

                // =========================================
                // PROFILE
                // =========================================

                const {
                    data: profile,
                    error: profileError,
                } = await supabase
                    .from("profiles")
                    .select(`
                        id,
                        school_id,
                        role_id
                    `)
                    .eq(
                        "id",
                        user.id
                    )
                    .maybeSingle();

                if (profileError) {
                    throw profileError;
                }

                // =========================================
                // PROFILE NOT FOUND
                // =========================================

                if (!profile) {

                    setSchool(null);

                    setSchoolId(null);

                    setAcademicYears([]);

                    setActiveAcademicYear(null);

                    setAcademicYearError(null);

                    return null;
                }

                // =========================================
                // RESOLVE SCHOOL
                // =========================================

                const resolvedSchoolId =
                    await resolveUserSchoolId(
                        user.id,
                        profile.school_id,
                        profile.role_id
                    );

                if (!resolvedSchoolId) {

                    setSchool(null);

                    setSchoolId(null);

                    setAcademicYears([]);

                    setActiveAcademicYear(null);

                    setAcademicYearError(
                        "Your account is not assigned to a school."
                    );

                    return null;
                }

                console.log(
                    "========================================"
                );

                console.log(
                    "SCHOOL CONTEXT - RESOLVED SCHOOL ID:",
                    resolvedSchoolId
                );

                console.log(
                    "SCHOOL CONTEXT - PROFILE SCHOOL ID:",
                    profile.school_id
                );

                console.log(
                    "SCHOOL CONTEXT - PROFILE ROLE ID:",
                    profile.role_id
                );

                console.log(
                    "========================================"
                );

                // =========================================
                // LOAD SCHOOL
                // =========================================

                const {
                    data: schoolData,
                    error: schoolError,
                } = await supabase
                    .from("schools")
                    .select(
                        SCHOOL_COLUMNS
                    )
                    .eq(
                        "id",
                        resolvedSchoolId
                    )
                    .maybeSingle();

                if (schoolError) {
                    throw schoolError;
                }

                // =========================================
                // SCHOOL NOT FOUND
                // =========================================

                if (!schoolData) {

                    setSchool(null);

                    setSchoolId(null);

                    setAcademicYears([]);

                    setActiveAcademicYear(null);

                    setAcademicYearError(
                        "Current school could not be found."
                    );

                    return null;
                }

                // =========================================
                // SAVE SCHOOL
                // =========================================

                setSchool(
                    schoolData
                );

                setSchoolId(
                    schoolData.id
                );

                return schoolData;

            } catch (err) {

                console.error(
                    "========================================"
                );

                console.error(
                    "SCHOOL CONTEXT LOAD ERROR"
                );

                console.error(
                    err
                );

                console.error(
                    "========================================"
                );

                setError(
                    err?.message ||
                    "Failed to load current school."
                );

                setSchool(null);

                setSchoolId(null);

                setAcademicYears([]);

                setActiveAcademicYear(null);

                setAcademicYearError(
                    err?.message ||
                    "Failed to load current academic year."
                );

                return null;

            } finally {

                setLoading(false);
            }

        },
        [
            resolveUserSchoolId,
        ]
    );

    // =================================================
    // REFRESH SCHOOL
    // =================================================

    const refreshSchool = useCallback(
        async () => {

            const schoolData =
                await loadSchool();

            if (
                schoolData?.id
            ) {

                await loadAcademicYears(
                    schoolData.id
                );

            } else {

                setAcademicYears([]);

                setActiveAcademicYear(
                    null
                );

                setAcademicYearLoading(
                    false
                );
            }

            return schoolData;

        },
        [
            loadSchool,
            loadAcademicYears,
        ]
    );

    // =================================================
    // REFRESH ACADEMIC YEAR
    // =================================================

    const refreshAcademicYear = useCallback(
        async () => {

            const targetSchoolId =
                schoolId ??
                school?.id ??
                null;

            if (!targetSchoolId) {

                setAcademicYears([]);

                setActiveAcademicYear(null);

                setAcademicYearError(
                    "No current school is available."
                );

                setAcademicYearLoading(
                    false
                );

                return [];
            }

            return await loadAcademicYears(
                targetSchoolId
            );

        },
        [
            schoolId,
            school?.id,
            loadAcademicYears,
        ]
    );

    // =================================================
    // INITIAL SCHOOL + ACADEMIC YEAR LOAD
    // =================================================

    useEffect(() => {

        let mounted = true;

        const initializeContext =
            async () => {

                const schoolData =
                    await loadSchool();

                if (!mounted) {
                    return;
                }

                if (
                    schoolData?.id
                ) {

                    await loadAcademicYears(
                        schoolData.id
                    );

                } else {

                    setAcademicYears([]);

                    setActiveAcademicYear(
                        null
                    );

                    setAcademicYearLoading(
                        false
                    );
                }
            };

        initializeContext();

        return () => {

            mounted = false;
        };

    }, [
        loadSchool,
        loadAcademicYears,
    ]);

    // =================================================
    // REFRESH WHEN ROLE SELECTION CHANGES
    // =================================================

    useEffect(() => {

        const handleRoleStorageChange = (
            event
        ) => {

            if (
                event.key ===
                ROLE_STORAGE_KEY
            ) {

                refreshSchool();
            }
        };

        const handleRoleChanged = () => {

            refreshSchool();
        };

        window.addEventListener(
            "storage",
            handleRoleStorageChange
        );

        window.addEventListener(
            "africore-role-changed",
            handleRoleChanged
        );

        return () => {

            window.removeEventListener(
                "storage",
                handleRoleStorageChange
            );

            window.removeEventListener(
                "africore-role-changed",
                handleRoleChanged
            );
        };

    }, [
        refreshSchool,
    ]);

    // =================================================
    // AUTH STATE LISTENER
    // =================================================

    useEffect(() => {

        const {
            data: {
                subscription,
            },
        } = supabase.auth.onAuthStateChange(
            (event) => {

                console.log(
                    "SCHOOL CONTEXT AUTH EVENT:",
                    event
                );

                if (
                    event === "SIGNED_IN" ||
                    event === "SIGNED_OUT" ||
                    event === "USER_UPDATED" ||
                    event === "TOKEN_REFRESHED"
                ) {

                    refreshSchool();
                }
            }
        );

        return () => {

            subscription?.unsubscribe();
        };

    }, [
        refreshSchool,
    ]);

    // =================================================
    // DERIVED ACADEMIC YEAR VALUES
    // =================================================

    const activeAcademicYearId =
        activeAcademicYear?.id ??
        null;

    const activeAcademicYearName =
        activeAcademicYear?.year_name ??
        "";

    const activeAcademicYearTerm =
        activeAcademicYear?.term ??
        "";

    // =================================================
    // SCHOOL INFORMATION
    // =================================================

    const schoolName =
        school?.school_name ??
        "";

    const registrationNumber =
        school?.registration_number ??
        "";

    const address =
        school?.address ??
        "";

    const phone =
        school?.phone ??
        "";

    const email =
        school?.email ??
        "";

    const logo =
        school?.logo ??
        "";

    // =================================================
    // DOCUMENT SETTINGS
    // =================================================

    const showSchoolName =
        school?.show_school_name !== false;

    const showLogo =
        school?.show_logo !== false;

    const showRegistrationNumber =
        school?.show_registration_number !== false;

    const showAddress =
        school?.show_address !== false;

    const showPhone =
        school?.show_phone !== false;

    const showEmail =
        school?.show_email !== false;

    // =================================================
    // DOCUMENT BRANDING
    // =================================================

    const documentBranding = useMemo(
        () => ({
            schoolId,

            schoolName,

            registrationNumber,

            address,

            phone,

            email,

            logo,

            showSchoolName,

            showLogo,

            showRegistrationNumber,

            showAddress,

            showPhone,

            showEmail,
        }),
        [
            schoolId,
            schoolName,
            registrationNumber,
            address,
            phone,
            email,
            logo,
            showSchoolName,
            showLogo,
            showRegistrationNumber,
            showAddress,
            showPhone,
            showEmail,
        ]
    );

    // =================================================
    // CONTEXT VALUE
    // =================================================

    const value = useMemo(
        () => ({

            // =========================================
            // SCHOOL
            // =========================================

            school,

            schoolId,

            schoolName,

            registrationNumber,

            address,

            phone,

            email,

            logo,

            // =========================================
            // DOCUMENT SETTINGS
            // =========================================

            showSchoolName,

            showLogo,

            showRegistrationNumber,

            showAddress,

            showPhone,

            showEmail,

            // =========================================
            // DOCUMENT BRANDING
            // =========================================

            documentBranding,

            // =========================================
            // STATE
            // =========================================

            loading,

            error,

            // =========================================
            // ACADEMIC YEARS
            // =========================================

            academicYears,

            activeAcademicYear,

            activeAcademicYearId,

            activeAcademicYearName,

            activeAcademicYearTerm,

            academicYearLoading,

            academicYearError,

            // =========================================
            // ACTIONS
            // =========================================

            refreshSchool,

            refreshAcademicYear,

        }),
        [
            school,
            schoolId,
            schoolName,
            registrationNumber,
            address,
            phone,
            email,
            logo,

            showSchoolName,
            showLogo,
            showRegistrationNumber,
            showAddress,
            showPhone,
            showEmail,

            documentBranding,

            loading,
            error,

            academicYears,
            activeAcademicYear,

            activeAcademicYearId,
            activeAcademicYearName,
            activeAcademicYearTerm,

            academicYearLoading,
            academicYearError,

            refreshSchool,
            refreshAcademicYear,
        ]
    );

    // =================================================
    // PROVIDER
    // =================================================

    return (
        <SchoolContext.Provider
            value={value}
        >
            {children}
        </SchoolContext.Provider>
    );
};

// =====================================================
// CUSTOM HOOK
// =====================================================

export const useSchool = () => {

    const context =
        useContext(
            SchoolContext
        );

    if (!context) {

        throw new Error(
            "useSchool must be used inside SchoolProvider."
        );
    }

    return context;
};

// =====================================================
// DEFAULT EXPORT
// =====================================================

export default SchoolContext;