import React, { useCallback, useEffect, useState } from "react";
import { FaArrowLeft, FaCheckCircle, FaEdit, FaUniversity, FaWallet } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";

const EMPTY_FORM = {
    accountName: "",
    accountType: "bank",
    providerName: "",
    accountNumber: "",
    chartOfAccountId: "",
};

function CashAccounts() {
    const navigate = useNavigate();
    const [schoolId, setSchoolId] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [chartAccounts, setChartAccounts] = useState([]);
    const [globalProviders, setGlobalProviders] = useState([]);
    const [form, setForm] = useState(EMPTY_FORM);
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const loadData = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const { data: authData, error: authError } = await supabase.auth.getUser();
            if (authError) throw authError;
            if (!authData?.user?.id) throw new Error("User session haijapatikana.");

            const { data: profile, error: profileError } = await supabase
                .from("profiles")
                .select("school_id")
                .eq("id", authData.user.id)
                .maybeSingle();
            if (profileError) throw profileError;
            if (!profile?.school_id) throw new Error("School ID ya mtumiaji haijapatikana.");
            setSchoolId(Number(profile.school_id));

            const [{ data: accountRows, error: accountError }, { data: chartRows, error: chartError }, { data: providerRows, error: providerError }] = await Promise.all([
                supabase.schema("finance").from("cash_accounts")
                    .select("id,school_id,account_name,account_type,provider_name,account_number,chart_of_account_id,opening_balance,current_balance,is_active")
                    .eq("school_id", profile.school_id)
                    .order("account_name", { ascending: true }),
                supabase.schema("finance").from("chart_of_accounts")
                    .select("id,account_code,account_name,account_type,allow_manual_posting,is_active")
                    .eq("school_id", profile.school_id)
                    .eq("account_type", "asset")
                    .eq("is_active", true)
                    .eq("allow_manual_posting", true)
                    .eq("is_control_account", false)
                    .order("account_code", { ascending: true }),
                supabase.schema("finance").from("payment_providers")
                    .select("id,provider_name,provider_type,is_active,sort_order")
                    .eq("is_active", true)
                    .order("sort_order", { ascending: true })
                    .order("provider_name", { ascending: true }),
            ]);
            if (accountError) throw accountError;
            if (chartError) throw chartError;
            if (providerError) throw providerError;
            setAccounts(accountRows || []);
            setChartAccounts(chartRows || []);
            setGlobalProviders(providerRows || []);
        } catch (err) {
            setError(err.message || "Imeshindikana kupakia financial accounts.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const resetForm = () => {
        setForm(EMPTY_FORM);
        setEditingId(null);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");
        setSuccess("");
        if (!schoolId) return setError("School ID haijapatikana.");
        if (!form.accountName.trim()) return setError("Weka jina la financial account.");
        if (!form.providerName.trim()) return setError("Chagua bank, mobile money provider au Cash kutoka kwenye orodha ya mfumo.");
        if (!form.chartOfAccountId) return setError("Chagua Chart of Accounts inayolingana na akaunti hii.");

        setSaving(true);
        try {
            const payload = {
                school_id: schoolId,
                account_name: form.accountName.trim(),
                account_type: form.accountType,
                provider_name: form.providerName.trim() || null,
                account_number: form.accountNumber.trim() || null,
                chart_of_account_id: form.chartOfAccountId,
            };
            let result;
            if (editingId) {
                result = await supabase.schema("finance").from("cash_accounts")
                    .update(payload)
                    .eq("id", editingId)
                    .eq("school_id", schoolId);
            } else {
                result = await supabase.schema("finance").from("cash_accounts").insert(payload);
            }
            if (result.error) throw result.error;
            setSuccess(editingId ? "Financial account imesasishwa." : "Financial account imeongezwa.");
            resetForm();
            await loadData();
        } catch (err) {
            setError(err.message || "Imeshindikana kuhifadhi financial account.");
        } finally {
            setSaving(false);
        }
    };

    const startEdit = (account) => {
        setEditingId(account.id);
        setForm({
            accountName: account.account_name || "",
            accountType: account.account_type || "bank",
            providerName: account.provider_name || "",
            accountNumber: account.account_number || "",
            chartOfAccountId: account.chart_of_account_id || "",
        });
        setError("");
        setSuccess("");
        window.scrollTo?.({ top: 0, behavior: "smooth" });
    };

    const toggleActive = async (account) => {
        setError("");
        setSuccess("");
        const { error: updateError } = await supabase.schema("finance").from("cash_accounts")
            .update({ is_active: !account.is_active })
            .eq("id", account.id)
            .eq("school_id", schoolId);
        if (updateError) {
            setError(updateError.message || "Imeshindikana kubadilisha hali ya akaunti.");
            return;
        }
        setSuccess(account.is_active ? "Akaunti imezimwa; historia yake imehifadhiwa." : "Akaunti imewashwa.");
        await loadData();
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <button type="button" onClick={() => navigate("/finance/dashboard")} className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white">
                    <FaArrowLeft /> Back to Finance
                </button>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold">Cash & Financial Accounts</h1>
                        <p className="text-sm text-slate-400 mt-1">Manage bank, mobile money and cash accounts used when receiving payments.</p>
                    </div>
                    <div className="rounded-xl bg-slate-900 border border-slate-800 p-3 flex items-center gap-3">
                        <FaWallet className="text-emerald-400" />
                        <span className="text-sm">{accounts.filter((a) => a.is_active).length} active accounts</span>
                    </div>
                </div>

                {error && <div role="alert" className="rounded-xl border border-red-800 bg-red-950/50 p-3 text-sm text-red-200">{error}</div>}
                {success && <div role="status" className="rounded-xl border border-emerald-800 bg-emerald-950/40 p-3 text-sm text-emerald-200"><FaCheckCircle className="inline mr-2" />{success}</div>}

                <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="font-semibold">{editingId ? "Edit Financial Account" : "Add Financial Account"}</h2>
                        {editingId && <button type="button" onClick={resetForm} className="text-xs text-slate-300 underline">Cancel edit</button>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="text-sm space-y-1">
                            <span className="text-slate-300">Account Type</span>
                            <select value={form.accountType} onChange={(e) => setForm((v) => ({ ...v, accountType: e.target.value, providerName: "" }))} className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3">
                                <option value="bank">Bank</option>
                                <option value="mobile_money">Mobile Money</option>
                                <option value="cash">Cash</option>
                            </select>
                        </label>
                        <label className="text-sm space-y-1">
                            <span className="text-slate-300">Account Name</span>
                            <input value={form.accountName} onChange={(e) => setForm((v) => ({ ...v, accountName: e.target.value }))} placeholder="e.g. CRDB School Fees Account" className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3" required />
                        </label>
                        <label className="text-sm space-y-1">
                            <span className="text-slate-300">Bank / Mobile Provider</span>
                            <select value={form.providerName} onChange={(e) => setForm((v) => ({ ...v, providerName: e.target.value }))} className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3" required><option value="">Select provider</option>{globalProviders.filter((provider) => provider.provider_type === form.accountType || (form.accountType === "cash" && provider.provider_type === "cash")).map((provider) => <option key={provider.id} value={provider.provider_name}>{provider.provider_name}</option>)}</select>
                        </label>
                        <label className="text-sm space-y-1">
                            <span className="text-slate-300">Account / Till / Phone Number</span>
                            <input value={form.accountNumber} onChange={(e) => setForm((v) => ({ ...v, accountNumber: e.target.value }))} placeholder="Account number or merchant number" className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3" />
                        </label>
                        <label className="text-sm space-y-1 md:col-span-2">
                            <span className="text-slate-300">Linked Chart of Accounts (Postable Asset)</span>
                            <select value={form.chartOfAccountId} onChange={(e) => setForm((v) => ({ ...v, chartOfAccountId: e.target.value }))} className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3" required>
                                <option value="">Select an active, postable Asset account</option>
                                {chartAccounts.map((account) => <option key={account.id} value={account.id}>{account.account_code} — {account.account_name}{account.allow_manual_posting ? "" : " (manual posting disabled)"}</option>)}
                            </select>
                            <span className="block text-xs text-slate-500">Tumia Asset account inayoruhusu manual posting na si control account. Usichague Student Receivables kwa ajili ya bank/cash.</span>
                        </label>
                    </div>
                    {chartAccounts.length === 0 && <p className="text-xs text-amber-300">Hakuna active, postable Asset account iliyosajiliwa. Ongeza kwanza Bank/Cash Asset kwenye Chart of Accounts; usitumie Student Receivables.</p>}
                    <button disabled={saving || chartAccounts.length === 0} className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-5 py-3 font-semibold text-sm">
                        {saving ? "Saving..." : editingId ? "Update Account" : "Save Financial Account"}
                    </button>
                </form>

                <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
                    <div className="p-5 border-b border-slate-800 flex items-center gap-2"><FaUniversity className="text-blue-400" /><h2 className="font-semibold">Registered Financial Accounts</h2></div>
                    {loading ? <p className="p-6 text-sm text-slate-400">Loading accounts...</p> : accounts.length === 0 ? <p className="p-6 text-sm text-slate-400">No financial accounts registered for this school yet.</p> : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-950 text-slate-400"><tr><th className="text-left p-3">Account</th><th className="text-left p-3">Type</th><th className="text-left p-3">Provider / Number</th><th className="text-right p-3">Current Balance</th><th className="text-left p-3">Status</th><th className="text-right p-3">Actions</th></tr></thead>
                                <tbody>{accounts.map((account) => (
                                    <tr key={account.id} className="border-t border-slate-800">
                                        <td className="p-3"><div className="font-medium">{account.account_name}</div><div className="text-xs text-slate-500">{chartAccounts.find((a) => a.id === account.chart_of_account_id)?.account_name || "Linked asset account"}</div></td>
                                        <td className="p-3 capitalize">{account.account_type === "mobile_money" ? "Mobile Money" : account.account_type}</td>
                                        <td className="p-3">{account.provider_name || "—"}<div className="text-xs text-slate-500">{account.account_number || ""}</div></td>
                                        <td className="p-3 text-right font-semibold tabular-nums">{new Intl.NumberFormat("en-TZ", { style: "currency", currency: "TZS", maximumFractionDigits: 0 }).format(Number(account.current_balance || 0))}</td>
                                        <td className="p-3"><span className={account.is_active ? "text-emerald-400" : "text-slate-500"}>{account.is_active ? "Active" : "Inactive"}</span></td>
                                        <td className="p-3 text-right whitespace-nowrap"><button type="button" onClick={() => startEdit(account)} className="inline-flex items-center gap-1 mr-3 text-blue-300 hover:text-blue-200"><FaEdit /> Edit</button><button type="button" onClick={() => toggleActive(account)} className="text-xs text-amber-300 hover:text-amber-200">{account.is_active ? "Deactivate" : "Activate"}</button></td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default CashAccounts;
