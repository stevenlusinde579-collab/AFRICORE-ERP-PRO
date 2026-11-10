import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../services/api";

const TOKEN_KEY = "africore_parent_portal_token";
const money = (value) => new Intl.NumberFormat("en-TZ", { style: "currency", currency: "TZS", maximumFractionDigits: 0 }).format(Number(value || 0));
const dateText = (value) => value ? new Date(value).toLocaleDateString() : "-";

export default function ParentPortal() {
  const [searchParams] = useSearchParams();
  const [schools, setSchools] = useState([]);
  const [schoolId, setSchoolId] = useState(searchParams.get("school") || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(sessionStorage.getItem(TOKEN_KEY) || "");
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedExam, setSelectedExam] = useState("");
  const [resultData, setResultData] = useState(null);
  const [suggestion, setSuggestion] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const authConfig = useMemo(() => ({ headers: { Authorization: "Bearer " + token } }), [token]);

  const loadDashboard = async (activeToken = token) => {
    if (!activeToken) return;
    try {
      const response = await api.get("/parent-portal/dashboard", { headers: { Authorization: "Bearer " + activeToken } });
      setData(response.data);
      if (response.data?.exams?.length && !selectedExam) setSelectedExam(String(response.data.exams[0].id));
    } catch (e) {
      setError(e.response?.data?.message || "Imeshindikana kupakia taarifa za mwanafunzi.");
      sessionStorage.removeItem(TOKEN_KEY);
      setToken("");
    }
  };

  useEffect(() => {
    api.get("/parent-portal/schools").then((r) => setSchools(r.data?.schools || [])).catch(() => setError("Imeshindikana kupata orodha ya shule."));
  }, []);
  useEffect(() => { if (token) loadDashboard(token); }, [token]);

  const signIn = async (event) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const response = await api.post("/parent-portal/login", { school_id: schoolId, username, password });
      sessionStorage.setItem(TOKEN_KEY, response.data.token);
      setToken(response.data.token);
      setPassword("");
      setNotice("Umeingia kwenye Parent Portal.");
    } catch (e) { setError(e.response?.data?.message || "Username au password si sahihi."); }
    finally { setBusy(false); }
  };
  const signOut = () => { sessionStorage.removeItem(TOKEN_KEY); setToken(""); setData(null); setActiveTab("overview"); };

  const loadResults = async (examId) => {
    setSelectedExam(examId); setResultData(null);
    if (!examId) return;
    try {
      const response = await api.get("/parent-portal/results/" + examId, authConfig);
      setResultData(response.data);
    } catch (e) { setError(e.response?.data?.message || "Imeshindikana kupakia matokeo."); }
  };
  const changePassword = async (event) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      await api.post("/parent-portal/change-password", { current_password: currentPassword, new_password: newPassword }, authConfig);
      setCurrentPassword(""); setNewPassword(""); setNotice("Password imebadilishwa kikamilifu. Tafadhali hifadhi password yako mpya.");
      await loadDashboard();
    } catch (e) { setError(e.response?.data?.message || "Imeshindikana kubadilisha password."); }
    finally { setBusy(false); }
  };
  const submitSuggestion = async (event) => {
    event.preventDefault(); setBusy(true);
    try { await api.post("/parent-portal/suggestions", { suggestion }, authConfig); setSuggestion(""); setNotice("Maoni yako yametumwa kwa uongozi wa shule."); }
    catch (e) { setError(e.response?.data?.message || "Imeshindikana kutuma maoni."); }
    finally { setBusy(false); }
  };
  const sendChat = async (event) => {
    event.preventDefault(); setBusy(true);
    try { await api.post("/parent-portal/chat", { message: chatMessage }, authConfig); setChatMessage(""); await loadDashboard(); }
    catch (e) { setError(e.response?.data?.message || "Imeshindikana kutuma ujumbe."); }
    finally { setBusy(false); }
  };

  if (!token) return (
    <div className="min-h-screen bg-slate-950 px-4 py-12 flex items-center justify-center">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl">
        <a href="/" className="text-sm font-bold text-blue-700">← AfriCore PRO</a>
        <div className="mt-6 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-3xl">👨‍👩‍👧</div><h1 className="mt-4 text-3xl font-black text-slate-900">Parent Portal</h1><p className="mt-2 text-slate-500">Fuatilia maendeleo na taarifa za mwanafunzi wako.</p></div>
        {error && <div className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <form onSubmit={signIn} className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-slate-700">Shule<select required value={schoolId} onChange={(e)=>setSchoolId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3"><option value="">Chagua shule</option>{schools.map((s)=><option key={s.id} value={s.id}>{s.school_name}</option>)}</select></label>
          <label className="block text-sm font-semibold text-slate-700">Username — Jina kamili la mwanafunzi<input required value={username} onChange={(e)=>setUsername(e.target.value)} autoComplete="username" className="mt-1 w-full rounded-xl border border-slate-300 p-3" placeholder="Mfano: Amina John Peter"/></label>
          <label className="block text-sm font-semibold text-slate-700">Password — Admission Number<input required type="password" value={password} onChange={(e)=>setPassword(e.target.value)} autoComplete="current-password" className="mt-1 w-full rounded-xl border border-slate-300 p-3" placeholder="Admission Number"/></label>
          <button disabled={busy} className="w-full rounded-xl bg-blue-700 p-3 font-bold text-white disabled:opacity-60">{busy ? "Inaingia..." : "Ingia Parent Portal"}</button>
        </form>
        <p className="mt-5 text-xs leading-relaxed text-slate-500">Kila mwanafunzi ana akaunti yake. Ikiwa hujapokea SMS ya kuingia, wasiliana na ofisi ya shule ili watume tena taarifa zako.</p>
      </div>
    </div>
  );

  if (!data) return <div className="min-h-screen bg-slate-50 p-10 text-center">Inapakia Parent Portal...</div>;
  const tabs = [["overview","Muhtasari"],["finance","Finance"],["results","Matokeo"],["communication","Mawasiliano"],["chat","Group Chat"],["attendance","Mahudhurio"],["suggestions","Maoni"]];
  const { student, finance } = data;
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-slate-950 text-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5"><div><div className="text-lg font-black">AfriCore <span className="text-cyan-400">Parent Portal</span></div><div className="text-xs text-slate-300">{student.school_name}</div></div><button onClick={signOut} className="rounded-lg border border-white/20 px-4 py-2 text-sm">Toka</button></div></header>
      <main className="mx-auto max-w-7xl px-4 py-7">
        {notice && <div className="mb-4 rounded-xl bg-emerald-50 p-3 text-emerald-800">{notice}</div>}
        {error && <div className="mb-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</div>}
        {data.must_change_password && <form onSubmit={changePassword} className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-5"><h2 className="font-bold text-amber-900">Badilisha password ya awali</h2><p className="mt-1 text-sm text-amber-800">Kwa usalama, unatakiwa kubadilisha admission number kabla ya kuendelea kutumia portal.</p><div className="mt-3 grid gap-3 md:grid-cols-3"><input type="password" required value={currentPassword} onChange={(e)=>setCurrentPassword(e.target.value)} placeholder="Password ya sasa" className="rounded-lg border p-3"/><input type="password" required minLength={8} value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} placeholder="Password mpya (angalau herufi 8)" className="rounded-lg border p-3"/><button disabled={busy} className="rounded-lg bg-amber-700 p-3 font-bold text-white">Badilisha password</button></div></form>}
        <section className="mb-6 rounded-2xl bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-slate-500">Mwanafunzi</p><h1 className="text-2xl font-black">{student.name}</h1><p className="mt-1 text-sm text-slate-500">{student.admission_number} · {student.class_name}</p></div><div className="rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">{student.status || "Active"}</div></div></section>
        <nav className="mb-6 flex flex-wrap gap-2">{tabs.map(([key,label])=><button key={key} onClick={()=>setActiveTab(key)} className={"rounded-xl px-4 py-2 text-sm font-semibold "+(activeTab===key?"bg-blue-700 text-white":"bg-white text-slate-700 shadow-sm")}>{label}</button>)}</nav>
        {activeTab==="overview" && <div className="grid gap-4 md:grid-cols-3"><Summary title="Ada zilizopangiwa" value={money(finance.total_charged)}/><Summary title="Zilizolipwa" value={money(finance.total_paid)}/><Summary title="Salio" value={money(finance.balance)}/><section className="rounded-2xl bg-white p-5 shadow-sm md:col-span-3"><h2 className="mb-3 font-bold">Taarifa za hivi karibuni</h2>{data.announcements.slice(0,5).map((a)=><article key={a.id} className="border-b py-3 last:border-0"><b>{a.title}</b><p className="mt-1 text-sm text-slate-600">{a.content}</p><small className="text-slate-400">{dateText(a.created_at)}</small></article>)}{!data.announcements.length&&<p className="text-sm text-slate-500">Hakuna matangazo mapya.</p>}</section></div>}
        {activeTab==="finance" && <div className="space-y-4"><div className="grid gap-4 md:grid-cols-3"><Summary title="Jumla ya ada/michango" value={money(finance.total_charged)}/><Summary title="Jumla iliyolipwa" value={money(finance.total_paid)}/><Summary title="Salio" value={money(finance.balance)}/></div><section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="mb-3 font-bold">Ada na michango</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-2">Maelezo</th><th className="p-2">Kiasi</th><th className="p-2">Imelipwa</th><th className="p-2">Salio</th><th className="p-2">Hali</th></tr></thead><tbody>{finance.charges.map((x)=><tr key={x.id} className="border-b"><td className="p-2">{x.description}</td><td className="p-2">{money(x.amount)}</td><td className="p-2">{money(x.paid_amount)}</td><td className="p-2">{money(x.balance)}</td><td className="p-2">{x.status}</td></tr>)}</tbody></table></div></section><section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="mb-3 font-bold">Historia ya malipo</h2>{finance.payments.map((p)=><div key={p.id} className="flex flex-wrap justify-between gap-2 border-b py-3 text-sm"><span>{dateText(p.payment_date)} · {p.payment_method || "Malipo"} · {p.reference_number || ""}</span><b>{money(p.amount)}</b></div>)}{!finance.payments.length&&<p className="text-sm text-slate-500">Hakuna malipo yaliyorekodiwa.</p>}</section></div>}
        {activeTab==="results" && <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="mb-3 font-bold">Uchambuzi wa matokeo</h2><select value={selectedExam} onChange={(e)=>loadResults(e.target.value)} className="mb-4 w-full max-w-md rounded-xl border p-3"><option value="">Chagua mtihani</option>{data.exams.map((e)=><option key={e.id} value={e.id}>{e.exam_name} {e.term ? "· "+e.term : ""}</option>)}</select>{resultData?.result ? <><div className="grid gap-3 md:grid-cols-4"><Summary title="Jumla" value={resultData.result.total_marks}/><Summary title="Wastani" value={resultData.result.average_marks}/><Summary title="Grade" value={resultData.result.grade}/><Summary title="Division" value={resultData.result.division}/></div><div className="mt-4 space-y-2">{resultData.marks.map((m)=><div key={m.id} className="flex justify-between border-b py-2"><span>Subject ID {m.subject_id}</span><b>{m.marks} · {m.grade || "-"}</b></div>)}</div></> : selectedExam && <p className="text-sm text-slate-500">Matokeo hayajaidhinishwa au bado hayajatolewa.</p>}</section>}
        {activeTab==="communication" && <div className="space-y-4"><section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="mb-3 font-bold">Ujumbe kutoka shule</h2>{data.communications.map((m)=><article key={m.id} className="border-b py-3"><div className="flex justify-between gap-2"><b>{m.subject || m.channel}</b><small>{dateText(m.sent_at || m.created_at)}</small></div><p className="mt-1 text-sm">{m.message}</p><small className="text-slate-500">{m.channel} · {m.status}</small></article>)}{!data.communications.length&&<p className="text-sm text-slate-500">Hakuna ujumbe uliohifadhiwa.</p>}</section><section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="mb-3 font-bold">Mikutano na video conference</h2>{data.meetings.map((m)=><article key={m.id} className="border-b py-3"><b>{m.title}</b><p className="text-sm text-slate-600">{m.description}</p><p className="text-xs text-slate-500">{dateText(m.meeting_date)} · {m.start_time || ""}</p>{m.meeting_link&&<a className="mt-2 inline-block text-blue-700 underline" href={m.meeting_link} target="_blank" rel="noreferrer">Jiunge na mkutano</a>}</article>)}{!data.meetings.length&&<p className="text-sm text-slate-500">Hakuna mikutano iliyopangwa.</p>}</section></div>}
        {activeTab==="chat" && <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="mb-3 font-bold">Group Chat ya darasa</h2><div className="max-h-96 space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-4">{data.chat.map((m)=><div key={m.id} className="rounded-lg bg-white p-3 shadow-sm"><b className="text-sm">{m.sender_name}</b><p className="mt-1 text-sm">{m.message}</p><small className="text-slate-400">{dateText(m.created_at)}</small></div>)}{!data.chat.length&&<p className="text-sm text-slate-500">Hakuna ujumbe bado.</p>}</div><form onSubmit={sendChat} className="mt-4 flex gap-2"><input value={chatMessage} onChange={(e)=>setChatMessage(e.target.value)} required maxLength={4000} placeholder="Andika ujumbe kwa kundi la darasa..." className="min-w-0 flex-1 rounded-xl border p-3"/><button disabled={busy} className="rounded-xl bg-blue-700 px-5 font-bold text-white">Tuma</button></form></section>}
        {activeTab==="attendance" && <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="mb-3 font-bold">Mahudhurio</h2>{data.attendance.map((a)=><div key={a.id} className="flex justify-between border-b py-3 text-sm"><span>{dateText(a.attendance_date)}</span><b>{a.status}</b></div>)}{!data.attendance.length&&<p className="text-sm text-slate-500">Hakuna mahudhurio yaliyorekodiwa.</p>}</section>}
        {activeTab==="suggestions" && <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-bold">Suggestion Box</h2><p className="mb-4 mt-1 text-sm text-slate-500">Tuma maoni, ushauri au malalamiko kwa uongozi wa shule.</p><form onSubmit={submitSuggestion}><textarea required minLength={5} maxLength={4000} value={suggestion} onChange={(e)=>setSuggestion(e.target.value)} rows={5} className="w-full rounded-xl border p-3" placeholder="Andika maoni yako hapa..."/><button disabled={busy} className="mt-3 rounded-xl bg-blue-700 px-5 py-3 font-bold text-white">Tuma maoni</button></form></section>}
      </main>
    </div>
  );
}
function Summary({title,value}) { return <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{title}</p><p className="mt-2 text-xl font-black text-slate-900">{value}</p></div>; }
