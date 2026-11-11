import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";

export default function HeadmasterProfile() {
    const { profileId } = useParams();
    const navigate = useNavigate();
    const [headmaster, setHeadmaster] = useState(null);
    const [school, setSchool] = useState(null);
    const [loading, setLoading] = useState(true);
    const [resending, setResending] = useState(false);
    const [savingEmail, setSavingEmail] = useState(false);
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    useEffect(() => {
        let active = true;
        const load = async () => {
            setLoading(true);
            try {
                const [headmastersResponse, schoolsResponse] = await Promise.all([
                    api.get("/schools/headmasters"),
                    api.get("/schools")
                ]);
                const found = (headmastersResponse?.data?.headmasters || []).find((item) => String(item.id) === String(profileId));
                if (!found) throw new Error("Headmaster hakupatikana.");
                const foundSchool = (schoolsResponse?.data?.schools || []).find((item) => Number(item.id) === Number(found.school_id));
                if (active) { setHeadmaster(found); setSchool(foundSchool || null); setEmail(found.email || ""); setError(""); }
            } catch (requestError) {
                if (active) setError(requestError?.response?.data?.message || requestError?.message || "Imeshindikana kupakia taarifa za Headmaster.");
            } finally { if (active) setLoading(false); }
        };
        load();
        return () => { active = false; };
    }, [profileId]);

    const saveEmail = async () => {
        setError(""); setNotice("");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            setError("Weka email sahihi; itatumika kama username ya Headmaster.");
            return;
        }
        setSavingEmail(true);
        try {
            const response = await api.patch(`/schools/headmasters/${encodeURIComponent(profileId)}/email`, { email: email.trim() });
            const savedEmail = response?.data?.email || email.trim();
            setHeadmaster((current) => ({ ...current, email: savedEmail }));
            setEmail(savedEmail);
            setNotice(response?.data?.message || "Email ya login imehifadhiwa.");
        } catch (requestError) {
            setError(requestError?.response?.data?.message || requestError?.message || "Imeshindikana kuhifadhi email.");
        } finally { setSavingEmail(false); }
    };

    const resend = async () => {
        if (!headmaster) return;
        if (!window.confirm("Password ya sasa itabadilishwa. Password mpya itatumwa kwa SMS. Username (email) itabaki ileile. Unaendelea?")) return;
        setResending(true); setError(""); setNotice("");
        try {
            const response = await api.post(`/schools/headmasters/${encodeURIComponent(profileId)}/resend-credentials`);
            setNotice(response?.data?.message || "Credentials zimetumwa kwa SMS.");
        } catch (requestError) {
            setError(requestError?.response?.data?.message || requestError?.message || "Imeshindikana kutuma credentials.");
        } finally { setResending(false); }
    };

    if (loading) return <main className="p-6">Inapakia taarifa za Headmaster...</main>;
    if (!headmaster) return <main className="space-y-4 p-6"><p>{error || "Headmaster hakupatikana."}</p><button onClick={() => navigate("/school-management")} className="rounded-lg bg-slate-800 px-4 py-2 text-white">Rudi</button></main>;

    return (
        <main className="mx-auto max-w-4xl space-y-5 p-4">
            <button onClick={() => navigate(school ? `/school-management/${school.id}` : "/school-management")} className="rounded-lg border px-4 py-2 text-sm font-semibold">← Rudi</button>
            <section className="rounded-2xl bg-slate-950 p-6 text-white">
                <p className="text-xs font-semibold text-blue-200">SUPER ADMIN • HEADMASTER PROFILE</p>
                <h1 className="mt-2 text-2xl font-bold">{headmaster.full_name}</h1>
                <p className="mt-1 text-sm text-slate-300">{school?.school_name || "Shule haijulikani"}</p>
            </section>
            {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
            {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">{notice}</div>}
            <section className="rounded-xl border bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold">Taarifa za akaunti</h2>
                <dl className="grid gap-4 sm:grid-cols-2">
                    <div><dt className="text-xs text-slate-500">Jina</dt><dd className="font-semibold">{headmaster.full_name}</dd></div>
                    <div className="sm:col-span-2">
                        <dt className="text-xs text-slate-500">Username / Login Email</dt>
                        <dd className="mt-1 flex flex-col gap-2 sm:flex-row">
                            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="headmaster@school.ac.tz" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                            <button type="button" onClick={saveEmail} disabled={savingEmail || !email.trim()} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{savingEmail ? "Inahifadhi..." : "Save Email"}</button>
                        </dd>
                    </div>
                    <div><dt className="text-xs text-slate-500">Namba ya simu ya SMS</dt><dd className="font-semibold">{headmaster.phone || "Haijawekwa"}</dd></div>
                    <div><dt className="text-xs text-slate-500">Shule</dt><dd className="font-semibold">{school?.school_name || "-"}</dd></div>
                </dl>
            </section>
            <section className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold">Login Credentials</h2>
                <p className="mt-1 text-sm text-slate-600">Ikiwa Headmaster hakupokea SMS ya kwanza, unaweza kutuma credentials tena. Mfumo utabadilisha password ya akaunti hiyo hiyo na kutuma password mpya.</p>
                <button onClick={resend} disabled={resending || !headmaster.email || !headmaster.phone || !headmaster.school_id} className="mt-4 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{resending ? "Inatuma..." : "Resend Credentials"}</button>
                {(!headmaster.email || !headmaster.phone) && <p className="mt-2 text-xs text-amber-700">Email na namba ya simu lazima viwekwe kwanza kwenye akaunti hii.</p>}
            </section>
        </main>
    );
}
