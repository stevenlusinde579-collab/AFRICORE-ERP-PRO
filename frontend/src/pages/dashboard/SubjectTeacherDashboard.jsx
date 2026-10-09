
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    MdAssignment,
    MdAssessment,
    MdCalendarMonth,
    MdBook,
    MdPeople,
    MdChat,
    MdRefresh,
    MdCheckCircle,
    MdSchedule,
    MdLock,
    MdUploadFile,
    MdErrorOutline,
} from "react-icons/md";
import { supabase } from "../../services/supabase";

const APPROVAL_STEPS = [
    {
        key: "approved_by_academic",
        label: "Academic Master",
    },
    {
        key: "approved_by_deputy",
        label: "Deputy Headmaster",
    },
    {
        key: "approved_by_headmaster",
        label: "Headmaster",
    },
];

function isApproved(value) {
    return value === true;
}

function normalizeStatus(value) {
    return String(value || "").trim().toLowerCase();
}

function SubjectTeacherDashboard() {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [teacherName, setTeacherName] = useState("");
    const [examSubjects, setExamSubjects] = useState([]);
    const [lastUpdated, setLastUpdated] = useState(null);

    const loadDashboard = useCallback(async (isManual = false) => {
        if (isManual) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        setError("");

        try {
            const {
                data: authData,
                error: authError,
            } = await supabase.auth.getUser();

            if (authError) {
                throw authError;
            }

            const user = authData?.user;

            if (!user) {
                throw new Error(
                    "Your login session could not be verified. Please sign in again."
                );
            }

            const {
                data: profile,
                error: profileError,
            } = await supabase
                .from("profiles")
                .select("id, full_name, school_id, role_id, teacher_id")
                .eq("id", user.id)
                .maybeSingle();

            if (profileError) {
                throw profileError;
            }

            if (!profile) {
                throw new Error(
                    "Your user profile could not be found."
                );
            }

            if (!profile.school_id || !profile.teacher_id) {
                throw new Error(
                    "Your account is not linked to a teacher record or school. Please contact the system administrator."
                );
            }

            setTeacherName(
                profile.full_name || user.email || "Subject Teacher"
            );

            const {
                data: assignments,
                error: assignmentError,
            } = await supabase
                .from("teacher_assignments")
                .select(
                    "id, school_id, teacher_id, subject_id, class_id"
                )
                .eq("school_id", profile.school_id)
                .eq("teacher_id", profile.teacher_id);

            if (assignmentError) {
                throw assignmentError;
            }

            if (!assignments?.length) {
                setExamSubjects([]);
                setLastUpdated(new Date());
                return;
            }

            // A teacher must match BOTH the assigned subject and class.
            const assignmentPairs = new Set(
                assignments
                    .filter(
                        (item) =>
                            item.subject_id != null &&
                            item.class_id != null
                    )
                    .map(
                        (item) =>
                            `${String(item.subject_id)}:${String(item.class_id)}`
                    )
            );

            if (!assignmentPairs.size) {
                setExamSubjects([]);
                setLastUpdated(new Date());
                return;
            }

            const {
                data: exams,
                error: examsError,
            } = await supabase
                .from("exams")
                .select(
                    "id, school_id, exam_name, exam_type, term, start_date, end_date, status"
                )
                .eq("school_id", profile.school_id);

            if (examsError) {
                throw examsError;
            }

            if (!exams?.length) {
                setExamSubjects([]);
                setLastUpdated(new Date());
                return;
            }

            const examIds = exams.map((exam) => exam.id);

            const {
                data: subjects,
                error: subjectsError,
            } = await supabase
                .from("exam_subjects")
                .select(
                    "id, exam_id, subject_id, class_id, full_marks, pass_marks, approval_status, approved_by_academic, approved_by_deputy, approved_by_headmaster, approved_at, rejection_reason"
                )
                .in("exam_id", examIds);

            if (subjectsError) {
                throw subjectsError;
            }

            const matchingSubjects = (subjects || []).filter(
                (item) =>
                    assignmentPairs.has(
                        `${String(item.subject_id)}:${String(item.class_id)}`
                    )
            );

            if (!matchingSubjects.length) {
                setExamSubjects([]);
                setLastUpdated(new Date());
                return;
            }

            const subjectIds = [
                ...new Set(
                    matchingSubjects
                        .map((item) => item.subject_id)
                        .filter((id) => id != null)
                ),
            ];

            const classIds = [
                ...new Set(
                    matchingSubjects
                        .map((item) => item.class_id)
                        .filter((id) => id != null)
                ),
            ];

            const matchingExamIds = [
                ...new Set(matchingSubjects.map((item) => item.exam_id)),
            ];

            const [
                subjectsResult,
                classesResult,
                papersResult,
            ] = await Promise.all([
                subjectIds.length
                    ? supabase
                        .from("subjects")
                        .select("id, subject_name, subject_code")
                        .in("id", subjectIds)
                    : Promise.resolve({ data: [], error: null }),

                classIds.length
                    ? supabase
                        .from("classes")
                        .select("id, class_name, short_name")
                        .in("id", classIds)
                    : Promise.resolve({ data: [], error: null }),

                matchingExamIds.length
                    ? supabase
                        .from("exam_papers")
                        .select(
                            "id, exam_subject_id, file_name, status, ai_status, created_at"
                        )
                        .in("exam_id", matchingExamIds)
                        .order("created_at", { ascending: false })
                    : Promise.resolve({ data: [], error: null }),
            ]);

            if (subjectsResult.error) {
                throw subjectsResult.error;
            }

            if (classesResult.error) {
                throw classesResult.error;
            }

            if (papersResult.error) {
                throw papersResult.error;
            }

            const subjectMap = new Map(
                (subjectsResult.data || []).map(
                    (item) => [String(item.id), item]
                )
            );

            const classMap = new Map(
                (classesResult.data || []).map(
                    (item) => [String(item.id), item]
                )
            );

            const examMap = new Map(
                exams.map((item) => [String(item.id), item])
            );

            const paperMap = new Map();

            // Keep the newest paper for each exam subject.
            for (const paper of papersResult.data || []) {
                const key = String(paper.exam_subject_id);

                if (!paperMap.has(key)) {
                    paperMap.set(key, paper);
                }
            }

            const rows = matchingSubjects
                .map((item) => {
                    const exam = examMap.get(String(item.exam_id));

                    if (!exam) {
                        return null;
                    }

                    const subject = subjectMap.get(
                        String(item.subject_id)
                    );

                    const classItem = classMap.get(
                        String(item.class_id)
                    );

                    return {
                        ...item,
                        exam,
                        subject,
                        classItem,
                        paper: paperMap.get(String(item.id)) || null,
                    };
                })
                .filter(Boolean)
                .sort((a, b) => {
                    const dateA = a.exam.start_date
                        ? new Date(a.exam.start_date).getTime()
                        : 0;

                    const dateB = b.exam.start_date
                        ? new Date(b.exam.start_date).getTime()
                        : 0;

                    return dateB - dateA;
                });

            setExamSubjects(rows);
            setLastUpdated(new Date());
        } catch (loadError) {
            console.error(
                "Subject Teacher Dashboard load failed:",
                loadError
            );

            setError(
                loadError?.message ||
                "Failed to load your examination dashboard."
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadDashboard();

        // Refresh approval and examination data periodically.
        const refreshTimer = setInterval(() => {
            loadDashboard(true);
        }, 30000);

        return () => clearInterval(refreshTimer);
    }, [loadDashboard]);

    const openAIAnalysis = (row) => {
        navigate(
            `/examination/${row.exam.id}/ai-analysis?examSubjectId=${row.id}`,
            {
                state: {
                    examSubjectId: row.id,
                },
            }
        );
    };

    const openResultsAnalysis = (row) => {
        navigate(
            `/examination/${row.exam.id}/results-analysis`,
            {
                state: {
                    examSubjectId: row.id,
                },
            }
        );
    };

    const openMarks = (row) => {
        navigate(
            `/examination/${row.exam.id}/marks`,
            {
                state: {
                    examSubjectId: row.id,
                },
            }
        );
    };

    const openApproval = (row) => {
        navigate(
            `/examination/${row.exam.id}/approval`,
            {
                state: {
                    examSubjectId: row.id,
                },
            }
        );
    };

    const openPaperUpload = (row) => {
        navigate(
            `/examination/${row.exam.id}/subject-upload`,
            {
                state: {
                    examSubjectId: row.id,
                },
            }
        );
    };

    const items = [
        {
            title: "My Teaching Assignments",
            description: "View your assigned subjects and classes.",
            path: "/teacher-assignment",
            icon: <MdAssignment />,
            color: "text-blue-600",
        },
        {
            title: "My Subjects",
            description: "Access your assigned subjects and academic content.",
            path: "/subjects",
            icon: <MdBook />,
            color: "text-green-600",
        },
        {
            title: "My Students",
            description: "View students from classes assigned to you.",
            path: "/students",
            icon: <MdPeople />,
            color: "text-indigo-600",
        },
        {
            title: "Communication",
            description: "Communicate with school management and colleagues.",
            path: "/communication",
            icon: <MdChat />,
            color: "text-cyan-600",
        },
        {
            title: "Examination",
            description: "Review your examination subjects and approval progress.",
            path: "/examination",
            icon: <MdAssessment />,
            color: "text-orange-600",
        },
        {
            title: "Timetable",
            description: "View your teaching timetable.",
            path: "/timetable",
            icon: <MdCalendarMonth />,
            color: "text-purple-600",
        },
    ];

    if (loading) {
        return (
            <div className="flex min-h-64 items-center justify-center">
                <div className="text-center">
                    <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
                    <p className="text-sm text-gray-600">
                        Loading your teaching and examination data...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">
                        Subject Teacher Dashboard
                    </h1>

                    <p className="mt-2 text-gray-600">
                        Welcome, {teacherName}. Review your assigned subjects,
                        examination approvals and results.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => loadDashboard(true)}
                    disabled={refreshing}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <MdRefresh
                        className={`text-xl ${refreshing ? "animate-spin" : ""}`}
                    />
                    {refreshing ? "Refreshing..." : "Refresh"}
                </button>
            </div>

            {error && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
                    <MdErrorOutline className="mt-0.5 text-xl" />
                    <div>
                        <p className="font-semibold">
                            Could not load dashboard data
                        </p>
                        <p className="mt-1 text-sm">{error}</p>
                        <button
                            type="button"
                            onClick={() => loadDashboard(true)}
                            className="mt-3 rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800"
                        >
                            Try again
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                    <button
                        key={item.title}
                        type="button"
                        onClick={() => navigate(item.path)}
                        className="rounded-xl border border-gray-200 bg-white p-6 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <div className={`text-4xl ${item.color}`}>
                            {item.icon}
                        </div>

                        <h2 className="mt-4 text-lg font-bold text-gray-800">
                            {item.title}
                        </h2>

                        <p className="mt-2 leading-relaxed text-gray-500">
                            {item.description}
                        </p>
                    </button>
                ))}
            </div>

            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-col gap-2 border-b border-gray-200 bg-gray-50 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">
                            My Examination Subjects
                        </h2>
                        <p className="mt-1 text-sm text-gray-600">
                            Approval progress refreshes automatically every 30 seconds.
                        </p>
                    </div>

                    <div className="text-sm text-gray-500">
                        {examSubjects.length} assigned exam subject
                        {examSubjects.length === 1 ? "" : "s"}
                    </div>
                </div>

                {examSubjects.length === 0 ? (
                    <div className="p-8 text-center">
                        <MdAssessment className="mx-auto text-5xl text-gray-300" />
                        <h3 className="mt-3 font-bold text-gray-800">
                            No matching examination subjects
                        </h3>
                        <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500">
                            No examination subjects were found for your assigned
                            subject and class combinations. If you believe this
                            is incorrect, ask the school administrator to check
                            your teacher assignments and examination setup.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {examSubjects.map((row) => {
                            const academicApproved = isApproved(
                                row.approved_by_academic
                            );
                            const deputyApproved = isApproved(
                                row.approved_by_deputy
                            );
                            const headmasterApproved = isApproved(
                                row.approved_by_headmaster
                            );

                            const allApprovalsComplete =
                                academicApproved &&
                                deputyApproved &&
                                headmasterApproved;

                            const examApproved =
                                normalizeStatus(row.exam.status) === "approved";

                            const canEnterMarks =
                                allApprovalsComplete && examApproved;

                            const paperStatus = normalizeStatus(
                                row.paper?.ai_status ||
                                row.paper?.status
                            );

                            let analysisLabel = "Paper not uploaded";

                            if (row.paper) {
                                if (
                                    ["completed", "complete", "success", "analysed", "analyzed"].includes(
                                        paperStatus
                                    )
                                ) {
                                    analysisLabel = "Analysis completed";
                                } else if (
                                    ["processing", "pending", "queued", "running"].includes(
                                        paperStatus
                                    )
                                ) {
                                    analysisLabel = "Analysis processing";
                                } else if (
                                    ["failed", "error", "rejected"].includes(
                                        paperStatus
                                    )
                                ) {
                                    analysisLabel = "Analysis needs attention";
                                } else {
                                    analysisLabel = "Paper uploaded";
                                }
                            }

                            return (
                                <article
                                    key={row.id}
                                    className="p-5 sm:p-6"
                                >
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0">
                                            <h3 className="text-lg font-bold text-gray-900">
                                                {row.exam.exam_name || "Examination"}
                                            </h3>

                                            <p className="mt-1 text-sm text-gray-600">
                                                {row.subject?.subject_name || "Subject"}
                                                {row.subject?.subject_code
                                                    ? ` (${row.subject.subject_code})`
                                                    : ""}
                                                {" · "}
                                                {row.classItem?.class_name ||
                                                    row.classItem?.short_name ||
                                                    "Class"}
                                            </p>

                                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                                {row.exam.term && (
                                                    <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">
                                                        {row.exam.term}
                                                    </span>
                                                )}

                                                <span className="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700">
                                                    Exam: {row.exam.status || "Unknown"}
                                                </span>

                                                <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">
                                                    {analysisLabel}
                                                </span>
                                            </div>

                                            {row.paper?.file_name && (
                                                <p className="mt-2 break-words text-xs text-gray-500">
                                                    Paper: {row.paper.file_name}
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={() => openPaperUpload(row)}
                                                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                                            >
                                                <MdUploadFile className="text-lg" />
                                                Paper
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => openAIAnalysis(row)}
                                                className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                                            >
                                                <MdAssessment className="text-lg" />
                                                AI Analysis
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => openResultsAnalysis(row)}
                                                className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
                                            >
                                                <MdBook className="text-lg" />
                                                Subject Results
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-6 rounded-xl border border-gray-200 p-4">
                                        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            <h4 className="font-bold text-gray-800">
                                                Approval Progress
                                            </h4>

                                            <span
                                                className={`inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                                                    allApprovalsComplete
                                                        ? "bg-green-100 text-green-800"
                                                        : "bg-amber-100 text-amber-800"
                                                }`}
                                            >
                                                {allApprovalsComplete
                                                    ? "All approvals complete"
                                                    : "Awaiting approval"}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                            {APPROVAL_STEPS.map((step) => {
                                                const approved = isApproved(
                                                    row[step.key]
                                                );

                                                return (
                                                    <div
                                                        key={step.key}
                                                        className={`flex items-center gap-3 rounded-lg border p-3 ${
                                                            approved
                                                                ? "border-green-200 bg-green-50"
                                                                : "border-gray-200 bg-gray-50"
                                                        }`}
                                                    >
                                                        {approved ? (
                                                            <MdCheckCircle className="shrink-0 text-2xl text-green-600" />
                                                        ) : (
                                                            <MdSchedule className="shrink-0 text-2xl text-amber-600" />
                                                        )}

                                                        <div>
                                                            <p className="text-sm font-semibold text-gray-800">
                                                                {step.label}
                                                            </p>
                                                            <p
                                                                className={`mt-1 text-xs font-medium ${
                                                                    approved
                                                                        ? "text-green-700"
                                                                        : "text-amber-700"
                                                                }`}
                                                            >
                                                                {approved
                                                                    ? "Approved"
                                                                    : "Pending"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {row.rejection_reason && (
                                            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                                                <strong>Rejection reason:</strong>{" "}
                                                {row.rejection_reason}
                                            </div>
                                        )}

                                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="text-sm">
                                                {canEnterMarks ? (
                                                    <span className="font-medium text-green-700">
                                                        All approvals are complete and the examination is approved.
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-2 text-amber-700">
                                                        <MdLock className="text-lg" />
                                                        Enter Marks is locked until all three approvals are complete and the exam is Approved.
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => openApproval(row)}
                                                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                                                >
                                                    View Approval
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => openMarks(row)}
                                                    disabled={!canEnterMarks}
                                                    title={
                                                        canEnterMarks
                                                            ? "Enter marks"
                                                            : "Waiting for all approvals and examination status Approved"
                                                    }
                                                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold ${
                                                        canEnterMarks
                                                            ? "bg-green-600 text-white hover:bg-green-700"
                                                            : "cursor-not-allowed bg-gray-200 text-gray-500"
                                                    }`}
                                                >
                                                    {canEnterMarks ? (
                                                        <MdAssessment className="text-lg" />
                                                    ) : (
                                                        <MdLock className="text-lg" />
                                                    )}
                                                    Enter Marks
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}

                {lastUpdated && (
                    <div className="border-t border-gray-200 px-5 py-3 text-xs text-gray-500">
                        Last refreshed: {lastUpdated.toLocaleTimeString()}
                    </div>
                )}
            </section>
        </div>
    );
}

export default SubjectTeacherDashboard;