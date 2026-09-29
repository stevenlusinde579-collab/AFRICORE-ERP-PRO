import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    FaArrowLeft,
    FaCheckCircle,
    FaExclamationTriangle,
    FaFileInvoiceDollar,
    FaMoneyBillWave,
    FaReceipt,
    FaRedo,
    FaSearch,
    FaSpinner,
    FaUniversity,
    FaUserGraduate,
    FaWallet,
} from "react-icons/fa";

import { Link } from "react-router-dom";

import { supabase } from "../../services/supabase";


// ============================================================
// HELPERS
// ============================================================

const today = () =>
    new Date().toISOString().slice(0, 10);

const numberValue = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

const money = (value) =>
    new Intl.NumberFormat("en-TZ", {
        style: "currency",
        currency: "TZS",
        maximumFractionDigits: 0,
    }).format(numberValue(value));

const normalize = (value) =>
    String(value || "")
        .trim()
        .toLowerCase();

const studentName = (student) => {
    if (!student) return "";

    return [
        student.first_name,
        student.middle_name,
        student.last_name,
    ]
        .filter(Boolean)
        .join(" ")
        .trim();
};

const getAdmission = (student) =>
    student?.admission_number ||
    student?.admission_no ||
    "-";

const getClassName = (classRow) =>
    classRow?.class_name ||
    classRow?.short_name ||
    "-";

const getChargeBalance = (charge) => {
    if (!charge) return 0;

    const amount = numberValue(charge.amount);

    const paid = numberValue(
        charge.paid_amount ??
            charge.amount_paid
    );

    const storedBalance = numberValue(
        charge.balance
    );

    if (
        storedBalance > 0 ||
        (storedBalance === 0 &&
            amount === 0)
    ) {
        return storedBalance;
    }

    return Math.max(
        amount - paid,
        0
    );
};


// ============================================================
// EMPTY FORMS
// ============================================================

const EMPTY_SETUP = {
    setupType: "tuition",
    tuitionTerm1: "",
    tuitionTerm2: "",
    otherFeeAmount: "",
};

const EMPTY_PAYMENT = {
    paymentFor: "tuition",
    paymentTerm: "term_1",
    setupId: "",
    paymentDate: today(),
    amount: "",
    paymentMethod: "cash",
    providerName: "",
    financialAccountId: "",
    referenceNumber: "",
    description: "",
};


// ============================================================
// COMPONENT
// ============================================================

