import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../services/api";

const money = (value, currency = "TZS") => {
    if (value === null || value === undefined) return "Not available";
    return new Intl.NumberFormat("en-TZ", {
        style: "currency",
        currency,
        maximumFractionDigits: currency === "TZS" ? 0 : 4,
    }).format(Number(value) || 0);
};
const number = (value) => new Intl.NumberFormat("en-TZ").format(Number(value) || 0);

function Metric({ label, value, hint }) {
    return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>;
}

export default function AIUsageMonitoring() {
    const [year, setYear] = useState(new Date().getFullYear());
    const [schools, setSchools] = useState([]);
    const [selectedSchoolId, setSelectedSchoolId] = useState("");
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [policy, setPolicy] = useState({
        is_enabled: true,
        annual_upload_limit: 10,
        exams_per_upload_limit: 20,
        admin_note: "",
    });

    const loadOverview = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const { data } = await api.get("/ai-usage/overview", { params: { year } });
            setSchools(Array.isArray(data?.schools) ? data.schools : []);
        } catch (e) {
            setError(e?.response?.data?.message || e.message || "Failed to load AI usage data.");
        } finally {
            setLoading(false);
        }
    }, [year]);

    const loadDetail = useCallback(async (schoolId) => {
        if (!schoolId) { setDetail(null); return; }
        try {
            const { data } = await api.get(`/ai-usage/schools/${schoolId}`, { params: { year } });
            setDetail(data?.detail || null);
            const p = data?.detail?.policy || {};
            setPolicy({
                is_enabled: p.is_enabled !== false,
                annual_upload_limit: Number(p.annual_upload_limit ?? 10),
                exams_per_upload_limit: Number(p.exams_per_upload_limit ?? 20),
                admin_note: p.admin_note || "",
            });
        } catch (e) {
            setError(e?.response?.data?.message || e.message || "Failed to load school details.");
        }
    }, [year]);

    useEffect(() => { loadOverview(); }, [loadOverview]);
    useEffect(() => { loadDetail(selectedSchoolId); }, [selectedSchoolId, loadDetail]);

    const totals = useMemo(() => schools.reduce((sum, s) => ({
        uploads: sum.uploads + Number(s.uploads_used || 0),
        exams: sum.exams + Number(s.exams_used || 0),
        tokens: sum.tokens + Number(s.total_tokens || 0),
        costUsd: sum.costUsd + Number(s.estimated_cost_usd || 0),
    }), { uploads: 0, exams: 0, tokens: 0, costUsd: 0 }), [schools]);

    const savePolicy = async () => {
        if (!selectedSchoolId) return;
        setSaving(true); setError(""); setNotice("");
        try {
            await api.put(`/ai-usage/schools/${selectedSchoolId}/policy`, {
                ...policy,
                annual_upload_limit: Number(policy.annual_upload_limit),
                exams_per_upload_limit: Number(policy.exams_per_upload_limit),
            });
            setNotice("AI usage agreement updated successfully.");
            await loadOverview();
            await loadDetail(selectedSchoolId);
        } catch (e) {
            setError(e?.response?.data?.message || e.message || "Unable to save AI usage policy.");
        } finally {
            setSaving(false);
        }
    };

    const selectedSchool = schools.find(s => String(s.school_id) === String(selectedSchoolId));

    return <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <p className="text-sm font-semibold text-blue-700">SUPER ADMIN / SYSTEM CONTROLS</p>
                <h1 className="mt-1 text-2xl font-bold text-slate-900">AI Usage Monitoring & Control</h1>
                <p className="mt-1 text-sm text-slate-600">Monitor Gemini usage, token costs and each school's annual AI upload agreement.</p>
            </div>
            <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-600" htmlFor="ai-usage-year">Usage year</label>
                <select id="ai-usage-year" value={year} onChange={e => setYear(Number(e.target.value))} className="rounded-lg border border-slate-300 bg-white px-3 py-2">
                    {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <button onClick={loadOverview} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Refresh</button>
            </div>
        </div>

        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Schools monitored" value={number(schools.length)} />
            <Metric label="Annual uploads used" value={number(totals.uploads)} hint={`Across all schools in ${year}`} />
            <Metric label="Examination papers" value={number(totals.exams)} hint="Papers submitted for AI analysis" />
            <Metric label="Estimated Gemini cost" value={money(totals.costUsd, "USD")} hint="Based on recorded token usage" />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
                <h2 className="font-bold text-slate-900">School AI Usage</h2>
                <p className="mt-1 text-xs text-slate-500">Default agreement: 10 uploads per calendar year × 20 examination papers per upload.</p>
            </div>
            {loading ? <div className="p-8 text-center text-sm text-slate-500">Loading school usage...</div> : (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                            <tr>
                                <th className="px-4 py-3">School</th><th className="px-4 py-3">Uploads</th><th className="px-4 py-3">Exams</th><th className="px-4 py-3">Tokens</th><th className="px-4 py-3">Cost USD</th><th className="px-4 py-3">Cost TZS</th><th className="px-4 py-3">AI Status</th><th className="px-4 py-3">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {schools.map(s => <tr key={s.school_id} className={String(selectedSchoolId) === String(s.school_id) ? "bg-blue-50/60" : ""}>
                                <td className="px-4 py-3 font-semibold text-slate-900">{s.school_name}<div className="text-xs font-normal text-slate-500">ID: {s.school_id}</div></td>
                                <td className="px-4 py-3 tabular-nums">{number(s.uploads_used)} / {number(s.annual_upload_limit)}<div className="text-xs text-slate-500">{number(s.uploads_remaining)} remaining</div></td>
                                <td className="px-4 py-3 tabular-nums">{number(s.exams_used)} / {number(Number(s.annual_upload_limit) * Number(s.exams_per_upload_limit))}</td>
                                <td className="px-4 py-3 tabular-nums">{number(s.total_tokens)}</td>
                                <td className="px-4 py-3 tabular-nums">{money(s.estimated_cost_usd, "USD")}</td>
                                <td className="px-4 py-3 tabular-nums">{money(s.estimated_cost_tzs)}</td>
                                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${s.ai_enabled ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{s.ai_enabled ? "Enabled" : "Blocked"}</span>{s.unpriced_analyses > 0 && <div className="mt-1 text-xs text-amber-700">{s.unpriced_analyses} unpriced</div>}</td>
                                <td className="px-4 py-3"><button onClick={() => setSelectedSchoolId(String(s.school_id))} className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50">Manage</button></td>
                            </tr>)}
                            {!schools.length && <tr><td colSpan="8" className="px-4 py-10 text-center text-slate-500">No schools found.</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}
        </div>

        {detail && selectedSchool && <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div><h2 className="text-lg font-bold text-slate-900">{detail.school?.name || selectedSchool.school_name}</h2><p className="text-sm text-slate-500">AI activity details for {year}</p></div>
                    <button onClick={() => setSelectedSchoolId("")} className="text-sm font-semibold text-slate-500 hover:text-slate-900">Close</button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Metric label="Uploads used" value={number(detail.usage?.uploads_used)} />
                    <Metric label="Papers" value={number(detail.usage?.exams_used)} />
                    <Metric label="Monthly records" value={number(detail.monthly?.length)} />
                    <Metric label="Remaining" value={number(Math.max(0, Number(policy.annual_upload_limit) - Number(detail.usage?.uploads_used || 0)))} />
                </div>
                <h3 className="mt-6 font-semibold text-slate-900">Upload batches</h3>
                <div className="mt-2 overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-2">Exam ID</th><th className="p-2">Papers</th><th className="p-2">Completed</th><th className="p-2">Failed</th><th className="p-2">Last activity</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">{(detail.batches || []).map(b => <tr key={b.exam_id}><td className="p-2">{b.exam_id}</td><td className="p-2">{b.papers_used}</td><td className="p-2">{b.completed}</td><td className="p-2">{b.failed}</td><td className="p-2">{b.last_upload_at ? new Date(b.last_upload_at).toLocaleString() : "—"}</td></tr>)}{!detail.batches?.length && <tr><td colSpan="5" className="p-4 text-center text-slate-500">No upload batches recorded for this year.</td></tr>}</tbody>
                    </table>
                </div>
                <h3 className="mt-6 font-semibold text-slate-900">Recent Gemini analyses</h3>
                <div className="mt-2 overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-2">Date</th><th className="p-2">Exam / Paper</th><th className="p-2">Model</th><th className="p-2">Tokens</th><th className="p-2">Cost USD</th><th className="p-2">Pricing</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">{(detail.recent || []).map(r => <tr key={r.id}><td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td><td className="p-2">{r.exam_id} / {r.exam_paper_id}</td><td className="p-2">{r.model}</td><td className="p-2">{number(r.total_tokens)}</td><td className="p-2">{money(r.estimated_cost_usd, "USD")}</td><td className="p-2">{r.pricing_status}</td></tr>)}{!detail.recent?.length && <tr><td colSpan="6" className="p-4 text-center text-slate-500">No Gemini logs for this year.</td></tr>}</tbody>
                    </table>
                </div>
            </section>

            <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">School AI Agreement</h2>
                <p className="mt-1 text-xs text-slate-500">Changes take effect immediately for new AI requests. Existing completed analyses are not deleted.</p>
                <label className="mt-5 flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><span className="text-sm font-semibold text-slate-800">Allow AI Analysis</span><input type="checkbox" checked={policy.is_enabled} onChange={e => setPolicy(p => ({ ...p, is_enabled: e.target.checked }))} className="h-5 w-5 accent-blue-600" /></label>
                <label className="mt-4 block text-sm font-semibold text-slate-700">Maximum uploads per year</label>
                <input type="number" min="0" max="10000" value={policy.annual_upload_limit} onChange={e => setPolicy(p => ({ ...p, annual_upload_limit: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                <label className="mt-4 block text-sm font-semibold text-slate-700">Maximum examination papers per upload</label>
                <input type="number" min="0" max="1000" value={policy.exams_per_upload_limit} onChange={e => setPolicy(p => ({ ...p, exams_per_upload_limit: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                <label className="mt-4 block text-sm font-semibold text-slate-700">Admin note / agreement reference</label>
                <textarea rows="3" value={policy.admin_note} onChange={e => setPolicy(p => ({ ...p, admin_note: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Optional contract or admin note" />
                <div className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-900"><strong>Annual capacity:</strong> {number(Number(policy.annual_upload_limit) * Number(policy.exams_per_upload_limit))} examination papers.</div>
                <button disabled={saving} onClick={savePolicy} className="mt-5 w-full rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">{saving ? "Saving..." : "Save AI Agreement"}</button>
            </aside>
        </div>}
    </div>;
}
