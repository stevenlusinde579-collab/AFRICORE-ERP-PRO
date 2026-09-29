import React, {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    FaArrowLeft,
    FaCalendarAlt,
    FaEdit,
    FaFileExcel,
    FaPrint,
    FaRedo,
    FaSave,
    FaSearch,
    FaSpinner,
    FaTrash,
    FaUsers,
    FaWallet,
    FaTimes,
    FaExclamationTriangle,
    FaPlus,
} from "react-icons/fa";

import { useNavigate } from "react-router-dom";

import { supabase } from "../../services/supabase";


// ============================================================
// HELPERS
// ============================================================

const numberValue = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};


const money = (value) => {
    return new Intl.NumberFormat("en-TZ", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(numberValue(value));
};


const percentage = (value) => {
    return `${numberValue(value).toFixed(2)}%`;
};


const studentName = (student) => {
    return [
        student?.first_name,
        student?.middle_name,
        student?.last_name,
    ]
        .filter(Boolean)
        .join(" ")
        .trim();
};


const normalizeText = (value) => {
    return String(value || "")
        .trim()
        .toLowerCase();
};


// ============================================================
// TUITION IDENTIFICATION
// ============================================================

const isTuitionFee = (feeName) => {
    const name = normalizeText(feeName);

    if (!name) {
        return false;
    }

    return (
        name.includes("tuition") ||
        name.includes("school fee") ||
        name.includes("school fees") ||
        name.includes("schoolfee") ||
        name.includes("education fee") ||
        name.includes("education fees") ||
        name === "fees" ||
        name === "fee"
    );
};


// ============================================================
// SETUP TYPE
// ============================================================

const isTuitionSetup = (setup) => {
    const type = normalizeText(
        setup?.setup_type
    );

    const code = normalizeText(
        setup?.fee_item?.item_code
    );

    const name = normalizeText(
        setup?.fee_item?.item_name
    );

    return (
        type === "tuition" ||
        code === "tuition" ||
        isTuitionFee(name)
    );
};


const isOtherSetup = (setup) => {
    const type = normalizeText(
        setup?.setup_type
    );

    const code = normalizeText(
        setup?.fee_item?.item_code
    );

    return (
        type === "other" ||
        code === "other"
    );
};


// ============================================================
// COMPONENT
// ============================================================

function ClassFeeCollection() {
    const navigate = useNavigate();


    // ========================================================
    // STATE
    // ========================================================

    const [profile, setProfile] = useState(null);

    const [school, setSchool] = useState(null);

    const [academicYears, setAcademicYears] = useState([]);

    const [classes, setClasses] = useState([]);

    const [students, setStudents] = useState([]);

    const [feeItems, setFeeItems] = useState([]);

    const [feeTerms, setFeeTerms] = useState([]);

    const [paymentSetups, setPaymentSetups] = useState([]);

    const [charges, setCharges] = useState([]);

    const [financePayments, setFinancePayments] = useState([]);

    const [publicPayments, setPublicPayments] = useState([]);

    const [loading, setLoading] = useState(true);

    const [refreshing, setRefreshing] = useState(false);

    const [error, setError] = useState("");

    const [search, setSearch] = useState("");

    const [selectedYearId, setSelectedYearId] =
        useState("");

    const [selectedClassId, setSelectedClassId] =
        useState("");


    // ========================================================
    // EDIT / CREATE / DELETE STATE
    // ========================================================

    const [editingSetup, setEditingSetup] =
        useState(null);

    const [editForm, setEditForm] = useState({
        fee_item_id: "",
        setup_type: "tuition",
        term_number: "1",
        amount: "",
        due_date: "",
    });

    const [savingEdit, setSavingEdit] =
        useState(false);

    const [deletingSetupId, setDeletingSetupId] =
        useState("");

    const [actionMessage, setActionMessage] =
        useState("");

    const [actionError, setActionError] =
        useState("");


    // ========================================================
    // LOAD PROFILE
    // ========================================================

    const loadProfile = async () => {
        const {
            data: {
                user,
            },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
            throw userError;
        }

        if (!user?.id) {
            throw new Error(
                "Your login session could not be found."
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
            .eq("id", user.id)
            .maybeSingle();

        if (profileError) {
            throw profileError;
        }

        if (!data) {
            throw new Error(
                "Your profile was not found."
            );
        }

        setProfile(data);

        return data;
    };


    // ========================================================
    // LOAD SCHOOL
    // ========================================================

    const loadSchool = async (schoolId) => {
        if (!schoolId) {
            return null;
        }

        const {
            data,
            error: schoolError,
        } = await supabase
            .from("schools")
            .select(`
                id,
                school_name,
                registration_number,
                address,
                phone,
                email,
                logo
            `)
            .eq("id", Number(schoolId))
            .maybeSingle();

        if (schoolError) {
            console.warn(
                "School information could not be loaded:",
                schoolError
            );

            return null;
        }

        setSchool(data || null);

        return data || null;
    };


    // ========================================================
    // LOAD ACADEMIC YEARS
    // ========================================================

    const loadAcademicYears = async (schoolId) => {
        if (!schoolId) {
            setAcademicYears([]);
            return [];
        }

        const {
            data,
            error: yearError,
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
                Number(schoolId)
            )
            .order("start_date", {
                ascending: false,
            });

        if (yearError) {
            throw yearError;
        }

        const rows = Array.isArray(data)
            ? data
            : [];

        setAcademicYears(rows);

        return rows;
    };


    // ========================================================
    // LOAD CLASSES
    // ========================================================

    const loadClasses = async (
        schoolId,
        yearId
    ) => {
        if (
            !schoolId ||
            !yearId
        ) {
            setClasses([]);
            return [];
        }

        const {
            data,
            error: classError,
        } = await supabase
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
                Number(schoolId)
            )
            .eq(
                "academic_year_id",
                Number(yearId)
            )
            .order("class_name", {
                ascending: true,
            });

        if (classError) {
            throw classError;
        }

        const rows = Array.isArray(data)
            ? data
            : [];

        setClasses(rows);

        return rows;
    };


    // ========================================================
    // LOAD FEE ITEMS
    // ========================================================

    const loadFeeItems = async (schoolId) => {
        if (!schoolId) {
            setFeeItems([]);
            return [];
        }

        const {
            data,
            error: feeItemError,
        } = await supabase
            .schema("finance")
            .from("fee_items")
            .select(`
                id,
                school_id,
                item_code,
                item_name,
                description,
                is_mandatory,
                is_active
            `)
            .eq(
                "school_id",
                Number(schoolId)
            )
            .order("item_name", {
                ascending: true,
            });

        if (feeItemError) {
            console.warn(
                "Finance fee items could not be loaded:",
                feeItemError
            );

            setFeeItems([]);

            return [];
        }

        const rows = Array.isArray(data)
            ? data
            : [];

        setFeeItems(rows);

        return rows;
    };


    // ========================================================
    // LOAD STUDENTS
    // ========================================================

    const loadStudents = async (
        schoolId,
        yearId,
        classId
    ) => {
        if (
            !schoolId ||
            !yearId ||
            !classId
        ) {
            setStudents([]);
            return [];
        }

        const {
            data,
            error: studentError,
        } = await supabase
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
                status
            `)
            .eq(
                "school_id",
                Number(schoolId)
            )
            .eq(
                "academic_year_id",
                Number(yearId)
            )
            .eq(
                "current_class_id",
                Number(classId)
            )
            .order("first_name", {
                ascending: true,
            })
            .order("last_name", {
                ascending: true,
            });

        if (studentError) {
            throw studentError;
        }

        const rows = Array.isArray(data)
            ? data
            : [];

        setStudents(rows);

        return rows;
    };


    // ========================================================
    // LOAD LEGACY STUDENT FEE TERMS
    // ========================================================

    const loadFeeTerms = async (
        schoolId,
        yearId,
        classId
    ) => {
        if (
            !schoolId ||
            !yearId ||
            !classId
        ) {
            setFeeTerms([]);
            return [];
        }

        const {
            data,
            error: termsError,
        } = await supabase
            .schema("finance")
            .from("student_fee_terms")
            .select(`
                id,
                school_id,
                student_id,
                academic_year_id,
                class_id,
                fee_structure_id,
                fee_item_id,
                term_number,
                expected_amount,
                paid_amount,
                balance,
                status
            `)
            .eq(
                "school_id",
                Number(schoolId)
            )
            .eq(
                "academic_year_id",
                Number(yearId)
            )
            .eq(
                "class_id",
                Number(classId)
            );

        if (termsError) {
            console.warn(
                "Finance student fee terms could not be loaded:",
                termsError
            );

            setFeeTerms([]);

            return [];
        }

        const rows = Array.isArray(data)
            ? data
            : [];

        setFeeTerms(rows);

        return rows;
    };


    // ========================================================
    // LOAD PAYMENT SETUPS
    // ========================================================

    const loadPaymentSetups = async (
        schoolId,
        yearId,
        classId
    ) => {
        if (
            !schoolId ||
            !yearId ||
            !classId
        ) {
            setPaymentSetups([]);
            return [];
        }

        const {
            data,
            error: setupError,
        } = await supabase
            .schema("finance")
            .from("student_payment_setups")
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
                "academic_year_id",
                Number(yearId)
            )
            .eq(
                "class_id",
                Number(classId)
            )
            .order("student_id", {
                ascending: true,
            })
            .order("term_number", {
                ascending: true,
            });

        if (setupError) {
            console.warn(
                "Student payment setups could not be loaded:",
                setupError
            );

            setPaymentSetups([]);

            return [];
        }

        const rows = Array.isArray(data)
            ? data
            : [];

        setPaymentSetups(rows);

        return rows;
    };


    // ========================================================
    // LOAD FINANCE CHARGES
    // ========================================================

    const loadCharges = async (
        schoolId,
        yearId
    ) => {
        if (
            !schoolId ||
            !yearId
        ) {
            setCharges([]);
            return [];
        }

        const {
            data,
            error: chargesError,
        } = await supabase
            .schema("finance")
            .from("student_charges")
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
                status,
                fee_item_id,
                term_number,
                payment_setup_id,
                due_date,
                invoice_number,
                created_at
            `)
            .eq(
                "school_id",
                Number(schoolId)
            )
            .eq(
                "academic_year_id",
                Number(yearId)
            )
            .order("charge_date", {
                ascending: true,
            });

        if (chargesError) {
            console.warn(
                "Finance student charges could not be loaded:",
                chargesError
            );

            setCharges([]);

            return [];
        }

        const rows = Array.isArray(data)
            ? data
            : [];

        setCharges(rows);

        return rows;
    };


    // ========================================================
    // LOAD FINANCE PAYMENTS
    // ========================================================

    const loadFinancePayments = async (
        schoolId,
        yearId
    ) => {
        if (
            !schoolId ||
            !yearId
        ) {
            setFinancePayments([]);
            return [];
        }

        const {
            data,
            error: paymentError,
        } = await supabase
            .schema("finance")
            .from("student_payments")
            .select(`
                id,
                school_id,
                student_id,
                charge_id,
                payment_date,
                amount,
                payment_method,
                reference_number,
                description,
                status
            `)
            .eq(
                "school_id",
                Number(schoolId)
            )
            .order("payment_date", {
                ascending: true,
            });

        if (paymentError) {
            console.warn(
                "Finance student payments could not be loaded:",
                paymentError
            );

            setFinancePayments([]);

            return [];
        }

        const rows = Array.isArray(data)
            ? data
            : [];

        setFinancePayments(rows);

        return rows;
    };


    // ========================================================
    // LOAD LEGACY / PUBLIC PAYMENTS
    // ========================================================

    const loadPublicPayments = async (
        schoolId
    ) => {
        if (!schoolId) {
            setPublicPayments([]);
            return [];
        }

        const {
            data,
            error: paymentError,
        } = await supabase
            .from("student_fee_payments")
            .select(`
                id,
                school_id,
                student_id,
                payment_number,
                amount,
                payment_date,
                payment_method,
                reference_number,
                description,
                status
            `)
            .eq(
                "school_id",
                Number(schoolId)
            )
            .order("payment_date", {
                ascending: true,
            });

        if (paymentError) {
            console.warn(
                "Public student fee payments could not be loaded:",
                paymentError
            );

            setPublicPayments([]);

            return [];
        }

        const rows = Array.isArray(data)
            ? data
            : [];

        setPublicPayments(rows);

        return rows;
    };


    // ========================================================
    // INITIAL LOAD
    // ========================================================

    useEffect(() => {
        let mounted = true;

        const initialise = async () => {
            try {
                setLoading(true);
                setError("");

                const currentProfile =
                    await loadProfile();

                if (!mounted) {
                    return;
                }

                const schoolId =
                    currentProfile?.school_id;

                await loadSchool(
                    schoolId
                );

                const years =
                    await loadAcademicYears(
                        schoolId
                    );

                await loadFeeItems(
                    schoolId
                );

                const activeYear =
                    years.find(
                        (year) =>
                            year.is_active ===
                            true
                    ) ||
                    years[0];

                if (
                    activeYear?.id
                ) {
                    setSelectedYearId(
                        String(
                            activeYear.id
                        )
                    );

                    await loadClasses(
                        schoolId,
                        activeYear.id
                    );
                }
            } catch (err) {
                console.error(
                    "Class Fee Collection initial load error:",
                    err
                );

                if (mounted) {
                    setError(
                        err?.message ||
                        "Failed to load fee collection data."
                    );
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        initialise();

        return () => {
            mounted = false;
        };
    }, []);


    // ========================================================
    // LOAD CLASSES WHEN YEAR CHANGES
    // ========================================================

    useEffect(() => {
        if (
            !profile?.school_id ||
            !selectedYearId
        ) {
            return;
        }

        const run = async () => {
            try {
                setError("");

                await loadClasses(
                    profile.school_id,
                    selectedYearId
                );

                setSelectedClassId("");

                setStudents([]);
                setFeeTerms([]);
                setPaymentSetups([]);
                setCharges([]);
                setFinancePayments([]);
                setPublicPayments([]);
            } catch (err) {
                console.error(
                    "Load classes error:",
                    err
                );

                setError(
                    err?.message ||
                    "Failed to load classes."
                );
            }
        };

        run();
    }, [
        selectedYearId,
        profile?.school_id,
    ]);


    // ========================================================
    // LOAD CLASS DATA
    // ========================================================

    useEffect(() => {
        if (
            !profile?.school_id ||
            !selectedYearId ||
            !selectedClassId
        ) {
            return;
        }

        const run = async () => {
            try {
                setLoading(true);
                setError("");

                await Promise.all([
                    loadStudents(
                        profile.school_id,
                        selectedYearId,
                        selectedClassId
                    ),

                    loadPaymentSetups(
                        profile.school_id,
                        selectedYearId,
                        selectedClassId
                    ),

                    loadFeeTerms(
                        profile.school_id,
                        selectedYearId,
                        selectedClassId
                    ),

                    loadCharges(
                        profile.school_id,
                        selectedYearId
                    ),

                    loadFinancePayments(
                        profile.school_id,
                        selectedYearId
                    ),

                    loadPublicPayments(
                        profile.school_id
                    ),
                ]);
            } catch (err) {
                console.error(
                    "Load class fee collection error:",
                    err
                );

                setError(
                    err?.message ||
                    "Failed to load class fee collection."
                );
            } finally {
                setLoading(false);
            }
        };

        run();
    }, [
        selectedClassId,
        selectedYearId,
        profile?.school_id,
    ]);


    // ========================================================
    // FEE ITEM LOOKUP
    // ========================================================

    const feeItemMap = useMemo(() => {
        const map = new Map();

        feeItems.forEach(
            (item) => {
                map.set(
                    String(item.id),
                    item
                );
            }
        );

        return map;
    }, [
        feeItems,
    ]);


    // ========================================================
    // PAYMENT LOOKUP BY CHARGE
    // ========================================================

    const financePaymentsByCharge = useMemo(() => {
        const map = new Map();

        financePayments.forEach(
            (payment) => {
                const chargeId =
                    String(
                        payment?.charge_id || ""
                    );

                if (!chargeId) {
                    return;
                }

                const current =
                    numberValue(
                        map.get(chargeId)
                    );

                map.set(
                    chargeId,
                    current +
                    numberValue(
                        payment?.amount
                    )
                );
            }
        );

        return map;
    }, [
        financePayments,
    ]);


    // ========================================================
    // STUDENT PAYMENT PROTECTION
    //
    // IMPORTANT:
    // If a student already has an actual payment recorded
    // through Record Payment, Class Fee Collection must not
    // edit/create/overwrite that student's fee information.
    // ========================================================

    const studentPaymentMap = useMemo(() => {
        const map = new Map();

        const markPaid = (
            studentId
        ) => {
            if (!studentId) {
                return;
            }

            const key =
                String(studentId);

            map.set(
                key,
                true
            );
        };


        // ----------------------------------------------------
        // FINANCE PAYMENTS
        // ----------------------------------------------------

        financePayments.forEach(
            (payment) => {
                const amount =
                    numberValue(
                        payment?.amount
                    );

                if (
                    amount > 0
                ) {
                    markPaid(
                        payment?.student_id
                    );
                }
            }
        );


        // ----------------------------------------------------
        // LEGACY / RECORD PAYMENT PAYMENTS
        // ----------------------------------------------------

        publicPayments.forEach(
            (payment) => {
                const amount =
                    numberValue(
                        payment?.amount
                    );

                if (
                    amount > 0
                ) {
                    markPaid(
                        payment?.student_id
                    );
                }
            }
        );


        // ----------------------------------------------------
        // CHARGES THAT ALREADY CARRY PAID AMOUNT
        // ----------------------------------------------------

        charges.forEach(
            (charge) => {
                const paid =
                    numberValue(
                        charge?.paid_amount
                    );

                if (
                    paid > 0
                ) {
                    markPaid(
                        charge?.student_id
                    );
                }


                const linkedPaid =
                    numberValue(
                        financePaymentsByCharge.get(
                            String(
                                charge?.id
                            )
                        )
                    );

                if (
                    linkedPaid > 0
                ) {
                    markPaid(
                        charge?.student_id
                    );
                }
            }
        );

        return map;
    }, [
        financePayments,
        publicPayments,
        charges,
        financePaymentsByCharge,
    ]);


    const studentHasRecordedPayment = (
        studentId
    ) => {
        return studentPaymentMap.has(
            String(studentId)
        );
    };


    // ========================================================
    // CREATE REPORT ROWS
    // ========================================================

    const reportRows = useMemo(() => {
        return students.map(
            (student, index) => {
                const studentId =
                    Number(student.id);


                const studentSetups =
                    paymentSetups.filter(
                        (setup) =>
                            Number(
                                setup.student_id
                            ) ===
                            studentId
                    );


                const setupData =
                    studentSetups.map(
                        (setup) => {
                            const setupCharges =
                                charges.filter(
                                    (charge) =>
                                        Number(
                                            charge.student_id
                                        ) ===
                                        studentId &&
                                        String(
                                            charge.payment_setup_id || ""
                                        ) ===
                                        String(
                                            setup.id
                                        )
                                );


                            const chargePaid =
                                setupCharges.reduce(
                                    (
                                        total,
                                        charge
                                    ) =>
                                        total +
                                        numberValue(
                                            charge.paid_amount
                                        ),
                                    0
                                );


                            const linkedPaymentPaid =
                                setupCharges.reduce(
                                    (
                                        total,
                                        charge
                                    ) =>
                                        total +
                                        numberValue(
                                            financePaymentsByCharge.get(
                                                String(
                                                    charge.id
                                                )
                                            )
                                        ),
                                    0
                                );


                            const paid =
                                chargePaid > 0
                                    ? chargePaid
                                    : linkedPaymentPaid;


                            const setupAmount =
                                numberValue(
                                    setup.amount
                                );


                            const balance =
                                Math.max(
                                    setupAmount -
                                    paid,
                                    0
                                );


                            const chargeAmount =
                                setupCharges.reduce(
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


                            return {
                                ...setup,

                                fee_item:
                                    feeItemMap.get(
                                        String(
                                            setup.fee_item_id
                                        )
                                    ) ||
                                    null,

                                setupAmount,

                                paid: Math.max(
                                    paid,
                                    0
                                ),

                                balance,

                                chargeAmount,

                                charges:
                                    setupCharges,

                                hasCharge:
                                    setupCharges.length > 0,

                                hasPayment:
                                    setupCharges.some(
                                        (charge) =>
                                            numberValue(
                                                charge.paid_amount
                                            ) > 0 ||
                                            numberValue(
                                                financePaymentsByCharge.get(
                                                    String(
                                                        charge.id
                                                    )
                                                )
                                            ) > 0
                                    ),
                            };
                        }
                    );


                let tuitionTerm1 = 0;
                let tuitionTerm1Paid = 0;

                let tuitionTerm2 = 0;
                let tuitionTerm2Paid = 0;

                let otherFees = 0;
                let otherPaid = 0;


                setupData.forEach(
                    (setup) => {
                        const tuition =
                            isTuitionSetup(
                                setup
                            );

                        const other =
                            isOtherSetup(
                                setup
                            );


                        if (tuition) {
                            if (
                                Number(
                                    setup.term_number
                                ) === 1
                            ) {
                                tuitionTerm1 +=
                                    setup.setupAmount;

                                tuitionTerm1Paid +=
                                    setup.paid;
                            }


                            if (
                                Number(
                                    setup.term_number
                                ) === 2
                            ) {
                                tuitionTerm2 +=
                                    setup.setupAmount;

                                tuitionTerm2Paid +=
                                    setup.paid;
                            }
                        } else if (other) {
                            otherFees +=
                                setup.setupAmount;

                            otherPaid +=
                                setup.paid;
                        }
                    }
                );


                if (
                    setupData.length === 0
                ) {
                    const studentTerms =
                        feeTerms.filter(
                            (item) =>
                                Number(
                                    item.student_id
                                ) ===
                                studentId
                        );


                    let legacyTerm1 = 0;
                    let legacyTerm2 = 0;
                    let legacyOther = 0;


                    studentTerms.forEach(
                        (item) => {
                            const amount =
                                numberValue(
                                    item.expected_amount
                                );


                            const feeItem =
                                feeItemMap.get(
                                    String(
                                        item.fee_item_id
                                    )
                                );


                            const feeName =
                                feeItem?.item_name ||
                                "";


                            if (
                                isTuitionFee(
                                    feeName
                                )
                            ) {
                                if (
                                    Number(
                                        item.term_number
                                    ) === 1
                                ) {
                                    legacyTerm1 +=
                                        amount;
                                }


                                if (
                                    Number(
                                        item.term_number
                                    ) === 2
                                ) {
                                    legacyTerm2 +=
                                        amount;
                                }
                            } else {
                                legacyOther +=
                                    amount;
                            }
                        }
                    );


                    tuitionTerm1 =
                        legacyTerm1;

                    tuitionTerm2 =
                        legacyTerm2;

                    otherFees =
                        legacyOther;


                    const legacyPaidTerm1 =
                        studentTerms
                            .filter(
                                (item) =>
                                    isTuitionFee(
                                        feeItemMap.get(
                                            String(
                                                item.fee_item_id
                                            )
                                        )?.item_name
                                    )
                            )
                            .filter(
                                (item) =>
                                    Number(
                                        item.term_number
                                    ) === 1
                            )
                            .reduce(
                                (
                                    total,
                                    item
                                ) =>
                                    total +
                                    numberValue(
                                        item.paid_amount
                                    ),
                                0
                            );


                    const legacyPaidTerm2 =
                        studentTerms
                            .filter(
                                (item) =>
                                    isTuitionFee(
                                        feeItemMap.get(
                                            String(
                                                item.fee_item_id
                                            )
                                        )?.item_name
                                    )
                            )
                            .filter(
                                (item) =>
                                    Number(
                                        item.term_number
                                    ) === 2
                            )
                            .reduce(
                                (
                                    total,
                                    item
                                ) =>
                                    total +
                                    numberValue(
                                        item.paid_amount
                                    ),
                                0
                            );


                    const legacyOtherPaid =
                        studentTerms
                            .filter(
                                (item) =>
                                    !isTuitionFee(
                                        feeItemMap.get(
                                            String(
                                                item.fee_item_id
                                            )
                                        )?.item_name
                                    )
                            )
                            .reduce(
                                (
                                    total,
                                    item
                                ) =>
                                    total +
                                    numberValue(
                                        item.paid_amount
                                    ),
                                0
                            );


                    tuitionTerm1Paid =
                        legacyPaidTerm1;

                    tuitionTerm2Paid =
                        legacyPaidTerm2;

                    otherPaid =
                        legacyOtherPaid;
                }


                const studentLegacyTerms =
                    feeTerms.filter(
                        (item) =>
                            Number(
                                item.student_id
                            ) === studentId
                    );


                if (
                    setupData.length === 0 &&
                    studentLegacyTerms.length === 0
                ) {
                    const studentCharges =
                        charges.filter(
                            (charge) =>
                                Number(
                                    charge.student_id
                                ) === studentId
                        );


                    studentCharges.forEach(
                        (charge) => {
                            const amount =
                                numberValue(
                                    charge.amount
                                );


                            const paid =
                                numberValue(
                                    charge.paid_amount
                                );


                            const feeItem =
                                feeItemMap.get(
                                    String(
                                        charge.fee_item_id
                                    )
                                );


                            const feeName =
                                feeItem?.item_name ||
                                charge.description ||
                                "";


                            if (
                                isTuitionFee(
                                    feeName
                                )
                            ) {
                                if (
                                    Number(
                                        charge.term_number
                                    ) === 1
                                ) {
                                    tuitionTerm1 +=
                                        amount;

                                    tuitionTerm1Paid +=
                                        paid;
                                }


                                if (
                                    Number(
                                        charge.term_number
                                    ) === 2
                                ) {
                                    tuitionTerm2 +=
                                        amount;

                                    tuitionTerm2Paid +=
                                        paid;
                                }
                            } else {
                                otherFees +=
                                    amount;

                                otherPaid +=
                                    paid;
                            }
                        }
                    );
                }


                const totalRequired =
                    tuitionTerm1 +
                    tuitionTerm2 +
                    otherFees;


                const totalPaid =
                    tuitionTerm1Paid +
                    tuitionTerm2Paid +
                    otherPaid;


                const term1Balance =
                    Math.max(
                        tuitionTerm1 -
                        tuitionTerm1Paid,
                        0
                    );


                const term2Balance =
                    Math.max(
                        tuitionTerm2 -
                        tuitionTerm2Paid,
                        0
                    );


                const otherBalance =
                    Math.max(
                        otherFees -
                        otherPaid,
                        0
                    );


                const totalBalance =
                    Math.max(
                        totalRequired -
                        totalPaid,
                        0
                    );


                const paidPercentage =
                    totalRequired > 0
                        ? Math.min(
                            (
                                totalPaid /
                                totalRequired
                            ) *
                                100,
                            100
                        )
                        : 0;


                let status =
                    "No Setup";


                if (
                    totalRequired <= 0
                ) {
                    status =
                        "No Setup";
                } else if (
                    totalPaid <= 0
                ) {
                    status =
                        "Not Paid";
                } else if (
                    totalBalance <= 0
                ) {
                    status =
                        "Paid";
                } else {
                    status =
                        "Partial";
                }


                return {
                    no:
                        index + 1,

                    id:
                        student.id,

                    name:
                        studentName(
                            student
                        ) ||
                        "Unnamed Student",

                    admission:
                        student.admission_number ||
                        student.admission_no ||
                        "-",

                    setupData,

                    tuitionTerm1,

                    tuitionTerm1Paid,

                    term1Balance,

                    tuitionTerm2,

                    tuitionTerm2Paid,

                    term2Balance,

                    otherFees,

                    otherPaid,

                    otherBalance,

                    totalRequired,

                    totalPaid,

                    totalBalance,

                    paidPercentage,

                    status,

                    hasRecordedPayment:
                        studentHasRecordedPayment(
                            student.id
                        ),

                    canCreateSetup:
                        !studentHasRecordedPayment(
                            student.id
                        ) &&
                        setupData.length === 0,
                };
            }
        );
    }, [
        students,
        paymentSetups,
        feeTerms,
        charges,
        financePaymentsByCharge,
        feeItemMap,
        studentPaymentMap,
    ]);


    // ========================================================
    // SEARCH
    // ========================================================

    const filteredRows = useMemo(() => {
        const query =
            normalizeText(search);

        if (!query) {
            return reportRows;
        }

        return reportRows.filter(
            (row) =>
                normalizeText(
                    row.name
                ).includes(query) ||
                normalizeText(
                    row.admission
                ).includes(query)
        );
    }, [
        reportRows,
        search,
    ]);


    // ========================================================
    // SUMMARY
    // ========================================================

    const summary = useMemo(() => {
        return filteredRows.reduce(
            (
                total,
                row
            ) => {
                total.students += 1;

                total.tuitionTerm1 +=
                    numberValue(
                        row.tuitionTerm1
                    );

                total.tuitionTerm1Paid +=
                    numberValue(
                        row.tuitionTerm1Paid
                    );

                total.term1Balance +=
                    numberValue(
                        row.term1Balance
                    );

                total.tuitionTerm2 +=
                    numberValue(
                        row.tuitionTerm2
                    );

                total.tuitionTerm2Paid +=
                    numberValue(
                        row.tuitionTerm2Paid
                    );

                total.term2Balance +=
                    numberValue(
                        row.term2Balance
                    );

                total.otherFees +=
                    numberValue(
                        row.otherFees
                    );

                total.otherPaid +=
                    numberValue(
                        row.otherPaid
                    );

                total.otherBalance +=
                    numberValue(
                        row.otherBalance
                    );

                total.required +=
                    numberValue(
                        row.totalRequired
                    );

                total.paid +=
                    numberValue(
                        row.totalPaid
                    );

                total.balance +=
                    numberValue(
                        row.totalBalance
                    );

                return total;
            },
            {
                students: 0,

                tuitionTerm1: 0,

                tuitionTerm1Paid: 0,

                term1Balance: 0,

                tuitionTerm2: 0,

                tuitionTerm2Paid: 0,

                term2Balance: 0,

                otherFees: 0,

                otherPaid: 0,

                otherBalance: 0,

                required: 0,

                paid: 0,

                balance: 0,
            }
        );
    }, [
        filteredRows,
    ]);


    const collectionRate =
        summary.required > 0
            ? Math.min(
                (
                    summary.paid /
                    summary.required
                ) *
                    100,
                100
            )
            : 0;


    // ========================================================
    // SELECTED YEAR / CLASS
    // ========================================================

    const selectedYear =
        academicYears.find(
            (year) =>
                String(year.id) ===
                String(selectedYearId)
        );


    const selectedClass =
        classes.find(
            (item) =>
                String(item.id) ===
                String(selectedClassId)
        );


    // ========================================================
    // OPEN CREATE SETUP FOR EMPTY STUDENT
    // ========================================================

    const openCreateSetup = (
        row
    ) => {
        setActionError("");
        setActionMessage("");

        if (!row?.id) {
            return;
        }

        if (
            studentHasRecordedPayment(
                row.id
            )
        ) {
            setActionError(
                `${row.name || "This student"} already has a payment recorded through Record Payment. Class Fee Collection cannot modify this student's payment information.`
            );

            return;
        }

        const defaultFeeItem =
            feeItems.find(
                (item) =>
                    isTuitionFee(
                        item?.item_name
                    ) ||
                    normalizeText(
                        item?.item_code
                    ) === "tuition"
            );


        setEditingSetup({
            mode: "create",

            id: null,

            student_id:
                row.id,

            studentName:
                row.name ||
                "Student",

            admission:
                row.admission ||
                "-",

            hasPayment:
                false,

            hasCharge:
                false,
        });


        setEditForm({
            fee_item_id:
                defaultFeeItem?.id
                    ? String(
                        defaultFeeItem.id
                    )
                    : "",

            setup_type:
                "tuition",

            term_number:
                "1",

            amount:
                "",

            due_date:
                "",
        });
    };


    // ========================================================
    // OPEN EDIT
    // ========================================================

    const openEditSetup = (
        setup,
        row
    ) => {
        setActionError("");
        setActionMessage("");

        if (
            studentHasRecordedPayment(
                row?.id
            )
        ) {
            setActionError(
                `${row?.name || "This student"} already has a payment recorded through Record Payment. Class Fee Collection cannot edit this student's payment information.`
            );

            return;
        }

        const relatedCharges =
            charges.filter(
                (charge) =>
                    String(
                        charge.payment_setup_id || ""
                    ) ===
                    String(setup.id)
            );

        const hasPayment =
            relatedCharges.some(
                (charge) =>
                    numberValue(
                        charge.paid_amount
                    ) > 0 ||
                    numberValue(
                        financePaymentsByCharge.get(
                            String(
                                charge.id
                            )
                        )
                    ) > 0
            );


        if (
            hasPayment
        ) {
            setActionError(
                "This fee setup already has a payment. Its accounting information is protected and cannot be edited from Class Fee Collection."
            );

            return;
        }


        setEditingSetup({
            ...setup,

            mode:
                "edit",

            studentName:
                row?.name ||
                "Student",

            admission:
                row?.admission ||
                "-",

            relatedCharges,

            hasPayment,
        });


        setEditForm({
            fee_item_id:
                setup?.fee_item_id
                    ? String(
                        setup.fee_item_id
                    )
                    : "",

            setup_type:
                setup?.setup_type ||
                "tuition",

            term_number:
                setup?.term_number
                    ? String(
                        setup.term_number
                    )
                    : "1",

            amount:
                setup?.amount === null ||
                setup?.amount === undefined
                    ? ""
                    : String(
                        setup.amount
                    ),

            due_date:
                setup?.due_date ||
                "",
        });
    };


    // ========================================================
    // CLOSE EDIT
    // ========================================================

    const closeEditSetup = () => {
        if (savingEdit) {
            return;
        }

        setEditingSetup(null);

        setEditForm({
            fee_item_id: "",
            setup_type: "tuition",
            term_number: "1",
            amount: "",
            due_date: "",
        });

        setActionError("");
    };


    // ========================================================
    // SAVE EDIT / CREATE
    // ========================================================

    const saveEditSetup = async () => {
        if (
            !editingSetup
        ) {
            return;
        }


        const amount =
            numberValue(
                editForm.amount
            );


        if (
            !editForm.fee_item_id
        ) {
            setActionError(
                "Please select a fee item."
            );

            return;
        }


        if (
            amount <= 0
        ) {
            setActionError(
                "Please enter a valid amount greater than zero."
            );

            return;
        }


        if (
            !profile?.school_id ||
            !selectedYearId ||
            !selectedClassId
        ) {
            setActionError(
                "School, academic year or class information is missing."
            );

            return;
        }


        const studentId =
            Number(
                editingSetup.student_id
            );


        // ----------------------------------------------------
        // FINAL PAYMENT PROTECTION BEFORE SAVE
        // ----------------------------------------------------

        if (
            studentHasRecordedPayment(
                studentId
            )
        ) {
            setActionError(
                "This student already has a recorded payment. The payment record is protected and cannot be changed from Class Fee Collection."
            );

            return;
        }


        try {
            setSavingEdit(true);
            setActionError("");
            setActionMessage("");


            // =================================================
            // CREATE NEW EMPTY SETUP
            // =================================================

            if (
                editingSetup.mode ===
                "create"
            ) {
                const {
                    data: existingSetups,
                    error: existingSetupError,
                } = await supabase
                    .schema("finance")
                    .from("student_payment_setups")
                    .select(`
                        id,
                        student_id,
                        fee_item_id,
                        setup_type,
                        term_number
                    `)
                    .eq(
                        "school_id",
                        Number(
                            profile.school_id
                        )
                    )
                    .eq(
                        "academic_year_id",
                        Number(
                            selectedYearId
                        )
                    )
                    .eq(
                        "class_id",
                        Number(
                            selectedClassId
                        )
                    )
                    .eq(
                        "student_id",
                        studentId
                    )
                    .eq(
                        "fee_item_id",
                        Number(
                            editForm.fee_item_id
                        )
                    )
                    .eq(
                        "term_number",
                        Number(
                            editForm.term_number
                        ));


                if (
                    existingSetupError
                ) {
                    throw existingSetupError;
                }


                if (
                    Array.isArray(
                        existingSetups
                    ) &&
                    existingSetups.length > 0
                ) {
                    setActionError(
                        "A fee setup for this student, fee item and term already exists. Please edit the existing setup instead."
                    );

                    return;
                }


                const {
                    data: createdSetup,
                    error: createError,
                } = await supabase
                    .schema("finance")
                    .from("student_payment_setups")
                    .insert({
                        school_id:
                            Number(
                                profile.school_id
                            ),

                        student_id:
                            studentId,

                        academic_year_id:
                            Number(
                                selectedYearId
                            ),

                        class_id:
                            Number(
                                selectedClassId
                            ),

                        fee_item_id:
                            Number(
                                editForm.fee_item_id
                            ),

                        setup_type:
                            editForm.setup_type ||
                            "tuition",

                        term_number:
                            Number(
                                editForm.term_number
                            ),

                        amount,

                        due_date:
                            editForm.due_date ||
                            null,

                        status:
                            "active",

                        created_by:
                            profile.id,

                        created_at:
                            new Date().toISOString(),

                        updated_at:
                            new Date().toISOString(),
                    })
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
                    .single();


                if (
                    createError
                ) {
                    throw createError;
                }


                // ------------------------------------------------
                // CREATE INITIAL UNPAID CHARGE
                //
                // IMPORTANT:
                // This charge contains no payment. Therefore it
                // remains editable later.
                // ------------------------------------------------

                const {
                    error: chargeCreateError,
                } = await supabase
                    .schema("finance")
                    .from("student_charges")
                    .insert({
                        school_id:
                            Number(
                                profile.school_id
                            ),

                        student_id:
                            studentId,

                        charge_date:
                            new Date().toISOString(),

                        academic_year_id:
                            Number(
                                selectedYearId
                            ),

                        description:
                            feeItemMap.get(
                                String(
                                    editForm.fee_item_id
                                )
                            )?.item_name ||
                            "Student Fee",

                        amount,

                        paid_amount:
                            0,

                        balance:
                            amount,

                        status:
                            "pending",

                        fee_item_id:
                            Number(
                                editForm.fee_item_id
                            ),

                        term_number:
                            Number(
                                editForm.term_number
                            ),

                        payment_setup_id:
                            createdSetup?.id ||
                            null,

                        due_date:
                            editForm.due_date ||
                            null,
                    });


                if (
                    chargeCreateError
                ) {
                    // The setup has already been saved.
                    // Do not delete it automatically because the
                    // setup itself is valid and can be synchronized.
                    console.warn(
                        "Fee setup saved but initial charge could not be created:",
                        chargeCreateError
                    );
                }


                await Promise.all([
                    loadPaymentSetups(
                        profile.school_id,
                        selectedYearId,
                        selectedClassId
                    ),

                    loadCharges(
                        profile.school_id,
                        selectedYearId
                    ),
                ]);


                setActionMessage(
                    "Student fee information was saved successfully."
                );


                setEditingSetup(null);


                setEditForm({
                    fee_item_id: "",
                    setup_type: "tuition",
                    term_number: "1",
                    amount: "",
                    due_date: "",
                });


                return;
            }


            // =================================================
            // UPDATE EXISTING SETUP
            // =================================================

            if (
                !editingSetup?.id
            ) {
                setActionError(
                    "The fee setup record could not be identified."
                );

                return;
            }


            const {
                error: updateError,
            } = await supabase
                .schema("finance")
                .from("student_payment_setups")
                .update({
                    fee_item_id:
                        Number(
                            editForm.fee_item_id
                        ),

                    setup_type:
                        editForm.setup_type ||
                        "tuition",

                    term_number:
                        Number(
                            editForm.term_number
                        ),

                    amount,

                    due_date:
                        editForm.due_date ||
                        null,

                    updated_at:
                        new Date().toISOString(),
                })
                .eq(
                    "id",
                    editingSetup.id
                )
                .eq(
                    "school_id",
                    Number(
                        profile?.school_id
                    )
                );


            if (
                updateError
            ) {
                throw updateError;
            }


            /*
             * Keep existing unpaid charge synchronized
             * with the edited setup.
             *
             * We DO NOT alter a charge that has already
             * received money.
             */

            const relatedCharges =
                charges.filter(
                    (charge) =>
                        String(
                            charge.payment_setup_id || ""
                        ) ===
                        String(
                            editingSetup.id
                        )
                );


            for (
                const charge
                of relatedCharges
            ) {
                const chargePaid =
                    numberValue(
                        charge.paid_amount
                    );


                const linkedPaid =
                    numberValue(
                        financePaymentsByCharge.get(
                            String(
                                charge.id
                            )
                        )
                    );


                if (
                    chargePaid > 0 ||
                    linkedPaid > 0
                ) {
                    continue;
                }


                const {
                    error: chargeUpdateError,
                } = await supabase
                    .schema("finance")
                    .from("student_charges")
                    .update({
                        amount,

                        balance:
                            amount,

                        fee_item_id:
                            Number(
                                editForm.fee_item_id
                            ),

                        term_number:
                            Number(
                                editForm.term_number
                            ),

                        due_date:
                            editForm.due_date ||
                            null,
                    })
                    .eq(
                        "id",
                        charge.id
                    )
                    .eq(
                        "school_id",
                        Number(
                            profile?.school_id
                        )
                    );


                if (
                    chargeUpdateError
                ) {
                    console.warn(
                        "Setup saved but related unpaid charge could not be synchronized:",
                        chargeUpdateError
                    );
                }
            }


            await Promise.all([
                loadPaymentSetups(
                    profile.school_id,
                    selectedYearId,
                    selectedClassId
                ),

                loadCharges(
                    profile.school_id,
                    selectedYearId
                ),
            ]);


            setActionMessage(
                "Fee setup updated successfully."
            );


            setEditingSetup(null);


            setEditForm({
                fee_item_id: "",
                setup_type: "tuition",
                term_number: "1",
                amount: "",
                due_date: "",
            });


        } catch (err) {
            console.error(
                "Save fee setup error:",
                err
            );

            setActionError(
                err?.message ||
                "Failed to save fee setup."
            );
        } finally {
            setSavingEdit(false);
        }
    };


    // ========================================================
    // DELETE SETUP
    // ========================================================

    const deleteSetup = async (
        setup,
        row
    ) => {
        if (!setup?.id) {
            return;
        }


        if (
            studentHasRecordedPayment(
                row?.id
            )
        ) {
            setActionError(
                `${row?.name || "This student"} already has a recorded payment. The payment record is protected.`
            );

            return;
        }


        const relatedCharges =
            charges.filter(
                (charge) =>
                    String(
                        charge.payment_setup_id || ""
                    ) ===
                    String(setup.id)
            );


        if (
            relatedCharges.length > 0
        ) {
            setActionError(
                `Cannot delete ${setup?.fee_item?.item_name || "this fee setup"} for ${row?.name || "this student"} because it is already linked to a finance charge.`
            );

            return;
        }


        const confirmed =
            window.confirm(
                `Delete this fee setup?\n\nStudent: ${row?.name || "-"}\nFee: ${setup?.fee_item?.item_name || setup?.setup_type || "-"}\nAmount: ${money(setup.amount)}\n\nThis action cannot be undone.`
            );


        if (!confirmed) {
            return;
        }


        try {
            setDeletingSetupId(
                String(setup.id)
            );

            setActionError("");
            setActionMessage("");


            const {
                error: deleteError,
            } = await supabase
                .schema("finance")
                .from("student_payment_setups")
                .delete()
                .eq(
                    "id",
                    setup.id
                )
                .eq(
                    "school_id",
                    Number(
                        profile?.school_id
                    )
                );


            if (
                deleteError
            ) {
                throw deleteError;
            }


            await loadPaymentSetups(
                profile.school_id,
                selectedYearId,
                selectedClassId
            );


            setActionMessage(
                "Fee setup deleted successfully."
            );


        } catch (err) {
            console.error(
                "Delete fee setup error:",
                err
            );

            setActionError(
                err?.message ||
                "Failed to delete fee setup."
            );
        } finally {
            setDeletingSetupId("");
        }
    };


    // ========================================================
    // REFRESH
    // ========================================================

    const refreshReport = async () => {
        if (
            !profile?.school_id ||
            !selectedYearId ||
            !selectedClassId
        ) {
            return;
        }


        try {
            setRefreshing(true);
            setError("");
            setActionError("");
            setActionMessage("");


            await Promise.all([
                loadStudents(
                    profile.school_id,
                    selectedYearId,
                    selectedClassId
                ),

                loadPaymentSetups(
                    profile.school_id,
                    selectedYearId,
                    selectedClassId
                ),

                loadFeeTerms(
                    profile.school_id,
                    selectedYearId,
                    selectedClassId
                ),

                loadCharges(
                    profile.school_id,
                    selectedYearId
                ),

                loadFinancePayments(
                    profile.school_id,
                    selectedYearId
                ),

                loadPublicPayments(
                    profile.school_id
                ),
            ]);
        } catch (err) {
            console.error(
                "Refresh fee report error:",
                err
            );

            setError(
                err?.message ||
                "Failed to refresh the report."
            );
        } finally {
            setRefreshing(false);
        }
    };


    // ========================================================
    // PRINT
    // ========================================================

    const printReport = () => {
        window.print();
    };


    // ========================================================
    // EXPORT CSV
    // ========================================================

    const exportExcel = () => {
        if (!filteredRows.length) {
            return;
        }


        const escapeCsv = (value) => {
            const text =
                String(
                    value ?? ""
                );

            return `"${text.replace(
                /"/g,
                '""'
            )}"`;
        };


        const headers = [
            "No",
            "Student Name",
            "Admission Number",

            "Term 1 Tuition",
            "Term 1 Paid",
            "Term 1 Balance",

            "Term 2 Tuition",
            "Term 2 Paid",
            "Term 2 Balance",

            "Other Fees",
            "Other Paid",
            "Other Balance",

            "Total Fee",
            "Total Paid",
            "Total Balance",

            "% Paid",
            "Status",
        ];


        const lines = [
            headers
                .map(escapeCsv)
                .join(","),
        ];


        filteredRows.forEach(
            (row) => {
                lines.push(
                    [
                        row.no,
                        row.name,
                        row.admission,
                        row.tuitionTerm1,
                        row.tuitionTerm1Paid,
                        row.term1Balance,
                        row.tuitionTerm2,
                        row.tuitionTerm2Paid,
                        row.term2Balance,
                        row.otherFees,
                        row.otherPaid,
                        row.otherBalance,
                        row.totalRequired,
                        row.totalPaid,
                        row.totalBalance,
                        row.paidPercentage.toFixed(
                            2
                        ),
                        row.status,
                    ]
                        .map(
                            escapeCsv
                        )
                        .join(",")
                );
            }
        );


        lines.push("");


        lines.push(
            [
                "",
                "CLASS TOTAL",
                "",
                summary.tuitionTerm1,
                summary.tuitionTerm1Paid,
                summary.term1Balance,
                summary.tuitionTerm2,
                summary.tuitionTerm2Paid,
                summary.term2Balance,
                summary.otherFees,
                summary.otherPaid,
                summary.otherBalance,
                summary.required,
                summary.paid,
                summary.balance,
                collectionRate.toFixed(
                    2
                ),
                "",
            ]
                .map(escapeCsv)
                .join(",")
        );


        const blob =
            new Blob(
                [
                    "\uFEFF" +
                        lines.join(
                            "\n"
                        ),
                ],
                {
                    type:
                        "text/csv;charset=utf-8;",
                }
            );


        const url =
            URL.createObjectURL(
                blob
            );


        const link =
            document.createElement(
                "a"
            );


        link.href = url;


        link.download =
            `Fee_Collection_${selectedClass?.class_name || "Class"}_${selectedYear?.year_name || "Year"}.csv`;


        document.body.appendChild(
            link
        );


        link.click();


        document.body.removeChild(
            link
        );


        URL.revokeObjectURL(
            url
        );
    };


    // ========================================================
    // STATUS UI
    // ========================================================

    const statusClass = (status) => {
        switch (status) {
            case "Paid":
                return "bg-green-100 text-green-700";

            case "Partial":
                return "bg-yellow-100 text-yellow-700";

            case "Not Paid":
                return "bg-red-100 text-red-700";

            default:
                return "bg-slate-100 text-slate-600";
        }
    };


    // ========================================================
    // SETUP LABEL
    // ========================================================

    const setupLabel = (setup) => {
        if (
            isTuitionSetup(setup)
        ) {
            if (
                Number(
                    setup.term_number
                ) === 1
            ) {
                return "Tuition T1";
            }

            if (
                Number(
                    setup.term_number
                ) === 2
            ) {
                return "Tuition T2";
            }

            return "Tuition";
        }

        return (
            setup?.fee_item?.item_name ||
            "Other Fee"
        );
    };


    // ========================================================
    // LOADING
    // ========================================================

    if (
        loading &&
        !profile
    ) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex items-center gap-3 text-slate-600 font-semibold">
                    <FaSpinner className="animate-spin" />
                    Loading fee collection...
                </div>
            </div>
        );
    }


    // ========================================================
    // RENDER
    // ========================================================

    return (
        <>
            <div
                id="class-fee-print-area"
                className="min-h-screen bg-slate-50 p-4 md:p-6 print:bg-white print:p-0"
            >

                {/* HEADER */}

                <div className="print:hidden flex flex-wrap items-center justify-between gap-4 mb-6">

                    <div className="flex items-center gap-3">

                        <button
                            type="button"
                            onClick={() =>
                                navigate(
                                    "/finance/dashboard"
                                )
                            }
                            className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-600 hover:bg-slate-100"
                        >
                            <FaArrowLeft />
                        </button>


                        <div>

                            <h1 className="text-2xl font-bold text-slate-800">
                                Class Fee Collection
                            </h1>

                            <p className="text-sm text-slate-500">
                                Student fee setup, payments and collection statement
                            </p>

                        </div>

                    </div>


                    <div className="flex flex-wrap gap-2">

                        <button
                            type="button"
                            onClick={
                                refreshReport
                            }
                            disabled={
                                refreshing ||
                                !selectedClassId
                            }
                            className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold flex items-center gap-2 hover:bg-slate-100 disabled:opacity-50"
                        >
                            <FaRedo
                                className={
                                    refreshing
                                        ? "animate-spin"
                                        : ""
                                }
                            />

                            Refresh
                        </button>


                        <button
                            type="button"
                            onClick={
                                exportExcel
                            }
                            disabled={
                                !filteredRows.length
                            }
                            className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold flex items-center gap-2 hover:bg-emerald-700 disabled:opacity-50"
                        >
                            <FaFileExcel />

                            Export Excel
                        </button>


                        <button
                            type="button"
                            onClick={
                                printReport
                            }
                            disabled={
                                !filteredRows.length
                            }
                            className="px-4 py-2.5 rounded-xl bg-blue-600 text-white font-semibold flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
                        >
                            <FaPrint />

                            Print Report
                        </button>

                    </div>

                </div>


                {/* PRINT HEADER */}

                <div className="hidden print:block mb-5">

                    <div className="text-center">

                        {school?.logo && (
                            <img
                                src={
                                    school.logo
                                }
                                alt="School Logo"
                                className="mx-auto h-16 object-contain mb-2"
                            />
                        )}


                        <h1 className="text-xl font-bold uppercase">
                            {school?.school_name ||
                                "School"}
                        </h1>


                        {school?.registration_number && (
                            <p className="text-xs">
                                Registration No:
                                {" "}
                                {
                                    school.registration_number
                                }
                            </p>
                        )}


                        <p className="text-xs">
                            {school?.address ||
                                ""}
                        </p>


                        <p className="text-xs">
                            {school?.phone ||
                                ""}

                            {school?.email
                                ? ` | ${school.email}`
                                : ""}
                        </p>


                        <div className="mt-3 border-t border-b border-slate-800 py-2">

                            <h2 className="font-bold text-base uppercase">
                                Student Fee Collection Statement
                            </h2>


                            <p className="text-xs mt-1">

                                Academic Year:
                                {" "}
                                {
                                    selectedYear?.year_name ||
                                    "-"
                                }

                                {"  |  "}

                                Class:
                                {" "}
                                {
                                    selectedClass?.class_name ||
                                    "-"
                                }

                            </p>

                        </div>

                    </div>

                </div>


                {/* FILTERS */}

                <div className="print:hidden bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-5">

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                        <div>

                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                                Academic Year
                            </label>


                            <div className="relative">

                                <FaCalendarAlt className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />


                                <select
                                    value={
                                        selectedYearId
                                    }
                                    onChange={(event) =>
                                        setSelectedYearId(
                                            event
                                                .target
                                                .value
                                        )
                                    }
                                    className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                >

                                    <option value="">
                                        Select Academic Year
                                    </option>


                                    {academicYears.map(
                                        (
                                            year
                                        ) => (
                                            <option
                                                key={
                                                    year.id
                                                }
                                                value={
                                                    year.id
                                                }
                                            >
                                                {
                                                    year.year_name
                                                }

                                                {year.is_active
                                                    ? " — Active"
                                                    : ""}
                                            </option>
                                        )
                                    )}

                                </select>

                            </div>

                        </div>


                        <div>

                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                                Class
                            </label>


                            <div className="relative">

                                <FaUsers className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />


                                <select
                                    value={
                                        selectedClassId
                                    }
                                    onChange={(event) =>
                                        setSelectedClassId(
                                            event
                                                .target
                                                .value
                                        )
                                    }
                                    disabled={
                                        !selectedYearId
                                    }
                                    className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                                >

                                    <option value="">
                                        Select Class
                                    </option>


                                    {classes.map(
                                        (
                                            item
                                        ) => (
                                            <option
                                                key={
                                                    item.id
                                                }
                                                value={
                                                    item.id
                                                }
                                            >
                                                {
                                                    item.class_name
                                                }

                                                {item.short_name
                                                    ? ` (${item.short_name})`
                                                    : ""}
                                            </option>
                                        )
                                    )}

                                </select>

                            </div>

                        </div>


                        <div>

                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                                Search Student
                            </label>


                            <div className="relative">

                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />


                                <input
                                    type="text"
                                    value={
                                        search
                                    }
                                    onChange={(event) =>
                                        setSearch(
                                            event
                                                .target
                                                .value
                                        )
                                    }
                                    placeholder="Name or admission number..."
                                    disabled={
                                        !selectedClassId
                                    }
                                    className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                                />

                            </div>

                        </div>

                    </div>

                </div>


                {/* ACTION SUCCESS */}

                {actionMessage && (
                    <div className="print:hidden mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 flex items-center gap-2">

                        <span className="font-semibold">
                            {actionMessage}
                        </span>

                        <button
                            type="button"
                            onClick={() =>
                                setActionMessage("")
                            }
                            className="ml-auto"
                        >
                            <FaTimes />
                        </button>

                    </div>
                )}


                {/* ACTION ERROR */}

                {actionError && (
                    <div className="print:hidden mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 flex items-center gap-2">

                        <FaExclamationTriangle />

                        <span className="font-semibold">
                            {actionError}
                        </span>

                        <button
                            type="button"
                            onClick={() =>
                                setActionError("")
                            }
                            className="ml-auto"
                        >
                            <FaTimes />
                        </button>

                    </div>
                )}


                {/* GENERAL ERROR */}

                {error && (
                    <div className="print:hidden mb-5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">

                        <div className="font-semibold">
                            Unable to load fee report
                        </div>

                        <div className="text-sm mt-1">
                            {error}
                        </div>

                    </div>
                )}


                {/* REPORT TITLE */}

                {selectedClassId && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4">

                        <div className="flex flex-wrap items-center justify-between gap-4">

                            <div>

                                <h2 className="text-lg font-bold text-slate-800">
                                    {
                                        selectedClass?.class_name ||
                                        "Selected Class"
                                    }
                                </h2>


                                <p className="text-sm text-slate-500">

                                    Academic Year:
                                    {" "}
                                    {
                                        selectedYear?.year_name ||
                                        "-"
                                    }

                                </p>

                            </div>


                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">

                                <FaWallet />

                                {
                                    filteredRows.length
                                }
                                {" "}
                                Students

                            </div>

                        </div>

                    </div>
                )}


                {/* EMPTY STATE */}

                {!selectedClassId && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-20 text-center">

                        <FaUsers className="mx-auto text-5xl text-slate-300 mb-4" />

                        <h2 className="text-lg font-bold text-slate-700">
                            Select a class
                        </h2>

                        <p className="text-sm text-slate-500 mt-1">
                            Select Academic Year and Class to view the fee collection statement.
                        </p>

                    </div>
                )}


                {/* REPORT TABLE */}

                {selectedClassId && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                        <div className="overflow-x-auto">

                            <table className="min-w-[2250px] w-full border-collapse text-sm">

                                <thead>

                                    <tr className="bg-slate-900 text-white">

                                        <th
                                            rowSpan="2"
                                            className="border border-slate-700 px-3 py-3 text-center sticky left-0 bg-slate-900 z-20"
                                        >
                                            #
                                        </th>


                                        <th
                                            rowSpan="2"
                                            className="border border-slate-700 px-4 py-3 text-left sticky left-[45px] bg-slate-900 z-20 min-w-[230px]"
                                        >
                                            Student Name
                                        </th>


                                        <th
                                            rowSpan="2"
                                            className="border border-slate-700 px-4 py-3 text-left min-w-[140px]"
                                        >
                                            Admission No.
                                        </th>


                                        <th
                                            colSpan="3"
                                            className="border border-slate-700 px-4 py-3 text-center bg-blue-900"
                                        >
                                            TUITION — TERM 1
                                        </th>


                                        <th
                                            colSpan="3"
                                            className="border border-slate-700 px-4 py-3 text-center bg-indigo-900"
                                        >
                                            TUITION — TERM 2
                                        </th>


                                        <th
                                            colSpan="3"
                                            className="border border-slate-700 px-4 py-3 text-center bg-purple-900"
                                        >
                                            OTHER FEES
                                        </th>


                                        <th
                                            colSpan="4"
                                            className="border border-slate-700 px-4 py-3 text-center bg-slate-800"
                                        >
                                            COLLECTION SUMMARY
                                        </th>


                                        <th
                                            rowSpan="2"
                                            className="border border-slate-700 px-4 py-3 text-center bg-slate-800 min-w-[120px]"
                                        >
                                            Status
                                        </th>


                                        <th
                                            rowSpan="2"
                                            className="border border-slate-700 px-4 py-3 text-center bg-slate-700 min-w-[260px] print:hidden"
                                        >
                                            Actions
                                        </th>

                                    </tr>


                                    <tr className="bg-slate-800 text-white">

                                        <th className="border border-slate-600 px-3 py-2 text-right">
                                            Fee
                                        </th>

                                        <th className="border border-slate-600 px-3 py-2 text-right">
                                            Paid
                                        </th>

                                        <th className="border border-slate-600 px-3 py-2 text-right">
                                            Balance
                                        </th>


                                        <th className="border border-slate-600 px-3 py-2 text-right">
                                            Fee
                                        </th>

                                        <th className="border border-slate-600 px-3 py-2 text-right">
                                            Paid
                                        </th>

                                        <th className="border border-slate-600 px-3 py-2 text-right">
                                            Balance
                                        </th>


                                        <th className="border border-slate-600 px-3 py-2 text-right">
                                            Fee
                                        </th>

                                        <th className="border border-slate-600 px-3 py-2 text-right">
                                            Paid
                                        </th>

                                        <th className="border border-slate-600 px-3 py-2 text-right">
                                            Balance
                                        </th>


                                        <th className="border border-slate-600 px-3 py-2 text-right">
                                            Total Fee
                                        </th>

                                        <th className="border border-slate-600 px-3 py-2 text-right">
                                            Total Paid
                                        </th>

                                        <th className="border border-slate-600 px-3 py-2 text-right">
                                            Total Balance
                                        </th>

                                        <th className="border border-slate-600 px-3 py-2 text-center">
                                            Paid %
                                        </th>

                                    </tr>

                                </thead>


                                <tbody>

                                    {filteredRows.length === 0 && (
                                        <tr>

                                            <td
                                                colSpan="18"
                                                className="px-6 py-16 text-center text-slate-500"
                                            >

                                                {loading ? (
                                                    <div className="flex items-center justify-center gap-2">

                                                        <FaSpinner className="animate-spin" />

                                                        Loading students...

                                                    </div>
                                                ) : (
                                                    <>
                                                        No students found for this class.
                                                    </>
                                                )}

                                            </td>

                                        </tr>
                                    )}


                                    {filteredRows.map(
                                        (row) => (
                                            <tr
                                                key={
                                                    row.id
                                                }
                                                className="hover:bg-blue-50"
                                            >

                                                <td className="border border-slate-200 px-3 py-3 text-center font-semibold sticky left-0 bg-white z-10">
                                                    {
                                                        row.no
                                                    }
                                                </td>


                                                <td className="border border-slate-200 px-4 py-3 font-semibold text-slate-800 sticky left-[45px] bg-white z-10">
                                                    {
                                                        row.name
                                                    }
                                                </td>


                                                <td className="border border-slate-200 px-4 py-3 text-slate-600">
                                                    {
                                                        row.admission
                                                    }
                                                </td>


                                                {/* TERM 1 */}

                                                <td className="border border-slate-200 px-3 py-3 text-right">
                                                    {money(
                                                        row.tuitionTerm1
                                                    )}
                                                </td>


                                                <td className="border border-slate-200 px-3 py-3 text-right font-bold text-blue-700">
                                                    {money(
                                                        row.tuitionTerm1Paid
                                                    )}
                                                </td>


                                                <td className="border border-slate-200 px-3 py-3 text-right font-bold text-red-600">
                                                    {money(
                                                        row.term1Balance
                                                    )}
                                                </td>


                                                {/* TERM 2 */}

                                                <td className="border border-slate-200 px-3 py-3 text-right">
                                                    {money(
                                                        row.tuitionTerm2
                                                    )}
                                                </td>


                                                <td className="border border-slate-200 px-3 py-3 text-right font-bold text-blue-700">
                                                    {money(
                                                        row.tuitionTerm2Paid
                                                    )}
                                                </td>


                                                <td className="border border-slate-200 px-3 py-3 text-right font-bold text-red-600">
                                                    {money(
                                                        row.term2Balance
                                                    )}
                                                </td>


                                                {/* OTHER */}

                                                <td className="border border-slate-200 px-3 py-3 text-right">
                                                    {money(
                                                        row.otherFees
                                                    )}
                                                </td>


                                                <td className="border border-slate-200 px-3 py-3 text-right font-bold text-blue-700">
                                                    {money(
                                                        row.otherPaid
                                                    )}
                                                </td>


                                                <td className="border border-slate-200 px-3 py-3 text-right font-bold text-red-600">
                                                    {money(
                                                        row.otherBalance
                                                    )}
                                                </td>


                                                {/* TOTAL */}

                                                <td className="border border-slate-200 px-3 py-3 text-right font-bold text-slate-800">
                                                    {money(
                                                        row.totalRequired
                                                    )}
                                                </td>


                                                <td className="border border-slate-200 px-3 py-3 text-right font-bold text-blue-700">
                                                    {money(
                                                        row.totalPaid
                                                    )}
                                                </td>


                                                <td className="border border-slate-200 px-3 py-3 text-right font-bold text-red-600">
                                                    {money(
                                                        row.totalBalance
                                                    )}
                                                </td>


                                                <td className="border border-slate-200 px-3 py-3 text-center font-bold">

                                                    {percentage(
                                                        row.paidPercentage
                                                    )}

                                                    <div className="mt-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">

                                                        <div
                                                            className="h-full bg-blue-600 rounded-full"
                                                            style={{
                                                                width: `${Math.min(
                                                                    row.paidPercentage,
                                                                    100
                                                                )}%`,
                                                            }}
                                                        />

                                                    </div>

                                                </td>


                                                {/* STATUS */}

                                                <td className="border border-slate-200 px-3 py-3 text-center">

                                                    <span
                                                        className={`inline-flex items-center justify-center px-3 py-1.5 rounded-full text-xs font-bold ${statusClass(
                                                            row.status
                                                        )}`}
                                                    >
                                                        {
                                                            row.status
                                                        }
                                                    </span>

                                                </td>


                                                {/* ACTIONS */}

                                                <td className="border border-slate-200 px-3 py-3 align-top print:hidden">

                                                    {/* --------------------------------------------
                                                        STUDENT HAS RECORD PAYMENT
                                                    --------------------------------------------- */}

                                                    {row.hasRecordedPayment ? (
                                                        <div className="rounded-xl bg-slate-100 border border-slate-200 px-3 py-3">

                                                            <div className="flex items-center gap-2 text-slate-600">

                                                                <FaExclamationTriangle />

                                                                <span className="text-xs font-bold">
                                                                    Payment Protected
                                                                </span>

                                                            </div>

                                                            <div className="text-[11px] text-slate-500 mt-1">
                                                                Recorded payment exists. Class Fee Collection cannot edit it.
                                                            </div>

                                                        </div>
                                                    ) : row.setupData?.length > 0 ? (

                                                        <div className="space-y-2">

                                                            {row.setupData.map(
                                                                (
                                                                    setup
                                                                ) => {

                                                                    const isDeleting =
                                                                        String(
                                                                            deletingSetupId
                                                                        ) ===
                                                                        String(
                                                                            setup.id
                                                                        );


                                                                    const locked =
                                                                        setup.hasPayment;


                                                                    return (
                                                                        <div
                                                                            key={
                                                                                setup.id
                                                                            }
                                                                            className="flex items-center gap-2"
                                                                        >

                                                                            <div className="flex-1 min-w-0">

                                                                                <div className="text-xs font-bold text-slate-700 truncate">
                                                                                    {
                                                                                        setupLabel(
                                                                                            setup
                                                                                        )
                                                                                    }
                                                                                </div>

                                                                                <div className="text-[11px] text-slate-500">

                                                                                    {money(
                                                                                        setup.amount
                                                                                    )}

                                                                                    {" "}

                                                                                    {setup.hasPayment
                                                                                        ? "• Paid"
                                                                                        : setup.hasCharge
                                                                                            ? "• Charged"
                                                                                            : "• Unused"}

                                                                                </div>

                                                                            </div>


                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    openEditSetup(
                                                                                        setup,
                                                                                        row
                                                                                    )
                                                                                }
                                                                                disabled={
                                                                                    locked ||
                                                                                    isDeleting
                                                                                }
                                                                                title={
                                                                                    locked
                                                                                        ? "Cannot edit a setup with an existing payment"
                                                                                        : "Edit fee setup"
                                                                                }
                                                                                className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center hover:bg-blue-100 disabled:opacity-50"
                                                                            >

                                                                                <FaEdit
                                                                                    size={
                                                                                        13
                                                                                    }
                                                                                />

                                                                            </button>


                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    deleteSetup(
                                                                                        setup,
                                                                                        row
                                                                                    )
                                                                                }
                                                                                disabled={
                                                                                    locked ||
                                                                                    setup.hasCharge ||
                                                                                    isDeleting
                                                                                }
                                                                                title={
                                                                                    locked ||
                                                                                    setup.hasCharge
                                                                                        ? "Cannot delete a setup already used by finance"
                                                                                        : "Delete fee setup"
                                                                                }
                                                                                className={`w-8 h-8 rounded-lg border flex items-center justify-center ${
                                                                                    locked ||
                                                                                    setup.hasCharge
                                                                                        ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                                                                        : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                                                                                } disabled:opacity-50`}
                                                                            >

                                                                                {isDeleting ? (
                                                                                    <FaSpinner
                                                                                        className="animate-spin"
                                                                                        size={
                                                                                            13
                                                                                        }
                                                                                    />
                                                                                ) : (
                                                                                    <FaTrash
                                                                                        size={
                                                                                            13
                                                                                        }
                                                                                    />
                                                                                )}

                                                                            </button>

                                                                        </div>
                                                                    );
                                                                }
                                                            )}

                                                        </div>

                                                    ) : (

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                openCreateSetup(
                                                                    row
                                                                )
                                                            }
                                                            className="w-full px-3 py-2.5 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center gap-2 hover:bg-blue-700"
                                                        >

                                                            <FaPlus />

                                                            Fill Fee Information

                                                        </button>

                                                    )}

                                                </td>

                                            </tr>
                                        )
                                    )}

                                </tbody>


                                {/* CLASS TOTAL */}

                                {filteredRows.length > 0 && (
                                    <tfoot>

                                        <tr className="bg-slate-100 font-bold">

                                            <td
                                                colSpan="3"
                                                className="border border-slate-300 px-4 py-4 text-right"
                                            >
                                                CLASS TOTAL
                                            </td>


                                            <td className="border border-slate-300 px-3 py-4 text-right">
                                                {money(
                                                    summary.tuitionTerm1
                                                )}
                                            </td>


                                            <td className="border border-slate-300 px-3 py-4 text-right text-blue-700">
                                                {money(
                                                    summary.tuitionTerm1Paid
                                                )}
                                            </td>


                                            <td className="border border-slate-300 px-3 py-4 text-right text-red-700">
                                                {money(
                                                    summary.term1Balance
                                                )}
                                            </td>


                                            <td className="border border-slate-300 px-3 py-4 text-right">
                                                {money(
                                                    summary.tuitionTerm2
                                                )}
                                            </td>


                                            <td className="border border-slate-300 px-3 py-4 text-right text-blue-700">
                                                {money(
                                                    summary.tuitionTerm2Paid
                                                )}
                                            </td>


                                            <td className="border border-slate-300 px-3 py-4 text-right text-red-700">
                                                {money(
                                                    summary.term2Balance
                                                )}
                                            </td>


                                            <td className="border border-slate-300 px-3 py-4 text-right">
                                                {money(
                                                    summary.otherFees
                                                )}
                                            </td>


                                            <td className="border border-slate-300 px-3 py-4 text-right text-blue-700">
                                                {money(
                                                    summary.otherPaid
                                                )}
                                            </td>


                                            <td className="border border-slate-300 px-3 py-4 text-right text-red-700">
                                                {money(
                                                    summary.otherBalance
                                                )}
                                            </td>


                                            <td className="border border-slate-300 px-3 py-4 text-right">
                                                {money(
                                                    summary.required
                                                )}
                                            </td>


                                            <td className="border border-slate-300 px-3 py-4 text-right text-blue-700">
                                                {money(
                                                    summary.paid
                                                )}
                                            </td>


                                            <td className="border border-slate-300 px-3 py-4 text-right text-red-700">
                                                {money(
                                                    summary.balance
                                                )}
                                            </td>


                                            <td className="border border-slate-300 px-3 py-4 text-center text-green-700">
                                                {percentage(
                                                    collectionRate
                                                )}
                                            </td>


                                            <td className="border border-slate-300 px-3 py-4 text-center print:hidden">
                                                —
                                            </td>

                                        </tr>

                                    </tfoot>
                                )}

                            </table>

                        </div>

                    </div>
                )}


                {/* SUMMARY CARDS */}

                {selectedClassId &&
                    filteredRows.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mt-5">

                            <div className="bg-white border border-slate-200 rounded-xl p-4">
                                <div className="text-xs text-slate-500">
                                    Students
                                </div>

                                <div className="text-xl font-bold text-slate-800 mt-1">
                                    {
                                        summary.students
                                    }
                                </div>
                            </div>


                            <div className="bg-white border border-slate-200 rounded-xl p-4">
                                <div className="text-xs text-slate-500">
                                    Term 1 Fee
                                </div>

                                <div className="text-lg font-bold text-slate-800 mt-1">
                                    {money(
                                        summary.tuitionTerm1
                                    )}
                                </div>
                            </div>


                            <div className="bg-white border border-slate-200 rounded-xl p-4">
                                <div className="text-xs text-slate-500">
                                    Term 1 Paid
                                </div>

                                <div className="text-lg font-bold text-blue-700 mt-1">
                                    {money(
                                        summary.tuitionTerm1Paid
                                    )}
                                </div>
                            </div>


                            <div className="bg-white border border-slate-200 rounded-xl p-4">
                                <div className="text-xs text-slate-500">
                                    Term 2 Fee
                                </div>

                                <div className="text-lg font-bold text-slate-800 mt-1">
                                    {money(
                                        summary.tuitionTerm2
                                    )}
                                </div>
                            </div>


                            <div className="bg-white border border-slate-200 rounded-xl p-4">
                                <div className="text-xs text-slate-500">
                                    Other Fees
                                </div>

                                <div className="text-lg font-bold text-slate-800 mt-1">
                                    {money(
                                        summary.otherFees
                                    )}
                                </div>
                            </div>


                            <div className="bg-white border border-slate-200 rounded-xl p-4">
                                <div className="text-xs text-slate-500">
                                    Total Paid
                                </div>

                                <div className="text-lg font-bold text-blue-700 mt-1">
                                    {money(
                                        summary.paid
                                    )}
                                </div>
                            </div>


                            <div className="bg-white border border-slate-200 rounded-xl p-4">
                                <div className="text-xs text-slate-500">
                                    Collection Rate
                                </div>

                                <div className="text-lg font-bold text-green-700 mt-1">
                                    {percentage(
                                        collectionRate
                                    )}
                                </div>
                            </div>

                        </div>
                    )}


                {/* PRINT SUMMARY */}

                {selectedClassId &&
                    filteredRows.length > 0 && (
                        <div className="hidden print:grid grid-cols-4 gap-3 mt-4 text-xs">

                            <div className="border border-slate-400 p-2">
                                <strong>
                                    Total Students:
                                </strong>
                                {" "}
                                {
                                    summary.students
                                }
                            </div>


                            <div className="border border-slate-400 p-2">
                                <strong>
                                    Total Fee:
                                </strong>
                                {" "}
                                {money(
                                    summary.required
                                )}
                            </div>


                            <div className="border border-slate-400 p-2">
                                <strong>
                                    Total Paid:
                                </strong>
                                {" "}
                                {money(
                                    summary.paid
                                )}
                            </div>


                            <div className="border border-slate-400 p-2">
                                <strong>
                                    Total Balance:
                                </strong>
                                {" "}
                                {money(
                                    summary.balance
                                )}
                            </div>


                            <div className="border border-slate-400 p-2">
                                <strong>
                                    Term 1 Fee:
                                </strong>
                                {" "}
                                {money(
                                    summary.tuitionTerm1
                                )}
                            </div>


                            <div className="border border-slate-400 p-2">
                                <strong>
                                    Term 1 Paid:
                                </strong>
                                {" "}
                                {money(
                                    summary.tuitionTerm1Paid
                                )}
                            </div>


                            <div className="border border-slate-400 p-2">
                                <strong>
                                    Term 2 Fee:
                                </strong>
                                {" "}
                                {money(
                                    summary.tuitionTerm2
                                )}
                            </div>


                            <div className="border border-slate-400 p-2">
                                <strong>
                                    Term 2 Paid:
                                </strong>
                                {" "}
                                {money(
                                    summary.tuitionTerm2Paid
                                )}
                            </div>


                            <div className="border border-slate-400 p-2">
                                <strong>
                                    Other Fees:
                                </strong>
                                {" "}
                                {money(
                                    summary.otherFees
                                )}
                            </div>


                            <div className="border border-slate-400 p-2">
                                <strong>
                                    Other Paid:
                                </strong>
                                {" "}
                                {money(
                                    summary.otherPaid
                                )}
                            </div>


                            <div className="border border-slate-400 p-2">
                                <strong>
                                    Other Balance:
                                </strong>
                                {" "}
                                {money(
                                    summary.otherBalance
                                )}
                            </div>


                            <div className="border border-slate-400 p-2">
                                <strong>
                                    Collection:
                                </strong>
                                {" "}
                                {percentage(
                                    collectionRate
                                )}
                            </div>

                        </div>
                    )}


                {/* PRINT FOOTER */}

                <div className="hidden print:flex justify-between mt-8 text-xs">

                    <div>
                        Printed on:
                        {" "}
                        {new Date().toLocaleDateString(
                            "en-TZ"
                        )}
                    </div>


                    <div>
                        AfriCore ERP PRO
                    </div>

                </div>

            </div>


            {/* =====================================================
                EDIT / CREATE MODAL
            ===================================================== */}

            {editingSetup && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">

                    <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">

                        {/* MODAL HEADER */}

                        <div className="bg-slate-900 px-5 py-4 flex items-center justify-between">

                            <div>

                                <h2 className="text-lg font-bold text-white">

                                    {editingSetup.mode === "create"
                                        ? "Fill Student Fee Information"
                                        : "Edit Fee Setup"}

                                </h2>

                                <p className="text-xs text-slate-300 mt-1">

                                    {editingSetup.mode === "create"
                                        ? "Enter the student's fee information and save it."
                                        : "Update the fee amount or due date"}

                                </p>

                            </div>


                            <button
                                type="button"
                                onClick={
                                    closeEditSetup
                                }
                                disabled={
                                    savingEdit
                                }
                                className="w-9 h-9 rounded-lg bg-white/10 text-white flex items-center justify-center hover:bg-white/20 disabled:opacity-50"
                            >
                                <FaTimes />
                            </button>

                        </div>


                        {/* STUDENT */}

                        <div className="px-5 pt-5">

                            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">

                                <div className="text-xs font-bold uppercase text-slate-500">
                                    Student
                                </div>

                                <div className="font-bold text-slate-800 mt-1">
                                    {
                                        editingSetup.studentName
                                    }
                                </div>

                                <div className="text-xs text-slate-500 mt-1">
                                    Admission:
                                    {" "}
                                    {
                                        editingSetup.admission
                                    }
                                </div>

                            </div>

                        </div>


                        {/* SETUP INFORMATION */}

                        <div className="px-5 pt-4">

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                                {/* FEE ITEM */}

                                <div>

                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
                                        Fee Item
                                    </label>

                                    {editingSetup.mode === "create" ? (

                                        <select
                                            value={
                                                editForm.fee_item_id
                                            }
                                            onChange={(event) =>
                                                setEditForm(
                                                    (current) => ({
                                                        ...current,
                                                        fee_item_id:
                                                            event
                                                                .target
                                                                .value,
                                                    })
                                                )
                                            }
                                            disabled={
                                                savingEdit
                                            }
                                            className="w-full px-3 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                                        >

                                            <option value="">
                                                Select Fee Item
                                            </option>

                                            {feeItems
                                                .filter(
                                                    (item) =>
                                                        item?.is_active !==
                                                        false
                                                )
                                                .map(
                                                    (
                                                        item
                                                    ) => (
                                                        <option
                                                            key={
                                                                item.id
                                                            }
                                                            value={
                                                                item.id
                                                            }
                                                        >
                                                            {
                                                                item.item_name
                                                            }
                                                        </option>
                                                    )
                                                )}

                                        </select>

                                    ) : (

                                        <div className="w-full px-3 py-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-semibold">
                                            {
                                                editingSetup?.fee_item?.item_name ||
                                                feeItemMap.get(
                                                    String(
                                                        editForm.fee_item_id
                                                    )
                                                )?.item_name ||
                                                editingSetup?.setup_type ||
                                                "-"
                                            }
                                        </div>

                                    )}

                                </div>


                                {/* SETUP TYPE */}

                                <div>

                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
                                        Fee Type
                                    </label>

                                    {editingSetup.mode === "create" ? (

                                        <select
                                            value={
                                                editForm.setup_type
                                            }
                                            onChange={(event) =>
                                                setEditForm(
                                                    (current) => ({
                                                        ...current,
                                                        setup_type:
                                                            event
                                                                .target
                                                                .value,
                                                    })
                                                )
                                            }
                                            disabled={
                                                savingEdit
                                            }
                                            className="w-full px-3 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                                        >

                                            <option value="tuition">
                                                Tuition
                                            </option>

                                            <option value="other">
                                                Other
                                            </option>

                                        </select>

                                    ) : (

                                        <div className="w-full px-3 py-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-semibold">
                                            {
                                                editingSetup?.setup_type ||
                                                "tuition"
                                            }
                                        </div>

                                    )}

                                </div>


                                {/* TERM */}

                                <div>

                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
                                        Term
                                    </label>

                                    <select
                                        value={
                                            editForm.term_number
                                        }
                                        onChange={(event) =>
                                            setEditForm(
                                                (current) => ({
                                                    ...current,
                                                    term_number:
                                                        event
                                                            .target
                                                            .value,
                                                })
                                            )
                                        }
                                        disabled={
                                            savingEdit
                                        }
                                        className="w-full px-3 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                                    >

                                        <option value="1">
                                            Term 1
                                        </option>

                                        <option value="2">
                                            Term 2
                                        </option>

                                    </select>

                                </div>


                                {/* AMOUNT */}

                                <div>

                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
                                        Amount
                                    </label>

                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={
                                            editForm.amount
                                        }
                                        onChange={(event) =>
                                            setEditForm(
                                                (current) => ({
                                                    ...current,
                                                    amount:
                                                        event
                                                            .target
                                                            .value,
                                                })
                                            )
                                        }
                                        disabled={
                                            savingEdit
                                        }
                                        className="w-full px-3 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                                    />

                                </div>

                            </div>

                        </div>


                        {/* FORM */}

                        <div className="px-5 py-4">

                            {editingSetup.mode === "create" && (
                                <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">

                                    <div className="flex items-start gap-2">

                                        <FaPlus className="mt-0.5 shrink-0" />

                                        <div>

                                            <div className="font-bold">
                                                New fee information
                                            </div>

                                            <div className="text-xs mt-1">
                                                This student has no recorded payment, so you can fill in the missing fee information.
                                            </div>

                                        </div>

                                    </div>

                                </div>
                            )}


                            {editingSetup.mode === "edit" &&
                                editingSetup.hasPayment && (
                                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">

                                        <div className="flex items-start gap-2">

                                            <FaExclamationTriangle className="mt-0.5 shrink-0" />

                                            <div>

                                                <div className="font-bold">
                                                    This setup already has payment
                                                </div>

                                                <div className="text-xs mt-1">
                                                    The accounting information is protected from changing.
                                                </div>

                                            </div>

                                        </div>

                                    </div>
                                )}


                            <div>

                                <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
                                    Due Date
                                </label>

                                <input
                                    type="date"
                                    value={
                                        editForm.due_date
                                    }
                                    onChange={(event) =>
                                        setEditForm(
                                            (current) => ({
                                                ...current,
                                                due_date:
                                                    event
                                                        .target
                                                        .value,
                                            })
                                        )
                                    }
                                    disabled={
                                        savingEdit ||
                                        editingSetup.hasPayment
                                    }
                                    className="w-full px-3 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                                />

                            </div>

                        </div>


                        {/* MODAL FOOTER */}

                        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">

                            <button
                                type="button"
                                onClick={
                                    closeEditSetup
                                }
                                disabled={
                                    savingEdit
                                }
                                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-100 disabled:opacity-50"
                            >
                                Cancel
                            </button>


                            <button
                                type="button"
                                onClick={
                                    saveEditSetup
                                }
                                disabled={
                                    savingEdit ||
                                    editingSetup.hasPayment
                                }
                                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >

                                {savingEdit ? (
                                    <>
                                        <FaSpinner className="animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <FaSave />

                                        {editingSetup.mode === "create"
                                            ? "Save Fee Information"
                                            : "Save Changes"}

                                    </>
                                )}

                            </button>

                        </div>

                    </div>

                </div>
            )}


            {/* =====================================================
                PRINT CSS
            ===================================================== */}

            <style>
                {`
                    @media print {

                        @page {
                            size: A4 landscape;
                            margin: 8mm;
                        }

                        html,
                        body {
                            background: white !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            width: 100% !important;
                        }

                        body * {
                            visibility: hidden !important;
                        }

                        #class-fee-print-area,
                        #class-fee-print-area * {
                            visibility: visible !important;
                        }

                        #class-fee-print-area {
                            position: absolute !important;
                            left: 0 !important;
                            top: 0 !important;
                            width: 100% !important;
                            max-width: none !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            background: white !important;
                            border: none !important;
                            box-shadow: none !important;
                        }

                        .print\\:hidden {
                            display: none !important;
                        }

                        table {
                            width: 100% !important;
                            page-break-inside: auto !important;
                            break-inside: auto !important;
                        }

                        tr {
                            page-break-inside: avoid !important;
                            break-inside: avoid !important;
                            page-break-after: auto !important;
                        }

                        thead {
                            display: table-header-group !important;
                        }

                        tfoot {
                            display: table-footer-group !important;
                        }

                        th,
                        td {
                            position: static !important;
                            left: auto !important;
                            right: auto !important;
                            top: auto !important;
                            bottom: auto !important;
                        }

                        .overflow-x-auto {
                            overflow: visible !important;
                        }

                        #class-fee-print-area .shadow,
                        #class-fee-print-area .shadow-sm,
                        #class-fee-print-area .shadow-md,
                        #class-fee-print-area .shadow-lg {
                            box-shadow: none !important;
                        }

                        * {
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }

                        h1,
                        h2,
                        h3 {
                            page-break-after: avoid !important;
                            break-after: avoid !important;
                        }
                    }
                `}
            </style>
        </>
    );
}

export default ClassFeeCollection;