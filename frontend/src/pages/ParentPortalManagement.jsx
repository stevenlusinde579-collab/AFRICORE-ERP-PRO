import { useEffect, useState } from "react";
import api from "../services/api";
import { useSchool } from "../context/SchoolContext";

export default function ParentPortalManagement() {
  const { schoolId } = useSchool();
  const [classes, setClasses] = useState([]);
  const [parents, setParents] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [classId, setClassId] = useState("");
  const [messages, setMessages] = useState([]);
  const [chatText, setChatText] = useState("");
  const [meetings, setMeetings] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [meetingClassId, setMeetingClassId] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [replies, setReplies] = useState({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadSuggestions = async () => {
    try { const response = await api.get("/parent-portal/staff/suggestions"); setSuggestions(response.data?.suggestions || []); }
    catch (e) { setError(e.response?.data?.message || "Imeshindikana kupakia maoni ya wazazi."); }
  };
  const saveSuggestionReply = async (item) => {
    setBusy(true); setError(""); setNotice("");
    try { await api.patch("/parent-portal/staff/suggestions/" + item.id, { staff_reply: replies[item.id] || "", status: (replies[item.id] || "").trim() ? "responded" : "under_review" }); setNotice("Jibu limehifadhiwa."); await loadSuggestions(); }
    catch (e) { setError(e.response?.data?.message || "Imeshindikana kuhifadhi jibu."); }
    finally { setBusy(false); }
  };
  const loadMeetings = async () => {
    try {
      const response = await api.get("/parent-portal/staff/meetings");
      setMeetings(response.data?.meetings || []);
    } catch (e) { setError(e.response?.data?.message || "Imeshindikana kupakia mikutano."); }
  };
  const loadChat = async (id = classId) => {
    if (!id) { setMessages([]); return; }
    try {
      const response = await api.get("/parent-portal/staff/chat/" + id);
      setMessages(response.data?.messages || []);
      setGroupMembers(response.data?.group_members || []);
    } catch (e) { setError(e.response?.data?.message || "Imeshindikana kupakia group chat."); }
  };
  useEffect(() => {
    if (!schoolId) return;
    api.get("/parent-portal/staff/classes").then(({ data }) => setClasses(data?.classes || [])).catch((e) => setError(e.response?.data?.message || "Imeshindikana kupakia madarasa yaliyoruhusiwa."));
    api.get("/parent-portal/staff/parents").then(({ data }) => setParents(data?.parents || [])).catch((e) => setError(e.response?.data?.message || "Imeshindikana kupakia taarifa za wazazi."));
    loadMeetings();
    loadSuggestions();
  }, [schoolId]);
  useEffect(() => {
    if (!classId) return undefined;
    loadChat(classId);
    const refreshTimer = window.setInterval(() => loadChat(classId), 5000);
    return () => window.clearInterval(refreshTimer);
  }, [classId]);

  const sendChat = async (event) => {
    event.preventDefault(); if (!classId || !chatText.trim()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api.post("/parent-portal/staff/chat/" + classId, { message: chatText.trim() });
      setChatText(""); await loadChat(classId);
    } catch (e) { setError(e.response?.data?.message || "Ujumbe haukutumwa."); }
    finally { setBusy(false); }
  };
  const createMeeting = async (event) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      await api.post("/parent-portal/staff/meetings", {
        title, description, class_id: meetingClassId || null,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        meeting_url: meetingUrl,
        meeting_provider: meetingUrl ? "External video conference" : "",
      });
      setTitle(""); setDescription(""); setStartsAt(""); setEndsAt(""); setMeetingUrl("");
      setNotice("Mkutano umehifadhiwa na utaonekana kwenye Parent Portal za wazazi husika.");
      await loadMeetings();
    } catch (e) { setError(e.response?.data?.message || "Imeshindikana kuhifadhi mkutano."); }
    finally { setBusy(false); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-900 p-6 text-white shadow-lg"><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">AfriCore · Communication</p><h1 className="mt-2 text-3xl font-black">Parent Portal Management</h1><p className="mt-2 max-w-2xl text-sm text-blue-100">Simamia mawasiliano ya wazazi, vikundi vya madarasa, mikutano na mrejesho wa wazazi.</p><div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3"><div className="rounded-xl bg-white/10 p-3"><p className="text-2xl font-black">{parents.length}</p><p className="text-xs text-blue-100">Wanafunzi / Wazazi</p></div><div className="rounded-xl bg-white/10 p-3"><p className="text-2xl font-black">{classes.length}</p><p className="text-xs text-blue-100">Madarasa yanayoruhusiwa</p></div><div className="col-span-2 rounded-xl bg-white/10 p-3 md:col-span-1"><p className="text-2xl font-black">{suggestions.length}</p><p className="text-xs text-blue-100">Maoni ya wazazi</p></div></div></div>
      {notice && <div className="rounded-xl bg-emerald-50 p-3 text-emerald-800">{notice}</div>}
      {error && <div className="rounded-xl bg-red-50 p-3 text-red-700">{error}</div>}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-900">Orodha ya wazazi na walezi</h2><p className="mt-1 text-sm text-slate-500">Taarifa za mawasiliano za wazazi kulingana na madarasa unayoruhusiwa kusimamia.</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">{parents.length} rekodi</span></div>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Mwanafunzi</th><th className="p-3">Mzazi / Mlezi</th><th className="p-3">Simu</th><th className="p-3">Barua pepe</th><th className="p-3">Darasa</th></tr></thead><tbody>{parents.map((p)=><tr key={p.student_id} className="border-t border-slate-100"><td className="p-3 font-semibold text-slate-800">{p.student_name}<small className="block text-slate-400">{p.admission_number || "—"}</small></td><td className="p-3">{p.parent_name}</td><td className="p-3">{p.phone || "—"}</td><td className="p-3">{p.email || "—"}</td><td className="p-3">{p.class_name}</td></tr>)}</tbody></table>{!parents.length && <p className="p-6 text-center text-sm text-slate-500">Hakuna taarifa za wazazi katika madarasa unayoruhusiwa kuona.</p>}</div>
      </section>
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Maoni na malalamiko ya wazazi</h2><p className="mt-1 text-sm text-slate-500">Jibu maoni ya wazazi; majibu yataonekana kwenye Parent Portal ya mwanafunzi husika.</p></div><button type="button" onClick={loadSuggestions} className="rounded-lg border px-4 py-2 text-sm font-semibold">Refresh</button></div>
        <div className="mt-4 space-y-4">{suggestions.map((item)=><article key={item.id} className="rounded-xl border p-4"><div className="flex flex-wrap justify-between gap-2"><b>{item.student?.name || "Mwanafunzi"} · {item.student?.admission_number || ""}</b><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">{item.status}</span></div><p className="mt-2 text-xs text-slate-500">{item.category} · {new Date(item.created_at).toLocaleString()}</p><p className="mt-2 whitespace-pre-wrap text-sm">{item.message}</p>{item.staff_reply&&<div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm"><b>Jibu la sasa</b><p className="mt-1">{item.staff_reply}</p></div>}<textarea value={replies[item.id] ?? item.staff_reply ?? ""} onChange={(e)=>setReplies(prev=>({...prev,[item.id]:e.target.value}))} rows={3} placeholder="Andika jibu la shule..." className="mt-3 w-full rounded-xl border p-3"/><button type="button" disabled={busy} onClick={()=>saveSuggestionReply(item)} className="mt-2 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Hifadhi jibu</button></article>)}{!suggestions.length&&<p className="text-sm text-slate-500">Hakuna maoni mapya kutoka kwa wazazi.</p>}</div>
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Ratibu Parent Meeting / Video Conference</h2>
          <form onSubmit={createMeeting} className="mt-4 space-y-3">
            <input required value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Jina la mkutano" className="w-full rounded-xl border p-3"/>
            <textarea value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="Maelezo ya mkutano" rows={3} className="w-full rounded-xl border p-3"/>
            <select value={meetingClassId} onChange={(e)=>setMeetingClassId(e.target.value)} className="w-full rounded-xl border p-3"><option value="">Shule nzima / wazazi wote</option>{classes.map((x)=><option key={x.id} value={x.id}>{x.class_name}</option>)}</select>
            <label className="block text-sm font-semibold">Muda wa kuanza<input required type="datetime-local" value={startsAt} onChange={(e)=>setStartsAt(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label>
            <label className="block text-sm font-semibold">Muda wa kumaliza (hiari)<input type="datetime-local" value={endsAt} onChange={(e)=>setEndsAt(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label>
            <input value={meetingUrl} onChange={(e)=>setMeetingUrl(e.target.value)} placeholder="Video conference link (Zoom, Meet, LiveKit...)" className="w-full rounded-xl border p-3"/>
            <button disabled={busy} className="rounded-xl bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? "Inahifadhi..." : "Hifadhi Mkutano"}</button>
          </form>
          <div className="mt-6"><h3 className="font-bold">Mikutano iliyopangwa</h3>{meetings.map((m)=><article key={m.id} className="border-b py-3"><b>{m.title}</b><p className="text-sm text-slate-500">{new Date(m.starts_at).toLocaleString()}</p>{m.meeting_url&&<a href={m.meeting_url} target="_blank" rel="noreferrer" className="text-sm text-blue-700 underline">Fungua kiungo</a>}</article>)}{!meetings.length&&<p className="mt-2 text-sm text-slate-500">Hakuna mikutano iliyopangwa.</p>}</div>
        </section>
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="rounded-xl bg-slate-900 p-4 text-white"><h2 className="text-xl font-bold">Class Group Chat</h2><p className="mt-1 text-sm text-slate-300">Muonekano wa mazungumzo wa WhatsApp; wazazi wa darasa na watumishi wanaoruhusiwa wanaona ujumbe wa kundi moja.</p></div>
          <select value={classId} onChange={(e)=>setClassId(e.target.value)} className="mt-4 w-full rounded-xl border p-3"><option value="">Chagua darasa</option>{classes.map((x)=><option key={x.id} value={x.id}>{x.class_name}</option>)}</select>
          <div className="mt-4 grid gap-3 md:grid-cols-[190px_1fr]"><aside className="rounded-xl bg-slate-50 p-3"><h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Wanachama · {groupMembers.length}</h3><div className="space-y-2">{groupMembers.map((member)=><div key={member.student_id} className="flex items-center gap-2 rounded-lg bg-white p-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{member.parent_name?.slice(0,1)||"M"}</span><div className="min-w-0"><p className="truncate text-xs font-semibold">{member.parent_name}</p><p className="truncate text-[10px] text-slate-400">{member.student_name}</p></div></div>)}{classId&&!groupMembers.length&&<p className="text-xs text-slate-400">Hakuna wazazi wenye akaunti hai.</p>}</div></aside><div className="h-96 space-y-3 overflow-y-auto rounded-xl bg-[#f0f2ed] p-4">{messages.map((m)=><div key={m.id} className={"flex "+(m.sender_type==="staff"?"justify-end":"justify-start")}><article className={"max-w-[85%] rounded-2xl px-4 py-3 shadow-sm "+(m.sender_type==="staff"?"bg-[#d9fdd3]":"bg-white")}><b className="text-xs text-slate-700">{m.sender_name}</b><p className="mt-1 whitespace-pre-wrap break-words text-sm">{m.message}</p><small className="mt-1 block text-right text-[10px] text-slate-400">{new Date(m.created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</small></article></div>)}{classId&&!messages.length&&<p className="py-16 text-center text-sm text-slate-500">Hakuna ujumbe bado.</p>}</div></div>
          <form onSubmit={sendChat} className="mt-3 flex gap-2"><input disabled={!classId} required value={chatText} onChange={(e)=>setChatText(e.target.value)} placeholder="Andika ujumbe kwa wazazi..." className="min-w-0 flex-1 rounded-xl border p-3"/><button disabled={busy||!classId} className="rounded-xl bg-blue-700 px-5 font-bold text-white disabled:opacity-50">Tuma</button></form>
        </section>
      </div>
    </div>
  );
}
