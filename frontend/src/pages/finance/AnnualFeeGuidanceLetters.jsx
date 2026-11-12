import React, { useEffect, useMemo, useState } from "react";
import { FaFileInvoiceDollar, FaPlus, FaPrint, FaSave, FaTrash } from "react-icons/fa";
import { supabase } from "../../services/supabase";

const money = value => new Intl.NumberFormat("en-TZ", { maximumFractionDigits: 2 }).format(Number(value || 0));
const blankItem = () => ({ id: `item-${Date.now()}-${Math.random().toString(36).slice(2)}`, name: "", category: "Ada", classId: "", term1: "0", term2: "0", term3: "0" });
const DEFAULT_MESSAGE = "Tunapenda kuwashukuru kwa ushirikiano wenu mzuri katika kipindi chote cha mwaka wa masomo unaomalizika. Ushirikiano wenu umechangia kwa kiasi kikubwa maendeleo ya wanafunzi na shughuli za shule. Tunawaomba mpokee mwongozo huu wa maandalizi ya ada na michango kwa mwaka mpya wa masomo ili muweze kupanga malipo mapema.";

export default function AnnualFeeGuidanceLetters({ school }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [schoolId, setSchoolId] = useState(null);
    const [years, setYears] = useState([]);
    const [classes, setClasses] = useState([]);
    const [students, setStudents] = useState([]);
    const [yearId, setYearId] = useState("");
    const [classId, setClassId] = useState("");
    const [selectedStudents, setSelectedStudents] = useState([]);
    const [items, setItems] = useState([blankItem()]);
    const [closingDate, setClosingDate] = useState("");
    const [reopeningDate, setReopeningDate] = useState("");
    const [intro, setIntro] = useState(DEFAULT_MESSAGE);
    const [extraMessage, setExtraMessage] = useState("Tafadhali zingatieni ratiba ya malipo ya kila muhula kama ilivyooneshwa. Kwa ufafanuzi zaidi, wasiliana na ofisi ya uhasibu ya shule.");
    const [accountantName, setAccountantName] = useState("");
    const [accountantPhone, setAccountantPhone] = useState("");
    const [loadedSetupId, setLoadedSetupId] = useState(null);

    useEffect(() => {
        if (!open) return;
        let active = true;
        (async () => {
            setLoading(true);
            setError("");
            try {
                const { data: { user }, error: authError } = await supabase.auth.getUser();
                if (authError) throw authError;
                if (!user?.id) throw new Error("Tafadhali ingia tena kwenye mfumo.");
                const { data: profile, error: profileError } = await supabase.from("profiles").select("school_id,full_name").eq("id", user.id).single();
                if (profileError) throw profileError;
                if (!profile?.school_id) throw new Error("Akaunti hii haijaunganishwa na shule.");
                const sid = Number(profile.school_id);
                const [yearResult, classResult, studentResult] = await Promise.all([
                    supabase.from("academic_years").select("id,school_id,year_name,is_active").eq("school_id", sid).order("year_name", { ascending: false }),
                    supabase.from("classes").select("id,school_id,class_name,academic_year_id,is_active").eq("school_id", sid).order("class_name"),
                    supabase.from("students").select("id,school_id,admission_number,admission_no,first_name,middle_name,last_name,current_class_id,academic_year_id,student_status,guardian_name,parent_name").eq("school_id", sid).order("first_name")
                ]);
                if (yearResult.error) throw yearResult.error;
                if (classResult.error) throw classResult.error;
                if (studentResult.error) throw studentResult.error;
                if (!active) return;
                setSchoolId(sid);
                setAccountantName(profile.full_name || "");
                setYears(yearResult.data || []);
                setClasses(classResult.data || []);
                setStudents((studentResult.data || []).filter(s => !s.student_status || !["left", "withdrawn", "transferred", "inactive"].includes(String(s.student_status).toLowerCase())));
                const activeYear = (yearResult.data || []).find(y => y.is_active) || (yearResult.data || [])[0];
                if (activeYear) setYearId(String(activeYear.id));
            } catch (e) {
                if (active) setError(e?.message || "Imeshindikana kupakia taarifa za shule.");
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [open]);

    useEffect(() => {
        if (!open || !schoolId || !yearId) return;
        let active = true;
        (async () => {
            setError("");
            const { data, error: loadError } = await supabase.from("annual_fee_guidance_setups").select("*").eq("school_id", schoolId).eq("academic_year_id", Number(yearId)).maybeSingle();
            if (loadError) {
                if (active) setError(loadError.message);
                return;
            }
            if (!active) return;
            setLoadedSetupId(data?.id || null);
            setItems(Array.isArray(data?.items) && data.items.length ? data.items.map(item => ({ ...item, id: item.id || blankItem().id, term1: String(item.term1 ?? 0), term2: String(item.term2 ?? 0), term3: String(item.term3 ?? 0) })) : [blankItem()]);
            setClosingDate(data?.closing_date || "");
            setReopeningDate(data?.reopening_date || "");
            setIntro(data?.intro_message || DEFAULT_MESSAGE);
            setExtraMessage(data?.extra_message || "Tafadhali zingatieni ratiba ya malipo ya kila muhula kama ilivyooneshwa. Kwa ufafanuzi zaidi, wasiliana na ofisi ya uhasibu ya shule.");
            setAccountantName(data?.accountant_name || "");
            setAccountantPhone(data?.accountant_phone || "");
        })();
        return () => { active = false; };
    }, [open, schoolId, yearId]);

    const selectedYear = years.find(y => String(y.id) === String(yearId));
    const yearName = selectedYear?.year_name || "";
    const visibleStudents = useMemo(() => students.filter(s => !classId || String(s.current_class_id) === String(classId)), [students, classId]);
    const selectedRows = useMemo(() => students.filter(s => selectedStudents.includes(String(s.id))), [students, selectedStudents]);
    const validItems = items.filter(item => item.name.trim());
    const totals = useMemo(() => validItems.reduce((sum, item) => ({ term1: sum.term1 + Number(item.term1 || 0), term2: sum.term2 + Number(item.term2 || 0), term3: sum.term3 + Number(item.term3 || 0) }), { term1: 0, term2: 0, term3: 0 }), [validItems]);
    const annualTotal = totals.term1 + totals.term2 + totals.term3;

    const updateItem = (id, field, value) => setItems(current => current.map(item => item.id === id ? { ...item, [field]: value } : item));
    const toggleStudent = id => setSelectedStudents(current => current.includes(String(id)) ? current.filter(x => x !== String(id)) : [...current, String(id)]);
    const selectVisible = checked => setSelectedStudents(current => checked ? [...new Set([...current, ...visibleStudents.map(s => String(s.id))])] : current.filter(id => !visibleStudents.some(s => String(s.id) === id)));

    async function saveSetup() {
        if (!schoolId || !yearId) { setError("Chagua mwaka wa masomo kwanza."); return; }
        if (!validItems.length) { setError("Ongeza angalau ada au mchango mmoja."); return; }
        if (validItems.some(item => ![item.term1, item.term2, item.term3].every(v => Number.isFinite(Number(v)) && Number(v) >= 0))) { setError("Kiasi cha kila muhula lazima kiwe namba isiyopungua sifuri."); return; }
        setSaving(true); setError(""); setNotice("");
        try {
            const payload = {
                school_id: schoolId,
                academic_year_id: Number(yearId),
                items: validItems.map(({ id, name, category, classId: targetClass, term1, term2, term3 }) => ({ id, name: name.trim(), category, classId: targetClass || null, term1: Number(term1 || 0), term2: Number(term2 || 0), term3: Number(term3 || 0) })),
                closing_date: closingDate || null,
                reopening_date: reopeningDate || null,
                intro_message: intro,
                extra_message: extraMessage,
                accountant_name: accountantName,
                accountant_phone: accountantPhone
            };
            const { data, error: saveError } = await supabase.from("annual_fee_guidance_setups").upsert(payload, { onConflict: "school_id,academic_year_id" }).select("id").single();
            if (saveError) throw saveError;
            setLoadedSetupId(data?.id || loadedSetupId);
            setNotice("Setup imehifadhiwa. Kiasi hiki ni mwongozo wa barua pekee; hakijaingizwa kwenye madeni wala hesabu za shule.");
        } catch (e) {
            setError(e?.message || "Imeshindikana kuhifadhi setup. Hakikisha migration ya barua za mwongozo imetekelezwa.");
        } finally { setSaving(false); }
    }

    const applicableItems = student => validItems.filter(item => !item.classId || String(item.classId) === String(student.current_class_id));
    const studentTotals = student => applicableItems(student).reduce((sum, item) => ({ term1: sum.term1 + Number(item.term1 || 0), term2: sum.term2 + Number(item.term2 || 0), term3: sum.term3 + Number(item.term3 || 0) }), { term1: 0, term2: 0, term3: 0 });

    function printLetters() {
        if (!selectedRows.length) { setError("Chagua angalau mwanafunzi mmoja wa kutengenezea barua."); return; }
        if (!yearName) { setError("Mwaka wa masomo haujapatikana."); return; }
        setError("");
        document.body.classList.add("annual-guidance-printing");
        window.setTimeout(() => window.print(), 100);
    }

    useEffect(() => {
        const afterPrint = () => document.body.classList.remove("annual-guidance-printing");
        window.addEventListener("afterprint", afterPrint);
        return () => window.removeEventListener("afterprint", afterPrint);
    }, []);

    return <div className="my-5">
        <div className="annual-guidance-screen">
            <button type="button" onClick={() => setOpen(v => !v)} className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-800">
                <FaFileInvoiceDollar /> Barua za Mwongozo wa Ada za Mwaka Mpya
            </button>
            {open && <section className="mt-4 overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 bg-indigo-50 px-5 py-4">
                    <div><h2 className="text-lg font-extrabold text-slate-900">Setup ya Barua za Mwongozo wa Malipo</h2><p className="mt-1 text-xs text-slate-600">Barua za taarifa kwa wazazi tu — si deni, invoice, wala muamala wa kifedha.</p></div>
                    <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">Funga</button>
                </header>
                {loading ? <div className="p-6 text-sm text-slate-600">Inapakia taarifa za shule...</div> : <>
                    <div className="grid gap-4 p-5 md:grid-cols-3">
                        <label className="text-xs font-bold text-slate-600">Mwaka mpya wa masomo<select value={yearId} onChange={e => { setYearId(e.target.value); setSelectedStudents([]); }} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">{years.map(y => <option key={y.id} value={y.id}>{y.year_name}</option>)}</select></label>
                        <label className="text-xs font-bold text-slate-600">Tarehe ya kufunga shule<input type="date" value={closingDate} onChange={e => setClosingDate(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" /></label>
                        <label className="text-xs font-bold text-slate-600">Tarehe ya kufungua shule<input type="date" value={reopeningDate} onChange={e => setReopeningDate(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" /></label>
                    </div>
                    <div className="mx-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">Muhimu: Taarifa hizi zinahifadhiwa kwenye sehemu tofauti ya barua. Hazitengenezi deni na haziathiri Receive Payment, Payment Setup, salio la mwanafunzi au ripoti za fedha.</div>
                    <div className="p-5">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-extrabold text-slate-800">Ada na michango ya mwaka</h3><button type="button" onClick={() => setItems(v => [...v, blankItem()])} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white"><FaPlus /> Ongeza kipengee</button></div>
                        <div className="space-y-3">
                            {items.map((item, index) => <div key={item.id} className="grid gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-[1.5fr_0.8fr_1fr_0.7fr_0.7fr_0.7fr_auto] md:items-end">
                                <label className="text-[11px] font-bold text-slate-600">Jina la ada/mchango<input value={item.name} onChange={e => updateItem(item.id, "name", e.target.value)} placeholder="Mf. Ada ya shule / Mahafali Form Four" className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-2 text-sm font-normal" /></label>
                                <label className="text-[11px] font-bold text-slate-600">Aina<select value={item.category} onChange={e => updateItem(item.id, "category", e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm font-normal"><option>Ada</option><option>Mchango</option></select></label>
                                <label className="text-[11px] font-bold text-slate-600">Darasa husika<select value={item.classId} onChange={e => updateItem(item.id, "classId", e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm font-normal"><option value="">Shule nzima</option>{classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}</select></label>
                                {["term1", "term2", "term3"].map((term, i) => <label key={term} className="text-[11px] font-bold text-slate-600">Muhula {i + 1}<input type="number" min="0" step="0.01" value={item[term]} onChange={e => updateItem(item.id, term, e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-2 text-sm font-normal" /></label>)}
                                <button type="button" onClick={() => setItems(v => v.length > 1 ? v.filter(x => x.id !== item.id) : [blankItem()])} title="Ondoa kipengee" className="inline-flex h-10 items-center justify-center rounded-lg border border-red-200 px-3 text-red-600"><FaTrash /></button>
                            </div>)}
                        </div>
                        <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm md:grid-cols-4">
                            <div><p className="text-xs text-slate-500">Jumla Muhula 1</p><strong>TZS {money(totals.term1)}</strong></div><div><p className="text-xs text-slate-500">Jumla Muhula 2</p><strong>TZS {money(totals.term2)}</strong></div><div><p className="text-xs text-slate-500">Jumla Muhula 3</p><strong>TZS {money(totals.term3)}</strong></div><div><p className="text-xs text-slate-500">Jumla ya vipengee vilivyowekwa</p><strong>TZS {money(annualTotal)}</strong></div>
                        </div>
                    </div>
                    <div className="grid gap-4 px-5 pb-5 md:grid-cols-2">
                        <label className="text-xs font-bold text-slate-600">Ujumbe wa shukrani na utangulizi<textarea rows={4} value={intro} onChange={e => setIntro(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" /></label>
                        <label className="text-xs font-bold text-slate-600">Ujumbe wa mwisho / maelekezo<textarea rows={4} value={extraMessage} onChange={e => setExtraMessage(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" /></label>
                        <label className="text-xs font-bold text-slate-600">Jina la muhasibu<input value={accountantName} onChange={e => setAccountantName(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" /></label>
                        <label className="text-xs font-bold text-slate-600">Simu ya muhasibu<input value={accountantPhone} onChange={e => setAccountantPhone(e.target.value)} placeholder="07XX XXX XXX" className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" /></label>
                    </div>
                    <div className="border-t border-slate-100 px-5 py-4"><button type="button" onClick={saveSetup} disabled={saving || !yearId} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-extrabold text-white disabled:opacity-50"><FaSave /> {saving ? "Inahifadhi..." : "Hifadhi Setup ya Barua"}</button>{notice && <p className="mt-3 text-sm font-semibold text-emerald-700">{notice}</p>}</div>
                    <div className="border-t border-slate-100 p-5">
                        <h3 className="font-extrabold text-slate-800">Chagua wazazi/wanafunzi wa kupewa barua</h3>
                        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_2fr]">
                            <label className="text-xs font-bold text-slate-600">Chagua darasa (au shule nzima)<select value={classId} onChange={e => { setClassId(e.target.value); setSelectedStudents([]); }} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Shule nzima</option>{classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}</select></label>
                            <div className="rounded-xl bg-slate-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-bold text-slate-700">{selectedStudents.length} wamechaguliwa · {visibleStudents.length} wanafunzi kwenye orodha</span><button type="button" onClick={() => selectVisible(selectedStudents.length < visibleStudents.length)} className="text-xs font-bold text-indigo-700">{visibleStudents.every(s => selectedStudents.includes(String(s.id))) ? "Ondoa wote wanaoonekana" : "Chagua wote wanaoonekana"}</button></div><div className="mt-2 max-h-64 overflow-y-auto divide-y divide-slate-200">{visibleStudents.map(s => <label key={s.id} className="flex items-center gap-3 py-2 text-sm"><input type="checkbox" checked={selectedStudents.includes(String(s.id))} onChange={() => toggleStudent(s.id)} /><span className="font-semibold text-slate-800">{[s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" ")}</span><span className="text-xs text-slate-500">{s.admission_number || s.admission_no || ""}</span></label>)}</div></div>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">Kila mwanafunzi atapata barua yake binafsi. Michango ya darasa maalumu itaonekana kwa wanafunzi wa darasa hilo tu.</p><button type="button" onClick={printLetters} disabled={!selectedStudents.length || !loadedSetupId} className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-5 py-3 text-sm font-extrabold text-white disabled:opacity-50"><FaPrint /> Tengeneza / Chapisha barua {selectedStudents.length}</button></div>
                        {!loadedSetupId && <p className="mt-2 text-xs font-semibold text-amber-700">Hifadhi setup kwanza ndipo uweze kutengeneza barua.</p>}
                    </div>
                </>}
                {error && <div className="mx-5 mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            </section>}
        </div>
        <style>{`
            .annual-guidance-print-root { display:none; }
            @page { size:A4 portrait; margin:12mm; }
            @media print {
                body.annual-guidance-printing * { visibility:hidden !important; }
                body.annual-guidance-printing .annual-guidance-print-root,
                body.annual-guidance-printing .annual-guidance-print-root * { visibility:visible !important; }
                body.annual-guidance-printing .annual-guidance-screen { display:none !important; }
                body.annual-guidance-printing .annual-guidance-print-root { display:block !important; position:absolute !important; inset:0 auto auto 0 !important; width:100% !important; }
                .annual-guidance-print-page { break-after:page; page-break-after:always; color:#111 !important; font:10.5pt/1.45 Arial,sans-serif !important; }
                .annual-guidance-print-page:last-child { break-after:auto; page-break-after:auto; }
                .annual-guidance-print-page table { width:100%; border-collapse:collapse; margin:12px 0; font-size:9.5pt; }
                .annual-guidance-print-page th,.annual-guidance-print-page td { border:1px solid #333; padding:6px; text-align:left; }
                .annual-guidance-print-page .numeric { text-align:right; }
            }
        `}</style>
        <div className="annual-guidance-print-root">
            {selectedRows.map((student, index) => {
                const applicable = applicableItems(student);
                const totalsForStudent = studentTotals(student);
                const className = classes.find(c => String(c.id) === String(student.current_class_id))?.class_name || "—";
                return <article key={student.id} className="annual-guidance-print-page">
                    <header style={{ display:"flex", alignItems:"center", gap:16, borderBottom:"2px solid #111", paddingBottom:12, marginBottom:18 }}>
                        {school?.logo && <img src={school.logo} alt="" style={{ width:70, height:70, objectFit:"contain" }} />}
                        <div style={{ flex:1, textAlign:"center" }}><h1 style={{ fontSize:18, fontWeight:800, textTransform:"uppercase", margin:0 }}>{school?.school_name || "SHULE"}</h1>{school?.registration_number && <p style={{ margin:3, fontSize:10 }}>Usajili: {school.registration_number}</p>}<p style={{ margin:3, fontSize:10 }}>{[school?.address, school?.phone, school?.email].filter(Boolean).join(" · ")}</p></div>
                    </header>
                    <div style={{ display:"flex", justifyContent:"space-between", gap:12 }}><p><strong>Kumb. Na:</strong> AFR/MWONGOZO/{student.admission_number || student.admission_no || student.id}/{new Date().getFullYear()}</p><p><strong>Tarehe:</strong> {new Date().toLocaleDateString("sw-TZ",{day:"2-digit",month:"long",year:"numeric"})}</p></div>
                    <p>Kwa: <strong>{student.guardian_name || student.parent_name || "Mzazi/Mlezi"}</strong></p><p>Mzazi/Mlezi wa: <strong>{[student.first_name,student.middle_name,student.last_name].filter(Boolean).join(" ")}</strong></p><p>Darasa: <strong>{className}</strong> · Namba ya mwanafunzi: <strong>{student.admission_number || student.admission_no || "—"}</strong></p>
                    <h2 style={{ textAlign:"center", textDecoration:"underline", fontSize:13, fontWeight:800, margin:"18px 0" }}>YAH: MWONGOZO WA ADA NA MICHANGO KWA MWAKA WA MASOMO {yearName}</h2>
                    <p>Ndugu Mzazi/Mlezi,</p><p style={{ textAlign:"justify" }}>{intro}</p>
                    <p>Kwa maandalizi ya mwaka mpya wa masomo <strong>{yearName}</strong>, hapa chini ni mwongozo wa ada na michango inayomhusu mwanafunzi wako. Huu ni mpango wa taarifa kwa mzazi kwa ajili ya maandalizi ya malipo; si ankara wala uthibitisho wa deni.</p>
                    <table><thead><tr><th>Ada / Mchango</th><th>Aina</th><th className="numeric">Muhula 1 (TZS)</th><th className="numeric">Muhula 2 (TZS)</th><th className="numeric">Muhula 3 (TZS)</th><th className="numeric">Jumla (TZS)</th></tr></thead><tbody>{applicable.map(item=><tr key={item.id}><td>{item.name}</td><td>{item.category}</td><td className="numeric">{money(item.term1)}</td><td className="numeric">{money(item.term2)}</td><td className="numeric">{money(item.term3)}</td><td className="numeric">{money(Number(item.term1||0)+Number(item.term2||0)+Number(item.term3||0))}</td></tr>)}</tbody><tfoot><tr><th colSpan="2">JUMLA</th><th className="numeric">{money(totalsForStudent.term1)}</th><th className="numeric">{money(totalsForStudent.term2)}</th><th className="numeric">{money(totalsForStudent.term3)}</th><th className="numeric">{money(totalsForStudent.term1+totalsForStudent.term2+totalsForStudent.term3)}</th></tr></tfoot></table>
                    <p><strong>Jumla ya mwaka:</strong> TZS {money(totalsForStudent.term1+totalsForStudent.term2+totalsForStudent.term3)}.</p>
                    <div style={{ border:"1px solid #333", padding:10, margin:"14px 0" }}><strong>Taarifa muhimu za kalenda ya shule</strong><p style={{ margin:"6px 0" }}>Tarehe ya kufunga shule: <strong>{closingDate ? new Date(closingDate+"T00:00:00").toLocaleDateString("sw-TZ",{day:"2-digit",month:"long",year:"numeric"}) : "Itatangazwa na shule"}</strong></p><p style={{ margin:"6px 0" }}>Tarehe ya kufungua shule: <strong>{reopeningDate ? new Date(reopeningDate+"T00:00:00").toLocaleDateString("sw-TZ",{day:"2-digit",month:"long",year:"numeric"}) : "Itatangazwa na shule"}</strong></p></div>
                    <p style={{ textAlign:"justify" }}>{extraMessage}</p><p>Tunawashukuru kwa kuendelea kushirikiana nasi katika kuhakikisha mwanafunzi anapata mazingira bora ya kujifunzia.</p>
                    <p>Wako katika huduma,</p><div style={{ marginTop:35, width:250, borderTop:"1px solid #111", paddingTop:8 }}><strong>{accountantName || "Muhasibu"}</strong><p style={{ margin:3 }}>Muhasibu wa Shule</p>{accountantPhone && <p style={{ margin:3 }}>Simu: {accountantPhone}</p>}<p style={{ marginTop:15 }}>Saini: ________________________</p></div>
                    <p style={{ textAlign:"center", fontSize:9, marginTop:24 }}>Barua ya mwongozo wa maandalizi ya malipo · {index+1} / {selectedRows.length}</p>
                </article>;
            })}
        </div>
    </div>;
}
