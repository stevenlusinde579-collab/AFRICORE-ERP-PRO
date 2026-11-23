import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaSave, FaPlus, FaUserTie, FaHistory, FaAddressBook } from "react-icons/fa";
import { supabase } from "../../services/supabase";
import { useSchool } from "../../context/SchoolContext";

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
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [profile, setProfile] = useState(emptyProfile);
  const [contacts, setContacts] = useState([]);
  const [history, setHistory] = useState([]);
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

    const [employeeResult, profileResult, contactsResult, historyResult] = await Promise.all([
      supabase.from("employees")
        .select("id,school_id,employee_number,first_name,middle_name,last_name,gender,phone,email,address,employee_type,department,position,employment_date,status")
        .eq("id", id)
        .eq("school_id", schoolId)
        .maybeSingle(),
      supabase.from("hr_employee_profiles").select("*").eq("employee_id", id).eq("school_id", schoolId).maybeSingle(),
      supabase.from("hr_employee_contacts").select("*").eq("employee_id", id).eq("school_id", schoolId).order("is_primary", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("hr_employment_history").select("*").eq("employee_id", id).eq("school_id", schoolId).order("event_date", { ascending: false }),
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

  const tabs = [
    ["overview", "Overview"],
    ["personal", "Personal Details"],
    ["contacts", "Emergency Contacts"],
    ["history", "Employment History"],
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
        <form onSubmit={saveProfile} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-2">
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
        </form>
      )}

      {activeTab === "contacts" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          <form onSubmit={addContact} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><FaAddressBook /> Add Emergency Contact</h2>
            <label className="block text-sm font-medium text-slate-700">Full Name<input required value={contact.contact_name} onChange={(e) => setContact((p) => ({ ...p, contact_name: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="block text-sm font-medium text-slate-700">Relationship<input value={contact.relationship} onChange={(e) => setContact((p) => ({ ...p, relationship: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="block text-sm font-medium text-slate-700">Phone<input required value={contact.phone} onChange={(e) => setContact((p) => ({ ...p, phone: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="block text-sm font-medium text-slate-700">Email<input type="email" value={contact.email} onChange={(e) => setContact((p) => ({ ...p, email: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="block text-sm font-medium text-slate-700">Address<input value={contact.address} onChange={(e) => setContact((p) => ({ ...p, address: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={contact.is_primary} onChange={(e) => setContact((p) => ({ ...p, is_primary: e.target.checked }))} /> Primary emergency contact</label>
            <button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"><FaPlus /> Add Contact</button>
          </form>
          <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold text-slate-900">Registered Contacts</h2><div className="mt-3 divide-y divide-slate-100">{contacts.map((row) => <article key={row.id} className="py-3"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-900">{row.contact_name}</p>{row.is_primary && <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">Primary</span>}</div><p className="mt-1 text-sm text-slate-600">{row.relationship || "Contact"} · {row.phone}</p><p className="text-xs text-slate-500">{row.email || ""} {row.address ? `· ${row.address}` : ""}</p></article>)}{contacts.length === 0 && <p className="py-5 text-sm text-slate-500">No emergency contacts recorded.</p>}</div></section>
        </div>
      )}

      {activeTab === "history" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          <form onSubmit={addHistory} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
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
          </form>
          <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold text-slate-900">Employment Timeline</h2><div className="mt-3 space-y-3">{history.map((row) => <article key={row.id} className="rounded-xl border border-slate-100 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold capitalize text-slate-900">{row.event_type.replaceAll("_", " ")}</span><time className="text-xs text-slate-500">{row.event_date}</time></div><p className="mt-2 text-sm text-slate-700">{row.description}</p><p className="mt-1 text-xs text-slate-500">{row.previous_position || "—"} → {row.new_position || "—"} · {row.reference_number || "No reference"}</p></article>)}{history.length === 0 && <p className="py-5 text-sm text-slate-500">No employment history recorded.</p>}</div></section>
        </div>
      )}
    </div>
  );
}

export default EmployeeDigitalFile;
