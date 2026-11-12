import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaArrowLeft, FaCheckCircle, FaExclamationTriangle, FaHistory,
  FaSearch, FaShieldAlt, FaSpinner, FaTimesCircle, FaWallet
} from "react-icons/fa";
import { Link } from "react-router-dom";
import { supabase } from "../../services/supabase";

const money = (value) => new Intl.NumberFormat("en-TZ", {
  style: "currency", currency: "TZS", maximumFractionDigits: 0,
}).format(Number(value || 0));
const dateLabel = (value) => value ? new Date(value).toLocaleDateString("en-GB") : "-";
const fullName = (row) => [row?.first_name, row?.middle_name, row?.last_name].filter(Boolean).join(" ") || "Student";

export default function FeeControlCorrectionCenter() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [profile, setProfile] = useState(null);
  const [roles, setRoles] = useState([]);
  const [years, setYears] = useState([]);
  const [yearId, setYearId] = useState("");
  const [charges, setCharges] = useState([]);
  const [requests, setRequests] = useState([]);
  const [itemsByRequest, setItemsByRequest] = useState({});
  const [students, setStudents] = useState({});
  const [feeItems, setFeeItems] = useState({});
  const [selected, setSelected] = useState({});
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");

  const roleNames = roles.map((row) => String(row.roles?.role_name || "").toLowerCase());
  const isSuperAdmin = roleNames.includes("super admin");
  const isAccountant = roleNames.includes("accountant") || isSuperAdmin;
  const isApprover = roleNames.includes("headmaster") || isSuperAdmin;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error("Your session has expired. Please sign in again.");

      const [{ data: profileRow, error: profileError }, { data: roleRows, error: roleError }] = await Promise.all([
        supabase.from("profiles").select("id,school_id").eq("id", authData.user.id).single(),
        supabase.from("profile_roles").select("school_id,is_active,roles(role_name)").eq("profile_id", authData.user.id).eq("is_active", true),
      ]);
      if (profileError) throw profileError;
      if (roleError) throw roleError;
      if (!profileRow?.school_id) throw new Error("Your school ID could not be identified.");
      const schoolId = Number(profileRow.school_id);
      const scopedRoles = (roleRows || []).filter((r) => !r.school_id || Number(r.school_id) === schoolId);
      setProfile({ ...profileRow, user_id: authData.user.id });
      setRoles(scopedRoles);

      const [yearResult, chargeResult, requestResult, studentResult, feeResult] = await Promise.all([
        supabase.from("academic_years").select("id,year_name,is_active").eq("school_id", schoolId).order("year_name", { ascending: false }),
        supabase.schema("finance").from("student_charges").select("id,school_id,student_id,academic_year_id,description,amount,paid_amount,balance,status,fee_item_id,term_number,payment_setup_id,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(2000),
        supabase.schema("finance").from("fee_correction_requests").select("id,school_id,academic_year_id,status,reason,requested_by,approved_by,approved_at,rejected_by,rejected_at,decision_note,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(200),
        supabase.from("students").select("id,school_id,first_name,middle_name,last_name,admission_number,admission_no,current_class_id").eq("school_id", schoolId).limit(5000),
        supabase.schema("finance").from("fee_items").select("id,school_id,item_name,item_code").eq("school_id", schoolId),
      ]);
      for (const result of [yearResult, chargeResult, requestResult, studentResult, feeResult]) if (result.error) throw result.error;

      const yearRows = yearResult.data || [];
      setYears(yearRows);
      const initialYear = yearId && yearRows.some((y) => String(y.id) === String(yearId))
        ? String(yearId)
        : String(yearRows.find((y) => y.is_active)?.id || yearRows[0]?.id || "");
      setYearId(initialYear);
      setCharges(chargeResult.data || []);
      setRequests(requestResult.data || []);
      setStudents(Object.fromEntries((studentResult.data || []).map((s) => [String(s.id), s])));
      setFeeItems(Object.fromEntries((feeResult.data || []).map((f) => [String(f.id), f])));
      const reqIds = (requestResult.data || []).map((r) => r.id);
      if (reqIds.length) {
        const { data: itemRows, error: itemError } = await supabase.schema("finance")
          .from("fee_correction_request_items")
          .select("id,request_id,school_id,charge_id,payment_setup_id,student_id,fee_item_id,term_number,old_amount,paid_amount,old_balance,proposed_amount,delta_amount,journal_entry_id")
          .eq("school_id", schoolId).in("request_id", reqIds);
        if (itemError) throw itemError;
        const grouped = {};
        for (const item of itemRows || []) (grouped[item.request_id] ||= []).push(item);
        setItemsByRequest(grouped);
      } else setItemsByRequest({});
    } catch (err) {
      console.error("Fee Control Center load error:", err);
      setError(err?.message || "Unable to load Fee Control & Correction Center.");
    } finally {
      setLoading(false);
    }
  }, [yearId]);

  useEffect(() => { load(); }, [load]);

  const visibleCharges = useMemo(() => {
    const q = search.trim().toLowerCase();
    return charges.filter((charge) => {
      if (yearId && String(charge.academic_year_id) !== String(yearId)) return false;
      if (!charge.payment_setup_id) return false;
      if (Number(charge.balance || 0) < 0) return false;
      const student = students[String(charge.student_id)];
      const fee = feeItems[String(charge.fee_item_id)];
      const haystack = [fullName(student), student?.admission_number, student?.admission_no, charge.description, fee?.item_name].join(" ").toLowerCase();
      return !q || haystack.includes(q);
    });
  }, [charges, yearId, search, students, feeItems]);

  const totals = useMemo(() => ({
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
    risk: visibleCharges.filter((c) => Number(c.amount || 0) > 0 && Number(c.balance || 0) > 0).length,
  }), [requests, visibleCharges]);

  const updateSelected = (charge, value) => {
    setSelected((current) => {
      const next = { ...current };
      if (value === null) delete next[charge.id];
      else next[charge.id] = { charge_id: charge.id, proposed_amount: value };
      return next;
    });
  };

  const submitRequest = async () => {
    setError(""); setNotice("");
    if (!profile?.school_id || !yearId) return setError("Select an academic year first.");
    if (reason.trim().length < 8) return setError("Explain the reason for this correction (at least 8 characters).");
    const items = Object.values(selected).map((row) => ({
      charge_id: row.charge_id,
      proposed_amount: Number(row.proposed_amount),
    }));
    if (!items.length) return setError("Select at least one fee charge to correct.");
    if (items.some((row) => !Number.isFinite(row.proposed_amount) || row.proposed_amount <= 0)) return setError("Every corrected amount must be greater than zero.");
    setBusy(true);
    try {
      const { data, error: rpcError } = await supabase.schema("finance").rpc("submit_fee_correction", {
        p_school_id: Number(profile.school_id),
        p_academic_year_id: Number(yearId),
        p_reason: reason.trim(),
        p_items: items,
      });
      if (rpcError) throw rpcError;
      setSelected({}); setReason("");
      setNotice("Correction request submitted. No student balance has changed yet; Headmaster approval is required.");
      await load();
    } catch (err) {
      console.error("Submit fee correction error:", err);
      setError(err?.message || "Unable to submit correction request.");
    } finally { setBusy(false); }
  };

  const decide = async (request, decision) => {
    const note = window.prompt(decision === "approve" ? "Optional approval note:" : "Reason for rejecting this correction (required):", "");
    if (note === null) return;
    if (decision === "reject" && note.trim().length < 5) return setError("A rejection reason of at least 5 characters is required.");
    if (decision === "approve" && !window.confirm("Approve this request? Student balances and accounting journals will be updated together.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const fn = decision === "approve" ? "approve_fee_correction" : "reject_fee_correction";
      const args = decision === "approve"
        ? { p_request_id: request.id, p_decision_note: note.trim() || null }
        : { p_request_id: request.id, p_decision_note: note.trim() };
      const { error: rpcError } = await supabase.schema("finance").rpc(fn, args);
      if (rpcError) throw rpcError;
      setNotice(decision === "approve" ? "Fee correction approved and applied successfully." : "Fee correction request rejected. No financial amounts were changed.");
      await load();
    } catch (err) {
      console.error("Fee correction decision error:", err);
      setError(err?.message || "Unable to process this decision.");
    } finally { setBusy(false); }
  };

  const filteredRequests = requests.filter((r) => statusFilter === "all" || r.status === statusFilter);
  const fmtAmount = (value) => money(value);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-600"><FaSpinner className="animate-spin mr-2" /> Loading Fee Control Center…</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-7">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to="/finance/dashboard" className="inline-flex items-center gap-2 text-sm text-blue-700 hover:underline mb-2"><FaArrowLeft /> Finance Dashboard</Link>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Fee Control & Correction Center</h1>
            <p className="text-sm text-slate-500 mt-1">Detect unusual fee amounts, request controlled corrections and review the full approval trail.</p>
          </div>
          <div className="rounded-xl border bg-white px-4 py-3 text-sm"><span className="text-slate-500">School ID</span><div className="font-bold text-slate-900">{profile?.school_id}</div></div>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        {notice && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ["Pending approvals", totals.pending, "text-amber-700"],
            ["Approved requests", totals.approved, "text-green-700"],
            ["Rejected requests", totals.rejected, "text-red-700"],
            ["Linked fee charges", visibleCharges.length, "text-blue-700"],
          ].map(([label, value, color]) => <div key={label} className="bg-white border rounded-xl p-4"><div className="text-xs text-slate-500">{label}</div><div className={"text-2xl font-bold mt-1 " + color}>{value}</div></div>)}
        </div>

        <section className="bg-white border rounded-xl p-4 md:p-5 space-y-4">
          <div className="flex flex-wrap justify-between items-end gap-3">
            <div><h2 className="font-bold text-lg text-slate-900">Fee charge review</h2><p className="text-xs text-slate-500">Only charges linked to a Payment Setup are eligible for controlled correction.</p></div>
            <div className="flex flex-wrap gap-2">
              <select value={yearId} onChange={(e) => setYearId(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white">
                {years.map((year) => <option key={year.id} value={year.id}>{year.year_name || ("Year " + year.id)}</option>)}
              </select>
              <div className="relative"><FaSearch className="absolute left-3 top-3 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student, admission or fee" className="border rounded-lg pl-9 pr-3 py-2 text-sm w-64 max-w-full" /></div>
            </div>
          </div>
          {!isAccountant && <div className="rounded-lg bg-blue-50 text-blue-800 p-3 text-sm">You can review charges and approve requests where authorized. Only the Accountant can submit correction requests.</div>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[850px]">
              <thead className="bg-slate-100 text-slate-600"><tr><th className="p-3 text-left">Student / Admission</th><th className="p-3 text-left">Fee item</th><th className="p-3 text-right">Current amount</th><th className="p-3 text-right">Paid</th><th className="p-3 text-right">Balance</th><th className="p-3 text-right">Correct amount</th></tr></thead>
              <tbody>
                {visibleCharges.map((charge) => {
                  const student = students[String(charge.student_id)];
                  const fee = feeItems[String(charge.fee_item_id)];
                  const picked = selected[charge.id];
                  const pending = requests.some((r) => r.status === "pending" && (itemsByRequest[r.id] || []).some((i) => i.charge_id === charge.id));
                  return <tr key={charge.id} className="border-t">
                    <td className="p-3"><div className="font-semibold text-slate-900">{fullName(student)}</div><div className="text-xs text-slate-500">{student?.admission_number || student?.admission_no || "No admission number"}</div></td>
                    <td className="p-3"><div>{fee?.item_name || charge.description || "Student fee"}</div><div className="text-xs text-slate-500">{charge.term_number ? "Term " + charge.term_number : "Annual"} · {dateLabel(charge.created_at)}</div></td>
                    <td className="p-3 text-right tabular-nums">{fmtAmount(charge.amount)}</td>
                    <td className="p-3 text-right tabular-nums">{fmtAmount(charge.paid_amount)}</td>
                    <td className="p-3 text-right tabular-nums">{fmtAmount(charge.balance)}</td>
                    <td className="p-3 text-right">
                      {isAccountant && !pending ? <div className="flex justify-end items-center gap-2"><input type="checkbox" checked={Boolean(picked)} onChange={(e) => updateSelected(charge, e.target.checked ? String(charge.amount) : null)} /><input aria-label="Corrected amount" type="number" min="0.01" step="0.01" disabled={!picked} value={picked?.proposed_amount ?? ""} onChange={(e) => updateSelected(charge, e.target.value)} placeholder={String(charge.amount)} className="border rounded px-2 py-1 w-36 text-right disabled:bg-slate-100" /></div> : <span className="text-xs text-slate-400">{pending ? "Pending approval" : "View only"}</span>}
                    </td>
                  </tr>;
                })}
                {!visibleCharges.length && <tr><td colSpan="6" className="p-8 text-center text-slate-500">No eligible fee charges found for this academic year.</td></tr>}
              </tbody>
            </table>
          </div>
          {isAccountant && <div className="border-t pt-4 space-y-3">
            <label className="block text-sm font-semibold text-slate-700">Reason for correction</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows="2" placeholder="Explain the setup error, e.g. an extra zero was entered in the tuition amount…" className="w-full border rounded-lg p-3 text-sm" />
            <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">{Object.keys(selected).length} charge(s) selected. Requests do not change balances until approved.</p><button disabled={busy || !Object.keys(selected).length} onClick={submitRequest} className="rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white px-4 py-2.5 text-sm font-semibold inline-flex items-center gap-2">{busy && <FaSpinner className="animate-spin" />} Submit correction request</button></div>
          </div>}
        </section>

        <section className="bg-white border rounded-xl p-4 md:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-lg text-slate-900 flex items-center gap-2"><FaHistory /> Correction history & approvals</h2><p className="text-xs text-slate-500">Every request is recorded with its requester, decision and accounting adjustment.</p></div><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All requests</option></select></div>
          <div className="space-y-3">
            {filteredRequests.map((request) => {
              const items = itemsByRequest[request.id] || [];
              const delta = items.reduce((sum, item) => sum + Number(item.delta_amount || 0), 0);
              return <article key={request.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><div className="font-semibold text-slate-900">Request {request.id.slice(0, 8).toUpperCase()}</div><div className="text-xs text-slate-500 mt-1">Submitted {dateLabel(request.created_at)} · {items.length} item(s)</div></div>
                  <span className={"text-xs font-bold rounded-full px-3 py-1 " + (request.status === "approved" ? "bg-green-100 text-green-800" : request.status === "rejected" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800")}>{request.status.toUpperCase()}</span>
                </div>
                <p className="text-sm text-slate-700">{request.reason}</p>
                <div className="overflow-x-auto"><table className="w-full text-xs min-w-[550px]"><thead className="text-slate-500"><tr><th className="text-left py-2">Student</th><th className="text-right">Old amount</th><th className="text-right">Paid</th><th className="text-right">New amount</th><th className="text-right">Difference</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t"><td className="py-2">{fullName(students[String(item.student_id)])}</td><td className="text-right">{fmtAmount(item.old_amount)}</td><td className="text-right">{fmtAmount(item.paid_amount)}</td><td className="text-right font-semibold">{fmtAmount(item.proposed_amount)}</td><td className={"text-right font-semibold " + (Number(item.delta_amount) < 0 ? "text-green-700" : "text-amber-700")}>{fmtAmount(item.delta_amount)}</td></tr>)}</tbody></table></div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3"><div className="text-xs text-slate-500">Net adjustment: <strong className="text-slate-800">{fmtAmount(delta)}</strong>{request.decision_note && <div className="mt-1">Decision note: {request.decision_note}</div>}</div>
                  {request.status === "pending" && isApprover && <div className="flex gap-2"><button disabled={busy} onClick={() => decide(request, "reject")} className="rounded-lg border border-red-200 text-red-700 px-3 py-2 text-xs font-semibold inline-flex items-center gap-1"><FaTimesCircle /> Reject</button><button disabled={busy} onClick={() => decide(request, "approve")} className="rounded-lg bg-green-700 text-white px-3 py-2 text-xs font-semibold inline-flex items-center gap-1"><FaCheckCircle /> Approve & apply</button></div>}
                </div>
              </article>;
            })}
            {!filteredRequests.length && <div className="text-center py-8 text-slate-500 text-sm">No correction requests in this category.</div>}
          </div>
        </section>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex gap-3"><FaExclamationTriangle className="mt-0.5 shrink-0" /><div><strong>Accounting protection:</strong> recorded payments are never edited by this workflow. A correction that would reduce a fee below the amount already paid is blocked and must use a separately approved refund or student-credit process. All changes require a Headmaster or Super Admin who is different from the requester.</div></div>
        <div className="text-xs text-slate-400 flex items-center gap-2"><FaShieldAlt /> Tenant scope is enforced by School ID, academic year, student ID and database row-level security.</div>
      </div>
    </div>
  );
}
