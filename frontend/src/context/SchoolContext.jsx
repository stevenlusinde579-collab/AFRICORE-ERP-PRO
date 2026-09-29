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
// Hii ndiyo GLOBAL source ya taarifa za shule
// pamoja na CURRENT ACADEMIC YEAR.
//
// Modules zote zitatumia current school na current
// academic year kutoka hapa.
//
// Mfano:
//
// const {
//     school,
//     schoolId,
//     schoolName,
//     activeAcademicYear,
//     activeAcademicYearId,
// } = useSchool();
//
// =====================================================


const SchoolContext = createContext(null);


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

    const [school, setSchool] = useState(null);

    const [schoolId, setSchoolId] = useState(null);

    const [loading, setLoading] = useState(true);

    const [error, setError] = useState(null);


    // =================================================
    // ACADEMIC YEAR STATE
    // =================================================

    const [academicYears, setAcademicYears] =
        useState([]);

    const [activeAcademicYear, setActiveAcademicYear] =
        useState(null);

    const [academicYearLoading, setAcademicYearLoading] =
        useState(true);

    const [academicYearError, setAcademicYearError] =
        useState(null);


    // =================================================
    // LOAD CURRENT USER SCHOOL
    // =================================================

    const loadSchool = useCallback(async () => {

        try {

            setLoading(true);

            setError(null);


            // -----------------------------------------
            // GET CURRENT AUTH USER
            // -----------------------------------------

            const {
                data: {
                    user
                },
                error: authError
            } = await supabase.auth.getUser();


            if (authError) {
                throw authError;
            }


            // -----------------------------------------
            // NO LOGGED-IN USER
            // -----------------------------------------

            if (!user) {

                setSchool(null);
                setSchoolId(null);

                setAcademicYears([]);
                setActiveAcademicYear(null);
                setAcademicYearError(null);

                setLoading(false);

                return null;
            }


            // -----------------------------------------
            // GET USER PROFILE
            // -----------------------------------------

            const {
                data: profile,
                error: profileError
            } = await supabase
                .from("profiles")
                .select(`
                    id,
                    school_id,
                    role_id
                `)
                .eq("id", user.id)
                .maybeSingle();


            if (profileError) {
                throw profileError;
            }


            // -----------------------------------------
            // PROFILE NOT FOUND
            // -----------------------------------------

            if (!profile) {

                setSchool(null);
                setSchoolId(null);

                setAcademicYears([]);
                setActiveAcademicYear(null);
                setAcademicYearError(null);

                setLoading(false);

                return null;
            }


            // -----------------------------------------
            // PROFILE WITHOUT SCHOOL
            // -----------------------------------------

            if (!profile.school_id) {

                setSchool(null);
                setSchoolId(null);

                setAcademicYears([]);
                setActiveAcademicYear(null);

                setAcademicYearError(
                    "Your profile is not assigned to a school."
                );

                setLoading(false);

                return null;
            }


            // -----------------------------------------
            // LOAD SCHOOL
            // -----------------------------------------

            const {
                data: schoolData,
                error: schoolError
            } = await supabase
                .from("schools")
                .select(SCHOOL_COLUMNS)
                .eq("id", profile.school_id)
                .maybeSingle();


            if (schoolError) {
                throw schoolError;
            }


            // -----------------------------------------
            // SCHOOL NOT FOUND
            // -----------------------------------------

            if (!schoolData) {

                setSchool(null);
                setSchoolId(null);

                setAcademicYears([]);
                setActiveAcademicYear(null);

                setAcademicYearError(
                    "Current school could not be found."
                );

                setLoading(false);

                return null;
            }


            // -----------------------------------------
            // SAVE GLOBAL SCHOOL
            // -----------------------------------------

            setSchool(schoolData);

            setSchoolId(schoolData.id);


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

    }, []);


    // =================================================
    // LOAD ACADEMIC YEARS
    // =================================================
    //
    // IMPORTANT:
    //
    // Hapa hatutengenezi academic year mpya.
    //
    // Tunasoma academic_years ambazo tayari zipo.
    //
    // is_active = true ndiyo CURRENT year.
    //
    // Historical years zinaendelea kubaki.
    //
    // =================================================

    const loadAcademicYears = useCallback(
        async (currentSchoolId = null) => {

            const targetSchoolId =
                currentSchoolId ||
                schoolId;


            if (!targetSchoolId) {

                setAcademicYears([]);
                setActiveAcademicYear(null);

                setAcademicYearError(
                    "No current school is available."
                );

                return [];

            }


            try {

                setAcademicYearLoading(true);

                setAcademicYearError(null);


                const {
                    data,
                    error: academicYearQueryError
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
                            ascending: false
                        }
                    );


                if (academicYearQueryError) {
                    throw academicYearQueryError;
                }


                const normalizedYears =
                    Array.isArray(data)
                        ? data
                        : [];


                // -------------------------------------
                // SAVE ALL YEARS
                // -------------------------------------

                setAcademicYears(
                    normalizedYears
                );


                // -------------------------------------
                // FIND ACTIVE YEAR
                // -------------------------------------

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

                    setAcademicYearError(null);

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

                setActiveAcademicYear(null);


                setAcademicYearError(
                    err?.message ||
                    "Failed to load academic years."
                );


                return [];

            } finally {

                setAcademicYearLoading(false);

            }

        },
        [schoolId]
    );


    // =================================================
    // INITIAL SCHOOL + ACADEMIC YEAR LOAD
    // =================================================

    useEffect(() => {

        let mounted = true;


        const initializeContext = async () => {

            const schoolData =
                await loadSchool();


            if (!mounted) return;


            if (schoolData?.id) {

                await loadAcademicYears(
                    schoolData.id
                );

            } else {

                setAcademicYears([]);
                setActiveAcademicYear(null);

                setAcademicYearLoading(false);

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
    // AUTH STATE LISTENER
    // =================================================
    //
    // User akilogin/logout/change session,
    // current school na academic year vina-refresh.
    //
    // =================================================

    useEffect(() => {

        const {
            data: {
                subscription
            }
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

                    loadSchool()
                        .then((schoolData) => {

                            if (schoolData?.id) {

                                loadAcademicYears(
                                    schoolData.id
                                );

                            } else {

                                setAcademicYears([]);
                                setActiveAcademicYear(null);

                            }

                        });

                }

            }
        );


        return () => {

            subscription?.unsubscribe();

        };

    }, [
        loadSchool,
        loadAcademicYears,
    ]);


    // =================================================
    // REFRESH SCHOOL
    // =================================================

    const refreshSchool = useCallback(
        async () => {

            const schoolData =
                await loadSchool();


            if (schoolData?.id) {

                await loadAcademicYears(
                    schoolData.id
                );

            } else {

                setAcademicYears([]);
                setActiveAcademicYear(null);

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
    //
    // Hii ndiyo function ambayo Settings itatumia
    // baada ya activate_academic_year().
    //
    // Mfano:
    //
    // await refreshAcademicYear();
    //
    // Baada ya hapo modules zote zinazotumia
    // useSchool() zitapata current year mpya.
    //
    // =================================================

    const refreshAcademicYear = useCallback(
        async () => {

            const targetSchoolId =
                schoolId ||
                school?.id;


            if (!targetSchoolId) {

                setAcademicYears([]);
                setActiveAcademicYear(null);

                setAcademicYearError(
                    "No current school is available."
                );

                return [];

            }


            return await loadAcademicYears(
                targetSchoolId
            );

        },
        [
            schoolId,
            school,
            loadAcademicYears,
        ]
    );


    // =================================================
    // DERIVED ACADEMIC YEAR VALUES
    // =================================================

    const activeAcademicYearId =
        activeAcademicYear?.id ||
        null;


    const activeAcademicYearName =
        activeAcademicYear?.year_name ||
        "";


    const activeAcademicYearTerm =
        activeAcademicYear?.term ||
        "";


    // =================================================
    // SCHOOL INFORMATION
    // =================================================

    const schoolName =
        school?.school_name ||
        "";


    const registrationNumber =
        school?.registration_number ||
        "";


    const address =
        school?.address ||
        "";


    const phone =
        school?.phone ||
        "";


    const email =
        school?.email ||
        "";


    const logo =
        school?.logo ||
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
    // DOCUMENT BRANDING OBJECT
    // =================================================
    //
    // Hii itatumika baadaye na:
    //
    // - Print
    // - PDF
    // - Reports
    // - Statements
    // - Receipts
    // - Certificates
    // - Social Welfare documents
    // - Examination documents
    //
    // =================================================

    const documentBranding = useMemo(() => {

        return {

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

        };

    }, [
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
    ]);


    // =================================================
    // CONTEXT VALUE
    // =================================================

    const value = useMemo(() => {

        return {

            // -----------------------------------------
            // SCHOOL
            // -----------------------------------------

            school,

            schoolId,

            schoolName,

            registrationNumber,

            address,

            phone,

            email,

            logo,


            // -----------------------------------------
            // DOCUMENT SETTINGS
            // -----------------------------------------

            showSchoolName,

            showLogo,

            showRegistrationNumber,

            showAddress,

            showPhone,

            showEmail,


            // -----------------------------------------
            // COMPLETE DOCUMENT BRANDING
            // -----------------------------------------

            documentBranding,


            // -----------------------------------------
            // STATE
            // -----------------------------------------

            loading,

            error,


            // -----------------------------------------
            // ACADEMIC YEARS
            // -----------------------------------------

            academicYears,

            activeAcademicYear,

            activeAcademicYearId,

            activeAcademicYearName,

            activeAcademicYearTerm,

            academicYearLoading,

            academicYearError,


            // -----------------------------------------
            // ACTIONS
            // -----------------------------------------

            refreshSchool,

            refreshAcademicYear,

        };

    }, [
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
    ]);


    // =================================================
    // PROVIDER
    // =================================================

    return (

        <SchoolContext.Provider value={value}>

            {children}

        </SchoolContext.Provider>

    );

};


// =====================================================
// CUSTOM HOOK
// =====================================================

export const useSchool = () => {

    const context = useContext(
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