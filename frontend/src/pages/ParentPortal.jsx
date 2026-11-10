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
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loginStudent, setLoginStudent] = useState(null);
  const [data, setData] = useState(null);
  const [groupMembers, setGroupMembers] = useState([]);
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
      setGroupMembers(response.data?.group_members || []);
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
  useEffect(() => { if (token && !mustChangePassword) loadDashboard(token); }, [token, mustChangePassword]);

  const signIn = async (event) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const response = await api.post("/parent-portal/login", { school_id: schoolId, username, password });
      sessionStorage.setItem(TOKEN_KEY, response.data.token);
      setLoginStudent(response.data.student || null);
      setMustChangePassword(Boolean(response.data.must_change_password));
      setToken(response.data.token);
      setPassword("");
      setNotice(response.data.must_change_password ? "Umeingia. Badilisha password ya awali ili kuendelea." : "Umeingia kwenye Parent Portal.");
    } catch (e) { setError(e.response?.data?.message || "Username au password si sahihi."); }
    finally { setBusy(false); }
  };
  const signOut = () => { sessionStorage.removeItem(TOKEN_KEY); setToken(""); setData(null); setLoginStudent(null); setMustChangePassword(false); setActiveTab("overview"); };

  const loadResults = async (examId) => {
    setSelectedExam(examId); setResultData(null);
    if (!examId) return;
    try {
      const response = await api.get("/parent-portal/results/" + examId, authConfig);
      setResultData(response.data);
    } catch (e) { setError(e.response?.data?.message || "Imeshindikana kupakia matokeo."); }
  };
  useEffect(() => {
    if (token && activeTab === "results" && selectedExam && !mustChangePassword) {
      loadResults(selectedExam);
    }
  }, [token, activeTab, selectedExam, mustChangePassword]);

  useEffect(() => {
    if (!token || activeTab !== "chat" || mustChangePassword) return undefined;
    const refresh = window.setInterval(() => loadDashboard(token), 8000);
    return () => window.clearInterval(refresh);
  }, [token, activeTab, mustChangePassword]);

  const changePassword = async (event) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      await api.post("/parent-portal/change-password", { current_password: currentPassword, new_password: newPassword }, authConfig);
      setCurrentPassword(""); setNewPassword(""); setMustChangePassword(false); setNotice("Password imebadilishwa kikamilifu. Tafadhali hifadhi password yako mpya.");
      await loadDashboard(token);
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

  if (mustChangePassword) return (
    <div className="min-h-screen bg-slate-950 px-4 py-12 flex items-center justify-center">
      <form onSubmit={changePassword} className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl">
        <a href="/" className="text-sm font-bold text-blue-700">← AfriCore PRO</a>
        <h1 className="mt-6 text-2xl font-black text-slate-900">Karibu Parent Portal</h1>
        <p className="mt-2 text-sm text-slate-600">{loginStudent?.name || "Mwanafunzi"} · {loginStudent?.school_name || "Shule"}</p>
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Kwa usalama, badilisha password ya awali (Admission Number) kabla ya kuona taarifa za mwanafunzi.</p>
        {error && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <label className="mt-5 block text-sm font-semibold">Password ya awali<input required type="password" value={currentPassword} onChange={(e)=>setCurrentPassword(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label>
        <label className="mt-4 block text-sm font-semibold">Password mpya (angalau herufi 8)<input required minLength={8} type="password" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label>
        <button disabled={busy} className="mt-5 w-full rounded-xl bg-blue-700 p-3 font-bold text-white">{busy ? "Inahifadhi..." : "Badilisha password na uendelee"}</button>
        <button type="button" onClick={signOut} className="mt-3 w-full rounded-xl border p-3 font-semibold">Toka</button>
      </form>
    </div>
  );

  if (!data) return <div className="min-h-screen bg-slate-50 p-10 text-center">Inapakia Parent Portal...</div>;
  const tabs = [["overview","Muhtasari"],["finance","Finance"],["results","Matokeo"],["communication","Mawasiliano"],["chat","Group Chat"],["attendance","Mahudhurio"],["suggestions","Maoni"]];
  const { student, finance } = data;
  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-800">
      <header className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-900 text-white"><div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-cyan-400/10 blur-2xl"/><div className="relative mx-auto flex max-w-7xl items-center justify-between px-4 py-6 md:px-6"><div><div className="text-xl font-black tracking-tight">AfriCore <span className="text-cyan-300">PARENT PORTAL</span></div><div className="mt-1 text-sm text-blue-100">{student.school_name}</div><p className="mt-3 text-xs text-blue-200">Taarifa za mwanafunzi · Mawasiliano ya shule · Maendeleo ya kitaaluma</p></div><button onClick={signOut} className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20">Toka</button></div></header>
      <main className="mx-auto max-w-7xl px-4 py-7 md:px-6">
        {notice && <div className="mb-4 rounded-xl bg-emerald-50 p-3 text-emerald-800">{notice}</div>}
        {error && <div className="mb-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</div>}
        {data.must_change_password && <form onSubmit={changePassword} className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-5"><h2 className="font-bold text-amber-900">Badilisha password ya awali</h2><p className="mt-1 text-sm text-amber-800">Kwa usalama, unatakiwa kubadilisha admission number kabla ya kuendelea kutumia portal.</p><div className="mt-3 grid gap-3 md:grid-cols-3"><input type="password" required value={currentPassword} onChange={(e)=>setCurrentPassword(e.target.value)} placeholder="Password ya sasa" className="rounded-lg border p-3"/><input type="password" required minLength={8} value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} placeholder="Password mpya (angalau herufi 8)" className="rounded-lg border p-3"/><button disabled={busy} className="rounded-lg bg-amber-700 p-3 font-bold text-white">Badilisha password</button></div></form>}
        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-slate-500">Mwanafunzi</p><h1 className="text-2xl font-black">{student.name}</h1><p className="mt-1 text-sm text-slate-500">{student.admission_number} · {student.class_name}</p></div><div className="rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">{student.status || "Active"}</div></div></section>
        <nav className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">{tabs.map(([key,label])=><button key={key} onClick={()=>setActiveTab(key)} className={"rounded-xl px-4 py-2.5 text-sm font-semibold transition "+(activeTab===key?"bg-blue-700 text-white shadow":"text-slate-600 hover:bg-slate-100")}>{label}</button>)}</nav>
        {activeTab==="overview" && <div className="grid gap-4 md:grid-cols-3"><Summary title="Ada zilizopangiwa" value={money(finance.total_charged)}/><Summary title="Zilizolipwa" value={money(finance.total_paid)}/><Summary title="Salio" value={money(finance.balance)}/><section className="rounded-2xl bg-white p-5 shadow-sm md:col-span-3"><h2 className="mb-3 font-bold">Taarifa za hivi karibuni</h2>{data.announcements.slice(0,5).map((a)=><article key={a.id} className="border-b py-3 last:border-0"><b>{a.title}</b><p className="mt-1 text-sm text-slate-600">{a.content}</p><small className="text-slate-400">{dateText(a.created_at)}</small></article>)}{!data.announcements.length&&<p className="text-sm text-slate-500">Hakuna matangazo mapya.</p>}</section></div>}
        {activeTab==="finance" && <div className="space-y-4"><div className="grid gap-4 md:grid-cols-3"><Summary title="Jumla ya ada/michango" value={money(finance.total_charged)}/><Summary title="Jumla iliyolipwa" value={money(finance.total_paid)}/><Summary title="Salio" value={money(finance.balance)}/></div><section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="mb-3 font-bold">Ada na michango</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-2">Maelezo</th><th className="p-2">Kiasi</th><th className="p-2">Imelipwa</th><th className="p-2">Salio</th><th className="p-2">Hali</th></tr></thead><tbody>{finance.charges.map((x)=><tr key={x.id} className="border-b"><td className="p-2">{x.description}</td><td className="p-2">{money(x.amount)}</td><td className="p-2">{money(x.paid_amount)}</td><td className="p-2">{money(x.balance)}</td><td className="p-2">{x.status}</td></tr>)}</tbody></table></div></section><section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="mb-3 font-bold">Historia ya malipo</h2>{finance.payments.map((p)=><div key={p.id} className="flex flex-wrap justify-between gap-2 border-b py-3 text-sm"><span>{dateText(p.payment_date)} · {p.payment_method || "Malipo"} · {p.reference_number || ""}</span><b>{money(p.amount)}</b></div>)}{!finance.payments.length&&<p className="text-sm text-slate-500">Hakuna malipo yaliyorekodiwa.</p>}</section></div>}
        {activeTab==="results" && <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="mb-3 font-bold">Uchambuzi wa matokeo</h2><select value={selectedExam} onChange={(e)=>loadResults(e.target.value)} className="mb-4 w-full max-w-md rounded-xl border p-3"><option value="">Chagua mtihani</option>{data.exams.map((e)=><option key={e.id} value={e.id}>{e.exam_name} {e.term ? "· "+e.term : ""}</option>)}</select>{resultData?.result_status === "approved" && resultData.result && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Matokeo rasmi yameidhinishwa.</div>}
          {resultData?.result_status === "pending_approval" && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">Alama zimeingizwa. Matokeo haya bado yanasubiri idhini ya shule.</div>}
          {resultData?.result && <div className="mb-4 grid gap-3 md:grid-cols-4"><Summary title="Jumla" value={resultData.result.total_marks}/><Summary title="Wastani" value={resultData.result.average_marks}/><Summary title="Grade" value={resultData.result.grade}/><Summary title="Division" value={resultData.result.division}/></div>}
          {resultData?.marks?.length ? <div className="overflow-hidden rounded-xl border border-slate-200"><div className="border-b bg-slate-50 px-4 py-3 font-bold text-slate-700">Alama za masomo</div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Somo</th><th className="px-4 py-3">Alama</th><th className="px-4 py-3">Grade</th><th className="px-4 py-3">Maoni</th></tr></thead><tbody>{resultData.marks.map((m)=><tr key={m.id} className="border-t"><td className="px-4 py-3 font-semibold">{m.subject_name || "Somo"}</td><td className="px-4 py-3 font-bold">{m.marks ?? "—"}</td><td className="px-4 py-3">{m.grade || "—"}</td><td className="px-4 py-3 text-slate-500">{m.remarks || "—"}</td></tr>)}</tbody></table></div></div> : selectedExam && resultData && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{resultData.result_status === "pending_approval" ? "Alama za masomo bado hazijahifadhiwa kwa mtihani huu." : "Bado hakuna alama zilizorekodiwa kwa mtihani huu."}</p>}
          {selectedExam && !resultData && <p className="text-sm text-slate-500">Inapakia matokeo...</p>}</section>}
        {activeTab==="communication" && <div className="space-y-4"><section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="mb-3 font-bold">Ujumbe kutoka shule</h2>{data.communications.map((m)=><article key={m.id} className="border-b py-3"><div className="flex justify-between gap-2"><b>{m.subject || m.channel}</b><small>{dateText(m.sent_at || m.created_at)}</small></div><p className="mt-1 text-sm">{m.message}</p><small className="text-slate-500">{m.channel} · {m.status}</small></article>)}{!data.communications.length&&<p className="text-sm text-slate-500">Hakuna ujumbe uliohifadhiwa.</p>}</section><section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="mb-3 font-bold">Mikutano na video conference</h2>{data.meetings.map((m)=><article key={m.id} className="border-b py-3"><b>{m.title}</b><p className="text-sm text-slate-600">{m.description}</p><p className="text-xs text-slate-500">{new Date(m.starts_at).toLocaleString()} {m.ends_at ? " - " + new Date(m.ends_at).toLocaleTimeString() : ""}</p>{m.meeting_url&&<a className="mt-2 inline-block text-blue-700 underline" href={m.meeting_url} target="_blank" rel="noreferrer">Jiunge na video conference</a>}</article>)}{!data.meetings.length&&<p className="text-sm text-slate-500">Hakuna mikutano iliyopangwa.</p>}</section></div>}
        {activeTab==="chat" && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 px-5 py-4 text-white"><div><h2 className="font-bold">Kundi la wazazi · {student.class_name}</h2><p className="mt-1 text-xs text-slate-300">Mawasiliano ya wazazi na shule kwa darasa hili</p></div><span className="rounded-full bg-white/10 px-3 py-1 text-xs">{groupMembers.length} wanachama</span></div><div className="grid md:grid-cols-[220px_1fr]"><aside className="border-b bg-slate-50 p-4 md:border-b-0 md:border-r"><h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Wanachama wa kundi</h3><div className="space-y-3">{groupMembers.map((member)=><div key={member.student_id} className="flex items-center gap-2"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{(member.parent_name || "M").slice(0,1).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800">{member.parent_name}</p><p className="truncate text-[11px] text-slate-400">{member.student_name}</p></div></div>)}{!groupMembers.length&&<p className="text-xs text-slate-500">Orodha ya wanachama haipatikani.</p>}</div></aside><div className="min-w-0 bg-[#f0f2ed] p-4"><div className="max-h-[440px] min-h-[260px] space-y-3 overflow-y-auto rounded-xl p-2">{data.chat.map((m)=><div key={m.id} className={"flex "+(m.sender_type==="parent"?"justify-end":"justify-start")}><article className={"max-w-[85%] rounded-2xl px-4 py-3 shadow-sm "+(m.sender_type==="parent"?"rounded-br-sm bg-[#d9fdd3]":"rounded-bl-sm bg-white")}><b className="text-xs text-slate-700">{m.sender_name}</b><p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">{m.message}</p><small className="mt-1 block text-right text-[10px] text-slate-400">{new Date(m.created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</small></article></div>)}{!data.chat.length&&<p className="py-16 text-center text-sm text-slate-500">Karibu. Hakuna ujumbe bado.</p>}</div><form onSubmit={sendChat} className="mt-3 flex gap-2 rounded-xl bg-white p-2"><input value={chatMessage} onChange={(e)=>setChatMessage(e.target.value)} required maxLength={4000} placeholder="Andika ujumbe kwa kundi..." className="min-w-0 flex-1 border-0 p-2 text-sm outline-none"/><button disabled={busy} className="rounded-lg bg-emerald-600 px-5 font-bold text-white disabled:opacity-50">Tuma</button></form></div></div></section>}
        {activeTab==="attendance" && <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="mb-3 font-bold">Mahudhurio</h2>{data.attendance.map((a)=><div key={a.id} className="flex justify-between border-b py-3 text-sm"><span>{dateText(a.attendance_date)}</span><b>{a.status}</b></div>)}{!data.attendance.length&&<p className="text-sm text-slate-500">Hakuna mahudhurio yaliyorekodiwa.</p>}</section>}
        {activeTab==="suggestions" && <div className="space-y-4"><section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-bold">Suggestion Box</h2><p className="mb-4 mt-1 text-sm text-slate-500">Tuma maoni, ushauri au malalamiko kwa uongozi wa shule.</p><form onSubmit={submitSuggestion}><textarea required minLength={5} maxLength={4000} value={suggestion} onChange={(e)=>setSuggestion(e.target.value)} rows={5} className="w-full rounded-xl border p-3" placeholder="Andika maoni yako hapa..."/><button disabled={busy} className="mt-3 rounded-xl bg-blue-700 px-5 py-3 font-bold text-white">Tuma maoni</button></form></section><section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="mb-3 font-bold">Maoni uliyotuma na majibu ya shule</h2>{(data.suggestions||[]).map((x)=><article key={x.id} className="border-b py-4"><div className="flex flex-wrap justify-between gap-2"><b>{x.category}</b><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">{x.status}</span></div><p className="mt-2 text-sm">{x.message}</p><small className="text-slate-500">{new Date(x.created_at).toLocaleString()}</small>{x.staff_reply&&<div className="mt-3 rounded-xl bg-emerald-50 p-3"><b className="text-sm text-emerald-900">Jibu la shule</b><p className="mt-1 text-sm text-emerald-900">{x.staff_reply}</p><small className="text-emerald-700">{x.replied_at ? new Date(x.replied_at).toLocaleString() : ""}</small></div>}</article>)}{!(data.suggestions||[]).length&&<p className="text-sm text-slate-500">Bado hujatuma maoni.</p>}</section></div>}
      </main>
    </div>
  );
}
function Summary({title,value}) { return <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{title}</p><p className="mt-2 text-xl font-black text-slate-900">{value}</p></div>; }
