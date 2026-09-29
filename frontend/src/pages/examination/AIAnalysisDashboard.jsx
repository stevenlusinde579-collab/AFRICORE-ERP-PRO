import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import axios from "axios";

import {
    FaArrowLeft,
    FaBrain,
    FaCheckCircle,
    FaChevronDown,
    FaChevronUp,
    FaCloudUploadAlt,
    FaExclamationTriangle,
    FaFileAlt,
    FaFlask,
    FaLightbulb,
    FaPlay,
    FaRedo,
    FaRobot,
    FaTasks,
    FaUpload,
} from "react-icons/fa";

import {
    useLocation,
    useNavigate,
    useParams,
} from "react-router-dom";

import { supabase } from "../../services/supabase";

// ============================================================
// CONFIG
// ============================================================

const API_URL = "http://localhost:5000/api";


// ============================================================
// CONSTANTS
// ============================================================

const ANALYSIS_POLL_INTERVAL = 3000;

const MAX_ANALYSIS_POLLS = 120;


// ============================================================
// HELPERS
// ============================================================

const normalizeNumber = (
    value,
    fallback = 0
) => {
    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;
};


const normalizeId = (value) => {
    const number = Number(value);

    if (
        !Number.isFinite(number) ||
        number <= 0
    ) {
        return null;
    }

    return number;
};


const normalizeArray = (value) => {
    return Array.isArray(value)
        ? value
        : [];
};


const getQuestionNumber = (
    question
) => {
    return (
        question?.question_number ??
        question?.questionNumber ??
        question?.number ??
        ""
    );
};


const getQuestionText = (
    question
) => {
    return (
        question?.question_text ??
        question?.questionText ??
        question?.text ??
        question?.question ??
        ""
    );
};


const getQuestionTopic = (
    question
) => {
    return (
        question?.topic ??
        question?.topics ??
        ""
    );
};


const getQuestionSubtopic = (
    question
) => {
    return (
        question?.sub_topic ??
        question?.subtopic ??
        question?.subTopic ??
        ""
    );
};


const getQuestionDifficulty = (
    question
) => {
    return (
        question?.difficulty_level ??
        question?.difficulty ??
        "Not specified"
    );
};


const getQuestionBloom = (
    question
) => {
    return (
        question?.bloom_level ??
        question?.blooms_level ??
        question?.bloomsLevel ??
        question?.bloom ??
        "Not specified"
    );
};


const getQuestionType = (
    question
) => {
    return (
        question?.question_type ??
        question?.questionType ??
        "Normal"
    );
};


const getQuestionMaxMarks = (
    question
) => {
    return normalizeNumber(
        question?.max_marks ??
        question?.marks ??
        question?.total_marks ??
        question?.mark ??
        0
    );
};


const getSelectionGroup = (
    question
) => {
    return (
        question?.selection_group ??
        question?.selectionGroup ??
        question?.group ??
        null
    );
};


const isSelectiveQuestion = (
    question
) => {
    return Boolean(
        question?.is_selective ??
        question?.isSelective ??
        question?.selection_required ??
        question?.selectionRequired ??
        question?.selection_group
    );
};


const getSelectionCount = (
    question
) => {
    return normalizeNumber(
        question?.selection_count ??
        question?.selectionCount ??
        0
    );
};


const getSelectionTotal = (
    question
) => {
    return normalizeNumber(
        question?.selection_total ??
        question?.selectionTotal ??
        0
    );
};


const getSelectionInstruction = (
    question
) => {
    return (
        question?.selection_instruction ??
        question?.selectionInstruction ??
        ""
    );
};


const getAIExplanation = (
    question
) => {
    return (
        question?.ai_explanation ??
        question?.aiExplanation ??
        question?.explanation ??
        ""
    );
};


const getConfidence = (
    question
) => {
    const value =
        question?.ai_confidence ??
        question?.confidence ??
        question?.confidence_score ??
        question?.confidenceScore;

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return 0;
    }

    return Math.max(
        0,
        Math.min(
            100,
            number
        )
    );
};


const sortQuestions = (
    items
) => {
    return [...items].sort(
        (a, b) => {
            const aNumber =
                Number(
                    getQuestionNumber(a)
                );

            const bNumber =
                Number(
                    getQuestionNumber(b)
                );

            if (
                Number.isFinite(
                    aNumber
                ) &&
                Number.isFinite(
                    bNumber
                )
            ) {
                return (
                    aNumber -
                    bNumber
                );
            }

            return String(
                getQuestionNumber(a)
            ).localeCompare(
                String(
                    getQuestionNumber(b)
                ),
                undefined,
                {
                    numeric: true,
                }
            );
        }
    );
};


// ============================================================
// STATUS HELPERS
// ============================================================

const normalizeAnalysisStatus = (
    value
) => {
    const status =
        String(
            value ||
            ""
        )
            .trim()
            .toLowerCase();

    if (
        status ===
            "completed" ||
        status ===
            "complete" ||
        status ===
            "success"
    ) {
        return "Completed";
    }

    if (
        status ===
            "processing" ||
        status ===
            "pending" ||
        status ===
            "running" ||
        status ===
            "analyzing" ||
        status ===
            "in_progress"
    ) {
        return "Processing";
    }

    if (
        status ===
            "failed" ||
        status ===
            "error"
    ) {
        return "Failed";
    }

    return value
        ? String(value)
        : "Pending";
};


// ============================================================
// SMALL UI COMPONENTS
// ============================================================

