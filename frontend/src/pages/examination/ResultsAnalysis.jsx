// ============================================================
// src/pages/examination/ResultsAnalysis.jsx
// Professional, traceable and data-first examination analysis
// ============================================================

import {
    useCallback,
    useEffect,
    useMemo,
    useState
} from "react";

import { createPortal } from "react-dom";
import axios from "axios";

import {
    useNavigate,
    useParams,
    useSearchParams
} from "react-router-dom";

import {
    FaArrowLeft,
    FaArrowUp,
    FaArrowDown,
    FaBrain,
    FaChartBar,
    FaChartLine,
    FaCheckCircle,
    FaClipboardList,
    FaExclamationTriangle,
    FaEye,
    FaFileAlt,
    FaFilter,
    FaEnvelope,
    FaWhatsapp,
    FaSms,
    FaGraduationCap,
    FaLayerGroup,
    FaListOl,
    FaPrint,
    FaRedo,
    FaSearch,
    FaSpinner,
    FaTimes,
    FaTimesCircle,
    FaTrophy,
    FaUserGraduate
} from "react-icons/fa";

import { supabase } from "../../services/supabase";
import { useSchool } from "../../context/SchoolContext";
import { useRole } from "../../context/RoleContext";

const API_URL = "https://africore-erp-pro.onrender.com/api";


// ============================================================
// HELPERS
// ============================================================

const numberValue = value => {
    if (value === null || value === undefined || value === "") {
        return 0;
    }

    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

const idValue = value => {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value);
};

const formatNumber = (value, decimals = 2) => {
    const n = numberValue(value);

    return n
        .toFixed(decimals)
        .replace(/\.00$/, "")
        .replace(/(\.\d)0$/, "$1");
};

const clamp = (value, min = 0, max = 100) =>
    Math.min(max, Math.max(min, numberValue(value)));

const normalizeSelectionType = value =>
    String(value || "ALL").trim().toUpperCase() === "SELECTIVE"
        ? "SELECTIVE"
        : "ALL";

//  O-Level subject grading (NECTA): A=75-100, B=65-74, C=45-64, D=30-44, F=0-29.
const getGrade = percentage => {
    const p = numberValue(percentage);
    if (p >= 75) return "A";
    if (p >= 65) return "B";
    if (p >= 45) return "C";
    if (p >= 30) return "D";
    return "F";
};

const _GRADE_POINTS = Object.freeze({ A: 1, B: 2, C: 3, D: 4, F: 5 });
const getGradePoint = grade => _GRADE_POINTS[String(grade || "").trim().toUpperCase()] ?? 5;

// Standard result: Best 7 analysed subjects determine Aggregate, GPA and Division.
const calculateResult = subjectResults => {
    // Every subject assigned to the student is part of the result. Missing
    // marks are treated as 0%, therefore they receive grade F and 5 points.
    const analysed = Array.isArray(subjectResults)
        ? subjectResults
            .filter(row => row)
            .map(row => {
                const percentage = clamp(
                    row.percentage !== undefined
                        ? row.percentage
                        : numberValue(row.total)
                );
                const grade = getGrade(percentage);
                return {
                    ...row,
                    percentage,
                    grade,
                    point: getGradePoint(grade)
                };
            })
        : [];

    // Always use exactly seven subjects when seven or more are available.
    // Missing marks remain F=5, so they can never disappear from the calculation.
    const bestSeven = [...analysed]
        .sort((a, b) => a.point - b.point || numberValue(b.percentage) - numberValue(a.percentage))
        .slice(0, 7);

    if (bestSeven.length === 0) {
        return {
            eligible: false,
            analysedSubjects: 0,
            bestSeven: [],
            aggregate: null,
            gpa: null,
            division: null,
            divisionLabel: "Not Calculated"
        };
    }

    const aggregate = bestSeven.reduce((sum, row) => sum + numberValue(row.point), 0);
    const subjectCount = bestSeven.length;
    const gpa = subjectCount === 7 ? aggregate / 7 : null;

    let division = "0";
    if (subjectCount === 7) {
        if (aggregate <= 17) division = "I";
        else if (aggregate <= 21) division = "II";
        else if (aggregate <= 25) division = "III";
        else if (aggregate <= 33) division = "IV";
    }

    return {
        eligible: subjectCount >= 7,
        analysedSubjects: analysed.length,
        bestSeven,
        aggregate,
        gpa,
        division,
        divisionLabel: division === "0" ? "Division 0" : `Division ${division}`
    };
};

const getRemark = grade => {
    switch (String(grade || "").toUpperCase()) {
        case "A": return "Excellent";
        case "B": return "Very Good";
        case "C": return "Good";
        case "D": return "Pass";
        default: return "Fail";
    }
};

const performanceLabel = percentage => {
    const p = numberValue(percentage);

    if (p >= 75) return "Excellent";
    if (p >= 60) return "Good";
    if (p >= 50) return "Satisfactory";
    if (p >= 40) return "Needs Improvement";
    return "Critical";
};

const performanceClass = percentage => {
    const p = numberValue(percentage);

    if (p >= 75) return "text-emerald-700 bg-emerald-50 border-emerald-200";
    if (p >= 60) return "text-blue-700 bg-blue-50 border-blue-200";
    if (p >= 50) return "text-amber-700 bg-amber-50 border-amber-200";
    if (p >= 40) return "text-orange-700 bg-orange-50 border-orange-200";
    return "text-red-700 bg-red-50 border-red-200";
};

const gradeClass = grade => {
    switch (String(grade || "").toUpperCase()) {
        case "A": return "text-emerald-700 bg-emerald-50 border-emerald-200";
        case "B": return "text-blue-700 bg-blue-50 border-blue-200";
        case "C": return "text-amber-700 bg-amber-50 border-amber-200";
        case "D": return "text-orange-700 bg-orange-50 border-orange-200";
        default: return "text-red-700 bg-red-50 border-red-200";
    }
};

const safeName = student => {
    const name = [
        student?.first_name,
        student?.middle_name,
        student?.last_name
    ]
        .filter(Boolean)
        .join(" ")
        .trim();

    return name || student?.full_name || "Unnamed Student";
};

const getAdmission = student =>
    student?.admission_number ||
    student?.admission_no ||
    student?.admission ||
    "â€”";

const getClassName = cls => {
    if (!cls) return "Unknown Class";

    return (
        cls.class_name ||
        cls.name ||
        cls.class ||
        cls.title ||
        cls.code ||
        "Class"
    );
};

const getSubjectName = subject => {
    if (!subject) return "Unknown Subject";

    return subject.subject_name || subject.name || subject.title || "Subject";
};

const getQuestionLabel = question => {
    const n = question?.question_number;
    return n !== null && n !== undefined && n !== ""
        ? `Q${n}`
        : "Question";
};

const pct = (obtained, possible) =>
    numberValue(possible) > 0
        ? clamp((numberValue(obtained) / numberValue(possible)) * 100)
        : 0;


// ============================================================
// RESULT SHARING HELPERS
// Parent contact details come directly from Student Registration.
// No parent fields are created inside Result Analysis.
// ============================================================

const getParentName = student =>
    student?.parent_name || "Parent/Guardian";

const getParentPhone = student =>
    String(student?.parent_phone || "").trim();

const getParentEmail = student =>
    String(student?.parent_email || "").trim();

const buildStudentResultMessage = (exam, report) => {
    const lines = [
        `Dear ${getParentName(report)},`,
        "",
        `Examination Results for ${report.full_name || "Student"}`,
        `Admission No: ${report.admission || "â€”"}`,
        `Examination: ${exam?.name || exam?.exam_name || exam?.title || "Examination"}`,
        `Class: ${report.class_name || "â€”"}`,
        "",
        "SUBJECT RESULTS:"
    ];

    (report.subjects || []).forEach((subject, index) => {
        lines.push(
            `${index + 1}. ${subject.subject_name || "Subject"}: ${formatNumber(subject.total)} (${formatNumber(subject.percentage, 1)}%) - Grade ${subject.grade} - ${subject.report_status || (subject.pass ? "Passed" : "Failed")}`
        );
    });

    lines.push(
        "",
        "OVERALL RESULT:",
        `Total Marks: ${formatNumber(report.total)}`,
        `Average: ${formatNumber(report.percentage, 1)}%`,
        `Grade: ${report.grade || "â€”"}`,
        `Position: ${report.position || "â€”"}/${report.rankTotal || "â€”"}`,
        `Status: ${report.reportStatus || (report.percentage >= 40 ? "Passed" : "Failed")}`,
        "",
        "Thank you.",
        "AfriCore School Management System"
    );

    return lines.join("\n");
};

const normalizePhoneForWhatsApp = phone => {
    const value = String(phone || "").trim();
    if (!value) return "";
    const digits = value.replace(/[^0-9]/g, "");
    if (value.startsWith("+")) return digits;
    if (digits.startsWith("255")) return digits;
    if (digits.startsWith("0")) return `255${digits.slice(1)}`;
    return digits;
};

// ============================================================
// COMPONENT
// ============================================================

