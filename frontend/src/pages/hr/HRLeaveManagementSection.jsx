import { useMemo, useState } from "react";

export default function HRLeaveManagementSection({ requests = [], loading, onReview, busyId }) {
  const [expandedStaffId, setExpandedStaffId] = useState(null);
  const [expandedRequestId, setExpandedRequestId] = useState(null);
  const grouped = useMemo(() => {
    const groups = new Map();
    requests.forEach((request) => {
      const key = String(request.employee_id);
      if (!groups.has(key)) groups.set(key, { id: key, employee: request.employees || {}, requests: [] });
      groups.get(key).requests.push(request);
    });
    return [...groups.values()];
  }, [requests]);

  return <section className="rounded-2xl border border-slate-200 bg-white p-5">
    <div><h2 className="text-lg font-bold text-slate-900">Leave Management</h2><p className="mt-1 text-sm text-slate-500">Staff leave requests are grouped by employee. Open a staff record to view applications and decisions.</p></div>
    {loading ? <p className="mt-4 text-sm text-slate-500">Loading leave requests...</p> : grouped.length === 0 ? <p className="mt-4 text-sm text-slate-500">No leave requests recorded.</p> : <div className="mt-4 space-y-2">
      {grouped.map((group) => {
        const name = [group.employee.first_name, group.employee.middle_name, group.employee.last_name].filter(Boolean).join(" ") || group.employee.employee_number || "Employee";
        const pending = group.requests.filter((request) => request.status === "pending").length;
        const expanded = expandedStaffId === group.id;
        return <article key={group.id} className="overflow-hidden rounded-xl border border-slate-200">
          <button type="button" onClick={() => setExpandedStaffId(expanded ? null : group.id)} className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left hover:bg-slate-50">
            <div><p className="font-semibold text-slate-900">{name}</p><p className="mt-1 text-xs text-slate-500">{group.requests.length} leave request(s) · {pending} pending</p></div>
            <span className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">{expanded ? "Close" : "View"}</span>
          </button>
          {expanded && <div className="space-y-2 border-t border-slate-100 bg-slate-50 p-3">
            {group.requests.map((request) => {
              const requestExpanded = expandedRequestId === request.id;
              return <article key={request.id} className="rounded-lg border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div><p className="font-semibold text-slate-800">{request.leave_type}</p><p className="mt-1 text-xs text-slate-500">{request.start_date} to {request.end_date} · {request.days_requested} day(s)</p></div>
                  <div className="flex items-center gap-2"><span className={"rounded-full px-2.5 py-1 text-xs font-bold " + (request.status === "approved" ? "bg-emerald-100 text-emerald-800" : request.status === "rejected" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800")}>{request.status.toUpperCase()}</span><button type="button" onClick={() => setExpandedRequestId(requestExpanded ? null : request.id)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">{requestExpanded ? "Hide" : "View details"}</button></div>
                </div>
                {requestExpanded && <div className="border-t border-slate-100 p-3"><p className="text-xs font-bold uppercase text-slate-500">Reason</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{request.reason || "No reason provided."}</p><p className="mt-2 text-xs text-slate-500">Submitted: {request.created_at ? new Date(request.created_at).toLocaleString("en-GB") : "—"}</p>{request.reviewed_at && <p className="mt-1 text-xs text-slate-500">Reviewed: {new Date(request.reviewed_at).toLocaleString("en-GB")}</p>}{request.status === "pending" && <div className="mt-3 flex gap-2"><button type="button" disabled={busyId === request.id} onClick={() => onReview(request.id, "approved")} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Approve</button><button type="button" disabled={busyId === request.id} onClick={() => onReview(request.id, "rejected")} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50">Reject</button></div>}</div>}
              </article>;
            })}
          </div>}
        </article>;
      })}
    </div>}
  </section>;
}
