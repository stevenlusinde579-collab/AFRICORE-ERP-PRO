import React, { useCallback, useEffect, useState } from "react";
import {
    Building2,
    Plus,
    Search,
    RefreshCw,
    Save,
    X,
    AlertCircle,
    CheckCircle2,
    Loader2,
    MapPin,
    Phone,
    Mail,
    Hash,
    ShieldCheck,
} from "lucide-react";
import { supabase } from "../../services/supabase";
import api from "../../services/api";

const emptyForm = {
    school_name: "",
    registration_number: "",
    address: "",
    phone: "",
    email: "",
};

function SchoolManagement() {
    const [schools, setSchools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [headmasterSchool, setHeadmasterSchool] = useState(null);
    const [headmasterForm, setHeadmasterForm] = useState({ full_name: "", email: "", phone: "", password: "" });
    const [creatingHeadmaster, setCreatingHeadmaster] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [search, setSearch] = useState("");
    const [showInactive, setShowInactive] = useState(false);
    const [notice, setNotice] = useState(null);

    const loadSchools = useCallback(async () => {
        setLoading(true);
        setNotice(null);
        const { data, error } = await supabase
            .from("schools")
            .select("id, school_name, registration_number, address, phone, email, created_at, is_active")
            .order("id", { ascending: true });

        if (error) {
            console.error("SCHOOL MANAGEMENT LOAD ERROR:", error);
            setNotice({ type: "error", text: error.message || "Imeshindikana kupata shule." });
            setSchools([]);
        } else {
            setSchools(data || []);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        loadSchools();
    }, [loadSchools]);

    const startCreate = () => {
        setEditingId(null);
        setForm(emptyForm);
        setNotice(null);
        setShowForm(true);
    };

    const startEdit = (school) => {
        setEditingId(school.id);
        setForm({
            school_name: school.school_name || "",
            registration_number: school.registration_number || "",
            address: school.address || "",
            phone: school.phone || "",
            email: school.email || "",
        });
        setNotice(null);
        setShowForm(true);
    };

    const startHeadmasterCreate = (school) => {
        setHeadmasterSchool(school);
        setHeadmasterForm({ full_name: "", email: "", phone: "", password: "" });
        setNotice(null);
    };

    const updateHeadmasterField = (event) => {
        const { name, value } = event.target;
        setHeadmasterForm((current) => ({ ...current, [name]: value }));
    };

    const saveHeadmaster = async (event) => {
        event.preventDefault();
        if (!headmasterSchool) return;
        setCreatingHeadmaster(true);
        setNotice(null);

        try {
            const response = await api.post("/schools/headmaster", {
                school_id: headmasterSchool.id,
                full_name: headmasterForm.full_name.trim(),
                email: headmasterForm.email.trim().toLowerCase(),
                phone: headmasterForm.phone.trim(),
                password: headmasterForm.password,
            });

            setHeadmasterSchool(null);
            setHeadmasterForm({ full_name: "", email: "", phone: "", password: "" });
            setNotice({
                type: "success",
                text: `Akaunti ya Headmaster ${response.data?.headmaster?.email || headmasterForm.email} imeundwa na kuunganishwa na ${headmasterSchool.school_name}. Mpe nenosiri kwa njia salama; halikutumwa kwa barua pepe.`,
            });
        } catch (error) {
            setNotice({
                type: "error",
                text: error?.response?.data?.message || "Imeshindikana kuunda akaunti ya Headmaster.",
            });
        } finally {
            setCreatingHeadmaster(false);
        }
    };

    const updateField = (event) => {
        const { name, value } = event.target;
        setForm((current) => ({ ...current, [name]: value }));
    };

    const saveSchool = async (event) => {
        event.preventDefault();
        setNotice(null);

        const schoolName = form.school_name.trim();
        if (!schoolName) {
            setNotice({ type: "error", text: "Jina la shule linahitajika." });
            return;
        }

        const registrationNumber = form.registration_number.trim();
        const email = form.email.trim();

        // Check likely duplicates before writing. Existing records are not changed.
        let duplicateQuery = supabase
            .from("schools")
            .select("id, school_name, registration_number, email")
            .eq("is_active", true)
            .neq("id", editingId ?? -1);

        if (registrationNumber) {
            duplicateQuery = duplicateQuery.eq("registration_number", registrationNumber);
        } else {
            duplicateQuery = duplicateQuery.ilike("school_name", schoolName);
        }

        const { data: duplicates, error: duplicateError } = await duplicateQuery.limit(1);
        if (duplicateError) {
            setNotice({ type: "error", text: "Imeshindikana kuthibitisha kama shule hii tayari ipo. Hakuna kilichohifadhiwa." });
            return;
        }
        if ((duplicates || []).length) {
            const duplicate = duplicates[0];
            setNotice({
                type: "error",
                text: `Shule inayofanana tayari ipo (School ID ${duplicate.id}: ${duplicate.school_name}). Kagua rekodi iliyopo kabla ya kuongeza nyingine.`,
            });
            return;
        }

        const payload = {
            school_name: schoolName,
            registration_number: registrationNumber || null,
            address: form.address.trim() || null,
            phone: form.phone.trim() || null,
            email: email || null,
        };

        setSaving(true);
        const result = editingId
            ? await supabase.from("schools").update(payload).eq("id", editingId).select("id").single()
            : await supabase.from("schools").insert(payload).select("id").single();
        setSaving(false);

        if (result.error) {
            console.error("SCHOOL MANAGEMENT SAVE ERROR:", result.error);
            setNotice({ type: "error", text: result.error.message || "Imeshindikana kuhifadhi shule." });
            return;
        }

        setShowForm(false);
        setEditingId(null);
        setForm(emptyForm);
        setNotice({
            type: "success",
            text: editingId
                ? "Taarifa za shule zimehifadhiwa."
                : `Shule imeongezwa kwa mafanikio. School ID: ${result.data.id}. Hatua inayofuata ni kuunda akaunti ya msimamizi wa shule hiyo.`,
        });
        await loadSchools();
    };

    const toggleSchoolStatus = async (school) => {
        // School ID 3 is the existing production school and must remain intact.
        if (Number(school.id) === 3 && school.is_active === true) {
            setNotice({
                type: "error",
                text: "Shule hii ya msingi (School ID 3) imelindwa na haiwezi kusimamishwa kupitia School Management.",
            });
            return;
        }

        const nextActive = school.is_active !== true;
        const action = nextActive ? "kuwasha" : "kusimamisha";
        if (!window.confirm(`Unataka ${action} shule \"${school.school_name}\" (ID ${school.id})? Data zake hazitafutwa.`)) return;

        setNotice(null);
        const { error } = await supabase
            .from("schools")
            .update({ is_active: nextActive })
            .eq("id", school.id);

        if (error) {
            console.error("SCHOOL STATUS UPDATE ERROR:", error);
            setNotice({ type: "error", text: error.message || "Imeshindikana kubadilisha hali ya shule." });
            return;
        }

        setNotice({
            type: "success",
            text: nextActive
                ? `Shule ${school.school_name} imewashwa tena.`
                : `Shule ${school.school_name} imesimamishwa bila kufuta data zake.`,
        });
        await loadSchools();
    };

    const normalizedSearch = search.trim().toLowerCase();
    const filteredSchools = schools.filter((school) =>
        (showInactive || school.is_active === true) &&
        [
            school.school_name,
            school.registration_number,
            school.email,
            school.phone,
            String(school.id),
        ].some((value) => String(value || "").toLowerCase().includes(normalizedSearch))
    );

    return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
                            <ShieldCheck size={14} /> SUPER ADMIN
                        </div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">School Management</h1>
                        <p className="mt-1 text-sm text-slate-600">Ongeza na simamia shule zinazotumia AfriCore ERP.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={loadSchools} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100">
                            <RefreshCw size={16} /> Refresh
                        </button>
                        <button type="button" onClick={startCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-800">
                            <Plus size={17} /> Add School
                        </button>
                    </div>
                </div>

                {notice && (
                    <div className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${notice.type === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
                        {notice.type === "error" ? <AlertCircle size={19} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={19} className="mt-0.5 shrink-0" />}
                        <span className="flex-1">{notice.text}</span>
                        <button type="button" onClick={() => setNotice(null)} aria-label="Close message"><X size={17} /></button>
                    </div>
                )}

                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-sm font-semibold text-slate-500">Shule active</p>
                        <p className="mt-2 text-3xl font-black text-slate-900">{schools.filter((school) => school.is_active === true).length}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-sm font-semibold text-slate-500">Shule zilizosimamishwa</p>
                        <p className="mt-2 text-3xl font-black text-slate-900">{schools.filter((school) => school.is_active !== true).length}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-sm font-semibold text-slate-500">Shule zote</p>
                        <p className="mt-2 text-3xl font-black text-slate-900">{schools.length}</p>
                    </div>
                </div>

                {showForm && (
                    <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm sm:p-6">
                        <div className="mb-5 flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-extrabold text-slate-900">{editingId ? "Hariri taarifa za shule" : "Ongeza shule mpya"}</h2>
                                <p className="mt-1 text-sm text-slate-500">School ID itatengenezwa na database.</p>
                            </div>
                            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close form"><X size={20} /></button>
                        </div>
                        <form onSubmit={saveSchool} className="grid gap-4 sm:grid-cols-2">
                            <label className="block sm:col-span-2">
                                <span className="mb-1.5 block text-sm font-bold text-slate-700">Jina la shule *</span>
                                <div className="relative">
                                    <Building2 size={17} className="absolute left-3 top-3.5 text-slate-400" />
                                    <input required name="school_name" value={form.school_name} onChange={updateField} maxLength={180} className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" placeholder="Mfano: AFRICORE SECONDARY SCHOOL" />
                                </div>
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-sm font-bold text-slate-700">Namba ya usajili</span>
                                <div className="relative">
                                    <Hash size={17} className="absolute left-3 top-3.5 text-slate-400" />
                                    <input name="registration_number" value={form.registration_number} onChange={updateField} maxLength={100} className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" placeholder="Mfano: S.1234" />
                                </div>
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-sm font-bold text-slate-700">Simu</span>
                                <div className="relative">
                                    <Phone size={17} className="absolute left-3 top-3.5 text-slate-400" />
                                    <input name="phone" value={form.phone} onChange={updateField} maxLength={50} className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" placeholder="Namba ya simu ya shule" />
                                </div>
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-sm font-bold text-slate-700">Barua pepe</span>
                                <div className="relative">
                                    <Mail size={17} className="absolute left-3 top-3.5 text-slate-400" />
                                    <input type="email" name="email" value={form.email} onChange={updateField} maxLength={180} className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" placeholder="info@shule.ac.tz" />
                                </div>
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-sm font-bold text-slate-700">Anuani / eneo</span>
                                <div className="relative">
                                    <MapPin size={17} className="absolute left-3 top-3.5 text-slate-400" />
                                    <input name="address" value={form.address} onChange={updateField} maxLength={500} className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" placeholder="Wilaya, mkoa, eneo" />
                                </div>
                            </label>
                            <div className="flex flex-wrap justify-end gap-3 sm:col-span-2">
                                <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancel</button>
                                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">
                                    {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
                                    {saving ? "Inahifadhi..." : editingId ? "Hifadhi mabadiliko" : "Hifadhi shule"}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {headmasterSchool && (
                    <div className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm sm:p-6">
                        <div className="mb-5 flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-extrabold text-slate-900">Create Headmaster Account</h2>
                                <p className="mt-1 text-sm text-slate-600">
                                    {headmasterSchool.school_name} · School ID: {headmasterSchool.id}
                                </p>
                                <p className="mt-2 text-xs text-amber-700">
                                    Nenosiri halitatumwa kwa barua pepe. Tumia nenosiri la muda na mpe Headmaster kwa njia salama.
                                </p>
                            </div>
                            <button type="button" onClick={() => setHeadmasterSchool(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close Headmaster form"><X size={20} /></button>
                        </div>
                        <form onSubmit={saveHeadmaster} className="grid gap-4 sm:grid-cols-2">
                            <label className="block sm:col-span-2">
                                <span className="mb-1.5 block text-sm font-bold text-slate-700">Full name *</span>
                                <input required name="full_name" value={headmasterForm.full_name} onChange={updateHeadmasterField} maxLength={180} className="w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-blue-600" placeholder="Jina kamili la Headmaster" />
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-sm font-bold text-slate-700">Email / username *</span>
                                <input required type="email" name="email" value={headmasterForm.email} onChange={updateHeadmasterField} maxLength={254} autoComplete="off" className="w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-blue-600" placeholder="headmaster@school.ac.tz" />
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-sm font-bold text-slate-700">Phone</span>
                                <input name="phone" value={headmasterForm.phone} onChange={updateHeadmasterField} maxLength={50} className="w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-blue-600" placeholder="+255..." />
                            </label>
                            <label className="block sm:col-span-2">
                                <span className="mb-1.5 block text-sm font-bold text-slate-700">Temporary password * (at least 8 characters)</span>
                                <input required type="password" name="password" value={headmasterForm.password} onChange={updateHeadmasterField} minLength={8} maxLength={128} autoComplete="new-password" className="w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-blue-600" placeholder="Tengeneza nenosiri la muda" />
                            </label>
                            <div className="flex justify-end gap-3 sm:col-span-2">
                                <button type="button" onClick={() => setHeadmasterSchool(null)} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancel</button>
                                <button type="submit" disabled={creatingHeadmaster} className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-5 py-3 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-60">
                                    {creatingHeadmaster ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />}
                                    {creatingHeadmaster ? "Creating account..." : "Create Headmaster"}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="font-extrabold text-slate-900">Shule zilizosajiliwa</h2>
                            <p className="mt-1 text-xs text-slate-500">Taarifa za shule active na zilizosimamishwa.</p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <div className="relative w-full sm:max-w-xs">
                                <Search size={17} className="absolute left-3 top-3.5 text-slate-400" />
                                <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 text-sm outline-none focus:border-blue-600" placeholder="Tafuta jina, ID, usajili..." />
                            </div>
                            <button type="button" onClick={() => setShowInactive((value) => !value)} className={`whitespace-nowrap rounded-xl border px-3 py-3 text-xs font-bold ${showInactive ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-300 bg-white text-slate-700"}`}>
                                {showInactive ? "Ficha shule zilizosimamishwa" : "Onyesha shule zilizosimamishwa"}
                            </button>
                        </div>
                    </div>
                    {loading ? (
                        <div className="flex items-center justify-center gap-3 p-12 text-slate-500"><Loader2 className="animate-spin" size={22} /> Inapakia shule...</div>
                    ) : filteredSchools.length === 0 ? (
                        <div className="p-12 text-center text-sm text-slate-500">Hakuna shule inayolingana na utafutaji.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px] text-left text-sm">
                                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                    <tr>
                                        <th className="px-5 py-4">School</th>
                                        <th className="px-5 py-4">Registration No.</th>
                                        <th className="px-5 py-4">Contact</th>
                                        <th className="px-5 py-4">Address</th>
                                        <th className="px-5 py-4">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredSchools.map((school) => (
                                        <tr key={school.id} className="hover:bg-slate-50">
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><Building2 size={20} /></div>
                                                    <div>
                                                        <p className="font-bold text-slate-900">{school.school_name}</p>
                                                        <p className="text-xs text-slate-500">School ID: {school.id}</p>
                                                        <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${school.is_active === true ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                                                            {school.is_active === true ? "ACTIVE" : "INACTIVE"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-slate-700">{school.registration_number || "—"}</td>
                                            <td className="px-5 py-4">
                                                <p className="text-slate-700">{school.phone || "—"}</p>
                                                <p className="text-xs text-slate-500">{school.email || "—"}</p>
                                            </td>
                                            <td className="max-w-xs whitespace-pre-wrap px-5 py-4 text-slate-600">{school.address || "—"}</td>
                                            <td className="px-5 py-4">
                                                <div className="flex flex-wrap gap-2"><button type="button" disabled={school.is_active !== true} onClick={() => startHeadmasterCreate(school)} className="rounded-lg border border-violet-300 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40">Create Headmaster</button><button type="button" onClick={() => startEdit(school)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:border-blue-400 hover:text-blue-700">Edit details</button><button type="button" disabled={Number(school.id) === 3 && school.is_active === true} title={Number(school.id) === 3 && school.is_active === true ? "Shule hii ya msingi imelindwa" : undefined} onClick={() => toggleSchoolStatus(school)} className={`rounded-lg border px-3 py-2 text-xs font-bold ${school.is_active === true ? "border-amber-300 text-amber-800 hover:bg-amber-50" : "border-emerald-300 text-emerald-800 hover:bg-emerald-50"} disabled:cursor-not-allowed disabled:opacity-40`}>{school.is_active === true ? "Deactivate" : "Activate"}</button></div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <strong>Usalama wa data:</strong> Deactivate haisufi shule wala data zake. Shule zilizosimamishwa zinaweza kuonyeshwa kwa kitufe hapo juu na kuwashwa tena. Akaunti ya Headmaster inaweza kuundwa kwa shule active pekee.
                </div>
            </div>
        </div>
    );
}

export default SchoolManagement;
