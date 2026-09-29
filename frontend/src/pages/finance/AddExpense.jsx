// ============================================================
// src/pages/finance/AddExpense.jsx
// AFRICORE ERP PRO - FINANCE
// NEW DARK FINANCE WORKSPACE
// ============================================================

import {
    useEffect,
    useMemo,
    useState
} from "react";

import {
    FaArrowLeft,
    FaCalendarAlt,
    FaCheckCircle,
    FaExclamationTriangle,
    FaFileInvoiceDollar,
    FaMoneyBillWave,
    FaPlus,
    FaSave,
    FaSpinner,
    FaStore,
    FaTimes,
    FaUserTie,
    FaWallet,
    FaBuilding,
    FaReceipt,
    FaCreditCard
} from "react-icons/fa";

import {
    useNavigate
} from "react-router-dom";

import {
    supabase
} from "../../services/supabase";


// ============================================================
// HELPERS
// ============================================================

const getToday = () =>
    new Date()
        .toISOString()
        .split("T")[0];


const formatMoney = value =>
    new Intl.NumberFormat("en-TZ", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(Number(value) || 0);


// ============================================================
// COMPONENT
// ============================================================

export default function AddExpense() {

    const navigate = useNavigate();


    // ========================================================
    // PAGE STATE
    // ========================================================

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");


    // ========================================================
    // MASTER DATA
    // ========================================================

    const [expenseAccounts, setExpenseAccounts] = useState([]);
    const [financialAccounts, setFinancialAccounts] = useState([]);
    const [suppliers, setSuppliers] = useState([]);


    // ========================================================
    // SUPPLIER MODAL
    // ========================================================

    const [showSupplierModal, setShowSupplierModal] =
        useState(false);

    const [savingSupplier, setSavingSupplier] =
        useState(false);

    const [supplierError, setSupplierError] =
        useState("");

    const [supplierForm, setSupplierForm] = useState({
        supplier_name: "",
        phone: "",
        email: "",
        address: ""
    });


    // ========================================================
    // EXPENSE FORM
    // ========================================================

    const [form, setForm] = useState({
        expense_date: getToday(),
        expense_category: "",
        description: "",
        amount: "",
        payment_status: "paid",
        payment_method: "cash",
        financial_account_id: "",
        expense_account_id: "",
        reference_number: "",
        supplier_id: "",
        bill_number: "",
        due_date: ""
    });


    // ========================================================
    // PAYMENT STATE
    // ========================================================

    const isPaid =
        form.payment_status === "paid";

    const isUnpaid =
        form.payment_status === "unpaid";


    const expenseAmount =
        Number(form.amount) || 0;


    // ========================================================
    // SELECTED FINANCIAL ACCOUNT
    // ========================================================

    const selectedFinancialAccount =
        useMemo(() => {

            if (!isPaid) {
                return null;
            }

            return financialAccounts.find(
                account =>
                    String(account.id) ===
                    String(form.financial_account_id)
            ) || null;

        }, [
            financialAccounts,
            form.financial_account_id,
            isPaid
        ]);


    const selectedAccountBalance =
        isPaid
            ? Number(
                selectedFinancialAccount?.current_balance
            ) || 0
            : 0;


    const selectedAccountHasEnoughFunds =
        Boolean(
            isPaid &&
            selectedFinancialAccount &&
            expenseAmount > 0 &&
            selectedAccountBalance >= expenseAmount
        );


    const sufficientFinancialAccounts =
        useMemo(() => {

            if (!isPaid || expenseAmount <= 0) {
                return [];
            }

            return financialAccounts.filter(
                account =>
                    Number(account.current_balance) >=
                    expenseAmount
            );

        }, [
            financialAccounts,
            expenseAmount,
            isPaid
        ]);


    const insufficientFinancialAccounts =
        useMemo(() => {

            if (!isPaid || expenseAmount <= 0) {
                return [];
            }

            return financialAccounts.filter(
                account =>
                    Number(account.current_balance) <
                    expenseAmount
            );

        }, [
            financialAccounts,
            expenseAmount,
            isPaid
        ]);


    const balanceAfterPayment =
        isPaid && selectedFinancialAccount
            ? selectedAccountBalance - expenseAmount
            : null;


    // ========================================================
    // SELECTED SUPPLIER
    // ========================================================

    const selectedSupplier =
        useMemo(() => {

            return suppliers.find(
                supplier =>
                    String(supplier.id) ===
                    String(form.supplier_id)
            ) || null;

        }, [
            suppliers,
            form.supplier_id
        ]);


    // ========================================================
    // LOAD MASTER DATA
    // ========================================================

    useEffect(() => {

        loadMasterData();

    }, []);


    const loadMasterData = async () => {

        try {

            setLoading(true);
            setError("");


            const [
                expenseAccountsResult,
                financialAccountsResult,
                suppliersResult
            ] = await Promise.all([

                supabase
                    .from("chart_of_accounts")
                    .select(`
                        id,
                        account_code,
                        account_name,
                        account_type,
                        is_active
                    `)
                    .eq("is_active", true)
                    .eq("account_type", "expense")
                    .order("account_code", {
                        ascending: true
                    }),

                supabase
                    .from("financial_accounts")
                    .select(`
                        id,
                        account_name,
                        current_balance
                    `)
                    .order("account_name", {
                        ascending: true
                    }),

                supabase
                    .schema("finance")
                    .from("suppliers")
                    .select(`
                        id,
                        supplier_name,
                        phone,
                        email,
                        address,
                        current_balance,
                        is_active
                    `)
                    .eq("is_active", true)
                    .order("supplier_name", {
                        ascending: true
                    })
            ]);


            if (expenseAccountsResult.error) {
                throw expenseAccountsResult.error;
            }

            if (financialAccountsResult.error) {
                throw financialAccountsResult.error;
            }

            if (suppliersResult.error) {
                throw suppliersResult.error;
            }


            setExpenseAccounts(
                expenseAccountsResult.data || []
            );

            setFinancialAccounts(
                financialAccountsResult.data || []
            );

            setSuppliers(
                suppliersResult.data || []
            );

        } catch (err) {

            console.error(
                "Add Expense load error:",
                err
            );

            setError(
                err?.message ||
                "Unable to load expense setup."
            );

        } finally {

            setLoading(false);

        }
    };


    // ========================================================
    // KEEP PAID ACCOUNT VALID
    // ========================================================

    useEffect(() => {

        if (!isPaid) {
            return;
        }

        if (
            !form.financial_account_id ||
            expenseAmount <= 0
        ) {
            return;
        }


        const selectedAccount =
            financialAccounts.find(
                account =>
                    String(account.id) ===
                    String(form.financial_account_id)
            );


        if (!selectedAccount) {
            return;
        }


        const balance =
            Number(selectedAccount.current_balance) || 0;


        if (balance < expenseAmount) {

            setForm(prev => ({
                ...prev,
                financial_account_id: ""
            }));

        }

    }, [
        expenseAmount,
        financialAccounts,
        form.financial_account_id,
        isPaid
    ]);


    // ========================================================
    // UPDATE FIELD
    // ========================================================

    const updateField = (
        field,
        value
    ) => {

        setForm(prev => ({
            ...prev,
            [field]: value
        }));

        setError("");
        setSuccess("");
    };


    // ========================================================
    // AMOUNT
    // ========================================================

    const handleAmountChange = value => {

        const numericAmount =
            Number(value);


        if (isUnpaid) {

            setForm(prev => ({
                ...prev,
                amount: value
            }));

            setError("");
            setSuccess("");

            return;
        }


        setForm(prev => {

            const currentAccount =
                financialAccounts.find(
                    account =>
                        String(account.id) ===
                        String(prev.financial_account_id)
                );


            const currentBalance =
                Number(
                    currentAccount?.current_balance
                ) || 0;


            const keepAccount =
                currentAccount &&
                numericAmount > 0 &&
                currentBalance >= numericAmount;


            return {
                ...prev,
                amount: value,
                financial_account_id:
                    keepAccount
                        ? prev.financial_account_id
                        : ""
            };

        });


        setError("");
        setSuccess("");
    };


    // ========================================================
    // PAYMENT STATUS
    // ========================================================

    const handlePaymentStatusChange =
        status => {

            setForm(prev => ({
                ...prev,

                payment_status: status,

                financial_account_id:
                    status === "paid"
                        ? prev.financial_account_id
                        : "",

                payment_method:
                    status === "paid"
                        ? (
                            prev.payment_method ||
                            "cash"
                        )
                        : prev.payment_method
            }));


            setError("");
            setSuccess("");
        };


    // ========================================================
    // SUPPLIER FORM
    // ========================================================

    const updateSupplierField = (
        field,
        value
    ) => {

        setSupplierForm(prev => ({
            ...prev,
            [field]: value
        }));

        setSupplierError("");
    };


    const openSupplierModal = () => {

        setSupplierError("");

        setSupplierForm({
            supplier_name: "",
            phone: "",
            email: "",
            address: ""
        });

        setShowSupplierModal(true);
    };


    const closeSupplierModal = () => {

        if (savingSupplier) {
            return;
        }

        setShowSupplierModal(false);
        setSupplierError("");
    };


    // ========================================================
    // CREATE SUPPLIER
    // ========================================================

    const handleCreateSupplier =
        async event => {

            event.preventDefault();

            if (savingSupplier) {
                return;
            }

            setSupplierError("");


            if (
                !supplierForm.supplier_name.trim()
            ) {

                setSupplierError(
                    "Supplier name is required."
                );

                return;
            }


            try {

                setSavingSupplier(true);


                const {
                    data,
                    error: createError
                } = await supabase
                    .schema("finance")
                    .rpc(
                        "create_supplier",
                        {
                            p_supplier_name:
                                supplierForm
                                    .supplier_name
                                    .trim(),

                            p_phone:
                                supplierForm
                                    .phone
                                    .trim() ||
                                null,

                            p_email:
                                supplierForm
                                    .email
                                    .trim() ||
                                null,

                            p_address:
                                supplierForm
                                    .address
                                    .trim() ||
                                null
                        }
                    );


                if (createError) {
                    throw createError;
                }


                if (!data) {
                    throw new Error(
                        "Supplier was not returned by Supabase."
                    );
                }


                setSuppliers(prev => {

                    const updated = [
                        ...prev,
                        data
                    ];

                    return updated.sort(
                        (a, b) =>
                            String(
                                a.supplier_name || ""
                            ).localeCompare(
                                String(
                                    b.supplier_name || ""
                                )
                            )
                    );

                });


                updateField(
                    "supplier_id",
                    String(data.id)
                );


                setShowSupplierModal(false);


                setSupplierForm({
                    supplier_name: "",
                    phone: "",
                    email: "",
                    address: ""
                });


                setSuccess(
                    `Supplier "${data.supplier_name}" was created and selected.`
                );

            } catch (err) {

                console.error(
                    "Create supplier error:",
                    err
                );

                setSupplierError(
                    err?.message ||
                    "Failed to create supplier."
                );

            } finally {

                setSavingSupplier(false);

            }
        };


    // ========================================================
    // VALIDATION
    // ========================================================

    const validateForm = () => {

        if (!form.expense_date) {
            return "Expense date is required.";
        }


        if (!form.expense_category.trim()) {
            return "Expense category is required.";
        }


        if (!form.description.trim()) {
            return "Expense description is required.";
        }


        const amount =
            Number(form.amount);


        if (
            !Number.isFinite(amount) ||
            amount <= 0
        ) {

            return "Enter a valid expense amount.";
        }


        if (!form.expense_account_id) {
            return "Select the expense account.";
        }


        // ====================================================
        // PAID
        // ====================================================

        if (isPaid) {

            if (!form.payment_method) {
                return "Select the payment method.";
            }


            if (financialAccounts.length === 0) {
                return "No financial account is available.";
            }


            if (!form.financial_account_id) {

                if (
                    sufficientFinancialAccounts.length ===
                    0
                ) {

                    return (
                        `No financial account has enough funds for this expense of TZS ${formatMoney(amount)}.`
                    );
                }


                return (
                    "Select a financial account with sufficient funds."
                );
            }


            const account =
                financialAccounts.find(
                    item =>
                        String(item.id) ===
                        String(
                            form.financial_account_id
                        )
                );


            if (!account) {
                return (
                    "The selected financial account could not be found."
                );
            }


            const available =
                Number(
                    account.current_balance
                ) || 0;


            if (available < amount) {

                return (
                    `Insufficient funds in ${account.account_name}. Available TZS ${formatMoney(available)}, required TZS ${formatMoney(amount)}.`
                );
            }
        }


        // ====================================================
        // UNPAID
        // ====================================================

        if (isUnpaid) {

            if (!form.supplier_id) {
                return (
                    "Select a supplier or create a new supplier."
                );
            }


            if (!form.bill_number.trim()) {
                return (
                    "Supplier bill number is required."
                );
            }


            if (!form.due_date) {
                return (
                    "Payable due date is required."
                );
            }
        }


        return "";
    };


    // ========================================================
    // SUBMIT
    // ========================================================

    const handleSubmit =
        async event => {

            event.preventDefault();


            if (saving) {
                return;
            }


            setError("");
            setSuccess("");


            const validationError =
                validateForm();


            if (validationError) {

                setError(validationError);

                return;
            }


            try {

                setSaving(true);


                const {
                    data,
                    error: rpcError
                } = await supabase.rpc(
                    "create_expense_with_payable",
                    {
                        p_expense_date:
                            form.expense_date,

                        p_expense_category:
                            form.expense_category.trim(),

                        p_description:
                            form.description.trim(),

                        p_amount:
                            Number(form.amount),

                        p_payment_status:
                            form.payment_status,

                        p_payment_method:
                            isPaid
                                ? form.payment_method
                                : null,

                        p_financial_account_id:
                            isPaid
                                ? Number(
                                    form.financial_account_id
                                )
                                : null,

                        p_expense_account_id:
                            form.expense_account_id,

                        p_reference_number:
                            form.reference_number.trim() ||
                            null,

                        p_supplier_id:
                            isUnpaid
                                ? Number(
                                    form.supplier_id
                                )
                                : null,

                        p_bill_number:
                            isUnpaid
                                ? form.bill_number.trim()
                                : null,

                        p_due_date:
                            isUnpaid
                                ? form.due_date
                                : null
                    }
                );


                if (rpcError) {
                    throw rpcError;
                }


                if (!data) {

                    throw new Error(
                        "Expense was not returned by Supabase."
                    );
                }


                const wasUnpaid =
                    isUnpaid;


                if (wasUnpaid) {

                    setSuccess(
                        "Expense created and supplier payable recorded. No financial account was charged."
                    );

                } else {

                    setSuccess(
                        "Expense and payment recorded successfully."
                    );
                }


                setForm({
                    expense_date: getToday(),
                    expense_category: "",
                    description: "",
                    amount: "",
                    payment_status: "paid",
                    payment_method: "cash",
                    financial_account_id: "",
                    expense_account_id: "",
                    reference_number: "",
                    supplier_id: "",
                    bill_number: "",
                    due_date: ""
                });


                setTimeout(() => {

                    if (wasUnpaid) {

                        navigate(
                            "/finance/record-payable"
                        );

                    } else {

                        navigate(
                            "/finance"
                        );
                    }

                }, 900);

            } catch (err) {

                console.error(
                    "Create expense error:",
                    err
                );

                setError(
                    err?.message ||
                    "Failed to create the expense."
                );

            } finally {

                setSaving(false);
            }
        };


    // ========================================================
    // LOADING
    // ========================================================

    if (loading) {

        return (

            <div className="min-h-screen bg-[#070b14] text-slate-200 flex items-center justify-center p-6">

                <div className="flex items-center gap-3 text-sm font-bold">

                    <FaSpinner className="animate-spin text-cyan-400" />

                    Loading finance workspace...

                </div>

            </div>
        );
    }


    // ========================================================
    // PAGE
    // ========================================================

    return (

        <div className="min-h-screen bg-[#070b14] text-slate-200">

            <div className="max-w-[1450px] mx-auto px-4 sm:px-6 lg:px-8 py-5 md:py-7">


                {/* ==================================================
                    TOP BAR
                ================================================== */}

                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-7">

                    <div className="flex items-center gap-4">

                        <button
                            type="button"
                            onClick={() =>
                                navigate("/finance")
                            }
                            className="w-10 h-10 rounded-xl border border-slate-700 bg-slate-900/70 text-slate-300 hover:text-white hover:border-cyan-500 flex items-center justify-center transition"
                        >

                            <FaArrowLeft />

                        </button>


                        <div>

                            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-400">

                                <FaReceipt />

                                Finance / Expenses

                            </div>

                            <h1 className="text-2xl md:text-3xl font-black text-white mt-1">

                                Add Expense

                            </h1>

                        </div>

                    </div>


                    <div className="flex items-center gap-2 text-xs text-slate-400">

                        <span className="w-2 h-2 rounded-full bg-emerald-400" />

                        Finance system ready

                    </div>

                </div>


                {/* ==================================================
                    ALERTS
                ================================================== */}

                {error && (

                    <div className="mb-5 border-l-4 border-red-500 bg-red-950/30 px-4 py-3">

                        <div className="flex items-start gap-3">

                            <FaExclamationTriangle className="text-red-400 mt-0.5" />

                            <div>

                                <div className="text-sm font-black text-red-300">

                                    Unable to save expense

                                </div>

                                <div className="text-xs text-red-200/80 mt-1">

                                    {error}

                                </div>

                            </div>

                        </div>

                    </div>
                )}


                {success && (

                    <div className="mb-5 border-l-4 border-emerald-500 bg-emerald-950/30 px-4 py-3">

                        <div className="flex items-start gap-3">

                            <FaCheckCircle className="text-emerald-400 mt-0.5" />

                            <div>

                                <div className="text-sm font-black text-emerald-300">

                                    Transaction successful

                                </div>

                                <div className="text-xs text-emerald-200/80 mt-1">

                                    {success}

                                </div>

                            </div>

                        </div>

                    </div>
                )}


                <form onSubmit={handleSubmit}>


                    {/* ==================================================
                        MAIN GRID
                    ================================================== */}

                    <div className="grid grid-cols-1 xl:grid-cols-[1fr_390px] gap-6">


                        {/* ==================================================
                            LEFT WORKSPACE
                        ================================================== */}

                        <div className="min-w-0">


                            {/* ------------------------------------------
                                EXPENSE DETAILS
                            ------------------------------------------ */}

                            <section className="border border-slate-800 bg-[#0d1320]">

                                <div className="border-b border-slate-800 px-5 py-4 flex items-center gap-3">

                                    <div className="w-9 h-9 bg-cyan-500/10 text-cyan-400 flex items-center justify-center">

                                        <FaFileInvoiceDollar />

                                    </div>

                                    <div>

                                        <h2 className="font-black text-white">

                                            Expense Details

                                        </h2>

                                        <p className="text-[11px] text-slate-500">

                                            Enter the transaction information.

                                        </p>

                                    </div>

                                </div>


                                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-5">


                                    {/* DATE */}

                                    <Field label="Expense Date">

                                        <div className="relative">

                                            <FaCalendarAlt className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs" />

                                            <input
                                                type="date"
                                                value={
                                                    form.expense_date
                                                }
                                                onChange={e =>
                                                    updateField(
                                                        "expense_date",
                                                        e.target.value
                                                    )
                                                }
                                                className="dark-input pl-9"
                                            />

                                        </div>

                                    </Field>


                                    {/* CATEGORY */}

                                    <Field label="Expense Category">

                                        <input
                                            type="text"
                                            value={
                                                form.expense_category
                                            }
                                            onChange={e =>
                                                updateField(
                                                    "expense_category",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Electricity, Stationery, Transport..."
                                            className="dark-input"
                                        />

                                    </Field>


                                    {/* AMOUNT */}

                                    <Field label="Amount">

                                        <div className="relative">

                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-400">

                                                TZS

                                            </span>

                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={
                                                    form.amount
                                                }
                                                onChange={e =>
                                                    handleAmountChange(
                                                        e.target.value
                                                    )
                                                }
                                                placeholder="0.00"
                                                className="dark-input pl-12 text-lg font-black"
                                            />

                                        </div>

                                    </Field>


                                    {/* EXPENSE ACCOUNT */}

                                    <Field label="Expense Account">

                                        <select
                                            value={
                                                form.expense_account_id
                                            }
                                            onChange={e =>
                                                updateField(
                                                    "expense_account_id",
                                                    e.target.value
                                                )
                                            }
                                            className="dark-input"
                                        >

                                            <option value="">
                                                Select expense account
                                            </option>

                                            {expenseAccounts.map(
                                                account => (

                                                    <option
                                                        key={account.id}
                                                        value={account.id}
                                                    >

                                                        {account.account_code}
                                                        {" - "}
                                                        {account.account_name}

                                                    </option>
                                                )
                                            )}

                                        </select>

                                    </Field>


                                    {/* DESCRIPTION */}

                                    <Field
                                        label="Description"
                                        full
                                    >

                                        <textarea
                                            rows="3"
                                            value={
                                                form.description
                                            }
                                            onChange={e =>
                                                updateField(
                                                    "description",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Describe the expense..."
                                            className="dark-input resize-none"
                                        />

                                    </Field>


                                    {/* REFERENCE */}

                                    <Field
                                        label="Reference Number"
                                        full
                                        optional
                                    >

                                        <input
                                            type="text"
                                            value={
                                                form.reference_number
                                            }
                                            onChange={e =>
                                                updateField(
                                                    "reference_number",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Receipt / transaction reference"
                                            className="dark-input"
                                        />

                                    </Field>

                                </div>

                            </section>


                            {/* ==================================================
                                PAYMENT MODE
                            ================================================== */}

                            <section className="mt-5 border border-slate-800 bg-[#0d1320]">

                                <div className="border-b border-slate-800 px-5 py-4">

                                    <div className="text-xs uppercase tracking-[0.16em] font-black text-slate-500">

                                        Settlement

                                    </div>

                                    <h2 className="font-black text-white mt-1">

                                        How is this expense being paid?

                                    </h2>

                                </div>


                                <div className="grid grid-cols-1 md:grid-cols-2">

                                    {/* PAID */}

                                    <button
                                        type="button"
                                        onClick={() =>
                                            handlePaymentStatusChange(
                                                "paid"
                                            )
                                        }
                                        className={`text-left p-5 border-b md:border-b-0 md:border-r border-slate-800 transition ${
                                            isPaid
                                                ? "bg-emerald-500/[0.07]"
                                                : "bg-transparent hover:bg-slate-900/60"
                                        }`}
                                    >

                                        <div className="flex items-start gap-4">

                                            <div
                                                className={`w-10 h-10 flex items-center justify-center ${
                                                    isPaid
                                                        ? "bg-emerald-500 text-[#07100b]"
                                                        : "bg-slate-800 text-slate-400"
                                                }`}
                                            >

                                                <FaWallet />

                                            </div>

                                            <div className="flex-1">

                                                <div className="flex items-center justify-between gap-2">

                                                    <span className="font-black text-white">

                                                        Pay Now

                                                    </span>

                                                    {isPaid && (

                                                        <FaCheckCircle className="text-emerald-400" />

                                                    )}

                                                </div>

                                                <p className="text-xs text-slate-500 mt-1">

                                                    Money leaves the selected financial account immediately.

                                                </p>

                                            </div>

                                        </div>

                                    </button>


                                    {/* PAY LATER */}

                                    <button
                                        type="button"
                                        onClick={() =>
                                            handlePaymentStatusChange(
                                                "unpaid"
                                            )
                                        }
                                        className={`text-left p-5 transition ${
                                            isUnpaid
                                                ? "bg-violet-500/[0.07]"
                                                : "bg-transparent hover:bg-slate-900/60"
                                        }`}
                                    >

                                        <div className="flex items-start gap-4">

                                            <div
                                                className={`w-10 h-10 flex items-center justify-center ${
                                                    isUnpaid
                                                        ? "bg-violet-500 text-white"
                                                        : "bg-slate-800 text-slate-400"
                                                }`}
                                            >

                                                <FaFileInvoiceDollar />

                                            </div>

                                            <div className="flex-1">

                                                <div className="flex items-center justify-between gap-2">

                                                    <span className="font-black text-white">

                                                        Pay Later

                                                    </span>

                                                    {isUnpaid && (

                                                        <FaCheckCircle className="text-violet-400" />

                                                    )}

                                                </div>

                                                <p className="text-xs text-slate-500 mt-1">

                                                    Create a supplier payable and pay it later.

                                                </p>

                                            </div>

                                        </div>

                                    </button>

                                </div>


                                {/* ==================================================
                                    PAID SETTINGS
                                ================================================== */}

                                {isPaid && (

                                    <div className="border-t border-slate-800 p-5 bg-[#0a101b]">

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">


                                            <Field label="Payment Method">

                                                <div className="relative">

                                                    <FaCreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs" />

                                                    <select
                                                        value={
                                                            form.payment_method
                                                        }
                                                        onChange={e =>
                                                            updateField(
                                                                "payment_method",
                                                                e.target.value
                                                            )
                                                        }
                                                        className="dark-input pl-9"
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

                                                    </select>

                                                </div>

                                            </Field>


                                            <Field label="Financial Account">

                                                <select
                                                    value={
                                                        form.financial_account_id
                                                    }
                                                    onChange={e =>
                                                        updateField(
                                                            "financial_account_id",
                                                            e.target.value
                                                        )
                                                    }
                                                    className="dark-input"
                                                >

                                                    <option value="">
                                                        Select financial account
                                                    </option>

                                                    {financialAccounts.map(
                                                        account => {

                                                            const balance =
                                                                Number(
                                                                    account.current_balance
                                                                ) || 0;

                                                            const enough =
                                                                expenseAmount > 0 &&
                                                                balance >=
                                                                expenseAmount;

                                                            return (

                                                                <option
                                                                    key={account.id}
                                                                    value={account.id}
                                                                    disabled={
                                                                        expenseAmount >
                                                                        0 &&
                                                                        !enough
                                                                    }
                                                                >

                                                                    {account.account_name}
                                                                    {" — TZS "}
                                                                    {formatMoney(
                                                                        balance
                                                                    )}

                                                                    {expenseAmount >
                                                                        0 &&
                                                                        !enough
                                                                        ? " — INSUFFICIENT"
                                                                        : ""}

                                                                </option>
                                                            );
                                                        }
                                                    )}

                                                </select>

                                            </Field>

                                        </div>


                                        {/* ACCOUNT STATUS */}

                                        {expenseAmount > 0 && (

                                            <div className="mt-5">

                                                {selectedFinancialAccount ? (

                                                    <div
                                                        className={`border p-4 ${
                                                            selectedAccountHasEnoughFunds
                                                                ? "border-emerald-500/30 bg-emerald-500/[0.04]"
                                                                : "border-red-500/30 bg-red-500/[0.04]"
                                                        }`}
                                                    >

                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

                                                            <Metric
                                                                label="Expense"
                                                                value={`TZS ${formatMoney(expenseAmount)}`}
                                                            />

                                                            <Metric
                                                                label="Available"
                                                                value={`TZS ${formatMoney(selectedAccountBalance)}`}
                                                                valueClass={
                                                                    selectedAccountHasEnoughFunds
                                                                        ? "text-emerald-400"
                                                                        : "text-red-400"
                                                                }
                                                            />

                                                            <Metric
                                                                label="After Payment"
                                                                value={`TZS ${formatMoney(Math.max(0, balanceAfterPayment || 0))}`}
                                                                valueClass="text-cyan-400"
                                                            />

                                                        </div>


                                                        {!selectedAccountHasEnoughFunds && (

                                                            <div className="mt-4 flex items-start gap-2 text-xs text-red-300">

                                                                <FaExclamationTriangle className="mt-0.5" />

                                                                <span>
                                                                    This financial account does not have enough funds. Select another account.
                                                                </span>

                                                            </div>

                                                        )}

                                                    </div>

                                                ) : (

                                                    <div className="border border-amber-500/30 bg-amber-500/[0.05] p-4">

                                                        <div className="flex items-start gap-3">

                                                            <FaExclamationTriangle className="text-amber-400 mt-0.5" />

                                                            <div>

                                                                <div className="text-sm font-black text-amber-300">

                                                                    Financial account required

                                                                </div>

                                                                <div className="text-xs text-amber-200/70 mt-1">

                                                                    Choose an account with enough funds for TZS{" "}

                                                                    <strong>

                                                                        {formatMoney(
                                                                            expenseAmount
                                                                        )}

                                                                    </strong>.

                                                                </div>

                                                            </div>

                                                        </div>

                                                    </div>

                                                )}

                                            </div>
                                        )}


                                        {expenseAmount > 0 && (

                                            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-bold">

                                                <span className="text-emerald-400">

                                                    ✓ {sufficientFinancialAccounts.length} funded account(s)

                                                </span>

                                                <span className="text-red-400">

                                                    ! {insufficientFinancialAccounts.length} insufficient

                                                </span>

                                            </div>
                                        )}

                                    </div>
                                )}


                                {/* ==================================================
                                    PAY LATER SETTINGS
                                ================================================== */}

                                {isUnpaid && (

                                    <div className="border-t border-slate-800 p-5 bg-[#0a101b]">

                                        <div className="flex items-start gap-3 mb-5">

                                            <FaStore className="text-violet-400 mt-1" />

                                            <div>

                                                <div className="font-black text-white">

                                                    Supplier Payable

                                                </div>

                                                <div className="text-xs text-slate-500 mt-1">

                                                    The expense will be posted to Accounts Payable. No cash/bank/mobile balance is reduced now.

                                                </div>

                                            </div>

                                        </div>


                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">


                                            {/* SUPPLIER */}

                                            <Field
                                                label="Supplier"
                                                full
                                            >

                                                <div className="flex flex-col sm:flex-row gap-2">

                                                    <select
                                                        value={
                                                            form.supplier_id
                                                        }
                                                        onChange={e =>
                                                            updateField(
                                                                "supplier_id",
                                                                e.target.value
                                                            )
                                                        }
                                                        className="dark-input flex-1"
                                                    >

                                                        <option value="">
                                                            Select supplier
                                                        </option>

                                                        {suppliers.map(
                                                            supplier => (

                                                                <option
                                                                    key={supplier.id}
                                                                    value={supplier.id}
                                                                >

                                                                    {supplier.supplier_name}

                                                                    {supplier.phone
                                                                        ? ` — ${supplier.phone}`
                                                                        : ""}

                                                                </option>
                                                            )
                                                        )}

                                                    </select>


                                                    <button
                                                        type="button"
                                                        onClick={
                                                            openSupplierModal
                                                        }
                                                        className="px-4 py-3 bg-violet-600 hover:bg-violet-500 text-white text-xs font-black flex items-center justify-center gap-2 whitespace-nowrap"
                                                    >

                                                        <FaPlus />

                                                        New Supplier

                                                    </button>

                                                </div>

                                            </Field>


                                            {/* BILL NUMBER */}

                                            <Field label="Supplier Bill Number">

                                                <div className="relative">

                                                    <FaFileInvoiceDollar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs" />

                                                    <input
                                                        type="text"
                                                        value={
                                                            form.bill_number
                                                        }
                                                        onChange={e =>
                                                            updateField(
                                                                "bill_number",
                                                                e.target.value
                                                            )
                                                        }
                                                        placeholder="INV-00125"
                                                        className="dark-input pl-9"
                                                    />

                                                </div>

                                            </Field>


                                            {/* DUE DATE */}

                                            <Field label="Due Date">

                                                <div className="relative">

                                                    <FaCalendarAlt className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs" />

                                                    <input
                                                        type="date"
                                                        value={
                                                            form.due_date
                                                        }
                                                        onChange={e =>
                                                            updateField(
                                                                "due_date",
                                                                e.target.value
                                                            )
                                                        }
                                                        className="dark-input pl-9"
                                                    />

                                                </div>

                                            </Field>

                                        </div>


                                        {selectedSupplier && (

                                            <div className="mt-5 border-l-2 border-violet-500 bg-violet-500/[0.04] px-4 py-3">

                                                <div className="flex items-center justify-between gap-4">

                                                    <div className="flex items-center gap-3">

                                                        <FaUserTie className="text-violet-400" />

                                                        <div>

                                                            <div className="text-sm font-black text-white">

                                                                {
                                                                    selectedSupplier.supplier_name
                                                                }

                                                            </div>

                                                            <div className="text-[11px] text-slate-500">

                                                                Current supplier balance

                                                            </div>

                                                        </div>

                                                    </div>


                                                    <div className="text-sm font-black text-violet-300">

                                                        TZS{" "}

                                                        {formatMoney(
                                                            selectedSupplier.current_balance
                                                        )}

                                                    </div>

                                                </div>

                                            </div>
                                        )}

                                    </div>
                                )}

                            </section>

                        </div>


                        {/* ==================================================
                            RIGHT SUMMARY PANEL
                        ================================================== */}

                        <aside className="xl:sticky xl:top-5 h-fit">

                            <div className="border border-slate-800 bg-[#0d1320]">

                                <div className="px-5 py-4 border-b border-slate-800">

                                    <div className="text-[10px] uppercase tracking-[0.18em] font-black text-slate-500">

                                        Transaction Preview

                                    </div>

                                    <div className="text-lg font-black text-white mt-1">

                                        Expense Summary

                                    </div>

                                </div>


                                <div className="p-5">


                                    {/* AMOUNT */}

                                    <div className="pb-5 border-b border-slate-800">

                                        <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500 font-black">

                                            Total Expense

                                        </div>

                                        <div className="text-3xl font-black text-white mt-2">

                                            TZS{" "}

                                            {formatMoney(
                                                expenseAmount
                                            )}

                                        </div>

                                    </div>


                                    {/* MODE */}

                                    <div className="py-5 border-b border-slate-800">

                                        <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500 font-black mb-2">

                                            Settlement Mode

                                        </div>

                                        <div className="flex items-center gap-3">

                                            <div
                                                className={`w-9 h-9 flex items-center justify-center ${
                                                    isPaid
                                                        ? "bg-emerald-500/10 text-emerald-400"
                                                        : "bg-violet-500/10 text-violet-400"
                                                }`}
                                            >

                                                {isPaid
                                                    ? <FaWallet />
                                                    : <FaFileInvoiceDollar />
                                                }

                                            </div>

                                            <div>

                                                <div className="font-black text-white">

                                                    {isPaid
                                                        ? "Pay Now"
                                                        : "Pay Later"}

                                                </div>

                                                <div className="text-[11px] text-slate-500">

                                                    {isPaid
                                                        ? "Financial account will be charged."
                                                        : "Supplier payable will be created."}

                                                </div>

                                            </div>

                                        </div>

                                    </div>


                                    {/* ACCOUNT */}

                                    {isPaid && (

                                        <div className="py-5 border-b border-slate-800">

                                            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500 font-black mb-2">

                                                Payment Account

                                            </div>

                                            <div className="flex items-center gap-3">

                                                <FaBuilding className="text-cyan-400" />

                                                <div className="min-w-0">

                                                    <div className="text-sm font-bold text-white truncate">

                                                        {selectedFinancialAccount
                                                            ?.account_name ||
                                                            "Not selected"}

                                                    </div>

                                                    <div className="text-[11px] text-slate-500">

                                                        {selectedFinancialAccount
                                                            ? `Balance TZS ${formatMoney(selectedAccountBalance)}`
                                                            : "Select a funded account"}

                                                    </div>

                                                </div>

                                            </div>

                                        </div>
                                    )}


                                    {/* SUPPLIER */}

                                    {isUnpaid && (

                                        <div className="py-5 border-b border-slate-800">

                                            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500 font-black mb-2">

                                                Supplier

                                            </div>

                                            <div className="flex items-center gap-3">

                                                <FaUserTie className="text-violet-400" />

                                                <div className="min-w-0">

                                                    <div className="text-sm font-bold text-white truncate">

                                                        {selectedSupplier
                                                            ?.supplier_name ||
                                                            "Not selected"}

                                                    </div>

                                                    <div className="text-[11px] text-slate-500">

                                                        {form.bill_number
                                                            ? `Bill ${form.bill_number}`
                                                            : "Bill number not entered"}

                                                    </div>

                                                </div>

                                            </div>

                                        </div>
                                    )}


                                    {/* ACCOUNTING */}

                                    <div className="py-5">

                                        <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500 font-black mb-3">

                                            Accounting Effect

                                        </div>

                                        {isPaid ? (

                                            <div className="space-y-2 text-xs">

                                                <div className="flex justify-between gap-3">

                                                    <span className="text-slate-500">
                                                        Expense
                                                    </span>

                                                    <span className="text-white font-bold">
                                                        + TZS {formatMoney(expenseAmount)}
                                                    </span>

                                                </div>

                                                <div className="flex justify-between gap-3">

                                                    <span className="text-slate-500">
                                                        Financial Account
                                                    </span>

                                                    <span className="text-red-400 font-bold">
                                                        - TZS {formatMoney(expenseAmount)}
                                                    </span>

                                                </div>

                                            </div>

                                        ) : (

                                            <div className="space-y-2 text-xs">

                                                <div className="flex justify-between gap-3">

                                                    <span className="text-slate-500">
                                                        Expense
                                                    </span>

                                                    <span className="text-white font-bold">
                                                        + TZS {formatMoney(expenseAmount)}
                                                    </span>

                                                </div>

                                                <div className="flex justify-between gap-3">

                                                    <span className="text-slate-500">
                                                        Accounts Payable
                                                    </span>

                                                    <span className="text-violet-400 font-bold">
                                                        + TZS {formatMoney(expenseAmount)}
                                                    </span>

                                                </div>

                                                <div className="pt-2 text-[10px] text-slate-600">

                                                    Cash / bank is not reduced until the payable is paid.

                                                </div>

                                            </div>
                                        )}

                                    </div>


                                    {/* ACTIONS */}

                                    <div className="pt-2 space-y-2">

                                        <button
                                            type="submit"
                                            disabled={
                                                saving ||
                                                (
                                                    isPaid &&
                                                    (
                                                        !form.financial_account_id ||
                                                        !selectedAccountHasEnoughFunds
                                                    )
                                                )
                                            }
                                            className={`w-full py-3.5 flex items-center justify-center gap-2 font-black text-sm transition disabled:opacity-40 disabled:cursor-not-allowed ${
                                                isUnpaid
                                                    ? "bg-violet-600 hover:bg-violet-500 text-white"
                                                    : "bg-cyan-500 hover:bg-cyan-400 text-[#061017]"
                                            }`}
                                        >

                                            {saving ? (

                                                <>
                                                    <FaSpinner className="animate-spin" />
                                                    Processing...
                                                </>

                                            ) : (

                                                <>
                                                    <FaSave />

                                                    {isUnpaid
                                                        ? "Create Expense & Payable"
                                                        : "Save Expense & Payment"}
                                                </>

                                            )}

                                        </button>


                                        <button
                                            type="button"
                                            onClick={() =>
                                                navigate("/finance")
                                            }
                                            disabled={saving}
                                            className="w-full py-3 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 font-bold text-sm disabled:opacity-50"
                                        >

                                            Cancel

                                        </button>

                                    </div>

                                </div>

                            </div>

                        </aside>

                    </div>

                </form>

            </div>


            {/* ========================================================
                CREATE SUPPLIER DRAWER / MODAL
            ======================================================== */}

            {showSupplierModal && (

                <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">

                    <div className="w-full max-w-xl bg-[#0d1320] border border-slate-700 shadow-2xl">

                        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">

                            <div className="flex items-center gap-3">

                                <div className="w-9 h-9 bg-violet-500/10 text-violet-400 flex items-center justify-center">

                                    <FaUserTie />

                                </div>

                                <div>

                                    <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500 font-black">

                                        Supplier Management

                                    </div>

                                    <h2 className="font-black text-white">

                                        Create Supplier

                                    </h2>

                                </div>

                            </div>


                            <button
                                type="button"
                                onClick={closeSupplierModal}
                                disabled={savingSupplier}
                                className="w-9 h-9 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center"
                            >

                                <FaTimes />

                            </button>

                        </div>


                        <form
                            onSubmit={
                                handleCreateSupplier
                            }
                            className="p-5"
                        >

                            {supplierError && (

                                <div className="mb-5 border-l-4 border-red-500 bg-red-950/30 px-4 py-3 text-xs text-red-300">

                                    {supplierError}

                                </div>
                            )}


                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">


                                <Field
                                    label="Supplier Name"
                                    full
                                >

                                    <div className="relative">

                                        <FaUserTie className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs" />

                                        <input
                                            type="text"
                                            value={
                                                supplierForm.supplier_name
                                            }
                                            onChange={e =>
                                                updateSupplierField(
                                                    "supplier_name",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Enter supplier name"
                                            autoFocus
                                            className="dark-input pl-9"
                                        />

                                    </div>

                                </Field>


                                <Field
                                    label="Phone"
                                    optional
                                >

                                    <input
                                        type="text"
                                        value={
                                            supplierForm.phone
                                        }
                                        onChange={e =>
                                            updateSupplierField(
                                                "phone",
                                                e.target.value
                                            )
                                        }
                                        placeholder="Phone number"
                                        className="dark-input"
                                    />

                                </Field>


                                <Field
                                    label="Email"
                                    optional
                                >

                                    <input
                                        type="email"
                                        value={
                                            supplierForm.email
                                        }
                                        onChange={e =>
                                            updateSupplierField(
                                                "email",
                                                e.target.value
                                            )
                                        }
                                        placeholder="supplier@example.com"
                                        className="dark-input"
                                    />

                                </Field>


                                <Field
                                    label="Address"
                                    optional
                                    full
                                >

                                    <textarea
                                        rows="3"
                                        value={
                                            supplierForm.address
                                        }
                                        onChange={e =>
                                            updateSupplierField(
                                                "address",
                                                e.target.value
                                            )
                                        }
                                        placeholder="Supplier address"
                                        className="dark-input resize-none"
                                    />

                                </Field>

                            </div>


                            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6">

                                <button
                                    type="button"
                                    onClick={closeSupplierModal}
                                    disabled={savingSupplier}
                                    className="px-5 py-3 border border-slate-700 text-slate-400 hover:text-white font-bold text-sm"
                                >

                                    Cancel

                                </button>


                                <button
                                    type="submit"
                                    disabled={savingSupplier}
                                    className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                                >

                                    {savingSupplier ? (

                                        <>
                                            <FaSpinner className="animate-spin" />
                                            Creating...
                                        </>

                                    ) : (

                                        <>
                                            <FaPlus />
                                            Create Supplier
                                        </>
                                    )}

                                </button>

                            </div>

                        </form>

                    </div>

                </div>
            )}


            {/* ========================================================
                LOCAL STYLES
            ======================================================== */}

            <style>{`

                .dark-input {
                    width: 100%;
                    background: #080d17;
                    border: 1px solid #263244;
                    color: #e2e8f0;
                    padding: 0.72rem 0.85rem;
                    font-size: 0.82rem;
                    outline: none;
                    transition: border-color 0.15s ease,
                                box-shadow 0.15s ease;
                }

                .dark-input::placeholder {
                    color: #475569;
                }

                .dark-input:focus {
                    border-color: #22d3ee;
                    box-shadow: 0 0 0 2px rgba(34, 211, 238, 0.08);
                }

                .dark-input option {
                    background: #0d1320;
                    color: #e2e8f0;
                }

            `}</style>

        </div>
    );
}


// ============================================================
// FIELD COMPONENT
// ============================================================

function Field({
    label,
    optional = false,
    full = false,
    children
}) {

    return (

        <div className={full ? "md:col-span-2" : ""}>

            <label className="block text-[11px] uppercase tracking-[0.12em] font-black text-slate-500 mb-2">

                {label}

                {optional && (

                    <span className="normal-case tracking-normal font-normal text-slate-700 ml-1">

                        optional

                    </span>

                )}

            </label>

            {children}

        </div>
    );
}


// ============================================================
// METRIC COMPONENT
// ============================================================

function Metric({
    label,
    value,
    valueClass = "text-white"
}) {

    return (

        <div>

            <div className="text-[10px] uppercase tracking-[0.14em] font-black text-slate-600">

                {label}

            </div>

            <div className={`mt-1 text-base font-black ${valueClass}`}>

                {value}

            </div>

        </div>
    );
}