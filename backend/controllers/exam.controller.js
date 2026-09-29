import { supabase } from "../config/supabase.js";
import { askGemini } from "../services/gemini.service.js";


// =====================================================
// HELPERS
// =====================================================

const normalizeSelectionType = (value) => {

    const type =
        String(value || "ALL")
            .trim()
            .toUpperCase();

    return type === "SELECTIVE"
        ? "SELECTIVE"
        : "ALL";
};


// =====================================================
// GET EFFECTIVE QUESTIONS
//
// ALL:
//   All questions count.
//
// SELECTIVE:
//   First questions_to_answer questions,
//   ordered by question_number.
//
// Current schema does not contain selected_question_ids.
// =====================================================

const getEffectiveQuestions = (
    questions,
    examSubject
) => {

    const safeQuestions =
        Array.isArray(questions)
            ? [...questions]
            : [];


    safeQuestions.sort(
        (a, b) =>
            Number(a.question_number || 0) -
            Number(b.question_number || 0)
    );


    const selectionType =
        normalizeSelectionType(
            examSubject?.question_selection_type
        );


    if (
        selectionType === "ALL"
    ) {

        return safeQuestions;

    }


    const questionsToAnswer =
        Number(
            examSubject?.questions_to_answer
        );


    if (
        !Number.isInteger(
            questionsToAnswer
        ) ||
        questionsToAnswer <= 0
    ) {

        return [];

    }


    return safeQuestions.slice(
        0,
        questionsToAnswer
    );

};


// =====================================================
// GET EFFECTIVE QUESTION IDS
// =====================================================

const getEffectiveQuestionIds = (
    questions,
    examSubject
) => {

    return new Set(

        getEffectiveQuestions(
            questions,
            examSubject
        ).map(
            question =>
                String(
                    question.id
                )
        )

    );

};


// =====================================================
// CALCULATE EFFECTIVE FULL MARKS
// =====================================================

const calculateEffectiveFullMarks = (
    questions,
    examSubject
) => {

    const effectiveQuestions =
        getEffectiveQuestions(
            questions,
            examSubject
        );


    return effectiveQuestions.reduce(
        (
            total,
            question
        ) => {

            return (
                total +
                (
                    Number(
                        question.max_marks
                    ) || 0
                )
            );

        },
        0
    );

};


// =====================================================
// GET GRADE
// =====================================================

const getGrade = (
    percentage
) => {

    const value =
        Number(
            percentage
        ) || 0;


    if (value >= 75) {
        return "A";
    }


    if (value >= 60) {
        return "B";
    }


    if (value >= 50) {
        return "C";
    }


    if (value >= 40) {
        return "D";
    }


    return "F";

};


// =====================================================
// GET REMARK
// =====================================================

const getRemark = (
    percentage
) => {

    const value =
        Number(
            percentage
        ) || 0;


    if (value >= 75) {
        return "Excellent";
    }


    if (value >= 60) {
        return "Very Good";
    }


    if (value >= 50) {
        return "Good";
    }


    if (value >= 40) {
        return "Pass";
    }


    return "Fail";

};


// =====================================================
// GET PERFORMANCE
// =====================================================

const getPerformance = (
    percentage
) => {

    const value =
        Number(
            percentage
        ) || 0;


    if (value >= 75) {
        return "Strong";
    }


    if (value >= 60) {
        return "Good";
    }


    if (value >= 50) {
        return "Average";
    }


    return "Needs Attention";

};


// =====================================================
// GET STUDENT NAME
// =====================================================

const getStudentName = (
    student
) => {

    if (!student) {

        return "Unknown Student";

    }


    return [

        student.first_name,

        student.middle_name,

        student.last_name

    ]
        .filter(Boolean)
        .join(" ");

};


// =====================================================
// GET ALL EXAMS
//
// GET /api/exams
// =====================================================