const InfoCard = ({
    icon,
    title,
    value,
    subtitle,
}) => {
    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg shrink-0">
                    {icon}
                </div>

                <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {title}
                    </p>

                    <p className="mt-1 text-2xl font-bold text-slate-900 break-words">
                        {value}
                    </p>

                    {subtitle && (
                        <p className="mt-1 text-xs text-slate-500">
                            {subtitle}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};


const KpiCard = ({
    label,
    value,
    subtitle,
    icon,
}) => {
    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {label}
                    </p>

                    <p className="mt-2 text-3xl font-black text-slate-900">
                        {value}
                    </p>

                    {subtitle && (
                        <p className="mt-1 text-xs text-slate-500">
                            {subtitle}
                        </p>
                    )}
                </div>

                <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                    {icon}
                </div>
            </div>
        </div>
    );
};


const DistributionCard = ({
    title,
    items,
    emptyText = "No data available",
}) => {
    const validItems =
        Array.isArray(items)
            ? items
            : [];

    const total =
        validItems.reduce(
            (sum, item) =>
                sum +
                normalizeNumber(
                    item.value
                ),
            0
        );

    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-slate-900">
                {title}
            </h3>

            {validItems.length ===
            0 ? (
                <p className="mt-5 text-sm text-slate-500">
                    {emptyText}
                </p>
            ) : (
                <div className="mt-5 space-y-4">
                    {validItems.map(
                        (
                            item,
                            index
                        ) => {
                            const value =
                                normalizeNumber(
                                    item.value
                                );

                            const percentage =
                                total > 0
                                    ? (value /
                                          total) *
                                      100
                                    : 0;

                            return (
                                <div
                                    key={`${item.label}-${index}`}
                                >
                                    <div className="flex items-center justify-between text-sm mb-1">
                                        <span className="font-medium text-slate-700">
                                            {
                                                item.label
                                            }
                                        </span>

                                        <span className="font-bold text-slate-900">
                                            {
                                                value
                                            }
                                        </span>
                                    </div>

                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-indigo-600 rounded-full transition-all"
                                            style={{
                                                width: `${Math.min(
                                                    100,
                                                    percentage
                                                )}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        }
                    )}
                </div>
            )}
        </div>
    );
};


const InsightBox = ({
    icon,
    title,
    children,
    type = "info",
}) => {
    const classes = {
        info:
            "bg-indigo-50 border-indigo-100 text-indigo-900",
        success:
            "bg-emerald-50 border-emerald-100 text-emerald-900",
        warning:
            "bg-amber-50 border-amber-100 text-amber-900",
        danger:
            "bg-red-50 border-red-100 text-red-900",
    };

    return (
        <div
            className={`rounded-2xl border p-5 ${
                classes[type] ||
                classes.info
            }`}
        >
            <div className="flex items-start gap-4">
                <div className="mt-0.5">
                    {icon}
                </div>

                <div>
                    <h3 className="font-bold">
                        {title}
                    </h3>

                    <div className="mt-2 text-sm leading-6">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};


const EmptyState = ({
    title,
    message,
    icon,
    action,
}) => {
    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center text-2xl">
                {icon || (
                    <FaFileAlt />
                )}
            </div>

            <h3 className="mt-5 text-lg font-bold text-slate-900">
                {title}
            </h3>

            <p className="mt-2 max-w-lg mx-auto text-sm text-slate-500 leading-6">
                {message}
            </p>

            {action && (
                <div className="mt-6">
                    {action}
                </div>
            )}
        </div>
    );
};


// ============================================================
// MAIN COMPONENT
// ============================================================

export default function AIAnalysisDashboard() {
    const location =
        useLocation();

    const navigate =
        useNavigate();

    const {
        examId: routeExamId,
    } = useParams();


    // --------------------------------------------------------
    // IDS
    // --------------------------------------------------------

    const examId = useMemo(
        () =>
            normalizeId(
                routeExamId
            ),
        [routeExamId]
    );


    const selectedFile =
        location?.state
            ?.selectedFile ||
        null;


    const selectedExamSubjectId =
        useMemo(() => {
            const state =
                location?.state ||
                {};

            const value =
                state.examSubjectId ??
                state.exam_subject_id ??
                state.subjectId ??
                state.examSubject?.id ??
                null;

            return normalizeId(
                value
            );
        }, [
            location?.state,
        ]);


    // --------------------------------------------------------
    // STATE
    // --------------------------------------------------------

    const [analysis, setAnalysis] =
        useState(null);

    const [questions, setQuestions] =
        useState([]);

    const [examQuestions, setExamQuestions] =
        useState([]);

    const [subjectInfo, setSubjectInfo] =
        useState(null);

    const [examInfo, setExamInfo] =
        useState(null);

    const [loading, setLoading] =
        useState(true);

    const [refreshing, setRefreshing] =
        useState(false);

    const [uploading, setUploading] =
        useState(false);

    const [runningAI, setRunningAI] =
        useState(false);

    const [processingAnalysis, setProcessingAnalysis] =
        useState(false);

    const [analysisLoaded, setAnalysisLoaded] =
        useState(false);

    const [error, setError] =
        useState("");

    const [success, setSuccess] =
        useState("");

    const [
        expandedQuestions,
        setExpandedQuestions,
    ] = useState({});


    // --------------------------------------------------------
    // REFS
    // --------------------------------------------------------

    const mountedRef =
        useRef(true);

    const analysisRequestRef =
        useRef(false);

    const fileSubmissionRef =
        useRef(null);

    const lastLoadedKeyRef =
        useRef(null);

    const pollTimerRef =
        useRef(null);

    const pollCountRef =
        useRef(0);


    // --------------------------------------------------------
    // MOUNT / UNMOUNT
    // --------------------------------------------------------

    useEffect(() => {
        mountedRef.current =
            true;

        return () => {
            mountedRef.current =
                false;

            if (
                pollTimerRef.current
            ) {
                clearTimeout(
                    pollTimerRef.current
                );
            }
        };
    }, []);


    // ========================================================
    // LOAD SUBJECT INFORMATION
    // ========================================================

    const loadSubjectInfo =
        useCallback(
            async (
                subjectId
            ) => {
                const normalizedSubjectId =
                    normalizeId(
                        subjectId
                    );

                if (
                    !normalizedSubjectId
                ) {
                    return null;
                }

                try {
                    /*
                     * IMPORTANT:
                     *
                     * exam_subjects contains:
                     * id
                     * exam_id
                     * subject_id
                     * class_id
                     *
                     * subjects contains:
                     * id
                     * name
                     *
                     * We load the exact exam subject.
                     */

                    const {
                        data:
                            examSubject,
                        error:
                            examSubjectError,
                    } =
                        await supabase
                            .from(
                                "exam_subjects"
                            )
                            .select(
                                "id, exam_id, subject_id, class_id, full_marks, pass_marks"
                            )
                            .eq(
                                "id",
                                normalizedSubjectId
                            )
                            .maybeSingle();

                    if (
                        examSubjectError
                    ) {
                        throw examSubjectError;
                    }

                    if (
                        !examSubject
                    ) {
                        return null;
                    }

                    let subject =
                        null;

                    if (
                        examSubject.subject_id
                    ) {
                        const {
                            data:
                                subjectData,
                            error:
                                subjectError,
                        } =
                            await supabase
                                .from(
                                    "subjects"
                                )
                                .select(
                                    "*"
                                )
                                .eq(
                                    "id",
                                    examSubject.subject_id
                                )
                                .maybeSingle();

                        if (
                            subjectError
                        ) {
                            throw subjectError;
                        }

                        subject =
                            subjectData;
                    }

                    if (
                        mountedRef.current
                    ) {
                        setSubjectInfo({
                            ...examSubject,
                            subject,
                        });
                    }

                    return {
                        ...examSubject,
                        subject,
                    };
                } catch (err) {
                    console.error(
                        "LOAD SUBJECT INFO ERROR:",
                        err
                    );

                    return null;
                }
            },
            []
        );


    // ========================================================
    // LOAD EXAM INFORMATION
    // ========================================================

    const loadExamInfo =
        useCallback(
            async () => {
                if (!examId) {
                    return null;
                }

                try {
                    const {
                        data,
                        error:
                            examError,
                    } =
                        await supabase
                            .from(
                                "exams"
                            )
                            .select(
                                "*"
                            )
                            .eq(
                                "id",
                                examId
                            )
                            .maybeSingle();

                    if (
                        examError
                    ) {
                        throw examError;
                    }

                    if (
                        mountedRef.current
                    ) {
                        setExamInfo(
                            data ||
                                null
                        );
                    }

                    return (
                        data ||
                        null
                    );
                } catch (err) {
                    console.error(
                        "LOAD EXAM INFO ERROR:",
                        err
                    );

                    return null;
                }
            },
            [examId]
        );


    // ========================================================
    // FILE KEY
    // ========================================================

    const getFileKey =
        useCallback(
            (
                file,
                subjectId
            ) => {
                if (!file) {
                    return null;
                }

                return [
                    examId,
                    subjectId,
                    file.name,
                    file.size,
                    file.lastModified,
                ].join(":");
            },
            [examId]
        );


    // ========================================================
    // LOAD ANALYSIS
    // ========================================================

    const loadAnalysis =
        useCallback(
            async (
                subjectId,
                options = {}
            ) => {
                const normalizedSubjectId =
                    normalizeId(
                        subjectId
                    );

                if (!examId) {
                    if (
                        mountedRef.current
                    ) {
                        setError(
                            "Exam ID haijapatikana kwenye URL."
                        );

                        setLoading(
                            false
                        );
                    }

                    return null;
                }

                if (
                    !normalizedSubjectId
                ) {
                    if (
                        mountedRef.current
                    ) {
                        setError(
                            "Exam Subject ID haijapatikana."
                        );

                        setLoading(
                            false
                        );
                    }

                    return null;
                }

                const requestKey =
                    `${examId}:${normalizedSubjectId}`;

                if (
                    analysisRequestRef.current
                ) {
                    return null;
                }

                analysisRequestRef.current =
                    true;

                const isRefresh =
                    Boolean(
                        options.refresh
                    );

                try {
                    if (
                        mountedRef.current
                    ) {
                        if (
                            isRefresh
                        ) {
                            setRefreshing(
                                true
                            );
                        } else {
                            setLoading(
                                true
                            );
                        }

                        setError("");
                    }

                    const response =
                        await axios.get(
                            `${API_URL}/ai/analysis/${examId}/${normalizedSubjectId}`,
                            {
                                params: {
                                    _t: Date.now(),
                                },

                                timeout: 30000,

                                headers: {
                                    "Cache-Control":
                                        "no-cache",
                                    Pragma:
                                        "no-cache",
                                },
                            }
                        );

                    const payload =
                        response?.data ||
                        {};

                    const receivedAnalysis =
                        payload?.analysis ||
                        payload?.data
                            ?.analysis ||
                        null;

                    const receivedQuestions =
                        payload?.questions ||
                        payload?.data
                            ?.questions ||
                        receivedAnalysis
                            ?.questions ||
                        [];

                    if (
                        !mountedRef.current
                    ) {
                        return null;
                    }

                    if (
                        receivedAnalysis
                    ) {
                        setAnalysis(
                            receivedAnalysis
                        );

                        setAnalysisLoaded(
                            true
                        );

                        setProcessingAnalysis(
                            normalizeAnalysisStatus(
                                receivedAnalysis
                                    ?.analysis_status ??
                                    receivedAnalysis
                                        ?.status
                            ) ===
                                "Processing"
                        );

                        lastLoadedKeyRef.current =
                            requestKey;
                    } else {
                        /*
                         * IMPORTANT:
                         *
                         * Do NOT immediately show
                         * "Hakuna AI Analysis..."
                         *
                         * The backend may still be
                         * processing and the GET may
                         * temporarily return 404.
                         */

                        setAnalysis(
                            null
                        );

                        setAnalysisLoaded(
                            false
                        );
                    }

                    const normalizedQuestions =
                        normalizeArray(
                            receivedQuestions
                        );

                    setQuestions(
                        normalizedQuestions
                    );

                    setExamQuestions(
                        normalizedQuestions
                    );

                    return {
                        analysis:
                            receivedAnalysis,
                        questions:
                            normalizedQuestions,
                    };
                } catch (err) {
                    if (
                        !mountedRef.current
                    ) {
                        return null;
                    }

                    console.error(
                        "LOAD AI ANALYSIS ERROR:",
                        err
                    );

                    const status =
                        err?.response
                            ?.status;

                    /*
                     * 404 is NOT displayed
                     * as a user error.
                     *
                     * It can happen while
                     * AI analysis is still
                     * being created.
                     */

                    if (
                        status ===
                        404
                    ) {
                        setAnalysis(
                            null
                        );

                        setQuestions(
                            []
                        );

                        setExamQuestions(
                            []
                        );

                        setAnalysisLoaded(
                            false
                        );

                        setProcessingAnalysis(
                            true
                        );

                        lastLoadedKeyRef.current =
                            requestKey;

                        /*
                         * VERY IMPORTANT:
                         *
                         * Clear visible error.
                         */

                        setError(
                            ""
                        );

                        return {
                            analysis:
                                null,
                            questions:
                                [],
                            notReady:
                                true,
                        };
                    }

                    if (
                        err?.code ===
                        "ECONNABORTED"
                    ) {
                        setError(
                            "Backend imechelewa kujibu. Hakikisha Node.js server inaendelea kwenye port 5000."
                        );

                        return null;
                    }

                    if (
                        !err?.response
                    ) {
                        setError(
                            "Haiwezi kuwasiliana na backend. Hakikisha backend inaendelea kwenye http://localhost:5000."
                        );

                        return null;
                    }

                    setError(
                        err?.response
                            ?.data
                            ?.message ||
                        err?.response
                            ?.data
                            ?.error ||
                        err?.message ||
                        "Imeshindikana kupakia AI Analysis."
                    );

                    return null;
                } finally {
                    analysisRequestRef.current =
                        false;

                    if (
                        mountedRef.current
                    ) {
                        setLoading(
                            false
                        );

                        setRefreshing(
                            false
                        );
                    }
                }
            },
            [examId]
        );


    // ========================================================
    // POLL UNTIL ANALYSIS EXISTS
    // ========================================================

    const pollForAnalysis =
        useCallback(
            async (
                subjectId
            ) => {
                const normalizedSubjectId =
                    normalizeId(
                        subjectId
                    );

                if (
                    !normalizedSubjectId ||
                    !examId
                ) {
                    return;
                }

                if (
                    pollTimerRef.current
                ) {
                    clearTimeout(
                        pollTimerRef.current
                    );
                }

                pollCountRef.current =
                    0;

                if (
                    mountedRef.current
                ) {
                    setProcessingAnalysis(
                        true
                    );

                    setError(
                        ""
                    );
                }

                const poll =
                    async () => {
                        if (
                            !mountedRef.current
                        ) {
                            return;
                        }

                        if (
                            pollCountRef.current >=
                            MAX_ANALYSIS_POLLS
                        ) {
                            setProcessingAnalysis(
                                false
                            );

                            setError(
                                "AI Analysis imechukua muda mrefu kuliko kawaida. Bonyeza Refresh kuangalia tena."
                            );

                            return;
                        }

                        pollCountRef.current +=
                            1;

                        const result =
                            await loadAnalysis(
                                normalizedSubjectId,
                                {
                                    refresh:
                                        true,
                                }
                            );

                        if (
                            !mountedRef.current
                        ) {
                            return;
                        }

                        const returnedAnalysis =
                            result?.analysis;

                        if (
                            returnedAnalysis
                        ) {
                            const status =
                                normalizeAnalysisStatus(
                                    returnedAnalysis
                                        ?.analysis_status ??
                                        returnedAnalysis
                                            ?.status
                                );

                            if (
                                status ===
                                "Completed"
                            ) {
                                setProcessingAnalysis(
                                    false
                                );

                                setSuccess(
                                    "AI Analysis imekamilika kikamilifu."
                                );

                                return;
                            }

                            if (
                                status ===
                                "Failed"
                            ) {
                                setProcessingAnalysis(
                                    false
                                );

                                setError(
                                    returnedAnalysis
                                        ?.teacher_comments ||
                                    returnedAnalysis
                                        ?.error_message ||
                                    "AI Analysis imeshindikana."
                                );

                                return;
                            }

                            /*
                             * Processing / Pending
                             */

                            setProcessingAnalysis(
                                true
                            );
                        }

                        /*
                         * No saved analysis yet.
                         * Continue polling silently.
                         */

                        pollTimerRef.current =
                            setTimeout(
                                poll,
                                ANALYSIS_POLL_INTERVAL
                            );
                    };

                await poll();
            },
            [
                examId,
                loadAnalysis,
            ]
        );


    // ========================================================
    // ANALYZE PAPER
    // ========================================================

    const analyzePaper =
        useCallback(
            async (
                file,
                subjectId
            ) => {
                const normalizedSubjectId =
                    normalizeId(
                        subjectId
                    );

                if (!examId) {
                    throw new Error(
                        "Exam ID haijapatikana."
                    );
                }

                if (
                    !normalizedSubjectId
                ) {
                    throw new Error(
                        "Exam Subject ID haijapatikana."
                    );
                }

                if (!file) {
                    throw new Error(
                        "Hakuna exam paper file iliyochaguliwa."
                    );
                }

                const fileKey =
                    getFileKey(
                        file,
                        normalizedSubjectId
                    );

                if (
                    fileSubmissionRef.current ===
                    fileKey
                ) {
                    return null;
                }

                fileSubmissionRef.current =
                    fileKey;

                const formData =
                    new FormData();

                formData.append(
                    "paper",
                    file
                );

                formData.append(
                    "exam_id",
                    String(examId)
                );

                formData.append(
                    "exam_subject_id",
                    String(
                        normalizedSubjectId
                    )
                );

                try {
                    if (
                        mountedRef.current
                    ) {
                        setRunningAI(
                            true
                        );

                        setProcessingAnalysis(
                            true
                        );

                        setLoading(
                            true
                        );

                        setError(
                            ""
                        );

                        setSuccess(
                            ""
                        );
                    }

                    const response =
                        await axios.post(
                            `${API_URL}/ai/analyze-paper`,
                            formData,
                            {
                                timeout:
                                    10 *
                                    60 *
                                    1000,

                                headers: {
                                    "Content-Type":
                                        "multipart/form-data",
                                },
                            }
                        );

                    const payload =
                        response?.data ||
                        {};

                    const receivedAnalysis =
                        payload?.analysis ||
                        payload?.data
                            ?.analysis ||
                        null;

                    const receivedQuestions =
                        payload?.questions ||
                        payload?.data
                            ?.questions ||
                        receivedAnalysis
                            ?.questions ||
                        [];

                    if (
                        mountedRef.current
                    ) {
                        if (
                            receivedAnalysis
                        ) {
                            setAnalysis(
                                receivedAnalysis
                            );

                            setAnalysisLoaded(
                                true
                            );

                            const status =
                                normalizeAnalysisStatus(
                                    receivedAnalysis
                                        ?.analysis_status ??
                                        receivedAnalysis
                                            ?.status
                                );

                            setProcessingAnalysis(
                                status !==
                                    "Completed"
                            );
                        }

                        const normalizedQuestions =
                            normalizeArray(
                                receivedQuestions
                            );

                        setQuestions(
                            normalizedQuestions
                        );

                        setExamQuestions(
                            normalizedQuestions
                        );
                    }

                    /*
                     * Backend may return before
                     * the final saved analysis is
                     * visible through GET.
                     *
                     * Therefore poll.
                     */

                    if (
                        !receivedAnalysis ||
                        normalizeAnalysisStatus(
                            receivedAnalysis
                                ?.analysis_status ??
                                receivedAnalysis
                                    ?.status
                        ) !==
                            "Completed"
                    ) {
                        await pollForAnalysis(
                            normalizedSubjectId
                        );
                    } else {
                        if (
                            mountedRef.current
                        ) {
                            setProcessingAnalysis(
                                false
                            );

                            setSuccess(
                                "AI Analysis imekamilika kikamilifu."
                            );
                        }
                    }

                    return {
                        analysis:
                            receivedAnalysis,
                        questions:
                            normalizeArray(
                                receivedQuestions
                            ),
                    };
                } catch (err) {
                    console.error(
                        "ANALYZE PAPER ERROR:",
                        err
                    );

                    fileSubmissionRef.current =
                        null;

                    if (
                        mountedRef.current
                    ) {
                        setProcessingAnalysis(
                            false
                        );

                        setError(
                            err?.response
                                ?.data
                                ?.message ||
                            err?.response
                                ?.data
                                ?.error ||
                            err?.message ||
                            "Imeshindikana kufanya AI Analysis."
                        );
                    }

                    throw err;
                } finally {
                    if (
                        mountedRef.current
                    ) {
                        setRunningAI(
                            false
                        );

                        setLoading(
                            false
                        );
                    }
                }
            },
            [
                examId,
                getFileKey,
                pollForAnalysis,
            ]
        );


    // ========================================================
    // INITIALIZE
    // ========================================================

    useEffect(() => {
        let cancelled =
            false;

        const initialize =
            async () => {
                if (!examId) {
                    if (
                        !cancelled
                    ) {
                        setError(
                            "Exam ID haijapatikana kwenye URL."
                        );

                        setLoading(
                            false
                        );
                    }

                    return;
                }

                if (
                    !selectedExamSubjectId
                ) {
                    if (
                        !cancelled
                    ) {
                        setError(
                            "Exam Subject ID haijapatikana. Rudi kwenye Exam Subjects kisha chagua subject."
                        );

                        setLoading(
                            false
                        );
                    }

                    return;
                }

                try {
                    if (
                        !cancelled
                    ) {
                        setLoading(
                            true
                        );

                        setError(
                            ""
                        );

                        setSuccess(
                            ""
                        );
                    }

                    /*
                     * Load exact subject.
                     */

                    await Promise.all([
                        loadSubjectInfo(
                            selectedExamSubjectId
                        ),
                        loadExamInfo(),
                    ]);

                    /*
                     * CASE 1:
                     * New uploaded PDF.
                     */

                    if (
                        selectedFile
                    ) {
                        const fileKey =
                            getFileKey(
                                selectedFile,
                                selectedExamSubjectId
                            );

                        if (
                            fileSubmissionRef.current !==
                            fileKey
                        ) {
                            await analyzePaper(
                                selectedFile,
                                selectedExamSubjectId
                            );

                            if (
                                !cancelled &&
                                mountedRef.current
                            ) {
                                navigate(
                                    `/examination/${examId}/ai-analysis`,
                                    {
                                        replace:
                                            true,

                                        state: {
                                            examSubjectId:
                                                selectedExamSubjectId,
                                        },
                                    }
                                );
                            }

                            return;
                        }
                    }

                    /*
                     * CASE 2:
                     * Existing analysis.
                     */

                    const result =
                        await loadAnalysis(
                            selectedExamSubjectId,
                            {
                                force: true,
                            }
                        );

                    if (
                        result?.analysis
                    ) {
                        const status =
                            normalizeAnalysisStatus(
                                result
                                    ?.analysis
                                    ?.analysis_status ??
                                    result
                                        ?.analysis
                                        ?.status
                            );

                        if (
                            status ===
                            "Completed"
                        ) {
                            setProcessingAnalysis(
                                false
                            );
                        } else if (
                            status ===
                                "Processing" ||
                            status ===
                                "Pending"
                        ) {
                            await pollForAnalysis(
                                selectedExamSubjectId
                            );
                        }
                    } else {
                        /*
                         * If no analysis is
                         * returned, quietly check
                         * whether backend is still
                         * processing.
                         *
                         * NO ERROR MESSAGE.
                         */

                        await pollForAnalysis(
                            selectedExamSubjectId
                        );
                    }
                } catch (err) {
                    console.error(
                        "AI ANALYSIS INITIALIZATION ERROR:",
                        err
                    );

                    if (
                        !cancelled &&
                        mountedRef.current
                    ) {
                        setError(
                            err?.response
                                ?.data
                                ?.message ||
                            err?.message ||
                            "Imeshindikana kuanzisha AI Analysis."
                        );
                    }
                } finally {
                    if (
                        !cancelled &&
                        mountedRef.current
                    ) {
                        setLoading(
                            false
                        );
                    }
                }
            };

        initialize();

        return () => {
            cancelled =
                true;

            if (
                pollTimerRef.current
            ) {
                clearTimeout(
                    pollTimerRef.current
                );
            }
        };
    }, [
        examId,
        selectedExamSubjectId,
        selectedFile,
        getFileKey,
        analyzePaper,
        loadAnalysis,
        loadSubjectInfo,
        loadExamInfo,
        pollForAnalysis,
        navigate,
    ]);


    // ========================================================
    // REFRESH
    // ========================================================

    const handleRefresh =
        useCallback(
            async () => {
                if (
                    !selectedExamSubjectId
                ) {
                    setError(
                        "Exam Subject ID haijapatikana."
                    );

                    return;
                }

                setError("");

                const result =
                    await loadAnalysis(
                        selectedExamSubjectId,
                        {
                            refresh: true,
                        }
                    );

                if (
                    result?.analysis
                ) {
                    const status =
                        normalizeAnalysisStatus(
                            result
                                ?.analysis
                                ?.analysis_status ??
                                result
                                    ?.analysis
                                    ?.status
                        );

                    if (
                        status ===
                        "Completed"
                    ) {
                        setProcessingAnalysis(
                            false
                        );
                    } else {
                        await pollForAnalysis(
                            selectedExamSubjectId
                        );
                    }
                } else {
                    await pollForAnalysis(
                        selectedExamSubjectId
                    );
                }
            },
            [
                selectedExamSubjectId,
                loadAnalysis,
                pollForAnalysis,
            ]
        );


    // ========================================================
    // UPLOAD ANOTHER
    // ========================================================

    const handleUploadAnother =
        useCallback(
            () => {
                if (!examId) {
                    return;
                }

                setUploading(
                    true
                );

                navigate(
                    `/examination/${examId}/ai-analysis/upload`,
                    {
                        state: {
                            examSubjectId:
                                selectedExamSubjectId,
                        },
                    }
                );
            },
            [
                examId,
                selectedExamSubjectId,
                navigate,
            ]
        );


    // ========================================================
    // NAVIGATION
    // ========================================================

    const handleContinueApproval =
        useCallback(
            () => {
                if (!examId) {
                    return;
                }

                navigate(
                    `/examination/${examId}/approval`,
                    {
                        state: {
                            examSubjectId:
                                selectedExamSubjectId,
                        },
                    }
                );
            },
            [
                examId,
                selectedExamSubjectId,
                navigate,
            ]
        );


    const handleEnterMarks =
        useCallback(
            () => {
                if (!examId) {
                    return;
                }

                navigate(
                    `/examination/${examId}/enter-marks`,
                    {
                        state: {
                            examSubjectId:
                                selectedExamSubjectId,
                        },
                    }
                );
            },
            [
                examId,
                selectedExamSubjectId,
                navigate,
            ]
        );


    // ========================================================
    // DISPLAY QUESTIONS
    // ========================================================

    const displayedQuestions =
        useMemo(() => {
            const source =
                questions.length > 0
                    ? questions
                    : examQuestions;

            return sortQuestions(
                normalizeArray(
                    source
                )
            );
        }, [
            questions,
            examQuestions,
        ]);


    // ========================================================
    // SUBJECT NAME
    // ========================================================

    const subjectName =
        useMemo(() => {
            return (
                subjectInfo
                    ?.subject
                    ?.name ||
                subjectInfo
                    ?.subject
                    ?.subject_name ||
                subjectInfo
                    ?.subject
                    ?.subjectName ||
                analysis
                    ?.subject ||
                analysis
                    ?.subject_name ||
                analysis
                    ?.subjectName ||
                "Subject haijapatikana"
            );
        }, [
            subjectInfo,
            analysis,
        ]);


    // ========================================================
    // CLASS
    // ========================================================

    const className =
        useMemo(() => {
            return (
                analysis
                    ?.class_name ||
                analysis
                    ?.className ||
                subjectInfo
                    ?.class_name ||
                subjectInfo
                    ?.className ||
                subjectInfo
                    ?.class_id ||
                "Class haijapatikana"
            );
        }, [
            analysis,
            subjectInfo,
        ]);


    // ========================================================
    // TOTAL QUESTIONS
    // ========================================================

    const totalQuestions =
        useMemo(() => {
            const analysisTotal =
                normalizeNumber(
                    analysis
                        ?.total_questions ??
                        analysis
                            ?.totalQuestions ??
                        0
                );

            if (
                analysisTotal >
                0
            ) {
                return analysisTotal;
            }

            return displayedQuestions.length;
        }, [
            analysis,
            displayedQuestions,
        ]);


    // ========================================================
    // QUESTION STATISTICS
    // ========================================================

    const questionStats =
        useMemo(() => {
            const normalQuestions =
                displayedQuestions.filter(
                    (question) =>
                        !isSelectiveQuestion(
                            question
                        )
                );

            const selectiveQuestions =
                displayedQuestions.filter(
                    (question) =>
                        isSelectiveQuestion(
                            question
                        )
                );

            return {
                normal:
                    normalQuestions.length,

                selective:
                    selectiveQuestions.length,

                total:
                    displayedQuestions.length,
            };
        }, [
            displayedQuestions,
        ]);


    // ========================================================
    // EFFECTIVE TOTAL MARKS
    // ========================================================

    const derivedTotalMarks =
        useMemo(() => {
            if (
                displayedQuestions.length ===
                0
            ) {
                return 0;
            }

            let total = 0;

            const normalQuestions =
                displayedQuestions.filter(
                    (question) =>
                        !isSelectiveQuestion(
                            question
                        )
                );

            total +=
                normalQuestions.reduce(
                    (
                        sum,
                        question
                    ) =>
                        sum +
                        getQuestionMaxMarks(
                            question
                        ),
                    0
                );

            const groups =
                new Map();

            displayedQuestions
                .filter(
                    (question) =>
                        isSelectiveQuestion(
                            question
                        )
                )
                .forEach(
                    (question) => {
                        const group =
                            getSelectionGroup(
                                question
                            ) ||
                            `selection-${getQuestionNumber(
                                question
                            )}`;

                        if (
                            !groups.has(
                                group
                            )
                        ) {
                            groups.set(
                                group,
                                []
                            );
                        }

                        groups
                            .get(group)
                            .push(
                                question
                            );
                    }
                );

            groups.forEach(
                (
                    groupQuestions
                ) => {
                    const first =
                        groupQuestions[0];

                    const selectionCount =
                        getSelectionCount(
                            first
                        );

                    const marks =
                        groupQuestions
                            .map(
                                (
                                    question
                                ) =>
                                    getQuestionMaxMarks(
                                        question
                                    )
                            )
                            .sort(
                                (
                                    a,
                                    b
                                ) =>
                                    b - a
                            );

                    if (
                        selectionCount >
                        0
                    ) {
                        total +=
                            marks
                                .slice(
                                    0,
                                    selectionCount
                                )
                                .reduce(
                                    (
                                        sum,
                                        value
                                    ) =>
                                        sum +
                                        value,
                                    0
                                );
                    } else {
                        total +=
                            marks.reduce(
                                (
                                    sum,
                                    value
                                ) =>
                                    sum +
                                    value,
                                0
                            );
                    }
                }
            );

            return total;
        }, [
            displayedQuestions,
        ]);


    const effectiveTotalMarks =
        useMemo(() => {
            const value =
                normalizeNumber(
                    analysis
                        ?.total_marks ??
                        analysis
                            ?.totalMarks ??
                        0
                );

            return value >
                0
                ? value
                : derivedTotalMarks;
        }, [
            analysis,
            derivedTotalMarks,
        ]);


    // ========================================================
    // DIFFICULTY
    // ========================================================

    const difficultyDistribution =
        useMemo(() => {
            const counts =
                {};

            displayedQuestions.forEach(
                (
                    question
                ) => {
                    const difficulty =
                        getQuestionDifficulty(
                            question
                        );

                    const label =
                        difficulty &&
                        difficulty !==
                            "Not specified"
                            ? String(
                                  difficulty
                              )
                            : "Not specified";

                    counts[label] =
                        (counts[label] ||
                            0) +
                        1;
                }
            );

            return Object.entries(
                counts
            ).map(
                (
                    [
                        label,
                        value,
                    ]
                ) => ({
                    label,
                    value,
                })
            );
        }, [
            displayedQuestions,
        ]);


    // ========================================================
    // BLOOM
    // ========================================================

    const bloomDistribution =
        useMemo(() => {
            const counts =
                {};

            displayedQuestions.forEach(
                (
                    question
                ) => {
                    const bloom =
                        getQuestionBloom(
                            question
                        );

                    const label =
                        bloom &&
                        bloom !==
                            "Not specified"
                            ? String(
                                  bloom
                              )
                            : "Not specified";

                    counts[label] =
                        (counts[label] ||
                            0) +
                        1;
                }
            );

            return Object.entries(
                counts
            ).map(
                (
                    [
                        label,
                        value,
                    ]
                ) => ({
                    label,
                    value,
                })
            );
        }, [
            displayedQuestions,
        ]);


    // ========================================================
    // TOPICS
    // ========================================================

    const topicDistribution =
        useMemo(() => {
            const counts =
                {};

            displayedQuestions.forEach(
                (
                    question
                ) => {
                    const topic =
                        getQuestionTopic(
                            question
                        );

                    if (!topic) {
                        return;
                    }

                    const label =
                        String(
                            topic
                        ).trim();

                    if (!label) {
                        return;
                    }

                    counts[label] =
                        (counts[label] ||
                            0) +
                        1;
                }
            );

            return Object.entries(
                counts
            )
                .map(
                    (
                        [
                            label,
                            value,
                        ]
                    ) => ({
                        label,
                        value,
                    })
                )
                .sort(
                    (
                        a,
                        b
                    ) =>
                        b.value -
                        a.value
                );
        }, [
            displayedQuestions,
        ]);


    // ========================================================
    // QUALITY
    // ========================================================

    const qualityScore =
        useMemo(() => {
            const value =
                analysis
                    ?.quality_score ??
                analysis
                    ?.qualityScore ??
                analysis
                    ?.paper_quality_score ??
                analysis
                    ?.paperQualityScore ??
                analysis
                    ?.overall_quality ??
                0;

            return Math.round(
                Math.max(
                    0,
                    Math.min(
                        100,
                        normalizeNumber(
                            value
                        )
                    )
                )
            );
        }, [
            analysis,
        ]);


    // ========================================================
    // CONFIDENCE
    // ========================================================

    const averageConfidence =
        useMemo(() => {
            if (
                displayedQuestions.length ===
                0
            ) {
                return 0;
            }

            const values =
                displayedQuestions
                    .map(
                        getConfidence
                    )
                    .filter(
                        (
                            value
                        ) =>
                            value >
                            0
                    );

            if (
                values.length ===
                0
            ) {
                return 0;
            }

            const average =
                values.reduce(
                    (
                        sum,
                        value
                    ) =>
                        sum +
                        value,
                    0
                ) /
                values.length;

            return Math.round(
                average
            );
        }, [
            displayedQuestions,
        ]);


    // ========================================================
    // STATUS
    // ========================================================

    const analysisStatus =
        normalizeAnalysisStatus(
            analysis
                ?.analysis_status ??
                analysis
                    ?.status ??
                (
                    analysis
                        ? "Completed"
                        : processingAnalysis
                        ? "Processing"
                        : "Pending"
                )
        );


    // ========================================================
    // TOGGLE QUESTION
    // ========================================================

    const toggleQuestion =
        useCallback(
            (
                questionNumber
            ) => {
                setExpandedQuestions(
                    (
                        previous
                    ) => ({
                        ...previous,

                        [questionNumber]:
                            !previous[
                                questionNumber
                            ],
                    })
                );
            },
            []
        );


    // ========================================================
    // LOADING SCREEN
    // ========================================================

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">

                    <div className="mx-auto h-14 w-14 rounded-full border-4 border-slate-200 border-t-indigo-600 animate-spin" />

                    <h2 className="mt-6 text-xl font-bold text-slate-900">
                        {runningAI ||
                        processingAnalysis
                            ? "AI inaendelea kuchambua..."
                            : "Loading AI Analysis"}
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                        {runningAI ||
                        processingAnalysis
                            ? "Tafadhali subiri. Mfumo unachambua examination paper na kuhifadhi analysis."
                            : "Tunapakia taarifa za examination analysis."}
                    </p>

                    <div className="mt-6 grid grid-cols-2 gap-3 text-left">

                        <div className="p-4 rounded-xl bg-slate-50">
                            <div className="text-xs text-slate-500">
                                Exam ID
                            </div>

                            <div className="font-bold text-slate-900">
                                {examId ||
                                    "N/A"}
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-50">
                            <div className="text-xs text-slate-500">
                                Exam Subject
                            </div>

                            <div className="font-bold text-slate-900 truncate">
                                {subjectName}
                            </div>
                        </div>
                    </div>

                    {(runningAI ||
                        processingAnalysis) && (
                        <div className="mt-5 p-4 rounded-xl bg-indigo-50 border border-indigo-100 text-left">
                            <div className="flex gap-3">

                                <FaRobot className="text-indigo-600 mt-1 shrink-0 animate-pulse" />

                                <div>
                                    <p className="font-bold text-indigo-900">
                                        Analysis in progress
                                    </p>

                                    <p className="mt-1 text-sm text-indigo-700">
                                        Mfumo unasubiri
                                        AI Analysis
                                        ikamilike.
                                        Hautaonyeshwa
                                        ujumbe wa
                                        "Hakuna
                                        Analysis"
                                        wakati
                                        processing
                                        inaendelea.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="mt-5 p-4 rounded-xl bg-red-50 border border-red-100 text-left">
                            <div className="flex gap-3">

                                <FaExclamationTriangle className="text-red-600 mt-1 shrink-0" />

                                <div className="text-sm text-red-800">
                                    {error}
                                </div>

                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }


    // ========================================================
    // MAIN
    // ========================================================

    return (
        <div className="min-h-screen bg-slate-50">

            {/* =================================================
                HEADER
            ================================================= */}

            <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                    <div className="min-h-[76px] flex items-center justify-between gap-4">

                        <div className="flex items-center gap-3 min-w-0">

                            <button
                                type="button"
                                onClick={() =>
                                    navigate(
                                        -1
                                    )
                                }
                                className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center shrink-0"
                                title="Back"
                            >
                                <FaArrowLeft />
                            </button>

                            <div className="min-w-0">

                                <div className="flex items-center gap-2">

                                    <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                                        <FaBrain />
                                    </div>

                                    <h1 className="text-lg sm:text-xl font-black text-slate-900 truncate">
                                        AI Analysis
                                    </h1>

                                </div>

                                <p className="mt-1 text-xs text-slate-500 truncate">
                                    {subjectName}
                                </p>

                            </div>
                        </div>


                        <div className="flex items-center gap-2 shrink-0">

                            <button
                                type="button"
                                onClick={
                                    handleRefresh
                                }
                                disabled={
                                    refreshing
                                }
                                className="inline-flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                            >
                                <FaRedo
                                    className={
                                        refreshing
                                            ? "animate-spin"
                                            : ""
                                    }
                                />

                                <span className="hidden sm:inline">
                                    Refresh
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={
                                    handleUploadAnother
                                }
                                disabled={
                                    uploading
                                }
                                className="inline-flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                            >
                                <FaUpload />

                                <span className="hidden sm:inline">
                                    Upload Another
                                </span>
                            </button>

                        </div>

                    </div>

                </div>

            </header>


            {/* =================================================
                CONTENT
            ================================================= */}

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

                {/* =================================================
                    ERROR
                ================================================= */}

                {error && (
                    <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4">

                        <div className="flex items-start gap-3">

                            <FaExclamationTriangle className="text-red-600 mt-1 shrink-0" />

                            <div className="flex-1">

                                <p className="font-bold text-red-900">
                                    Attention
                                </p>

                                <p className="mt-1 text-sm text-red-800">
                                    {error}
                                </p>

                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setError(
                                        ""
                                    )
                                }
                                className="text-xs font-semibold text-red-700 hover:text-red-900"
                            >
                                Close
                            </button>

                        </div>

                    </div>
                )}


                {/* =================================================
                    SUCCESS
                ================================================= */}

                {success && (
                    <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">

                        <div className="flex items-start gap-3">

                            <FaCheckCircle className="text-emerald-600 mt-1 shrink-0" />

                            <div className="flex-1">

                                <p className="font-bold text-emerald-900">
                                    Success
                                </p>

                                <p className="mt-1 text-sm text-emerald-800">
                                    {success}
                                </p>

                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setSuccess(
                                        ""
                                    )
                                }
                                className="text-xs font-semibold text-emerald-700"
                            >
                                Close
                            </button>

                        </div>

                    </div>
                )}


                {/* =================================================
                    AI RUNNING
                ================================================= */}

                {(runningAI ||
                    processingAnalysis) && (
                    <div className="mb-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-5">

                        <div className="flex items-center gap-4">

                            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                                <FaRobot className="animate-pulse" />
                            </div>

                            <div>

                                <h2 className="font-bold text-indigo-900">
                                    AI Analysis in progress
                                </h2>

                                <p className="mt-1 text-sm text-indigo-700">
                                    {subjectName} —
                                    Gemini AI
                                    inachambua
                                    structure,
                                    questions,
                                    marks, topics,
                                    difficulty na
                                    Bloom levels.
                                </p>

                            </div>

                        </div>

                    </div>
                )}


                {/* =================================================
                    EXAMINATION OVERVIEW
                ================================================= */}

                <div className="mb-6 bg-gradient-to-r from-indigo-700 to-indigo-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg">

                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">

                        <div>

                            <div className="flex items-center gap-2 text-indigo-100 text-sm font-semibold">

                                <FaFlask />

                                AI-POWERED EXAMINATION ANALYSIS

                            </div>

                            <h2 className="mt-3 text-2xl sm:text-3xl font-black">
                                Examination Paper Analysis
                            </h2>

                            <p className="mt-2 text-sm sm:text-base text-indigo-100 max-w-2xl">
                                Detailed analysis ya
                                examination paper
                                iliyofanyiwa processing
                                na AI.
                            </p>

                        </div>


                        <div className="shrink-0">

                            <div className="rounded-2xl bg-white/10 border border-white/20 p-5 min-w-[240px]">

                                <p className="text-xs uppercase tracking-wide text-indigo-100">
                                    Subject
                                </p>

                                <p className="mt-1 text-xl font-black">
                                    {subjectName}
                                </p>

                                <div className="mt-4">

                                    <p className="text-xs uppercase tracking-wide text-indigo-100">
                                        Analysis Status
                                    </p>

                                    <div className="mt-2 flex items-center gap-2">

                                        <span
                                            className={`w-2.5 h-2.5 rounded-full ${
                                                analysisStatus ===
                                                "Completed"
                                                    ? "bg-emerald-400"
                                                    : analysisStatus ===
                                                      "Failed"
                                                    ? "bg-red-400"
                                                    : "bg-amber-300 animate-pulse"
                                            }`}
                                        />

                                        <span className="font-bold">
                                            {
                                                analysisStatus
                                            }
                                        </span>

                                    </div>

                                </div>

                                <p className="mt-3 text-xs text-indigo-100">
                                    Exam #
                                    {examId}
                                </p>

                                <p className="text-xs text-indigo-100">
                                    Exam Subject #
                                    {
                                        selectedExamSubjectId
                                    }
                                </p>

                            </div>

                        </div>

                    </div>

                </div>


                {/* =================================================
                    SUBJECT DETAILS
                ================================================= */}

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

                    <InfoCard
                        icon={
                            <FaFileAlt />
                        }
                        title="Subject"
                        value={
                            subjectName
                        }
                        subtitle="Analysed examination subject"
                    />

                    <InfoCard
                        icon={
                            <FaFlask />
                        }
                        title="Exam"
                        value={
                            examInfo
                                ?.exam_name ||
                            examInfo
                                ?.name ||
                            `Exam #${examId}`
                        }
                        subtitle="Current examination"
                    />

                    <InfoCard
                        icon={
                            <FaTasks />
                        }
                        title="Exam Subject ID"
                        value={
                            selectedExamSubjectId ||
                            "N/A"
                        }
                        subtitle="Exact subject record"
                    />

                    <InfoCard
                        icon={
                            <FaCheckCircle />
                        }
                        title="Status"
                        value={
                            analysisStatus
                        }
                        subtitle="AI analysis status"
                    />

                </div>


                {/* =================================================
                    PROCESSING STATE
                ================================================= */}

                {!analysis &&
                    processingAnalysis && (
                        <div className="mb-8">

                            <div className="bg-white border border-indigo-200 rounded-3xl p-8 shadow-sm">

                                <div className="max-w-2xl mx-auto text-center">

                                    <div className="mx-auto w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-2xl">
                                        <FaRobot className="animate-pulse" />
                                    </div>

                                    <h2 className="mt-5 text-xl font-black text-slate-900">
                                        AI Analysis inaendelea
                                    </h2>

                                    <p className="mt-2 text-sm text-slate-500 leading-6">
                                        Mfumo bado
                                        unachambua
                                        <strong className="text-slate-900">
                                            {" "}
                                            {subjectName}
                                        </strong>
                                        . Analysis
                                        ikikamilika
                                        taarifa
                                        zitaonekana
                                        hapa
                                        automatically.
                                    </p>

                                    <div className="mt-6 h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full w-1/2 bg-indigo-600 rounded-full animate-pulse" />
                                    </div>

                                    <p className="mt-4 text-xs font-semibold text-indigo-600">
                                        Tunangoja AI
                                        Analysis
                                        ihifadhiwe...
                                    </p>

                                </div>

                            </div>

                        </div>
                    )}


                {/* =================================================
                    NO ANALYSIS
                ================================================= */}

                {!analysis &&
                    !processingAnalysis &&
                    displayedQuestions.length ===
                        0 ? (
                    <EmptyState
                        title="No AI Analysis Available"
                        message={`Hakuna analysis iliyofanyika kwa ${subjectName}. Upload exam paper ili AI iweze kuichambua.`}
                        icon={
                            <FaRobot />
                        }
                        action={
                            <button
                                type="button"
                                onClick={
                                    handleUploadAnother
                                }
                                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
                            >
                                <FaCloudUploadAlt />

                                Upload Exam Paper
                            </button>
                        }
                    />
                ) : (
                    <>
                        {/* =========================================
                            KPI
                        ========================================= */}

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

                            <KpiCard
                                label="Questions"
                                value={
                                    totalQuestions
                                }
                                subtitle="Detected by AI"
                                icon={
                                    <FaTasks />
                                }
                            />

                            <KpiCard
                                label="Total Marks"
                                value={
                                    effectiveTotalMarks
                                }
                                subtitle="Effective examination marks"
                                icon={
                                    <FaCheckCircle />
                                }
                            />

                            <KpiCard
                                label="AI Confidence"
                                value={`${averageConfidence}%`}
                                subtitle="Average question confidence"
                                icon={
                                    <FaBrain />
                                }
                            />

                            <KpiCard
                                label="Quality Score"
                                value={`${qualityScore}%`}
                                subtitle="Overall paper quality"
                                icon={
                                    <FaFlask />
                                }
                            />

                        </div>


                        {/* =========================================
                            QUESTION TYPES
                        ========================================= */}

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">

                            <InfoCard
                                icon={
                                    <FaFileAlt />
                                }
                                title="All Questions"
                                value={
                                    questionStats.total
                                }
                                subtitle="AI detected"
                            />

                            <InfoCard
                                icon={
                                    <FaCheckCircle />
                                }
                                title="Normal"
                                value={
                                    questionStats.normal
                                }
                                subtitle="Required questions"
                            />

                            <InfoCard
                                icon={
                                    <FaTasks />
                                }
                                title="Selective"
                                value={
                                    questionStats.selective
                                }
                                subtitle="Selection questions"
                            />

                            <InfoCard
                                icon={
                                    <FaLightbulb />
                                }
                                title="Topics"
                                value={
                                    topicDistribution.length
                                }
                                subtitle="Detected topics"
                            />

                        </div>


                        {/* =========================================
                            AI INSIGHTS
                        ========================================= */}

                        <section className="mb-8">

                            <div className="flex items-center gap-3 mb-4">

                                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                    <FaLightbulb />
                                </div>

                                <div>

                                    <h2 className="text-xl font-black text-slate-900">
                                        AI Insights
                                    </h2>

                                    <p className="text-sm text-slate-500">
                                        Summary ya machine analysis ya{" "}
                                        <strong>
                                            {
                                                subjectName
                                            }
                                        </strong>
                                    </p>

                                </div>

                            </div>


                            <div className="grid lg:grid-cols-2 gap-4">

                                <InsightBox
                                    icon={
                                        <FaCheckCircle />
                                    }
                                    title="Question Structure"
                                    type="success"
                                >
                                    AI imegundua{" "}
                                    <strong>
                                        {
                                            questionStats.total
                                        }
                                    </strong>{" "}
                                    questions,
                                    ambapo{" "}
                                    <strong>
                                        {
                                            questionStats.normal
                                        }
                                    </strong>{" "}
                                    ni normal na{" "}
                                    <strong>
                                        {
                                            questionStats.selective
                                        }
                                    </strong>{" "}
                                    ni selective
                                    questions.
                                </InsightBox>


                                <InsightBox
                                    icon={
                                        <FaBrain />
                                    }
                                    title="AI Confidence"
                                    type={
                                        averageConfidence >=
                                        80
                                            ? "success"
                                            : averageConfidence >=
                                              60
                                            ? "warning"
                                            : "danger"
                                    }
                                >
                                    Average AI
                                    confidence ni{" "}
                                    <strong>
                                        {
                                            averageConfidence
                                        }
                                        %
                                    </strong>
                                    .
                                </InsightBox>


                                <InsightBox
                                    icon={
                                        <FaFlask />
                                    }
                                    title="Paper Quality"
                                    type={
                                        qualityScore >=
                                        80
                                            ? "success"
                                            : qualityScore >=
                                              60
                                            ? "warning"
                                            : "danger"
                                    }
                                >
                                    Overall paper
                                    quality score ni{" "}
                                    <strong>
                                        {
                                            qualityScore
                                        }
                                        %
                                    </strong>
                                    .
                                </InsightBox>


                                <InsightBox
                                    icon={
                                        <FaTasks />
                                    }
                                    title="Assessment Coverage"
                                    type="info"
                                >
                                    Mfumo
                                    ume-identify{" "}
                                    <strong>
                                        {
                                            topicDistribution.length
                                        }
                                    </strong>{" "}
                                    topics kutoka
                                    kwenye{" "}
                                    <strong>
                                        {
                                            subjectName
                                        }
                                    </strong>
                                    examination
                                    paper.
                                </InsightBox>

                            </div>

                        </section>


                        {/* =========================================
                            DISTRIBUTIONS
                        ========================================= */}

                        <section className="mb-8">

                            <div className="grid lg:grid-cols-3 gap-5">

                                <DistributionCard
                                    title="Difficulty Distribution"
                                    items={
                                        difficultyDistribution
                                    }
                                />

                                <DistributionCard
                                    title="Bloom's Taxonomy"
                                    items={
                                        bloomDistribution
                                    }
                                />

                                <DistributionCard
                                    title="Topic Distribution"
                                    items={
                                        topicDistribution
                                    }
                                />

                            </div>

                        </section>


                        {/* =========================================
                            QUALITY
                        ========================================= */}

                        <section className="mb-8">

                            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">

                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

                                    <div>

                                        <h2 className="text-lg font-black text-slate-900">
                                            Overall Paper Quality
                                        </h2>

                                        <p className="mt-1 text-sm text-slate-500">
                                            AI assessment ya
                                            ubora wa{" "}
                                            {
                                                subjectName
                                            }{" "}
                                            examination
                                            paper.
                                        </p>

                                    </div>

                                    <div className="text-3xl font-black text-indigo-600">
                                        {
                                            qualityScore
                                        }
                                        %
                                    </div>

                                </div>

                                <div className="mt-5 h-4 rounded-full bg-slate-100 overflow-hidden">

                                    <div
                                        className="h-full bg-indigo-600 rounded-full transition-all"
                                        style={{
                                            width: `${qualityScore}%`,
                                        }}
                                    />

                                </div>

                            </div>

                        </section>


                        {/* =========================================
                            QUESTIONS
                        ========================================= */}

                        <section className="mb-8">

                            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">

                                <div>

                                    <h2 className="text-xl font-black text-slate-900">
                                        Question-by-Question Analysis
                                    </h2>

                                    <p className="mt-1 text-sm text-slate-500">
                                        Detailed AI
                                        interpretation
                                        ya kila swali
                                        la{" "}
                                        <strong>
                                            {
                                                subjectName
                                            }
                                        </strong>
                                        .
                                    </p>

                                </div>

                                <div className="text-sm font-semibold text-slate-500">
                                    {
                                        displayedQuestions.length
                                    }{" "}
                                    questions
                                </div>

                            </div>


                            {displayedQuestions.length ===
                            0 ? (
                                <EmptyState
                                    title="No Questions Detected"
                                    message="AI haikupata questions za kuonyesha kwenye analysis."
                                    icon={
                                        <FaFileAlt />
                                    }
                                />
                            ) : (
                                <div className="space-y-3">

                                    {displayedQuestions.map(
                                        (
                                            question,
                                            index
                                        ) => {

                                            const number =
                                                getQuestionNumber(
                                                    question
                                                ) ||
                                                index +
                                                    1;

                                            const expanded =
                                                Boolean(
                                                    expandedQuestions[
                                                        number
                                                    ]
                                                );

                                            const selective =
                                                isSelectiveQuestion(
                                                    question
                                                );

                                            const marks =
                                                getQuestionMaxMarks(
                                                    question
                                                );

                                            const confidence =
                                                getConfidence(
                                                    question
                                                );

                                            const selectionCount =
                                                getSelectionCount(
                                                    question
                                                );

                                            const selectionTotal =
                                                getSelectionTotal(
                                                    question
                                                );

                                            const selectionInstruction =
                                                getSelectionInstruction(
                                                    question
                                                );

                                            return (
                                                <div
                                                    key={`${number}-${index}`}
                                                    className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
                                                >

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            toggleQuestion(
                                                                number
                                                            )
                                                        }
                                                        className="w-full text-left p-5 hover:bg-slate-50 transition"
                                                    >

                                                        <div className="flex items-start gap-4">

                                                            <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black shrink-0">
                                                                Q
                                                                {
                                                                    number
                                                                }
                                                            </div>

                                                            <div className="flex-1 min-w-0">

                                                                <div className="flex flex-wrap items-center gap-2">

                                                                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                                                                        {
                                                                            marks
                                                                        }{" "}
                                                                        marks
                                                                    </span>

                                                                    <span
                                                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                                                            selective
                                                                                ? "bg-amber-100 text-amber-800"
                                                                                : "bg-emerald-100 text-emerald-800"
                                                                        }`}
                                                                    >
                                                                        {selective
                                                                            ? "Selective"
                                                                            : "Normal"}
                                                                    </span>

                                                                    <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 text-xs font-bold">
                                                                        {
                                                                            getQuestionDifficulty(
                                                                                question
                                                                            )
                                                                        }
                                                                    </span>

                                                                </div>

                                                                <p className="mt-3 text-sm sm:text-base font-semibold text-slate-900 leading-6">
                                                                    {
                                                                        getQuestionText(
                                                                            question
                                                                        ) ||
                                                                        "Question text haijapatikana."
                                                                    }
                                                                </p>

                                                            </div>

                                                            <div className="shrink-0 text-slate-400 pt-1">

                                                                {expanded ? (
                                                                    <FaChevronUp />
                                                                ) : (
                                                                    <FaChevronDown />
                                                                )}

                                                            </div>

                                                        </div>

                                                    </button>


                                                    {expanded && (
                                                        <div className="border-t border-slate-200 p-5 bg-slate-50">

                                                            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">

                                                                <MiniStat
                                                                    label="Topic"
                                                                    value={
                                                                        getQuestionTopic(
                                                                            question
                                                                        ) ||
                                                                        "Not specified"
                                                                    }
                                                                />

                                                                <MiniStat
                                                                    label="Sub-topic"
                                                                    value={
                                                                        getQuestionSubtopic(
                                                                            question
                                                                        ) ||
                                                                        "Not specified"
                                                                    }
                                                                />

                                                                <MiniStat
                                                                    label="Bloom Level"
                                                                    value={
                                                                        getQuestionBloom(
                                                                            question
                                                                        )
                                                                    }
                                                                />

                                                                <MiniStat
                                                                    label="Question Type"
                                                                    value={
                                                                        getQuestionType(
                                                                            question
                                                                        )
                                                                    }
                                                                />

                                                            </div>


                                                            <div className="mt-4 grid sm:grid-cols-2 gap-4">

                                                                <div className="bg-white border border-slate-200 rounded-xl p-4">

                                                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                                                        Marks
                                                                    </p>

                                                                    <p className="mt-2 text-xl font-black text-slate-900">
                                                                        {
                                                                            marks
                                                                        }
                                                                    </p>

                                                                </div>


                                                                <div className="bg-white border border-slate-200 rounded-xl p-4">

                                                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                                                        AI Confidence
                                                                    </p>

                                                                    <p className="mt-2 text-xl font-black text-indigo-600">
                                                                        {
                                                                            confidence
                                                                        }
                                                                        %
                                                                    </p>

                                                                </div>

                                                            </div>


                                                            {selective && (
                                                                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">

                                                                    <div className="flex gap-3">

                                                                        <FaTasks className="text-amber-600 mt-1" />

                                                                        <div>

                                                                            <p className="font-bold text-amber-900">
                                                                                Selective Question
                                                                            </p>

                                                                            <p className="mt-1 text-sm text-amber-800">
                                                                                Selection count:{" "}
                                                                                <strong>
                                                                                    {
                                                                                        selectionCount ||
                                                                                        "Not specified"
                                                                                    }
                                                                                </strong>
                                                                            </p>

                                                                            {selectionTotal >
                                                                                0 && (
                                                                                <p className="mt-1 text-sm text-amber-800">
                                                                                    Available questions:{" "}
                                                                                    <strong>
                                                                                        {
                                                                                            selectionTotal
                                                                                        }
                                                                                    </strong>
                                                                                </p>
                                                                            )}

                                                                            {selectionInstruction && (
                                                                                <p className="mt-2 text-sm text-amber-900 font-medium">
                                                                                    {
                                                                                        selectionInstruction
                                                                                    }
                                                                                </p>
                                                                            )}

                                                                        </div>

                                                                    </div>

                                                                </div>
                                                            )}


                                                            {getAIExplanation(
                                                                question
                                                            ) && (
                                                                <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 p-4">

                                                                    <div className="flex gap-3">

                                                                        <FaRobot className="text-indigo-600 mt-1" />

                                                                        <div>

                                                                            <p className="font-bold text-indigo-900">
                                                                                AI Explanation
                                                                            </p>

                                                                            <p className="mt-1 text-sm text-indigo-800 leading-6">
                                                                                {
                                                                                    getAIExplanation(
                                                                                        question
                                                                                    )
                                                                                }
                                                                            </p>

                                                                        </div>

                                                                    </div>

                                                                </div>
                                                            )}

                                                        </div>
                                                    )}

                                                </div>
                                            );
                                        }
                                    )}

                                </div>
                            )}

                        </section>


                        {/* =========================================
                            BLOOM SUMMARY
                        ========================================= */}

                        <section className="mb-8">

                            <DistributionCard
                                title="Bloom's Taxonomy Distribution"
                                items={
                                    bloomDistribution
                                }
                            />

                        </section>


                        {/* =========================================
                            ACTION FOOTER
                        ========================================= */}

                        <section className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">

                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">

                                <div>

                                    <h2 className="text-xl font-black text-slate-900">
                                        Analysis Complete
                                    </h2>

                                    <p className="mt-2 text-sm text-slate-500 max-w-2xl">
                                        Review the AI
                                        analysis ya{" "}
                                        <strong>
                                            {
                                                subjectName
                                            }
                                        </strong>
                                        , then
                                        continue with
                                        examination
                                        approval.
                                    </p>

                                </div>


                                <div className="flex flex-col sm:flex-row gap-3">

                                    <button
                                        type="button"
                                        onClick={
                                            handleUploadAnother
                                        }
                                        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50"
                                    >
                                        <FaCloudUploadAlt />

                                        Upload Another
                                    </button>


                                    <button
                                        type="button"
                                        onClick={
                                            handleContinueApproval
                                        }
                                        disabled={
                                            !analysis ||
                                            analysisStatus !==
                                                "Completed"
                                        }
                                        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <FaCheckCircle />

                                        Continue Approval
                                    </button>


                                    <button
                                        type="button"
                                        onClick={
                                            handleEnterMarks
                                        }
                                        disabled={
                                            !analysis ||
                                            analysisStatus !==
                                                "Completed"
                                        }
                                        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <FaPlay />

                                        Enter Marks
                                    </button>

                                </div>

                            </div>

                        </section>

                    </>
                )}

            </main>

        </div>
    );
}


// ============================================================
// MINI STAT
// ============================================================

function MiniStat({
    label,
    value,
}) {
    return (
        <div className="bg-white border border-slate-200 rounded-xl p-4">

            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {label}
            </p>

            <p className="mt-1 text-sm font-bold text-slate-900 break-words">
                {value}
            </p>

        </div>
    );
}