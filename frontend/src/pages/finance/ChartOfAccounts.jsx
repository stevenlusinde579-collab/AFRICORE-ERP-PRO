import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FaPlus, FaEdit, FaSyncAlt, FaSearch, FaCheckCircle } from "react-icons/fa";
import { supabase } from "../../services/supabase";

const EMPTY_FORM = {
  account_code: "",
  account_name: "",
  account_type: "asset",
  description: "",
  account_category: "",
  parent_id: "",
};

const normalBalanceFor = (type) =>
  ["liability", "equity", "revenue"].includes(type) ? "credit" : "debit";

const money = (value) =>
  new Intl.NumberFormat("en-TZ", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

function ChartOfAccounts() {
  const [schoolId, setSchoolId] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user?.id) throw new Error("Your session has expired. Please login again.");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", authData.user.id)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile?.school_id) throw new Error("School ID ya mtumiaji haijapatikana.");

      const activeSchoolId = Number(profile.school_id);
      setSchoolId(activeSchoolId);

      const { data, error: accountsError } = await supabase
        .schema("finance")
        .from("chart_of_accounts")
        .select("id,school_id,account_code,account_name,account_type,normal_balance,parent_id,account_category,description,is_control_account,allow_manual_posting,is_active,opening_balance")
        .eq("school_id", activeSchoolId)
        .order("account_code", { ascending: true });

      if (accountsError) throw accountsError;
      setAccounts(data || []);
    } catch (loadError) {
      setError(loadError.message || "Imeshindikana kupakia Chart of Accounts.");
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const filteredAccounts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return accounts.filter((account) => {
      const matchesTerm =
        !term ||
        String(account.account_code || "").toLowerCase().includes(term) ||
        String(account.account_name || "").toLowerCase().includes(term);
      const matchesType = typeFilter === "all" || account.account_type === typeFilter;
      return matchesTerm && matchesType;
    });
  }, [accounts, search, typeFilter]);

  const summary = useMemo(() => ({
    total: accounts.length,
    assets: accounts.filter((item) => item.account_type === "asset").length,
    liabilities: accounts.filter((item) => item.account_type === "liability").length,
    revenue: accounts.filter((item) => item.account_type === "revenue").length,
    expenses: accounts.filter((item) => item.account_type === "expense").length,
  }), [accounts]);

  const openAddForm = () => {
    setEditingAccount(null);
    setForm(EMPTY_FORM);
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const openEditForm = (account) => {
    setEditingAccount(account);
    setForm({
      account_code: account.account_code || "",
      account_name: account.account_name || "",
      account_type: account.account_type || "asset",
      description: account.description || "",
      account_category: account.account_category || "",
      parent_id: account.parent_id || "",
    });
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!schoolId) return setError("School ID haijapatikana.");
    if (!form.account_code.trim()) return setError("Account code is required.");
    if (!form.account_name.trim()) return setError("Account name is required.");

    setSaving(true);
    try {
      const payload = {
        school_id: schoolId,
        account_code: form.account_code.trim(),
        account_name: form.account_name.trim(),
        account_type: form.account_type,
        normal_balance: normalBalanceFor(form.account_type),
        description: form.description.trim() || null,
        account_category: form.account_category.trim() || null,
        parent_id: form.parent_id || null,
      };

      let result;
      if (editingAccount) {
        // Control accounts are maintained by the system to protect ledger integrity.
        if (editingAccount.is_control_account) {
          throw new Error("System control accounts cannot be edited here.");
        }
        const { school_id: _schoolId, account_code: _accountCode, ...updatePayload } = payload;
        result = await supabase
          .schema("finance")
          .from("chart_of_accounts")
          .update(updatePayload)
          .eq("id", editingAccount.id)
          .eq("school_id", schoolId);
      } else {
        // User-created accounts are always postable and are never control accounts.
        result = await supabase
          .schema("finance")
          .from("chart_of_accounts")
          .insert({
            ...payload,
            is_control_account: false,
            allow_manual_posting: true,
            is_active: true,
            opening_balance: 0,
          });
      }

      if (result.error) throw result.error;
      setSuccess(editingAccount ? "Account updated successfully." : "Account created successfully.");
      setShowForm(false);
      setEditingAccount(null);
      setForm(EMPTY_FORM);
      await loadAccounts();
    } catch (saveError) {
      setError(saveError.message || "Imeshindikana kuhifadhi akaunti.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (account) => {
    if (account.is_control_account) {
      setError("System control accounts cannot be deactivated here.");
      return;
    }
    setError("");
    setSuccess("");
    const { error: updateError } = await supabase
      .schema("finance")
      .from("chart_of_accounts")
      .update({ is_active: !account.is_active })
      .eq("id", account.id)
      .eq("school_id", schoolId);
    if (updateError) {
      setError(updateError.message || "Imeshindikana kubadilisha hali ya akaunti.");
      return;
    }
    setSuccess(account.is_active ? "Account deactivated." : "Account activated.");
    await loadAccounts();
  };

  const parentOptions = accounts.filter((account) =>
    account.id !== editingAccount?.id && account.is_active
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Chart of Accounts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage this school's accounting accounts. Changes are restricted to your school.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={loadAccounts} className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
            <FaSyncAlt /> Refresh
          </button>
          <button type="button" onClick={openAddForm} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <FaPlus /> Add Account
          </button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700"><FaCheckCircle className="inline mr-2" />{success}</div>}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          ["Total Accounts", summary.total],
          ["Assets", summary.assets],
          ["Liabilities", summary.liabilities],
          ["Revenue", summary.revenue],
          ["Expenses", summary.expenses],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-white p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-1 text-xl font-bold text-gray-800">{value}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">{editingAccount ? "Edit Account" : "Add Account"}</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-500 underline">Cancel</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-sm">
              <span className="block mb-1 font-medium">Account Code</span>
              <input value={form.account_code} disabled={!!editingAccount} onChange={(e) => setForm((old) => ({ ...old, account_code: e.target.value }))} placeholder="e.g. 1030" className="w-full rounded-lg border px-3 py-2 disabled:bg-gray-100" required />
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium">Account Name</span>
              <input value={form.account_name} onChange={(e) => setForm((old) => ({ ...old, account_name: e.target.value }))} placeholder="e.g. NMB Bank Account" className="w-full rounded-lg border px-3 py-2" required />
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium">Account Type</span>
              <select value={form.account_type} onChange={(e) => setForm((old) => ({ ...old, account_type: e.target.value }))} className="w-full rounded-lg border px-3 py-2">
                <option value="asset">Asset</option>
                <option value="liability">Liability</option>
                <option value="equity">Equity</option>
                <option value="revenue">Revenue</option>
                <option value="expense">Expense</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium">Parent Account (optional)</span>
              <select value={form.parent_id} onChange={(e) => setForm((old) => ({ ...old, parent_id: e.target.value }))} className="w-full rounded-lg border px-3 py-2">
                <option value="">No parent account</option>
                {parentOptions.map((account) => <option key={account.id} value={account.id}>{account.account_code} — {account.account_name}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium">Category (optional)</span>
              <input value={form.account_category} onChange={(e) => setForm((old) => ({ ...old, account_category: e.target.value }))} placeholder="e.g. Cash and Cash Equivalents" className="w-full rounded-lg border px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium">Normal Balance</span>
              <input value={normalBalanceFor(form.account_type).toUpperCase()} readOnly className="w-full rounded-lg border bg-gray-100 px-3 py-2" />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="block mb-1 font-medium">Description (optional)</span>
              <textarea value={form.description} onChange={(e) => setForm((old) => ({ ...old, description: e.target.value }))} rows={3} className="w-full rounded-lg border px-3 py-2" placeholder="Account purpose or notes..." />
            </label>
          </div>
          <p className="text-xs text-gray-500">
            Accounts created here belong only to this school. New accounts are postable, active, and start with zero opening balance. System control accounts are protected.
          </p>
          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving..." : editingAccount ? "Update Account" : "Save Account"}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="flex flex-col md:flex-row gap-3 border-b p-4">
          <div className="relative flex-1">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search account code or name..." className="w-full rounded-lg border py-2 pl-9 pr-3" />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-lg border px-3 py-2">
            <option value="all">All Account Types</option>
            <option value="asset">Assets</option>
            <option value="liability">Liabilities</option>
            <option value="equity">Equity</option>
            <option value="revenue">Revenue</option>
            <option value="expense">Expenses</option>
          </select>
        </div>
        {loading ? (
          <p className="p-6 text-sm text-gray-500">Loading accounts...</p>
        ) : filteredAccounts.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No accounts found for this school.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-3 text-left">Code</th>
                  <th className="p-3 text-left">Account Name</th>
                  <th className="p-3 text-left">Type</th>
                  <th className="p-3 text-left">Normal Balance</th>
                  <th className="p-3 text-right">Opening Balance</th>
                  <th className="p-3 text-left">Posting</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredAccounts.map((account) => (
                  <tr key={account.id} className="hover:bg-gray-50">
                    <td className="p-3 font-semibold">{account.account_code}</td>
                    <td className="p-3">
                      <div className="font-medium">{account.account_name}</div>
                      {account.description && <div className="mt-1 text-xs text-gray-500">{account.description}</div>}
                    </td>
                    <td className="p-3 capitalize">{account.account_type}</td>
                    <td className="p-3 capitalize">{account.normal_balance}</td>
                    <td className="p-3 text-right tabular-nums">{money(account.opening_balance)}</td>
                    <td className="p-3">
                      {account.is_control_account ? <span className="text-xs text-purple-700">System control</span> : account.allow_manual_posting ? <span className="text-xs text-green-700">Postable</span> : <span className="text-xs text-gray-500">Restricted</span>}
                    </td>
                    <td className="p-3">
                      <span className={account.is_active ? "text-green-700" : "text-gray-500"}>{account.is_active ? "Active" : "Inactive"}</span>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {!account.is_control_account && (
                        <>
                          <button type="button" onClick={() => openEditForm(account)} className="mr-3 text-blue-700 hover:underline"><FaEdit className="inline mr-1" />Edit</button>
                          <button type="button" onClick={() => toggleActive(account)} className="text-amber-700 hover:underline">{account.is_active ? "Deactivate" : "Activate"}</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChartOfAccounts;
