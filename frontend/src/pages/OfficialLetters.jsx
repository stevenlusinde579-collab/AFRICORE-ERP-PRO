import { useEffect, useMemo, useState } from "react";
import api from "../services/api";

const today = () => new Date().toLocaleDateString("sw-TZ", { day: "2-digit", month: "long", year: "numeric" });

export default function OfficialLetters() {
  const [context, setContext] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [senderAddress, setSenderAddress] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [authorTitle, setAuthorTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const [contextResponse, recipientResponse] = await Promise.all([
          api.get("/parent-portal/staff/letters/context"),
          api.get("/parent-portal/staff/parents"),
        ]);
        if (!active) return;
        const ctx = contextResponse.data || {};
        setContext(ctx);
        setRecipients(recipientResponse.data?.parents || []);
        setSenderAddress(ctx.school?.address || "");
        setAuthorName(ctx.author?.full_name || "");
        setPhone(ctx.author?.phone || "");
        setAuthorTitle(ctx.author?.role_name || "");
      } catch (e) {
        if (active) setError(e.response?.data?.message || "Imeshindikana kupakia taarifa za shule na wapokeaji.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const selectedRecipients = useMemo(
    () => recipients.filter((recipient) => selectedIds.includes(String(recipient.student_id))),
    [recipients, selectedIds]
  );

  const toggleRecipient = (id) => setSelectedIds((current) =>
    current.includes(String(id)) ? current.filter((value) => value !== String(id)) : [...current, String(id)]
  );

  const buildPayload = (recipient) => ({
    sender_address: senderAddress.trim(),
    recipient_name: recipient.parent_name || "Mzazi/Mlezi",
    recipient_address: recipientAddress.trim(),
    subject: subject.trim(),
    body: body.trim(),
    author_name: authorName.trim(),
    author_title: authorTitle.trim(),
    author_phone: phone.trim(),
    student: {
      name: recipient.student_name,
      admission_number: recipient.admission_number || "",
      class_name: recipient.class_name || "",
      parent_name: recipient.parent_name || "",
    },
    school: context?.school || {},
    reference: "AFR/OFISI/" + String(recipient.admission_number || recipient.student_id) + "/" + new Date().getFullYear(),
    date: today(),
  });

  const validate = () => {
    if (!selectedIds.length) return "Chagua angalau mwanafunzi mmoja wa kumwandikia barua.";
    if (!senderAddress.trim() || !recipientAddress.trim()) return "Jaza anwani ya mwandishi na ya mwandikiwa.";
    if (!subject.trim() || !body.trim()) return "Jaza YAH na maudhui ya barua.";
    if (!authorName.trim() || !authorTitle.trim() || !phone.trim()) return "Jaza jina, cheo na namba ya simu ya mwandishi.";
    return "";
  };

  const publish = async () => {
    const validation = validate();
    if (validation) { setError(validation); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const letters = selectedRecipients.map((recipient) => ({
        student_id: Number(recipient.student_id),
        title: subject.trim(),
        payload: buildPayload(recipient),
      }));
      const response = await api.post("/parent-portal/staff/letters/publish", {
        letter_type: "official_letter",
        letters,
      });
      setNotice(response.data?.message || "Barua zimechapishwa kwenye Parent/Sponsor Portal.");
    } catch (e) {
      setError(e.response?.data?.message || "Imeshindikana kuchapisha barua.");
    } finally {
      setBusy(false);
    }
  };

  const print = () => {
    const validation = validate();
    if (validation) { setError(validation); return; }
    setError("");
    document.body.classList.add("afri-official-letter-printing");
    window.setTimeout(() => window.print(), 100);
  };

  useEffect(() => {
    const afterPrint = () => document.body.classList.remove("afri-official-letter-printing");
    window.addEventListener("afterprint", afterPrint);
    return () => window.removeEventListener("afterprint", afterPrint);
  }, []);

  return (
    <section className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-900 p-6 text-white">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">School communication</p>
        <h2 className="mt-2 text-2xl font-black">Official Letters</h2>
        <p className="mt-2 text-sm text-blue-100">Tengeneza barua rasmi zisizo za kifedha kwa wazazi na sponsors. Unaweza kuchapisha au kuzituma kwenye Parent/Sponsor Portal.</p>
      </div>
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{notice}</div>}
      {loading ? <div className="rounded-xl border bg-white p-6 text-sm text-slate-500">Inapakia taarifa za shule na wapokeaji...</div> : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,.8fr)]">
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-extrabold text-slate-900">Taarifa za barua</h3>
            <label className="block text-xs font-bold text-slate-600">Anwani ya mwandishi
              <textarea value={senderAddress} onChange={(e)=>setSenderAddress(e.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal" placeholder="Jina la shule, S.L.P, eneo..." />
            </label>
            <label className="block text-xs font-bold text-slate-600">Anwani ya mwandikiwa
              <textarea value={recipientAddress} onChange={(e)=>setRecipientAddress(e.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal" placeholder="Jina la mzazi/sponsor, anuani ya posta au eneo..." />
            </label>
            <label className="block text-xs font-bold text-slate-600">YAH / Kichwa cha barua
              <input value={subject} onChange={(e)=>setSubject(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-normal" placeholder="Mfano: MAELEKEZO YA MAHUDHURIO YA MWANAFUNZI" />
            </label>
            <label className="block text-xs font-bold text-slate-600">Maudhui ya barua
              <textarea value={body} onChange={(e)=>setBody(e.target.value)} rows={10} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal" placeholder="Andika maudhui ya barua hapa..." />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-bold text-slate-600">Jina la mwandishi
                <input value={authorName} onChange={(e)=>setAuthorName(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-normal" />
              </label>
              <label className="block text-xs font-bold text-slate-600">Cheo
                <input value={authorTitle} onChange={(e)=>setAuthorTitle(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-normal" placeholder="Mfano: Mkuu wa Shule" />
              </label>
            </div>
            <label className="block text-xs font-bold text-slate-600">Namba ya simu
              <input type="tel" value={phone} onChange={(e)=>setPhone(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-normal" placeholder="07XX XXX XXX" />
            </label>
            <p className="text-xs text-slate-500">Sehemu ya saini itaachwa wazi kwenye barua iliyochapishwa ili mwandishi aweze kusaini kwa mkono.</p>
            <div className="flex flex-wrap gap-3 border-t pt-4">
              <button type="button" onClick={print} disabled={busy || !selectedIds.length} className="rounded-xl bg-slate-800 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">Print Letter ({selectedIds.length})</button>
              <button type="button" onClick={publish} disabled={busy || !selectedIds.length} className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Inachapisha..." : "Publish to Parent Portal"}</button>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3"><div><h3 className="font-extrabold text-slate-900">Wapokeaji</h3><p className="mt-1 text-xs text-slate-500">Chagua mwanafunzi/wanafunzi. Barua itafika kwa mzazi au sponsor aliyehusishwa na mwanafunzi.</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{selectedIds.length} wamechaguliwa</span></div>
            <div className="mt-4 max-h-[620px] divide-y overflow-y-auto">
              {recipients.map((recipient) => <label key={recipient.student_id} className="flex cursor-pointer items-start gap-3 py-3">
                <input type="checkbox" checked={selectedIds.includes(String(recipient.student_id))} onChange={()=>toggleRecipient(recipient.student_id)} className="mt-1" />
                <span className="min-w-0 flex-1"><b className="block text-sm text-slate-800">{recipient.student_name}</b><span className="mt-0.5 block text-xs text-slate-500">{recipient.admission_number || "—"} · {recipient.class_name || "Darasa halijabainishwa"}</span><span className="mt-1 block text-xs text-slate-600">{recipient.parent_name || "Mzazi/Mlezi"} · {recipient.phone || "Hakuna simu"}</span></span>
              </label>)}
              {!recipients.length && <p className="py-6 text-sm text-slate-500">Hakuna wapokeaji wanaopatikana katika wigo wa ruhusa yako.</p>}
            </div>
          </div>
        </div>
      )}
      <div className="official-letter-print-root">
        {selectedRecipients.map((recipient, index) => <article key={recipient.student_id} className="official-letter-print-page">
          <header className="border-b-2 border-black pb-4 text-center">
            {context?.school?.logo ? <img src={context.school.logo} alt="" className="mx-auto mb-2 h-16 w-16 object-contain" /> : null}
            <h1 className="text-xl font-black uppercase">{context?.school?.school_name || "SHULE"}</h1>
            <p className="mt-1 text-xs">{senderAddress}</p>
            <p className="text-xs">{context?.school?.phone || ""} {context?.school?.email || ""}</p>
          </header>
          <div className="mt-5 flex justify-between text-sm"><div><p><b>Kumb. Na:</b> AFR/OFISI/{recipient.admission_number || recipient.student_id}/{new Date().getFullYear()}</p><p className="mt-2 whitespace-pre-line"><b>Kwa:</b> {recipient.parent_name || "Mzazi/Mlezi"}{"\n"}{recipientAddress}</p></div><p><b>Tarehe:</b> {today()}</p></div>
          <h2 className="mt-6 text-center text-sm font-black underline">YAH: {subject.toUpperCase()}</h2>
          <div className="mt-5 whitespace-pre-wrap text-justify text-sm leading-7">{body}</div>
          <p className="mt-5 text-sm">Wako katika huduma,</p>
          <div className="mt-14 w-72 border-t border-black pt-2 text-sm">
            <p className="font-bold">{authorName}</p><p>{authorTitle}</p><p className="mt-1">Simu: {phone}</p><p className="mt-8">Saini: ______________________________</p>
          </div>
          <p className="mt-8 text-center text-[9px] text-slate-500">{context?.school?.school_name || "AfriCore ERP PRO"} · Barua rasmi · {index + 1}/{selectedRecipients.length}</p>
        </article>)}
      </div>
      <style>{`
        .official-letter-print-root { display: none; }
        @page { size: A4 portrait; margin: 18mm; }
        @media print {
          body.afri-official-letter-printing * { visibility: hidden !important; }
          body.afri-official-letter-printing .official-letter-print-root,
          body.afri-official-letter-printing .official-letter-print-root * { visibility: visible !important; }
          body.afri-official-letter-printing .official-letter-print-root { display: block !important; position: absolute; inset: 0; width: 100%; }
          body.afri-official-letter-printing .official-letter-print-page { display: block; min-height: 255mm; max-height: 255mm; overflow: hidden; break-after: page; page-break-after: always; color: #000 !important; font-size: 11pt; line-height: 1.45; }
          body.afri-official-letter-printing .official-letter-print-page:last-child { break-after: auto; page-break-after: auto; }
        }
      `}</style>
    </section>
  );
}
