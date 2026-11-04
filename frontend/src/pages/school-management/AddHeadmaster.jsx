import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MdArrowBack, MdBusiness, MdEmail, MdPhone, MdPerson, MdContentCopy, MdCheckCircle } from "react-icons/md";
import api from "../../services/api";

const inputClass = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function getError(error) {
    return error?.response?.data?.message || error?.message || "Imeshindikana kuunda akaunti. Jaribu tena.";
}

export default function AddHeadmaster() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const requestedSchoolId = searchParams.get("school_id") || "";
    const [schools, setSchools] = useState([]);
    const [schoolId, setSchoolId] = useState(requestedSchoolId);
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [loadingSchools, setLoadingSchools] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [created, setCreated] = useState(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        let mounted = true;
        const loadSchools = async () => {
            setLoadingSchools(true);
            setError("");
            try {
                const response = await api.get("/schools");
                const rows = response?.data?.schools;
                if (!Array.isArray(rows)) throw new Error("Orodha ya shule haijarudishwa vizuri.");
                if (mounted) {
                    const active = rows.filter((school) => school.is_active === true);
                    setSchools(active);
                    if (requestedSchoolId && active.some((school) => String(school.id) === String(requestedSchoolId))) {
                        setSchoolId(String(requestedSchoolId));
                    } else if (!requestedSchoolId && active.length === 1) {
                        setSchoolId(String(active[0].id));
                    }
                }
            } catch (loadError) {
                if (mounted) setError(getError(loadError));
            } finally {
                if (mounted) setLoadingSchools(false);
            }
        };
        loadSchools();
        return () => { mounted = false; };
    }, [requestedSchoolId]);

    const selectedSchool = useMemo(
        () => schools.find((school) => String(school.id) === String(schoolId)) || null,
        [schools, schoolId]
    );

    const submit = async (event) => {
        event.preventDefault();
        setError("");
        setCreated(null);
        if (!schoolId) {
            setError("Chagua shule ambayo Headmaster ataisimamia.");
            return;
        }
        if (!fullName.trim()) {
            setError("Jina kamili la Headmaster linahitajika.");
            return;
        }
        if (!email.trim() && !phone.trim()) {
            setError("Weka email au namba ya simu kwa ajili ya kuingia kwenye mfumo.");
            return;
        }

        setSaving(true);
        try {
            const response = await api.post(`/schools/${schoolId}/headmasters`, {
                full_name: fullName.trim(),
                email: email.trim(),
                phone: phone.trim()
            });
            const credentials = response?.data?.login_credentials;
            if (!response?.data?.success || !credentials?.temporary_password) {
                throw new Error("Akaunti imerudisha majibu yasiyokamilika. Wasiliana na msimamizi kabla ya kujaribu tena.");
            }
            setCreated({
                school: selectedSchool?.school_name || "Shule iliyochaguliwa",
                full_name: fullName.trim(),
                ...credentials
            });
        } catch (submitError) {
            setError(getError(submitError));
        } finally {
            setSaving(false);
        }
    };

    const copyCredentials = async () => {
        if (!created) return;
        const lines = [
            "AfriCore ERP - Headmaster Login",
            `School: ${created.school}`,
            `Name: ${created.full_name}`,
            `Email: ${created.login_email || "-"}`,
            `Phone: ${created.login_phone || "-"}`,
            `Temporary Password: ${created.temporary_password}`
        ];
        try {
            await navigator.clipboard.writeText(lines.join("\n"));
            setCopied(true);
        } catch {
            setError("Imeshindikana kunakili taarifa. Unaweza kuzinakili mwenyewe.");
        }
    };

    return (
        <main className="mx-auto min-h-[70vh] max-w-4xl space-y-6 p-1 sm:p-2">
            <button
                type="button"
                onClick={() => navigate(selectedSchool ? `/school-management/${selectedSchool.id}` : "/school-management")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
                <MdArrowBack /> Rudi
            </button>

            <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-800 p-6 text-white shadow-lg sm:p-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100">
                    <MdBusiness /> SUPER ADMIN • SCHOOL MANAGEMENT
                </div>
                <h1 className="mt-4 text-2xl font-extrabold sm:text-3xl">Add Headmaster</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
                    Tengeneza akaunti ya Mkuu wa Shule. Atatumia akaunti hii kuingia AfriCore ERP na kusajili Staff na Non-Staff wa shule yake.
                </p>
            </section>

            {error && (
                <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                    {error}
                </div>
            )}

            {!created ? (
                <form onSubmit={submit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                    <div>
                        <label className="text-sm font-semibold text-slate-700">Shule atakayosimamia</label>
                        <select
                            value={schoolId}
                            onChange={(event) => setSchoolId(event.target.value)}
                            disabled={loadingSchools || saving || Boolean(requestedSchoolId)}
                            className={inputClass}
                            required
                        >
                            <option value="">{loadingSchools ? "Inapakia shule..." : "Chagua shule"}</option>
                            {schools.map((school) => (
                                <option key={school.id} value={String(school.id)}>{school.school_name}</option>
                            ))}
                        </select>
                        {selectedSchool && <p className="mt-2 text-xs text-emerald-700">Shule iliyochaguliwa: {selectedSchool.school_name}</p>}
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><MdPerson /> Jina kamili la Headmaster</label>
                        <input value={fullName} onChange={(event) => setFullName(event.target.value)} className={inputClass} placeholder="Mfano: Juma Amani" autoComplete="name" required />
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><MdEmail /> Email ya login</label>
                            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} placeholder="headmaster@school.ac.tz" autoComplete="email" />
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><MdPhone /> Namba ya simu</label>
                            <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className={inputClass} placeholder="0712345678" autoComplete="tel" />
                        </div>
                    </div>

                    <p className="rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                        Email au simu angalau moja inahitajika. Mfumo utatengeneza password ya muda na kukuonyesha mara moja baada ya akaunti kuundwa.
                    </p>

                    <button type="submit" disabled={saving || loadingSchools || schools.length === 0} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
                        {saving ? "Inatengeneza akaunti..." : "Tengeneza Akaunti ya Headmaster"}
                    </button>
                </form>
            ) : (
                <section className="space-y-5 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-7">
                    <div className="flex items-start gap-3">
                        <MdCheckCircle className="mt-0.5 text-3xl text-emerald-600" />
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Akaunti imeundwa kikamilifu</h2>
                            <p className="mt-1 text-sm text-slate-600">{created.full_name} sasa ameunganishwa na {created.school}.</p>
                        </div>
                    </div>
                    <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Shule</p>
                            <p className="mt-1 font-semibold text-slate-900">{created.school}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Jina</p>
                            <p className="mt-1 font-semibold text-slate-900">{created.full_name}</p>
                        </div>
                        {created.login_email && <div><p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Login Email</p><p className="mt-1 break-all font-semibold text-slate-900">{created.login_email}</p></div>}
                        {created.login_phone && <div><p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Login Phone</p><p className="mt-1 font-semibold text-slate-900">{created.login_phone}</p></div>}
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Temporary Password</p>
                            <p className="mt-1 break-all rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 font-mono text-lg font-bold text-slate-900">{created.temporary_password}</p>
                        </div>
                    </div>
                    <div className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                        Mpe Headmaster taarifa hizi kwa njia salama. Password hii inaonyeshwa mara hii tu; Headmaster anashauriwa kubadilisha password baada ya kuingia.
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button type="button" onClick={copyCredentials} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"><MdContentCopy /> {copied ? "Imenakiliwa" : "Nakili login credentials"}</button>
                        <button type="button" onClick={() => navigate(selectedSchool ? `/school-management/${selectedSchool.id}` : "/school-management")} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Rudi kwenye shule</button>
                    </div>
                </section>
            )}
        </main>
    );
}
