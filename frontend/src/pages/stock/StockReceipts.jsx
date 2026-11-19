import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../services/supabase";
import api from "../../services/api";

const money = (n) => new Intl.NumberFormat("en-TZ", { style: "currency", currency: "TZS", maximumFractionDigits: 0 }).format(Number(n) || 0);

export default function StockReceipts({ schoolId }) {
  const [receipts, setReceipts] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true); setError("");
    try {
      // Load official receipts first. Optional Parent Portal and student lookups must
      // never prevent existing receipts from appearing or being printed.
      const receiptResult = await supabase.schema("finance").from("receipts")
        .select("id,school_id,receipt_number,receipt_date,student_id,payer_name,amount,payment_method,reference_number,description,status")
        .eq("school_id", schoolId).like("receipt_number", "STOCK-%")
        .order("receipt_date", { ascending: false }).limit(1000);
      if (receiptResult.error) throw receiptResult.error;
      setReceipts(receiptResult.data || []);

      const [documentResult, studentResult] = await Promise.all([
        supabase.from("parent_portal_documents").select("id,document_number,source_id,publication_status,published_at")
          .eq("school_id", schoolId).eq("document_type", "receipt").eq("source_type", "stock_payment"),
        supabase.from("students").select("id,first_name,middle_name,last_name,admission_number,admission_no").eq("school_id", schoolId)
      ]);
      if (documentResult.error) console.warn("Stock receipt Parent Portal status lookup failed:", documentResult.error);
      if (studentResult.error) console.warn("Stock receipt student details lookup failed:", studentResult.error);
      setDocuments(documentResult.data || []);
      setStudents(studentResult.data || []);
    } catch (e) { setError(e.message || "Unable to load stock receipts."); }
    finally { setLoading(false); }
  }, [schoolId]);

  useEffect(() => { load(); }, [load]);

  const publish = async () => {
    setPublishing(true); setMessage(""); setError("");
    try {
      const ids = receipts.filter(r => selected.includes(String(r.id)))
        .map(r => documents.find(d => d.document_number === r.receipt_number && d.publication_status !== "published")?.id)
        .filter(Boolean);
      if (!ids.length) { setMessage("Hakuna risiti zilizopo tayari kuchapishwa. Hakikisha mzazi ana akaunti hai ya Parent Portal."); return; }
      const result = await api.post("/parent-portal/staff/documents/publish", { document_ids: ids });
      setMessage(result.data?.message || "Risiti zimechapishwa Parent Portal.");
      await load();
    } catch (e) { setError(e?.response?.data?.message || e.message || "Imeshindikana kuchapisha risiti."); }
    finally { setPublishing(false); }
  };

  if (loading) return <div className="rounded-xl border bg-white p-6 text-sm text-slate-500">Loading stock receipts…</div>;

  return <section className="space-y-4">
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-extrabold text-slate-900">Stock Sales Receipts</h2><p className="text-sm text-slate-500">Risiti za malipo ya sare na bidhaa za wanafunzi yaliyoidhinishwa na Finance.</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!receipts.some(r => selected.includes(String(r.id)))} onClick={() => window.print()} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold disabled:opacity-40">Print selected ({receipts.filter(r => selected.includes(String(r.id))).length})</button>
          <button type="button" disabled={publishing || !receipts.some(r => selected.includes(String(r.id)) && documents.some(d => d.document_number === r.receipt_number && d.publication_status !== "published"))} onClick={publish} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{publishing ? "Publishing…" : "Publish selected to Parent Portal"}</button>
          <button type="button" onClick={load} className="rounded-xl border px-4 py-2 text-sm font-semibold">Refresh</button>
        </div>
      </div>
      {error && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {message && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{message}</p>}
      <div className="mt-4 space-y-2">
        {receipts.map(r => {
          const doc = documents.find(d => d.document_number === r.receipt_number);
          const status = doc?.publication_status || "not_linked";
          return <label key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-3 text-sm">
            <span className="flex items-center gap-3"><input type="checkbox" checked={selected.includes(String(r.id))} onChange={e => setSelected(current => e.target.checked ? [...current, String(r.id)] : current.filter(id => id !== String(r.id)))} />
              <span><b className="block">{r.receipt_number}</b><span className="text-xs text-slate-500">{r.payer_name || "Parent/Guardian"} · {r.receipt_date} · {r.payment_method}</span><span className={`mt-1 block text-xs font-semibold ${status === "published" ? "text-emerald-700" : status === "pending" ? "text-amber-700" : "text-slate-500"}`}>{status === "published" ? "Published to Parent Portal" : status === "pending" ? "Not published yet" : "Parent Portal account/document unavailable"}</span></span>
            </span><b>{money(r.amount)}</b>
          </label>;
        })}
        {!receipts.length && <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Hakuna risiti za mauzo ya stock zilizopostiwa bado. Risiti hutengenezwa baada ya Headmaster kuidhinisha malipo Finance.</p>}
      </div>
    </div>
    <div className="stock-receipt-print hidden">{receipts.filter(r => selected.includes(String(r.id))).map(r => {
      const student = students.find(s => String(s.id) === String(r.student_id));
      return <article key={r.id} className="mb-10 border p-8 text-slate-900">
        <header className="border-b-2 pb-4 text-center"><h2 className="text-xl font-black">STOCK PAYMENT RECEIPT</h2><p>{r.receipt_number}</p></header>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm"><p><b>Parent:</b> {r.payer_name || "Parent/Guardian"}</p><p><b>Student:</b> {[student?.first_name, student?.middle_name, student?.last_name].filter(Boolean).join(" ") || "—"}</p><p><b>Admission:</b> {student?.admission_number || student?.admission_no || "—"}</p><p><b>Date:</b> {r.receipt_date}</p><p><b>Method:</b> {r.payment_method}</p><p><b>Reference:</b> {r.reference_number || "—"}</p></div>
        <p className="mt-6 text-right text-lg font-black">AMOUNT RECEIVED: {money(r.amount)}</p><p className="mt-4 text-sm">{r.description || "Stock / uniform order payment"}</p><p className="mt-12 text-center text-xs">AfriCore ERP PRO</p>
      </article>;
    })}</div>
    <style>{'@media print { body * { visibility:hidden !important; } body .stock-receipt-print, body .stock-receipt-print * { visibility:visible !important; } body .stock-receipt-print { display:block !important; position:absolute; inset:0; padding:18mm; background:white; } .stock-receipt-print article { break-after:page; page-break-after:always; } }'}</style>
  </section>;
}
