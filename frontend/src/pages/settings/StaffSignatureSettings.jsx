import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, Save, ShieldCheck, History } from "lucide-react";
import { supabase } from "../../services/supabase";

const displayName = (person) => [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(" ") || person.employee_number || "Staff";
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

export default function StaffSignatureSettings({ schoolId, canManage }) {
  const [staff, setStaff] = useState([]);
  const [roles, setRoles] = useState([]);
  const [primaryRows, setPrimaryRows] = useState([]);
  const [signatures, setSignatures] = useState([]);
  const [auditRows, setAuditRows] = useState([]);
  const [selection, setSelection] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingRole, setSavingRole] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!schoolId || !canManage) { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const [staffResult, roleResult, primaryResult, signatureResult, auditResult] = await Promise.all([
        supabase.from("teachers").select("id,user_id,employee_number,first_name,middle_name,last_name").eq("school_id", schoolId).not("user_id", "is", null).order("first_name"),
        supabase.from("profile_roles").select("profile_id,role_id,roles(id,role_name)").eq("school_id", schoolId).eq("is_active", true),
        supabase.from("hr_primary_signatories").select("id,role_id,profile_id,teacher_id,updated_at").eq("school_id", schoolId),
        supabase.from("hr_staff_signatures").select("id,teacher_id,profile_id,storage_path,is_active,created_at,registered_by").eq("school_id", schoolId),
        supabase.from("hr_signature_audit").select("id,entity_type,entity_id,action,actor_user_id,old_value,new_value,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(50),
      ]);
      for (const result of [staffResult, roleResult, primaryResult, signatureResult, auditResult]) if (result.error) throw result.error;

      const roleMap = new Map();
      for (const assignment of roleResult.data || []) {
        const name = assignment.roles?.role_name;
        if (!name) continue;
        const current = roleMap.get(Number(assignment.role_id)) || { id: Number(assignment.role_id), name, profileIds: new Set() };
        current.profileIds.add(assignment.profile_id);
        roleMap.set(Number(assignment.role_id), current);
      }
      const staffRows = staffResult.data || [];
      const staffByProfile = new Map(staffRows.map((person) => [person.user_id, person]));
      const roleRows = [...roleMap.values()].map((role) => ({
        ...role,
        members: [...role.profileIds].map((profileId) => staffByProfile.get(profileId)).filter(Boolean),
      })).filter((role) => role.members.length).sort((a, b) => a.name.localeCompare(b.name));
      const activeSignatures = (signatureResult.data || []).filter((row) => row.is_active);
      const primary = primaryResult.data || [];
      const nextSelection = {};
      for (const role of roleRows) {
        const saved = primary.find((row) => Number(row.role_id) === role.id);
        const savedIsValid = saved
          && role.members.some((person) => person.user_id === saved.profile_id)
          && activeSignatures.some((signature) => signature.profile_id === saved.profile_id);
        // Do not auto-select the first signed staff member for every role.
        // HR must explicitly choose a primary signatory per role.
        nextSelection[role.id] = savedIsValid ? saved.profile_id : "";
      }
      setStaff(staffRows); setRoles(roleRows); setPrimaryRows(primary); setSignatures(signatureResult.data || []);
      setAuditRows(auditResult.data || []); setSelection(nextSelection);
    } catch (loadError) {
      setError(loadError.message || "Could not load staff signature settings.");
    } finally { setLoading(false); }
  }, [schoolId, canManage]);

  useEffect(() => { load(); }, [load]);

  const activeSignatureProfiles = useMemo(() => new Set(signatures.filter((row) => row.is_active).map((row) => row.profile_id)), [signatures]);

  const downloadRoster = () => {
    const rows = staff.map((person) => {
      const roleNames = roles.filter((role) => role.members.some((member) => member.user_id === person.user_id)).map((role) => role.name).join(", ");
      return { person, roleNames };
    });
    const popup = window.open("", "_blank");
    if (!popup) { setError("Browser imezuia dirisha la kuchapisha. Ruhusu pop-ups kisha jaribu tena."); return; }
    const schoolTitle = escapeHtml(document.title.replace(" | AfriCore", "") || "School");
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Staff Signature Register</title><style>
      @page{size:A4;margin:14mm}body{font:12px Arial,sans-serif;color:#111}h1{font-size:20px;margin:0 0 5px}p{margin:4px 0 16px;color:#444}.actions{margin:0 0 14px}button{padding:8px 14px;border:1px solid #444;background:#fff;cursor:pointer}table{width:100%;border-collapse:collapse}th,td{border:1px solid #555;padding:7px;text-align:left;vertical-align:middle}th{background:#eee}.signature{height:44px;width:32%}.uid{font-size:10px;word-break:break-all}@media print{.actions{display:none}}
      </style></head><body><div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div><h1>${schoolTitle} — Staff Signature Register</h1><p>Write each staff member's handwritten signature in the last column. User ID and role are included to prevent identity mix-ups.</p><table><thead><tr><th>No.</th><th>Staff Name / Employee No.</th><th>User ID</th><th>Role(s)</th><th>Handwritten Signature</th></tr></thead><tbody>${rows.map(({ person, roleNames }, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(displayName(person))}<br><span class="uid">${escapeHtml(person.employee_number || "")}</span></td><td class="uid">${escapeHtml(person.user_id)}</td><td>${escapeHtml(roleNames || "No active role")}</td><td class="signature"></td></tr>`).join("")}</tbody></table><p style="margin-top:18px">Prepared on ${new Date().toLocaleDateString("en-GB")} • HR verification required</p></body></html>`);
    popup.document.close();
    popup.focus();
  };

  const savePrimary = async (role) => {
    const profileId = selection[role.id];
    const person = role.members.find((member) => member.user_id === profileId);
    if (!person || !activeSignatureProfiles.has(profileId)) {
      setError("Chagua mtumishi mwenye saini hai iliyosajiliwa na HR kwanza.");
      return;
    }
    setSavingRole(role.id); setError(""); setMessage("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const { error: saveError } = await supabase.from("hr_primary_signatories").upsert({
        school_id: schoolId, role_id: role.id, profile_id: profileId,
        teacher_id: person.id, set_by: auth.user?.id || null, updated_at: new Date().toISOString(),
      }, { onConflict: "school_id,role_id" });
      if (saveError) throw saveError;
      setMessage(`Primary signatory wa ${role.name} amehifadhiwa.`);
      await load();
    } catch (saveError) { setError(saveError.message || "Imeshindikana kuhifadhi Primary Signatory."); }
    finally { setSavingRole(null); }
  };

  if (!canManage) return null;

  return <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-indigo-700"/><h2 className="text-xl font-bold text-slate-900">Staff Signatures & Primary Signatories</h2></div><p className="mt-1 max-w-3xl text-sm text-slate-500">HR husimamia saini na kuchagua msaini mkuu kwa kila role. Uchaguzi unahifadhiwa kwa User ID pamoja na Role ID, si jina la role pekee.</p></div>
      <div className="flex gap-2"><button type="button" onClick={downloadRoster} disabled={!staff.length} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"><Download className="h-4 w-4"/> Download Signature Register</button><button type="button" onClick={load} className="rounded-lg border border-slate-300 p-2 text-slate-600" aria-label="Refresh"><RefreshCw className="h-4 w-4"/></button></div>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
    {loading ? <p className="py-5 text-sm text-slate-500">Loading signature settings...</p> : <>
      <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-3">Role</th><th className="px-3 py-3">Users assigned</th><th className="px-3 py-3">Primary Signatory</th><th className="px-3 py-3">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{roles.map((role) => {
        const eligible = role.members.filter((person) => activeSignatureProfiles.has(person.user_id));
        const current = primaryRows.find((row) => Number(row.role_id) === role.id);
        return <tr key={role.id}><td className="px-3 py-3 font-semibold text-slate-800">{role.name}<div className="text-xs font-normal text-slate-400">Role ID: {role.id}</div></td><td className="px-3 py-3 text-slate-600">{role.members.length}</td><td className="px-3 py-3"><select value={selection[role.id] || ""} onChange={(event) => setSelection((previous) => ({ ...previous, [role.id]: event.target.value }))} className="min-w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">Select staff with registered signature</option>{role.members.map((person) => <option key={person.user_id} value={person.user_id} disabled={!activeSignatureProfiles.has(person.user_id)}>{displayName(person)} • User ID: {person.user_id.slice(0, 8)}{!activeSignatureProfiles.has(person.user_id) ? " (No active signature)" : ""}</option>)}</select></td><td className="px-3 py-3"><button type="button" onClick={() => savePrimary(role)} disabled={!eligible.length || !selection[role.id] || savingRole === role.id} className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Save className="h-3.5 w-3.5"/>{savingRole === role.id ? "Saving..." : current?.profile_id === selection[role.id] ? "Update Primary" : "Set Primary"}</button></td></tr>;
      })}</tbody></table></div>
      {!roles.length && <p className="text-sm text-slate-500">No active staff roles were found for this school.</p>}
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><p className="font-semibold">Signature Register workflow</p><ol className="mt-2 list-decimal space-y-1 pl-5"><li>Download and print the register.</li><li>Staff sign next to their own name and User ID.</li><li>HR uploads the signed register PDF once in HR → Staff Signature Registry, then crops and saves each person's signature against the printed User ID.</li><li>Return here to select a Primary Signatory for each role.</li></ol><p className="mt-2 text-xs">After signing, scan all pages into one PDF and upload that single file in HR → Staff Signature Registry. HR will review each crop and confirm the matching User ID before saving.</p></div>
      <div className="border-t border-slate-200 pt-4"><div className="mb-3 flex items-center gap-2"><History className="h-4 w-4 text-slate-600"/><h3 className="font-bold text-slate-800">Signature Audit History</h3></div>{auditRows.length ? <div className="max-h-64 space-y-2 overflow-y-auto">{auditRows.map((row) => <div key={row.id} className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600"><div className="flex flex-wrap justify-between gap-2"><strong className="text-slate-800">{row.action} • {row.entity_type}</strong><span>{new Date(row.created_at).toLocaleString("en-GB")}</span></div><p>Actor User ID: {row.actor_user_id || "System"}</p><p>Change reference: {row.entity_id}</p></div>)}</div> : <p className="text-xs text-slate-500">No signature changes recorded yet.</p>}</div>
    </>}
  </section>;
}
