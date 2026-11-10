import { useEffect, useState } from "react";
import api from "../services/api";
import { supabase } from "../services/supabase";
import { useSchool } from "../context/SchoolContext";

export default function ParentPortalManagement() {
  const { schoolId } = useSchool();
  const [classes, setClasses] = useState([]);
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
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
    } catch (e) { setError(e.response?.data?.message || "Imeshindikana kupakia group chat."); }
  };
  useEffect(() => {
    if (!schoolId) return;
    supabase.from("classes").select("id,class_name").eq("school_id", schoolId).order("class_name")
      .then(({ data, error: e }) => { if (e) setError(e.message); else setClasses(data || []); });
    loadMeetings();
  }, [schoolId]);
  useEffect(() => { if (classId) loadChat(classId); }, [classId]);

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
      <div><h1 className="text-3xl font-black text-slate-900">Parent Portal Management</h1><p className="mt-2 text-slate-600">Ratibu mikutano ya wazazi na wasiliana na kundi la wazazi la darasa.</p></div>
      {notice && <div className="rounded-xl bg-emerald-50 p-3 text-emerald-800">{notice}</div>}
      {error && <div className="rounded-xl bg-red-50 p-3 text-red-700">{error}</div>}
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
          <h2 className="text-xl font-bold">Class Group Chat</h2>
          <p className="mt-1 text-sm text-slate-500">Ujumbe huu unaonekana kwa wazazi wa darasa husika pamoja na watumishi wanaoruhusiwa.</p>
          <select value={classId} onChange={(e)=>setClassId(e.target.value)} className="mt-4 w-full rounded-xl border p-3"><option value="">Chagua darasa</option>{classes.map((x)=><option key={x.id} value={x.id}>{x.class_name}</option>)}</select>
          <div className="mt-4 h-96 space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-4">{messages.map((m)=><article key={m.id} className="rounded-lg bg-white p-3 shadow-sm"><b className="text-sm">{m.sender_name}</b><span className="ml-2 text-xs text-slate-400">{m.sender_type}</span><p className="mt-1 text-sm">{m.message}</p><small className="text-slate-400">{new Date(m.created_at).toLocaleString()}</small></article>)}{classId&&!messages.length&&<p className="text-sm text-slate-500">Hakuna ujumbe bado.</p>}</div>
          <form onSubmit={sendChat} className="mt-3 flex gap-2"><input disabled={!classId} required value={chatText} onChange={(e)=>setChatText(e.target.value)} placeholder="Andika ujumbe kwa wazazi..." className="min-w-0 flex-1 rounded-xl border p-3"/><button disabled={busy||!classId} className="rounded-xl bg-blue-700 px-5 font-bold text-white disabled:opacity-50">Tuma</button></form>
        </section>
      </div>
    </div>
  );
}
