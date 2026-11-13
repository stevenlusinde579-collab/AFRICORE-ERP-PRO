import React, { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import api from "../services/api";
import ParentLiveMeeting from "../components/ParentLiveMeeting";
import { StudentReportPrint } from "./examination/ResultsAnalysis";

const TOKEN_KEY = "africore_parent_portal_token";
const money = (value) => new Intl.NumberFormat("en-TZ", { style: "currency", currency: "TZS", maximumFractionDigits: 0 }).format(Number(value || 0));
const dateText = (value) => value ? new Date(value).toLocaleDateString() : "-";

export default function ParentPortal() {
  const [searchParams] = useSearchParams();
  const [schools, setSchools] = useState([]);
  const [schoolId, setSchoolId] = useState(searchParams.get("school") || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginMode, setLoginMode] = useState("parent");
  const [sponsorToken, setSponsorToken] = useState(sessionStorage.getItem("africore_sponsor_portal_token") || "");
  const [sponsorStudents, setSponsorStudents] = useState(() => { try { return JSON.parse(sessionStorage.getItem("africore_sponsor_students") || "[]"); } catch { return []; } });
  const [sponsorCenter, setSponsorCenter] = useState(() => { try { return JSON.parse(sessionStorage.getItem("africore_sponsor_center") || "null"); } catch { return null; } });
  const [token, setToken] = useState(sessionStorage.getItem(TOKEN_KEY) || "");
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [portalHome, setPortalHome] = useState(true);
  const [showSponsorStudents, setShowSponsorStudents] = useState(false);
  const [loginStudent, setLoginStudent] = useState(null);
  const [data, setData] = useState(null);
  const [groupMembers, setGroupMembers] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedExam, setSelectedExam] = useState("");
  const [selectedPublishedLetter, setSelectedPublishedLetter] = useState(null);
  const [resultData, setResultData] = useState(null);
  const [suggestion, setSuggestion] = useState("");
  const [suggestionCategory, setSuggestionCategory] = useState("General");
  const [chatMessage, setChatMessage] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [liveMeeting, setLiveMeeting] = useState(null);
  const [liveRoom, setLiveRoom] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const authConfig = useMemo(() => ({ headers: { Authorization: "Bearer " + token } }), [token]);

  const loadDashboard = async (activeToken = token) => {
    if (!activeToken) return;
    try {
      const response = await api.get("/parent-portal/dashboard", { headers: { Authorization: "Bearer " + activeToken } });
      setData(response.data);
      setGroupMembers(response.data?.group_members || []);
      const availableExams = Array.isArray(response.data?.exams) ? response.data.exams : [];
      const firstAvailableExam = availableExams[0]?.id ? String(availableExams[0].id) : "";
      setSelectedExam(firstAvailableExam);
      setResultData(null);
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
      if (loginMode === "sponsor") {
        const response = await api.post("/sponsor-portal/login", { school_id: schoolId, username, password });
        sessionStorage.setItem("africore_sponsor_portal_token", response.data.token);
        sessionStorage.setItem("africore_sponsor_students", JSON.stringify(response.data.students || []));
        sessionStorage.setItem("africore_sponsor_center", JSON.stringify(response.data.center || null));
        setSponsorToken(response.data.token); setSponsorStudents(response.data.students || []); setSponsorCenter(response.data.center || null);
        setPortalHome(true); setShowSponsorStudents(false);
        setPassword(""); setShowPassword(false); setNotice("Umeingia kama Sponsor. Chagua mwanafunzi unayetaka kuona taarifa zake.");
      } else {
        const response = await api.post("/parent-portal/login", { school_id: schoolId, username, password });
        sessionStorage.setItem(TOKEN_KEY, response.data.token);
        setLoginStudent(response.data.student || null);
        setPortalHome(true);
        setMustChangePassword(Boolean(response.data.must_change_password));
        setToken(response.data.token);
        setPassword("");
        setShowPassword(false);
        setNotice(response.data.must_change_password ? "Umeingia. Badilisha password ya awali ili kuendelea." : "Umeingia kwenye Parent Portal.");
      }
    } catch (e) { setError(e.response?.data?.message || "Username au password si sahihi."); }
    finally { setBusy(false); }
  };
  const chooseSponsorStudent = async (student) => {
    setBusy(true); setError("");
    try {
      const response = await api.post("/sponsor-portal/select-student", { student_id: student.id }, { headers: { Authorization: "Bearer " + sponsorToken } });
      sessionStorage.setItem(TOKEN_KEY, response.data.token);
      setLoginStudent(response.data.student || student);
      setPortalHome(false);
      setToken(response.data.token);
      setNotice("Unaangalia taarifa za " + student.name + ".");
    } catch (e) { setError(e.response?.data?.message || "Imeshindikana kufungua taarifa za mwanafunzi."); }
    finally { setBusy(false); }
  };
  const returnToPortalDashboard = () => {
    if (data?.portal_type === "Sponsor") {
      // End only the selected-student session; keep the Sponsor Manager session alive.
      sessionStorage.removeItem(TOKEN_KEY);
      setToken("");
      setData(null);
      setLoginStudent(null);
      setActiveTab("overview");
      setPortalHome(true);
      setShowSponsorStudents(false);
      setError("");
      setNotice("");
      return;
    }
    setPortalHome(true);
    setActiveTab("overview");
    setError("");
  };
  const signOut = () => {
    sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem("africore_sponsor_portal_token");
    sessionStorage.removeItem("africore_sponsor_students"); sessionStorage.removeItem("africore_sponsor_center");
    setToken(""); setSponsorToken(""); setSponsorStudents([]); setSponsorCenter(null); setData(null); setLoginStudent(null);
    setSelectedExam(""); setResultData(null); setMustChangePassword(false); setActiveTab("overview"); setLoginMode("parent"); setPortalHome(true); setShowSponsorStudents(false);
  };

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
    if (!token || mustChangePassword || !["finance", "overview"].includes(activeTab)) return undefined;
    // Finance figures are read from the finance schema (accounting source of truth).
    // Refresh this small portal view every second so posted receipts/charges appear promptly.
    const refresh = window.setInterval(async () => {
      try {
        const response = await api.get("/parent-portal/finance", { headers: { Authorization: "Bearer " + token } });
        setData((current) => current ? { ...current, finance: response.data.finance } : current);
      } catch (refreshError) {
        console.warn("Parent finance refresh failed:", refreshError?.response?.data?.message || refreshError?.message);
      }
    }, 1000);
    return () => window.clearInterval(refresh);
  }, [token, activeTab, mustChangePassword]);

  useEffect(() => {
    if (!token || mustChangePassword || !data?.student?.id) return undefined;
    const heartbeat = () => api.post("/parent-portal/presence/heartbeat", {}, { headers: { Authorization: "Bearer " + token } }).catch(() => {});
    heartbeat();
    const timer = window.setInterval(heartbeat, 15000);
    return () => window.clearInterval(timer);
  }, [token, mustChangePassword, data?.student?.id]);

  useEffect(() => {
    if (!token || activeTab !== "chat" || mustChangePassword) return undefined;
    const refresh = window.setInterval(() => loadDashboard(token), 3000);
    return () => window.clearInterval(refresh);
  }, [token, activeTab, mustChangePassword]);

  const joinParentLiveMeeting = async (meeting) => {
    if (!meeting?.id) return;
    setBusy(true); setError("");
    try {
      const response = await api.post("/parent-portal/meetings/" + meeting.id + "/token", {}, authConfig);
      setLiveRoom({ meeting: response.data.meeting, connectionInfo: response.data });
      setActiveTab("video");
    } catch (e) { setError(e.response?.data?.message || "Imeshindikana kujiunga na mkutano."); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!token || mustChangePassword) return undefined;
    let mounted = true;
    const refreshLiveMeeting = async () => {
      try {
        const response = await api.get("/parent-portal/meetings/active", authConfig);
        if (!mounted) return;
        const nextMeeting = response.data?.meeting || null;
        setLiveMeeting(nextMeeting);
        if (!nextMeeting) setLiveRoom(null);
      } catch (e) {
        // Keep the current room visible during a temporary network interruption.
        console.warn("Parent live meeting refresh failed:", e?.response?.data?.message || e?.message);
      }
    };
    refreshLiveMeeting();
    const timer = window.setInterval(refreshLiveMeeting, 5000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, [token, mustChangePassword]);

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
    try { await api.post("/parent-portal/suggestions", { suggestion, category: suggestionCategory }, authConfig); setSuggestion(""); setSuggestionCategory("General"); await loadDashboard(token); setNotice("Maoni yako yametumwa kwa uongozi wa shule."); }
    catch (e) { setError(e.response?.data?.message || "Imeshindikana kutuma maoni."); }
    finally { setBusy(false); }
  };
  const sendChat = async (event) => {
    event.preventDefault(); setBusy(true);
    try { await api.post("/parent-portal/chat", { message: chatMessage }, authConfig); setChatMessage(""); await loadDashboard(); }
    catch (e) { setError(e.response?.data?.message || "Imeshindikana kutuma ujumbe."); }
    finally { setBusy(false); }
  };

  if (!token && sponsorToken) return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-800">
      <header className="bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-900 text-white"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-6 md:px-6"><div><p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Sponsor Portal</p><h1 className="mt-1 text-2xl font-black">{sponsorCenter?.name || "Sponsor Centre"}</h1><p className="mt-1 text-sm text-blue-200">Karibu kwenye dashibodi ya kituo chako.</p></div><button onClick={signOut} className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10">Toka</button></div></header>
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        {error && <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {!showSponsorStudents ? <><div className="mb-6"><p className="text-sm text-slate-500">Dashboard</p><h2 className="text-2xl font-black">Muhtasari wa Sponsor Centre</h2><p className="mt-1 text-sm text-slate-500">Taarifa za wanafunzi waliopangiwa kituo hiki.</p></div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border bg-white p-6 shadow-sm"><p className="text-sm font-semibold text-slate-500">Jumla ya wanafunzi</p><p className="mt-2 text-4xl font-black text-blue-800">{sponsorStudents.length}</p></div><div className="rounded-2xl border bg-white p-6 shadow-sm"><p className="text-sm font-semibold text-slate-500">Sponsor Centre</p><p className="mt-2 text-xl font-black">{sponsorCenter?.name || "Kituo chako"}</p></div></div>
          <button type="button" onClick={()=>setShowSponsorStudents(true)} className="mt-6 rounded-xl bg-blue-700 px-6 py-3 font-bold text-white shadow-sm hover:bg-blue-800">My Students <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5">{sponsorStudents.length}</span></button>
        </> : <><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-slate-500">Sponsor Portal</p><h2 className="text-2xl font-black">My Students</h2><p className="mt-1 text-sm text-slate-500">Chagua mwanafunzi kufungua taarifa zake.</p></div><button type="button" onClick={()=>setShowSponsorStudents(false)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">← Dashboard</button></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{sponsorStudents.map((student)=><button key={student.id} disabled={busy} onClick={()=>chooseSponsorStudent(student)} className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-blue-400 hover:bg-blue-50"><b className="block">{student.name}</b><span className="mt-1 block text-xs text-slate-500">{student.admission_number || "—"} · {student.class_name}</span><span className="mt-3 inline-block text-xs font-bold text-blue-700">{busy ? "Inafungua..." : "View Student →"}</span></button>)}</div>
          {!sponsorStudents.length && <p className="mt-5 rounded-xl bg-white p-6 text-sm text-slate-500">Hakuna wanafunzi waliopangiwa kituo hiki.</p>}
        </>}
      </main>
    </div>
  );
  if (!token) return (
    <div className="min-h-screen bg-slate-950 px-4 py-12 flex items-center justify-center">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl">
        <a href="/" className="text-sm font-bold text-blue-700">← AfriCore PRO</a>
        <div className="mt-6 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-3xl">{loginMode === "parent" ? "👨‍👩‍👧" : "🏫"}</div><h1 className="mt-4 text-3xl font-black text-slate-900">{loginMode === "parent" ? "Parent Portal" : "Sponsor Portal"}</h1><p className="mt-2 text-slate-500">{loginMode === "parent" ? "Fuatilia maendeleo na taarifa za mwanafunzi wako." : "Ingia kuona wanafunzi waliopangiwa kituo chako."}</p></div>
        <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1"><button type="button" onClick={()=>{setLoginMode("parent");setError("");}} className={"rounded-lg p-2 text-sm font-bold "+(loginMode==="parent"?"bg-white shadow":"text-slate-500")}>Login as Parent</button><button type="button" onClick={()=>{setLoginMode("sponsor");setError("");}} className={"rounded-lg p-2 text-sm font-bold "+(loginMode==="sponsor"?"bg-white shadow":"text-slate-500")}>Login as Sponsor</button></div>
        {error && <div className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <form onSubmit={signIn} className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-slate-700">Shule<select required value={schoolId} onChange={(e)=>setSchoolId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3"><option value="">Chagua shule</option>{schools.map((s)=><option key={s.id} value={s.id}>{s.school_name}</option>)}</select></label>
          <label className="block text-sm font-semibold text-slate-700">{loginMode === "parent" ? "Username — Jina kamili la mwanafunzi" : "Username — Email ya msimamizi"}<input required value={username} onChange={(e)=>setUsername(e.target.value)} autoComplete="username" className="mt-1 w-full rounded-xl border border-slate-300 p-3" placeholder={loginMode === "parent" ? "Mfano: Amina John Peter" : "name@example.com"}/></label>
          <label className="block text-sm font-semibold text-slate-700">Password
            <div className="relative mt-1">
              <input required type={showPassword ? "text" : "password"} value={password} onChange={(e)=>setPassword(e.target.value)} autoComplete="current-password" className="w-full rounded-xl border border-slate-300 p-3 pr-12" placeholder={loginMode === "parent" ? "Admission Number" : "Password ya Sponsor"}/>
              <button type="button" onClick={()=>setShowPassword((visible)=>!visible)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-slate-500 hover:text-blue-700">
                {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
              </button>
            </div>
          </label>
          <button disabled={busy} className="w-full rounded-xl bg-blue-700 p-3 font-bold text-white disabled:opacity-60">{busy ? "Inaingia..." : loginMode === "parent" ? "Ingia Parent Portal" : "Ingia Sponsor Portal"}</button>
        </form>
        {loginMode === "parent" && <p className="mt-5 text-xs leading-relaxed text-slate-500">Kila mwanafunzi ana akaunti yake. Ikiwa hujapokea SMS ya kuingia, wasiliana na ofisi ya shule ili watume tena taarifa zako.</p>}
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

  if (!data) return <div className="min-h-screen bg-slate-50 p-10 text-center"><p className="font-semibold text-slate-700">Inapakia Parent Portal...</p>{error && <div className="mx-auto mt-4 max-w-lg rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}</div>;
  // Prepare portal data before rendering either dashboard or student details.
  // The parent dashboard also uses these values, so declaring them below the
  // dashboard branch caused a temporal-dead-zone runtime error and a blank page.
  const { student = loginStudent || {}, finance = {} } = data || {};
  if (portalHome && !mustChangePassword) return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-800">
      <header className="bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-900 text-white"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-6 md:px-6"><div><p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Parent Portal</p><h1 className="mt-1 text-2xl font-black">{student.school_name || "Shule"}</h1><p className="mt-1 text-sm text-blue-200">Karibu, {student.name}</p></div><button onClick={signOut} className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10">Toka</button></div></header>
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        {notice && <div className="mb-4 rounded-xl bg-emerald-50 p-3 text-emerald-800">{notice}</div>}
        {error && <div className="mb-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</div>}
        <div className="mb-6"><p className="text-sm text-slate-500">Dashboard</p><h2 className="text-2xl font-black">Muhtasari wa mzazi</h2><p className="mt-1 text-sm text-slate-500">Fuatilia taarifa za mtoto wako kupitia sehemu zilizo hapa chini.</p></div>
        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-blue-700">My Child</p><h3 className="mt-2 text-xl font-black">{student.name}</h3><p className="mt-1 text-sm text-slate-500">{student.admission_number || "—"} · {student.class_name || "Darasa halijaainishwa"}</p><button type="button" onClick={()=>setPortalHome(false)} className="mt-4 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white">View Child Information →</button></section>
        <div className="grid gap-4 sm:grid-cols-3"><Summary title="Ada zilizopangiwa" value={money(finance.total_charged)}/><Summary title="Zilizolipwa" value={money(finance.total_paid)}/><Summary title="Salio" value={money(finance.balance)}/></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[["finance","Finance","Angalia ada, malipo na salio."],["results","Matokeo","Fuatilia matokeo ya mitihani."],["attendance","Mahudhurio","Angalia mahudhurio ya mwanafunzi."],["communication","Mawasiliano","Pata taarifa kutoka shuleni."],["chat","Group Chat","Wasiliana na shule na kundi husika."],["video","Video Conference","Jiunge na mikutano ya shule."],["suggestions","Maoni","Tuma maoni kwa uongozi wa shule."],["reports","Reports","Soma barua rasmi zilizochapishwa na shule."]].map(([tab,label,description])=><button key={tab} type="button" onClick={()=>{setActiveTab(tab);setPortalHome(false);}} className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-blue-300 hover:bg-blue-50"><b className="block">{label}</b><span className="mt-1 block text-sm text-slate-500">{description}</span></button>)}</div>
      </main>
    </div>
  );
  const tabs = [["overview","Muhtasari"],["finance","Finance"],["results","Matokeo"],["communication","Mawasiliano"],["video","Video Conference"],["chat","Group Chat"],["attendance","Mahudhurio"],...(data.portal_type === "Sponsor" ? [] : [["suggestions","Maoni"]]),["reports","Reports"]];
  const attendanceRows = Array.isArray(data.attendance) ? data.attendance : [];
  const attendanceStats = attendanceRows.reduce((stats, row) => { stats[attendanceBucket(row.status)] += 1; return stats; }, { present: 0, absent: 0, late: 0, other: 0 });
  const attendanceRate = attendanceRows.length ? Math.round(((attendanceStats.present + attendanceStats.late) / attendanceRows.length) * 100) : 0;
  const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
  const publishedLetters = Array.isArray(data.published_letters) ? data.published_letters : [];
  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-800">
      <header className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-900 text-white"><div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-cyan-400/10 blur-2xl"/><div className="relative mx-auto flex max-w-7xl items-center justify-between px-4 py-6 md:px-6"><div><div className="text-xl font-black tracking-tight">{student.school_name || "Shule"} <span className="text-cyan-300">{data.portal_type === "Sponsor" ? "SPONSOR PORTAL" : "PARENT PORTAL"}</span></div><p className="mt-3 text-xs text-blue-200">{data.portal_type === "Sponsor" ? (data.sponsor_center_name || "Sponsor Centre") + " · Taarifa za wanafunzi waliopangiwa" : "Taarifa za mwanafunzi · Mawasiliano ya shule · Maendeleo ya kitaaluma"}</p></div><div className="flex gap-2"><button onClick={returnToPortalDashboard} className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20">Dashboard</button><button onClick={signOut} className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20">Toka</button></div></div></header>
      <main className="mx-auto max-w-7xl px-4 py-7 md:px-6">
        {notice && <div className="mb-4 rounded-xl bg-emerald-50 p-3 text-emerald-800">{notice}</div>}
        {error && <div className="mb-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</div>}
        {data.must_change_password && <form onSubmit={changePassword} className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-5"><h2 className="font-bold text-amber-900">Badilisha password ya awali</h2><p className="mt-1 text-sm text-amber-800">Kwa usalama, unatakiwa kubadilisha admission number kabla ya kuendelea kutumia portal.</p><div className="mt-3 grid gap-3 md:grid-cols-3"><input type="password" required value={currentPassword} onChange={(e)=>setCurrentPassword(e.target.value)} placeholder="Password ya sasa" className="rounded-lg border p-3"/><input type="password" required minLength={8} value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} placeholder="Password mpya (angalau herufi 8)" className="rounded-lg border p-3"/><button disabled={busy} className="rounded-lg bg-amber-700 p-3 font-bold text-white">Badilisha password</button></div></form>}
        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-slate-500">Mwanafunzi</p><h1 className="text-2xl font-black">{student.name}</h1><p className="mt-1 text-sm text-slate-500">{student.admission_number} · {student.class_name}</p></div><div className="rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">{student.status || "Active"}</div></div></section>
        <nav className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">{tabs.map(([key,label])=><button key={key} onClick={()=>setActiveTab(key)} className={"rounded-xl px-4 py-2.5 text-sm font-semibold transition "+(activeTab===key?"bg-blue-700 text-white shadow":"text-slate-600 hover:bg-slate-100")}>{label}</button>)}</nav>
        {activeTab==="overview" && <div className="space-y-4">
          {liveMeeting && <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm"><div className="min-w-0"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-rose-700"><span className="h-2 w-2 animate-pulse rounded-full bg-rose-600"/> Mkutano LIVE sasa</div><h2 className="mt-2 text-lg font-black text-slate-900">{liveMeeting.title}</h2><p className="mt-1 text-xs text-slate-600">Uongozi wa shule unaendesha mkutano huu sasa.</p></div><button type="button" disabled={busy} onClick={() => joinParentLiveMeeting(liveMeeting)} className="shrink-0 rounded-xl bg-rose-600 px-6 py-3 text-sm font-black text-white shadow-sm hover:bg-rose-700 disabled:opacity-50">{busy ? "Inaingia..." : "Join Meeting"}</button></section>}
          <div className="grid gap-4 md:grid-cols-3"><Summary title="Ada zilizopangiwa" value={money(finance.total_charged)}/><Summary title="Zilizolipwa" value={money(finance.total_paid)}/><Summary title="Salio" value={money(finance.balance)}/></div>
        </div>}
        {activeTab==="finance" && <div className="space-y-6">
          <section className="relative isolate overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 p-6 text-white shadow-xl md:p-8">
            <div className="pointer-events-none absolute -right-16 -top-20 -z-10 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl"/>
            <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-cyan-300">Student account · Finance</p><h2 className="mt-2 text-2xl font-black md:text-3xl">Muhtasari wa fedha</h2><p className="mt-2 text-sm text-blue-100">Taarifa za akaunti kutoka idara ya uhasibu wa shule.</p></div><span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">● Taarifa za sasa</span></div>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <FinanceMetric label="Jumla ya gharama" value={money(finance.total_charged)} detail="Ada na michango iliyopangiwa" icon="▤"/>
              <FinanceMetric label="Jumla iliyolipwa" value={money(finance.total_paid)} detail="Malipo yaliyorekodiwa" icon="✓"/>
              <FinanceMetric label="Salio linalodaiwa" value={money(finance.balance)} detail="Kiasi kilichobaki" icon="◷" accent/>
            </div>
          </section>
          <section className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">Ada na michango</h3><p className="mt-1 text-xs text-slate-500">Mgawanyo wa gharama, malipo na salio</p></div><span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{(finance.charges || []).length} rekodi</span></div></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Aina ya gharama</th><th className="px-4 py-3 text-right">Kiasi</th><th className="px-4 py-3 text-right">Imelipwa</th><th className="px-4 py-3 text-right">Salio</th><th className="px-5 py-3">Hali</th></tr></thead><tbody>{(finance.charges || []).map((x)=><tr key={x.id} className="border-t border-slate-100 hover:bg-slate-50/70"><td className="px-5 py-4"><p className="font-semibold text-slate-800">{x.description || "Ada / mchango"}</p><p className="mt-1 text-[11px] text-slate-400">{x.due_date ? "Mwisho: "+dateText(x.due_date) : x.term_number ? "Muhula "+x.term_number : "Taarifa ya akaunti"}</p></td><td className="px-4 py-4 text-right font-medium tabular-nums">{money(x.amount)}</td><td className="px-4 py-4 text-right font-medium tabular-nums text-emerald-700">{money(x.paid_amount)}</td><td className="px-4 py-4 text-right font-bold tabular-nums text-slate-900">{money(x.balance)}</td><td className="px-5 py-4"><StatusPill value={x.status}/></td></tr>)}</tbody></table></div>
              {!(finance.charges || []).length && <EmptyState title="Hakuna gharama zilizorekodiwa" detail="Ada au michango itakayoingizwa na idara ya uhasibu itaonekana hapa."/>}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">Historia ya malipo</h3><p className="mt-1 text-xs text-slate-500">Risiti na miamala ya mwanafunzi</p></div><span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{(finance.payments || []).length} malipo</span></div>
              <div className="mt-4 space-y-3">{(finance.payments || []).map((p)=><article key={p.id} className="flex gap-3 rounded-xl border border-slate-100 p-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-lg text-emerald-700">✓</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-bold text-slate-800">{p.payment_number || p.reference_number || "Malipo yaliyopokelewa"}</p><p className="mt-1 text-xs text-slate-500">{dateText(p.payment_date)} · {p.payment_method || "Njia haijaainishwa"}</p></div><b className="text-sm tabular-nums text-emerald-700">{money(p.amount)}</b></div>{p.description && <p className="mt-2 text-xs text-slate-500">{p.description}</p>}<div className="mt-2"><StatusPill value={p.status || "Recorded"}/></div></div></article>)}</div>
              {!(finance.payments || []).length && <EmptyState title="Hakuna malipo yaliyopokelewa" detail="Malipo yakirekodiwa na mhasibu yataonekana kwenye historia hii."/>}
            </div>
          </section>
        </div>}
        {activeTab==="results" && <section className="space-y-4"><div className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="mb-3 font-bold">Matokeo ya mwanafunzi — Report Form</h2><select value={selectedExam} onChange={(e)=>loadResults(e.target.value)} className="w-full max-w-md rounded-xl border p-3" disabled={!data.exams?.length}><option value="">{data.exams?.length ? "Chagua ripoti ya mwanafunzi" : "Hakuna ripoti iliyochapishwa kwa mwanafunzi huyu"}</option>{(data.exams || []).map((e)=><option key={e.id} value={e.id}>{e.exam_name} {e.term ? "· "+e.term : ""}</option>)}</select>{!data.exams?.length && <p className="mt-2 text-sm text-slate-500">Ripoti zitaonekana hapa shule itakapochapisha matokeo ya mwanafunzi huyu.</p>}{resultData?.result_status === "published" && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Report form rasmi imechapishwa na shule. Tarehe: {dateText(resultData.published_at)}</div>}{resultData?.result_status === "pending_approval" && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">Alama zinasubiri idhini ya shule.</div>}</div>
          {resultData?.result?.report_form ? <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"><div className="mx-auto min-w-[760px] max-w-5xl border border-slate-300 bg-white"><StudentReportPrint exam={resultData.exam} report={resultData.result.report_form} isCseeExam={Boolean(resultData.result.report_form.isCseeExam)} isAlevel={Boolean(resultData.result.report_form.isAlevel)} examGradingScales={resultData.result.report_form.examGradingScales || []} schoolName={student.school_name} hideFinalClassification /></div></div> : resultData?.result ? <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold">Muhtasari wa matokeo</h3><div className="mt-3 grid gap-3 md:grid-cols-4"><Summary title="Jumla" value={resultData.result.total_marks}/><Summary title="Wastani" value={resultData.result.average_marks}/><Summary title="Grade" value={resultData.result.grade}/><Summary title="Division" value={resultData.result.division}/></div><p className="mt-3 text-sm text-amber-700">Report form ya muundo mpya haikuhifadhiwa kwenye chapisho hili la zamani.</p></div> : selectedExam && resultData && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Hakuna report form iliyopatikana kwa mtihani huu.</p>}
          {selectedExam && !resultData && <p className="text-sm text-slate-500">Inapakia report form...</p>}</section>}
        {activeTab==="communication" && <div className="space-y-4"><section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="mb-3 font-bold">Ujumbe kutoka shule</h2>{data.communications.map((m)=><article key={m.id} className="border-b py-3"><div className="flex justify-between gap-2"><b>{m.subject || m.channel}</b><small>{dateText(m.sent_at || m.created_at)}</small></div><p className="mt-1 text-sm">{m.message}</p><small className="text-slate-500">{m.channel} · {m.status}</small></article>)}{!data.communications.length&&<p className="text-sm text-slate-500">Hakuna ujumbe uliohifadhiwa.</p>}</section><section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="mb-3 font-bold">Mikutano na video conference</h2>{data.meetings.map((m)=><article key={m.id} className="border-b py-3"><b>{m.title}</b><p className="text-sm text-slate-600">{m.description}</p><p className="text-xs text-slate-500">{new Date(m.starts_at).toLocaleString()} {m.ends_at ? " - " + new Date(m.ends_at).toLocaleTimeString() : ""}</p>{m.meeting_url&&<a className="mt-2 inline-block text-blue-700 underline" href={m.meeting_url} target="_blank" rel="noreferrer">Jiunge na video conference</a>}</article>)}{!data.meetings.length&&<p className="text-sm text-slate-500">Hakuna mikutano iliyopangwa.</p>}</section></div>}
        {activeTab==="video" && <section className="space-y-5">
          {liveRoom ? (
            <ParentLiveMeeting
              meeting={liveRoom.meeting}
              connectionInfo={liveRoom.connectionInfo}
              authToken={token}
              onLeave={() => setLiveRoom(null)}
            />
          ) : (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-xl md:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">AfriCore · Parent Connect</p><h2 className="mt-2 text-2xl font-black md:text-3xl">Video Conference</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Jiunge moja kwa moja na mkutano wa shule pale uongozi utakapoanzisha mkutano LIVE.</p></div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300">{liveMeeting ? "● LIVE NOW" : "Hakuna mkutano LIVE"}</span>
              </div>
              {liveMeeting ? (
                <article className="mt-6 rounded-2xl border border-rose-300/30 bg-rose-400/10 p-5">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-rose-200"><span className="h-2 w-2 animate-pulse rounded-full bg-rose-400"/> Mkutano unaendelea sasa</div>
                  <h3 className="mt-3 text-xl font-black">{liveMeeting.title}</h3>
                  {liveMeeting.description && <p className="mt-2 text-sm text-slate-300">{liveMeeting.description}</p>}
                  <p className="mt-2 text-xs text-slate-400">Umeanzishwa: {new Date(liveMeeting.starts_at).toLocaleString()}</p>
                  <button type="button" disabled={busy} onClick={() => joinParentLiveMeeting(liveMeeting)} className="mt-5 rounded-xl bg-cyan-300 px-7 py-3.5 text-sm font-black text-slate-950 shadow-lg transition hover:bg-cyan-200 disabled:opacity-50">{busy ? "Inaingia kwenye mkutano..." : "Join Meeting"}</button>
                </article>
              ) : (
                <div className="mt-6 rounded-2xl border border-dashed border-white/15 bg-white/[.04] p-8 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-3xl">🎥</div><h3 className="mt-4 text-lg font-bold">Hakuna mkutano unaoendelea</h3><p className="mt-2 text-sm text-slate-400">Uongozi wa shule utakapoanzisha mkutano, kichwa chake na kitufe cha Join Meeting vitaonekana hapa moja kwa moja.</p></div>
              )}
            </div>
          )}
        </section>}
        {activeTab==="chat" && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 px-5 py-4 text-white"><div><h2 className="font-bold">Kundi la wazazi · {student.class_name}</h2><p className="mt-1 text-xs text-slate-300">Mawasiliano ya wazazi na shule kwa darasa hili</p></div><span className="rounded-full bg-white/10 px-3 py-1 text-xs">{groupMembers.length} wanachama</span></div><div className="grid md:grid-cols-[220px_1fr]"><aside className="border-b bg-slate-50 p-4 md:border-b-0 md:border-r"><h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Wanachama wa kundi</h3><div className="space-y-3">{groupMembers.map((member)=><div key={(member.member_type || "parent")+"-"+(member.student_id || member.user_id || member.member_name)} className="flex items-center gap-2"><div className={"flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold "+(member.member_type==="staff"?"bg-violet-100 text-violet-700":"bg-blue-100 text-blue-700")}>{(member.member_name || member.parent_name || "M").slice(0,1).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800">{member.member_name || member.parent_name}</p><p className="truncate text-[11px] text-slate-400">{member.member_type==="staff" ? "Staff wa shule" : "Mzazi · "+(member.student_name || "")}</p><span className={"mt-1 inline-flex items-center gap-1 text-[10px] "+(member.online?"text-emerald-600":"text-slate-400")}><i className={"h-1.5 w-1.5 rounded-full "+(member.online?"bg-emerald-500":"bg-slate-300")}/>{member.online?"Online":"Offline"}</span></div></div>)}{!groupMembers.length&&<p className="text-xs text-slate-500">Orodha ya wanachama haipatikani.</p>}</div></aside><div className="min-w-0 bg-[#f0f2ed] p-4"><div className="max-h-[440px] min-h-[260px] space-y-3 overflow-y-auto rounded-xl p-2">{data.chat.map((m)=><div key={m.id} className={"flex "+(m.sender_type==="parent"?"justify-end":"justify-start")}><article className={"max-w-[85%] rounded-2xl px-4 py-3 shadow-sm "+(m.sender_type==="parent"?"rounded-br-sm bg-[#d9fdd3]":"rounded-bl-sm bg-white")}><b className="text-xs text-slate-700">{m.sender_name}</b><p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">{m.message}</p><small className="mt-1 block text-right text-[10px] text-slate-400">{new Date(m.created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</small></article></div>)}{!data.chat.length&&<p className="py-16 text-center text-sm text-slate-500">Karibu. Hakuna ujumbe bado.</p>}</div><form onSubmit={sendChat} className="mt-3 flex gap-2 rounded-xl bg-white p-2"><input value={chatMessage} onChange={(e)=>setChatMessage(e.target.value)} required maxLength={4000} placeholder="Andika ujumbe kwa kundi..." className="min-w-0 flex-1 border-0 p-2 text-sm outline-none"/><button disabled={busy} className="rounded-lg bg-emerald-600 px-5 font-bold text-white disabled:opacity-50">Tuma</button></form></div></div></section>}
        {activeTab==="attendance" && <div className="space-y-5">
          <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-r from-indigo-950 via-blue-950 to-slate-900 p-6 text-white shadow-lg md:p-8"><div className="absolute -right-12 -top-16 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl"/><div className="relative flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Student attendance record</p><h2 className="mt-2 text-2xl font-black md:text-3xl">Muhtasari wa mahudhurio</h2><p className="mt-2 text-sm text-blue-100">Rekodi za mahudhurio zilizoingizwa na shule kwa mwanafunzi huyu.</p></div><div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 backdrop-blur"><p className="text-xs text-blue-100">Mahudhurio ya kushiriki</p><p className="mt-1 text-3xl font-black">{attendanceRate}%</p></div></div></section>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><AttendanceMetric label="Alikuwepo" value={attendanceStats.present} tone="green"/><AttendanceMetric label="Hakuwepo" value={attendanceStats.absent} tone="red"/><AttendanceMetric label="Alichelewa" value={attendanceStats.late} tone="amber"/><AttendanceMetric label="Nyingine" value={attendanceStats.other} tone="slate"/></div>
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h3 className="font-bold text-slate-900">Historia ya mahudhurio</h3><p className="mt-1 text-xs text-slate-500">Rekodi {attendanceRows.length} · Zinaonyeshwa kuanzia tarehe la karibuni</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Rekodi za shule</span></div>
            <div className="divide-y divide-slate-100">{attendanceRows.map((a)=><article key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50/70"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-lg text-blue-700">▦</span><div><p className="text-sm font-semibold text-slate-800">{dateText(a.attendance_date)}</p><p className="mt-1 text-xs text-slate-500">{a.remarks || "Rekodi ya mahudhurio"}</p></div></div><StatusPill value={a.status}/></article>)}</div>
            {!attendanceRows.length && <EmptyState title="Hakuna rekodi za mahudhurio" detail="Mahudhurio yataonekana hapa baada ya mwalimu au shule kurekodi roll call."/>}
          </section>
        </div>}
        {activeTab==="reports" && <section className="space-y-4">
          <div className="rounded-2xl bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-900 p-6 text-white"><p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Parent & Sponsor Portal</p><h2 className="mt-2 text-2xl font-black">Reports & Letters</h2><p className="mt-2 text-sm text-blue-100">Barua rasmi zilizochapishwa na shule kwa mwanafunzi huyu.</p><p className="mt-3 text-xs text-blue-200">{student.name} · {student.admission_number || "—"} · {student.class_name || "—"}</p></div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {publishedLetters.map(letter=><div key={letter.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 last:border-b-0">
              <div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-wider text-blue-700">{letter.letter_type==="official_letter"?"Official Letter":letter.letter_type==="annual_fee_guidance"?"Annual Fee Guidance":"Fee Reminder"}</p><h3 className="mt-1 truncate font-extrabold text-slate-900">{letter.title}</h3><p className="mt-1 text-xs text-slate-500">Imechapishwa: {dateText(letter.published_at)}</p></div>
              <button type="button" onClick={()=>setSelectedPublishedLetter(letter)} className="shrink-0 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800">View</button>
            </div>)}
            {!publishedLetters.length&&<div className="p-6"><EmptyState title="Hakuna barua zilizochapishwa" detail="Barua za mwanafunzi huyu zitaonekana hapa baada ya shule kuchagua Publish to Parent Portal."/></div>}
          </div>
          {selectedPublishedLetter && (()=>{const letter=selectedPublishedLetter;const p=letter.payload||{};const s=p.student||{};const schoolInfo=p.school||{};const official=letter.letter_type==="official_letter";const guidance=letter.letter_type==="annual_fee_guidance";return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={letter.title}>
            <div className="flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b bg-slate-50 px-5 py-4"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-700">{official?"Official Letter":guidance?"Annual Fee Guidance":"Fee Reminder"}</p><h3 className="font-extrabold text-slate-900">{letter.title}</h3></div><div className="flex gap-2"><button type="button" onClick={()=>window.print()} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold">Print</button><button type="button" onClick={()=>setSelectedPublishedLetter(null)} className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold text-white">Close</button></div></div>
              <div className="overflow-y-auto p-6 text-sm text-slate-800">
                <header className="mb-5 border-b-2 border-slate-800 pb-4 text-center">{schoolInfo.logo&&<img src={schoolInfo.logo} alt="" className="mx-auto mb-2 h-14 w-14 object-contain"/>}<h4 className="font-black uppercase">{schoolInfo.name||student.school_name}</h4><p className="text-xs text-slate-500">{[schoolInfo.address,schoolInfo.phone,schoolInfo.email].filter(Boolean).join(" · ")}</p></header>
                {official?<><div className="grid gap-3 text-xs sm:grid-cols-2"><p><b>Kumb. Na:</b> {p.reference||"—"}</p><p><b>Tarehe:</b> {p.date||dateText(letter.published_at)}</p><p className="whitespace-pre-wrap"><b>Kwa:</b> {p.recipient_name||"Mzazi/Mlezi"}{"\n"}{p.recipient_address||""}</p><p className="whitespace-pre-wrap"><b>Kutoka:</b> {p.sender_address||""}</p></div><h4 className="my-6 text-center font-extrabold underline">YAH: {p.subject||letter.title}</h4><div className="whitespace-pre-wrap text-justify leading-7">{p.body}</div><div className="mt-8"><p>Wako katika huduma,</p><div className="mt-12 w-72 border-t border-slate-800 pt-2"><b>{p.author_name}</b><p>{p.author_title}</p><p className="mt-1">Simu: {p.author_phone}</p><p className="mt-7">Saini: ______________________________</p></div></div></>:<><div className="grid gap-1 text-xs sm:grid-cols-2"><p><b>Kumb. Na:</b> {p.reference||"—"}</p><p><b>Tarehe:</b> {dateText(letter.published_at)}</p><p><b>Kwa:</b> {s.guardian_name||"Mzazi/Mlezi"}</p><p><b>Mwanafunzi:</b> {s.name||student.name}</p><p><b>Namba:</b> {s.admission_number||student.admission_number}</p><p><b>Darasa:</b> {s.class_name||student.class_name}</p></div>
                  {guidance?<><h4 className="my-4 text-center font-extrabold underline">MWONGOZO WA ADA NA MICHANGO · {p.year_name||""}</h4><p className="whitespace-pre-wrap">{p.intro}</p><p className="my-3">Mwongozo wa ada na michango kwa mwaka wa masomo {p.year_name}.</p><div className="overflow-x-auto"><table className="w-full border-collapse text-xs"><thead><tr>{["Ada/Mchango","Aina","Muhula 1","Muhula 2","Muhula 3"].map(x=><th key={x} className="border p-2 text-left">{x}</th>)}</tr></thead><tbody>{(p.items||[]).map((x,i)=><tr key={i}><td className="border p-2">{x.name}</td><td className="border p-2">{x.category}</td><td className="border p-2">{money(x.term1)}</td><td className="border p-2">{money(x.term2)}</td><td className="border p-2">{money(x.term3)}</td></tr>)}</tbody></table></div><p className="mt-3 font-bold">Jumla ya mwaka: TZS {money((p.totals?.term1||0)+(p.totals?.term2||0)+(p.totals?.term3||0))}</p><p className="mt-3">Tarehe ya kufunga: {p.closing_date||"Itatangazwa"} · Tarehe ya kufungua: {p.reopening_date||"Itatangazwa"}</p><p className="mt-3 whitespace-pre-wrap">{p.extra_message}</p></>:<><h4 className="my-4 text-center font-extrabold underline">UKUMBUSHO WA MALIPO YA ADA NA MADENI YA SHULE</h4><p>Mzazi/Mlezi, mwanafunzi ana salio la ada/michango kama ilivyo hapa chini.</p><div className="mt-3 overflow-x-auto"><table className="w-full border-collapse text-xs"><thead><tr>{["Ada/Mchango","Mwaka","Kiasi","Kilicholipwa","Salio"].map(x=><th key={x} className="border p-2 text-left">{x}</th>)}</tr></thead><tbody>{(p.charges||[]).map((x,i)=><tr key={i}><td className="border p-2">{x.fee_name}</td><td className="border p-2">{x.academic_year_name}</td><td className="border p-2">{money(x.amount)}</td><td className="border p-2">{money(x.paid_amount)}</td><td className="border p-2">{money(x.balance)}</td></tr>)}</tbody></table></div><p className="mt-3 font-bold">Jumla inayodaiwa: TZS {money(p.total_balance)}</p><div className="mt-3 rounded-xl border p-3"><b>Taarifa za malipo</b>{p.payment_method==="bank"?<p>{p.bank_name} · {p.bank_account_name} · {p.bank_account_number}</p>:<p>{p.mobile_network} · {p.mobile_number} · {p.mobile_recipient_name}</p>}<p className="mt-2 whitespace-pre-wrap">{p.payment_instructions}</p></div></>}
                  <div className="mt-6 border-t pt-3 text-xs"><b>{p.accountant_name||"Ofisi ya Uhasibu"}</b><p>Muhasibu wa Shule · {p.accountant_phone||""}</p></div></>}
              </div>
            </div>
          </div>;})()}
        </section>}
        {activeTab==="suggestions" && <div className="space-y-5">
          <section className="relative isolate overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-900 p-6 text-white shadow-xl md:p-8"><div className="pointer-events-none absolute -right-16 -top-16 -z-10 h-64 w-64 rounded-full bg-fuchsia-400/15 blur-3xl"/><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Parent feedback centre</p><div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-2xl font-black md:text-3xl">Maoni na mrejesho</h2><p className="mt-2 max-w-2xl text-sm text-blue-100">Wasilisha ushauri, swali au changamoto kwa uongozi wa shule na fuatilia majibu hapa.</p></div><div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3"><p className="text-xs text-blue-100">Maoni uliyowasilisha</p><p className="mt-1 text-3xl font-black">{suggestions.length}</p></div></div></section>
          <section className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-xl text-indigo-700">✎</span><div><h3 className="font-bold text-slate-900">Tuma maoni mapya</h3><p className="mt-1 text-xs text-slate-500">Ujumbe wako utafikishwa kwa uongozi wa shule.</p></div></div>
              <form onSubmit={submitSuggestion} className="mt-5 space-y-4"><label className="block text-sm font-semibold text-slate-700">Aina ya maoni<select value={suggestionCategory} onChange={(e)=>setSuggestionCategory(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"><option value="General">Ujumbe wa jumla</option><option value="Academic">Masomo na maendeleo</option><option value="Attendance">Mahudhurio</option><option value="Finance">Ada na malipo</option><option value="Welfare">Ustawi na nidhamu</option><option value="Complaint">Malalamiko</option><option value="Suggestion">Ushauri / pendekezo</option></select></label>
                <label className="block text-sm font-semibold text-slate-700">Ujumbe wako<textarea required minLength={5} maxLength={4000} value={suggestion} onChange={(e)=>setSuggestion(e.target.value)} rows={6} className="mt-2 w-full resize-y rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Eleza jambo unalotaka shule ifahamu..."/></label><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-slate-400">{suggestion.length}/4000 herufi</span><button disabled={busy || suggestion.trim().length<5} className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Inatuma..." : "Tuma maoni  →"}</button></div>
              </form>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">Historia ya maoni</h3><p className="mt-1 text-xs text-slate-500">Hali ya maoni na majibu kutoka shuleni</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{suggestions.length} ujumbe</span></div>
              <div className="mt-5 space-y-4">{suggestions.map((x)=><article key={x.id} className="rounded-xl border border-slate-100 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-bold text-slate-800">{x.category || "Ujumbe wa jumla"}</p><p className="mt-1 text-xs text-slate-400">{x.created_at ? new Date(x.created_at).toLocaleString() : "—"}</p></div><StatusPill value={x.status}/></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{x.message}</p>
                {x.staff_reply ? <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4"><div className="flex items-center gap-2 text-sm font-bold text-emerald-900"><span>✓</span> Jibu kutoka shuleni</div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-emerald-900">{x.staff_reply}</p><p className="mt-2 text-[11px] text-emerald-700">{x.replied_at ? new Date(x.replied_at).toLocaleString() : ""}</p></div> : <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Shule bado haijajibu maoni haya.</div>}
              </article>)}</div>
              {!suggestions.length && <EmptyState title="Bado hujawasilisha maoni" detail="Maoni utakayotuma yataonekana hapa pamoja na majibu ya shule."/>}
            </div>
          </section>
        </div>}
      </main>
    </div>
  );
}
function Summary({title,value}) { return <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{title}</p><p className="mt-2 text-xl font-black text-slate-900">{value}</p></div>; }
function attendanceBucket(status) {
  const value = String(status || "").toLowerCase();
  if (value.includes("present") || value.includes("attended") || value.includes("po")) return "present";
  if (value.includes("absent") || value.includes("missing") || value.includes("hakuwepo")) return "absent";
  if (value.includes("late") || value.includes("chelewa")) return "late";
  return "other";
}
function StatusPill({value}) {
  const status = String(value || "Haijaainishwa");
  const key = status.toLowerCase();
  const tone = ["paid","complete","completed","settled","approved","responded","resolved","present","recorded"].some((x)=>key.includes(x))
    ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
    : ["partial","pending","under_review","under review","late"].some((x)=>key.includes(x))
      ? "bg-amber-50 text-amber-700 ring-amber-100"
      : ["unpaid","overdue","absent","rejected","declined"].some((x)=>key.includes(x))
        ? "bg-rose-50 text-rose-700 ring-rose-100" : "bg-slate-100 text-slate-600 ring-slate-200";
  return <span className={"inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset "+tone}>{status.replaceAll("_"," ")}</span>;
}
function FinanceMetric({label,value,detail,icon,accent}) {
  return <div className={"rounded-2xl border p-4 "+(accent?"border-amber-300/20 bg-amber-300/10":"border-white/10 bg-white/[.07]")}><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-blue-100">{label}</p><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-lg">{icon}</span></div><p className="mt-3 text-xl font-black tabular-nums md:text-2xl">{value}</p><p className="mt-1 text-[11px] text-blue-100/80">{detail}</p></div>;
}
function AttendanceMetric({label,value,tone}) {
  const colors = {green:"border-emerald-100 bg-emerald-50 text-emerald-700",red:"border-rose-100 bg-rose-50 text-rose-700",amber:"border-amber-100 bg-amber-50 text-amber-700",slate:"border-slate-200 bg-slate-50 text-slate-700"};
  return <div className={"rounded-2xl border p-5 "+colors[tone]}><p className="text-sm font-semibold">{label}</p><p className="mt-2 text-3xl font-black tabular-nums">{value}</p><p className="mt-1 text-[11px] opacity-70">Rekodi</p></div>;
}
function EmptyState({title,detail}) {
  return <div className="flex flex-col items-center justify-center px-5 py-10 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl text-slate-400">▤</span><p className="mt-3 text-sm font-bold text-slate-700">{title}</p><p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{detail}</p></div>;
}
