import React, { useCallback, useEffect, useState } from "react";
import { FaArrowLeft, FaCheckCircle, FaEdit, FaMoneyBillWave } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";

const EMPTY = { providerName: "", providerType: "bank", sortOrder: "100" };

export default function PaymentProviderSetup() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user?.id) throw new Error("User session haijapatikana.");
      const { data: profile, error: profileError } = await supabase.from("profiles").select("role_id").eq("id", auth.user.id).maybeSingle();
      if (profileError) throw profileError;
      if (Number(profile?.role_id) !== 1) throw new Error("Ni SuperAdmin pekee anayeruhusiwa kusimamia orodha hii.");
      const { data, error: queryError } = await supabase.schema("finance").from("payment_providers").select("*").order("sort_order").order("provider_name");
      if (queryError) throw queryError;
      setRows(data || []);
    } catch (e) { setError(e.message || "Imeshindikana kupakia payment providers."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  const reset = () => { setForm(EMPTY); setEditingId(null); };

  const save = async (event) => {
    event.preventDefault(); setError(""); setSuccess("");
    if (!form.providerName.trim()) return setError("Weka jina la bank au mobile money provider.");
    setSaving(true);
    try {
      const payload = { provider_name: form.providerName.trim(), provider_type: form.providerType, sort_order: Number(form.sortOrder) || 100 };
      const result = editingId
        ? await supabase.schema("finance").from("payment_providers").update(payload).eq("id", editingId)
        : await supabase.schema("finance").from("payment_providers").insert(payload);
      if (result.error) throw result.error;
      setSuccess(editingId ? "Provider amesasishwa." : "Provider ameongezwa kwa shule zote.");
      reset(); await load();
    } catch (e) { setError(e.message || "Imeshindikana kuhifadhi provider."); }
    finally { setSaving(false); }
  };

  const toggle = async (row) => {
    setError(""); setSuccess("");
    const { error: updateError } = await supabase.schema("finance").from("payment_providers").update({ is_active: !row.is_active }).eq("id", row.id);
    if (updateError) return setError(updateError.message);
    setSuccess(row.is_active ? "Provider amezimwa kwa shule zote." : "Provider amewashwa kwa shule zote.");
    await load();
  };

  return <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8"><div className="max-w-5xl mx-auto space-y-6">
    <button type="button" onClick={() => navigate("/dashboard")} className="inline-flex items-center gap-2 text-sm text-slate-300"><FaArrowLeft /> Back</button>
    <header><h1 className="text-2xl font-bold">Global Payment Provider Setup</h1><p className="text-sm text-slate-400 mt-1">Manage bank and mobile money provider names shared by every school. This does not create bank connections or school accounts.</p></header>
    {error && <div role="alert" className="rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{error}</div>}
    {success && <div role="status" className="rounded-xl border border-emerald-800 bg-emerald-950/40 p-3 text-sm text-emerald-200"><FaCheckCircle className="inline mr-2" />{success}</div>}
    <form onSubmit={save} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
      <label className="text-sm space-y-1"><span>Provider Type</span><select value={form.providerType} onChange={e => setForm(v => ({...v,providerType:e.target.value}))} className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3"><option value="bank">Bank</option><option value="mobile_money">Mobile Money</option><option value="cash">Cash</option></select></label>
      <label className="text-sm space-y-1"><span>Provider Name</span><input value={form.providerName} onChange={e => setForm(v => ({...v,providerName:e.target.value}))} placeholder="e.g. NMB" className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3" required /></label>
      <label className="text-sm space-y-1"><span>Display Order</span><input type="number" value={form.sortOrder} onChange={e => setForm(v => ({...v,sortOrder:e.target.value}))} className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3" /></label>
      <div className="md:col-span-3 flex gap-2"><button disabled={saving} className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold disabled:opacity-50">{saving ? "Saving..." : editingId ? "Update Provider" : "Add Provider"}</button>{editingId && <button type="button" onClick={reset} className="rounded-lg border border-slate-700 px-5 py-3 text-sm">Cancel</button>}</div>
    </form>
    <section className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden"><div className="p-5 border-b border-slate-800 flex items-center gap-2"><FaMoneyBillWave className="text-emerald-400" /><h2 className="font-semibold">Providers available to all schools</h2></div>
      {loading ? <p className="p-5 text-sm text-slate-400">Loading...</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-950 text-slate-400"><tr><th className="p-3 text-left">Provider</th><th className="p-3 text-left">Type</th><th className="p-3 text-left">Status</th><th className="p-3 text-right">Actions</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t border-slate-800"><td className="p-3 font-medium">{row.provider_name}</td><td className="p-3">{row.provider_type === "mobile_money" ? "Mobile Money" : row.provider_type}</td><td className="p-3"><span className={row.is_active ? "text-emerald-400" : "text-slate-500"}>{row.is_active ? "Active" : "Inactive"}</span></td><td className="p-3 text-right whitespace-nowrap"><button type="button" onClick={() => {setEditingId(row.id);setForm({providerName:row.provider_name,providerType:row.provider_type,sortOrder:String(row.sort_order)});}} className="text-blue-300 mr-4"><FaEdit className="inline mr-1" />Edit</button><button type="button" onClick={() => toggle(row)} className="text-amber-300">{row.is_active ? "Deactivate" : "Activate"}</button></td></tr>)}</tbody></table></div>}
    </section>
  </div></div>;
}
