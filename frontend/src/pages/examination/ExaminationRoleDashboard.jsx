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

function ExaminationRoleDashboard() {
    const { selectedRole, activeRole, role, roles } = useRole();

    const [loading, setLoading] = useState(true);
    const [roleId, setRoleId] = useState(null);
    const [profile, setProfile] = useState(null);
    const [queue, setQueue] = useState([]);
    const [error, setError] = useState("");

    /*
    ============================================================
    ROLE CONTEXT
    ============================================================
    */

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

            if (
                Number.isFinite(numberValue) &&
                numberValue > 0
            ) {
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

        if (
            Array.isArray(roles) &&
            roles.length === 1
        ) {
            const onlyRole = roles[0];

            const id = Number(
                onlyRole?.id ??
                onlyRole?.role_id ??
                0
            );

            if (
                Number.isFinite(id) &&
                id > 0
            ) {
                return id;
            }
        }

        return null;
    }, [
        selectedRole,
        activeRole,
        role,
        roles,
    ]);

    /*
    ============================================================
    LOAD CURRENT USER
    ============================================================
    */

    const loadRole = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const {
                data: {
                    user,
                },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError) {
                throw authError;
            }

            if (!user?.id) {
                throw new Error(
                    "User session not found."
                );
            }

            const {
                data: currentProfile,
                error: profileError,
            } = await supabase
                .from("profiles")
                .select(`
                    id,
                    full_name,
                    role_id,
                    school_id,
                    teacher_id
                `)
                .eq("id", user.id)
                .maybeSingle();

            if (profileError) {
                throw profileError;
            }

            if (!currentProfile) {
                throw new Error(
                    "Your profile could not be found."
                );
            }

            const contextRoleId =
                getSelectedRoleId();

            const profileRoleId =
                Number(
                    currentProfile?.role_id || 0
                );

            const currentRole =
                contextRoleId ||
                profileRoleId ||
                null;

            setProfile(currentProfile);
            setRoleId(currentRole);

            /*
            --------------------------------------------------------
            APPROVAL QUEUE
            --------------------------------------------------------
            */

            if (
                [2, 3].includes(
                    currentRole
                )
            ) {
                await loadApprovalQueue(
                    currentProfile,
                    currentRole
                );
            } else {
                setQueue([]);
            }

        } catch (err) {
            console.error(
                "EXAMINATION ROLE DASHBOARD ERROR:",
                err
            );

            setError(
                err?.message ||
                "Failed to load examination access."
            );

        } finally {
            setLoading(false);
        }
    }, [getSelectedRoleId]);

    /*
    ============================================================
    APPROVAL QUEUE
    ============================================================
    */

    const loadApprovalQueue = async (
        currentProfile,
        currentRole
    ) => {
        if (!currentProfile?.school_id) {
            setQueue([]);
            return;
        }

        const {
            data: exams,
            error: examsError,
        } = await supabase
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
            .eq(
                "school_id",
                currentProfile.school_id
            )
            .order(
                "created_at",
                {
                    ascending: false,
                }
            );

        if (examsError) {
            throw examsError;
        }

        const examRows = exams || [];

        const examIds = examRows
            .map(row => row.id)
            .filter(Boolean);

        if (!examIds.length) {
            setQueue([]);
            return;
        }

        /*
        IMPORTANT:
        approval_status removed.
        The verified approval fields are used.
        */

        const {
            data: examSubjects,
            error: subjectError,
        } = await supabase
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
            .in(
                "exam_id",
                examIds
            );

        if (subjectError) {
            throw subjectError;
        }

        const pending =
            (examSubjects || [])
                .filter(row => {

                    const academic =
                        Boolean(
                            row.approved_by_academic
                        );

                    const deputy =
                        Boolean(
                            row.approved_by_deputy
                        );

                    const headmaster =
                        Boolean(
                            row.approved_by_headmaster
                        );

                    if (
                        currentRole === 3
                    ) {
                        return (
                            academic &&
                            !deputy &&
                            !headmaster
                        );
                    }

                    return (
                        academic &&
                        deputy &&
                        !headmaster
                    );
                });

        if (!pending.length) {
            setQueue([]);
            return;
        }

        const subjectIds = [
            ...new Set(
                pending
                    .map(row => row.subject_id)
                    .filter(Boolean)
            ),
        ];

        const classIds = [
            ...new Set(
                pending
                    .map(row => row.class_id)
                    .filter(Boolean)
            ),
        ];

        const [
            subjectResult,
            classResult,
        ] = await Promise.all([

            subjectIds.length
                ? supabase
                    .from("subjects")
                    .select(`
                        id,
                        subject_name,
                        subject_code
                    `)
                    .in(
                        "id",
                        subjectIds
                    )
                : Promise.resolve({
                    data: [],
                    error: null,
                }),

            classIds.length
                ? supabase
                    .from("classes")
                    .select(`
                        id,
                        class_name,
                        short_name
                    `)
                    .in(
                        "id",
                        classIds
                    )
                : Promise.resolve({
                    data: [],
                    error: null,
                }),
        ]);

        if (subjectResult.error) {
            throw subjectResult.error;
        }

        if (classResult.error) {
            throw classResult.error;
        }

        const examMap =
            new Map(
                examRows.map(
                    row => [
                        String(row.id),
                        row,
                    ]
                )
            );

        const subjectMap =
            new Map(
                (subjectResult.data || [])
                    .map(
                        row => [
                            String(row.id),
                            row,
                        ]
                    )
            );

        const classMap =
            new Map(
                (classResult.data || [])
                    .map(
                        row => [
                            String(row.id),
                            row,
                        ]
                    )
            );

        setQueue(
            pending.map(row => ({
                ...row,

                exam:
                    examMap.get(
                        String(row.exam_id)
                    ) || null,

                subject:
                    subjectMap.get(
                        String(row.subject_id)
                    ) || null,

                classRow:
                    classMap.get(
                        String(row.class_id)
                    ) || null,
            }))
        );
    };

    /*
    ============================================================
    RELOAD WHEN ROLE CHANGES
    ============================================================
    */

    useEffect(() => {
        loadRole();
    }, [loadRole]);

    /*
    ============================================================
    LOADING
    ============================================================
    */

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

    /*
    ============================================================
    ERROR
    ============================================================
    */

    if (error) {
        return (
            <div className="min-h-[500px] bg-slate-50 p-6">

                <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">

                    <p className="font-bold">
                        Unable to load Examination
                    </p>

                    <p className="mt-1 text-sm">
                        {error}
                    </p>

                </div>

            </div>
        );
    }

    /*
    ============================================================
    SUPER ADMIN / ACADEMIC MASTER
    ============================================================
    */

    if ([1, 4].includes(roleId)) {
        return (
            <ExaminationDashboard />
        );
    }

    /*
    ============================================================
    SECRETARY
    ============================================================
    */

    if (roleId === 7) {
        return (
            <ExamPrintingUnit />
        );
    }

    /*
    ============================================================
    SUBJECT TEACHER
    ============================================================
    */

    if (roleId === 5) {
        return (
            <SubjectTeacherDashboard
                profile={profile}
            />
        );
    }

    /*
    ============================================================
    OTHER APPROVAL ROLES
    ============================================================
    */

    return (
        <RoleSpecificDashboard
            roleId={roleId}
            profile={profile}
            queue={queue}
        />
    );
}

