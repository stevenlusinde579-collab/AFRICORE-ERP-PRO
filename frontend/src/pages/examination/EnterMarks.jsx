import {
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

import {
    useNavigate,
    useParams,
    useSearchParams
} from "react-router-dom";

import axios from "axios";

import {
    FaArrowLeft,
    FaSave,
    FaSpinner,
    FaExclamationTriangle,
    FaUserGraduate,
    FaChevronDown,
    FaChevronUp,
    FaCheckCircle
} from "react-icons/fa";

import { supabase } from "../../services/supabase";


const API_URL = "https://africore-erp-pro.onrender.com/api";


function EnterMarks() {

    const navigate = useNavigate();

    const { examId } = useParams();

    const [searchParams] = useSearchParams();

    const examSubjectIdFromUrl =
        searchParams.get("examSubjectId") || "";


    // =========================================================
    // STATE
    // =========================================================

    const [exam, setExam] = useState(null);

    const [examSubjects, setExamSubjects] = useState([]);

    const [questions, setQuestions] = useState([]);

    const [students, setStudents] = useState([]);


    // DATABASE MARKS
    const [existingMarks, setExistingMarks] = useState({});


    // TEMPORARY MARKS
    const [marks, setMarks] = useState({});


    // SELECTED QUESTIONS
    const [selectedQuestions, setSelectedQuestions] =
        useState({});


    // MAX MARKS
    const [maxMarks, setMaxMarks] = useState({});

    const [maxMarksSaved, setMaxMarksSaved] =
        useState(false);

    const [savingMaxMarks, setSavingMaxMarks] =
        useState(false);


    // STUDENT UI
    const [openStudents, setOpenStudents] =
        useState({});

    const [savedStudents, setSavedStudents] =
        useState({});


    // SELECTION
    const [
        selectedSubjectId,
        setSelectedSubjectId
    ] = useState("");

    const [
        selectedClassId,
        setSelectedClassId
    ] = useState("");

    const [
        selectedExamSubjectId,
        setSelectedExamSubjectId
    ] = useState(
        examSubjectIdFromUrl
    );


    // LOADING
    const [loadingExam, setLoadingExam] =
        useState(true);

    const [loadingSubjects, setLoadingSubjects] =
        useState(true);

    const [loadingQuestions, setLoadingQuestions] =
        useState(false);

    const [loadingStudents, setLoadingStudents] =
        useState(false);

    const [loadingExistingMarks, setLoadingExistingMarks] =
        useState(false);

    const [savingStudentId, setSavingStudentId] =
        useState(null);


    // MESSAGES
    const [message, setMessage] = useState("");

    const [error, setError] = useState("");

    const [checkingApproval, setCheckingApproval] = useState(true);
    const [fullApproval, setFullApproval] = useState(false);
    const [approvalDetails, setApprovalDetails] = useState({
        academic: false,
        deputy: false,
        headmaster: false,
        statusApproved: false
    });

    // Marks entry is available ONLY after the complete exam-level approval chain.
    const canEnterMarks =
        !checkingApproval &&
        fullApproval;


    // REFS
    const maxMarkRefs = useRef({});

    const markInputRefs = useRef({});

    const saveMaxMarksButtonRef = useRef(null);


    // =========================================================
    // HELPERS
    // =========================================================

    const getSubjectId = item => {

        if (!item) return "";

        if (
            item.subject_id !== undefined &&
            item.subject_id !== null
        ) {
            return String(item.subject_id);
        }

        if (
            item.subjectId !== undefined &&
            item.subjectId !== null
        ) {
            return String(item.subjectId);
        }

        if (
            item.subject?.id !== undefined &&
            item.subject?.id !== null
        ) {
            return String(item.subject.id);
        }

        return "";
    };


    const getClassId = item => {

        if (!item) return "";

        if (
            item.class_id !== undefined &&
            item.class_id !== null
        ) {
            return String(item.class_id);
        }

        if (
            item.classId !== undefined &&
            item.classId !== null
        ) {
            return String(item.classId);
        }

        if (
            item.class?.id !== undefined &&
            item.class?.id !== null
        ) {
            return String(item.class.id);
        }

        return "";
    };


    const getSubjectName = item => {

        if (!item) {
            return "Unknown Subject";
        }

        return (
            item.subject?.subject_name ||
            item.subject?.name ||
            item.subject_name ||
            item.subjectName ||
            item.name ||
            `Subject ${getSubjectId(item)}`
        );
    };


    const getClassName = item => {

        if (!item) {
            return "Unknown Class";
        }

        return (
            item.class?.class_name ||
            item.class?.name ||
            item.class?.short_name ||
            item.class_name ||
            item.className ||
            item.short_name ||
            `Class ${getClassId(item)}`
        );
    };


    const getStudentName = student => {

        if (!student) {
            return "Unknown Student";
        }

        const fullName = [
            student.first_name,
            student.middle_name,
            student.last_name
        ]
            .filter(Boolean)
            .join(" ")
            .trim();

        return (
            fullName ||
            student.student_name ||
            student.name ||
            "Unknown Student"
        );
    };


    const formatMark = value => {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return "0";
        }

        const number = Number(value);

        if (Number.isNaN(number)) {
            return "0";
        }

        return Number.isInteger(number)
            ? String(number)
            : String(Number(number.toFixed(2)));
    };


    const getStudentKey = (
        studentId,
        questionId
    ) => {

        return `${String(studentId)}_${String(questionId)}`;
    };


    const toNumberOrNull = value => {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return null;
        }

        const number = Number(value);

        return Number.isFinite(number)
            ? number
            : null;
    };


    // =========================================================
    // BOOLEAN NORMALIZER
    // =========================================================

    const normalizeBoolean = value => {

        if (
            value === true ||
            value === 1
        ) {
            return true;
        }

        if (
            value === false ||
            value === 0
        ) {
            return false;
        }

        if (
            typeof value === "string"
        ) {

            const normalized =
                value.trim().toLowerCase();

            if (
                [
                    "true",
                    "1",
                    "yes",
                    "y",
                    "selected",
                    "selective"
                ].includes(normalized)
            ) {
                return true;
            }

            if (
                [
                    "false",
                    "0",
                    "no",
                    "n"
                ].includes(normalized)
            ) {
                return false;
            }
        }

        return false;
    };


    // =========================================================
    // IMPORTANT:
    // IS SELECTIVE MUST COME FROM DATABASE / AI
    //
    // We DO NOT inspect question text.
    // We DO NOT use "out of", "choose", etc.
    // We DO NOT use ai_explanation to determine selectivity.
    // =========================================================

    const isSelectiveQuestion = question => {

        if (!question) {
            return false;
        }

        /*
         * PRIMARY SOURCE:
         * exam_questions.is_selective
         *
         * If the column exists and contains TRUE/FALSE,
         * that value is authoritative.
         */

        if (
            question.is_selective !== undefined &&
            question.is_selective !== null
        ) {
            return normalizeBoolean(
                question.is_selective
            );
        }


        /*
         * Compatibility fallback only when is_selective
         * is completely missing/null.
         *
         * We do NOT inspect question text.
         */

        if (
            question.selective !== undefined &&
            question.selective !== null
        ) {
            return normalizeBoolean(
                question.selective
            );
        }


        if (
            question.isSelective !== undefined &&
            question.isSelective !== null
        ) {
            return normalizeBoolean(
                question.isSelective
            );
        }


        return false;
    };


    // =========================================================
    // PARSE SELECTION COUNT
    // =========================================================

    const parseSelectionCount = value => {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return null;
        }

        if (
            typeof value === "number"
        ) {

            return Number.isFinite(value)
                ? Math.floor(value)
                : null;
        }

        const text =
            String(value)
                .trim()
                .toLowerCase();

        const direct = Number(text);

        if (
            Number.isFinite(direct)
        ) {
            return Math.floor(direct);
        }

        const match =
            text.match(
                /(?:any|choose|select|answer|attempt|jibu|chagua)\s*(?:any\s*)?(\d+)/i
            );

        if (match) {
            return Number(match[1]);
        }

        const matchOutOf =
            text.match(
                /(\d+)\s*(?:out\s+of|of|kati\s+ya)\s*(\d+)/i
            );

        if (matchOutOf) {
            return Number(matchOutOf[1]);
        }

        return null;
    };


    // =========================================================
    // SELECTION INSTRUCTION
    //
    // Only metadata fields.
    // NEVER question_text.
    // NEVER ai_explanation as a selectivity detector.
    // =========================================================

    const getSelectionInstruction = question => {

        if (!question) {
            return "";
        }

        return (
            question.selection_instruction ||
            question.selective_instruction ||
            question.selectionInstruction ||
            question.ai_selection_instruction ||
            question.ai_selective_instruction ||
            ""
        );
    };


    // =========================================================
    // SELECTION GROUP
    // =========================================================

    const getSelectionGroup = question => {

        if (!question) {
            return "";
        }

        return (
            question.selection_group ||
            question.selective_group ||
            question.selectionGroup ||
            ""
        );
    };


    // =========================================================
    // SELECTION REQUIREMENT
    // =========================================================

    const getSelectionRequirement = question => {

        if (!question) {

            return {
                required: false,
                count: null,
                total: null,
                group: "",
                instruction: ""
            };
        }


        /*
         * VERY IMPORTANT:
         *
         * A question is selective ONLY if
         * isSelectiveQuestion(question) is true.
         */

        const selective =
            isSelectiveQuestion(question);


        if (!selective) {

            return {
                required: false,
                count: null,
                total: null,
                group: "",
                instruction: ""
            };
        }


        /*
         * selection_count
         */

        let count =
            parseSelectionCount(
                question.selection_count
            );


        /*
         * Some AI/database structures may put the
         * required number in selection_required.
         *
         * We use it as a COUNT only when it is
         * numeric / parseable.
         *
         * It does NOT decide whether the question
         * is selective.
         */

        if (
            count === null
        ) {

            count =
                parseSelectionCount(
                    question.selection_required
                );
        }


        if (
            count === null
        ) {

            count =
                parseSelectionCount(
                    question.selective_count
                );
        }


        if (
            count === null
        ) {

            count =
                parseSelectionCount(
                    question.selectionCount
                );
        }


        /*
         * Selection total
         */

        let total =
            parseSelectionCount(
                question.selection_total
            );


        if (
            total === null
        ) {

            total =
                parseSelectionCount(
                    question.selective_total
                );
        }


        const instruction =
            getSelectionInstruction(
                question
            );


        const group =
            getSelectionGroup(
                question
            );


        /*
         * If there is a numeric "selection_required"
         * and no selection_count, it is treated as count.
         */

        if (
            count === null &&
            question.selection_required !== undefined &&
            question.selection_required !== null &&
            question.selection_required !== ""
        ) {

            const parsed =
                toNumberOrNull(
                    question.selection_required
                );

            if (
                parsed !== null &&
                parsed > 0
            ) {
                count =
                    Math.floor(parsed);
            }
        }


        return {

            required: true,

            count:
                count !== null &&
                count > 0
                    ? count
                    : null,

            total:
                total !== null &&
                total > 0
                    ? total
                    : null,

            group:
                group
                    ? String(group)
                    : "",

            instruction
        };
    };


    // =========================================================
    // SELECTION KEY
    // =========================================================

    const getSelectionKey = (
        studentId,
        questionId
    ) => {

        return getStudentKey(
            studentId,
            questionId
        );
    };


    // =========================================================
    // QUESTION SELECTED
    // =========================================================

    const isQuestionSelected = (
        studentId,
        question
    ) => {

        /*
         * NORMAL QUESTIONS are always considered selected
         * because they must be marked.
         */

        if (
            !isSelectiveQuestion(question)
        ) {
            return true;
        }


        const key =
            getSelectionKey(
                studentId,
                question.id
            );

        return Boolean(
            selectedQuestions[key]
        );
    };


    // =========================================================
    // QUESTION GROUP
    // =========================================================

    const getQuestionGroupKey = question => {

        const requirement =
            getSelectionRequirement(
                question
            );


        if (
            requirement.group
        ) {

            return `group:${requirement.group}`;
        }


        /*
         * If AI provided an instruction but no group,
         * use the exact instruction as a fallback grouping
         * for selective questions only.
         */

        if (
            requirement.instruction
        ) {

            const normalized =
                String(
                    requirement.instruction
                )
                    .trim()
                    .toLowerCase();

            if (normalized) {

                return `instruction:${normalized}`;
            }
        }


        return "default-selective-group";
    };


    // =========================================================
    // GROUP QUESTIONS
    // =========================================================

    const getSelectiveGroupQuestions = question => {

        if (
            !isSelectiveQuestion(question)
        ) {
            return [];
        }


        const groupKey =
            getQuestionGroupKey(
                question
            );


        return questions.filter(
            candidate => {

                if (
                    !isSelectiveQuestion(
                        candidate
                    )
                ) {
                    return false;
                }

                return (
                    getQuestionGroupKey(
                        candidate
                    ) === groupKey
                );
            }
        );
    };


    // =========================================================
    // REQUIRED SELECTION COUNT
    // =========================================================

    const getRequiredSelectionCount = question => {

        const requirement =
            getSelectionRequirement(
                question
            );


        if (
            requirement.count !== null
        ) {

            return requirement.count;
        }


        const groupQuestions =
            getSelectiveGroupQuestions(
                question
            );


        if (
            requirement.total !== null &&
            requirement.total <
                groupQuestions.length
        ) {

            return requirement.total;
        }


        return null;
    };


    // =========================================================
    // SELECTED COUNT FOR GROUP
    // =========================================================

    const getSelectedCountForQuestion = (
        studentId,
        question
    ) => {

        const groupQuestions =
            getSelectiveGroupQuestions(
                question
            );


        return groupQuestions.filter(
            candidate =>
                isQuestionSelected(
                    studentId,
                    candidate
                )
        ).length;
    };


    // =========================================================
    // INITIAL LOAD
    // =========================================================

    useEffect(() => {

        if (!examId) {

            setError(
                "Exam ID haipo kwenye URL."
            );

            setLoadingExam(false);

            setLoadingSubjects(false);

            return;
        }


        loadExam();

        loadExamSubjects();

    }, [examId]);


    // =========================================================
    // LOAD EXAM
    // =========================================================

    const hasApprovalUser = value => {

        if (value === true) {
            return true;
        }

        if (
            value === false ||
            value === null ||
            value === undefined
        ) {
            return false;
        }

        const normalized =
            String(value).trim().toLowerCase();

        return (
            normalized !== "" &&
            normalized !== "false" &&
            normalized !== "null" &&
            normalized !== "undefined"
        );
    };

    const checkExamApproval = async (examSubjectId = selectedExamSubjectId) => {

        if (!examId || !examSubjectId) {
            setCheckingApproval(false);
            setFullApproval(false);
            setApprovalDetails({
                academic: false,
                deputy: false,
                headmaster: false,
                statusApproved: false
            });
            return false;
        }

        try {
            setCheckingApproval(true);

            // IMPORTANT: Approval belongs to the selected exam_subject
            // (Subject + Class), not the whole examination.
            const { data: approvalSubject, error: approvalError } = await supabase
                .from("exam_subjects")
                .select(`
                    id,
                    exam_id,
                    subject_id,
                    class_id,
                    approval_status,
                    approved_by_academic,
                    approved_by_deputy,
                    approved_by_headmaster
                `)
                .eq("id", Number(examSubjectId))
                .eq("exam_id", Number(examId))
                .maybeSingle();

            if (approvalError) throw approvalError;

            if (!approvalSubject) {
                throw new Error(
                    "Exam Subject haikupatikana kwa examination hii."
                );
            }

            const academic = hasApprovalUser(
                approvalSubject.approved_by_academic
            );

            const deputy = hasApprovalUser(
                approvalSubject.approved_by_deputy
            );

            const headmaster = hasApprovalUser(
                approvalSubject.approved_by_headmaster
            );

            const statusApproved =
                String(approvalSubject.approval_status || "")
                    .trim()
                    .toLowerCase() === "approved";

            // The unlock condition is the complete three-person
            // approval chain for this exact subject/class.
            // Keep approval_status for display/diagnostics.
            // The three approval users are the actual approval chain.
            // approval_status is kept for display/diagnostics and must not
            // make Save disagree with the unlocked Enter Marks screen.
            const approved =
                academic &&
                deputy &&
                headmaster;

            setApprovalDetails({
                academic,
                deputy,
                headmaster,
                statusApproved
            });

            setFullApproval(approved);

            if (!approved) {
                setError(
                    !academic
                        ? "Academic Master Approval bado haijakamilika."
                        : !deputy
                            ? "Deputy Headmaster Approval bado haijakamilika."
                            : "Headmaster Final Approval bado haijakamilika."
                );
            } else {
                setError("");
            }

            return approved;

        } catch (err) {
            console.error("EXAM SUBJECT APPROVAL CHECK ERROR:", err);

            setFullApproval(false);
            setApprovalDetails({
                academic: false,
                deputy: false,
                headmaster: false,
                statusApproved: false
            });

            setError(
                err?.message ||
                "Imeshindikana kuthibitisha approval ya Exam Subject."
            );

            return false;

        } finally {
            setCheckingApproval(false);
        }
    };

    useEffect(() => {
        checkExamApproval(selectedExamSubjectId);
    }, [examId, selectedExamSubjectId]);

    const loadExam = async () => {

        try {

            setLoadingExam(true);

            setError("");

            // The backend does not expose GET /api/exams/:examId.
            // Enter Marks uses the exam-subject endpoint below and the
            // selected exam_subject row for approval verification.
            // Keep a local exam object so the existing UI remains intact.
            setExam({
                id: Number(examId),
                exam_name: `Examination ${examId}`
            });

        } catch (err) {

            console.error(
                "LOAD EXAM ERROR:",
                err
            );

            setError(
                err.response?.data?.message ||
                err.message ||
                "Failed to load examination."
            );

        } finally {

            setLoadingExam(false);
        }
    };


    // =========================================================
    // LOAD EXAM SUBJECTS
    // =========================================================

    const loadExamSubjects = async () => {

        try {

            setLoadingSubjects(true);

            setError("");

            const response =
                await axios.get(
                    `${API_URL}/exams/${examId}/subjects`
                );


            if (
                !response.data?.success
            ) {

                throw new Error(
                    response.data?.message ||
                    "Failed to load examination subjects."
                );
            }


            const subjects =
                Array.isArray(
                    response.data.subjects
                )
                    ? response.data.subjects
                    : [];


            setExamSubjects(
                subjects
            );


            let selected = null;


            if (
                examSubjectIdFromUrl
            ) {

                selected =
                    subjects.find(
                        item =>
                            String(item.id) ===
                            String(
                                examSubjectIdFromUrl
                            )
                    );
            }


            if (
                !selected &&
                subjects.length > 0
            ) {

                selected =
                    subjects[0];
            }


            if (selected) {

                const subjectId =
                    getSubjectId(
                        selected
                    );

                const classId =
                    getClassId(
                        selected
                    );


                setSelectedExamSubjectId(
                    String(selected.id)
                );


                if (subjectId) {

                    setSelectedSubjectId(
                        subjectId
                    );
                }


                if (classId) {

                    setSelectedClassId(
                        classId
                    );
                }

            } else {

                setSelectedExamSubjectId("");

                setSelectedSubjectId("");

                setSelectedClassId("");

                setError(
                    `Hakuna subjects/classes zilizopatikana kwenye examination ID ${examId}.`
                );
            }

        } catch (err) {

            console.error(
                "LOAD EXAM SUBJECTS ERROR:",
                err
            );

            setExamSubjects([]);

            setSelectedExamSubjectId("");

            setSelectedSubjectId("");

            setSelectedClassId("");

            setError(
                err.response?.data?.message ||
                err.message ||
                "Failed to load examination subjects."
            );

        } finally {

            setLoadingSubjects(false);
        }
    };


    // =========================================================
    // AVAILABLE SUBJECTS
    // =========================================================

    const availableSubjects =
        useMemo(() => {

            const map =
                new Map();


            examSubjects.forEach(
                item => {

                    const subjectId =
                        getSubjectId(
                            item
                        );


                    if (!subjectId) {
                        return;
                    }


                    if (
                        !map.has(
                            subjectId
                        )
                    ) {

                        map.set(
                            subjectId,
                            item
                        );
                    }
                }
            );


            return Array.from(
                map.values()
            );

        }, [examSubjects]);


    // =========================================================
    // AVAILABLE CLASSES
    // =========================================================

    const availableClasses =
        useMemo(() => {

            if (
                !selectedSubjectId
            ) {
                return [];
            }


            const map =
                new Map();


            examSubjects
                .filter(
                    item =>
                        getSubjectId(
                            item
                        ) ===
                        String(
                            selectedSubjectId
                        )
                )
                .forEach(
                    item => {

                        const classId =
                            getClassId(
                                item
                            );


                        if (!classId) {
                            return;
                        }


                        if (
                            !map.has(
                                classId
                            )
                        ) {

                            map.set(
                                classId,
                                item
                            );
                        }
                    }
                );


            return Array.from(
                map.values()
            );

        }, [
            examSubjects,
            selectedSubjectId
        ]);


    // =========================================================
    // SELECTED EXAM SUBJECT
    // =========================================================

    const selectedExamSubject =
        useMemo(() => {

            return examSubjects.find(
                item =>
                    String(item.id) ===
                    String(
                        selectedExamSubjectId
                    )
            );

        }, [
            examSubjects,
            selectedExamSubjectId
        ]);


    // =========================================================
    // SUBJECT CHANGE
    // =========================================================

    const handleSubjectChange =
        event => {

            const subjectId =
                event.target.value;


            setSelectedSubjectId(
                subjectId
            );

            setSelectedClassId("");

            setSelectedExamSubjectId("");

            setQuestions([]);

            setStudents([]);

            setMarks({});

            setMaxMarks({});

            setExistingMarks({});

            setSelectedQuestions({});

            setOpenStudents({});

            setSavedStudents({});

            setMaxMarksSaved(false);

            setMessage("");

            setError("");
        };


    // =========================================================
    // CLASS CHANGE
    // =========================================================

    const handleClassChange =
        event => {

            const classId =
                event.target.value;


            setSelectedClassId(
                classId
            );

            setQuestions([]);

            setStudents([]);

            setMarks({});

            setMaxMarks({});

            setExistingMarks({});

            setSelectedQuestions({});

            setOpenStudents({});

            setSavedStudents({});

            setMaxMarksSaved(false);

            setMessage("");

            setError("");


            if (
                !selectedSubjectId ||
                !classId
            ) {

                setSelectedExamSubjectId("");

                return;
            }


            const examSubject =
                examSubjects.find(
                    item =>
                        getSubjectId(
                            item
                        ) ===
                            String(
                                selectedSubjectId
                            ) &&
                        getClassId(
                            item
                        ) ===
                            String(
                                classId
                            )
                );


            if (!examSubject) {

                setSelectedExamSubjectId("");

                setError(
                    "Subject hii haijaunganishwa na class uliyochagua kwenye examination hii."
                );

                return;
            }


            setSelectedExamSubjectId(
                String(
                    examSubject.id
                )
            );
        };


    // =========================================================
    // LOAD QUESTIONS
    // =========================================================

    useEffect(() => {

        if (
            !examId ||
            !selectedExamSubjectId ||
            !canEnterMarks
        ) {

            setQuestions([]);

            setMaxMarks({});

            setMaxMarksSaved(false);

            return;
        }


        loadQuestions();

    }, [
        examId,
        selectedExamSubjectId,
        canEnterMarks
    ]);


    const loadQuestions = async () => {

        try {

            setLoadingQuestions(true);

            setError("");

            setQuestions([]);

            setMaxMarks({});

            setMaxMarksSaved(false);


            // -------------------------------------------------
            // GET EXAM SUBJECT
            // -------------------------------------------------

            const {
                data: examSubject,
                error: examSubjectError
            } = await supabase
                .from("exam_subjects")
                .select(`
                    id,
                    exam_id,
                    subject_id,
                    class_id
                `)
                .eq(
                    "id",
                    Number(
                        selectedExamSubjectId
                    )
                )
                .eq(
                    "exam_id",
                    Number(examId)
                )
                .single();


            if (
                examSubjectError
            ) {
                throw examSubjectError;
            }


            if (
                !examSubject
            ) {

                throw new Error(
                    "Exam Subject haikupatikana."
                );
            }


            const subjectId =
                Number(
                    examSubject.subject_id
                );


            const classId =
                Number(
                    examSubject.class_id
                );


            if (
                Number.isNaN(subjectId) ||
                subjectId <= 0
            ) {

                throw new Error(
                    "Subject ID ya Exam Subject si sahihi."
                );
            }


            if (
                Number.isNaN(classId) ||
                classId <= 0
            ) {

                throw new Error(
                    "Class ID ya Exam Subject si sahihi."
                );
            }


            setSelectedSubjectId(
                String(subjectId)
            );


            setSelectedClassId(
                String(classId)
            );


            // -------------------------------------------------
            // GET ALL QUESTIONS
            //
            // select("*") is intentional.
            // It allows us to receive the exact AI metadata
            // stored in exam_questions.
            // -------------------------------------------------

            const {
                data,
                error: questionError
            } = await supabase
                .from("exam_questions")
                .select("*")
                .eq(
                    "exam_id",
                    Number(examId)
                )
                .eq(
                    "subject_id",
                    subjectId
                )
                .order(
                    "question_number",
                    {
                        ascending: true
                    }
                );


            if (
                questionError
            ) {
                throw questionError;
            }


            const finalQuestions =
                (
                    Array.isArray(data)
                        ? data
                        : []
                )
                    .filter(
                        question =>
                            Number(
                                question.exam_id
                            ) ===
                                Number(
                                    examId
                                ) &&
                            Number(
                                question.subject_id
                            ) ===
                                subjectId
                    )
                    .sort(
                        (a, b) =>
                            Number(
                                a.question_number
                            ) -
                            Number(
                                b.question_number
                            )
                    );


            console.log(
                "================================================"
            );

            console.log(
                "QUESTIONS FOR ENTER MARKS:",
                finalQuestions
            );


            console.log(
                "================================================"
            );

            console.log(
                "AI/SUPABASE SELECTIVE QUESTIONS:"
            );


            finalQuestions
                .filter(
                    question =>
                        isSelectiveQuestion(
                            question
                        )
                )
                .forEach(
                    question => {

                        console.log({
                            id:
                                question.id,

                            question_number:
                                question.question_number,

                            is_selective:
                                question.is_selective,

                            selection_required:
                                question.selection_required,

                            selection_count:
                                question.selection_count,

                            selection_total:
                                question.selection_total,

                            selection_group:
                                question.selection_group,

                            selection_instruction:
                                question.selection_instruction
                        });
                    }
                );


            console.log(
                "NORMAL QUESTIONS:",
                finalQuestions.filter(
                    question =>
                        !isSelectiveQuestion(
                            question
                        )
                )
            );


            setQuestions(
                finalQuestions
            );


            // -------------------------------------------------
            // LOAD MAX MARKS
            // -------------------------------------------------

            const loadedMaxMarks =
                {};

            let allMaxMarksSaved =
                finalQuestions.length > 0;


            finalQuestions.forEach(
                question => {

                    if (
                        question.max_marks !==
                            null &&
                        question.max_marks !==
                            undefined &&
                        question.max_marks !==
                            ""
                    ) {

                        loadedMaxMarks[
                            String(
                                question.id
                            )
                        ] =
                            String(
                                question.max_marks
                            );

                    } else {

                        loadedMaxMarks[
                            String(
                                question.id
                            )
                        ] =
                            "";

                        allMaxMarksSaved =
                            false;
                    }
                }
            );


            setMaxMarks(
                loadedMaxMarks
            );


            setMaxMarksSaved(
                allMaxMarksSaved
            );


            if (
                finalQuestions.length === 0
            ) {

                setError(
                    `Hakuna questions zilizopatikana kwa Exam ID ${examId}, Subject ID ${subjectId}.`
                );
            }

        } catch (err) {

            console.error(
                "LOAD QUESTIONS ERROR:",
                err
            );

            setQuestions([]);

            setMaxMarks({});

            setMaxMarksSaved(false);

            setError(
                err.message ||
                "Failed to load examination questions."
            );

        } finally {

            setLoadingQuestions(false);
        }
    };


    // =========================================================
    // LOAD STUDENTS
    // =========================================================

    useEffect(() => {

        if (
            !selectedExamSubjectId ||
            !canEnterMarks
        ) {

            setStudents([]);

            return;
        }


        loadStudents(
            selectedExamSubjectId
        );

    }, [
        selectedExamSubjectId,
        canEnterMarks
    ]);


    const loadStudents =
        async examSubjectId => {

            try {

                setLoadingStudents(true);

                setError("");

                setMessage("");


                const response =
                    await axios.get(
                        `${API_URL}/exams/exam-subject/${examSubjectId}/students`
                    );


                if (
                    !response.data?.success
                ) {

                    throw new Error(
                        response.data?.message ||
                        "Failed to load students."
                    );
                }


                const studentList =
                    Array.isArray(
                        response.data.students
                    )
                        ? response.data.students
                        : [];


                setStudents(
                    studentList
                );

            } catch (err) {

                console.error(
                    "LOAD STUDENTS ERROR:",
                    err
                );

                setStudents([]);

                setError(
                    err.response?.data?.message ||
                    err.message ||
                    "Failed to load students."
                );

            } finally {

                setLoadingStudents(false);
            }
        };


    // =========================================================
    // LOAD EXISTING MARKS
    // =========================================================

    useEffect(() => {

        if (
            !examId ||
            !selectedExamSubjectId ||
            !canEnterMarks
        ) {

            setExistingMarks({});

            setSelectedQuestions({});

            return;
        }


        loadExistingMarks();

    }, [
        examId,
        selectedExamSubjectId,
        canEnterMarks
    ]);


    const loadExistingMarks =
        async () => {

            try {

                setLoadingExistingMarks(true);


                const {
                    data,
                    error: marksError
                } = await supabase
                    .from(
                        "exam_question_marks"
                    )
                    .select(`
                        id,
                        exam_id,
                        exam_subject_id,
                        question_id,
                        student_id,
                        marks_obtained,
                        created_at,
                        created_by,
                        is_selected
                    `)
                    .eq(
                        "exam_id",
                        Number(examId)
                    )
                    .eq(
                        "exam_subject_id",
                        Number(
                            selectedExamSubjectId
                        )
                    );


                if (
                    marksError
                ) {
                    throw marksError;
                }


                const mapped =
                    {};

                const studentSavedMap =
                    {};


                (
                    data || []
                ).forEach(
                    record => {

                        const key =
                            getStudentKey(
                                record.student_id,
                                record.question_id
                            );


                        mapped[key] = {
                            ...record
                        };


                        studentSavedMap[
                            String(
                                record.student_id
                            )
                        ] = true;
                    }
                );


                setExistingMarks(
                    mapped
                );


                setSavedStudents(
                    studentSavedMap
                );

            } catch (err) {

                console.error(
                    "LOAD EXISTING MARKS ERROR:",
                    err
                );

                setExistingMarks({});

                setSelectedQuestions({});

                setError(
                    err.message ||
                    "Failed to load saved marks."
                );

            } finally {

                setLoadingExistingMarks(false);
            }
        };


    // =========================================================
    // REBUILD SELECTIVE SELECTIONS
    //
    // IMPORTANT:
    // Existing marks are considered selections ONLY when
    // the corresponding question is actually selective
    // according to exam_questions.is_selective.
    // =========================================================

    useEffect(() => {

        if (
            questions.length === 0
        ) {
            return;
        }


        setSelectedQuestions(
            previous => {

                const next = {
                    ...previous
                };


                Object.values(
                    existingMarks
                ).forEach(
                    record => {

                        const question =
                            questions.find(
                                item =>
                                    Number(
                                        item.id
                                    ) ===
                                    Number(
                                        record.question_id
                                    )
                            );


                        if (
                            question &&
                            isSelectiveQuestion(
                                question
                            )
                        ) {

                            const key =
                                getStudentKey(
                                    record.student_id,
                                    record.question_id
                                );


                            next[key] =
                                true;
                        }
                    }
                );


                return next;
            }
        );

    }, [
        questions,
        existingMarks
    ]);


    // =========================================================
    // LOAD EXISTING MARKS INTO TEMPORARY STATE
    // =========================================================

    useEffect(() => {

        if (
            Object.keys(
                existingMarks
            ).length === 0
        ) {
            return;
        }


        const restoredMarks =
            {};


        Object.values(
            existingMarks
        ).forEach(
            record => {

                const key =
                    getStudentKey(
                        record.student_id,
                        record.question_id
                    );


                restoredMarks[key] =
                    record.marks_obtained ===
                        null ||
                    record.marks_obtained ===
                        undefined
                        ? ""
                        : String(
                            record.marks_obtained
                        );
            }
        );


        setMarks(
            previous => ({
                ...restoredMarks,
                ...previous
            })
        );

    }, [
        existingMarks
    ]);


    // =========================================================
    // REGISTER MAX MARK REF
    // =========================================================

    const registerMaxMarkRef =
        (
            questionId,
            element
        ) => {

            if (element) {

                maxMarkRefs.current[
                    String(
                        questionId
                    )
                ] =
                    element;
            }
        };


    // =========================================================
    // REGISTER MARK INPUT REF
    // =========================================================

    const registerMarkInputRef =
        (
            studentId,
            questionId,
            element
        ) => {

            const key =
                getStudentKey(
                    studentId,
                    questionId
                );


            if (element) {

                markInputRefs.current[
                    key
                ] =
                    element;
            }
        };


    // =========================================================
    // MAX MARK CHANGE
    // =========================================================

    const handleMaxMarkChange =
        (
            questionId,
            value
        ) => {

            if (!canEnterMarks) {
                setError("Huwezi kuweka Max Marks mpaka approval ya examination ikamilike.");
                return;
            }



            if (
                value === ""
            ) {

                setMaxMarks(
                    previous => ({
                        ...previous,
                        [String(
                            questionId
                        )]:
                            ""
                    })
                );

                setMaxMarksSaved(
                    false
                );

                return;
            }


            const numeric =
                Number(value);


            if (
                Number.isNaN(
                    numeric
                ) ||
                numeric < 0
            ) {
                return;
            }


            setMaxMarks(
                previous => ({
                    ...previous,
                    [String(
                        questionId
                    )]:
                        value
                })
            );


            setMaxMarksSaved(
                false
            );

            setMessage("");
        };


    // =========================================================
    // MAX MARK KEYBOARD
    // =========================================================

    const handleMaxMarkKeyDown =
        (
            event,
            questionIndex
        ) => {

            if (
                event.key !== "Enter"
            ) {
                return;
            }


            event.preventDefault();


            const nextQuestion =
                questions[
                    questionIndex + 1
                ];


            if (nextQuestion) {

                const ref =
                    maxMarkRefs.current[
                        String(
                            nextQuestion.id
                        )
                    ];


                if (ref) {

                    ref.focus();

                    ref.select();
                }

            } else {

                if (
                    saveMaxMarksButtonRef.current
                ) {

                    saveMaxMarksButtonRef.current.focus();
                }
            }
        };


    // =========================================================
    // SAVE MAX MARKS
    // =========================================================

    const saveMaxMarksToDatabase =
        async () => {

            try {

                if (!selectedExamSubjectId) {
                    setError("Exam Subject haijachaguliwa.");
                    return;
                }

                // Fresh Supabase approval check immediately before writing Max Marks.
                const {
                    data: currentApproval,
                    error: currentApprovalError
                } = await supabase
                    .from("exam_subjects")
                    .select(`
                        approval_status,
                        approved_by_academic,
                        approved_by_deputy,
                        approved_by_headmaster
                    `)
                    .eq("id", Number(selectedExamSubjectId))
                    .eq("exam_id", Number(examId))
                    .maybeSingle();

                if (currentApprovalError) {
                    throw currentApprovalError;
                }

                // Approval is COMPLETE when all three approval-chain users
                // have approved this exact Exam Subject. Do not let a stale
                // approval_status value block saving after the three approvals
                // are already present.
                const approvedNow = Boolean(
                    currentApproval &&
                    hasApprovalUser(currentApproval.approved_by_academic) &&
                    hasApprovalUser(currentApproval.approved_by_deputy) &&
                    hasApprovalUser(currentApproval.approved_by_headmaster)
                );

                if (!approvedNow) {
                    setError(
                        "Huwezi kuhifadhi Max Marks mpaka approval ya Exam Subject ikamilike."
                    );
                    return;
                }

                setFullApproval(true);
                setApprovalDetails({
                    academic: true,
                    deputy: true,
                    headmaster: true,
                    statusApproved: true
                });

                setSavingMaxMarks(
                    true
                );

                setError("");

                setMessage("");


                if (
                    questions.length === 0
                ) {

                    throw new Error(
                        "Hakuna questions za kuweka Max Marks."
                    );
                }


                const updates =
                    [];


                for (
                    const question
                    of questions
                ) {

                    const value =
                        maxMarks[
                            String(
                                question.id
                            )
                        ];


                    if (
                        value === "" ||
                        value === null ||
                        value === undefined
                    ) {

                        throw new Error(
                            `Weka Max Marks kwa Question ${question.question_number || question.id}.`
                        );
                    }


                    const numeric =
                        Number(value);


                    if (
                        Number.isNaN(
                            numeric
                        ) ||
                        numeric < 0
                    ) {

                        throw new Error(
                            `Max Marks ya Question ${question.question_number || question.id} si sahihi.`
                        );
                    }


                    updates.push(
                        supabase
                            .from(
                                "exam_questions"
                            )
                            .update({
                                max_marks:
                                    numeric
                            })
                            .eq(
                                "id",
                                question.id
                            )
                            .eq(
                                "exam_id",
                                Number(
                                    examId
                                )
                            )
                            .eq(
                                "subject_id",
                                Number(
                                    selectedSubjectId
                                )
                            )
                    );
                }


                const results =
                    await Promise.all(
                        updates
                    );


                const failed =
                    results.find(
                        result =>
                            result.error
                    );


                if (
                    failed?.error
                ) {

                    throw failed.error;
                }


                setMaxMarksSaved(
                    true
                );


                setQuestions(
                    previous =>
                        previous.map(
                            question => ({
                                ...question,

                                max_marks:
                                    Number(
                                        maxMarks[
                                            String(
                                                question.id
                                            )
                                        ]
                                    )
                            })
                        )
                );


                setMessage(
                    "Max Marks zimehifadhiwa kwenye exam_questions."
                );

            } catch (err) {

                console.error(
                    "SAVE MAX MARKS ERROR:",
                    err
                );


                setMaxMarksSaved(
                    false
                );


                setError(
                    err.message ||
                    "Failed to save Max Marks."
                );

            } finally {

                setSavingMaxMarks(
                    false
                );
            }
        };


    // =========================================================
    // TOTAL PAPER MAX
    // =========================================================

    const totalMaxMarks =
        useMemo(
            () => {

                return questions.reduce(
                    (
                        total,
                        question
                    ) => {

                        const value =
                            maxMarks[
                                String(
                                    question.id
                                )
                            ];


                        const number =
                            Number(value);


                        if (
                            Number.isNaN(
                                number
                            )
                        ) {

                            return total;
                        }


                        return (
                            total +
                            number
                        );

                    },
                    0
                );

            },
            [
                questions,
                maxMarks
            ]
        );


    // =========================================================
    // NORMAL QUESTION COUNT
    // =========================================================

    const normalQuestionCount =
        useMemo(
            () => {

                return questions.filter(
                    question =>
                        !isSelectiveQuestion(
                            question
                        )
                ).length;

            },
            [
                questions
            ]
        );


    // =========================================================
    // SELECTIVE QUESTION COUNT
    // =========================================================

    const selectiveQuestionCount =
        useMemo(
            () => {

                return questions.filter(
                    question =>
                        isSelectiveQuestion(
                            question
                        )
                ).length;

            },
            [
                questions
            ]
        );


    // =========================================================
    // SELECTIVE GROUPS
    // =========================================================

    const selectiveGroups =
        useMemo(
            () => {

                const map =
                    new Map();


                questions
                    .filter(
                        question =>
                            isSelectiveQuestion(
                                question
                            )
                    )
                    .forEach(
                        question => {

                            const key =
                                getQuestionGroupKey(
                                    question
                                );


                            if (
                                !map.has(
                                    key
                                )
                            ) {

                                map.set(
                                    key,
                                    []
                                );
                            }


                            map.get(
                                key
                            ).push(
                                question
                            );
                        }
                    );


                return Array.from(
                    map.entries()
                );

            },
            [
                questions
            ]
        );


    // =========================================================
    // TOPIC GROUPS
    // =========================================================

    const topicGroups =
        useMemo(
            () => {

                const map =
                    new Map();


                questions.forEach(
                    question => {

                        const topic =
                            question.topic ||
                            "General";


                        if (
                            !map.has(
                                topic
                            )
                        ) {

                            map.set(
                                topic,
                                []
                            );
                        }


                        map.get(
                            topic
                        ).push(
                            question
                        );
                    }
                );


                return Array.from(
                    map.entries()
                );

            },
            [
                questions
            ]
        );


    // =========================================================
    // GET QUESTION MARK
    // =========================================================

    const getQuestionMark =
        (
            studentId,
            questionId
        ) => {

            const key =
                getStudentKey(
                    studentId,
                    questionId
                );


            if (
                Object.prototype.hasOwnProperty.call(
                    marks,
                    key
                )
            ) {

                return marks[key];
            }


            if (
                existingMarks[key]
            ) {

                const value =
                    existingMarks[key]
                        .marks_obtained;


                return (
                    value === null ||
                    value === undefined
                )
                    ? ""
                    : String(value);
            }


            return "";
        };


    // =========================================================
    // EXISTING MARK
    // =========================================================

    const hasExistingMark =
        (
            studentId,
            questionId
        ) => {

            const key =
                getStudentKey(
                    studentId,
                    questionId
                );


            return Boolean(
                existingMarks[key]
            );
        };


    // =========================================================
    // HANDLE MARK CHANGE
    // =========================================================

    const handleMarkChange =
        (
            studentId,
            question,
            value
        ) => {

            if (!canEnterMarks) {
                setError("Huwezi kuingiza marks mpaka approval ya examination ikamilike.");
                return;
            }



            const key =
                getStudentKey(
                    studentId,
                    question.id
                );


            if (
                value === ""
            ) {

                setMarks(
                    previous => ({
                        ...previous,
                        [key]: ""
                    })
                );


                setSavedStudents(
                    previous => ({
                        ...previous,
                        [String(
                            studentId
                        )]:
                            false
                    })
                );


                return;
            }


            const numeric =
                Number(value);


            if (
                Number.isNaN(
                    numeric
                )
            ) {
                return;
            }


            const max =
                Number(
                    maxMarks[
                        String(
                            question.id
                        )
                    ]
                );


            if (
                numeric < 0
            ) {
                return;
            }


            if (
                !Number.isNaN(max) &&
                numeric > max
            ) {

                setError(
                    `Marks za Question ${question.question_number || question.id} haziwezi kuzidi ${formatMark(max)}.`
                );

                return;
            }


            setError("");


            setMarks(
                previous => ({
                    ...previous,
                    [key]: value
                })
            );


            setSavedStudents(
                previous => ({
                    ...previous,
                    [String(
                        studentId
                    )]:
                        false
                })
            );
        };


    // =========================================================
    // MARK KEYBOARD
    // =========================================================

    const handleMarkKeyDown =
        (
            event,
            studentId,
            questionIndex
        ) => {

            if (
                event.key !== "Enter"
            ) {
                return;
            }


            event.preventDefault();


            let nextQuestion =
                null;


            let nextIndex =
                questionIndex + 1;


            while (
                nextIndex <
                questions.length
            ) {

                const candidate =
                    questions[
                        nextIndex
                    ];


                if (
                    !isSelectiveQuestion(
                        candidate
                    ) ||
                    isQuestionSelected(
                        studentId,
                        candidate
                    )
                ) {

                    nextQuestion =
                        candidate;

                    break;
                }


                nextIndex++;
            }


            if (
                !nextQuestion
            ) {

                const button =
                    document.getElementById(
                        `save-student-${studentId}`
                    );


                if (button) {

                    button.focus();
                }


                return;
            }


            const nextKey =
                getStudentKey(
                    studentId,
                    nextQuestion.id
                );


            const ref =
                markInputRefs.current[
                    nextKey
                ];


            if (
                ref &&
                !ref.disabled
            ) {

                ref.focus();

                ref.select();
            }
        };


    // =========================================================
    // TOGGLE SELECTIVE QUESTION
    // =========================================================

    const toggleSelectiveQuestion =
        (
            studentId,
            question
        ) => {

            if (!canEnterMarks) {
                setError("Huwezi kuchagua questions mpaka approval ya examination ikamilike.");
                return;
            }



            /*
             * NORMAL QUESTION:
             * absolutely no selection logic.
             */

            if (
                !isSelectiveQuestion(
                    question
                )
            ) {
                return;
            }


            const key =
                getSelectionKey(
                    studentId,
                    question.id
                );


            const currentlySelected =
                Boolean(
                    selectedQuestions[key]
                );


            // -------------------------------------------------
            // UNSELECT
            // -------------------------------------------------

            if (
                currentlySelected
            ) {

                setSelectedQuestions(
                    previous => ({
                        ...previous,
                        [key]: false
                    })
                );


                setMarks(
                    previous => ({
                        ...previous,
                        [key]: ""
                    })
                );


                setSavedStudents(
                    previous => ({
                        ...previous,
                        [String(
                            studentId
                        )]:
                            false
                    })
                );


                setError("");

                setMessage("");

                return;
            }


            // -------------------------------------------------
            // SELECT
            // -------------------------------------------------

            const requiredCount =
                getRequiredSelectionCount(
                    question
                );


            const selectedCount =
                getSelectedCountForQuestion(
                    studentId,
                    question
                );


            if (
                requiredCount !== null &&
                selectedCount >=
                    requiredCount
            ) {

                setError(
                    `Huwezi kuchagua zaidi ya ${requiredCount} questions kwa selective group hii.`
                );

                return;
            }


            setSelectedQuestions(
                previous => ({
                    ...previous,
                    [key]: true
                })
            );


            setSavedStudents(
                previous => ({
                    ...previous,
                    [String(
                        studentId
                    )]:
                        false
                })
            );


            setError("");

            setMessage("");
        };


    // =========================================================
    // STUDENT SELECTED QUESTIONS
    // =========================================================

    const getSelectedQuestionsForStudent =
        studentId => {

            return questions.filter(
                question =>
                    isQuestionSelected(
                        studentId,
                        question
                    )
            );
        };


    // =========================================================
    // STUDENT MAX
    // =========================================================

    const calculateStudentMax =
        studentId => {

            return getSelectedQuestionsForStudent(
                studentId
            ).reduce(
                (
                    total,
                    question
                ) => {

                    const value =
                        Number(
                            maxMarks[
                                String(
                                    question.id
                                )
                            ]
                        );


                    if (
                        Number.isNaN(
                            value
                        )
                    ) {

                        return total;
                    }


                    return (
                        total +
                        value
                    );

                },
                0
            );
        };


    // =========================================================
    // STUDENT TOTAL
    // =========================================================

    const calculateStudentTotal =
        studentId => {

            return getSelectedQuestionsForStudent(
                studentId
            ).reduce(
                (
                    total,
                    question
                ) => {

                    const key =
                        getStudentKey(
                            studentId,
                            question.id
                        );


                    const value =
                        Object.prototype.hasOwnProperty.call(
                            marks,
                            key
                        )
                            ? marks[key]
                            : existingMarks[key]
                                ?.marks_obtained;


                    const number =
                        Number(value);


                    if (
                        Number.isNaN(
                            number
                        )
                    ) {

                        return total;
                    }


                    return (
                        total +
                        number
                    );

                },
                0
            );
        };


    // =========================================================
    // STUDENT PERCENTAGE
    // =========================================================

    const calculateStudentPercentage =
        studentId => {

            const total =
                calculateStudentTotal(
                    studentId
                );


            const selectedMax =
                calculateStudentMax(
                    studentId
                );


            if (
                selectedMax <= 0
            ) {

                return 0;
            }


            return (
                total /
                selectedMax
            ) *
            100;
        };


    // =========================================================
    // ENTERED COUNT
    // =========================================================

    const getStudentEnteredCount =
        studentId => {

            return getSelectedQuestionsForStudent(
                studentId
            ).filter(
                question => {

                    const key =
                        getStudentKey(
                            studentId,
                            question.id
                        );


                    const value =
                        Object.prototype.hasOwnProperty.call(
                            marks,
                            key
                        )
                            ? marks[key]
                            : existingMarks[key]
                                ?.marks_obtained;


                    return (
                        value !== "" &&
                        value !== null &&
                        value !== undefined
                    );
                }
            ).length;
        };


    // =========================================================
    // SELECTIVE VALIDATION
    // =========================================================

    const getStudentSelectionValidation =
        studentId => {

            const problems =
                [];


            selectiveGroups.forEach(
                (
                    [
                        groupKey,
                        groupQuestions
                    ]
                ) => {

                    if (
                        groupQuestions.length === 0
                    ) {
                        return;
                    }


                    const firstQuestion =
                        groupQuestions[0];


                    const requiredCount =
                        getRequiredSelectionCount(
                            firstQuestion
                        );


                    /*
                     * If AI did not specify a number,
                     * there is no numeric validation.
                     */

                    if (
                        requiredCount === null
                    ) {
                        return;
                    }


                    const selectedCount =
                        groupQuestions.filter(
                            question =>
                                isQuestionSelected(
                                    studentId,
                                    question
                                )
                        ).length;


                    if (
                        selectedCount !==
                        requiredCount
                    ) {

                        const instruction =
                            getSelectionInstruction(
                                firstQuestion
                            );


                        problems.push({

                            groupKey,

                            selectedCount,

                            requiredCount,

                            instruction
                        });
                    }
                }
            );


            return problems;
        };


    // =========================================================
    // TOTAL ENTERED MARKS COUNT
    // =========================================================

    const enteredMarksCount =
        useMemo(
            () => {

                let count = 0;


                students.forEach(
                    student => {

                        count +=
                            getStudentEnteredCount(
                                student.id
                            );
                    }
                );


                return count;

            },
            [
                students,
                questions,
                marks,
                existingMarks,
                selectedQuestions,
                maxMarks
            ]
        );


    // =========================================================
    // TOGGLE STUDENT
    // =========================================================

    const toggleStudent =
        studentId => {

            setOpenStudents(
                previous => ({
                    ...previous,

                    [studentId]:
                        !previous[
                            studentId
                        ]
                })
            );
        };


    // =========================================================
    // SAVE STUDENT MARKS
    // =========================================================

    const saveStudentMarks =
        async student => {

            try {

                if (!selectedExamSubjectId) {
                    setError("Exam Subject haijachaguliwa.");
                    return;
                }

                // Fresh Supabase approval check immediately before saving marks.
                // This prevents stale React approval state from blocking a
                // subject that is already fully approved in exam_subjects.
                const {
                    data: currentApproval,
                    error: currentApprovalError
                } = await supabase
                    .from("exam_subjects")
                    .select(`
                        approval_status,
                        approved_by_academic,
                        approved_by_deputy,
                        approved_by_headmaster
                    `)
                    .eq("id", Number(selectedExamSubjectId))
                    .eq("exam_id", Number(examId))
                    .maybeSingle();

                if (currentApprovalError) {
                    throw currentApprovalError;
                }

                // Approval is complete only when the three approval-chain
                // users have approved this exact Exam Subject.
                const approvedNow = Boolean(
                    currentApproval &&
                    hasApprovalUser(currentApproval.approved_by_academic) &&
                    hasApprovalUser(currentApproval.approved_by_deputy) &&
                    hasApprovalUser(currentApproval.approved_by_headmaster)
                );

                if (!approvedNow) {
                    setError(
                        !currentApproval
                            ? "Exam Subject haikupatikana kwa examination hii."
                            : !hasApprovalUser(currentApproval.approved_by_academic)
                                ? "Academic Master Approval bado haijakamilika."
                                : !hasApprovalUser(currentApproval.approved_by_deputy)
                                    ? "Deputy Headmaster Approval bado haijakamilika."
                                    : !hasApprovalUser(currentApproval.approved_by_headmaster)
                                        ? "Headmaster Final Approval bado haijakamilika."
                                        : "Approval status ya examination subject bado si Approved."
                    );
                    return;
                }

                setFullApproval(true);
                setApprovalDetails({
                    academic: true,
                    deputy: true,
                    headmaster: true,
                    statusApproved: true
                });

                setSavingStudentId(
                    student.id
                );

                setError("");

                setMessage("");


                if (
                    !selectedExamSubjectId
                ) {

                    throw new Error(
                        "Exam Subject haijachaguliwa."
                    );
                }


                if (
                    !maxMarksSaved
                ) {

                    throw new Error(
                        "Hifadhi Max Marks kwanza."
                    );
                }


                // -------------------------------------------------
                // VALIDATE SELECTIVE REQUIREMENTS
                // -------------------------------------------------

                const selectionProblems =
                    getStudentSelectionValidation(
                        student.id
                    );


                if (
                    selectionProblems.length > 0
                ) {

                    const problem =
                        selectionProblems[0];


                    if (
                        problem.requiredCount >
                        problem.selectedCount
                    ) {

                        throw new Error(
                            `${getStudentName(student)} anatakiwa kuchagua ${problem.requiredCount} questions lakini amechagua ${problem.selectedCount}.`
                        );
                    }


                    throw new Error(
                        `${getStudentName(student)} amechagua questions ${problem.selectedCount}; anatakiwa kuchagua ${problem.requiredCount} tu.`
                    );
                }


                // -------------------------------------------------
                // GET QUESTIONS TO SAVE
                //
                // Normal questions:
                // ALWAYS included.
                //
                // Selective questions:
                // ONLY included if selected.
                // -------------------------------------------------

                const selectedQuestionsForStudent =
                    getSelectedQuestionsForStudent(
                        student.id
                    );


                if (
                    selectedQuestionsForStudent.length ===
                    0
                ) {

                    throw new Error(
                        "Hakuna questions zilizochaguliwa kwa mwanafunzi huyu."
                    );
                }


                const records =
                    [];


                // -------------------------------------------------
                // VALIDATE QUESTIONS
                // -------------------------------------------------

                for (
                    const question
                    of selectedQuestionsForStudent
                ) {

                    const key =
                        getStudentKey(
                            student.id,
                            question.id
                        );


                    const value =
                        Object.prototype.hasOwnProperty.call(
                            marks,
                            key
                        )
                            ? marks[key]
                            : existingMarks[key]
                                ?.marks_obtained;


                    if (
                        value === "" ||
                        value === null ||
                        value === undefined
                    ) {

                        throw new Error(
                            `Weka marks kwa Question ${question.question_number || question.id} ya ${getStudentName(student)}.`
                        );
                    }


                    const numeric =
                        Number(value);


                    const questionMax =
                        Number(
                            maxMarks[
                                String(
                                    question.id
                                )
                            ]
                        );


                    if (
                        Number.isNaN(
                            numeric
                        ) ||
                        numeric < 0
                    ) {

                        throw new Error(
                            `Marks za Question ${question.question_number || question.id} si sahihi.`
                        );
                    }


                    if (
                        !Number.isNaN(
                            questionMax
                        ) &&
                        numeric >
                            questionMax
                    ) {

                        throw new Error(
                            `Marks za Question ${question.question_number || question.id} haziwezi kuzidi ${formatMark(questionMax)}.`
                        );
                    }


                    records.push({

                        exam_id:
                            Number(
                                examId
                            ),

                        exam_subject_id:
                            Number(
                                selectedExamSubjectId
                            ),

                        question_id:
                            Number(
                                question.id
                            ),

                        student_id:
                            Number(
                                student.id
                            ),

                        marks_obtained:
                            numeric,

                        is_selected:
                            isSelectiveQuestion(question)
                                ? isQuestionSelected(
                                    student.id,
                                    question
                                )
                                : true
                    });
                }


                // -------------------------------------------------
                // SAVE CURRENT MARKS
                // UPSERT prevents duplicate-key failures.
                // -------------------------------------------------

                const {
                    error: deleteError
                } = await supabase
                    .from(
                        "exam_question_marks"
                    )
                    .delete()
                    .eq(
                        "exam_id",
                        Number(examId)
                    )
                    .eq(
                        "exam_subject_id",
                        Number(
                            selectedExamSubjectId
                        )
                    )
                    .eq(
                        "student_id",
                        Number(
                            student.id
                        )
                    );


                if (
                    deleteError
                ) {

                    throw deleteError;
                }


                // -------------------------------------------------
                // INSERT CURRENT MARKS
                // -------------------------------------------------

                const {
                    data,
                    error:
                        saveError
                } = await supabase
                    .from(
                        "exam_question_marks"
                    )
                    .upsert(
                        records,
                        {
                            onConflict:
                                "exam_subject_id,question_id,student_id"
                        }
                    )
                    .select();


                if (
                    saveError
                ) {

                    throw saveError;
                }


                console.log(
                    "SAVED MARKS:",
                    data
                );


                // -------------------------------------------------
                // RELOAD SAVED MARKS
                // -------------------------------------------------

                const {
                    data:
                        refreshedMarks,
                    error:
                        refreshError
                } = await supabase
                    .from(
                        "exam_question_marks"
                    )
                    .select(`
                        id,
                        exam_id,
                        exam_subject_id,
                        question_id,
                        student_id,
                        marks_obtained,
                        created_at,
                        created_by,
                        is_selected
                    `)
                    .eq(
                        "exam_id",
                        Number(examId)
                    )
                    .eq(
                        "exam_subject_id",
                        Number(
                            selectedExamSubjectId
                        )
                    );


                if (
                    refreshError
                ) {

                    throw refreshError;
                }


                const mapped =
                    {};

                const savedMap =
                    {};


                (
                    refreshedMarks || []
                ).forEach(
                    record => {

                        const key =
                            getStudentKey(
                                record.student_id,
                                record.question_id
                            );


                        mapped[key] =
                            record;


                        savedMap[
                            String(
                                record.student_id
                            )
                        ] =
                            true;
                    }
                );


                // -------------------------------------------------
                // REBUILD CURRENT MARK STATE
                // -------------------------------------------------

                const refreshedCurrentMarks =
                    {};


                (
                    refreshedMarks || []
                ).forEach(
                    record => {

                        const key =
                            getStudentKey(
                                record.student_id,
                                record.question_id
                            );


                        refreshedCurrentMarks[
                            key
                        ] =
                            record.marks_obtained ===
                                null ||
                            record.marks_obtained ===
                                undefined
                                ? ""
                                : String(
                                    record.marks_obtained
                                );
                    }
                );


                // -------------------------------------------------
                // REBUILD CURRENT SELECTIVE STATE
                //
                // ONLY TRUE selective questions.
                // -------------------------------------------------

                const refreshedSelections =
                    {};


                (
                    refreshedMarks || []
                ).forEach(
                    record => {

                        if (
                            String(
                                record.student_id
                            ) !==
                            String(
                                student.id
                            )
                        ) {
                            return;
                        }


                        const question =
                            questions.find(
                                item =>
                                    Number(
                                        item.id
                                    ) ===
                                    Number(
                                        record.question_id
                                    )
                            );


                        if (
                            question &&
                            isSelectiveQuestion(
                                question
                            )
                        ) {

                            const key =
                                getSelectionKey(
                                    student.id,
                                    question.id
                                );

                            const selectedInDatabase =
                                record.is_selected === undefined ||
                                record.is_selected === null
                                    ? true
                                    : normalizeBoolean(
                                        record.is_selected
                                    );

                            if (selectedInDatabase) {
                                refreshedSelections[key] = true;
                            }
                        }
                    }
                );


                // -------------------------------------------------
                // UPDATE EXISTING MARKS
                // -------------------------------------------------

                setExistingMarks(
                    mapped
                );


                // -------------------------------------------------
                // UPDATE MARK STATE
                // -------------------------------------------------

                setMarks(
                    previous => {

                        const next = {
                            ...previous
                        };


                        questions.forEach(
                            question => {

                                const key =
                                    getStudentKey(
                                        student.id,
                                        question.id
                                    );


                                delete next[key];
                            }
                        );


                        Object.entries(
                            refreshedCurrentMarks
                        ).forEach(
                            (
                                [
                                    key,
                                    value
                                ]
                            ) => {

                                next[key] =
                                    value;
                            }
                        );


                        return next;
                    }
                );


                // -------------------------------------------------
                // UPDATE SELECTIVE STATE
                // -------------------------------------------------

                setSelectedQuestions(
                    previous => {

                        const next = {
                            ...previous
                        };


                        questions.forEach(
                            question => {

                                if (
                                    isSelectiveQuestion(
                                        question
                                    )
                                ) {

                                    const key =
                                        getSelectionKey(
                                            student.id,
                                            question.id
                                        );


                                    delete next[key];
                                }
                            }
                        );


                        Object.entries(
                            refreshedSelections
                        ).forEach(
                            (
                                [
                                    key,
                                    value
                                ]
                            ) => {

                                next[key] =
                                    value;
                            }
                        );


                        return next;
                    }
                );


                // -------------------------------------------------
                // SAVED STUDENTS
                // -------------------------------------------------

                setSavedStudents(
                    previous => ({
                        ...previous,
                        ...savedMap
                    })
                );


                // -------------------------------------------------
                // SAVED TOTAL
                // -------------------------------------------------

                const savedRawTotal =
                    records.reduce(
                        (
                            total,
                            record
                        ) =>
                            total +
                            Number(
                                record.marks_obtained
                            ),
                        0
                    );


                const savedMax =
                    records.reduce(
                        (
                            total,
                            record
                        ) => {

                            const question =
                                questions.find(
                                    item =>
                                        Number(
                                            item.id
                                        ) ===
                                        Number(
                                            record.question_id
                                        )
                                );


                            if (
                                !question
                            ) {

                                return total;
                            }


                            const max =
                                Number(
                                    maxMarks[
                                        String(
                                            question.id
                                        )
                                    ]
                                );


                            if (
                                Number.isNaN(
                                    max
                                )
                            ) {

                                return total;
                            }


                            return (
                                total +
                                max
                            );

                        },
                        0
                    );


                const savedPercentage =
                    savedMax > 0
                        ? (
                            savedRawTotal /
                            savedMax
                        ) *
                        100
                        : 0;


                setMessage(
                    `Marks za ${getStudentName(student)} zimehifadhiwa. Total: ${formatMark(savedRawTotal)} / ${formatMark(savedMax)} = ${formatMark(savedPercentage)} / 100.`
                );

            } catch (err) {

                console.error(
                    "SAVE STUDENT MARKS ERROR:",
                    {
                        message: err?.message,
                        details: err?.details,
                        hint: err?.hint,
                        code: err?.code,
                        status: err?.status,
                        error: err
                    }
                );

                setError(
                    err?.message ||
                    err?.details ||
                    err?.hint ||
                    "Failed to save student marks."
                );

            } finally {

                setSavingStudentId(
                    null
                );
            }
        };


    // =========================================================
    // LOADING SCREEN
    // =========================================================

    if (
        loadingExam &&
        loadingSubjects
    ) {

        return (

            <div className="min-h-screen bg-gray-50 flex items-center justify-center">

                <div className="bg-white rounded-2xl border shadow-sm p-10">

                    <div className="flex items-center gap-3 text-blue-600">

                        <FaSpinner className="animate-spin" />

                        Loading examination...

                    </div>

                </div>

            </div>
        );
    }


    // =========================================================
    // RENDER
    // =========================================================

    return (

        <div className="min-h-screen bg-gray-50">

            <div className="max-w-7xl mx-auto px-4 py-6">


                {/* =================================================
                    HEADER
                ================================================= */}

                <div className="bg-white rounded-2xl border shadow-sm p-5 mb-6">

                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

                        <div>

                            <button
                                type="button"
                                onClick={() =>
                                    navigate(-1)
                                }
                                className="inline-flex items-center gap-2 text-gray-600 hover:text-blue-600 mb-3"
                            >

                                <FaArrowLeft />

                                Back

                            </button>


                            <h1 className="text-2xl font-bold text-gray-900">

                                Enter Examination Marks

                            </h1>


                            <p className="text-sm text-gray-500 mt-1">

                                {
                                    exam?.exam_name ||
                                    exam?.name ||
                                    `Examination ID ${examId}`
                                }

                            </p>

                        </div>


                        <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-3">

                            <p className="text-xs font-semibold text-blue-600">

                                EXAMINATION ID

                            </p>


                            <p className="text-xl font-bold text-blue-800">

                                {examId}

                            </p>

                        </div>

                    </div>

                </div>


                {/* =================================================
                    ERROR
                ================================================= */}

                {error && (

                    <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 mb-6">

                        <div className="flex items-start gap-3">

                            <FaExclamationTriangle className="mt-1 shrink-0" />

                            <div>

                                <p className="font-bold">
                                    Error
                                </p>


                                <p className="text-sm mt-1">
                                    {error}
                                </p>

                            </div>

                        </div>

                    </div>
                )}


                {/* =================================================
                    SUCCESS
                ================================================= */}

                {message && (

                    <div className="bg-green-50 border border-green-200 text-green-800 rounded-2xl p-4 mb-6">

                        <div className="flex items-start gap-3">

                            <FaCheckCircle className="mt-1 shrink-0" />

                            <div>

                                <p className="font-bold">
                                    Success
                                </p>


                                <p className="text-sm mt-1">
                                    {message}
                                </p>

                            </div>

                        </div>

                    </div>
                )}


                {/* =================================================
                    SUBJECT / CLASS
                ================================================= */}

                <div className="bg-white rounded-2xl border shadow-sm p-5 mb-6">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">


                        {/* SUBJECT */}

                        <div>

                            <label className="block text-sm font-semibold text-gray-700 mb-2">

                                Subject

                            </label>


                            <select
                                value={
                                    selectedSubjectId
                                }
                                onChange={
                                    handleSubjectChange
                                }
                                disabled={
                                    loadingSubjects
                                }
                                className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-white disabled:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >

                                <option value="">

                                    {
                                        loadingSubjects
                                            ? "Loading Subjects..."
                                            : "Select Subject"
                                    }

                                </option>


                                {
                                    availableSubjects.map(
                                        item => {

                                            const subjectId =
                                                getSubjectId(
                                                    item
                                                );


                                            return (

                                                <option
                                                    key={
                                                        subjectId
                                                    }
                                                    value={
                                                        subjectId
                                                    }
                                                >

                                                    {
                                                        getSubjectName(
                                                            item
                                                        )
                                                    }

                                                </option>
                                            );
                                        }
                                    )
                                }

                            </select>

                        </div>


                        {/* CLASS */}

                        <div>

                            <label className="block text-sm font-semibold text-gray-700 mb-2">

                                Class

                            </label>


                            <select
                                value={
                                    selectedClassId
                                }
                                onChange={
                                    handleClassChange
                                }
                                disabled={
                                    !selectedSubjectId
                                }
                                className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-white disabled:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >

                                <option value="">

                                    {
                                        selectedSubjectId
                                            ? "Select Class"
                                            : "Select Subject First"
                                    }

                                </option>


                                {
                                    availableClasses.map(
                                        item => {

                                            const classId =
                                                getClassId(
                                                    item
                                                );


                                            return (

                                                <option
                                                    key={
                                                        classId
                                                    }
                                                    value={
                                                        classId
                                                    }
                                                >

                                                    {
                                                        getClassName(
                                                            item
                                                        )
                                                    }

                                                </option>
                                            );
                                        }
                                    )
                                }

                            </select>

                        </div>

                    </div>


                    {/* SELECTED INFO */}

                    {selectedExamSubject && (

                        <div className="mt-5 grid grid-cols-1 md:grid-cols-5 gap-4">


                            <div className="bg-blue-50 rounded-xl p-4">

                                <p className="text-xs text-blue-600 font-semibold">
                                    SUBJECT
                                </p>


                                <p className="font-bold text-gray-900 mt-1">

                                    {
                                        getSubjectName(
                                            selectedExamSubject
                                        )
                                    }

                                </p>

                            </div>


                            <div className="bg-purple-50 rounded-xl p-4">

                                <p className="text-xs text-purple-600 font-semibold">
                                    CLASS
                                </p>


                                <p className="font-bold text-gray-900 mt-1">

                                    {
                                        getClassName(
                                            selectedExamSubject
                                        )
                                    }

                                </p>

                            </div>


                            <div className="bg-green-50 rounded-xl p-4">

                                <p className="text-xs text-green-600 font-semibold">
                                    QUESTIONS
                                </p>


                                <p className="font-bold text-gray-900 mt-1">

                                    {questions.length}

                                </p>

                            </div>


                            <div className="bg-purple-50 rounded-xl p-4">

                                <p className="text-xs text-purple-600 font-semibold">
                                    SELECTIVE
                                </p>


                                <p className="font-bold text-purple-800 mt-1">

                                    {
                                        selectiveQuestionCount
                                    }

                                </p>

                            </div>


                            <div className="bg-orange-50 rounded-xl p-4">

                                <p className="text-xs text-orange-600 font-semibold">
                                    PAPER MAX
                                </p>


                                <p className="font-bold text-gray-900 mt-1">

                                    {
                                        formatMark(
                                            totalMaxMarks
                                        )
                                    }

                                </p>

                            </div>

                        </div>
                    )}

                    {selectedExamSubjectId && (
                        <div className={`mt-5 rounded-2xl border p-5 ${checkingApproval ? "bg-blue-50 border-blue-200" : fullApproval ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div>
                                    <p className={`font-bold ${checkingApproval ? "text-blue-800" : fullApproval ? "text-green-800" : "text-red-800"}`}>
                                        {checkingApproval ? "Checking Examination Approval..." : fullApproval ? "EXAMINATION APPROVED â€” ENTER MARKS UNLOCKED" : "ENTER MARKS LOCKED â€” APPROVAL NOT COMPLETE"}
                                    </p>
                                    <p className="text-sm text-gray-600 mt-1">Academic Master â†’ Deputy Headmaster â†’ Headmaster</p>
                                </div>
                                <button type="button" onClick={() => checkExamApproval(selectedExamSubjectId)} disabled={checkingApproval} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50">
                                    {checkingApproval ? <><FaSpinner className="animate-spin" /> Checking...</> : "Check Approval Again"}
                                </button>
                            </div>
                            {!checkingApproval && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                                    <div className={`rounded-xl p-3 border ${approvalDetails.academic ? "bg-green-100 border-green-200" : "bg-yellow-100 border-yellow-200"}`}><p className="text-xs font-bold">ACADEMIC MASTER</p><p className="font-semibold mt-1">{approvalDetails.academic ? "âœ“ Approved" : "Pending"}</p></div>
                                    <div className={`rounded-xl p-3 border ${approvalDetails.deputy ? "bg-green-100 border-green-200" : "bg-yellow-100 border-yellow-200"}`}><p className="text-xs font-bold">DEPUTY HEADMASTER</p><p className="font-semibold mt-1">{approvalDetails.deputy ? "âœ“ Approved" : "Pending"}</p></div>
                                    <div className={`rounded-xl p-3 border ${approvalDetails.headmaster ? "bg-green-100 border-green-200" : "bg-yellow-100 border-yellow-200"}`}><p className="text-xs font-bold">HEADMASTER</p><p className="font-semibold mt-1">{approvalDetails.headmaster ? "âœ“ Approved" : "Pending"}</p></div>
                                    <div className={`rounded-xl p-3 border ${approvalDetails.statusApproved ? "bg-green-100 border-green-200" : "bg-yellow-100 border-yellow-200"}`}><p className="text-xs font-bold">EXAM STATUS</p><p className="font-semibold mt-1">{approvalDetails.statusApproved ? "âœ“ Approved" : "Not Approved"}</p></div>
                                </div>
                            )}
                        </div>
                    )}

                    {selectedExamSubjectId && !checkingApproval && !canEnterMarks && (
                        <div className="mt-5 rounded-2xl border-2 border-red-300 bg-red-50 p-6">
                            <div className="flex items-start gap-3">
                                <FaExclamationTriangle className="text-red-600 mt-1" />
                                <div>
                                    <p className="text-lg font-bold text-red-800">
                                        ENTER MARKS IS LOCKED
                                    </p>
                                    <p className="text-sm text-red-700 mt-1">
                                        This examination cannot be opened for marks entry until Academic Master, Deputy Headmaster and Headmaster approval are all completed and the examination status is Approved.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                </div>


                {/* =================================================
                    QUESTIONS LOADING
                ================================================= */}

                {
                    selectedExamSubjectId &&
                    canEnterMarks &&
                    loadingQuestions && (

                        <div className="bg-white rounded-2xl border shadow-sm p-10 flex justify-center mb-6">

                            <div className="flex items-center gap-3 text-blue-600">

                                <FaSpinner className="animate-spin" />

                                Loading examination questions...

                            </div>

                        </div>
                    )
                }


                {/* =================================================
                    MAX MARKS SETUP
                ================================================= */}

                {
                    selectedExamSubjectId &&
                    canEnterMarks &&
                    !loadingQuestions &&
                    questions.length > 0 && (

                        <div className="bg-white rounded-2xl border shadow-sm p-5 mb-6">


                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">

                                <div>

                                    <h2 className="text-lg font-bold text-gray-900">

                                        Step 1: Set Maximum Marks

                                    </h2>


                                    <p className="text-sm text-gray-500 mt-1">

                                        Weka Max Marks kwa kila swali
                                        kulingana na mtihani
                                        uliopandishwa.

                                    </p>

                                </div>


                                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">

                                    <p className="text-xs text-blue-600 font-semibold">

                                        FULL PAPER MAX MARKS

                                    </p>


                                    <p className="text-xl font-bold text-blue-800">

                                        {
                                            formatMark(
                                                totalMaxMarks
                                            )
                                        }

                                    </p>

                                </div>

                            </div>


                            {/* SUMMARY */}

                            <div className="mb-5 grid grid-cols-1 md:grid-cols-4 gap-3">


                                <div className="bg-gray-50 border rounded-xl p-4">

                                    <p className="text-xs text-gray-500 font-semibold">
                                        ALL QUESTIONS
                                    </p>


                                    <p className="text-xl font-bold">
                                        {questions.length}
                                    </p>

                                </div>


                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">

                                    <p className="text-xs text-blue-600 font-semibold">
                                        NORMAL QUESTIONS
                                    </p>


                                    <p className="text-xl font-bold text-blue-800">

                                        {
                                            normalQuestionCount
                                        }

                                    </p>

                                </div>


                                <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">

                                    <p className="text-xs text-purple-600 font-semibold">
                                        SELECTIVE QUESTIONS
                                    </p>


                                    <p className="text-xl font-bold text-purple-800">

                                        {
                                            selectiveQuestionCount
                                        }

                                    </p>

                                </div>


                                <div className="bg-green-50 border border-green-100 rounded-xl p-4">

                                    <p className="text-xs text-green-600 font-semibold">
                                        SELECTIVE GROUPS
                                    </p>


                                    <p className="text-xl font-bold text-green-800">

                                        {
                                            selectiveGroups.length
                                        }

                                    </p>

                                </div>

                            </div>


                            {/* QUESTIONS */}

                            <div className="space-y-3">

                                {
                                    questions.map(
                                        (
                                            question,
                                            questionIndex
                                        ) => {

                                            const questionMaxMark =
                                                maxMarks[
                                                    String(
                                                        question.id
                                                    )
                                                ] ??
                                                "";


                                            const selective =
                                                isSelectiveQuestion(
                                                    question
                                                );


                                            const requirement =
                                                getSelectionRequirement(
                                                    question
                                                );


                                            return (

                                                <div
                                                    key={
                                                        question.id
                                                    }
                                                    className={`border rounded-xl p-4 ${
                                                        questionMaxMark &&
                                                        maxMarksSaved
                                                            ? "border-green-200 bg-green-50"
                                                            : selective
                                                                ? "border-purple-200 bg-purple-50"
                                                                : "border-gray-200 bg-gray-50"
                                                    }`}
                                                >

                                                    <div className="flex flex-col md:flex-row md:items-center gap-4">


                                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                                                            selective
                                                                ? "bg-purple-100 text-purple-700"
                                                                : "bg-blue-100 text-blue-700"
                                                        }`}>

                                                            Q
                                                            {
                                                                question.question_number ||
                                                                questionIndex + 1
                                                            }

                                                        </div>


                                                        <div className="flex-1 min-w-0">

                                                            <div className="flex flex-wrap items-center gap-2">

                                                                <p className="font-semibold text-gray-900">

                                                                    Question{" "}

                                                                    {
                                                                        question.question_number ||
                                                                        questionIndex + 1
                                                                    }

                                                                </p>


                                                                {selective && (

                                                                    <span className="px-2 py-1 rounded-lg bg-purple-100 text-purple-700 text-xs font-bold">

                                                                        SELECTIVE

                                                                    </span>
                                                                )}


                                                                {selective &&
                                                                    requirement.count !== null && (

                                                                        <span className="px-2 py-1 rounded-lg bg-orange-100 text-orange-700 text-xs font-bold">

                                                                            CHOOSE{" "}

                                                                            {
                                                                                requirement.count
                                                                            }

                                                                        </span>
                                                                    )}

                                                            </div>


                                                            <p className="text-sm text-gray-600 mt-1">

                                                                {
                                                                    question.question_text ||
                                                                    "Question text unavailable."
                                                                }

                                                            </p>


                                                            {selective &&
                                                                requirement.instruction && (

                                                                    <div className="mt-2 bg-purple-100 border border-purple-200 rounded-lg p-2">

                                                                        <p className="text-xs font-semibold text-purple-800">

                                                                            AI Selection Rule

                                                                        </p>


                                                                        <p className="text-xs text-purple-700 mt-1">

                                                                            {
                                                                                requirement.instruction
                                                                            }

                                                                        </p>

                                                                    </div>
                                                                )}

                                                        </div>


                                                        <div className="w-full md:w-44">

                                                            <label className="block text-xs font-bold text-gray-600 mb-2">

                                                                MAX MARKS

                                                            </label>


                                                            <input
                                                                ref={
                                                                    element =>
                                                                        registerMaxMarkRef(
                                                                            question.id,
                                                                            element
                                                                        )
                                                                }
                                                                type="number"
                                                                min="0"
                                                                step="any"
                                                                inputMode="decimal"
                                                                value={
                                                                    questionMaxMark
                                                                }
                                                                onChange={
                                                                    event =>
                                                                        handleMaxMarkChange(
                                                                            question.id,
                                                                            event.target.value
                                                                        )
                                                                }
                                                                onKeyDown={
                                                                    event =>
                                                                        handleMaxMarkKeyDown(
                                                                            event,
                                                                            questionIndex
                                                                        )
                                                                }
                                                                className={`w-full border rounded-xl px-4 py-3 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                                                    maxMarksSaved
                                                                        ? "border-green-300 bg-green-50 text-green-800"
                                                                        : "border-blue-300 bg-white text-blue-800"
                                                                }`}
                                                                placeholder="Max"
                                                                disabled={!canEnterMarks}
                                                            />


                                                            <p className="text-xs text-gray-500 text-center mt-2">

                                                                ENTER = Next Question

                                                            </p>

                                                        </div>

                                                    </div>

                                                </div>
                                            );
                                        }
                                    )
                                }

                            </div>


                            {/* SAVE MAX MARKS */}

                            <div className="mt-6 border-t pt-5">

                                <button
                                    ref={
                                        saveMaxMarksButtonRef
                                    }
                                    type="button"
                                    onClick={
                                        saveMaxMarksToDatabase
                                    }
                                    disabled={
                                        savingMaxMarks ||
                                        !canEnterMarks
                                    }
                                    className={`w-full rounded-xl px-5 py-4 flex items-center justify-center gap-3 font-bold text-lg transition ${
                                        maxMarksSaved
                                            ? "bg-green-600 hover:bg-green-700 text-white"
                                            : "bg-blue-600 hover:bg-blue-700 text-white"
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >

                                    {
                                        savingMaxMarks
                                            ? (
                                                <>
                                                    <FaSpinner className="animate-spin" />
                                                    Saving Max Marks...
                                                </>
                                            )
                                            : maxMarksSaved
                                                ? (
                                                    <>
                                                        <FaCheckCircle />
                                                        Max Marks Saved
                                                    </>
                                                )
                                                : (
                                                    <>
                                                        <FaSave />
                                                        Save Max Marks
                                                    </>
                                                )
                                    }

                                </button>


                                <p className="text-xs text-gray-500 text-center mt-2">

                                    Max Marks zita-save moja kwa moja
                                    kwenye{" "}
                                    <strong>
                                        exam_questions.max_marks
                                    </strong>.

                                </p>

                            </div>


                            {/* STATUS */}

                            <div
                                className={`mt-4 rounded-xl p-4 border ${
                                    maxMarksSaved
                                        ? "bg-green-50 border-green-200 text-green-800"
                                        : "bg-yellow-50 border-yellow-200 text-yellow-800"
                                }`}
                            >

                                <div className="flex items-start gap-3">

                                    {
                                        maxMarksSaved
                                            ? (
                                                <FaCheckCircle className="mt-1 shrink-0" />
                                            )
                                            : (
                                                <FaExclamationTriangle className="mt-1 shrink-0" />
                                            )
                                    }


                                    <div>

                                        <p className="font-semibold">

                                            {
                                                maxMarksSaved
                                                    ? "Max Marks zimehifadhiwa."
                                                    : "Max Marks bado hazijahifadhiwa."
                                            }

                                        </p>


                                        <p className="text-sm mt-1">

                                            {
                                                maxMarksSaved
                                                    ? "Sasa unaweza kuendelea chini na kuingiza marks za wanafunzi."
                                                    : "Hifadhi Max Marks kwanza kabla ya kuanza kuingiza marks."
                                            }

                                        </p>

                                    </div>

                                </div>

                            </div>

                        </div>
                    )
                }


                {/* =================================================
                    NO QUESTIONS
                ================================================= */}

                {
                    selectedExamSubjectId &&
                    canEnterMarks &&
                    !loadingQuestions &&
                    questions.length === 0 && (

                        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 mb-6 text-yellow-800">

                            <div className="flex items-start gap-3">

                                <FaExclamationTriangle className="mt-1" />


                                <div>

                                    <p className="font-bold">

                                        Hakuna questions zilizopatikana.

                                    </p>


                                    <p className="text-sm mt-1">

                                        Exam ID:
                                        {" "}
                                        {examId}

                                        {" â€¢ "}

                                        Subject ID:
                                        {" "}
                                        {selectedSubjectId || "-"}

                                        {" â€¢ "}

                                        Class ID:
                                        {" "}
                                        {selectedClassId || "-"}

                                        {" â€¢ "}

                                        Exam Subject ID:
                                        {" "}
                                        {selectedExamSubjectId || "-"}

                                    </p>

                                </div>

                            </div>

                        </div>
                    )
                }


                {/* =================================================
                    QUESTION INFORMATION
                ================================================= */}

                {
                    selectedExamSubjectId &&
                    !loadingQuestions &&
                    questions.length > 0 && (

                        <div className="bg-white rounded-2xl border shadow-sm p-5 mb-6">

                            <div className="flex flex-col lg:flex-row lg:justify-between gap-4">

                                <div>

                                    <h2 className="text-lg font-bold">

                                        Examination Questions

                                    </h2>


                                    <p className="text-sm text-gray-500 mt-1">

                                        Questions:
                                        {" "}
                                        {questions.length}

                                        {" â€¢ "}

                                        Topics:
                                        {" "}
                                        {topicGroups.length}

                                        {" â€¢ "}

                                        Selective:
                                        {" "}
                                        {selectiveQuestionCount}

                                    </p>

                                </div>


                                <div>

                                    {
                                        topicGroups.map(
                                            ([topic]) => (

                                                <span
                                                    key={topic}
                                                    className="inline-block bg-gray-100 rounded-lg px-3 py-1 mr-2 mb-2 text-sm"
                                                >

                                                    {topic}

                                                </span>
                                            )
                                        )
                                    }

                                </div>

                            </div>


                            {/* SELECTIVE RULE SUMMARY */}

                            {
                                selectiveGroups.length > 0 && (

                                    <div className="mt-5 border-t pt-5">

                                        <h3 className="font-bold text-purple-800 mb-3">

                                            AI Selective Question Rules

                                        </h3>


                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                                            {
                                                selectiveGroups.map(
                                                    (
                                                        [
                                                            groupKey,
                                                            groupQuestions
                                                        ]
                                                    ) => {

                                                        const first =
                                                            groupQuestions[0];


                                                        const required =
                                                            getRequiredSelectionCount(
                                                                first
                                                            );


                                                        const instruction =
                                                            getSelectionInstruction(
                                                                first
                                                            );


                                                        return (

                                                            <div
                                                                key={
                                                                    groupKey
                                                                }
                                                                className="bg-purple-50 border border-purple-200 rounded-xl p-4"
                                                            >

                                                                <p className="text-xs font-bold text-purple-600">

                                                                    SELECTIVE GROUP

                                                                </p>


                                                                <p className="font-bold text-purple-900 mt-1">

                                                                    {
                                                                        required !== null
                                                                            ? `Chagua ${required} kati ya ${groupQuestions.length}`
                                                                            : `Chagua maswali kwenye group hii`
                                                                    }

                                                                </p>


                                                                {
                                                                    instruction && (

                                                                        <p className="text-xs text-purple-700 mt-2">

                                                                            {
                                                                                instruction
                                                                            }

                                                                        </p>
                                                                    )
                                                                }

                                                            </div>
                                                        );
                                                    }
                                                )
                                            }

                                        </div>

                                    </div>
                                )
                            }

                        </div>
                    )
                }


                {/* =================================================
                    STEP 2 SUMMARY
                ================================================= */}

                {
                    selectedExamSubjectId &&
                    canEnterMarks &&
                    questions.length > 0 &&
                    maxMarksSaved && (

                        <div className="bg-white rounded-2xl border shadow-sm p-5 mb-6">

                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

                                <div>

                                    <h2 className="text-xl font-bold text-gray-900">

                                        Step 2: Students Marks Entry

                                    </h2>


                                    <p className="text-sm text-gray-500 mt-1">

                                        Max Marks zimehifadhiwa.
                                        Kwa Selective Questions,
                                        weka tick kwenye maswali
                                        aliyojibu kila mwanafunzi.
                                        Mfumo utahesabu Total /100
                                        kulingana na maswali
                                        aliyochagua.

                                    </p>

                                </div>


                                <div className="flex gap-3">

                                    <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">

                                        <p className="text-xs text-blue-600 font-semibold">

                                            PAPER MAX

                                        </p>


                                        <p className="text-lg font-bold text-blue-800">

                                            {
                                                formatMark(
                                                    totalMaxMarks
                                                )
                                            }

                                        </p>

                                    </div>


                                    <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3">

                                        <p className="text-xs text-green-600 font-semibold">

                                            ENTERED MARKS

                                        </p>


                                        <p className="text-lg font-bold text-green-800">

                                            {
                                                enteredMarksCount
                                            }

                                        </p>

                                    </div>

                                </div>

                            </div>

                        </div>
                    )
                }


                {/* =================================================
                    STUDENTS
                ================================================= */}

                {
                    selectedExamSubjectId &&
                    canEnterMarks &&
                    questions.length > 0 &&
                    maxMarksSaved && (

                        loadingStudents

                            ? (

                                <div className="bg-white rounded-2xl border shadow-sm p-10 flex justify-center">

                                    <div className="flex items-center gap-3 text-blue-600">

                                        <FaSpinner
                                            className="animate-spin"
                                        />

                                        Loading students...

                                    </div>

                                </div>

                            )

                            : students.length === 0

                                ? (

                                    <div className="bg-white rounded-2xl border shadow-sm p-10 text-center text-gray-500">

                                        <FaUserGraduate className="mx-auto text-3xl mb-3 text-gray-400" />

                                        Hakuna students waliopatikana
                                        kwa examination subject hii.

                                    </div>

                                )

                                : (

                                    <div className="space-y-4">

                                        {
                                            students.map(
                                                (
                                                    student,
                                                    studentIndex
                                                ) => {

                                                    const isOpen =
                                                        Boolean(
                                                            openStudents[
                                                                student.id
                                                            ]
                                                        );


                                                    const studentTotal =
                                                        calculateStudentTotal(
                                                            student.id
                                                        );


                                                    const studentMax =
                                                        calculateStudentMax(
                                                            student.id
                                                        );


                                                    const studentPercentage =
                                                        calculateStudentPercentage(
                                                            student.id
                                                        );


                                                    const enteredCount =
                                                        getStudentEnteredCount(
                                                            student.id
                                                        );


                                                    const isSaved =
                                                        Boolean(
                                                            savedStudents[
                                                                String(
                                                                    student.id
                                                                )
                                                            ]
                                                        );


                                                    const isSaving =
                                                        savingStudentId ===
                                                        student.id;


                                                    const selectedCount =
                                                        questions.filter(
                                                            question =>
                                                                isSelectiveQuestion(
                                                                    question
                                                                ) &&
                                                                isQuestionSelected(
                                                                    student.id,
                                                                    question
                                                                )
                                                        ).length;


                                                    const selectedTotalQuestions =
                                                        questions.filter(
                                                            question =>
                                                                isQuestionSelected(
                                                                    student.id,
                                                                    question
                                                                )
                                                        ).length;


                                                    const selectionProblems =
                                                        getStudentSelectionValidation(
                                                            student.id
                                                        );


                                                    const hasSelectionProblem =
                                                        selectionProblems.length >
                                                        0;


                                                    return (

                                                        <div
                                                            key={
                                                                student.id
                                                            }
                                                            className="bg-white rounded-2xl border shadow-sm overflow-hidden"
                                                        >


                                                            {/* STUDENT HEADER */}

                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    toggleStudent(
                                                                        student.id
                                                                    )
                                                                }
                                                                className="w-full text-left px-5 py-4 hover:bg-gray-50 transition"
                                                            >

                                                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">


                                                                    <div className="flex items-center gap-3">

                                                                        <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">

                                                                            {
                                                                                studentIndex +
                                                                                1
                                                                            }

                                                                        </div>


                                                                        <div>

                                                                            <h3 className="text-lg font-bold text-gray-900">

                                                                                {
                                                                                    getStudentName(
                                                                                        student
                                                                                    )
                                                                                }

                                                                            </h3>


                                                                            <p className="text-sm text-gray-500">

                                                                                Admission No:
                                                                                {" "}

                                                                                {
                                                                                    student.admission_number ||
                                                                                    student.admission_no ||
                                                                                    "-"
                                                                                }

                                                                            </p>

                                                                        </div>

                                                                    </div>


                                                                    <div className="flex flex-wrap items-center gap-4">


                                                                        {isSaved && (

                                                                            <div className="flex items-center gap-1 text-green-600 text-sm font-semibold">

                                                                                <FaCheckCircle />

                                                                                Saved

                                                                            </div>
                                                                        )}


                                                                        <div className="text-right">

                                                                            <p className="text-xs text-gray-500 font-semibold">

                                                                                CURRENT TOTAL

                                                                            </p>


                                                                            <p className="text-lg font-bold text-blue-700">

                                                                                {
                                                                                    formatMark(
                                                                                        studentTotal
                                                                                    )
                                                                                }

                                                                                {" / "}

                                                                                {
                                                                                    formatMark(
                                                                                        studentMax
                                                                                    )
                                                                                }

                                                                            </p>

                                                                        </div>


                                                                        <div className="text-right">

                                                                            <p className="text-xs text-purple-600 font-semibold">

                                                                                SELECTED

                                                                            </p>


                                                                            <p className="text-lg font-bold text-purple-700">

                                                                                {
                                                                                    selectedCount
                                                                                }

                                                                            </p>

                                                                        </div>


                                                                        <div className="text-right">

                                                                            <p className="text-xs text-green-600 font-semibold">

                                                                                TOTAL /100

                                                                            </p>


                                                                            <p className="text-lg font-bold text-green-700">

                                                                                {
                                                                                    formatMark(
                                                                                        studentPercentage
                                                                                    )
                                                                                }

                                                                            </p>

                                                                        </div>


                                                                        <div className="text-right">

                                                                            <p className="text-xs text-gray-500 font-semibold">

                                                                                ENTERED

                                                                            </p>


                                                                            <p className="text-lg font-bold text-gray-800">

                                                                                {
                                                                                    enteredCount
                                                                                }

                                                                                {" / "}

                                                                                {
                                                                                    selectedTotalQuestions
                                                                                }

                                                                            </p>

                                                                        </div>


                                                                        {
                                                                            isOpen
                                                                                ? (
                                                                                    <FaChevronUp />
                                                                                )
                                                                                : (
                                                                                    <FaChevronDown />
                                                                                )
                                                                        }

                                                                    </div>

                                                                </div>

                                                            </button>


                                                            {/* STUDENT BODY */}

                                                            {isOpen && (

                                                                <div className="border-t">


                                                                    <div className="bg-gray-50 px-5 py-4">

                                                                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">


                                                                            <div>

                                                                                <p className="font-bold text-gray-900">

                                                                                    {
                                                                                        getStudentName(
                                                                                            student
                                                                                        )
                                                                                    }

                                                                                </p>


                                                                                <p className="text-sm text-gray-500">

                                                                                    Ingiza marks
                                                                                    kwa kila
                                                                                    swali.

                                                                                    {" "}

                                                                                    Kwa Selective
                                                                                    Questions,
                                                                                    weka tick
                                                                                    kwenye
                                                                                    maswali
                                                                                    aliyojibu
                                                                                    mwanafunzi.

                                                                                </p>

                                                                            </div>


                                                                            <div className="text-right">

                                                                                <p className="text-xs uppercase font-semibold text-gray-500">

                                                                                    Selected Max Marks

                                                                                </p>


                                                                                <p className="text-2xl font-bold text-blue-700">

                                                                                    {
                                                                                        formatMark(
                                                                                            studentMax
                                                                                        )
                                                                                    }

                                                                                </p>

                                                                            </div>

                                                                        </div>


                                                                        {/* SELECTION STATUS */}

                                                                        {
                                                                            selectiveGroups.length >
                                                                            0 && (

                                                                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">

                                                                                    {
                                                                                        selectiveGroups.map(
                                                                                            (
                                                                                                [
                                                                                                    groupKey,
                                                                                                    groupQuestions
                                                                                                ]
                                                                                            ) => {

                                                                                                const first =
                                                                                                    groupQuestions[0];


                                                                                                const required =
                                                                                                    getRequiredSelectionCount(
                                                                                                        first
                                                                                                    );


                                                                                                const selectedGroupCount =
                                                                                                    groupQuestions.filter(
                                                                                                        question =>
                                                                                                            isQuestionSelected(
                                                                                                                student.id,
                                                                                                                question
                                                                                                            )
                                                                                                    ).length;


                                                                                                const complete =
                                                                                                    required ===
                                                                                                    null
                                                                                                        ? true
                                                                                                        : selectedGroupCount ===
                                                                                                            required;


                                                                                                return (

                                                                                                    <div
                                                                                                        key={
                                                                                                            groupKey
                                                                                                        }
                                                                                                        className={`rounded-xl border p-4 ${
                                                                                                            complete
                                                                                                                ? "bg-green-50 border-green-200"
                                                                                                                : "bg-orange-50 border-orange-200"
                                                                                                        }`}
                                                                                                    >

                                                                                                        <div className="flex items-center justify-between gap-3">

                                                                                                            <div>

                                                                                                                <p className="text-xs font-bold text-gray-500">

                                                                                                                    SELECTIVE REQUIREMENT

                                                                                                                </p>


                                                                                                                <p className="font-bold text-gray-900">

                                                                                                                    {
                                                                                                                        required !== null
                                                                                                                            ? `Chagua ${required} kati ya ${groupQuestions.length}`
                                                                                                                            : "Chagua maswali yaliyotakiwa"
                                                                                                                    }

                                                                                                                </p>

                                                                                                            </div>


                                                                                                            <div className={`text-lg font-bold ${
                                                                                                                complete
                                                                                                                    ? "text-green-700"
                                                                                                                    : "text-orange-700"
                                                                                                            }`}>

                                                                                                                {
                                                                                                                    selectedGroupCount
                                                                                                                }

                                                                                                                {
                                                                                                                    required !== null
                                                                                                                        ? ` / ${required}`
                                                                                                                        : ""
                                                                                                                }

                                                                                                            </div>

                                                                                                        </div>


                                                                                                        {
                                                                                                            complete
                                                                                                                ? (

                                                                                                                    <p className="text-xs text-green-700 mt-2 font-semibold">

                                                                                                                        <FaCheckCircle className="inline mr-1" />

                                                                                                                        Selection iko sawa.

                                                                                                                    </p>

                                                                                                                )
                                                                                                                : (

                                                                                                                    <p className="text-xs text-orange-700 mt-2 font-semibold">

                                                                                                                        Chagua maswali
                                                                                                                        {
                                                                                                                            required !== null
                                                                                                                                ? ` ${required} `
                                                                                                                                : " "
                                                                                                                        }
                                                                                                                        kabla ya Save.

                                                                                                                    </p>
                                                                                                                )
                                                                                                        }

                                                                                                    </div>
                                                                                                );
                                                                                            }
                                                                                        )
                                                                                    }

                                                                                </div>
                                                                            )
                                                                        }

                                                                    </div>


                                                                    {/* QUESTIONS */}

                                                                    <div className="p-5 space-y-4">

                                                                        {
                                                                            questions.map(
                                                                                (
                                                                                    question,
                                                                                    questionIndex
                                                                                ) => {

                                                                                    const value =
                                                                                        getQuestionMark(
                                                                                            student.id,
                                                                                            question.id
                                                                                        );


                                                                                    const existing =
                                                                                        hasExistingMark(
                                                                                            student.id,
                                                                                            question.id
                                                                                        );


                                                                                    const temporaryKey =
                                                                                        getStudentKey(
                                                                                            student.id,
                                                                                            question.id
                                                                                        );


                                                                                    const isTemporary =
                                                                                        Object.prototype.hasOwnProperty.call(
                                                                                            marks,
                                                                                            temporaryKey
                                                                                        );


                                                                                    const questionMaxMark =
                                                                                        maxMarks[
                                                                                            String(
                                                                                                question.id
                                                                                            )
                                                                                        ] ??
                                                                                        "";


                                                                                    const selective =
                                                                                        isSelectiveQuestion(
                                                                                            question
                                                                                        );


                                                                                    /*
                                                                                     * NORMAL QUESTION:
                                                                                     * selected = TRUE automatically.
                                                                                     *
                                                                                     * SELECTIVE:
                                                                                     * selected = checkbox state.
                                                                                     */

                                                                                    const selected =
                                                                                        isQuestionSelected(
                                                                                            student.id,
                                                                                            question
                                                                                        );


                                                                                    const requirement =
                                                                                        getSelectionRequirement(
                                                                                            question
                                                                                        );


                                                                                    const selectedInGroup =
                                                                                        getSelectedCountForQuestion(
                                                                                            student.id,
                                                                                            question
                                                                                        );


                                                                                    const requiredCount =
                                                                                        getRequiredSelectionCount(
                                                                                            question
                                                                                        );


                                                                                    const selectionLimitReached =
                                                                                        selective &&
                                                                                        !selected &&
                                                                                        requiredCount !== null &&
                                                                                        selectedInGroup >=
                                                                                            requiredCount;


                                                                                    return (

                                                                                        <div
                                                                                            key={
                                                                                                question.id
                                                                                            }
                                                                                            className={`border rounded-xl p-4 ${
                                                                                                existing &&
                                                                                                !isTemporary
                                                                                                    ? "border-green-200 bg-green-50"
                                                                                                    : selective
                                                                                                        ? selected
                                                                                                            ? "border-purple-300 bg-purple-50"
                                                                                                            : "border-gray-200 bg-gray-50"
                                                                                                        : "border-gray-200 bg-white"
                                                                                            }`}
                                                                                        >

                                                                                            <div className="flex flex-col lg:flex-row lg:items-start gap-4">


                                                                                                {/* QUESTION NUMBER */}

                                                                                                <div className="shrink-0">

                                                                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold ${
                                                                                                        selective
                                                                                                            ? "bg-purple-100 text-purple-700"
                                                                                                            : "bg-blue-100 text-blue-700"
                                                                                                    }`}>

                                                                                                        Q
                                                                                                        {
                                                                                                            question.question_number ||
                                                                                                            questionIndex + 1
                                                                                                        }

                                                                                                    </div>

                                                                                                </div>


                                                                                                {/* QUESTION */}

                                                                                                <div className="flex-1 min-w-0">

                                                                                                    <div className="flex flex-wrap items-center gap-2 mb-3">

                                                                                                        <span className="font-bold text-gray-900">

                                                                                                            Question{" "}

                                                                                                            {
                                                                                                                question.question_number ||
                                                                                                                questionIndex + 1
                                                                                                            }

                                                                                                        </span>


                                                                                                        {question.topic && (

                                                                                                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs">

                                                                                                                {
                                                                                                                    question.topic
                                                                                                                }

                                                                                                            </span>

                                                                                                        )}


                                                                                                        {selective && (

                                                                                                            <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                                                                                                                selected
                                                                                                                    ? "bg-purple-100 text-purple-700"
                                                                                                                    : "bg-yellow-100 text-yellow-700"
                                                                                                            }`}>

                                                                                                                SELECTIVE QUESTION

                                                                                                            </span>
                                                                                                        )}

                                                                                                    </div>


                                                                                                    {/* SELECTIVE TICK */}

                                                                                                    {selective && (

                                                                                                        <div className={`mb-4 rounded-xl border p-3 ${
                                                                                                            selected
                                                                                                                ? "bg-purple-100 border-purple-200"
                                                                                                                : selectionLimitReached
                                                                                                                    ? "bg-gray-100 border-gray-200"
                                                                                                                    : "bg-white border-gray-200"
                                                                                                        }`}>

                                                                                                            <label className={`flex items-center gap-3 ${
                                                                                                                selectionLimitReached
                                                                                                                    ? "cursor-not-allowed"
                                                                                                                    : "cursor-pointer"
                                                                                                            }`}>

                                                                                                                <input
                                                                                                                    type="checkbox"
                                                                                                                    checked={
                                                                                                                        selected
                                                                                                                    }
                                                                                                                    onChange={() =>
                                                                                                                        toggleSelectiveQuestion(
                                                                                                                            student.id,
                                                                                                                            question
                                                                                                                        )
                                                                                                                    }
                                                                                                                    disabled={
                                                                                                                        isSaving ||
                                                                                                                        selectionLimitReached ||
                                                                                                                        !canEnterMarks
                                                                                                                    }
                                                                                                                    className="w-5 h-5 accent-purple-600"
                                                                                                                />


                                                                                                                <div className="flex-1">

                                                                                                                    <div className="flex flex-wrap items-center justify-between gap-2">

                                                                                                                        <p className="font-bold text-gray-900">

                                                                                                                            {
                                                                                                                                selected
                                                                                                                                    ? "Question selected"
                                                                                                                                    : selectionLimitReached
                                                                                                                                        ? "Selection limit reached"
                                                                                                                                        : "Select this question"
                                                                                                                            }

                                                                                                                        </p>


                                                                                                                        {
                                                                                                                            requiredCount !== null && (

                                                                                                                                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                                                                                                                                    selected
                                                                                                                                        ? "bg-purple-200 text-purple-800"
                                                                                                                                        : "bg-gray-200 text-gray-700"
                                                                                                                                }`}>

                                                                                                                                    {
                                                                                                                                        selectedInGroup
                                                                                                                                    }

                                                                                                                                    {" / "}

                                                                                                                                    {
                                                                                                                                        requiredCount
                                                                                                                                    }

                                                                                                                                </span>

                                                                                                                            )
                                                                                                                        }

                                                                                                                    </div>


                                                                                                                    {
                                                                                                                        requirement.instruction && (

                                                                                                                            <p className="text-xs text-gray-600 mt-1">

                                                                                                                                {
                                                                                                                                    requirement.instruction
                                                                                                                                }

                                                                                                                            </p>
                                                                                                                        )
                                                                                                                    }


                                                                                                                    <p className="text-xs text-gray-500 mt-1">

                                                                                                                        {
                                                                                                                            selected
                                                                                                                                ? "Max Marks yake imejumuishwa kwenye Student Max."
                                                                                                                                : "Haitahesabiwa kwenye Student Max mpaka ichaguliwe."
                                                                                                                        }

                                                                                                                    </p>

                                                                                                                </div>

                                                                                                            </label>

                                                                                                        </div>
                                                                                                    )}


                                                                                                    <p className="text-sm text-gray-700 leading-6">

                                                                                                        {
                                                                                                            question.question_text ||
                                                                                                            "Question text unavailable."
                                                                                                        }

                                                                                                    </p>


                                                                                                    {question.ai_explanation && (

                                                                                                        <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg p-3">

                                                                                                            <p className="text-xs font-semibold text-blue-700 mb-1">

                                                                                                                AI Analysis

                                                                                                            </p>


                                                                                                            <p className="text-xs text-blue-800 leading-5">

                                                                                                                {
                                                                                                                    question.ai_explanation
                                                                                                                }

                                                                                                            </p>

                                                                                                        </div>
                                                                                                    )}

                                                                                                </div>


                                                                                                {/* MARK AREA */}

                                                                                                <div className="w-full lg:w-40 shrink-0">

                                                                                                    <label className="block text-xs font-bold text-gray-600 mb-2">

                                                                                                        MAX MARKS

                                                                                                    </label>


                                                                                                    <div className={`w-full border rounded-xl px-4 py-3 text-center text-lg font-bold mb-3 ${
                                                                                                        selective &&
                                                                                                        !selected
                                                                                                            ? "border-gray-200 bg-gray-100 text-gray-400"
                                                                                                            : "border-green-200 bg-green-50 text-green-800"
                                                                                                    }`}>

                                                                                                        {
                                                                                                            selective &&
                                                                                                            !selected
                                                                                                                ? "Not Selected"
                                                                                                                : formatMark(
                                                                                                                    questionMaxMark
                                                                                                                )
                                                                                                        }

                                                                                                    </div>


                                                                                                    <label className="block text-xs font-bold text-gray-600 mb-2">

                                                                                                        MARKS

                                                                                                    </label>


                                                                                                    <input
                                                                                                        ref={
                                                                                                            element =>
                                                                                                                registerMarkInputRef(
                                                                                                                    student.id,
                                                                                                                    question.id,
                                                                                                                    element
                                                                                                                )
                                                                                                        }
                                                                                                        type="number"
                                                                                                        min="0"
                                                                                                        max={
                                                                                                            questionMaxMark ||
                                                                                                            undefined
                                                                                                        }
                                                                                                        step="any"
                                                                                                        inputMode="decimal"
                                                                                                        value={
                                                                                                            selective &&
                                                                                                            !selected
                                                                                                                ? ""
                                                                                                                : value
                                                                                                        }
                                                                                                        onChange={
                                                                                                            event =>
                                                                                                                handleMarkChange(
                                                                                                                    student.id,
                                                                                                                    question,
                                                                                                                    event.target.value
                                                                                                                )
                                                                                                        }
                                                                                                        onKeyDown={
                                                                                                            event =>
                                                                                                                handleMarkKeyDown(
                                                                                                                    event,
                                                                                                                    student.id,
                                                                                                                    questionIndex
                                                                                                                )
                                                                                                        }
                                                                                                        disabled={
                                                                                                            !canEnterMarks ||
                                                                                                            isSaving ||
                                                                                                            (
                                                                                                                selective &&
                                                                                                                !selected
                                                                                                            )
                                                                                                        }
                                                                                                        className={`w-full border rounded-xl px-4 py-3 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                                                                                            selective &&
                                                                                                            !selected
                                                                                                                ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                                                                                                                : existing &&
                                                                                                                    !isTemporary
                                                                                                                    ? "bg-green-100 border-green-300 text-green-800"
                                                                                                                    : "bg-white border-gray-300"
                                                                                                        }`}
                                                                                                        placeholder={
                                                                                                            selective &&
                                                                                                            !selected
                                                                                                                ? "Not selected"
                                                                                                                : "Enter mark"
                                                                                                        }
                                                                                                    />


                                                                                                    <p className="text-xs text-gray-500 text-center mt-2">

                                                                                                        {
                                                                                                            selective &&
                                                                                                            !selected
                                                                                                                ? "Tick kwanza"
                                                                                                                : (
                                                                                                                    <>
                                                                                                                        Max:
                                                                                                                        {" "}
                                                                                                                        {
                                                                                                                            formatMark(
                                                                                                                                questionMaxMark
                                                                                                                            )
                                                                                                                        }

                                                                                                                        {" â€¢ "}

                                                                                                                        ENTER =
                                                                                                                        Next Question
                                                                                                                    </>
                                                                                                                )
                                                                                                        }

                                                                                                    </p>

                                                                                                </div>

                                                                                            </div>

                                                                                        </div>

                                                                                    );
                                                                                }
                                                                            )
                                                                        }


                                                                        {/* =================================================
                                                                            STUDENT TOTAL
                                                                        ================================================= */}

                                                                        <div className="border-t pt-5 mt-5">

                                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">


                                                                                {/* RAW TOTAL */}

                                                                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">

                                                                                    <p className="text-sm font-semibold text-blue-700">

                                                                                        RAW TOTAL

                                                                                    </p>


                                                                                    <p className="text-xs text-blue-600 mt-1">

                                                                                        Marks zilizopatikana
                                                                                        kwenye maswali
                                                                                        yaliyochaguliwa.

                                                                                    </p>


                                                                                    <p className="text-2xl font-bold text-blue-800 mt-2">

                                                                                        {
                                                                                            formatMark(
                                                                                                studentTotal
                                                                                            )
                                                                                        }

                                                                                        {" / "}

                                                                                        {
                                                                                            formatMark(
                                                                                                studentMax
                                                                                            )
                                                                                        }

                                                                                    </p>

                                                                                </div>


                                                                                {/* TOTAL /100 */}

                                                                                <div className="bg-green-50 border border-green-200 rounded-xl p-4">

                                                                                    <p className="text-sm font-semibold text-green-700">

                                                                                        TOTAL MARKS / 100

                                                                                    </p>


                                                                                    <p className="text-xs text-green-600 mt-1">

                                                                                        Raw marks zime-normalize
                                                                                        kuwa asilimia 100.

                                                                                    </p>


                                                                                    <p className="text-3xl font-bold text-green-800 mt-2">

                                                                                        {
                                                                                            formatMark(
                                                                                                studentPercentage
                                                                                            )
                                                                                        }

                                                                                        {" / 100"}

                                                                                    </p>

                                                                                </div>


                                                                                {/* SELECTION */}

                                                                                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">

                                                                                    <p className="text-sm font-semibold text-purple-700">

                                                                                        SELECTED QUESTIONS

                                                                                    </p>


                                                                                    <p className="text-xs text-purple-600 mt-1">

                                                                                        Maswali yaliyowekwa
                                                                                        tick.

                                                                                    </p>


                                                                                    <p className="text-2xl font-bold text-purple-800 mt-2">

                                                                                        {
                                                                                            selectedTotalQuestions
                                                                                        }

                                                                                    </p>

                                                                                </div>

                                                                            </div>


                                                                            {
                                                                                hasSelectionProblem && (

                                                                                    <div className="mt-4 bg-orange-50 border border-orange-200 rounded-xl p-4 text-orange-800">

                                                                                        <div className="flex items-start gap-3">

                                                                                            <FaExclamationTriangle className="mt-1 shrink-0" />


                                                                                            <div>

                                                                                                <p className="font-bold">

                                                                                                    Selective Questions hazijakamilika

                                                                                                </p>


                                                                                                {
                                                                                                    selectionProblems.map(
                                                                                                        problem => (

                                                                                                            <p
                                                                                                                key={
                                                                                                                    problem.groupKey
                                                                                                                }
                                                                                                                className="text-sm mt-1"
                                                                                                            >

                                                                                                                Chagua{" "}
                                                                                                                {
                                                                                                                    problem.requiredCount
                                                                                                                }
                                                                                                                {" "}questions.
                                                                                                                Umechagua{" "}
                                                                                                                {
                                                                                                                    problem.selectedCount
                                                                                                                }.

                                                                                                            </p>
                                                                                                        )
                                                                                                    )
                                                                                                }

                                                                                            </div>

                                                                                        </div>

                                                                                    </div>
                                                                                )
                                                                            }

                                                                        </div>


                                                                        {/* =================================================
                                                                            SAVE STUDENT
                                                                        ================================================= */}

                                                                        <div className="border-t pt-5 mt-5">

                                                                            <button
                                                                                id={`save-student-${student.id}`}
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    saveStudentMarks(
                                                                                        student
                                                                                    )
                                                                                }
                                                                                disabled={
                                                                                    isSaving ||
                                                                                    loadingExistingMarks ||
                                                                                    !maxMarksSaved ||
                                                                                    hasSelectionProblem ||
                                                                                    !canEnterMarks
                                                                                }
                                                                                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5 py-4 flex items-center justify-center gap-3 font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                                                            >

                                                                                {
                                                                                    isSaving
                                                                                        ? (

                                                                                            <>

                                                                                                <FaSpinner
                                                                                                    className="animate-spin"
                                                                                                />

                                                                                                Saving Marks...

                                                                                            </>

                                                                                        )
                                                                                        : (

                                                                                            <>

                                                                                                <FaSave />

                                                                                                Save Marks for Student

                                                                                            </>

                                                                                        )
                                                                                }

                                                                            </button>


                                                                            <p className="text-xs text-gray-500 text-center mt-2">

                                                                                Normal questions
                                                                                zinahesabiwa
                                                                                moja kwa moja.
                                                                                Selective Questions
                                                                                zinahesabiwa baada ya
                                                                                kuweka tick.
                                                                                Total ya mwisho
                                                                                ina-normalize kuwa
                                                                                <strong>
                                                                                    {" "} /100
                                                                                </strong>.

                                                                            </p>

                                                                        </div>

                                                                    </div>

                                                                </div>

                                                            )}

                                                        </div>
                                                    );
                                                }
                                            )
                                        }

                                    </div>
                                )
                    )
                }

            </div>

        </div>
    );
}


export default EnterMarks;
