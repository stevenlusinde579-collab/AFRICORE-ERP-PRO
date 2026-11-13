import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import ParentLiveMeeting from "../components/ParentLiveMeeting";
import { useSchool } from "../context/SchoolContext";
import { useRole } from "../context/RoleContext";

function normalizeParentIdentity(parent) {
  let phone = String(parent.phone || "").replace(/\D/g, "");
  if (phone.startsWith("0")) phone = "255" + phone.slice(1);
  else if (/^[67]/.test(phone)) phone = "255" + phone;
  if (phone) return "phone:" + phone;
  const email = String(parent.email || "").trim().toLowerCase();
  if (email) return "email:" + email;
  const name = String(parent.parent_name || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!name || name === "not provided") return null;
  return "name:" + name;
}

function normalizeClassLabel(name) {
  const roman = { i: "1", ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7" };
  return String(name || "").normalize("NFKC").toLowerCase()
    .replace(/\b(standard|std|form)\s+(vii|vi|iv|iii|ii|i)\b/g, (_match, level, numeral) => level + " " + roman[numeral])
    .replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function uniqueClassOptions(rows = []) {
  const unique = new Map();
  rows.forEach((item) => {
    const key = normalizeClassLabel(item.class_name) || "class-id:" + String(item.id);
    const current = unique.get(key);
    const score = (row) => [
      row.is_active === true ? 1 : 0,
      Number(row.student_count || 0),
      Number(row.id || 0),
    ];
    const candidateScore = score(item);
    const currentScore = current ? score(current) : [];
    if (!current || candidateScore.some((value, index) => value > currentScore[index] && candidateScore.slice(0, index).every((v, j) => v === currentScore[j]))) {
      unique.set(key, item);
    }
  });
  return [...unique.values()];
}

function classOrder(name) {
  const value = String(name || "").toLowerCase().replace(/[_-]+/g, " ").trim();
  if (/\bbaby\b/.test(value)) return 0;
  if (/\bnursery\b/.test(value)) return 10;
  if (/\b(kg|kindergarten)\b/.test(value)) return 20;
  if (/\b(pre primary|preprimary|pre unit)\b/.test(value)) return 30;
  const roman = "(vi|v|iv|iii|ii|i|[1-7])";
  const standard = value.match(new RegExp("\b(?:standard|std)\s*" + roman));
  if (standard) {
    const token = standard[1];
    const number = /^[1-7]$/.test(token) ? Number(token) : ({ i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7 }[token] || 0);
    return 40 + number;
  }
  const form = value.match(new RegExp("\bform\s*(vi|v|iv|iii|ii|i|[1-6])"));
  if (form) {
    const token = form[1];
    const number = /^[1-6]$/.test(token) ? Number(token) : ({ i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6 }[token] || 0);
    return 60 + number;
  }
  return 100;
}

export default function ParentPortalManagement() {
  const { schoolId } = useSchool();
  const { selectedRoleName, selectedRoleId } = useRole();
  const canManageSponsorCentres = [1, 2, 3, 4].includes(Number(selectedRoleId)) || String(selectedRoleName || "").trim().toLowerCase() === "accountant";
  const [classes, setClasses] = useState([]);
  const [meetingClasses, setMeetingClasses] = useState([]);
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
  const [activeModule, setActiveModule] = useState("parents");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [liveRoom, setLiveRoom] = useState(null);
  const [sponsorStudents, setSponsorStudents] = useState([]);
  const [sponsorSelectionMode, setSponsorSelectionMode] = useState("");
  const [sponsorSelectedClasses, setSponsorSelectedClasses] = useState([]);
  const [sponsorCenters, setSponsorCenters] = useState([]);
  const [selectedSponsorCenter, setSelectedSponsorCenter] = useState(null);
  const [sponsorForm, setSponsorForm] = useState({ sponsor_name: "", sponsor_phone: "", center_name: "", supervisor_name: "", supervisor_phone: "", supervisor_email: "", student_ids: [] });

  const sponsorClassOptions = useMemo(() => {
    const unique = new Map();
    sponsorStudents.forEach((student) => {
      const label = String(student.class_name || "Unassigned").trim() || "Unassigned";
      const key = normalizeClassLabel(label) || label.toLowerCase();
      if (!unique.has(key)) unique.set(key, label);
    });
    return [...unique.entries()].sort((a, b) => classOrder(a[1]) - classOrder(b[1]) || a[1].localeCompare(b[1]));
  }, [sponsorStudents]);
  const visibleSponsorStudents = useMemo(() => {
    if (!sponsorSelectionMode) return [];
    if (sponsorSelectionMode === "school") return sponsorStudents;
    if (!sponsorSelectedClasses.length) return [];
    const selected = new Set(sponsorSelectedClasses);
    return sponsorStudents.filter((student) => selected.has(normalizeClassLabel(student.class_name || "Unassigned")));
  }, [sponsorStudents, sponsorSelectionMode, sponsorSelectedClasses]);

  const orderedClasses = useMemo(
    () => uniqueClassOptions(classes).sort((a, b) => classOrder(a.class_name) - classOrder(b.class_name) || String(a.class_name).localeCompare(String(b.class_name))),
    [classes]
  );
  const orderedMeetingClasses = useMemo(
    () => uniqueClassOptions(meetingClasses).sort((a, b) => classOrder(a.class_name) - classOrder(b.class_name) || String(a.class_name).localeCompare(String(b.class_name))),
    [meetingClasses]
  );
  const parentStats = useMemo(() => {
    const total = new Set();
    const byClass = new Map();
    (parents || []).forEach((parent) => {
      const identity = normalizeParentIdentity(parent);
      if (!identity) return;
      total.add(identity);
      const key = String(parent.class_id || parent.class_name || "unassigned");
      if (!byClass.has(key)) byClass.set(key, new Set());
      byClass.get(key).add(identity);
    });
    return {
      total: total.size,
      byClass: orderedClasses.map((item) => ({
        ...item,
        count: (byClass.get(String(item.id)) || new Set()).size,
      })),
    };
  }, [parents, orderedClasses]);


  const loadSponsorData = async () => {
    try {
      const [studentsResponse, centersResponse] = await Promise.all([
        api.get("/sponsor-portal/management/students"),
        api.get("/sponsor-portal/management/centers"),
      ]);
      setSponsorStudents(studentsResponse.data?.students || []);
      setSponsorCenters(centersResponse.data?.centers || []);
    } catch (e) { setError(e.response?.data?.message || "Imeshindikana kupakia taarifa za Sponsor na vituo."); }
  };
  const updateSponsorForm = (field, value) => setSponsorForm((current) => ({ ...current, [field]: value }));
  const createSponsorCenter = async (event) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const response = await api.post("/sponsor-portal/management/centers", sponsorForm);
      setNotice(response.data?.message || "Kituo kimehifadhiwa.");
      setSponsorForm({ sponsor_name: "", sponsor_phone: "", center_name: "", supervisor_name: "", supervisor_phone: "", supervisor_email: "", student_ids: [] });
      await loadSponsorData();
    } catch (e) { setError(e.response?.data?.message || "Imeshindikana kuhifadhi kituo."); }
    finally { setBusy(false); }
  };
  const resendSponsorCredentials = async (center) => {
    if (!center?.id) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await api.post("/sponsor-portal/management/centers/" + center.id + "/resend");
      setNotice(response.data?.message || "Credentials zimetumwa kwa SMS.");
      await loadSponsorData();
    } catch (e) { setError(e.response?.data?.message || "Imeshindikana kutuma credentials."); }
    finally { setBusy(false); }
  };

  const loadSuggestions = async () => {
    try {
      const response = await api.get("/parent-portal/staff/suggestions");
      setSuggestions(response.data?.suggestions || []);
    } catch (e) {
      setError(e.response?.data?.message || "Imeshindikana kupakia maoni ya wazazi.");
    }
  };
  const saveSuggestionReply = async (item) => {
    setBusy(true); setError(""); setNotice("");
    try {
      await api.patch("/parent-portal/staff/suggestions/" + item.id, {
        staff_reply: replies[item.id] || "",
        status: (replies[item.id] || "").trim() ? "responded" : "under_review",
      });
      setNotice("Jibu limehifadhiwa.");
      await loadSuggestions();
    } catch (e) {
      setError(e.response?.data?.message || "Imeshindikana kuhifadhi jibu.");
    } finally {
      setBusy(false);
    }
  };
  const loadMeetingClasses = async () => {
    try {
      const response = await api.get("/parent-portal/staff/meeting-classes");
      const available = response.data?.classes || [];
      setMeetingClasses(available);
      setMeetingClassId((current) => available.some((item) => String(item.id) === String(current)) ? current : "");
    } catch (e) {
      setError(e.response?.data?.message || "Imeshindikana kupakia madarasa yenye wanafunzi.");
    }
  };
  const loadMeetings = async () => {
    try {
      const response = await api.get("/parent-portal/staff/meetings");
      setMeetings(response.data?.meetings || []);
    } catch (e) {
      setError(e.response?.data?.message || "Imeshindikana kupakia mikutano.");
    }
  };
  const activeMeeting = meetings.find((meeting) =>
    meeting.status === "scheduled" && meeting.meeting_provider === "AfriCore WebRTC" && !meeting.ends_at && String(meeting.class_id) === String(meetingClassId) && new Date(meeting.starts_at).getTime() <= Date.now()
  ) || null;
  const startLiveMeeting = async (event) => {
    event.preventDefault();
    if (!title.trim() || !meetingClassId) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await api.post("/parent-portal/staff/meetings/start", { title: title.trim(), class_id: Number(meetingClassId) });
      setLiveRoom({ meeting: response.data.meeting, connectionInfo: response.data });
      setTitle("");
      setNotice("Mkutano umeanzishwa. Wazazi wataona kitufe cha Join Meeting kwenye Parent Portal zao.");
      await loadMeetings();
      await loadMeetingClasses();
    } catch (e) {
      setError(e.response?.data?.message || "Imeshindikana kuanzisha mkutano LIVE.");
      await loadMeetings();
    } finally { setBusy(false); }
  };
  const joinLiveMeetingAsAdmin = async () => {
    if (!activeMeeting) return;
    setBusy(true); setError("");
    try {
      const response = await api.post("/parent-portal/staff/meetings/" + activeMeeting.id + "/token");
      setLiveRoom({ meeting: response.data.meeting, connectionInfo: response.data });
    } catch (e) { setError(e.response?.data?.message || "Imeshindikana kujiunga na mkutano."); }
    finally { setBusy(false); }
  };
  const endLiveMeeting = async () => {
    if (!liveRoom?.meeting?.id) return;
    setBusy(true); setError("");
    try {
      await api.patch("/parent-portal/staff/meetings/" + liveRoom.meeting.id + "/end");
      setLiveRoom(null);
      setNotice("Mkutano umemalizika. Wazazi hawawezi tena kujiunga.");
      await loadMeetings();
    } catch (e) { throw new Error(e.response?.data?.message || "Imeshindikana kumaliza mkutano."); }
    finally { setBusy(false); }
  };
  const loadChat = async (id = classId) => {
    if (!id) { setMessages([]); setGroupMembers([]); return; }
    try {
      const response = await api.get("/parent-portal/staff/chat/" + id);
      setMessages(response.data?.messages || []);
      setGroupMembers(response.data?.group_members || []);
    } catch (e) {
      setError(e.response?.data?.message || "Imeshindikana kupakia group chat.");
    }
  };

  useEffect(() => {
    if (!schoolId) return;
    setError("");
    api.get("/parent-portal/staff/classes")
      .then(({ data }) => setClasses(data?.classes || []))
      .catch((e) => setError(e.response?.data?.message || "Imeshindikana kupakia madarasa yaliyoruhusiwa."));
    api.get("/parent-portal/staff/parents")
      .then(({ data }) => setParents(data?.parents || []))
      .catch((e) => setError(e.response?.data?.message || "Imeshindikana kupakia taarifa za wazazi."));
    loadMeetings();
    loadMeetingClasses();
    loadSuggestions();
    if (canManageSponsorCentres) loadSponsorData();
  }, [schoolId, canManageSponsorCentres]);

  useEffect(() => {
    if (activeModule !== "video") return undefined;
    const timer = window.setInterval(loadMeetings, 5000);
    return () => window.clearInterval(timer);
  }, [activeModule]);

  useEffect(() => {
    if (!classId || activeModule !== "chat") return undefined;
    const heartbeat = () => api.post("/parent-portal/staff/presence/heartbeat", { class_id: classId }).catch(() => {});
    heartbeat();
    const timer = window.setInterval(heartbeat, 15000);
    return () => window.clearInterval(timer);
  }, [classId, activeModule]);

  useEffect(() => {
    if (!classId || activeModule !== "chat") return undefined;
    loadChat(classId);
    const refreshTimer = window.setInterval(() => loadChat(classId), 2500);
    return () => window.clearInterval(refreshTimer);
  }, [classId, activeModule]);

  const sendChat = async (event) => {
    event.preventDefault();
    if (!classId || !chatText.trim()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api.post("/parent-portal/staff/chat/" + classId, { message: chatText.trim() });
      setChatText("");
      await loadChat(classId);
    } catch (e) {
      setError(e.response?.data?.message || "Ujumbe haukutumwa.");
    } finally {
      setBusy(false);
    }
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
    } catch (e) {
      setError(e.response?.data?.message || "Imeshindikana kuhifadhi mkutano.");
    } finally {
      setBusy(false);
    }
  };

  const modules = [
    { id: "video", icon: "🎥", title: "Video Conference", description: "Anzisha au ratibu mkutano wa wazazi.", count: meetings.length, countLabel: "Mikutano", accent: "from-violet-600 to-indigo-700" },
    { id: "feedback", icon: "💬", title: "Maoni ya Wazazi", description: "Pokea, fuatilia na jibu maoni ya wazazi.", count: suggestions.length, countLabel: "Maoni", accent: "from-amber-500 to-orange-600" },
    { id: "chat", icon: "👥", title: "Group Chat", description: "Wasiliana na wazazi na walimu kwa kila darasa.", count: classes.length, countLabel: "Madarasa", accent: "from-emerald-600 to-teal-700" },
    { id: "parents", icon: "🏫", title: "Wazazi wa Shule", description: "Angalia idadi ya wazazi/walezi kwa kila darasa.", count: parentStats.total, countLabel: "Wazazi/walezi", accent: "from-blue-600 to-cyan-700" },
    ...(canManageSponsorCentres ? [{ id: "sponsors", icon: "🤝", title: "Sponsors & Centres", description: "Sajili sponsor, vituo, wasimamizi na wanafunzi wao.", count: sponsorCenters.length, countLabel: "Vituo", accent: "from-cyan-600 to-blue-800" }] : []),
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-900 p-6 text-white shadow-lg md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">AfriCore · Communication</p>
        <h1 className="mt-2 text-2xl font-black md:text-3xl">Parent Portal Management</h1>
        <p className="mt-2 max-w-2xl text-sm text-blue-100">Chagua moduli unayotaka kusimamia. Kila sehemu ina taarifa na zana zake.</p>
        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full bg-white/10 px-3 py-1.5">{classes.length} madarasa yanayopatikana</span>
          <span className="rounded-full bg-white/10 px-3 py-1.5">{parentStats.total} wazazi/walezi wenye taarifa</span>
        </div>
      </header>

      <section aria-label="Parent Portal modules" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {modules.map((module) => (
          <button
            key={module.id}
            type="button"
            onClick={() => { setActiveModule(module.id); setNotice(""); setError(""); }}
            aria-pressed={activeModule === module.id}
            className={"group rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg " + (activeModule === module.id ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200")}
          >
            <div className={"flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-2xl text-white shadow-sm " + module.accent}>{module.icon}</div>
            <div className="mt-4 flex items-start justify-between gap-2">
              <h2 className="text-base font-extrabold text-slate-900">{module.title}</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{module.count}</span>
            </div>
            <p className="mt-2 min-h-10 text-sm leading-5 text-slate-500">{module.description}</p>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-xs font-semibold text-slate-500">{module.countLabel}</span>
              <span className="text-sm font-bold text-blue-700">{activeModule === module.id ? "Imefunguliwa" : "Fungua moduli →"}</span>
            </div>
          </button>
        ))}
      </section>

      {notice && <div role="status" className="rounded-xl bg-emerald-50 p-3 text-emerald-800">{notice}</div>}
      {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">{error}</div>}


      {activeModule === "sponsors" && (
        <section className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-cyan-700">Sponsor administration</p><h2 className="mt-1 text-xl font-extrabold">Sajili Sponsor na Kituo</h2><p className="mt-1 text-sm text-slate-500">Wanafunzi wanaweza kuchaguliwa kutoka madarasa tofauti ya shule hii.</p></div><button type="button" onClick={loadSponsorData} className="rounded-lg border px-4 py-2 text-sm font-semibold">Refresh</button></div>
            <form onSubmit={createSponsorCenter} className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold">Sponsor Name<input required value={sponsorForm.sponsor_name} onChange={(e)=>updateSponsorForm("sponsor_name",e.target.value)} placeholder="Sponsor / Organization name" className="mt-1 w-full rounded-xl border p-3"/></label>
              <label className="text-sm font-semibold">Sponsor Phone<input required value={sponsorForm.sponsor_phone} onChange={(e)=>updateSponsorForm("sponsor_phone",e.target.value)} placeholder="0712345678" className="mt-1 w-full rounded-xl border p-3"/></label>
              <label className="text-sm font-semibold">Center Name<input required value={sponsorForm.center_name} onChange={(e)=>updateSponsorForm("center_name",e.target.value)} placeholder="Center name" className="mt-1 w-full rounded-xl border p-3"/></label>
              <label className="text-sm font-semibold">Supervisor / Manager Name<input required value={sponsorForm.supervisor_name} onChange={(e)=>updateSponsorForm("supervisor_name",e.target.value)} placeholder="Full name" className="mt-1 w-full rounded-xl border p-3"/></label>
              <label className="text-sm font-semibold">Supervisor Phone<input required value={sponsorForm.supervisor_phone} onChange={(e)=>updateSponsorForm("supervisor_phone",e.target.value)} placeholder="0712345678" className="mt-1 w-full rounded-xl border p-3"/></label>
              <label className="text-sm font-semibold">Supervisor Email / Username<input required type="email" value={sponsorForm.supervisor_email} onChange={(e)=>updateSponsorForm("supervisor_email",e.target.value)} placeholder="manager@example.com" className="mt-1 w-full rounded-xl border p-3"/></label>
              <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-sm font-bold text-slate-900">Chagua kundi la wanafunzi</p>
                  <p className="mt-1 text-xs text-slate-500">Wanafunzi wataonekana baada ya kuchagua kundi unalotaka.</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-semibold">
                    <input type="radio" name="sponsor-student-scope" checked={sponsorSelectionMode === "school"} onChange={() => { setSponsorSelectionMode("school"); setSponsorSelectedClasses([]); }} />
                    Shule nzima
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-semibold">
                    <input type="radio" name="sponsor-student-scope" checked={sponsorSelectionMode === "classes"} onChange={() => { setSponsorSelectionMode("classes"); setSponsorSelectedClasses([]); }} />
                    Chagua kwa madarasa
                  </label>
                </div>
                {sponsorSelectionMode === "classes" && (
                  <div className="mt-4">
                    <label className="block text-sm font-semibold text-slate-800">Chagua darasa (unaweza kuchagua madarasa zaidi ya moja)
                      <select multiple value={sponsorSelectedClasses} onChange={(e) => setSponsorSelectedClasses(Array.from(e.target.selectedOptions).map((option) => option.value))} className="mt-1 h-32 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">
                        {sponsorClassOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                      </select>
                    </label>
                    <p className="mt-1 text-xs text-slate-500">Madarasa yanayofanana yameunganishwa ili yasijirudie kwenye orodha.</p>
                  </div>
                )}
                {sponsorSelectionMode && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">Wanafunzi wa kundi lililochaguliwa</p>
                        <p className="text-xs text-slate-500">{visibleSponsorStudents.length} wanafunzi · {sponsorForm.student_ids.length} wamechaguliwa kwa sasa</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" disabled={!visibleSponsorStudents.length} onClick={() => updateSponsorForm("student_ids", [...new Set([...sponsorForm.student_ids, ...visibleSponsorStudents.map((student) => Number(student.id))])])} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Chagua wote</button>
                        <button type="button" disabled={!visibleSponsorStudents.length} onClick={() => { const visibleIds = new Set(visibleSponsorStudents.map((student) => Number(student.id))); updateSponsorForm("student_ids", sponsorForm.student_ids.filter((id) => !visibleIds.has(Number(id)))); }} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40">Ondoa kundi hili</button>
                      </div>
                    </div>
                    {visibleSponsorStudents.length ? (
                      <div className="mt-3 max-h-80 space-y-1 overflow-y-auto">
                        {visibleSponsorStudents.map((student) => {
                          const checked = sponsorForm.student_ids.includes(Number(student.id));
                          return <label key={student.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50">
                            <input type="checkbox" checked={checked} onChange={(e) => updateSponsorForm("student_ids", e.target.checked ? [...new Set([...sponsorForm.student_ids, Number(student.id)])] : sponsorForm.student_ids.filter((id) => Number(id) !== Number(student.id)))} />
                            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-800">{student.name}</span><span className="block text-xs text-slate-500">{student.admission_number || "—"} · {student.class_name || "Darasa halijawekwa"}</span></span>
                          </label>;
                        })}
                      </div>
                    ) : <p className="py-8 text-center text-sm text-slate-500">{sponsorSelectionMode === "classes" ? "Chagua darasa moja au zaidi ili kuona wanafunzi." : "Hakuna wanafunzi waliopatikana kwa shule hii."}</p>}
                  </div>
                )}
                {!sponsorSelectionMode && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Chagua kwanza “Shule nzima” au “Chagua kwa madarasa” ili kuonyesha orodha ya wanafunzi.</p>}
              </div>
              <div className="md:col-span-2"><button disabled={busy || !sponsorForm.student_ids.length} className="rounded-xl bg-blue-700 px-6 py-3 font-bold text-white disabled:opacity-50">{busy ? "Inahifadhi..." : "Create Center & Send Login Credentials"}</button></div>
            </form>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-extrabold">Registered Sponsors & Centres</h2>
            <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Sponsor</th><th className="p-3">Center</th><th className="p-3">Supervisor</th><th className="p-3">Phone</th><th className="p-3">Students</th><th className="p-3">Username</th><th className="p-3">Credentials</th></tr></thead>
              <tbody>{sponsorCenters.map((center)=><tr key={center.id} className="border-t border-slate-100"><td className="p-3"><b>{center.sponsor?.sponsor_name || "—"}</b><small className="block text-slate-500">{center.sponsor?.sponsor_phone || ""}</small></td><td className="p-3 font-semibold">{center.center_name}</td><td className="p-3">{center.supervisor_name}<small className="block text-slate-500">{center.supervisor_email}</small></td><td className="p-3">{center.supervisor_phone}</td><td className="p-3">{center.student_count}</td><td className="p-3">{center.account?.username || center.supervisor_email}</td><td className="p-3"><button type="button" onClick={()=>setSelectedSponsorCenter(center)} className="rounded-lg border border-blue-200 px-3 py-1.5 font-semibold text-blue-700 hover:bg-blue-50">View</button></td></tr>)}</tbody>
            </table>{!sponsorCenters.length && <p className="p-6 text-center text-sm text-slate-500">Hakuna Sponsor Centre iliyosajiliwa.</p>}</div>
          </div>
          {selectedSponsorCenter && <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Sponsor account details</p><h3 className="mt-1 text-lg font-extrabold">{selectedSponsorCenter.center_name}</h3></div><button type="button" onClick={()=>setSelectedSponsorCenter(null)} className="rounded-lg border bg-white px-3 py-1.5 text-sm font-semibold">Close</button></div>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><p><b>Sponsor:</b> {selectedSponsorCenter.sponsor?.sponsor_name || "—"}</p><p><b>Supervisor:</b> {selectedSponsorCenter.supervisor_name}</p><p><b>Phone:</b> {selectedSponsorCenter.supervisor_phone}</p><p><b>Email / Username:</b> {selectedSponsorCenter.account?.username || selectedSponsorCenter.supervisor_email}</p><p><b>Assigned students:</b> {selectedSponsorCenter.student_count}</p><p><b>Account status:</b> {selectedSponsorCenter.account?.is_active ? "Active" : "Not active"}</p></div>
            <p className="mt-3 text-xs text-slate-600">Kwa usalama, password ya zamani haihifadhiwi katika mfumo. Resend Credentials itatengeneza password mpya na kuituma kwa simu ya msimamizi.</p>
            <button type="button" disabled={busy || !selectedSponsorCenter.account?.is_active} onClick={()=>resendSponsorCredentials(selectedSponsorCenter)} className="mt-4 rounded-xl bg-blue-700 px-5 py-2.5 font-bold text-white disabled:opacity-50">{busy ? "Inatuma..." : "Resend Credentials"}</button>
          </div>}
        </section>
      )}

      {activeModule === "parents" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-700">School parent directory</p>
              <h2 className="mt-1 text-xl font-extrabold text-slate-900">Wazazi na walezi kwa madarasa</h2>
              <p className="mt-1 text-sm text-slate-500">Idadi inahesabu mzazi/mlezi mara moja kwa shule nzima kwa kutumia simu, barua pepe au jina lililopo kwenye taarifa za mwanafunzi.</p>
            </div>
            <div className="rounded-2xl bg-blue-50 px-5 py-3 text-right">
              <p className="text-3xl font-black text-blue-800">{parentStats.total}</p>
              <p className="text-xs font-semibold text-blue-700">Wazazi/walezi wa kipekee</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {parentStats.byClass.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { setClassId(String(item.id)); setActiveModule("chat"); }}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50"
                title={"Fungua group chat ya " + item.class_name}
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Darasa {index + 1}</p>
                  <p className="mt-1 truncate font-bold text-slate-800">{item.class_name}</p>
                </div>
                <span className="flex h-11 min-w-11 items-center justify-center rounded-xl bg-white px-3 text-lg font-black text-blue-800 shadow-sm">{item.count}</span>
              </button>
            ))}
            {!parentStats.byClass.length && <p className="col-span-full rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Hakuna madarasa yanayopatikana kwa akaunti hii.</p>}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900">Orodha ya wazazi/walezi</h3>
              <p className="text-xs text-slate-500">Taarifa za wanafunzi waliosajiliwa katika madarasa yanayoruhusiwa.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{parents.length} taarifa za mwanafunzi</span>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Mwanafunzi</th><th className="p-3">Mzazi / Mlezi</th><th className="p-3">Simu</th><th className="p-3">Barua pepe</th><th className="p-3">Darasa</th></tr></thead>
              <tbody>
                {parents.map((p) => <tr key={p.student_id} className="border-t border-slate-100"><td className="p-3 font-semibold text-slate-800">{p.student_name}<small className="block text-slate-400">{p.admission_number || "—"}</small></td><td className="p-3">{p.parent_name}</td><td className="p-3">{p.phone || "—"}</td><td className="p-3">{p.email || "—"}</td><td className="p-3">{p.class_name}</td></tr>)}
              </tbody>
            </table>
            {!parents.length && <p className="p-6 text-center text-sm text-slate-500">Hakuna taarifa za wazazi katika madarasa unayoruhusiwa kuona.</p>}
          </div>
        </section>
      )}

      {activeModule === "feedback" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-wider text-amber-700">Parent feedback desk</p><h2 className="mt-1 text-xl font-extrabold">Maoni na malalamiko ya wazazi</h2><p className="mt-1 text-sm text-slate-500">Jibu maoni ya wazazi; majibu yataonekana kwenye Parent Portal ya mwanafunzi husika.</p></div>
            <button type="button" onClick={loadSuggestions} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Refresh</button>
          </div>
          <div className="mt-4 space-y-4">
            {suggestions.map((item) => (
              <article key={item.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap justify-between gap-2"><b>{item.student?.name || "Mwanafunzi"} · {item.student?.admission_number || ""}</b><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">{item.status}</span></div>
                <p className="mt-2 text-xs text-slate-500">{item.category} · {new Date(item.created_at).toLocaleString()}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm">{item.message}</p>
                {item.staff_reply && <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm"><b>Jibu la sasa</b><p className="mt-1">{item.staff_reply}</p></div>}
                <textarea value={replies[item.id] ?? item.staff_reply ?? ""} onChange={(e) => setReplies((prev) => ({ ...prev, [item.id]: e.target.value }))} rows={3} placeholder="Andika jibu la shule..." className="mt-3 w-full rounded-xl border border-slate-200 p-3" />
                <button type="button" disabled={busy} onClick={() => saveSuggestionReply(item)} className="mt-2 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Hifadhi jibu</button>
              </article>
            ))}
            {!suggestions.length && <p className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">Hakuna maoni mapya kutoka kwa wazazi.</p>}
          </div>
        </section>
      )}

      {activeModule === "video" && (
        <section className="space-y-5">
          {liveRoom ? (
            <ParentLiveMeeting
              meeting={liveRoom.meeting}
              connectionInfo={liveRoom.connectionInfo}
              isAdmin
              onEnd={endLiveMeeting}
              onLeave={() => setLiveRoom(null)}
            />
          ) : (
            <div className="grid gap-5 xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <p className="text-xs font-bold uppercase tracking-wider text-violet-700">Live parent conference</p>
                <h2 className="mt-1 text-xl font-extrabold">Create & Start Meeting</h2>
                <p className="mt-1 text-sm text-slate-500">Weka kichwa cha mkutano kisha uanze. Wazazi wa darasa ulilochagua wataona mkutano ukiwa LIVE na watajiunga kwa kitufe cha Join Meeting.</p>
                {activeMeeting ? (
                  <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-rose-700"><span className="h-2 w-2 animate-pulse rounded-full bg-rose-600"/> Meeting is LIVE</div>
                    <h3 className="mt-2 text-lg font-black text-slate-900">{activeMeeting.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">Ilianza {new Date(activeMeeting.starts_at).toLocaleString()}</p>
                    <button type="button" disabled={busy} onClick={joinLiveMeetingAsAdmin} className="mt-4 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Inaunganisha..." : "Join Meeting"}</button>
                  </div>
                ) : (
                  <form onSubmit={startLiveMeeting} className="mt-5 space-y-3">
                    <label className="block text-sm font-semibold text-slate-700">Meeting Title<input required maxLength={180} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mfano: Mkutano wa Wazazi – Muhula wa Pili" className="mt-2 w-full rounded-xl border border-slate-200 p-3"/></label>
                    <label className="block text-sm font-semibold text-slate-700">Select Class<select required value={meetingClassId} onChange={(e) => setMeetingClassId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3"><option value="">-- Chagua darasa lenye wanafunzi --</option>{orderedMeetingClasses.map((item) => <option key={item.id} value={item.id}>{item.class_name} · {item.academic_year_name || "Mwaka haujaainishwa"} · {item.student_count} wanafunzi (ID {item.id})</option>)}</select></label>
                    <p className="text-xs text-slate-500">Orodha hii ina madarasa yenye wanafunzi waliopangiwa kwa mwaka wa masomo unaotumika. Mkutano utaonekana kwa wazazi wa wanafunzi hao pekee.</p>
                    <button disabled={busy || !title.trim() || !meetingClassId || !orderedMeetingClasses.some((item) => String(item.id) === String(meetingClassId))} className="rounded-xl bg-violet-700 px-6 py-3 font-bold text-white disabled:opacity-50">{busy ? "Inaanzisha..." : "Create Meeting & Start Live"}</button>
                  </form>
                )}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <h3 className="text-lg font-bold text-slate-900">Meeting status</h3>
                <p className="mt-2 text-sm text-slate-500">{activeMeeting ? "Mkutano unaendelea. Wazazi wanaweza kujiunga sasa." : "Hakuna mkutano LIVE kwa darasa lililochaguliwa. Ukianzisha mkutano, wazazi wa darasa hilo wataona kitufe cha kujiunga."}</p>
                <div className="mt-5 rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Meeting lifecycle</p><ol className="mt-3 space-y-2 text-sm text-slate-700"><li>1. Admin anaweka title na kuanzisha mkutano.</li><li>2. Wazazi wanaona LIVE na wanabonyeza Join Meeting.</li><li>3. Mkutano unaendelea hadi Admin abonyeze End Meeting.</li></ol></div>
              </div>
            </div>
          )}
        </section>
      )}
      {activeModule === "chat" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="rounded-xl bg-slate-900 p-4 text-white"><p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Class communication</p><h2 className="mt-1 text-xl font-bold">Group Chat ya Wazazi</h2><p className="mt-1 text-sm text-slate-300">Chagua darasa. Kundi linaonyesha wazazi wa darasa hilo pamoja na watumishi waliopewa jukumu la darasa.</p></div>
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className="mt-4 w-full rounded-xl border border-slate-200 p-3"><option value="">Chagua darasa</option>{orderedClasses.map((x) => <option key={x.id} value={x.id}>{x.class_name}</option>)}</select>
          <div className="mt-4 grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="rounded-xl bg-slate-50 p-3">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Wanachama · {groupMembers.length}</h3>
              <div className="max-h-[480px] space-y-2 overflow-y-auto">
                {groupMembers.map((member) => <div key={(member.member_type || "parent") + "-" + (member.teacher_id || member.student_id)} className="flex items-center gap-2 rounded-lg bg-white p-2"><span className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold " + (member.member_type === "staff" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700")}>{(member.member_name || member.parent_name || "M").slice(0, 1)}</span><div className="min-w-0"><p className="truncate text-xs font-semibold">{member.member_name || member.parent_name}</p><p className="truncate text-[10px] text-slate-400">{member.member_type === "staff" ? (member.role_label || "Staff") : member.student_name}</p><span className={"text-[10px] " + (member.online ? "text-emerald-600" : "text-slate-400")}>{member.online ? "● Online" : "○ Offline"}</span></div></div>)}
                {classId && !groupMembers.length && <p className="p-3 text-xs text-slate-400">Hakuna wazazi wenye akaunti hai.</p>}
                {!classId && <p className="p-3 text-xs text-slate-400">Chagua darasa kuona wanachama wake.</p>}
              </div>
            </aside>
            <div className="min-w-0">
              <div className="flex h-[420px] flex-col gap-3 overflow-y-auto rounded-xl bg-[#f0f2ed] p-4">
                {messages.map((m) => <div key={m.id} className={"flex " + (m.sender_type === "staff" ? "justify-end" : "justify-start")}><article className={"max-w-[85%] rounded-2xl px-4 py-3 shadow-sm " + (m.sender_type === "staff" ? "bg-[#d9fdd3]" : "bg-white")}><b className="text-xs text-slate-700">{m.sender_name}</b><p className="mt-1 whitespace-pre-wrap break-words text-sm">{m.message}</p><small className="mt-1 block text-right text-[10px] text-slate-400">{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></article></div>)}
                {classId && !messages.length && <p className="py-16 text-center text-sm text-slate-500">Hakuna ujumbe bado.</p>}
                {!classId && <p className="py-16 text-center text-sm text-slate-500">Chagua darasa kuanza mazungumzo.</p>}
              </div>
              <form onSubmit={sendChat} className="mt-3 flex gap-2"><input disabled={!classId} required value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="Andika ujumbe kwa wazazi..." className="min-w-0 flex-1 rounded-xl border border-slate-200 p-3" /><button disabled={busy || !classId} className="rounded-xl bg-blue-700 px-5 font-bold text-white disabled:opacity-50">Tuma</button></form>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