const RecordPayment = () => {
    // ========================================================
    // AUTH / PROFILE
    // ========================================================

    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);

    // ========================================================
    // MASTER DATA
    // ========================================================

    const [academicYears, setAcademicYears] =
        useState([]);

    const [classes, setClasses] =
        useState([]);

    const [students, setStudents] =
        useState([]);

    const [financialAccounts, setFinancialAccounts] =
        useState([]);

    const [feeItems, setFeeItems] =
        useState([]);

    // ========================================================
    // SELECTION
    // ========================================================

    const [selectedAcademicYearId, setSelectedAcademicYearId] =
        useState("");

    const [selectedClassId, setSelectedClassId] =
        useState("");

    /*
     * This remains the ACTIVE student.
     *
     * It is used by the existing finance/payment flow.
     */
    const [selectedStudentId, setSelectedStudentId] =
        useState("");

    /*
     * NEW:
     * Multiple selected students.
     *
     * The first selected student becomes the active student.
     */
    const [selectedStudentIds, setSelectedStudentIds] =
        useState([]);

    const [studentSearch, setStudentSearch] =
        useState("");

    // ========================================================
    // STUDENT FINANCE
    // ========================================================

    const [studentSetups, setStudentSetups] =
        useState([]);

    const [studentCharges, setStudentCharges] =
        useState([]);

    // ========================================================
    // FORMS
    // ========================================================

    const [setupForm, setSetupForm] =
        useState(EMPTY_SETUP);

    const [paymentForm, setPaymentForm] =
        useState(EMPTY_PAYMENT);

    // ========================================================
    // UI STATE
    // ========================================================

    const [isLoading, setIsLoading] =
        useState(true);

    const [isLoadingStudentFinance, setIsLoadingStudentFinance] =
        useState(false);

    const [isSavingSetup, setIsSavingSetup] =
        useState(false);

    const [isProcessingPayment, setIsProcessingPayment] =
        useState(false);

    const [error, setError] =
        useState("");

    const [success, setSuccess] =
        useState("");

    // ========================================================
    // SCHOOL
    // ========================================================

    const schoolId = Number(
        profile?.school_id || 0
    );


    // ========================================================
    // LOAD USER PROFILE
    // ========================================================

    const loadUserProfile = useCallback(
        async (authUser) => {
            if (!authUser?.id) {
                throw new Error(
                    "User session haijapatikana."
                );
            }

            const {
                data,
                error: profileError,
            } = await supabase
                .from("profiles")
                .select(`
                    id,
                    full_name,
                    school_id,
                    role_id
                `)
                .eq(
                    "id",
                    authUser.id
                )
                .maybeSingle();

            if (profileError) {
                throw profileError;
            }

            if (!data) {
                throw new Error(
                    "Profile ya user haijapatikana."
                );
            }

            if (!data.school_id) {
                throw new Error(
                    "User huyu hana school iliyounganishwa."
                );
            }

            setUser(authUser);
            setProfile(data);

            return data;
        },
        []
    );


    // ========================================================
    // LOAD ACADEMIC YEARS
    // ========================================================

    const loadAcademicYears = useCallback(
        async (currentSchoolId) => {
            const numericSchoolId =
                Number(currentSchoolId);

            if (!numericSchoolId) {
                throw new Error(
                    "School ID haijapatikana."
                );
            }

            const {
                data,
                error: yearsError,
            } = await supabase
                .from("academic_years")
                .select(`
                    id,
                    school_id,
                    year_name,
                    term,
                    start_date,
                    end_date,
                    is_active
                `)
                .eq(
                    "school_id",
                    numericSchoolId
                )
                .order(
                    "year_name",
                    {
                        ascending: false,
                    }
                );

            if (yearsError) {
                throw yearsError;
            }

            const rows = data || [];

            setAcademicYears(rows);

            const activeYear =
                rows.find(
                    (row) =>
                        row.is_active === true
                ) || rows[0];

            if (activeYear) {
                setSelectedAcademicYearId(
                    String(activeYear.id)
                );
            } else {
                setSelectedAcademicYearId("");
            }

            return rows;
        },
        []
    );


    // ========================================================
    // LOAD CLASSES
    // ========================================================

    const loadClasses = useCallback(
        async (
            currentSchoolId,
            yearId = null
        ) => {
            const numericSchoolId =
                Number(currentSchoolId);

            if (!numericSchoolId) {
                return [];
            }

            let query = supabase
                .from("classes")
                .select(`
                    id,
                    school_id,
                    academic_level,
                    class_name,
                    short_name,
                    academic_year_id
                `)
                .eq(
                    "school_id",
                    numericSchoolId
                )
                .order(
                    "class_name",
                    {
                        ascending: true,
                    }
                );

            if (yearId) {
                query = query.eq(
                    "academic_year_id",
                    Number(yearId)
                );
            }

            const {
                data,
                error: classesError,
            } = await query;

            if (classesError) {
                throw classesError;
            }

            return data || [];
        },
        []
    );


    // ========================================================
    // LOAD STUDENTS
    // ========================================================

    const loadStudents = useCallback(
        async (
            currentSchoolId,
            yearId = null
        ) => {
            const numericSchoolId =
                Number(currentSchoolId);

            if (!numericSchoolId) {
                return [];
            }

            let query = supabase
                .from("students")
                .select(`
                    id,
                    school_id,
                    admission_number,
                    admission_no,
                    first_name,
                    middle_name,
                    last_name,
                    current_class_id,
                    academic_year_id,
                    student_status,
                    status,
                    class_name,
                    stream
                `)
                .eq(
                    "school_id",
                    numericSchoolId
                )
                .order(
                    "first_name",
                    {
                        ascending: true,
                    }
                );

            if (yearId) {
                query = query.eq(
                    "academic_year_id",
                    Number(yearId)
                );
            }

            const {
                data,
                error: studentsError,
            } = await query;

            if (studentsError) {
                throw studentsError;
            }

            return data || [];
        },
        []
    );


    // ========================================================
    // LOAD FINANCIAL ACCOUNTS
    // ========================================================

    const loadFinancialAccounts = useCallback(
        async (currentSchoolId) => {
            const numericSchoolId =
                Number(currentSchoolId);

            if (!numericSchoolId) {
                return [];
            }

            const {
                data,
                error: accountsError,
            } = await supabase
                .schema("finance")
                .from("cash_accounts")
                .select(`
                    id,
                    school_id,
                    account_name,
                    account_type,
                    provider_name,
                    account_number,
                    chart_of_account_id,
                    opening_balance,
                    current_balance,
                    is_active
                `)
                .eq(
                    "school_id",
                    numericSchoolId
                )
                .eq(
                    "is_active",
                    true
                )
                .order(
                    "account_name",
                    {
                        ascending: true,
                    }
                );

            if (accountsError) {
                throw accountsError;
            }

            return data || [];
        },
        []
    );


    // ========================================================
    // ENSURE FINANCE SETUP
    //
    // IMPORTANT:
    // The RPC is authoritative.
    // Do NOT fail just because the second fee_items SELECT
    // cannot see rows because of RLS/API visibility.
    // ========================================================

    const ensureRequiredFeeItems = useCallback(
        async (
            currentSchoolId,
            currentUserId
        ) => {
            if (!currentSchoolId) {
                throw new Error(
                    "School haijapatikana."
                );
            }

            const schoolNumber =
                Number(currentSchoolId);

            if (
                !Number.isFinite(
                    schoolNumber
                ) ||
                schoolNumber <= 0
            ) {
                throw new Error(
                    "School ID sio sahihi."
                );
            }

            const {
                data: setupData,
                error: setupError,
            } = await supabase
                .schema("finance")
                .rpc(
                    "ensure_school_fee_setup",
                    {
                        p_school_id:
                            schoolNumber,

                        p_created_by:
                            currentUserId ||
                            null,
                    }
                );

            if (setupError) {
                throw setupError;
            }

            const setup =
                Array.isArray(
                    setupData
                )
                    ? setupData[0]
                    : setupData;

            if (!setup) {
                throw new Error(
                    "Finance setup haikuweza kuandaliwa kwa shule hii."
                );
            }

            const tuitionFeeItemId =
                setup.tuition_fee_item_id ||
                null;

            const otherFeeItemId =
                setup.other_fee_item_id ||
                null;

            const tuitionRevenueAccountId =
                setup.tuition_revenue_account_id ||
                null;

            const otherRevenueAccountId =
                setup.other_revenue_account_id ||
                null;

            const receivableAccountId =
                setup.receivable_account_id ||
                null;

            if (
                !tuitionRevenueAccountId
            ) {
                throw new Error(
                    "School Fees Income account 4000 haikuweza kuandaliwa."
                );
            }

            if (
                !receivableAccountId
            ) {
                throw new Error(
                    "Student Receivables account 1100 haikuweza kuandaliwa."
                );
            }

            if (
                !tuitionFeeItemId
            ) {
                throw new Error(
                    "Tuition Fee setup haikuweza kuandaliwa. Finance setup RPC haikurudisha Tuition Fee ID."
                );
            }

            let items = [];

            try {
                const {
                    data: feeItemsData,
                    error: feeItemsError,
                } = await supabase
                    .schema("finance")
                    .from("fee_items")
                    .select(`
                        id,
                        school_id,
                        item_code,
                        item_name,
                        description,
                        revenue_account_id,
                        is_mandatory,
                        is_active,
                        created_by,
                        created_at,
                        updated_at
                    `)
                    .eq(
                        "school_id",
                        schoolNumber
                    )
                    .eq(
                        "is_active",
                        true
                    )
                    .order(
                        "item_name",
                        {
                            ascending: true,
                        }
                    );

                if (
                    !feeItemsError
                ) {
                    items =
                        feeItemsData ||
                        [];
                }
            } catch (displayError) {
                console.warn(
                    "Fee items display query skipped:",
                    displayError
                );

                items = [];
            }

            const tuitionFromQuery =
                items.find(
                    (item) =>
                        String(
                            item.id
                        ) ===
                        String(
                            tuitionFeeItemId
                        )
                ) ||
                items.find(
                    (item) =>
                        normalize(
                            item.item_code
                        ) ===
                        "tuition"
                );

            const otherFromQuery =
                otherFeeItemId
                    ? items.find(
                          (item) =>
                              String(
                                  item.id
                              ) ===
                              String(
                                  otherFeeItemId
                              )
                      ) ||
                      items.find(
                          (item) =>
                              normalize(
                                  item.item_code
                              ) ===
                              "other"
                      )
                    : null;

            const tuition = {
                id: tuitionFeeItemId,
                school_id:
                    schoolNumber,
                item_code:
                    tuitionFromQuery?.item_code ||
                    "TUITION",
                item_name:
                    tuitionFromQuery?.item_name ||
                    "Tuition Fee",
                description:
                    tuitionFromQuery?.description ||
                    "Student Tuition Fee",
                revenue_account_id:
                    tuitionRevenueAccountId,
                is_mandatory:
                    tuitionFromQuery?.is_mandatory ??
                    true,
                is_active: true,
                created_by:
                    tuitionFromQuery?.created_by ||
                    currentUserId ||
                    null,
                created_at:
                    tuitionFromQuery?.created_at ||
                    null,
                updated_at:
                    tuitionFromQuery?.updated_at ||
                    null,
            };

            const other = otherFeeItemId
                ? {
                      id: otherFeeItemId,
                      school_id:
                          schoolNumber,
                      item_code:
                          otherFromQuery?.item_code ||
                          "OTHER",
                      item_name:
                          otherFromQuery?.item_name ||
                          "Other Fee",
                      description:
                          otherFromQuery?.description ||
                          "Other Student Fees",
                      revenue_account_id:
                          otherRevenueAccountId,
                      is_mandatory:
                          otherFromQuery?.is_mandatory ??
                          false,
                      is_active: true,
                      created_by:
                          otherFromQuery?.created_by ||
                          currentUserId ||
                          null,
                      created_at:
                          otherFromQuery?.created_at ||
                          null,
                      updated_at:
                          otherFromQuery?.updated_at ||
                          null,
                  }
                : null;

            return {
                feeItems: items,
                tuition,
                other,
                accounts: {
                    tuitionRevenueAccountId:
                        tuitionRevenueAccountId,

                    otherRevenueAccountId:
                        otherRevenueAccountId,

                    receivableAccountId:
                        receivableAccountId,
                },
            };
        },
        []
    );


    // ========================================================
    // INITIAL DATA
    // ========================================================

    const loadInitialData = useCallback(
        async () => {
            setIsLoading(true);
            setError("");

            try {
                const {
                    data: {
                        user: authUser,
                    },
                    error: authError,
                } =
                    await supabase.auth.getUser();

                if (authError) {
                    throw authError;
                }

                if (!authUser) {
                    throw new Error(
                        "Session ya user haijapatikana."
                    );
                }

                const currentProfile =
                    await loadUserProfile(
                        authUser
                    );

                const currentSchoolId =
                    Number(
                        currentProfile.school_id
                    );

                const years =
                    await loadAcademicYears(
                        currentSchoolId
                    );

                const activeYear =
                    years.find(
                        (row) =>
                            row.is_active ===
                            true
                    ) ||
                    years[0] ||
                    null;

                const yearId =
                    activeYear?.id ||
                    null;

                const [
                    loadedClasses,
                    loadedStudents,
                    loadedAccounts,
                    financeSetup,
                ] =
                    await Promise.all([
                        loadClasses(
                            currentSchoolId,
                            yearId
                        ),

                        loadStudents(
                            currentSchoolId,
                            yearId
                        ),

                        loadFinancialAccounts(
                            currentSchoolId
                        ),

                        ensureRequiredFeeItems(
                            currentSchoolId,
                            authUser.id
                        ),
                    ]);

                setClasses(
                    loadedClasses
                );

                setStudents(
                    loadedStudents
                );

                setFinancialAccounts(
                    loadedAccounts
                );

                setFeeItems(
                    financeSetup.feeItems ||
                        []
                );
            } catch (loadError) {
                console.error(
                    "RecordPayment initial load error:",
                    loadError
                );

                setError(
                    loadError?.message ||
                        "Imeshindikana kupakia taarifa za Receive Payment."
                );
            } finally {
                setIsLoading(false);
            }
        },
        [
            loadAcademicYears,
            loadClasses,
            loadFinancialAccounts,
            loadStudents,
            loadUserProfile,
            ensureRequiredFeeItems,
        ]
    );


    // ========================================================
    // INITIAL EFFECT
    // ========================================================

    useEffect(() => {
        loadInitialData();
    }, [loadInitialData]);


    // ========================================================
    // SELECTED CLASS
    // ========================================================

    const selectedClass = useMemo(() => {
        return classes.find(
            (row) =>
                String(row.id) ===
                String(
                    selectedClassId
                )
        );
    }, [
        classes,
        selectedClassId,
    ]);


    // ========================================================
    // SELECTED STUDENT
    // ========================================================

    const selectedStudent = useMemo(() => {
        return students.find(
            (row) =>
                String(row.id) ===
                String(
                    selectedStudentId
                )
        );
    }, [
        students,
        selectedStudentId,
    ]);


    // ========================================================
    // CURRENT ACADEMIC YEAR
    // ========================================================

    const selectedAcademicYear =
        useMemo(() => {
            return academicYears.find(
                (row) =>
                    String(row.id) ===
                    String(
                        selectedAcademicYearId
                    )
            );
        }, [
            academicYears,
            selectedAcademicYearId,
        ]);


    // ========================================================
    // FILTER STUDENTS
    // ========================================================

    const filteredStudents = useMemo(() => {
        const search =
            normalize(
                studentSearch
            );

        return students.filter(
            (student) => {
                const matchesClass =
                    !selectedClassId ||
                    String(
                        student.current_class_id
                    ) ===
                        String(
                            selectedClassId
                        );

                if (!matchesClass) {
                    return false;
                }

                if (!search) {
                    return true;
                }

                const name =
                    normalize(
                        studentName(
                            student
                        )
                    );

                const admission =
                    normalize(
                        getAdmission(
                            student
                        )
                    );

                return (
                    name.includes(
                        search
                    ) ||
                    admission.includes(
                        search
                    )
                );
            }
        );
    }, [
        students,
        selectedClassId,
        studentSearch,
    ]);


    // ========================================================
    // SELECTED STUDENTS HELPERS
    // ========================================================

    const selectedStudentCount =
        selectedStudentIds.length;

    const allFilteredStudentsSelected =
        filteredStudents.length > 0 &&
        filteredStudents.every(
            (student) =>
                selectedStudentIds.some(
                    (id) =>
                        String(id) ===
                        String(student.id)
                )
        );


    // ========================================================
    // LOAD STUDENT SETUPS / CHARGES
    // ========================================================

    const loadStudentSetups = useCallback(
        async (
            studentId,
            academicYearId
        ) => {
            if (
                !studentId ||
                !academicYearId ||
                !schoolId
            ) {
                setStudentSetups([]);
                setStudentCharges([]);
                return;
            }

            setIsLoadingStudentFinance(
                true
            );

            try {
                const [
                    setupsResponse,
                    chargesResponse,
                ] = await Promise.all([
                    supabase
                        .schema("finance")
                        .from(
                            "student_payment_setups"
                        )
                        .select(`
                            id,
                            school_id,
                            student_id,
                            academic_year_id,
                            class_id,
                            fee_item_id,
                            setup_type,
                            term_number,
                            amount,
                            due_date,
                            status,
                            created_by,
                            created_at,
                            updated_at
                        `)
                        .eq(
                            "school_id",
                            Number(schoolId)
                        )
                        .eq(
                            "student_id",
                            Number(
                                studentId
                            )
                        )
                        .eq(
                            "academic_year_id",
                            Number(
                                academicYearId
                            )
                        )
                        .eq(
                            "status",
                            "active"
                        )
                        .order(
                            "created_at",
                            {
                                ascending: true,
                            }
                        ),

                    supabase
                        .schema("finance")
                        .from(
                            "student_charges"
                        )
                        .select(`
                            id,
                            school_id,
                            student_id,
                            charge_date,
                            academic_year_id,
                            description,
                            amount,
                            paid_amount,
                            balance,
                            revenue_account_id,
                            journal_entry_id,
                            status,
                            fee_item_id,
                            term_number,
                            due_date,
                            invoice_number,
                            payment_setup_id,
                            created_at
                        `)
                        .eq(
                            "school_id",
                            Number(schoolId)
                        )
                        .eq(
                            "student_id",
                            Number(
                                studentId
                            )
                        )
                        .eq(
                            "academic_year_id",
                            Number(
                                academicYearId
                            )
                        )
                        .order(
                            "created_at",
                            {
                                ascending: false,
                            }
                        ),
                ]);

                if (
                    setupsResponse.error
                ) {
                    throw setupsResponse.error;
                }

                if (
                    chargesResponse.error
                ) {
                    throw chargesResponse.error;
                }

                setStudentSetups(
                    setupsResponse.data ||
                        []
                );

                setStudentCharges(
                    chargesResponse.data ||
                        []
                );
            } catch (financeError) {
                console.error(
                    "Student finance loading error:",
                    financeError
                );

                setStudentSetups([]);
                setStudentCharges([]);

                throw financeError;
            } finally {
                setIsLoadingStudentFinance(
                    false
                );
            }
        },
        [schoolId]
    );


    // ========================================================
    // LOAD STUDENT FINANCE WHEN STUDENT CHANGES
    // ========================================================

    useEffect(() => {
        if (
            !selectedStudentId ||
            !selectedAcademicYearId
        ) {
            setStudentSetups([]);
            setStudentCharges([]);
            return;
        }

        loadStudentSetups(
            selectedStudentId,
            selectedAcademicYearId
        ).catch((financeError) => {
            setError(
                financeError?.message ||
                    "Imeshindikana kupakia student finance."
            );
        });
    }, [
        selectedStudentId,
        selectedAcademicYearId,
        loadStudentSetups,
    ]);


    // ========================================================
    // RESET PAYMENT WHEN ACTIVE STUDENT CHANGES
    // ========================================================

    useEffect(() => {
        setPaymentForm(
            EMPTY_PAYMENT
        );
        setSuccess("");
        setError("");
    }, [
        selectedStudentId,
    ]);


    // ========================================================
    // FEE ITEM MAP
    // ========================================================

    const feeItemMap = useMemo(() => {
        const map = new Map();

        for (const item of feeItems) {
            map.set(
                String(item.id),
                item
            );
        }

        return map;
    }, [feeItems]);


    // ========================================================
    // PAYABLE SETUPS
    //
    // VERY IMPORTANT:
    // We link setup -> charge using payment_setup_id.
    // This prevents Class Collection Fee records from
    // interfering with this payment screen.
    // ========================================================

    const payableSetups = useMemo(() => {
        return studentSetups
            .map((setup) => {
                const charge =
                    studentCharges.find(
                        (row) =>
                            String(
                                row.payment_setup_id
                            ) ===
                            String(
                                setup.id
                            )
                    );

                const feeItem =
                    feeItemMap.get(
                        String(
                            setup.fee_item_id
                        )
                    );

                const balance =
                    charge
                        ? getChargeBalance(
                              charge
                          )
                        : numberValue(
                              setup.amount
                          );

                return {
                    ...setup,
                    charge,
                    feeItem,
                    balance,
                };
            })
            .filter(
                (setup) =>
                    numberValue(
                        setup.balance
                    ) > 0
            );
    }, [
        studentSetups,
        studentCharges,
        feeItemMap,
    ]);


    // ========================================================
    // FILTER PAYABLE SETUPS
    // ========================================================

    const filteredPayableSetups =
        useMemo(() => {
            return payableSetups.filter(
                (setup) => {
                    const type =
                        normalize(
                            setup.setup_type
                        );

                    if (
                        paymentForm.paymentFor ===
                        "tuition"
                    ) {
                        if (
                            type !==
                            "tuition"
                        ) {
                            return false;
                        }

                        if (
                            paymentForm.paymentTerm ===
                            "term_1"
                        ) {
                            return (
                                Number(
                                    setup.term_number
                                ) === 1
                            );
                        }

                        if (
                            paymentForm.paymentTerm ===
                            "term_2"
                        ) {
                            return (
                                Number(
                                    setup.term_number
                                ) === 2
                            );
                        }

                        return false;
                    }

                    return (
                        type ===
                        "other"
                    );
                }
            );
        }, [
            payableSetups,
            paymentForm.paymentFor,
            paymentForm.paymentTerm,
        ]);


    // ========================================================
    // CURRENT TOTALS
    // ========================================================

    const totalCharges = useMemo(() => {
        return studentCharges.reduce(
            (
                total,
                charge
            ) =>
                total +
                numberValue(
                    charge.amount
                ),
            0
        );
    }, [
        studentCharges,
    ]);

    const totalPaid = useMemo(() => {
        return studentCharges.reduce(
            (
                total,
                charge
            ) =>
                total +
                numberValue(
                    charge.paid_amount ??
                        charge.amount_paid
                ),
            0
        );
    }, [
        studentCharges,
    ]);

    const totalOutstanding = useMemo(() => {
        return studentCharges.reduce(
            (
                total,
                charge
            ) =>
                total +
                getChargeBalance(
                    charge
                ),
            0
        );
    }, [
        studentCharges,
    ]);


    // ========================================================
    // PAYMENT METHOD FINANCIAL ACCOUNT FILTER
    // ========================================================

    const availableFinancialAccounts =
        useMemo(() => {
            const method =
                normalize(
                    paymentForm.paymentMethod
                );

            if (
                method === "other"
            ) {
                return financialAccounts;
            }

            return financialAccounts.filter(
                (account) => {
                    const type =
                        normalize(
                            account.account_type
                        );

                    const name =
                        normalize(
                            account.account_name
                        );

                    const provider =
                        normalize(
                            account.provider_name
                        );

                    if (
                        method ===
                        "cash"
                    ) {
                        return (
                            type.includes(
                                "cash"
                            ) ||
                            name.includes(
                                "cash"
                            )
                        );
                    }

                    if (
                        method ===
                        "bank"
                    ) {
                        return (
                            type.includes(
                                "bank"
                            ) ||
                            name.includes(
                                "bank"
                            ) ||
                            provider.includes(
                                "bank"
                            )
                        );
                    }

                    if (
                        method ===
                        "mobile_money"
                    ) {
                        return (
                            type.includes(
                                "mobile"
                            ) ||
                            type.includes(
                                "mobile_money"
                            ) ||
                            name.includes(
                                "mobile"
                            ) ||
                            name.includes(
                                "m-pesa"
                            ) ||
                            name.includes(
                                "mpesa"
                            ) ||
                            name.includes(
                                "airtel"
                            ) ||
                            name.includes(
                                "tigo"
                            ) ||
                            name.includes(
                                "halopesa"
                            ) ||
                            provider.includes(
                                "mobile"
                            ) ||
                            provider.includes(
                                "m-pesa"
                            ) ||
                            provider.includes(
                                "mpesa"
                            ) ||
                            provider.includes(
                                "airtel"
                            ) ||
                            provider.includes(
                                "tigo"
                            ) ||
                            provider.includes(
                                "halopesa"
                            )
                        );
                    }

                    if (
                        method ===
                        "cheque"
                    ) {
                        return (
                            type.includes(
                                "bank"
                            ) ||
                            name.includes(
                                "bank"
                            )
                        );
                    }

                    return true;
                }
            );
        }, [
            financialAccounts,
            paymentForm.paymentMethod,
        ]);


    // ========================================================
    // AUTO-CLEAR INVALID FINANCIAL ACCOUNT
    // ========================================================

    useEffect(() => {
        if (
            paymentForm.financialAccountId &&
            !availableFinancialAccounts.some(
                (account) =>
                    String(
                        account.id
                    ) ===
                    String(
                        paymentForm.financialAccountId
                    )
            )
        ) {
            setPaymentForm(
                (current) => ({
                    ...current,
                    financialAccountId:
                        "",
                })
            );
        }
    }, [
        availableFinancialAccounts,
        paymentForm.financialAccountId,
    ]);


    // ========================================================
    // SELECTED PAYMENT SETUP
    // ========================================================

    const selectedPaymentSetup =
        useMemo(() => {
            return filteredPayableSetups.find(
                (row) =>
                    String(row.id) ===
                    String(
                        paymentForm.setupId
                    )
            );
        }, [
            filteredPayableSetups,
            paymentForm.setupId,
        ]);


    // ========================================================
    // SETUP LABEL
    // ========================================================

    const getSetupLabel = useCallback(
        (setup) => {
            if (!setup) {
                return "Payment Setup";
            }

            const feeName =
                setup.feeItem?.item_name ||
                (
                    normalize(
                        setup.setup_type
                    ) ===
                    "tuition"
                        ? "Tuition Fee"
                        : "Other Fee"
                );

            if (
                normalize(
                    setup.setup_type
                ) ===
                "tuition"
            ) {
                return `${feeName} - Term ${setup.term_number}`;
            }

            return feeName;
        },
        []
    );


    // ========================================================
    // ACADEMIC YEAR CHANGE
    // ========================================================

    const handleAcademicYearChange =
        async (event) => {
            const value =
                event.target.value;

            setSelectedAcademicYearId(
                value
            );

            setSelectedClassId("");
            setSelectedStudentId("");
            setSelectedStudentIds([]);

            setStudentSetups([]);
            setStudentCharges([]);

            setPaymentForm(
                EMPTY_PAYMENT
            );

            if (!schoolId) {
                return;
            }

            try {
                setError("");

                const loadedClasses =
                    await loadClasses(
                        schoolId,
                        value
                    );

                const loadedStudents =
                    await loadStudents(
                        schoolId,
                        value
                    );

                setClasses(
                    loadedClasses
                );

                setStudents(
                    loadedStudents
                );
            } catch (changeError) {
                console.error(
                    changeError
                );

                setError(
                    changeError?.message ||
                        "Imeshindikana kubadilisha academic year."
                );
            }
        };


    // ========================================================
    // CLASS CHANGE
    // ========================================================

    const handleClassChange = (
        event
    ) => {
        const value =
            event.target.value;

        setSelectedClassId(value);
        setSelectedStudentId("");
        setSelectedStudentIds([]);
        setStudentSearch("");

        setStudentSetups([]);
        setStudentCharges([]);

        setPaymentForm(
            EMPTY_PAYMENT
        );
    };


    // ========================================================
    // STUDENT CHANGE
    //
    // This is retained so the active student can be changed
    // directly if needed.
    // ========================================================

    const handleStudentChange = (
        event
    ) => {
        const value =
            event.target.value;

        setSelectedStudentId(
            value
        );

        if (value) {
            setSelectedStudentIds(
                [value]
            );
        } else {
            setSelectedStudentIds([]);
        }

        setPaymentForm(
            EMPTY_PAYMENT
        );

        setSuccess("");
        setError("");
    };


    // ========================================================
    // TOGGLE ONE STUDENT
    // ========================================================

    const handleToggleStudent = (
        studentId
    ) => {
        const id =
            String(studentId);

        setSelectedStudentIds(
            (current) => {
                const exists =
                    current.some(
                        (item) =>
                            String(item) ===
                            id
                    );

                if (exists) {
                    const next =
                        current.filter(
                            (item) =>
                                String(item) !==
                                id
                        );

                    /*
                     * If active student was removed,
                     * automatically activate another selected
                     * student.
                     */
                    if (
                        String(
                            selectedStudentId
                        ) === id
                    ) {
                        const nextActive =
                            next[0] || "";

                        setSelectedStudentId(
                            nextActive
                        );
                    }

                    return next;
                }

                /*
                 * First selected student becomes active.
                 */
                if (
                    current.length === 0
                ) {
                    setSelectedStudentId(
                        id
                    );
                }

                return [
                    ...current,
                    id,
                ];
            }
        );

        setSuccess("");
        setError("");
    };


    // ========================================================
    // SELECT ALL FILTERED STUDENTS
    // ========================================================

    const handleSelectAllStudents = () => {
        if (
            filteredStudents.length ===
            0
        ) {
            return;
        }

        const filteredIds =
            filteredStudents.map(
                (student) =>
                    String(student.id)
            );

        setSelectedStudentIds(
            (current) => {
                const merged = [
                    ...current,
                ];

                for (
                    const id of filteredIds
                ) {
                    if (
                        !merged.some(
                            (existing) =>
                                String(
                                    existing
                                ) ===
                                String(id)
                        )
                    ) {
                        merged.push(id);
                    }
                }

                if (
                    !selectedStudentId &&
                    merged.length > 0
                ) {
                    setSelectedStudentId(
                        String(
                            merged[0]
                        )
                    );
                }

                return merged;
            }
        );

        setSuccess("");
        setError("");
    };


    // ========================================================
    // DESELECT ALL FILTERED STUDENTS
    // ========================================================

    const handleDeselectAllStudents = () => {
        const filteredIds =
            new Set(
                filteredStudents.map(
                    (student) =>
                        String(
                            student.id
                        )
                )
            );

        setSelectedStudentIds(
            (current) =>
                current.filter(
                    (id) =>
                        !filteredIds.has(
                            String(id)
                        )
                )
        );

        if (
            filteredStudents.some(
                (student) =>
                    String(student.id) ===
                    String(
                        selectedStudentId
                    )
            )
        ) {
            setSelectedStudentId("");
            setStudentSetups([]);
            setStudentCharges([]);
            setPaymentForm(
                EMPTY_PAYMENT
            );
        }

        setSuccess("");
        setError("");
    };


    // ========================================================
    // SET ACTIVE STUDENT
    //
    // Clicking the student name/card makes that student the
    // active student while keeping other selections.
    // ========================================================

    const handleSetActiveStudent = (
        studentId
    ) => {
        const id =
            String(studentId);

        if (
            !selectedStudentIds.some(
                (selectedId) =>
                    String(selectedId) ===
                    id
            )
        ) {
            setSelectedStudentIds(
                (current) => [
                    ...current,
                    id,
                ]
            );
        }

        setSelectedStudentId(
            id
        );

        setPaymentForm(
            EMPTY_PAYMENT
        );

        setSuccess("");
        setError("");
    };


    // ========================================================
    // SETUP FORM CHANGE
    // ========================================================

    const handleSetupChange = (
        event
    ) => {
        const {
            name,
            value,
        } = event.target;

        setSetupForm(
            (current) => ({
                ...current,
                [name]: value,
            })
        );
    };


    // ========================================================
    // PAYMENT FORM CHANGE
    // ========================================================

    const handlePaymentChange = (
        event
    ) => {
        const {
            name,
            value,
        } = event.target;

        if (
            name ===
            "paymentFor"
        ) {
            setPaymentForm(
                (current) => ({
                    ...current,
                    paymentFor:
                        value,
                    paymentTerm:
                        value ===
                        "tuition"
                            ? "term_1"
                            : "",
                    setupId: "",
                    amount: "",
                })
            );

            return;
        }

        if (
            name ===
            "paymentTerm"
        ) {
            setPaymentForm(
                (current) => ({
                    ...current,
                    paymentTerm:
                        value,
                    setupId: "",
                    amount: "",
                })
            );

            return;
        }

        if (
            name ===
            "setupId"
        ) {
            const setup =
                filteredPayableSetups.find(
                    (row) =>
                        String(
                            row.id
                        ) ===
                        String(
                            value
                        )
                );

            const balance =
                setup
                    ? numberValue(
                          setup.balance
                      )
                    : "";

            setPaymentForm(
                (current) => ({
                    ...current,
                    setupId:
                        value,
                    amount:
                        balance !==
                        ""
                            ? String(
                                  balance
                              )
                            : "",
                })
            );

            return;
        }

        setPaymentForm(
            (current) => ({
                ...current,
                [name]: value,
            })
        );
    };


    // ========================================================
    // HANDLE SAVE PAYMENT SETUP
    // ========================================================

    const handleSaveSetup = async (
        event
    ) => {
        event.preventDefault();

        setError("");
        setSuccess("");

        if (!user?.id) {
            setError(
                "User session haijapatikana."
            );
            return;
        }

        if (!schoolId) {
            setError(
                "School haijapatikana."
            );
            return;
        }

        if (
            !selectedStudentId
        ) {
            setError(
                "Chagua student kwanza."
            );
            return;
        }

        if (
            !selectedAcademicYearId
        ) {
            setError(
                "Chagua academic year."
            );
            return;
        }

        if (
            !selectedClassId
        ) {
            setError(
                "Chagua class."
            );
            return;
        }

        const setupType =
            normalize(
                setupForm.setupType
            );

        const term1 =
            numberValue(
                setupForm.tuitionTerm1
            );

        const term2 =
            numberValue(
                setupForm.tuitionTerm2
            );

        const otherFees =
            numberValue(
                setupForm.otherFeeAmount
            );

        const shouldSaveTuition =
            setupType ===
                "tuition" ||
            setupType ===
                "both";

        const shouldSaveOther =
            setupType ===
                "other" ||
            setupType ===
                "both";

        if (
            !shouldSaveTuition &&
            !shouldSaveOther
        ) {
            setError(
                "Chagua aina ya Payment Setup."
            );
            return;
        }

        if (
            shouldSaveTuition &&
            term1 <= 0 &&
            term2 <= 0
        ) {
            setError(
                "Weka kiasi cha Tuition Term 1 au Term 2."
            );
            return;
        }

        if (
            shouldSaveOther &&
            otherFees <= 0
        ) {
            setError(
                "Weka kiasi cha Other Fee."
            );
            return;
        }

        setIsSavingSetup(true);

        try {
            const financeSetup =
                await ensureRequiredFeeItems(
                    schoolId,
                    user.id
                );

            const tuition =
                financeSetup.tuition;

            const other =
                financeSetup.other;

            if (
                shouldSaveTuition &&
                !tuition?.id
            ) {
                throw new Error(
                    "Tuition Fee setup haijapatikana."
                );
            }

            if (
                shouldSaveOther &&
                !other?.id
            ) {
                throw new Error(
                    "Other Fee setup haijapatikana."
                );
            }

            const otherFeesPayload =
                shouldSaveOther
                    ? [
                          {
                              fee_item_id:
                                  other.id,
                              amount:
                                  otherFees,
                          },
                      ]
                    : [];

            const {
                data,
                error: saveError,
            } = await supabase
                .schema("finance")
                .rpc(
                    "save_student_payment_setup",
                    {
                        p_school_id:
                            Number(
                                schoolId
                            ),

                        p_student_id:
                            Number(
                                selectedStudentId
                            ),

                        p_academic_year_id:
                            Number(
                                selectedAcademicYearId
                            ),

                        p_class_id:
                            Number(
                                selectedClassId
                            ),

                        p_created_by:
                            user.id,

                        p_tuition_fee_item_id:
                            shouldSaveTuition
                                ? tuition.id
                                : null,

                        p_tuition_term_1:
                            shouldSaveTuition
                                ? term1
                                : 0,

                        p_tuition_term_2:
                            shouldSaveTuition
                                ? term2
                                : 0,

                        p_other_fees:
                            otherFeesPayload,
                    }
                );

            if (saveError) {
                throw saveError;
            }

            setStudentSetups(
                data || []
            );

            setSetupForm(
                EMPTY_SETUP
            );

            setPaymentForm(
                EMPTY_PAYMENT
            );

            await loadStudentSetups(
                selectedStudentId,
                selectedAcademicYearId
            );

            setSuccess(
                "Payment setup imehifadhiwa kikamilifu."
            );
        } catch (saveError) {
            console.error(
                "Save payment setup error:",
                saveError
            );

            setError(
                saveError?.message ||
                    "Imeshindikana kuhifadhi Payment Setup."
            );
        } finally {
            setIsSavingSetup(false);
        }
    };


    // ========================================================
    // HANDLE MAKE PAYMENT
    // ========================================================

    const handleMakePayment = async (
        event
    ) => {
        event.preventDefault();

        setError("");
        setSuccess("");

        if (!user?.id) {
            setError(
                "User session haijapatikana."
            );
            return;
        }

        if (!schoolId) {
            setError(
                "School haijapatikana."
            );
            return;
        }

        if (
            !selectedStudentId
        ) {
            setError(
                "Chagua student kwanza."
            );
            return;
        }

        if (
            !paymentForm.setupId
        ) {
            setError(
                "Chagua Payment Against."
            );
            return;
        }

        const selectedSetup =
            payableSetups.find(
                (row) =>
                    String(
                        row.id
                    ) ===
                    String(
                        paymentForm.setupId
                    )
            );

        if (!selectedSetup) {
            setError(
                "Payment setup iliyochaguliwa haipatikani au haina deni."
            );
            return;
        }

        const amount =
            numberValue(
                paymentForm.amount
            );

        const balance =
            numberValue(
                selectedSetup.balance
            );

        if (amount <= 0) {
            setError(
                "Weka kiasi cha malipo."
            );
            return;
        }

        if (
            amount >
            balance
        ) {
            setError(
                `Kiasi cha malipo hakiwezi kuzidi deni la ${money(
                    balance
                )}.`
            );
            return;
        }

        if (
            !paymentForm.paymentDate
        ) {
            setError(
                "Chagua tarehe ya malipo."
            );
            return;
        }

        if (
            !paymentForm.paymentMethod
        ) {
            setError(
                "Chagua payment method."
            );
            return;
        }

        if (
            !paymentForm.financialAccountId
        ) {
            setError(
                "Chagua financial account."
            );
            return;
        }

        const financialAccount =
            financialAccounts.find(
                (account) =>
                    String(
                        account.id
                    ) ===
                    String(
                        paymentForm.financialAccountId
                    )
            );

        if (!financialAccount) {
            setError(
                "Financial account iliyochaguliwa haipatikani."
            );
            return;
        }

        if (
            !financialAccount.chart_of_account_id
        ) {
            setError(
                `Financial account "${financialAccount.account_name}" haina Chart of Account iliyounganishwa.`
            );
            return;
        }

        // ----------------------------------------------------
        // EXACT SETUP VALIDATION
        // ----------------------------------------------------

        const setupType =
            normalize(
                selectedSetup.setup_type
            );

        if (
            paymentForm.paymentFor ===
                "tuition" &&
            (
                setupType !==
                    "tuition" ||
                Number(
                    selectedSetup.term_number
                ) !==
                    (
                        paymentForm.paymentTerm ===
                        "term_1"
                            ? 1
                            : 2
                    )
            )
        ) {
            setError(
                "Malipo ya Tuition lazima yaendane na term na setup iliyochaguliwa."
            );
            return;
        }

        if (
            paymentForm.paymentFor ===
                "other" &&
            setupType !==
                "other"
        ) {
            setError(
                "Malipo ya Other Fee lazima yaendane na Other Fee setup."
            );
            return;
        }

        /*
         * IMPORTANT:
         * The existing finance RPC is designed around one
         * student + one charge.
         *
         * Therefore the actual payment transaction remains
         * tied to the ACTIVE student.
         *
         * Multiple selection is available for choosing and
         * switching students, while accounting remains
         * safely attached to the active student's charge.
         */
        setIsProcessingPayment(
            true
        );

        try {
            // ------------------------------------------------
            // STEP 1:
            // GUARANTEE CHARGE EXISTS FOR THIS EXACT SETUP
            // ------------------------------------------------

            const {
                data: chargeResult,
                error: chargeRpcError,
            } = await supabase
                .schema("finance")
                .rpc(
                    "ensure_student_charge_for_setup",
                    {
                        p_setup_id:
                            selectedSetup.id,

                        p_charge_date:
                            paymentForm.paymentDate,

                        p_created_by:
                            user.id,
                    }
                );

            if (chargeRpcError) {
                throw chargeRpcError;
            }

            let chargeId = null;

            const chargeRpcRow =
                Array.isArray(
                    chargeResult
                )
                    ? chargeResult[0]
                    : chargeResult;

            if (
                chargeRpcRow?.charge_id
            ) {
                chargeId =
                    chargeRpcRow.charge_id;
            }

            if (
                chargeRpcRow?.id &&
                !chargeId
            ) {
                chargeId =
                    chargeRpcRow.id;
            }

            // ------------------------------------------------
            // STEP 2:
            // FALLBACK LOOKUP BY EXACT payment_setup_id
            // ------------------------------------------------

            if (!chargeId) {
                const {
                    data: chargeRows,
                    error: chargeLookupError,
                } = await supabase
                    .schema("finance")
                    .from(
                        "student_charges"
                    )
                    .select(`
                        id,
                        school_id,
                        student_id,
                        payment_setup_id,
                        amount,
                        paid_amount,
                        balance,
                        status,
                        created_at
                    `)
                    .eq(
                        "school_id",
                        Number(
                            schoolId
                        )
                    )
                    .eq(
                        "student_id",
                        Number(
                            selectedStudentId
                        )
                    )
                    .eq(
                        "payment_setup_id",
                        selectedSetup.id
                    )
                    .order(
                        "created_at",
                        {
                            ascending:
                                false,
                        }
                    )
                    .limit(1);

                if (
                    chargeLookupError
                ) {
                    throw chargeLookupError;
                }

                chargeId =
                    chargeRows?.[0]?.id ||
                    null;
            }

            if (!chargeId) {
                throw new Error(
                    "Student charge haikuweza kuandaliwa kwa Payment Setup hii."
                );
            }

            // ------------------------------------------------
            // STEP 3:
            // RECORD ACTUAL PAYMENT
            // ------------------------------------------------

            const {
                data: paymentResult,
                error: paymentError,
            } = await supabase
                .schema("finance")
                .rpc(
                    "record_student_payment",
                    {
                        p_school_id:
                            Number(
                                schoolId
                            ),

                        p_student_id:
                            Number(
                                selectedStudentId
                            ),

                        p_charge_id:
                            chargeId,

                        p_payment_date:
                            paymentForm.paymentDate,

                        p_amount:
                            amount,

                        p_payment_method:
                            paymentForm.paymentMethod,

                        p_financial_account_id:
                            Number(
                                paymentForm.financialAccountId
                            ),

                        p_provider_name:
                            paymentForm.providerName?.trim() ||
                            null,

                        p_reference_number:
                            paymentForm.referenceNumber?.trim() ||
                            null,

                        p_description:
                            paymentForm.description?.trim() ||
                            `Student fee payment - ${studentName(
                                selectedStudent
                            )}`,

                        p_created_by:
                            user.id,
                    }
                );

            if (paymentError) {
                throw paymentError;
            }

            // ------------------------------------------------
            // REFRESH
            // ------------------------------------------------

            await loadStudentSetups(
                selectedStudentId,
                selectedAcademicYearId
            );

            const refreshedAccounts =
                await loadFinancialAccounts(
                    schoolId
                );

            setFinancialAccounts(
                refreshedAccounts
            );

            setPaymentForm(
                EMPTY_PAYMENT
            );

            const paymentRow =
                Array.isArray(
                    paymentResult
                )
                    ? paymentResult[0]
                    : paymentResult;

            const receiptNumber =
                paymentRow?.receipt_number ||
                paymentRow?.payment_number ||
                paymentRow?.reference_number ||
                "";

            setSuccess(
                receiptNumber
                    ? `Malipo yamepokelewa kikamilifu. Receipt: ${receiptNumber}`
                    : "Malipo yamepokelewa kikamilifu na accounting entries zimehifadhiwa."
            );
        } catch (paymentError) {
            console.error(
                "Record student payment error:",
                paymentError
            );

            setError(
                paymentError?.message ||
                    "Imeshindikana kurekodi malipo."
            );
        } finally {
            setIsProcessingPayment(
                false
            );
        }
    };


    // ========================================================
    // MANUAL REFRESH
    // ========================================================

    const handleRefresh = async () => {
        setError("");
        setSuccess("");

        try {
            setIsLoading(true);

            if (
                !user?.id ||
                !schoolId
            ) {
                await loadInitialData();
                return;
            }

            const [
                loadedClasses,
                loadedStudents,
                loadedAccounts,
                financeSetup,
            ] =
                await Promise.all([
                    loadClasses(
                        schoolId,
                        selectedAcademicYearId
                    ),

                    loadStudents(
                        schoolId,
                        selectedAcademicYearId
                    ),

                    loadFinancialAccounts(
                        schoolId
                    ),

                    ensureRequiredFeeItems(
                        schoolId,
                        user.id
                    ),
                ]);

            setClasses(
                loadedClasses
            );

            setStudents(
                loadedStudents
            );

            setFinancialAccounts(
                loadedAccounts
            );

            setFeeItems(
                financeSetup.feeItems ||
                    []
            );

            if (
                selectedStudentId &&
                selectedAcademicYearId
            ) {
                await loadStudentSetups(
                    selectedStudentId,
                    selectedAcademicYearId
                );
            }

            setSuccess(
                "Taarifa zime-refresh."
            );
        } catch (refreshError) {
            console.error(
                refreshError
            );

            setError(
                refreshError?.message ||
                    "Imeshindikana ku-refresh taarifa."
            );
        } finally {
            setIsLoading(false);
        }
    };


    // ========================================================
    // SETUP SUMMARY
    // ========================================================

    const tuitionSetupTotal =
        useMemo(() => {
            return studentSetups
                .filter(
                    (setup) =>
                        normalize(
                            setup.setup_type
                        ) ===
                        "tuition"
                )
                .reduce(
                    (
                        total,
                        setup
                    ) =>
                        total +
                        numberValue(
                            setup.amount
                        ),
                    0
                );
        }, [
            studentSetups,
        ]);

    const otherSetupTotal =
        useMemo(() => {
            return studentSetups
                .filter(
                    (setup) =>
                        normalize(
                            setup.setup_type
                        ) ===
                        "other"
                )
                .reduce(
                    (
                        total,
                        setup
                    ) =>
                        total +
                        numberValue(
                            setup.amount
                        ),
                    0
                );
        }, [
            studentSetups,
        ]);


    // ========================================================
    // RENDER
    // ========================================================

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
                <div className="text-center">
                    <FaSpinner className="animate-spin text-4xl mx-auto mb-4 text-blue-400" />

                    <p className="text-slate-300">
                        Loading Receive Payment...
                    </p>
                </div>
            </div>
        );
    }


    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            {/* ================================================= */}
            {/* TOP HEADER */}
            {/* ================================================= */}

            <div className="border-b border-slate-800 bg-slate-950/95 sticky top-0 z-20">
                <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-4">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <Link
                                to="/finance"
                                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition"
                            >
                                <FaArrowLeft />
                            </Link>

                            <div>
                                <div className="flex items-center gap-2">
                                    <FaMoneyBillWave className="text-blue-400" />

                                    <h1 className="text-xl md:text-2xl font-bold">
                                        Receive Payment
                                    </h1>
                                </div>

                                <p className="text-sm text-slate-400 mt-1">
                                    Student fee collection,
                                    receivables and
                                    accounting
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={
                                handleRefresh
                            }
                            disabled={
                                isLoading
                            }
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition font-semibold"
                        >
                            <FaRedo
                                className={
                                    isLoading
                                        ? "animate-spin"
                                        : ""
                                }
                            />

                            Refresh
                        </button>
                    </div>
                </div>
            </div>


            {/* ================================================= */}
            {/* CONTENT */}
            {/* ================================================= */}

            <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 space-y-6">

                {/* ================================================= */}
                {/* ALERTS */}
                {/* ================================================= */}

                {error && (
                    <div className="rounded-2xl border border-red-500/30 bg-red-950/40 px-5 py-4 flex gap-3 items-start">
                        <FaExclamationTriangle className="text-red-400 mt-1 shrink-0" />

                        <div>
                            <p className="font-semibold text-red-300">
                                Transaction Error
                            </p>

                            <p className="text-sm text-red-200 mt-1">
                                {error}
                            </p>
                        </div>
                    </div>
                )}

                {success && (
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/40 px-5 py-4 flex gap-3 items-start">
                        <FaCheckCircle className="text-emerald-400 mt-1 shrink-0" />

                        <div>
                            <p className="font-semibold text-emerald-300">
                                Transaction Successful
                            </p>

                            <p className="text-sm text-emerald-200 mt-1">
                                {success}
                            </p>
                        </div>
                    </div>
                )}


                {/* ================================================= */}
                {/* STUDENT SELECTION */}
                {/* ================================================= */}

                <section className="rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/80">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
                                    <FaUserGraduate />
                                </div>

                                <div>
                                    <h2 className="font-bold text-lg">
                                        Select Student
                                    </h2>

                                    <p className="text-xs text-slate-400">
                                        Chagua academic year,
                                        class na student mmoja au
                                        wengi
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-bold">
                                    Selected:{" "}
                                    {selectedStudentCount}
                                </span>

                                {filteredStudents.length >
                                    0 && (
                                    <button
                                        type="button"
                                        onClick={
                                            allFilteredStudentsSelected
                                                ? handleDeselectAllStudents
                                                : handleSelectAllStudents
                                        }
                                        className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                                            allFilteredStudentsSelected
                                                ? "bg-red-600 hover:bg-red-500 text-white"
                                                : "bg-blue-600 hover:bg-blue-500 text-white"
                                        }`}
                                    >
                                        <FaCheckCircle />

                                        {allFilteredStudentsSelected
                                            ? "Deselect All"
                                            : "Select All"}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="p-5 space-y-5">

                        {/* FILTERS */}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                            {/* Academic Year */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-2">
                                    Academic Year
                                </label>

                                <select
                                    value={
                                        selectedAcademicYearId
                                    }
                                    onChange={
                                        handleAcademicYearChange
                                    }
                                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                >
                                    <option value="">
                                        Select Academic Year
                                    </option>

                                    {academicYears.map(
                                        (year) => (
                                            <option
                                                key={
                                                    year.id
                                                }
                                                value={
                                                    year.id
                                                }
                                            >
                                                {year.year_name}
                                                {year.term
                                                    ? ` - ${year.term}`
                                                    : ""}
                                            </option>
                                        )
                                    )}
                                </select>
                            </div>


                            {/* Class */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-2">
                                    Class
                                </label>

                                <select
                                    value={
                                        selectedClassId
                                    }
                                    onChange={
                                        handleClassChange
                                    }
                                    disabled={
                                        !selectedAcademicYearId
                                    }
                                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
                                >
                                    <option value="">
                                        Select Class
                                    </option>

                                    {classes.map(
                                        (row) => (
                                            <option
                                                key={
                                                    row.id
                                                }
                                                value={
                                                    row.id
                                                }
                                            >
                                                {getClassName(
                                                    row
                                                )}
                                            </option>
                                        )
                                    )}
                                </select>
                            </div>


                            {/* Search */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-2">
                                    Search Student
                                </label>

                                <div className="relative">
                                    <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />

                                    <input
                                        value={
                                            studentSearch
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setStudentSearch(
                                                event.target
                                                    .value
                                            )
                                        }
                                        placeholder="Name or admission number"
                                        disabled={
                                            !selectedClassId
                                        }
                                        className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-11 pr-4 py-3 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
                                    />
                                </div>
                            </div>
                        </div>


                        {/* STUDENT LIST */}

                        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">

                            <div className="px-4 py-3 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <div>
                                    <p className="font-bold text-sm">
                                        Students
                                    </p>

                                    <p className="text-xs text-slate-500 mt-1">
                                        Tick students unaotaka.
                                        Student wa kwanza
                                        aliye-selected ndiye
                                        active student.
                                    </p>
                                </div>

                                <div className="text-xs text-slate-500">
                                    Showing{" "}
                                    {
                                        filteredStudents.length
                                    }{" "}
                                    student(s)
                                </div>
                            </div>

                            <div className="max-h-[420px] overflow-y-auto">

                                {filteredStudents.length ===
                                0 ? (
                                    <div className="px-5 py-12 text-center">
                                        <FaUserGraduate className="text-3xl text-slate-700 mx-auto mb-3" />

                                        <p className="text-slate-400 font-semibold">
                                            Hakuna students
                                        </p>

                                        <p className="text-xs text-slate-600 mt-1">
                                            Chagua academic year
                                            na class kwanza.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-800">
                                        {filteredStudents.map(
                                            (
                                                student
                                            ) => {
                                                const studentId =
                                                    String(
                                                        student.id
                                                    );

                                                const isSelected =
                                                    selectedStudentIds.some(
                                                        (
                                                            id
                                                        ) =>
                                                            String(
                                                                id
                                                            ) ===
                                                            studentId
                                                    );

                                                const isActive =
                                                    String(
                                                        selectedStudentId
                                                    ) ===
                                                    studentId;

                                                return (
                                                    <div
                                                        key={
                                                            student.id
                                                        }
                                                        className={`px-4 py-3 flex items-center gap-3 transition ${
                                                            isActive
                                                                ? "bg-blue-950/40"
                                                                : isSelected
                                                                ? "bg-slate-900"
                                                                : "hover:bg-slate-900/70"
                                                        }`}
                                                    >

                                                        {/* CHECKBOX */}

                                                        <input
                                                            type="checkbox"
                                                            checked={
                                                                isSelected
                                                            }
                                                            onChange={() =>
                                                                handleToggleStudent(
                                                                    studentId
                                                                )
                                                            }
                                                            disabled={
                                                                isProcessingPayment ||
                                                                isSavingSetup
                                                            }
                                                            className="w-4 h-4 rounded border-slate-600 bg-slate-950 text-blue-600 focus:ring-blue-500"
                                                        />


                                                        {/* STUDENT INFO */}

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                handleSetActiveStudent(
                                                                    studentId
                                                                )
                                                            }
                                                            className="flex-1 min-w-0 text-left"
                                                        >
                                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                                                <div className="min-w-0">
                                                                    <p
                                                                        className={`font-semibold truncate ${
                                                                            isActive
                                                                                ? "text-blue-300"
                                                                                : "text-slate-200"
                                                                        }`}
                                                                    >
                                                                        {studentName(
                                                                            student
                                                                        )}
                                                                    </p>

                                                                    <p className="text-xs text-slate-500 mt-1">
                                                                        Admission:{" "}
                                                                        {getAdmission(
                                                                            student
                                                                        )}
                                                                    </p>
                                                                </div>

                                                                <div className="flex items-center gap-2">
                                                                    {student.stream && (
                                                                        <span className="px-2 py-1 rounded-lg bg-slate-800 text-slate-400 text-[10px]">
                                                                            {
                                                                                student.stream
                                                                            }
                                                                        </span>
                                                                    )}

                                                                    {isActive && (
                                                                        <span className="px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[10px] font-bold">
                                                                            ACTIVE
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </button>

                                                    </div>
                                                );
                                            }
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* SELECTED SUMMARY */}

                            {selectedStudentCount >
                                0 && (
                                <div className="px-4 py-3 border-t border-slate-800 bg-slate-900/80">
                                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">

                                        <div>
                                            <p className="text-xs text-slate-500">
                                                Selected students
                                            </p>

                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {selectedStudentIds
                                                    .slice(
                                                        0,
                                                        10
                                                    )
                                                    .map(
                                                        (
                                                            id
                                                        ) => {
                                                            const student =
                                                                students.find(
                                                                    (
                                                                        row
                                                                    ) =>
                                                                        String(
                                                                            row.id
                                                                        ) ===
                                                                        String(
                                                                            id
                                                                        )
                                                                );

                                                            if (!student) {
                                                                return null;
                                                            }

                                                            return (
                                                                <button
                                                                    type="button"
                                                                    key={
                                                                        id
                                                                    }
                                                                    onClick={() =>
                                                                        handleSetActiveStudent(
                                                                            id
                                                                        )
                                                                    }
                                                                    className={`px-2.5 py-1.5 rounded-lg text-xs border transition ${
                                                                        String(
                                                                            selectedStudentId
                                                                        ) ===
                                                                        String(
                                                                            id
                                                                        )
                                                                            ? "bg-blue-600/20 border-blue-500/40 text-blue-300"
                                                                            : "bg-slate-950 border-slate-700 text-slate-400 hover:text-white"
                                                                    }`}
                                                                >
                                                                    {studentName(
                                                                        student
                                                                    )}
                                                                </button>
                                                            );
                                                        }
                                                    )}

                                                {selectedStudentCount >
                                                    10 && (
                                                    <span className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-500">
                                                        +
                                                        {selectedStudentCount -
                                                            10}{" "}
                                                        more
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedStudentIds(
                                                    []
                                                );
                                                setSelectedStudentId(
                                                    ""
                                                );
                                                setStudentSetups(
                                                    []
                                                );
                                                setStudentCharges(
                                                    []
                                                );
                                                setPaymentForm(
                                                    EMPTY_PAYMENT
                                                );
                                            }}
                                            className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                                        >
                                            Clear Selection
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </section>


                {/* ================================================= */}
                {/* STUDENT SUMMARY */}
                {/* ================================================= */}

                {selectedStudent && (
                    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

                        <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-950/80 to-slate-900 p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-slate-400">
                                        Active Student
                                    </p>

                                    <p className="font-bold mt-1">
                                        {studentName(
                                            selectedStudent
                                        )}
                                    </p>
                                </div>

                                <FaUserGraduate className="text-blue-400 text-2xl" />
                            </div>

                            <p className="text-xs text-slate-500 mt-3">
                                Admission:{" "}
                                {getAdmission(
                                    selectedStudent
                                )}
                            </p>

                            {selectedStudentCount >
                                1 && (
                                <p className="text-xs text-blue-400 mt-2">
                                    {selectedStudentCount} students
                                    selected
                                </p>
                            )}
                        </div>


                        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                            <p className="text-xs text-slate-400">
                                Academic Year
                            </p>

                            <p className="font-bold mt-1">
                                {selectedAcademicYear?.year_name ||
                                    "-"}
                            </p>

                            <p className="text-xs text-slate-500 mt-2">
                                Class:{" "}
                                {getClassName(
                                    selectedClass
                                )}
                            </p>
                        </div>


                        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-5">
                            <p className="text-xs text-slate-400">
                                Total Paid
                            </p>

                            <p className="text-xl font-bold text-emerald-400 mt-1">
                                {money(
                                    totalPaid
                                )}
                            </p>
                        </div>


                        <div className="rounded-2xl border border-orange-500/20 bg-orange-950/20 p-5">
                            <p className="text-xs text-slate-400">
                                Outstanding
                            </p>

                            <p className="text-xl font-bold text-orange-400 mt-1">
                                {money(
                                    totalOutstanding
                                )}
                            </p>
                        </div>
                    </section>
                )}


                {selectedStudent && (
                    <>
                        {/* ================================================= */}
                        {/* PAYMENT SETUP */}
                        {/* ================================================= */}

                        <section className="rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                                        <FaFileInvoiceDollar />
                                    </div>

                                    <div>
                                        <h2 className="font-bold text-lg">
                                            Student Payment Setup
                                        </h2>

                                        <p className="text-xs text-slate-400">
                                            Weka deni/fees za student kwa academic year hii
                                        </p>
                                    </div>
                                </div>

                                <div className="hidden md:flex gap-3 text-xs">
                                    <span className="px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-300">
                                        Tuition:{" "}
                                        {money(
                                            tuitionSetupTotal
                                        )}
                                    </span>

                                    <span className="px-3 py-1.5 rounded-full bg-purple-500/10 text-purple-300">
                                        Other:{" "}
                                        {money(
                                            otherSetupTotal
                                        )}
                                    </span>
                                </div>
                            </div>


                            <form
                                onSubmit={
                                    handleSaveSetup
                                }
                                className="p-5 space-y-5"
                            >
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

                                    {/* Setup Type */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 mb-2">
                                            Setup Type
                                        </label>

                                        <select
                                            name="setupType"
                                            value={
                                                setupForm.setupType
                                            }
                                            onChange={
                                                handleSetupChange
                                            }
                                            disabled={
                                                isSavingSetup
                                            }
                                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                        >
                                            <option value="tuition">
                                                Tuition
                                            </option>

                                            <option value="other">
                                                Other Fee
                                            </option>

                                            <option value="both">
                                                Tuition + Other
                                            </option>
                                        </select>
                                    </div>


                                    {/* Term 1 */}
                                    {(setupForm.setupType ===
                                        "tuition" ||
                                        setupForm.setupType ===
                                            "both") && (
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-400 mb-2">
                                                Tuition Term 1
                                            </label>

                                            <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                name="tuitionTerm1"
                                                value={
                                                    setupForm.tuitionTerm1
                                                }
                                                onChange={
                                                    handleSetupChange
                                                }
                                                placeholder="0"
                                                disabled={
                                                    isSavingSetup
                                                }
                                                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    )}


                                    {/* Term 2 */}
                                    {(setupForm.setupType ===
                                        "tuition" ||
                                        setupForm.setupType ===
                                            "both") && (
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-400 mb-2">
                                                Tuition Term 2
                                            </label>

                                            <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                name="tuitionTerm2"
                                                value={
                                                    setupForm.tuitionTerm2
                                                }
                                                onChange={
                                                    handleSetupChange
                                                }
                                                placeholder="0"
                                                disabled={
                                                    isSavingSetup
                                                }
                                                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    )}


                                    {/* Other */}
                                    {(setupForm.setupType ===
                                        "other" ||
                                        setupForm.setupType ===
                                            "both") && (
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-400 mb-2">
                                                Other Fee Amount
                                            </label>

                                            <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                name="otherFeeAmount"
                                                value={
                                                    setupForm.otherFeeAmount
                                                }
                                                onChange={
                                                    handleSetupChange
                                                }
                                                placeholder="0"
                                                disabled={
                                                    isSavingSetup
                                                }
                                                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    )}
                                </div>


                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-2">
                                    <div className="text-xs text-slate-500">
                                        Tuition hutumia Fee Item ya
                                        mfumo na Revenue Account 4000.
                                        Student receivable hutumia
                                        Account 1100.
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={
                                            isSavingSetup
                                        }
                                        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition font-bold"
                                    >
                                        {isSavingSetup ? (
                                            <>
                                                <FaSpinner className="animate-spin" />

                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <FaCheckCircle />

                                                Save Payment Setup
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </section>


                        {/* ================================================= */}
                        {/* CURRENT RECEIVABLES */}
                        {/* ================================================= */}

                        <section className="rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-800">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-orange-600/20 text-orange-400 flex items-center justify-center">
                                        <FaReceipt />
                                    </div>

                                    <div>
                                        <h2 className="font-bold text-lg">
                                            Current Receivables
                                        </h2>

                                        <p className="text-xs text-slate-400">
                                            Deni na malipo yaliyopo kwa student huyu
                                        </p>
                                    </div>
                                </div>
                            </div>


                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-950 text-slate-400">
                                        <tr>
                                            <th className="text-left px-5 py-3">
                                                Description
                                            </th>

                                            <th className="text-left px-5 py-3">
                                                Date
                                            </th>

                                            <th className="text-right px-5 py-3">
                                                Amount
                                            </th>

                                            <th className="text-right px-5 py-3">
                                                Paid
                                            </th>

                                            <th className="text-right px-5 py-3">
                                                Balance
                                            </th>

                                            <th className="text-left px-5 py-3">
                                                Status
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-slate-800">
                                        {isLoadingStudentFinance ? (
                                            <tr>
                                                <td
                                                    colSpan="6"
                                                    className="px-5 py-10 text-center text-slate-400"
                                                >
                                                    <FaSpinner className="animate-spin inline mr-2" />

                                                    Loading student finance...
                                                </td>
                                            </tr>
                                        ) : studentCharges.length ===
                                          0 ? (
                                            <tr>
                                                <td
                                                    colSpan="6"
                                                    className="px-5 py-10 text-center text-slate-500"
                                                >
                                                    Hakuna student charges kwa academic year hii.
                                                </td>
                                            </tr>
                                        ) : (
                                            studentCharges.map(
                                                (
                                                    charge
                                                ) => {
                                                    const balance =
                                                        getChargeBalance(
                                                            charge
                                                        );

                                                    return (
                                                        <tr
                                                            key={
                                                                charge.id
                                                            }
                                                            className="hover:bg-slate-800/40"
                                                        >
                                                            <td className="px-5 py-4">
                                                                <div className="font-medium text-slate-200">
                                                                    {charge.description ||
                                                                        "Student Fee"}
                                                                </div>

                                                                <div className="text-xs text-slate-500 mt-1">
                                                                    {charge.invoice_number ||
                                                                        charge.payment_setup_id
                                                                            ? "Linked student payment setup"
                                                                            : "Student receivable"}
                                                                </div>
                                                            </td>

                                                            <td className="px-5 py-4 text-slate-400">
                                                                {charge.charge_date ||
                                                                    "-"}
                                                            </td>

                                                            <td className="px-5 py-4 text-right">
                                                                {money(
                                                                    charge.amount
                                                                )}
                                                            </td>

                                                            <td className="px-5 py-4 text-right text-emerald-400">
                                                                {money(
                                                                    charge.paid_amount ??
                                                                        charge.amount_paid
                                                                )}
                                                            </td>

                                                            <td className="px-5 py-4 text-right font-bold text-orange-400">
                                                                {money(
                                                                    balance
                                                                )}
                                                            </td>

                                                            <td className="px-5 py-4">
                                                                <span
                                                                    className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                                        balance <=
                                                                        0
                                                                            ? "bg-emerald-500/10 text-emerald-400"
                                                                            : "bg-orange-500/10 text-orange-400"
                                                                    }`}
                                                                >
                                                                    {balance <=
                                                                    0
                                                                        ? "Paid"
                                                                        : "Outstanding"}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                }
                                            )
                                        )}
                                    </tbody>
                                </table>
                            </div>


                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 border-t border-slate-800 bg-slate-950/40">
                                <div>
                                    <p className="text-xs text-slate-500">
                                        Total Charges
                                    </p>

                                    <p className="text-lg font-bold mt-1">
                                        {money(
                                            totalCharges
                                        )}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs text-slate-500">
                                        Total Paid
                                    </p>

                                    <p className="text-lg font-bold text-emerald-400 mt-1">
                                        {money(
                                            totalPaid
                                        )}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs text-slate-500">
                                        Outstanding
                                    </p>

                                    <p className="text-lg font-bold text-orange-400 mt-1">
                                        {money(
                                            totalOutstanding
                                        )}
                                    </p>
                                </div>
                            </div>
                        </section>


                        {/* ================================================= */}
                        {/* MAKE PAYMENT */}
                        {/* ================================================= */}

                        <section className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/30 shadow-2xl overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-800">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
                                        <FaWallet />
                                    </div>

                                    <div>
                                        <h2 className="font-bold text-lg">
                                            Make Payment
                                        </h2>

                                        <p className="text-xs text-slate-400">
                                            Pokea malipo dhidi ya deni maalum la student
                                        </p>
                                    </div>
                                </div>
                            </div>


                            <form
                                onSubmit={
                                    handleMakePayment
                                }
                                className="p-5 space-y-5"
                            >

                                {/* ========================================= */}
                                {/* PAYMENT TARGET */}
                                {/* ========================================= */}

                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

                                    {/* Payment For */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 mb-2">
                                            Payment For
                                        </label>

                                        <select
                                            name="paymentFor"
                                            value={
                                                paymentForm.paymentFor
                                            }
                                            onChange={
                                                handlePaymentChange
                                            }
                                            disabled={
                                                !selectedStudentId ||
                                                isProcessingPayment
                                            }
                                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
                                        >
                                            <option value="tuition">
                                                Tuition Fee
                                            </option>

                                            <option value="other">
                                                Other Fee
                                            </option>
                                        </select>
                                    </div>


                                    {/* Term */}
                                    {paymentForm.paymentFor ===
                                        "tuition" && (
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-400 mb-2">
                                                Term
                                            </label>

                                            <select
                                                name="paymentTerm"
                                                value={
                                                    paymentForm.paymentTerm
                                                }
                                                onChange={
                                                    handlePaymentChange
                                                }
                                                disabled={
                                                    !selectedStudentId ||
                                                    isProcessingPayment
                                                }
                                                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
                                            >
                                                <option value="term_1">
                                                    Term 1
                                                </option>

                                                <option value="term_2">
                                                    Term 2
                                                </option>
                                            </select>
                                        </div>
                                    )}


                                    {/* Payment Against */}
                                    <div
                                        className={
                                            paymentForm.paymentFor ===
                                            "tuition"
                                                ? "xl:col-span-2"
                                                : "md:col-span-2 xl:col-span-3"
                                        }
                                    >
                                        <label className="block text-xs font-semibold text-slate-400 mb-2">
                                            Payment Against
                                        </label>

                                        <select
                                            name="setupId"
                                            value={
                                                paymentForm.setupId
                                            }
                                            onChange={
                                                handlePaymentChange
                                            }
                                            disabled={
                                                !selectedStudentId ||
                                                filteredPayableSetups.length ===
                                                    0 ||
                                                isProcessingPayment
                                            }
                                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
                                        >
                                            <option value="">
                                                {filteredPayableSetups.length
                                                    ? "Select setup / charge"
                                                    : paymentForm.paymentFor ===
                                                      "tuition"
                                                    ? "No unpaid tuition setup for this term"
                                                    : "No unpaid other fee setup"}
                                            </option>

                                            {filteredPayableSetups.map(
                                                (
                                                    setup
                                                ) => (
                                                    <option
                                                        key={
                                                            setup.id
                                                        }
                                                        value={
                                                            setup.id
                                                        }
                                                    >
                                                        {getSetupLabel(
                                                            setup
                                                        )}{" "}
                                                        — Outstanding{" "}
                                                        {money(
                                                            setup.balance
                                                        )}
                                                    </option>
                                                )
                                            )}
                                        </select>
                                    </div>
                                </div>


                                {/* ========================================= */}
                                {/* SELECTED RECEIVABLE */}
                                {/* ========================================= */}

                                {paymentForm.setupId &&
                                    selectedPaymentSetup && (
                                        <div className="rounded-xl border border-blue-500/20 bg-blue-950/20 px-4 py-3">
                                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                                <div>
                                                    <p className="text-xs text-slate-500">
                                                        Selected receivable
                                                    </p>

                                                    <p className="font-semibold text-blue-300">
                                                        {getSetupLabel(
                                                            selectedPaymentSetup
                                                        )}
                                                    </p>
                                                </div>

                                                <div className="text-left md:text-right">
                                                    <p className="text-xs text-slate-500">
                                                        Outstanding
                                                    </p>

                                                    <p className="font-bold text-orange-400">
                                                        {money(
                                                            selectedPaymentSetup.balance
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}


                                {/* ========================================= */}
                                {/* PAYMENT DETAILS */}
                                {/* ========================================= */}

                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

                                    {/* Amount */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 mb-2">
                                            Amount
                                        </label>

                                        <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            name="amount"
                                            value={
                                                paymentForm.amount
                                            }
                                            onChange={
                                                handlePaymentChange
                                            }
                                            disabled={
                                                !paymentForm.setupId ||
                                                isProcessingPayment
                                            }
                                            placeholder="0"
                                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
                                        />

                                        {selectedPaymentSetup && (
                                            <p className="text-xs text-slate-500 mt-1">
                                                Max:{" "}
                                                {money(
                                                    selectedPaymentSetup.balance
                                                )}
                                            </p>
                                        )}
                                    </div>


                                    {/* Date */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 mb-2">
                                            Payment Date
                                        </label>

                                        <input
                                            type="date"
                                            name="paymentDate"
                                            value={
                                                paymentForm.paymentDate
                                            }
                                            onChange={
                                                handlePaymentChange
                                            }
                                            disabled={
                                                isProcessingPayment
                                            }
                                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
                                        />
                                    </div>


                                    {/* Method */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 mb-2">
                                            Payment Method
                                        </label>

                                        <select
                                            name="paymentMethod"
                                            value={
                                                paymentForm.paymentMethod
                                            }
                                            onChange={
                                                handlePaymentChange
                                            }
                                            disabled={
                                                isProcessingPayment
                                            }
                                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
                                        >
                                            <option value="cash">
                                                Cash
                                            </option>

                                            <option value="bank">
                                                Bank
                                            </option>

                                            <option value="mobile_money">
                                                Mobile Money
                                            </option>

                                            <option value="cheque">
                                                Cheque
                                            </option>

                                            <option value="other">
                                                Other
                                            </option>
                                        </select>
                                    </div>


                                    {/* Provider */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 mb-2">
                                            Provider
                                        </label>

                                        <input
                                            type="text"
                                            name="providerName"
                                            value={
                                                paymentForm.providerName
                                            }
                                            onChange={
                                                handlePaymentChange
                                            }
                                            disabled={
                                                isProcessingPayment
                                            }
                                            placeholder="M-Pesa, CRDB, NMB..."
                                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
                                        />
                                    </div>


                                    {/* Financial Account */}
                                    <div className="md:col-span-2 xl:col-span-2">
                                        <label className="block text-xs font-semibold text-slate-400 mb-2">
                                            Financial Account
                                        </label>

                                        <select
                                            name="financialAccountId"
                                            value={
                                                paymentForm.financialAccountId
                                            }
                                            onChange={
                                                handlePaymentChange
                                            }
                                            disabled={
                                                isProcessingPayment
                                            }
                                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
                                        >
                                            <option value="">
                                                Select Financial Account
                                            </option>

                                            {availableFinancialAccounts.map(
                                                (
                                                    account
                                                ) => (
                                                    <option
                                                        key={
                                                            account.id
                                                        }
                                                        value={
                                                            account.id
                                                        }
                                                    >
                                                        {
                                                            account.account_name
                                                        }
                                                        {account.provider_name
                                                            ? ` — ${account.provider_name}`
                                                            : ""}
                                                        {account.account_number
                                                            ? ` (${account.account_number})`
                                                            : ""}
                                                    </option>
                                                )
                                            )}
                                        </select>

                                        {availableFinancialAccounts.length ===
                                            0 && (
                                            <p className="text-xs text-orange-400 mt-2">
                                                Hakuna active financial account inayolingana na payment method hii.
                                            </p>
                                        )}
                                    </div>


                                    {/* Reference */}
                                    <div className="md:col-span-2 xl:col-span-2">
                                        <label className="block text-xs font-semibold text-slate-400 mb-2">
                                            Reference Number
                                        </label>

                                        <input
                                            type="text"
                                            name="referenceNumber"
                                            value={
                                                paymentForm.referenceNumber
                                            }
                                            onChange={
                                                handlePaymentChange
                                            }
                                            disabled={
                                                isProcessingPayment
                                            }
                                            placeholder="Transaction / bank / mobile reference"
                                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
                                        />
                                    </div>


                                    {/* Description */}
                                    <div className="md:col-span-2 xl:col-span-4">
                                        <label className="block text-xs font-semibold text-slate-400 mb-2">
                                            Description
                                        </label>

                                        <textarea
                                            name="description"
                                            value={
                                                paymentForm.description
                                            }
                                            onChange={
                                                handlePaymentChange
                                            }
                                            disabled={
                                                isProcessingPayment
                                            }
                                            rows="3"
                                            placeholder="Payment description..."
                                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:opacity-50 resize-none"
                                        />
                                    </div>
                                </div>


                                {/* ========================================= */}
                                {/* ACCOUNTING SUMMARY */}
                                {/* ========================================= */}

                                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                                    <div className="flex items-center gap-3 mb-4">
                                        <FaUniversity className="text-blue-400" />

                                        <div>
                                            <h3 className="font-bold">
                                                Accounting Treatment
                                            </h3>

                                            <p className="text-xs text-slate-500">
                                                Mfumo uta-record payment kupitia finance RPC
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                                            <p className="text-xs text-slate-500">
                                                Debit
                                            </p>

                                            <p className="font-semibold mt-1">
                                                {financialAccounts.find(
                                                    (
                                                        account
                                                    ) =>
                                                        String(
                                                            account.id
                                                        ) ===
                                                        String(
                                                            paymentForm.financialAccountId
                                                        )
                                                )?.account_name ||
                                                    "Selected Cash / Bank Account"}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                                            <p className="text-xs text-slate-500">
                                                Credit
                                            </p>

                                            <p className="font-semibold mt-1">
                                                Accounts Receivable -
                                                Students
                                            </p>

                                            <p className="text-xs text-slate-500 mt-1">
                                                Account 1100
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                                            <p className="text-xs text-slate-500">
                                                Payment
                                            </p>

                                            <p className="font-bold text-emerald-400 mt-1">
                                                {money(
                                                    paymentForm.amount
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>


                                {/* ========================================= */}
                                {/* SUBMIT */}
                                {/* ========================================= */}

                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-2">
                                    <div className="text-xs text-slate-500 max-w-2xl">
                                        Payment hii itaunganishwa na
                                        Payment Setup husika, Student
                                        Charge yake, kisha finance
                                        RPC ita-update receivable,
                                        payment record, journal entry
                                        na financial account balance.
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={
                                            isProcessingPayment ||
                                            !paymentForm.setupId ||
                                            !paymentForm.amount ||
                                            !paymentForm.financialAccountId
                                        }
                                        className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition font-bold shadow-lg"
                                    >
                                        {isProcessingPayment ? (
                                            <>
                                                <FaSpinner className="animate-spin" />

                                                Processing Payment...
                                            </>
                                        ) : (
                                            <>
                                                <FaMoneyBillWave />

                                                Receive Payment
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </section>
                    </>
                )}
            </main>
        </div>
    );
};

export default RecordPayment;