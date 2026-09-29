import React, {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    FaArrowLeft,
    FaBalanceScale,
    FaCalendarAlt,
    FaChartLine,
    FaCheckCircle,
    FaFileInvoiceDollar,
    FaPrint,
    FaRedo,
    FaSpinner,
    FaUniversity,
    FaWallet,
} from "react-icons/fa";

import {
    useNavigate,
} from "react-router-dom";

import { supabase } from "../../services/supabase";


// ============================================================
// HELPERS
// ============================================================

function money(value) {
    const number = Number(value || 0);

    return new Intl.NumberFormat("en-TZ", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(number);
}


function todayKey() {
    const date = new Date();

    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
    ].join("-");
}


function yearStartKey(dateValue = new Date()) {
    return `${dateValue.getFullYear()}-01-01`;
}


function monthStartKey(dateValue = new Date()) {
    return `${dateValue.getFullYear()}-${String(
        dateValue.getMonth() + 1
    ).padStart(2, "0")}-01`;
}


function previousMonthRange() {
    const now = new Date();

    const firstDay = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1
    );

    const lastDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        0
    );

    return {
        start: `${firstDay.getFullYear()}-${String(
            firstDay.getMonth() + 1
        ).padStart(2, "0")}-01`,

        end: `${lastDay.getFullYear()}-${String(
            lastDay.getMonth() + 1
        ).padStart(2, "0")}-${String(
            lastDay.getDate()
        ).padStart(2, "0")}`,
    };
}


function previousYearRange() {
    const year = new Date().getFullYear() - 1;

    return {
        start: `${year}-01-01`,
        end: `${year}-12-31`,
    };
}


function formatDate(value) {
    if (!value) {
        return "-";
    }

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    });
}


function normalizeNumber(value) {
    const number = Number(value || 0);

    return Number.isFinite(number)
        ? number
        : 0;
}


function isNonZero(value) {
    return Math.abs(
        normalizeNumber(value)
    ) > 0.005;
}


function isDateInRange(
    value,
    start,
    end
) {
    const date = String(
        value || ""
    ).slice(0, 10);

    if (!date) {
        return false;
    }

    if (start && date < start) {
        return false;
    }

    if (end && date > end) {
        return false;
    }

    return true;
}


function titleCase(value) {
    return String(value || "")
        .replace(/_/g, " ")
        .replace(/\b\w/g, char =>
            char.toUpperCase()
        );
}


function periodMovement(
    account,
    lines
) {
    return lines.reduce(
        (total, line) => {
            const debit =
                normalizeNumber(line?.debit);

            const credit =
                normalizeNumber(line?.credit);

            if (
                account?.account_type ===
                "revenue"
            ) {
                return total +
                    credit -
                    debit;
            }

            if (
                account?.account_type ===
                "expense"
            ) {
                return total +
                    debit -
                    credit;
            }

            if (
                account?.normal_balance ===
                "credit"
            ) {
                return total +
                    credit -
                    debit;
            }

            return total +
                debit -
                credit;
        },
        0
    );
}


function accountBalance(
    account,
    lines
) {
    const opening =
        normalizeNumber(
            account?.opening_balance
        );

    const movement =
        lines.reduce(
            (total, line) => {
                const debit =
                    normalizeNumber(
                        line?.debit
                    );

                const credit =
                    normalizeNumber(
                        line?.credit
                    );

                if (
                    account?.normal_balance ===
                    "credit"
                ) {
                    return total +
                        credit -
                        debit;
                }

                return total +
                    debit -
                    credit;
            },
            0
        );

    return opening + movement;
}


function displayCategory(account) {
    const category =
        String(
            account?.account_category || ""
        ).toLowerCase();

    if (
        category ===
        "cash_and_cash_equivalents"
    ) {
        return "Cash & Cash Equivalents";
    }

    if (
        category ===
        "cash & bank"
    ) {
        return "Cash & Cash Equivalents";
    }

    if (
        category ===
        "accounts receivable"
    ) {
        return "Accounts Receivable";
    }

    if (
        category ===
        "current assets"
    ) {
        return "Other Current Assets";
    }

    if (
        category ===
        "accounts payable"
    ) {
        return "Accounts Payable";
    }

    if (
        category ===
        "current liabilities"
    ) {
        return "Current Liabilities";
    }

    if (
        category === "equity"
    ) {
        return "Equity";
    }

    return titleCase(
        account?.account_category ||
        "Other"
    );
}


function groupAccounts(
    accounts,
    values
) {
    const groups =
        new Map();

    accounts.forEach(account => {
        const value =
            normalizeNumber(
                values.get(
                    String(account.id)
                )
            );

        if (!isNonZero(value)) {
            return;
        }

        const groupName =
            displayCategory(account);

        if (!groups.has(groupName)) {
            groups.set(
                groupName,
                []
            );
        }

        groups.get(groupName).push({
            account,
            value,
        });
    });

    return [...groups.entries()]
        .map(([name, rows]) => ({
            name,

            rows: rows.sort(
                (a, b) =>
                    String(
                        a.account.account_code ||
                        ""
                    ).localeCompare(
                        String(
                            b.account.account_code ||
                            ""
                        )
                    )
            ),

            total: rows.reduce(
                (sum, row) =>
                    sum + row.value,
                0
            ),
        }))
        .sort(
            (a, b) =>
                a.name.localeCompare(
                    b.name
                )
        );
}


