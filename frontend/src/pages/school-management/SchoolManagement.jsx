import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    FaBuilding,
    FaCheckCircle,
    FaEdit,
    FaPlus,
    FaRedo,
    FaSearch,
    FaTimes,
    FaToggleOff,
    FaToggleOn
} from "react-icons/fa";
import api from "../../services/api";

const EMPTY_FORM = {
    school_name: "",
    registration_number: "",
    address: "",
    phone: "",
    email: ""
};

const inputClass =
    "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function displayError(error) {
    return (
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Ombi halikufanikiwa. Tafadhali jaribu tena."
    );
}

export default function SchoolManagement() {
    const [schools, setSchools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [modalOpen, setModalOpen] = useState(false);
    const [editingSchool, setEditingSchool] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);

    const loadSchools = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await api.get("/schools");
            const rows = response?.data?.schools;
            if (!Array.isArray(rows)) {
                throw new Error("Backend haikurudisha orodha sahihi ya shule.");
            }
            setSchools(rows);
        } catch (loadError) {
            setError(displayError(loadError));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSchools();
    }, [loadSchools]);

    const activeCount = useMemo(
        () => schools.filter((school) => school.is_active === true).length,
        [schools]
    );

    const inactiveCount = schools.length - activeCount;

    const visibleSchools = useMemo(() => {
        const query = search.trim().toLowerCase();
        return schools.filter((school) => {
            const matchesStatus =
                statusFilter === "all" ||
                (statusFilter === "active" && school.is_active === true) ||
                (statusFilter === "inactive" && school.is_active !== true);

            const matchesSearch =
                !query ||
                [
                    school.school_name,
                    school.registration_number,
                    school.address,
                    school.email,
                    school.phone
                ].some((value) => String(value || "").toLowerCase().includes(query));

            return matchesStatus && matchesSearch;
        });
    }, [schools, search, statusFilter]);

    const openAddModal = () => {
        setEditingSchool(null);
        setForm(EMPTY_FORM);
        setError("");
        setNotice("");
        setModalOpen(true);
    };

    const openEditModal = (school) => {
        setEditingSchool(school);
        setForm({
            school_name: school.school_name || "",
            registration_number: school.registration_number || "",
            address: school.address || "",
            phone: school.phone || "",
            email: school.email || ""
        });
        setError("");
        setNotice("");
        setModalOpen(true);
    };

    const closeModal = () => {
        if (saving) return;
        setModalOpen(false);
        setEditingSchool(null);
        setForm(EMPTY_FORM);
    };

    const updateField = (event) => {
        const { name, value } = event.target;
        setForm((current) => ({ ...current, [name]: value }));
    };

    const submitSchool = async (event) => {
        event.preventDefault();
        if (!form.school_name.trim()) {
            setError("Jina la shule linahitajika.");
            return;
        }

        setSaving(true);
        setError("");
        setNotice("");

        const payload = {
            school_name: form.school_name.trim(),
            registration_number: form.registration_number.trim(),
            address: form.address.trim(),
            phone: form.phone.trim(),
            email: form.email.trim()
        };

        try {
            if (editingSchool) {
                await api.patch(`/schools/${editingSchool.id}`, payload);
                setNotice("Taarifa za shule zimehifadhiwa.");
            } else {
                await api.post("/schools", payload);
                setNotice("Shule imeongezwa kikamilifu.");
            }

            setModalOpen(false);
            setEditingSchool(null);
            setForm(EMPTY_FORM);
            await loadSchools();
        } catch (saveError) {
            setError(displayError(saveError));
        } finally {
            setSaving(false);
        }
    };

    const toggleSchoolStatus = async (school) => {
        const nextStatus = school.is_active !== true;
        const confirmed = window.confirm(
            nextStatus
                ? `Unataka ku-activate shule "${school.school_name}"?`
                : `Unataka ku-deactivate shule "${school.school_name}"? Data ya shule haitafutwa.`
        );
        if (!confirmed) return;

        setError("");
        setNotice("");
        try {
            await api.patch(`/schools/${school.id}`, {
                is_active: nextStatus
            });
            setNotice(
                nextStatus
                    ? "Shule ime-activate."
                    : "Shule ime-deactivate. Data yake imehifadhiwa."
            );
            await loadSchools();
        } catch (statusError) {
            setError(displayError(statusError));
        }
    };

    const StatCard = ({ title, count, tone, filter, icon }) => (
        <button
            type="button"
            onClick={() => setStatusFilter(filter)}
            className={`rounded-xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-300 ${statusFilter === filter ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200"}`}
            aria-pressed={statusFilter === filter}
        >
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-medium text-slate-500">{title}</p>
                    <p className={`mt-2 text-3xl font-bold ${tone}`}>{count}</p>
                    <p className="mt-1 text-xs text-slate-400">Bonyeza kuchuja orodha</p>
                </div>
                <span className="rounded-xl bg-slate-100 p-3 text-xl text-slate-600">{icon}</span>
            </div>
        </button>
    );

    return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
            <div className="mx-auto max-w-7xl space-y-6">
                <header className="flex flex-col justify-between gap-4 rounded-2xl bg-gradient-to-r from-slate-950 via-blue-950 to-blue-800 p-6 text-white shadow-lg sm:flex-row sm:items-center">
                    <div>
                        <div className="flex items-center gap-3">
                            <span className="rounded-xl bg-white/10 p-3"><FaBuilding className="text-2xl" /></span>
                            <div>
                                <h1 className="text-2xl font-bold sm:text-3xl">School Management</h1>
                                <p className="mt-1 text-sm text-blue-100">Usimamizi wa shule nyingi — Super Admin</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={loadSchools}
                            disabled={loading}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/20 disabled:opacity-60"
                        >
                            <FaRedo className={loading ? "animate-spin" : ""} /> Refresh
                        </button>
                        <button
                            type="button"
                            onClick={openAddModal}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-blue-900 shadow transition hover:bg-blue-50"
                        >
                            <FaPlus /> Add School
                        </button>
                    </div>
                </header>

                {error && !modalOpen && (
                    <div role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                        <span>{error}</span>
                        <button type="button" onClick={() => setError("")} aria-label="Funga ujumbe"><FaTimes /></button>
                    </div>
                )}
                {notice && (
                    <div role="status" className="flex items-start justify-between gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                        <span>{notice}</span>
                        <button type="button" onClick={() => setNotice("")} aria-label="Funga ujumbe"><FaTimes /></button>
                    </div>
                )}

                <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <StatCard title="Total Schools" count={schools.length} tone="text-slate-900" filter="all" icon={<FaBuilding />} />
                    <StatCard title="Active Schools" count={activeCount} tone="text-emerald-600" filter="active" icon={<FaCheckCircle />} />
                    <StatCard title="Inactive Schools" count={inactiveCount} tone="text-rose-600" filter="inactive" icon={<FaToggleOff />} />
                </section>

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Schools Directory</h2>
                            <p className="text-sm text-slate-500">{visibleSchools.length} shule zinaonekana</p>
                        </div>
                        <div className="relative w-full sm:max-w-sm">
                            <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="search"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Tafuta jina, code, simu au email..."
                                className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                aria-label="Tafuta shule"
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center text-sm text-slate-500">Inapakia shule kutoka database...</div>
                    ) : error && schools.length === 0 ? (
                        <div className="p-10 text-center">
                            <p className="font-semibold text-slate-800">Orodha haijapakiwa</p>
                            <p className="mt-2 text-sm text-slate-500">{error}</p>
                            <button type="button" onClick={loadSchools} className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Jaribu tena</button>
                        </div>
                    ) : visibleSchools.length === 0 ? (
                        <div className="p-12 text-center">
                            <FaBuilding className="mx-auto text-3xl text-slate-300" />
                            <p className="mt-3 font-semibold text-slate-700">{schools.length === 0 ? "Hakuna shule zilizopatikana." : "Hakuna shule zinazolingana na utafutaji."}</p>
                            {schools.length === 0 && <button type="button" onClick={openAddModal} className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Ongeza shule ya kwanza</button>}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[850px] text-left text-sm">
                                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                    <tr>
                                        <th className="px-5 py-4">School</th>
                                        <th className="px-5 py-4">Registration / Code</th>
                                        <th className="px-5 py-4">Contact</th>
                                        <th className="px-5 py-4">Status</th>
                                        <th className="px-5 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {visibleSchools.map((school) => (
                                        <tr key={school.id} className="transition hover:bg-slate-50/80">
                                            <td className="px-5 py-4">
                                                <div className="font-semibold text-slate-900">{school.school_name}</div>
                                                <div className="mt-1 text-xs text-slate-500">{school.address || "Anwani haijawekwa"}</div>
                                            </td>
                                            <td className="px-5 py-4 text-slate-700">{school.registration_number || "—"}</td>
                                            <td className="px-5 py-4">
                                                <div className="text-slate-700">{school.phone || "—"}</div>
                                                <div className="mt-1 text-xs text-slate-500">{school.email || "—"}</div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${school.is_active === true ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                                                    <span className={`h-1.5 w-1.5 rounded-full ${school.is_active === true ? "bg-emerald-500" : "bg-rose-500"}`} />
                                                    {school.is_active === true ? "Active" : "Inactive"}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex justify-end gap-2">
                                                    <button type="button" onClick={() => openEditModal(school)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800">
                                                        <FaEdit /> Edit
                                                    </button>
                                                    <button type="button" onClick={() => toggleSchoolStatus(school)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${school.is_active === true ? "border border-rose-200 text-rose-700 hover:bg-rose-50" : "border border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}>
                                                        {school.is_active === true ? <FaToggleOff /> : <FaToggleOn />}
                                                        {school.is_active === true ? "Deactivate" : "Activate"}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                {modalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
                        <section role="dialog" aria-modal="true" aria-labelledby="school-form-title" className="my-6 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
                            <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5 sm:p-6">
                                <div>
                                    <h2 id="school-form-title" className="text-xl font-bold text-slate-900">{editingSchool ? "Edit School" : "Add New School"}</h2>
                                    <p className="mt-1 text-sm text-slate-500">{editingSchool ? "Badilisha taarifa za shule iliyopo." : "Jaza taarifa ili kuongeza shule kwenye database."}</p>
                                </div>
                                <button type="button" onClick={closeModal} disabled={saving} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50" aria-label="Funga"><FaTimes /></button>
                            </div>
                            <form onSubmit={submitSchool} className="space-y-4 p-5 sm:p-6">
                                {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
                                <div>
                                    <label htmlFor="school_name" className="text-sm font-semibold text-slate-700">School Name <span className="text-red-600">*</span></label>
                                    <input id="school_name" name="school_name" value={form.school_name} onChange={updateField} required maxLength={200} autoFocus className={inputClass} placeholder="Mfano: AfriCore Secondary School" />
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <label htmlFor="registration_number" className="text-sm font-semibold text-slate-700">Registration Number / Code</label>
                                        <input id="registration_number" name="registration_number" value={form.registration_number} onChange={updateField} maxLength={100} className={inputClass} placeholder="Namba ya usajili" />
                                    </div>
                                    <div>
                                        <label htmlFor="phone" className="text-sm font-semibold text-slate-700">Phone</label>
                                        <input id="phone" name="phone" type="tel" value={form.phone} onChange={updateField} maxLength={50} className={inputClass} placeholder="+255..." />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="email" className="text-sm font-semibold text-slate-700">Email</label>
                                    <input id="email" name="email" type="email" value={form.email} onChange={updateField} maxLength={254} className={inputClass} placeholder="office@school.ac.tz" />
                                </div>
                                <div>
                                    <label htmlFor="address" className="text-sm font-semibold text-slate-700">Address</label>
                                    <textarea id="address" name="address" value={form.address} onChange={updateField} maxLength={500} rows={3} className={inputClass} placeholder="Mkoa, wilaya na eneo la shule" />
                                </div>
                                <div className="flex flex-col-reverse justify-end gap-3 border-t border-slate-100 pt-4 sm:flex-row">
                                    <button type="button" onClick={closeModal} disabled={saving} className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Cancel</button>
                                    <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">
                                        {saving ? "Inahifadhi..." : <><FaCheckCircle /> {editingSchool ? "Save Changes" : "Create School"}</>}
                                    </button>
                                </div>
                            </form>
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
}
