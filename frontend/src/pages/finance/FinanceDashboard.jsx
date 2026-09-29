import React, {
    useEffect,
    useMemo,
    useState
} from "react";

import {
    FaArrowRight,
    FaBalanceScale,
    FaBuilding,
    FaChartLine,
    FaClipboardList,
    FaCoins,
    FaExchangeAlt,
    FaFileInvoiceDollar,
    FaMoneyBillWave,
    FaPlus,
    FaReceipt,
    FaRedo,
    FaSpinner,
    FaUniversity,
    FaUsers,
    FaWallet,
} from "react-icons/fa";

import {
    useNavigate
} from "react-router-dom";

import { supabase } from "../../services/supabase";


// =====================================================
// HELPERS
// =====================================================

function money(value) {
    const number = Number(value || 0);

    return new Intl.NumberFormat("en-TZ", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(number);
}


function formatDate(value) {
    if (!value) {
        return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}


// =====================================================
// COMPONENT
// =====================================================

function FinanceDashboard() {
    const navigate = useNavigate();


    // =================================================
    // STATE
    // =================================================

    const [loading, setLoading] = useState(true);

    const [refreshing, setRefreshing] = useState(false);

    const [error, setError] = useState("");

    const [school, setSchool] = useState(null);

    const [profile, setProfile] = useState(null);

    const [studentCharges, setStudentCharges] = useState([]);

    const [otherReceivables, setOtherReceivables] = useState([]);

    const [staffReceivables, setStaffReceivables] = useState([]);

    const [staffMembers, setStaffMembers] = useState([]);

    const [supplierBills, setSupplierBills] = useState([]);

    const [cashAccounts, setCashAccounts] = useState([]);

    const [students, setStudents] = useState([]);

    const [suppliers, setSuppliers] = useState([]);


    const [statistics, setStatistics] = useState({
        receivables: 0,
        payables: 0,
        cash: 0,
        netPosition: 0,
        studentReceivables: 0,
        staffReceivables: 0,
        otherReceivables: 0,
        activeCashAccounts: 0,
        outstandingReceivablesCount: 0,
        outstandingPayablesCount: 0,
    });


    // =================================================
    // LOAD DASHBOARD
    // =================================================

    const loadDashboard = async (
        showRefresh = false
    ) => {
        try {
            if (showRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            setError("");


            // -----------------------------------------
            // AUTH USER
            // -----------------------------------------

            const {
                data: {
                    user
                },
                error: userError
            } = await supabase.auth.getUser();


            if (userError) {
                throw userError;
            }


            if (!user) {
                throw new Error(
                    "Your session has expired. Please login again."
                );
            }


            // -----------------------------------------
            // PROFILE
            // -----------------------------------------

            const {
                data: profileData,
                error: profileError
            } = await supabase
                .from("profiles")
                .select(
                    "id, school_id, role_id"
                )
                .eq(
                    "id",
                    user.id
                )
                .maybeSingle();


            if (profileError) {
                throw profileError;
            }


            setProfile(profileData);


            const superAdmin =
                Number(profileData?.role_id) === 1;


            const schoolId =
                profileData?.school_id
                    ? Number(profileData.school_id)
                    : null;


            // -----------------------------------------
            // SCHOOL
            // -----------------------------------------

            if (schoolId) {
                const {
                    data: schoolData,
                    error: schoolError
                } = await supabase
                    .from("schools")
                    .select(
                        "id, school_name, logo"
                    )
                    .eq(
                        "id",
                        schoolId
                    )
                    .maybeSingle();


                if (schoolError) {
                    console.warn(
                        "School loading warning:",
                        schoolError
                    );
                }

                setSchool(
                    schoolData || null
                );
            }


            // =================================================
            // STUDENT CHARGES
            // =================================================

            let studentChargesQuery = supabase
                .schema("finance")
                .from("student_charges")
                .select("*")
                .gt(
                    "balance",
                    0
                )
                .order(
                    "charge_date",
                    {
                        ascending: false
                    }
                )
                .limit(500);


            if (
                !superAdmin &&
                schoolId
            ) {
                studentChargesQuery =
                    studentChargesQuery.eq(
                        "school_id",
                        schoolId
                    );
            }


            const {
                data: studentChargesData,
                error: studentChargesError
            } = await studentChargesQuery;


            if (studentChargesError) {
                throw studentChargesError;
            }


            const safeStudentCharges =
                studentChargesData || [];


            setStudentCharges(
                safeStudentCharges
            );


            // =================================================
            // OTHER RECEIVABLES
            // =================================================

            let receivablesQuery = supabase
                .schema("finance")
                .from("other_receivables")
                .select("*")
                .gt(
                    "balance",
                    0
                )
                .order(
                    "receivable_date",
                    {
                        ascending: false
                    }
                )
                .limit(500);


            if (
                !superAdmin &&
                schoolId
            ) {
                receivablesQuery =
                    receivablesQuery.eq(
                        "school_id",
                        schoolId
                    );
            }


            const {
                data: receivablesData,
                error: receivablesError
            } = await receivablesQuery;


            if (receivablesError) {
                throw receivablesError;
            }


            const safeReceivables =
                receivablesData || [];


            setOtherReceivables(
                safeReceivables
            );


            // =================================================
            // STAFF SALARY ADVANCE RECEIVABLES
            // =================================================

            let staffReceivablesQuery = supabase
                .schema("finance")
                .from("staff_receivables")
                .select(`
                    id,
                    school_id,
                    staff_id,
                    receivable_type,
                    reference_number,
                    advance_date,
                    due_date,
                    description,
                    amount,
                    paid_amount,
                    balance,
                    status,
                    created_at
                `)
                .gt("balance", 0)
                .order("advance_date", {
                    ascending: false
                })
                .limit(500);

            if (!superAdmin && schoolId) {
                staffReceivablesQuery =
                    staffReceivablesQuery.eq(
                        "school_id",
                        schoolId
                    );
            }

            const {
                data: staffReceivablesData,
                error: staffReceivablesError
            } = await staffReceivablesQuery;

            if (staffReceivablesError) {
                throw staffReceivablesError;
            }

            const safeStaffReceivables =
                staffReceivablesData || [];

            setStaffReceivables(
                safeStaffReceivables
            );


            // Load staff names for the receivable register.
            const staffIds = [
                ...new Set(
                    safeStaffReceivables
                        .map(item => item.staff_id)
                        .filter(Boolean)
                )
            ];

            if (staffIds.length > 0) {
                const {
                    data: staffData,
                    error: staffError
                } = await supabase
                    .from("teachers")
                    .select(`
                        id,
                        first_name,
                        middle_name,
                        last_name,
                        employee_number,
                        school_id
                    `)
                    .in("id", staffIds);

                if (staffError) {
                    console.warn(
                        "Staff loading warning:",
                        staffError
                    );
                }

                setStaffMembers(staffData || []);
            } else {
                setStaffMembers([]);
            }


            // =================================================
            // SUPPLIER BILLS
            // =================================================

            let supplierBillsQuery = supabase
                .schema("finance")
                .from("supplier_bills")
                .select("*")
                .gt(
                    "balance",
                    0
                )
                .order(
                    "bill_date",
                    {
                        ascending: false
                    }
                )
                .limit(500);


            if (
                !superAdmin &&
                schoolId
            ) {
                supplierBillsQuery =
                    supplierBillsQuery.eq(
                        "school_id",
                        schoolId
                    );
            }


            const {
                data: supplierBillsData,
                error: supplierBillsError
            } = await supplierBillsQuery;


            if (supplierBillsError) {
                throw supplierBillsError;
            }


            const safeSupplierBills =
                supplierBillsData || [];


            setSupplierBills(
                safeSupplierBills
            );


            // =================================================
            // CASH ACCOUNTS
            // =================================================

            let cashAccountsQuery = supabase
                .schema("finance")
                .from("cash_accounts")
                .select("*")
                .eq(
                    "is_active",
                    true
                )
                .order(
                    "account_name",
                    {
                        ascending: true
                    }
                );


            if (
                !superAdmin &&
                schoolId
            ) {
                cashAccountsQuery =
                    cashAccountsQuery.eq(
                        "school_id",
                        schoolId
                    );
            }


            const {
                data: cashAccountsData,
                error: cashAccountsError
            } = await cashAccountsQuery;


            if (cashAccountsError) {
                throw cashAccountsError;
            }


            const safeCashAccounts =
                cashAccountsData || [];


            setCashAccounts(
                safeCashAccounts
            );


            // =================================================
            // STUDENTS
            // =================================================

            const studentIds = [
                ...new Set(
                    safeStudentCharges
                        .map(
                            item =>
                                item.student_id
                        )
                        .filter(Boolean)
                )
            ];


            if (studentIds.length > 0) {
                const {
                    data: studentsData,
                    error: studentsError
                } = await supabase
                    .from("students")
                    .select(
                        "id, first_name, middle_name, last_name"
                    )
                    .in(
                        "id",
                        studentIds
                    );


                if (studentsError) {
                    console.warn(
                        "Student loading warning:",
                        studentsError
                    );
                }


                setStudents(
                    studentsData || []
                );
            } else {
                setStudents([]);
            }


            // =================================================
            // SUPPLIERS
            // =================================================

            const supplierIds = [
                ...new Set(
                    safeSupplierBills
                        .map(
                            item =>
                                item.supplier_id
                        )
                        .filter(Boolean)
                )
            ];


            if (supplierIds.length > 0) {
                const {
                    data: suppliersData,
                    error: suppliersError
                } = await supabase
                    .schema("finance")
                    .from("suppliers")
                    .select("*")
                    .in(
                        "id",
                        supplierIds
                    );


                if (suppliersError) {
                    console.warn(
                        "Supplier loading warning:",
                        suppliersError
                    );
                }


                setSuppliers(
                    suppliersData || []
                );
            } else {
                setSuppliers([]);
            }


            // =================================================
            // STATISTICS
            // =================================================

            const studentReceivableTotal =
                safeStudentCharges.reduce(
                    (
                        total,
                        item
                    ) =>
                        total +
                        Number(
                            item.balance || 0
                        ),
                    0
                );


            const otherReceivableTotal =
                safeReceivables.reduce(
                    (
                        total,
                        item
                    ) =>
                        total +
                        Number(
                            item.balance || 0
                        ),
                    0
                );


            const staffReceivableTotal =
                safeStaffReceivables.reduce(
                    (
                        total,
                        item
                    ) =>
                        total +
                        Number(
                            item.balance || 0
                        ),
                    0
                );


            const payableTotal =
                safeSupplierBills.reduce(
                    (
                        total,
                        item
                    ) =>
                        total +
                        Number(
                            item.balance || 0
                        ),
                    0
                );


            const cashTotal =
                safeCashAccounts.reduce(
                    (
                        total,
                        item
                    ) =>
                        total +
                        Number(
                            item.current_balance ||
                            item.balance ||
                            0
                        ),
                    0
                );


            const totalReceivables =
                studentReceivableTotal +
                staffReceivableTotal +
                otherReceivableTotal;


            const netPosition =
                cashTotal +
                totalReceivables -
                payableTotal;


            setStatistics({
                receivables:
                    totalReceivables,

                payables:
                    payableTotal,

                cash:
                    cashTotal,

                netPosition,

                studentReceivables:
                    studentReceivableTotal,

                staffReceivables:
                    staffReceivableTotal,

                otherReceivables:
                    otherReceivableTotal,

                activeCashAccounts:
                    safeCashAccounts.length,

                outstandingReceivablesCount:
                    safeStudentCharges.length +
                    safeStaffReceivables.length +
                    safeReceivables.length,

                outstandingPayablesCount:
                    safeSupplierBills.length,
            });


        } catch (err) {
            console.error(
                "Finance dashboard error:",
                err
            );

            setError(
                err?.message ||
                "Failed to load finance dashboard."
            );

        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };


    // =================================================
    // INITIAL LOAD
    // =================================================

    useEffect(() => {
        loadDashboard(false);
    }, []);


    // =================================================
    // LOOKUP HELPERS
    // =================================================

    const getStudentName = (
        studentId
    ) => {
        const student =
            students.find(
                item =>
                    Number(item.id) ===
                    Number(studentId)
            );


        if (!student) {
            return `Student #${studentId || "-"}`;
        }


        return [
            student.first_name,
            student.middle_name,
            student.last_name
        ]
            .filter(Boolean)
            .join(" ");
    };


    const getStaffName = (
        staffId
    ) => {
        const staff =
            staffMembers.find(
                item =>
                    Number(item.id) ===
                    Number(staffId)
            );

        if (!staff) {
            return `Staff #${staffId || "-"}`;
        }

        return [
            staff.first_name,
            staff.middle_name,
            staff.last_name
        ]
            .filter(Boolean)
            .join(" ");
    };


    const getSupplierName = (
        supplierId
    ) => {
        const supplier =
            suppliers.find(
                item =>
                    Number(item.id) ===
                    Number(supplierId)
            );


        if (!supplier) {
            return `Supplier #${supplierId || "-"}`;
        }


        return (
            supplier.supplier_name ||
            supplier.name ||
            supplier.full_name ||
            supplier.company_name ||
            supplier.business_name ||
            `Supplier #${supplierId}`
        );
    };


    // =================================================
    // RECENT RECEIVABLES
    // =================================================

    const recentReceivables =
        useMemo(() => {
            const studentRows =
                studentCharges.map(
                    item => ({
                        id:
                            `student-${item.id}`,

                        type:
                            "Student Fee",

                        name:
                            getStudentName(
                                item.student_id
                            ),

                        reference:
                            item.reference_number ||
                            item.charge_number ||
                            item.id,

                        date:
                            item.charge_date ||
                            item.created_at,

                        amount:
                            Number(
                                item.balance || 0
                            ),
                    })
                );


            const otherRows =
                otherReceivables.map(
                    item => ({
                        id:
                            `other-${item.id}`,

                        type:
                            "Other Receivable",

                        name:
                            item.party_name ||
                            "Other Party",

                        reference:
                            item.reference_number ||
                            item.id,

                        date:
                            item.receivable_date ||
                            item.created_at,

                        amount:
                            Number(
                                item.balance || 0
                            ),
                    })
                );


            const staffRows =
                staffReceivables.map(
                    item => ({
                        id:
                            `staff-${item.id}`,

                        type:
                            "Staff Salary Advance",

                        name:
                            getStaffName(
                                item.staff_id
                            ),

                        reference:
                            item.reference_number ||
                            item.id,

                        date:
                            item.advance_date ||
                            item.created_at,

                        amount:
                            Number(
                                item.balance || 0
                            ),
                    })
                );


            return [
                ...studentRows,
                ...staffRows,
                ...otherRows
            ]
                .sort(
                    (
                        a,
                        b
                    ) =>
                        new Date(
                            b.date || 0
                        ) -
                        new Date(
                            a.date || 0
                        )
                )
                .slice(
                    0,
                    8
                );
        }, [
            studentCharges,
            staffReceivables,
            otherReceivables,
            students,
            staffMembers
        ]);


    // =================================================
    // RECENT PAYABLES
    // =================================================

    const recentPayables =
        useMemo(() => {
            return supplierBills
                .map(
                    item => ({
                        ...item,

                        supplierDisplayName:
                            getSupplierName(
                                item.supplier_id
                            ),

                        displayDate:
                            item.bill_date ||
                            item.created_at,

                        displayBalance:
                            Number(
                                item.balance || 0
                            ),
                    })
                )
                .sort(
                    (
                        a,
                        b
                    ) =>
                        new Date(
                            b.displayDate || 0
                        ) -
                        new Date(
                            a.displayDate || 0
                        )
                )
                .slice(
                    0,
                    8
                );
        }, [
            supplierBills,
            suppliers
        ]);


    // =================================================
    // LOADING
    // =================================================

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <FaSpinner
                        className="animate-spin text-blue-600"
                        size={36}
                    />

                    <p className="text-sm text-slate-600">
                        Loading finance dashboard...
                    </p>
                </div>
            </div>
        );
    }


    // =================================================
    // MAIN UI
    // =================================================

    return (
        <div className="min-h-screen bg-slate-50">


            {/* =================================================
                HEADER
            ================================================= */}

            <div className="bg-white border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-6 py-5">

                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

                        <div>

                            <div className="flex items-center gap-3">

                                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                                    <FaCoins size={22} />
                                </div>

                                <div>

                                    <h1 className="text-2xl font-bold text-slate-900">
                                        Finance Dashboard
                                    </h1>

                                    <p className="text-sm text-slate-500 mt-1">
                                        {school?.school_name ||
                                            "School Finance Management"}
                                    </p>

                                </div>

                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2">

                                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                                    <FaBuilding />

                                    {Number(profile?.role_id) === 1
                                        ? "All Schools"
                                        : "Current School"}
                                </span>

                                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                                    <FaChartLine />

                                    Finance Overview
                                </span>

                            </div>

                        </div>


                        <button
                            type="button"
                            onClick={() =>
                                loadDashboard(true)
                            }
                            disabled={refreshing}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-60 transition"
                        >
                            <FaRedo
                                className={
                                    refreshing
                                        ? "animate-spin"
                                        : ""
                                }
                            />

                            {refreshing
                                ? "Refreshing..."
                                : "Refresh"}
                        </button>

                    </div>

                </div>
            </div>


            {/* =================================================
                ERROR
            ================================================= */}

            {error && (
                <div className="max-w-7xl mx-auto px-6 pt-5">

                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">

                        <div className="font-semibold mb-1">
                            Finance dashboard warning
                        </div>

                        {error}

                    </div>

                </div>
            )}


            {/* =================================================
                CONTENT
            ================================================= */}

            <div className="max-w-7xl mx-auto px-6 py-6">


                {/* =================================================
                    KPI CARDS
                ================================================= */}

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">


                    {/* RECEIVABLES */}

                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

                        <div className="flex items-start justify-between">

                            <div>

                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Total Receivables
                                </p>

                                <p className="text-2xl font-bold text-slate-900 mt-2">
                                    {money(
                                        statistics.receivables
                                    )}
                                </p>

                            </div>

                            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                <FaFileInvoiceDollar />
                            </div>

                        </div>

                        <div className="mt-4 flex items-center justify-between text-xs">

                            <span className="text-slate-500">
                                Student + Staff + Other AR
                            </span>

                            <span className="font-semibold text-blue-600">
                                {statistics.outstandingReceivablesCount}
                            </span>

                        </div>

                    </div>


                    {/* PAYABLES */}

                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

                        <div className="flex items-start justify-between">

                            <div>

                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Total Payables
                                </p>

                                <p className="text-2xl font-bold text-slate-900 mt-2">
                                    {money(
                                        statistics.payables
                                    )}
                                </p>

                            </div>

                            <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                                <FaClipboardList />
                            </div>

                        </div>

                        <div className="mt-4 flex items-center justify-between text-xs">

                            <span className="text-slate-500">
                                Outstanding supplier bills
                            </span>

                            <span className="font-semibold text-purple-600">
                                {statistics.outstandingPayablesCount}
                            </span>

                        </div>

                    </div>


                    {/* CASH */}

                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

                        <div className="flex items-start justify-between">

                            <div>

                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Cash & Bank
                                </p>

                                <p className="text-2xl font-bold text-slate-900 mt-2">
                                    {money(
                                        statistics.cash
                                    )}
                                </p>

                            </div>

                            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <FaWallet />
                            </div>

                        </div>

                        <div className="mt-4 flex items-center justify-between text-xs">

                            <span className="text-slate-500">
                                Active cash accounts
                            </span>

                            <span className="font-semibold text-emerald-600">
                                {statistics.activeCashAccounts}
                            </span>

                        </div>

                    </div>


                    {/* NET POSITION */}

                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

                        <div className="flex items-start justify-between">

                            <div>

                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Net Financial Position
                                </p>

                                <p
                                    className={`text-2xl font-bold mt-2 ${
                                        statistics.netPosition >= 0
                                            ? "text-emerald-600"
                                            : "text-red-600"
                                    }`}
                                >
                                    {money(
                                        statistics.netPosition
                                    )}
                                </p>

                            </div>

                            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                                <FaBalanceScale />
                            </div>

                        </div>

                        <div className="mt-4 text-xs text-slate-500">
                            Cash + Receivables - Payables
                        </div>

                    </div>

                </div>


                {/* =================================================
                    QUICK ACTIONS
                ================================================= */}

                <div className="mt-7">

                    <div className="flex items-center justify-between mb-4">

                        <div>

                            <h2 className="text-lg font-bold text-slate-900">
                                Finance Actions
                            </h2>

                            <p className="text-sm text-slate-500 mt-1">
                                Open and manage your finance workflows.
                            </p>

                        </div>

                        <span className="text-xs font-semibold text-slate-400">
                            8 modules
                        </span>

                    </div>


                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">


                        {/* CHART OF ACCOUNTS */}

                        <button
                            type="button"
                            onClick={() =>
                                navigate(
                                    "/finance/chart-of-accounts"
                                )
                            }
                            className="group bg-white border border-slate-200 rounded-2xl p-4 text-left hover:border-blue-300 hover:shadow-md transition"
                        >

                            <div className="flex items-center justify-between">

                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                    <FaBalanceScale />
                                </div>

                                <FaArrowRight className="text-slate-300 group-hover:text-blue-600 transition" />

                            </div>

                            <h3 className="font-bold text-slate-900 mt-4">
                                Chart of Accounts
                            </h3>

                            <p className="text-xs text-slate-500 mt-1">
                                Manage financial accounts.
                            </p>

                        </button>


                        {/* RECEIVE PAYMENT */}

                        <button
                            type="button"
                            onClick={() =>
                                navigate(
                                    "/finance/record-payment"
                                )
                            }
                            className="group bg-white border border-slate-200 rounded-2xl p-4 text-left hover:border-emerald-300 hover:shadow-md transition"
                        >

                            <div className="flex items-center justify-between">

                                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                    <FaMoneyBillWave />
                                </div>

                                <FaArrowRight className="text-slate-300 group-hover:text-emerald-600 transition" />

                            </div>

                            <h3 className="font-bold text-slate-900 mt-4">
                                Receive Payment
                            </h3>

                            <p className="text-xs text-slate-500 mt-1">
                                Record student payments.
                            </p>

                        </button>


                        {/* CLASS FEE COLLECTION */}

                        <button
                            type="button"
                            onClick={() =>
                                navigate(
                                    "/finance/class-fee-collection"
                                )
                            }
                            className="group bg-white border border-slate-200 rounded-2xl p-4 text-left hover:border-cyan-300 hover:shadow-md transition"
                        >

                            <div className="flex items-center justify-between">

                                <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                                    <FaUsers />
                                </div>

                                <FaArrowRight className="text-slate-300 group-hover:text-cyan-600 transition" />

                            </div>

                            <h3 className="font-bold text-slate-900 mt-4">
                                Class Fee Collection
                            </h3>

                            <p className="text-xs text-slate-500 mt-1">
                                View class fee collection.
                            </p>

                        </button>


                        {/* RECORD EXPENSE */}

                        <button
                            type="button"
                            onClick={() =>
                                navigate(
                                    "/finance/add-expense"
                                )
                            }
                            className="group bg-white border border-slate-200 rounded-2xl p-4 text-left hover:border-orange-300 hover:shadow-md transition"
                        >

                            <div className="flex items-center justify-between">

                                <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                                    <FaReceipt />
                                </div>

                                <FaArrowRight className="text-slate-300 group-hover:text-orange-600 transition" />

                            </div>

                            <h3 className="font-bold text-slate-900 mt-4">
                                Record Expense
                            </h3>

                            <p className="text-xs text-slate-500 mt-1">
                                Record school expenses.
                            </p>

                        </button>


                        {/* RECORD RECEIVABLE */}

                        <button
                            type="button"
                            onClick={() =>
                                navigate(
                                    "/finance/record-receivable"
                                )
                            }
                            className="group bg-white border border-slate-200 rounded-2xl p-4 text-left hover:border-indigo-300 hover:shadow-md transition"
                        >

                            <div className="flex items-center justify-between">

                                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                    <FaPlus />
                                </div>

                                <FaArrowRight className="text-slate-300 group-hover:text-indigo-600 transition" />

                            </div>

                            <h3 className="font-bold text-slate-900 mt-4">
                                Staff Receivable
                            </h3>

                            <p className="text-xs text-slate-500 mt-1">
                                Record staff salary advances.
                            </p>

                        </button>


                        {/* RECORD PAYABLE */}

                        <button
                            type="button"
                            onClick={() =>
                                navigate(
                                    "/finance/record-payable"
                                )
                            }
                            className="group bg-white border border-slate-200 rounded-2xl p-4 text-left hover:border-purple-300 hover:shadow-md transition"
                        >

                            <div className="flex items-center justify-between">

                                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                                    <FaClipboardList />
                                </div>

                                <FaArrowRight className="text-slate-300 group-hover:text-purple-600 transition" />

                            </div>

                            <h3 className="font-bold text-slate-900 mt-4">
                                Record Payable
                            </h3>

                            <p className="text-xs text-slate-500 mt-1">
                                Create supplier bills.
                            </p>

                        </button>


                        {/* GENERAL LEDGER */}

                        <button
                            type="button"
                            onClick={() =>
                                navigate(
                                    "/finance/general-ledger"
                                )
                            }
                            className="group bg-white border border-slate-200 rounded-2xl p-4 text-left hover:border-slate-400 hover:shadow-md transition"
                        >

                            <div className="flex items-center justify-between">

                                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                                    <FaExchangeAlt />
                                </div>

                                <FaArrowRight className="text-slate-300 group-hover:text-slate-700 transition" />

                            </div>

                            <h3 className="font-bold text-slate-900 mt-4">
                                General Ledger
                            </h3>

                            <p className="text-xs text-slate-500 mt-1">
                                View journal and ledger entries.
                            </p>

                        </button>


                        {/* FINANCIAL STATEMENTS */}

                        <button
                            type="button"
                            onClick={() =>
                                navigate(
                                    "/finance/financial-statements"
                                )
                            }
                            className="group bg-white border border-slate-200 rounded-2xl p-4 text-left hover:border-blue-300 hover:shadow-md transition"
                        >

                            <div className="flex items-center justify-between">

                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                    <FaBalanceScale />
                                </div>

                                <FaArrowRight className="text-slate-300 group-hover:text-blue-600 transition" />

                            </div>

                            <h3 className="font-bold text-slate-900 mt-4">
                                Financial Statements
                            </h3>

                            <p className="text-xs text-slate-500 mt-1">
                                Income Statement & Financial Position.
                            </p>

                        </button>

                    </div>

                </div>


                {/* =================================================
                    AR BREAKDOWN + CASH ACCOUNTS
                ================================================= */}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-7">


                    {/* AR BREAKDOWN */}

                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

                        <div className="px-5 py-4 border-b border-slate-200">

                            <div className="flex items-center justify-between">

                                <div>

                                    <h2 className="font-bold text-slate-900">
                                        Receivables Breakdown
                                    </h2>

                                    <p className="text-xs text-slate-500 mt-1">
                                        Outstanding amounts by source.
                                    </p>

                                </div>

                                <FaFileInvoiceDollar className="text-blue-600" />

                            </div>

                        </div>


                        <div className="p-5 space-y-4">


                            <div className="flex items-center justify-between">

                                <div className="flex items-center gap-3">

                                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                        <FaUsers />
                                    </div>

                                    <div>

                                        <p className="text-sm font-semibold text-slate-800">
                                            Student Fees
                                        </p>

                                        <p className="text-xs text-slate-500">
                                            Outstanding student balances
                                        </p>

                                    </div>

                                </div>

                                <p className="font-bold text-slate-900">
                                    {money(
                                        statistics.studentReceivables
                                    )}
                                </p>

                            </div>


                            <div className="border-t border-slate-100" />


                            <div className="flex items-center justify-between">

                                <div className="flex items-center gap-3">

                                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                                        <FaMoneyBillWave />
                                    </div>

                                    <div>

                                        <p className="text-sm font-semibold text-slate-800">
                                            Staff Salary Advances
                                        </p>

                                        <p className="text-xs text-slate-500">
                                            Outstanding staff advances
                                        </p>

                                    </div>

                                </div>

                                <p className="font-bold text-slate-900">
                                    {money(
                                        statistics.staffReceivables
                                    )}
                                </p>

                            </div>


                            <div className="border-t border-slate-100" />


                            <div className="flex items-center justify-between">

                                <div className="flex items-center gap-3">

                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                        <FaFileInvoiceDollar />
                                    </div>

                                    <div>

                                        <p className="text-sm font-semibold text-slate-800">
                                            Other Receivables
                                        </p>

                                        <p className="text-xs text-slate-500">
                                            Non-student receivables
                                        </p>

                                    </div>

                                </div>

                                <p className="font-bold text-slate-900">
                                    {money(
                                        statistics.otherReceivables
                                    )}
                                </p>

                            </div>


                            <div className="border-t border-slate-100" />


                            <div className="flex items-center justify-between">

                                <span className="text-sm font-bold text-slate-900">
                                    Total Receivables
                                </span>

                                <span className="text-lg font-bold text-blue-600">
                                    {money(
                                        statistics.receivables
                                    )}
                                </span>

                            </div>

                        </div>

                    </div>


                    {/* CASH ACCOUNTS */}

                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

                        <div className="px-5 py-4 border-b border-slate-200">

                            <div className="flex items-center justify-between">

                                <div>

                                    <h2 className="font-bold text-slate-900">
                                        Cash Accounts
                                    </h2>

                                    <p className="text-xs text-slate-500 mt-1">
                                        Current balances across active accounts.
                                    </p>

                                </div>

                                <FaUniversity className="text-emerald-600" />

                            </div>

                        </div>


                        <div className="p-5">

                            {cashAccounts.length === 0 ? (

                                <div className="py-8 text-center">

                                    <FaWallet className="mx-auto text-slate-300 text-3xl" />

                                    <p className="text-sm font-semibold text-slate-600 mt-3">
                                        No active cash accounts
                                    </p>

                                    <p className="text-xs text-slate-400 mt-1">
                                        Add or activate cash accounts to see balances here.
                                    </p>

                                </div>

                            ) : (

                                <div className="space-y-3">

                                    {cashAccounts
                                        .slice(0, 6)
                                        .map(
                                            account => (

                                                <div
                                                    key={
                                                        account.id
                                                    }
                                                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50"
                                                >

                                                    <div className="flex items-center gap-3">

                                                        <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 text-emerald-600 flex items-center justify-center">
                                                            {String(
                                                                account.account_type ||
                                                                ""
                                                            )
                                                                .toLowerCase()
                                                                .includes(
                                                                    "bank"
                                                                )
                                                                ? (
                                                                    <FaUniversity />
                                                                )
                                                                : (
                                                                    <FaWallet />
                                                                )}
                                                        </div>

                                                        <div>

                                                            <p className="text-sm font-semibold text-slate-800">
                                                                {
                                                                    account.name ||
                                                                    account.account_name ||
                                                                    "Cash Account"
                                                                }
                                                            </p>

                                                            <p className="text-xs text-slate-500">
                                                                {
                                                                    account.account_number ||
                                                                    account.code ||
                                                                    account.account_type ||
                                                                    "Active account"
                                                                }
                                                            </p>

                                                        </div>

                                                    </div>

                                                    <p className="font-bold text-slate-900">
                                                        {money(
                                                            account.current_balance ??
                                                            account.balance ??
                                                            0
                                                        )}
                                                    </p>

                                                </div>

                                            )
                                        )}

                                </div>

                            )}

                        </div>

                    </div>

                </div>


                {/* =================================================
                    FINANCIAL POSITION
                ================================================= */}

                <div className="mt-6 bg-white border border-slate-200 rounded-2xl shadow-sm">

                    <div className="px-5 py-4 border-b border-slate-200">

                        <div className="flex items-center gap-3">

                            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                                <FaChartLine />
                            </div>

                            <div>

                                <h2 className="font-bold text-slate-900">
                                    Financial Position
                                </h2>

                                <p className="text-xs text-slate-500 mt-1">
                                    Current high-level financial position.
                                </p>

                            </div>

                        </div>

                    </div>


                    <div className="grid grid-cols-1 md:grid-cols-3 gap-0">


                        <div className="p-5 md:border-r border-slate-200">

                            <p className="text-xs uppercase tracking-wide font-semibold text-slate-500">
                                Cash & Bank
                            </p>

                            <p className="text-xl font-bold text-emerald-600 mt-2">
                                {money(
                                    statistics.cash
                                )}
                            </p>

                        </div>


                        <div className="p-5 md:border-r border-slate-200">

                            <p className="text-xs uppercase tracking-wide font-semibold text-slate-500">
                                Receivables
                            </p>

                            <p className="text-xl font-bold text-blue-600 mt-2">
                                {money(
                                    statistics.receivables
                                )}
                            </p>

                        </div>


                        <div className="p-5">

                            <p className="text-xs uppercase tracking-wide font-semibold text-slate-500">
                                Payables
                            </p>

                            <p className="text-xl font-bold text-purple-600 mt-2">
                                {money(
                                    statistics.payables
                                )}
                            </p>

                        </div>

                    </div>

                </div>


                {/* =================================================
                    RECENT TRANSACTIONS
                ================================================= */}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">


                    {/* RECENT RECEIVABLES */}

                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

                        <div className="px-5 py-4 border-b border-slate-200">

                            <div className="flex items-center justify-between">

                                <div>

                                    <h2 className="font-bold text-slate-900">
                                        Recent Receivables
                                    </h2>

                                    <p className="text-xs text-slate-500 mt-1">
                                        Latest outstanding receivables.
                                    </p>

                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        navigate(
                                            "/finance/record-receivable"
                                        )
                                    }
                                    className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                                >
                                    Add
                                </button>

                            </div>

                        </div>


                        <div className="divide-y divide-slate-100">

                            {recentReceivables.length === 0 ? (

                                <div className="px-5 py-10 text-center">

                                    <FaFileInvoiceDollar className="mx-auto text-slate-300 text-3xl" />

                                    <p className="text-sm font-semibold text-slate-600 mt-3">
                                        No outstanding receivables
                                    </p>

                                </div>

                            ) : (

                                recentReceivables.map(
                                    item => (

                                        <div
                                            key={
                                                item.id
                                            }
                                            className="px-5 py-4 flex items-center justify-between gap-4"
                                        >

                                            <div className="min-w-0">

                                                <p className="text-sm font-semibold text-slate-800 truncate">
                                                    {item.name}
                                                </p>

                                                <div className="flex flex-wrap items-center gap-2 mt-1">

                                                    <span className="text-xs text-slate-500">
                                                        {item.type}
                                                    </span>

                                                    <span className="text-xs text-slate-300">
                                                        •
                                                    </span>

                                                    <span className="text-xs text-slate-500">
                                                        Ref: {item.reference}
                                                    </span>

                                                    <span className="text-xs text-slate-300">
                                                        •
                                                    </span>

                                                    <span className="text-xs text-slate-500">
                                                        {formatDate(
                                                            item.date
                                                        )}
                                                    </span>

                                                </div>

                                            </div>


                                            <div className="text-right shrink-0">

                                                <p className="font-bold text-blue-600">
                                                    {money(
                                                        item.amount
                                                    )}
                                                </p>

                                                <p className="text-[11px] text-slate-400">
                                                    Outstanding
                                                </p>

                                            </div>

                                        </div>

                                    )
                                )

                            )}

                        </div>

                    </div>


                    {/* RECENT PAYABLES */}

                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

                        <div className="px-5 py-4 border-b border-slate-200">

                            <div className="flex items-center justify-between">

                                <div>

                                    <h2 className="font-bold text-slate-900">
                                        Recent Payables
                                    </h2>

                                    <p className="text-xs text-slate-500 mt-1">
                                        Latest outstanding supplier bills.
                                    </p>

                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        navigate(
                                            "/finance/record-payable"
                                        )
                                    }
                                    className="text-xs font-semibold text-purple-600 hover:text-purple-700"
                                >
                                    Add
                                </button>

                            </div>

                        </div>


                        <div className="divide-y divide-slate-100">

                            {recentPayables.length === 0 ? (

                                <div className="px-5 py-10 text-center">

                                    <FaClipboardList className="mx-auto text-slate-300 text-3xl" />

                                    <p className="text-sm font-semibold text-slate-600 mt-3">
                                        No outstanding payables
                                    </p>

                                </div>

                            ) : (

                                recentPayables.map(
                                    item => (

                                        <div
                                            key={
                                                item.id
                                            }
                                            className="px-5 py-4 flex items-center justify-between gap-4"
                                        >

                                            <div className="min-w-0">

                                                <p className="text-sm font-semibold text-slate-800 truncate">
                                                    {item.supplierDisplayName}
                                                </p>

                                                <div className="flex flex-wrap items-center gap-2 mt-1">

                                                    <span className="text-xs text-slate-500">
                                                        Bill: {item.bill_number || "-"}
                                                    </span>

                                                    <span className="text-xs text-slate-300">
                                                        •
                                                    </span>

                                                    <span className="text-xs text-slate-500">
                                                        {formatDate(
                                                            item.displayDate
                                                        )}
                                                    </span>

                                                </div>

                                            </div>


                                            <div className="text-right shrink-0">

                                                <p className="font-bold text-purple-600">
                                                    {money(
                                                        item.displayBalance
                                                    )}
                                                </p>

                                                <p className="text-[11px] text-slate-400">
                                                    Outstanding
                                                </p>

                                            </div>

                                        </div>

                                    )
                                )

                            )}

                        </div>

                    </div>

                </div>


                {/* =================================================
                    FOOTER NOTE
                ================================================= */}

                <div className="mt-7 bg-slate-900 rounded-2xl px-5 py-4 text-white">

                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

                        <div className="flex items-start gap-3">

                            <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                                <FaExchangeAlt />
                            </div>

                            <div>

                                <p className="text-sm font-semibold">
                                    Core finance workflow is now connected
                                </p>

                                <p className="text-xs text-slate-300 mt-1">
                                    Chart of Accounts, Receive Payment,
                                    Class Fee Collection, Expense,
                                    Receivable, Payable and General Ledger
                                    are available from this dashboard.
                                </p>

                            </div>

                        </div>


                        <button
                            type="button"
                            onClick={() =>
                                navigate(
                                    "/finance/general-ledger"
                                )
                            }
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white text-slate-900 text-xs font-bold hover:bg-slate-100 transition shrink-0"
                        >
                            Open General Ledger

                            <FaArrowRight />

                        </button>

                    </div>

                </div>

            </div>

        </div>
    );
}


export default FinanceDashboard;