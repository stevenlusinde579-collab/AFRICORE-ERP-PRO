import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaSave, FaPlus, FaUserTie, FaHistory, FaAddressBook } from "react-icons/fa";
import { supabase } from "../../services/supabase";
import { useSchool } from "../../context/SchoolContext";
import { useRole } from "../../context/RoleContext";

const emptyProfile = {
  date_of_birth: "",
  nationality: "",
  national_id: "",
  marital_status: "",
  residential_address: "",
  postal_address: "",
  personal_email: "",
  alternative_phone: "",
  notes: "",
};

const emptyContact = {
  contact_name: "",
  relationship: "",
  phone: "",
  email: "",
  address: "",
  is_primary: false,
  notes: "",
};

const eventTypes = [
  ["appointment", "Appointment"],
  ["confirmation", "Confirmation"],
  ["promotion", "Promotion"],
  ["transfer", "Transfer"],
  ["salary_review", "Salary Review"],
  ["disciplinary", "Disciplinary"],
  ["termination", "Termination"],
  ["rehire", "Rehire"],
  ["other", "Other"],
];

const fullName = (employee) =>
  [employee?.first_name, employee?.middle_name, employee?.last_name].filter(Boolean).join(" ");

function EmployeeDigitalFile() {
  const { employeeId } = useParams();
  const { schoolId } = useSchool();
  const { selectedRoleId, selectedRoleName } = useRole();
  const canManage = Number(selectedRoleId) === 1 || String(selectedRoleName || "").trim().toLowerCase() === "hr manager";
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [profile, setProfile] = useState(emptyProfile);
  const [contacts, setContacts] = useState([]);
  const [history, setHistory] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [documentFile, setDocumentFile] = useState(null);
  const [contractFile, setContractFile] = useState(null);
  const [documentForm, setDocumentForm] = useState({ document_type: "other", document_title: "", document_number: "", issue_date: "", expiry_date: "", notes: "" });
  const [contractForm, setContractForm] = useState({ contract_number: "", contract_type: "fixed_term", start_date: "", end_date: "", job_title: "", department: "", basic_salary: "", probation_end_date: "", notice_period_days: "30", status: "draft", notes: "" });
  const [contact, setContact] = useState(emptyContact);
  const [event, setEvent] = useState({
    event_type: "appointment",
    event_date: new Date().toISOString().slice(0, 10),
    previous_department: "",
    new_department: "",
    previous_position: "",
    new_position: "",
    description: "",
    reference_number: "",
  });
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadFile = useCallback(async () => {
    if (!schoolId || !employeeId) return;
    setLoading(true);
    setError("");
    const id = Number(employeeId);
    if (!Number.isSafeInteger(id) || id <= 0) {
      setError("Invalid employee record.");
      setLoading(false);
      return;
    }

    const [employeeResult, profileResult, contactsResult, historyResult, documentsResult, contractsResult] = await Promise.all([
      supabase.from("employees")
        .select("id,school_id,employee_number,first_name,middle_name,last_name,gender,phone,email,address,employee_type,department,position,employment_date,status")
        .eq("id", id)
        .eq("school_id", schoolId)
        .maybeSingle(),
      supabase.from("hr_employee_profiles").select("*").eq("employee_id", id).eq("school_id", schoolId).maybeSingle(),
      supabase.from("hr_employee_contacts").select("*").eq("employee_id", id).eq("school_id", schoolId).order("is_primary", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("hr_employment_history").select("*").eq("employee_id", id).eq("school_id", schoolId).order("event_date", { ascending: false }),
      supabase.from("hr_employee_documents").select("*").eq("employee_id", id).eq("school_id", schoolId).order("created_at", { ascending: false }),
      supabase.from("hr_employment_contracts").select("*").eq("employee_id", id).eq("school_id", schoolId).order("start_date", { ascending: false }),
    ]);

    if (employeeResult.error || !employeeResult.data) {
      setError(employeeResult.error?.message || "Employee was not found in this school.");
      setLoading(false);
      return;
    }
    setEmployee(employeeResult.data);
    if (profileResult.error && profileResult.error.code !== "42P01") {
      setError(profileResult.error.message);
    } else {
      setProfile({ ...emptyProfile, ...(profileResult.data || {}) });
    }
    if (contactsResult.error && contactsResult.error.code !== "42P01") {
      setError((current) => current || contactsResult.error.message);
    } else {
      setContacts(contactsResult.data || []);
    }
    if (historyResult.error && historyResult.error.code !== "42P01") {
      setError((current) => current || historyResult.error.message);
    } else {
      setHistory(historyResult.data || []);
    }
    if (documentsResult.error && documentsResult.error.code !== "42P01") setError((current) => current || documentsResult.error.message);
    else setDocuments(documentsResult.data || []);
    if (contractsResult.error && contractsResult.error.code !== "42P01") setError((current) => current || contractsResult.error.message);
    else setContracts(contractsResult.data || []);
    setLoading(false);
  }, [schoolId, employeeId]);

  useEffect(() => {
    loadFile();
  }, [loadFile]);

  const saveProfile = async (formEvent) => {
    formEvent.preventDefault();
    if (!employee || saving) return;
    setSaving(true);
    setNotice("");
    setError("");
    const { data: authData } = await supabase.auth.getUser();
    const payload = Object.fromEntries(
      Object.entries(profile).filter(([key]) => key in emptyProfile)
    );
    Object.keys(payload).forEach((key) => {
      if (payload[key] === "") payload[key] = null;
    });
    const { error: saveError } = await supabase.from("hr_employee_profiles").upsert({
      ...payload,
      employee_id: employee.id,
      school_id: employee.school_id,
      updated_at: new Date().toISOString(),
      updated_by: authData.user?.id || null,
    }, { onConflict: "employee_id" });
    if (saveError) setError(saveError.message);
    else setNotice("Personal details saved successfully.");
    setSaving(false);
  };

  const addContact = async (formEvent) => {
    formEvent.preventDefault();
    if (!employee || saving) return;
    setSaving(true);
    setNotice("");
    setError("");
    const { data: authData } = await supabase.auth.getUser();
    const { error: saveError } = await supabase.from("hr_employee_contacts").insert({
      ...contact,
      employee_id: employee.id,
      school_id: employee.school_id,
      created_by: authData.user?.id || null,
    });
    if (saveError) setError(saveError.message);
    else {
      setContact(emptyContact);
      setNotice("Emergency contact added.");
      await loadFile();
    }
    setSaving(false);
  };

  const addHistory = async (formEvent) => {
    formEvent.preventDefault();
    if (!employee || saving) return;
    setSaving(true);
    setNotice("");
    setError("");
    const { data: authData } = await supabase.auth.getUser();
    const { error: saveError } = await supabase.from("hr_employment_history").insert({
      ...event,
      employee_id: employee.id,
      school_id: employee.school_id,
      created_by: authData.user?.id || null,
    });
    if (saveError) setError(saveError.message);
    else {
      setEvent({
        event_type: "appointment",
        event_date: new Date().toISOString().slice(0, 10),
        previous_department: "",
        new_department: employee.department || "",
        previous_position: "",
        new_position: employee.position || "",
        description: "",
        reference_number: "",
      });
      setNotice("Employment history entry added.");
      await loadFile();
    }
    setSaving(false);
  };

  const uploadEmployeeDocument = async (formEvent) => {
    formEvent.preventDefault();
    if (!employee || !documentFile || !canManage || saving) return;
    if (documentFile.size > 20 * 1024 * 1024) { setError("File exceeds the 20 MB limit."); return; }
    const allowed = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg", "image/png"];
    if (!allowed.includes(documentFile.type)) { setError("Allowed formats: PDF, DOC, DOCX, JPG and PNG."); return; }
    setSaving(true); setError(""); setNotice("");
    const safeName = documentFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${employee.school_id}/${employee.id}/documents/${crypto.randomUUID()}-${safeName}`;
    const upload = await supabase.storage.from("hr-employee-files").upload(storagePath, documentFile, { contentType: documentFile.type, upsert: false });
    if (upload.error) { setError(upload.error.message); setSaving(false); return; }
    const { data: authData } = await supabase.auth.getUser();
    const saved = await supabase.from("hr_employee_documents").insert({
      ...documentForm,
      employee_id: employee.id, school_id: employee.school_id,
      issue_date: documentForm.issue_date || null, expiry_date: documentForm.expiry_date || null,
      storage_path: storagePath, original_file_name: documentFile.name,
      mime_type: documentFile.type, file_size_bytes: documentFile.size,
      created_by: authData.user?.id || null,
    });
    if (saved.error) {
      await supabase.storage.from("hr-employee-files").remove([storagePath]);
      setError(saved.error.message);
    } else {
      setDocumentForm({ document_type: "other", document_title: "", document_number: "", issue_date: "", expiry_date: "", notes: "" });
      setDocumentFile(null); setNotice("Employee document uploaded successfully."); await loadFile();
    }
    setSaving(false);
  };

  const createEmploymentContract = async (formEventEvent) => {
    formEventEvent.preventDefault();
    if (!employee || !canManage || saving) return;
    if (contractFile && (contractFile.size > 20 * 1024 * 1024 || contractFile.type !== "application/pdf")) {
      setError("Contract attachment must be a PDF of 20 MB or less."); return;
    }
    setSaving(true); setError(""); setNotice("");
    let storagePath = null;
    if (contractFile) {
      const safeName = contractFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      storagePath = `${employee.school_id}/${employee.id}/contracts/${crypto.randomUUID()}-${safeName}`;
      const upload = await supabase.storage.from("hr-employee-files").upload(storagePath, contractFile, { contentType: "application/pdf", upsert: false });
      if (upload.error) { setError(upload.error.message); setSaving(false); return; }
    }
    const { data: authData } = await supabase.auth.getUser();
    const payload = {
      ...contractForm, employee_id: employee.id, school_id: employee.school_id,
      end_date: contractForm.end_date || null, probation_end_date: contractForm.probation_end_date || null,
      basic_salary: contractForm.basic_salary === "" ? null : Number(contractForm.basic_salary),
      notice_period_days: contractForm.notice_period_days === "" ? null : Number(contractForm.notice_period_days),
      storage_path: storagePath, created_by: authData.user?.id || null,
    };
    const saved = await supabase.from("hr_employment_contracts").insert(payload);
    if (saved.error) {
      if (storagePath) await supabase.storage.from("hr-employee-files").remove([storagePath]);
      setError(saved.error.message);
    } else {
      setContractForm({ contract_number: "", contract_type: "fixed_term", start_date: "", end_date: "", job_title: employee.position || "", department: employee.department || "", basic_salary: "", probation_end_date: "", notice_period_days: "30", status: "draft", notes: "" });
      setContractFile(null); setNotice("Employment contract saved."); await loadFile();
    }
    setSaving(false);
  };

  const openPrivateFile = async (path) => {
    const { data, error: linkError } = await supabase.storage.from("hr-employee-files").createSignedUrl(path, 60);
    if (linkError) { setError(linkError.message); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const tabs = [
    ["overview", "Overview"],
    ["personal", "Personal Details"],
    ["contacts", "Emergency Contacts"],
    ["history", "Employment History"],
    ["documents", "Documents"],
    ["contracts", "Contracts"],
  ];

  if (loading) return <div className="rounded-2xl border bg-white p-8 text-sm text-slate-600">Loading employee file...</div>;
  if (!employee) return <div className="rounded-2xl border bg-white p-8"><p className="font-semibold text-rose-700">{error || "Employee not found."}</p><button className="mt-4 rounded-lg bg-slate-800 px-4 py-2 text-white" onClick={() => navigate("/hr-management")}>Back to HR Management</button></div>;

  return (
    <div className="space-y-6">
      <header className="rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-800 p-6 text-white shadow-lg">
        <button type="button" onClick={() => navigate("/hr-management")} className="mb-5 inline-flex items-center gap-2 text-sm text-blue-100 hover:text-white"><FaArrowLeft /> Back to HR Management</button>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">Employee Digital File</p>
            <h1 className="mt-2 text-3xl font-extrabold">{fullName(employee)}</h1>
            <p className="mt-2 text-sm text-blue-100">{employee.employee_number || "No employee number"} · {employee.department || "Department not set"} · {employee.position || "Position not set"}</p>
          </div>
          <span className="w-fit rounded-full bg-white/15 px-4 py-2 text-sm font-semibold">{employee.status || "Status not set"}</span>
        </div>
      </header>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}

      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Employee file sections">
        {tabs.map(([id, label]) => <button key={id} type="button" onClick={() => setActiveTab(id)} className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold ${activeTab === id ? "bg-blue-700 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>{label}</button>)}
      </nav>

      {activeTab === "overview" && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            ["Employee Number", employee.employee_number],
            ["Full Name", fullName(employee)],
            ["Employee Type", employee.employee_type],
            ["Department", employee.department],
            ["Position", employee.position],
            ["Employment Date", employee.employment_date],
            ["Gender", employee.gender],
            ["Phone", employee.phone],
            ["Email", employee.email],
            ["Status", employee.status],
            ["Emergency Contacts", contacts.length],
            ["Employment History Entries", history.length],
          ].map(([label, value]) => <article key={label} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-2 font-semibold text-slate-900">{value || "—"}</p></article>)}
        </div>
      )}

      {activeTab === "personal" && (
        canManage ? <form onSubmit={saveProfile} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-2">
          <div className="md:col-span-2"><h2 className="text-lg font-bold text-slate-900">Additional Personal Details</h2><p className="text-sm text-slate-500">Core identity, contact and employment fields remain sourced from the existing Employees / Teachers records.</p></div>
          <label className="text-sm font-medium text-slate-700">Date of Birth<input type="date" value={profile.date_of_birth || ""} onChange={(e) => setProfile((p) => ({ ...p, date_of_birth: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          <label className="text-sm font-medium text-slate-700">Nationality<input value={profile.nationality || ""} onChange={(e) => setProfile((p) => ({ ...p, nationality: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          <label className="text-sm font-medium text-slate-700">National ID<input value={profile.national_id || ""} onChange={(e) => setProfile((p) => ({ ...p, national_id: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          <label className="text-sm font-medium text-slate-700">Marital Status<select value={profile.marital_status || ""} onChange={(e) => setProfile((p) => ({ ...p, marital_status: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">Not specified</option><option value="single">Single</option><option value="married">Married</option><option value="divorced">Divorced</option><option value="widowed">Widowed</option><option value="other">Other</option></select></label>
          <label className="text-sm font-medium text-slate-700">Personal Email<input type="email" value={profile.personal_email || ""} onChange={(e) => setProfile((p) => ({ ...p, personal_email: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          <label className="text-sm font-medium text-slate-700">Alternative Phone<input value={profile.alternative_phone || ""} onChange={(e) => setProfile((p) => ({ ...p, alternative_phone: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          <label className="text-sm font-medium text-slate-700">Residential Address<input value={profile.residential_address || ""} onChange={(e) => setProfile((p) => ({ ...p, residential_address: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          <label className="text-sm font-medium text-slate-700">Postal Address<input value={profile.postal_address || ""} onChange={(e) => setProfile((p) => ({ ...p, postal_address: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">HR Notes<textarea rows="3" value={profile.notes || ""} onChange={(e) => setProfile((p) => ({ ...p, notes: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          <div className="md:col-span-2 flex justify-end"><button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"><FaSave /> {saving ? "Saving..." : "Save Personal Details"}</button></div>
        </form> : <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Personal details are read-only for this role.</section>
      )}

      {activeTab === "contacts" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          {canManage ? <form onSubmit={addContact} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><FaAddressBook /> Add Emergency Contact</h2>
            <label className="block text-sm font-medium text-slate-700">Full Name<input required value={contact.contact_name} onChange={(e) => setContact((p) => ({ ...p, contact_name: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="block text-sm font-medium text-slate-700">Relationship<input value={contact.relationship} onChange={(e) => setContact((p) => ({ ...p, relationship: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="block text-sm font-medium text-slate-700">Phone<input required value={contact.phone} onChange={(e) => setContact((p) => ({ ...p, phone: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="block text-sm font-medium text-slate-700">Email<input type="email" value={contact.email} onChange={(e) => setContact((p) => ({ ...p, email: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="block text-sm font-medium text-slate-700">Address<input value={contact.address} onChange={(e) => setContact((p) => ({ ...p, address: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={contact.is_primary} onChange={(e) => setContact((p) => ({ ...p, is_primary: e.target.checked }))} /> Primary emergency contact</label>
            <button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"><FaPlus /> Add Contact</button>
          </form> : null}
          <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold text-slate-900">Registered Contacts</h2><div className="mt-3 divide-y divide-slate-100">{contacts.map((row) => <article key={row.id} className="py-3"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-900">{row.contact_name}</p>{row.is_primary && <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">Primary</span>}</div><p className="mt-1 text-sm text-slate-600">{row.relationship || "Contact"} · {row.phone}</p><p className="text-xs text-slate-500">{row.email || ""} {row.address ? `· ${row.address}` : ""}</p></article>)}{contacts.length === 0 && <p className="py-5 text-sm text-slate-500">No emergency contacts recorded.</p>}</div></section>
        </div>
      )}

      {activeTab === "documents" && (
        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          {canManage ? <form onSubmit={uploadEmployeeDocument} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-bold text-slate-900">Upload Employee Document</h2>
            <label className="block text-sm font-medium">Document Type<select required value={documentForm.document_type} onChange={(e) => setDocumentForm((p) => ({ ...p, document_type: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2">{[["national_id","National ID"],["passport","Passport"],["academic_certificate","Academic Certificate"],["professional_certificate","Professional Certificate"],["birth_certificate","Birth Certificate"],["medical_certificate","Medical Certificate"],["appointment_letter","Appointment Letter"],["confirmation_letter","Confirmation Letter"],["promotion_letter","Promotion Letter"],["disciplinary_letter","Disciplinary Letter"],["termination_letter","Termination Letter"],["cv","CV"],["other","Other"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label className="block text-sm font-medium">Document Title<input required value={documentForm.document_title} onChange={(e) => setDocumentForm((p) => ({ ...p, document_title: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
            <label className="block text-sm font-medium">Document Number<input value={documentForm.document_number} onChange={(e) => setDocumentForm((p) => ({ ...p, document_number: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
            <div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium">Issue Date<input type="date" value={documentForm.issue_date} onChange={(e) => setDocumentForm((p) => ({ ...p, issue_date: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><label className="text-sm font-medium">Expiry Date<input type="date" value={documentForm.expiry_date} onChange={(e) => setDocumentForm((p) => ({ ...p, expiry_date: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2" /></label></div>
            <label className="block text-sm font-medium">Choose File<input required type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(e) => setDocumentFile(e.target.files?.[0] || null)} className="mt-1 block w-full text-sm" /></label>
            <p className="text-xs text-slate-500">PDF, DOC, DOCX, JPG or PNG. Maximum 20 MB. Stored privately.</p>
            <label className="block text-sm font-medium">Notes<textarea rows="2" value={documentForm.notes} onChange={(e) => setDocumentForm((p) => ({ ...p, notes: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
            <button disabled={saving || !documentFile} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Uploading..." : "Upload Document"}</button>
          </form> : null}
          <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold">Employee Documents ({documents.length})</h2><div className="mt-3 divide-y">{documents.map((doc) => <article key={doc.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold">{doc.document_title}</p><p className="text-xs text-slate-500">{doc.document_type.replaceAll("_"," ")} · {doc.original_file_name} · {Math.ceil(doc.file_size_bytes / 1024)} KB</p><p className="text-xs text-slate-500">Expiry: {doc.expiry_date || "Not specified"}</p></div><button type="button" onClick={() => openPrivateFile(doc.storage_path)} className="rounded-lg border px-3 py-2 text-xs font-bold">Open Securely</button></article>)}{documents.length === 0 && <p className="py-5 text-sm text-slate-500">No employee documents have been uploaded.</p>}</div></section>
        </div>
      )}

      {activeTab === "contracts" && (
        <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
          {canManage ? <form onSubmit={createEmploymentContract} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-bold">Create Employment Contract</h2>
            <label className="block text-sm font-medium">Contract Number<input required value={contractForm.contract_number} onChange={(e) => setContractForm((p) => ({ ...p, contract_number: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
            <label className="block text-sm font-medium">Contract Type<select value={contractForm.contract_type} onChange={(e) => setContractForm((p) => ({ ...p, contract_type: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2">{[["permanent","Permanent"],["fixed_term","Fixed Term"],["probation","Probation"],["part_time","Part Time"],["temporary","Temporary"],["consultancy","Consultancy"],["internship","Internship"],["other","Other"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium">Start Date<input required type="date" value={contractForm.start_date} onChange={(e) => setContractForm((p) => ({ ...p, start_date: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><label className="text-sm font-medium">End Date<input type="date" value={contractForm.end_date} onChange={(e) => setContractForm((p) => ({ ...p, end_date: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2" /></label></div>
            <div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium">Job Title<input value={contractForm.job_title} onChange={(e) => setContractForm((p) => ({ ...p, job_title: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><label className="text-sm font-medium">Department<input value={contractForm.department} onChange={(e) => setContractForm((p) => ({ ...p, department: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2" /></label></div>
            <div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium">Basic Salary (TZS)<input type="number" min="0" step="0.01" value={contractForm.basic_salary} onChange={(e) => setContractForm((p) => ({ ...p, basic_salary: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><label className="text-sm font-medium">Notice Period (days)<input type="number" min="0" value={contractForm.notice_period_days} onChange={(e) => setContractForm((p) => ({ ...p, notice_period_days: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2" /></label></div>
            <label className="block text-sm font-medium">Probation End Date<input type="date" value={contractForm.probation_end_date} onChange={(e) => setContractForm((p) => ({ ...p, probation_end_date: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
            <label className="block text-sm font-medium">Status<select value={contractForm.status} onChange={(e) => setContractForm((p) => ({ ...p, status: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="draft">Draft</option><option value="pending_signature">Pending Signature</option><option value="active">Active</option></select></label>
            <label className="block text-sm font-medium">Signed Contract PDF (optional)<input type="file" accept="application/pdf,.pdf" onChange={(e) => setContractFile(e.target.files?.[0] || null)} className="mt-1 block w-full text-sm" /></label>
            <label className="block text-sm font-medium">Notes<textarea rows="2" value={contractForm.notes} onChange={(e) => setContractForm((p) => ({ ...p, notes: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
            <button disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Saving..." : "Save Contract"}</button>
          </form> : null}
          <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold">Employment Contracts ({contracts.length})</h2><div className="mt-3 space-y-3">{contracts.map((contract) => <article key={contract.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{contract.contract_number}</p><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold capitalize">{contract.status.replaceAll("_"," ")}</span></div><p className="mt-1 text-sm">{contract.contract_type.replaceAll("_"," ")} · {contract.job_title || "Position not set"}</p><p className="text-xs text-slate-500">{contract.start_date} – {contract.end_date || "Open-ended"} · {contract.basic_salary == null ? "Salary not recorded" : `TZS ${Number(contract.basic_salary).toLocaleString()}`}</p>{contract.storage_path && <button type="button" onClick={() => openPrivateFile(contract.storage_path)} className="mt-3 rounded-lg border px-3 py-2 text-xs font-bold">Open Contract PDF</button>}</article>)}{contracts.length === 0 && <p className="py-5 text-sm text-slate-500">No employment contracts recorded.</p>}</div></section>
        </div>
      )}

      {activeTab === "history" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          {canManage ? <form onSubmit={addHistory} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><FaHistory /> Record Employment Event</h2>
            <label className="block text-sm font-medium text-slate-700">Event Type<select value={event.event_type} onChange={(e) => setEvent((p) => ({ ...p, event_type: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">{eventTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="block text-sm font-medium text-slate-700">Effective Date<input required type="date" value={event.event_date} onChange={(e) => setEvent((p) => ({ ...p, event_date: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="block text-sm font-medium text-slate-700">Previous Department<input value={event.previous_department} onChange={(e) => setEvent((p) => ({ ...p, previous_department: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="block text-sm font-medium text-slate-700">New Department<input value={event.new_department} onChange={(e) => setEvent((p) => ({ ...p, new_department: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="block text-sm font-medium text-slate-700">Previous Position<input value={event.previous_position} onChange={(e) => setEvent((p) => ({ ...p, previous_position: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="block text-sm font-medium text-slate-700">New Position<input value={event.new_position} onChange={(e) => setEvent((p) => ({ ...p, new_position: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="block text-sm font-medium text-slate-700">Reference Number<input value={event.reference_number} onChange={(e) => setEvent((p) => ({ ...p, reference_number: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="block text-sm font-medium text-slate-700">Description<textarea required rows="3" value={event.description} onChange={(e) => setEvent((p) => ({ ...p, description: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"><FaPlus /> Save History Entry</button>
          </form> : null}
          <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold text-slate-900">Employment Timeline</h2><div className="mt-3 space-y-3">{history.map((row) => <article key={row.id} className="rounded-xl border border-slate-100 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold capitalize text-slate-900">{row.event_type.replaceAll("_", " ")}</span><time className="text-xs text-slate-500">{row.event_date}</time></div><p className="mt-2 text-sm text-slate-700">{row.description}</p><p className="mt-1 text-xs text-slate-500">{row.previous_position || "—"} → {row.new_position || "—"} · {row.reference_number || "No reference"}</p></article>)}{history.length === 0 && <p className="py-5 text-sm text-slate-500">No employment history recorded.</p>}</div></section>
        </div>
      )}
    </div>
  );
}

export default EmployeeDigitalFile;
