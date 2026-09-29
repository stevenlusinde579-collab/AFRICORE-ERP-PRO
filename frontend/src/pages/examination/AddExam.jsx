import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
    FaArrowLeft,
    FaSave,
    FaSpinner,
    FaPlus,
    FaTrash,
    FaClock,
    FaLayerGroup,
    FaCheckCircle,
    FaGraduationCap,
    FaChevronUp,
    FaChevronDown
} from "react-icons/fa";

import { supabase } from "../../services/supabase";
import { useSchool } from "../../context/SchoolContext";

function AddExam() {
    const navigate = useNavigate();

    const {
        school,
        activeAcademicYearId,
        activeAcademicYearName,
        activeAcademicYearTerm,
        academicYearLoading
    } = useSchool();

    // DATA
    const [subjects, setSubjects] = useState([]);
    const [classes, setClasses] = useState([]);

    // LOADING
    const loadingYears = academicYearLoading;
    const [loadingSubjects, setLoadingSubjects] = useState(true);
    const [loadingClasses, setLoadingClasses] = useState(true);
    const [saving, setSaving] = useState(false);

    // MESSAGES
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // EXAM FORM
    const [form, setForm] = useState({
        academic_year_id: "",
        exam_name: "",
        exam_type: "",
        term: "",
        start_date: "",
        end_date: "",
        status: "DRAFT",
        total_marks: 100,
        duration_minutes: 120
    });

    // GRADING SETTINGS
    const [gradingScales, setGradingScales] = useState([
        {
            grade: "A",
            min_percentage: 75,
            max_percentage: 100,
            remark: "Excellent",
            result: "PASS"
        },
        {
            grade: "B",
            min_percentage: 65,
            max_percentage: 74,
            remark: "Very Good",
            result: "PASS"
        },
        {
            grade: "C",
            min_percentage: 45,
            max_percentage: 64,
            remark: "Good",
            result: "PASS"
        },
        {
            grade: "D",
            min_percentage: 30,
            max_percentage: 44,
            remark: "Satisfactory",
            result: "PASS"
        },
        {
            grade: "F",
            min_percentage: 0,
            max_percentage: 29,
            remark: "Fail",
            result: "FAIL"
        }
    ]);

    // CLASSIFICATION FORM
    const [classificationForm, setClassificationForm] = useState({
        class_id: "",
        subject_ids: [],
        full_marks: 100,
        pass_marks: 40,
        session: "MORNING",
        start_time: "08:00",
        end_time: "10:00"
    });

    const [classifications, setClassifications] = useState([]);

    // ============================================================
    // SYNC GLOBAL ACTIVE ACADEMIC YEAR
    // ============================================================

    useEffect(() => {
        if (activeAcademicYearId) {
            setForm(previous => ({
                ...previous,
                academic_year_id: String(activeAcademicYearId),
                term: previous.term || activeAcademicYearTerm || ""
            }));
        } else {
            setForm(previous => ({
                ...previous,
                academic_year_id: ""
            }));
        }
    }, [activeAcademicYearId, activeAcademicYearTerm]);

    // ============================================================
    // LOAD SUBJECTS
    // ============================================================

    useEffect(() => {
        loadSubjects();
    }, []);

    // ============================================================
    // LOAD CLASSES FOR ACTIVE SCHOOL + ACTIVE ACADEMIC YEAR
    // ============================================================

    useEffect(() => {
        if (!school?.id || !activeAcademicYearId) {
            setClasses([]);
            setLoadingClasses(false);
            return;
        }

        loadClasses();
    }, [school?.id, activeAcademicYearId]);

    // ============================================================
    // LOAD SUBJECTS
    // ============================================================

    const loadSubjects = async () => {
        try {
            setLoadingSubjects(true);

            const { data, error: fetchError } = await supabase
                .from("subjects")
                .select("*")
                .eq("is_active", true)
                .order("id", { ascending: true });

            if (fetchError) throw fetchError;

            setSubjects(data || []);
        } catch (err) {
            console.error("SUBJECTS ERROR:", err);
            setError(err?.message || "Failed to load subjects.");
        } finally {
            setLoadingSubjects(false);
        }
    };

    // ============================================================
    // LOAD CLASSES
    // ============================================================

    const loadClasses = async () => {
        try {
            setLoadingClasses(true);

            const schoolId = Number(school?.id);
            const academicYearId = Number(activeAcademicYearId);

            if (!schoolId) {
                throw new Error("School information is not available.");
            }

            if (!academicYearId) {
                throw new Error(
                    "No active academic year is configured for this school."
                );
            }

            const { data, error: fetchError } = await supabase
                .from("classes")
                .select("*")
                .eq("school_id", schoolId)
                .eq("academic_year_id", academicYearId)
                .order("id", { ascending: true });

            if (fetchError) throw fetchError;

            setClasses(data || []);
        } catch (err) {
            console.error("CLASSES ERROR:", err);
            setClasses([]);
            setError(err?.message || "Failed to load classes.");
        } finally {
            setLoadingClasses(false);
        }
    };

    // ============================================================
    // HELPERS
    // ============================================================

    const getSubjectName = (subject) => {
        if (!subject) return "Unknown Subject";

        return (
            subject.subject_name ||
            subject.name ||
            subject.subjectName ||
            subject.title ||
            `Subject ${subject.id}`
        );
    };

    const getClassName = (item) => {
        if (!item) return "Unknown Class";

        return (
            item.class_name ||
            item.name ||
            item.short_name ||
            item.className ||
            item.title ||
            `Class ${item.id}`
        );
    };

    const selectedClass = useMemo(() => {
        if (!classificationForm.class_id) return null;

        return (
            classes.find(
                item =>
                    String(item.id) ===
                    String(classificationForm.class_id)
            ) || null
        );
    }, [classes, classificationForm.class_id]);

    const getClassNumber = (classItem) => {
        if (!classItem) return null;

        const text = `${classItem.class_name || ""} ${
            classItem.short_name || ""
        }`
            .trim()
            .toUpperCase();

        const numericMatch = text.match(/FORM\s*[-_ ]?\s*(\d+)/);

        if (numericMatch) {
            return Number(numericMatch[1]);
        }

        const wordForms = {
            ONE: 1,
            TWO: 2,
            THREE: 3,
            FOUR: 4,
            FIVE: 5,
            SIX: 6
        };

        for (const word of Object.keys(wordForms)) {
            if (text.includes(`FORM ${word}`)) {
                return wordForms[word];
            }
        }

        return null;
    };

    const subjectBelongsToClass = (subject, classItem) => {
        if (!subject || !classItem) return false;

        if (subject.is_active === false) return false;

        const educationLevel = String(
            subject.education_level || ""
        )
            .trim()
            .toLowerCase();

        const classLevel = String(
            classItem.academic_level || ""
        )
            .trim()
            .toLowerCase();

        if (educationLevel !== classLevel) return false;

        if (
            !subject.class_scope ||
            String(subject.class_scope).trim() === ""
        ) {
            return true;
        }

        const scope = String(subject.class_scope)
            .trim()
            .toUpperCase();

        const classNumber = getClassNumber(classItem);

        const rangeMatch = scope.match(
            /FORM\s*(\d+)\s*[-–—]\s*(\d+)/
        );

        if (rangeMatch) {
            const start = Number(rangeMatch[1]);
            const end = Number(rangeMatch[2]);

            if (classNumber === null) return false;

            return (
                classNumber >= start &&
                classNumber <= end
            );
        }

        if (scope.includes("I-IV")) {
            if (classNumber === null) return false;

            return (
                classNumber >= 1 &&
                classNumber <= 4
            );
        }

        const singleFormMatch = scope.match(
            /FORM\s*(\d+)/
        );

        if (singleFormMatch) {
            const requiredForm = Number(
                singleFormMatch[1]
            );

            return classNumber === requiredForm;
        }

        return false;
    };

    const availableSubjects = useMemo(() => {
        if (!selectedClass) return [];

        return subjects.filter(subject =>
            subjectBelongsToClass(
                subject,
                selectedClass
            )
        );
    }, [subjects, selectedClass]);

    const selectedSubjects = useMemo(() => {
        return subjects.filter(subject =>
            classificationForm.subject_ids.includes(
                String(subject.id)
            )
        );
    }, [subjects, classificationForm.subject_ids]);

    // ============================================================
    // FORM HANDLERS
    // ============================================================

    const handleChange = event => {
        const { name, value } = event.target;

        setForm(previous => ({
            ...previous,
            [name]: value
        }));

        setError("");
        setSuccess("");
    };

    const handleClassSelection = event => {
        const { value } = event.target;

        setClassificationForm(previous => ({
            ...previous,
            class_id: value,
            subject_ids: []
        }));

        setError("");
        setSuccess("");
    };

    const handleSubjectCheckbox = subjectId => {
        const id = String(subjectId);

        setClassificationForm(previous => {
            const alreadySelected =
                previous.subject_ids.includes(id);

            if (alreadySelected) {
                return {
                    ...previous,
                    subject_ids:
                        previous.subject_ids.filter(
                            item => item !== id
                        )
                };
            }

            return {
                ...previous,
                subject_ids: [
                    ...previous.subject_ids,
                    id
                ]
            };
        });

        setError("");
        setSuccess("");
    };

    const selectAllSubjects = () => {
        setClassificationForm(previous => ({
            ...previous,
            subject_ids: availableSubjects.map(
                subject => String(subject.id)
            )
        }));

        setError("");
        setSuccess("");
    };

    const clearSubjectSelection = () => {
        setClassificationForm(previous => ({
            ...previous,
            subject_ids: []
        }));

        setError("");
        setSuccess("");
    };

    const handleClassificationChange = event => {
        const { name, value } = event.target;

        setClassificationForm(previous => ({
            ...previous,
            [name]: value
        }));

        setError("");
        setSuccess("");
    };

    // ============================================================
    // CLASSIFICATION
    // ============================================================

    const addClassification = () => {
        setError("");
        setSuccess("");

        if (!classificationForm.class_id) {
            setError(
                "Please select a Class first."
            );
            return;
        }

        if (
            classificationForm.subject_ids.length ===
            0
        ) {
            setError(
                `Please select at least one Subject for ${getClassName(
                    selectedClass
                )}.`
            );
            return;
        }

        if (
            Number(classificationForm.full_marks) <=
            0
        ) {
            setError(
                "Full marks must be greater than zero."
            );
            return;
        }

        if (
            Number(classificationForm.pass_marks) <
            0
        ) {
            setError(
                "Pass marks cannot be negative."
            );
            return;
        }

        if (
            Number(classificationForm.pass_marks) >
            Number(classificationForm.full_marks)
        ) {
            setError(
                "Pass marks cannot be greater than full marks."
            );
            return;
        }

        if (
            classificationForm.start_time >=
            classificationForm.end_time
        ) {
            setError(
                "End time must be later than start time."
            );
            return;
        }

        const newClassifications = [];

        selectedSubjects.forEach(subjectItem => {
            const alreadyExists =
                classifications.some(
                    item =>
                        String(item.subject_id) ===
                            String(subjectItem.id) &&
                        String(item.class_id) ===
                            String(selectedClass.id)
                );

            if (!alreadyExists) {
                newClassifications.push({
                    subject_id: String(
                        subjectItem.id
                    ),
                    class_id: String(
                        selectedClass.id
                    ),
                    full_marks: Number(
                        classificationForm.full_marks
                    ),
                    pass_marks: Number(
                        classificationForm.pass_marks
                    ),
                    session:
                        classificationForm.session,
                    start_time:
                        classificationForm.start_time,
                    end_time:
                        classificationForm.end_time,
                    subject_name:
                        getSubjectName(subjectItem),
                    class_name:
                        getClassName(selectedClass)
                });
            }
        });

        if (
            newClassifications.length === 0
        ) {
            setError(
                `All selected Subjects for ${getClassName(
                    selectedClass
                )} have already been added.`
            );
            return;
        }

        setClassifications(previous => [
            ...previous,
            ...newClassifications
        ]);

        setClassificationForm(previous => ({
            ...previous,
            subject_ids: [],
            full_marks: 100,
            pass_marks: 40
        }));

        setSuccess(
            `${newClassifications.length} Subject(s) added successfully for ${getClassName(
                selectedClass
            )}. You can now select another Class.`
        );
    };

    const removeClassification = index => {
        setClassifications(previous =>
            previous.filter(
                (_, itemIndex) =>
                    itemIndex !== index
            )
        );

        setError("");
        setSuccess("");
    };

    const clearClassifications = () => {
        setClassifications([]);

        setError("");
        setSuccess(
            "All Class/Subject classifications have been removed."
        );
    };

    // ============================================================
    // GRADING
    // ============================================================

    const addGradingScale = () => {
        setGradingScales(previous => [
            ...previous,
            {
                grade: "",
                min_percentage: 0,
                max_percentage: 0,
                remark: "",
                result: "PASS"
            }
        ]);

        setError("");
        setSuccess("");
    };

    const updateGradingScale = (
        index,
        field,
        value
    ) => {
        setGradingScales(previous =>
            previous.map(
                (item, itemIndex) => {
                    if (
                        itemIndex !== index
                    ) {
                        return item;
                    }

                    return {
                        ...item,
                        [field]:
                            field ===
                                "min_percentage" ||
                            field ===
                                "max_percentage"
                                ? value
                                : value
                    };
                }
            )
        );

        setError("");
        setSuccess("");
    };

    const removeGradingScale = index => {
        if (gradingScales.length <= 1) {
            setError(
                "At least one grading scale is required."
            );
            return;
        }

        setGradingScales(previous =>
            previous.filter(
                (_, itemIndex) =>
                    itemIndex !== index
            )
        );

        setError("");
        setSuccess("");
    };

    const moveGradeUp = index => {
        if (index === 0) return;

        setGradingScales(previous => {
            const updated = [...previous];

            const temp =
                updated[index - 1];

            updated[index - 1] =
                updated[index];

            updated[index] = temp;

            return updated;
        });
    };

    const moveGradeDown = index => {
        if (
            index ===
            gradingScales.length - 1
        ) {
            return;
        }

        setGradingScales(previous => {
            const updated = [...previous];

            const temp =
                updated[index + 1];

            updated[index + 1] =
                updated[index];

            updated[index] = temp;

            return updated;
        });
    };

    const normalizedGradingScales =
        useMemo(() => {
            return gradingScales.map(
                item => ({
                    ...item,
                    grade: String(
                        item.grade || ""
                    )
                        .trim()
                        .toUpperCase(),
                    min_percentage:
                        Number(
                            item.min_percentage
                        ),
                    max_percentage:
                        Number(
                            item.max_percentage
                        ),
                    remark: String(
                        item.remark || ""
                    ).trim(),
                    result:
                        item.result ===
                        "FAIL"
                            ? "FAIL"
                            : "PASS"
                })
            );
        }, [gradingScales]);

    const validateGradingScales = () => {
        if (
            normalizedGradingScales.length ===
            0
        ) {
            return {
                valid: false,
                message:
                    "Please configure at least one grading scale."
            };
        }

        const grades =
            normalizedGradingScales.map(
                item => item.grade
            );

        const duplicateGrades =
            grades.filter(
                (grade, index) =>
                    grade &&
                    grades.indexOf(
                        grade
                    ) !== index
            );

        if (
            duplicateGrades.length > 0
        ) {
            return {
                valid: false,
                message: `Duplicate grade detected: ${duplicateGrades[0]}. Each grade must be unique.`
            };
        }

        for (
            let index = 0;
            index <
            normalizedGradingScales.length;
            index++
        ) {
            const item =
                normalizedGradingScales[
                    index
                ];

            if (!item.grade) {
                return {
                    valid: false,
                    message: `Grade name is required on row ${
                        index + 1
                    }.`
                };
            }

            if (
                Number.isNaN(
                    item.min_percentage
                ) ||
                Number.isNaN(
                    item.max_percentage
                )
            ) {
                return {
                    valid: false,
                    message: `Minimum and maximum percentage are required on grading row ${
                        index + 1
                    }.`
                };
            }

            if (
                item.min_percentage < 0
            ) {
                return {
                    valid: false,
                    message: `Minimum percentage cannot be below 0 on row ${
                        index + 1
                    }.`
                };
            }

            if (
                item.max_percentage > 100
            ) {
                return {
                    valid: false,
                    message: `Maximum percentage cannot exceed 100 on row ${
                        index + 1
                    }.`
                };
            }

            if (
                item.min_percentage >
                item.max_percentage
            ) {
                return {
                    valid: false,
                    message: `Minimum percentage cannot be greater than maximum percentage on row ${
                        index + 1
                    }.`
                };
            }
        }

        const sorted = [
            ...normalizedGradingScales
        ].sort(
            (a, b) =>
                a.min_percentage -
                b.min_percentage
        );

        for (
            let index = 0;
            index < sorted.length - 1;
            index++
        ) {
            const current =
                sorted[index];

            const next =
                sorted[index + 1];

            if (
                next.min_percentage <=
                current.max_percentage
            ) {
                return {
                    valid: false,
                    message: `Grading ranges overlap between ${current.grade} (${current.min_percentage}-${current.max_percentage}) and ${next.grade} (${next.min_percentage}-${next.max_percentage}).`
                };
            }
        }

        if (
            sorted[0].min_percentage !==
            0
        ) {
            return {
                valid: false,
                message:
                    "Grading scale must start from 0% so every student can receive a grade."
            };
        }

        if (
            sorted[
                sorted.length - 1
            ].max_percentage !== 100
        ) {
            return {
                valid: false,
                message:
                    "Grading scale must end at 100% so every student can receive a grade."
            };
        }

        for (
            let index = 0;
            index < sorted.length - 1;
            index++
        ) {
            const current =
                sorted[index];

            const next =
                sorted[index + 1];

            if (
                next.min_percentage >
                current.max_percentage + 1
            ) {
                return {
                    valid: false,
                    message: `There is a grading gap between ${current.grade} and ${next.grade}. Every percentage from 0% to 100% must belong to a grade.`
                };
            }
        }

        return {
            valid: true,
            message: ""
        };
    };

    // ============================================================
    // SUBMIT
    // ============================================================

    const handleSubmit = async event => {
        event.preventDefault();

        setError("");
        setSuccess("");

        const schoolId = Number(
            school?.id
        );

        const academicYearId = Number(
            activeAcademicYearId
        );

        // --------------------------------------------------------
        // GLOBAL SCHOOL VALIDATION
        // --------------------------------------------------------

        if (!schoolId) {
            setError(
                "School information is not available. Please refresh the page and try again."
            );
            return;
        }

        // --------------------------------------------------------
        // GLOBAL ACADEMIC YEAR VALIDATION
        // --------------------------------------------------------

        if (!academicYearId) {
            setError(
                "No active academic year is configured for this school. Please activate an academic year in Settings."
            );
            return;
        }

        if (!form.exam_name.trim()) {
            setError(
                "Examination name is required."
            );
            return;
        }

        if (!form.exam_type) {
            setError(
                "Please select examination type."
            );
            return;
        }

        // Always use global active academic year
        if (
            String(form.academic_year_id) !==
            String(activeAcademicYearId)
        ) {
            setForm(previous => ({
                ...previous,
                academic_year_id:
                    String(
                        activeAcademicYearId
                    )
            }));
        }

        if (!form.term) {
            setError(
                "Please select term."
            );
            return;
        }

        if (!form.start_date) {
            setError(
                "Please select examination start date."
            );
            return;
        }

        if (!form.end_date) {
            setError(
                "Please select examination end date."
            );
            return;
        }

        if (
            new Date(form.end_date) <
            new Date(form.start_date)
        ) {
            setError(
                "End date cannot be earlier than start date."
            );
            return;
        }

        if (
            Number(form.total_marks) <=
            0
        ) {
            setError(
                "Examination total marks must be greater than zero."
            );
            return;
        }

        if (
            Number(form.duration_minutes) <=
            0
        ) {
            setError(
                "Examination duration must be greater than zero."
            );
            return;
        }

        if (
            classifications.length === 0
        ) {
            setError(
                "Please add at least one Class and Subject before creating the examination."
            );
            return;
        }

        const gradingValidation =
            validateGradingScales();

        if (!gradingValidation.valid) {
            setError(
                gradingValidation.message
            );
            return;
        }

        try {
            setSaving(true);

            // ----------------------------------------------------
            // EXAM PAYLOAD
            // ----------------------------------------------------

            const examPayload = {
                school_id: schoolId,
                academic_year_id:
                    academicYearId,
                exam_name:
                    form.exam_name.trim(),
                exam_type:
                    form.exam_type,
                term: form.term,
                start_date:
                    form.start_date,
                end_date:
                    form.end_date,
                status: "DRAFT",
                total_marks:
                    Number(
                        form.total_marks
                    ),
                duration_minutes:
                    Number(
                        form.duration_minutes
                    ),
                ai_status: "Pending"
            };

            // ----------------------------------------------------
            // CREATE EXAM
            // ----------------------------------------------------

            const {
                data: exam,
                error: examError
            } = await supabase
                .from("exams")
                .insert([examPayload])
                .select("*")
                .single();

            if (examError) {
                throw examError;
            }

            if (!exam?.id) {
                throw new Error(
                    "Examination ID was not returned after creation."
                );
            }

            // ----------------------------------------------------
            // CREATE APPROVAL RECORD
            // ----------------------------------------------------

            const {
                error: approvalError
            } = await supabase
                .from("exam_approvals")
                .insert([
                    {
                        exam_id:
                            exam.id,
                        academic_status:
                            "PENDING",
                        second_master_status:
                            "PENDING",
                        headmaster_status:
                            "PENDING",
                        secretary_status:
                            "PENDING"
                    }
                ]);

            if (approvalError) {
                console.error(
                    "APPROVAL RECORD ERROR:",
                    approvalError
                );
            }

            // ----------------------------------------------------
            // GRADING RECORDS
            // ----------------------------------------------------

            const gradingRecords =
                normalizedGradingScales.map(
                    (
                        item,
                        index
                    ) => ({
                        exam_id:
                            exam.id,
                        grade:
                            item.grade,
                        min_percentage:
                            Number(
                                item.min_percentage
                            ),
                        max_percentage:
                            Number(
                                item.max_percentage
                            ),
                        remark:
                            item.remark ||
                            null,
                        result:
                            item.result,
                        sort_order:
                            index
                    })
                );

            const {
                data: createdGradingScales,
                error: gradingError
            } = await supabase
                .from(
                    "exam_grading_scales"
                )
                .insert(
                    gradingRecords
                )
                .select("*");

            if (gradingError) {
                throw new Error(
                    `Failed to save grading settings: ${gradingError.message}`
                );
            }

            if (
                !createdGradingScales ||
                createdGradingScales.length !==
                    gradingRecords.length
            ) {
                throw new Error(
                    "Not all grading settings were saved."
                );
            }

            // ----------------------------------------------------
            // EXAM SUBJECT RECORDS
            // ----------------------------------------------------

            const examSubjectRecords =
                classifications.map(
                    item => ({
                        exam_id:
                            exam.id,
                        subject_id:
                            Number(
                                item.subject_id
                            ),
                        class_id:
                            Number(
                                item.class_id
                            ),
                        full_marks:
                            Number(
                                item.full_marks
                            ),
                        pass_marks:
                            Number(
                                item.pass_marks
                            )
                    })
                );

            const {
                data: createdExamSubjects,
                error: examSubjectsError
            } = await supabase
                .from("exam_subjects")
                .insert(
                    examSubjectRecords
                )
                .select("*");

            if (examSubjectsError) {
                throw examSubjectsError;
            }

            // ----------------------------------------------------
            // DEBUG
            // ----------------------------------------------------

            console.log(
                "CREATED EXAM:",
                exam
            );

            console.log(
                "CREATED GRADING:",
                createdGradingScales
            );

            console.log(
                "CREATED EXAM SUBJECTS:",
                createdExamSubjects
            );

            // ----------------------------------------------------
            // SUCCESS
            // ----------------------------------------------------

            setSuccess(
                "Examination, grading settings, classes and subjects created successfully."
            );

            setTimeout(() => {
                navigate(
                    `/examination/${exam.id}`
                );
            }, 700);
        } catch (err) {
            console.error(
                "CREATE EXAM ERROR:",
                err
            );

            setError(
                err?.message ||
                    "Failed to create examination."
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-6">
            {/* ==================================================
                HEADER
            ================================================== */}

            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() =>
                            navigate(
                                "/examination"
                            )
                        }
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100"
                    >
                        <FaArrowLeft />
                    </button>

                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">
                            Create Examination
                        </h1>

                        <p className="text-sm text-slate-500">
                            Configure examination details,
                            grading and class subjects.
                        </p>
                    </div>
                </div>
            </div>

            {/* ==================================================
                MESSAGES
            ================================================== */}

            {error && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {error}
                </div>
            )}

            {success && (
                <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                    <div className="flex items-center gap-2">
                        <FaCheckCircle />
                        <span>{success}</span>
                    </div>
                </div>
            )}

            <form
                onSubmit={handleSubmit}
                className="space-y-6"
            >
                {/* ==================================================
                    EXAMINATION DETAILS
                ================================================== */}

                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-5 py-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                <FaGraduationCap />
                            </div>

                            <div>
                                <h2 className="font-bold text-slate-800">
                                    Examination Details
                                </h2>

                                <p className="text-xs text-slate-500">
                                    Basic examination information
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2 lg:grid-cols-3">
                        {/* EXAM NAME */}
                        <div className="lg:col-span-2">
                            <label className="mb-2 block text-sm font-semibold text-slate-700">
                                Examination Name
                            </label>

                            <input
                                type="text"
                                name="exam_name"
                                value={
                                    form.exam_name
                                }
                                onChange={
                                    handleChange
                                }
                                placeholder="e.g. Form Four Annual Examination 2026"
                                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>

                        {/* EXAM TYPE */}
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-700">
                                Examination Type
                            </label>

                            <select
                                name="exam_type"
                                value={
                                    form.exam_type
                                }
                                onChange={
                                    handleChange
                                }
                                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            >
                                <option value="">
                                    Select examination type
                                </option>

                                <option value="CAT">
                                    CAT
                                </option>

                                <option value="MID_TERM">
                                    MID TERM
                                </option>

                                <option value="TERMINAL">
                                    TERMINAL
                                </option>

                                <option value="ANNUAL">
                                    ANNUAL
                                </option>

                                <option value="MOCK">
                                    MOCK
                                </option>

                                <option value="NATIONAL">
                                    NATIONAL
                                </option>
                            </select>
                        </div>

                        {/* ACADEMIC YEAR */}
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-700">
                                Academic Year
                            </label>

                            <select
                                name="academic_year_id"
                                value={
                                    form.academic_year_id
                                }
                                disabled
                                className="w-full cursor-not-allowed rounded-lg border border-slate-300 bg-slate-100 px-4 py-2.5 text-sm text-slate-600 outline-none"
                            >
                                <option value="">
                                    {loadingYears
                                        ? "Loading active academic year..."
                                        : "No active academic year"}
                                </option>

                                {activeAcademicYearId && (
                                    <option
                                        value={
                                            activeAcademicYearId
                                        }
                                    >
                                        {activeAcademicYearName ||
                                            `Academic Year ${activeAcademicYearId}`}
                                    </option>
                                )}
                            </select>

                            <p className="mt-1.5 text-xs text-slate-500">
                                Global active academic year
                            </p>
                        </div>

                        {/* TERM */}
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-700">
                                Term
                            </label>

                            <select
                                name="term"
                                value={
                                    form.term
                                }
                                onChange={
                                    handleChange
                                }
                                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            >
                                <option value="">
                                    Select term
                                </option>

                                <option value="TERM_1">
                                    TERM 1
                                </option>

                                <option value="TERM_2">
                                    TERM 2
                                </option>

                                <option value="TERM_3">
                                    TERM 3
                                </option>
                            </select>

                            {activeAcademicYearTerm && (
                                <p className="mt-1.5 text-xs text-slate-500">
                                    Active year term:{" "}
                                    {activeAcademicYearTerm}
                                </p>
                            )}
                        </div>

                        {/* TOTAL MARKS */}
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-700">
                                Total Marks
                            </label>

                            <input
                                type="number"
                                name="total_marks"
                                min="1"
                                value={
                                    form.total_marks
                                }
                                onChange={
                                    handleChange
                                }
                                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>

                        {/* DURATION */}
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-700">
                                Duration (Minutes)
                            </label>

                            <div className="relative">
                                <FaClock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

                                <input
                                    type="number"
                                    name="duration_minutes"
                                    min="1"
                                    value={
                                        form.duration_minutes
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>
                        </div>

                        {/* START DATE */}
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-700">
                                Start Date
                            </label>

                            <input
                                type="date"
                                name="start_date"
                                value={
                                    form.start_date
                                }
                                onChange={
                                    handleChange
                                }
                                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>

                        {/* END DATE */}
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-700">
                                End Date
                            </label>

                            <input
                                type="date"
                                name="end_date"
                                value={
                                    form.end_date
                                }
                                onChange={
                                    handleChange
                                }
                                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                    </div>
                </div>

                {/* ==================================================
                    GRADING SETTINGS
                ================================================== */}

                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                                <FaLayerGroup />
                            </div>

                            <div>
                                <h2 className="font-bold text-slate-800">
                                    Grading Settings
                                </h2>

                                <p className="text-xs text-slate-500">
                                    Configure percentage ranges and results
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={
                                addGradingScale
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700"
                        >
                            <FaPlus />
                            Add Grade
                        </button>
                    </div>

                    <div className="overflow-x-auto p-5">
                        <table className="w-full min-w-[850px] border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                                    <th className="border border-slate-200 px-3 py-3">
                                        #
                                    </th>

                                    <th className="border border-slate-200 px-3 py-3">
                                        Grade
                                    </th>

                                    <th className="border border-slate-200 px-3 py-3">
                                        Min %
                                    </th>

                                    <th className="border border-slate-200 px-3 py-3">
                                        Max %
                                    </th>

                                    <th className="border border-slate-200 px-3 py-3">
                                        Remark
                                    </th>

                                    <th className="border border-slate-200 px-3 py-3">
                                        Result
                                    </th>

                                    <th className="border border-slate-200 px-3 py-3 text-center">
                                        Order
                                    </th>

                                    <th className="border border-slate-200 px-3 py-3 text-center">
                                        Action
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {gradingScales.map(
                                    (
                                        item,
                                        index
                                    ) => (
                                        <tr
                                            key={
                                                index
                                            }
                                            className="text-sm"
                                        >
                                            <td className="border border-slate-200 px-3 py-3 font-semibold text-slate-600">
                                                {index +
                                                    1}
                                            </td>

                                            <td className="border border-slate-200 px-3 py-3">
                                                <input
                                                    type="text"
                                                    value={
                                                        item.grade
                                                    }
                                                    onChange={event =>
                                                        updateGradingScale(
                                                            index,
                                                            "grade",
                                                            event
                                                                .target
                                                                .value
                                                        )
                                                    }
                                                    className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-center font-bold uppercase outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                                />
                                            </td>

                                            <td className="border border-slate-200 px-3 py-3">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={
                                                        item.min_percentage
                                                    }
                                                    onChange={event =>
                                                        updateGradingScale(
                                                            index,
                                                            "min_percentage",
                                                            event
                                                                .target
                                                                .value
                                                        )
                                                    }
                                                    className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-center outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                                />
                                            </td>

                                            <td className="border border-slate-200 px-3 py-3">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={
                                                        item.max_percentage
                                                    }
                                                    onChange={event =>
                                                        updateGradingScale(
                                                            index,
                                                            "max_percentage",
                                                            event
                                                                .target
                                                                .value
                                                        )
                                                    }
                                                    className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-center outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                                />
                                            </td>

                                            <td className="border border-slate-200 px-3 py-3">
                                                <input
                                                    type="text"
                                                    value={
                                                        item.remark
                                                    }
                                                    onChange={event =>
                                                        updateGradingScale(
                                                            index,
                                                            "remark",
                                                            event
                                                                .target
                                                                .value
                                                        )
                                                    }
                                                    className="w-full min-w-[180px] rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                                />
                                            </td>

                                            <td className="border border-slate-200 px-3 py-3">
                                                <select
                                                    value={
                                                        item.result
                                                    }
                                                    onChange={event =>
                                                        updateGradingScale(
                                                            index,
                                                            "result",
                                                            event
                                                                .target
                                                                .value
                                                        )
                                                    }
                                                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                                >
                                                    <option value="PASS">
                                                        PASS
                                                    </option>

                                                    <option value="FAIL">
                                                        FAIL
                                                    </option>
                                                </select>
                                            </td>

                                            <td className="border border-slate-200 px-3 py-3">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            moveGradeUp(
                                                                index
                                                            )
                                                        }
                                                        disabled={
                                                            index ===
                                                            0
                                                        }
                                                        className="rounded-md border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                                                        title="Move up"
                                                    >
                                                        <FaChevronUp />
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            moveGradeDown(
                                                                index
                                                            )
                                                        }
                                                        disabled={
                                                            index ===
                                                            gradingScales.length -
                                                                1
                                                        }
                                                        className="rounded-md border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                                                        title="Move down"
                                                    >
                                                        <FaChevronDown />
                                                    </button>
                                                </div>
                                            </td>

                                            <td className="border border-slate-200 px-3 py-3 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        removeGradingScale(
                                                            index
                                                        )
                                                    }
                                                    className="rounded-lg p-2 text-red-600 transition hover:bg-red-50"
                                                    title="Remove grade"
                                                >
                                                    <FaTrash />
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="grid grid-cols-1 gap-4 px-5 pb-5 md:grid-cols-2">
                        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                            <h3 className="mb-2 text-sm font-bold text-blue-800">
                                Grading Summary
                            </h3>

                            <div className="space-y-1 text-sm text-blue-900">
                                {normalizedGradingScales.map(
                                    (
                                        item,
                                        index
                                    ) => (
                                        <div
                                            key={
                                                index
                                            }
                                            className="flex items-center justify-between border-b border-blue-100 py-1 last:border-0"
                                        >
                                            <span className="font-bold">
                                                {
                                                    item.grade
                                                }
                                            </span>

                                            <span>
                                                {
                                                    item.min_percentage
                                                }
                                                %
                                                {" - "}
                                                {
                                                    item.max_percentage
                                                }
                                                %
                                            </span>

                                            <span>
                                                {
                                                    item.result
                                                }
                                            </span>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <h3 className="mb-2 text-sm font-bold text-slate-700">
                                Example
                            </h3>

                            <p className="text-sm leading-6 text-slate-600">
                                A student scoring 75%
                                receives grade A, while
                                65% receives B, 45%
                                receives C, 30% receives
                                D and marks below 30%
                                receive F.
                            </p>
                        </div>
                    </div>
                </div>

                {/* ==================================================
                    CLASS & SUBJECT ASSIGNMENT
                ================================================== */}

                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-5 py-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                                <FaLayerGroup />
                            </div>

                            <div>
                                <h2 className="font-bold text-slate-800">
                                    Class & Subject Assignment
                                </h2>

                                <p className="text-xs text-slate-500">
                                    Select classes and their examination subjects
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6 p-5">
                        {/* ACTIVE YEAR / SCHOOL INFO */}
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                                    Active Academic Year
                                </p>

                                <p className="mt-1 text-lg font-bold text-blue-900">
                                    {activeAcademicYearName ||
                                        "Not configured"}
                                </p>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    School
                                </p>

                                <p className="mt-1 text-lg font-bold text-slate-800">
                                    {school?.school_name ||
                                        school?.name ||
                                        school?.schoolName ||
                                        "Current School"}
                                </p>
                            </div>
                        </div>

                        {/* CLASS SELECT */}
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-700">
                                Select Class
                            </label>

                            {loadingClasses ? (
                                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                                    <FaSpinner className="animate-spin" />
                                    Loading classes...
                                </div>
                            ) : (
                                <select
                                    value={
                                        classificationForm.class_id
                                    }
                                    onChange={
                                        handleClassSelection
                                    }
                                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                >
                                    <option value="">
                                        Select class
                                    </option>

                                    {classes.map(
                                        classItem => (
                                            <option
                                                key={
                                                    classItem.id
                                                }
                                                value={
                                                    classItem.id
                                                }
                                            >
                                                {getClassName(
                                                    classItem
                                                )}
                                            </option>
                                        )
                                    )}
                                </select>
                            )}
                        </div>

                        {/* SUBJECTS */}
                        {selectedClass && (
                            <div>
                                <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-800">
                                            Subjects for{" "}
                                            {getClassName(
                                                selectedClass
                                            )}
                                        </h3>

                                        <p className="text-xs text-slate-500">
                                            {availableSubjects.length} available subject(s)
                                        </p>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={
                                                selectAllSubjects
                                            }
                                            disabled={
                                                availableSubjects.length ===
                                                0
                                            }
                                            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            Select All
                                        </button>

                                        <button
                                            type="button"
                                            onClick={
                                                clearSubjectSelection
                                            }
                                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>

                                {loadingSubjects ? (
                                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                                        <FaSpinner className="animate-spin" />
                                        Loading subjects...
                                    </div>
                                ) : availableSubjects.length ===
                                  0 ? (
                                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-700">
                                        No active subjects are configured for this class.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                        {availableSubjects.map(
                                            subject => {
                                                const subjectId =
                                                    String(
                                                        subject.id
                                                    );

                                                const selected =
                                                    classificationForm.subject_ids.includes(
                                                        subjectId
                                                    );

                                                return (
                                                    <label
                                                        key={
                                                            subject.id
                                                        }
                                                        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                                                            selected
                                                                ? "border-blue-500 bg-blue-50"
                                                                : "border-slate-200 bg-white hover:border-blue-300"
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={
                                                                selected
                                                            }
                                                            onChange={() =>
                                                                handleSubjectCheckbox(
                                                                    subject.id
                                                                )
                                                            }
                                                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                        />

                                                        <span className="text-sm font-medium text-slate-700">
                                                            {getSubjectName(
                                                                subject
                                                            )}
                                                        </span>
                                                    </label>
                                                );
                                            }
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* CLASSIFICATION SETTINGS */}
                        {selectedClass && (
                            <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 lg:grid-cols-5">
                                <div>
                                    <label className="mb-2 block text-xs font-semibold text-slate-600">
                                        Full Marks
                                    </label>

                                    <input
                                        type="number"
                                        min="1"
                                        name="full_marks"
                                        value={
                                            classificationForm.full_marks
                                        }
                                        onChange={
                                            handleClassificationChange
                                        }
                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-xs font-semibold text-slate-600">
                                        Pass Marks
                                    </label>

                                    <input
                                        type="number"
                                        min="0"
                                        name="pass_marks"
                                        value={
                                            classificationForm.pass_marks
                                        }
                                        onChange={
                                            handleClassificationChange
                                        }
                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-xs font-semibold text-slate-600">
                                        Session
                                    </label>

                                    <select
                                        name="session"
                                        value={
                                            classificationForm.session
                                        }
                                        onChange={
                                            handleClassificationChange
                                        }
                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    >
                                        <option value="MORNING">
                                            MORNING
                                        </option>

                                        <option value="AFTERNOON">
                                            AFTERNOON
                                        </option>

                                        <option value="EVENING">
                                            EVENING
                                        </option>
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-2 block text-xs font-semibold text-slate-600">
                                        Start Time
                                    </label>

                                    <input
                                        type="time"
                                        name="start_time"
                                        value={
                                            classificationForm.start_time
                                        }
                                        onChange={
                                            handleClassificationChange
                                        }
                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-xs font-semibold text-slate-600">
                                        End Time
                                    </label>

                                    <input
                                        type="time"
                                        name="end_time"
                                        value={
                                            classificationForm.end_time
                                        }
                                        onChange={
                                            handleClassificationChange
                                        }
                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={
                                    addClassification
                                }
                                disabled={
                                    !classificationForm.class_id ||
                                    classificationForm.subject_ids.length ===
                                        0
                                }
                                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <FaPlus />
                                Save Class & Subjects
                            </button>
                        </div>
                    </div>
                </div>

                {/* ==================================================
                    SAVED CLASSIFICATIONS
                ================================================== */}

                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className="font-bold text-slate-800">
                                Saved Class & Subject Assignments
                            </h2>

                            <p className="text-xs text-slate-500">
                                Review all examination class and subject assignments
                            </p>
                        </div>

                        {classifications.length >
                            0 && (
                            <button
                                type="button"
                                onClick={
                                    clearClassifications
                                }
                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100"
                            >
                                <FaTrash />
                                Clear All
                            </button>
                        )}
                    </div>

                    <div className="overflow-x-auto">
                        {classifications.length ===
                        0 ? (
                            <div className="px-5 py-10 text-center text-sm text-slate-500">
                                No class and subject assignments have been added yet.
                            </div>
                        ) : (
                            <table className="w-full min-w-[850px] border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                                        <th className="border border-slate-200 px-4 py-3">
                                            #
                                        </th>

                                        <th className="border border-slate-200 px-4 py-3">
                                            Class
                                        </th>

                                        <th className="border border-slate-200 px-4 py-3">
                                            Subject
                                        </th>

                                        <th className="border border-slate-200 px-4 py-3">
                                            Full Marks
                                        </th>

                                        <th className="border border-slate-200 px-4 py-3">
                                            Pass Marks
                                        </th>

                                        <th className="border border-slate-200 px-4 py-3">
                                            Session
                                        </th>

                                        <th className="border border-slate-200 px-4 py-3">
                                            Time
                                        </th>

                                        <th className="border border-slate-200 px-4 py-3 text-center">
                                            Action
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {classifications.map(
                                        (
                                            item,
                                            index
                                        ) => (
                                            <tr
                                                key={`${item.class_id}-${item.subject_id}-${index}`}
                                                className="text-sm"
                                            >
                                                <td className="border border-slate-200 px-4 py-3 font-semibold text-slate-600">
                                                    {index +
                                                        1}
                                                </td>

                                                <td className="border border-slate-200 px-4 py-3 font-semibold text-slate-800">
                                                    {
                                                        item.class_name
                                                    }
                                                </td>

                                                <td className="border border-slate-200 px-4 py-3 text-slate-700">
                                                    {
                                                        item.subject_name
                                                    }
                                                </td>

                                                <td className="border border-slate-200 px-4 py-3 text-slate-700">
                                                    {
                                                        item.full_marks
                                                    }
                                                </td>

                                                <td className="border border-slate-200 px-4 py-3 text-slate-700">
                                                    {
                                                        item.pass_marks
                                                    }
                                                </td>

                                                <td className="border border-slate-200 px-4 py-3 text-slate-700">
                                                    {
                                                        item.session
                                                    }
                                                </td>

                                                <td className="border border-slate-200 px-4 py-3 text-slate-700">
                                                    {
                                                        item.start_time
                                                    }{" "}
                                                    -{" "}
                                                    {
                                                        item.end_time
                                                    }
                                                </td>

                                                <td className="border border-slate-200 px-4 py-3 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            removeClassification(
                                                                index
                                                            )
                                                        }
                                                        className="rounded-lg p-2 text-red-600 transition hover:bg-red-50"
                                                        title="Remove assignment"
                                                    >
                                                        <FaTrash />
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* SUMMARY */}
                    {classifications.length >
                        0 && (
                        <div className="grid grid-cols-1 gap-4 border-t border-slate-200 bg-slate-50 p-5 sm:grid-cols-3">
                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Assignments
                                </p>

                                <p className="mt-1 text-2xl font-bold text-slate-800">
                                    {
                                        classifications.length
                                    }
                                </p>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Classes
                                </p>

                                <p className="mt-1 text-2xl font-bold text-slate-800">
                                    {
                                        new Set(
                                            classifications.map(
                                                item =>
                                                    String(
                                                        item.class_id
                                                    )
                                            )
                                        ).size
                                    }
                                </p>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Academic Year
                                </p>

                                <p className="mt-1 text-lg font-bold text-blue-700">
                                    {activeAcademicYearName ||
                                        "Not configured"}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* ==================================================
                    STATUS
                ================================================== */}

                <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Examination Status
                        </p>

                        <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700">
                            <span className="h-2 w-2 rounded-full bg-slate-500" />
                            DRAFT
                        </div>
                    </div>

                    <div className="text-sm text-slate-500">
                        The examination will be created as a draft.
                    </div>
                </div>

                {/* ==================================================
                    ACTIONS
                ================================================== */}

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={() =>
                            navigate(
                                "/examination"
                            )
                        }
                        disabled={saving}
                        className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Cancel
                    </button>

                    <button
                        type="submit"
                        disabled={
                            saving ||
                            loadingYears ||
                            loadingClasses ||
                            !activeAcademicYearId ||
                            !school?.id
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {saving ? (
                            <>
                                <FaSpinner className="animate-spin" />
                                Creating Examination...
                            </>
                        ) : (
                            <>
                                <FaSave />
                                Create Examination
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default AddExam;