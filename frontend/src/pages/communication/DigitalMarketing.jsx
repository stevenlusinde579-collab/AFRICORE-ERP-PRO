import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    AlertCircle, CheckCircle2, Copy, Eye, Megaphone, Plus, RefreshCw, Send, ShieldCheck, X
} from "lucide-react";
import api from "../../services/api";
import { useSchool } from "../../context/SchoolContext";

const PLATFORM_META = {
    facebook: {
        label: "Facebook",
        description: "Open Facebook and sign in or create the school's account.",
        url: "https://www.facebook.com/"
    },
    instagram: {
        label: "Instagram",
        description: "Open Instagram and sign in or create the school's account.",
        url: "https://www.instagram.com/"
    },
    whatsapp: {
        label: "WhatsApp",
        description: "Open WhatsApp Web and link the school's WhatsApp account.",
        url: "https://web.whatsapp.com/"
    }
};

// Inline brand marks keep the official platform identities visible without
// relying on generic interface icons or a third-party icon package.
const PlatformLogo = ({ platform, size = 24 }) => {
    if (platform === "facebook") {
        return <svg aria-hidden="true" viewBox="0 0 32 32" width={size} height={size}>
            <circle cx="16" cy="16" r="16" fill="#1877F2" />
            <path fill="#fff" d="M18.1 27V17.4h3.2l.5-3.8h-3.7v-2.4c0-1.1.3-1.8 1.9-1.8H22V6a21 21 0 0 0-2.9-.2c-2.9 0-4.9 1.8-4.9 5.1v2.8H11v3.8h3.2V27z" />
        </svg>;
    }
    if (platform === "instagram") {
        return <svg aria-hidden="true" viewBox="0 0 32 32" width={size} height={size}>
            <defs><linearGradient id="instagram-brand-gradient" x1="4" y1="29" x2="28" y2="3" gradientUnits="userSpaceOnUse"><stop stopColor="#FFDC80"/><stop offset=".32" stopColor="#F77737"/><stop offset=".62" stopColor="#E1306C"/><stop offset="1" stopColor="#833AB4"/></linearGradient></defs>
            <rect x="2" y="2" width="28" height="28" rx="8" fill="url(#instagram-brand-gradient)" />
            <rect x="8" y="8" width="16" height="16" rx="5" fill="none" stroke="#fff" strokeWidth="2.2"/>
            <circle cx="16" cy="16" r="3.8" fill="none" stroke="#fff" strokeWidth="2.2"/>
            <circle cx="22" cy="10" r="1.4" fill="#fff"/>
        </svg>;
    }
    return <svg aria-hidden="true" viewBox="0 0 32 32" width={size} height={size}>
        <circle cx="16" cy="16" r="16" fill="#25D366"/>
        <path fill="#fff" d="M8.1 24.2 9.3 20a10 10 0 1 1 3.7 3.1zm5.1-3.2.6.3a7.7 7.7 0 1 0-2.3-2l.4.6-.7 2.3z"/>
        <path fill="#25D366" d="M13.1 11.8c-.2-.5-.5-.5-.8-.5h-.7c-.2 0-.6.1-.9.4-.3.3-1.1 1.1-1.1 2.6s1.1 3 1.3 3.2c.2.2 2.1 3.3 5.2 4.5 2.6 1 3.1.8 3.7.8.6-.1 1.9-.8 2.2-1.5.3-.7.3-1.3.2-1.5-.1-.1-.3-.2-.7-.4l-2.1-1c-.3-.1-.5-.2-.7.2-.2.3-.8 1-1-1.2-.2.2-.4.2-.7.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.7z"/>
    </svg>;
};