export const getExams = async (
    req,
    res
) => {

    try {

        const {
            data,
            error
        } = await supabase

            .from("exams")

            .select("*")

            .order(
                "created_at",
                {
                    ascending: false
                }
            );


        if (error) {

            console.error(
                "GET EXAMS SUPABASE ERROR:",
                error
            );


            return res.status(400).json({

                success: false,

                message:
                    error.message,

                details:
                    error.details || null,

                hint:
                    error.hint || null,

                code:
                    error.code || null

            });

        }


        return res.json({

            success: true,

            exams:
                data || []

        });

    }
    catch (error) {

        console.error(
            "GET EXAMS ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};


// =====================================================
// GET SINGLE EXAM
//
// GET /api/exams/:id
// =====================================================

export const getExamById = async (
    req,
    res
) => {

    try {

        const {
            id
        } = req.params;


        if (!id) {

            return res.status(400).json({

                success: false,

                message:
                    "Exam ID is required"

            });

        }


        const {
            data,
            error
        } = await supabase

            .from("exams")

            .select("*")

            .eq(
                "id",
                id
            )

            .single();


        if (error) {

            console.error(
                "GET EXAM BY ID SUPABASE ERROR:",
                error
            );


            return res.status(404).json({

                success: false,

                message:
                    error.message

            });

        }


        return res.json({

            success: true,

            exam:
                data

        });

    }
    catch (error) {

        console.error(
            "GET EXAM BY ID ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};


// =====================================================
// CREATE EXAM
//
// POST /api/exams
// =====================================================

export const createExam = async (
    req,
    res
) => {

    try {

        console.log(
            "====================================="
        );

        console.log(
            "CREATE EXAM REQUEST"
        );

        console.log(
            "BODY:",
            req.body
        );

        console.log(
            "====================================="
        );


        const examData =
            req.body;


        if (
            !examData ||
            typeof examData !== "object" ||
            Object.keys(examData).length === 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Exam data is required"

            });

        }


        const {
            data,
            error
        } = await supabase

            .from("exams")

            .insert([
                examData
            ])

            .select("*")

            .single();


        if (error) {

            console.error(
                "CREATE EXAM SUPABASE ERROR:",
                error
            );


            return res.status(400).json({

                success: false,

                message:
                    error.message,

                details:
                    error.details || null,

                hint:
                    error.hint || null,

                code:
                    error.code || null

            });

        }


        return res.status(201).json({

            success: true,

            message:
                "Exam created successfully",

            exam:
                data

        });

    }
    catch (error) {

        console.error(
            "CREATE EXAM ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};


// =====================================================
// UPDATE EXAM
//
// PUT /api/exams/:id
// =====================================================

export const updateExam = async (
    req,
    res
) => {

    try {

        const {
            id
        } = req.params;


        if (!id) {

            return res.status(400).json({

                success: false,

                message:
                    "Exam ID is required"

            });

        }


        if (
            !req.body ||
            Object.keys(req.body).length === 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Update data is required"

            });

        }


        const {
            data,
            error
        } = await supabase

            .from("exams")

            .update(
                req.body
            )

            .eq(
                "id",
                id
            )

            .select("*")

            .single();


        if (error) {

            console.error(
                "UPDATE EXAM SUPABASE ERROR:",
                error
            );


            return res.status(400).json({

                success: false,

                message:
                    error.message,

                details:
                    error.details || null,

                hint:
                    error.hint || null,

                code:
                    error.code || null

            });

        }


        return res.json({

            success: true,

            message:
                "Exam updated successfully",

            exam:
                data

        });

    }
    catch (error) {

        console.error(
            "UPDATE EXAM ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};


// =====================================================
// DELETE EXAM
//
// DELETE /api/exams/:id
// =====================================================

export const deleteExam = async (
    req,
    res
) => {

    try {

        const {
            id
        } = req.params;


        if (!id) {

            return res.status(400).json({

                success: false,

                message:
                    "Exam ID is required"

            });

        }


        const aiDelete =
            await supabase

                .from(
                    "ai_exam_analysis"
                )

                .delete()

                .eq(
                    "exam_id",
                    id
                );


        if (aiDelete.error) {

            console.error(
                "DELETE AI ANALYSIS ERROR:",
                aiDelete.error
            );

        }


        const questionMarksDelete =
            await supabase

                .from(
                    "student_question_marks"
                )

                .delete()

                .eq(
                    "exam_id",
                    id
                );


        if (
            questionMarksDelete.error
        ) {

            console.error(
                "DELETE STUDENT QUESTION MARKS ERROR:",
                questionMarksDelete.error
            );

        }


        const marksDelete =
            await supabase

                .from(
                    "exam_marks"
                )

                .delete()

                .eq(
                    "exam_id",
                    id
                );


        if (marksDelete.error) {

            console.error(
                "DELETE EXAM MARKS ERROR:",
                marksDelete.error
            );

        }


        const subjectsDelete =
            await supabase

                .from(
                    "exam_subjects"
                )

                .delete()

                .eq(
                    "exam_id",
                    id
                );


        if (
            subjectsDelete.error
        ) {

            console.error(
                "DELETE EXAM SUBJECTS ERROR:",
                subjectsDelete.error
            );

        }


        const {
            error
        } = await supabase

            .from("exams")

            .delete()

            .eq(
                "id",
                id
            );


        if (error) {

            console.error(
                "DELETE EXAM SUPABASE ERROR:",
                error
            );


            return res.status(400).json({

                success: false,

                message:
                    error.message

            });

        }


        return res.json({

            success: true,

            message:
                "Exam deleted successfully"

        });

    }
    catch (error) {

        console.error(
            "DELETE EXAM ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

};


// =====================================================
// GET EXAM SUBJECTS
//
// GET /api/exams/:id/subjects
// =====================================================

export const getExamSubjects = async (
    req,
    res
) => {

    try {

        const {
            id
        } = req.params;


        if (!id) {

            return res.status(400).json({

                success: false,

                message:
                    "Exam ID is required"

            });

        }


        const {
            data: examSubjects,
            error: examSubjectsError
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
                created_at
            `)

            .eq(
                "exam_id",
                id
            );


        if (examSubjectsError) {

            throw examSubjectsError;

        }


        if (
            !examSubjects ||
            examSubjects.length === 0
        ) {

            return res.json({

                success: true,

                exam_id:
                    id,

                subjects: []

            });

        }


        const subjectIds = [
            ...new Set(
                examSubjects
                    .map(
                        item =>
                            item.subject_id
                    )
                    .filter(
                        value =>
                            value !== null &&
                            value !== undefined
                    )
            )
        ];


        const classIds = [
            ...new Set(
                examSubjects
                    .map(
                        item =>
                            item.class_id
                    )
                    .filter(
                        value =>
                            value !== null &&
                            value !== undefined
                    )
            )
        ];


        let subjects = [];


        if (
            subjectIds.length > 0
        ) {

            const {
                data,
                error
            } = await supabase

                .from("subjects")

                .select(`
                    id,
                    subject_name,
                    subject_code,
                    education_level,
                    is_compulsory,
                    is_active,
                    class_scope
                `)

                .in(
                    "id",
                    subjectIds
                );


            if (error) {

                throw error;

            }


            subjects =
                data || [];

        }


        let classes = [];


        if (
            classIds.length > 0
        ) {

            const {
                data,
                error
            } = await supabase

                .from("classes")

                .select(`
                    id,
                    school_id,
                    academic_level,
                    class_name,
                    short_name,
                    academic_year_id
                `)

                .in(
                    "id",
                    classIds
                );


            if (error) {

                throw error;

            }


            classes =
                data || [];

        }


        const {
            data: questions,
            error: questionsError
        } = await supabase

            .from("exam_questions")

            .select(`
                id,
                exam_id,
                subject_id,
                question_number,
                max_marks
            `)

            .eq(
                "exam_id",
                id
            );


        if (questionsError) {

            throw questionsError;

        }


        const result =
            examSubjects.map(
                examSubject => {

                    const subject =
                        subjects.find(
                            item =>
                                Number(
                                    item.id
                                ) ===
                                Number(
                                    examSubject.subject_id
                                )
                        );


                    const classData =
                        classes.find(
                            item =>
                                Number(
                                    item.id
                                ) ===
                                Number(
                                    examSubject.class_id
                                )
                        );


                    const subjectQuestions =
                        (
                            questions ||
                            []
                        ).filter(
                            question =>
                                Number(
                                    question.subject_id
                                ) ===
                                Number(
                                    examSubject.subject_id
                                )
                        );


                    const effectiveQuestions =
                        getEffectiveQuestions(
                            subjectQuestions,
                            examSubject
                        );


                    const calculatedFullMarks =
                        calculateEffectiveFullMarks(
                            subjectQuestions,
                            examSubject
                        );


                    return {

                        ...examSubject,

                        subject:
                            subject ||
                            null,

                        class:
                            classData ||
                            null,

                        total_questions:
                            subjectQuestions.length,

                        effective_questions:
                            effectiveQuestions.length,

                        calculated_full_marks:
                            calculatedFullMarks

                    };

                }
            );


        return res.json({

            success: true,

            exam_id:
                id,

            subjects:
                result

        });

    }
    catch (error) {

        console.error(
            "GET EXAM SUBJECTS ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error.message,

            details:
                error.details || null,

            hint:
                error.hint || null,

            code:
                error.code || null

        });

    }

};


// =====================================================
// GET STUDENTS FOR EXAM SUBJECT
//
// GET /api/exams/exam-subject/:examSubjectId/students
// =====================================================

export const getStudentsForExamSubject = async (
    req,
    res
) => {

    try {

        const {
            examSubjectId
        } = req.params;


        if (!examSubjectId) {

            return res.status(400).json({

                success: false,

                message:
                    "Exam subject ID is required"

            });

        }


        // =================================================
        // 1. LOAD EXAM SUBJECT
        // =================================================

        const {
            data: examSubject,
            error: examSubjectError
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
                created_at
            `)

            .eq(
                "id",
                examSubjectId
            )

            .single();


        if (examSubjectError) {

            return res.status(404).json({

                success: false,

                message:
                    examSubjectError.message,

                code:
                    examSubjectError.code ||
                    null

            });

        }


        if (!examSubject) {

            return res.status(404).json({

                success: false,

                message:
                    "Exam subject not found"

            });

        }


        if (
            !examSubject.subject_id ||
            !examSubject.class_id
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "This exam subject does not have both subject_id and class_id."

            });

        }


        // =================================================
        // 2. LOAD SUBJECT
        // =================================================

        const {
            data: subject,
            error: subjectError
        } = await supabase

            .from("subjects")

            .select(`
                id,
                subject_name,
                subject_code,
                education_level,
                class_scope
            `)

            .eq(
                "id",
                examSubject.subject_id
            )

            .single();


        if (subjectError) {

            throw subjectError;

        }


        // =================================================
        // 3. LOAD CLASS
        // =================================================

        const {
            data: classData,
            error: classError
        } = await supabase

            .from("classes")

            .select(`
                id,
                school_id,
                academic_level,
                class_name,
                short_name,
                academic_year_id
            `)

            .eq(
                "id",
                examSubject.class_id
            )

            .single();


        if (classError) {

            throw classError;

        }


        // =================================================
        // 4. LOAD QUESTIONS
        // =================================================

        const {
            data: questions,
            error: questionsError
        } = await supabase

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
                ai_confidence,
                ai_explanation,
                ai_processed,
                max_marks
            `)

            .eq(
                "exam_id",
                examSubject.exam_id
            )

            .eq(
                "subject_id",
                examSubject.subject_id
            );


        if (questionsError) {

            throw questionsError;

        }


        const allQuestions =
            questions || [];


        const effectiveQuestions =
            getEffectiveQuestions(
                allQuestions,
                examSubject
            );


        const effectiveQuestionIds =
            getEffectiveQuestionIds(
                allQuestions,
                examSubject
            );


        // =================================================
        // 5. LOAD REGISTERED STUDENTS
        // =================================================

        const {
            data: studentSubjectRows,
            error: studentSubjectError
        } = await supabase

            .from("student_subjects")

            .select(`
                id,
                student_id,
                subject_id,
                class_id,
                created_at
            `)

            .eq(
                "subject_id",
                examSubject.subject_id
            )

            .eq(
                "class_id",
                examSubject.class_id
            );


        if (studentSubjectError) {

            throw studentSubjectError;

        }


        const studentIds = [
            ...new Set(
                (
                    studentSubjectRows ||
                    []
                )
                    .map(
                        row =>
                            row.student_id
                    )
                    .filter(
                        value =>
                            value !== null &&
                            value !== undefined
                    )
            )
        ];


        if (
            studentIds.length === 0
        ) {

            return res.json({

                success: true,

                exam_subject: {

                    ...examSubject,

                    subject,

                    class:
                        classData,

                    total_questions:
                        allQuestions.length,

                    effective_questions:
                        effectiveQuestions.length,

                    calculated_full_marks:
                        calculateEffectiveFullMarks(
                            allQuestions,
                            examSubject
                        )

                },

                questions:
                    effectiveQuestions,

                all_questions:
                    allQuestions,

                students: [],

                total_students:
                    0,

                message:
                    "Hakuna wanafunzi waliosajiliwa kwenye subject hii kwa class hii."

            });

        }


        // =================================================
        // 6. LOAD STUDENTS
        // =================================================

        const {
            data: students,
            error: studentsError
        } = await supabase

            .from("students")

            .select(`
                id,
                admission_number,
                admission_no,
                first_name,
                middle_name,
                last_name,
                gender,
                current_class_id,
                academic_year_id,
                admission_date,
                student_status,
                status,
                class_name,
                stream,
                photo,
                photo_url
            `)

            .in(
                "id",
                studentIds
            )

            .order(
                "first_name",
                {
                    ascending: true
                }
            );


        if (studentsError) {

            throw studentsError;

        }


        // =================================================
        // 7. LOAD QUESTION MARKS
        // =================================================

        const {
            data: existingQuestionMarks,
            error: questionMarksError
        } = await supabase

            .from(
                "student_question_marks"
            )

            .select(`
                id,
                exam_id,
                exam_subject_id,
                question_id,
                student_id,
                marks_obtained
            `)

            .eq(
                "exam_id",
                examSubject.exam_id
            )

            .eq(
                "exam_subject_id",
                examSubject.id
            );


        if (questionMarksError) {

            throw questionMarksError;

        }


        // =================================================
        // 8. LOAD OLD SUBJECT MARKS
        // =================================================

        const {
            data: existingMarks,
            error: marksError
        } = await supabase

            .from("exam_marks")

            .select(`
                id,
                exam_id,
                exam_subject_id,
                student_id,
                marks_obtained,
                grade,
                remark,
                created_at,
                created_by
            `)

            .eq(
                "exam_subject_id",
                examSubject.id
            );


        if (marksError) {

            throw marksError;

        }


        // =================================================
        // 9. ATTACH MARKS
        // =================================================

        const studentsWithMarks =
            (students || []).map(
                student => {

                    const studentQuestionMarks =
                        (
                            existingQuestionMarks ||
                            []
                        )
                            .filter(
                                mark =>
                                    String(
                                        mark.student_id
                                    ) ===
                                    String(
                                        student.id
                                    )
                            )
                            .filter(
                                mark =>
                                    effectiveQuestionIds.has(
                                        String(
                                            mark.question_id
                                        )
                                    )
                            );


                    const total =
                        studentQuestionMarks.reduce(
                            (
                                sum,
                                mark
                            ) =>
                                sum +
                                (
                                    Number(
                                        mark.marks_obtained
                                    ) || 0
                                ),
                            0
                        );


                    const oldMark =
                        (
                            existingMarks ||
                            []
                        ).find(
                            mark =>
                                String(
                                    mark.student_id
                                ) ===
                                String(
                                    student.id
                                )
                        );


                    return {

                        ...student,

                        mark:
                            oldMark ||
                            null,

                        marks:
                            oldMark
                                ? oldMark.marks_obtained
                                : "",

                        question_marks:
                            studentQuestionMarks,

                        total:
                            Number(
                                total.toFixed(2)
                            )

                    };

                }
            );


        const calculatedFullMarks =
            calculateEffectiveFullMarks(
                allQuestions,
                examSubject
            );


        return res.json({

            success: true,

            exam_subject: {

                ...examSubject,

                subject,

                class:
                    classData,

                total_questions:
                    allQuestions.length,

                effective_questions:
                    effectiveQuestions.length,

                calculated_full_marks:
                    calculatedFullMarks

            },

            questions:
                effectiveQuestions,

            all_questions:
                allQuestions,

            students:
                studentsWithMarks,

            total_students:
                studentsWithMarks.length

        });

    }
    catch (error) {

        console.error(
            "GET STUDENTS FOR EXAM SUBJECT ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error.message,

            details:
                error.details || null,

            hint:
                error.hint || null,

            code:
                error.code || null

        });

    }

};


// =====================================================
// SAVE EXAM MARKS
//
// POST /api/exams/marks
// =====================================================

export const saveExamMarks = async (
    req,
    res
) => {

    try {

        const {
            exam_id,
            subject_id,
            class_id,
            entered_by,
            marks
        } = req.body;


        if (
            !exam_id ||
            !subject_id ||
            !class_id
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "exam_id, subject_id and class_id are required"

            });

        }


        if (
            !Array.isArray(marks) ||
            marks.length === 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Marks list is required"

            });

        }


        // =================================================
        // FIND EXAM SUBJECT
        // =================================================

        const {
            data: examSubject,
            error: examSubjectError
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
                questions_to_answer
            `)

            .eq(
                "exam_id",
                exam_id
            )

            .eq(
                "subject_id",
                subject_id
            )

            .eq(
                "class_id",
                class_id
            )

            .single();


        if (examSubjectError) {

            return res.status(404).json({

                success: false,

                message:
                    examSubjectError.message,

                code:
                    examSubjectError.code ||
                    null

            });

        }


        if (!examSubject) {

            return res.status(404).json({

                success: false,

                message:
                    "Exam subject for this class was not found"

            });

        }


        // =================================================
        // LOAD QUESTIONS
        // =================================================

        const {
            data: questions,
            error: questionsError
        } = await supabase

            .from("exam_questions")

            .select(`
                id,
                exam_id,
                subject_id,
                question_number,
                max_marks
            `)

            .eq(
                "exam_id",
                exam_id
            )

            .eq(
                "subject_id",
                subject_id
            );


        if (questionsError) {

            throw questionsError;

        }


        const allQuestions =
            questions || [];


        const effectiveQuestions =
            getEffectiveQuestions(
                allQuestions,
                examSubject
            );


        const effectiveFullMarks =
            calculateEffectiveFullMarks(
                allQuestions,
                examSubject
            );


        // =================================================
        // SELECTIVE VALIDATION
        // =================================================

        if (
            normalizeSelectionType(
                examSubject.question_selection_type
            ) === "SELECTIVE"
        ) {

            const questionsToAnswer =
                Number(
                    examSubject.questions_to_answer
                );


            if (
                !Number.isInteger(
                    questionsToAnswer
                ) ||
                questionsToAnswer <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "questions_to_answer must be a positive integer for SELECTIVE exam subjects."

                });

            }


            if (
                questionsToAnswer >
                allQuestions.length
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        `questions_to_answer (${questionsToAnswer}) cannot be greater than available questions (${allQuestions.length}).`

                });

            }

        }


        // =================================================
        // VALIDATE STUDENTS
        // =================================================

        const studentIds =
            marks
                .filter(
                    item =>
                        item &&
                        item.student_id
                )
                .map(
                    item =>
                        item.student_id
                );


        if (
            studentIds.length > 0
        ) {

            const {
                data: registeredStudents,
                error: registeredStudentsError
            } = await supabase

                .from(
                    "student_subjects"
                )

                .select(`
                    student_id
                `)

                .eq(
                    "subject_id",
                    subject_id
                )

                .eq(
                    "class_id",
                    class_id
                )

                .in(
                    "student_id",
                    studentIds
                );


            if (registeredStudentsError) {

                throw registeredStudentsError;

            }


            const registeredStudentIds =
                new Set(
                    (
                        registeredStudents ||
                        []
                    ).map(
                        row =>
                            String(
                                row.student_id
                            )
                    )
                );


            for (
                const studentId of studentIds
            ) {

                if (
                    !registeredStudentIds.has(
                        String(
                            studentId
                        )
                    )
                ) {

                    return res.status(400).json({

                        success: false,

                        message:
                            `Student ${studentId} hajasajiliwa kwenye subject hii na class hii.`

                    });

                }

            }

        }


        // =================================================
        // VALIDATE MARK VALUES
        // =================================================

        for (
            const item of marks
        ) {

            if (
                !item ||
                !item.student_id
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Every mark record must contain student_id"

                });

            }


            if (
                item.marks === "" ||
                item.marks === null ||
                item.marks === undefined
            ) {

                continue;

            }


            const numericMarks =
                Number(
                    item.marks
                );


            if (
                Number.isNaN(
                    numericMarks
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        `Invalid marks for student ${item.student_id}`

                });

            }


            if (
                numericMarks < 0 ||
                numericMarks >
                Number(
                    examSubject.full_marks
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        `Marks must be between 0 and ${examSubject.full_marks}`

                });

            }

        }


        const recordsToSave =
            marks.filter(
                item =>
                    item &&
                    item.marks !== "" &&
                    item.marks !== null &&
                    item.marks !== undefined
            );


        if (
            recordsToSave.length === 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "No marks were entered"

            });

        }


        // =================================================
        // SAVE MARKS
        // =================================================

        const savedMarks = [];


        for (
            const item of recordsToSave
        ) {

            const numericMarks =
                Number(
                    item.marks
                );


            const percentage =
                Number(
                    examSubject.full_marks
                ) > 0

                    ? (
                        numericMarks /
                        Number(
                            examSubject.full_marks
                        )
                    ) *
                    100

                    : 0;


            const grade =
                getGrade(
                    percentage
                );


            const remark =
                getRemark(
                    percentage
                );


            // =================================================
            // FIND EXISTING
            // =================================================

            const {
                data: existingMark,
                error: existingMarkError
            } = await supabase

                .from("exam_marks")

                .select(`
                    id,
                    exam_id,
                    exam_subject_id,
                    student_id,
                    marks_obtained,
                    grade,
                    remark,
                    created_at,
                    created_by
                `)

                .eq(
                    "exam_id",
                    exam_id
                )

                .eq(
                    "exam_subject_id",
                    examSubject.id
                )

                .eq(
                    "student_id",
                    item.student_id
                )

                .maybeSingle();


            if (existingMarkError) {

                throw existingMarkError;

            }


            // =================================================
            // UPDATE
            // =================================================

            if (existingMark) {

                const {
                    data: updatedMark,
                    error: updateError
                } = await supabase

                    .from(
                        "exam_marks"
                    )

                    .update({

                        marks_obtained:
                            numericMarks,

                        grade,

                        remark,

                        created_by:
                            entered_by ||
                            null

                    })

                    .eq(
                        "id",
                        existingMark.id
                    )

                    .select(`
                        id,
                        exam_id,
                        exam_subject_id,
                        student_id,
                        marks_obtained,
                        grade,
                        remark,
                        created_at,
                        created_by
                    `)

                    .single();


                if (updateError) {

                    throw updateError;

                }


                savedMarks.push(
                    updatedMark
                );

            }

            // =================================================
            // INSERT
            // =================================================

            else {

                const {
                    data: insertedMark,
                    error: insertError
                } = await supabase

                    .from(
                        "exam_marks"
                    )

                    .insert([
                        {

                            exam_id,

                            exam_subject_id:
                                examSubject.id,

                            student_id:
                                item.student_id,

                            marks_obtained:
                                numericMarks,

                            grade,

                            remark,

                            created_by:
                                entered_by ||
                                null

                        }
                    ])

                    .select(`
                        id,
                        exam_id,
                        exam_subject_id,
                        student_id,
                        marks_obtained,
                        grade,
                        remark,
                        created_at,
                        created_by
                    `)

                    .single();


                if (insertError) {

                    throw insertError;

                }


                savedMarks.push(
                    insertedMark
                );

            }

        }


        return res.json({

            success: true,

            message:
                "Marks saved successfully",

            selection: {

                type:
                    normalizeSelectionType(
                        examSubject.question_selection_type
                    ),

                questions_to_answer:
                    examSubject.questions_to_answer,

                available_questions:
                    allQuestions.length,

                effective_questions:
                    effectiveQuestions.length,

                calculated_full_marks:
                    effectiveFullMarks,

                configured_full_marks:
                    examSubject.full_marks

            },

            marks:
                savedMarks

        });

    }
    catch (error) {

        console.error(
            "SAVE EXAM MARKS ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error.message,

            details:
                error.details || null,

            hint:
                error.hint || null,

            code:
                error.code || null

        });

    }

};