/*
================================================================
APPROVAL DASHBOARD
================================================================
*/

function RoleSpecificDashboard({
    roleId,
    profile,
    queue,
}) {
    const navigate = useNavigate();

    const roleName =
        ROLE_LABELS[roleId] ||
        "User";

    const title =
        "Examination Approval Console";

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
                                Signed in as{" "}
                                {profile?.full_name ||
                                    roleName}{" "}
                                •{" "}
                                {roleName}
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

                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                                Create
                            </span>

                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                                Edit
                            </span>

                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                                Other subjects
                            </span>

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

                            {queue.map(row => (

                                <div
                                    key={row.id}
                                    className="flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between"
                                >

                                    <div>

                                        <p className="font-bold text-slate-900">
                                            {row.exam?.exam_name ||
                                                "Examination"}
                                        </p>

                                        <p className="mt-1 text-sm text-slate-700">

                                            {row.subject?.subject_name ||
                                                row.subject?.subject_code ||
                                                `Subject ${row.subject_id}`}

                                            <span className="mx-2 text-slate-300">
                                                •
                                            </span>

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
                                            navigate(
                                                `/examination/${row.exam_id}/approval`,
                                                {
                                                    state: {
                                                        examSubjectId:
                                                            row.id,
                                                    },
                                                }
                                            )
                                        }
                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"
                                    >
                                        Open Approval

                                        <FaArrowRight />

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

/*
================================================================
SUBJECT TEACHER EXAMINATION DASHBOARD
================================================================
*/

function SubjectTeacherDashboard({
    profile,
}) {
    const navigate = useNavigate();

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    const [workItems, setWorkItems] =
        useState([]);

    useEffect(() => {

        let mounted = true;

        const loadTeacherWork = async () => {

            try {

                setLoading(true);
                setError("");

                if (
                    !profile?.school_id ||
                    !profile?.teacher_id
                ) {
                    throw new Error(
                        "Your profile is not linked to a school and teacher record."
                    );
                }

                /*
                ====================================================
                STEP 1
                GET EXACT TEACHER ASSIGNMENTS
                ====================================================
                */

                const {
                    data: assignments,
                    error: assignmentError,
                } = await supabase
                    .from("teacher_assignments")
                    .select(`
                        id,
                        subject_id,
                        class_id
                    `)
                    .eq(
                        "school_id",
                        profile.school_id
                    )
                    .eq(
                        "teacher_id",
                        profile.teacher_id
                    );

                if (assignmentError) {
                    throw assignmentError;
                }

                const assignmentRows =
                    assignments || [];

                if (!assignmentRows.length) {

                    if (mounted) {
                        setWorkItems([]);
                    }

                    return;
                }

                /*
                ====================================================
                STEP 2
                BUILD EXACT SUBJECT + CLASS PAIRS
                ====================================================
                */

                const pairs =
                    new Set();

                assignmentRows.forEach(
                    assignment => {

                        const key =
                            makePairKey(
                                assignment.subject_id,
                                assignment.class_id
                            );

                        if (key) {
                            pairs.add(key);
                        }
                    }
                );

                if (!pairs.size) {

                    if (mounted) {
                        setWorkItems([]);
                    }

                    return;
                }

                /*
                ====================================================
                STEP 3
                IMPORTANT FIX

                DO NOT FIRST FILTER EXAMS BY exams.school_id.

                The real relationship is:

                teacher assignment
                    ↓
                subject + class
                    ↓
                exam_subjects
                    ↓
                exam_id
                    ↓
                exams

                This allows an examination created by Academic
                Master to reach the teacher even if exams.school_id
                is NULL or was not populated.
                ====================================================
                */

                const subjectIds = [
                    ...new Set(
                        assignmentRows
                            .map(
                                row =>
                                    row.subject_id
                            )
                            .filter(Boolean)
                    ),
                ];

                const classIds = [
                    ...new Set(
                        assignmentRows
                            .map(
                                row =>
                                    row.class_id
                            )
                            .filter(Boolean)
                    ),
                ];

                /*
                ====================================================
                STEP 4
                FIND EXAM SUBJECTS DIRECTLY FROM ASSIGNMENT
                ====================================================
                */

                const {
                    data: examSubjects,
                    error: examSubjectError,
                } = await supabase
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
                    .in(
                        "subject_id",
                        subjectIds
                    )
                    .in(
                        "class_id",
                        classIds
                    );

                if (examSubjectError) {
                    throw examSubjectError;
                }

                /*
                ====================================================
                STEP 5
                EXACT PAIR MATCH
                ====================================================
                */

                const matching =
                    (examSubjects || [])
                        .filter(row => {

                            return pairs.has(
                                makePairKey(
                                    row.subject_id,
                                    row.class_id
                                )
                            );

                        });

                if (!matching.length) {

                    if (mounted) {
                        setWorkItems([]);
                    }

                    return;
                }

                /*
                ====================================================
                STEP 6
                GET ONLY THE EXAMS REFERENCED BY THOSE
                EXAM SUBJECTS

                NO exams.school_id FILTER HERE.
                ====================================================
                */

                const examIds = [
                    ...new Set(
                        matching
                            .map(
                                row =>
                                    row.exam_id
                            )
                            .filter(Boolean)
                    ),
                ];

                const [
                    examResult,
                    subjectResult,
                    classResult,
                ] = await Promise.all([

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
                            .in(
                                "id",
                                examIds
                            )
                        : Promise.resolve({
                            data: [],
                            error: null,
                        }),

                    subjectIds.length
                        ? supabase
                            .from("subjects")
                            .select(`
                                id,
                                subject_name,
                                subject_code
                            `)
                            .in(
                                "id",
                                subjectIds
                            )
                        : Promise.resolve({
                            data: [],
                            error: null,
                        }),

                    classIds.length
                        ? supabase
                            .from("classes")
                            .select(`
                                id,
                                class_name,
                                short_name
                            `)
                            .in(
                                "id",
                                classIds
                            )
                        : Promise.resolve({
                            data: [],
                            error: null,
                        }),
                ]);

                if (examResult.error) {
                    throw examResult.error;
                }

                if (subjectResult.error) {
                    throw subjectResult.error;
                }

                if (classResult.error) {
                    throw classResult.error;
                }

                /*
                ====================================================
                STEP 7
                LOAD PAPERS ONLY FOR TEACHER'S EXAM SUBJECTS
                ====================================================
                */

                const examSubjectIds =
                    matching
                        .map(
                            row => row.id
                        )
                        .filter(Boolean);

                const {
                    data: papers,
                    error: paperError,
                } = examSubjectIds.length
                    ? await supabase
                        .from("exam_papers")
                        .select(`
                            id,
                            exam_subject_id,
                            file_name,
                            status,
                            ai_status,
                            created_at
                        `)
                        .in(
                            "exam_subject_id",
                            examSubjectIds
                        )
                        .order(
                            "created_at",
                            {
                                ascending: false,
                            }
                        )
                    : {
                        data: [],
                        error: null,
                    };

                if (paperError) {
                    throw paperError;
                }

                /*
                ====================================================
                STEP 8
                MAP DATA
                ====================================================
                */

                const examMap =
                    new Map(
                        (examResult.data || [])
                            .map(
                                row => [
                                    String(row.id),
                                    row,
                                ]
                            )
                    );

                const subjectMap =
                    new Map(
                        (subjectResult.data || [])
                            .map(
                                row => [
                                    String(row.id),
                                    row,
                                ]
                            )
                    );

                const classMap =
                    new Map(
                        (classResult.data || [])
                            .map(
                                row => [
                                    String(row.id),
                                    row,
                                ]
                            )
                    );

                /*
                ====================================================
                LATEST PAPER PER EXAM SUBJECT
                ====================================================
                */

                const paperMap =
                    new Map();

                (papers || [])
                    .forEach(paper => {

                        const key =
                            String(
                                paper.exam_subject_id
                            );

                        if (
                            !paperMap.has(key)
                        ) {
                            paperMap.set(
                                key,
                                paper
                            );
                        }

                    });

                /*
                ====================================================
                STEP 9
                BUILD FINAL TEACHER WORK
                ====================================================
                */

                const normalized =
                    matching.map(row => ({

                        ...row,

                        exam:
                            examMap.get(
                                String(
                                    row.exam_id
                                )
                            ) || null,

                        subject:
                            subjectMap.get(
                                String(
                                    row.subject_id
                                )
                            ) || null,

                        classRow:
                            classMap.get(
                                String(
                                    row.class_id
                                )
                            ) || null,

                        paper:
                            paperMap.get(
                                String(
                                    row.id
                                )
                            ) || null,

                    }));

                /*
                ====================================================
                REMOVE INVALID ROWS

                If exam record itself is missing, don't show a
                broken examination card.
                ====================================================
                */

                const validRows =
                    normalized.filter(
                        row =>
                            Boolean(row.exam)
                    );

                /*
                ====================================================
                REMOVE DUPLICATES
                ====================================================
                */

                const unique =
                    Array.from(
                        new Map(
                            validRows.map(
                                row => [
                                    String(row.id),
                                    row,
                                ]
                            )
                        ).values()
                    );

                if (mounted) {
                    setWorkItems(
                        unique
                    );
                }

            } catch (err) {

                console.error(
                    "SUBJECT TEACHER WORKLOAD ERROR:",
                    err
                );

                if (mounted) {
                    setError(
                        err?.message ||
                        "Failed to load your examination work."
                    );
                }

            } finally {

                if (mounted) {
                    setLoading(false);
                }

            }

        };

        loadTeacherWork();

        return () => {
            mounted = false;
        };

    }, [profile]);

    /*
    ============================================================
    COUNTERS
    ============================================================
    */

    const counts =
        useMemo(() => {

            return {

                total:
                    workItems.length,

                awaitingUpload:
                    workItems.filter(
                        row =>
                            !row.paper?.file_name
                    ).length,

                uploaded:
                    workItems.filter(
                        row =>
                            Boolean(
                                row.paper?.file_name
                            )
                    ).length,

                approved:
                    workItems.filter(
                        row =>
                            row.approved_by_academic &&
                            row.approved_by_deputy &&
                            row.approved_by_headmaster
                    ).length,

            };

        }, [workItems]);

    /*
    ============================================================
    LOADING
    ============================================================
    */

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

    /*
    ============================================================
    SUBJECT TEACHER UI
    ============================================================
    */

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
                                Examinations are automatically shown when they contain your assigned subject and class.
                            </p>

                            <p className="mt-3 text-xs font-semibold text-slate-400">
                                {profile?.full_name ||
                                    "Subject Teacher"}
                            </p>

                        </div>

                        <div className="rounded-2xl bg-blue-50 p-5 text-center">

                            <FaTasks className="mx-auto text-2xl text-blue-600" />

                            <p className="mt-2 text-xs font-bold uppercase tracking-wide text-blue-700">
                                Assigned Work
                            </p>

                            <p className="mt-1 text-2xl font-extrabold text-blue-900">
                                {counts.total}
                            </p>

                        </div>

                    </div>

                </div>

                {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">

                    <Metric
                        label="Assigned"
                        value={counts.total}
                        icon={<FaTasks />}
                    />

                    <Metric
                        label="Awaiting Upload"
                        value={counts.awaitingUpload}
                        icon={<FaCloudUploadAlt />}
                    />

                    <Metric
                        label="Uploaded"
                        value={counts.uploaded}
                        icon={<FaFilePdf />}
                    />

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
                            Examinations created by Academic Master are automatically available here when your assigned subject and class are included.
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

                            {workItems.map(row => {

                                const fullyApproved =
                                    Boolean(
                                        row.approved_by_academic &&
                                        row.approved_by_deputy &&
                                        row.approved_by_headmaster
                                    );

                                return (
                                    <div
                                        key={row.id}
                                        className="flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between"
                                    >

                                        <div>

                                            <p className="font-bold text-slate-900">
                                                {row.exam?.exam_name ||
                                                    "Examination"}
                                            </p>

                                            <p className="mt-1 text-sm text-slate-700">

                                                {row.subject?.subject_name ||
                                                    row.subject?.subject_code ||
                                                    `Subject ${row.subject_id}`}

                                                <span className="mx-2 text-slate-300">
                                                    •
                                                </span>

                                                {row.classRow?.class_name ||
                                                    row.classRow?.short_name ||
                                                    `Class ${row.class_id}`}

                                            </p>

                                            <div className="mt-2 flex flex-wrap gap-2">

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

                                                {fullyApproved && (
                                                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                                                        Approval Complete
                                                    </span>
                                                )}

                                                {!fullyApproved && (
                                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                                                        Approval Pending
                                                    </span>
                                                )}

                                            </div>

                                        </div>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                navigate(
                                                    `/examination/${row.exam_id}/subject-upload?examSubjectId=${encodeURIComponent(
                                                        row.id
                                                    )}`
                                                )
                                            }
                                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"
                                        >

                                            <FaCloudUploadAlt />

                                            {row.paper?.file_name
                                                ? "Manage Paper"
                                                : "Upload Paper"}

                                        </button>

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
                                You only see examinations containing your assigned subject and class. You cannot create examinations, edit examination structure, manage other subjects or classes, or approve examinations.
                            </p>

                        </div>

                    </div>

                </div>

            </div>

        </div>
    );
}

/*
================================================================
METRIC
================================================================
*/

function Metric({
    label,
    value,
    icon,
}) {
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
