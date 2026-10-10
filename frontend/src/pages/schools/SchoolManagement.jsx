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
    const [form, setForm] = useState(emptyForm);
    const [search, setSearch] = useState("");
    const [notice, setNotice] = useState(null);

    const loadSchools = useCallback(async () => {
        setLoading(true);
        setNotice(null);
        const { data, error } = await supabase
            .from("schools")
            .select("id, school_name, registration_number, address, phone, email, created_at, is_active")
            .eq("is_active", true)
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

    const normalizedSearch = search.trim().toLowerCase();
    const filteredSchools = schools.filter((school) =>
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
                        <p className="text-sm font-semibold text-slate-500">Jumla ya shule</p>
                        <p className="mt-2 text-3xl font-black text-slate-900">{schools.length}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-sm font-semibold text-slate-500">Shule zenye usajili</p>
                        <p className="mt-2 text-3xl font-black text-slate-900">{schools.filter((school) => school.registration_number).length}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-sm font-semibold text-slate-500">Shule bila namba ya usajili</p>
                        <p className="mt-2 text-3xl font-black text-slate-900">{schools.filter((school) => !school.registration_number).length}</p>
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

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="font-extrabold text-slate-900">Shule zilizosajiliwa</h2>
                            <p className="mt-1 text-xs text-slate-500">Taarifa zilizopo kwenye database kuu.</p>
                        </div>
                        <div className="relative w-full sm:max-w-xs">
                            <Search size={17} className="absolute left-3 top-3.5 text-slate-400" />
                            <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 text-sm outline-none focus:border-blue-600" placeholder="Tafuta jina, ID, usajili..." />
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
                                                <button type="button" onClick={() => startEdit(school)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:border-blue-400 hover:text-blue-700">Edit details</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <strong>Hatua inayofuata:</strong> Kuongeza shule hapa kunatengeneza rekodi ya shule tu. Akaunti ya Headmaster/Admin na kuanzisha madarasa, mwaka wa masomo na watumiaji wa shule hiyo vitafanywa katika hatua inayofuata; hakuna akaunti inayotengenezwa kimyakimya.
                </div>
            </div>
        </div>
    );
}

export default SchoolManagement;
