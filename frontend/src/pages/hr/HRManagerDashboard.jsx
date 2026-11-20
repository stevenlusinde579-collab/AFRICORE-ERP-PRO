import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaUsers, FaCalendarAlt, FaFingerprint, FaClipboardCheck,
  FaUmbrellaBeach, FaFileAlt, FaChartBar, FaSyncAlt,
  FaComments, FaCog, FaExclamationTriangle
} from "react-icons/fa";
import { supabase } from "../../services/supabase";
import { useSchool } from "../../context/SchoolContext";

const today = () => new Date().toISOString().slice(0, 10);

const formatNumber = (value) => Number(value || 0).toLocaleString("en-TZ");

function MetricCard({ label, value, note, icon, tone = "blue" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
  };
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-900">{formatNumber(value)}</p>
          <p className="mt-1 text-xs text-slate-500">{note}</p>
        </div>
        <span className={`rounded-xl p-3 text-xl ${tones[tone] || tones.blue}`}>{icon}</span>
      </div>
    </article>
  );
}

function HRManagerDashboard() {
  const navigate = useNavigate();
  const { schoolId } = useSchool();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [schemaReady, setSchemaReady] = useState(false);
  const [stats, setStats] = useState({
    staff: 0, offToday: 0, pendingLeave: 0, attendanceToday: 0,
  });
  const [staff, setStaff] = useState([]);
  const [devices, setDevices] = useState([]);
  const [offdayRows, setOffdayRows] = useState([]);
  const [activeSection, setActiveSection] = useState("overview");

  const loadHRData = useCallback(async () => {
    if (!schoolId) {
      setLoading(false);
      setError("Akaunti hii haijaunganishwa na shule. Tafadhali wasiliana na msimamizi.");
      return;
    }

    setRefreshing(true);
    setError("");
    const date = today();
    try {
      const [staffResult, offdayResult, leaveResult, attendanceResult, deviceResult] = await Promise.all([
        supabase.from("employees")
          .select("id,employee_number,first_name,middle_name,last_name,department,position,status")
          .eq("school_id", schoolId)
          .order("first_name", { ascending: true }),
        supabase.from("hr_offday_rosters")
          .select("id,employee_id,off_date,status,employees(first_name,middle_name,last_name,employee_number)")
          .eq("school_id", schoolId)
          .gte("off_date", date)
          .order("off_date", { ascending: true })
          .limit(100),
        supabase.from("hr_leave_requests")
          .select("id,status")
          .eq("school_id", schoolId)
          .eq("status", "pending"),
        supabase.from("hr_attendance_events")
          .select("employee_id,event_type,occurred_at")
          .eq("school_id", schoolId)
          .gte("occurred_at", `${date}T00:00:00`)
          .lt("occurred_at", `${date}T23:59:59.999`),
        supabase.from("hr_biometric_devices")
          .select("id,device_name,device_model,connection_type,bridge_status,last_seen_at")
          .eq("school_id", schoolId),
      ]);

      const missingHRSchema = [offdayResult, leaveResult, attendanceResult, deviceResult]
        .some((result) => result.error?.code === "42P01" || result.error?.code === "PGRST205");

      if (staffResult.error) throw staffResult.error;
      if (missingHRSchema) {
        setSchemaReady(false);
        setStaff(staffResult.data || []);
        setStats((current) => ({ ...current, staff: staffResult.data?.length || 0 }));
        setError("HR database migration bado haijawekwa. Taarifa za wafanyakazi zinaonekana, lakini Off Days, Leave na Attendance zitaanza baada ya migration kuidhinishwa na kuwekwa.");
        return;
      }

      const errors = [offdayResult, leaveResult, attendanceResult, deviceResult]
        .filter((result) => result.error);
      if (errors.length) throw errors[0].error;

      setSchemaReady(true);
      setStaff(staffResult.data || []);
      setOffdayRows(offdayResult.data || []);
      setDevices(deviceResult.data || []);
      const events = attendanceResult.data || [];
      const presentIds = new Set(events.filter((event) => event.event_type === "check_in").map((event) => event.employee_id));
      setStats({
        staff: staffResult.data?.length || 0,
        offToday: (offdayResult.data || []).filter((row) => row.off_date === date && row.status !== "cancelled").length,
        pendingLeave: leaveResult.data?.length || 0,
        attendanceToday: presentIds.size,
      });
    } catch (loadError) {
      console.error("HR dashboard load error:", loadError);
      setError(loadError.message || "Imeshindikana kupakia taarifa za HR.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [schoolId]);

  useEffect(() => { loadHRData(); }, [loadHRData]);

  const activeStaff = useMemo(
    () => staff.filter((person) => !["inactive", "terminated", "left"].includes(String(person.status || "").toLowerCase())),
    [staff]
  );

  const sections = [
    { id: "overview", label: "Overview", icon: <FaChartBar /> },
    { id: "staff", label: "Staff Records", icon: <FaUsers /> },
    { id: "offdays", label: "Off Day Management", icon: <FaCalendarAlt /> },
    { id: "attendance", label: "Attendance & USB Fingerprint", icon: <FaFingerprint /> },
    { id: "leave", label: "Leave Management", icon: <FaUmbrellaBeach /> },
    { id: "reports", label: "HR Reports & Documents", icon: <FaFileAlt /> },
  ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-800 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full border-[28px] border-white/5" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-blue-100">AFRICORE • HUMAN RESOURCES</p>
            <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">HR Management</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">Simamia taarifa za wafanyakazi, ratiba za mapumziko, mahudhurio, likizo na vifaa vya USB fingerprint vya shule yako.</p>
          </div>
          <button type="button" onClick={loadHRData} disabled={refreshing} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-blue-950 hover:bg-blue-50 disabled:opacity-60">
            <FaSyncAlt className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </section>

      {error && (
        <div role="status" className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <FaExclamationTriangle className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="HR sections">
        {sections.map((section) => (
          <button key={section.id} type="button" onClick={() => setActiveSection(section.id)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${activeSection === section.id ? "bg-blue-700 text-white shadow" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
            {section.icon}{section.label}
          </button>
        ))}
      </nav>

      {activeSection === "overview" && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total Staff" value={stats.staff} note="Wafanyakazi waliosajiliwa" icon={<FaUsers />} />
            <MetricCard label="On Off-Day Today" value={stats.offToday} note="Waliopangiwa mapumziko leo" icon={<FaCalendarAlt />} tone="amber" />
            <MetricCard label="Pending Leave Requests" value={stats.pendingLeave} note="Maombi yanayosubiri uamuzi" icon={<FaClipboardCheck />} tone="violet" />
            <MetricCard label="Attendance Events Today" value={stats.attendanceToday} note="Matukio ya check-in yaliyorekodiwa" icon={<FaFingerprint />} tone="green" />
          </section>
          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-bold text-slate-900">Off-Day Coverage</h2>
              <p className="mt-1 text-sm text-slate-500">Ratiba zijazo za mapumziko ya wafanyakazi.</p>
              {!schemaReady ? <p className="mt-5 text-sm text-slate-500">Ratiba zitaonekana baada ya HR database migration.</p> :
                offdayRows.length === 0 ? <p className="mt-5 text-sm text-slate-500">Hakuna off-day iliyopangwa kwa sasa.</p> :
                <div className="mt-4 divide-y divide-slate-100">{offdayRows.slice(0, 6).map((row) => <div key={row.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="font-medium text-slate-800">{[row.employees?.first_name, row.employees?.middle_name, row.employees?.last_name].filter(Boolean).join(" ") || row.employees?.employee_number || "Staff"}</span><span className="rounded-lg bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">{row.off_date}</span></div>)}</div>}
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">USB Fingerprint Scanner</h2><p className="mt-1 text-sm text-slate-500">Muunganisho wa kifaa cha fingerprint kupitia kompyuta.</p></div><FaFingerprint className="text-3xl text-blue-700" /></div>
              {devices.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4"><p className="font-semibold text-slate-800">No USB bridge connected</p><p className="mt-1 text-sm text-slate-500">Mfumo utaonyesha hali ya kifaa baada ya kusakinisha bridge inayolingana na model ya scanner.</p></div> :
                <div className="mt-4 space-y-3">{devices.map((device) => <div key={device.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><div><p className="font-semibold text-slate-800">{device.device_name}</p><p className="text-xs text-slate-500">{device.device_model || "Model not set"} • {device.connection_type}</p></div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{device.bridge_status || "Not connected"}</span></div>)}</div>}
              <p className="mt-4 text-xs leading-5 text-slate-500">Usalama: AfriCore haitahifadhi picha au template ghafi za alama za vidole. Itapokea tu matokeo ya uthibitisho na muda wa check-in/check-out.</p>
            </article>
          </section>
        </>
      )}

      {activeSection === "staff" && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5"><h2 className="text-lg font-bold text-slate-900">Staff Records</h2><p className="text-sm text-slate-500">{activeStaff.length} active staff records</p></div>
          {loading ? <p className="p-5 text-sm text-slate-500">Loading staff...</p> : activeStaff.length === 0 ? <p className="p-5 text-sm text-slate-500">Hakuna wafanyakazi waliopatikana.</p> :
            <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Employee No.</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Position</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{activeStaff.map((person) => <tr key={person.id}><td className="px-4 py-3 font-semibold">{person.employee_number || "—"}</td><td className="px-4 py-3">{[person.first_name, person.middle_name, person.last_name].filter(Boolean).join(" ")}</td><td className="px-4 py-3">{person.department || "—"}</td><td className="px-4 py-3">{person.position || "—"}</td><td className="px-4 py-3">{person.status || "Active"}</td></tr>)}</tbody></table></div>}
        </section>
      )}

      {activeSection === "offdays" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold text-slate-900">Off Day Management</h2>
          <p className="mt-1 text-sm text-slate-500">Weka haki ya off-days kwa mwaka, panga siku za kila mfanyakazi kwa zamu, na fuatilia zilizotumika dhidi ya zilizobaki.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Annual entitlement</p><p className="mt-1 font-bold text-slate-800">Per staff member</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Rotation planning</p><p className="mt-1 font-bold text-slate-800">Staggered schedules</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Coverage control</p><p className="mt-1 font-bold text-slate-800">Avoid understaffing</p></div></div>
          {!schemaReady && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Off-day records hazijawezeshwa kwenye database bado; migration iko kwenye tawi la majaribio.</p>}
        </section>
      )}

      {activeSection === "attendance" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3"><FaFingerprint className="text-2xl text-blue-700" /><div><h2 className="text-lg font-bold text-slate-900">Biometric Attendance</h2><p className="text-sm text-slate-500">USB fingerprint scanner integration</p></div></div>
          <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5"><p className="font-semibold text-slate-900">USB device bridge required</p><p className="mt-2 text-sm leading-6 text-slate-600">USB fingerprint scanners hutumia SDK/driver maalumu kulingana na model. AfriCore itaunganisha kupitia local Windows bridge yenye API salama. Kabla ya kuandika driver, tunahitaji model halisi ya scanner; kwa sasa dashboard imeandaliwa bila kudai kuwa kifaa kimeunganishwa.</p></div>
          <p className="mt-4 text-xs leading-5 text-slate-500">Kila tukio litahifadhi employee ID, check-in/check-out, timestamp, device ID na chanzo. Hakuna fingerprint image/template itakayohifadhiwa kwenye Supabase.</p>
        </section>
      )}

      {activeSection === "leave" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold text-slate-900">Leave Management</h2><p className="mt-1 text-sm text-slate-500">Maombi, aina za likizo, approval workflow na salio la likizo.</p>{!schemaReady && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Leave workflow itawashwa baada ya database migration.</p>}</section>
      )}

      {activeSection === "reports" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold text-slate-900">HR Reports & Documents</h2><p className="mt-1 text-sm text-slate-500">Staff register, attendance summaries, off-day balances, leave history na HR document records.</p></section>
      )}

      <footer className="flex flex-wrap gap-3 border-t border-slate-200 pt-5">
        <button type="button" onClick={() => navigate("/communication")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"><FaComments /> Communication</button>
        <button type="button" onClick={() => navigate("/settings")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"><FaCog /> Personal Settings</button>
      </footer>
    </div>
  );
}

export default HRManagerDashboard;
