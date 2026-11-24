import React, { useCallback, useEffect, useState } from "react";
import { FaArrowLeft, FaChartPie, FaMoneyBillWave, FaReceipt, FaWallet, FaRedo, FaCalendarAlt } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useRole } from "../../context/RoleContext";
import api from "../../services/api";

const localDate = (date = new Date()) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Dar_es_Salaam",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
};
const money = value => new Intl.NumberFormat("en-TZ", { style: "currency", currency: "TZS", maximumFractionDigits: 2 }).format(Number(value || 0));

function SourceTable({ title, rows, emptyText, tone }) {
    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={`border-b border-slate-100 px-5 py-4 ${tone}`}>
                <h2 className="font-bold text-slate-900">{title}</h2>
                <p className="mt-1 text-xs text-slate-500">Amounts from posted accounting entries</p>
            </div>
            {rows.length === 0 ? <p className="px-5 py-8 text-sm text-slate-500">{emptyText}</p> : (
                <div className="divide-y divide-slate-100">
                    {rows.map(row => (
                        <div key={row.source} className="px-5 py-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="font-semibold text-slate-800">{row.source}</p>
                                    <p className="mt-1 text-xs text-slate-500">{row.transactionCount} journal transaction(s)</p>
                                </div>
                                <p className="text-base font-bold tabular-nums text-slate-900">{money(row.amount)}</p>
                            </div>
                            {row.accounts?.length > 0 && <div className="mt-3 space-y-1 border-l-2 border-slate-100 pl-3">
                                {row.accounts.map(item => <div key={item.account} className="flex justify-between gap-3 text-xs text-slate-500"><span>{item.account}</span><span className="tabular-nums">{money(item.amount)}</span></div>)}
                            </div>}
                        </div>
                    ))}
                </div>
            )}
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3">
                <span className="text-sm font-semibold text-slate-600">{title} total</span>
                <span className="font-bold tabular-nums text-slate-900">{money(rows.reduce((sum, row) => sum + Number(row.amount || 0), 0))}</span>
            </div>
        </section>
    );
}

export default function IncomeExpensesSummary() {
    const navigate = useNavigate();
    const { selectedSchoolId, isSuperAdmin } = useRole();
    const today = localDate(new Date());
    const [from, setFrom] = useState(`${today.slice(0, 4)}-01-01`);
    const [to, setTo] = useState(today);
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");

    const loadReport = useCallback(async (refresh = false) => {
        try {
            if (refresh) setRefreshing(true); else setLoading(true);
            setError("");
            const params = { from, to };
            // Use the school linked to the active profile role for every school-scoped request.
            // Auth user metadata does not consistently expose school_id across all roles.
            if (!selectedSchoolId) {
                throw new Error("No school is linked to the active role. Please select a school role and try again.");
            }
            params.school_id = selectedSchoolId;
            const response = await api.get("/finance/reports/income-expenses-summary", { params });
            setReport(response.data?.data || null);
        } catch (err) {
            setReport(null);
            setError(err.response?.data?.message || err.message || "Unable to load income and expenses summary.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [from, to, isSuperAdmin, selectedSchoolId]);

    useEffect(() => { loadReport(); }, [loadReport]);

    return (
        <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <button type="button" onClick={() => navigate("/finance/dashboard")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><FaArrowLeft /> Finance Dashboard</button>
                <button type="button" onClick={() => loadReport(true)} disabled={loading || refreshing} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"><FaRedo className={refreshing ? "animate-spin" : ""} /> Refresh</button>
            </div>
            <header className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 px-6 py-7 text-white shadow-lg sm:px-8">
                <div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-2xl"><FaChartPie /></span><div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-200">Finance Reports</p><h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">Income and Expenses Summary</h1></div></div>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Track the actual income sources and expense categories recorded in the school's accounting ledger.</p>
            </header>
            <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <label className="grid gap-1 text-xs font-semibold text-slate-600">From date<input type="date" value={from} max={to} onChange={event => setFrom(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800" /></label>
                <label className="grid gap-1 text-xs font-semibold text-slate-600">To date<input type="date" value={to} min={from} max={today} onChange={event => setTo(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800" /></label>
                <button type="button" onClick={() => loadReport()} disabled={loading || refreshing} className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"><FaCalendarAlt className="mr-2 inline" /> Apply period</button>
            </section>
            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Loading actual accounting data...</div> : report && <>
                <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-emerald-800">Total Income</p><FaMoneyBillWave className="text-emerald-700" /></div><p className="mt-3 text-2xl font-extrabold tabular-nums text-emerald-950">{money(report.totalIncome)}</p></div>
                    <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-orange-800">Total Expenses</p><FaReceipt className="text-orange-700" /></div><p className="mt-3 text-2xl font-extrabold tabular-nums text-orange-950">{money(report.totalExpenses)}</p></div>
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-blue-800">Net Result</p><FaWallet className="text-blue-700" /></div><p className="mt-3 text-2xl font-extrabold tabular-nums text-blue-950">{money(report.netResult)}</p></div>
                </section>
                <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                    <SourceTable title="Income by Source" rows={report.incomeSources || []} emptyText="No posted income transactions were found for this period." tone="bg-emerald-50/70" />
                    <SourceTable title="Expenses by Category" rows={report.expenseSources || []} emptyText="No posted expense transactions were found for this period." tone="bg-orange-50/70" />
                </section>
                <p className="text-xs leading-5 text-slate-500">Based on posted, non-reversed General Ledger entries for the selected school and period. Receipts and expense records are used to classify transactions, not added again. Transaction entries counted: {report.transactionCount || 0}.</p>
            </>}
        </main>
    );
}
