import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase";
import {
  MdAdd,
  MdEdit,
  MdSearch,
  MdRefresh,
  MdAccountBalanceWallet,
  MdClose,
} from "react-icons/md";

function ChartOfAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);

  const [form, setForm] = useState({
    account_code: "",
    account_name: "",
    account_type: "asset",
    normal_balance: "debit",
    description: "",
  });

  // =====================================================
  // LOAD ACCOUNTS
  // =====================================================

  const loadAccounts = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .order("account_code", { ascending: true });

      if (error) {
        throw error;
      }

      setAccounts(data || []);
    } catch (error) {
      console.error("Error loading accounts:", error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  // =====================================================
  // FILTER
  // =====================================================

  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      const searchText = search.toLowerCase();

      const matchesSearch =
        account.account_code?.toLowerCase().includes(searchText) ||
        account.account_name?.toLowerCase().includes(searchText);

      const matchesType =
        typeFilter === "all" ||
        account.account_type === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [accounts, search, typeFilter]);

  // =====================================================
  // OPEN ADD MODAL
  // =====================================================

  const openAddModal = () => {
    setEditingAccount(null);

    setForm({
      account_code: "",
      account_name: "",
      account_type: "asset",
      normal_balance: "debit",
      description: "",
    });

    setShowModal(true);
  };

  // =====================================================
  // OPEN EDIT MODAL
  // =====================================================

  const openEditModal = (account) => {
    setEditingAccount(account);

    setForm({
      account_code: account.account_code || "",
      account_name: account.account_name || "",
      account_type: account.account_type || "asset",
      normal_balance: account.normal_balance || "debit",
      description: account.description || "",
    });

    setShowModal(true);
  };

  // =====================================================
  // HANDLE ACCOUNT TYPE
  // =====================================================

  const handleAccountTypeChange = (value) => {
    let normalBalance = "debit";

    if (
      value === "liability" ||
      value === "equity" ||
      value === "revenue"
    ) {
      normalBalance = "credit";
    }

    setForm((prev) => ({
      ...prev,
      account_type: value,
      normal_balance: normalBalance,
    }));
  };

  // =====================================================
  // SAVE ACCOUNT
  // =====================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.account_code.trim()) {
      alert("Account code is required.");
      return;
    }

    if (!form.account_name.trim()) {
      alert("Account name is required.");
      return;
    }

    try {
      const payload = {
        account_code: form.account_code.trim(),
        account_name: form.account_name.trim(),
        account_type: form.account_type,
        normal_balance: form.normal_balance,
        description: form.description.trim() || null,
      };

      if (editingAccount) {
        const { error } = await supabase
          .from("chart_of_accounts")
          .update({
            account_name: payload.account_name,
            account_type: payload.account_type,
            normal_balance: payload.normal_balance,
            description: payload.description,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingAccount.id);

        if (error) {
          throw error;
        }

        alert("Account updated successfully.");
      } else {
        const { error } = await supabase
          .from("chart_of_accounts")
          .insert([payload]);

        if (error) {
          throw error;
        }

        alert("Account created successfully.");
      }

      setShowModal(false);
      setEditingAccount(null);

      await loadAccounts();
    } catch (error) {
      console.error("Error saving account:", error);
      alert(error.message);
    }
  };

  // =====================================================
  // FORMAT MONEY
  // =====================================================

  const formatMoney = (amount) => {
    return new Intl.NumberFormat("en-TZ", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));
  };

  // =====================================================
  // ACCOUNT TYPE BADGE
  // =====================================================

  const getTypeBadge = (type) => {
    const styles = {
      asset: "bg-blue-100 text-blue-700",
      liability: "bg-red-100 text-red-700",
      equity: "bg-purple-100 text-purple-700",
      revenue: "bg-green-100 text-green-700",
      expense: "bg-orange-100 text-orange-700",
    };

    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
          styles[type] || "bg-gray-100 text-gray-700"
        }`}
      >
        {type}
      </span>
    );
  };

  // =====================================================
  // SUMMARY
  // =====================================================

  const summary = {
    total: accounts.length,
    assets: accounts.filter((a) => a.account_type === "asset").length,
    liabilities: accounts.filter(
      (a) => a.account_type === "liability"
    ).length,
    equity: accounts.filter((a) => a.account_type === "equity").length,
    revenue: accounts.filter((a) => a.account_type === "revenue").length,
    expenses: accounts.filter((a) => a.account_type === "expense").length,
  };

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Chart of Accounts
          </h1>

          <p className="text-sm text-gray-500 mt-1">
            Manage your accounting accounts and account structure.
          </p>
        </div>

        <div className="flex gap-2">

          <button
            onClick={loadAccounts}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <MdRefresh size={20} />
            Refresh
          </button>

          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <MdAdd size={20} />
            Add Account
          </button>

        </div>

      </div>


      {/* =================================================
          SUMMARY CARDS
      ================================================= */}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">

        <SummaryCard
          title="Total"
          value={summary.total}
          icon={<MdAccountBalanceWallet size={22} />}
        />

        <SummaryCard
          title="Assets"
          value={summary.assets}
        />

        <SummaryCard
          title="Liabilities"
          value={summary.liabilities}
        />

        <SummaryCard
          title="Equity"
          value={summary.equity}
        />

        <SummaryCard
          title="Revenue"
          value={summary.revenue}
        />

        <SummaryCard
          title="Expenses"
          value={summary.expenses}
        />

      </div>


      {/* =================================================
          SEARCH + FILTER
      ================================================= */}

      <div className="bg-white rounded-xl shadow-sm border p-4">

        <div className="flex flex-col md:flex-row gap-3">

          <div className="relative flex-1">

            <MdSearch
              size={22}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search account code or account name..."
              className="w-full border rounded-lg pl-10 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
            />

          </div>


          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Account Types</option>
            <option value="asset">Assets</option>
            <option value="liability">Liabilities</option>
            <option value="equity">Equity</option>
            <option value="revenue">Revenue</option>
            <option value="expense">Expenses</option>
          </select>

        </div>

      </div>


      {/* =================================================
          TABLE
      ================================================= */}

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">

        <div className="overflow-x-auto">

          <table className="w-full text-sm">

            <thead className="bg-gray-50 border-b">

              <tr>

                <th className="text-left px-5 py-4 font-semibold text-gray-600">
                  Code
                </th>

                <th className="text-left px-5 py-4 font-semibold text-gray-600">
                  Account Name
                </th>

                <th className="text-left px-5 py-4 font-semibold text-gray-600">
                  Type
                </th>

                <th className="text-left px-5 py-4 font-semibold text-gray-600">
                  Normal Balance
                </th>

                <th className="text-left px-5 py-4 font-semibold text-gray-600">
                  Status
                </th>

                <th className="text-right px-5 py-4 font-semibold text-gray-600">
                  Action
                </th>

              </tr>

            </thead>

            <tbody className="divide-y">

              {loading ? (

                <tr>
                  <td
                    colSpan="6"
                    className="text-center py-10 text-gray-500"
                  >
                    Loading accounts...
                  </td>
                </tr>

              ) : filteredAccounts.length === 0 ? (

                <tr>
                  <td
                    colSpan="6"
                    className="text-center py-10 text-gray-500"
                  >
                    No accounts found.
                  </td>
                </tr>

              ) : (

                filteredAccounts.map((account) => (

                  <tr
                    key={account.id}
                    className="hover:bg-gray-50"
                  >

                    <td className="px-5 py-4 font-semibold text-gray-800">
                      {account.account_code}
                    </td>

                    <td className="px-5 py-4">
                      <div className="font-medium text-gray-800">
                        {account.account_name}
                      </div>

                      {account.description && (
                        <div className="text-xs text-gray-500 mt-1">
                          {account.description}
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      {getTypeBadge(account.account_type)}
                    </td>

                    <td className="px-5 py-4 capitalize">
                      {account.normal_balance}
                    </td>

                    <td className="px-5 py-4">

                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          account.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {account.is_active ? "Active" : "Inactive"}
                      </span>

                    </td>

                    <td className="px-5 py-4 text-right">

                      <button
                        onClick={() => openEditModal(account)}
                        className="inline-flex items-center gap-1 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <MdEdit size={18} />
                        Edit
                      </button>

                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>

      </div>


      {/* =================================================
          MODAL
      ================================================= */}

      {showModal && (

        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">

          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">

            {/* Modal Header */}

            <div className="flex items-center justify-between px-6 py-4 border-b">

              <h2 className="text-lg font-bold text-gray-800">
                {editingAccount
                  ? "Edit Account"
                  : "Add Account"}
              </h2>

              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <MdClose size={22} />
              </button>

            </div>


            {/* Form */}

            <form
              onSubmit={handleSubmit}
              className="p-6 space-y-4"
            >

              <div>

                <label className="block text-sm font-medium mb-1">
                  Account Code
                </label>

                <input
                  type="text"
                  value={form.account_code}
                  disabled={!!editingAccount}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      account_code: e.target.value,
                    })
                  }
                  placeholder="e.g. 1400"
                  className="w-full border rounded-lg px-4 py-2.5 disabled:bg-gray-100"
                />

              </div>


              <div>

                <label className="block text-sm font-medium mb-1">
                  Account Name
                </label>

                <input
                  type="text"
                  value={form.account_name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      account_name: e.target.value,
                    })
                  }
                  placeholder="e.g. Inventory"
                  className="w-full border rounded-lg px-4 py-2.5"
                />

              </div>


              <div>

                <label className="block text-sm font-medium mb-1">
                  Account Type
                </label>

                <select
                  value={form.account_type}
                  onChange={(e) =>
                    handleAccountTypeChange(e.target.value)
                  }
                  className="w-full border rounded-lg px-4 py-2.5"
                >
                  <option value="asset">Asset</option>
                  <option value="liability">Liability</option>
                  <option value="equity">Equity</option>
                  <option value="revenue">Revenue</option>
                  <option value="expense">Expense</option>
                </select>

              </div>


              <div>

                <label className="block text-sm font-medium mb-1">
                  Normal Balance
                </label>

                <input
                  type="text"
                  value={form.normal_balance.toUpperCase()}
                  readOnly
                  className="w-full border rounded-lg px-4 py-2.5 bg-gray-100"
                />

              </div>


              <div>

                <label className="block text-sm font-medium mb-1">
                  Description
                </label>

                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      description: e.target.value,
                    })
                  }
                  rows="3"
                  placeholder="Account description..."
                  className="w-full border rounded-lg px-4 py-2.5"
                />

              </div>


              <div className="flex justify-end gap-3 pt-3">

                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingAccount
                    ? "Update Account"
                    : "Save Account"}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}


// =========================================================
// SUMMARY CARD
// =========================================================

function SummaryCard({ title, value, icon }) {
  return (
    <div className="bg-white border rounded-xl p-4 shadow-sm">

      <div className="flex items-center justify-between">

        <div>
          <p className="text-xs text-gray-500">
            {title}
          </p>

          <p className="text-xl font-bold text-gray-800 mt-1">
            {value}
          </p>
        </div>

        {icon && (
          <div className="text-blue-600">
            {icon}
          </div>
        )}

      </div>

    </div>
  );
}

export default ChartOfAccounts;