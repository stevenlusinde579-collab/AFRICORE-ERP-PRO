import { useCallback, useEffect, useMemo, useState } from "react";
import {
    FaCheckCircle,
    FaFilePdf,
    FaPrint,
    FaRedo,
    FaSearch,
    FaSpinner,
    FaTimes,
} from "react-icons/fa";
import { supabase } from "../../services/supabase";

function ExamPrintingUnit() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [papers, setPapers] = useState([]);
    const [search, setSearch] = useState("");
    const [preview, setPreview] = useState(null);

    const loadPrintingQueue = useCallback(async (refresh = false) => {
        try {
            if (refresh) setRefreshing(true);
            else setLoading(true);
            setError("");

            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();
            if (authError) throw authError;
            if (!user?.id) throw new Error("User session not found.");

            const { data: profile, error: profileError } = await supabase
                .from("profiles")
                .select("school_id, role_id, full_name")
                .eq("id", user.id)
                .maybeSingle();
            if (profileError) throw profileError;

            if (!profile?.school_id) {
                throw new Error("Your profile is not assigned to a school.");
            }

            const { data: exams, error: examsError } = await supabase
                .from("exams")
                .select("id, school_id, exam_name, exam_type, term, start_date, end_date, status")
                .eq("school_id", profile.school_id)
                .order("created_at", { ascending: false });
            if (examsError) throw examsError;

            const examRows = exams || [];
            const examIds = examRows.map((row) => row.id);
            if (!examIds.length) {
                setPapers([]);
                return;
            }

            const { data: examSubjects, error: subjectRowsError } = await supabase
                .from("exam_subjects")
                .select("id, exam_id, subject_id, class_id, approval_status, approved_by_academic, approved_by_deputy, approved_by_headmaster, approved_at")
                .in("exam_id", examIds);
            if (subjectRowsError) throw subjectRowsError;

            const approvedSubjects = (examSubjects || []).filter((row) => {
                return (
                    String(row.approval_status || "").trim().toLowerCase() === "approved" &&
                    Boolean(row.approved_by_academic) &&
                    Boolean(row.approved_by_deputy) &&
                    Boolean(row.approved_by_headmaster)
                );
            });

            if (!approvedSubjects.length) {
                setPapers([]);
                return;
            }

            const examSubjectIds = approvedSubjects.map((row) => row.id);
            const subjectIds = [...new Set(approvedSubjects.map((row) => row.subject_id).filter(Boolean))];
            const classIds = [...new Set(approvedSubjects.map((row) => row.class_id).filter(Boolean))];

            const [{ data: paperRows, error: paperError }, { data: subjectRows, error: subjectsError }, { data: classRows, error: classesError }] = await Promise.all([
                supabase
                    .from("exam_papers")
                    .select("id, exam_id, exam_subject_id, file_name, file_url, file_type, ai_status, status, created_at")
                    .in("exam_subject_id", examSubjectIds)
                    .order("created_at", { ascending: false }),
                subjectIds.length
                    ? supabase.from("subjects").select("id, subject_name, subject_code").in("id", subjectIds)
                    : Promise.resolve({ data: [], error: null }),
                classIds.length
                    ? supabase.from("classes").select("id, class_name, short_name").in("id", classIds)
                    : Promise.resolve({ data: [], error: null }),
            ]);

            if (paperError) throw paperError;
            if (subjectsError) throw subjectsError;
            if (classesError) throw classesError;

            const examMap = new Map(examRows.map((row) => [String(row.id), row]));
            const subjectMap = new Map((subjectRows || []).map((row) => [String(row.id), row]));
            const classMap = new Map((classRows || []).map((row) => [String(row.id), row]));

            const latestByExamSubject = new Map();
            (paperRows || []).forEach((paper) => {
                const key = String(paper.exam_subject_id);
                if (!latestByExamSubject.has(key)) latestByExamSubject.set(key, paper);
            });

            const queue = approvedSubjects
                .map((examSubject) => {
                    const paper = latestByExamSubject.get(String(examSubject.id));
                    if (!paper?.file_url) return null;

                    const exam = examMap.get(String(examSubject.exam_id));
                    const subject = subjectMap.get(String(examSubject.subject_id));
                    const classRow = classMap.get(String(examSubject.class_id));

                    return {
                        ...examSubject,
                        paper,
                        exam,
                        subject,
                        classRow,
                    };
                })
                .filter(Boolean);

            setPapers(queue);
        } catch (err) {
            console.error("PRINTING UNIT ERROR:", err);
            setPapers([]);
            setError(err?.message || "Failed to load approved examination papers.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadPrintingQueue();
    }, [loadPrintingQueue]);

    const filteredPapers = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return papers;

        return papers.filter((row) => {
            const values = [
                row.exam?.exam_name,
                row.exam?.exam_type,
                row.subject?.subject_name,
                row.subject?.subject_code,
                row.classRow?.class_name,
                row.classRow?.short_name,
                row.paper?.file_name,
            ];
            return values.some((value) => String(value || "").toLowerCase().includes(query));
        });
    }, [papers, search]);

    const getClassName = (row) => row.classRow?.class_name || row.classRow?.short_name || "-";
    const getSubjectName = (row) => row.subject?.subject_name || row.subject?.subject_code || "-";

    const openPaper = async (row, shouldPreview = false) => {
        try {
            setError("");
            const { data, error: signedUrlError } = await supabase.storage
                .from("exam-papers")
                .createSignedUrl(row.paper.file_url, 60 * 30);

            if (signedUrlError) throw signedUrlError;
            if (!data?.signedUrl) throw new Error("Unable to create a secure PDF link.");

            if (shouldPreview) {
                setPreview({ ...row, signedUrl: data.signedUrl });
                return;
            }

            window.open(data.signedUrl, "_blank", "noopener,noreferrer");
        } catch (err) {
            console.error("OPEN PRINT PAPER ERROR:", err);
            setError(err?.message || "Unable to open this examination paper.");
        }
    };

    if (loading) {
        return (
            <div className="min-h-[500px] flex items-center justify-center bg-slate-50">
                <div className="flex items-center gap-3 text-slate-600">
                    <FaSpinner className="animate-spin" />
                    Loading Printing Unit...
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Examination</p>
                        <h1 className="mt-1 text-3xl font-extrabold text-slate-900">Printing Unit</h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Approved examination papers appear here only after the complete approval chain.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => loadPrintingQueue(true)}
                        disabled={refreshing}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                    >
                        <FaRedo className={refreshing ? "animate-spin" : ""} />
                        Refresh Queue
                    </button>
                </div>

                {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Approved Papers</p>
                        <p className="mt-2 text-3xl font-extrabold text-emerald-900">{papers.length}</p>
                        <p className="mt-1 text-sm text-emerald-700">Ready for printing unit</p>
                    </div>
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                        <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Workflow Rule</p>
                        <p className="mt-2 text-lg font-extrabold text-blue-900">3 Approvals</p>
                        <p className="mt-1 text-sm text-blue-700">Academic + Deputy + Headmaster</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Search</p>
                        <div className="relative mt-2">
                            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Exam, subject, class, PDF..."
                                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                    </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-5 py-4">
                        <h2 className="text-lg font-bold text-slate-900">Approved Paper Queue</h2>
                        <p className="mt-1 text-sm text-slate-500">Only fully approved papers are listed.</p>
                    </div>

                    {filteredPapers.length === 0 ? (
                        <div className="px-6 py-14 text-center">
                            <FaFilePdf className="mx-auto text-4xl text-slate-300" />
                            <h3 className="mt-4 text-lg font-bold text-slate-800">No approved papers yet</h3>
                            <p className="mt-1 text-sm text-slate-500">
                                A paper will appear here after Academic, Deputy Headmaster and Headmaster approval are complete.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-sm">
                                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                    <tr>
                                        <th className="px-5 py-3">Examination</th>
                                        <th className="px-5 py-3">Subject</th>
                                        <th className="px-5 py-3">Class</th>
                                        <th className="px-5 py-3">Paper</th>
                                        <th className="px-5 py-3">Approval</th>
                                        <th className="px-5 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredPapers.map((row) => (
                                        <tr key={row.id} className="hover:bg-slate-50/70">
                                            <td className="px-5 py-4">
                                                <p className="font-semibold text-slate-900">{row.exam?.exam_name || "-"}</p>
                                                <p className="mt-1 text-xs text-slate-500">{row.exam?.term || row.exam?.exam_type || "Examination"}</p>
                                            </td>
                                            <td className="px-5 py-4 font-medium text-slate-800">{getSubjectName(row)}</td>
                                            <td className="px-5 py-4 text-slate-700">{getClassName(row)}</td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2">
                                                    <FaFilePdf className="text-red-500" />
                                                    <span className="max-w-[280px] truncate text-slate-700">{row.paper?.file_name || "Examination Paper"}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                                                    <FaCheckCircle /> Fully Approved
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => openPaper(row, true)}
                                                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                                                    >
                                                        Preview
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => openPaper(row, false)}
                                                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
                                                    >
                                                        <FaPrint />
                                                        Open & Print
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {preview && (
                <div className="fixed inset-0 z-50 bg-slate-950/70 p-3 md:p-6">
                    <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-slate-900">{preview.paper?.file_name}</p>
                                <p className="truncate text-xs text-slate-500">{preview.subject?.subject_name} • {getClassName(preview)}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPreview(null)}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                                aria-label="Close preview"
                            >
                                <FaTimes />
                            </button>
                        </div>
                        <div className="min-h-0 flex-1 bg-slate-100 p-2">
                            <iframe
                                title={preview.paper?.file_name || "Approved Examination Paper"}
                                src={preview.signedUrl}
                                className="h-full w-full rounded-xl bg-white"
                            />
                        </div>
                        <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4">
                            <button
                                type="button"
                                onClick={() => setPreview(null)}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
                            >
                                Close
                            </button>
                            <button
                                type="button"
                                onClick={() => window.open(preview.signedUrl, "_blank", "noopener,noreferrer")}
                                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                            >
                                <FaPrint />
                                Open PDF for Printing
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ExamPrintingUnit;