// ============================================================
// STATEMENT LINE
// ============================================================

function StatementLine({
    code,
    label,
    value,
    bold = false,
    indent = false,
    total = false,
}) {
    const amount =
        normalizeNumber(value);

    return (
        <div
            className={[
                "grid grid-cols-[1fr_auto] items-center gap-4 py-2.5",

                total
                    ? "border-t border-slate-300 mt-1 pt-3"
                    : "border-b border-slate-100",

                bold
                    ? "font-semibold"
                    : "",
            ].join(" ")}
        >
            <div
                className={[
                    "flex min-w-0 items-center gap-3",

                    indent
                        ? "pl-5"
                        : "",
                ].join(" ")}
            >
                {code ? (
                    <span className="w-12 shrink-0 text-[11px] font-semibold text-slate-400">
                        {code}
                    </span>
                ) : (
                    <span className="w-12 shrink-0" />
                )}

                <span
                    className={[
                        "truncate",

                        total
                            ? "text-slate-900"
                            : "text-slate-700",

                        bold
                            ? "font-semibold"
                            : "",
                    ].join(" ")}
                >
                    {label}
                </span>
            </div>

            <span
                className={[
                    "font-mono text-sm tabular-nums",

                    amount < 0
                        ? "text-red-600"
                        : "text-slate-800",

                    total
                        ? "font-bold"
                        : "",
                ].join(" ")}
            >
                {money(amount)}
            </span>
        </div>
    );
}


// ============================================================
// GROUP BLOCK
// ============================================================

function GroupBlock({
    title,
    groups,
    valueLabel,
}) {
    return (
        <div className="mb-5">
            <div className="mb-2 flex items-center justify-between border-b border-slate-200 pb-2">
                <h4 className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-500">
                    {title}
                </h4>

                {valueLabel ? (
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        {valueLabel}
                    </span>
                ) : null}
            </div>

            {groups.map(group => (
                <div
                    key={group.name}
                    className="mb-4 last:mb-0"
                >
                    <p className="mb-1 text-xs font-bold text-slate-500">
                        {group.name}
                    </p>

                    {group.rows.map(row => (
                        <StatementLine
                            key={row.account.id}
                            code={
                                row.account.account_code
                            }
                            label={
                                row.account.account_name
                            }
                            value={row.value}
                            indent
                        />
                    ))}

                    <StatementLine
                        label={`${group.name} Total`}
                        value={group.total}
                        bold
                        total
                    />
                </div>
            ))}
        </div>
    );
}


// ============================================================
// MAIN COMPONENT
// ============================================================

