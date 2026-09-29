import { useEffect, useMemo, useRef, useState } from "react";

import { useNavigate, useParams } from "react-router-dom";

import axios from "axios";

import {
    FaArrowLeft,
    FaCheckCircle,
    FaCloudUploadAlt,
    FaFilePdf,
    FaSpinner,
    FaTimes,
    FaSyncAlt,
    FaExclamationTriangle,
} from "react-icons/fa";

import { supabase } from "../../services/supabase";

const API_URL = "https://africore-erp-pro.onrender.com/api";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

function SubjectTeacherExamUpload() {
    const navigate = useNavigate();

    const { examId } = useParams();

    const fileInputRef = useRef(null);

    const [loading, setLoading] = useState(true);

    const [processing, setProcessing] = useState(false);

    const [error, setError] = useState("");

    const [diagnostic, setDiagnostic] = useState(null);

    const [profile, setProfile] = useState(null);

    const [exam, setExam] = useState(null);

    const [teacherAssignments, setTeacherAssignments] = useState([]);

    const [examSubjects, setExamSubjects] = useState([]);

    const [selectedExamSubjectId, setSelectedExamSubjectId] =
        useState("");

    const [selectedFile, setSelectedFile] = useState(null);

    const [uploaded, setUploaded] = useState(false);

    const [uploadResult, setUploadResult] = useState(null);

    // ------------------------------------------------------------
    // HELPERS
    // ------------------------------------------------------------

    const normalizeId = (value) => {
        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return "";
        }

        return String(value);
    };

    const assignmentPair = (subjectId, classId) =>
        `${normalizeId(subjectId)}:${normalizeId(classId)}`;

    // ------------------------------------------------------------
    // LOAD DATA
    // ------------------------------------------------------------

    const loadData = async () => {
        try {
            setLoading(true);
            setError("");
            setDiagnostic(null);

            if (!examId) {
                throw new Error(
                    "Examination ID haipo kwenye URL."
                );
            }

            const numericExamId = Number(examId);

            if (!Number.isFinite(numericExamId)) {
                throw new Error(
                    "Examination ID iliyopo kwenye URL si sahihi."
                );
            }

            // ----------------------------------------------------
            // AUTH USER
            // ----------------------------------------------------

            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError) {
                throw authError;
            }

            if (!user?.id) {
                throw new Error(
                    "User session haijapatikana. Tafadhali login tena."
                );
            }

            // ----------------------------------------------------
            // PROFILE
            // ----------------------------------------------------

            const {
                data: currentProfile,
                error: profileError,
            } = await supabase
                .from("profiles")
                .select(
                    "id, full_name, school_id, role_id, teacher_id"
                )
                .eq("id", user.id)
                .maybeSingle();

            if (profileError) {
                throw profileError;
            }

            if (!currentProfile) {
                throw new Error(
                    "Profile ya user huyu haijapatikana."
                );
            }

            setProfile(currentProfile);

            // ----------------------------------------------------
            // ACTIVE ROLES
            //
            // Subject Teacher = role 5
            //
            // profiles.role_id may be only primary role,
            // therefore profile_roles is also checked.
            // ----------------------------------------------------

            const {
                data: profileRoles,
                error: profileRolesError,
            } = await supabase
                .from("profile_roles")
                .select(
                    "role_id, is_primary, is_active"
                )
                .eq(
                    "profile_id",
                    currentProfile.id
                )
                .eq(
                    "is_active",
                    true
                );

            if (profileRolesError) {
                throw profileRolesError;
            }

            const activeRoleIds = new Set(
                (profileRoles || [])
                    .map((row) =>
                        Number(row.role_id)
                    )
                    .filter(
                        Number.isFinite
                    )
            );

            if (
                currentProfile.role_id !== null &&
                currentProfile.role_id !== undefined &&
                currentProfile.role_id !== ""
            ) {
                activeRoleIds.add(
                    Number(
                        currentProfile.role_id
                    )
                );
            }

            const isSubjectTeacher =
                activeRoleIds.has(5);

            if (!isSubjectTeacher) {
                throw new Error(
                    "This upload page is only for Subject Teachers."
                );
            }

            // ----------------------------------------------------
            // TEACHER ID
            // ----------------------------------------------------

            if (
                currentProfile.teacher_id === null ||
                currentProfile.teacher_id === undefined ||
                currentProfile.teacher_id === ""
            ) {
                throw new Error(
                    "Profile yako haina teacher_id. Subject Teacher lazima awe linked na teacher record."
                );
            }

            // ----------------------------------------------------
            // SCHOOL ID
            // ----------------------------------------------------

            if (
                currentProfile.school_id === null ||
                currentProfile.school_id === undefined ||
                currentProfile.school_id === ""
            ) {
                throw new Error(
                    "Profile yako haina school_id."
                );
            }

            const teacherId = Number(
                currentProfile.teacher_id
            );

            const schoolId = Number(
                currentProfile.school_id
            );

            if (!Number.isFinite(teacherId)) {
                throw new Error(
                    "teacher_id ya profile si valid."
                );
            }

            if (!Number.isFinite(schoolId)) {
                throw new Error(
                    "school_id ya profile si valid."
                );
            }

            // ----------------------------------------------------
            // EXAMINATION
            //
            // DO NOT filter by school_id here.
            // Existing exams may have NULL school_id.
            // ----------------------------------------------------

            const {
                data: examRow,
                error: examError,
            } = await supabase
                .from("exams")
                .select(
                    "id, school_id, exam_name, exam_type, term, start_date, end_date, status"
                )
                .eq(
                    "id",
                    numericExamId
                )
                .maybeSingle();

            if (examError) {
                throw examError;
            }

            if (!examRow) {
                throw new Error(
                    `Examination ${numericExamId} haijapatikana.`
                );
            }

            setExam(examRow);

            // ----------------------------------------------------
            // TEACHER ASSIGNMENTS
            //
            // teacher_assignments has:
            // id
            // school_id
            // teacher_id
            // subject_id
            // class_id
            // ----------------------------------------------------

            const {
                data: assignments,
                error: assignmentError,
            } = await supabase
                .from("teacher_assignments")
                .select(
                    "id, school_id, teacher_id, subject_id, class_id"
                )
                .eq(
                    "teacher_id",
                    teacherId
                )
                .eq(
                    "school_id",
                    schoolId
                );

            if (assignmentError) {
                throw assignmentError;
            }

            const safeAssignments =
                assignments || [];

            setTeacherAssignments(
                safeAssignments
            );

            // ----------------------------------------------------
            // EXAM SUBJECTS
            // ----------------------------------------------------

            const {
                data: subjectRows,
                error: examSubjectsError,
            } = await supabase
                .from("exam_subjects")
                .select(
                    [
                        "id",
                        "exam_id",
                        "subject_id",
                        "class_id",
                        "full_marks",
                        "pass_marks",
                        "question_selection_type",
                        "questions_to_answer",
                        "approved_by_academic",
                        "approved_by_deputy",
                        "approved_by_headmaster",
                    ].join(", ")
                )
                .eq(
                    "exam_id",
                    numericExamId
                );

            if (examSubjectsError) {
                throw examSubjectsError;
            }

            const safeSubjectRows =
                subjectRows || [];

            // ----------------------------------------------------
            // DIAGNOSTIC
            // ----------------------------------------------------

            setDiagnostic({
                teacherId,
                schoolId,
                examId: numericExamId,
                teacherAssignmentsFound:
                    safeAssignments.length,
                examinationSubjectsFound:
                    safeSubjectRows.length,
            });

            // ----------------------------------------------------
            // NO ASSIGNMENT
            // ----------------------------------------------------

            if (!safeAssignments.length) {
                setExamSubjects([]);

                throw new Error(
                    "Hakuna teacher assignment iliyopatikana kwa teacher huyu kwenye school hii."
                );
            }

            // ----------------------------------------------------
            // ALLOWED SUBJECT + CLASS PAIRS
            // ----------------------------------------------------

            const allowedPairs = new Set(
                safeAssignments.map(
                    (row) =>
                        assignmentPair(
                            row.subject_id,
                            row.class_id
                        )
                )
            );

            // ----------------------------------------------------
            // NO EXAM SUBJECTS
            // ----------------------------------------------------

            if (!safeSubjectRows.length) {
                setExamSubjects([]);

                throw new Error(
                    `Examination ${numericExamId} haina exam subjects zilizosanidiwa.`
                );
            }

            // ----------------------------------------------------
            // SUBJECT IDS
            // ----------------------------------------------------

            const subjectIds = [
                ...new Set(
                    safeSubjectRows
                        .map(
                            (row) =>
                                row.subject_id
                        )
                        .filter(
                            (value) =>
                                value !== null &&
                                value !== undefined
                        )
                ),
            ];

            // ----------------------------------------------------
            // CLASS IDS
            // ----------------------------------------------------

            const classIds = [
                ...new Set(
                    safeSubjectRows
                        .map(
                            (row) =>
                                row.class_id
                        )
                        .filter(
                            (value) =>
                                value !== null &&
                                value !== undefined
                        )
                ),
            ];

            // ----------------------------------------------------
            // LOAD SUBJECTS / CLASSES / PAPERS
            // ----------------------------------------------------

            const [
                subjectsResult,
                classesResult,
                papersResult,
            ] = await Promise.all([
                subjectIds.length
                    ? supabase
                          .from("subjects")
                          .select(
                              "id, subject_name, subject_code"
                          )
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
                          .select(
                              "id, class_name, short_name"
                          )
                          .in(
                              "id",
                              classIds
                          )
                    : Promise.resolve({
                          data: [],
                          error: null,
                      }),

                supabase
                    .from("exam_papers")
                    .select(
                        "id, exam_subject_id, file_name, status, ai_status, created_at"
                    )
                    .eq(
                        "exam_id",
                        numericExamId
                    )
                    .order(
                        "created_at",
                        {
                            ascending: false,
                        }
                    ),
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

            // ----------------------------------------------------
            // SUBJECT MAP
            // ----------------------------------------------------

            const subjectMap = new Map(
                (subjectsResult.data || []).map(
                    (row) => [
                        String(row.id),
                        row,
                    ]
                )
            );

            // ----------------------------------------------------
            // CLASS MAP
            // ----------------------------------------------------

            const classMap = new Map(
                (classesResult.data || []).map(
                    (row) => [
                        String(row.id),
                        row,
                    ]
                )
            );

            // ----------------------------------------------------
            // PAPER MAP
            // ----------------------------------------------------

            const paperMap = new Map();

            (papersResult.data || []).forEach(
                (paper) => {
                    const key = String(
                        paper.exam_subject_id
                    );

                    if (!paperMap.has(key)) {
                        paperMap.set(
                            key,
                            paper
                        );
                    }
                }
            );

            // ----------------------------------------------------
            // STRICT MATCH
            //
            // Subject + Class
            // ----------------------------------------------------

            const allowedRows =
                safeSubjectRows
                    .filter(
                        (row) =>
                            allowedPairs.has(
                                assignmentPair(
                                    row.subject_id,
                                    row.class_id
                                )
                            )
                    )
                    .map((row) => ({
                        ...row,

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

            setExamSubjects(
                allowedRows
            );

            // ----------------------------------------------------
            // AUTO SELECT
            // ----------------------------------------------------

            if (
                allowedRows.length === 1
            ) {
                setSelectedExamSubjectId(
                    String(
                        allowedRows[0].id
                    )
                );
            } else if (
                allowedRows.length > 1
            ) {
                setSelectedExamSubjectId("");
            }
        } catch (err) {
            console.error(
                "SUBJECT TEACHER EXAM UPLOAD LOAD ERROR:",
                err
            );

            setError(
                err?.message ||
                    "Failed to load your assigned examination work."
            );
        } finally {
            setLoading(false);
        }
    };

    // ------------------------------------------------------------
    // INITIAL LOAD
    // ------------------------------------------------------------

    useEffect(() => {
        loadData();
    }, [examId]);

    // ------------------------------------------------------------
    // SELECTED ROW
    // ------------------------------------------------------------

    const selectedRow = useMemo(
        () =>
            examSubjects.find(
                (row) =>
                    String(row.id) ===
                    String(
                        selectedExamSubjectId
                    )
            ) || null,
        [
            examSubjects,
            selectedExamSubjectId,
        ]
    );

    // ------------------------------------------------------------
    // FILE VALIDATION
    // ------------------------------------------------------------

    const validateFile = (file) => {
        if (!file) {
            return "Chagua PDF ya examination kwanza.";
        }

        const isPdf =
            file.type ===
                "application/pdf" ||
            /\.pdf$/i.test(
                file.name || ""
            );

        if (!isPdf) {
            return "Tafadhali chagua PDF file pekee.";
        }

        if (file.size > MAX_FILE_SIZE) {
            return "PDF imezidi ukubwa unaoruhusiwa wa 20MB.";
        }

        return "";
    };

    // ------------------------------------------------------------
    // HANDLE FILE
    // ------------------------------------------------------------

    const handleFile = (file) => {
        setError("");
        setUploaded(false);
        setUploadResult(null);

        const validationError =
            validateFile(file);

        if (validationError) {
            setSelectedFile(null);
            setError(validationError);

            if (fileInputRef.current) {
                fileInputRef.current.value =
                    "";
            }

            return;
        }

        setSelectedFile(file);
    };

    // ------------------------------------------------------------
    // STORAGE UPLOAD
    // ------------------------------------------------------------

    const uploadPdfToStorage = async (
        file
    ) => {
        if (!selectedExamSubjectId) {
            throw new Error(
                "Examination subject haijachaguliwa."
            );
        }

        const safeName = String(
            file.name ||
                "exam-paper.pdf"
        )
            .replace(
                /[^a-zA-Z0-9._-]+/g,
                "-"
            )
            .replace(
                /-+/g,
                "-"
            );

        const baseName =
            safeName.replace(
                /\.pdf$/i,
                ""
            ) ||
            "exam-paper";

        const uniquePart =
            typeof crypto !==
                "undefined" &&
            typeof crypto.randomUUID ===
                "function"
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random()
                      .toString(36)
                      .slice(
                          2,
                          10
                      )}`;

        const storagePath =
            `${examId}/${selectedExamSubjectId}/${uniquePart}-${baseName}.pdf`;

        const {
            data,
            error: storageError,
        } = await supabase.storage
            .from("exam-papers")
            .upload(
                storagePath,
                file,
                {
                    cacheControl:
                        "3600",

                    contentType:
                        "application/pdf",

                    upsert: false,
                }
            );

        if (storageError) {
            throw storageError;
        }

        return (
            data?.path ||
            storagePath
        );
    };

    // ------------------------------------------------------------
    // SUBMIT
    // ------------------------------------------------------------

    const handleSubmit = async () => {
        setError("");
        setUploaded(false);
        setUploadResult(null);

        if (!selectedExamSubjectId) {
            setError(
                "Chagua examination subject yako kwanza."
            );

            return;
        }

        if (!selectedFile) {
            setError(
                "Chagua PDF ya examination kwanza."
            );

            return;
        }

        if (!selectedRow) {
            setError(
                "Assigned examination subject haijapatikana."
            );

            return;
        }

        // --------------------------------------------------------
        // FINAL ASSIGNMENT CHECK
        // --------------------------------------------------------

        const matchingAssignment =
            teacherAssignments.find(
                (assignment) =>
                    normalizeId(
                        assignment.subject_id
                    ) ===
                        normalizeId(
                            selectedRow.subject_id
                        ) &&
                    normalizeId(
                        assignment.class_id
                    ) ===
                        normalizeId(
                            selectedRow.class_id
                        )
            );

        if (!matchingAssignment) {
            setError(
                "Huna assignment ya Subject + Class hii. Upload imezuiwa."
            );

            return;
        }

        try {
            setProcessing(true);

            // ----------------------------------------------------
            // STORAGE
            // ----------------------------------------------------

            const storagePath =
                await uploadPdfToStorage(
                    selectedFile
                );

            // ----------------------------------------------------
            // AI BACKEND
            // ----------------------------------------------------

            const formData =
                new FormData();

            formData.append(
                "paper",
                selectedFile,
                selectedFile.name
            );

            formData.append(
                "exam_id",
                String(examId)
            );

            formData.append(
                "exam_subject_id",
                String(
                    selectedExamSubjectId
                )
            );

            formData.append(
                "storage_bucket",
                "exam-papers"
            );

            formData.append(
                "storage_path",
                storagePath
            );

            const response =
                await axios.post(
                    `${API_URL}/ai/analyze-paper`,
                    formData,
                    {
                        headers: {
                            "Content-Type":
                                "multipart/form-data",
                        },

                        maxContentLength:
                            Infinity,

                        maxBodyLength:
                            Infinity,

                        timeout:
                            10 * 60 * 1000,
                    }
                );

            // ----------------------------------------------------
            // VERIFY RESPONSE
            // ----------------------------------------------------

            if (
                !response.data?.success
            ) {
                throw new Error(
                    response.data
                        ?.message ||
                        "Paper imehifadhiwa lakini AI analysis imeshindwa kuikamilisha."
                );
            }

            // ----------------------------------------------------
            // SUCCESS
            // ----------------------------------------------------

            setUploaded(true);

            setUploadResult(
                response.data
            );

            setSelectedFile(null);

            if (fileInputRef.current) {
                fileInputRef.current.value =
                    "";
            }

            // ====================================================
            // IMPORTANT FIX
            //
            // Send examSubjectId BOTH:
            //
            // 1. Query string
            // 2. React Router state
            //
            // The current AI Analysis component reads
            // location.state.examSubjectId.
            //
            // Query string also keeps the exact ID visible
            // in the URL.
            // ====================================================

            navigate(
                `/examination/${examId}/ai-analysis?examSubjectId=${encodeURIComponent(
                    selectedExamSubjectId
                )}`,
                {
                    replace: true,

                    state: {
                        examSubjectId:
                            Number(
                                selectedExamSubjectId
                            ),
                    },
                }
            );
        } catch (err) {
            console.error(
                "SUBJECT TEACHER PAPER UPLOAD ERROR:",
                err
            );

            const backendMessage =
                err?.response
                    ?.data?.message;

            setError(
                backendMessage ||
                    err?.message ||
                    "Paper upload imeshindikana."
            );
        } finally {
            setProcessing(false);
        }
    };

    // ------------------------------------------------------------
    // LOADING
    // ------------------------------------------------------------

    if (loading) {
        return (
            <div className="min-h-[500px] flex items-center justify-center bg-slate-50">
                <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
                    <div className="flex items-center gap-3 text-slate-600">
                        <FaSpinner className="animate-spin text-blue-600" />

                        <span className="text-sm font-medium">
                            Loading your assigned examination...
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    // ------------------------------------------------------------
    // PAGE
    // ------------------------------------------------------------

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-6">
            <div className="mx-auto max-w-5xl space-y-6">

                {/* HEADER */}

                <div className="flex items-start gap-4">
                    <button
                        type="button"
                        onClick={() =>
                            navigate(
                                `/examination/${examId}`
                            )
                        }
                        disabled={processing}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                    >
                        <FaArrowLeft />
                    </button>

                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
                            Subject Teacher
                        </p>

                        <h1 className="mt-1 text-3xl font-extrabold text-slate-900">
                            Upload Examination Paper
                        </h1>

                        <p className="mt-1 text-sm text-slate-500">
                            Upload paper only for your assigned Subject + Class.
                        </p>
                    </div>
                </div>

                {/* EXAMINATION INFO */}

                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                    <p className="text-sm font-semibold text-blue-900">
                        {exam?.exam_name ||
                            "Examination"}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-blue-700">
                        <span>
                            Teacher:{" "}
                            <strong>
                                {profile?.full_name ||
                                    "-"}
                            </strong>
                        </span>

                        <span>
                            Examination ID:{" "}
                            <strong>
                                {exam?.id ||
                                    examId}
                            </strong>
                        </span>

                        <span>
                            Teacher ID:{" "}
                            <strong>
                                {profile?.teacher_id ||
                                    "-"}
                            </strong>
                        </span>

                        <span>
                            School ID:{" "}
                            <strong>
                                {profile?.school_id ||
                                    "-"}
                            </strong>
                        </span>
                    </div>
                </div>

                {/* ERROR */}

                {error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                        <div className="flex items-start gap-3">
                            <FaExclamationTriangle className="mt-0.5 shrink-0 text-red-600" />

                            <div className="min-w-0">
                                <h2 className="font-bold text-red-900">
                                    Upload page verification error
                                </h2>

                                <p className="mt-1 text-sm text-red-700">
                                    {error}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* DIAGNOSTIC */}

                {diagnostic &&
                    !examSubjects.length && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                            <div className="flex items-start gap-3">
                                <FaExclamationTriangle className="mt-0.5 shrink-0 text-amber-600" />

                                <div className="min-w-0 flex-1">
                                    <h2 className="font-bold text-amber-900">
                                        No assigned examination subject found
                                    </h2>

                                    <p className="mt-1 text-sm text-amber-700">
                                        Mfumo haujapata Subject + Class ambayo ime-assigned kwa teacher huyu ndani ya examination hii.
                                    </p>

                                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">

                                        <div className="rounded-xl bg-white p-3">
                                            <p className="text-[10px] font-bold uppercase text-slate-400">
                                                Teacher ID
                                            </p>

                                            <p className="mt-1 font-bold text-slate-900">
                                                {
                                                    diagnostic.teacherId
                                                }
                                            </p>
                                        </div>

                                        <div className="rounded-xl bg-white p-3">
                                            <p className="text-[10px] font-bold uppercase text-slate-400">
                                                School ID
                                            </p>

                                            <p className="mt-1 font-bold text-slate-900">
                                                {
                                                    diagnostic.schoolId
                                                }
                                            </p>
                                        </div>

                                        <div className="rounded-xl bg-white p-3">
                                            <p className="text-[10px] font-bold uppercase text-slate-400">
                                                Examination ID
                                            </p>

                                            <p className="mt-1 font-bold text-slate-900">
                                                {
                                                    diagnostic.examId
                                                }
                                            </p>
                                        </div>

                                        <div className="rounded-xl bg-white p-3">
                                            <p className="text-[10px] font-bold uppercase text-slate-400">
                                                Teacher Assignments
                                            </p>

                                            <p className="mt-1 font-bold text-slate-900">
                                                {
                                                    diagnostic.teacherAssignmentsFound
                                                }
                                            </p>
                                        </div>

                                        <div className="rounded-xl bg-white p-3">
                                            <p className="text-[10px] font-bold uppercase text-slate-400">
                                                Exam Subjects
                                            </p>

                                            <p className="mt-1 font-bold text-slate-900">
                                                {
                                                    diagnostic.examinationSubjectsFound
                                                }
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={
                                            loadData
                                        }
                                        disabled={
                                            loading ||
                                            processing
                                        }
                                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                                    >
                                        <FaSyncAlt
                                            className={
                                                loading
                                                    ? "animate-spin"
                                                    : ""
                                            }
                                        />

                                        Check Again
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                {/* SUCCESS */}

                {uploaded && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                        <div className="flex items-start gap-3">
                            <FaCheckCircle className="mt-0.5 text-emerald-600" />

                            <div>
                                <h2 className="font-bold text-emerald-900">
                                    Paper uploaded successfully
                                </h2>

                                <p className="mt-1 text-sm text-emerald-700">
                                    Paper imeingia kwenye examination processing workflow.
                                </p>

                                <p className="mt-1 text-sm text-emerald-700">
                                    Approval remains with the Academic Master, Deputy Headmaster and Headmaster.
                                </p>

                                {uploadResult?.total_questions !==
                                    undefined && (
                                    <p className="mt-2 text-xs font-semibold text-emerald-800">
                                        AI detected{" "}
                                        {
                                            uploadResult.total_questions
                                        }{" "}
                                        question(s).
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* MAIN UPLOAD AREA */}

                {examSubjects.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">

                        {/* SUBJECT + CLASS */}

                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-700">
                                Your Examination Subject + Class
                            </label>

                            <select
                                value={
                                    selectedExamSubjectId
                                }
                                onChange={(e) => {
                                    setSelectedExamSubjectId(
                                        e.target.value
                                    );

                                    setSelectedFile(
                                        null
                                    );

                                    setUploaded(
                                        false
                                    );

                                    setUploadResult(
                                        null
                                    );

                                    setError(
                                        ""
                                    );

                                    if (
                                        fileInputRef.current
                                    ) {
                                        fileInputRef.current.value =
                                            "";
                                    }
                                }}
                                disabled={
                                    processing
                                }
                                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                            >
                                <option value="">
                                    Select your subject + class
                                </option>

                                {examSubjects.map(
                                    (row) => (
                                        <option
                                            key={
                                                row.id
                                            }
                                            value={
                                                row.id
                                            }
                                        >
                                            {row.subject
                                                ?.subject_name ||
                                                row.subject
                                                    ?.subject_code ||
                                                `Subject ${row.subject_id}`}{" "}
                                            â€”{" "}
                                            {row.classRow
                                                ?.class_name ||
                                                row.classRow
                                                    ?.short_name ||
                                                `Class ${row.class_id}`}
                                        </option>
                                    )
                                )}
                            </select>
                        </div>

                        {/* SELECTED DETAILS */}

                        {selectedRow && (
                            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">

                                <div className="rounded-xl bg-blue-50 p-4">
                                    <p className="text-xs font-bold text-blue-600">
                                        SUBJECT
                                    </p>

                                    <p className="mt-1 font-bold text-slate-900">
                                        {selectedRow
                                            .subject
                                            ?.subject_name ||
                                            "-"}
                                    </p>
                                </div>

                                <div className="rounded-xl bg-purple-50 p-4">
                                    <p className="text-xs font-bold text-purple-600">
                                        CLASS
                                    </p>

                                    <p className="mt-1 font-bold text-slate-900">
                                        {selectedRow
                                            .classRow
                                            ?.class_name ||
                                            selectedRow
                                                .classRow
                                                ?.short_name ||
                                            "-"}
                                    </p>
                                </div>

                                <div className="rounded-xl bg-emerald-50 p-4">
                                    <p className="text-xs font-bold text-emerald-600">
                                        PAPER STATUS
                                    </p>

                                    <p className="mt-1 font-bold text-slate-900">
                                        {selectedRow
                                            .paper
                                            ?.file_name
                                            ? "Already Uploaded"
                                            : "Awaiting Upload"}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* FILE UPLOAD */}

                        <div className="mt-7">
                            <input
                                ref={
                                    fileInputRef
                                }
                                type="file"
                                accept="application/pdf,.pdf"
                                onChange={(e) =>
                                    handleFile(
                                        e.target
                                            .files?.[0]
                                    )
                                }
                                className="hidden"
                            />

                            <div
                                onDragOver={(e) =>
                                    e.preventDefault()
                                }
                                onDrop={(e) => {
                                    e.preventDefault();

                                    if (
                                        !processing
                                    ) {
                                        handleFile(
                                            e
                                                .dataTransfer
                                                .files?.[0]
                                        );
                                    }
                                }}
                                onClick={() =>
                                    !processing &&
                                    fileInputRef.current?.click()
                                }
                                className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${
                                    selectedFile
                                        ? "border-emerald-300 bg-emerald-50"
                                        : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50"
                                }`}
                            >
                                <FaCloudUploadAlt className="mx-auto text-4xl text-blue-500" />

                                <h3 className="mt-3 text-lg font-bold text-slate-900">
                                    {selectedFile
                                        ? selectedFile.name
                                        : "Drop examination PDF here or click to browse"}
                                </h3>

                                <p className="mt-1 text-sm text-slate-500">
                                    PDF only â€¢ Maximum 20MB
                                </p>

                                {selectedFile && (
                                    <p className="mt-2 text-xs font-semibold text-emerald-700">
                                        {(
                                            selectedFile.size /
                                            (1024 *
                                                1024)
                                        ).toFixed(
                                            2
                                        )}{" "}
                                        MB selected
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* ACTIONS */}

                        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">

                            {selectedFile && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedFile(
                                            null
                                        );

                                        if (
                                            fileInputRef.current
                                        ) {
                                            fileInputRef.current.value =
                                                "";
                                        }

                                        setError(
                                            ""
                                        );
                                    }}
                                    disabled={
                                        processing
                                    }
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                >
                                    <FaTimes />

                                    Remove File
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={
                                    handleSubmit
                                }
                                disabled={
                                    processing ||
                                    !selectedFile ||
                                    !selectedExamSubjectId ||
                                    !selectedRow
                                }
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                                {processing ? (
                                    <FaSpinner className="animate-spin" />
                                ) : (
                                    <FaFilePdf />
                                )}

                                {processing
                                    ? "Uploading & Processing..."
                                    : "Upload Paper"}
                            </button>
                        </div>
                    </div>
                )}

                {/* BACK */}

                <div className="flex justify-start pb-6">
                    <button
                        type="button"
                        onClick={() =>
                            navigate(
                                `/examination/${examId}`
                            )
                        }
                        disabled={processing}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                    >
                        <FaArrowLeft />

                        Back to Examination
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SubjectTeacherExamUpload;