// =====================================================
// AI EXAM ANALYSIS
//
// GET /api/exams/:id/ai-analysis
// =====================================================

export const analyzeExamWithAI = async (
    req,
    res
) => {

    try {

        const {
            id
        } = req.params;


        if (!id) {

            return res.status(400).json({

                success: false,

                message:
                    "Exam ID is required"

            });

        }


        // =================================================
        // LOAD EXAM
        // =================================================

        const {
            data: exam,
            error: examError
        } = await supabase

            .from("exams")

            .select("*")

            .eq(
                "id",
                id
            )

            .single();


        if (examError) {

            return res.status(404).json({

                success: false,

                message:
                    examError.message

            });

        }


        if (!exam) {

            return res.status(404).json({

                success: false,

                message:
                    "Exam not found"

            });

        }


        // =================================================
        // LOAD EXAM SUBJECTS
        // =================================================

        const {
            data: examSubjects,
            error: examSubjectsError
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
                questions_to_answer
            `)

            .eq(
                "exam_id",
                id
            );


        if (examSubjectsError) {

            throw examSubjectsError;

        }


        // =================================================
        // LOAD QUESTIONS
        // =================================================

        const {
            data: questions,
            error: questionError
        } = await supabase

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
                ai_confidence,
                ai_explanation,
                ai_processed,
                max_marks
            `)

            .eq(
                "exam_id",
                id
            );


        if (questionError) {

            throw questionError;

        }


        // =================================================
        // PREPARE ANALYSIS
        // =================================================

        const analysisSubjects =
            (
                examSubjects ||
                []
            ).map(
                examSubject => {

                    const subjectQuestions =
                        (
                            questions ||
                            []
                        ).filter(
                            question =>
                                Number(
                                    question.subject_id
                                ) ===
                                Number(
                                    examSubject.subject_id
                                )
                        );


                    const effectiveQuestions =
                        getEffectiveQuestions(
                            subjectQuestions,
                            examSubject
                        );


                    return {

                        exam_subject:
                            examSubject,

                        available_questions:
                            subjectQuestions.length,

                        effective_questions:
                            effectiveQuestions.length,

                        calculated_full_marks:
                            calculateEffectiveFullMarks(
                                subjectQuestions,
                                examSubject
                            ),

                        questions:
                            effectiveQuestions

                    };

                }
            );


        // =================================================
        // AI PROMPT
        // =================================================

        const prompt = `
You are AfriCore ERP PRO Educational AI.

Analyze this examination accurately.

EXAM:
${JSON.stringify(
    exam,
    null,
    2
)}

EXAM SUBJECT CONFIGURATION:
${JSON.stringify(
    analysisSubjects,
    null,
    2
)}

IMPORTANT:

For subjects configured as SELECTIVE,
analyze only the effective questions selected
according to questions_to_answer.

Analyze:

1. Subject
2. Topics tested
3. Difficulty level
4. Question distribution
5. Weak areas
6. Skills tested
7. Quality of examination
8. Selective question configuration
9. Teacher recommendations

Return valid JSON only.
`;


        // =================================================
        // GEMINI
        // =================================================

        const aiResult =
            await askGemini(
                prompt
            );


        // =================================================
        // SAVE AI ANALYSIS
        // =================================================

        const {
            data: saved,
            error: saveError
        } = await supabase

            .from(
                "ai_exam_analysis"
            )

            .insert([
                {

                    exam_id:
                        id,

                    summary:
                        aiResult,

                    ai_model:
                        "Gemini",

                    status:
                        "Completed"

                }
            ])

            .select("*");


        if (saveError) {

            throw saveError;

        }


        return res.json({

            success: true,

            message:
                "AI analysis completed successfully",

            analysis:
                saved || []

        });

    }
    catch (error) {

        console.error(
            "AI ANALYSIS ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error.message,

            details:
                error.details ||
                null,

            hint:
                error.hint ||
                null,

            code:
                error.code ||
                null

        });

    }

};


