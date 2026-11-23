import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dar_es_Salaam" }).format(new Date());
const dayCount = (start, end) => Math.max(1, Math.round((Date.parse(end + "T00:00:00Z") - Date.parse(start + "T00:00:00Z")) / 86400000) + 1);

export default function LeaveManagementPanel({ profile, canReview }) {
  const isHR = Boolean(canReview) || Number(profile?.role_id) === 18 || [1, 2].includes(Number(profile?.role_id));
  const [requests, setRequests] = useState([]);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [form, setForm] = useState({ leave_type: "Annual Leave", start_date: "", end_date: "", reason: "" });

  const load = useCallback(async () => {
    if (!profile?.id || !profile?.school_id) { setRequests([]); setLoading(false); return; }
    setLoading(true); setNotice("");
    try {
      let employeeRow = null;
      if (profile.employee_id) {
        const result = await supabase.from("employees").select("id,school_id,employee_number,first_name,middle_name,last_name").eq("id", profile.employee_id).eq("school_id", profile.school_id).maybeSingle();
        if (result.error) throw result.error;
        employeeRow = result.data;
      }
      if (!employeeRow && profile.teacher_id) {
        const result = await supabase.from("employees").select("id,school_id,employee_number,first_name,middle_name,last_name").eq("source_teacher_id", profile.teacher_id).eq("school_id", profile.school_id).maybeSingle();
        if (result.error) throw result.error;
        employeeRow = result.data;
      }
      if (!employeeRow) {
        const result = await supabase.from("employees").select("id,school_id,employee_number,first_name,middle_name,last_name").eq("user_id", profile.id).eq("school_id", profile.school_id).maybeSingle();
        if (result.error) throw result.error;
        employeeRow = result.data;
      }
      setEmployee(employeeRow || null);
      let query = supabase.from("hr_leave_requests")
        .select("id,school_id,employee_id,leave_type,start_date,end_date,days_requested,reason,status,reviewed_by,reviewed_at,created_at,employees(first_name,middle_name,last_name,employee_number,user_id)")
        .eq("school_id", profile.school_id).order("created_at", { ascending: false }).limit(200);
      if (!isHR && employeeRow?.id) query = query.eq("employee_id", employeeRow.id);
      const result = await query;
      if (result.error) throw result.error;
      setRequests(result.data || []);
    } catch (error) {
      setNotice(error?.message || "Unable to load leave requests.");
    } finally { setLoading(false); }
  }, [profile?.id, profile?.school_id, profile?.employee_id, profile?.teacher_id, isHR]);

  useEffect(() => { load(); }, [load]);

  const submit = async (event) => {
    event.preventDefault();
    if (!employee?.id) { setNotice("Your account is not linked to an employee record. Contact HR to link your staff profile."); return; }
    if (!form.start_date || !form.end_date || form.end_date < form.start_date || !form.reason.trim()) { setNotice("Choose valid start and end dates and enter a reason."); return; }
    setSaving(true); setNotice("");
    try {
      const { error } = await supabase.from("hr_leave_requests").insert({
        school_id: profile.school_id, employee_id: employee.id, leave_type: form.leave_type,
        start_date: form.start_date, end_date: form.end_date, days_requested: dayCount(form.start_date, form.end_date),
        reason: form.reason.trim(), status: "pending",
      });
      if (error) throw error;
      setForm({ leave_type: "Annual Leave", start_date: "", end_date: "", reason: "" });
      setNotice("Your leave request has been submitted to HR.");
      await load();
    } catch (error) { setNotice(error?.message || "Unable to submit your leave request."); }
    finally { setSaving(false); }
  };

  const decide = async (request, status) => {
    if (!isHR || !request?.id) return;
    setSaving(true); setNotice("");
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const { error } = await supabase.from("hr_leave_requests")
        .update({ status, reviewed_by: authData.user?.id || null, reviewed_at: new Date().toISOString() })
        .eq("id", request.id).eq("school_id", profile.school_id).eq("status", "pending");
      if (error) throw error;
      if (request.employees?.user_id) {
        const { error: notificationError } = await supabase.from("notifications").insert({
          school_id: profile.school_id, user_id: request.employees.user_id,
          title: status === "approved" ? "Leave request approved" : "Leave request rejected",
          message: "Your leave request from " + request.start_date + " to " + request.end_date + " was " + status + ".",
          notification_type: "leave_request", is_read: false,
        });
        if (notificationError) console.warn("Leave notification could not be created:", notificationError.message);
      }
      setNotice(status === "approved" ? "Leave request approved." : "Leave request rejected.");
      await load();
    } catch (error) { setNotice(error?.message || "Unable to process this leave request."); }
    finally { setSaving(false); }
  };

  const grouped = useMemo(() => requests, [requests]);
  return <section className="space-y-5">
    {!isHR && <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5">
      <div><h2 className="text-lg font-bold text-slate-900">Request Leave</h2><p className="mt-1 text-sm text-slate-500">Submit a leave request to HR for review and approval.</p></div>
      {!employee && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Your account is not linked to an employee record yet. HR must link your staff profile before you can submit a leave request.</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-medium text-slate-700">Leave type<select value={form.leave_type} onChange={(e) => setForm((p) => ({ ...p, leave_type: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"><option>Annual Leave</option><option>Sick Leave</option><option>Maternity Leave</option><option>Paternity Leave</option><option>Compassionate Leave</option><option>Study Leave</option><option>Unpaid Leave</option><option>Other</option></select></label>
        <label className="text-sm font-medium text-slate-700">Start date<input required type="date" min={today()} value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value, end_date: p.end_date && p.end_date < e.target.value ? e.target.value : p.end_date }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" /></label>
        <label className="text-sm font-medium text-slate-700">End date<input required type="date" min={form.start_date || today()} value={form.end_date} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" /></label>
      </div>
      <label className="mt-3 block text-sm font-medium text-slate-700">Reason<textarea required rows={3} value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" placeholder="Explain why you are requesting leave..." /></label>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-500">{form.start_date && form.end_date && form.end_date >= form.start_date ? dayCount(form.start_date, form.end_date) + " calendar day(s)" : "Select leave dates."}</p><button disabled={saving || !employee?.id} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Submitting..." : "Submit to HR"}</button></div>
    </form>}
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-bold text-slate-900">{isHR ? "Staff Leave Requests" : "My Leave Requests"}</h2><p className="mt-1 text-sm text-slate-500">{isHR ? "Review pending requests and view previous decisions." : "Track the status of your leave applications."}</p></div><button type="button" onClick={load} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Refresh</button></div>
      {notice && <p role="status" className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{notice}</p>}
      {loading ? <p className="mt-4 text-sm text-slate-500">Loading leave requests...</p> : grouped.length === 0 ? <p className="mt-4 text-sm text-slate-500">No leave requests found.</p> : <div className="mt-4 space-y-2">
        {grouped.map((request) => {
          const name = [request.employees?.first_name, request.employees?.middle_name, request.employees?.last_name].filter(Boolean).join(" ") || request.employees?.employee_number || "Staff member";
          const expanded = expandedId === request.id;
          return <article key={request.id} className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-semibold text-slate-900">{isHR ? name : request.leave_type}</p><p className="mt-1 text-xs text-slate-500">{request.leave_type} · {request.start_date} to {request.end_date} · {request.days_requested} day(s)</p></div><div className="flex items-center gap-2"><span className={"rounded-full px-2.5 py-1 text-xs font-bold " + (request.status === "approved" ? "bg-emerald-100 text-emerald-800" : request.status === "rejected" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800")}>{request.status.toUpperCase()}</span><button type="button" onClick={() => setExpandedId(expanded ? null : request.id)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">{expanded ? "Close" : "View"}</button></div></div>
            {expanded && <div className="border-t border-slate-100 bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-500">Reason</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{request.reason}</p><p className="mt-3 text-xs text-slate-500">Submitted: {request.created_at ? new Date(request.created_at).toLocaleString("en-GB") : "—"}</p>{request.reviewed_at && <p className="mt-1 text-xs text-slate-500">Reviewed: {new Date(request.reviewed_at).toLocaleString("en-GB")}</p>}{isHR && request.status === "pending" && <div className="mt-4 flex gap-2"><button type="button" disabled={saving} onClick={() => decide(request, "approved")} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Approve</button><button type="button" disabled={saving} onClick={() => decide(request, "rejected")} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50">Reject</button></div>}</div>}
          </article>;
        })}
      </div>}
    </section>
  </section>;
}
