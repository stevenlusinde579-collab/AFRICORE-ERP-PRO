import { useMemo, useRef, useState } from "react";
import { supabase } from "../../services/supabase";

const apiBase = () => new URL(import.meta.env.VITE_API_URL || "https://africore-erp-pro.onrender.com").origin;
const cleanName = (value) => String(value || "staff").replace(/[^a-zA-Z0-9_-]/g, "_");

export default function StaffSignaturePdfImport({ schoolId, staff, signatures, onSaved }) {
  const [file, setFile] = useState(null);
  const [pages, setPages] = useState([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [rect, setRect] = useState(null);
  const [dragStart, setDragStart] = useState(null);
  const [batch, setBatch] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [recognizedText, setRecognizedText] = useState("");
  const [fileType, setFileType] = useState("pdf");
  const [error, setError] = useState("");
  const imageRef = useRef(null);
  const page = pages[pageIndex];
  const person = useMemo(() => staff.find((row) => String(row.id) === String(selectedId)), [staff, selectedId]);
  const fullName = (row) => [row?.first_name, row?.middle_name, row?.last_name].filter(Boolean).join(" ") || row?.employee_number || "Staff";
  const existing = signatures.find((row) => row.teacher_id === person?.id && row.is_active);

  const previewPdf = async (nextFile) => {
    setError(""); setNotice(""); setPages([]); setBatch(null); setRect(null);
    if (!nextFile) return;
    const isPdf = nextFile.type === "application/pdf" && /\.pdf$/i.test(nextFile.name);
    const isImage = ["image/png", "image/jpeg"].includes(nextFile.type) && /\.(png|jpe?g)$/i.test(nextFile.name);
    if (!isPdf && !isImage) { setError("Chagua PDF, PNG au JPG/JPEG."); return; }
    if (nextFile.size > 15 * 1024 * 1024) {
      setError("Faili isizidi 15 MB."); return;
    }
    setBusy(true);
    try {
      const { data: session, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = session?.session?.access_token;
      if (!token) throw new Error("Session imeisha. Ingia tena kwenye mfumo.");
      const body = new FormData(); body.append("file", nextFile);
      const response = await fetch(`${apiBase()}/api/hr/signature-register/preview`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "PDF haikuweza kusomwa.");
      setFile(nextFile); setPages(result.pages || []); setPageIndex(0);
      setFileType(result.fileType || (isPdf ? "pdf" : "image"));
      setRecognizedText(result.recognizedText || "");
      setSelectedId((current) => current || String(staff[0]?.id || ""));
      setNotice(`${isPdf ? "PDF" : "Picha"} imefunguliwa: kurasa ${result.pageCount}. OCR imesoma maandishi ya hati.`);
    } catch (previewError) { setError(previewError.message || "Imeshindikana kusoma PDF."); }
    finally { setBusy(false); }
  };

  const getPoint = (event) => {
    const bounds = imageRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))
    };
  };
  const beginCrop = (event) => {
    if (!person || busy) return;
    const point = getPoint(event); if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragStart(point); setRect({ x: point.x, y: point.y, w: 0, h: 0 });
  };
  const moveCrop = (event) => {
    if (!dragStart) return;
    const point = getPoint(event); if (!point) return;
    setRect({ x: Math.min(dragStart.x, point.x), y: Math.min(dragStart.y, point.y), w: Math.abs(point.x - dragStart.x), h: Math.abs(point.y - dragStart.y) });
  };
  const finishCrop = (event) => {
    if (!dragStart) return;
    moveCrop(event); setDragStart(null);
  };

  const saveCrop = async () => {
    if (!file || !page || !person || !rect || rect.w < 0.008 || rect.h < 0.008) {
      setError("Chagua mfanyakazi na chora eneo la saini yake kwenye ukurasa."); return;
    }
    setBusy(true); setError(""); setNotice("");
    let uploadedPath = null; let insertedId = null; let previous = null;
    try {
      const image = new Image(); image.src = page.dataUrl;
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
      const sx = Math.round(rect.x * image.naturalWidth);
      const sy = Math.round(rect.y * image.naturalHeight);
      const sw = Math.max(1, Math.round(rect.w * image.naturalWidth));
      const sh = Math.max(1, Math.round(rect.h * image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = sw; canvas.height = sh;
      canvas.getContext("2d").drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Imeshindikana kuandaa picha ya saini.");
      const signatureFile = new File([blob], `signature-${cleanName(person.user_id)}.png`, { type: "image/png" });
      const batchId = batch?.id || crypto.randomUUID();
      if (!batch && fileType === "pdf") {
        const path = `${schoolId}/signature-registers/${batchId}-${Date.now()}-${cleanName(file.name)}`;
        const { error: uploadPdfError } = await supabase.storage.from("school-signing-documents").upload(path, file, { contentType: "application/pdf", upsert: false });
        if (uploadPdfError) throw uploadPdfError;
        const { data: authData } = await supabase.auth.getUser();
        const { data: insertedBatch, error: batchError } = await supabase.from("hr_signature_register_batches").insert({
          id: batchId, school_id: schoolId, original_pdf_path: path, original_file_name: file.name,
          page_count: pages.length, staff_count: staff.length, uploaded_by: authData.user?.id || null
        }).select("id,original_pdf_path").single();
        if (batchError) { await supabase.storage.from("school-signing-documents").remove([path]); throw batchError; }
        setBatch(insertedBatch);
      }
      const path = `${schoolId}/${person.id}/signature-${Date.now()}-${cleanName(person.user_id)}.png`;
      uploadedPath = path;
      const { error: uploadError } = await supabase.storage.from("hr-staff-signatures").upload(path, signatureFile, { contentType: "image/png", upsert: false });
      if (uploadError) throw uploadError;
      previous = signatures.find((row) => row.teacher_id === person.id && row.is_active) || null;
      const { data: authData } = await supabase.auth.getUser();
      const { data: inserted, error: insertError } = await supabase.from("hr_staff_signatures").insert({
        school_id: schoolId, teacher_id: person.id, profile_id: person.user_id,
        storage_path: path, source_batch_id: fileType === "pdf" ? batchId : null, is_active: false, registered_by: authData.user?.id || null
      }).select("id").single();
      if (insertError) throw insertError;
      insertedId = inserted.id;
      if (previous?.id) {
        const { error: deactivateError } = await supabase.from("hr_staff_signatures").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", previous.id).eq("school_id", schoolId).eq("is_active", true);
        if (deactivateError) throw deactivateError;
      }
      const { error: activateError } = await supabase.from("hr_staff_signatures").update({ is_active: true, updated_at: new Date().toISOString() }).eq("id", insertedId).eq("school_id", schoolId);
      if (activateError) throw activateError;
      setNotice(`Saini ya ${fullName(person)} (User ID: ${person.user_id}) imesajiliwa. Unaweza kuchagua mfanyakazi anayefuata.`);
      setRect(null);
      await onSaved?.();
    } catch (saveError) {
      if (insertedId) {
        if (previous?.id) await supabase.from("hr_staff_signatures").update({ is_active: true, updated_at: new Date().toISOString() }).eq("id", previous.id).eq("school_id", schoolId);
        await supabase.from("hr_staff_signatures").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", insertedId).eq("school_id", schoolId);
      }
      if (uploadedPath) await supabase.storage.from("hr-staff-signatures").remove([uploadedPath]);
      setError(saveError.message || "Imeshindikana kuhifadhi saini.");
    } finally { setBusy(false); }
  };

  const savedIds = new Set(signatures.filter((row) => row.is_active).map((row) => row.teacher_id));
  return <section className="space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
    <div><h3 className="font-bold text-slate-900">Import Signed Staff Register (One PDF)</h3><p className="mt-1 text-sm text-slate-600">Pakia PDF au picha iliyosainiwa. OCR itasoma maandishi yaliyochapishwa/yanayoonekana ili kusaidia kuthibitisha majina; kisha chagua mfanyakazi na kata eneo la saini pekee. Karatasi nzima haitahifadhiwa kama saini.</p></div>
    <label className="inline-flex cursor-pointer items-center rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white">{busy ? "Processing..." : "Choose signed PDF"}<input className="sr-only" type="file" accept="application/pdf,.pdf" disabled={busy} onChange={(event) => { previewPdf(event.target.files?.[0]); event.target.value = ""; }} /></label>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{notice}</p>}
    {recognizedText && <details className="rounded-lg border border-slate-200 bg-white p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-700">Maandishi yaliyosomwa na OCR</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-slate-600">{recognizedText}</pre></details>}\n    {pages.length > 0 && <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2"><button type="button" className="rounded border px-3 py-1.5 text-sm" disabled={pageIndex===0} onClick={()=>{setPageIndex(v=>v-1);setRect(null);}}>Previous page</button><span className="text-sm font-semibold">Page {pageIndex+1} / {pages.length}</span><button type="button" className="rounded border px-3 py-1.5 text-sm" disabled={pageIndex===pages.length-1} onClick={()=>{setPageIndex(v=>v+1);setRect(null);}}>Next page</button><button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={()=>setRect(null)}>Clear crop</button></div>
        <div className="overflow-auto rounded-lg border bg-slate-200 p-2">
          <div className="relative inline-block max-w-full select-none" onPointerDown={beginCrop} onPointerMove={moveCrop} onPointerUp={finishCrop} onPointerCancel={()=>setDragStart(null)}>
            <img ref={imageRef} src={page.dataUrl} alt={`Signed register page ${page.page}`} draggable="false" className="block max-h-[70vh] max-w-full pointer-events-none" />
            {rect && <div className="pointer-events-none absolute border-2 border-red-600 bg-red-300/20" style={{left:`${rect.x*100}%`,top:`${rect.y*100}%`,width:`${rect.w*100}%`,height:`${rect.h*100}%`}} />}
          </div>
        </div>
        <p className="text-xs text-slate-500">Bonyeza na vuta mouse kuzungushia saini pekee; usijumuishe jina au saini ya mtu mwingine.</p>
      </div>
      <div className="space-y-3 rounded-lg border bg-white p-3">
        <label className="block text-sm font-semibold text-slate-700">Staff member</label>
        <select className="w-full rounded-lg border p-2 text-sm" value={selectedId} onChange={(event)=>{setSelectedId(event.target.value);setRect(null);}}>
          {staff.map((row)=><option key={row.id} value={row.id}>{fullName(row)} • ID {row.user_id?.slice(0,8)}</option>)}
        </select>
        {person && <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600"><p className="font-bold text-slate-900">{fullName(person)}</p><p>User ID: {person.user_id}</p><p>Employee No: {person.employee_number || "—"}</p><p>Current signature: {existing ? "Registered (will be versioned)" : "Not registered"}</p></div>}
        <button type="button" onClick={saveCrop} disabled={busy || !rect || !person} className="w-full rounded-lg bg-emerald-700 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? "Saving..." : existing ? "Save / Replace signature" : "Save this person's signature"}</button>
        <div className="border-t pt-3"><p className="mb-2 text-xs font-bold text-slate-700">Registration progress</p><p className="text-sm">{savedIds.size} / {staff.length} staff with active signatures</p><div className="mt-2 max-h-44 space-y-1 overflow-auto">{staff.map((row)=><div key={row.id} className="flex justify-between gap-2 text-xs"><span className="truncate">{fullName(row)}</span><span className={savedIds.has(row.id)?"text-emerald-700":"text-amber-700"}>{savedIds.has(row.id)?"Saved":"Pending"}</span></div>)}</div></div>
      </div>
    </div>}
    {batch && <p className="text-xs text-slate-500">Original PDF imetunzwa kama kumbukumbu ya batch {batch.id}. Saini ulizohifadhi zimeunganishwa na batch hiyo.</p>}
  </section>;
}
