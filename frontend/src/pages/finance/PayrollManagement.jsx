import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FaCheckCircle, FaDownload, FaFileInvoiceDollar, FaPrint, FaSyncAlt, FaSave, FaArrowRight, FaUndo, FaWallet } from "react-icons/fa";
import { useSchool } from "../../context/SchoolContext";
import { useRole } from "../../context/RoleContext";
import api from "../../services/api";

const currentMonth = () => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Dar_es_Salaam", year: "numeric", month: "2-digit",
    }).format(new Date());
    return parts.slice(0, 7);
};
const money = (value) => new Intl.NumberFormat("en-TZ", {
    style: "currency", currency: "TZS", maximumFractionDigits: 2,
}).format(Number(value || 0));
const fullName = (person = {}) =>
    [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(" ") || "Employee";
const deductionLines = (components = []) => (Array.isArray(components) ? components : [])
    .filter((line) => line?.type === "deduction" && String(line.name || "").trim() && Number(line.amount) > 0);
const deductionTotal = (components = []) => deductionLines(components)
    .reduce((sum, line) => sum + Number(line.amount || 0), 0);
const statusLabel = (status) => ({
    draft: "Draft", submitted_for_review: "Awaiting HR review", returned: "Returned to Accountant",
    approved: "HR approved", posted: "Posted to Finance", partially_paid: "Partially paid",
    paid: "Fully paid", cancelled: "Cancelled",
}[status] || status || "Unknown");

function OfficialSeal({ seal }) {
    if (!seal?.show_official_seal) return null;
    return (
        <div className="flex justify-end py-4">
            <div className="relative flex h-32 w-32 -rotate-6 flex-col items-center justify-center rounded-full border-4 border-double border-blue-900 px-3 text-center text-blue-900 opacity-80">
                <div className="absolute inset-1 rounded-full border border-blue-900" />
                <span className="relative text-[8px] font-black uppercase leading-tight">{seal.school_name}</span>
                {seal.registration_number && <span className="relative mt-1 text-[7px]">{seal.registration_number}</span>}
                <span className="relative my-1 border-y border-blue-900 px-1 py-0.5 text-[10px] font-black tracking-widest">OFFICIAL SEAL</span>
                <span className="relative text-[9px] font-black tracking-wider">HEADMASTER</span>
                {seal.headmaster_name && <span className="relative mt-0.5 max-w-full text-[7px] font-bold leading-tight">{seal.headmaster_name}</span>}
            </div>
        </div>
    );
}

function PayrollManagement() {
    const { schoolId, school } = useSchool();
    const { selectedRoleName, isSuperAdmin } = useRole();
    const [workspace, setWorkspace] = useState({ employees: [], payrolls: [], accounts: [], cashAccounts: [], settings: null });
    const [selectedPayroll, setSelectedPayroll] = useState(null);
    const [payrollMonth, setPayrollMonth] = useState(currentMonth());
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
    const [employeeValues, setEmployeeValues] = useState({});
    const [itemDeductionForms, setItemDeductionForms] = useState({});
    const [settingsForm, setSettingsForm] = useState({
        salary_expense_account_id: "", salary_payable_account_id: "", deductions_payable_account_id: "",
    });
    const [paymentForms, setPaymentForms] = useState({});
    const [reviewNote, setReviewNote] = useState("");
    const [returnNote, setReturnNote] = useState("");
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [printItemId, setPrintItemId] = useState(null);

    const requestConfig = useMemo(() => ({
        params: { school_id: schoolId, payroll_month: payrollMonth },
    }), [schoolId, payrollMonth]);
    const canPrepare = isSuperAdmin || selectedRoleName === "Accountant";
    const canReview = isSuperAdmin || selectedRoleName === "HR Manager";
    const canPay = canPrepare;

    const loadWorkspace = useCallback(async () => {
        if (!schoolId) { setLoading(false); setError("School context is not available."); return; }
        setLoading(true); setError("");
        try {
            const { data } = await api.get("/payroll", requestConfig);
            const next = data.data;
            setWorkspace(next);
            setSettingsForm({
                salary_expense_account_id: next.settings?.salary_expense_account_id || "",
                salary_payable_account_id: next.settings?.salary_payable_account_id || "",
                deductions_payable_account_id: next.settings?.deductions_payable_account_id || "",
            });
            setEmployeeValues(Object.fromEntries((next.employees || []).map((person) => [person.id, {
                basic_salary: Number(person.basic_salary || 0), allowances: 0, deductions: 0,
                deductionLines: [],
            }])));
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Unable to load payroll.");
        } finally { setLoading(false); }
    }, [schoolId, requestConfig]);

    useEffect(() => { loadWorkspace(); }, [loadWorkspace]);

    const loadPayroll = async (payrollId) => {
        if (!payrollId) { setSelectedPayroll(null); return; }
        setBusy(true); setError(""); setNotice("");
        try {
            const { data } = await api.get(`/payroll/${payrollId}`, requestConfig);
            setSelectedPayroll(data.data);
            setItemDeductionForms(Object.fromEntries((data.data.payroll_items || []).map((item) => [
                item.id, deductionLines(item.components_snapshot || []).length
                    ? deductionLines(item.components_snapshot || []).map((line) => ({ name: line.name, amount: String(line.amount) }))
                    : (Number(item.deductions || 0) > 0 ? [{ name: "Other deductions (legacy)", amount: String(item.deductions) }] : [])
            ])));
            setReviewNote(data.data.review_notes || "");
            setPaymentForms(Object.fromEntries((data.data.payroll_items || []).map((item) => [item.id, {
                cash_account_id: workspace.cashAccounts?.[0]?.id || "",
                payment_date: new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Dar_es_Salaam" }),
                payment_method: "Bank transfer", reference: "",
            }])));
        } catch (err) { setError(err.response?.data?.message || err.message || "Unable to load payroll details."); }
        finally { setBusy(false); }
    };

    const refresh = async () => { await loadWorkspace(); if (selectedPayroll?.id) await loadPayroll(selectedPayroll.id); };

    const selectedEmployees = useMemo(
        () => (workspace.employees || []).filter((person) => selectedEmployeeIds.includes(person.id)),
        [workspace.employees, selectedEmployeeIds]
    );

    const selectedTotal = useMemo(() => selectedEmployees.reduce((sum, person) => {
        const values = employeeValues[person.id] || {};
        const deductions = (values.deductionLines || []).reduce((total, line) => total + Number(line.amount || 0), 0);
        return sum + Number(values.basic_salary || 0) + Number(values.allowances || 0) - (deductions || Number(values.deductions || 0));
    }, 0), [selectedEmployees, employeeValues]);

    const createDraft = async (event) => {
        event.preventDefault();
        if (!selectedEmployees.length) { setError("Select at least one employee."); return; }
        setBusy(true); setError(""); setNotice("");
        try {
            const items = selectedEmployees.map((person) => ({
                employee_id: person.id,
                ...employeeValues[person.id],
                components: (employeeValues[person.id]?.deductionLines || [])
                    .filter((line) => String(line.name || "").trim() && Number(line.amount) > 0)
                    .map((line) => ({ type: "deduction", name: String(line.name).trim(), amount: Number(line.amount) })),
                deductions: (employeeValues[person.id]?.deductionLines || []).reduce((sum, line) => sum + Number(line.amount || 0), 0) || Number(employeeValues[person.id]?.deductions || 0),
            }));
            const { data } = await api.post("/payroll", { school_id: schoolId, payroll_month: payrollMonth, items }, requestConfig);
            setNotice(data.message);
            await loadWorkspace();
            await loadPayroll(data.data.id);
        } catch (err) { setError(err.response?.data?.message || err.message || "Unable to create payroll."); }
        finally { setBusy(false); }
    };

    const runAction = async (action, successMessage) => {
        if (!selectedPayroll?.id) return;
        setBusy(true); setError(""); setNotice("");
        try {
            const { data } = await action();
            setNotice(data.message || successMessage);
            await loadWorkspace();
            await loadPayroll(selectedPayroll.id);
        } catch (err) { setError(err.response?.data?.message || err.message || "Payroll action failed."); }
        finally { setBusy(false); }
    };

    const saveItem = async (item) => {
        const form = document.getElementById(`payroll-item-${item.id}`);
        const lines = itemDeductionForms[item.id] || [];
        const components = lines.filter((line) => String(line.name || "").trim() && Number(line.amount) > 0)
            .map((line) => ({ type: "deduction", name: String(line.name).trim(), amount: Number(line.amount) }));
        const values = {
            basic_salary: Number(form.elements.basic_salary.value),
            allowances: Number(form.elements.allowances.value),
            deductions: components.reduce((sum, line) => sum + Number(line.amount || 0), 0),
            components,
        };
        await runAction(
            () => api.patch(`/payroll/${selectedPayroll.id}/items/${item.id}`, values, requestConfig),
            "Payroll employee details saved."
        );
    };

    const payItem = async (item) => {
        const values = paymentForms[item.id] || {};
        await runAction(
            () => api.post(`/payroll/${selectedPayroll.id}/items/${item.id}/pay`, values, requestConfig),
            "Payment recorded."
        );
    };

    const saveSettings = async (event) => {
        event.preventDefault(); setBusy(true); setError(""); setNotice("");
        try {
            const { data } = await api.put("/payroll/settings", { school_id: schoolId, ...settingsForm }, requestConfig);
            setNotice(data.message); await loadWorkspace();
        } catch (err) { setError(err.response?.data?.message || err.message || "Unable to save payroll accounts."); }
        finally { setBusy(false); }
    };

    useEffect(() => {
        if (!printItemId) return undefined;
        const afterPrint = () => setPrintItemId(null);
        window.addEventListener("afterprint", afterPrint);
        window.print();
        return () => window.removeEventListener("afterprint", afterPrint);
    }, [printItemId]);

    const snapshot = selectedPayroll?.payroll_snapshot;
    const snapshotItems = snapshot?.items || [];
    const printableItems = printItemId
        ? snapshotItems.filter((item) => String(item.payroll_item_id) === String(printItemId))
        : snapshotItems;
    const printIsPayslip = Boolean(printItemId);

    if (loading) return <div className="rounded-2xl border bg-white p-8 text-slate-600">Loading payroll workspace...</div>;

    return (
        <div className="space-y-6">
            <style>{`
                @media print {
                    body * { visibility: hidden !important; }
                    #payroll-print-area, #payroll-print-area * { visibility: visible !important; }
                    #payroll-print-area { position: absolute; inset: 0; width: 100%; padding: 12mm; background: white; }
                    .no-print { display: none !important; }
                    .payroll-print-page { break-after: page; page-break-after: always; }
                    .payroll-print-page:last-child { break-after: auto; page-break-after: auto; }
                }
            `}</style>

            <div className="no-print rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-800 p-6 text-white shadow-lg">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-blue-200">AfriCore • Human Resources & Finance</p>
                        <h1 className="mt-2 text-3xl font-extrabold">Payroll Management</h1>
                        <p className="mt-2 text-sm text-blue-100">{school?.school_name || "Current School"} • Accountant preparation and HR approval</p>
                    </div>
                    <button type="button" onClick={refresh} disabled={busy} className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-blue-950"><FaSyncAlt className="mr-2 inline" />Refresh</button>
                </div>
            </div>

            {error && <div role="alert" className="no-print rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
            {notice && <div role="status" className="no-print rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}

            {canPrepare && (
                <section className="no-print rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-bold text-slate-900">Payroll Account Mapping</h2>
                    <p className="mt-1 text-sm text-slate-500">Chagua akaunti za shule zilizopo kwenye Chart of Accounts. Hakuna akaunti mpya inayotengenezwa moja kwa moja.</p>
                    <form onSubmit={saveSettings} className="mt-4 grid gap-3 md:grid-cols-3">
                        {[
                            ["salary_expense_account_id", "Salary expense account", "expense"],
                            ["salary_payable_account_id", "Net salary payable", "liability"],
                            ["deductions_payable_account_id", "Deductions payable (if deductions apply)", "liability"],
                        ].map(([key, label, type]) => (
                            <label key={key} className="text-sm font-semibold text-slate-700">{label}
                                <select value={settingsForm[key]} onChange={(event) => setSettingsForm((old) => ({ ...old, [key]: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                                    <option value="">Select account</option>
                                    {workspace.accounts.filter((account) => account.account_type === type).map((account) => <option key={account.id} value={account.id}>{account.account_code} — {account.account_name}</option>)}
                                </select>
                            </label>
                        ))}
                        <div className="md:col-span-3"><button disabled={busy} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white"><FaSave className="mr-2 inline" />Save account mapping</button></div>
                    </form>
                </section>
            )}

            {canPrepare && (
                <section className="no-print rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div><h2 className="text-lg font-bold text-slate-900">Prepare New Monthly Payroll</h2><p className="text-sm text-slate-500">Choose employees and verify each salary before creating a draft.</p></div>
                        <label className="text-sm font-semibold text-slate-700">Payroll month
                            <input type="month" value={payrollMonth} onChange={(event) => setPayrollMonth(event.target.value)} className="ml-2 rounded-lg border border-slate-300 px-3 py-2" />
                        </label>
                    </div>
                    {workspace.employees.length === 0 ? <p className="mt-4 text-sm text-slate-500">No active employee records were found.</p> : (
                        <form onSubmit={createDraft} className="mt-4 space-y-4">
                            <div className="flex flex-wrap items-center gap-3 text-sm">
                                <button type="button" onClick={() => setSelectedEmployeeIds(workspace.employees.map((person) => person.id))} className="font-semibold text-blue-700">Select all active</button>
                                <button type="button" onClick={() => setSelectedEmployeeIds([])} className="font-semibold text-slate-500">Clear selection</button>
                                <span className="text-slate-500">{selectedEmployeeIds.length} selected</span>
                            </div>
                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-3">Select</th><th className="px-3 py-3">Employee</th><th className="px-3 py-3">Basic salary</th><th className="px-3 py-3">Allowances</th><th className="px-3 py-3">Deductions</th><th className="px-3 py-3">Net pay</th></tr></thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {workspace.employees.map((person) => {
                                            const values = employeeValues[person.id] || { basic_salary: 0, allowances: 0, deductions: 0 };
                                            const lineTotal = (values.deductionLines || []).reduce((total, line) => total + Number(line.amount || 0), 0);
                                            const deductionAmount = lineTotal || Number(values.deductions || 0);
                                            const net = Number(values.basic_salary || 0) + Number(values.allowances || 0) - deductionAmount;
                                            return <tr key={person.id}>
                                                <td className="px-3 py-3"><input type="checkbox" checked={selectedEmployeeIds.includes(person.id)} onChange={(event) => setSelectedEmployeeIds((old) => event.target.checked ? [...old, person.id] : old.filter((id) => id !== person.id))} /></td>
                                                <td className="px-3 py-3"><p className="font-semibold text-slate-900">{fullName(person)}</p><p className="text-xs text-slate-500">{person.employee_number || "No employee number"} • {person.position || person.department || "Staff"}</p><p className="text-[10px] text-slate-400">{person.salary_source === "active_contract" ? "Salary from active contract" : "Salary from employee record"}</p></td>
                                                {["basic_salary", "allowances"].map((key) => <td key={key} className="px-3 py-3"><input type="number" min="0" step="0.01" value={values[key]} onChange={(event) => setEmployeeValues((old) => ({ ...old, [person.id]: { ...values, [key]: event.target.value } }))} className="w-32 rounded-lg border border-slate-300 px-2 py-1.5" /></td>)}
                                                <td className="px-3 py-3">
                                                    <p className="font-bold">{money(deductionAmount)}</p>
                                                    <div className="mt-2 min-w-52 space-y-1">
                                                        {(values.deductionLines || []).map((line, lineIndex) => <div key={lineIndex} className="flex gap-1">
                                                            <input aria-label="Deduction name" value={line.name} onChange={(event) => setEmployeeValues((old) => ({ ...old, [person.id]: { ...values, deductionLines: values.deductionLines.map((entry, index) => index === lineIndex ? { ...entry, name: event.target.value } : entry) } }))} placeholder="e.g. PAYE / NSSF" className="w-28 rounded border px-1 py-1 text-xs" />
                                                            <input aria-label="Deduction amount" type="number" min="0" step="0.01" value={line.amount} onChange={(event) => setEmployeeValues((old) => ({ ...old, [person.id]: { ...values, deductionLines: values.deductionLines.map((entry, index) => index === lineIndex ? { ...entry, amount: event.target.value } : entry) } }))} placeholder="Amount" className="w-24 rounded border px-1 py-1 text-xs" />
                                                            <button type="button" onClick={() => setEmployeeValues((old) => ({ ...old, [person.id]: { ...values, deductionLines: values.deductionLines.filter((_, index) => index !== lineIndex) } }))} className="text-rose-600" aria-label="Remove deduction">×</button>
                                                        </div>)}
                                                        <button type="button" onClick={() => setEmployeeValues((old) => ({ ...old, [person.id]: { ...values, deductionLines: [...(values.deductionLines || []), { name: "", amount: "" }] } }))} className="text-xs font-semibold text-blue-700">+ Add deduction</button>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 font-bold text-slate-900">{money(net)}</td>
                                            </tr>;
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">Estimated selected net payroll: <strong>{money(selectedTotal)}</strong></p><button disabled={busy || selectedEmployees.length === 0} className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"><FaFileInvoiceDollar className="mr-2 inline" />Create payroll draft</button></div>
                        </form>
                    )}
                </section>
            )}

            <section className="no-print grid gap-5 lg:grid-cols-[320px_1fr]">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h2 className="mb-3 font-bold text-slate-900">Payroll History</h2>
                    <div className="space-y-2">
                        {workspace.payrolls.map((payroll) => (
                            <button key={payroll.id} type="button" onClick={() => loadPayroll(payroll.id)} className={`w-full rounded-xl border p-3 text-left ${selectedPayroll?.id === payroll.id ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}>
                                <div className="flex items-center justify-between gap-2"><strong className="text-sm text-slate-900">{payroll.payroll_number}</strong><span className="text-[10px] text-slate-500">{payroll.payroll_month?.slice(0, 7)}</span></div>
                                <p className="mt-1 text-xs text-slate-500">{statusLabel(payroll.status)}</p>
                                <p className="mt-1 text-sm font-bold text-slate-800">{money(payroll.total_net_salary)}</p>
                            </button>
                        ))}
                        {workspace.payrolls.length === 0 && <p className="text-sm text-slate-500">No payrolls have been created yet.</p>}
                    </div>
                </div>

                <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    {!selectedPayroll ? <div className="py-10 text-center text-sm text-slate-500">Select a payroll record to review, post, pay or print.</div> : (
                        <div className="space-y-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Payroll record</p><h2 className="mt-1 text-xl font-extrabold text-slate-900">{selectedPayroll.payroll_number}</h2><p className="mt-1 text-sm text-slate-500">{selectedPayroll.payroll_month} • {statusLabel(selectedPayroll.status)}</p></div>
                                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">{selectedPayroll.payroll_items?.length || 0} employees</span>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                {[["Basic salary", selectedPayroll.total_basic_salary], ["Allowances", selectedPayroll.total_allowances], ["Deductions", selectedPayroll.total_deductions], ["Net payroll", selectedPayroll.total_net_salary]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-900">{money(value)}</p></div>)}
                            </div>

                            {canPrepare && ["draft", "returned"].includes(selectedPayroll.status) && <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => runAction(() => api.post(`/payroll/${selectedPayroll.id}/submit`, {}, requestConfig), "Submitted to HR.")} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white"><FaArrowRight className="mr-2 inline" />Send to HR</button></div>}

                            {canReview && selectedPayroll.status === "submitted_for_review" && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                                <h3 className="font-bold text-amber-950">HR Review Required</h3>
                                <textarea value={returnNote} onChange={(event) => setReturnNote(event.target.value)} rows="2" placeholder="Review note or reason for returning payroll..." className="mt-3 w-full rounded-lg border border-amber-200 bg-white p-3 text-sm" />
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <button disabled={busy} onClick={() => runAction(() => api.post(`/payroll/${selectedPayroll.id}/review`, { decision: "approve" }, requestConfig), "Payroll approved.")} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white"><FaCheckCircle className="mr-2 inline" />Approve & lock snapshot</button>
                                    <button disabled={busy || !returnNote.trim()} onClick={() => runAction(() => api.post(`/payroll/${selectedPayroll.id}/review`, { decision: "return", note: returnNote }, requestConfig), "Returned to Accountant.")} className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-bold text-white"><FaUndo className="mr-2 inline" />Return to Accountant</button>
                                </div>
                            </div>}

                            {canPrepare && selectedPayroll.status === "approved" && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                                <p className="text-sm font-semibold text-emerald-900">HR approval complete. The payroll snapshot is locked against later employee or salary changes.</p>
                                <button disabled={busy} onClick={() => runAction(() => api.post(`/payroll/${selectedPayroll.id}/post`, {}, requestConfig), "Payroll posted to Finance.")} className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Post payroll to Finance</button>
                            </div>}

                            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold text-slate-900">Employee Payroll Items</h3>{snapshot && <button type="button" onClick={() => { setPrintItemId(null); window.print(); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700"><FaPrint className="mr-2 inline" />Print full payroll / Save PDF</button>}</div>

                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-3">Employee</th><th className="px-3 py-3">Basic</th><th className="px-3 py-3">Allowances</th><th className="px-3 py-3">Deductions</th><th className="px-3 py-3">Net pay</th><th className="px-3 py-3">Payment</th><th className="px-3 py-3">Actions</th></tr></thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(selectedPayroll.payroll_items || []).map((item) => {
                                            const person = item.employee_snapshot || {};
                                            return <tr key={item.id}>
                                                <td className="px-3 py-3"><p className="font-semibold text-slate-900">{fullName(person)}</p><p className="text-xs text-slate-500">{person.employee_number || "—"}</p></td>
                                                <td className="px-3 py-3">{money(item.basic_salary)}</td><td className="px-3 py-3">{money(item.allowances)}</td><td className="px-3 py-3">{money(item.deductions)}</td><td className="px-3 py-3 font-bold">{money(item.net_salary)}</td>
                                                <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${item.payment_status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{item.payment_status}</span></td>
                                                <td className="px-3 py-3"><div className="flex flex-wrap gap-2">
                                                    {canPrepare && ["draft", "returned"].includes(selectedPayroll.status) && <button type="button" onClick={() => saveItem(item)} className="rounded-md border px-2 py-1 text-xs font-semibold">Save changes</button>}
                                                    {canPay && ["posted", "partially_paid"].includes(selectedPayroll.status) && item.payment_status !== "paid" && <button type="button" onClick={() => payItem(item)} disabled={busy} className="rounded-md bg-blue-700 px-2 py-1 text-xs font-bold text-white"><FaWallet className="mr-1 inline" />Record payment</button>}
                                                    {snapshot && <button type="button" onClick={() => setPrintItemId(item.id)} className="rounded-md border px-2 py-1 text-xs font-semibold"><FaPrint className="mr-1 inline" />Payslip</button>}
                                                </div>
                                                {canPrepare && ["draft", "returned"].includes(selectedPayroll.status) && <form id={`payroll-item-${item.id}`} className="mt-2 grid grid-cols-3 gap-1">
                                                    {["basic_salary", "allowances"].map((key) => <input key={key} name={key} aria-label={key} type="number" min="0" step="0.01" defaultValue={item[key]} className="w-24 rounded border px-1 py-1 text-xs" />)}
                                                    <div className="col-span-3 space-y-1">
                                                        {(itemDeductionForms[item.id] || []).map((line, lineIndex) => <div key={lineIndex} className="flex gap-1">
                                                            <input aria-label="Deduction name" value={line.name} onChange={(event) => setItemDeductionForms((old) => ({ ...old, [item.id]: old[item.id].map((entry, index) => index === lineIndex ? { ...entry, name: event.target.value } : entry) }))} placeholder="Deduction name" className="w-28 rounded border px-1 py-1 text-xs" />
                                                            <input aria-label="Deduction amount" type="number" min="0" step="0.01" value={line.amount} onChange={(event) => setItemDeductionForms((old) => ({ ...old, [item.id]: old[item.id].map((entry, index) => index === lineIndex ? { ...entry, amount: event.target.value } : entry) }))} className="w-24 rounded border px-1 py-1 text-xs" />
                                                            <button type="button" onClick={() => setItemDeductionForms((old) => ({ ...old, [item.id]: old[item.id].filter((_, index) => index !== lineIndex) }))} className="text-rose-600">×</button>
                                                        </div>)}
                                                        <button type="button" onClick={() => setItemDeductionForms((old) => ({ ...old, [item.id]: [...(old[item.id] || []), { name: "", amount: "" }] }))} className="text-xs font-semibold text-blue-700">+ Add named deduction</button>
                                                    </div>
                                                </form>}
                                                {canPay && ["posted", "partially_paid"].includes(selectedPayroll.status) && item.payment_status !== "paid" && <div className="mt-2 grid gap-1">
                                                    <select value={paymentForms[item.id]?.cash_account_id || ""} onChange={(event) => setPaymentForms((old) => ({ ...old, [item.id]: { ...old[item.id], cash_account_id: event.target.value } }))} className="rounded border px-2 py-1 text-xs"><option value="">Cash/bank account</option>{workspace.cashAccounts.map((account) => <option key={account.id} value={account.id}>{account.account_name}</option>)}</select>
                                                    <input type="date" value={paymentForms[item.id]?.payment_date || ""} onChange={(event) => setPaymentForms((old) => ({ ...old, [item.id]: { ...old[item.id], payment_date: event.target.value } }))} className="rounded border px-2 py-1 text-xs" />
                                                    <input value={paymentForms[item.id]?.payment_method || ""} onChange={(event) => setPaymentForms((old) => ({ ...old, [item.id]: { ...old[item.id], payment_method: event.target.value } }))} placeholder="Payment method" className="rounded border px-2 py-1 text-xs" />
                                                    <input value={paymentForms[item.id]?.reference || ""} onChange={(event) => setPaymentForms((old) => ({ ...old, [item.id]: { ...old[item.id], reference: event.target.value } }))} placeholder="Payment reference" className="rounded border px-2 py-1 text-xs" />
                                                </div>}
                                                </td>
                                            </tr>;
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {selectedPayroll.review_notes && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">HR note: {selectedPayroll.review_notes}</p>}
                            {selectedPayroll.snapshot_locked_at && <p className="text-xs text-slate-500">Historical snapshot locked: {new Date(selectedPayroll.snapshot_locked_at).toLocaleString("en-GB", { timeZone: "Africa/Dar_es_Salaam" })}. Later changes to staff profiles do not alter this payroll or its payslips.</p>}
                            {selectedPayroll.audit?.length > 0 && <section className="rounded-xl border border-slate-200 p-4">
                                <h3 className="font-bold text-slate-900">Payroll Activity History</h3>
                                <ol className="mt-3 space-y-3">
                                    {selectedPayroll.audit.map((event) => <li key={event.id} className="flex gap-3 text-xs">
                                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                                        <div><p className="font-semibold text-slate-800">{String(event.event_type || "").replaceAll("_", " ")}</p>
                                            <p className="text-slate-600">{event.event_note || "Payroll workflow action"} · {event.actor_name}</p>
                                            <p className="mt-0.5 text-slate-400">{new Date(event.created_at).toLocaleString("en-GB", { timeZone: "Africa/Dar_es_Salaam" })}</p>
                                        </div>
                                    </li>)}
                                </ol>
                            </section>}
                        </div>
                    )}
                </div>
            </section>

            <div id="payroll-print-area" className="hidden print:block">
                {snapshot ? (
                    <div>
                        {printableItems.map((item, index) => {
                            const person = item.employee || {};
                            const payroll = snapshot.payroll || {};
                            const schoolSnapshot = snapshot.school || {};
                            const isPayslip = printIsPayslip;
                            const paymentInfo = (selectedPayroll?.payroll_items || []).find((row) => String(row.id) === String(item.payroll_item_id)) || {};
                            return <article key={item.payroll_item_id} className="payroll-print-page mx-auto max-w-4xl bg-white text-slate-900">
                                <header className="border-b-2 border-slate-800 pb-4 text-center">
                                    {schoolSnapshot.logo && <img src={schoolSnapshot.logo} alt="School logo" className="mx-auto mb-2 h-16 w-16 object-contain" />}
                                    <h1 className="text-xl font-black uppercase">{schoolSnapshot.school_name || school?.school_name}</h1>
                                    {schoolSnapshot.registration_number && <p className="text-xs">Registration No: {schoolSnapshot.registration_number}</p>}
                                    {schoolSnapshot.address && <p className="text-xs">{schoolSnapshot.address}</p>}
                                    {(schoolSnapshot.phone || schoolSnapshot.email || schoolSnapshot.website) && <p className="text-xs">{[schoolSnapshot.phone, schoolSnapshot.email, schoolSnapshot.website].filter(Boolean).join(" • ")}</p>}
                                    <h2 className="mt-4 text-lg font-bold">{isPayslip ? "EMPLOYEE PAYSLIP" : "MONTHLY PAYROLL REGISTER"}</h2>
                                    <p className="text-sm">Payroll No: {payroll.payroll_number} • Period: {String(payroll.payroll_month || "").slice(0, 7)}</p>
                                </header>
                                {isPayslip ? (
                                    <div className="mt-5 space-y-3 text-sm">
                                        <p><strong>Employee:</strong> {fullName(person)}</p>
                                        <p><strong>Employee No:</strong> {person.employee_number || "—"}</p>
                                        <p><strong>Department / Position:</strong> {[person.department, person.position].filter(Boolean).join(" / ") || "—"}</p>
                                        <table className="mt-4 w-full border-collapse text-sm"><tbody>
                                            <tr><td className="border p-2">Basic salary</td><td className="border p-2 text-right">{money(item.basic_salary)}</td></tr>
                                            <tr><td className="border p-2">Allowances</td><td className="border p-2 text-right">{money(item.allowances)}</td></tr>
                                            <tr><td className="border p-2">Gross earnings</td><td className="border p-2 text-right">{money(item.gross_salary)}</td></tr>
                                            {deductionLines(item.components).length ? deductionLines(item.components).map((line, lineIndex) => <tr key={lineIndex}><td className="border p-2">{line.name}</td><td className="border p-2 text-right">{money(line.amount)}</td></tr>) : <tr><td className="border p-2">Deductions</td><td className="border p-2 text-right">{money(item.deductions)}</td></tr>}
                                            <tr><td className="border p-2 font-semibold">Total deductions</td><td className="border p-2 text-right font-semibold">{money(item.deductions)}</td></tr>
                                            <tr><td className="border p-2 font-bold">Net pay</td><td className="border p-2 text-right font-bold">{money(item.net_salary)}</td></tr>
                                        </tbody></table>
                                        <div className="mt-4 rounded border p-3 text-xs">
                                            <p><strong>Payment status:</strong> {paymentInfo.payment_status || "unpaid"}</p>
                                            {paymentInfo.payment_date && <p><strong>Payment date:</strong> {paymentInfo.payment_date}</p>}
                                            {paymentInfo.payment_method && <p><strong>Payment method:</strong> {paymentInfo.payment_method}</p>}
                                            {paymentInfo.payment_reference && <p><strong>Payment reference:</strong> {paymentInfo.payment_reference}</p>}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-5">
                                        <table className="w-full border-collapse text-xs"><thead><tr>{["No.","Employee","Employee No","Basic","Allowances","Deductions","Net Pay","Payment"].map((label) => <th key={label} className="border p-2 text-left">{label}</th>)}</tr></thead><tbody>
                                            {snapshot.items.map((row, i) => {
                                                const paidItem = (selectedPayroll?.payroll_items || []).find((current) => String(current.id) === String(row.payroll_item_id)) || {};
                                                return <tr key={row.payroll_item_id}><td className="border p-2">{i + 1}</td><td className="border p-2">{fullName(row.employee)}</td><td className="border p-2">{row.employee?.employee_number || "—"}</td><td className="border p-2 text-right">{money(row.basic_salary)}</td><td className="border p-2 text-right">{money(row.allowances)}</td><td className="border p-2 text-right">{money(row.deductions)}{deductionLines(row.components).length > 0 && <div className="mt-1 text-left text-[9px]">{deductionLines(row.components).map((line, lineIndex) => <div key={lineIndex}>{line.name}: {money(line.amount)}</div>)}</div>}</td><td className="border p-2 text-right">{money(row.net_salary)}</td><td className="border p-2">{paidItem.payment_status || "unpaid"}</td></tr>;
                                            })}
                                        </tbody></table>
                                        <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm"><p>Gross: <strong>{money(payroll.total_gross_salary)}</strong></p><p>Deductions: <strong>{money(payroll.total_deductions)}</strong></p><p>Net payroll: <strong>{money(payroll.total_net_salary)}</strong></p></div>
                                    </div>
                                )}
                                <div className="mt-6 grid grid-cols-2 gap-8 text-xs">
                                    <div><p>Prepared by: {payroll.prepared_by_name || "—"}</p><p className="mt-8 border-t border-slate-500 pt-1">Accountant</p></div>
                                    <div><p>Reviewed / approved by: {payroll.reviewed_by_name || "—"}</p><p className="mt-8 border-t border-slate-500 pt-1">HR Manager</p></div>
                                </div>
                                <OfficialSeal seal={snapshot.seal} />
                                <p className="mt-2 text-center text-[10px] text-slate-500">Approved on {payroll.approved_at ? new Date(payroll.approved_at).toLocaleDateString("en-GB") : "—"}</p>
                            </article>;
                        })}
                    </div>
                ) : <p>Payroll print requires an HR-approved immutable snapshot.</p>}
            </div>
        </div>
    );
}

export default PayrollManagement;
