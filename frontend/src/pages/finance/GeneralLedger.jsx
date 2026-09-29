import React, {
    useEffect,
    useMemo,
    useState
} from "react";

import {
    FaArrowLeft,
    FaBook,
    FaChevronDown,
    FaChevronRight,
    FaExclamationTriangle,
    FaFilter,
    FaRedo,
    FaSearch,
    FaSpinner
} from "react-icons/fa";

import { useNavigate } from "react-router-dom";

import { supabase } from "../../services/supabase";


// =========================================================
// HELPERS
// =========================================================

const money = (value) => {
    const number = Number(value || 0);

    return new Intl.NumberFormat("en-TZ", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(number);
};


const dateOnly = (value) => {
    if (!value) return "-";

    return new Date(value).toLocaleDateString(
        "en-GB"
    );
};


// =========================================================
// GENERAL LEDGER
// =========================================================

function GeneralLedger() {

    const navigate = useNavigate();


    // =====================================================
    // STATE
    // =====================================================

    const [loading, setLoading] = useState(true);

    const [refreshing, setRefreshing] =
        useState(false);

    const [error, setError] =
        useState("");

    const [profile, setProfile] =
        useState(null);

    const [accounts, setAccounts] =
        useState([]);

    const [entries, setEntries] =
        useState([]);

    const [lines, setLines] =
        useState([]);

    const [expandedEntry, setExpandedEntry] =
        useState(null);


    // =====================================================
    // FILTERS
    // =====================================================

    const [search, setSearch] =
        useState("");

    const [accountFilter, setAccountFilter] =
        useState("");

    const [statusFilter, setStatusFilter] =
        useState("");

    const [fromDate, setFromDate] =
        useState("");

    const [toDate, setToDate] =
        useState("");


    // =====================================================
    // LOAD PROFILE
    // =====================================================

    const loadProfile = async () => {

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
                "User session not found."
            );
        }


        const {
            data,
            error: profileError
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


        if (!data?.school_id) {
            throw new Error(
                "Your profile is not assigned to a school."
            );
        }


        setProfile(data);

        return data;
    };


    // =====================================================
    // LOAD ACCOUNTS
    // =====================================================

    const loadAccounts = async (
        schoolId
    ) => {

        const {
            data,
            error
        } = await supabase
            .schema("finance")
            .from("chart_of_accounts")
            .select(`
                id,
                account_code,
                account_name,
                account_type,
                normal_balance
            `)
            .eq(
                "school_id",
                Number(schoolId)
            )
            .order("account_code", {
                ascending: true
            });


        if (error) {
            throw error;
        }


        setAccounts(
            Array.isArray(data)
                ? data
                : []
        );
    };


    // =====================================================
    // LOAD JOURNAL ENTRIES
    // =====================================================

    const loadEntries = async (
        schoolId
    ) => {

        const {
            data,
            error
        } = await supabase
            .schema("finance")
            .from("journal_entries")
            .select(`
                id,
                school_id,
                journal_number,
                transaction_date,
                period_id,
                reference_number,
                description,
                source_type,
                source_id,
                status,
                created_by,
                approved_by,
                approved_at,
                posted_at,
                created_at
            `)
            .eq(
                "school_id",
                Number(schoolId)
            )
            .order(
                "transaction_date",
                {
                    ascending: false
                }
            )
            .order(
                "journal_number",
                {
                    ascending: false
                }
            );


        if (error) {
            throw error;
        }


        setEntries(
            Array.isArray(data)
                ? data
                : []
        );


        return Array.isArray(data)
            ? data
            : [];
    };


    // =====================================================
    // LOAD JOURNAL LINES
    // =====================================================

    const loadLines = async (
        entryData
    ) => {

        if (!entryData.length) {

            setLines([]);

            return;
        }


        const entryIds =
            entryData.map(
                item => item.id
            );


        const {
            data,
            error
        } = await supabase
            .schema("finance")
            .from("journal_lines")
            .select(`
                id,
                journal_entry_id,
                line_number,
                account_id,
                party_id,
                description,
                debit,
                credit,
                created_at
            `)
            .in(
                "journal_entry_id",
                entryIds
            )
            .order(
                "line_number",
                {
                    ascending: true
                }
            );


        if (error) {
            throw error;
        }


        setLines(
            Array.isArray(data)
                ? data
                : []
        );
    };


    // =====================================================
    // LOAD ALL
    //
    // IMPORTANT:
    // General Ledger is loaded through one SECURITY DEFINER
    // finance RPC so entries, lines and accounts always come
    // from the same database snapshot.
    // =====================================================

    const loadData = async (
        showFullLoading = true
    ) => {

        try {

            if (showFullLoading) {
                setLoading(true);
            } else {
                setRefreshing(true);
            }

            setError("");

            const currentProfile =
                profile ||
                await loadProfile();

            const schoolId =
                Number(currentProfile?.school_id);

            if (!schoolId) {
                throw new Error(
                    "Your profile is not assigned to a valid school."
                );
            }

            const {
                data: ledgerData,
                error: ledgerError
            } = await supabase
                .schema("finance")
                .rpc("get_general_ledger", {
                    p_school_id: schoolId
                });

            if (ledgerError) {
                throw ledgerError;
            }

            const payload =
                ledgerData &&
                typeof ledgerData === "object"
                    ? ledgerData
                    : {};

            const safeAccounts =
                Array.isArray(payload.accounts)
                    ? payload.accounts
                    : [];

            const safeEntries =
                Array.isArray(payload.entries)
                    ? payload.entries.map(entry => ({
                        ...entry,
                        lines:
                            Array.isArray(entry.lines)
                                ? entry.lines
                                : []
                    }))
                    : [];

            const safeLines =
                safeEntries.flatMap(entry =>
                    entry.lines.map(line => ({
                        ...line,
                        journal_entry_id:
                            line.journal_entry_id ||
                            entry.id
                    }))
                );

            setAccounts(safeAccounts);
            setEntries(safeEntries);
            setLines(safeLines);

        } catch (err) {

            console.error(
                "General Ledger load error:",
                err
            );

            setAccounts([]);
            setEntries([]);
            setLines([]);

            setError(
                err?.message ||
                "Failed to load General Ledger."
            );

        } finally {

            setLoading(false);
            setRefreshing(false);
        }
    };


    // =====================================================
    // INITIAL LOAD
    // =====================================================

    useEffect(() => {

        loadData(true);

    }, []);


    // =====================================================
    // ACCOUNT MAP
    // =====================================================

    const accountMap = useMemo(() => {

        const map = {};


        accounts.forEach(account => {

            map[String(account.id)] =
                account;
        });


        return map;

    }, [accounts]);


    // =====================================================
    // LINES BY ENTRY
    // =====================================================

    const linesByEntry = useMemo(() => {

        const map = {};


        lines.forEach(line => {

            const key =
                String(
                    line.journal_entry_id
                );


            if (!map[key]) {
                map[key] = [];
            }


            map[key].push({
                ...line,
                account:
                    accountMap[
                        String(
                            line.account_id
                        )
                    ] || null
            });
        });


        return map;

    }, [
        lines,
        accountMap
    ]);


    // =====================================================
    // ENTRY TOTALS
    // =====================================================

    const entryData = useMemo(() => {

        return entries.map(entry => {

            const entryLines =
                linesByEntry[
                    String(entry.id)
                ] || [];


            const debit =
                entryLines.reduce(
                    (
                        total,
                        line
                    ) =>
                        total +
                        Number(
                            line.debit || 0
                        ),
                    0
                );


            const credit =
                entryLines.reduce(
                    (
                        total,
                        line
                    ) =>
                        total +
                        Number(
                            line.credit || 0
                        ),
                    0
                );


            return {
                ...entry,
                lines: entryLines,
                debit,
                credit,
                difference:
                    debit - credit
            };

        });

    }, [
        entries,
        linesByEntry
    ]);


    // =====================================================
    // FILTERED ENTRIES
    // =====================================================

    const filteredEntries = useMemo(() => {

        const text =
            search
                .trim()
                .toLowerCase();


        return entryData.filter(
            entry => {

                if (
                    statusFilter &&
                    String(
                        entry.status || ""
                    ).toLowerCase() !==
                    statusFilter.toLowerCase()
                ) {
                    return false;
                }


                if (
                    fromDate &&
                    entry.transaction_date <
                    fromDate
                ) {
                    return false;
                }


                if (
                    toDate &&
                    entry.transaction_date >
                    toDate
                ) {
                    return false;
                }


                if (
                    accountFilter
                ) {

                    const found =
                        entry.lines.some(
                            line =>
                                String(
                                    line.account_id
                                ) ===
                                String(
                                    accountFilter
                                )
                        );


                    if (!found) {
                        return false;
                    }
                }


                if (!text) {
                    return true;
                }


                return (

                    String(
                        entry.journal_number ||
                        ""
                    )
                        .toLowerCase()
                        .includes(text)

                    ||

                    String(
                        entry.reference_number ||
                        ""
                    )
                        .toLowerCase()
                        .includes(text)

                    ||

                    String(
                        entry.description ||
                        ""
                    )
                        .toLowerCase()
                        .includes(text)

                    ||

                    String(
                        entry.source_type ||
                        ""
                    )
                        .toLowerCase()
                        .includes(text)

                    ||

                    entry.lines.some(
                        line =>
                            String(
                                line.account?.account_code ||
                                ""
                            )
                                .toLowerCase()
                                .includes(text)

                            ||

                            String(
                                line.account?.account_name ||
                                ""
                            )
                                .toLowerCase()
                                .includes(text)

                            ||

                            String(
                                line.description ||
                                ""
                            )
                                .toLowerCase()
                                .includes(text)
                    )
                );
            }
        );

    }, [
        entryData,
        search,
        statusFilter,
        fromDate,
        toDate,
        accountFilter
    ]);


    // =====================================================
    // SUMMARY
    // =====================================================

    const summary = useMemo(() => {

        const debit =
            filteredEntries.reduce(
                (
                    total,
                    entry
                ) =>
                    total +
                    entry.debit,
                0
            );


        const credit =
            filteredEntries.reduce(
                (
                    total,
                    entry
                ) =>
                    total +
                    entry.credit,
                0
            );


        const posted =
            filteredEntries.filter(
                entry =>
                    String(
                        entry.status || ""
                    ).toLowerCase() ===
                    "posted"
            ).length;


        return {
            entries:
                filteredEntries.length,

            debit,

            credit,

            difference:
                debit - credit,

            posted
        };

    }, [
        filteredEntries
    ]);


    // =====================================================
    // RESET FILTERS
    // =====================================================

    const resetFilters = () => {

        setSearch("");

        setAccountFilter("");

        setStatusFilter("");

        setFromDate("");

        setToDate("");
    };


    // =====================================================
    // TOGGLE ENTRY
    // =====================================================

    const toggleEntry = (
        entryId
    ) => {

        setExpandedEntry(
            current =>
                current === entryId
                    ? null
                    : entryId
        );
    };


    // =====================================================
    // STATUS STYLE
    // =====================================================

    const statusClass = (
        status
    ) => {

        const value =
            String(
                status || ""
            ).toLowerCase();


        if (value === "posted") {

            return "bg-emerald-100 text-emerald-700";
        }


        if (value === "approved") {

            return "bg-blue-100 text-blue-700";
        }


        if (value === "void") {

            return "bg-red-100 text-red-700";
        }


        return "bg-amber-100 text-amber-700";
    };


    // =====================================================
    // LOADING
    // =====================================================

    if (loading) {

        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">

                <div className="bg-white border border-slate-200 rounded-2xl px-6 py-5 shadow-sm flex items-center gap-3">

                    <FaSpinner className="animate-spin text-blue-600" />

                    <span className="text-sm font-medium text-slate-600">
                        Loading General Ledger...
                    </span>

                </div>

            </div>
        );
    }


    // =====================================================
    // MAIN
    // =====================================================

    return (

        <div className="min-h-screen bg-slate-50 p-4 md:p-6">

            <div className="max-w-7xl mx-auto">


                {/* =================================================
                    HEADER
                ================================================= */}

                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 mb-6">

                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

                        <div className="flex items-start gap-4">

                            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">

                                <FaBook size={20} />

                            </div>


                            <div>

                                <h1 className="text-2xl font-bold text-slate-800">
                                    General Ledger
                                </h1>

                                <p className="text-sm text-slate-500 mt-1">
                                    View journal entries and their accounting lines.
                                </p>

                            </div>

                        </div>


                        <div className="flex flex-wrap gap-2">

                            <button
                                type="button"
                                onClick={() =>
                                    navigate(
                                        "/finance/dashboard"
                                    )
                                }
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50"
                            >
                                <FaArrowLeft />

                                Back
                            </button>


                            <button
                                type="button"
                                onClick={() =>
                                    loadData(false)
                                }
                                disabled={refreshing}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
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

                </div>


                {/* =================================================
                    ERROR
                ================================================= */}

                {error && (

                    <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">

                        <FaExclamationTriangle className="text-red-600 mt-1" />

                        <div>

                            <p className="font-semibold text-red-800">
                                General Ledger could not be loaded
                            </p>

                            <p className="text-sm text-red-700 mt-1 break-words">
                                {error}
                            </p>

                        </div>

                    </div>

                )}


                {/* =================================================
                    SUMMARY
                ================================================= */}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

                    <div className="bg-white border border-slate-200 rounded-2xl p-5">

                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Journal Entries
                        </p>

                        <p className="text-2xl font-bold text-slate-800 mt-2">
                            {summary.entries}
                        </p>

                    </div>


                    <div className="bg-white border border-slate-200 rounded-2xl p-5">

                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Total Debit
                        </p>

                        <p className="text-2xl font-bold text-blue-700 mt-2">
                            TZS {money(summary.debit)}
                        </p>

                    </div>


                    <div className="bg-white border border-slate-200 rounded-2xl p-5">

                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Total Credit
                        </p>

                        <p className="text-2xl font-bold text-indigo-700 mt-2">
                            TZS {money(summary.credit)}
                        </p>

                    </div>


                    <div className="bg-white border border-slate-200 rounded-2xl p-5">

                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Difference
                        </p>

                        <p
                            className={`text-2xl font-bold mt-2 ${
                                Math.abs(
                                    summary.difference
                                ) < 0.01
                                    ? "text-emerald-600"
                                    : "text-red-600"
                            }`}
                        >
                            TZS {money(
                                summary.difference
                            )}
                        </p>

                    </div>

                </div>


                {/* =================================================
                    FILTERS
                ================================================= */}

                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 mb-6">

                    <div className="flex items-center gap-2 mb-4">

                        <FaFilter className="text-blue-600" />

                        <h2 className="font-bold text-slate-800">
                            Filters
                        </h2>

                    </div>


                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">

                        <div className="lg:col-span-2">

                            <label className="block text-xs font-semibold text-slate-600 mb-2">
                                Search
                            </label>

                            <div className="relative">

                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

                                <input
                                    type="text"
                                    value={search}
                                    onChange={e =>
                                        setSearch(
                                            e.target.value
                                        )
                                    }
                                    placeholder="Journal number, description, account..."
                                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />

                            </div>

                        </div>


                        <div>

                            <label className="block text-xs font-semibold text-slate-600 mb-2">
                                Account
                            </label>

                            <select
                                value={accountFilter}
                                onChange={e =>
                                    setAccountFilter(
                                        e.target.value
                                    )
                                }
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >

                                <option value="">
                                    All Accounts
                                </option>

                                {accounts.map(
                                    account => (

                                        <option
                                            key={
                                                account.id
                                            }
                                            value={
                                                account.id
                                            }
                                        >
                                            {account.account_code} - {account.account_name}
                                        </option>

                                    )
                                )}

                            </select>

                        </div>


                        <div>

                            <label className="block text-xs font-semibold text-slate-600 mb-2">
                                Status
                            </label>

                            <select
                                value={statusFilter}
                                onChange={e =>
                                    setStatusFilter(
                                        e.target.value
                                    )
                                }
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >

                                <option value="">
                                    All Statuses
                                </option>

                                <option value="draft">
                                    Draft
                                </option>

                                <option value="approved">
                                    Approved
                                </option>

                                <option value="posted">
                                    Posted
                                </option>

                                <option value="void">
                                    Void
                                </option>

                            </select>

                        </div>


                        <div>

                            <label className="block text-xs font-semibold text-slate-600 mb-2">
                                From
                            </label>

                            <input
                                type="date"
                                value={fromDate}
                                onChange={e =>
                                    setFromDate(
                                        e.target.value
                                    )
                                }
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />

                        </div>


                        <div>

                            <label className="block text-xs font-semibold text-slate-600 mb-2">
                                To
                            </label>

                            <input
                                type="date"
                                value={toDate}
                                onChange={e =>
                                    setToDate(
                                        e.target.value
                                    )
                                }
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />

                        </div>

                    </div>


                    <div className="mt-4">

                        <button
                            type="button"
                            onClick={
                                resetFilters
                            }
                            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"
                        >
                            Clear Filters
                        </button>

                    </div>

                </div>


                {/* =================================================
                    LEDGER
                ================================================= */}

                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

                    <div className="px-5 py-4 border-b border-slate-200">

                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">

                            <div>

                                <h2 className="font-bold text-slate-800">
                                    Journal Ledger
                                </h2>

                                <p className="text-xs text-slate-500 mt-1">
                                    {filteredEntries.length} journal entries displayed
                                </p>

                            </div>


                            <div className="text-xs font-semibold text-slate-500">

                                Posted:{" "}

                                <span className="text-emerald-600">
                                    {summary.posted}
                                </span>

                            </div>

                        </div>

                    </div>


                    {filteredEntries.length === 0 ? (

                        <div className="p-10 text-center">

                            <FaBook className="mx-auto text-3xl text-slate-300" />

                            <p className="font-semibold text-slate-600 mt-3">
                                No journal entries found
                            </p>

                            <p className="text-sm text-slate-400 mt-1">
                                Try changing the filters or record a finance transaction first.
                            </p>

                        </div>

                    ) : (

                        <div className="divide-y divide-slate-200">

                            {filteredEntries.map(
                                entry => {

                                    const open =
                                        expandedEntry ===
                                        entry.id;


                                    return (

                                        <div
                                            key={
                                                entry.id
                                            }
                                        >

                                            {/* ENTRY HEADER */}

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    toggleEntry(
                                                        entry.id
                                                    )
                                                }
                                                className="w-full text-left px-5 py-4 hover:bg-slate-50 transition"
                                            >

                                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">

                                                    <div className="lg:col-span-1">

                                                        {open ? (
                                                            <FaChevronDown className="text-blue-600" />
                                                        ) : (
                                                            <FaChevronRight className="text-slate-400" />
                                                        )}

                                                    </div>


                                                    <div className="lg:col-span-2">

                                                        <p className="text-xs text-slate-400">
                                                            Journal
                                                        </p>

                                                        <p className="font-bold text-slate-800">
                                                            #{entry.journal_number}
                                                        </p>

                                                    </div>


                                                    <div className="lg:col-span-2">

                                                        <p className="text-xs text-slate-400">
                                                            Date
                                                        </p>

                                                        <p className="text-sm font-semibold text-slate-700">
                                                            {dateOnly(
                                                                entry.transaction_date
                                                            )}
                                                        </p>

                                                    </div>


                                                    <div className="lg:col-span-3">

                                                        <p className="text-xs text-slate-400">
                                                            Description
                                                        </p>

                                                        <p className="text-sm font-semibold text-slate-700 truncate">
                                                            {entry.description ||
                                                                "-"}
                                                        </p>

                                                        {entry.reference_number && (

                                                            <p className="text-xs text-slate-400 mt-1">
                                                                Ref:{" "}
                                                                {entry.reference_number}
                                                            </p>

                                                        )}

                                                    </div>


                                                    <div className="lg:col-span-1">

                                                        <span
                                                            className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${statusClass(
                                                                entry.status
                                                            )}`}
                                                        >
                                                            {entry.status ||
                                                                "Draft"}
                                                        </span>

                                                    </div>


                                                    <div className="lg:col-span-3 lg:text-right">

                                                        <p className="text-xs text-slate-400">
                                                            Debit / Credit
                                                        </p>

                                                        <p className="text-sm font-bold text-slate-800">
                                                            TZS{" "}
                                                            {money(
                                                                entry.debit
                                                            )}
                                                            {" / "}
                                                            TZS{" "}
                                                            {money(
                                                                entry.credit
                                                            )}
                                                        </p>

                                                    </div>

                                                </div>

                                            </button>


                                            {/* JOURNAL LINES */}

                                            {open && (

                                                <div className="bg-slate-50 border-t border-slate-200 px-5 py-5">

                                                    {entry.lines.length ===
                                                    0 ? (

                                                        <div className="text-sm text-slate-500">
                                                            No journal lines found for this entry.
                                                        </div>

                                                    ) : (

                                                        <div className="overflow-x-auto">

                                                            <table className="w-full text-sm">

                                                                <thead>

                                                                    <tr className="border-b border-slate-200">

                                                                        <th className="text-left py-3 px-3 text-xs font-bold text-slate-500">
                                                                            #
                                                                        </th>

                                                                        <th className="text-left py-3 px-3 text-xs font-bold text-slate-500">
                                                                            Account
                                                                        </th>

                                                                        <th className="text-left py-3 px-3 text-xs font-bold text-slate-500">
                                                                            Description
                                                                        </th>

                                                                        <th className="text-right py-3 px-3 text-xs font-bold text-slate-500">
                                                                            Debit
                                                                        </th>

                                                                        <th className="text-right py-3 px-3 text-xs font-bold text-slate-500">
                                                                            Credit
                                                                        </th>

                                                                    </tr>

                                                                </thead>


                                                                <tbody>

                                                                    {entry.lines.map(
                                                                        (
                                                                            line,
                                                                            index
                                                                        ) => (

                                                                            <tr
                                                                                key={
                                                                                    line.id
                                                                                }
                                                                                className="border-b border-slate-100 last:border-0"
                                                                            >

                                                                                <td className="py-3 px-3 text-slate-500">
                                                                                    {line.line_number ||
                                                                                        index +
                                                                                        1}
                                                                                </td>


                                                                                <td className="py-3 px-3">

                                                                                    <div className="font-semibold text-slate-800">

                                                                                        {line.account?.account_code ||
                                                                                            "—"}

                                                                                    </div>

                                                                                    <div className="text-xs text-slate-500">

                                                                                        {line.account?.account_name ||
                                                                                            "Account not found"}

                                                                                    </div>

                                                                                </td>


                                                                                <td className="py-3 px-3 text-slate-600">

                                                                                    {line.description ||
                                                                                        entry.description ||
                                                                                        "-"}

                                                                                </td>


                                                                                <td className="py-3 px-3 text-right font-semibold text-slate-700">

                                                                                    {Number(
                                                                                        line.debit ||
                                                                                        0
                                                                                    ) >
                                                                                    0
                                                                                        ? money(
                                                                                              line.debit
                                                                                          )
                                                                                        : "-"}

                                                                                </td>


                                                                                <td className="py-3 px-3 text-right font-semibold text-slate-700">

                                                                                    {Number(
                                                                                        line.credit ||
                                                                                        0
                                                                                    ) >
                                                                                    0
                                                                                        ? money(
                                                                                              line.credit
                                                                                          )
                                                                                        : "-"}

                                                                                </td>

                                                                            </tr>

                                                                        )
                                                                    )}

                                                                </tbody>


                                                                <tfoot>

                                                                    <tr className="border-t-2 border-slate-300">

                                                                        <td
                                                                            colSpan="3"
                                                                            className="py-3 px-3 text-right font-bold text-slate-700"
                                                                        >
                                                                            Total
                                                                        </td>

                                                                        <td className="py-3 px-3 text-right font-bold text-blue-700">
                                                                            {money(
                                                                                entry.debit
                                                                            )}
                                                                        </td>

                                                                        <td className="py-3 px-3 text-right font-bold text-indigo-700">
                                                                            {money(
                                                                                entry.credit
                                                                            )}
                                                                        </td>

                                                                    </tr>

                                                                </tfoot>

                                                            </table>

                                                        </div>

                                                    )}


                                                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">

                                                        <div className="text-xs text-slate-500">

                                                            Source:{" "}

                                                            <span className="font-semibold text-slate-700">
                                                                {entry.source_type ||
                                                                    "Manual"}
                                                            </span>

                                                        </div>


                                                        <div
                                                            className={`text-sm font-bold ${
                                                                Math.abs(
                                                                    entry.difference
                                                                ) <
                                                                0.01
                                                                    ? "text-emerald-600"
                                                                    : "text-red-600"
                                                            }`}
                                                        >

                                                            Balance Difference:{" "}

                                                            TZS{" "}

                                                            {money(
                                                                entry.difference
                                                            )}

                                                        </div>

                                                    </div>

                                                </div>

                                            )}

                                        </div>

                                    );
                                }
                            )}

                        </div>

                    )}

                </div>

            </div>

        </div>
    );
}


export default GeneralLedger;