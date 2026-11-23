import { useCallback, useEffect, useMemo, useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { FaFileSignature, FaFilePdf, FaSyncAlt, FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import { supabase } from "../../services/supabase";
import { useSchool } from "../../context/SchoolContext";
import { useRole } from "../../context/RoleContext";

function SecretaryDocumentSigning() {
  const { schoolId } = useSchool();
  const { selectedRoleName = "", isSuperAdmin = false } = useRole();
  const canManageRequests = isSuperAdmin || String(selectedRoleName).trim().toLowerCase() === "secretary";
  const [userId, setUserId] = useState(null);
  const [staff, setStaff] = useState([]);
  const [signatures, setSignatures] = useState([]);
  const [primarySignatories, setPrimarySignatories] = useState([]);
  const [requests, setRequests] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [documentFile, setDocumentFile] = useState(null);
  const [selectedSigners, setSelectedSigners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!schoolId) { setLoading(false); setError("Akaunti hii haijaunganishwa na shule."); return; }
    setLoading(true); setError("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      setUserId(auth.user?.id || null);
      const [staffResult, signatureResult, requestResult, primaryResult] = await Promise.all([
        supabase.from("teachers").select("id,user_id,employee_number,first_name,middle_name,last_name").eq("school_id", schoolId).not("user_id", "is", null).order("first_name"),
        supabase.from("hr_staff_signatures").select("id,teacher_id,profile_id,is_active").eq("school_id", schoolId),
        supabase.from("document_signing_requests").select("id,title,description,document_path,status,created_at,created_by,document_signing_recipients(id,teacher_id,profile_id,status,signed_at,teachers(first_name,middle_name,last_name,employee_number))").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
        supabase.from("hr_primary_signatories").select("id,role_id,profile_id,teacher_id,roles(role_name)").eq("school_id", schoolId),
      ]);
      if (staffResult.error) throw staffResult.error;
      if (signatureResult.error) throw signatureResult.error;
      if (requestResult.error) throw requestResult.error;
      if (primaryResult.error) throw primaryResult.error;
      setStaff(staffResult.data || []);
      setSignatures(signatureResult.data || []);
      setRequests(requestResult.data || []);
      setPrimarySignatories(primaryResult.data || []);
    } catch (loadError) {
      setError(loadError.message || "Imeshindikana kupakia taarifa za kusaini nyaraka.");
    } finally { setLoading(false); }
  }, [schoolId]);

  useEffect(() => { load(); }, [load]);

  const myTasks = useMemo(() => requests.flatMap((request) =>
    (request.document_signing_recipients || [])
      .filter((recipient) => recipient.profile_id === userId)
      .map((recipient) => ({ ...recipient, request }))
  ), [requests, userId]);

  const createRequest = async (event) => {
    event.preventDefault();
    if (!schoolId || !title.trim() || !documentFile || selectedSigners.length === 0) {
      setError("Weka jina la nyaraka, PDF na chagua angalau msaini mmoja."); return;
    }
    if (documentFile.type !== "application/pdf" || documentFile.size > 15 * 1024 * 1024) {
      setError("Nyaraka lazima iwe PDF isiyozidi 15 MB."); return;
    }
    setSaving(true); setError(""); setNotice("");
    let uploadedPath = null;
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user?.id) throw new Error("Tafadhali ingia tena kwenye mfumo.");
      uploadedPath = `${schoolId}/${Date.now()}-${documentFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage.from("school-signing-documents").upload(uploadedPath, documentFile, { contentType: "application/pdf", upsert: false });
      if (uploadError) throw uploadError;
      const { data: request, error: requestError } = await supabase.from("document_signing_requests").insert({
        school_id: schoolId, title: title.trim(), description: description.trim() || null,
        document_path: uploadedPath, status: "pending", created_by: auth.user.id,
      }).select("id").single();
      if (requestError) throw requestError;
      const recipients = staff.filter((person) => selectedSigners.includes(person.id) && person.user_id).map((person) => ({
        request_id: request.id, school_id: schoolId, teacher_id: person.id, profile_id: person.user_id,
      }));
      const { error: recipientError } = await supabase.from("document_signing_recipients").insert(recipients);
      if (recipientError) throw recipientError;
      setTitle(""); setDescription(""); setDocumentFile(null); setSelectedSigners([]);
      setNotice("Ombi la kusaini nyaraka limetumwa kwa wahusika.");
      await load();
    } catch (createError) {
      if (uploadedPath) await supabase.storage.from("school-signing-documents").remove([uploadedPath]);
      setError(createError.message || "Imeshindikana kutuma nyaraka kwa wasaini.");
    } finally { setSaving(false); }
  };

  const respondToTask = async (recipient, decision) => {
    setActionId(recipient.id); setError(""); setNotice("");
    try {
      const signature = signatures.find((row) => row.profile_id === userId && row.teacher_id === recipient.teacher_id);
      if (decision === "signed" && !signature) throw new Error("HR bado hajasajili saini yako. Tafadhali wasiliana na HR.");
      const { error: updateError } = await supabase.from("document_signing_recipients").update({
        status: decision, signed_at: decision === "signed" ? new Date().toISOString() : null,
        signature_id: decision === "signed" ? signature.id : null,
      }).eq("id", recipient.id).eq("profile_id", userId).eq("status", "pending");
      if (updateError) throw updateError;
      setNotice(decision === "signed" ? "Umesajili uthibitisho wa kusaini nyaraka." : "Umeikataa nyaraka hii.");
      await load();
    } catch (responseError) { setError(responseError.message || "Imeshindikana kuhifadhi jibu lako."); }
    finally { setActionId(null); }
  };

  const openDocument = async (path) => {
    const { data, error: urlError } = await supabase.storage.from("school-signing-documents").createSignedUrl(path, 60);
    if (urlError) { setError(urlError.message); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const downloadSignedPdf = async (request) => {
    setActionId(`pdf-${request.id}`); setError(""); setNotice("");
    try {
      const recipients = request.document_signing_recipients || [];
      if (!recipients.length || recipients.some((row) => row.status !== "signed" || !row.signature_id)) {
        throw new Error("PDF ya mwisho itapatikana baada ya kila msaini kukamilisha saini yake.");
      }
      const { data: sourceFile, error: sourceError } = await supabase.storage.from("school-signing-documents").download(request.document_path);
      if (sourceError) throw sourceError;
      const pdf = await PDFDocument.load(await sourceFile.arrayBuffer());
      let page = pdf.addPage([595.28, 841.89]);
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      page.drawText("AFRICORE — SIGNATURE RECORD", { x: 42, y: 790, size: 15, font: bold, color: rgb(0.08, 0.16, 0.3) });
      page.drawText(request.title || "Signed document", { x: 42, y: 766, size: 11, font: bold });
      page.drawText(`School document reference: ${request.id}`, { x: 42, y: 748, size: 8, font, color: rgb(0.35, 0.35, 0.35) });
      let y = 700;
      for (const recipient of recipients) {
        const signature = signatures.find((row) => row.id === recipient.signature_id && row.teacher_id === recipient.teacher_id && row.profile_id === recipient.profile_id);
        if (!signature) throw new Error("Picha ya saini ya mmoja wa wasaini haipatikani. Wasiliana na HR.");
        const { data: imageFile, error: imageError } = await supabase.storage.from("hr-staff-signatures").download(signature.storage_path);
        if (imageError) throw imageError;
        const bytes = await imageFile.arrayBuffer();
        const image = imageFile.type === "image/png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
        const scale = Math.min(150 / image.width, 48 / image.height);
        const person = recipient.teachers || {};
        const name = [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(" ") || person.employee_number || "Staff";
        page.drawText(name, { x: 42, y, size: 10, font: bold });
        page.drawImage(image, { x: 330, y: y - 8, width: image.width * scale, height: image.height * scale });
        page.drawText(`Signed electronically: ${new Date(recipient.signed_at).toLocaleString("en-GB")}`, { x: 42, y: y - 16, size: 8, font, color: rgb(0.25, 0.25, 0.25) });
        page.drawLine({ start: { x: 42, y: y - 24 }, end: { x: 550, y: y - 24 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
        y -= 95;
        if (y < 85 && recipient !== recipients[recipients.length - 1]) {
          page.drawText("Additional signatories continued on next page.", { x: 42, y: 40, size: 8, font });
          page = pdf.addPage([595.28, 841.89]);
          page.drawText("AFRICORE — SIGNATURE RECORD (CONTINUED)", { x: 42, y: 790, size: 13, font: bold });
          y = 755;
        }
      }
      const bytes = await pdf.save();
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${(request.title || "signed-document").replace(/[^a-z0-9_-]+/gi, "-")}-signed.pdf`;
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      setNotice("PDF yenye ukurasa wa kumbukumbu ya saini imepakuliwa.");
    } catch (pdfError) {
      setError(pdfError.message || "Imeshindikana kutengeneza PDF iliyosainiwa.");
    } finally { setActionId(null); }
  };

  const staffName = (person) => [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(" ") || person.employee_number || "Staff";
  const statusLabel = (status) => ({ pending: "Inasubiri", in_progress: "Inaendelea", completed: "Imekamilika", cancelled: "Imefutwa", signed: "Imesaini", declined: "Amekataa" }[status] || status);
  const requestStatus = (request) => {
    const recipients = request.document_signing_recipients || [];
    if (recipients.length && recipients.every((row) => row.status === "signed")) return "completed";
    if (recipients.some((row) => row.status !== "pending")) return "in_progress";
    return request.status || "pending";
  };

  return (
    <main className="space-y-6">
      <header className="rounded-3xl bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-800 p-6 text-white">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-200">AFRICORE • DOCUMENT CONTROL</p>
        <h1 className="mt-2 text-3xl font-extrabold">Document Signing</h1>
        <p className="mt-2 max-w-3xl text-sm text-blue-100">Secretary anaratibu nyaraka, wasaini na ufuatiliaji. HR husajili saini za wafanyakazi; kila msaini hutumia saini yake iliyosajiliwa.</p>
      </header>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

      {canManageRequests && (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Tengeneza ombi la kusaini</h2>
        <form onSubmit={createRequest} className="mt-4 grid gap-4">
          <label className="grid gap-1 text-sm font-semibold text-slate-700">Jina la nyaraka<input value={title} onChange={(e) => setTitle(e.target.value)} required className="rounded-lg border border-slate-300 px-3 py-2 font-normal" placeholder="Mfano: Staff Meeting Minutes" /></label>
          <label className="grid gap-1 text-sm font-semibold text-slate-700">Maelezo (si lazima)<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
          <label className="grid gap-1 text-sm font-semibold text-slate-700">PDF ya kusainiwa<input type="file" accept="application/pdf,.pdf" onChange={(e) => setDocumentFile(e.target.files?.[0] || null)} required className="rounded-lg border border-slate-300 p-2 font-normal" /></label>
          <div><p className="mb-2 text-sm font-semibold text-slate-700">Primary signatories by role</p><div className="mb-3 grid gap-2 rounded-xl border border-indigo-100 bg-indigo-50 p-3 sm:grid-cols-2">{primarySignatories.map((primary) => { const person = staff.find((row) => row.id === primary.teacher_id && row.user_id === primary.profile_id); if (!person) return null; const hasSignature = signatures.some((sig) => sig.teacher_id === person.id && sig.profile_id === person.user_id); return <label key={primary.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedSigners.includes(person.id)} disabled={!hasSignature} onChange={(e) => setSelectedSigners((current) => e.target.checked ? [...new Set([...current, person.id])] : current.filter((id) => id !== person.id))} /><span className="text-slate-800">{primary.roles?.role_name || `Role #${primary.role_id}`} — {staffName(person)} <span className="text-xs text-indigo-700">(Primary)</span></span></label>; })}{primarySignatories.length === 0 && <p className="text-xs text-slate-500">HR bado hajachagua Primary Signatory kwa role yoyote.</p>}</div><p className="mb-2 text-sm font-semibold text-slate-700">Au chagua wasaini wengine</p><div className="grid max-h-64 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3 sm:grid-cols-2">{staff.map((person) => {
            const hasSignature = signatures.some((sig) => sig.teacher_id === person.id && sig.profile_id === person.user_id);
            return <label key={person.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedSigners.includes(person.id)} disabled={!hasSignature} onChange={(e) => setSelectedSigners((current) => e.target.checked ? [...new Set([...current, person.id])] : current.filter((id) => id !== person.id))} /><span className={hasSignature ? "text-slate-800" : "text-slate-400"}>{staffName(person)}{!hasSignature ? " (HR hajahifadhi saini)" : ""}</span></label>;
          })}</div></div>
          <button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-60"><FaFileSignature />{saving ? "Inatuma..." : "Tuma kwa wasaini"}</button>
        </form>
      </section>
      )}

      {canManageRequests && (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold text-slate-900">Nyaraka nilizotuma</h2><button onClick={load} className="rounded-lg border border-slate-300 p-2 text-slate-600" aria-label="Refresh"><FaSyncAlt /></button></div>
        {loading ? <p className="py-6 text-sm text-slate-500">Inapakia...</p> : requests.length === 0 ? <p className="py-6 text-sm text-slate-500">Bado hakuna ombi la kusaini.</p> : <div className="mt-3 divide-y divide-slate-100">{requests.map((request) => <article key={request.id} className="py-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-slate-900">{request.title}</h3><p className="text-xs text-slate-500">{new Date(request.created_at).toLocaleString("en-GB")} • {statusLabel(requestStatus(request))}</p>{request.description && <p className="mt-1 text-sm text-slate-600">{request.description}</p>}</div><button onClick={() => openDocument(request.document_path)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"><FaFilePdf /> Fungua PDF</button>{requestStatus(request) === "completed" && <button onClick={() => downloadSignedPdf(request)} disabled={actionId === `pdf-${request.id}`} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><FaFilePdf /> {actionId === `pdf-${request.id}` ? "Inatengeneza..." : "Pakua PDF yenye saini"}</button>}</div><div className="mt-3 flex flex-wrap gap-2">{(request.document_signing_recipients || []).map((recipient) => <span key={recipient.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{staffName(recipient.teachers || {})}: {statusLabel(recipient.status)}</span>)}</div></article>)}</div>}
      </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Nyaraka ninazotakiwa kusaini</h2>
        {myTasks.length === 0 ? <p className="py-5 text-sm text-slate-500">Huna nyaraka zinazosubiri saini kwa sasa.</p> : <div className="divide-y divide-slate-100">{myTasks.map((task) => <article key={task.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold text-slate-900">{task.request.title}</h3><p className="text-xs text-slate-500">{statusLabel(task.status)} • {task.request.description || "Hakuna maelezo"}</p><button onClick={() => openDocument(task.request.document_path)} className="mt-2 text-sm font-semibold text-blue-700 underline">Soma PDF</button></div>{task.status === "pending" && <div className="flex gap-2"><button disabled={actionId === task.id} onClick={() => respondToTask(task, "signed")} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><FaCheckCircle className="mr-1 inline" /> Nimesaini</button><button disabled={actionId === task.id} onClick={() => respondToTask(task, "declined")} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700 disabled:opacity-50"><FaTimesCircle className="mr-1 inline" /> Kataa</button></div>}</article>)}</div>}
      </section>
      <p className="text-xs text-slate-500">Kumbuka: PDF ya asili huhifadhiwa bila kubadilishwa. Baada ya wasaini wote kukamilisha, unaweza kupakua nakala yenye ukurasa wa kumbukumbu ya saini, picha za saini, majina na muda wa kusaini.</p>
    </main>
  );
}

export default SecretaryDocumentSigning;