export default function ResultsAnalysis() {
    const navigate = useNavigate();
    const { showSchoolName, schoolName } = useSchool();
    const documentBrandName = showSchoolName && schoolName ? schoolName : "AfriCore ERP";
    const { selectedRoleId } = useRole();
    const isSubjectTeacher = Number(selectedRoleId) === 5;
    const { examId } = useParams();
    const [searchParams] = useSearchParams();

    // Subject Teacher context comes from the same URL contract used by
    // examination navigation: exam_subject_id + subject_id + class_id.
    const urlExamSubjectId =
        searchParams.get("exam_subject_id") ||
        searchParams.get("examSubjectId") ||
        "";

    const urlSubjectId =
        searchParams.get("subject_id") ||
        searchParams.get("subjectId") ||
        "";

    const urlClassId =
        searchParams.get("class_id") ||
        searchParams.get("classId") ||
        "";


    // --------------------------------------------------------
    // DATA STATE
    // --------------------------------------------------------

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [sendingChannel, setSendingChannel] = useState("");
    const [communicationStatus, setCommunicationStatus] = useState({});

    const [exam, setExam] = useState(null);
    const [examSubjects, setExamSubjects] = useState([]);
    const [questions, setQuestions] = useState([]);
    const [students, setStudents] = useState([]);
    const [marks, setMarks] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [classes, setClasses] = useState([]);

    // --------------------------------------------------------
    // UI STATE
    // --------------------------------------------------------

    const [selectedClassId, setSelectedClassId] = useState(urlClassId || "ALL");
    const [selectedSubjectId, setSelectedSubjectId] = useState(urlSubjectId || "ALL");
    const [activeTab, setActiveTab] = useState("overview");
    const [studentSearch, setStudentSearch] = useState("");
    const [subjectSearch, setSubjectSearch] = useState("");
    const [topicSearch, setTopicSearch] = useState("");
    const [questionSearch, setQuestionSearch] = useState("");
    const [detail, setDetail] = useState(null);
    const [printReport, setPrintReport] = useState(null);
    const [studentReportFields, setStudentReportFields] = useState({});


    // ========================================================
    // STUDENT REPORT NOTES
    // These are report-level fields, intentionally kept separate from
    // academic marks. They are persisted in the browser so they remain
    // available after closing/reopening the report without inventing
    // unverified Supabase columns.
    // ========================================================

    useEffect(() => {
        if (!examId || typeof window === "undefined") return;

        try {
            const key = `africore_student_report_fields_${examId}`;
            const saved = window.localStorage.getItem(key);
            setStudentReportFields(saved ? JSON.parse(saved) : {});
        } catch (storageError) {
            console.warn("Unable to load student report fields:", storageError);
            setStudentReportFields({});
        }
    }, [examId]);

    const updateStudentReportFields = useCallback((studentId, field, value) => {
        setStudentReportFields(previous => {
            const next = {
                ...previous,
                [idValue(studentId)]: {
                    ...(previous[idValue(studentId)] || {}),
                    [field]: value
                }
            };

            if (examId && typeof window !== "undefined") {
                try {
                    window.localStorage.setItem(
                        `africore_student_report_fields_${examId}`,
                        JSON.stringify(next)
                    );
                } catch (storageError) {
                    console.warn("Unable to save student report fields:", storageError);
                }
            }

            return next;
        });
    }, [examId]);


    // ========================================================
    // LOAD DATA
    // ========================================================

    const loadAnalysis = useCallback(async (refresh = false) => {
        try {
            if (refresh) setRefreshing(true);
            else setLoading(true);

            setError("");

            if (!examId) {
                throw new Error("Exam ID haijapatikana.");
            }

            // 1. EXAM
            const { data: examData, error: examError } = await supabase
                .from("exams")
                .select("*")
                .eq("id", examId)
                .single();

            if (examError) throw examError;
            setExam(examData);

            // 2. EXAM SUBJECTS
            const { data: examSubjectData, error: examSubjectError } = await supabase
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
                    created_at
                `)
                .eq("exam_id", examId)
                .order("id", { ascending: true });

            if (examSubjectError) throw examSubjectError;

            const allExamSubjects = examSubjectData || [];

            // Subject Teacher can see ONLY the exact Subject + Class assignment.
            // We additionally honor exam_subject_id from the URL when supplied,
            // so the teacher cannot accidentally switch to another class/subject.
            let safeExamSubjects = allExamSubjects;

            if (isSubjectTeacher) {
                let assignments = [];
                let currentProfile = null;

                try {
                    const {
                        data: { user }
                    } = await supabase.auth.getUser();

                    if (user?.id) {
                        const { data: profileData, error: profileError } = await supabase
                            .from("profiles")
                            .select("id, school_id, teacher_id")
                            .eq("id", user.id)
                            .maybeSingle();

                        if (!profileError) currentProfile = profileData;
                    }
                } catch (profileLoadError) {
                    console.warn("RESULT ANALYSIS PROFILE SCOPE WARNING:", profileLoadError);
                }

                if (currentProfile?.teacher_id && currentProfile?.school_id) {
                    const { data: assignmentData, error: assignmentError } = await supabase
                        .from("teacher_assignments")
                        .select("id, school_id, teacher_id, subject_id, class_id")
                        .eq("teacher_id", Number(currentProfile.teacher_id))
                        .eq("school_id", Number(currentProfile.school_id));

                    if (assignmentError) {
                        console.warn("RESULT ANALYSIS TEACHER ASSIGNMENT WARNING:", assignmentError);
                    } else {
                        assignments = assignmentData || [];
                    }
                }

                const assignedPairs = new Set(
                    assignments.map(row => `${idValue(row.subject_id)}::${idValue(row.class_id)}`)
                );

                safeExamSubjects = allExamSubjects.filter(row => {
                    const exactAssignment = assignedPairs.has(
                        `${idValue(row.subject_id)}::${idValue(row.class_id)}`
                    );

                    const examSubjectMatch = !urlExamSubjectId ||
                        idValue(row.id) === idValue(urlExamSubjectId);

                    const urlSubjectMatch = !urlSubjectId ||
                        idValue(row.subject_id) === idValue(urlSubjectId);

                    const urlClassMatch = !urlClassId ||
                        idValue(row.class_id) === idValue(urlClassId);

                    return exactAssignment && examSubjectMatch && urlSubjectMatch && urlClassMatch;
                });

                // If the URL contains an exam_subject_id but it is not assigned
                // to this teacher, do not expose another subject as a fallback.
                if (urlExamSubjectId && safeExamSubjects.length === 0) {
                    console.warn("SUBJECT TEACHER RESULT ANALYSIS: URL subject is not assigned to teacher.");
                }
            }

            setExamSubjects(safeExamSubjects);

            // 3. SUBJECTS
            const subjectIds = [
                ...new Set(
                    safeExamSubjects
                        .map(row => row.subject_id)
                        .filter(Boolean)
                        .map(idValue)
                )
            ];

            let subjectData = [];
            if (subjectIds.length > 0) {
                const { data, error: subjectError } = await supabase
                    .from("subjects")
                    .select(`
                        id,
                        subject_name,
                        subject_code,
                        education_level,
                        is_compulsory,
                        is_active
                    `)
                    .in("id", subjectIds);

                if (subjectError) throw subjectError;
                subjectData = data || [];
            }
            setSubjects(subjectData);

            // 4. CLASSES
            const classIds = [
                ...new Set(
                    safeExamSubjects
                        .map(row => row.class_id)
                        .filter(Boolean)
                        .map(idValue)
                )
            ];

            let classData = [];
            if (classIds.length > 0) {
                const { data, error: classError } = await supabase
                    .from("classes")
                    .select("*")
                    .in("id", classIds);

                if (classError) throw classError;
                classData = data || [];
            }
            setClasses(classData);

            // 5. QUESTIONS
            const { data: questionData, error: questionError } = await supabase
                .from("exam_questions")
                .select(`
                    id,
                    exam_id,
                    subject_id,
                    question_number,
                    question_text,
                    topic,
                    sub_topic,
                    difficulty_level,
                    bloom_level,
                    question_type,
                    ai_explanation,
                    ai_processed,
                    max_marks,
                    section,
                    section_type,
                    is_selective,
                    selection_required,
                    selection_count,
                    selection_total,
                    selection_group,
                    selection_instruction
                `)
                .eq("exam_id", examId)
                .order("question_number", { ascending: true });

            if (questionError) throw questionError;
            setQuestions(questionData || []);

            // 6. QUESTION-LEVEL MARKS
            // These are used for question/topic traceability.
            const { data: questionMarksData, error: questionMarksError } = await supabase
                .from("exam_question_marks")
                .select(`
                    id,
                    exam_id,
                    exam_subject_id,
                    question_id,
                    student_id,
                    marks_obtained,
                    created_at
                `)
                .eq("exam_id", examId);

            if (questionMarksError) {
                console.error("RESULT ANALYSIS QUESTION MARKS ERROR:", questionMarksError);
            }

            // 7. SUBJECT-LEVEL MARKS
            // IMPORTANT: the current exam_marks structure uses exam_subject_id.
            // Never query exam_marks.subject_id.
            const { data: subjectMarksData, error: subjectMarksError } = await supabase
                .from("exam_marks")
                .select(`
                    id,
                    exam_id,
                    exam_subject_id,
                    student_id,
                    marks_obtained,
                    grade,
                    remark,
                    created_at
                `)
                .eq("exam_id", examId);

            if (subjectMarksError) {
                console.error("RESULT ANALYSIS SUBJECT MARKS ERROR:", subjectMarksError);
            }

            const scopedExamSubjectIds = new Set(
                safeExamSubjects.map(row => idValue(row.id))
            );

            const safeQuestionMarks = (questionMarksData || []).filter(mark =>
                !isSubjectTeacher || scopedExamSubjectIds.has(idValue(mark.exam_subject_id))
            );

            const safeSubjectMarks = (subjectMarksData || []).filter(mark =>
                !isSubjectTeacher || scopedExamSubjectIds.has(idValue(mark.exam_subject_id))
            );

            // Keep both sources in one analysis collection.
            // source=exam_marks identifies the final subject mark.
            // source=exam_question_marks identifies question-level marks.
            const combinedMarks = [
                ...safeQuestionMarks.map(row => ({
                    ...row,
                    source: "exam_question_marks"
                })),
                ...safeSubjectMarks.map(row => ({
                    ...row,
                    question_id: null,
                    source: "exam_marks"
                }))
            ];

            setMarks(combinedMarks);

            // 8. STUDENTS
            // Include students in exam classes AND students that have saved
            // marks. This keeps old exam candidates visible after promotion.
            const markedStudentIds = [
                ...new Set(
                    combinedMarks
                        .map(mark => idValue(mark.student_id))
                        .filter(Boolean)
                )
            ];

            let studentData = [];

            const studentColumns = `
                id,
                admission_number,
                admission_no,
                first_name,
                middle_name,
                last_name,
                gender,
                current_class_id,
                class_name,
                stream,
                student_status,
                status,
                parent_name,
                parent_phone,
                parent_email
            `;

            if (classIds.length > 0) {
                const { data, error: studentError } = await supabase
                    .from("students")
                    .select(studentColumns)
                    .in("current_class_id", classIds);

                if (studentError) throw studentError;
                studentData = data || [];
            }

            if (markedStudentIds.length > 0) {
                const { data: markedStudents, error: markedStudentError } = await supabase
                    .from("students")
                    .select(studentColumns)
                    .in("id", markedStudentIds);

                if (markedStudentError) throw markedStudentError;

                const merged = new Map();
                [...studentData, ...(markedStudents || [])].forEach(student => {
                    merged.set(idValue(student.id), student);
                });
                studentData = [...merged.values()];
            }

            // Optional historical class fallback.
            if (classIds.length > 0) {
                try {
                    const { data: historyRows, error: historyError } = await supabase
                        .from("student_academic_history")
                        .select("student_id, academic_year_id, to_class_id, student_status")
                        .in("to_class_id", classIds);

                    if (!historyError && historyRows?.length) {
                        const historicalIds = [
                            ...new Set(
                                historyRows
                                    .map(row => idValue(row.student_id))
                                    .filter(Boolean)
                            )
                        ];

                        if (historicalIds.length > 0) {
                            const { data: historicalStudents, error: historicalStudentsError } = await supabase
                                .from("students")
                                .select(studentColumns)
                                .in("id", historicalIds);

                            if (!historicalStudentsError) {
                                const merged = new Map();
                                [...studentData, ...(historicalStudents || [])].forEach(student => {
                                    merged.set(idValue(student.id), student);
                                });
                                studentData = [...merged.values()];
                            }
                        }
                    }
                } catch (historyLoadError) {
                    console.warn("Academic history fallback unavailable:", historyLoadError);
                }
            }

            // IMPORTANT: a student may have been promoted to another class
            // after this examination. For Results Analysis, the examination
            // class must remain the student's reporting class. Derive it from
            // the saved exam marks/question marks instead of the student's
            // current class. This is what keeps old examination reports
            // populated after promotion.
            const examClassByStudent = new Map();
            combinedMarks.forEach(mark => {
                const examSubject = safeExamSubjects.find(
                    es => idValue(es.id) === idValue(mark.exam_subject_id)
                );
                if (examSubject?.class_id && !examClassByStudent.has(idValue(mark.student_id))) {
                    examClassByStudent.set(
                        idValue(mark.student_id),
                        examSubject.class_id
                    );
                }
            });

            studentData = studentData.map(student => {
                const examClassId = examClassByStudent.get(idValue(student.id));
                return examClassId
                    ? {
                        ...student,
                        exam_class_id: examClassId,
                        current_class_id: examClassId
                    }
                    : student;
            });

            setStudents(studentData);

            console.info("RESULT ANALYSIS DATA LOADED", {
                examId,
                examSubjects: safeExamSubjects.length,
                questions: questionData?.length || 0,
                questionMarks: safeQuestionMarks.length,
                subjectMarks: safeSubjectMarks.length,
                students: studentData.length
            });
        } catch (requestError) {
            console.error("RESULT ANALYSIS ERROR:", requestError);
            setError(
                requestError?.message ||
                "Imeshindikana kusoma taarifa za Results Analysis kutoka Supabase."
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [examId, isSubjectTeacher, urlExamSubjectId, urlSubjectId, urlClassId]);


    useEffect(() => {
        loadAnalysis();
    }, [loadAnalysis]);

    // Subject Teacher filters are locked to the exact assigned exam subject.
    // Other roles retain the existing All Classes / All Subjects behavior.
    useEffect(() => {
        if (!isSubjectTeacher) return;

        const scopedSubject =
            examSubjects.find(row =>
                (!urlExamSubjectId || idValue(row.id) === idValue(urlExamSubjectId)) &&
                (!urlSubjectId || idValue(row.subject_id) === idValue(urlSubjectId)) &&
                (!urlClassId || idValue(row.class_id) === idValue(urlClassId))
            ) || examSubjects[0];

        if (scopedSubject) {
            setSelectedClassId(idValue(scopedSubject.class_id));
            setSelectedSubjectId(idValue(scopedSubject.subject_id));
        }
    }, [
        isSubjectTeacher,
        examSubjects,
        urlExamSubjectId,
        urlSubjectId,
        urlClassId
    ]);


    // ========================================================
    // INDEXES
    // ========================================================

    const subjectMap = useMemo(() => {
        const map = new Map();
        subjects.forEach(subject => map.set(idValue(subject.id), subject));
        return map;
    }, [subjects]);

    const classMap = useMemo(() => {
        const map = new Map();
        classes.forEach(cls => map.set(idValue(cls.id), cls));
        return map;
    }, [classes]);

    const questionMap = useMemo(() => {
        const map = new Map();
        questions.forEach(question => map.set(idValue(question.id), question));
        return map;
    }, [questions]);

    const studentMap = useMemo(() => {
        const map = new Map();
        students.forEach(student => map.set(idValue(student.id), student));
        return map;
    }, [students]);

    const marksByStudent = useMemo(() => {
        const map = new Map();

        marks.forEach(mark => {
            const key = idValue(mark.student_id);
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(mark);
        });

        return map;
    }, [marks]);

    const marksByQuestion = useMemo(() => {
        const map = new Map();

        marks.forEach(mark => {
            const key = idValue(mark.question_id);
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(mark);
        });

        return map;
    }, [marks]);

    const marksByExamSubject = useMemo(() => {
        const map = new Map();

        marks.forEach(mark => {
            const key = idValue(mark.exam_subject_id);
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(mark);
        });

        return map;
    }, [marks]);

    const getQuestionMax = useCallback(questionId => {
        return numberValue(questionMap.get(idValue(questionId))?.max_marks);
    }, [questionMap]);

    const getStudentMarks = useCallback(studentId => {
        return marksByStudent.get(idValue(studentId)) || [];
    }, [marksByStudent]);


    // ========================================================
    // FILTERED EXAM SUBJECTS
    // ========================================================

    const filteredExamSubjects = useMemo(() => {
        return examSubjects.filter(row => {
            const classOK =
                selectedClassId === "ALL" ||
                idValue(row.class_id) === idValue(selectedClassId);

            const subjectOK =
                selectedSubjectId === "ALL" ||
                idValue(row.subject_id) === idValue(selectedSubjectId);

            return classOK && subjectOK;
        });
    }, [examSubjects, selectedClassId, selectedSubjectId]);

    const filteredExamSubjectIds = useMemo(() => {
        return new Set(
            filteredExamSubjects.map(row => idValue(row.id))
        );
    }, [filteredExamSubjects]);

    const filteredSubjectIds = useMemo(() => {
        return new Set(
            filteredExamSubjects.map(row => idValue(row.subject_id))
        );
    }, [filteredExamSubjects]);

    const availableClasses = useMemo(() => {
        const ids = new Set(examSubjects.map(row => idValue(row.class_id)));
        return classes.filter(cls => ids.has(idValue(cls.id)));
    }, [classes, examSubjects]);

    const availableSubjects = useMemo(() => {
        const ids = new Set(examSubjects.map(row => idValue(row.subject_id)));
        return subjects.filter(subject => ids.has(idValue(subject.id)));
    }, [subjects, examSubjects]);

    const currentClassLabel = selectedClassId === "ALL"
        ? "All Examination Classes"
        : getClassName(classMap.get(idValue(selectedClassId)));


    // ========================================================
    // STUDENT SUBJECT RESULT
    // IMPORTANT: selective-question logic remains based on the
    // examination configuration and actual saved question marks.
    // ========================================================

    const calculateStudentSubject = useCallback((studentId, examSubject) => {
        const examSubjectId = idValue(examSubject.id);
        const studentMarks = getStudentMarks(studentId).filter(
            mark => idValue(mark.exam_subject_id) === examSubjectId
        );

        const subjectQuestions = questions.filter(
            question => idValue(question.subject_id) === idValue(examSubject.subject_id)
        );

        const selectionType = normalizeSelectionType(examSubject.question_selection_type);

        // A final row in exam_marks is already the subject mark against
        // exam_subjects.full_marks. Keep the public `total` value normalized
        // to 0-100 because Best 7 is always calculated out of 700.
        const subjectLevelMarks = studentMarks
            .filter(mark => mark.source === "exam_marks")
            .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

        const finalSubjectMark = subjectLevelMarks[0] || null;

        if (finalSubjectMark) {
            // IMPORTANT: exam_marks.marks_obtained is the FINAL SUBJECT MARK
            // already entered on a 0-100 scale. Never divide it again by
            // exam_subjects.full_marks or by exam_questions.max_marks.
            const rawTotal = clamp(numberValue(finalSubjectMark.marks_obtained));
            const rawPossible = 100;
            const percentage = rawTotal;
            const passMarks = numberValue(examSubject.pass_marks);
            const passPercentage = passMarks > 0 ? passMarks : 40;
            const grade = getGrade(percentage);
            const questionLevelMarks = studentMarks.filter(
                mark => mark.source !== "exam_marks" && mark.question_id != null
            );

            return {
                exam_subject_id: examSubject.id,
                subject_id: examSubject.subject_id,
                class_id: examSubject.class_id,
                subject: subjectMap.get(idValue(examSubject.subject_id)),
                total: percentage,
                possible: 100,
                rawTotal,
                rawPossible,
                percentage,
                grade,
                remark: finalSubjectMark.remark || getRemark(grade),
                pass: percentage >= passPercentage,
                questions: subjectQuestions.length,
                marked_questions: questionLevelMarks.length,
                missing_questions: Math.max(0, subjectQuestions.length - questionLevelMarks.length),
                selection_type: selectionType,
                usedQuestionIds: questionLevelMarks.map(mark => idValue(mark.question_id)).filter(Boolean),
                status: "Complete",
                source: "exam_marks"
            };
        }

        // When exam_marks is not present, use question-level marks as the
        // fallback source. The final subject mark entered in exam_marks is
        // always authoritative and is already on a 0-100 scale.
        const questionMarks = studentMarks.filter(
            mark => mark.source !== "exam_marks" && mark.question_id != null
        );

        let selectedQuestions = [];

        if (selectionType === "ALL") {
            selectedQuestions = [...subjectQuestions];
        } else {
            const markedQuestionIds = new Set(questionMarks.map(mark => idValue(mark.question_id)));
            const groups = new Map();

            subjectQuestions
                .filter(question => markedQuestionIds.has(idValue(question.id)))
                .forEach(question => {
                    const group = question.selection_group || `QUESTION_${question.id}`;
                    if (!groups.has(group)) groups.set(group, []);
                    groups.get(group).push(question);
                });

            groups.forEach(groupQuestions => {
                const first = groupQuestions[0];
                const required = numberValue(first.selection_count);
                const sorted = [...groupQuestions].sort(
                    (a, b) => numberValue(a.question_number) - numberValue(b.question_number)
                );
                selectedQuestions.push(...(required > 0 ? sorted.slice(0, required) : sorted));
            });
        }

        let rawTotal = 0;
        let rawPossible = 0;
        let markedQuestions = 0;
        const usedQuestionIds = [];

        selectedQuestions.forEach(question => {
            const mark = questionMarks.find(row => idValue(row.question_id) === idValue(question.id));
            rawPossible += numberValue(question.max_marks);
            usedQuestionIds.push(idValue(question.id));
            if (mark) {
                rawTotal += numberValue(mark.marks_obtained);
                markedQuestions += 1;
            }
        });

        // Question-level marks are also entered as the student's final marks
        // on a 0-100 scale. The number of questions and their max_marks are
        // used only for traceability (e.g. 10/11 questions), NOT to rescale
        // the student's mark. Therefore 85 remains 85%, even if the selected
        // questions have a combined max_marks of 115.
        const percentage = clamp(rawTotal);
        const grade = getGrade(percentage);
        const configuredPassMarks = numberValue(examSubject.pass_marks);
        const passPercentage = configuredPassMarks > 0 ? configuredPassMarks : 40;

        return {
            exam_subject_id: examSubject.id,
            subject_id: examSubject.subject_id,
            class_id: examSubject.class_id,
            subject: subjectMap.get(idValue(examSubject.subject_id)),
            total: percentage,
            possible: 100,
            rawTotal,
            rawPossible,
            percentage,
            grade,
            remark: getRemark(grade),
            pass: rawPossible > 0 && percentage >= passPercentage,
            questions: selectedQuestions.length,
            marked_questions: markedQuestions,
            missing_questions: Math.max(0, selectedQuestions.length - markedQuestions),
            selection_type: selectionType,
            usedQuestionIds,
            status:
                selectedQuestions.length === 0
                    ? "No Marks"
                    : markedQuestions >= selectedQuestions.length
                        ? "Complete"
                        : markedQuestions > 0
                            ? "Partial"
                            : "No Marks",
            source: "exam_question_marks"
        };
    }, [getStudentMarks, questions, subjectMap]);

    // ========================================================
    // STUDENT ANALYSIS
    // ========================================================

    const studentAnalysis = useMemo(() => {
        const rows = [];

        students.forEach(student => {
            const studentExamSubjectIds = new Set(
                (marksByStudent.get(idValue(student.id)) || [])
                    .map(mark => idValue(mark.exam_subject_id))
            );

            const assignedExamSubjects = examSubjects.filter(es =>
                idValue(es.class_id) === idValue(student.current_class_id) ||
                studentExamSubjectIds.has(idValue(es.id))
            );

            const classOK =
                selectedClassId === "ALL" ||
                idValue(student.current_class_id) === idValue(selectedClassId) ||
                assignedExamSubjects.some(es => idValue(es.class_id) === idValue(selectedClassId));

            if (!classOK) return;

            // ------------------------------------------------------------
            // IMPORTANT RESULT RULE
            // ------------------------------------------------------------
            // The Subject filter is ONLY a display filter. It must NEVER
            // change Best 7, Aggregate, GPA, Division or Overall Grade.
            // Therefore we calculate the student's result from ALL subjects
            // assigned to this examination/class first, then use the selected
            // subject filter only for the visible subject rows.
            // ------------------------------------------------------------
            const allSubjectResults = assignedExamSubjects.map(examSubject =>
                calculateStudentSubject(student.id, examSubject)
            );

            const subjectResults = allSubjectResults.filter(result => {
                const classOKForDisplay =
                    selectedClassId === "ALL" ||
                    idValue(result.class_id) === idValue(selectedClassId);

                const subjectOKForDisplay =
                    selectedSubjectId === "ALL" ||
                    idValue(result.subject_id) === idValue(selectedSubjectId);

                return classOKForDisplay && subjectOKForDisplay;
            });

            const markedResults = allSubjectResults.filter(result => result.possible > 0);
            // OVERALL STUDENT PERFORMANCE: every examination subject assigned
            // to the student's class is included in the denominator. A subject
            // with no entered marks contributes ZERO. Each subject mark is
            // already stored as a mark out of 100, so there is NO conversion.
            // Example: 80, 0, 0, 0 = 80 / 4 = 20%.
            // FINAL STUDENT PERFORMANCE = BEST 7 ONLY.
            // This table is the Student Performance & Traceability source.
            // Therefore its Total, Percentage and Grade must use the SAME
            // Best-7 calculation as the Report Form. Missing marks remain F.
            // BEST 7 MUST ALWAYS use ALL examination subjects, never the
            // currently selected subject filter.
            const csee = calculateResult(allSubjectResults);
            const bestSeven = csee.bestSeven || [];
            const total = bestSeven.reduce((sum, result) => sum + numberValue(result.total), 0);
            const possible = 700;
            const average = bestSeven.length ? (total / 700) * 100 : 0;
            const percentage = average;
            const grade = bestSeven.length === 7 ? getGrade(average) : "â€”";
            const passed = bestSeven.length === 7 ? average >= 40 : false;
            const hasMarks = markedResults.some(result => result.total > 0 || result.marked_questions > 0);

            // Calculate GPA/Division for this exact studentAnalysis row.
            // Student Report / Trace opens from studentAnalysis, so GPA and
            // Division must be present here, not only in overallStudentAnalysis.
            const completeSubjects = allSubjectResults.filter(result => result.status === "Complete").length;
            const partialSubjects = allSubjectResults.filter(result => result.status === "Partial").length;
            const missingSubjects = allSubjectResults.filter(result => result.status === "No Marks").length;

            rows.push({
                id: student.id,
                full_name: safeName(student),
                admission: getAdmission(student),
                gender: student.gender,
                class_id: student.current_class_id,
                class_name: getClassName(classMap.get(idValue(student.current_class_id))) || student.class_name,
                stream: student.stream,
                total,
                possible,
                percentage,
                grade,
                remark: getRemark(grade),
                pass: passed,
                hasMarks,
                cseeEligible: csee.eligible,
                cseeAggregate: csee.aggregate,
                cseeGpa: csee.gpa,
                cseeGPA: csee.gpa,
                cseeDivision: csee.division,
                cseeDivisionLabel: csee.divisionLabel,
                cseeBestSeven: csee.bestSeven,
                // Direct fields used by Student Report and print views.
                aggregate: csee.aggregate,
                gpa: csee.gpa,
                division: csee.division,
                divisionLabel: csee.divisionLabel,
                bestSeven: csee.bestSeven,
                analysedSubjects: csee.analysedSubjects,
                subjects: subjectResults,
                subjectCount: allSubjectResults.length,
                parent_name: student.parent_name || "",
                parent_phone: student.parent_phone || "",
                parent_email: student.parent_email || "",
                completeSubjects,
                partialSubjects,
                missingSubjects,
                status: allSubjectResults.length === 0
                    ? "No Marks"
                    : completeSubjects === allSubjectResults.length
                        ? "Complete"
                        : hasMarks
                            ? "Partial"
                            : "No Marks"
            });
        });

        // Position is calculated only among students with actual analysed marks.
        const ranked = [...rows]
            .filter(row => row.possible > 0)
            .sort((a, b) => {
                if (b.percentage !== a.percentage) return b.percentage - a.percentage;
                return b.total - a.total;
            });

        const positionMap = new Map();
        ranked.forEach((row, index) => {
            if (!positionMap.has(row.percentage)) {
                positionMap.set(row.percentage, index + 1);
            }
        });

        return rows.map(row => ({
            ...row,
            position: row.possible > 0 ? positionMap.get(row.percentage) : null,
            rankTotal: ranked.length
        }));
    }, [
        students,
        selectedClassId,
        selectedSubjectId,
        filteredExamSubjects,
        calculateStudentSubject,
        classMap,
        marksByStudent,
        examSubjects
    ]);


    // ========================================================
    // OVERALL STUDENT ANALYSIS - ALL EXAM SUBJECTS
    // This dataset intentionally ignores the selected subject filter.
    // It is the source for the complete student report and overall print.
    // ========================================================

    const overallStudentAnalysis = useMemo(() => {
        return students.map(student => {
            const studentExamSubjectIds = new Set(
                (marksByStudent.get(idValue(student.id)) || []).map(mark => idValue(mark.exam_subject_id))
            );

            // A student's current_class_id may change after the examination.
            // For examination reporting, the exam subject/class and saved marks
            // are authoritative. This keeps historical reports intact.
            const assignedExamSubjects = examSubjects.filter(es =>
                idValue(es.class_id) === idValue(student.current_class_id) ||
                studentExamSubjectIds.has(idValue(es.id))
            );

            const subjectResults = assignedExamSubjects
                .map(es => calculateStudentSubject(student.id, es));

            const examClassId = assignedExamSubjects.length
                ? assignedExamSubjects[0].class_id
                : student.current_class_id;

            // The overall student result shown for Grade/GPA/Division is based on
            // Best 7 subjects. Missing marks remain zero/F and therefore still count.
            // The raw all-subject totals are retained separately for analysis.
            const assignedSubjectsCount = subjectResults.length;
            const allSubjectsTotal = subjectResults.reduce(
                (sum, result) => sum + numberValue(result.total),
                0
            );
            const allSubjectsPossible = assignedSubjectsCount * 100;
            const analysed = subjectResults.filter(result => result.possible > 0);
            const csee = calculateResult(subjectResults);

            // FINAL STUDENT RESULT = BEST 7 ONLY.
            // Do not divide the Best 7 percentage by the total number of
            // examination subjects. For example, 423/700 = 60.43% = C.
            // If the student has more than seven subjects, only the seven
            // subjects selected by calculateResult() are used for Grade/GPA/Division.
            const bestSeven = csee.bestSeven || [];
            const total = bestSeven.reduce(
                (sum, result) => sum + numberValue(result.total),
                0
            );
            const possible = bestSeven.length * 100;
            const average = bestSeven.length > 0
                ? (total / 700) * 100
                : 0;
            const percentage = average;
            const grade = bestSeven.length === 7 ? getGrade(average) : (bestSeven.length ? getGrade(average) : "â€”");

            return {
                id: student.id,
                full_name: safeName(student),
                admission: getAdmission(student),
                gender: student.gender,
                class_id: examClassId,
                class_name: getClassName(classMap.get(idValue(examClassId))) || student.class_name,
                stream: student.stream,
                total,
                possible,
                percentage,
                grade,
                remark: getRemark(grade),
                pass: bestSeven.length === 7 ? average >= 40 : false,
                subjects: subjectResults,
                subjectCount: subjectResults.length,
                allSubjectsTotal,
                allSubjectsPossible,
                parent_name: student.parent_name || "",
                parent_phone: student.parent_phone || "",
                parent_email: student.parent_email || "",
                analysedSubjects: analysed.length,
                cseeEligible: csee.eligible,
                cseeAggregate: csee.aggregate,
                cseeGpa: csee.gpa,
                cseeDivision: csee.division,
                cseeDivisionLabel: csee.divisionLabel,
                cseeBestSeven: csee.bestSeven,
                aggregate: csee.aggregate,
                gpa: csee.gpa,
                division: csee.division,
                divisionLabel: csee.divisionLabel,
                bestSeven: csee.bestSeven,
                completeSubjects: subjectResults.filter(result => result.status === "Complete").length,
                partialSubjects: subjectResults.filter(result => result.status === "Partial").length,
                missingSubjects: subjectResults.filter(result => result.status === "No Marks").length
            };
        });
    }, [students, examSubjects, calculateStudentSubject, classMap]);

    const overallRankedStudents = useMemo(() => {
        const ranked = overallStudentAnalysis
            .filter(row => row.possible > 0)
            .sort((a, b) => b.percentage - a.percentage || b.total - a.total);
        const positionMap = new Map();
        ranked.forEach((row, index) => {
            if (!positionMap.has(row.percentage)) positionMap.set(row.percentage, index + 1);
        });
        return overallStudentAnalysis.map(row => ({
            ...row,
            position: row.possible > 0 ? positionMap.get(row.percentage) : null,
            rankTotal: ranked.length
        }));
    }, [overallStudentAnalysis]);

    // ========================================================
    // SCHOOL OVERALL RESULT
    // Ignores class/subject filters and evaluates the whole exam.
    // Every student-subject assignment is weighted equally.
    // Subject marks are already out of 100.
    // ========================================================

    const schoolOverall = useMemo(() => {
        const allStudentResults = [];

        examSubjects.forEach(examSubject => {
            students
                .filter(student => idValue(student.current_class_id) === idValue(examSubject.class_id))
                .forEach(student => {
                    allStudentResults.push(calculateStudentSubject(student.id, examSubject));
                });
        });

        const candidates = students.length;
        const assignmentCount = allStudentResults.length;
        const totalMarks = allStudentResults.reduce((sum, row) => sum + numberValue(row.total), 0);
        const possible = assignmentCount * 100;
        const average = assignmentCount > 0 ? totalMarks / assignmentCount : 0;
        const analysedAssignments = allStudentResults.filter(row => row.possible > 0);
        const passedAssignments = analysedAssignments.filter(row => row.pass).length;

        const rankedStudents = overallStudentAnalysis
            .filter(row => row.possible > 0)
            .sort((a, b) => b.percentage - a.percentage || b.total - a.total);

        const studentGradeDistribution = ["A", "B", "C", "D", "F"].map(grade => ({
            grade,
            count: rankedStudents.filter(row => row.grade === grade).length
        }));
        const cseeEligibleStudents = rankedStudents.filter(row => row.cseeEligible);
        const cseeGpa = cseeEligibleStudents.length ? cseeEligibleStudents.reduce((sum, row) => sum + numberValue(row.cseeGpa), 0) / cseeEligibleStudents.length : null;
        const cseeDivisionDistribution = ["I", "II", "III", "IV", "0"].map(division => ({
            division, count: cseeEligibleStudents.filter(row => row.cseeDivision === division).length
        }));

        const subjectRows = examSubjects.map(es => {
            const subjectResults = students
                .filter(student =>
                    idValue(student.current_class_id) === idValue(es.class_id) ||
                    idValue(student.exam_class_id) === idValue(es.class_id))
                .map(student => calculateStudentSubject(student.id, es));
            const graded = subjectResults.map(row => ({ ...row, grade: getGrade(row.percentage), point: getGradePoint(getGrade(row.percentage)) }));
            const total = graded.reduce((sum, row) => sum + numberValue(row.total), 0);
            const avg = graded.length ? total / graded.length : 0;
            const passed = graded.filter(row => numberValue(row.percentage) >= 40).length;
            const gradeCounts = Object.fromEntries(["A","B","C","D","F"].map(g => [g, graded.filter(row => row.grade === g).length]));
            const subjectGpa = graded.length ? graded.reduce((sum, row) => sum + row.point, 0) / graded.length : null;
            return {
                exam_subject_id: es.id,
                subject_id: es.subject_id,
                class_id: es.class_id,
                subject_name: getSubjectName(subjectMap.get(idValue(es.subject_id))),
                class_name: getClassName(classMap.get(idValue(es.class_id))),
                candidates: subjectResults.length,
                analysed: graded.length,
                average: avg,
                highest: graded.length ? Math.max(...graded.map(row => row.percentage)) : 0,
                lowest: graded.length ? Math.min(...graded.map(row => row.percentage)) : 0,
                pass_rate: graded.length ? (passed / graded.length) * 100 : 0,
                passed,
                failed: graded.length - passed,
                gradeCounts,
                gpa: subjectGpa
            };
        });

        const classRows = [...new Set(examSubjects.map(es => idValue(es.class_id)).filter(Boolean))].map(classId => {
            const className = getClassName(classMap.get(classId)) || `Class ${classId}`;
            const classStudents = overallStudentAnalysis.filter(row => idValue(row.class_id) === classId);
            const eligible = classStudents.filter(row => row.cseeEligible && row.cseeGpa != null);
            const divisionDistribution = ["I", "II", "III", "IV", "0"].map(division => ({
                division,
                count: classStudents.filter(row => row.cseeDivision === division).length
            }));
            const average = classStudents.length
                ? classStudents.reduce((sum, row) => sum + numberValue(row.percentage), 0) / classStudents.length
                : 0;
            const gpa = eligible.length
                ? eligible.reduce((sum, row) => sum + numberValue(row.cseeGpa), 0) / eligible.length
                : null;
            return {
                class_id: classId,
                class_name: className,
                students: classStudents.length,
                average,
                gpa,
                divisionDistribution,
                divisions: divisionDistribution.reduce((acc, row) => ({ ...acc, [row.division]: row.count }), {}),
                passRate: classStudents.length
                    ? (classStudents.filter(row => row.pass).length / classStudents.length) * 100
                    : 0
            };
        }).sort((a, b) => a.class_name.localeCompare(b.class_name, undefined, { numeric: true }));

        return {
            candidates,
            assignments: assignmentCount,
            totalMarks,
            possible,
            average,
            analysedAssignments: analysedAssignments.length,
            passedAssignments,
            failedAssignments: analysedAssignments.length - passedAssignments,
            passRate: analysedAssignments.length ? (passedAssignments / analysedAssignments) * 100 : 0,
            studentsAnalysed: rankedStudents.length,
            studentsPassed: rankedStudents.filter(row => row.pass).length,
            studentsFailed: rankedStudents.filter(row => !row.pass).length,
            cseeEligibleStudents: cseeEligibleStudents.length,
            cseeGpa,
            cseeDivisionDistribution,
            studentGradeDistribution,
            topStudents: rankedStudents.slice(0, 10),
            allStudents: rankedStudents,
            allSubjects: subjectRows,
            subjectRows,
            classRows
        };
    }, [examSubjects, students, calculateStudentSubject, overallStudentAnalysis, subjectMap, classMap]);

    // ========================================================
    // CLASS OVERALL RESULT
    // Uses the selected class and ALL subjects assigned to it.
    // Missing marks are treated as zero in the student's overall average.
    // ========================================================

    const classOverall = useMemo(() => {
        if (selectedClassId === "ALL") return null;

        const classStudents = students.filter(
            student =>
            idValue(student.current_class_id) === idValue(selectedClassId) ||
            idValue(student.exam_class_id) === idValue(selectedClassId)
        );

        const classExamSubjects = examSubjects.filter(
            es => idValue(es.class_id) === idValue(selectedClassId)
        );

        const rows = classStudents.map(student => {
            const subjectResults = classExamSubjects.map(es =>
                calculateStudentSubject(student.id, es)
            );
            const subjectCount = subjectResults.length;
            const total = subjectResults.reduce((sum, row) => sum + numberValue(row.total), 0);
            const average = subjectCount ? total / subjectCount : 0;
            const grade = getGrade(average);
            const csee = calculateResult(subjectResults);
            return {
                ...student,
                full_name: safeName(student),
                admission: getAdmission(student),
                subjects: subjectResults,
                subjectCount,
                total,
                possible: subjectCount * 100,
                percentage: average,
                grade,
                remark: getRemark(grade),
                pass: average >= 40,
                cseeEligible: csee.eligible,
                cseeAggregate: csee.aggregate,
                cseeGpa: csee.gpa,
                cseeDivision: csee.division,
                cseeDivisionLabel: csee.divisionLabel,
                cseeBestSeven: csee.bestSeven,
                missingSubjects: subjectResults.filter(row => row.status === "No Marks").length
            };
        });

        const ranked = [...rows].sort((a, b) => b.percentage - a.percentage || b.total - a.total);
        const positionMap = new Map();
        ranked.forEach((row, index) => {
            if (!positionMap.has(row.percentage)) positionMap.set(row.percentage, index + 1);
        });

        const rankedWithPosition = rows.map(row => ({
            ...row,
            position: positionMap.get(row.percentage) || null,
            rankTotal: ranked.length
        }));

        const subjectRows = classExamSubjects.map(es => {
            const results = classStudents.map(student =>
                calculateStudentSubject(student.id, es)
            );
            const graded = results.map(row => ({ ...row, grade: getGrade(row.percentage), point: getGradePoint(getGrade(row.percentage)) }));
            const total = graded.reduce((sum, row) => sum + numberValue(row.total), 0);
            const average = graded.length ? total / graded.length : 0;
            const passed = graded.filter(row => numberValue(row.percentage) >= 40).length;
            const gradeCounts = Object.fromEntries(["A","B","C","D","F"].map(g => [g, graded.filter(row => row.grade === g).length]));
            const subjectGpa = graded.length ? graded.reduce((sum, row) => sum + row.point, 0) / graded.length : null;
            return {
                exam_subject_id: es.id,
                subject_id: es.subject_id,
                subject_name: getSubjectName(subjectMap.get(idValue(es.subject_id))),
                candidates: results.length,
                analysed: graded.length,
                average,
                highest: graded.length ? Math.max(...graded.map(row => row.percentage)) : 0,
                lowest: graded.length ? Math.min(...graded.map(row => row.percentage)) : 0,
                pass_rate: graded.length ? (passed / graded.length) * 100 : 0,
                passed,
                failed: graded.length - passed,
                gradeCounts,
                gpa: subjectGpa
            };
        });

        const subjectCount = classExamSubjects.length;
        const totalMarks = rows.reduce((sum, row) => sum + numberValue(row.total), 0);
        const possible = rows.length * subjectCount * 100;
        const average = rows.length && subjectCount ? totalMarks / (rows.length * subjectCount) : 0;
        const passedStudents = rows.filter(row => row.pass).length;
        const eligibleStudents = rows.filter(row => row.cseeEligible && row.cseeGpa != null);
        const classGpa = eligibleStudents.length ? eligibleStudents.reduce((sum, row) => sum + numberValue(row.cseeGpa), 0) / eligibleStudents.length : null;
        const divisionDistribution = ["I","II","III","IV","0"].map(division => ({
            division,
            count: rows.filter(row => row.cseeDivision === division).length
        }));

        return {
            classId: selectedClassId,
            className: getClassName(classMap.get(idValue(selectedClassId))),
            students: rankedWithPosition,
            subjects: subjectRows,
            studentCount: rows.length,
            subjectCount,
            totalMarks,
            possible,
            average,
            passRate: rows.length ? (passedStudents / rows.length) * 100 : 0,
            passedStudents,
            failedStudents: rows.length - passedStudents,
            cseeEligibleStudents: eligibleStudents.length,
            cseeGpa: classGpa,
            cseeDivisionDistribution: divisionDistribution,
            gradeDistribution: ["A", "B", "C", "D", "F"].map(grade => ({
                grade,
                count: rows.filter(row => row.grade === grade).length
            })),
            topStudents: rankedWithPosition.slice(0, 10)
        };
    }, [selectedClassId, students, examSubjects, calculateStudentSubject, subjectMap, classMap]);


    const getStudentReport = useCallback(student => {
        const full = overallRankedStudents.find(row => idValue(row.id) === idValue(student.id)) || student;
        const subjectsForReport = (full.subjects || []).map(result => ({
            ...result,
            subject_name: getSubjectName(subjectMap.get(idValue(result.subject_id))),
            grade: getGrade(result.percentage),
            remark: getRemark(getGrade(result.percentage)),
            report_status: result.pass ? "Passed" : "Failed"
        }));
        const analysed = subjectsForReport.filter(row => row.possible > 0);
        const csee = calculateResult(subjectsForReport);
        const cseeGpa = csee.gpa;
        const cseeDivision = csee.division;
        const weak = [...analysed].sort((a, b) => a.percentage - b.percentage).slice(0, 3);
        const recommendations = [];
        if (csee.bestSeven?.length === 7 && csee.bestSeven.reduce((sum, row) => sum + numberValue(row.total), 0) / 700 * 100 >= 75) recommendations.push("Endelea na nidhamu nzuri ya kujisomea na uimarishe zaidi masomo yenye ufaulu wa juu.");
        else if (csee.bestSeven?.length === 7 && csee.bestSeven.reduce((sum, row) => sum + numberValue(row.total), 0) / 700 * 100 >= 60) recommendations.push("Ongeza muda wa marudio katika masomo yenye ufaulu wa chini ili kuboresha wastani wa jumla.");
        else if (csee.bestSeven?.length === 7 && csee.bestSeven.reduce((sum, row) => sum + numberValue(row.total), 0) / 700 * 100 >= 50) recommendations.push("Tumia mpango maalum wa marudio na mazoezi ya ziada katika masomo yenye changamoto.");
        else if (csee.bestSeven?.length === 7 && csee.bestSeven.reduce((sum, row) => sum + numberValue(row.total), 0) / 700 * 100 >= 40) recommendations.push("Mwanafunzi anahitaji mpango maalum wa kuboresha ufaulu pamoja na ufuatiliaji wa karibu wa maendeleo yake.");
        else recommendations.push("Mwanafunzi anahitaji uingiliaji wa haraka wa kitaaluma, marudio ya msingi na ufuatiliaji wa maendeleo mara kwa mara.");
        if (weak.length) recommendations.push(`Masomo yanayohitaji kipaumbele cha kuboresha ufaulu: ${weak.map(row => `${row.subject_name} (${formatNumber(row.percentage, 1)}%)`).join(", ")}.`);

        const savedFields = studentReportFields[idValue(full.id)] || {};
        return {
            ...full,
            subjects: subjectsForReport,
            recommendations,
            reportStatus: csee.bestSeven?.length === 7 && (csee.bestSeven.reduce((sum, row) => sum + numberValue(row.total), 0) / 700) * 100 >= 40 ? "Passed" : "Failed",
            cseeEligible: csee.eligible,
            cseeAggregate: csee.aggregate,
            cseeGpa,
            cseeGPA: cseeGpa,
            cseeDivision,
            cseeDivisionLabel: csee.divisionLabel,
            cseeBestSeven: csee.bestSeven,
            aggregate: csee.aggregate,
            gpa: csee.gpa,
            division: csee.division,
            divisionLabel: csee.divisionLabel,
            bestSeven: csee.bestSeven,
            generalConduct: savedFields.generalConduct || "",
            manualWorkEffort: savedFields.manualWorkEffort || "",
            parent_name: full.parent_name || "",
            parent_phone: full.parent_phone || "",
            parent_email: full.parent_email || ""
        };
    }, [overallRankedStudents, subjectMap, studentReportFields]);


    const printStudentReport = useCallback(student => {
        setDetail(null);
        setPrintReport({ type: "student", data: getStudentReport(student) });
    }, [getStudentReport]);

    const shareStudentResult = useCallback(async (student, channel) => {
        const report = getStudentReport(student);
        const message = buildStudentResultMessage(exam, report);
        const phone = getParentPhone(report);
        const email = getParentEmail(report);
        const recipient = channel === "email" ? email : phone;

        if (!recipient) {
            window.alert(
                channel === "email"
                    ? "Mzazi hana email iliyowekwa kwenye Student Registration."
                    : "Mzazi hana namba ya simu iliyowekwa kwenye Student Registration."
            );
            return;
        }

        const subject = `${exam?.name || exam?.exam_name || "Examination"} Results - ${report.full_name}`;

        // Convert ANY backend/API error value into a safe human-readable string.
        const getCommunicationErrorMessage = error => {
            const data = error?.response?.data;
            const providerError =
                data?.error ||
                data?.detail ||
                data?.provider_response?.error ||
                data?.provider_response?.detail ||
                null;

            const providerDetail =
                providerError?.details ||
                data?.details ||
                data?.provider_response?.error?.details ||
                data?.provider_response?.detail?.details ||
                null;

            const code =
                providerError?.code ||
                data?.code ||
                data?.provider_code ||
                "";

            const messageValue =
                providerError?.message ||
                data?.message ||
                error?.message ||
                "";

            if (
                String(code).toLowerCase() === "insufficient_balance" ||
                String(messageValue).toLowerCase().includes("insufficient balance")
            ) {
                const required =
                    providerDetail?.required ??
                    providerError?.required ??
                    data?.required;

                const available =
                    providerDetail?.available ??
                    providerError?.available ??
                    data?.available;

                const segments =
                    providerDetail?.segments ??
                    providerError?.segments ??
                    data?.segments;

                const requestId =
                    providerError?.request_id ||
                    data?.request_id ||
                    data?.provider_request_id ||
                    "";

                const parts = [
                    "SMS haikutumwa.",
                    "eSMS Africa LIVE account haina salio la kutosha."
                ];

                if (required !== undefined && required !== null) {
                    parts.push(`Required: USD ${Number(required).toFixed(4)}`);
                }

                if (available !== undefined && available !== null) {
                    parts.push(`Available: USD ${Number(available).toFixed(4)}`);
                }

                if (segments !== undefined && segments !== null) {
                    parts.push(`Segments: ${segments}`);
                }

                if (requestId) {
                    parts.push(`Request ID: ${requestId}`);
                }

                return parts.join("\n");
            }

            if (typeof messageValue === "string" && messageValue.trim()) {
                return messageValue;
            }

            if (typeof providerError === "string" && providerError.trim()) {
                return providerError;
            }

            if (providerError && typeof providerError === "object") {
                if (providerError.message) {
                    return String(providerError.message);
                }
                if (providerError.code) {
                    return `Provider error: ${String(providerError.code)}`;
                }
            }

            if (data && typeof data === "object") {
                if (data.success === false) {
                    return "Imeshindikana kutuma result kwa mzazi.";
                }
            }

            return "Imeshindikana kutuma result kwa mzazi.";
        };

        try {
            setSendingChannel(channel);

            const response = await axios.post(`${API_URL}/communication/parent-result`, {
                school_id: report.school_id || null,
                student_id: report.id,
                exam_id: exam?.id || examId,
                parent_name: getParentName(report),
                recipient,
                channel,
                subject,
                message,
            });

            if (!response?.data?.success) {
                const responseData = response?.data || {};

                if (channel === "sms") {
                    setCommunicationStatus(previous => ({
                        ...previous,
                        [idValue(report.id)]: {
                            provider: responseData?.provider || "eSMS Africa",
                            status: responseData?.provider_status || "failed",
                            provider_message_id: responseData?.provider_message_id || null,
                            environment:
                                responseData?.environment ||
                                responseData?.backend_environment ||
                                "live",
                            segments: responseData?.segments || null,
                            cost: responseData?.cost || null,
                            cost_currency: responseData?.cost_currency || null,
                            error_code:
                                responseData?.error?.code ||
                                responseData?.provider_code ||
                                null,
                            error_message: getCommunicationErrorMessage({
                                response: { data: responseData }
                            }),
                            sent_at: new Date().toISOString()
                        }
                    }));
                }

                throw new Error(getCommunicationErrorMessage({
                    response: { data: responseData }
                }));
            }

            if (channel === "sms") {
                setCommunicationStatus(previous => ({
                    ...previous,
                    [idValue(report.id)]: {
                        provider: response?.data?.provider || "eSMS Africa",
                        status: response?.data?.provider_status || "accepted",
                        provider_message_id: response?.data?.provider_message_id || null,
                        environment:
                            response?.data?.environment ||
                            response?.data?.backend_environment ||
                            "live",
                        segments: response?.data?.segments || null,
                        cost: response?.data?.cost || null,
                        cost_currency: response?.data?.cost_currency || null,
                        error_code: null,
                        error_message: null,
                        sent_at: new Date().toISOString()
                    }
                }));
            }

            window.alert(
                typeof response?.data?.message === "string"
                    ? response.data.message
                    : `Result imetumwa kwa ${channel}.`
            );
        } catch (error) {
            console.error("Parent result communication error:", error);

            const safeMessage = getCommunicationErrorMessage(error);

            if (channel === "sms") {
                const data = error?.response?.data || {};
                const providerError =
                    data?.error ||
                    data?.detail ||
                    data?.provider_response?.error ||
                    data?.provider_response?.detail ||
                    {};

                const details =
                    providerError?.details ||
                    data?.details ||
                    data?.provider_response?.error?.details ||
                    data?.provider_response?.detail?.details ||
                    {};

                setCommunicationStatus(previous => ({
                    ...previous,
                    [idValue(report.id)]: {
                        provider: data?.provider || "eSMS Africa",
                        status: "failed",
                        provider_message_id:
                            data?.provider_message_id ||
                            providerError?.request_id ||
                            null,
                        environment:
                            data?.environment ||
                            data?.backend_environment ||
                            "live",
                        segments:
                            details?.segments ??
                            providerError?.segments ??
                            data?.segments ??
                            null,
                        cost:
                            details?.cost ??
                            providerError?.cost ??
                            data?.cost ??
                            null,
                        cost_currency:
                            details?.currency ||
                            providerError?.currency ||
                            data?.cost_currency ||
                            null,
                        error_code:
                            providerError?.code ||
                            data?.provider_code ||
                            data?.code ||
                            null,
                        error_message: safeMessage,
                        sent_at: new Date().toISOString()
                    }
                }));
            }

            window.alert(safeMessage);
        } finally {
            setSendingChannel("");
        }
    }, [exam, examId, getStudentReport]);

    const printSchoolOverallReport = useCallback(() => {
        setDetail(null);
        setPrintReport({ type: "school", data: schoolOverall });
    }, [schoolOverall]);

    const printClassOverallReport = useCallback(() => {
        if (!classOverall) return;
        setDetail(null);
        setPrintReport({ type: "class", data: classOverall });
    }, [classOverall]);

    const printOverallReport = useCallback(() => {
        setDetail(null);

        const subjectsForReport = examSubjects.map(es => {
            const subjectStudents = students
                .filter(student =>
                    idValue(student.current_class_id) === idValue(es.class_id) ||
                    idValue(student.exam_class_id) === idValue(es.class_id))
                .map(student => calculateStudentSubject(student.id, es));
            const analysed = subjectStudents.filter(result => result.possible > 0);
            const total = analysed.reduce((sum, result) => sum + numberValue(result.total), 0);
            const possible = analysed.reduce((sum, result) => sum + numberValue(result.possible), 0);
            const average = pct(total, possible);
            const passed = analysed.filter(result => result.pass).length;
            return {
                ...es,
                exam_subject_id: es.id,
                subject_name: getSubjectName(subjectMap.get(idValue(es.subject_id))),
                class_name: getClassName(classMap.get(idValue(es.class_id))),
                average,
                pass_rate: analysed.length ? (passed / analysed.length) * 100 : 0,
                candidates: subjectStudents.length,
                analysed: analysed.length,
                full_marks: numberValue(es.full_marks),
                pass_marks: numberValue(es.pass_marks)
            };
        });

        setPrintReport({
            type: "overall",
            data: {
                students: overallRankedStudents.filter(row => row.possible > 0),
                subjects: subjectsForReport
            }
        });
    }, [examSubjects, students, calculateStudentSubject, subjectMap, classMap, overallRankedStudents]);

    // ========================================================
    // SUBJECT ANALYSIS
    // ========================================================

    const subjectAnalysis = useMemo(() => {
        const rows = [];

        filteredExamSubjects.forEach(examSubject => {
            const subject = subjectMap.get(idValue(examSubject.subject_id));
            const className = getClassName(classMap.get(idValue(examSubject.class_id)));

            const eligibleStudents = students.filter(student => {
                return idValue(student.current_class_id) === idValue(examSubject.class_id);
            });

            const results = eligibleStudents.map(student =>
                calculateStudentSubject(student.id, examSubject)
            );

            const withMarks = results.filter(result => result.possible > 0 && result.marked_questions > 0);
            const complete = results.filter(result => result.status === "Complete");
            const partial = results.filter(result => result.status === "Partial");
            const missing = results.filter(result => result.status === "No Marks");

            const total = withMarks.reduce((sum, result) => sum + result.total, 0);
            const possible = withMarks.reduce((sum, result) => sum + result.possible, 0);
            // Use the actual saved marks against the actual possible marks.
            // This keeps the subject average traceable to Enter Marks.
            const average = possible > 0
                ? pct(total, possible)
                : 0;

            const passed = withMarks.filter(result => result.pass).length;
            const failed = withMarks.length - passed;

            const percentages = withMarks.map(result => result.percentage);
            const highest = percentages.length ? Math.max(...percentages) : 0;
            const lowest = percentages.length ? Math.min(...percentages) : 0;

            rows.push({
                exam_subject_id: examSubject.id,
                subject_id: examSubject.subject_id,
                class_id: examSubject.class_id,
                subject_name: getSubjectName(subject),
                subject_code: subject?.subject_code || "",
                class_name: className,
                average,
                highest,
                lowest,
                pass_rate: withMarks.length > 0 ? (passed / withMarks.length) * 100 : 0,
                passed,
                failed,
                candidates: eligibleStudents.length,
                analysed: withMarks.length,
                complete: complete.length,
                partial: partial.length,
                missing: missing.length,
                total,
                possible,
                full_marks: numberValue(examSubject.full_marks),
                pass_marks: numberValue(examSubject.pass_marks),
                selection_type: normalizeSelectionType(examSubject.question_selection_type),
                questions_to_answer: numberValue(examSubject.questions_to_answer),
                status: missing.length === 0 && eligibleStudents.length > 0
                    ? "Complete"
                    : withMarks.length > 0
                        ? "Partial"
                        : "No Marks"
            });
        });

        return rows;
    }, [
        filteredExamSubjects,
        subjectMap,
        classMap,
        students,
        calculateStudentSubject
    ]);


    // ========================================================
    // QUESTION ANALYSIS
    // ========================================================

    const questionAnalysis = useMemo(() => {
        const rows = [];

        questions.forEach(question => {
            const subjectAllowed = filteredSubjectIds.has(idValue(question.subject_id));
            if (!subjectAllowed) return;

            const questionMarks = marksByQuestion.get(idValue(question.id)) || [];
            const validMarks = questionMarks.filter(mark => {
                const examSubjectOK = filteredExamSubjectIds.has(idValue(mark.exam_subject_id));
                return examSubjectOK && studentMap.has(idValue(mark.student_id));
            });

            const possible = numberValue(question.max_marks);
            const obtained = validMarks.reduce(
                (sum, mark) => sum + numberValue(mark.marks_obtained),
                0
            );
            const average = validMarks.length > 0
                ? obtained / validMarks.length
                : 0;
            const performance = pct(average, possible);
            const zeroOrLow = validMarks.filter(
                mark => pct(mark.marks_obtained, possible) < 40
            ).length;

            rows.push({
                id: question.id,
                label: getQuestionLabel(question),
                question_number: question.question_number,
                subject_id: question.subject_id,
                subject_name: getSubjectName(subjectMap.get(idValue(question.subject_id))),
                topic: question.topic || "Unclassified",
                sub_topic: question.sub_topic || "â€”",
                difficulty: question.difficulty_level || "â€”",
                bloom: question.bloom_level || "â€”",
                question_type: question.question_type || "â€”",
                max_marks: possible,
                obtained,
                average,
                performance,
                attempts: validMarks.length,
                weak_count: zeroOrLow,
                ai_processed: Boolean(question.ai_processed),
                ai_explanation: question.ai_explanation || ""
            });
        });

        return rows.sort(
            (a, b) => numberValue(a.question_number) - numberValue(b.question_number)
        );
    }, [
        questions,
        filteredSubjectIds,
        filteredExamSubjectIds,
        marksByQuestion,
        studentMap,
        subjectMap
    ]);


    const getSubjectReport = useCallback(subjectRow => {
        const subjectStudents = students
            .filter(student => idValue(student.current_class_id) === idValue(subjectRow.class_id))
            .map(student => ({
                student,
                result: calculateStudentSubject(student.id, {
                    id: subjectRow.exam_subject_id,
                    subject_id: subjectRow.subject_id,
                    class_id: subjectRow.class_id,
                    full_marks: subjectRow.full_marks,
                    pass_marks: subjectRow.pass_marks,
                    question_selection_type: subjectRow.selection_type
                })
            }));
        const weakQuestions = [...questionAnalysis]
            .filter(q => idValue(q.subject_id) === idValue(subjectRow.subject_id) && q.attempts > 0)
            .sort((a, b) => a.performance - b.performance)
            .slice(0, 5);
        const recommendations = [];
        if (subjectRow.average >= 75) recommendations.push("Endelea na mkakati mzuri wa ufundishaji na marudio, huku ukiwaongezea changamoto wanafunzi wanaofanya vizuri.");
        else if (subjectRow.average >= 60) recommendations.push("Zingatia mada na maswali yenye ufaulu mdogo ili kuongeza uthabiti wa ufaulu wa somo.");
        else if (subjectRow.average >= 50) recommendations.push("Ongeza mazoezi ya ziada, marudio maalum na ufuatiliaji wa mada zenye changamoto.");
        else recommendations.push("Somo linahitaji mpango wa haraka wa uboreshaji, ukizingatia mada moja baada ya nyingine na ufuatiliaji wa karibu.");
        if (weakQuestions.length) recommendations.push(`Maeneo ya maswali yanayohitaji kipaumbele: ${weakQuestions.map(q => `${q.label} â€“ ${q.topic} (${formatNumber(q.performance, 1)}%)`).join("; ")}.`);
        return { ...subjectRow, students: subjectStudents, recommendations, weakQuestions };
    }, [students, calculateStudentSubject, questionAnalysis]);


    const printSubjectReport = useCallback(subject => {
        setDetail(null);
        setPrintReport({ type: "subject", data: getSubjectReport(subject) });
    }, [getSubjectReport]);


    // ========================================================
    // TOPIC ANALYSIS
    // ========================================================

    const topicAnalysis = useMemo(() => {
        const map = new Map();

        questionAnalysis.forEach(question => {
            const topic = question.topic || "Unclassified";
            const key = `${idValue(question.subject_id)}::${topic}`;

            if (!map.has(key)) {
                map.set(key, {
                    key,
                    topic,
                    subject_id: question.subject_id,
                    subject_name: question.subject_name,
                    questions: 0,
                    max_marks: 0,
                    obtained: 0,
                    attempts: 0,
                    questionRows: []
                });
            }

            const row = map.get(key);
            row.questions += 1;
            row.max_marks += question.max_marks;
            row.obtained += question.obtained;
            row.attempts += question.attempts;
            row.questionRows.push(question);
        });

        return [...map.values()]
            .map(row => ({
                ...row,
                average: row.questions > 0
                    ? row.questionRows.reduce((sum, question) => sum + question.performance, 0) / row.questions
                    : 0,
                performance: pct(row.obtained, row.max_marks * Math.max(1, row.attempts / Math.max(1, row.questions))),
                weakestQuestion: [...row.questionRows].sort((a, b) => a.performance - b.performance)[0] || null,
                strongestQuestion: [...row.questionRows].sort((a, b) => b.performance - a.performance)[0] || null
            }))
            .sort((a, b) => a.average - b.average);
    }, [questionAnalysis]);


    // ========================================================
    // OVERVIEW / INTELLIGENCE
    // ========================================================

    const analysedStudents = useMemo(
        () => studentAnalysis.filter(student => student.possible > 0),
        [studentAnalysis]
    );

    const overview = useMemo(() => {
        const percentages = analysedStudents.map(student => student.percentage);
        const totalPossible = analysedStudents.reduce((sum, student) => sum + student.possible, 0);
        const totalMarks = analysedStudents.reduce((sum, student) => sum + student.total, 0);
        const passed = analysedStudents.filter(student => student.pass).length;
        const failed = analysedStudents.length - passed;

        return {
            candidates: studentAnalysis.length,
            analysed: analysedStudents.length,
            subjects: subjectAnalysis.length,
            average: analysedStudents.length
                ? analysedStudents.reduce((sum, student) => sum + student.percentage, 0) / analysedStudents.length
                : 0,
            pass_rate: analysedStudents.length ? (passed / analysedStudents.length) * 100 : 0,
            highest: percentages.length ? Math.max(...percentages) : 0,
            lowest: percentages.length ? Math.min(...percentages) : 0,
            total_possible: totalPossible,
            total_marks_entered: totalMarks,
            passed,
            failed,
            missing_students: studentAnalysis.length - analysedStudents.length
        };
    }, [studentAnalysis, analysedStudents, subjectAnalysis]);

    const gradeDistribution = useMemo(() => {
        return ["A", "B", "C", "D", "F"].map(grade => {
            const count = analysedStudents.filter(student => student.grade === grade).length;
            return {
                grade,
                count,
                percentage: analysedStudents.length ? (count / analysedStudents.length) * 100 : 0
            };
        });
    }, [analysedStudents]);

    const bestSubject = useMemo(() => {
        if (!subjectAnalysis.length) return null;
        return [...subjectAnalysis]
            .filter(row => row.analysed > 0)
            .sort((a, b) => b.average - a.average)[0] || null;
    }, [subjectAnalysis]);

    const weakestSubject = useMemo(() => {
        if (!subjectAnalysis.length) return null;
        return [...subjectAnalysis]
            .filter(row => row.analysed > 0)
            .sort((a, b) => a.average - b.average)[0] || null;
    }, [subjectAnalysis]);

    const weakestTopic = useMemo(() => {
        return topicAnalysis.find(topic => topic.attempts > 0) || null;
    }, [topicAnalysis]);

    const weakestQuestion = useMemo(() => {
        return [...questionAnalysis]
            .filter(question => question.attempts > 0)
            .sort((a, b) => a.performance - b.performance)[0] || null;
    }, [questionAnalysis]);

    const atRiskStudents = useMemo(() => {
        return [...studentAnalysis]
            .filter(student => {
                if (student.possible <= 0) return false;
                return (
                    student.percentage < 40 ||
                    student.missingSubjects > 0 ||
                    student.partialSubjects > 0
                );
            })
            .sort((a, b) => a.percentage - b.percentage)
            .slice(0, 12);
    }, [studentAnalysis]);

    const performanceSummary = useMemo(() => {
        const insights = [];

        if (!analysedStudents.length) {
            insights.push({
                type: "warning",
                title: "No analysed marks",
                text: "Hakuna mwanafunzi mwenye marks zinazoweza kuchambuliwa kwa filters ulizochagua."
            });
            return insights;
        }

        if (overview.pass_rate >= 80) {
            insights.push({
                type: "success",
                title: "Strong overall performance",
                text: `Pass rate ni ${formatNumber(overview.pass_rate, 1)}%, ikionyesha performance nzuri kwa kundi hili.`
            });
        } else if (overview.pass_rate < 50) {
            insights.push({
                type: "danger",
                title: "Overall performance needs attention",
                text: `Pass rate ni ${formatNumber(overview.pass_rate, 1)}%. Inahitaji uchunguzi wa subjects na topics dhaifu.`
            });
        } else {
            insights.push({
                type: "info",
                title: "Mixed performance",
                text: `Pass rate ni ${formatNumber(overview.pass_rate, 1)}%. Kuna nafasi ya kuboresha performance kwa targeted intervention.`
            });
        }

        if (weakestSubject) {
            insights.push({
                type: "warning",
                title: "Weakest subject",
                text: `${weakestSubject.subject_name} ina average ya ${formatNumber(weakestSubject.average, 1)}%.`
            });
        }

        if (weakestTopic) {
            insights.push({
                type: "warning",
                title: "Weakest topic",
                text: `${weakestTopic.topic} ndiyo topic yenye performance ya chini zaidi kwenye questions zilizochambuliwa.`
            });
        }

        if (weakestQuestion) {
            insights.push({
                type: "danger",
                title: "Question requiring attention",
                text: `${weakestQuestion.label} (${weakestQuestion.topic}) ina performance ya ${formatNumber(weakestQuestion.performance, 1)}%.`
            });
        }

        if (overview.missing_students > 0) {
            insights.push({
                type: "warning",
                title: "Marks completion issue",
                text: `${overview.missing_students} student(s) hawana marks zinazoweza kuchambuliwa kwenye selection hii.`
            });
        }

        return insights;
    }, [
        analysedStudents,
        overview,
        weakestSubject,
        weakestTopic,
        weakestQuestion
    ]);


    // ========================================================
    // FILTERED TABLES
    // ========================================================

    const filteredStudents = useMemo(() => {
        const query = studentSearch.trim().toLowerCase();
        if (!query) return studentAnalysis;

        return studentAnalysis.filter(student =>
            String(student.full_name || "").toLowerCase().includes(query) ||
            String(student.admission || "").toLowerCase().includes(query)
        );
    }, [studentAnalysis, studentSearch]);

    const filteredSubjects = useMemo(() => {
        const query = subjectSearch.trim().toLowerCase();
        if (!query) return subjectAnalysis;

        return subjectAnalysis.filter(row =>
            String(row.subject_name || "").toLowerCase().includes(query) ||
            String(row.subject_code || "").toLowerCase().includes(query) ||
            String(row.class_name || "").toLowerCase().includes(query)
        );
    }, [subjectAnalysis, subjectSearch]);

    const filteredTopics = useMemo(() => {
        const query = topicSearch.trim().toLowerCase();
        if (!query) return topicAnalysis;

        return topicAnalysis.filter(row =>
            String(row.topic || "").toLowerCase().includes(query) ||
            String(row.subject_name || "").toLowerCase().includes(query)
        );
    }, [topicAnalysis, topicSearch]);

    const filteredQuestions = useMemo(() => {
        const query = questionSearch.trim().toLowerCase();
        if (!query) return questionAnalysis;

        return questionAnalysis.filter(row =>
            String(row.label || "").toLowerCase().includes(query) ||
            String(row.topic || "").toLowerCase().includes(query) ||
            String(row.subject_name || "").toLowerCase().includes(query) ||
            String(row.difficulty || "").toLowerCase().includes(query)
        );
    }, [questionAnalysis, questionSearch]);


    // ========================================================
    // TRACE DETAILS
    // ========================================================

    const openStudentDetail = student => {
        const overallStudent = overallRankedStudents.find(
            row => idValue(row.id) === idValue(student.id)
        ) || student;
        setDetail({ type: "student", data: overallStudent });
    };

    const openSubjectDetail = subject => {
        setDetail({ type: "subject", data: subject });
    };

    const openQuestionDetail = question => {
        const rawMarks = marksByQuestion.get(idValue(question.id)) || [];

        const rows = rawMarks
            .filter(mark => filteredExamSubjectIds.has(idValue(mark.exam_subject_id)))
            .map(mark => ({
                ...mark,
                student: studentMap.get(idValue(mark.student_id)),
                percentage: pct(mark.marks_obtained, question.max_marks)
            }))
            .sort((a, b) => numberValue(b.marks_obtained) - numberValue(a.marks_obtained));

        setDetail({
            type: "question",
            data: question,
            marks: rows
        });
    };

    const openTopicDetail = topic => {
        setDetail({ type: "topic", data: topic });
    };

    const handlePrint = () => {
        printOverallReport();
    };

    useEffect(() => {
        const onAfterPrint = () => {
            setPrintReport(null);
        };
        window.addEventListener("afterprint", onAfterPrint);
        return () => window.removeEventListener("afterprint", onAfterPrint);
    }, []);

    useEffect(() => {
        if (!printReport) return;

        const previousTitle = document.title;
        document.title =
            printReport.type === "student"
                ? `${documentBrandName} Student Academic Report`
                : printReport.type === "subject"
                    ? `${documentBrandName} Subject Analysis Report`
                    : printReport.type === "school"
                        ? `${documentBrandName} School Overall Examination Report`
                        : printReport.type === "class"
                            ? `${documentBrandName} Class Overall Examination Report`
                            : `${documentBrandName} Overall Examination Report`;

        const timer = window.setTimeout(() => window.print(), 150);

        return () => {
            window.clearTimeout(timer);
            document.title = previousTitle;
        };
    }, [printReport, documentBrandName]);


    // ========================================================
    // TABS
    // ========================================================

    const tabs = [
        { id: "overview", label: "Overview", icon: FaChartBar },
        { id: "school", label: "School Overall", icon: FaGraduationCap },
        { id: "class", label: "Class Overall", icon: FaUserGraduate },
        { id: "subjects", label: "Subject Analysis", icon: FaListOl },
        { id: "topics", label: "Topic Analysis", icon: FaLayerGroup },
        { id: "questions", label: "Question Analysis", icon: FaClipboardList },
        { id: "students", label: "Student Analysis", icon: FaUserGraduate }
    ];


    // ========================================================
    // LOADING / ERROR
    // ========================================================

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-8 py-7 text-center max-w-sm w-full">
                    <FaSpinner className="animate-spin text-3xl text-blue-600 mx-auto mb-4" />
                    <h2 className="font-bold text-slate-800 text-lg">Loading Result Analysis</h2>
                    <p className="text-sm text-slate-500 mt-2">Tunachambua examination data kutoka kwenye marks halisi...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
                <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-8 max-w-xl w-full">
                    <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-red-50 text-red-600">
                            <FaExclamationTriangle />
                        </div>
                        <div className="flex-1">
                            <h2 className="font-bold text-slate-800 text-lg">Result Analysis haikuweza kupakiwa</h2>
                            <p className="text-sm text-slate-600 mt-2 break-words">{error}</p>
                            <div className="flex gap-3 mt-5">
                                <button
                                    onClick={() => loadAnalysis()}
                                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                                >
                                    Retry
                                </button>
                                <button
                                    onClick={() => navigate(-1)}
                                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"
                                >
                                    Back
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }


    // ========================================================
    // MAIN UI
    // ========================================================

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 print:bg-white">
            <style>{`
                .print-report { display: none; }

                @media print {
                    @page {
                        size: A4 landscape;
                        margin: 10mm;
                    }

                    html, body {
                        background: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }

                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }

                    /*
                     * PRINT ONLY THE GENERATED REPORT.
                     *
                     * ResultsAnalysis normally lives inside the ERP layout, so
                     * the sidebar/header may be OUTSIDE this component. Hiding
                     * only .screen-content therefore still allowed the layout
                     * sidebar to print.
                     *
                     * Hide every element in the document first, then explicitly
                     * reveal the generated report. This makes the printout
                     * independent of the surrounding ERP layout.
                     */
                    /* The report is rendered through a portal directly under
                       <body>. Hide the ERP application root and every other body
                       child, then print exactly ONE report node. */
                    body > * {
                        display: none !important;
                    }

                    body > .print-report {
                        display: block !important;
                        position: static !important;
                        width: 100% !important;
                        min-height: 0 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                        color: #111827 !important;
                    }

                    body > .print-report,
                    body > .print-report * {
                        visibility: visible !important;
                    }

                    .screen-content,
                    .no-print {
                        display: none !important;
                    }

                    .print-report > div {
                        width: 100% !important;
                        margin: 0 !important;
                        box-sizing: border-box !important;
                    }

                    .print-report table {
                        break-inside: auto;
                    }
                    .report-page {
                        width: 100% !important;
                        font-size: 8px !important;
                    }
                    .report-table th, .report-table td, .report-matrix th, .report-matrix td {
                        padding: 2px 1px !important;
                        font-size: 7px !important;
                        line-height: 1.05 !important;
                    }
                    .report-matrix { table-layout: fixed; width: 100% !important; }
                    .report-matrix .student-name-col { width: 105px !important; min-width: 105px !important; }
                    .report-matrix .subject-head {
                        font-size: 6px !important;
                        min-width: 31px !important;
                        max-width: 55px !important;
                        word-break: break-word !important;
                        white-space: normal !important;
                    }
                    .report-matrix-wrap { overflow: visible !important; }


                    .shadow-sm,
                    .shadow,
                    .shadow-md {
                        box-shadow: none !important;
                    }

                    .rounded-2xl,
                    .rounded-xl {
                        border-radius: 0 !important;
                    }
                }
            `}</style>

            <div className="screen-content max-w-[1600px] mx-auto p-4 md:p-6 print:p-0 print-full">

                {/* ====================================================
                    HEADER
                ==================================================== */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 md:p-6 mb-5">
                    <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
                        <div className="flex items-start gap-4">
                            <button
                                onClick={() => navigate(-1)}
                                className="no-print w-10 h-10 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-600"
                                title="Back"
                            >
                                <FaArrowLeft />
                            </button>

                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                                        Examination Intelligence
                                    </span>
                                    <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-500 font-semibold">
                                        TRACEABLE ANALYSIS
                                    </span>
                                </div>
                                <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 mt-1">
                                    Result Analysis
                                </h1>
                                <p className="text-sm text-slate-500 mt-1">
                                    {exam?.name || exam?.title || exam?.exam_name || "Examination"}
                                </p>
                            </div>
                        </div>

                        <div className="no-print flex items-center gap-2">
                            <button
                                onClick={() => loadAnalysis(true)}
                                disabled={refreshing}
                                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
                            >
                                <FaRedo className={refreshing ? "animate-spin" : ""} />
                                Refresh
                            </button>
                            <button
                                onClick={handlePrint}
                                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold flex items-center gap-2"
                            >
                                <FaPrint />
                                Print
                            </button>
                        </div>
                    </div>

                    {/* FILTERS */}
                    <div className="no-print mt-6 pt-5 border-t border-slate-100">
                        <div className="flex items-center gap-2 mb-3 text-sm font-bold text-slate-700">
                            <FaFilter className="text-blue-600" />
                            Analysis Filters
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                            {isSubjectTeacher ? (
                                <>
                                    <div className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-800 font-semibold flex items-center gap-2">
                                        <FaGraduationCap className="shrink-0" />
                                        <span className="truncate">{currentClassLabel}</span>
                                    </div>

                                    <div className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-800 font-semibold flex items-center gap-2">
                                        <FaFileAlt className="shrink-0" />
                                        <span className="truncate">{getSubjectName(subjectMap.get(idValue(selectedSubjectId)))}</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <select
                                        value={selectedClassId}
                                        onChange={event => setSelectedClassId(event.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                                    >
                                        <option value="ALL">All Classes</option>
                                        {availableClasses.map(cls => (
                                            <option key={cls.id} value={cls.id}>
                                                {getClassName(cls)}
                                            </option>
                                        ))}
                                    </select>

                                    <select
                                        value={selectedSubjectId}
                                        onChange={event => setSelectedSubjectId(event.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                                    >
                                        <option value="ALL">All Subjects</option>
                                        {availableSubjects.map(subject => (
                                            <option key={subject.id} value={subject.id}>
                                                {getSubjectName(subject)}
                                            </option>
                                        ))}
                                    </select>
                                </>
                            )}

                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 flex items-center gap-2">
                                <FaGraduationCap className="text-blue-600" />
                                <span className="truncate">{currentClassLabel}</span>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 flex items-center gap-2">
                                <FaFileAlt className="text-blue-600" />
                                <span>{filteredExamSubjects.length} examination subject(s)</span>
                            </div>
                        </div>
                    </div>
                </div>


                {/* ====================================================
                    TABS
                ==================================================== */}
                <div className="no-print bg-white border border-slate-200 rounded-2xl shadow-sm p-2 mb-5 overflow-x-auto">
                    <div className="flex min-w-max gap-1">
                        {tabs.map(tab => {
                            const Icon = tab.icon;
                            const active = activeTab === tab.id;

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition ${
                                        active
                                            ? "bg-blue-600 text-white shadow-sm"
                                            : "text-slate-600 hover:bg-slate-50"
                                    }`}
                                >
                                    <Icon />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>


                {/* ====================================================
                    OVERVIEW
                ==================================================== */}
                {activeTab === "overview" && (
                    <div className="space-y-5">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <MetricCard
                                icon={FaUserGraduate}
                                label="Candidates"
                                value={overview.candidates}
                                sub={`${overview.analysed} analysed`}
                            />
                            <MetricCard
                                icon={FaChartBar}
                                label="Overall Average"
                                value={`${formatNumber(overview.average, 1)}%`}
                                sub={performanceLabel(overview.average)}
                                tone={overview.average < 40 ? "danger" : overview.average < 60 ? "warning" : "success"}
                            />
                            <MetricCard
                                icon={FaCheckCircle}
                                label="Pass Rate"
                                value={`${formatNumber(overview.pass_rate, 1)}%`}
                                sub={`${overview.passed} passed Â· ${overview.failed} failed`}
                                tone={overview.pass_rate < 50 ? "danger" : overview.pass_rate < 70 ? "warning" : "success"}
                            />
                            <MetricCard
                                icon={FaTrophy}
                                label="Highest"
                                value={`${formatNumber(overview.highest, 1)}%`}
                                sub={`Lowest ${formatNumber(overview.lowest, 1)}%`}
                                tone="info"
                            />
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                            <Panel className="xl:col-span-2" title="Performance Intelligence" icon={FaBrain}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {performanceSummary.map((item, index) => (
                                        <InsightCard key={`${item.title}-${index}`} {...item} />
                                    ))}
                                </div>
                            </Panel>

                            <Panel title="Grade Distribution" icon={FaChartBar}>
                                <div className="space-y-4">
                                    {gradeDistribution.map(row => (
                                        <div key={row.grade}>
                                            <div className="flex items-center justify-between mb-1.5 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-7 h-7 rounded-lg border flex items-center justify-center font-extrabold ${gradeClass(row.grade)}`}>
                                                        {row.grade}
                                                    </span>
                                                    <span className="text-slate-600">{row.count} students</span>
                                                </div>
                                                <span className="font-bold text-slate-800">{formatNumber(row.percentage, 1)}%</span>
                                            </div>
                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-600 rounded-full" style={{ width: `${clamp(row.percentage)}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Panel>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <InsightMetric
                                title="Strongest Subject"
                                icon={FaArrowUp}
                                value={bestSubject?.subject_name || "â€”"}
                                detail={bestSubject ? `${formatNumber(bestSubject.average, 1)}% average` : "No analysed subject"}
                                tone="success"
                            />
                            <InsightMetric
                                title="Weakest Subject"
                                icon={FaArrowDown}
                                value={weakestSubject?.subject_name || "â€”"}
                                detail={weakestSubject ? `${formatNumber(weakestSubject.average, 1)}% average` : "No analysed subject"}
                                tone="danger"
                            />
                            <InsightMetric
                                title="At-Risk Students"
                                icon={FaExclamationTriangle}
                                value={atRiskStudents.length}
                                detail="Low/partial/missing marks require attention"
                                tone="warning"
                            />
                        </div>

                        <Panel title="At-Risk / Incomplete Students" icon={FaExclamationTriangle}>
                            {atRiskStudents.length === 0 ? (
                                <EmptyState text="Hakuna student aliye kwenye at-risk/incomplete list kwa filters hizi." />
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                                                <th className="px-3 py-3">Student</th>
                                                <th className="px-3 py-3">Class</th>
                                                <th className="px-3 py-3">Performance</th>
                                                <th className="px-3 py-3">Status</th>
                                                <th className="px-3 py-3 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {atRiskStudents.map(student => (
                                                <tr key={student.id} className="border-b last:border-0 border-slate-100 hover:bg-slate-50">
                                                    <td className="px-3 py-3">
                                                        <div className="font-semibold text-slate-800">{student.full_name}</div>
                                                        <div className="text-xs text-slate-500">{student.admission}</div>
                                                    </td>
                                                    <td className="px-3 py-3 text-slate-600">{student.class_name}</td>
                                                    <td className="px-3 py-3">
                                                        <span className={`px-2.5 py-1 rounded-full border text-xs font-bold ${performanceClass(student.percentage)}`}>
                                                            {formatNumber(student.percentage, 1)}% Â· {student.grade}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <span className="text-xs text-slate-600">
                                                            {student.missingSubjects > 0
                                                                ? `${student.missingSubjects} missing subject(s)`
                                                                : `${student.partialSubjects} partial subject(s)`}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3 text-right">
                                                        <button
                                                            onClick={() => openStudentDetail(student)}
                                                            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-white text-xs font-bold text-blue-700 inline-flex items-center gap-1.5"
                                                        >
                                                            <FaEye /> View
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Panel>
                    </div>
                )}


                {/* ====================================================
                    SCHOOL OVERALL RESULT
                ==================================================== */}
                {activeTab === "school" && (
                    <div className="space-y-5">
                        <div className="flex justify-end no-print">
                            <button onClick={printSchoolOverallReport} className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold inline-flex items-center gap-2"><FaPrint /> Print School Overall</button>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                            <MetricCard icon={FaUserGraduate} label="Students" value={schoolOverall.candidates} sub={`${schoolOverall.studentsAnalysed} analysed`} />
                            <MetricCard icon={FaChartBar} label="School Average" value={`${formatNumber(schoolOverall.average, 1)}%`} sub={performanceLabel(schoolOverall.average)} tone={schoolOverall.average < 40 ? "danger" : schoolOverall.average < 60 ? "warning" : "success"} />
                            <MetricCard icon={FaGraduationCap} label="GPA" value={schoolOverall.cseeGpa != null ? formatNumber(schoolOverall.cseeGpa, 2) : "â€”"} sub={`${schoolOverall.cseeEligibleStudents} eligible Â· Best 7`} tone="info" />
                            <MetricCard icon={FaTrophy} label="Candidates" value={schoolOverall.cseeEligibleStudents} sub="Best 7 eligible" tone="info" />
                            <MetricCard icon={FaCheckCircle} label="Pass Rate" value={`${formatNumber(schoolOverall.passRate, 1)}%`} sub={`${schoolOverall.studentsPassed} passed Â· ${schoolOverall.studentsFailed} failed`} tone={schoolOverall.passRate < 50 ? "danger" : schoolOverall.passRate < 70 ? "warning" : "success"} />
                            <MetricCard icon={FaTrophy} label="Highest Student" value={schoolOverall.topStudents[0]?.full_name || "â€”"} sub={schoolOverall.topStudents[0] ? `${formatNumber(schoolOverall.topStudents[0].percentage, 1)}%` : "No result"} tone="info" />
                            <MetricCard icon={FaListOl} label="Exam Subjects" value={examSubjects.length} sub={`${schoolOverall.assignments} subject assignments`} />
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                            <Panel className="xl:col-span-2" title="School Subject Performance" icon={FaListOl}>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100"><th className="px-3 py-3">Subject</th><th className="px-3 py-3">Class</th><th className="px-3 py-3">Candidates</th><th className="px-3 py-3">Average</th><th className="px-3 py-3">Pass Rate</th></tr></thead>
                                        <tbody>
                                            {[...schoolOverall.subjectRows].sort((a,b) => b.average-a.average).map(row => (
                                                <tr key={row.exam_subject_id} className="border-b last:border-0 border-slate-100">
                                                    <td className="px-3 py-3 font-bold">{row.subject_name}</td>
                                                    <td className="px-3 py-3">{row.class_name}</td>
                                                    <td className="px-3 py-3">{row.analysed}/{row.candidates}</td>
                                                    <td className="px-3 py-3"><span className={`px-2.5 py-1 rounded-full border text-xs font-bold ${performanceClass(row.average)}`}>{formatNumber(row.average,1)}%</span></td>
                                                    <td className="px-3 py-3 font-semibold">{formatNumber(row.pass_rate,1)}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </Panel>

                            <Panel title="School Grade Distribution" icon={FaChartBar}>
                                <div className="space-y-4">
                                    {schoolOverall.studentGradeDistribution.map(row => {
                                        const percent = schoolOverall.studentsAnalysed ? (row.count / schoolOverall.studentsAnalysed) * 100 : 0;
                                        return <div key={row.grade}><div className="flex justify-between text-sm mb-1"><span className={`w-7 h-7 rounded-lg border flex items-center justify-center font-extrabold ${gradeClass(row.grade)}`}>{row.grade}</span><span className="font-bold">{row.count} Â· {formatNumber(percent,1)}%</span></div><div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-600 rounded-full" style={{width:`${clamp(percent)}%`}} /></div></div>;
                                    })}
                                </div>
                            </Panel>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                            <Panel title="Division Distribution" icon={FaGraduationCap}>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                    {schoolOverall.cseeDivisionDistribution.map(row => (
                                        <div key={row.division} className="border border-slate-200 rounded-xl p-4 text-center">
                                            <div className="text-xs uppercase tracking-wide text-slate-500 font-bold">Division {row.division}</div>
                                            <div className="text-2xl font-extrabold text-slate-900 mt-1">{row.count}</div>
                                        </div>
                                    ))}
                                </div>
                            </Panel>
                            <Panel title=" Calculation" icon={FaChartBar}>
                                <div className="text-sm text-slate-600 leading-6">GPA na Division vinahesabiwa kwa <strong>Best 7</strong> subjects. A=1, B=2, C=3, D=4, F=5; Aggregate ni jumla ya points za Best 7.</div>
                            </Panel>
                        </div>

                        <Panel title="Top Students â€” School" icon={FaTrophy}>
                            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100"><th className="px-3 py-3">Pos.</th><th className="px-3 py-3">Student</th><th className="px-3 py-3">Class</th><th className="px-3 py-3">Total</th><th className="px-3 py-3">Average</th><th className="px-3 py-3">Grade</th><th className="px-3 py-3">GPA</th><th className="px-3 py-3">Division</th></tr></thead><tbody>{schoolOverall.topStudents.map(row => <tr key={row.id} className="border-b last:border-0 border-slate-100"><td className="px-3 py-3 font-bold">{row.position}</td><td className="px-3 py-3 font-semibold">{row.full_name}<div className="text-xs text-slate-500">{row.admission}</div></td><td className="px-3 py-3">{row.class_name}</td><td className="px-3 py-3 font-bold">{formatNumber(row.total)}</td><td className="px-3 py-3">{formatNumber(row.percentage,1)}%</td><td className="px-3 py-3"><span className={`px-2.5 py-1 rounded-full border text-xs font-bold ${gradeClass(row.grade)}`}>{row.grade}</span></td><td className="px-3 py-3 font-bold">{row.cseeGpa != null ? formatNumber(row.cseeGpa,2) : "â€”"}</td><td className="px-3 py-3 font-bold">{row.cseeDivision ? `Div ${row.cseeDivision}` : "â€”"}</td></tr>)}</tbody></table></div>
                        </Panel>
                    </div>
                )}

                {/* ====================================================
                    CLASS OVERALL RESULT
                ==================================================== */}
                {activeTab === "class" && (
                    <div className="space-y-5">
                        {selectedClassId === "ALL" ? (
                            <Panel title="Select a Class" icon={FaGraduationCap}><EmptyState text="Chagua class kwenye Analysis Filters ili kuona Overall Class Result." /></Panel>
                        ) : (
                            <>
                                <div className="flex justify-end no-print">
                                    <button onClick={printClassOverallReport} className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold inline-flex items-center gap-2"><FaPrint /> Print Class Overall</button>
                                </div>
                                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                                    <MetricCard icon={FaUserGraduate} label="Students" value={classOverall.studentCount} sub={`${classOverall.subjectCount} subjects`} />
                                    <MetricCard icon={FaChartBar} label="Class Average" value={`${formatNumber(classOverall.average,1)}%`} sub={performanceLabel(classOverall.average)} tone={classOverall.average < 40 ? "danger" : classOverall.average < 60 ? "warning" : "success"} />
                                    <MetricCard icon={FaCheckCircle} label="Pass Rate" value={`${formatNumber(classOverall.passRate,1)}%`} sub={`${classOverall.passedStudents} passed Â· ${classOverall.failedStudents} failed`} tone={classOverall.passRate < 50 ? "danger" : classOverall.passRate < 70 ? "warning" : "success"} />
                                    <MetricCard icon={FaTrophy} label="Best Student" value={classOverall.topStudents[0]?.full_name || "â€”"} sub={classOverall.topStudents[0] ? `${formatNumber(classOverall.topStudents[0].percentage,1)}%` : "No result"} tone="info" />
                                    <MetricCard icon={FaListOl} label="Class Subjects" value={classOverall.subjectCount} sub={classOverall.className} />
                                </div>

                                <Panel title={`Student Ranking â€” ${classOverall.className}`} icon={FaTrophy}>
                                    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100"><th className="px-3 py-3">Pos.</th><th className="px-3 py-3">Student</th><th className="px-3 py-3">Total</th><th className="px-3 py-3">Average</th><th className="px-3 py-3">Grade</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Missing</th></tr></thead><tbody>{classOverall.students.map(row => <tr key={row.id} className="border-b last:border-0 border-slate-100"><td className="px-3 py-3 font-bold">{row.position}</td><td className="px-3 py-3 font-semibold">{row.full_name}<div className="text-xs text-slate-500">{row.admission}</div></td><td className="px-3 py-3 font-bold">{formatNumber(row.total)}</td><td className="px-3 py-3">{formatNumber(row.percentage,1)}%</td><td className="px-3 py-3"><span className={`px-2.5 py-1 rounded-full border text-xs font-bold ${gradeClass(row.grade)}`}>{row.grade}</span></td><td className="px-3 py-3">{row.pass ? <span className="text-emerald-700 font-bold">Passed</span> : <span className="text-red-700 font-bold">Failed</span>}</td><td className="px-3 py-3">{row.missingSubjects}</td></tr>)}</tbody></table></div>
                                </Panel>

                                <Panel title="Class Subject Performance" icon={FaChartBar}>
                                    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100"><th className="px-3 py-3">Subject</th><th className="px-3 py-3">Candidates</th><th className="px-3 py-3">Average</th><th className="px-3 py-3">Highest</th><th className="px-3 py-3">Lowest</th><th className="px-3 py-3">Pass Rate</th></tr></thead><tbody>{[...classOverall.subjects].sort((a,b)=>b.average-a.average).map(row => <tr key={row.exam_subject_id} className="border-b last:border-0 border-slate-100"><td className="px-3 py-3 font-bold">{row.subject_name}</td><td className="px-3 py-3">{row.analysed}/{row.candidates}</td><td className="px-3 py-3">{formatNumber(row.average,1)}%</td><td className="px-3 py-3">{formatNumber(row.highest,1)}%</td><td className="px-3 py-3">{formatNumber(row.lowest,1)}%</td><td className="px-3 py-3 font-semibold">{formatNumber(row.pass_rate,1)}%</td></tr>)}</tbody></table></div>
                                </Panel>
                            </>
                        )}
                    </div>
                )}

                {/* ====================================================
                    SUBJECT ANALYSIS
                ==================================================== */}
                {activeTab === "subjects" && (
                    <Panel title="Subject Performance" icon={FaListOl}>
                        <div className="no-print mb-4 relative max-w-md">
                            <FaSearch className="absolute left-3 top-3 text-slate-400 text-sm" />
                            <input
                                value={subjectSearch}
                                onChange={event => setSubjectSearch(event.target.value)}
                                placeholder="Search subject, code or class..."
                                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                            />
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                                        <th className="px-3 py-3">Subject</th>
                                        <th className="px-3 py-3">Class</th>
                                        <th className="px-3 py-3">Candidates</th>
                                        <th className="px-3 py-3">Analysed</th>
                                        <th className="px-3 py-3">Average</th>
                                        <th className="px-3 py-3">Pass Rate</th>
                                        <th className="px-3 py-3">Completion</th>
                                        <th className="px-3 py-3 text-right">Trace</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSubjects.map(row => (
                                        <tr key={row.exam_subject_id} className="border-b last:border-0 border-slate-100 hover:bg-slate-50">
                                            <td className="px-3 py-3">
                                                <div className="font-bold text-slate-800">{row.subject_name}</div>
                                                <div className="text-xs text-slate-500">{row.subject_code || "No code"}</div>
                                            </td>
                                            <td className="px-3 py-3 text-slate-600">{row.class_name}</td>
                                            <td className="px-3 py-3 font-semibold">{row.candidates}</td>
                                            <td className="px-3 py-3 font-semibold">{row.analysed}</td>
                                            <td className="px-3 py-3">
                                                <span className={`px-2.5 py-1 rounded-full border text-xs font-bold ${performanceClass(row.average)}`}>
                                                    {formatNumber(row.average, 1)}%
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 font-semibold">{formatNumber(row.pass_rate, 1)}%</td>
                                            <td className="px-3 py-3">
                                                <div className="text-xs">
                                                    <span className="text-emerald-700 font-semibold">{row.complete} complete</span>
                                                    {row.partial > 0 && <span className="text-amber-700 font-semibold ml-2">{row.partial} partial</span>}
                                                    {row.missing > 0 && <span className="text-red-700 font-semibold ml-2">{row.missing} missing</span>}
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-right">
                                                <button
                                                    onClick={() => openSubjectDetail(row)}
                                                    className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-white text-xs font-bold text-blue-700 inline-flex items-center gap-1.5"
                                                >
                                                    <FaEye /> Trace
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {filteredSubjects.length === 0 && <EmptyState text="Hakuna subject analysis kwa filters hizi." />}
                    </Panel>
                )}


                {/* ====================================================
                    TOPIC ANALYSIS
                ==================================================== */}
                {activeTab === "topics" && (
                    <Panel title="Topic Performance" icon={FaLayerGroup}>
                        <p className="text-sm text-slate-500 mb-4">
                            Topic analysis inatoka kwenye marks halisi za questions; topic yenye performance ndogo huonekana juu kwa ajili ya intervention.
                        </p>

                        <div className="no-print mb-4 relative max-w-md">
                            <FaSearch className="absolute left-3 top-3 text-slate-400 text-sm" />
                            <input
                                value={topicSearch}
                                onChange={event => setTopicSearch(event.target.value)}
                                placeholder="Search topic or subject..."
                                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                            />
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                                        <th className="px-3 py-3">Topic</th>
                                        <th className="px-3 py-3">Subject</th>
                                        <th className="px-3 py-3">Questions</th>
                                        <th className="px-3 py-3">Performance</th>
                                        <th className="px-3 py-3">Strongest Q</th>
                                        <th className="px-3 py-3">Weakest Q</th>
                                        <th className="px-3 py-3 text-right">Trace</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTopics.map(topic => (
                                        <tr key={topic.key} className="border-b last:border-0 border-slate-100 hover:bg-slate-50">
                                            <td className="px-3 py-3 font-bold text-slate-800">{topic.topic}</td>
                                            <td className="px-3 py-3 text-slate-600">{topic.subject_name}</td>
                                            <td className="px-3 py-3">{topic.questions}</td>
                                            <td className="px-3 py-3">
                                                <span className={`px-2.5 py-1 rounded-full border text-xs font-bold ${performanceClass(topic.average)}`}>
                                                    {formatNumber(topic.average, 1)}%
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-emerald-700 font-semibold">
                                                {topic.strongestQuestion?.label || "â€”"}
                                                {topic.strongestQuestion && ` (${formatNumber(topic.strongestQuestion.performance, 0)}%)`}
                                            </td>
                                            <td className="px-3 py-3 text-red-700 font-semibold">
                                                {topic.weakestQuestion?.label || "â€”"}
                                                {topic.weakestQuestion && ` (${formatNumber(topic.weakestQuestion.performance, 0)}%)`}
                                            </td>
                                            <td className="px-3 py-3 text-right">
                                                <button
                                                    onClick={() => openTopicDetail(topic)}
                                                    className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-white text-xs font-bold text-blue-700 inline-flex items-center gap-1.5"
                                                >
                                                    <FaEye /> Trace
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {filteredTopics.length === 0 && <EmptyState text="Hakuna topic analysis kwa filters hizi." />}
                    </Panel>
                )}


                {/* ====================================================
                    QUESTION ANALYSIS
                ==================================================== */}
                {activeTab === "questions" && (
                    <Panel title="Question Intelligence" icon={FaClipboardList}>
                        <div className="no-print mb-4 relative max-w-md">
                            <FaSearch className="absolute left-3 top-3 text-slate-400 text-sm" />
                            <input
                                value={questionSearch}
                                onChange={event => setQuestionSearch(event.target.value)}
                                placeholder="Search Q, topic, subject or difficulty..."
                                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                            />
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                                        <th className="px-3 py-3">Question</th>
                                        <th className="px-3 py-3">Topic</th>
                                        <th className="px-3 py-3">Difficulty</th>
                                        <th className="px-3 py-3">Bloom</th>
                                        <th className="px-3 py-3">Max</th>
                                        <th className="px-3 py-3">Average</th>
                                        <th className="px-3 py-3">Performance</th>
                                        <th className="px-3 py-3">Attempts</th>
                                        <th className="px-3 py-3 text-right">Trace</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredQuestions.map(question => (
                                        <tr key={question.id} className="border-b last:border-0 border-slate-100 hover:bg-slate-50">
                                            <td className="px-3 py-3">
                                                <div className="font-bold text-slate-800">{question.label}</div>
                                                <div className="text-xs text-slate-500">{question.subject_name}</div>
                                            </td>
                                            <td className="px-3 py-3">{question.topic}</td>
                                            <td className="px-3 py-3 text-slate-600">{question.difficulty}</td>
                                            <td className="px-3 py-3 text-slate-600">{question.bloom}</td>
                                            <td className="px-3 py-3 font-semibold">{formatNumber(question.max_marks)}</td>
                                            <td className="px-3 py-3">{formatNumber(question.average)}</td>
                                            <td className="px-3 py-3">
                                                <span className={`px-2.5 py-1 rounded-full border text-xs font-bold ${performanceClass(question.performance)}`}>
                                                    {formatNumber(question.performance, 1)}%
                                                </span>
                                            </td>
                                            <td className="px-3 py-3">{question.attempts}</td>
                                            <td className="px-3 py-3 text-right">
                                                <button
                                                    onClick={() => openQuestionDetail(question)}
                                                    className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-white text-xs font-bold text-blue-700 inline-flex items-center gap-1.5"
                                                >
                                                    <FaEye /> Trace
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {filteredQuestions.length === 0 && <EmptyState text="Hakuna question analysis kwa filters hizi." />}
                    </Panel>
                )}


                {/* ====================================================
                    STUDENT ANALYSIS
                ==================================================== */}
                {activeTab === "students" && (
                    <Panel title="Student Performance & Traceability" icon={FaUserGraduate}>
                        <div className="no-print mb-4 relative max-w-md">
                            <FaSearch className="absolute left-3 top-3 text-slate-400 text-sm" />
                            <input
                                value={studentSearch}
                                onChange={event => setStudentSearch(event.target.value)}
                                placeholder="Search student name or admission number..."
                                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                            />
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                                        <th className="px-3 py-3">Position</th>
                                        <th className="px-3 py-3">Student</th>
                                        <th className="px-3 py-3">Class</th>
                                        <th className="px-3 py-3">Total</th>
                                        <th className="px-3 py-3">%</th>
                                        <th className="px-3 py-3">Grade</th>
                                        <th className="px-3 py-3">GPA</th>
                                        <th className="px-3 py-3">Division</th>
                                        <th className="px-3 py-3">Status</th>
                                        <th className="px-3 py-3 text-right">Trace</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStudents.map(student => (
                                        <tr key={student.id} className="border-b last:border-0 border-slate-100 hover:bg-slate-50">
                                            <td className="px-3 py-3 font-extrabold text-slate-700">
                                                {student.position ? `${student.position}/${student.rankTotal}` : "â€”"}
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="font-bold text-slate-800">{student.full_name}</div>
                                                <div className="text-xs text-slate-500">{student.admission}</div>
                                            </td>
                                            <td className="px-3 py-3 text-slate-600">{student.class_name}</td>
                                            <td className="px-3 py-3 font-semibold">
                                                {formatNumber(student.total)} / {formatNumber(student.possible)}
                                            </td>
                                            <td className="px-3 py-3">
                                                <span className={`px-2.5 py-1 rounded-full border text-xs font-bold ${performanceClass(student.percentage)}`}>
                                                    {formatNumber(student.percentage, 1)}%
                                                </span>
                                            </td>
                                            <td className="px-3 py-3">
                                                <span className={`w-8 h-8 rounded-lg border inline-flex items-center justify-center font-extrabold ${gradeClass(student.grade)}`}>
                                                    {student.grade}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 font-bold">{student.cseeGpa != null ? formatNumber(student.cseeGpa, 2) : "â€”"}</td>
                                            <td className="px-3 py-3 font-bold">{student.cseeDivision ? `Div ${student.cseeDivision}` : "â€”"}</td>
                                            <td className="px-3 py-3">
                                                {student.status === "Complete" ? (
                                                    <span className="text-emerald-700 text-xs font-bold inline-flex items-center gap-1">
                                                        <FaCheckCircle /> Complete
                                                    </span>
                                                ) : student.status === "Partial" ? (
                                                    <span className="text-amber-700 text-xs font-bold inline-flex items-center gap-1">
                                                        <FaExclamationTriangle /> Partial
                                                    </span>
                                                ) : (
                                                    <span className="text-red-700 text-xs font-bold inline-flex items-center gap-1">
                                                        <FaTimesCircle /> No Marks
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 text-right">
                                                <button
                                                    onClick={() => openStudentDetail(student)}
                                                    className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-white text-xs font-bold text-blue-700 inline-flex items-center gap-1.5"
                                                >
                                                    <FaEye /> Trace
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {filteredStudents.length === 0 && <EmptyState text="Hakuna student analysis kwa filters hizi." />}
                    </Panel>
                )}

                <div className="mt-5 text-xs text-slate-400 text-center print:mt-3">
                    Result Analysis is calculated from examination configuration, exam questions and saved student question marks.
                </div>
            </div>


            {/* ========================================================
                TRACE MODAL
            ======================================================== */}
            {detail && (
                <TraceModal
                    detail={detail}
                    close={() => setDetail(null)}
                    studentMap={studentMap}
                    marksByQuestion={marksByQuestion}
                    questionMap={questionMap}
                    examSubjects={examSubjects}
                    questions={questions}
                    calculateStudentSubject={calculateStudentSubject}
                    subjectMap={subjectMap}
                    getStudentMarks={getStudentMarks}
                    openQuestionDetail={openQuestionDetail}
                    printStudentReport={printStudentReport}
                    shareStudentResult={shareStudentResult}
                    sendingChannel={sendingChannel}
                    printSubjectReport={printSubjectReport}
                    studentReportFields={studentReportFields}
                    updateStudentReportFields={updateStudentReportFields}
                    communicationStatus={communicationStatus}
                />
            )}

            {printReport && typeof document !== "undefined" && createPortal(
                <div className="print-report">
                    {printReport.type === "student" && <StudentReportPrint exam={exam} report={printReport.data} />}
                    {printReport.type === "subject" && <SubjectReportPrint exam={exam} report={printReport.data} />}
                    {printReport.type === "overall" && <OverallReportPrint exam={exam} data={printReport.data} />}
                    {printReport.type === "school" && <SchoolOverallReportPrint exam={exam} data={printReport.data} />}
                    {printReport.type === "class" && <ClassOverallReportPrint exam={exam} data={printReport.data} />}
                </div>,
                document.body
            )}
        </div>
    );
}


// ============================================================
// METRIC CARD
// ============================================================

function MetricCard({ icon: Icon, label, value, sub, tone = "info" }) {
    const toneClass = {
        info: "bg-blue-50 text-blue-700",
        success: "bg-emerald-50 text-emerald-700",
        warning: "bg-amber-50 text-amber-700",
        danger: "bg-red-50 text-red-700"
    }[tone] || "bg-blue-50 text-blue-700";

    return (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 md:p-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs uppercase tracking-wide font-bold text-slate-500">{label}</p>
                    <p className="text-2xl md:text-3xl font-extrabold text-slate-900 mt-2">{value}</p>
                    <p className="text-xs text-slate-500 mt-1">{sub}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${toneClass}`}>
                    <Icon />
                </div>
            </div>
        </div>
    );
}


// ============================================================
// PANEL
// ============================================================

function Panel({ title, icon: Icon, children, className = "" }) {
    return (
        <section className={`bg-white border border-slate-200 rounded-2xl shadow-sm p-5 ${className}`}>
            <div className="flex items-center gap-2 mb-5">
                {Icon && (
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                        <Icon />
                    </div>
                )}
                <h2 className="font-extrabold text-slate-900">{title}</h2>
            </div>
            {children}
        </section>
    );
}


// ============================================================
// INSIGHT CARD
// ============================================================

function InsightCard({ type, title, text }) {
    const config = {
        success: {
            wrap: "border-emerald-200 bg-emerald-50/70",
            icon: "text-emerald-700",
            Icon: FaCheckCircle
        },
        warning: {
            wrap: "border-amber-200 bg-amber-50/70",
            icon: "text-amber-700",
            Icon: FaExclamationTriangle
        },
        danger: {
            wrap: "border-red-200 bg-red-50/70",
            icon: "text-red-700",
            Icon: FaTimesCircle
        },
        info: {
            wrap: "border-blue-200 bg-blue-50/70",
            icon: "text-blue-700",
            Icon: FaBrain
        }
    }[type] || {
        wrap: "border-slate-200 bg-slate-50",
        icon: "text-slate-700",
        Icon: FaBrain
    };

    const Icon = config.Icon;

    return (
        <div className={`border rounded-xl p-4 ${config.wrap}`}>
            <div className="flex items-start gap-3">
                <Icon className={`mt-0.5 ${config.icon}`} />
                <div>
                    <h3 className="font-bold text-sm text-slate-800">{title}</h3>
                    <p className="text-xs text-slate-600 mt-1 leading-5">{text}</p>
                </div>
            </div>
        </div>
    );
}


// ============================================================
// INSIGHT METRIC
// ============================================================

function InsightMetric({ title, icon: Icon, value, detail, tone }) {
    const classes = {
        success: "border-emerald-200 bg-emerald-50/60 text-emerald-700",
        warning: "border-amber-200 bg-amber-50/60 text-amber-700",
        danger: "border-red-200 bg-red-50/60 text-red-700",
        info: "border-blue-200 bg-blue-50/60 text-blue-700"
    }[tone] || "border-blue-200 bg-blue-50/60 text-blue-700";

    return (
        <div className={`border rounded-2xl p-5 ${classes}`}>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide font-bold">
                <Icon /> {title}
            </div>
            <div className="mt-3 text-xl font-extrabold text-slate-900 break-words">{value}</div>
            <div className="text-xs text-slate-500 mt-1">{detail}</div>
        </div>
    );
}


// ============================================================
// PRINT REPORT COMPONENTS
// ============================================================

function ReportHeader({ exam, title, subtitle }) {
    const { showSchoolName, schoolName } = useSchool();
    const brandName = showSchoolName && schoolName ? schoolName : "AfriCore ERP";

    return (
        <div className="text-center border-b-2 border-slate-800 pb-4 mb-5">
            <div className="text-xs font-bold uppercase tracking-widest">{brandName}</div>
            <h1 className="text-2xl font-extrabold mt-1">{title}</h1>
            <p className="text-sm mt-1">{exam?.name || exam?.title || exam?.exam_name || "Examination"}</p>
            {subtitle && <p className="text-xs text-slate-600 mt-1">{subtitle}</p>}
        </div>
    );
}

function RecommendationBox({ recommendations }) {
    return (
        <div className="border border-slate-400 rounded-lg p-4 mt-5">
            <h3 className="font-extrabold text-sm mb-2">Mapendekezo</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm leading-5">
                {(recommendations || []).map((item, index) => <li key={index}>{item}</li>)}
            </ul>
        </div>
    );
}

function StudentReportPrint({ exam, report }) {
    const result = calculateResult(report?.subjects || []);
    const bestSeven = result.bestSeven || [];
    const gpa = report?.cseeGpa ?? report?.gpa ?? result.gpa;
    const division = report?.cseeDivision ?? report?.division ?? result.division;
    const aggregate = report?.cseeAggregate ?? report?.aggregate ?? result.aggregate;
    const divisionLabel = division ? (division === "0" ? "Division 0" : `Division ${division}`) : "Not Calculated";
    const bestSevenTotal = bestSeven.reduce((sum, row) => sum + numberValue(row.total), 0);
    const bestSevenAverage = bestSeven.length ? (bestSevenTotal / 700) * 100 : 0;
    const finalGrade = bestSeven.length === 7 ? getGrade(bestSevenAverage) : "â€”";
    const allSubjects = report?.subjects || [];

    return (
        <div className="p-7 text-slate-900 report-page">
            <ReportHeader exam={exam} title="Student Academic Report" subtitle={`${report.class_name || "Class"} Â· ${report.stream || ""} Â· Position ${report.position || "â€”"}/${report.rankTotal || "â€”"}`} />

            <div className="grid grid-cols-4 gap-2 text-[10px] mb-4">
                <DetailBox label="Student Name" value={report.full_name || "â€”"} />
                <DetailBox label="Admission No." value={report.admission || "â€”"} />
                <DetailBox label="Class" value={report.class_name || "â€”"} />
                <DetailBox label="Gender" value={report.gender || "â€”"} />
                <DetailBox label="Best 7 Subjects" value={`${bestSeven.length}/7`} />
                <DetailBox label="Best 7 Total" value={`${formatNumber(bestSevenTotal, 0)} / 700`} />
                <DetailBox label="Best 7 Average" value={bestSeven.length ? `${formatNumber(bestSevenAverage, 1)}%` : "â€”"} />
                <DetailBox label="Aggregate" value={aggregate != null ? formatNumber(aggregate, 0) : "â€”"} />
                <DetailBox label="GPA" value={gpa != null ? formatNumber(gpa, 2) : "â€”"} />
                <DetailBox label="Division" value={divisionLabel} />
                <DetailBox label="Grade" value={finalGrade} />
                <DetailBox label="Status" value={report.reportStatus || "â€”"} />
            </div>

            <DivisionSummary distribution={division ? [{ division, count: 1 }] : []} title="Student Final Classification" />

            <div className="mb-4">
                <h3 className="font-extrabold text-sm mb-2">Best Seven Subjects â€” Final Calculation</h3>
                <table className="w-full border-collapse text-[9px] report-table">
                    <thead><tr>{["#","Subject","Mark","%","Grade","Point","Counted"].map(h => <th key={h} className="border border-slate-400 p-1 text-center">{h}</th>)}</tr></thead>
                    <tbody>
                        {bestSeven.map((row, index) => (
                            <tr key={row.exam_subject_id || index}>
                                <td className="border border-slate-400 p-1 text-center">{index + 1}</td>
                                <td className="border border-slate-400 p-1 font-bold text-left">{row.subject_name || "Subject"}</td>
                                <td className="border border-slate-400 p-1 text-center">{formatNumber(row.total, 0)}</td>
                                <td className="border border-slate-400 p-1 text-center">{formatNumber(row.percentage, 1)}%</td>
                                <td className={`border border-slate-400 p-1 text-center font-bold ${gradeClass(row.grade)}`}>{row.grade}</td>
                                <td className="border border-slate-400 p-1 text-center font-bold">{getGradePoint(row.grade)}</td>
                                <td className="border border-slate-400 p-1 text-center font-bold">YES</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mb-4">
                <h3 className="font-extrabold text-sm mb-2">All Exam Subjects</h3>
                <table className="w-full border-collapse text-[8px] report-table">
                    <thead><tr>{["#","Subject","Mark","%","Grade","Point","Status"].map(h => <th key={h} className="border border-slate-400 p-1 text-center">{h}</th>)}</tr></thead>
                    <tbody>{allSubjects.map((row, index) => (
                        <tr key={row.exam_subject_id || index}>
                            <td className="border border-slate-400 p-1 text-center">{index + 1}</td>
                            <td className="border border-slate-400 p-1 font-bold">{row.subject_name || "Subject"}</td>
                            <td className="border border-slate-400 p-1 text-center">{formatNumber(row.total, 0)}</td>
                            <td className="border border-slate-400 p-1 text-center">{formatNumber(row.percentage, 1)}%</td>
                            <td className={`border border-slate-400 p-1 text-center font-bold ${gradeClass(row.grade)}`}>{row.grade}</td>
                            <td className="border border-slate-400 p-1 text-center">{getGradePoint(row.grade)}</td>
                            <td className="border border-slate-400 p-1 text-center">{bestSeven.some(best => idValue(best.exam_subject_id) === idValue(row.exam_subject_id)) ? "Best 7" : (row.report_status || "Reported")}</td>
                        </tr>
                    ))}</tbody>
                </table>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="border border-slate-400 rounded-lg p-3 min-h-[80px]"><h3 className="font-extrabold text-xs mb-1">Tabia kwa Ujumla</h3><p className="text-[10px] whitespace-pre-wrap">{report.generalConduct || "____________________________________________"}</p></div>
                <div className="border border-slate-400 rounded-lg p-3 min-h-[80px]"><h3 className="font-extrabold text-xs mb-1">Bidii za Kazi za Mikono</h3><p className="text-[10px] whitespace-pre-wrap">{report.manualWorkEffort || "____________________________________________"}</p></div>
            </div>
            <RecommendationBox recommendations={report.recommendations} />
            <div className="mt-7 grid grid-cols-3 gap-8 text-[9px]"><div className="border-t border-slate-500 pt-2">Class Teacher</div><div className="border-t border-slate-500 pt-2">Academic Officer</div><div className="border-t border-slate-500 pt-2">Headmaster</div></div>
        </div>
    );
}

function SubjectReportPrint({ exam, report }) {
    return (
        <div className="p-8 text-slate-900">
            <ReportHeader exam={exam} title="Subject Analysis Report" subtitle={`${report.subject_name} Â· ${report.class_name}`} />
            <div className="grid grid-cols-4 gap-3 text-sm mb-5">
                <DetailBox label="Candidates" value={report.candidates} />
                <DetailBox label="Analysed" value={report.analysed} />
                <DetailBox label="Average" value={`${formatNumber(report.average, 1)}%`} />
                <DetailBox label="Pass Rate" value={`${formatNumber(report.pass_rate, 1)}%`} />
                <DetailBox label="Highest" value={`${formatNumber(report.highest, 1)}%`} />
                <DetailBox label="Lowest" value={`${formatNumber(report.lowest, 1)}%`} />
                <DetailBox label="Complete" value={report.complete} />
                <DetailBox label="Partial / Missing" value={`${report.partial} / ${report.missing}`} />
            </div>
            <h3 className="font-extrabold text-sm mb-2">Candidate Performance</h3>
            <table className="w-full border-collapse text-xs">
                <thead><tr>{['#','Student','Admission','Mark','%','Grade','Status'].map(h => <th key={h} className="border border-slate-400 p-2 text-left">{h}</th>)}</tr></thead>
                <tbody>
                    {(report.students || []).map((row, index) => (
                        <tr key={row.student.id}>
                            <td className="border border-slate-400 p-2">{index + 1}</td>
                            <td className="border border-slate-400 p-2 font-bold">{safeName(row.student)}</td>
                            <td className="border border-slate-400 p-2">{getAdmission(row.student)}</td>
                            <td className="border border-slate-400 p-2">{formatNumber(row.result.total)} / {formatNumber(row.result.possible)}</td>
                            <td className="border border-slate-400 p-2">{formatNumber(row.result.percentage, 1)}%</td>
                            <td className="border border-slate-400 p-2">{getGrade(row.result.percentage)}</td>
                            <td className="border border-slate-400 p-2">{row.result.status}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <RecommendationBox recommendations={report.recommendations} />
        </div>
    );
}

function DivisionSummary({ distribution = [], title = "Division Summary" }) {
    const order = ["I", "II", "III", "IV", "0"];
    return (
        <div className="border border-slate-300 rounded-xl p-3 mb-4">
            <div className="font-extrabold text-sm mb-2">{title}</div>
            <div className="grid grid-cols-5 gap-2">
                {order.map(div => {
                    const row = distribution.find(item => item.division === div);
                    const count = row?.count || 0;
                    return <div key={div} className="border border-slate-300 rounded-lg p-2 text-center bg-white">
                        <div className="text-[9px] uppercase font-bold text-slate-500">{div === "0" ? "Division 0" : `Division ${div}`}</div>
                        <div className="text-xl font-black text-slate-900">{count}</div>
                        <div className="text-[8px] text-slate-500">students</div>
                    </div>;
                })}
            </div>
        </div>
    );
}

function SubjectSummaryTable({ subjects = [] }) {
    return (
        <div className="mb-5">
            <h3 className="font-extrabold text-sm mb-2">Subject Performance Summary</h3>
            <table className="w-full border-collapse text-[9px] report-table">
                <thead><tr>{["Subject","A","B","C","D","F","GPA"].map(h => <th key={h} className="border border-slate-400 p-1 text-center">{h}</th>)}</tr></thead>
                <tbody>{subjects.map(row => {
                    const gc = row.gradeCounts || {};
                    const gpa = row.gpa != null ? formatNumber(row.gpa,2) : "â€”";
                    const gpaTone = numberValue(row.gpa) <= 2 ? "bg-emerald-100 text-emerald-900" : numberValue(row.gpa) <= 3 ? "bg-yellow-100 text-yellow-900" : numberValue(row.gpa) <= 4 ? "bg-orange-100 text-orange-900" : "bg-red-100 text-red-900";
                    return <tr key={row.exam_subject_id}>
                        <td className="border border-slate-400 p-1 font-bold text-left">{row.subject_name}{row.class_name ? <span className="font-normal text-slate-500"> Â· {row.class_name}</span> : null}</td>
                        {["A","B","C","D","F"].map(g => <td key={g} className={`border border-slate-400 p-1 text-center font-bold ${gradeClass(g)}`}>{gc[g] || 0}</td>)}
                        <td className={`border border-slate-400 p-1 text-center font-black ${gpaTone}`}>{gpa}</td>
                    </tr>;
                })}</tbody>
            </table>
            <div className="mt-2 text-[8px] text-slate-600">GPA points: A=1, B=2, C=3, D=4, F=5. A higher subject GPA indicates weaker performance.</div>
        </div>
    );
}

function StudentSubjectMatrix({ students = [], subjects = [] }) {
    return (
        <div className="mb-5 overflow-x-auto report-matrix-wrap">
            <h3 className="font-extrabold text-sm mb-2">Student Results by Subject</h3>
            <table className="w-full border-collapse report-matrix">
                <thead><tr>
                    <th className="border border-slate-400 p-1 text-left student-name-col"># Student</th>
                    {subjects.map(s => <th key={s.exam_subject_id} className="border border-slate-400 p-1 subject-head">{s.subject_name}</th>)}
                    <th className="border border-slate-400 p-1">GPA</th><th className="border border-slate-400 p-1">Division</th>
                </tr></thead>
                <tbody>{students.map((student,index) => <tr key={student.id}>
                    <td className="border border-slate-400 p-1 font-bold student-name-col">{index+1}. {student.full_name}<div className="text-[7px] font-normal text-slate-500">{student.admission || ""}</div></td>
                    {subjects.map(subject => {
                        const result = (student.subjects || []).find(r => idValue(r.exam_subject_id) === idValue(subject.exam_subject_id));
                        const grade = result ? getGrade(result.percentage) : "F";
                        const mark = result ? numberValue(result.total) : 0;
                        return <td key={subject.exam_subject_id} className={`border border-slate-400 p-1 text-center font-bold ${gradeClass(grade)}`}>{formatNumber(mark,0)} {grade}</td>;
                    })}
                    <td className="border border-slate-400 p-1 text-center font-bold">{student.cseeGpa != null ? formatNumber(student.cseeGpa,2) : "â€”"}</td>
                    <td className="border border-slate-400 p-1 text-center font-bold">{student.cseeDivision ? `Div ${student.cseeDivision}` : "â€”"}</td>
                </tr>)}</tbody>
            </table>
        </div>
    );
}

function SchoolOverallReportPrint({ exam, data }) {
    const students = data.allStudents || data.topStudents || [];
    const finalRows = students.map(student => ({ ...student, finalResult: calculateResult(student.subjects || []) }));
    const finalEligible = finalRows.filter(row => row.finalResult.eligible && row.finalResult.gpa != null);
    const schoolGpa = finalEligible.length ? finalEligible.reduce((sum, row) => sum + numberValue(row.finalResult.gpa), 0) / finalEligible.length : null;
    const schoolDivisions = ["I", "II", "III", "IV", "0"].map(division => ({ division, count: finalRows.filter(row => row.finalResult.division === division).length }));
    const schoolGrades = ["A", "B", "C", "D", "F"].map(grade => ({ grade, count: finalRows.filter(row => { const bs = row.finalResult.bestSeven || []; const avg = bs.length ? (bs.reduce((sum, item) => sum + numberValue(item.total), 0) / 700) * 100 : 0; return getGrade(avg) === grade; }).length }));
    const classRows = data.classRows || [];
    return (
        <div className="p-6 text-slate-900 report-page">
            <ReportHeader exam={exam} title="School Overall Examination Report" subtitle="Whole School Performance Â· Best Seven Classification" />

            <div className="grid grid-cols-5 gap-2 text-[9px] mb-4">
                <DetailBox label="Candidates" value={data.candidates || 0} />
                <DetailBox label="School Average" value={`${formatNumber(data.average,1)}%`} />
                <DetailBox label="School GPA" value={schoolGpa != null ? formatNumber(schoolGpa,2) : "â€”"} />
                <DetailBox label="Pass Rate" value={`${formatNumber(data.passRate,1)}%`} />
                <DetailBox label="Subjects" value={(data.subjectRows || []).length} />
            </div>

            <DivisionSummary distribution={schoolDivisions} title="School Division Distribution" />

            <div className="mb-5">
                <h3 className="font-extrabold text-sm mb-2">School Grade Distribution</h3>
                <div className="grid grid-cols-5 gap-2">
                    {schoolGrades.map(row => <div key={row.grade} className={`border rounded-lg p-2 text-center ${gradeClass(row.grade)}`}><div className="text-[9px] font-bold">Grade {row.grade}</div><div className="text-lg font-black">{row.count || 0}</div><div className="text-[8px]">students</div></div>)}
                </div>
            </div>

            <div className="mb-5">
                <h3 className="font-extrabold text-sm mb-2">Class Performance & Division Distribution</h3>
                <table className="w-full border-collapse text-[8px] report-table">
                    <thead><tr>{["Class","Students","Average","GPA","Div I","Div II","Div III","Div IV","Div 0","Pass Rate"].map(h => <th key={h} className="border border-slate-400 p-1 text-center">{h}</th>)}</tr></thead>
                    <tbody>{classRows.map(row => <tr key={row.class_id}>
                        <td className="border border-slate-400 p-1 font-bold">{row.class_name}</td><td className="border border-slate-400 p-1 text-center">{row.students}</td><td className="border border-slate-400 p-1 text-center">{formatNumber(row.average,1)}%</td><td className="border border-slate-400 p-1 text-center font-bold">{row.gpa != null ? formatNumber(row.gpa,2) : "â€”"}</td>
                        {['I','II','III','IV','0'].map(d => <td key={d} className="border border-slate-400 p-1 text-center font-bold">{row.divisions?.[d] || 0}</td>)}
                        <td className="border border-slate-400 p-1 text-center">{formatNumber(row.passRate,1)}%</td>
                    </tr>)}</tbody>
                </table>
            </div>

            <SubjectSummaryTable subjects={data.subjectRows || []} />

            <div className="mb-4">
                <h3 className="font-extrabold text-sm mb-2">Students â€” Final GPA & Division</h3>
                <table className="w-full border-collapse text-[8px] report-table">
                    <thead><tr>{["Pos.","Student","Admission","Class","Best 7 Total","Average","Grade","Aggregate","GPA","Division"].map(h => <th key={h} className="border border-slate-400 p-1 text-center">{h}</th>)}</tr></thead>
                    <tbody>{finalRows.map(student => <tr key={student.id}>
                        <td className="border border-slate-400 p-1 text-center">{student.position || "â€”"}</td><td className="border border-slate-400 p-1 font-bold">{student.full_name}</td><td className="border border-slate-400 p-1">{student.admission}</td><td className="border border-slate-400 p-1">{student.class_name}</td>
                        <td className="border border-slate-400 p-1 text-center">{formatNumber((student.cseeBestSeven || []).reduce((sum,row) => sum + numberValue(row.total),0),0)}</td><td className="border border-slate-400 p-1 text-center">{student.cseeBestSeven?.length ? `${formatNumber(((student.cseeBestSeven.reduce((sum,row)=>sum+numberValue(row.total),0) / 700) * 100),1)}%` : "â€”"}</td><td className="border border-slate-400 p-1 text-center font-bold">{(() => { const bs = student.finalResult.bestSeven || []; const total = bs.reduce((sum,row)=>sum+numberValue(row.total),0); const avg = bs.length ? (total / 700) * 100 : 0; return bs.length ? getGrade(avg) : "â€”"; })()}</td><td className="border border-slate-400 p-1 text-center">{student.finalResult.aggregate ?? "â€”"}</td><td className="border border-slate-400 p-1 text-center font-bold">{student.finalResult.gpa != null ? formatNumber(student.finalResult.gpa,2) : "â€”"}</td><td className="border border-slate-400 p-1 text-center font-bold">{student.finalResult.division ? `Division ${student.finalResult.division}` : "â€”"}</td>
                    </tr>)}</tbody>
                </table>
            </div>
            <div className="mt-4 text-[8px] text-slate-600">Final GPA, Aggregate and Division are calculated from the Best Seven subjects. Subjects without marks remain F and may occupy a Best Seven position when required.</div>
            <div className="mt-7 grid grid-cols-3 gap-8 text-[9px]"><div className="border-t border-slate-500 pt-2">Prepared By</div><div className="border-t border-slate-500 pt-2">Academic Officer</div><div className="border-t border-slate-500 pt-2">Headmaster</div></div>
        </div>
    );
}

function ClassOverallReportPrint({ exam, data }) {
    const students = data.students || data.topStudents || [];
    const finalRows = students.map(student => ({ ...student, finalResult: calculateResult(student.subjects || []) }));
    const classGpa = (() => { const eligible = finalRows.filter(row => row.finalResult.eligible && row.finalResult.gpa != null); return eligible.length ? eligible.reduce((sum,row)=>sum+numberValue(row.finalResult.gpa),0)/eligible.length : null; })();
    const classDivisions = ["I","II","III","IV","0"].map(division => ({ division, count: finalRows.filter(row => row.finalResult.division === division).length }));
    const classGrades = ["A","B","C","D","F"].map(grade => ({ grade, count: finalRows.filter(row => { const bs=row.finalResult.bestSeven||[]; const avg=bs.length?(bs.reduce((sum,item)=>sum+numberValue(item.total),0)/700)*100:0; return getGrade(avg)===grade; }).length }));
    return (
        <div className="p-6 text-slate-900 report-page">
            <ReportHeader exam={exam} title="Class Overall Examination Report" subtitle={`${data.className || "Class"} Â· Best Seven Classification`} />
            <div className="grid grid-cols-5 gap-2 text-[9px] mb-4">
                <DetailBox label="Students" value={data.studentCount || 0} /><DetailBox label="Class Average" value={`${formatNumber(data.average,1)}%`} /><DetailBox label="Class GPA" value={classGpa != null ? formatNumber(classGpa,2) : "â€”"} /><DetailBox label="Pass Rate" value={`${formatNumber(data.passRate,1)}%`} /><DetailBox label="Subjects" value={data.subjectCount || 0} />
            </div>
            <DivisionSummary distribution={classDivisions} title="Class Division Distribution" />
            <div className="mb-5">
                <h3 className="font-extrabold text-sm mb-2">Class Grade Distribution</h3>
                <div className="grid grid-cols-5 gap-2">{classGrades.map(row => <div key={row.grade} className={`border rounded-lg p-2 text-center ${gradeClass(row.grade)}`}><div className="text-[9px] font-bold">Grade {row.grade}</div><div className="text-lg font-black">{row.count || 0}</div><div className="text-[8px]">students</div></div>)}</div>
            </div>
            <SubjectSummaryTable subjects={data.subjects || []} />
            <div className="mb-4">
                <h3 className="font-extrabold text-sm mb-2">Student Final Results â€” GPA & Division</h3>
                <table className="w-full border-collapse text-[8px] report-table">
                    <thead><tr>{["Pos.","Student","Admission","Best 7 Total","Average","Grade","Aggregate","GPA","Division","Status"].map(h => <th key={h} className="border border-slate-400 p-1 text-center">{h}</th>)}</tr></thead>
                    <tbody>{finalRows.map(student => <tr key={student.id}>
                        <td className="border border-slate-400 p-1 text-center">{student.position || "â€”"}</td><td className="border border-slate-400 p-1 font-bold">{student.full_name}</td><td className="border border-slate-400 p-1">{student.admission}</td><td className="border border-slate-400 p-1 text-center">{formatNumber((student.cseeBestSeven || []).reduce((sum,row)=>sum+numberValue(row.total),0),0)}</td><td className="border border-slate-400 p-1 text-center">{student.cseeBestSeven?.length ? `${formatNumber(student.cseeBestSeven.reduce((sum,row)=>sum+numberValue(row.percentage),0)/student.cseeBestSeven.length,1)}%` : "â€”"}</td><td className="border border-slate-400 p-1 text-center font-bold">{(() => { const bs=student.finalResult.bestSeven||[]; const avg=bs.length?(bs.reduce((sum,row)=>sum+numberValue(row.total),0)/700)*100:0; return bs.length ? getGrade(avg) : "â€”"; })()}</td><td className="border border-slate-400 p-1 text-center">{student.finalResult.aggregate ?? "â€”"}</td><td className="border border-slate-400 p-1 text-center font-bold">{student.finalResult.gpa != null ? formatNumber(student.finalResult.gpa,2) : "â€”"}</td><td className="border border-slate-400 p-1 text-center font-bold">{student.finalResult.division ? `Division ${student.finalResult.division}` : "â€”"}</td><td className="border border-slate-400 p-1 text-center">{student.pass ? "Passed" : "Failed"}</td>
                    </tr>)}</tbody>
                </table>
            </div>
            <div className="mt-4 text-[8px] text-slate-600">Final GPA, Aggregate and Division use the Best Seven subjects. Missing marks are treated as F when a subject is required to complete the seven counted subjects.</div>
            <div className="mt-7 grid grid-cols-3 gap-8 text-[9px]"><div className="border-t border-slate-500 pt-2">Prepared By</div><div className="border-t border-slate-500 pt-2">Academic Officer</div><div className="border-t border-slate-500 pt-2">Headmaster</div></div>
        </div>
    );
}

function OverallReportPrint({ exam, data }) {
    const students = data.students || [];
    const subjects = data.subjects || [];
    return (
        <div className="p-8 text-slate-900">
            <ReportHeader exam={exam} title="Overall Examination Results" subtitle="All examination subjects" />
            <div className="mb-5 text-sm"><strong>Subjects:</strong> {subjects.map(s => s.subject_name).join(", ") || "â€”"} Â· <strong>Candidates:</strong> {students.length}</div>
            <table className="w-full border-collapse text-[10px]">
                <thead><tr>
                    <th className="border border-slate-400 p-1">Pos.</th><th className="border border-slate-400 p-1 text-left">Student</th><th className="border border-slate-400 p-1">Admission</th>
                    {subjects.map(s => <th key={s.exam_subject_id} className="border border-slate-400 p-1">{s.subject_name}</th>)}
                    <th className="border border-slate-400 p-1">Total</th><th className="border border-slate-400 p-1">%</th><th className="border border-slate-400 p-1">Grade</th><th className="border border-slate-400 p-1">GPA</th><th className="border border-slate-400 p-1">Division</th>
                </tr></thead>
                <tbody>
                    {students.map(student => (
                        <tr key={student.id}>
                            <td className="border border-slate-400 p-1 text-center">{student.position || "â€”"}</td>
                            <td className="border border-slate-400 p-1 font-bold">{student.full_name}</td>
                            <td className="border border-slate-400 p-1">{student.admission}</td>
                            {subjects.map(subject => {
                                const result = (student.subjects || []).find(r => idValue(r.exam_subject_id) === idValue(subject.exam_subject_id));
                                return <td key={subject.exam_subject_id} className="border border-slate-400 p-1 text-center">{result ? `${formatNumber(result.total)} (${formatNumber(result.percentage, 0)}%)` : "â€”"}</td>;
                            })}
                            <td className="border border-slate-400 p-1 text-center font-bold">{formatNumber(student.total)}</td>
                            <td className="border border-slate-400 p-1 text-center font-bold">{formatNumber(student.percentage, 1)}%</td>
                            <td className="border border-slate-400 p-1 text-center font-bold">{student.grade}</td>
                            <td className="border border-slate-400 p-1 text-center font-bold">{student.cseeGpa != null ? formatNumber(student.cseeGpa, 2) : "â€”"}</td>
                            <td className="border border-slate-400 p-1 text-center font-bold">{student.cseeDivision ? `Division ${student.cseeDivision}` : "â€”"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="mt-5 grid grid-cols-4 gap-3 text-xs">
                {subjects.map(subject => <DetailBox key={subject.exam_subject_id} label={subject.subject_name} value={`${formatNumber(subject.average, 1)}% avg Â· ${formatNumber(subject.pass_rate, 1)}% pass`} />)}
            </div>
            <div className="mt-8 grid grid-cols-3 gap-10 text-xs"><div className="border-t border-slate-500 pt-2">Prepared By</div><div className="border-t border-slate-500 pt-2">Academic Officer</div><div className="border-t border-slate-500 pt-2">Headmaster</div></div>
        </div>
    );
}

// ============================================================
// EMPTY STATE
// ============================================================

function EmptyState({ text }) {
    return (
        <div className="py-12 text-center text-sm text-slate-500">
            <FaFileAlt className="mx-auto text-2xl text-slate-300 mb-3" />
            {text}
        </div>
    );
}


// ============================================================
// TRACE MODAL
// ============================================================

function TraceModal({
    detail,
    close,
    marksByQuestion,
    studentMap,
    examSubjects,
    questions,
    calculateStudentSubject,
    subjectMap,
    getStudentMarks,
    openQuestionDetail,
    printStudentReport,
    shareStudentResult,
    sendingChannel,
    printSubjectReport,
    studentReportFields,
    updateStudentReportFields,
    communicationStatus
}) {
    const data = detail.data;

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/50 p-3 md:p-6 flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
                    <div>
                        <div className="text-[10px] uppercase tracking-wider text-blue-600 font-extrabold">Traceable Result Detail</div>
                        <h2 className="text-lg md:text-xl font-extrabold text-slate-900 mt-1">
                            {detail.type === "student" && data.full_name}
                            {detail.type === "subject" && data.subject_name}
                            {detail.type === "question" && `${data.label} Â· ${data.topic}`}
                            {detail.type === "topic" && `${data.topic} Â· ${data.subject_name}`}
                        </h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {detail.type === "student" && (
                            <>
                                <button disabled={sendingChannel !== ""} onClick={() => shareStudentResult(data, "email")} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" title={data.parent_email ? `Email: ${data.parent_email}` : "Parent email haijawekwa"}>
                                    <FaEnvelope /> {sendingChannel === "email" ? "Sending..." : "Email"}
                                </button>
                                <button disabled={sendingChannel !== ""} onClick={() => shareStudentResult(data, "sms")} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" title={data.parent_phone ? `SMS: ${data.parent_phone}` : "Parent phone haijawekwa"}>
                                    <FaSms /> {sendingChannel === "sms" ? "Sending..." : "SMS"}
                                </button>
                                <button disabled={sendingChannel !== ""} onClick={() => shareStudentResult(data, "whatsapp")} className="px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-bold inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" title={data.parent_phone ? `WhatsApp: ${data.parent_phone}` : "Parent phone haijawekwa"}>
                                    <FaWhatsapp /> {sendingChannel === "whatsapp" ? "Sending..." : "WhatsApp"}
                                </button>
                                <button onClick={() => printStudentReport(data)} className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold inline-flex items-center gap-2">
                                    <FaPrint /> Print Report
                                </button>
                                {communicationStatus?.[idValue(data.id)] && (
                                    <span className={`px-2.5 py-2 rounded-lg border text-[10px] font-extrabold ${
                                        communicationStatus[idValue(data.id)].status === "failed"
                                            ? "bg-red-50 text-red-700 border-red-200"
                                            : communicationStatus[idValue(data.id)].environment === "test"
                                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    }`} title={communicationStatus[idValue(data.id)].provider_message_id || ""}>
                                        SMS: {communicationStatus[idValue(data.id)].status === "failed"
                                            ? "FAILED"
                                            : communicationStatus[idValue(data.id)].environment === "test"
                                                ? "SANDBOX"
                                                : (communicationStatus[idValue(data.id)].status || "accepted")}
                                    </span>
                                )}
                            </>
                        )}
                        {detail.type === "subject" && (
                            <button onClick={() => printSubjectReport(data)} className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold inline-flex items-center gap-2">
                                <FaPrint /> Print Report
                            </button>
                        )}
                        <button
                            onClick={close}
                            className="w-9 h-9 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-500"
                        >
                            <FaTimes />
                        </button>
                    </div>
                </div>

                <div className="overflow-y-auto p-5">
                    {detail.type === "student" && (
                        <StudentTrace
                            student={data}
                            examSubjects={examSubjects}
                            calculateStudentSubject={calculateStudentSubject}
                            subjectMap={subjectMap}
                            getStudentMarks={getStudentMarks}
                            questions={questions}
                            openQuestionDetail={openQuestionDetail}
                            reportFields={studentReportFields[idValue(data.id)] || {}}
                            updateReportField={updateStudentReportFields}
                            communicationStatus={communicationStatus?.[idValue(data.id)] || null}
                        />
                    )}

                    {detail.type === "subject" && (
                        <SubjectTrace
                            subject={data}
                            examSubjects={examSubjects}
                            questions={questions}
                            marksByQuestion={marksByQuestion}
                            studentMap={studentMap}
                        />
                    )}

                    {detail.type === "question" && (
                        <QuestionTrace
                            question={data}
                            marks={detail.marks || []}
                        />
                    )}

                    {detail.type === "topic" && (
                        <TopicTrace
                            topic={data}
                            openQuestionDetail={openQuestionDetail}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}


// ============================================================
// STUDENT TRACE
// ============================================================

function StudentTrace({
    student,
    examSubjects,
    calculateStudentSubject,
    subjectMap,
    getStudentMarks,
    questions,
    openQuestionDetail,
    reportFields,
    updateReportField,
    communicationStatus
}) {
    const results = examSubjects
        .filter(es => idValue(es.class_id) === idValue(student.class_id))
        .map(es => calculateStudentSubject(student.id, es));

    return (
        <div className="space-y-5">
            {communicationStatus && (
                <div className={`rounded-xl border p-4 ${
                    communicationStatus.environment === "test"
                        ? "bg-amber-50 border-amber-200"
                        : "bg-emerald-50 border-emerald-200"
                }`}>
                    <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                            communicationStatus.environment === "test"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-emerald-100 text-emerald-700"
                        }`}>
                            <FaSms />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-extrabold text-slate-800">Latest SMS Communication</h3>
                                <span className="text-[10px] font-extrabold px-2 py-1 rounded-full border border-slate-200 bg-white text-slate-600">
                                    {communicationStatus.environment === "test" ? "SANDBOX" : "LIVE"}
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 text-xs">
                                <div><div className="text-slate-500">Provider</div><div className="font-bold text-slate-800">{communicationStatus.provider || "eSMS Africa"}</div></div>
                                <div><div className="text-slate-500">Status</div><div className="font-bold text-slate-800">{communicationStatus.status || "accepted"}</div></div>
                                <div><div className="text-slate-500">Provider ID</div><div className="font-bold text-slate-800 break-all">{communicationStatus.provider_message_id || "â€”"}</div></div>
                            </div>
                            {communicationStatus.sent_at && (
                                <div className="text-[11px] text-slate-500 mt-3">
                                    Last request: {new Date(communicationStatus.sent_at).toLocaleString()}
                                </div>
                            )}
                            {communicationStatus.environment === "test" && (
                                <div className="text-[11px] text-amber-700 mt-2 font-medium">
                                    Sandbox response only â€” ujumbe huu ni wa test na haujafika kwenye mtandao halisi.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <DetailBox label="Admission" value={student.admission} />
                <DetailBox label="Class" value={student.class_name} />
                <DetailBox label="Jumla ya Marks" value={formatNumber(student.total)} />
                <DetailBox label="Percentage" value={`${formatNumber(student.percentage, 1)}%`} />
                <DetailBox label="Grade" value={student.grade} />
                <DetailBox label="Aggregate" value={student.cseeAggregate ?? "â€”"} />
                <DetailBox label="GPA" value={student.cseeGpa != null ? formatNumber(student.cseeGpa, 2) : "â€”"} />
                <DetailBox label="Division" value={student.cseeDivision ? `Division ${student.cseeDivision}` : "â€”"} />
                <DetailBox label="Status" value={student.percentage >= 40 ? "Passed" : "Failed"} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-xl p-4">
                    <label className="block text-sm font-extrabold text-slate-800 mb-2">Tabia kwa Ujumla</label>
                    <textarea
                        value={reportFields?.generalConduct || ""}
                        onChange={event => updateReportField(student.id, "generalConduct", event.target.value)}
                        rows={4}
                        placeholder="Andika tathmini ya tabia ya mwanafunzi kwa ujumla..."
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div className="border border-slate-200 rounded-xl p-4">
                    <label className="block text-sm font-extrabold text-slate-800 mb-2">Bidii za Kazi za Mikono</label>
                    <textarea
                        value={reportFields?.manualWorkEffort || ""}
                        onChange={event => updateReportField(student.id, "manualWorkEffort", event.target.value)}
                        rows={4}
                        placeholder="Andika tathmini ya bidii za kazi za mikono..."
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-bold text-sm">
                    Subject â†’ Questions â†’ Marks
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                                <th className="px-3 py-3">Subject</th>
                                <th className="px-3 py-3">Mark</th>
                                <th className="px-3 py-3">%</th>
                                <th className="px-3 py-3">Grade</th>
                                <th className="px-3 py-3">Questions</th>
                                <th className="px-3 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map(result => (
                                <tr key={result.exam_subject_id} className="border-b last:border-0 border-slate-100">
                                    <td className="px-3 py-3 font-bold text-slate-800">
                                        {getSubjectName(subjectMap.get(idValue(result.subject_id)))}
                                    </td>
                                    <td className="px-3 py-3 font-semibold">
                                        {formatNumber(result.total)}
                                    </td>
                                    <td className="px-3 py-3">{formatNumber(result.percentage, 1)}%</td>
                                    <td className="px-3 py-3">
                                        <span className={`px-2 py-1 rounded-full border text-xs font-bold ${gradeClass(getGrade(result.percentage))}`}>
                                            {getGrade(result.percentage)}
                                        </span>
                                    </td>
                                    <td className="px-3 py-3">{result.marked_questions}/{result.questions}</td>
                                    <td className="px-3 py-3 font-bold">{result.pass ? "Passed" : "Failed"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-4">
                <h3 className="font-extrabold text-sm mb-2">Mapendekezo</h3>
                <ul className="list-disc pl-5 text-sm space-y-1">
                    {student.percentage >= 75 && <li>Endelea na nidhamu nzuri ya kujisomea na uimarishe zaidi masomo yenye ufaulu wa juu.</li>}
                    {student.percentage >= 60 && student.percentage < 75 && <li>Ongeza muda wa marudio katika masomo yenye ufaulu wa chini ili kuboresha wastani wa jumla.</li>}
                    {student.percentage >= 50 && student.percentage < 60 && <li>Tumia marudio maalum na mazoezi ya ziada katika masomo yenye changamoto.</li>}
                    {student.percentage < 50 && <li>Mwanafunzi anahitaji mpango maalum wa kuboresha ufaulu pamoja na ufuatiliaji wa karibu.</li>}
                </ul>
            </div>
        </div>
    );
}


// ============================================================
// SUBJECT TRACE
// ============================================================

function SubjectTrace({ subject, examSubjects, questions, marksByQuestion, studentMap }) {
    const examSubject = examSubjects.find(
        row => idValue(row.id) === idValue(subject.exam_subject_id)
    );

    const subjectQuestions = questions.filter(
        question => idValue(question.subject_id) === idValue(subject.subject_id)
    );

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <DetailBox label="Class" value={subject.class_name} />
                <DetailBox label="Candidates" value={subject.candidates} />
                <DetailBox label="Analysed" value={subject.analysed} />
                <DetailBox label="Average" value={`${formatNumber(subject.average, 1)}%`} />
                <DetailBox label="Pass Rate" value={`${formatNumber(subject.pass_rate, 1)}%`} />
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-bold text-sm">
                    Question-level trace
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                                <th className="px-3 py-3">Question</th>
                                <th className="px-3 py-3">Topic</th>
                                <th className="px-3 py-3">Max</th>
                                <th className="px-3 py-3">Marks Recorded</th>
                                <th className="px-3 py-3">Average %</th>
                            </tr>
                        </thead>
                        <tbody>
                            {subjectQuestions.map(question => {
                                const rows = marksByQuestion.get(idValue(question.id)) || [];
                                const filteredRows = rows.filter(row =>
                                    !examSubject || idValue(row.exam_subject_id) === idValue(examSubject.id)
                                );
                                const avg = filteredRows.length
                                    ? filteredRows.reduce((sum, row) => sum + numberValue(row.marks_obtained), 0) / filteredRows.length
                                    : 0;

                                return (
                                    <tr key={question.id} className="border-b last:border-0 border-slate-100">
                                        <td className="px-3 py-3 font-bold">{getQuestionLabel(question)}</td>
                                        <td className="px-3 py-3">{question.topic || "Unclassified"}</td>
                                        <td className="px-3 py-3">{formatNumber(question.max_marks)}</td>
                                        <td className="px-3 py-3">{filteredRows.length}</td>
                                        <td className="px-3 py-3">{formatNumber(pct(avg, question.max_marks), 1)}%</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-4">
                <h3 className="font-extrabold text-sm mb-2">Recommendations</h3>
                <ul className="list-disc pl-5 text-sm space-y-1">
                    {subject.average >= 75 && <li>Maintain the current teaching and revision strategy while extending high achievers.</li>}
                    {subject.average >= 60 && subject.average < 75 && <li>Target weaker topics and questions to improve consistency.</li>}
                    {subject.average >= 50 && subject.average < 60 && <li>Increase targeted remediation and practice in difficult topics.</li>}
                    {subject.average < 50 && <li>Urgent academic intervention and topic-by-topic remediation are recommended.</li>}
                    {subject.missing > 0 && <li>{subject.missing} candidate(s) have no marks recorded and should be verified.</li>}
                    {subject.partial > 0 && <li>{subject.partial} candidate(s) have incomplete marks and should be reviewed.</li>}
                </ul>
            </div>
        </div>
    );
}


// ============================================================
// QUESTION TRACE
// ============================================================

function QuestionTrace({ question, marks }) {
    const average = marks.length
        ? marks.reduce((sum, mark) => sum + numberValue(mark.marks_obtained), 0) / marks.length
        : 0;

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <DetailBox label="Question" value={question.label} />
                <DetailBox label="Topic" value={question.topic} />
                <DetailBox label="Max Marks" value={question.max_marks} />
                <DetailBox label="Average" value={formatNumber(average)} />
                <DetailBox label="Performance" value={`${formatNumber(pct(average, question.max_marks), 1)}%`} />
                <DetailBox label="Attempts" value={marks.length} />
            </div>

            {question.question_text && (
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                    <div className="text-xs uppercase tracking-wide font-bold text-slate-500 mb-2">Question Text</div>
                    <div className="text-sm text-slate-700 leading-6 whitespace-pre-wrap">{question.question_text}</div>
                </div>
            )}

            <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-bold text-sm">
                    Student marks for {question.label}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                                <th className="px-3 py-3">Student</th>
                                <th className="px-3 py-3">Admission</th>
                                <th className="px-3 py-3">Mark</th>
                                <th className="px-3 py-3">%</th>
                            </tr>
                        </thead>
                        <tbody>
                            {marks.map(mark => (
                                <tr key={mark.id} className="border-b last:border-0 border-slate-100">
                                    <td className="px-3 py-3 font-semibold">{safeName(mark.student)}</td>
                                    <td className="px-3 py-3 text-slate-500">{getAdmission(mark.student)}</td>
                                    <td className="px-3 py-3 font-bold">{formatNumber(mark.marks_obtained)} / {formatNumber(question.max_marks)}</td>
                                    <td className="px-3 py-3">{formatNumber(mark.percentage, 1)}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}


// ============================================================
// TOPIC TRACE
// ============================================================

function TopicTrace({ topic, openQuestionDetail }) {
    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <DetailBox label="Subject" value={topic.subject_name} />
                <DetailBox label="Questions" value={topic.questions} />
                <DetailBox label="Performance" value={`${formatNumber(topic.average, 1)}%`} />
                <DetailBox label="Attempts" value={topic.attempts} />
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-bold text-sm">
                    Questions within this topic
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                                <th className="px-3 py-3">Question</th>
                                <th className="px-3 py-3">Max</th>
                                <th className="px-3 py-3">Average</th>
                                <th className="px-3 py-3">Performance</th>
                                <th className="px-3 py-3 text-right">Trace</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(topic.questionRows || []).map(question => (
                                <tr key={question.id} className="border-b last:border-0 border-slate-100">
                                    <td className="px-3 py-3 font-bold">{question.label}</td>
                                    <td className="px-3 py-3">{formatNumber(question.max_marks)}</td>
                                    <td className="px-3 py-3">{formatNumber(question.average)}</td>
                                    <td className="px-3 py-3">
                                        <span className={`px-2 py-1 rounded-full border text-xs font-bold ${performanceClass(question.performance)}`}>
                                            {formatNumber(question.performance, 1)}%
                                        </span>
                                    </td>
                                    <td className="px-3 py-3 text-right">
                                        <button
                                            onClick={() => openQuestionDetail(question)}
                                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-blue-700"
                                        >
                                            <FaEye className="inline mr-1" /> Trace
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}


// ============================================================
// DETAIL BOX
// ============================================================

function DetailBox({ label, value }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[10px] uppercase tracking-wide font-bold text-slate-500">{label}</div>
            <div className="text-sm font-extrabold text-slate-800 mt-1 break-words">{value ?? "â€”"}</div>
        </div>
    );
}