// =====================================================
// RESULTS ANALYSIS
//
// GET /api/exams/:id/results-analysis
// =====================================================

export const getExamResultsAnalysis = async (
    req,
    res
) => {

    try {

        const {
            id
        } = req.params;


        if (!id) {

            return res.status(400).json({

                success: false,

                message:
                    "Exam ID is required"

            });

        }


        // =================================================
        // LOAD EXAM
        // =================================================

        const {
            data: exam,
            error: examError
        } = await supabase

            .from("exams")

            .select("*")

            .eq(
                "id",
                id
            )

            .single();


        if (examError) {

            return res.status(404).json({

                success: false,

                message:
                    examError.message

            });

        }


        if (!exam) {

            return res.status(404).json({

                success: false,

                message:
                    "Exam not found"

            });

        }


        // =================================================
        // LOAD EXAM SUBJECTS
        // =================================================

        const {
            data: examSubjects,
            error: examSubjectsError
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
                created_at
            `)

            .eq(
                "exam_id",
                id
            );


        if (examSubjectsError) {

            throw examSubjectsError;

        }


        if (
            !examSubjects ||
            examSubjects.length === 0
        ) {

            return res.json({

                success: true,

                exam,

                overview: {

                    candidates: 0,

                    subjects: 0,

                    average: 0,

                    pass_rate: 0,

                    highest: 0,

                    lowest: 0,

                    total_possible: 0,

                    total_marks_entered: 0

                },

                subjects: [],

                topics: [],

                students: [],

                grade_distribution: [],

                message:
                    "No subjects found for this examination."

            });

        }


        // =================================================
        // LOAD SUBJECTS
        // =================================================

        const subjectIds = [
            ...new Set(
                examSubjects
                    .map(
                        item =>
                            item.subject_id
                    )
                    .filter(
                        value =>
                            value !== null &&
                            value !== undefined
                    )
            )
        ];


        let subjects = [];


        if (
            subjectIds.length > 0
        ) {

            const {
                data,
                error
            } = await supabase

                .from("subjects")

                .select(`
                    id,
                    subject_name,
                    subject_code,
                    education_level,
                    is_compulsory,
                    is_active,
                    class_scope
                `)

                .in(
                    "id",
                    subjectIds
                );


            if (error) {

                throw error;

            }


            subjects =
                data || [];

        }


        // =================================================
        // LOAD QUESTIONS
        // =================================================

        const {
            data: questions,
            error: questionsError
        } = await supabase

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
                ai_confidence,
                ai_explanation,
                ai_processed,
                max_marks
            `)

            .eq(
                "exam_id",
                id
            );


        if (questionsError) {

            throw questionsError;

        }


        const safeQuestions =
            questions || [];


        // =================================================
        // EFFECTIVE QUESTIONS BY SUBJECT
        // =================================================

        const effectiveQuestionsBySubject =
            new Map();


        const effectiveQuestionIdsBySubject =
            new Map();


        examSubjects.forEach(
            examSubject => {

                const subjectQuestions =
                    safeQuestions.filter(
                        question =>
                            Number(
                                question.subject_id
                            ) ===
                            Number(
                                examSubject.subject_id
                            )
                    );


                const effectiveQuestions =
                    getEffectiveQuestions(
                        subjectQuestions,
                        examSubject
                    );


                effectiveQuestionsBySubject.set(
                    String(
                        examSubject.id
                    ),
                    effectiveQuestions
                );


                effectiveQuestionIdsBySubject.set(
                    String(
                        examSubject.id
                    ),
                    new Set(
                        effectiveQuestions.map(
                            question =>
                                String(
                                    question.id
                                )
                        )
                    )
                );

            }
        );


        // =================================================
        // LOAD QUESTION MARKS
        // =================================================

        const {
            data: questionMarks,
            error: questionMarksError
        } = await supabase

            .from(
                "student_question_marks"
            )

            .select(`
                id,
                exam_id,
                exam_subject_id,
                question_id,
                student_id,
                marks_obtained
            `)

            .eq(
                "exam_id",
                id
            );


        if (questionMarksError) {

            throw questionMarksError;

        }


        const safeQuestionMarks =
            questionMarks || [];


        // =================================================
        // FILTER ONLY EFFECTIVE QUESTIONS
        // =================================================

        const effectiveQuestionMarks =
            safeQuestionMarks.filter(
                mark => {

                    const questionSet =
                        effectiveQuestionIdsBySubject.get(
                            String(
                                mark.exam_subject_id
                            )
                        );


                    if (!questionSet) {

                        return false;

                    }


                    return questionSet.has(
                        String(
                            mark.question_id
                        )
                    );

                }
            );


        // =================================================
        // STUDENT IDS
        // =================================================

        const studentIds = [
            ...new Set(
                effectiveQuestionMarks
                    .map(
                        mark =>
                            mark.student_id
                    )
                    .filter(
                        value =>
                            value !== null &&
                            value !== undefined
                    )
            )
        ];


        // =================================================
        // LOAD STUDENTS
        // =================================================

        let students = [];


        if (
            studentIds.length > 0
        ) {

            const {
                data,
                error
            } = await supabase

                .from("students")

                .select(`
                    id,
                    admission_number,
                    admission_no,
                    first_name,
                    middle_name,
                    last_name,
                    gender,
                    current_class_id,
                    academic_year_id,
                    admission_date,
                    student_status,
                    status,
                    class_name,
                    stream,
                    photo,
                    photo_url
                `)

                .in(
                    "id",
                    studentIds
                );


            if (error) {

                throw error;

            }


            students =
                data || [];

        }


        // =================================================
        // SUBJECT ANALYSIS
        // =================================================

        const subjectAnalysis =
            examSubjects.map(
                examSubject => {

                    const subject =
                        subjects.find(
                            item =>
                                Number(
                                    item.id
                                ) ===
                                Number(
                                    examSubject.subject_id
                                )
                        );


                    const subjectQuestions =
                        safeQuestions.filter(
                            question =>
                                Number(
                                    question.subject_id
                                ) ===
                                Number(
                                    examSubject.subject_id
                                )
                        );


                    const effectiveQuestions =
                        effectiveQuestionsBySubject.get(
                            String(
                                examSubject.id
                            )
                        ) || [];


                    const effectiveIds =
                        new Set(
                            effectiveQuestions.map(
                                question =>
                                    String(
                                        question.id
                                    )
                            )
                        );


                    const subjectMarks =
                        effectiveQuestionMarks.filter(
                            mark =>
                                Number(
                                    mark.exam_subject_id
                                ) ===
                                Number(
                                    examSubject.id
                                ) &&
                                effectiveIds.has(
                                    String(
                                        mark.question_id
                                    )
                                )
                        );


                    const studentMap =
                        new Map();


                    subjectMarks.forEach(
                        mark => {

                            const studentId =
                                String(
                                    mark.student_id
                                );


                            if (
                                !studentMap.has(
                                    studentId
                                )
                            ) {

                                studentMap.set(
                                    studentId,
                                    {
                                        obtained: 0
                                    }
                                );

                            }


                            studentMap.get(
                                studentId
                            ).obtained +=
                                Number(
                                    mark.marks_obtained
                                ) || 0;

                        }
                    );


                    const calculatedFullMarks =
                        calculateEffectiveFullMarks(
                            subjectQuestions,
                            examSubject
                        );


                    const configuredFullMarks =
                        Number(
                            examSubject.full_marks
                        );


                    const fullMarks =
                        Number.isFinite(
                            configuredFullMarks
                        ) &&
                        configuredFullMarks > 0

                            ? configuredFullMarks

                            : calculatedFullMarks;


                    const candidates =
                        studentMap.size;


                    const studentPercentages =
                        Array.from(
                            studentMap.values()
                        ).map(
                            student =>
                                fullMarks > 0

                                    ? (
                                        student.obtained /
                                        fullMarks
                                    ) *
                                    100

                                    : 0
                        );


                    const average =
                        studentPercentages.length > 0

                            ? studentPercentages.reduce(
                                (
                                    total,
                                    value
                                ) =>
                                    total +
                                    value,
                                0
                            ) /
                            studentPercentages.length

                            : 0;


                    const highest =
                        studentPercentages.length > 0

                            ? Math.max(
                                ...studentPercentages
                            )

                            : 0;


                    const lowest =
                        studentPercentages.length > 0

                            ? Math.min(
                                ...studentPercentages
                            )

                            : 0;


                    const passMarks =
                        Number(
                            examSubject.pass_marks
                        ) || 0;


                    const passRate =
                        candidates > 0

                            ? (
                                Array.from(
                                    studentMap.values()
                                ).filter(
                                    student =>
                                        Number(
                                            student.obtained
                                        ) >=
                                        passMarks
                                ).length /
                                candidates
                            ) *
                            100

                            : 0;


                    return {

                        id:
                            examSubject.id,

                        exam_id:
                            examSubject.exam_id,

                        subject_id:
                            examSubject.subject_id,

                        class_id:
                            examSubject.class_id,

                        name:
                            subject?.subject_name ||
                            "Unknown Subject",

                        code:
                            subject?.subject_code ||
                            "",

                        selection_type:
                            normalizeSelectionType(
                                examSubject.question_selection_type
                            ),

                        questions_to_answer:
                            examSubject.questions_to_answer,

                        available_questions:
                            subjectQuestions.length,

                        effective_questions:
                            effectiveQuestions.length,

                        candidates,

                        questions:
                            effectiveQuestions.length,

                        full_marks:
                            fullMarks,

                        calculated_full_marks:
                            calculatedFullMarks,

                        pass_marks:
                            passMarks,

                        average:
                            Number(
                                average.toFixed(2)
                            ),

                        highest:
                            Number(
                                highest.toFixed(2)
                            ),

                        lowest:
                            Number(
                                lowest.toFixed(2)
                            ),

                        pass_rate:
                            Number(
                                passRate.toFixed(2)
                            ),

                        grade:
                            getGrade(
                                average
                            ),

                        performance:
                            getPerformance(
                                average
                            )

                    };

                }
            );


        // =================================================
        // TOPIC ANALYSIS
        // =================================================

        const topicMap =
            new Map();


        effectiveQuestionMarks.forEach(
            mark => {

                const question =
                    safeQuestions.find(
                        item =>
                            String(
                                item.id
                            ) ===
                            String(
                                mark.question_id
                            )
                    );


                if (!question) {

                    return;

                }


                const topicName =
                    String(
                        question.topic ||
                        "Unclassified"
                    ).trim();


                const key =
                    `${question.subject_id}::${topicName}`;


                if (
                    !topicMap.has(key)
                ) {

                    const subject =
                        subjects.find(
                            item =>
                                Number(
                                    item.id
                                ) ===
                                Number(
                                    question.subject_id
                                )
                        );


                    topicMap.set(
                        key,
                        {

                            subject_id:
                                question.subject_id,

                            subject:
                                subject?.subject_name ||
                                "Unknown Subject",

                            topic:
                                topicName,

                            questions:
                                new Set(),

                            max_marks:
                                0,

                            obtained:
                                0,

                            students:
                                new Set()

                        }
                    );

                }


                const topic =
                    topicMap.get(
                        key
                    );


                topic.questions.add(
                    String(
                        question.id
                    )
                );


                topic.obtained +=
                    Number(
                        mark.marks_obtained
                    ) || 0;


                topic.students.add(
                    String(
                        mark.student_id
                    )
                );

            }
        );


        topicMap.forEach(
            topic => {

                topic.max_marks = 0;


                topic.questions.forEach(
                    questionId => {

                        const question =
                            safeQuestions.find(
                                item =>
                                    String(
                                        item.id
                                    ) ===
                                    String(
                                        questionId
                                    )
                            );


                        if (question) {

                            topic.max_marks +=
                                Number(
                                    question.max_marks
                                ) || 0;

                        }

                    }
                );

            }
        );


        const topicAnalysis =
            Array.from(
                topicMap.values()
            ).map(
                topic => {

                    const totalPossible =
                        topic.max_marks *
                        topic.students.size;


                    const performance =
                        totalPossible > 0

                            ? (
                                topic.obtained /
                                totalPossible
                            ) *
                            100

                            : 0;


                    return {

                        subject_id:
                            topic.subject_id,

                        subject:
                            topic.subject,

                        topic:
                            topic.topic,

                        questions:
                            topic.questions.size,

                        max_marks:
                            topic.max_marks,

                        candidates:
                            topic.students.size,

                        obtained:
                            Number(
                                topic.obtained.toFixed(2)
                            ),

                        average:
                            Number(
                                performance.toFixed(2)
                            ),

                        performance:
                            getPerformance(
                                performance
                            )

                    };

                }
            );


        // =================================================
        // STUDENT ANALYSIS
        // =================================================

        const studentMap =
            new Map();


        effectiveQuestionMarks.forEach(
            mark => {

                const studentId =
                    String(
                        mark.student_id
                    );


                if (
                    !studentMap.has(
                        studentId
                    )
                ) {

                    studentMap.set(
                        studentId,
                        {

                            obtained:
                                0,

                            subjects:
                                new Set(),

                            questions:
                                0

                        }
                    );

                }


                const record =
                    studentMap.get(
                        studentId
                    );


                record.obtained +=
                    Number(
                        mark.marks_obtained
                    ) || 0;


                record.questions +=
                    1;


                const examSubject =
                    examSubjects.find(
                        item =>
                            Number(
                                item.id
                            ) ===
                            Number(
                                mark.exam_subject_id
                            )
                    );


                if (examSubject) {

                    record.subjects.add(
                        String(
                            examSubject.subject_id
                        )
                    );

                }

            }
        );


        const totalPossible =
            subjectAnalysis.reduce(
                (
                    total,
                    subject
                ) =>
                    total +
                    Number(
                        subject.full_marks
                    ),
                0
            );


        const studentAnalysis =
            Array.from(
                studentMap.entries()
            ).map(
                (
                    [
                        studentId,
                        record
                    ]
                ) => {

                    const student =
                        students.find(
                            item =>
                                String(
                                    item.id
                                ) ===
                                String(
                                    studentId
                                )
                        );


                    const percentage =
                        totalPossible > 0

                            ? (
                                record.obtained /
                                totalPossible
                            ) *
                            100

                            : 0;


                    return {

                        student_id:
                            studentId,

                        admission_number:
                            student?.admission_number ||
                            student?.admission_no ||
                            "",

                        name:
                            getStudentName(
                                student
                            ),

                        gender:
                            student?.gender ||
                            null,

                        subjects:
                            record.subjects.size,

                        questions:
                            record.questions,

                        total:
                            Number(
                                record.obtained.toFixed(2)
                            ),

                        total_possible:
                            totalPossible,

                        percentage:
                            Number(
                                percentage.toFixed(2)
                            ),

                        grade:
                            getGrade(
                                percentage
                            ),

                        remark:
                            getRemark(
                                percentage
                            )

                    };

                }
            );


        // =================================================
        // RANK
        // =================================================

        studentAnalysis.sort(
            (
                a,
                b
            ) =>
                b.percentage -
                a.percentage
        );


        let previousPercentage =
            null;


        let currentPosition =
            0;


        studentAnalysis.forEach(
            (
                student,
                index
            ) => {

                if (
                    previousPercentage === null ||
                    student.percentage !==
                    previousPercentage
                ) {

                    currentPosition =
                        index + 1;

                }


                student.position =
                    currentPosition;


                previousPercentage =
                    student.percentage;

            }
        );


        // =================================================
        // GRADE DISTRIBUTION
        // =================================================

        const grades = [
            "A",
            "B",
            "C",
            "D",
            "F"
        ];


        const gradeDistribution =
            grades.map(
                grade => {

                    const count =
                        studentAnalysis.filter(
                            student =>
                                student.grade ===
                                grade
                        ).length;


                    const percentage =
                        studentAnalysis.length > 0

                            ? (
                                count /
                                studentAnalysis.length
                            ) *
                            100

                            : 0;


                    return {

                        grade,

                        count,

                        percentage:
                            Number(
                                percentage.toFixed(2)
                            )

                    };

                }
            );


        // =================================================
        // OVERALL
        // =================================================

        const subjectAverages =
            subjectAnalysis
                .map(
                    subject =>
                        Number(
                            subject.average
                        )
                )
                .filter(
                    value =>
                        Number.isFinite(
                            value
                        )
                );


        const overallAverage =
            subjectAverages.length > 0

                ? subjectAverages.reduce(
                    (
                        total,
                        value
                    ) =>
                        total +
                        value,
                    0
                ) /
                subjectAverages.length

                : 0;


        const highest =
            subjectAnalysis.length > 0

                ? Math.max(
                    ...subjectAnalysis.map(
                        subject =>
                            Number(
                                subject.highest
                            )
                    )
                )

                : 0;


        const lowest =
            subjectAnalysis.length > 0

                ? Math.min(
                    ...subjectAnalysis.map(
                        subject =>
                            Number(
                                subject.lowest
                            )
                    )
                )

                : 0;


        const totalCandidates =
            studentAnalysis.length;


        const passedStudents =
            studentAnalysis.filter(
                student =>
                    student.grade !== "F"
            ).length;


        const overallPassRate =
            totalCandidates > 0

                ? (
                    passedStudents /
                    totalCandidates
                ) *
                100

                : 0;


        // =================================================
        // RESPONSE
        // =================================================

        return res.json({

            success: true,

            exam,

            overview: {

                candidates:
                    totalCandidates,

                subjects:
                    examSubjects.length,

                average:
                    Number(
                        overallAverage.toFixed(2)
                    ),

                pass_rate:
                    Number(
                        overallPassRate.toFixed(2)
                    ),

                highest:
                    Number(
                        highest.toFixed(2)
                    ),

                lowest:
                    Number(
                        lowest.toFixed(2)
                    ),

                total_possible:
                    totalPossible,

                total_marks_entered:
                    effectiveQuestionMarks.length

            },

            grade_distribution:
                gradeDistribution,

            subjects:
                subjectAnalysis,

            topics:
                topicAnalysis,

            students:
                studentAnalysis

        });

    }
    catch (error) {

        console.error(
            "GET EXAM RESULTS ANALYSIS ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error.message,

            details:
                error.details ||
                null,

            hint:
                error.hint ||
                null,

            code:
                error.code ||
                null

        });

    }

};