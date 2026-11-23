import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaUsers, FaCalendarAlt, FaFingerprint, FaClipboardCheck,
  FaUmbrellaBeach, FaFileAlt, FaChartBar, FaSyncAlt,
  FaComments, FaCog, FaExclamationTriangle, FaPen
} from "react-icons/fa";
import { supabase } from "../../services/supabase";
import { useSchool } from "../../context/SchoolContext";
import OffdayStaffSchedules from "./OffdayStaffSchedules";
import HRLeaveManagementSection from "./HRLeaveManagementSection";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dar_es_Salaam" }).format(new Date());

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
  const [signatureSchemaReady, setSignatureSchemaReady] = useState(false);
  const [stats, setStats] = useState({
    staff: 0, offToday: 0, pendingLeave: 0, attendanceToday: 0,
  });
  const [staff, setStaff] = useState([]);
  const [devices, setDevices] = useState([]);
  const [offdayRows, setOffdayRows] = useState([]);
  const [leaveRows, setLeaveRows] = useState([]);
  const [entitlementRows, setEntitlementRows] = useState([]);
  const [usedOffdayRows, setUsedOffdayRows] = useState([]);
  void usedOffdayRows;
  const [activeSection, setActiveSection] = useState("overview");
  const [entitlementEmployeeId, setEntitlementEmployeeId] = useState("");
  const [offdayYear, setOffdayYear] = useState(Number(today().slice(0, 4)));
  const [entitlementDays, setEntitlementDays] = useState("7");
  const [savingEntitlement, setSavingEntitlement] = useState(false);
  const [offdayEmployeeId, setOffdayEmployeeId] = useState("");
  const [offdayDate, setOffdayDate] = useState("");
  const [offdayEndDate, setOffdayEndDate] = useState("");
  const [savingOffday, setSavingOffday] = useState(false);
  const [leaveActionId, setLeaveActionId] = useState(null);
  const [deviceName, setDeviceName] = useState("Main Office Fingerprint Scanner");
  const [deviceSerial, setDeviceSerial] = useState("");
  const [registeringDevice, setRegisteringDevice] = useState(false);
  const [deviceMessage, setDeviceMessage] = useState("");
  const [signatureStaff, setSignatureStaff] = useState([]);
  const [signatureRows, setSignatureRows] = useState([]);
  const [signatureBusyId, setSignatureBusyId] = useState(null);
  const [signatureNotice, setSignatureNotice] = useState("");
  const [attendanceEvents, setAttendanceEvents] = useState([]);
  const [attendanceActionId, setAttendanceActionId] = useState(null);
  const [attendanceNotice, setAttendanceNotice] = useState("");

  const loadHRData = useCallback(async () => {
    if (!schoolId) {
      setLoading(false);
      setError("Akaunti hii haijaunganishwa na shule. Tafadhali wasiliana na msimamizi.");
      return;
    }

    setRefreshing(true);
    setError("");
    const date = today();
    const year = Number(date.slice(0, 4));
    try {
      const [staffResult, teacherRecordsResult, offdayResult, leaveResult, attendanceResult, deviceResult, entitlementResult, usedOffdayResult, signatureStaffResult, signatureResult] = await Promise.all([
        supabase.from("employees")
          .select("id,employee_number,first_name,middle_name,last_name,department,position,status")
          .eq("school_id", schoolId)
          .order("first_name", { ascending: true }),
        supabase.from("teachers")
          .select("id,school_id,user_id,employee_number,first_name,middle_name,last_name,specialization,staff_type,status")
          .eq("school_id", schoolId)
          .order("first_name", { ascending: true }),
        supabase.from("hr_offday_rosters")
          .select("id,employee_id,off_date,status,employees(first_name,middle_name,last_name,employee_number)")
          .eq("school_id", schoolId)
          .gte("off_date", `${year}-01-01`)
          .lt("off_date", `${year + 2}-01-01`)
          .order("off_date", { ascending: true }),
        supabase.from("hr_leave_requests")
          .select("id,employee_id,leave_type,start_date,end_date,days_requested,reason,status,employees(first_name,middle_name,last_name,employee_number)")
          .eq("school_id", schoolId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("hr_attendance_events")
          .select("id,employee_id,event_type,event_source,occurred_at,device_id")
          .eq("school_id", schoolId)
          .gte("occurred_at", new Date(`${date}T00:00:00+03:00`).toISOString())
          .lt("occurred_at", new Date(`${date}T23:59:59.999+03:00`).toISOString()),
        supabase.from("hr_biometric_devices")
          .select("id,device_name,device_model,connection_type,bridge_status,last_seen_at")
          .eq("school_id", schoolId),
        supabase.from("hr_offday_entitlements")
          .select("id,employee_id,entitlement_year,entitled_days")
          .eq("school_id", schoolId)
          .in("entitlement_year", [year, year + 1]),
        supabase.from("hr_offday_rosters")
          .select("employee_id")
          .eq("school_id", schoolId)
          .eq("status", "taken")
          .gte("off_date", `${year}-01-01`)
          .lt("off_date", `${year + 1}-01-01`),
        supabase.from("teachers")
          .select("id,school_id,user_id,employee_number,first_name,middle_name,last_name,status")
          .eq("school_id", schoolId)
          .not("user_id", "is", null)
          .order("first_name", { ascending: true }),
        supabase.from("hr_staff_signatures")
          .select("id,teacher_id,profile_id,storage_path,is_active,created_at")
          .eq("school_id", schoolId),
      ]);

      // Staff signatures are an optional, separately migrated workflow. Their absence
      // must never disable the core HR off-day, leave, or attendance modules.
      const missingHRSchema = [offdayResult, leaveResult, attendanceResult, deviceResult, entitlementResult, usedOffdayResult]
        .some((result) => result.error?.code === "42P01" || result.error?.code === "PGRST205");
      const signatureSchemaMissing = signatureResult.error?.code === "42P01" || signatureResult.error?.code === "PGRST205";
      setSignatureSchemaReady(!signatureResult.error && !signatureSchemaMissing);
      if (signatureResult.error && !signatureSchemaMissing) {
        console.warn("Optional HR signature registry is unavailable:", signatureResult.error);
      }

      if (staffResult.error) throw staffResult.error;
      if (teacherRecordsResult.error) throw teacherRecordsResult.error;
      if (signatureStaffResult.error) throw signatureStaffResult.error;
      if (missingHRSchema) {
        setSchemaReady(false);
        const combinedStaff = [
          ...(staffResult.data || []).map((person) => ({ ...person, record_source: "employees" })),
          ...(teacherRecordsResult.data || []).map((person) => ({ ...person, department: person.department || person.staff_type || "Teaching", position: person.position || person.specialization || "—", record_source: "teachers" })),
        ];
        setStaff(combinedStaff);
        setStats((current) => ({ ...current, staff: combinedStaff.length }));
        setError("HR database migration bado haijawekwa. Taarifa za wafanyakazi zinaonekana, lakini Off Days, Leave na Attendance zitaanza baada ya migration kuidhinishwa na kuwekwa.");
        return;
      }

      const errors = [offdayResult, leaveResult, attendanceResult, deviceResult, entitlementResult, usedOffdayResult]
        .filter((result) => result.error);
      if (errors.length) throw errors[0].error;

      setSchemaReady(true);
      const employeeRows = staffResult.data || [];
      const employeeNumbers = new Set(employeeRows.map((person) => String(person.employee_number || "").trim()).filter(Boolean));
      const unlinkedTeacherRows = (teacherRecordsResult.data || []).filter((teacher) => !employeeNumbers.has(String(teacher.employee_number || "").trim()));
      const combinedStaff = [
        ...employeeRows.map((person) => ({ ...person, record_source: "employees" })),
        ...unlinkedTeacherRows.map((person) => ({ ...person, department: person.staff_type || "Teaching", position: person.specialization || "—", record_source: "teachers" })),
      ];
      setStaff(combinedStaff);
      setOffdayRows(offdayResult.data || []);
      setLeaveRows(leaveResult.data || []);
      setEntitlementRows(entitlementResult.data || []);
      setUsedOffdayRows(usedOffdayResult.data || []);
      setDevices(deviceResult.data || []);
      setSignatureStaff(signatureStaffResult.data || []);
      setSignatureRows(signatureResult.error ? [] : (signatureResult.data || []));
      const events = attendanceResult.data || [];
      setAttendanceEvents(events);
      const latestByEmployee = new Map();
      for (const event of [...events].sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at))) {
        latestByEmployee.set(event.employee_id, event);
      }
      const presentIds = new Set([...latestByEmployee.entries()].filter(([, event]) => event.event_type === "check_in").map(([employeeId]) => employeeId));
      setStats({
        staff: combinedStaff.length,
        offToday: (offdayResult.data || []).filter((row) => row.off_date === date && row.status !== "cancelled").length,
        pendingLeave: (leaveResult.data || []).filter((row) => row.status === "pending").length,
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

  const pairZK9500 = useCallback(async (deviceId) => {
    setDeviceMessage("");
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("Tafadhali ingia tena kwenye mfumo.");

      const apiBase = new URL(
        import.meta.env.VITE_API_URL || "https://africore-erp-pro.onrender.com"
      ).origin;
      const response = await fetch(`${apiBase}/api/hr/biometric/devices/${deviceId}/pair`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Imeshindikana kuunganisha kifaa.");
      }
      setDeviceMessage(
        `Pairing token imetengenezwa kwa kifaa #${deviceId}. Ihifadhi kwa usalama na itumike mara moja kwenye Windows Agent: ${payload.agent_token}`
      );
    } catch (pairError) {
      setDeviceMessage(pairError.message || "Imeshindikana kuunganisha kifaa.");
    }
  }, []);

  const registerZK9500 = useCallback(async (event) => {
    event.preventDefault();
    if (!schoolId || !schemaReady || registeringDevice) return;

    setRegisteringDevice(true);
    setDeviceMessage("");
    try {
      const { error: insertError } = await supabase
        .from("hr_biometric_devices")
        .insert({
          school_id: schoolId,
          device_name: deviceName.trim() || "ZK9500 Fingerprint Scanner",
          device_model: "ZK9500",
          manufacturer: "ZKTeco",
          connection_type: "USB",
          bridge_status: "not_connected",
          device_serial_number: deviceSerial.trim() || null,
          settings: {
            integration: "zkfinger_windows_sdk",
            bridge_protocol: "africore-usb-bridge-v1",
            biometric_templates_stored_in_cloud: false
          }
        });

      if (insertError) throw insertError;
      setDeviceMessage("ZKTeco ZK9500 imesajiliwa kwenye shule hii. Bado inahitaji Windows bridge na SDK ya kifaa kabla ya kusoma fingerprint.");
      setDeviceSerial("");
      await loadHRData();
    } catch (registerError) {
      console.error("ZK9500 registration error:", registerError);
      setDeviceMessage(registerError.message || "Imeshindikana kusajili kifaa.");
    } finally {
      setRegisteringDevice(false);
    }
  }, [schoolId, schemaReady, registeringDevice, deviceName, deviceSerial, loadHRData]);

  useEffect(() => { loadHRData(); }, [loadHRData]);

  const saveEntitlement = useCallback(async (event) => {
    event.preventDefault();
    if (!schoolId || !entitlementEmployeeId || !entitlementDays || savingEntitlement) return;
    const days = Number(entitlementDays);
    if (!Number.isFinite(days) || days < 0 || days > 366) {
      setError("Idadi ya off-days lazima iwe kati ya 0 na 366.");
      return;
    }
    setSavingEntitlement(true);
    setError("");
    try {
      const { error: upsertError } = await supabase.from("hr_offday_entitlements").upsert({
        school_id: schoolId,
        employee_id: Number(entitlementEmployeeId),
        entitlement_year: Number(offdayYear),
        entitled_days: days
      }, { onConflict: "school_id,employee_id,entitlement_year" });
      if (upsertError) throw upsertError;
      setEntitlementEmployeeId("");
      await loadHRData();
    } catch (saveError) {
      setError(saveError.message || "Imeshindikana kuhifadhi haki ya off-days.");
    } finally {
      setSavingEntitlement(false);
    }
  }, [schoolId, entitlementEmployeeId, entitlementDays, offdayYear, savingEntitlement, loadHRData]);

  const saveOffday = useCallback(async (event) => {
    event.preventDefault();
    if (!schoolId || !offdayEmployeeId || !offdayDate || !offdayEndDate || savingOffday) return;
    if (offdayEndDate < offdayDate) { setError("The end date cannot be earlier than the start date."); return; }
    const selectedYear = Number(offdayDate.slice(0, 4));
    if (Number(offdayEndDate.slice(0, 4)) !== selectedYear) { setError("Schedule one calendar year at a time so each year uses its own entitlement."); return; }
    const entitlement = entitlementRows.find((row) => Number(row.employee_id) === Number(offdayEmployeeId) && Number(row.entitlement_year) === selectedYear);
    if (!entitlement) { setError("Set this employee entitlement for " + selectedYear + " before scheduling dates."); return; }
    setSavingOffday(true);
    setError("");
    try {
      const start = new Date(`${offdayDate}T00:00:00Z`);
      const end = new Date(`${offdayEndDate}T00:00:00Z`);
      const dayRows = [];
      for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
        dayRows.push({
          school_id: schoolId,
          employee_id: Number(offdayEmployeeId),
          off_date: cursor.toISOString().slice(0, 10),
          status: "planned"
        });
      }
      const alreadyScheduled = offdayRows.filter((row) => Number(row.employee_id) === Number(offdayEmployeeId) && row.status !== "cancelled" && Number(row.off_date.slice(0, 4)) === selectedYear).length;
      const cancelledRows = offdayRows.filter((existing) => Number(existing.employee_id) === Number(offdayEmployeeId) && existing.status === "cancelled" && dayRows.some((row) => row.off_date === existing.off_date));
      const newDates = dayRows.filter((row) => !offdayRows.some((existing) => Number(existing.employee_id) === Number(offdayEmployeeId) && existing.off_date === row.off_date && existing.status !== "cancelled"));
      if (alreadyScheduled + newDates.length > Number(entitlement.entitled_days)) throw new Error("This schedule exceeds the " + selectedYear + " entitlement. Remaining days: " + Math.max(0, Number(entitlement.entitled_days) - alreadyScheduled) + ".");
      const { error: insertError } = await supabase.from("hr_offday_rosters").upsert(dayRows, { onConflict: "employee_id,off_date", ignoreDuplicates: true });
      if (insertError) throw insertError;
      if (cancelledRows.length) {
        const { error: reopenError } = await supabase.from("hr_offday_rosters").update({ status: "planned" }).in("id", cancelledRows.map((row) => row.id)).eq("school_id", schoolId);
        if (reopenError) throw reopenError;
      }
      setOffdayEmployeeId("");
      setOffdayDate("");
      setOffdayEndDate("");
      await loadHRData();
    } catch (saveError) {
      setError(saveError.message || "Unable to save the off-day schedule.");
    } finally {
      setSavingOffday(false);
    }
  }, [schoolId, offdayEmployeeId, offdayDate, offdayEndDate, savingOffday, entitlementRows, offdayRows, loadHRData]);

  const updateOffdayStatus = useCallback(async (rosterId, status) => {
    if (!schoolId || !rosterId) return;
    setError("");
    try {
      const { error: updateError } = await supabase.from("hr_offday_rosters")
        .update({ status })
        .eq("id", rosterId)
        .eq("school_id", schoolId);
      if (updateError) throw updateError;
      await loadHRData();
    } catch (updateError) {
      setError(updateError.message || "Unable to update the off-day status.");
    }
  }, [schoolId, loadHRData]);

  const reviewLeave = useCallback(async (requestId, status) => {
    if (!schoolId || leaveActionId) return;
    setLeaveActionId(requestId);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: updateError } = await supabase.from("hr_leave_requests")
        .update({ status, reviewed_by: user?.id || null, reviewed_at: new Date().toISOString() })
        .eq("id", requestId)
        .eq("school_id", schoolId)
        .eq("status", "pending");
      if (updateError) throw updateError;
      await loadHRData();
    } catch (reviewError) {
      setError(reviewError.message || "Imeshindikana kufanya uamuzi wa ombi.");
    } finally {
      setLeaveActionId(null);
    }
  }, [schoolId, leaveActionId, loadHRData]);

  const recordAttendance = useCallback(async (employee, eventType) => {
    if (!schoolId || !schemaReady || !employee?.id || attendanceActionId) return;
    setAttendanceActionId(employee.id);
    setAttendanceNotice("");
    setError("");
    try {
      const todayEvents = attendanceEvents
        .filter((event) => event.employee_id === employee.id)
        .sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at));
      const latest = todayEvents[todayEvents.length - 1];
      if (eventType === "check_out" && latest?.event_type !== "check_in") {
        throw new Error("Employee huyu hajaingia kazini leo; haiwezekani kurekodi Sign Out.");
      }
      if (eventType === "check_in" && latest?.event_type === "check_in") {
        throw new Error("Employee huyu tayari ameingia kazini leo.");
      }
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user?.id) throw new Error("Session ya mtumiaji haijathibitishwa. Ingia tena.");
      const { error: insertError } = await supabase.from("hr_attendance_events").insert({
        school_id: schoolId,
        employee_id: employee.id,
        event_type: eventType,
        event_source: "manual",
        created_by: authData.user.id,
        occurred_at: new Date().toISOString(),
      });
      if (insertError) throw insertError;
      setAttendanceNotice(`${eventType === "check_in" ? "Sign In" : "Sign Out"} imerekodiwa kwa ${[employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(" ")}.`);
      await loadHRData();
    } catch (attendanceError) {
      setAttendanceNotice(attendanceError.message || "Imeshindikana kurekodi mahudhurio.");
    } finally {
      setAttendanceActionId(null);
    }
  }, [schoolId, schemaReady, attendanceActionId, attendanceEvents, loadHRData]);

  const registerStaffSignature = useCallback(async (teacher, file) => {
    if (!schoolId || !signatureSchemaReady || !teacher?.user_id || !file) return;
    if (!["image/png", "image/jpeg"].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setSignatureNotice("Tumia picha ya PNG/JPG isiyozidi 2 MB.");
      return;
    }
    setSignatureBusyId(teacher.id);
    setSignatureNotice("");
    try {
      const previousSignature = signatureRows.find((row) => row.teacher_id === teacher.id);
      const path = `${schoolId}/${teacher.id}/signature-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage.from("hr-staff-signatures").upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { data: { user } } = await supabase.auth.getUser();
      const { error: saveError } = await supabase.from("hr_staff_signatures").upsert({
        school_id: schoolId,
        teacher_id: teacher.id,
        profile_id: teacher.user_id,
        storage_path: path,
        is_active: true,
        registered_by: user?.id || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "school_id,teacher_id" });
      if (saveError) {
        await supabase.storage.from("hr-staff-signatures").remove([path]);
        throw saveError;
      }
      if (previousSignature?.storage_path && previousSignature.storage_path !== path) {
        await supabase.storage.from("hr-staff-signatures").remove([previousSignature.storage_path]);
      }
      setSignatureNotice("Saini limehifadhiwa kwa mafanikio.");
      await loadHRData();
    } catch (saveError) {
      setSignatureNotice(saveError.message || "Imeshindikana kuhifadhi saini.");
    } finally {
      setSignatureBusyId(null);
    }
  }, [schoolId, signatureSchemaReady, signatureRows, loadHRData]);

  const normalizedStaffStatus = (status) => {
    const value = String(status || "").trim().toLowerCase();
    if (["active", "enabled", "working"].includes(value)) return "Active";
    if (["inactive", "disabled", "terminated", "left", "resigned", "retired"].includes(value)) return "Inactive";
    return "Not set";
  };
  const allStaff = staff;
  const activeStaff = useMemo(
    () => staff.filter((person) => normalizedStaffStatus(person.status) === "Active"),
    [staff]
  );
  // HR transactions reference employees.id. The HR sync migration mirrors each
  // teacher into employees, preserving one canonical ID for all HR workflows.
  const activeEmployeeStaff = useMemo(
    () => activeStaff.filter((person) => person.record_source === "employees"),
    [activeStaff]
  );

  const sections = [
    { id: "overview", label: "Overview", icon: <FaChartBar /> },
    { id: "staff", label: "Staff Records", icon: <FaUsers /> },
    { id: "offdays", label: "Off Day Management", icon: <FaCalendarAlt /> },
    { id: "attendance", label: "Attendance & USB Fingerprint", icon: <FaFingerprint /> },
    { id: "leave", label: "Leave Management", icon: <FaUmbrellaBeach /> },
    { id: "reports", label: "HR Reports & Documents", icon: <FaFileAlt /> },
    { id: "signatures", label: "Staff Signature Registry", icon: <FaPen /> },
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

      {activeSection === "signatures" && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div><h2 className="text-xl font-bold text-slate-900">Staff Signature Registration</h2><p className="mt-1 text-sm text-slate-500">HR husajili picha ya saini ya kila mfanyakazi. Secretary atatumia saini hizi kwenye mchakato wa kusaini nyaraka.</p></div>
          {signatureNotice && <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{signatureNotice}</p>}
          {!signatureSchemaReady ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Usajili wa saini unasubiri migration yake tofauti. Hii haiathiri Staff Records, Off Days, Leave au Attendance.
            </p>
          ) : <div className="divide-y divide-slate-100">
            {signatureStaff.map((person) => {
              const existing = signatureRows.find((row) => row.teacher_id === person.id && row.is_active);
              const fullName = [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(" ");
              return <div key={person.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="font-semibold text-slate-900">{fullName || person.employee_number}</p><p className="text-xs text-slate-500">{person.employee_number || "No employee number"} • {existing ? "Signature registered" : "No signature registered"}</p></div>
                <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  {signatureBusyId === person.id ? "Saving..." : existing ? "Replace signature" : "Upload signature"}
                  <input type="file" accept="image/png,image/jpeg" className="sr-only" disabled={signatureBusyId === person.id} onChange={(event) => { const file = event.target.files?.[0]; if (file) registerStaffSignature(person, file); event.target.value = ""; }} />
                </label>
              </div>;
            })}
            {signatureStaff.length === 0 && <p className="py-5 text-sm text-slate-500">Hakuna Staff wenye akaunti za kuingia zilizounganishwa na shule hii.</p>}
          </div>}
          <p className="text-xs text-slate-500">Picha zinakubaliwa PNG/JPG, hadi 2 MB. Hifadhi ni ya faragha na inapatikana kwa HR na watumiaji wenye ruhusa husika.</p>
        </section>
      )}

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
              <p className="mt-1 text-sm text-slate-500">Scheduled Off Days za mapumziko ya wafanyakazi.</p>
              {!schemaReady ? <p className="mt-5 text-sm text-slate-500">Ratiba zitaonekana baada ya HR database migration.</p> :
                offdayRows.length === 0 ? <p className="mt-5 text-sm text-slate-500">Hakuna off-day iliyopangwa kwa sasa.</p> :
                <div className="mt-4 divide-y divide-slate-100">{offdayRows.slice(0, 6).map((row) => <div key={row.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="font-medium text-slate-800">{[row.employees?.first_name, row.employees?.middle_name, row.employees?.last_name].filter(Boolean).join(" ") || row.employees?.employee_number || "Staff"}</span><span className="rounded-lg bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">{row.off_date}</span></div>)}</div>}
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">USB Fingerprint Scanner</h2><p className="mt-1 text-sm text-slate-500">Muunganisho wa kifaa cha fingerprint kupitia kompyuta.</p></div><FaFingerprint className="text-3xl text-blue-700" /></div>
              {devices.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4"><p className="font-semibold text-slate-800">No USB bridge connected</p><p className="mt-1 text-sm text-slate-500">Mfumo utaonyesha hali ya kifaa baada ya kusakinisha bridge inayolingana na model ya scanner.</p></div> :
                <div className="mt-4 space-y-3">{devices.map((device) => <div key={device.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div><p className="font-semibold text-slate-800">{device.device_name}</p><p className="text-xs text-slate-500">{device.device_model || "Model not set"} • {device.connection_type} • ID #{device.id}</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{device.bridge_status || "Not connected"}</span><button type="button" onClick={() => pairZK9500(device.id)} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-blue-800">Pair Windows Agent</button></div></div>)}</div>}
              {deviceMessage && <p role="status" className="mt-3 break-words rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{deviceMessage}</p>}
              <p className="mt-4 text-xs leading-5 text-slate-500">Usalama: AfriCore haitahifadhi picha au template ghafi za alama za vidole. Itapokea tu matokeo ya uthibitisho na muda wa check-in/check-out.</p>
            </article>
          </section>
        </>
      )}

      {activeSection === "staff" && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5"><h2 className="text-lg font-bold text-slate-900">Staff Records</h2><p className="text-sm text-slate-500">{allStaff.length} total staff records • {activeStaff.length} active</p></div>
          {loading ? <p className="p-5 text-sm text-slate-500">Loading staff...</p> : allStaff.length === 0 ? <p className="p-5 text-sm text-slate-500">Hakuna wafanyakazi waliopatikana.</p> :
            <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Employee No.</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Position</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{allStaff.map((person) => { const status = normalizedStaffStatus(person.status); return <tr key={`${person.record_source}-${person.id}`}><td className="px-4 py-3 font-semibold">{person.employee_number || "—"}</td><td className="px-4 py-3">{[person.first_name, person.middle_name, person.last_name].filter(Boolean).join(" ")}</td><td className="px-4 py-3">{person.department || "—"}</td><td className="px-4 py-3">{person.position || "—"}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status === "Active" ? "bg-emerald-50 text-emerald-700" : status === "Inactive" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}>{status}</span>{person.record_source === "teachers" ? <span className="ml-2 text-xs text-slate-500">(Teacher record)</span> : null}</td></tr>; })}</tbody></table></div>}
        </section>
      )}

      {activeSection === "offdays" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold text-slate-900">Off Day Management</h2>
          <p className="mt-1 text-sm text-slate-500">Set annual off-day entitlements, schedule staff days off, and track used and remaining days.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Annual entitlement</p><p className="mt-1 font-bold text-slate-800">Per staff member</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Rotation planning</p><p className="mt-1 font-bold text-slate-800">Staggered schedules</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Coverage control</p><p className="mt-1 font-bold text-slate-800">Avoid understaffing</p></div></div>
          {schemaReady && (
            <form onSubmit={saveOffday} className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-4">
              <label className="text-sm font-medium text-slate-700 sm:col-span-1">Employee
                <select required value={offdayEmployeeId} onChange={(event) => setOffdayEmployeeId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                  <option value="">Select employee</option>
                  {activeEmployeeStaff.map((person) => <option key={person.id} value={person.id}>{[person.first_name, person.middle_name, person.last_name].filter(Boolean).join(" ")} ({person.employee_number || person.id})</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">Start date
                <input required type="date" min={today()} value={offdayDate} onChange={(event) => setOffdayDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
              </label>
              <label className="text-sm font-medium text-slate-700">End date\n                <input required type="date" min={offdayDate || today()} value={offdayEndDate} onChange={(event) => setOffdayEndDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />\n              </label>\n              <div className="flex flex-col justify-end gap-1"><p className="text-xs text-slate-500">{offdayDate && offdayEndDate && offdayEndDate >= offdayDate ? `Total: ${Math.round((Date.parse(`${offdayEndDate}T00:00:00Z`) - Date.parse(`${offdayDate}T00:00:00Z`)) / 86400000) + 1} day(s)` : "Select a start and end date."}</p><button disabled={savingOffday || !offdayEmployeeId || !offdayDate || !offdayEndDate || offdayEndDate < offdayDate} className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{savingOffday ? "Saving..." : "Schedule Off Days"}</button></div>
            </form>
          )}
          {schemaReady && <OffdayStaffSchedules staff={activeEmployeeStaff} rows={offdayRows} entitlements={entitlementRows} year={offdayYear} schoolId={schoolId} onStatusChange={updateOffdayStatus} onRefresh={loadHRData} />}
          {schemaReady && (
            <form onSubmit={saveEntitlement} className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
              <label className="text-sm font-medium text-slate-700">Employee
                <select required value={entitlementEmployeeId} onChange={(event) => setEntitlementEmployeeId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                  <option value="">Select employee</option>
                  {activeEmployeeStaff.map((person) => <option key={person.id} value={person.id}>{[person.first_name, person.middle_name, person.last_name].filter(Boolean).join(" ")}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">Entitlement year
                <select value={offdayYear} onChange={(event) => setOffdayYear(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"><option value={Number(today().slice(0, 4))}>{today().slice(0, 4)}</option><option value={Number(today().slice(0, 4)) + 1}>{Number(today().slice(0, 4)) + 1}</option></select>
              </label>
              <label className="text-sm font-medium text-slate-700">Annual off-day entitlement
                <input required type="number" min="0" max="366" step="0.5" value={entitlementDays} onChange={(event) => setEntitlementDays(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
              </label>
              <div className="flex items-end"><button disabled={savingEntitlement || !entitlementEmployeeId} className="w-full rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{savingEntitlement ? "Saving..." : "Save entitlement"}</button></div>
            </form>
          )}
          {schemaReady && <div className="mt-4 overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Employee</th><th className="px-3 py-2">Year</th><th className="px-3 py-2">Entitled</th><th className="px-3 py-2">Closed</th><th className="px-3 py-2">Remaining</th></tr></thead><tbody className="divide-y divide-slate-100">{entitlementRows.map((row) => { const person = staff.find((item) => item.id === row.employee_id); return <tr key={row.id}><td className="px-3 py-2">{[person?.first_name, person?.middle_name, person?.last_name].filter(Boolean).join(" ") || "Staff"}</td><td className="px-3 py-2">{row.entitlement_year}</td><td className="px-3 py-2">{row.entitled_days}</td><td className="px-3 py-2">{offdayRows.filter((item) => item.employee_id === row.employee_id && item.status === "taken" && Number(item.off_date.slice(0, 4)) === Number(row.entitlement_year)).length}</td><td className="px-3 py-2 font-semibold">{Math.max(0, Number(row.entitled_days) - offdayRows.filter((item) => item.employee_id === row.employee_id && item.status !== "cancelled" && Number(item.off_date.slice(0, 4)) === Number(row.entitlement_year)).length)}</td></tr>; })}</tbody></table></div>}
          {!schemaReady && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Off-day records are not enabled in the database yet. Apply the required HR migration first.</p>}
        </section>
      )}

      {activeSection === "attendance" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3"><FaFingerprint className="text-2xl text-blue-700" /><div><h2 className="text-lg font-bold text-slate-900">Biometric Attendance</h2><p className="text-sm text-slate-500">USB fingerprint scanner integration</p></div></div>
          <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/60 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="font-semibold text-slate-900">Supported scanner: ZKTeco ZK9500</p><p className="mt-1 text-sm leading-6 text-slate-600">USB optical reader. Itahitaji PC yenye Windows 8 au toleo jipya zaidi, ZKTeco ZKFinger SDK/driver na AfriCore local bridge. Windows 8/10 zitatumika kama matoleo ya kuanzia kwa majaribio; Windows 11 itathibitishwa kwa kifaa na SDK halisi. Kifaa hiki hakifanyi kazi kama attendance terminal ya kujitegemea.</p></div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-blue-800">USB • ZK9500</span>
            </div>
            {schemaReady ? (
              <form onSubmit={registerZK9500} className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">Jina la kifaa
                  <input value={deviceName} onChange={(event) => setDeviceName(event.target.value)} maxLength={100} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" placeholder="Main Office Fingerprint Scanner" />
                </label>
                <label className="text-sm font-medium text-slate-700">Serial number (hiari)
                  <input value={deviceSerial} onChange={(event) => setDeviceSerial(event.target.value)} maxLength={100} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" placeholder="Serial number ya kifaa" />
                </label>
                <div className="sm:col-span-2"><button type="submit" disabled={registeringDevice || !deviceName.trim()} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">{registeringDevice ? "Inasajili..." : "Register ZK9500 device"}</button></div>
              </form>
            ) : <p className="mt-3 text-sm text-amber-800">Sajili kifaa baada ya HR database migration kuwekwa na kuidhinishwa.</p>}
            {deviceMessage && <p role="status" className="mt-3 rounded-lg bg-white p-3 text-sm text-slate-700">{deviceMessage}</p>}
          </div>
          {schemaReady && (
            <div className="mt-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-bold text-slate-900">Staff Sign In / Sign Out</h3><p className="text-sm text-slate-500">Rekodi muda wa kuingia na kutoka kwa mfanyakazi. Hii ni njia ya manual ya muda wakati USB bridge inakamilishwa.</p></div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Manual attendance</span></div>
              {attendanceNotice && <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{attendanceNotice}</p>}
              <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-3">Employee</th><th className="px-3 py-3">Today status</th><th className="px-3 py-3">Last event</th><th className="px-3 py-3">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{activeEmployeeStaff.map((person) => { const personEvents = attendanceEvents.filter((event) => event.employee_id === person.id).sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at)); const latest = personEvents[personEvents.length - 1]; const isIn = latest?.event_type === "check_in"; const lastTime = latest ? new Date(latest.occurred_at).toLocaleTimeString("en-GB", { timeZone: "Africa/Dar_es_Salaam", hour: "2-digit", minute: "2-digit" }) : "—"; return <tr key={person.id}><td className="px-3 py-3"><p className="font-semibold text-slate-900">{[person.first_name, person.middle_name, person.last_name].filter(Boolean).join(" ")}</p><p className="text-xs text-slate-500">{person.employee_number || "—"}</p></td><td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${isIn ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{isIn ? "Signed In" : latest?.event_type === "check_out" ? "Signed Out" : "Not Signed In"}</span></td><td className="px-3 py-3 text-slate-600">{latest ? `${latest.event_type === "check_in" ? "Sign In" : "Sign Out"} • ${lastTime}` : "No attendance yet"}</td><td className="px-3 py-3"><button type="button" disabled={attendanceActionId === person.id || (isIn && !latest)} onClick={() => recordAttendance(person, isIn ? "check_out" : "check_in")} className={`rounded-lg px-3 py-2 text-xs font-bold text-white disabled:opacity-50 ${isIn ? "bg-rose-700 hover:bg-rose-800" : "bg-emerald-700 hover:bg-emerald-800"}`}>{attendanceActionId === person.id ? "Saving..." : isIn ? "Sign Out" : "Sign In"}</button></td></tr>; })}{activeEmployeeStaff.length === 0 && <tr><td colSpan="4" className="px-3 py-6 text-center text-slate-500">Hakuna wafanyakazi hai waliopatikana.</td></tr>}</tbody></table></div>
              <p className="text-xs text-slate-500">Matukio yanahifadhiwa kwa shule hii pekee. Mfumo hurekodi muda wa server na chanzo cha tukio; alama za vidole hazihifadhiwi kwenye cloud.</p>
            </div>
          )}
          <p className="mt-4 text-xs leading-5 text-slate-500">Kila tukio litahifadhi employee ID, check-in/check-out, timestamp, device ID na chanzo. Fingerprint images/templates hazitahifadhiwa Supabase. Matching ya fingerprint itafanyika kwenye PC ya shule.</p>
        </section>
      )}

      {activeSection === "leave" && <HRLeaveManagementSection requests={leaveRows} loading={loading} onReview={reviewLeave} busyId={leaveActionId} />}

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
