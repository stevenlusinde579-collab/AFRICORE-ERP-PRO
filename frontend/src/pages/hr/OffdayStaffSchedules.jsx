import { useMemo, useState } from "react";

export default function OffdayStaffSchedules({ staff = [], rows = [], entitlements = [], schoolId, onStatusChange, onRefresh }) {
  const year = new Date().getFullYear();
  const [expandedId, setExpandedId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState("");
  const staffRows = useMemo(() => staff.map((person) => {
    const dates = rows.filter((row) => Number(row.employee_id) === Number(person.id) && Number(row.off_date?.slice(0, 4)) === year).sort((a, b) => a.off_date.localeCompare(b.off_date));
    const entitlement = entitlements.find((item) => Number(item.employee_id) === Number(person.id) && Number(item.entitlement_year) === year);
    const counted = dates.filter((item) => item.status !== "cancelled").length;
    return { person, dates, entitlement, counted, remaining: Math.max(0, Number(entitlement?.entitled_days || 0) - counted) };
  }), [staff, rows, entitlements, year]);

  const deleteSchedule = async (employeeId, personName) => {
    if (!schoolId || !window.confirm("Delete all " + year + " off-day dates for " + personName + "? This will not delete the employee record.")) return;
    setBusyId(employeeId); setNotice("");
    try {
      const { error } = await (await import("../../services/supabase")).supabase
        .from("hr_offday_rosters").delete().eq("school_id", schoolId).eq("employee_id", employeeId)
        .gte("off_date", year + "-01-01").lt("off_date", (year + 1) + "-01-01");
      if (error) throw error;
      if (expandedId === employeeId) setExpandedId(null);
      setNotice("The selected employee's " + year + " off-day schedule was deleted.");
      await onRefresh?.();
    } catch (error) {
      setNotice(error?.message || "Unable to delete the schedule.");
    } finally { setBusyId(null); }
  };

  return <section className="mt-5">
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div><h3 className="font-semibold text-slate-800">Staff Off-Day Schedules</h3><p className="mt-1 text-xs text-slate-500">Year: {year}. Open a staff member to view their dates and balance.</p></div>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{staffRows.length} staff members</span>
    </div>
    {notice && <p role="status" className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{notice}</p>}
    <div className="mt-3 space-y-2">
      {staffRows.map(({ person, dates, entitlement, counted, remaining }) => {
        const name = [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(" ") || person.employee_number || "Staff";
        const expanded = expandedId === person.id;
        return <article key={person.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div><p className="font-semibold text-slate-900">{name}</p><p className="mt-1 text-xs text-slate-500">{person.employee_number || "No employee number"} · {dates.length} scheduled date(s) · {remaining} remaining</p></div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setExpandedId(expanded ? null : person.id)} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white">{expanded ? "Close" : "View"}</button>
              <button type="button" disabled={!dates.length || busyId === person.id} onClick={() => deleteSchedule(person.id, name)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-40">{busyId === person.id ? "Deleting..." : "Delete"}</button>
            </div>
          </div>
          {expanded && <div className="border-t border-slate-100 bg-slate-50 p-4">
            <div className="grid gap-2 sm:grid-cols-4">
              <Balance label="Annual entitlement" value={entitlement?.entitled_days ?? "Not set"} />
              <Balance label="Scheduled dates" value={dates.length} />
              <Balance label="Counted / used" value={counted} />
              <Balance label="Remaining" value={remaining} />
            </div>
            {!dates.length ? <p className="mt-3 text-sm text-slate-500">No off-day dates recorded for this year.</p> : <div className="mt-3 divide-y divide-slate-200 rounded-lg bg-white px-3">
              {dates.map((row) => <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span className="font-medium text-slate-800">{row.off_date}</span>
                <span className={"rounded-full px-2 py-1 text-xs font-semibold " + (row.status === "taken" ? "bg-rose-100 text-rose-800" : row.status === "cancelled" ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-800")}>{row.status === "taken" ? "Closed" : row.status === "cancelled" ? "Cancelled" : "Open"}</span>
                {row.status !== "cancelled" && <button type="button" onClick={() => onStatusChange?.(row.id, row.status === "taken" ? "planned" : "taken")} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700">{row.status === "taken" ? "Reopen" : "Close"}</button>}
              </div>)}
            </div>}
          </div>}
        </article>;
      })}
    </div>
  </section>;
}

function Balance({ label, value }) {
  return <div className="rounded-lg bg-white p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-900">{value}</p></div>;
}
