
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    FaArrowRight,
    FaCheckCircle,
    FaClipboardCheck,
    FaCloudUploadAlt,
    FaFilePdf,
    FaLock,
    FaSpinner,
    FaTasks,
    FaChartBar,
    FaPen,
    FaSyncAlt,
} from "react-icons/fa";

import { supabase } from "../../services/supabase";
import { useRole } from "../../context/RoleContext";

import ExaminationDashboard from "./ExaminationDashboard";
import ExamPrintingUnit from "./ExamPrintingUnit";

const ROLE_LABELS = {
    1: "Super Admin",
    2: "Headmaster",
    3: "Deputy Headmaster",
    4: "Academic Master",
    5: "Subject Teacher",
    7: "Secretary",
};

function normalizeRoleName(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ");
}

function makePairKey(subjectId, classId) {
    if (
        subjectId === null ||
        subjectId === undefined ||
        classId === null ||
        classId === undefined
    ) {
        return "";
    }

    return `${String(subjectId).trim()}:${String(classId).trim()}`;
}

function isApprovedStatus(status) {
    return String(status || "").trim().toLowerCase() === "approved";
}

function ExaminationRoleDashboard() {
    const { selectedRole, activeRole, role, roles } = useRole();

    const [loading, setLoading] = useState(true);
    const [roleId, setRoleId] = useState(null);
    const [profile, setProfile] = useState(null);
    const [queue, setQueue] = useState([]);
    const [error, setError] = useState("");

    const getSelectedRoleId = useCallback(() => {
        const candidates = [
            selectedRole?.id,
            selectedRole?.role_id,
            activeRole?.id,
            activeRole?.role_id,
            role?.id,
            role?.role_id,
        ];

        for (const value of candidates) {
            const numberValue = Number(value);

            if (Number.isFinite(numberValue) && numberValue > 0) {
                return numberValue;
            }
        }

        const roleNameCandidates = [
            selectedRole?.role_name,
            selectedRole?.name,
            activeRole?.role_name,
            activeRole?.name,
            role?.role_name,
            role?.name,
        ];

        for (const value of roleNameCandidates) {
            const normalized = normalizeRoleName(value);

            if (normalized === "super admin") return 1;
            if (normalized === "headmaster") return 2;
            if (normalized === "deputy headmaster") return 3;
            if (normalized === "academic master") return 4;
            if (normalized === "subject teacher") return 5;
            if (normalized === "secretary") return 7;
        }

        if (Array.isArray(roles) && roles.length === 1) {
            const onlyRole = roles[0];
            const id = Number(onlyRole?.id ?? onlyRole?.role_id ?? 0);

            if (Number.isFinite(id) && id > 0) {
                return id;
            }
        }

        return null;
    }, [selectedRole, activeRole, role, roles]);

    const loadApprovalQueue = useCallback(async (currentProfile, currentRole) => {
        if (!currentProfile?.school_id) {
            setQueue([]);
            return;
        }

        const { data: exams, error: examsError } = await supabase
            .from("exams")
            .select(`
                id,
                exam_name,
                exam_type,
                term,
                start_date,
                end_date,
                status
            `)
            .eq("school_id", currentProfile.school_id)
            .order("created_at", { ascending: false });

        if (examsError) throw examsError;

        const examRows = exams || [];
        const examIds = examRows.map((row) => row.id).filter(Boolean);

        if (!examIds.length) {
            setQueue([]);
            return;
        }

        const { data: examSubjects, error: subjectError } = await supabase
            .from("exam_subjects")
            .select(`
                id,
                exam_id,
                subject_id,
                class_id,
                approved_by_academic,
                approved_by_deputy,
                approved_by_headmaster
            `)
            .in("exam_id", examIds);

        if (subjectError) throw subjectError;

        const pending = (examSubjects || []).filter((row) => {
            const academic = Boolean(row.approved_by_academic);
            const deputy = Boolean(row.approved_by_deputy);
            const headmaster = Boolean(row.approved_by_headmaster);

            if (currentRole === 3) {
                return academic && !deputy && !headmaster;
            }

            return academic && deputy && !headmaster;
        });

        if (!pending.length) {
            setQueue([]);
            return;
        }

        const subjectIds = [
            ...new Set(pending.map((row) => row.subject_id).filter(Boolean)),
        ];
        const classIds = [
            ...new Set(pending.map((row) => row.class_id).filter(Boolean)),
        ];

        const [subjectResult, classResult] = await Promise.all([
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
        ]);

        if (subjectResult.error) throw subjectResult.error;
        if (classResult.error) throw classResult.error;

        const examMap = new Map(
            examRows.map((row) => [String(row.id), row])
        );
        const subjectMap = new Map(
            (subjectResult.data || []).map((row) => [String(row.id), row])
        );
        const classMap = new Map(
            (classResult.data || []).map((row) => [String(row.id), row])
        );

        setQueue(
            pending.map((row) => ({
                ...row,
                exam: examMap.get(String(row.exam_id)) || null,
                subject: subjectMap.get(String(row.subject_id)) || null,
                classRow: classMap.get(String(row.class_id)) || null,
            }))
        );
    }, []);

    const loadRole = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError) throw authError;

            if (!user?.id) {
                throw new Error("User session not found.");
            }

            const { data: currentProfile, error: profileError } =
                await supabase
                    .from("profiles")
                    .select("id, full_name, role_id, school_id, teacher_id")
                    .eq("id", user.id)
                    .maybeSingle();

            if (profileError) throw profileError;

            if (!currentProfile) {
                throw new Error("Your profile could not be found.");
            }

            const contextRoleId = getSelectedRoleId();
            const profileRoleId = Number(currentProfile?.role_id || 0);
            const currentRole = contextRoleId || profileRoleId || null;

            setProfile(currentProfile);
            setRoleId(currentRole);

            if ([2, 3].includes(currentRole)) {
                await loadApprovalQueue(currentProfile, currentRole);
            } else {
                setQueue([]);
            }
        } catch (err) {
            console.error("EXAMINATION ROLE DASHBOARD ERROR:", err);
            setError(err?.message || "Failed to load examination access.");
        } finally {
            setLoading(false);
        }
    }, [getSelectedRoleId, loadApprovalQueue]);

    useEffect(() => {
        loadRole();
    }, [loadRole]);

    if (loading) {
        return (
            <div className="min-h-[500px] flex items-center justify-center bg-slate-50">
                <div className="flex items-center gap-3 text-slate-600">
                    <FaSpinner className="animate-spin" />
                    Loading Examination access...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-[500px] bg-slate-50 p-6">
                <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
                    <p className="font-bold">Unable to load Examination</p>
                    <p className="mt-1 text-sm">{error}</p>
                    <button
                        type="button"
                        onClick={loadRole}
                        className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    if ([1, 4].includes(roleId)) {
        return <ExaminationDashboard />;
    }

    if (roleId === 7) {
        return <ExamPrintingUnit />;
    }

    if (roleId === 5) {
        return <SubjectTeacherDashboard profile={profile} />;
    }

    return (
        <RoleSpecificDashboard
            roleId={roleId}
            profile={profile}
            queue={queue}
        />
    );
}

function RoleSpecificDashboard({ roleId, profile, queue }) {
    const navigate = useNavigate();
    const roleName = ROLE_LABELS[roleId] || "User";

    const title = "Examination Approval Console";
    const description =
        roleId === 2
            ? "Review examinations that have completed Academic and Deputy approval and are waiting for final approval."
            : "Review examinations that have completed Academic approval and are waiting for your approval.";

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-6">
            <div className="mx-auto max-w-7xl space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
                                Examination
                            </p>
                            <h1 className="mt-1 text-3xl font-extrabold text-slate-900">
                                {title}
                            </h1>
                            <p className="mt-1 text-sm text-slate-500">
                                {description}
                            </p>
                            <p className="mt-3 text-xs font-semibold text-slate-400">
                                Signed in as {profile?.full_name || roleName} • {roleName}
                            </p>
                        </div>
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                            <FaClipboardCheck className="text-2xl" />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                        <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                            Waiting for You
                        </p>
                        <p className="mt-2 text-3xl font-extrabold text-blue-900">
                            {queue.length}
                        </p>
                        <p className="mt-1 text-sm text-blue-700">
                            Examination subject approval item(s)
                        </p>
                    </div>

                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                            Approval Rule
                        </p>
                        <p className="mt-2 text-lg font-extrabold text-emerald-900">
                            Sequential
                        </p>
                        <p className="mt-1 text-sm text-emerald-700">
                            Academic → Deputy → Headmaster
                        </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                            Restricted Areas
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {["Create", "Edit", "Other subjects"].map((label) => (
                                <span
                                    key={label}
                                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"
                                >
                                    {label}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-5 py-4">
                        <h2 className="text-lg font-bold text-slate-900">
                            Approval Queue
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Only items requiring your approval are shown.
                        </p>
                    </div>

                    {queue.length === 0 ? (
                        <div className="px-6 py-14 text-center">
                            <FaCheckCircle className="mx-auto text-4xl text-emerald-300" />
                            <h3 className="mt-4 text-lg font-bold text-slate-800">
                                No pending approval
                            </h3>
                            <p className="mt-1 text-sm text-slate-500">
                                There are currently no examination subjects waiting for your action.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {queue.map((row) => (
                                <div
                                    key={row.id}
                                    className="flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between"
                                >
                                    <div>
                                        <p className="font-bold text-slate-900">
                                            {row.exam?.exam_name || "Examination"}
                                        </p>
                                        <p className="mt-1 text-sm text-slate-700">
                                            {row.subject?.subject_name ||
                                                row.subject?.subject_code ||
                                                `Subject ${row.subject_id}`}
                                            <span className="mx-2 text-slate-300">•</span>
                                            {row.classRow?.class_name ||
                                                row.classRow?.short_name ||
                                                `Class ${row.class_id}`}
                                        </p>
                                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                                                Academic Approved
                                            </span>
                                            {roleId === 2 && (
                                                <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">
                                                    Deputy Approved
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            navigate(`/examination/${row.exam_id}/approval`, {
                                                state: { examSubjectId: row.id },
                                            })
                                        }
                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"
                                    >
                                        Open Approval <FaArrowRight />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function SubjectTeacherDashboard({ profile }) {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [workItems, setWorkItems] = useState([]);

    const loadTeacherWork = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            setError("");

            if (!profile?.school_id || !profile?.teacher_id) {
                throw new Error(
                    "Your profile is not linked to a school and teacher record."
                );
            }

            const { data: assignments, error: assignmentError } = await supabase
                .from("teacher_assignments")
                .select("id, subject_id, class_id")
                .eq("school_id", profile.school_id)
                .eq("teacher_id", profile.teacher_id);

            if (assignmentError) throw assignmentError;

            const assignmentRows = assignments || [];

            if (!assignmentRows.length) {
                setWorkItems([]);
                return;
            }

            const pairs = new Set();

            assignmentRows.forEach((assignment) => {
                const key = makePairKey(
                    assignment.subject_id,
                    assignment.class_id
                );

                if (key) pairs.add(key);
            });

            if (!pairs.size) {
                setWorkItems([]);
                return;
            }

            const subjectIds = [
                ...new Set(
                    assignmentRows
                        .map((row) => row.subject_id)
                        .filter((id) => id !== null && id !== undefined)
                ),
            ];

            const classIds = [
                ...new Set(
                    assignmentRows
                        .map((row) => row.class_id)
                        .filter((id) => id !== null && id !== undefined)
                ),
            ];

            /*
             * Start from exam_subjects and match the exact subject + class pair.
             * This avoids hiding examination subjects when exams.school_id is NULL.
             */
            const { data: examSubjects, error: examSubjectError } = await supabase
                .from("exam_subjects")
                .select(`
                    id,
                    exam_id,
                    subject_id,
                    class_id,
                    full_marks,
                    pass_marks,
                    question_selection_type,
                    questions_to_answer,
                    approved_by_academic,
                    approved_by_deputy,
                    approved_by_headmaster
                `)
                .in("subject_id", subjectIds)
                .in("class_id", classIds);

            if (examSubjectError) throw examSubjectError;

            const matching = (examSubjects || []).filter((row) =>
                pairs.has(makePairKey(row.subject_id, row.class_id))
            );

            if (!matching.length) {
                setWorkItems([]);
                return;
            }

            const examIds = [
                ...new Set(
                    matching
                        .map((row) => row.exam_id)
                        .filter((id) => id !== null && id !== undefined)
                ),
            ];

            const examSubjectIds = [
                ...new Set(
                    matching
                        .map((row) => row.id)
                        .filter((id) => id !== null && id !== undefined)
                ),
            ];

            const [examResult, subjectResult, classResult, paperResult] =
                await Promise.all([
                    examIds.length
                        ? supabase
                            .from("exams")
                            .select(`
                                id,
                                exam_name,
                                exam_type,
                                term,
                                start_date,
                                end_date,
                                status
                            `)
                            .in("id", examIds)
                        : Promise.resolve({ data: [], error: null }),

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

                    examSubjectIds.length
                        ? supabase
                            .from("exam_papers")
                            .select(`
                                id,
                                exam_subject_id,
                                file_name,
                                status,
                                ai_status,
                                created_at
                            `)
                            .in("exam_subject_id", examSubjectIds)
                            .order("created_at", { ascending: false })
                        : Promise.resolve({ data: [], error: null }),
                ]);

            if (examResult.error) throw examResult.error;
            if (subjectResult.error) throw subjectResult.error;
            if (classResult.error) throw classResult.error;
            if (paperResult.error) throw paperResult.error;

            const examMap = new Map(
                (examResult.data || []).map((row) => [String(row.id), row])
            );
            const subjectMap = new Map(
                (subjectResult.data || []).map((row) => [String(row.id), row])
            );
            const classMap = new Map(
                (classResult.data || []).map((row) => [String(row.id), row])
            );

            const paperMap = new Map();

            (paperResult.data || []).forEach((paper) => {
                const key = String(paper.exam_subject_id);

                if (!paperMap.has(key)) {
                    paperMap.set(key, paper);
                }
            });

            const normalized = matching.map((row) => ({
                ...row,
                exam: examMap.get(String(row.exam_id)) || null,
                subject: subjectMap.get(String(row.subject_id)) || null,
                classRow: classMap.get(String(row.class_id)) || null,
                paper: paperMap.get(String(row.id)) || null,
            }));

            const unique = Array.from(
                new Map(
                    normalized
                        .filter((row) => Boolean(row.exam))
                        .map((row) => [String(row.id), row])
                ).values()
            );

            setWorkItems(unique);
        } catch (err) {
            console.error("SUBJECT TEACHER WORKLOAD ERROR:", err);
            setError(
                err?.message || "Failed to load your examination work."
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [profile]);

    useEffect(() => {
        loadTeacherWork();

        const timer = setInterval(() => {
            loadTeacherWork(true);
        }, 30000);

        return () => clearInterval(timer);
    }, [loadTeacherWork]);

    const counts = useMemo(() => {
        return {
            total: workItems.length,
            awaitingUpload: workItems.filter((row) => !row.paper?.file_name).length,
            uploaded: workItems.filter((row) => Boolean(row.paper?.file_name)).length,
            approved: workItems.filter((row) =>
                row.approved_by_academic &&
                row.approved_by_deputy &&
                row.approved_by_headmaster &&
                isApprovedStatus(row.exam?.status)
            ).length,
        };
    }, [workItems]);

    if (loading) {
        return (
            <div className="min-h-[500px] flex items-center justify-center bg-slate-50">
                <div className="flex items-center gap-3 text-slate-600">
                    <FaSpinner className="animate-spin" />
                    Loading your examination assignments...
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-6">
            <div className="mx-auto max-w-7xl space-y-6">
                <div className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
                                Subject Teacher
                            </p>
                            <h1 className="mt-1 text-3xl font-extrabold text-slate-900">
                                My Examination Work
                            </h1>
                            <p className="mt-1 text-sm text-slate-500">
                                Your assigned subjects, approval progress, paper analysis and marks entry.
                            </p>
                            <p className="mt-3 text-xs font-semibold text-slate-400">
                                {profile?.full_name || "Subject Teacher"}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => loadTeacherWork(true)}
                            disabled={refreshing}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                            <FaSyncAlt className={refreshing ? "animate-spin" : ""} />
                            Refresh
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                        {error}
                        <button
                            type="button"
                            onClick={() => loadTeacherWork()}
                            className="ml-3 font-bold underline"
                        >
                            Retry
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Metric label="Assigned" value={counts.total} icon={<FaTasks />} />
                    <Metric
                        label="Awaiting Upload"
                        value={counts.awaitingUpload}
                        icon={<FaCloudUploadAlt />}
                    />
                    <Metric label="Uploaded" value={counts.uploaded} icon={<FaFilePdf />} />
                    <Metric
                        label="Fully Approved"
                        value={counts.approved}
                        icon={<FaCheckCircle />}
                    />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-5 py-4">
                        <h2 className="text-lg font-bold text-slate-900">
                            My Examination Assignments
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Only examination subjects matching your assigned subject and class are displayed.
                        </p>
                    </div>

                    {workItems.length === 0 ? (
                        <div className="px-6 py-14 text-center">
                            <FaLock className="mx-auto text-4xl text-slate-300" />
                            <h3 className="mt-4 text-lg font-bold text-slate-800">
                                No examination work assigned
                            </h3>
                            <p className="mt-1 text-sm text-slate-500">
                                No examination currently contains your assigned subject and class combination.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {workItems.map((row) => {
                                const academicApproved = Boolean(row.approved_by_academic);
                                const deputyApproved = Boolean(row.approved_by_deputy);
                                const headmasterApproved = Boolean(row.approved_by_headmaster);

                                const approvalsComplete =
                                    academicApproved &&
                                    deputyApproved &&
                                    headmasterApproved;

                                const examApproved = isApprovedStatus(row.exam?.status);
                                const canEnterMarks = approvalsComplete && examApproved;

                                const approvalSteps = [
                                    {
                                        label: "Academic Master",
                                        approved: academicApproved,
                                    },
                                    {
                                        label: "Deputy Headmaster",
                                        approved: deputyApproved,
                                    },
                                    {
                                        label: "Headmaster",
                                        approved: headmasterApproved,
                                    },
                                ];

                                return (
                                    <div key={row.id} className="px-5 py-6">
                                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                            <div className="min-w-0 flex-1">
                                                <p className="font-bold text-slate-900">
                                                    {row.exam?.exam_name || "Examination"}
                                                </p>

                                                <p className="mt-1 text-sm text-slate-700">
                                                    {row.subject?.subject_name ||
                                                        row.subject?.subject_code ||
                                                        `Subject ${row.subject_id}`}
                                                    <span className="mx-2 text-slate-300">•</span>
                                                    {row.classRow?.class_name ||
                                                        row.classRow?.short_name ||
                                                        `Class ${row.class_id}`}
                                                </p>

                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <span
                                                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                                            row.paper?.file_name
                                                                ? "bg-emerald-50 text-emerald-700"
                                                                : "bg-amber-50 text-amber-700"
                                                        }`}
                                                    >
                                                        {row.paper?.file_name
                                                            ? "Paper Uploaded"
                                                            : "Paper Awaiting Upload"}
                                                    </span>

                                                    <span
                                                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                                            examApproved
                                                                ? "bg-emerald-50 text-emerald-700"
                                                                : "bg-slate-100 text-slate-600"
                                                        }`}
                                                    >
                                                        Examination: {row.exam?.status || "Unknown"}
                                                    </span>
                                                </div>

                                                <div className="mt-5">
                                                    <p className="mb-3 text-sm font-bold text-slate-800">
                                                        Approval Progress
                                                    </p>

                                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                                        {approvalSteps.map((step) => (
                                                            <div
                                                                key={step.label}
                                                                className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${
                                                                    step.approved
                                                                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                                                        : "border-amber-200 bg-amber-50 text-amber-800"
                                                                }`}
                                                            >
                                                                {step.approved ? (
                                                                    <FaCheckCircle className="shrink-0" />
                                                                ) : (
                                                                    <FaLock className="shrink-0" />
                                                                )}
                                                                <span className="font-semibold">
                                                                    {step.label}
                                                                </span>
                                                                <span className="ml-auto text-xs font-bold">
                                                                    {step.approved ? "Approved" : "Pending"}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {!canEnterMarks && (
                                                        <p className="mt-3 text-xs text-amber-700">
                                                            Enter Marks itafunguliwa baada ya approvals zote tatu kukamilika na examination status kuwa Approved.
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:w-64 xl:shrink-0">
                                                <ActionButton
                                                    icon={<FaCloudUploadAlt />}
                                                    label={row.paper?.file_name ? "Manage Paper" : "Upload Paper"}
                                                    onClick={() =>
                                                        navigate(
                                                            `/examination/${row.exam_id}/subject-upload?examSubjectId=${encodeURIComponent(row.id)}`
                                                        )
                                                    }
                                                    variant="blue"
                                                />

                                                <ActionButton
                                                    icon={<FaChartBar />}
                                                    label="Subject Result Analysis"
                                                    onClick={() =>
                                                        navigate(
                                                            `/examination/${row.exam_id}/results-analysis`,
                                                            { state: { examSubjectId: row.id } }
                                                        )
                                                    }
                                                    variant="indigo"
                                                />

                                                <ActionButton
                                                    icon={<FaFilePdf />}
                                                    label="AI Paper Analysis"
                                                    onClick={() =>
                                                        navigate(
                                                            `/examination/${row.exam_id}/ai-analysis?examSubjectId=${encodeURIComponent(row.id)}`
                                                        )
                                                    }
                                                    variant="slate"
                                                />

                                                <ActionButton
                                                    icon={canEnterMarks ? <FaPen /> : <FaLock />}
                                                    label="Enter Marks"
                                                    disabled={!canEnterMarks}
                                                    onClick={() =>
                                                        navigate(
                                                            `/examination/${row.exam_id}/marks`,
                                                            { state: { examSubjectId: row.id } }
                                                        )
                                                    }
                                                    variant={canEnterMarks ? "green" : "disabled"}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-start gap-3">
                        <FaLock className="mt-0.5 text-slate-500" />
                        <div>
                            <h3 className="font-bold text-slate-800">
                                Your Examination Boundaries
                            </h3>
                            <p className="mt-1 text-sm text-slate-600">
                                You only see examination subjects matching your assigned subject and class. You cannot create examinations, change examination structure, manage other subjects or classes, or approve examinations. Marks entry remains locked until the complete approval chain and examination status requirements are satisfied.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ActionButton({ icon, label, onClick, disabled = false, variant = "blue" }) {
    const variants = {
        blue: "border-blue-600 bg-blue-600 text-white hover:bg-blue-700",
        indigo: "border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700",
        slate: "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
        green: "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700",
        disabled: "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400",
    };

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-bold transition disabled:cursor-not-allowed ${variants[disabled ? "disabled" : variant]}`}
        >
            {icon}
            {label}
        </button>
    );
}

function Metric({ label, value, icon }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        {label}
                    </p>
                    <p className="mt-2 text-3xl font-extrabold text-slate-900">
                        {value}
                    </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                    {icon}
                </div>
            </div>
        </div>
    );
}

export default ExaminationRoleDashboard;