import React, { useEffect, useMemo, useState } from "react";

import {
    FaArrowLeft,
    FaCalendarAlt,
    FaCheckCircle,
    FaClipboardList,
    FaExclamationTriangle,
    FaMoneyBillWave,
    FaPlus,
    FaRedo,
    FaSearch,
    FaSpinner,
    FaUniversity,
    FaWallet,
} from "react-icons/fa";

import { useNavigate } from "react-router-dom";

import { supabase } from "../../services/supabase";


// ============================================================
// HELPERS
// ============================================================

const today = () =>
    new Date().toISOString().slice(0, 10);

const money = value =>
    new Intl.NumberFormat("en-TZ", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(Number(value) || 0);

const normalizeNumber = value => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
};

const getSupplierName = supplier =>
    supplier?.supplier_name ||
    supplier?.name ||
    "Unknown Supplier";

const getPaymentMethodLabel = accountType => {
    switch (String(accountType || "").toLowerCase()) {
        case "cash":
            return "Cash";
        case "bank":
            return "Bank";
        case "mobile_money":
            return "Mobile Money";
        default:
            return accountType || "Account";
    }
};


// ============================================================
// COMPONENT
// ============================================================

function RecordPayable() {
    const navigate = useNavigate();

    const [profile, setProfile] = useState(null);
    const [suppliers, setSuppliers] = useState([]);
    const [bills, setBills] = useState([]);
    const [financialAccounts, setFinancialAccounts] = useState([]);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);

    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    const [supplierFilter, setSupplierFilter] = useState("");
    const [search, setSearch] = useState("");

    const [selectedBill, setSelectedBill] = useState(null);

    const [paymentForm, setPaymentForm] = useState({
        payment_date: today(),
        amount: "",
        financial_account_id: "",
        payment_method: "",
        reference_number: "",
        description: "",
    });


    // ============================================================
    // PROFILE
    // ============================================================

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
            data: profileData,
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
            .single();

        if (profileError) {
            throw profileError;
        }

        if (!profileData?.school_id) {
            throw new Error("Your profile is not assigned to a school.");
        }

        setProfile(profileData);
        return profileData;
    };


    // ============================================================
    // LOAD SUPPLIERS
    // ============================================================

    const loadSuppliers = async schoolId => {
        const {
            data,
            error: supplierError,
        } = await supabase
            .schema("finance")
            .from("suppliers")
            .select(`
                id,
                school_id,
                supplier_name,
                phone,
                email,
                address,
                opening_balance,
                current_balance,
                is_active,
                created_at
            `)
            .eq("school_id", Number(schoolId))
            .eq("is_active", true)
            .order("supplier_name", {
                ascending: true,
            });

        if (supplierError) {
            throw supplierError;
        }

        const rows = Array.isArray(data) ? data : [];
        setSuppliers(rows);
        return rows;
    };


    // ============================================================
    // LOAD OUTSTANDING BILLS
    // ============================================================

    const loadBills = async schoolId => {
        const {
            data,
            error: billError,
        } = await supabase
            .schema("finance")
            .from("supplier_bills")
            .select(`
                id,
                school_id,
                supplier_id,
                bill_number,
                bill_date,
                due_date,
                expense_account_id,
                description,
                amount,
                paid_amount,
                balance,
                status,
                journal_entry_id,
                created_by,
                approved_by,
                created_at,
                updated_at,
                expense_id
            `)
            .eq("school_id", Number(schoolId))
            .gt("balance", 0)
            .order("bill_date", {
                ascending: false,
            })
            .order("created_at", {
                ascending: false,
            });

        if (billError) {
            throw billError;
        }

        const rows = Array.isArray(data) ? data : [];
        setBills(rows);
        return rows;
    };


    // ============================================================
    // LOAD PAYMENT ACCOUNTS
    //
    // IMPORTANT:
    // pay_supplier_bill expects public.financial_accounts.id.
    // ============================================================

    const loadFinancialAccounts = async schoolId => {
        const {
            data,
            error: accountError,
        } = await supabase
            .from("financial_accounts")
            .select(`
                id,
                school_id,
                account_name,
                account_type,
                account_number,
                bank_name,
                current_balance,
                chart_of_account_id
            `)
            .eq("school_id", Number(schoolId))
            .in("account_type", [
                "cash",
                "bank",
                "mobile_money",
            ])
            .order("account_name", {
                ascending: true,
            });

        if (accountError) {
            throw accountError;
        }

        const rows = Array.isArray(data) ? data : [];
        setFinancialAccounts(rows);
        return rows;
    };


    // ============================================================
    // LOAD ALL
    // ============================================================

    const loadAll = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            setError("");
            setSuccessMessage("");

            const currentProfile =
                profile ||
                await loadProfile();

            await Promise.all([
                loadSuppliers(currentProfile.school_id),
                loadBills(currentProfile.school_id),
                loadFinancialAccounts(currentProfile.school_id),
            ]);
        } catch (err) {
            console.error("Record Payable loading error:", err);
            setError(
                err?.message ||
                "Failed to load supplier payable data."
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadAll(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    // ============================================================
    // SUPPLIER LOOKUP
    // ============================================================

    const supplierMap = useMemo(() => {
        const map = new Map();

        suppliers.forEach(supplier => {
            map.set(String(supplier.id), supplier);
        });

        return map;
    }, [suppliers]);


    // ============================================================
    // FILTER BILLS
    // ============================================================

    const filteredBills = useMemo(() => {
        const term = search.trim().toLowerCase();

        return bills.filter(bill => {
            const supplier = supplierMap.get(
                String(bill.supplier_id)
            );

            const supplierName = getSupplierName(supplier);
            const billNumber = String(
                bill.bill_number || ""
            );
            const description = String(
                bill.description || ""
            );

            const supplierMatch =
                !supplierFilter ||
                String(bill.supplier_id) ===
                    String(supplierFilter);

            const searchMatch =
                !term ||
                supplierName.toLowerCase().includes(term) ||
                billNumber.toLowerCase().includes(term) ||
                description.toLowerCase().includes(term);

            return supplierMatch && searchMatch;
        });
    }, [
        bills,
        supplierMap,
        supplierFilter,
        search,
    ]);


    // ============================================================
    // SUMMARY
    // ============================================================

    const outstandingTotal = useMemo(
        () =>
            bills.reduce(
                (total, bill) =>
                    total +
                    normalizeNumber(bill.balance),
                0
            ),
        [bills]
    );

    const supplierBalance = useMemo(() => {
        if (!supplierFilter) {
            return outstandingTotal;
        }

        const supplier = supplierMap.get(
            String(supplierFilter)
        );

        if (supplier) {
            return Math.max(
                0,
                normalizeNumber(supplier.current_balance)
            );
        }

        return bills
            .filter(
                bill =>
                    String(bill.supplier_id) ===
                    String(supplierFilter)
            )
            .reduce(
                (total, bill) =>
                    total +
                    normalizeNumber(bill.balance),
                0
            );
    }, [
        supplierFilter,
        supplierMap,
        outstandingTotal,
        bills,
    ]);


    // ============================================================
    // OPEN PAYMENT
    // ============================================================

    const openPayment = bill => {
        setError("");
        setSuccessMessage("");
        setSelectedBill(bill);

        setPaymentForm({
            payment_date: today(),
            amount: String(
                normalizeNumber(bill.balance)
            ),
            financial_account_id:
                financialAccounts.length === 1
                    ? String(financialAccounts[0].id)
                    : "",
            payment_method:
                financialAccounts.length === 1
                    ? String(
                          financialAccounts[0].account_type ||
                          ""
                      ).toLowerCase()
                    : "",
            reference_number: "",
            description:
                `Payment for supplier bill ${
                    bill.bill_number || ""
                }`,
        });
    };

    const closePayment = () => {
        if (saving) {
            return;
        }

        setSelectedBill(null);
    };


    // ============================================================
    // FORM HANDLERS
    // ============================================================

    const handleAccountChange = event => {
        const accountId = event.target.value;
        const account = financialAccounts.find(
            item => String(item.id) === String(accountId)
        );

        setPaymentForm(previous => ({
            ...previous,
            financial_account_id: accountId,
            payment_method:
                String(
                    account?.account_type ||
                    ""
                ).toLowerCase(),
        }));
    };


    // ============================================================
    // MAKE PAYMENT
    // ============================================================

    const makePayment = async event => {
        event.preventDefault();

        if (!selectedBill) {
            return;
        }

        try {
            setSaving(true);
            setError("");
            setSuccessMessage("");

            const amount = Number(
                paymentForm.amount
            );

            if (!Number.isFinite(amount) || amount <= 0) {
                throw new Error(
                    "Payment amount must be greater than zero."
                );
            }

            const outstanding = Number(
                selectedBill.balance
            ) || 0;

            if (amount > outstanding) {
                throw new Error(
                    `Payment cannot exceed the outstanding balance of TZS ${money(
                        outstanding
                    )}.`
                );
            }

            if (!paymentForm.financial_account_id) {
                throw new Error(
                    "Please select the account being used for payment."
                );
            }

            if (!paymentForm.payment_method) {
                throw new Error(
                    "Please select a payment account."
                );
            }

            const {
                data,
                error: paymentError,
            } = await supabase.rpc(
                "record_supplier_bill_payment",
                {
                    p_bill_id: selectedBill.id,
                    p_amount: amount,
                    p_financial_account_id:
                        Number(
                            paymentForm.financial_account_id
                        ),
                    p_payment_method:
                        paymentForm.payment_method,
                    p_reference_number:
                        paymentForm.reference_number.trim() ||
                        null,
                    p_payment_date:
                        paymentForm.payment_date ||
                        today(),
                }
            );

            if (paymentError) {
                throw paymentError;
            }

            const returnedBill = data || null;

            setSuccessMessage(
                `Payment of TZS ${money(
                    amount
                )} has been recorded for bill ${
                    selectedBill.bill_number ||
                    "-"
                }.`
            );

            setSelectedBill(null);

            await loadAll(true);

            if (
                returnedBill?.balance !== undefined &&
                Number(returnedBill.balance) > 0
            ) {
                setSuccessMessage(
                    `Payment of TZS ${money(
                        amount
                    )} has been recorded. Remaining balance: TZS ${money(
                        returnedBill.balance
                    )}.`
                );
            }
        } catch (err) {
            console.error("Supplier payment error:", err);

            setError(
                err?.message ||
                "Failed to record supplier payment."
            );
        } finally {
            setSaving(false);
        }
    };


    // ============================================================
    // LOADING
    // ============================================================

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <FaSpinner
                        className="animate-spin text-purple-600"
                        size={34}
                    />
                    <p className="text-sm text-slate-600">
                        Loading supplier payables...
                    </p>
                </div>
            </div>
        );
    }


    // ============================================================
    // MAIN UI
    // ============================================================

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

                {/* HEADER */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 mb-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() =>
                                    navigate("/finance/dashboard")
                                }
                                className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center"
                                title="Back to Finance Dashboard"
                            >
                                <FaArrowLeft />
                            </button>

                            <div className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                                <FaClipboardList />
                            </div>

                            <div>
                                <h1 className="text-xl font-bold text-slate-900">
                                    Record Payable
                                </h1>
                                <p className="text-sm text-slate-500 mt-1">
                                    View supplier debts recorded from expenses and make payments.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => loadAll(true)}
                            disabled={refreshing}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
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
                    </div>
                </div>

                {/* ALERTS */}
                {error && (
                    <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-3">
                        <FaExclamationTriangle className="mt-0.5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {successMessage && (
                    <div className="mb-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 flex items-start gap-3">
                        <FaCheckCircle className="mt-0.5 shrink-0" />
                        <span>{successMessage}</span>
                    </div>
                )}

                {/* SUMMARY */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Outstanding Payables
                                </p>
                                <p className="text-2xl font-bold text-purple-700 mt-2">
                                    TZS {money(outstandingTotal)}
                                </p>
                            </div>
                            <div className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                                <FaClipboardList />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Open Supplier Bills
                                </p>
                                <p className="text-2xl font-bold text-slate-900 mt-2">
                                    {bills.length}
                                </p>
                            </div>
                            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                                <FaPlus />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Selected Supplier Balance
                                </p>
                                <p className="text-2xl font-bold text-blue-700 mt-2">
                                    TZS {money(supplierBalance)}
                                </p>
                            </div>
                            <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                                <FaWallet />
                            </div>
                        </div>
                    </div>
                </div>

                {/* FILTER BAR */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 mb-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-1">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Supplier
                            </label>
                            <select
                                value={supplierFilter}
                                onChange={event =>
                                    setSupplierFilter(
                                        event.target.value
                                    )
                                }
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-purple-500"
                            >
                                <option value="">
                                    All suppliers
                                </option>
                                {suppliers.map(supplier => (
                                    <option
                                        key={supplier.id}
                                        value={supplier.id}
                                    >
                                        {getSupplierName(supplier)} — TZS {money(supplier.current_balance)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="lg:col-span-2">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Search bill / supplier
                            </label>
                            <div className="relative">
                                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={event =>
                                        setSearch(
                                            event.target.value
                                        )
                                    }
                                    placeholder="Search supplier, bill number or description..."
                                    className="w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-3 text-sm text-slate-800 outline-none focus:border-purple-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* WORKFLOW NOTE */}
                <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4">
                    <div className="flex items-start gap-3">
                        <FaCheckCircle className="mt-0.5 text-blue-600 shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-blue-900">
                                Supplier payable workflow
                            </p>
                            <p className="text-xs text-blue-800 mt-1 leading-5">
                                Record the supplier expense/bill first. It appears here automatically with its outstanding balance. Payment made here is posted through the existing supplier payment RPC and updates the supplier balance, cash account and journal.
                            </p>
                        </div>
                    </div>
                </div>

                {/* BILLS */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h2 className="font-bold text-slate-900">
                                Outstanding Supplier Bills
                            </h2>
                            <p className="text-xs text-slate-500 mt-1">
                                Select a bill and make payment against the remaining balance.
                            </p>
                        </div>

                        <div className="text-xs font-semibold text-slate-500">
                            Showing {filteredBills.length} of {bills.length}
                        </div>
                    </div>

                    {filteredBills.length === 0 ? (
                        <div className="px-6 py-16 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                                <FaClipboardList size={22} />
                            </div>
                            <p className="mt-4 font-semibold text-slate-700">
                                No outstanding supplier bills
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                                Supplier debts created in the expense/payable workflow will appear here.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-5 py-3 text-left font-semibold text-slate-600">
                                            Supplier
                                        </th>
                                        <th className="px-5 py-3 text-left font-semibold text-slate-600">
                                            Bill
                                        </th>
                                        <th className="px-5 py-3 text-left font-semibold text-slate-600">
                                            Bill Date
                                        </th>
                                        <th className="px-5 py-3 text-left font-semibold text-slate-600">
                                            Due Date
                                        </th>
                                        <th className="px-5 py-3 text-right font-semibold text-slate-600">
                                            Amount
                                        </th>
                                        <th className="px-5 py-3 text-right font-semibold text-slate-600">
                                            Paid
                                        </th>
                                        <th className="px-5 py-3 text-right font-semibold text-slate-600">
                                            Balance
                                        </th>
                                        <th className="px-5 py-3 text-right font-semibold text-slate-600">
                                            Action
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100">
                                    {filteredBills.map(bill => {
                                        const supplier =
                                            supplierMap.get(
                                                String(
                                                    bill.supplier_id
                                                )
                                            );

                                        const overdue =
                                            bill.due_date &&
                                            new Date(
                                                `${bill.due_date}T23:59:59`
                                            ) < new Date();

                                        return (
                                            <tr
                                                key={bill.id}
                                                className="hover:bg-slate-50"
                                            >
                                                <td className="px-5 py-4">
                                                    <div>
                                                        <p className="font-semibold text-slate-800">
                                                            {getSupplierName(
                                                                supplier
                                                            )}
                                                        </p>
                                                        {supplier?.phone && (
                                                            <p className="text-xs text-slate-500 mt-1">
                                                                {supplier.phone}
                                                            </p>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="px-5 py-4">
                                                    <p className="font-semibold text-slate-800">
                                                        {bill.bill_number || "-"}
                                                    </p>
                                                    {bill.description && (
                                                        <p className="text-xs text-slate-500 mt-1 max-w-xs truncate">
                                                            {bill.description}
                                                        </p>
                                                    )}
                                                </td>

                                                <td className="px-5 py-4 text-slate-600 whitespace-nowrap">
                                                    {bill.bill_date || "-"}
                                                </td>

                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <FaCalendarAlt className="text-slate-400" />
                                                        <span
                                                            className={
                                                                overdue
                                                                    ? "font-semibold text-red-600"
                                                                    : "text-slate-600"
                                                            }
                                                        >
                                                            {bill.due_date || "-"}
                                                        </span>
                                                    </div>
                                                </td>

                                                <td className="px-5 py-4 text-right font-semibold text-slate-800 whitespace-nowrap">
                                                    TZS {money(bill.amount)}
                                                </td>

                                                <td className="px-5 py-4 text-right text-slate-600 whitespace-nowrap">
                                                    TZS {money(bill.paid_amount)}
                                                </td>

                                                <td className="px-5 py-4 text-right whitespace-nowrap">
                                                    <span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">
                                                        TZS {money(bill.balance)}
                                                    </span>
                                                </td>

                                                <td className="px-5 py-4 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            openPayment(
                                                                bill
                                                            )
                                                        }
                                                        className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-3.5 py-2.5 text-xs font-bold text-white hover:bg-purple-700"
                                                    >
                                                        <FaMoneyBillWave />
                                                        Make Payment
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* PAYMENT MODAL */}
                {selectedBill && (
                    <div className="fixed inset-0 z-50 bg-slate-950/50 px-4 py-6 overflow-y-auto">
                        <div className="max-w-2xl mx-auto">
                            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                                            <FaMoneyBillWave />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900">
                                                Make Supplier Payment
                                            </h3>
                                            <p className="text-xs text-slate-500 mt-1">
                                                {getSupplierName(
                                                    supplierMap.get(
                                                        String(
                                                            selectedBill.supplier_id
                                                        )
                                                    )
                                                )}{" "}
                                                • Bill {selectedBill.bill_number || "-"}
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={closePayment}
                                        className="w-9 h-9 rounded-xl border border-slate-200 text-slate-500 hover:bg-white"
                                    >
                                        ×
                                    </button>
                                </div>

                                <form
                                    onSubmit={makePayment}
                                    className="p-5 space-y-5"
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="rounded-xl bg-purple-50 border border-purple-100 p-4">
                                            <p className="text-[11px] font-bold uppercase tracking-wide text-purple-700">
                                                Bill Amount
                                            </p>
                                            <p className="mt-1 font-bold text-slate-900">
                                                TZS {money(selectedBill.amount)}
                                            </p>
                                        </div>

                                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                                                Already Paid
                                            </p>
                                            <p className="mt-1 font-bold text-slate-900">
                                                TZS {money(selectedBill.paid_amount)}
                                            </p>
                                        </div>

                                        <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
                                            <p className="text-[11px] font-bold uppercase tracking-wide text-blue-700">
                                                Outstanding
                                            </p>
                                            <p className="mt-1 font-bold text-blue-900">
                                                TZS {money(selectedBill.balance)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                                Payment Date
                                            </label>
                                            <input
                                                type="date"
                                                value={
                                                    paymentForm.payment_date
                                                }
                                                onChange={event =>
                                                    setPaymentForm(
                                                        previous => ({
                                                            ...previous,
                                                            payment_date:
                                                                event.target.value,
                                                        })
                                                    )
                                                }
                                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-purple-500"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                                Payment Amount
                                            </label>
                                            <input
                                                type="number"
                                                min="0.01"
                                                step="0.01"
                                                max={
                                                    selectedBill.balance
                                                }
                                                value={
                                                    paymentForm.amount
                                                }
                                                onChange={event =>
                                                    setPaymentForm(
                                                        previous => ({
                                                            ...previous,
                                                            amount:
                                                                event.target.value,
                                                        })
                                                    )
                                                }
                                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-purple-500"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Payment Account
                                        </label>
                                        <select
                                            value={
                                                paymentForm.financial_account_id
                                            }
                                            onChange={
                                                handleAccountChange
                                            }
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-purple-500"
                                            required
                                        >
                                            <option value="">
                                                Select account
                                            </option>
                                            {financialAccounts.map(
                                                account => (
                                                    <option
                                                        key={account.id}
                                                        value={account.id}
                                                    >
                                                        {account.account_name} — {getPaymentMethodLabel(account.account_type)} — TZS {money(account.current_balance)}
                                                    </option>
                                                )
                                            )}
                                        </select>

                                        {financialAccounts.length === 0 && (
                                            <p className="mt-2 text-xs text-red-600">
                                                No active cash/bank/mobile-money account is available for this school.
                                            </p>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                                Payment Method
                                            </label>
                                            <input
                                                type="text"
                                                value={
                                                    getPaymentMethodLabel(
                                                        paymentForm.payment_method
                                                    )
                                                }
                                                readOnly
                                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                                Reference Number
                                            </label>
                                            <input
                                                type="text"
                                                value={
                                                    paymentForm.reference_number
                                                }
                                                onChange={event =>
                                                    setPaymentForm(
                                                        previous => ({
                                                            ...previous,
                                                            reference_number:
                                                                event.target.value,
                                                        })
                                                    )
                                                }
                                                placeholder="Receipt / transaction reference"
                                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-purple-500"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Description
                                        </label>
                                        <textarea
                                            rows={3}
                                            value={
                                                paymentForm.description
                                            }
                                            onChange={event =>
                                                setPaymentForm(
                                                    previous => ({
                                                        ...previous,
                                                        description:
                                                            event.target.value,
                                                    })
                                                )
                                            }
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-purple-500"
                                        />
                                    </div>

                                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                                        The payment will update the supplier payable balance, supplier balance, selected financial account and journal through the existing finance RPC.
                                    </div>

                                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t border-slate-200 pt-5">
                                        <button
                                            type="button"
                                            onClick={closePayment}
                                            disabled={saving}
                                            className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                                        >
                                            Cancel
                                        </button>

                                        <button
                                            type="submit"
                                            disabled={
                                                saving ||
                                                financialAccounts.length === 0
                                            }
                                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-3 text-sm font-bold text-white hover:bg-purple-700 disabled:opacity-60"
                                        >
                                            {saving ? (
                                                <>
                                                    <FaSpinner className="animate-spin" />
                                                    Posting Payment...
                                                </>
                                            ) : (
                                                <>
                                                    <FaMoneyBillWave />
                                                    Confirm Payment
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default RecordPayable;