function FinancialStatements() {
    const navigate =
        useNavigate();

    const [
        loading,
        setLoading,
    ] = useState(true);

    const [
        refreshing,
        setRefreshing,
    ] = useState(false);

    const [
        error,
        setError,
    ] = useState("");

    const [
        school,
        setSchool,
    ] = useState(null);

    const [
        accounts,
        setAccounts,
    ] = useState([]);

    const [
        entries,
        setEntries,
    ] = useState([]);

    const [
        activeStatement,
        setActiveStatement,
    ] = useState("income");

    const [
        preset,
        setPreset,
    ] = useState("current-year");

    const [
        startDate,
        setStartDate,
    ] = useState(
        yearStartKey()
    );

    const [
        endDate,
        setEndDate,
    ] = useState(
        todayKey()
    );


    // ========================================================
    // LOAD DATA
    // ========================================================

    async function loadData({
        silent = false,
    } = {}) {
        try {
            if (silent) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            setError("");

            const {
                data: {
                    user,
                } = {},
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
                data: profileData,
                error: profileError,
            } = await supabase
                .from("profiles")
                .select(
                    "id, school_id, role_id"
                )
                .eq(
                    "id",
                    user.id
                )
                .single();

            if (profileError) {
                throw profileError;
            }

            if (!profileData?.school_id) {
                throw new Error(
                    "Your profile is not linked to a school."
                );
            }

            const [
                schoolResult,
                ledgerResult,
            ] = await Promise.all([
                supabase
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
                    .eq(
                        "id",
                        profileData.school_id
                    )
                    .maybeSingle(),

                supabase
                    .schema("finance")
                    .rpc(
                        "get_general_ledger",
                        {
                            p_school_id:
                                Number(
                                    profileData.school_id
                                ),
                        }
                    ),
            ]);

            if (schoolResult.error) {
                throw schoolResult.error;
            }

            if (ledgerResult.error) {
                throw ledgerResult.error;
            }

            const payload =
                ledgerResult.data || {};

            const safeAccounts =
                Array.isArray(
                    payload.accounts
                )
                    ? payload.accounts
                    : [];

            const safeEntries =
                Array.isArray(
                    payload.entries
                )
                    ? payload.entries.map(
                        entry => ({
                            ...entry,

                            lines:
                                Array.isArray(
                                    entry.lines
                                )
                                    ? entry.lines
                                    : [],
                        })
                    )
                    : [];

            setSchool(
                schoolResult.data || null
            );

            setAccounts(
                safeAccounts
            );

            setEntries(
                safeEntries
            );
        } catch (loadError) {
            console.error(
                "Financial Statements load error:",
                loadError
            );

            setError(
                loadError?.message ||
                "Failed to load financial statements."
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }


    useEffect(() => {
        loadData();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    // ========================================================
    // PRESET
    // ========================================================

    function applyPreset(
        nextPreset
    ) {
        setPreset(
            nextPreset
        );

        const now =
            new Date();

        if (
            nextPreset ===
            "current-month"
        ) {
            setStartDate(
                monthStartKey(now)
            );

            setEndDate(
                todayKey()
            );

            return;
        }

        if (
            nextPreset ===
            "current-year"
        ) {
            setStartDate(
                yearStartKey(now)
            );

            setEndDate(
                todayKey()
            );

            return;
        }

        if (
            nextPreset ===
            "previous-month"
        ) {
            const range =
                previousMonthRange();

            setStartDate(
                range.start
            );

            setEndDate(
                range.end
            );

            return;
        }

        if (
            nextPreset ===
            "previous-year"
        ) {
            const range =
                previousYearRange();

            setStartDate(
                range.start
            );

            setEndDate(
                range.end
            );

            return;
        }

        if (
            nextPreset === "all"
        ) {
            const datedEntries =
                entries
                    .map(entry =>
                        String(
                            entry.transaction_date ||
                            ""
                        ).slice(0, 10)
                    )
                    .filter(Boolean)
                    .sort();

            setStartDate(
                datedEntries[0] ||
                startDate
            );

            setEndDate(
                datedEntries[
                    datedEntries.length - 1
                ] ||
                todayKey()
            );
        }
    }


    // ========================================================
    // POSTED ENTRIES
    // ========================================================

    const postedEntries =
        useMemo(() => {
            return entries
                .filter(
                    entry =>
                        String(
                            entry?.status ||
                            ""
                        ).toLowerCase() ===
                        "posted"
                )
                .map(entry => ({
                    ...entry,

                    transaction_date:
                        String(
                            entry?.transaction_date ||
                            ""
                        ).slice(0, 10),

                    lines:
                        Array.isArray(
                            entry?.lines
                        )
                            ? entry.lines
                            : [],
                }))
                .filter(
                    entry =>
                        Boolean(
                            entry.transaction_date
                        )
                );
        }, [entries]);


    // ========================================================
    // PERIOD ENTRIES
    // ========================================================

    const periodEntries =
        useMemo(() => {
            return postedEntries.filter(
                entry =>
                    isDateInRange(
                        entry.transaction_date,
                        startDate,
                        endDate
                    )
            );
        }, [
            postedEntries,
            startDate,
            endDate,
        ]);


    // ========================================================
    // PERIOD LINES
    // ========================================================

    const periodLines =
        useMemo(() => {
            return periodEntries.flatMap(
                entry =>
                    entry.lines.map(
                        line => ({
                            ...line,

                            journal_entry_id:
                                entry.id,

                            transaction_date:
                                entry.transaction_date,
                        })
                    )
            );
        }, [periodEntries]);


    // ========================================================
    // AS-OF ENTRIES
    // ========================================================

    const asOfEntries =
        useMemo(() => {
            return postedEntries.filter(
                entry =>
                    entry.transaction_date <=
                    endDate
            );
        }, [
            postedEntries,
            endDate,
        ]);


    const asOfLines =
        useMemo(() => {
            return asOfEntries.flatMap(
                entry =>
                    entry.lines.map(
                        line => ({
                            ...line,

                            journal_entry_id:
                                entry.id,

                            transaction_date:
                                entry.transaction_date,
                        })
                    )
            );
        }, [asOfEntries]);


    // ========================================================
    // INCOME VALUES
    // ========================================================

    const incomeValues =
        useMemo(() => {
            const values =
                new Map();

            accounts.forEach(
                account => {
                    if (
                        account.account_type !==
                            "revenue" &&
                        account.account_type !==
                            "expense"
                    ) {
                        return;
                    }

                    const lines =
                        periodLines.filter(
                            line =>
                                String(
                                    line.account_id
                                ) ===
                                String(
                                    account.id
                                )
                        );

                    values.set(
                        String(account.id),
                        periodMovement(
                            account,
                            lines
                        )
                    );
                }
            );

            return values;
        }, [
            accounts,
            periodLines,
        ]);


    // ========================================================
    // POSITION VALUES
    // ========================================================

    const positionValues =
        useMemo(() => {
            const values =
                new Map();

            accounts.forEach(
                account => {
                    if (
                        ![
                            "asset",
                            "liability",
                            "equity",
                        ].includes(
                            account.account_type
                        )
                    ) {
                        return;
                    }

                    const lines =
                        asOfLines.filter(
                            line =>
                                String(
                                    line.account_id
                                ) ===
                                String(
                                    account.id
                                )
                        );

                    values.set(
                        String(account.id),
                        accountBalance(
                            account,
                            lines
                        )
                    );
                }
            );

            return values;
        }, [
            accounts,
            asOfLines,
        ]);


    // ========================================================
    // INCOME STATEMENT
    // ========================================================

    const incomeData =
        useMemo(() => {
            const revenueAccounts =
                accounts.filter(
                    account =>
                        account.account_type ===
                        "revenue"
                );

            const expenseAccounts =
                accounts.filter(
                    account =>
                        account.account_type ===
                        "expense"
                );

            const revenueGroups =
                groupAccounts(
                    revenueAccounts,
                    incomeValues
                );

            const expenseGroups =
                groupAccounts(
                    expenseAccounts,
                    incomeValues
                );

            const totalRevenue =
                revenueGroups.reduce(
                    (sum, group) =>
                        sum + group.total,
                    0
                );

            const totalExpenses =
                expenseGroups.reduce(
                    (sum, group) =>
                        sum + group.total,
                    0
                );

            return {
                revenueGroups,
                expenseGroups,
                totalRevenue,
                totalExpenses,
                profit:
                    totalRevenue -
                    totalExpenses,
            };
        }, [
            accounts,
            incomeValues,
        ]);


    // ========================================================
    // FINANCIAL POSITION
    // ========================================================

    const positionData =
        useMemo(() => {
            const assetAccounts =
                accounts.filter(
                    account =>
                        account.account_type ===
                        "asset"
                );

            const liabilityAccounts =
                accounts.filter(
                    account =>
                        account.account_type ===
                        "liability"
                );

            const equityAccounts =
                accounts.filter(
                    account =>
                        account.account_type ===
                        "equity"
                );

            const assetGroups =
                groupAccounts(
                    assetAccounts,
                    positionValues
                );

            const liabilityGroups =
                groupAccounts(
                    liabilityAccounts,
                    positionValues
                );

            const equityGroups =
                groupAccounts(
                    equityAccounts,
                    positionValues
                );

            const totalAssets =
                assetGroups.reduce(
                    (sum, group) =>
                        sum + group.total,
                    0
                );

            const totalLiabilities =
                liabilityGroups.reduce(
                    (sum, group) =>
                        sum + group.total,
                    0
                );

            const directEquity =
                equityGroups.reduce(
                    (sum, group) =>
                        sum + group.total,
                    0
                );


            // ------------------------------------------------
            // CUMULATIVE SURPLUS / DEFICIT
            // ------------------------------------------------

            const cumulativeRevenue =
                accounts
                    .filter(
                        account =>
                            account.account_type ===
                            "revenue"
                    )
                    .reduce(
                        (sum, account) => {
                            const lines =
                                asOfLines.filter(
                                    line =>
                                        String(
                                            line.account_id
                                        ) ===
                                        String(
                                            account.id
                                        )
                                );

                            return (
                                sum +
                                periodMovement(
                                    account,
                                    lines
                                )
                            );
                        },
                        0
                    );


            const cumulativeExpenses =
                accounts
                    .filter(
                        account =>
                            account.account_type ===
                            "expense"
                    )
                    .reduce(
                        (sum, account) => {
                            const lines =
                                asOfLines.filter(
                                    line =>
                                        String(
                                            line.account_id
                                        ) ===
                                        String(
                                            account.id
                                        )
                                );

                            return (
                                sum +
                                periodMovement(
                                    account,
                                    lines
                                )
                            );
                        },
                        0
                    );


            const accumulatedSurplus =
                cumulativeRevenue -
                cumulativeExpenses;


            const totalEquity =
                directEquity +
                accumulatedSurplus;


            const totalLiabilitiesAndEquity =
                totalLiabilities +
                totalEquity;


            const balanceDifference =
                totalAssets -
                totalLiabilitiesAndEquity;


            return {
                assetGroups,
                liabilityGroups,
                equityGroups,

                totalAssets,

                totalLiabilities,

                directEquity,

                accumulatedSurplus,

                totalEquity,

                totalLiabilitiesAndEquity,

                balanceDifference,
            };
        }, [
            accounts,
            asOfLines,
            positionValues,
        ]);


    // ========================================================
    // LABELS
    // ========================================================

    const statementPeriodLabel =
        useMemo(() => {
            return `${formatDate(
                startDate
            )} – ${formatDate(
                endDate
            )}`;
        }, [
            startDate,
            endDate,
        ]);


    const positionDateLabel =
        formatDate(endDate);


    // ========================================================
    // PRINT
    // ========================================================

    function printStatement() {
        window.print();
    }


    // ========================================================
    // LOADING
    // ========================================================

    if (loading) {
        return (
            <div className="min-h-[70vh] bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <FaSpinner className="mx-auto animate-spin text-3xl text-blue-600" />

                    <p className="mt-3 text-sm font-semibold text-slate-700">
                        Loading financial statements...
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                        Reading posted accounting entries.
                    </p>
                </div>
            </div>
        );
    }


    // ========================================================
    // MAIN RENDER
    // ========================================================

    return (
        <div className="financial-statement-print-area min-h-screen bg-slate-50 px-4 py-5 md:px-6 lg:px-8">

            {/* ==================================================
                PRINT CONTROL
            ================================================== */}

            <style>
                {`
                    @media print {

                        html,
                        body {
                            background: #ffffff !important;
                            margin: 0 !important;
                            padding: 0 !important;
                        }

                        /*
                         * IMPORTANT:
                         * Hide the entire application layout first.
                         * This removes sidebar, topbar and dashboard
                         * elements from the print output.
                         */
                        body * {
                            visibility: hidden !important;
                        }

                        /*
                         * Then make only the financial statement
                         * print area visible again.
                         */
                        .financial-statement-print-area,
                        .financial-statement-print-area * {
                            visibility: visible !important;
                        }

                        /*
                         * Pull the statement out of the normal dashboard
                         * layout so it becomes the only printable area.
                         */
                        .financial-statement-print-area {
                            position: absolute !important;
                            left: 0 !important;
                            top: 0 !important;
                            width: 100% !important;
                            max-width: none !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            background: #ffffff !important;
                        }

                        /*
                         * Hide controls that should never appear
                         * on the printed statement.
                         */
                        .print-hide {
                            display: none !important;
                        }

                        .statement-shell {
                            box-shadow: none !important;
                            border: 0 !important;
                            border-radius: 0 !important;
                            width: 100% !important;
                            max-width: none !important;
                            margin: 0 !important;
                        }

                        .statement-page {
                            width: 100% !important;
                            max-width: none !important;
                            margin: 0 !important;
                            padding: 0 !important;
                        }

                        @page {
                            size: A4;
                            margin: 12mm;
                        }
                    }
                `}
            </style>


            <div className="mx-auto max-w-7xl statement-page">

                {/* =================================================
                    TOP TOOLBAR
                ================================================= */}

                <div className="print-hide mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                    <div className="flex items-center gap-3">

                        <button
                            type="button"
                            onClick={() =>
                                navigate(
                                    "/finance/dashboard"
                                )
                            }
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
                            title="Back to Finance Dashboard"
                        >
                            <FaArrowLeft />
                        </button>

                        <div>
                            <div className="flex items-center gap-2">
                                <FaFileInvoiceDollar className="text-blue-600" />

                                <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                                    Financial Statements
                                </h1>
                            </div>

                            <p className="mt-1 text-sm text-slate-500">
                                Professional management statements generated from posted journals.
                            </p>
                        </div>
                    </div>


                    <div className="flex flex-wrap items-center gap-2">

                        <button
                            type="button"
                            onClick={() =>
                                loadData({
                                    silent: true,
                                })
                            }
                            disabled={refreshing}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                        >
                            {refreshing ? (
                                <FaSpinner className="animate-spin" />
                            ) : (
                                <FaRedo />
                            )}

                            Refresh
                        </button>


                        <button
                            type="button"
                            onClick={printStatement}
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800"
                        >
                            <FaPrint />
                            Print Statement
                        </button>

                    </div>
                </div>


                {/* =================================================
                    ERROR
                ================================================= */}

                {error ? (
                    <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">

                        <div className="font-bold">
                            Financial statement loading error
                        </div>

                        <div className="mt-1">
                            {error}
                        </div>

                    </div>
                ) : null}


                {/* =================================================
                    FILTER PANEL
                ================================================= */}

                <div className="print-hide mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">

                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[auto_1fr_auto] xl:items-end">

                        {/* STATEMENT TYPE */}

                        <div>

                            <label className="mb-2 block text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                                Statement
                            </label>

                            <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-1">

                                <button
                                    type="button"
                                    onClick={() =>
                                        setActiveStatement(
                                            "income"
                                        )
                                    }
                                    className={[
                                        "rounded-lg px-4 py-2 text-xs font-bold transition",

                                        activeStatement === "income"
                                            ? "bg-white text-blue-700 shadow-sm"
                                            : "text-slate-500 hover:text-slate-800",
                                    ].join(" ")}
                                >
                                    Income Statement
                                </button>


                                <button
                                    type="button"
                                    onClick={() =>
                                        setActiveStatement(
                                            "position"
                                        )
                                    }
                                    className={[
                                        "rounded-lg px-4 py-2 text-xs font-bold transition",

                                        activeStatement === "position"
                                            ? "bg-white text-emerald-700 shadow-sm"
                                            : "text-slate-500 hover:text-slate-800",
                                    ].join(" ")}
                                >
                                    Financial Position
                                </button>

                            </div>
                        </div>


                        {/* DATE FILTERS */}

                        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">

                            {/* PRESET */}

                            <div>

                                <label className="mb-2 block text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                                    Preset
                                </label>

                                <select
                                    value={preset}
                                    onChange={event =>
                                        applyPreset(
                                            event.target.value
                                        )
                                    }
                                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
                                >
                                    <option value="current-month">
                                        Current Month
                                    </option>

                                    <option value="current-year">
                                        Current Year
                                    </option>

                                    <option value="previous-month">
                                        Previous Month
                                    </option>

                                    <option value="previous-year">
                                        Previous Year
                                    </option>

                                    <option value="all">
                                        All Available
                                    </option>

                                    <option value="custom">
                                        Custom
                                    </option>
                                </select>

                            </div>


                            {/* FROM */}

                            <div>

                                <label className="mb-2 block text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                                    From
                                </label>

                                <div className="relative">

                                    <FaCalendarAlt className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={event => {
                                            setPreset(
                                                "custom"
                                            );

                                            setStartDate(
                                                event.target.value
                                            );
                                        }}
                                        className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
                                    />

                                </div>
                            </div>


                            {/* END */}

                            <div>

                                <label className="mb-2 block text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                                    To / As At
                                </label>

                                <div className="relative">

                                    <FaCalendarAlt className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={event => {
                                            setPreset(
                                                "custom"
                                            );

                                            setEndDate(
                                                event.target.value
                                            );
                                        }}
                                        className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
                                    />

                                </div>
                            </div>


                            {/* ENTRY COUNT */}

                            <div className="flex items-end">

                                <div className="w-full rounded-xl bg-slate-50 px-3 py-2.5">

                                    <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                                        Posted Entries
                                    </p>

                                    <p className="mt-1 text-lg font-extrabold text-slate-900">
                                        {periodEntries.length}
                                    </p>

                                </div>

                            </div>

                        </div>

                    </div>

                </div>


                {/* =================================================
                    STATEMENT PAPER
                ================================================= */}

                <div className="statement-shell overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

                    {/* =================================================
                        HEADER
                    ================================================= */}

                    <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-6 py-7 text-white md:px-9">

                        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">

                            <div className="flex items-center gap-4">

                                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/20">

                                    {school?.logo ? (
                                        <img
                                            src={school.logo}
                                            alt={
                                                school.school_name ||
                                                "School"
                                            }
                                            className="h-full w-full object-contain p-2"
                                        />
                                    ) : (
                                        <FaUniversity className="text-2xl text-white/80" />
                                    )}

                                </div>


                                <div className="min-w-0">

                                    <h2 className="truncate text-xl font-extrabold md:text-2xl">
                                        {school?.school_name ||
                                            "AfriCore School"}
                                    </h2>

                                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                                        {school?.registration_number
                                            ? `Registration No. ${school.registration_number}`
                                            : "Financial Management System"}
                                    </p>

                                    <p className="mt-1 text-xs text-slate-400">
                                        {school?.address ||
                                            school?.phone ||
                                            school?.email ||
                                            "AfriCore ERP PRO"}
                                    </p>

                                </div>

                            </div>


                            <div className="md:text-right">

                                <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-blue-300">
                                    {activeStatement === "income"
                                        ? "Income Statement"
                                        : "Statement of Financial Position"}
                                </p>

                                <p className="mt-2 text-sm font-semibold text-white">
                                    {activeStatement === "income"
                                        ? `For the period ${statementPeriodLabel}`
                                        : `As at ${positionDateLabel}`}
                                </p>

                                <p className="mt-1 text-[11px] text-slate-400">
                                    Based on posted accounting entries
                                </p>

                            </div>

                        </div>

                    </div>


                    {/* =================================================
                        KPI STRIP
                    ================================================= */}

                    <div className="grid grid-cols-1 divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">

                        {/* INCOME */}

                        <div className="px-6 py-5 md:px-9">

                            <div className="flex items-center gap-3">

                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                                    <FaChartLine />
                                </div>

                                <div>

                                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
                                        Total Income
                                    </p>

                                    <p className="mt-1 text-xl font-extrabold text-slate-900">
                                        TZS{" "}
                                        {money(
                                            incomeData.totalRevenue
                                        )}
                                    </p>

                                </div>

                            </div>

                        </div>


                        {/* EXPENSES */}

                        <div className="px-6 py-5 md:px-9">

                            <div className="flex items-center gap-3">

                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                                    <FaWallet />
                                </div>

                                <div>

                                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
                                        Total Expenses
                                    </p>

                                    <p className="mt-1 text-xl font-extrabold text-slate-900">
                                        TZS{" "}
                                        {money(
                                            incomeData.totalExpenses
                                        )}
                                    </p>

                                </div>

                            </div>

                        </div>


                        {/* RESULT */}

                        <div className="px-6 py-5 md:px-9">

                            <div className="flex items-center gap-3">

                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                                    <FaBalanceScale />
                                </div>

                                <div>

                                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
                                        {activeStatement === "income"
                                            ? "Net Surplus / (Deficit)"
                                            : "Net Assets"}
                                    </p>

                                    <p className="mt-1 text-xl font-extrabold text-slate-900">
                                        TZS{" "}
                                        {money(
                                            activeStatement ===
                                                "income"
                                                ? incomeData.profit
                                                : positionData.totalAssets -
                                                  positionData.totalLiabilities
                                        )}
                                    </p>

                                </div>

                            </div>

                        </div>

                    </div>


                    {/* =================================================
                        BODY
                    ================================================= */}

                    <div className="px-6 py-7 md:px-9 md:py-9">

                        {/* =================================================
                            INCOME STATEMENT
                        ================================================= */}

                        {activeStatement ===
                        "income" ? (
                            <>

                                <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">

                                    {/* REVENUE */}

                                    <section>

                                        <div className="mb-4 flex items-center justify-between">

                                            <div>

                                                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-600">
                                                    Statement Section A
                                                </p>

                                                <h3 className="mt-1 text-lg font-extrabold text-slate-900">
                                                    Income / Revenue
                                                </h3>

                                            </div>

                                            <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-blue-700">
                                                Credit-based
                                            </span>

                                        </div>


                                        {incomeData.revenueGroups.length >
                                        0 ? (
                                            <GroupBlock
                                                title="Operating Income"
                                                groups={
                                                    incomeData.revenueGroups
                                                }
                                                valueLabel="TZS"
                                            />
                                        ) : (
                                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
                                                No posted income was recorded for the selected period.
                                            </div>
                                        )}


                                        <StatementLine
                                            label="TOTAL INCOME"
                                            value={
                                                incomeData.totalRevenue
                                            }
                                            bold
                                            total
                                        />

                                    </section>


                                    {/* EXPENSES */}

                                    <section>

                                        <div className="mb-4 flex items-center justify-between">

                                            <div>

                                                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-orange-600">
                                                    Statement Section B
                                                </p>

                                                <h3 className="mt-1 text-lg font-extrabold text-slate-900">
                                                    Operating Expenses
                                                </h3>

                                            </div>

                                            <span className="rounded-full bg-orange-50 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-orange-700">
                                                Debit-based
                                            </span>

                                        </div>


                                        {incomeData.expenseGroups.length >
                                        0 ? (
                                            <GroupBlock
                                                title="Operating Expenses"
                                                groups={
                                                    incomeData.expenseGroups
                                                }
                                                valueLabel="TZS"
                                            />
                                        ) : (
                                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
                                                No posted expenses were recorded for the selected period.
                                            </div>
                                        )}


                                        <StatementLine
                                            label="TOTAL OPERATING EXPENSES"
                                            value={
                                                incomeData.totalExpenses
                                            }
                                            bold
                                            total
                                        />

                                    </section>

                                </div>


                                {/* RESULT */}

                                <div className="mt-8 rounded-2xl border border-slate-300 bg-slate-50 px-5 py-5 md:px-7">

                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                                        <div>

                                            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
                                                Final Result
                                            </p>

                                            <h3 className="mt-1 text-xl font-extrabold text-slate-900">
                                                Surplus / (Deficit) for the Period
                                            </h3>

                                            <p className="mt-1 text-xs text-slate-500">
                                                Total income less total operating expenses.
                                            </p>

                                        </div>


                                        <div className="text-left sm:text-right">

                                            <p
                                                className={[
                                                    "text-2xl font-extrabold font-mono tabular-nums",

                                                    incomeData.profit <
                                                    0
                                                        ? "text-red-600"
                                                        : "text-emerald-700",
                                                ].join(" ")}
                                            >
                                                TZS{" "}
                                                {money(
                                                    incomeData.profit
                                                )}
                                            </p>

                                            <p className="mt-1 text-xs font-semibold text-slate-500">
                                                {incomeData.profit >= 0
                                                    ? "Surplus"
                                                    : "Deficit"}
                                            </p>

                                        </div>

                                    </div>

                                </div>

                            </>
                        ) : (
                            /* =================================================
                               FINANCIAL POSITION
                            ================================================= */

                            <>

                                <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">

                                    {/* ASSETS */}

                                    <section>

                                        <div className="mb-4 flex items-center justify-between">

                                            <div>

                                                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-600">
                                                    Statement Section A
                                                </p>

                                                <h3 className="mt-1 text-lg font-extrabold text-slate-900">
                                                    Assets
                                                </h3>

                                            </div>

                                            <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-blue-700">
                                                What the school controls
                                            </span>

                                        </div>


                                        {positionData.assetGroups.length >
                                        0 ? (
                                            <GroupBlock
                                                title="Asset Classes"
                                                groups={
                                                    positionData.assetGroups
                                                }
                                                valueLabel="TZS"
                                            />
                                        ) : (
                                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
                                                No non-zero asset balances were found as at the selected date.
                                            </div>
                                        )}


                                        <StatementLine
                                            label="TOTAL ASSETS"
                                            value={
                                                positionData.totalAssets
                                            }
                                            bold
                                            total
                                        />

                                    </section>


                                    {/* LIABILITIES & EQUITY */}

                                    <section>

                                        <div className="mb-4 flex items-center justify-between">

                                            <div>

                                                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-purple-600">
                                                    Statement Section B
                                                </p>

                                                <h3 className="mt-1 text-lg font-extrabold text-slate-900">
                                                    Liabilities & Equity
                                                </h3>

                                            </div>

                                            <span className="rounded-full bg-purple-50 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-purple-700">
                                                Funding of assets
                                            </span>

                                        </div>


                                        {positionData.liabilityGroups.length >
                                        0 ? (
                                            <GroupBlock
                                                title="Liabilities"
                                                groups={
                                                    positionData.liabilityGroups
                                                }
                                                valueLabel="TZS"
                                            />
                                        ) : (
                                            <div className="mb-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-center text-sm text-slate-500">
                                                No non-zero liabilities were found as at the selected date.
                                            </div>
                                        )}


                                        {positionData.equityGroups.length >
                                        0 ? (
                                            <GroupBlock
                                                title="School Equity"
                                                groups={
                                                    positionData.equityGroups
                                                }
                                                valueLabel="TZS"
                                            />
                                        ) : null}


                                        <StatementLine
                                            label="Accumulated Surplus / (Deficit)"
                                            value={
                                                positionData.accumulatedSurplus
                                            }
                                            bold
                                        />


                                        <StatementLine
                                            label="TOTAL EQUITY"
                                            value={
                                                positionData.totalEquity
                                            }
                                            bold
                                            total
                                        />


                                        <StatementLine
                                            label="TOTAL LIABILITIES + EQUITY"
                                            value={
                                                positionData.totalLiabilitiesAndEquity
                                            }
                                            bold
                                            total
                                        />

                                    </section>

                                </div>


                                {/* ACCOUNTING EQUATION */}

                                <div
                                    className={[
                                        "mt-8 flex flex-col gap-4 rounded-2xl border px-5 py-5 md:flex-row md:items-center md:justify-between md:px-7",

                                        Math.abs(
                                            positionData.balanceDifference
                                        ) <= 0.01
                                            ? "border-emerald-200 bg-emerald-50/50"
                                            : "border-red-200 bg-red-50/50",
                                    ].join(" ")}
                                >

                                    <div className="flex items-start gap-3">

                                        <div
                                            className={[
                                                "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",

                                                Math.abs(
                                                    positionData.balanceDifference
                                                ) <= 0.01
                                                    ? "bg-emerald-50 text-emerald-600"
                                                    : "bg-red-50 text-red-600",
                                            ].join(" ")}
                                        >
                                            {Math.abs(
                                                positionData.balanceDifference
                                            ) <= 0.01 ? (
                                                <FaCheckCircle />
                                            ) : (
                                                <FaBalanceScale />
                                            )}
                                        </div>


                                        <div>

                                            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
                                                Accounting equation check
                                            </p>

                                            <h3 className="mt-1 text-lg font-extrabold text-slate-900">
                                                Assets = Liabilities + Equity
                                            </h3>

                                            <p className="mt-1 text-xs text-slate-500">
                                                Difference after applying posted transactions through {positionDateLabel}.
                                            </p>

                                        </div>

                                    </div>


                                    <div className="text-left md:text-right">

                                        <p
                                            className={[
                                                "font-mono text-xl font-extrabold tabular-nums",

                                                Math.abs(
                                                    positionData.balanceDifference
                                                ) <= 0.01
                                                    ? "text-emerald-700"
                                                    : "text-red-600",
                                            ].join(" ")}
                                        >
                                            TZS{" "}
                                            {money(
                                                positionData.balanceDifference
                                            )}
                                        </p>

                                        <p
                                            className={[
                                                "mt-1 text-xs font-bold",

                                                Math.abs(
                                                    positionData.balanceDifference
                                                ) <= 0.01
                                                    ? "text-emerald-600"
                                                    : "text-red-600",
                                            ].join(" ")}
                                        >
                                            {Math.abs(
                                                positionData.balanceDifference
                                            ) <= 0.01
                                                ? "BALANCED"
                                                : "OUT OF BALANCE"}
                                        </p>

                                    </div>

                                </div>

                            </>
                        )}

                    </div>


                    {/* =================================================
                        FOOTER
                    ================================================= */}

                    <div className="border-t border-slate-200 bg-slate-50 px-6 py-5 md:px-9">

                        <div className="flex flex-col gap-3 text-[11px] text-slate-500 md:flex-row md:items-center md:justify-between">

                            <div>

                                <span className="font-semibold text-slate-600">
                                    Prepared by AfriCore ERP PRO
                                </span>

                                <span className="mx-2 text-slate-300">
                                    •
                                </span>

                                Posted journals only

                            </div>


                            <div className="md:text-right">

                                <div>
                                    Statement generated:{" "}
                                    {formatDate(
                                        todayKey()
                                    )}
                                </div>

                                <div className="mt-1 text-[10px] text-slate-400">
                                    Financial position is cumulative to the selected statement date.
                                </div>

                            </div>

                        </div>

                    </div>

                </div>

            </div>

        </div>
    );
}


export default FinancialStatements;