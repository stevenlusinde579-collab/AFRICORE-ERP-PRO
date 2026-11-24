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
    FaChartPie,
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
import { useRole } from "../../context/RoleContext";
import api from "../../services/api";
import SchoolOfficialSeal from "../../components/SchoolOfficialSeal";
import StaffSignatureImage from "../../components/StaffSignatureImage";


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
    const { selectedSchoolId, isSuperAdmin, loadingRoles, selectedRoleName } = useRole();


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
    const [receipts, setReceipts] = useState([]);
    const [selectedReceiptIds, setSelectedReceiptIds] = useState([]);
    const [portalDocuments, setPortalDocuments] = useState([]);
    const [publishingReceipts, setPublishingReceipts] = useState(false);
    const [publishMessage, setPublishMessage] = useState("");
    const [receiptsExpanded, setReceiptsExpanded] = useState(false);
    const [receiptHeaderColor, setReceiptHeaderColor] = useState("#e0f2fe");
    const [viewingReceipt, setViewingReceipt] = useState(null);

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
                Boolean(isSuperAdmin) || Number(profileData?.role_id) === 1;


            const schoolId =
                selectedSchoolId != null
                    ? Number(selectedSchoolId)
                    : profileData?.school_id
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
                    .select("*")
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

            let receiptsQuery = supabase.schema("finance").from("receipts")
                .select("id,school_id,receipt_number,receipt_date,student_id,payer_name,amount,payment_method,reference_number,description,status,issued_by")
                .like("receipt_number", "FEE-%").order("receipt_date", { ascending: false }).limit(500);
            if (!superAdmin && schoolId) receiptsQuery = receiptsQuery.eq("school_id", schoolId);
            const { data: receiptsData, error: receiptsError } = await receiptsQuery;
            if (receiptsError) throw receiptsError;
            // Receipts are primary records. Load and display them even if optional
            // student details or Parent Portal publication metadata cannot be read.
            setReceipts((receiptsData || []).map(row => ({ ...row, student: null })));
            const receiptStudentIds = [...new Set((receiptsData || []).map(row => row.student_id).filter(Boolean))];
            let receiptStudents = [];
            if (receiptStudentIds.length) {
                const { data: receiptStudentRows, error: receiptStudentsError } = await supabase.from("students")
                    .select("id,first_name,middle_name,last_name,admission_number,admission_no,parent_name,guardian_name")
                    .in("id", receiptStudentIds);
                if (receiptStudentsError) console.warn("Receipt student details lookup failed:", receiptStudentsError);
                else receiptStudents = receiptStudentRows || [];
            }
            const receiptStudentMap = new Map(receiptStudents.map(row => [String(row.id), row]));
            setReceipts((receiptsData || []).map(row => ({ ...row, student: receiptStudentMap.get(String(row.student_id)) || null })));
            const { data: portalDocumentRows, error: portalDocumentError } = await supabase
                .from("parent_portal_documents")
                .select("id,document_number,source_id,publication_status,published_at")
                .eq("school_id", schoolId)
                .eq("document_type", "receipt")
                .eq("source_type", "fee_payment");
            if (portalDocumentError) console.warn("Receipt Parent Portal status lookup failed:", portalDocumentError);
            setPortalDocuments(portalDocumentRows || []);

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
        if (loadingRoles) return;
        loadDashboard(false);
    }, [selectedSchoolId, isSuperAdmin, loadingRoles]);


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


                        <div className="flex flex-wrap items-center gap-2">
                        {(isSuperAdmin || selectedRoleName === "Accountant") && (
                            <button
                                type="button"
                                onClick={() => navigate("/payroll-management")}
                                className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 transition"
                            >
                                <FaMoneyBillWave /> Payroll
                            </button>
                        )}
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


                <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <button type="button" aria-expanded={receiptsExpanded} aria-controls="school-fees-receipts-panel" onClick={() => setReceiptsExpanded(value => !value)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><FaReceipt /></span>
                            <span><span className="block text-lg font-extrabold text-slate-900">School Fees Receipts <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold">{receipts.length}</span></span><span className="block text-sm text-slate-500">Risiti za ada zilizopostiwa. Fungua kuona, kuchagua, kuangalia au kuchapisha risiti.</span></span>
                            <span className="ml-auto text-xl font-bold text-slate-500">{receiptsExpanded ? "−" : "+"}</span>
                        </button>
                    </div>
                    {receiptsExpanded && <div id="school-fees-receipts-panel" className="mt-5">
                        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">Rangi ya kivuli cha kichwa cha risiti
                                <input aria-label="Receipt header shade" type="color" value={receiptHeaderColor} onChange={event => setReceiptHeaderColor(event.target.value)} className="h-10 w-14 cursor-pointer rounded border border-slate-300 bg-white p-1" />
                            </label>
                            <div className="flex flex-wrap gap-2">
                                <button type="button" disabled={!receipts.some(r => selectedReceiptIds.includes(String(r.id)))} onClick={() => { const previousTitle = document.title; document.title = `${school?.school_name || "School"} - Official Receipts`; const restoreTitle = () => { document.title = previousTitle; window.removeEventListener("afterprint", restoreTitle); }; window.addEventListener("afterprint", restoreTitle); window.print(); }} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-40">Print selected ({receipts.filter(r => selectedReceiptIds.includes(String(r.id))).length})</button>
                                <button type="button" disabled={publishingReceipts || !receipts.some(r => selectedReceiptIds.includes(String(r.id)))} onClick={async () => { setPublishingReceipts(true); setPublishMessage(""); try { const receipt_ids = receipts.filter(r => selectedReceiptIds.includes(String(r.id))).map(r => r.id); if (!receipt_ids.length) { setPublishMessage("Chagua angalau risiti moja ya ada."); return; } const result = await api.post("/parent-portal/staff/documents/publish", { receipt_ids, receipt_header_color: receiptHeaderColor }); setPublishMessage(result.data?.message || "Risiti zimechapishwa."); const refreshed = await supabase.from("parent_portal_documents").select("id,document_number,source_id,publication_status,published_at").eq("school_id", school?.id).eq("document_type", "receipt").eq("source_type", "fee_payment"); if (refreshed.error) throw refreshed.error; setPortalDocuments(refreshed.data || []); } catch (e) { setPublishMessage(e?.response?.data?.message || e.message || "Imeshindikana kuchapisha risiti."); } finally { setPublishingReceipts(false); } }} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{publishingReceipts ? "Publishing…" : "Publish selected to Parent Portal"}</button>
                            </div>
                        </div>
                        {publishMessage && <p className="mb-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{publishMessage}</p>}
                        <div className="space-y-2">
                            {receipts.map(receipt => {
                                const doc = portalDocuments.find(d => d.document_number === receipt.receipt_number);
                                const status = doc?.publication_status || "not_linked";
                                const studentName = receipt.student ? [receipt.student.first_name, receipt.student.middle_name, receipt.student.last_name].filter(Boolean).join(" ") : "Student details unavailable";
                                return <div key={receipt.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-sm">
                                    <div className="flex min-w-0 flex-1 items-center gap-3">
                                        <input aria-label={`Select receipt ${receipt.receipt_number}`} type="checkbox" checked={selectedReceiptIds.includes(String(receipt.id))} onChange={event => setSelectedReceiptIds(current => event.target.checked ? [...current, String(receipt.id)] : current.filter(id => id !== String(receipt.id)))} />
                                        <div className="min-w-0"><b className="block">{receipt.receipt_number}</b><span className="block text-xs text-slate-500">{receipt.payer_name || "Parent/Guardian"} · {studentName} · {formatDate(receipt.receipt_date)}</span><span className={`mt-1 block text-xs font-semibold ${status === "published" ? "text-emerald-700" : status === "pending" ? "text-amber-700" : "text-slate-500"}`}>{status === "published" ? "Published to Parent Portal" : status === "pending" ? "Not published yet" : "Ready to publish to Parent Portal"}</span></div>
                                    </div>
                                    <b className="whitespace-nowrap">{money(receipt.amount)} TZS</b>
                                    <button type="button" onClick={() => setViewingReceipt(receipt)} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50">View</button>
                                </div>;
                            })}
                            {!receipts.length && <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Hakuna risiti za ada zilizopostiwa bado.</p>}
                        </div>
                    </div>}
                    <div className="finance-receipt-print hidden">{receipts.filter(r => selectedReceiptIds.includes(String(r.id))).map(r => <article key={r.id} className="mb-8 break-after-page border border-slate-300 text-slate-900">
                        <header className="px-8 py-6 text-center" style={{ backgroundColor: receiptHeaderColor, printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
                            <h2 className="text-2xl font-black uppercase">{school?.school_name || "School"}</h2>
                            <p className="mt-1 text-sm font-semibold">{school?.address || school?.school_address || school?.postal_address || school?.location || ""}</p>
                            <p className="mt-3 text-lg font-extrabold tracking-widest">OFFICIAL SCHOOL FEES RECEIPT</p>
                            
                        </header>
                        <SchoolOfficialSeal className="px-8 pb-2" />
                        <div className="p-8">
                            <div className="mb-5 grid grid-cols-2 gap-x-8 gap-y-3 border-b pb-5 text-sm">
                                <p><b>Receipt Number:</b> {r.receipt_number}</p><p><b>Receipt Date:</b> {formatDate(r.receipt_date)}</p>
                                <p><b>Receipt Status:</b> {r.status || "Posted"}</p><p><b>Payment Method:</b> {r.payment_method || "Not specified"}</p>
                                <p><b>Parent / Payer:</b> {r.payer_name || "Not recorded"}</p><p><b>Payment Reference:</b> {r.reference_number || "Not provided"}</p>
                                <p><b>Student Name:</b> {r.student ? [r.student.first_name, r.student.middle_name, r.student.last_name].filter(Boolean).join(" ") : "Not linked"}</p>
                                <p><b>Admission Number:</b> {r.student?.admission_number || r.student?.admission_no || "Not available"}</p>
                                <p><b>Parent / Guardian:</b> {r.student?.parent_name || r.student?.guardian_name || r.payer_name || "Not recorded"}</p>
                                <p><b>School:</b> {school?.school_name || "School"}</p>
                            </div>
                            <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wide">Payment details</h3>
                            <table className="w-full border-collapse text-sm"><thead><tr className="bg-slate-100"><th className="border p-3 text-left">Description</th><th className="border p-3 text-right">Amount (TZS)</th></tr></thead><tbody><tr><td className="border p-3">{r.description || "School fees payment"}</td><td className="border p-3 text-right font-bold">{money(r.amount)}</td></tr></tbody><tfoot><tr><td className="border p-3 text-right font-extrabold">TOTAL RECEIVED</td><td className="border p-3 text-right text-lg font-black">{money(r.amount)} TZS</td></tr></tfoot></table>
                            <div className="mt-6 rounded-lg border border-slate-300 p-4"><p className="text-xs font-bold uppercase text-slate-600">Amount received</p><p className="mt-1 text-2xl font-black">{money(r.amount)} TZS</p><p className="mt-2 text-xs text-slate-600">This receipt confirms that the amount stated above was recorded as received by the school, subject to the school's financial records.</p></div>
                            <div className="mt-14 grid grid-cols-2 gap-12 text-center text-xs"><div><div className="mx-auto w-full max-w-56"><StaffSignatureImage schoolId={school?.id} profileId={r.issued_by} className="items-center" alt="Cashier signature" /></div><p className="mt-2">Cashier / Accountant signature</p></div><div><div className="mx-auto h-14 w-full max-w-56 border-b border-slate-500" aria-hidden="true" /><p className="mt-2">Parent / Payer acknowledgement</p></div></div>
                            <div className="mt-8 border-t pt-3 text-center text-xs text-slate-500"><p>Asante kwa kufanya malipo. Kwa ufafanuzi, wasiliana na ofisi ya shule.</p></div>
                        </div>
                    </article>)}</div>
                </section>
                {viewingReceipt && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="Receipt preview">
                    <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
                        <div className="sticky top-0 flex items-center justify-between border-b bg-white p-4"><h2 className="font-extrabold">Receipt preview · {viewingReceipt.receipt_number}</h2><button type="button" onClick={() => setViewingReceipt(null)} className="rounded-lg border px-3 py-1.5 text-sm font-bold">Close</button></div>
                        <article className="m-5 border border-slate-300 text-slate-900">
                            <header className="px-6 py-6 text-center" style={{ backgroundColor: receiptHeaderColor, printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}><h2 className="text-2xl font-black uppercase">{school?.school_name || "School"}</h2><p className="mt-1 text-sm font-semibold">{school?.address || school?.school_address || school?.postal_address || school?.location || ""}</p><p className="mt-3 text-lg font-extrabold tracking-widest">OFFICIAL SCHOOL FEES RECEIPT</p><p className="text-xs font-semibold">AFRICORE ERP PRO · ORIGINAL RECEIPT</p></header><SchoolOfficialSeal className="px-6 pb-2" />
                            <div className="p-6 text-sm"><div className="grid grid-cols-2 gap-3 border-b pb-5"><p><b>Receipt Number:</b> {viewingReceipt.receipt_number}</p><p><b>Date:</b> {formatDate(viewingReceipt.receipt_date)}</p><p><b>Parent / Payer:</b> {viewingReceipt.payer_name || "Not recorded"}</p><p><b>Student:</b> {viewingReceipt.student ? [viewingReceipt.student.first_name, viewingReceipt.student.middle_name, viewingReceipt.student.last_name].filter(Boolean).join(" ") : "Not linked"}</p><p><b>Admission Number:</b> {viewingReceipt.student?.admission_number || viewingReceipt.student?.admission_no || "Not available"}</p><p><b>Guardian:</b> {viewingReceipt.student?.parent_name || viewingReceipt.student?.guardian_name || "Not recorded"}</p><p><b>Payment Method:</b> {viewingReceipt.payment_method || "Not specified"}</p><p><b>Reference:</b> {viewingReceipt.reference_number || "Not provided"}</p><p><b>Status:</b> {viewingReceipt.status || "Posted"}</p><p><b>Amount:</b> <strong>{money(viewingReceipt.amount)} TZS</strong></p></div><h3 className="mt-5 font-extrabold">Payment description</h3><p className="mt-2 min-h-16 rounded-lg bg-slate-50 p-3">{viewingReceipt.description || "School fees payment"}</p><p className="mt-8 text-xs text-slate-500">Asante kwa kufanya malipo. Kwa ufafanuzi, wasiliana na ofisi ya shule.</p></div>
                        </article>
                        <div className="flex justify-end gap-2 border-t p-4"><button type="button" onClick={() => { setSelectedReceiptIds(current => current.includes(String(viewingReceipt.id)) ? current : [...current, String(viewingReceipt.id)]); setTimeout(() => window.print(), 0); }} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">Print this receipt</button><button type="button" onClick={() => setViewingReceipt(null)} className="rounded-xl border px-4 py-2 text-sm font-bold">Done</button></div>
                    </div>
                </div>}
                <style>{'@media print { @page { size: A4; margin: 12mm; } body * { visibility:hidden !important; } body .finance-receipt-print, body .finance-receipt-print * { visibility:visible !important; } body .finance-receipt-print { display:block !important; position:absolute; left:0; top:0; width:100%; padding:0; background:white; } .finance-receipt-print article { page-break-after:always; } }'}</style>

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
                            9 modules
                        </span>

                    </div>


                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">


                        {/* INCOME AND EXPENSES SUMMARY */}
                        <button
                            type="button"
                            onClick={() => navigate("/finance/income-expenses-summary")}
                            className="group bg-white border border-slate-200 rounded-2xl p-4 text-left hover:border-emerald-300 hover:shadow-md transition"
                        >
                            <div className="flex items-center justify-between">
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                                    <FaChartPie />
                                </div>
                                <FaArrowRight className="text-slate-300 group-hover:text-emerald-600 transition" />
                            </div>
                            <h3 className="font-bold text-slate-900 mt-4">
                                Income and Expenses Summary
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Analyse actual income sources and expense categories.
                            </p>
                        </button>


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


                        {/* CASH & FINANCIAL ACCOUNTS */}
                        <button
                            type="button"
                            onClick={() => navigate("/finance/cash-accounts")}
                            className="group bg-white border border-slate-200 rounded-2xl p-4 text-left hover:border-violet-300 hover:shadow-md transition"
                        >
                            <div className="flex items-center justify-between">
                                <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                                    <FaWallet />
                                </div>
                                <FaArrowRight className="text-slate-300 group-hover:text-violet-600 transition" />
                            </div>
                            <h3 className="font-bold text-slate-900 mt-4">Cash & Financial Accounts</h3>
                            <p className="text-xs text-slate-500 mt-1">Register bank, cash and mobile money accounts for receiving payments.</p>
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