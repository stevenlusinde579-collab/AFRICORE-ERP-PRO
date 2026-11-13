import React, { useEffect, useState } from "react";
import { FaArrowLeft, FaUniversity, FaWallet } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";

// Provider names are provisioned by AfriCore migrations and shared by every school.
// Schools only register their own accounts in Cash & Financial Accounts.
export default function PaymentProviderSetup() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const { data, error: queryError } = await supabase
          .schema("finance")
          .from("payment_providers")
          .select("id,provider_name,provider_type,sort_order")
          .eq("is_active", true)
          .order("provider_type")
          .order("sort_order")
          .order("provider_name");
        if (queryError) throw queryError;
        if (active) setRows(data || []);
      } catch (err) {
        if (active) setError(err.message || "Imeshindikana kupakia orodha ya watoa huduma.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  const banks = rows.filter((row) => row.provider_type === "bank");
  const mobileMoney = rows.filter((row) => row.provider_type === "mobile_money");
  const cash = rows.filter((row) => row.provider_type === "cash");

  const ProviderGroup = ({ title, icon, items }) => (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
      <div className="p-5 border-b border-slate-800 flex items-center gap-3">
        {icon}
        <h2 className="font-semibold">{title}</h2>
        <span className="ml-auto text-xs text-slate-500">{items.length} available</span>
      </div>
      {items.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-4">
          {items.map((item) => <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm">{item.provider_name}</div>)}
        </div>
      ) : <p className="p-5 text-sm text-slate-500">No providers available.</p>}
    </section>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <button type="button" onClick={() => navigate("/dashboard")} className="inline-flex items-center gap-2 text-sm text-slate-300"><FaArrowLeft /> Back</button>
        <header>
          <h1 className="text-2xl font-bold">Built-in Payment Providers</h1>
          <p className="text-sm text-slate-400 mt-1">AfriCore supplies this shared provider list automatically. No SuperAdmin setup is required. Each school registers only its own financial accounts and balances.</p>
        </header>
        {error && <div role="alert" className="rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{error}</div>}
        {loading ? <p className="text-sm text-slate-400">Loading built-in providers...</p> : (
          <>
            <ProviderGroup title="Banks" icon={<FaUniversity className="text-blue-400" />} items={banks} />
            <ProviderGroup title="Mobile Money" icon={<FaWallet className="text-emerald-400" />} items={mobileMoney} />
            <ProviderGroup title="Cash" icon={<FaWallet className="text-amber-400" />} items={cash} />
          </>
        )}
      </div>
    </div>
  );
}
