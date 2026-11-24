import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    AlertCircle, Camera, CheckCircle2, Globe,
    Megaphone, MessageCircle, Plus, RefreshCw, Send, ShieldCheck,
    X
} from "lucide-react";
import api from "../../services/api";
import { useSchool } from "../../context/SchoolContext";

const PLATFORM_META = {
    facebook: { label: "Facebook", description: "Publish posts to the school's official Facebook Page.", icon: Globe },
    instagram: { label: "Instagram", description: "Publish photos and videos to the school's professional Instagram account.", icon: Camera },
    whatsapp: { label: "WhatsApp", description: "Send approved campaign messages to opted-in parents and guardians.", icon: MessageCircle }
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

    const togglePlatform = (platform) => {
        setForm((current) => ({
            ...current,
            platforms: current.platforms.includes(platform)
                ? current.platforms.filter((item) => item !== platform)
                : [...current.platforms, platform]
        }));
    };

    const saveCampaign = async (event) => {
        event.preventDefault();
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
                    <p className="text-sm text-slate-500">Scheduled</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{campaigns.filter((item) => item.status === "scheduled").length}</p>
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
                        const Icon = item.icon;
                        const accounts = platforms.find((platform) => platform.platform === key)?.accounts || [];
                        const connected = accounts.filter((account) => account.connection_status === "connected");
                        return (
                            <div key={key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-xl bg-slate-100 p-3 text-slate-700"><Icon size={22} /></div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-bold text-slate-900">{item.label}</h3>
                                        <p className="text-xs text-slate-500">{connected.length ? connected[0].account_name || connected[0].external_account_id : "Not connected"}</p>
                                    </div>
                                    {connected.length ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Connected</span> : <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Setup required</span>}
                                </div>
                                <p className="mt-4 min-h-10 text-sm text-slate-600">{item.description}</p>
                                <p className="mt-3 text-xs text-slate-500">{connected.length ? "Account credentials are stored securely by the backend." : "Official Meta account authorization will be required before publishing."}</p>
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
                            <label className="block text-sm font-medium text-slate-700">Message<textarea required rows={5} maxLength={5000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="Write the school's announcement..." /></label>
                            <div>
                                <p className="mb-2 text-sm font-medium text-slate-700">Publish on</p>
                                <div className="grid gap-2 sm:grid-cols-3">
                                    {Object.entries(PLATFORM_META).map(([key, item]) => <label key={key} className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm"><input type="checkbox" checked={form.platforms.includes(key)} onChange={() => togglePlatform(key)} />{item.label}</label>)}
                                </div>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="block text-sm font-medium text-slate-700">WhatsApp audience<select value={form.audience_type} onChange={(e) => setForm({ ...form, audience_type: e.target.value, target_class_id: "" })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"><option value="all_school">Whole school</option><option value="class">Selected class / form</option></select></label>
                                {form.audience_type === "class" && <label className="block text-sm font-medium text-slate-700">Class<select required value={form.target_class_id} onChange={(e) => setForm({ ...form, target_class_id: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"><option value="">Choose class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.class_name}{item.academic_level ? ` · ${item.academic_level}` : ""}</option>)}</select></label>}
                            </div>
                            <label className="block text-sm font-medium text-slate-700">Schedule (optional)<input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
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