const DigitalMarketing = () => {
    const { schoolName } = useSchool();
    const [schools, setSchools] = useState([]);
    const [selectedSchoolId, setSelectedSchoolId] = useState("");
    const [platforms, setPlatforms] = useState([]);
    const [classes, setClasses] = useState([]);
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [showComposer, setShowComposer] = useState(false);
    const [copyNotice, setCopyNotice] = useState("");
    const [form, setForm] = useState({
        title: "", message: "", platforms: ["facebook", "instagram", "whatsapp"],
        audience_type: "all_school", target_class_id: "", scheduled_at: ""
    });

    const loadSchools = useCallback(async () => {
        setError("");
        try {
            const response = await api.get("/marketing/schools");
            const availableSchools = response.data?.schools || [];
            setSchools(availableSchools);
            setSelectedSchoolId((current) => {
                if (current && availableSchools.some((school) => String(school.id) === String(current))) return current;
                return availableSchools[0]?.id ? String(availableSchools[0].id) : "";
            });
        } catch (err) {
            setError(err?.response?.data?.message || "Imeshindikana kupata shule zinazopatikana.");
        }
    }, []);

    const loadModule = useCallback(async () => {
        if (!selectedSchoolId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setError("");
        try {
            const params = { school_id: selectedSchoolId };
            const [statusResponse, audienceResponse, campaignResponse] = await Promise.all([
                api.get("/marketing/status", { params }),
                api.get("/marketing/audiences", { params }),
                api.get("/marketing/campaigns", { params })
            ]);
            setPlatforms(statusResponse.data?.platforms || []);
            setClasses(audienceResponse.data?.classes || []);
            setCampaigns(campaignResponse.data?.campaigns || []);
        } catch (err) {
            setError(err?.response?.data?.message || "Imeshindikana kupakia taarifa za Digital Marketing.");
        } finally {
            setLoading(false);
        }
    }, [selectedSchoolId]);

    useEffect(() => { loadSchools(); }, [loadSchools]);
    useEffect(() => { if (selectedSchoolId) loadModule(); }, [selectedSchoolId, loadModule]);

    const connectedCount = useMemo(
        () => platforms.filter((item) => (item.accounts || []).some((account) => account.connection_status === "connected")).length,
        [platforms]
    );
    const scheduledCount = useMemo(
        () => campaigns.filter((item) => item.scheduled_at && item.status !== "published").length,
        [campaigns]
    );

    const togglePlatform = (platform) => {
        setForm((current) => ({
            ...current,
            platforms: current.platforms.includes(platform)
                ? current.platforms.filter((item) => item !== platform)
                : [...current.platforms, platform]
        }));
    };

    const copyCampaignMessage = async () => {
        try {
            await navigator.clipboard.writeText(form.message || "");
            setCopyNotice("Ujumbe umenakiliwa. Unaweza kuubandika kwenye jukwaa husika.");
        } catch {
            setCopyNotice("Imeshindikana kunakili ujumbe. Tafadhali nakili maandishi mwenyewe.");
        }
    };

    const saveCampaign = async (event) => {
        event.preventDefault();
        if (form.scheduled_at && new Date(form.scheduled_at).getTime() <= Date.now()) {
            setError("Muda wa kupanga kampeni lazima uwe wa baadaye.");
            return;
        }
        setSaving(true);
        setError("");
        setNotice("");
        try {
            const payload = {
                ...form,
                school_id: Number(selectedSchoolId),
                target_class_id: form.audience_type === "class" ? Number(form.target_class_id) : null,
                scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null
            };
            const response = await api.post("/marketing/campaigns", payload);
            setCampaigns((current) => [response.data.campaign, ...current]);
            setNotice(form.scheduled_at ? "Rasimu imehifadhiwa pamoja na tarehe uliyopanga. Uchapishaji wa moja kwa moja utawezeshwa baada ya kuunganishwa kwa akaunti na scheduler." : "Rasimu ya kampeni imehifadhiwa. Haijatumwa wala kuchapishwa.");
            setShowComposer(false);
            setForm({ title: "", message: "", platforms: ["facebook", "instagram", "whatsapp"], audience_type: "all_school", target_class_id: "", scheduled_at: "" });
        } catch (err) {
            setError(err?.response?.data?.message || "Imeshindikana kuhifadhi kampeni.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-indigo-600">
                        <Megaphone size={18} /> SCHOOL DIGITAL COMMUNICATION
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Digital Marketing &amp; Publicity</h1>
                    <p className="mt-1 text-sm text-slate-500">{schools.find((school) => String(school.id) === String(selectedSchoolId))?.school_name || schoolName || "School"} · Manage campaigns across social platforms.</p>
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={() => { loadSchools(); if (selectedSchoolId) loadModule(); }} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                        <RefreshCw size={16} /> Refresh
                    </button>
                    <button type="button" onClick={() => { setError(""); setNotice(""); setShowComposer(true); }} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
                        <Plus size={17} /> Create Campaign
                    </button>
                </div>
            </div>

            {schools.length > 1 && (
                <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <label className="block text-sm font-semibold text-slate-700">
                        School workspace
                        <select value={selectedSchoolId} onChange={(event) => setSelectedSchoolId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5">
                            {schools.map((school) => <option key={school.id} value={school.id}>{school.school_name}{school.is_active === false ? " (Inactive)" : ""}</option>)}
                        </select>
                    </label>
                </div>
            )}
            {!selectedSchoolId && !loading && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    Hakuna shule iliyochaguliwa au akaunti yako haijaunganishwa na shule. Tafadhali wasiliana na msimamizi.
                </div>
            )}

            {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={18} className="mt-0.5 shrink-0" />{error}</div>}
            {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"><CheckCircle2 size={18} />{notice}</div>}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm text-slate-500">Connected platforms</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{connectedCount}/3</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm text-slate-500">Total campaigns</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{campaigns.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm text-slate-500">Scheduled drafts</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{scheduledCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm text-slate-500">Published</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{campaigns.filter((item) => item.status === "published").length}</p>
                </div>
            </div>

            <section className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900">Connected platforms</h2>
                    <span className="text-xs text-slate-500">Each school connects its own accounts</span>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                    {Object.entries(PLATFORM_META).map(([key, item]) => {
                        const accounts = platforms.find((platform) => platform.platform === key)?.accounts || [];
                        const connected = accounts.filter((account) => account.connection_status === "connected");
                        return (
                            <div key={key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={`Open ${item.label}`}
                                        title={`Open ${item.label}`}
                                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 ring-1 ring-slate-100 transition hover:scale-105 hover:ring-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <PlatformLogo platform={key} size={30} />
                                    </a>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-bold text-slate-900">{item.label}</h3>
                                        <p className="text-xs text-slate-500">{connected.length ? connected[0].account_name || connected[0].external_account_id : "No account connected yet"}</p>
                                    </div>
                                    {connected.length ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Linked</span> : <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Open account</span>}
                                </div>
                                <p className="mt-4 min-h-10 text-sm text-slate-600">{item.description}</p>
                                <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-4 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                                >
                                    Open {item.label}
                                </a>
                                <p className="mt-3 text-xs text-slate-500">Sign in on the official platform. AfriCore does not ask for or store your social-media password.</p>
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 p-5">
                    <div>
                        <h2 className="font-bold text-slate-900">Campaign history</h2>
                        <p className="text-xs text-slate-500">Drafts and scheduled campaigns for this school</p>
                    </div>
                    <Megaphone className="text-slate-400" size={20} />
                </div>
                {loading ? <div className="p-8 text-center text-sm text-slate-500">Loading campaigns...</div> : campaigns.length === 0 ? (
                    <div className="p-10 text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><Send size={22} /></div>
                        <p className="font-semibold text-slate-800">No campaigns yet</p>
                        <p className="mt-1 text-sm text-slate-500">Create a campaign to prepare your first school announcement.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {campaigns.map((campaign) => (
                            <div key={campaign.id} className="flex flex-wrap items-center gap-4 p-5">
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-slate-900">{campaign.title}</p>
                                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">{campaign.message}</p>
                                    <p className="mt-2 text-xs text-slate-400">{(campaign.platforms || []).join(" · ")} · {campaign.audience_type === "class" ? "Selected class" : "Whole school"}</p>
                                </div>
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">{campaign.status}</span>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {showComposer && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
                    <div role="dialog" aria-modal="true" aria-labelledby="marketing-composer-title" className="my-6 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-100 p-5">
                            <div><h2 id="marketing-composer-title" className="text-lg font-bold text-slate-900">Create school campaign</h2><p className="text-xs text-slate-500">Prepare one message for the selected platforms.</p></div>
                            <button type="button" onClick={() => setShowComposer(false)} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={19} /></button>
                        </div>
                        <form onSubmit={saveCampaign} className="space-y-4 p-5">
                            <label className="block text-sm font-medium text-slate-700">Campaign title<input required maxLength={160} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="e.g. Admission Open 2027" /></label>
                            <label className="block text-sm font-medium text-slate-700">
                                Message
                                <textarea required rows={5} maxLength={5000} value={form.message} onChange={(e) => { setForm({ ...form, message: e.target.value }); setCopyNotice(""); }} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="Write the school's announcement..." />
                                <span className="mt-1 flex items-center justify-between text-xs font-normal text-slate-500">
                                    <span>Maximum 5,000 characters</span>
                                    <span>{form.message.length}/5,000</span>
                                </span>
                            </label>
                            <section className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4" aria-label="Campaign preview">
                                <div className="mb-3 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-indigo-900"><Eye size={16} /> Preview ya tangazo</div>
                                    <button type="button" onClick={copyCampaignMessage} disabled={!form.message.trim()} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"><Copy size={14} /> Copy message</button>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white p-4">
                                    <p className="font-semibold text-slate-900">{form.title || "Kichwa cha tangazo kitaonekana hapa"}</p>
                                    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">{form.message || "Ujumbe wa tangazo utaonekana hapa unapouandika."}</p>
                                    <p className="mt-3 text-xs text-slate-400">{schools.find((school) => String(school.id) === String(selectedSchoolId))?.school_name || schoolName || "School"}</p>
                                </div>
                                <p className="mt-2 text-xs text-indigo-800">Huu ni mwonekano wa jumla wa maandishi; kila jukwaa linaweza kuonyesha tangazo kwa mpangilio tofauti.</p>
                                {copyNotice && <p role="status" className="mt-2 text-xs text-indigo-800">{copyNotice}</p>}
                            </section>
                            <div>
                                <p className="mb-2 text-sm font-medium text-slate-700">Publish on</p>
                                <div className="grid gap-2 sm:grid-cols-3">
                                    {Object.entries(PLATFORM_META).map(([key, item]) => <label key={key} className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm"><input type="checkbox" checked={form.platforms.includes(key)} onChange={() => togglePlatform(key)} /><PlatformLogo platform={key} size={22} /><span>{item.label}</span></label>)}
                                </div>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="block text-sm font-medium text-slate-700">WhatsApp audience<select value={form.audience_type} onChange={(e) => setForm({ ...form, audience_type: e.target.value, target_class_id: "" })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"><option value="all_school">Whole school</option><option value="class">Selected class / form</option></select></label>
                                {form.audience_type === "class" && <label className="block text-sm font-medium text-slate-700">Class<select required value={form.target_class_id} onChange={(e) => setForm({ ...form, target_class_id: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"><option value="">Choose class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.class_name}{item.academic_level ? ` · ${item.academic_level}` : ""}</option>)}</select></label>}
                            </div>
                            <label className="block text-sm font-medium text-slate-700">
                                Schedule (optional)
                                <input type="datetime-local" min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
                                <span className="mt-1 block text-xs font-normal text-slate-500">Muda unaotumia hapa ni muda wa eneo la shule. Kampeni itahifadhiwa kama rasimu; haitachapishwa moja kwa moja mpaka huduma rasmi ya uchapishaji iwekwe.</span>
                            </label>
                            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800"><ShieldCheck size={17} /> Saving a campaign does not send it. WhatsApp will only target guardians with recorded opt-in consent; publishing is enabled after official platform accounts are connected.</div>
                            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setShowComposer(false)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button><button type="submit" disabled={saving || !form.platforms.length} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving..." : "Save campaign"}</button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DigitalMarketing;
