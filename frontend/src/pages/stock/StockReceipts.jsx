import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../services/supabase";
import api from "../../services/api";
import SchoolOfficialSeal from "../../components/SchoolOfficialSeal";
import StaffSignatureImage from "../../components/StaffSignatureImage";
const money = (n) => new Intl.NumberFormat("en-TZ", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(n) || 0);
const dateText = (v) => { if (!v) return "—"; const d=new Date(v); return Number.isNaN(d.getTime())?"—":d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}); };
const fullName = (s) => [s?.first_name,s?.middle_name,s?.last_name].filter(Boolean).join(" ") || "—";
const addressText = (s) => [s?.address,s?.school_address,s?.postal_address,s?.location].filter(Boolean).join(" · ");

export default function StockReceipts({ schoolId }) {
  const [receipts,setReceipts]=useState([]),[documents,setDocuments]=useState([]),[students,setStudents]=useState([]),[school,setSchool]=useState(null);
  const [selected,setSelected]=useState([]),[loading,setLoading]=useState(true),[publishing,setPublishing]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
  const [expanded,setExpanded]=useState(false),[headerColor,setHeaderColor]=useState("#e0f2fe"),[viewing,setViewing]=useState(null);
  const load=useCallback(async()=>{
    if(!schoolId){setReceipts([]);setDocuments([]);setStudents([]);setSchool(null);setError("Chagua shule yenye ruhusa ya kuona risiti za stock.");setLoading(false);return;}
    setLoading(true);setError("");
    try{
      const [rr,dr,sr,sch]=await Promise.all([
        supabase.schema("finance").from("receipts").select("id,school_id,receipt_number,receipt_date,student_id,payer_name,amount,payment_method,reference_number,description,status,issued_by").eq("school_id",schoolId).like("receipt_number","STOCK-%").order("receipt_date",{ascending:false}).limit(1000),
        supabase.from("parent_portal_documents").select("id,document_number,source_id,publication_status,published_at,payload").eq("school_id",schoolId).eq("document_type","receipt").eq("source_type","stock_payment"),
        supabase.from("students").select("id,first_name,middle_name,last_name,admission_number,admission_no,parent_name,guardian_name").eq("school_id",schoolId),
        supabase.from("schools").select("*").eq("id",schoolId).maybeSingle()
      ]);
      if(rr.error)throw rr.error;setReceipts(rr.data||[]);
      if(dr.error)console.warn("Stock receipt portal lookup failed:",dr.error);if(sr.error)console.warn("Stock receipt student lookup failed:",sr.error);if(sch.error)console.warn("School receipt header lookup failed:",sch.error);
      setDocuments(dr.data||[]);setStudents(sr.data||[]);setSchool(sch.data||null);
      const ids=new Set((rr.data||[]).map(x=>String(x.id)));setSelected(cur=>cur.filter(id=>ids.has(id)));
    }catch(e){setError(e.message||"Unable to load stock receipts.");}finally{setLoading(false);}
  },[schoolId]);
  useEffect(()=>{load();},[load]);
  const studentFor=r=>students.find(s=>String(s.id)===String(r.student_id));
  const documentFor=r=>documents.find(d=>d.document_number===r.receipt_number);
  const selectedReceipts=receipts.filter(r=>selected.includes(String(r.id)));
  const publish=async()=>{
    setPublishing(true);setMessage("");setError("");
    try{
      const receiptIds=selectedReceipts.map(r=>r.id);
      if(!receiptIds.length){setMessage("Chagua angalau risiti moja ya stock.");return;}
      const result=await api.post("/parent-portal/staff/documents/publish",{receipt_ids:receiptIds,receipt_header_color:headerColor});
      setMessage(result.data?.message||"Risiti zimechapishwa Parent Portal.");await load();
    }catch(e){setError(e?.response?.data?.message||e.message||"Imeshindikana kuchapisha risiti.");}finally{setPublishing(false);}
  };
  const renderReceipt=(r)=>{
    const st=studentFor(r),doc=documentFor(r),p=doc?.payload&&typeof doc.payload==="object"?doc.payload:{},items=Array.isArray(p.items)?p.items:[];
    return <article key={r.id} className="border border-slate-300 text-slate-900">
      <header className="px-8 py-6 text-center" style={{backgroundColor:p.receipt_header_color||headerColor,printColorAdjust:"exact",WebkitPrintColorAdjust:"exact"}}>
        <h2 className="text-2xl font-black uppercase">{p.school_name||school?.school_name||"School"}</h2><p className="mt-1 text-sm font-semibold">{p.school_address||addressText(school)}</p><p className="mt-3 text-lg font-extrabold tracking-widest">OFFICIAL SCHOOL RECEIPT</p>
      </header>
      <div className="p-8">
        <div className="mb-5 grid grid-cols-2 gap-x-8 gap-y-3 border-b pb-5 text-sm">
          <p><b>Receipt Number:</b> {r.receipt_number}</p><p><b>Receipt Date:</b> {dateText(r.receipt_date)}</p>
          <p><b>Parent / Payer:</b> {r.payer_name||p.parent_name||"Not recorded"}</p><p><b>Student Name:</b> {fullName(st)==="—"?(p.student_name||"Not linked"):fullName(st)}</p>
          <p><b>Admission Number:</b> {st?.admission_number||st?.admission_no||p.admission_number||"—"}</p><p><b>Parent / Guardian:</b> {st?.parent_name||st?.guardian_name||p.parent_name||r.payer_name||"—"}</p>
          <p><b>Payment Method:</b> {r.payment_method||p.payment_method||"Not specified"}</p><p><b>Payment Reference:</b> {r.reference_number||p.reference_number||"—"}</p>
          <p><b>Payment Status:</b> {r.status||"Posted"}</p><p><b>Order Number:</b> {p.order_number||p.order_reference||"—"}</p>
        </div>
        <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wide">Items / payment details</h3>
        {items.length?<table className="w-full border-collapse text-sm"><thead><tr className="bg-slate-100"><th className="border p-3 text-left">Description</th><th className="border p-3 text-right">Quantity</th><th className="border p-3 text-right">Unit price (TZS)</th><th className="border p-3 text-right">Amount (TZS)</th></tr></thead><tbody>{items.map((it,i)=><tr key={i}><td className="border p-3">{it.item_name||it.name||it.description||"Stock item"} {it.variant_label||""}</td><td className="border p-3 text-right">{it.quantity??"—"}</td><td className="border p-3 text-right">{money(it.unit_price)}</td><td className="border p-3 text-right">{money(it.line_total??it.total??Number(it.quantity||0)*Number(it.unit_price||0))}</td></tr>)}</tbody></table>:<table className="w-full border-collapse text-sm"><thead><tr className="bg-slate-100"><th className="border p-3 text-left">Description</th><th className="border p-3 text-right">Amount (TZS)</th></tr></thead><tbody><tr><td className="border p-3">{r.description||p.description||"Uniform / school stock payment"}</td><td className="border p-3 text-right font-bold">{money(r.amount)}</td></tr></tbody></table>}
        <div className="mt-6 rounded-lg border border-slate-300 p-4"><p className="text-xs font-bold uppercase text-slate-600">Total amount received</p><p className="mt-1 text-2xl font-black">{money(r.amount)} TZS</p><p className="mt-2 text-xs text-slate-600">Malipo haya yamerekodiwa kwenye kumbukumbu za fedha za shule.</p></div>
        <div className="mt-14 grid grid-cols-2 gap-12 text-center text-xs"><div><div className="mx-auto w-full max-w-56"><StaffSignatureImage schoolId={schoolId} profileId={r.issued_by} className="items-center" alt="Cashier signature" /></div><p className="mt-2">Sahihi ya Mhasibu / Mpokeaji</p></div><div><div className="mx-auto h-14 w-full max-w-56 border-b border-slate-500" aria-hidden="true" /><p className="mt-2">Sahihi ya Mzazi / Mlipaji</p></div></div>
        <SchoolOfficialSeal className="mt-5" seal={p.seal} />
        <p className="mt-8 border-t pt-3 text-center text-xs text-slate-500">Asante kwa kufanya malipo. Kwa ufafanuzi, wasiliana na ofisi ya shule.</p>
      </div>
    </article>;
  };
  if(loading)return <div className="rounded-xl border bg-white p-6 text-sm text-slate-500">Loading stock receipts…</div>;
  return <section className="space-y-4">
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <button type="button" aria-expanded={expanded} aria-controls="stock-receipts-panel" onClick={()=>setExpanded(v=>!v)} className="flex w-full items-center justify-between gap-3 text-left">
        <span><span className="block text-lg font-extrabold text-slate-900">Stock Sales Receipts <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs">{receipts.length}</span></span><span className="block text-sm text-slate-500">Risiti za malipo ya sare na bidhaa za wanafunzi yaliyoidhinishwa na Finance.</span></span><span className="text-xl font-bold text-slate-500">{expanded?"−":"+"}</span>
      </button>
      {expanded&&<div id="stock-receipts-panel" className="mt-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">Rangi ya kivuli cha kichwa cha risiti <input aria-label="Receipt header shade" type="color" value={headerColor} onChange={e=>setHeaderColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded border border-slate-300 bg-white p-1"/></label>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!selectedReceipts.length} onClick={()=>window.print()} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold disabled:opacity-40">Print selected ({selectedReceipts.length})</button>
            <button type="button" disabled={publishing||selectedReceipts.length===0} onClick={publish} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{publishing?"Publishing…":"Publish selected to Parent Portal"}</button>
            <button type="button" onClick={load} className="rounded-xl border px-4 py-2 text-sm font-semibold">Refresh</button>
          </div>
        </div>
        {error&&<p className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}{message&&<p className="mb-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{message}</p>}
        <div className="space-y-2">{receipts.map(r=>{const d=documentFor(r),st=studentFor(r),status=d?.publication_status||"not_linked";return <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-sm">
          <div className="flex min-w-0 flex-1 items-center gap-3"><input aria-label={`Select receipt ${r.receipt_number}`} type="checkbox" checked={selected.includes(String(r.id))} onChange={e=>setSelected(cur=>e.target.checked?[...cur,String(r.id)]:cur.filter(id=>id!==String(r.id)))}/><div className="min-w-0"><b className="block">{r.receipt_number}</b><span className="block text-xs text-slate-500">{r.payer_name||"Parent/Guardian"} · {fullName(st)} · {dateText(r.receipt_date)}</span><span className={`mt-1 block text-xs font-semibold ${status==="published"?"text-emerald-700":status==="pending"?"text-amber-700":"text-slate-500"}`}>{status==="published"?"Published to Parent Portal":status==="pending"?"Not published yet":status==="published"?"Published to Parent Portal":"Ready to publish to Parent Portal"}</span></div></div>
          <b className="whitespace-nowrap">{money(r.amount)} TZS</b><button type="button" onClick={()=>setViewing(r)} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50">View</button>
        </div>;})}{!receipts.length&&<p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Hakuna risiti za mauzo ya stock zilizopostiwa bado. Risiti hutengenezwa baada ya Headmaster kuidhinisha malipo Finance.</p>}</div>
      </div>}
    </div>
    <div className="stock-receipt-print hidden">{selectedReceipts.map(r=><div className="mb-8 break-after-page" key={r.id}>{renderReceipt(r)}</div>)}</div>
    {viewing&&<div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="Stock receipt preview"><div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
      <div className="sticky top-0 flex items-center justify-between border-b bg-white p-4"><h2 className="font-extrabold">Receipt preview · {viewing.receipt_number}</h2><button type="button" onClick={()=>setViewing(null)} className="rounded-lg border px-3 py-1.5 text-sm font-bold">Close</button></div>
      <div className="m-5">{renderReceipt(viewing)}</div><div className="flex justify-end gap-2 border-t p-4"><button type="button" onClick={()=>{setSelected(cur=>cur.includes(String(viewing.id))?cur:[...cur,String(viewing.id)]);window.setTimeout(()=>window.print(),100);}} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">Print this receipt</button><button type="button" onClick={()=>setViewing(null)} className="rounded-xl border px-4 py-2 text-sm font-bold">Done</button></div>
    </div></div>}
    <style>{'@media print { @page { size:A4; margin:12mm; } body * { visibility:hidden !important; } body .stock-receipt-print, body .stock-receipt-print * { visibility:visible !important; } body .stock-receipt-print { display:block !important; position:absolute; left:0; top:0; width:100%; padding:0; background:white; } .stock-receipt-print article { page-break-after:always; } }'}</style>
  </section>;
}
