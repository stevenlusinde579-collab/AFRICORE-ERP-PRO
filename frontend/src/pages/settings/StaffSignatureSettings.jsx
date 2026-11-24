import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, Save, ShieldCheck, History } from "lucide-react";
import { supabase } from "../../services/supabase";

const displayName = (person) => [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(" ") || person.employee_number || "Staff";
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const roleKind = (name) => {
  const value = String(name || "").trim().toLowerCase();
  if (value.includes("class teacher")) return "class";
  if (value.includes("subject teacher")) return "subject";
  return "general";
};
const contextKey = (roleId, classId = null, subjectId = null) => `${roleId}:${classId ?? ""}:${subjectId ?? ""}`;

export default function StaffSignatureSettings({ schoolId, canManage }) {
  const [staff, setStaff] = useState([]);
  const [contexts, setContexts] = useState([]);
  const [primaryRows, setPrimaryRows] = useState([]);
  const [signatures, setSignatures] = useState([]);
  const [auditRows, setAuditRows] = useState([]);
  const [selection, setSelection] = useState({});
  const [selectedContexts, setSelectedContexts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!schoolId || !canManage) { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const [staffResult, roleResult, primaryResult, signatureResult, auditResult, assignmentResult] = await Promise.all([
        supabase.from("teachers").select("id,user_id,employee_number,first_name,middle_name,last_name").eq("school_id", schoolId).not("user_id", "is", null).order("first_name"),
        supabase.from("profile_roles").select("profile_id,role_id,roles(id,role_name)").eq("school_id", schoolId).eq("is_active", true),
        supabase.from("hr_primary_signatories").select("id,role_id,profile_id,teacher_id,class_id,subject_id,updated_at").eq("school_id", schoolId),
        supabase.from("hr_staff_signatures").select("id,teacher_id,profile_id,storage_path,is_active,created_at,registered_by").eq("school_id", schoolId),
        supabase.from("hr_signature_audit").select("id,entity_type,entity_id,action,actor_user_id,old_value,new_value,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(50),
        supabase.from("teacher_assignments").select("id,teacher_id,subject_id,class_id,school_id").eq("school_id", schoolId),
      ]);
      for (const result of [staffResult, roleResult, primaryResult, signatureResult, auditResult, assignmentResult]) if (result.error) throw result.error;

      const staffRows = staffResult.data || [];
      const staffByProfile = new Map(staffRows.map((person) => [person.user_id, person]));
      const teacherIds = new Set(staffRows.map((person) => Number(person.id)));
      const assignments = (assignmentResult.data || []).filter((row) => teacherIds.has(Number(row.teacher_id)) && row.class_id != null);
      const classIds = [...new Set(assignments.map((row) => Number(row.class_id)))];
      const subjectIds = [...new Set(assignments.map((row) => Number(row.subject_id)).filter(Boolean))];
      const [classResult, subjectResult] = await Promise.all([
        classIds.length ? supabase.from("classes").select("id,class_name,short_name").eq("school_id", schoolId).in("id", classIds) : Promise.resolve({ data: [], error: null }),
        subjectIds.length ? supabase.from("subjects").select("id,subject_name,subject_code").in("id", subjectIds) : Promise.resolve({ data: [], error: null }),
      ]);
      if (classResult.error) throw classResult.error;
      if (subjectResult.error) throw subjectResult.error;
      const classMap = new Map((classResult.data || []).map((row) => [Number(row.id), row]));
      const subjectMap = new Map((subjectResult.data || []).map((row) => [Number(row.id), row]));

      const roleMap = new Map();
      for (const assignment of roleResult.data || []) {
        const name = assignment.roles?.role_name;
        if (!name) continue;
        const roleId = Number(assignment.role_id);
        const role = roleMap.get(roleId) || { id: roleId, name, profileIds: new Set() };
        role.profileIds.add(assignment.profile_id);
        roleMap.set(roleId, role);
      }

      const nextContexts = [];
      for (const role of roleMap.values()) {
        const kind = roleKind(role.name);
        const members = [...role.profileIds].map((profileId) => staffByProfile.get(profileId)).filter(Boolean);
        if (kind === "general") {
          if (members.length) nextContexts.push({ key: contextKey(role.id), roleId: role.id, roleName: role.name, kind, label: "Role-wide", members });
          continue;
        }
        const teacherIdByProfile = new Map(members.map((person) => [Number(person.id), person]));
        const matching = assignments.filter((row) => teacherIdByProfile.has(Number(row.teacher_id)));
        if (kind === "class") {
          const classGroups = new Map();
          for (const row of matching) {
            const cls = classMap.get(Number(row.class_id));
            const person = teacherIdByProfile.get(Number(row.teacher_id));
            if (!cls || !person) continue;
            const key = String(row.class_id);
            if (!classGroups.has(key)) classGroups.set(key, { classId: Number(row.class_id), className: cls.class_name || cls.short_name || `Class ${row.class_id}`, members: new Map() });
            classGroups.get(key).members.set(person.user_id, person);
          }
          for (const group of classGroups.values()) nextContexts.push({ key: contextKey(role.id, group.classId), roleId: role.id, roleName: role.name, kind, classId: group.classId, subjectId: null, label: group.className, members: [...group.members.values()] });
        } else {
          const pairGroups = new Map();
          for (const row of matching) {
            const cls = classMap.get(Number(row.class_id));
            const subject = subjectMap.get(Number(row.subject_id));
            const person = teacherIdByProfile.get(Number(row.teacher_id));
            if (!cls || !subject || !person) continue;
            const key = `${row.class_id}:${row.subject_id}`;
            if (!pairGroups.has(key)) pairGroups.set(key, { classId: Number(row.class_id), subjectId: Number(row.subject_id), label: `${subject.subject_name} — ${cls.class_name || cls.short_name}`, members: new Map() });
            pairGroups.get(key).members.set(person.user_id, person);
          }
          for (const group of pairGroups.values()) nextContexts.push({ key: contextKey(role.id, group.classId, group.subjectId), roleId: role.id, roleName: role.name, kind, classId: group.classId, subjectId: group.subjectId, label: group.label, members: [...group.members.values()] });
        }
      }

      nextContexts.sort((a, b) => a.roleName.localeCompare(b.roleName) || a.label.localeCompare(b.label));
      const primary = primaryResult.data || [];
      const nextSelection = {};
      const nextSelectedContexts = {};
      for (const context of nextContexts) {
        const saved = primary.find((row) => Number(row.role_id) === context.roleId && Number(row.class_id || 0) === Number(context.classId || 0) && Number(row.subject_id || 0) === Number(context.subjectId || 0));
        nextSelection[context.key] = saved && context.members.some((person) => person.user_id === saved.profile_id) ? saved.profile_id : "";
        nextSelectedContexts[context.key] = Boolean(saved);
      }
      setStaff(staffRows); setContexts(nextContexts); setPrimaryRows(primary); setSignatures(signatureResult.data || []);
      setAuditRows(auditResult.data || []); setSelection(nextSelection); setSelectedContexts(nextSelectedContexts);
    } catch (loadError) {
      setError(loadError.message || "Could not load staff signature settings.");
    } finally { setLoading(false); }
  }, [schoolId, canManage]);

  useEffect(() => { load(); }, [load]);
  const activeSignatureProfiles = useMemo(() => new Set(signatures.filter((row) => row.is_active).map((row) => row.profile_id)), [signatures]);

  const downloadRoster = () => {
    const roleNames = new Map();
    contexts.forEach((context) => context.members.forEach((person) => {
      const current = roleNames.get(person.user_id) || new Set();
      current.add(`${context.roleName}: ${context.label}`);
      roleNames.set(person.user_id, current);
    }));
    const popup = window.open("", "_blank");
    if (!popup) { setError("Browser imezuia dirisha la kuchapisha. Ruhusu pop-ups kisha jaribu tena."); return; }
    const schoolTitle = escapeHtml(document.title.replace(" | AfriCore", "") || "School");
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Staff Signature Register</title><style>@page{size:A4;margin:14mm}body{font:12px Arial,sans-serif;color:#111}h1{font-size:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #555;padding:7px;text-align:left}.signature{height:44px}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Print / Save as PDF</button><h1>${schoolTitle} — Staff Signature Register</h1><table><thead><tr><th>No.</th><th>Staff</th><th>User ID</th><th>Assigned role / class / subject</th><th>Handwritten signature</th></tr></thead><tbody>${staff.map((person, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(displayName(person))}<br>${escapeHtml(person.employee_number || "")}</td><td>${escapeHtml(person.user_id)}</td><td>${escapeHtml([...(roleNames.get(person.user_id) || [])].join("; ") || "No active assignment")}</td><td class="signature"></td></tr>`).join("")}</tbody></table></body></html>`);
    popup.document.close(); popup.focus();
  };

  const savePrimary = async (context) => {
    if (!selectedContexts[context.key]) { setError("Weka tiki kwenye assignment unayotaka kusajili kwanza."); return; }
    const profileId = selection[context.key];
    const person = context.members.find((member) => member.user_id === profileId);
    if (!person) { setError("Chagua mfanyakazi mwenye assignment husika."); return; }
    setSavingKey(context.key); setError(""); setMessage("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const { error: saveError } = await supabase.from("hr_primary_signatories").upsert({
        school_id: schoolId, role_id: context.roleId, profile_id: profileId, teacher_id: person.id,
        class_id: context.classId ?? null, subject_id: context.subjectId ?? null,
        set_by: auth.user?.id || null, updated_at: new Date().toISOString(),
      }, { onConflict: "school_id,role_id,assignment_key" });
      if (saveError) {
        if (/class_id|subject_id|assignment_key|schema cache/i.test(saveError.message || "")) {
          throw new Error("Assignment-specific signatory database update is pending. The included Supabase migration must be applied before saving selections.");
        }
        throw saveError;
      }
      setMessage(`Primary signatory wa ${context.roleName} — ${context.label} amehifadhiwa.`);
      await load();
    } catch (saveError) { setError(saveError.message || "Imeshindikana kuhifadhi Primary Signatory."); }
    finally { setSavingKey(null); }
  };

  if (!canManage) return null;
  return <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-indigo-700"/><h2 className="text-xl font-bold text-slate-900">Staff Signatures & Primary Signatories</h2></div><p className="mt-1 max-w-3xl text-sm text-slate-500">HR huchagua msaini kwa kuzingatia mfanyakazi, role na assignment husika. Walimu wote wenye assignments huonekana hata kama saini zao bado hazijasajiliwa.</p></div>
      <div className="flex gap-2"><button type="button" onClick={downloadRoster} disabled={!staff.length} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"><Download className="h-4 w-4"/> Download Signature Register</button><button type="button" onClick={load} className="rounded-lg border border-slate-300 p-2 text-slate-600" aria-label="Refresh"><RefreshCw className="h-4 w-4"/></button></div>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
    {loading ? <p className="py-5 text-sm text-slate-500">Loading signature settings...</p> : <>
      <div className="space-y-4">
        {contexts.map((context) => {
          const saved = primaryRows.find((row) => Number(row.role_id) === context.roleId && Number(row.class_id || 0) === Number(context.classId || 0) && Number(row.subject_id || 0) === Number(context.subjectId || 0));
          const selectedPerson = context.members.find((person) => person.user_id === selection[context.key]);
          return <div key={context.key} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold text-slate-900">{context.roleName}</p><p className="text-sm text-indigo-700">{context.label}</p><p className="text-xs text-slate-500">{context.members.length} eligible staff member(s)</p></div><label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={Boolean(selectedContexts[context.key])} onChange={(event) => setSelectedContexts((previous) => ({ ...previous, [context.key]: event.target.checked }))} className="h-4 w-4"/> Select assignment</label>{saved && <span className="text-xs font-semibold text-emerald-700">Primary saved</span>}</div>
            {context.kind !== "general" && <div className="mt-3 rounded-lg bg-slate-50 p-3"><p className="mb-2 text-xs font-semibold uppercase text-slate-500">{context.kind === "class" ? "Class Teacher — selected class" : "Subject Teacher — exact subject and class assignment"}</p><label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked readOnly className="h-4 w-4"/> {context.label}</label></div>}
            <div className="mt-3 flex flex-wrap items-end gap-3"><label className="min-w-64 flex-1 text-sm font-medium text-slate-700">Choose primary signatory<select disabled={!selectedContexts[context.key]} value={selection[context.key] || ""} onChange={(event) => setSelection((previous) => ({ ...previous, [context.key]: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100"><option value="">Select staff member</option>{context.members.map((person) => <option key={person.user_id} value={person.user_id}>{displayName(person)}{activeSignatureProfiles.has(person.user_id) ? " • Signature registered" : " • Signature not yet registered"}</option>)}</select></label><button type="button" onClick={() => savePrimary(context)} disabled={!selectedContexts[context.key] || !selectedPerson || savingKey === context.key} className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Save className="h-4 w-4"/>{savingKey === context.key ? "Saving..." : "Save selection"}</button></div>
            {selectedPerson && !activeSignatureProfiles.has(selectedPerson.user_id) && <p className="mt-2 text-xs text-amber-700">Saini bado haijasajiliwa. Mfanyakazi amechaguliwa na anaweza kusajiliwa kupitia HR → Staff Signature Registry.</p>}
          </div>;
        })}
      </div>
      {!contexts.length && <p className="text-sm text-slate-500">No eligible staff assignments were found for this school.</p>}
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><p className="font-semibold">Signature Register workflow</p><ol className="mt-2 list-decimal space-y-1 pl-5"><li>Download and print the register.</li><li>Staff sign next to their own name and User ID.</li><li>HR uploads the signed register PDF in HR → Staff Signature Registry, then reviews and saves each person's signature against the matching User ID.</li><li>Return here to select the primary signatory for each role and assignment.</li></ol></div>
      <div className="border-t border-slate-200 pt-4"><div className="mb-3 flex items-center gap-2"><History className="h-4 w-4 text-slate-600"/><h3 className="font-bold text-slate-800">Signature Audit History</h3></div>{auditRows.length ? <div className="max-h-64 space-y-2 overflow-y-auto">{auditRows.map((row) => <div key={row.id} className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600"><div className="flex flex-wrap justify-between gap-2"><strong className="text-slate-800">{row.action} • {row.entity_type}</strong><span>{new Date(row.created_at).toLocaleString("en-GB")}</span></div><p>Actor User ID: {row.actor_user_id || "System"}</p><p>Change reference: {row.entity_id}</p></div>)}</div> : <p className="text-xs text-slate-500">No signature changes recorded yet.</p>}</div>
    </>}
  </section>;
}
