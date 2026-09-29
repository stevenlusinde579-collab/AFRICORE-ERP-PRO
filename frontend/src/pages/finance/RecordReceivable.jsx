import React, {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    FaArrowLeft,
    FaCalendarAlt,
    FaCheckCircle,
    FaExclamationTriangle,
    FaFileInvoiceDollar,
    FaMoneyBillWave,
    FaRedo,
    FaSearch,
    FaSpinner,
    FaUniversity,
    FaUserTie,
    FaWallet,
} from "react-icons/fa";

import { Link } from "react-router-dom";

import { supabase } from "../../services/supabase";


// ============================================================
// HELPERS
// ============================================================

const today = () => {
    const date = new Date();

    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
    ].join("-");
};

const money = (value) =>
    new Intl.NumberFormat("en-TZ", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(Number(value) || 0);

const staffName = (staff) =>
    [
        staff?.first_name,
        staff?.middle_name,
        staff?.last_name,
    ]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .join(" ") || "Unknown Staff";

const statusClass = (status) => {
    const value = String(status || "").toLowerCase();

    if (value === "paid") {
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }

    if (value === "partial") {
        return "bg-amber-50 text-amber-700 border-amber-200";
    }

    if (value === "voided") {
        return "bg-slate-100 text-slate-500 border-slate-200";
    }

    return "bg-blue-50 text-blue-700 border-blue-200";
};

const statusLabel = (status) => {
    const value = String(status || "open").toLowerCase();

    if (value === "paid") return "Paid";
    if (value === "partial") return "Partial";
    if (value === "voided") return "Voided";

    return "Open";
};


// ============================================================
// EMPTY FORMS
// ============================================================

const EMPTY_ADVANCE = {
    staff_id: "",
    amount: "",
    advance_date: today(),
    due_date: "",
    financial_account_id: "",
    payment_method: "bank",
    reference_number: "",
    description: "",
};

const EMPTY_REPAYMENT = {
    receivable_id: "",
    amount: "",
    payment_date: today(),
    financial_account_id: "",
    payment_method: "bank",
    provider_name: "",
    reference_number: "",
    description: "",
};


// ============================================================
// COMPONENT
// ============================================================

function RecordReceivable() {
    const [profile, setProfile] = useState(null);
    const [staff, setStaff] = useState([]);
    const [financialAccounts, setFinancialAccounts] = useState([]);
    const [receivables, setReceivables] = useState([]);
    const [repaymentHistory, setRepaymentHistory] = useState([]);

    const [advanceForm, setAdvanceForm] = useState(EMPTY_ADVANCE);
    const [repaymentForm, setRepaymentForm] = useState(EMPTY_REPAYMENT);

    const [staffSearch, setStaffSearch] = useState("");
    const [receivableSearch, setReceivableSearch] = useState("");

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [savingAdvance, setSavingAdvance] = useState(false);
    const [savingRepayment, setSavingRepayment] = useState(false);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");


    // =========================================================
    // PROFILE
    // =========================================================

    const loadProfile = async () => {
        const {
            data: authData,
            error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
            throw authError;
        }

        const user = authData?.user;

        if (!user?.id) {
            throw new Error("User session not found.");
        }

        const {
            data,
            error: profileError,
        } = await supabase
            .from("profiles")
            .select("id, school_id, role_id, full_name")
            .eq("id", user.id)
            .maybeSingle();

        if (profileError) {
            throw profileError;
        }

        if (!data?.school_id) {
            throw new Error("User profile is not assigned to a school.");
        }

        setProfile(data);

        return data;
    };


    // =========================================================
    // LOAD STAFF
    // =========================================================

    const loadStaff = async (profileOverride = null) => {
        const currentProfile =
            profileOverride ||
            profile ||
            (await loadProfile());

        const {
            data,
            error: staffError,
        } = await supabase
            .from("teachers")
            .select(`
                id,
                school_id,
                employee_number,
                first_name,
                middle_name,
                last_name,
                phone,
                email,
                staff_type,
                status
            `)
            .eq("school_id", Number(currentProfile.school_id))
            .ilike("status", "active")
            .order("first_name", { ascending: true })
            .order("last_name", { ascending: true });

        if (staffError) {
            throw staffError;
        }

        const normalized = Array.isArray(data) ? data : [];

        setStaff(normalized);

        return normalized;
    };


    // =========================================================
    // LOAD FINANCIAL ACCOUNTS
    // =========================================================

    const loadFinancialAccounts = async (profileOverride = null) => {
        const currentProfile =
            profileOverride ||
            profile ||
            (await loadProfile());

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
            .eq("school_id", Number(currentProfile.school_id))
            .eq("is_active", true)
            .order("account_name", { ascending: true });

        if (accountsError) {
            throw accountsError;
        }

        const normalized = Array.isArray(data) ? data : [];

        setFinancialAccounts(normalized);

        return normalized;
    };


    // =========================================================
    // LOAD RECEIVABLES
    // =========================================================

    const loadReceivables = async (profileOverride = null) => {
        const currentProfile =
            profileOverride ||
            profile ||
            (await loadProfile());

        const {
            data,
            error: receivablesError,
        } = await supabase
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
                journal_entry_id,
                created_by,
                created_at,
                updated_at
            `)
            .eq("school_id", Number(currentProfile.school_id))
            .order("advance_date", { ascending: false })
            .order("created_at", { ascending: false });

        if (receivablesError) {
            throw receivablesError;
        }

        const normalized = Array.isArray(data) ? data : [];

        setReceivables(normalized);

        return normalized;
    };


    // =========================================================
    // LOAD PAYMENT HISTORY
    // =========================================================

    const loadRepaymentHistory = async (profileOverride = null) => {
        const currentProfile =
            profileOverride ||
            profile ||
            (await loadProfile());

        const {
            data,
            error: paymentsError,
        } = await supabase
            .schema("finance")
            .from("staff_receivable_payments")
            .select(`
                id,
                payment_number,
                staff_receivable_id,
                staff_id,
                payment_date,
                amount,
                financial_account_id,
                payment_method,
                provider_name,
                reference_number,
                description,
                status,
                journal_entry_id,
                created_at
            `)
            .eq("school_id", Number(currentProfile.school_id))
            .order("payment_date", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(200);

        if (paymentsError) {
            throw paymentsError;
        }

        const normalized = Array.isArray(data) ? data : [];

        setRepaymentHistory(normalized);

        return normalized;
    };


    // =========================================================
    // LOAD ALL
    // =========================================================

    const loadAll = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            setError("");

            const currentProfile =
                profile ||
                (await loadProfile());

            await Promise.all([
                loadStaff(currentProfile),
                loadFinancialAccounts(currentProfile),
                loadReceivables(currentProfile),
                loadRepaymentHistory(currentProfile),
            ]);
        } catch (err) {
            console.error("STAFF RECEIVABLE LOAD ERROR:", err);

            setError(
                err?.message ||
                "Failed to load staff receivables."
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };


    // =========================================================
    // INITIAL LOAD
    // =========================================================

    useEffect(() => {
        loadAll(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    // =========================================================
    // FILTERED STAFF
    // =========================================================

    const filteredStaff = useMemo(() => {
        const query = String(staffSearch || "")
            .trim()
            .toLowerCase();

        if (!query) {
            return staff;
        }

        return staff.filter((person) => {
            const haystack = [
                staffName(person),
                person.employee_number,
                person.phone,
                person.email,
                person.staff_type,
            ]
                .map((value) => String(value || "").toLowerCase())
                .join(" ");

            return haystack.includes(query);
        });
    }, [staff, staffSearch]);


    // =========================================================
    // FILTERED RECEIVABLES
    // =========================================================

    const filteredReceivables = useMemo(() => {
        const query = String(receivableSearch || "")
            .trim()
            .toLowerCase();

        const activeRows = receivables.filter(
            (row) => String(row.status || "").toLowerCase() !== "voided"
        );

        if (!query) {
            return activeRows;
        }

        return activeRows.filter((row) => {
            const person = staff.find(
                (item) => String(item.id) === String(row.staff_id)
            );

            const haystack = [
                staffName(person),
                person?.employee_number,
                row.reference_number,
                row.description,
                row.status,
            ]
                .map((value) => String(value || "").toLowerCase())
                .join(" ");

            return haystack.includes(query);
        });
    }, [receivables, receivableSearch, staff]);


    // =========================================================
    // SELECTED RECEIVABLE
    // =========================================================

    const selectedReceivable = useMemo(() => {
        return (
            receivables.find(
                (row) =>
                    String(row.id) ===
                    String(repaymentForm.receivable_id)
            ) || null
        );
    }, [receivables, repaymentForm.receivable_id]);


    // =========================================================
    // STAFF LOOKUP
    // =========================================================

    const staffById = useMemo(() => {
        const map = new Map();

        staff.forEach((person) => {
            map.set(String(person.id), person);
        });

        return map;
    }, [staff]);


    const selectedAdvanceStaff =
        staffById.get(String(advanceForm.staff_id)) || null;

    const selectedRepaymentStaff = selectedReceivable
        ? staffById.get(String(selectedReceivable.staff_id)) || null
        : null;


    // =========================================================
    // SUMMARY
    // =========================================================

    const summary = useMemo(() => {
        const totalAdvanced = receivables.reduce(
            (total, row) => total + Number(row.amount || 0),
            0
        );

        const totalPaid = receivables.reduce(
            (total, row) => total + Number(row.paid_amount || 0),
            0
        );

        const totalOutstanding = receivables.reduce(
            (total, row) => total + Number(row.balance || 0),
            0
        );

        const openCount = receivables.filter(
            (row) =>
                Number(row.balance || 0) > 0 &&
                String(row.status || "").toLowerCase() !== "voided"
        ).length;

        return {
            totalAdvanced,
            totalPaid,
            totalOutstanding,
            openCount,
        };
    }, [receivables]);


    // =========================================================
    // FORM HANDLERS
    // =========================================================

    const updateAdvance = (field, value) => {
        setAdvanceForm((current) => ({
            ...current,
            [field]: value,
        }));
    };

    const updateRepayment = (field, value) => {
        setRepaymentForm((current) => ({
            ...current,
            [field]: value,
        }));
    };


    // =========================================================
    // CREATE STAFF RECEIVABLE / SALARY ADVANCE
    // =========================================================

    const handleCreateAdvance = async (event) => {
        event.preventDefault();

        try {
            setSavingAdvance(true);
            setError("");
            setSuccess("");

            if (!advanceForm.staff_id) {
                throw new Error("Select a staff member first.");
            }

            const amount = Number(advanceForm.amount);

            if (!Number.isFinite(amount) || amount <= 0) {
                throw new Error("Salary advance amount must be greater than zero.");
            }

            if (!advanceForm.advance_date) {
                throw new Error("Advance date is required.");
            }

            if (
                advanceForm.due_date &&
                advanceForm.due_date < advanceForm.advance_date
            ) {
                throw new Error("Due date cannot be before advance date.");
            }

            if (!advanceForm.financial_account_id) {
                throw new Error("Select the financial account used to give the advance.");
            }

            if (!advanceForm.payment_method) {
                throw new Error("Payment method is required.");
            }

            const account = financialAccounts.find(
                (item) =>
                    String(item.id) ===
                    String(advanceForm.financial_account_id)
            );

            if (!account) {
                throw new Error("Selected financial account was not found.");
            }

            if (!account.chart_of_account_id) {
                throw new Error(
                    `Financial account "${account.account_name}" is not linked to a Chart of Account.`
                );
            }

            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError) {
                throw userError;
            }

            if (!user?.id) {
                throw new Error("User session not found.");
            }

            const { data, error: rpcError } = await supabase
                .schema("finance")
                .rpc("record_staff_salary_advance", {
                    p_staff_id: Number(advanceForm.staff_id),
                    p_amount: amount,
                    p_financial_account_id: Number(
                        advanceForm.financial_account_id
                    ),
                    p_payment_method: advanceForm.payment_method,
                    p_advance_date: advanceForm.advance_date,
                    p_due_date: advanceForm.due_date || null,
                    p_reference_number:
                        advanceForm.reference_number.trim() || null,
                    p_description:
                        advanceForm.description.trim() || null,
                    p_created_by: user.id,
                });

            if (rpcError) {
                throw rpcError;
            }

            const created = Array.isArray(data)
                ? data[0]
                : data;

            setSuccess(
                `Salary advance ya ${money(created?.amount || amount)} imerekodiwa kwa ${staffName(selectedAdvanceStaff)} na accounting entries zimehifadhiwa.`
            );

            setAdvanceForm({
                ...EMPTY_ADVANCE,
                advance_date: today(),
                due_date: "",
            });

            await loadAll(true);
        } catch (err) {
            console.error("CREATE STAFF RECEIVABLE ERROR:", err);

            setError(
                err?.message ||
                "Failed to record staff salary advance."
            );
        } finally {
            setSavingAdvance(false);
        }
    };


    // =========================================================
    // RECORD REPAYMENT
    // =========================================================

    const handleRecordRepayment = async (event) => {
        event.preventDefault();

        try {
            setSavingRepayment(true);
            setError("");
            setSuccess("");

            if (!selectedReceivable) {
                throw new Error("Select the staff receivable being repaid.");
            }

            const amount = Number(repaymentForm.amount);
            const balance = Number(selectedReceivable.balance || 0);

            if (!Number.isFinite(amount) || amount <= 0) {
                throw new Error("Repayment amount must be greater than zero.");
            }

            if (amount > balance) {
                throw new Error(
                    `Repayment cannot exceed the outstanding balance of ${money(balance)}.`
                );
            }

            if (!repaymentForm.payment_date) {
                throw new Error("Payment date is required.");
            }

            if (!repaymentForm.financial_account_id) {
                throw new Error("Select the financial account receiving the repayment.");
            }

            if (!repaymentForm.payment_method) {
                throw new Error("Payment method is required.");
            }

            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError) {
                throw userError;
            }

            if (!user?.id) {
                throw new Error("User session not found.");
            }

            const { data, error: rpcError } = await supabase
                .schema("finance")
                .rpc("record_staff_receivable_payment", {
                    p_staff_receivable_id:
                        repaymentForm.receivable_id,
                    p_amount: amount,
                    p_financial_account_id: Number(
                        repaymentForm.financial_account_id
                    ),
                    p_payment_method: repaymentForm.payment_method,
                    p_payment_date: repaymentForm.payment_date,
                    p_provider_name:
                        repaymentForm.provider_name.trim() || null,
                    p_reference_number:
                        repaymentForm.reference_number.trim() || null,
                    p_description:
                        repaymentForm.description.trim() || null,
                    p_created_by: user.id,
                });

            if (rpcError) {
                throw rpcError;
            }

            const result = Array.isArray(data)
                ? data[0]
                : data;

            const remaining = Number(result?.new_balance || 0);

            setSuccess(
                `Repayment ya ${money(amount)} imepokelewa. Balance ya ${staffName(selectedRepaymentStaff)} sasa ni ${money(remaining)}.`
            );

            setRepaymentForm({
                ...EMPTY_REPAYMENT,
                payment_date: today(),
            });

            await loadAll(true);
        } catch (err) {
            console.error("STAFF RECEIVABLE PAYMENT ERROR:", err);

            setError(
                err?.message ||
                "Failed to record staff receivable repayment."
            );
        } finally {
            setSavingRepayment(false);
        }
    };


    // =========================================================
    // SELECT RECEIVABLE FOR PAYMENT
    // =========================================================

    const selectReceivableForPayment = (row) => {
        const balance = Number(row.balance || 0);

        setRepaymentForm((current) => ({
            ...current,
            receivable_id: row.id,
            amount: balance > 0 ? String(balance) : "",
            payment_date: today(),
        }));

        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    };


    // =========================================================
    // LOADING SCREEN
    // =========================================================

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm flex items-center gap-3">
                    <FaSpinner className="animate-spin text-blue-600" />
                    <span className="text-sm font-semibold text-slate-600">
                        Loading staff receivables...
                    </span>
                </div>
            </div>
        );
    }


    // =========================================================
    // UI
    // =========================================================

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl">

                {/* ====================================================
                    HEADER
                ==================================================== */}

                <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                        <Link
                            to="/finance/dashboard"
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100"
                        >
                            <FaArrowLeft />
                        </Link>

                        <div>
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
                                    <FaUserTie />
                                </div>

                                <div>
                                    <h1 className="text-2xl font-bold text-slate-900">
                                        Staff Receivables
                                    </h1>

                                    <p className="mt-1 text-sm text-slate-500">
                                        Salary advances, staff repayments and outstanding balances.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => loadAll(true)}
                        disabled={refreshing || savingAdvance || savingRepayment}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <FaRedo className={refreshing ? "animate-spin" : ""} />
                        {refreshing ? "Refreshing..." : "Refresh"}
                    </button>
                </div>


                {/* ====================================================
                    MESSAGES
                ==================================================== */}

                {error && (
                    <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        <div className="flex items-start gap-3">
                            <FaExclamationTriangle className="mt-0.5 shrink-0" />
                            <div>
                                <p className="font-bold">Transaction Error</p>
                                <p className="mt-1">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                {success && (
                    <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        <div className="flex items-start gap-3">
                            <FaCheckCircle className="mt-0.5 shrink-0" />
                            <div>
                                <p className="font-bold">Transaction Successful</p>
                                <p className="mt-1">{success}</p>
                            </div>
                        </div>
                    </div>
                )}


                {/* ====================================================
                    SUMMARY
                ==================================================== */}

                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Total Advanced
                        </p>
                        <p className="mt-2 text-2xl font-bold text-slate-900">
                            {money(summary.totalAdvanced)}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                            Gross salary advances issued
                        </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Total Repaid
                        </p>
                        <p className="mt-2 text-2xl font-bold text-emerald-600">
                            {money(summary.totalPaid)}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                            Cash / bank received back
                        </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Outstanding
                        </p>
                        <p className="mt-2 text-2xl font-bold text-indigo-600">
                            {money(summary.totalOutstanding)}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                            Staff money still recoverable
                        </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Open Advances
                        </p>
                        <p className="mt-2 text-2xl font-bold text-amber-600">
                            {summary.openCount}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                            Staff receivables with balance
                        </p>
                    </div>
                </div>


                {/* ====================================================
                    CREATE STAFF RECEIVABLE
                ==================================================== */}

                <form
                    onSubmit={handleCreateAdvance}
                    className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                    <div className="border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-white px-5 py-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
                                <FaFileInvoiceDollar />
                            </div>
                            <div>
                                <h2 className="font-bold text-slate-900">
                                    Create Staff Receivable
                                </h2>
                                <p className="mt-1 text-xs text-slate-500">
                                    Record salary advance issued to a staff member.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2 xl:grid-cols-4">
                        <div className="xl:col-span-2">
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                                Staff Member
                            </label>

                            <div className="mb-2 relative">
                                <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={staffSearch}
                                    onChange={(event) => setStaffSearch(event.target.value)}
                                    placeholder="Search staff by name, employee no. or phone..."
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                />
                            </div>

                            <select
                                value={advanceForm.staff_id}
                                onChange={(event) => updateAdvance("staff_id", event.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                            >
                                <option value="">Select Staff</option>
                                {filteredStaff.map((person) => (
                                    <option key={person.id} value={person.id}>
                                        {staffName(person)} — {person.employee_number || "No Employee No."} — {person.staff_type || "Staff"}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                                Advance Amount
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={advanceForm.amount}
                                onChange={(event) => updateAdvance("amount", event.target.value)}
                                placeholder="0.00"
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                                Advance Date
                            </label>
                            <div className="relative">
                                <FaCalendarAlt className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="date"
                                    value={advanceForm.advance_date}
                                    onChange={(event) => updateAdvance("advance_date", event.target.value)}
                                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                                Due Date
                            </label>
                            <input
                                type="date"
                                value={advanceForm.due_date}
                                min={advanceForm.advance_date || undefined}
                                onChange={(event) => updateAdvance("due_date", event.target.value)}
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                                Payment Method
                            </label>
                            <select
                                value={advanceForm.payment_method}
                                onChange={(event) => updateAdvance("payment_method", event.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                            >
                                <option value="cash">Cash</option>
                                <option value="bank">Bank</option>
                                <option value="mobile_money">Mobile Money</option>
                                <option value="cheque">Cheque</option>
                                <option value="other">Other</option>
                            </select>
                        </div>

                        <div className="xl:col-span-2">
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                                Account Giving the Advance
                            </label>
                            <select
                                value={advanceForm.financial_account_id}
                                onChange={(event) => updateAdvance("financial_account_id", event.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                            >
                                <option value="">Select Cash / Bank Account</option>
                                {financialAccounts.map((account) => (
                                    <option key={account.id} value={account.id}>
                                        {account.account_name} — Balance {money(account.current_balance)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="xl:col-span-2">
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                                Reference Number
                            </label>
                            <input
                                type="text"
                                value={advanceForm.reference_number}
                                onChange={(event) => updateAdvance("reference_number", event.target.value)}
                                placeholder="Advance reference / voucher no."
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                            />
                        </div>

                        <div className="md:col-span-2 xl:col-span-4">
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                                Description
                            </label>
                            <textarea
                                rows="2"
                                value={advanceForm.description}
                                onChange={(event) => updateAdvance("description", event.target.value)}
                                placeholder="Optional notes about the salary advance..."
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                            />
                        </div>
                    </div>

                    <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <p className="text-xs font-semibold text-slate-500">
                                    Accounting Preview
                                </p>
                                <p className="mt-1 text-sm text-slate-700">
                                    Dr <span className="font-bold">Staff Salary Advances Receivable (1120)</span>
                                    {" "} / Cr <span className="font-bold">
                                        {financialAccounts.find(
                                            (item) =>
                                                String(item.id) ===
                                                String(advanceForm.financial_account_id)
                                        )?.account_name || "Cash / Bank"}
                                    </span>
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={savingAdvance}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {savingAdvance ? (
                                    <FaSpinner className="animate-spin" />
                                ) : (
                                    <FaMoneyBillWave />
                                )}
                                {savingAdvance ? "Saving..." : "Issue Salary Advance"}
                            </button>
                        </div>
                    </div>
                </form>


                {/* ====================================================
                    RECORD REPAYMENT
                ==================================================== */}

                <form
                    onSubmit={handleRecordRepayment}
                    className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                    <div className="border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-white px-5 py-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
                                <FaWallet />
                            </div>
                            <div>
                                <h2 className="font-bold text-slate-900">
                                    Record Staff Receivable Payment
                                </h2>
                                <p className="mt-1 text-xs text-slate-500">
                                    Record money returned by staff against a salary advance.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2 xl:grid-cols-4">
                        <div className="md:col-span-2 xl:col-span-2">
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                                Staff Receivable
                            </label>

                            <select
                                value={repaymentForm.receivable_id}
                                onChange={(event) => {
                                    const row = receivables.find(
                                        (item) =>
                                            String(item.id) ===
                                            String(event.target.value)
                                    );

                                    updateRepayment(
                                        "receivable_id",
                                        event.target.value
                                    );

                                    updateRepayment(
                                        "amount",
                                        row && Number(row.balance || 0) > 0
                                            ? String(row.balance)
                                            : ""
                                    );
                                }}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                            >
                                <option value="">Select outstanding staff receivable</option>
                                {receivables
                                    .filter(
                                        (row) => Number(row.balance || 0) > 0 &&
                                            String(row.status || "").toLowerCase() !== "voided"
                                    )
                                    .map((row) => {
                                        const person = staffById.get(String(row.staff_id));

                                        return (
                                            <option key={row.id} value={row.id}>
                                                {staffName(person)} — Ref {row.reference_number || "-"} — Outstanding {money(row.balance)}
                                            </option>
                                        );
                                    })}
                            </select>
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                                Outstanding Balance
                            </label>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-indigo-700">
                                {money(selectedReceivable?.balance || 0)}
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                                Repayment Amount
                            </label>
                            <input
                                type="number"
                                min="0"
                                max={selectedReceivable?.balance || undefined}
                                step="0.01"
                                value={repaymentForm.amount}
                                onChange={(event) => updateRepayment("amount", event.target.value)}
                                placeholder="0.00"
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                                Payment Date
                            </label>
                            <input
                                type="date"
                                value={repaymentForm.payment_date}
                                onChange={(event) => updateRepayment("payment_date", event.target.value)}
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                                Payment Method
                            </label>
                            <select
                                value={repaymentForm.payment_method}
                                onChange={(event) => updateRepayment("payment_method", event.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                            >
                                <option value="cash">Cash</option>
                                <option value="bank">Bank</option>
                                <option value="mobile_money">Mobile Money</option>
                                <option value="cheque">Cheque</option>
                                <option value="other">Other</option>
                            </select>
                        </div>

                        <div className="xl:col-span-2">
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                                Receiving Account
                            </label>
                            <select
                                value={repaymentForm.financial_account_id}
                                onChange={(event) => updateRepayment("financial_account_id", event.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                            >
                                <option value="">Select Cash / Bank Account</option>
                                {financialAccounts.map((account) => (
                                    <option key={account.id} value={account.id}>
                                        {account.account_name} — Balance {money(account.current_balance)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                                Provider
                            </label>
                            <input
                                type="text"
                                value={repaymentForm.provider_name}
                                onChange={(event) => updateRepayment("provider_name", event.target.value)}
                                placeholder="Bank / Mobile provider"
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                                Reference
                            </label>
                            <input
                                type="text"
                                value={repaymentForm.reference_number}
                                onChange={(event) => updateRepayment("reference_number", event.target.value)}
                                placeholder="Receipt / transaction no."
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                            />
                        </div>

                        <div className="md:col-span-2 xl:col-span-4">
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                                Description
                            </label>
                            <textarea
                                rows="2"
                                value={repaymentForm.description}
                                onChange={(event) => updateRepayment("description", event.target.value)}
                                placeholder="Optional repayment notes..."
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                            />
                        </div>
                    </div>

                    <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <p className="text-xs font-semibold text-slate-500">
                                    Accounting Preview
                                </p>
                                <p className="mt-1 text-sm text-slate-700">
                                    Dr <span className="font-bold">
                                        {financialAccounts.find(
                                            (item) =>
                                                String(item.id) ===
                                                String(repaymentForm.financial_account_id)
                                        )?.account_name || "Cash / Bank"}
                                    </span>
                                    {" "} / Cr <span className="font-bold">Staff Salary Advances Receivable (1120)</span>
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={savingRepayment || !selectedReceivable}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {savingRepayment ? (
                                    <FaSpinner className="animate-spin" />
                                ) : (
                                    <FaCheckCircle />
                                )}
                                {savingRepayment ? "Saving..." : "Record Repayment"}
                            </button>
                        </div>
                    </div>
                </form>


                {/* ====================================================
                    RECEIVABLE REGISTER
                ==================================================== */}

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h2 className="font-bold text-slate-900">
                                Staff Receivable Register
                            </h2>
                            <p className="mt-1 text-xs text-slate-500">
                                Salary advances and their repayment status.
                            </p>
                        </div>

                        <div className="relative w-full lg:w-80">
                            <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={receivableSearch}
                                onChange={(event) => setReceivableSearch(event.target.value)}
                                placeholder="Search staff / reference..."
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                    </div>

                    {filteredReceivables.length === 0 ? (
                        <div className="px-5 py-14 text-center">
                            <FaFileInvoiceDollar className="mx-auto text-4xl text-slate-300" />
                            <p className="mt-3 text-sm font-bold text-slate-600">
                                No staff receivables found
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                                Create a salary advance above to start the staff receivable register.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-[1150px] w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Staff</th>
                                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Ref</th>
                                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Advance Date</th>
                                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Due Date</th>
                                        <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">Advance</th>
                                        <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">Paid</th>
                                        <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">Balance</th>
                                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Status</th>
                                        <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">Action</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100">
                                    {filteredReceivables.map((row) => {
                                        const person = staffById.get(String(row.staff_id));
                                        const balance = Number(row.balance || 0);

                                        return (
                                            <tr key={row.id} className="hover:bg-slate-50/70">
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                                                            <FaUserTie />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-800">
                                                                {staffName(person)}
                                                            </p>
                                                            <p className="mt-0.5 text-xs text-slate-500">
                                                                {person?.employee_number || "-"} · {person?.staff_type || "Staff"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-4 py-4 text-sm text-slate-600">
                                                    {row.reference_number || "-"}
                                                </td>

                                                <td className="px-4 py-4 text-sm text-slate-600">
                                                    {row.advance_date || "-"}
                                                </td>

                                                <td className="px-4 py-4 text-sm text-slate-600">
                                                    {row.due_date || "-"}
                                                </td>

                                                <td className="px-4 py-4 text-right text-sm font-bold text-slate-800">
                                                    {money(row.amount)}
                                                </td>

                                                <td className="px-4 py-4 text-right text-sm font-semibold text-emerald-600">
                                                    {money(row.paid_amount)}
                                                </td>

                                                <td className="px-4 py-4 text-right text-sm font-bold text-indigo-600">
                                                    {money(balance)}
                                                </td>

                                                <td className="px-4 py-4">
                                                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(row.status)}`}>
                                                        {statusLabel(row.status)}
                                                    </span>
                                                </td>

                                                <td className="px-4 py-4 text-right">
                                                    {balance > 0 ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => selectReceivableForPayment(row)}
                                                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                                                        >
                                                            <FaMoneyBillWave />
                                                            Pay
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs font-semibold text-slate-400">
                                                            Settled
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>


                {/* ====================================================
                    RECENT REPAYMENTS
                ==================================================== */}

                <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-5 py-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                                <FaCheckCircle />
                            </div>
                            <div>
                                <h2 className="font-bold text-slate-900">
                                    Recent Repayments
                                </h2>
                                <p className="mt-1 text-xs text-slate-500">
                                    Payments received against staff salary advances.
                                </p>
                            </div>
                        </div>
                    </div>

                    {repaymentHistory.length === 0 ? (
                        <div className="px-5 py-10 text-center text-sm text-slate-500">
                            No staff receivable repayment has been recorded yet.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-[950px] w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Payment No.</th>
                                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Staff</th>
                                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Date</th>
                                        <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">Amount</th>
                                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Method</th>
                                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Reference</th>
                                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Status</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100">
                                    {repaymentHistory.slice(0, 20).map((payment) => {
                                        const person = staffById.get(String(payment.staff_id));

                                        return (
                                            <tr key={payment.id} className="hover:bg-slate-50/70">
                                                <td className="px-4 py-3 text-sm font-semibold text-slate-700">
                                                    {payment.payment_number || "-"}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                                                    {staffName(person)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-600">
                                                    {payment.payment_date || "-"}
                                                </td>
                                                <td className="px-4 py-3 text-right text-sm font-bold text-emerald-600">
                                                    {money(payment.amount)}
                                                </td>
                                                <td className="px-4 py-3 text-sm capitalize text-slate-600">
                                                    {String(payment.payment_method || "-").replaceAll("_", " ")}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-600">
                                                    {payment.reference_number || "-"}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(payment.status === "posted" ? "paid" : payment.status)}`}>
                                                        {payment.status === "posted" ? "Posted" : String(payment.status || "-")}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}

export default RecordReceivable;
