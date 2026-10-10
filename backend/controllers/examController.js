import { supabase } from "../config/supabase.js";
import { askGemini } from "../services/gemini.service.js";

// =====================================================
// GET ALL EXAMS
// GET /api/exams
// =====================================================

export const getExams = async (req, res) => {
    try {
        const { academic_year_id } = req.query;
        const schoolId = req.schoolContext?.isSuperAdmin
            ? Number(req.query.school_id)
            : Number(req.schoolContext?.schoolId);
        if (!Number.isInteger(schoolId) || schoolId <= 0) {
            return res.status(400).json({ success: false, message: "A valid school must be selected." });
        }

        if (!academic_year_id) {
            return res.status(400).json({
                success: false,
                message: "Active academic year is required."
            });
        }

        let query = supabase
            .from("exams")
            .select("*")
            .eq("academic_year_id", Number(academic_year_id))
            .order("created_at", { ascending: false });

        query = query.eq("school_id", schoolId);

        const { data, error } = await query;

        if (error) {
            throw error;
        }

        return res.json({
            success: true,
            exams: data || []
        });

    } catch (error) {
        console.error("GET EXAMS ERROR:", error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// =====================================================
// GET SINGLE EXAM
// GET /api/exams/:id
// =====================================================

export const getExamById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Exam ID is required"
            });
        }

        let examQuery = supabase
            .from("exams")
            .select("*")
            .eq("id", id);

        if (!req.schoolContext?.isSuperAdmin) {
            examQuery = examQuery.eq("school_id", Number(req.schoolContext?.schoolId));
        } else if (req.query?.school_id) {
            examQuery = examQuery.eq("school_id", Number(req.query.school_id));
        }

        const { data, error } = await examQuery.maybeSingle();
        if (error) throw error;
        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Examination not found in your school."
            });
        }

        return res.json({ success: true, exam: data });

    } catch (error) {
        console.error("GET EXAM BY ID ERROR:", error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// =====================================================
// CREATE EXAM
// POST /api/exams
// =====================================================

export const createExam = async (req, res) => {
    try {
        const examData = { ...(req.body || {}) };

        if (!req.body) {
            return res.status(400).json({
                success: false,
                message: "Exam data is required"
            });
        }

        const requestedSchoolId = examData.school_id == null || examData.school_id === "" ? null : Number(examData.school_id);
        const schoolId = req.schoolContext?.isSuperAdmin
            ? (requestedSchoolId || Number(req.schoolContext?.schoolId))
            : Number(req.schoolContext?.schoolId);

        const academicYearId = examData.academic_year_id
            ? Number(examData.academic_year_id)
            : null;

        if (!schoolId) {
            return res.status(400).json({
                success: false,
                message:
                    "School is required when creating an examination."
            });
        }

        if (!academicYearId) {
            return res.status(400).json({
                success: false,
                message:
                    "Active academic year is required when creating an examination."
            });
        }

        const {
            data: academicYear,
            error: academicYearError
        } = await supabase
            .from("academic_years")
            .select(
                "id, school_id, year_name, term, is_active"
            )
            .eq("id", academicYearId)
            .eq("school_id", schoolId)
            .maybeSingle();

        if (academicYearError) {
            throw academicYearError;
        }

        if (!academicYear) {
            return res.status(400).json({
                success: false,
                message:
                    "The selected academic year does not belong to this school."
            });
        }

        if (academicYear.is_active === false) {
            return res.status(400).json({
                success: false,
                message:
                    "The selected academic year is not active."
            });
        }

        examData.school_id = schoolId;
        examData.academic_year_id = academicYearId;

        const {
            data,
            error
        } = await supabase
            .from("exams")
            .insert([examData])
            .select()
            .single();

        if (error) {
            throw error;
        }

        return res.status(201).json({
            success: true,
            message: "Exam created successfully",
            exam: data
        });

    } catch (error) {
        console.error("CREATE EXAM ERROR:", error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// =====================================================
// UPDATE EXAM
// PUT /api/exams/:id
// =====================================================

export const updateExam = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: "Valid Exam ID is required." });
        }

        let existingQuery = supabase
            .from("exams")
            .select("id, school_id, academic_year_id")
            .eq("id", id);

        if (!req.schoolContext?.isSuperAdmin) {
            existingQuery = existingQuery.eq("school_id", Number(req.schoolContext?.schoolId));
        }

        const { data: existing, error: existingError } = await existingQuery.maybeSingle();
        if (existingError) throw existingError;
        if (!existing) {
            return res.status(404).json({ success: false, message: "Examination not found in your school." });
        }

        const schoolId = Number(existing.school_id);
        const updates = { ...(req.body || {}), school_id: schoolId };
        delete updates.id;
        delete updates.created_at;

        if (updates.academic_year_id != null) {
            const yearId = Number(updates.academic_year_id);
            const { data: year, error: yearError } = await supabase
                .from("academic_years")
                .select("id, school_id")
                .eq("id", yearId)
                .eq("school_id", schoolId)
                .maybeSingle();

            if (yearError) throw yearError;
            if (!year) {
                return res.status(400).json({
                    success: false,
                    message: "The selected academic year does not belong to this school."
                });
            }
            updates.academic_year_id = yearId;
        }

        const { data, error } = await supabase
            .from("exams")
            .update(updates)
            .eq("id", id)
            .eq("school_id", schoolId)
            .select()
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            return res.status(404).json({ success: false, message: "Examination not found in your school." });
        }

        return res.json({ success: true, message: "Exam updated successfully", exam: data });
    } catch (error) {
        console.error("UPDATE EXAM ERROR:", error);
        return res.status(500).json({ success: false, message: "Unable to update examination." });
    }
};


// =====================================================
// DELETE EXAM
// DELETE /api/exams/:id
// =====================================================

export const deleteExam = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: "Valid Exam ID is required." });
        }

        let existingQuery = supabase
            .from("exams")
            .select("id, school_id")
            .eq("id", id);

        if (!req.schoolContext?.isSuperAdmin) {
            existingQuery = existingQuery.eq("school_id", Number(req.schoolContext?.schoolId));
        }

        const { data: existing, error: existingError } = await existingQuery.maybeSingle();
        if (existingError) throw existingError;
        if (!existing) {
            return res.status(404).json({ success: false, message: "Examination not found in your school." });
        }

        const { error } = await supabase
            .from("exams")
            .delete()
            .eq("id", id)
            .eq("school_id", Number(existing.school_id));

        if (error) throw error;

        return res.json({ success: true, message: "Exam deleted successfully" });
    } catch (error) {
        console.error("DELETE EXAM ERROR:", error);
        return res.status(500).json({ success: false, message: "Unable to delete examination." });
    }
};


// =====================================================
// GET SUBJECTS + CLASSES FOR EXAM
// GET /api/exams/:id/subjects
// =====================================================

export const getExamSubjects = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Exam ID is required"
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
                created_at
            `)
            .eq("exam_id", id);

        if (examSubjectsError) {
            throw examSubjectsError;
        }

        if (!examSubjects || examSubjects.length === 0) {
            return res.json({
                success: true,
                exam_id: id,
                subjects: []
            });
        }

        const subjectIds = [
            ...new Set(
                examSubjects
                    .map(item => item.subject_id)
                    .filter(
                        id =>
                            id !== null &&
                            id !== undefined
                    )
            )
        ];

        const classIds = [
            ...new Set(
                examSubjects
                    .map(item => item.class_id)
                    .filter(
                        id =>
                            id !== null &&
                            id !== undefined
                    )
            )
        ];

        let subjects = [];

        if (subjectIds.length > 0) {
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
                .in("id", subjectIds);

            if (error) {
                throw error;
            }

            subjects = data || [];
        }

        let classes = [];

        if (classIds.length > 0) {
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
                .in("id", classIds);

            if (error) {
                throw error;
            }

            classes = data || [];
        }

        const result = examSubjects.map(examSubject => {

            const subject = subjects.find(
                item =>
                    Number(item.id) ===
                    Number(examSubject.subject_id)
            );

            const classData = classes.find(
                item =>
                    Number(item.id) ===
                    Number(examSubject.class_id)
            );

            return {
                id: examSubject.id,

                exam_id:
                    examSubject.exam_id,

                subject_id:
                    examSubject.subject_id,

                class_id:
                    examSubject.class_id,

                full_marks:
                    examSubject.full_marks,

                pass_marks:
                    examSubject.pass_marks,

                created_at:
                    examSubject.created_at,

                subject:
                    subject || null,

                class:
                    classData || null
            };
        });

        return res.json({
            success: true,
            exam_id: id,
            subjects: result
        });

    } catch (error) {
        console.error(
            "GET EXAM SUBJECTS ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// =====================================================
// GET STUDENTS FOR EXAM SUBJECT
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

        // -------------------------------------------------
        // Get exam subject
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
                class_id,
                full_marks,
                pass_marks,
                created_at
            `)
            .eq("id", examSubjectId)
            .single();

        if (examSubjectError) {
            throw examSubjectError;
        }

        if (!examSubject) {
            return res.status(404).json({
                success: false,
                message:
                    "Exam subject not found"
            });
        }

        // -------------------------------------------------
        // Get examination academic year
        // -------------------------------------------------

        const {
            data: examData,
            error: examError
        } = await supabase
            .from("exams")
            .select(
                "id, academic_year_id, school_id, status"
            )
            .eq(
                "id",
                examSubject.exam_id
            )
            .single();

        if (examError) {
            throw examError;
        }

        // -------------------------------------------------
        // Get subject
        // -------------------------------------------------

        let subject = null;

        if (examSubject.subject_id) {

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
                    class_scope
                `)
                .eq(
                    "id",
                    examSubject.subject_id
                )
                .single();

            if (error) {
                throw error;
            }

            subject = data;
        }

        // -------------------------------------------------
        // Get class
        // -------------------------------------------------

        let classData = null;

        if (examSubject.class_id) {

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
                .eq(
                    "id",
                    examSubject.class_id
                )
                .single();

            if (error) {
                throw error;
            }

            classData = data;
        }

        // -------------------------------------------------
        // GET STUDENTS
        // -------------------------------------------------
        //
        // Historical examinations use
        // student_academic_history.
        //
        // Current examinations can fall back to the
        // current students table.
        // -------------------------------------------------

        let students = [];

        if (
            examData?.academic_year_id !== null &&
            examData?.academic_year_id !== undefined
        ) {

            const {
                data: historyRows,
                error: historyError
            } = await supabase
                .from(
                    "student_academic_history"
                )
                .select(`
                    student_id,
                    academic_year_id,
                    to_class_id,
                    student_status
                `)
                .eq(
                    "academic_year_id",
                    examData.academic_year_id
                )
                .eq(
                    "to_class_id",
                    examSubject.class_id
                )
                .eq(
                    "student_status",
                    "Active"
                );

            if (historyError) {
                throw historyError;
            }

            const historicalStudentIds = [
                ...new Set(
                    (historyRows || [])
                        .map(row => row.student_id)
                        .filter(Boolean)
                )
            ];

            if (
                historicalStudentIds.length > 0
            ) {

                const {
                    data: historicalStudents,
                    error:
                        historicalStudentsError
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
                        historicalStudentIds
                    );

                if (historicalStudentsError) {
                    throw historicalStudentsError;
                }

                students =
                    historicalStudents || [];
            }
        }

        // -------------------------------------------------
        // FALLBACK FOR CURRENT STUDENTS
        // -------------------------------------------------

        if (students.length === 0) {

            let studentQuery = supabase
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
                .eq(
                    "current_class_id",
                    examSubject.class_id
                )
                .eq(
                    "student_status",
                    "Active"
                )
                .eq(
                    "status",
                    "Active"
                );

            if (
                examData?.academic_year_id !== null &&
                examData?.academic_year_id !== undefined
            ) {

                studentQuery =
                    studentQuery.eq(
                        "academic_year_id",
                        examData.academic_year_id
                    );
            }

            const {
                data: fallbackStudents,
                error: studentsError
            } = await studentQuery.order(
                "first_name",
                {
                    ascending: true
                }
            );

            if (studentsError) {
                throw studentsError;
            }

            students =
                fallbackStudents || [];
        }

        students.sort(
            (a, b) =>
                String(
                    a.first_name || ""
                ).localeCompare(
                    String(
                        b.first_name || ""
                    )
                )
        );

        // -------------------------------------------------
        // GET EXISTING QUESTION-LEVEL MARKS
        // -------------------------------------------------
        //
        // IMPORTANT:
        // Current Enter Marks stores marks in
        // exam_question_marks.
        //
        // The old exam_marks query used columns such as:
        // subject_id
        // class_id
        // marks
        // remarks
        // entered_by
        // status
        //
        // Those columns are not present in the current
        // exam_marks structure.
        //
        // Therefore the current Enter Marks flow uses
        // exam_question_marks.
        // -------------------------------------------------

        const {
            data: existingMarks,
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
                is_selected,
                created_at,
                created_by
            `)
            .eq(
                "exam_id",
                examSubject.exam_id
            )
            .eq(
                "exam_subject_id",
                examSubject.id
            );

        if (marksError) {
            throw marksError;
        }

        // -------------------------------------------------
        // ATTACH QUESTION-LEVEL MARKS TO STUDENTS
        // -------------------------------------------------

        const studentsWithMarks =
            (students || []).map(
                student => {

                    const studentQuestionMarks =
                        (existingMarks || [])
                            .filter(
                                item =>
                                    Number(
                                        item.student_id
                                    ) ===
                                    Number(
                                        student.id
                                    )
                            );

                    const totalMarks =
                        studentQuestionMarks.reduce(
                            (
                                total,
                                item
                            ) =>
                                total +
                                (
                                    Number(
                                        item.marks_obtained ||
                                        0
                                    )
                                ),
                            0
                        );

                    return {
                        ...student,

                        // Current question-level marks
                        question_marks:
                            studentQuestionMarks,

                        // Compatibility field
                        mark:
                            studentQuestionMarks.length >
                            0
                                ? studentQuestionMarks
                                : null,

                        // Compatibility total
                        marks:
                            studentQuestionMarks.length >
                            0
                                ? totalMarks
                                : ""
                    };
                }
            );

        return res.json({
            success: true,

            exam_subject: {
                ...examSubject,

                subject,

                class: classData
            },

            students:
                studentsWithMarks,

            total_students:
                studentsWithMarks.length,

            existing_marks:
                existingMarks || []
        });

    } catch (error) {

        console.error(
            "GET STUDENTS FOR EXAM SUBJECT ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// =====================================================
// SAVE MARKS
// POST /api/exams/marks
//
// LEGACY COMPATIBILITY ENDPOINT
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
                pass_marks
            `)
            .eq("exam_id", exam_id)
            .eq("subject_id", subject_id)
            .eq("class_id", class_id)
            .single();

        if (examSubjectError) {
            throw examSubjectError;
        }

        if (!examSubject) {
            return res.status(404).json({
                success: false,
                message:
                    "Exam subject for this class was not found"
            });
        }

        for (const item of marks) {

            const numericMarks =
                Number(item.marks);

            if (
                item.marks !== "" &&
                item.marks !== null &&
                item.marks !== undefined
            ) {

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
                        examSubject.full_marks
                ) {
                    return res.status(400).json({
                        success: false,
                        message:
                            `Marks must be between 0 and ${examSubject.full_marks}`
                    });
                }
            }
        }

        const records = marks
            .filter(
                item =>
                    item.marks !== "" &&
                    item.marks !== null &&
                    item.marks !== undefined
            )
            .map(item => {

                const numericMarks =
                    Number(item.marks);

                let grade = "";
                let remarks = "";

                const percentage =
                    (
                        numericMarks /
                        Number(
                            examSubject.full_marks
                        )
                    ) * 100;

                // Current AfriCore grading
                if (percentage >= 75) {
                    grade = "A";
                    remarks = "Excellent";
                }
                else if (percentage >= 65) {
                    grade = "B";
                    remarks = "Very Good";
                }
                else if (percentage >= 45) {
                    grade = "C";
                    remarks = "Good";
                }
                else if (percentage >= 30) {
                    grade = "D";
                    remarks = "Pass";
                }
                else {
                    grade = "F";
                    remarks = "Fail";
                }

                return {
                    exam_id,
                    student_id:
                        item.student_id,
                    subject_id,
                    class_id,
                    marks: numericMarks,
                    grade,
                    remarks,
                    entered_by:
                        entered_by || null,
                    status: "Draft"
                };
            });

        if (records.length === 0) {
            return res.status(400).json({
                success: false,
                message:
                    "No marks were entered"
            });
        }

        const {
            data,
            error
        } = await supabase
            .from("exam_marks")
            .upsert(
                records,
                {
                    onConflict:
                        "exam_id,student_id,subject_id,class_id"
                }
            )
            .select();

        if (error) {
            throw error;
        }

        return res.json({
            success: true,
            message:
                "Marks saved successfully",
            marks: data || []
        });

    } catch (error) {

        console.error(
            "SAVE EXAM MARKS ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// =====================================================
// AI EXAM ANALYSIS
// GET /api/exams/:id/ai-analysis
// =====================================================

export const analyzeExamWithAI = async (
    req,
    res
) => {
    try {

        const { id } = req.params;

        const {
            data: exam,
            error: examError
        } = await supabase
            .from("exams")
            .select("*")
            .eq("id", id)
            .single();

        if (examError) {
            throw examError;
        }

        const {
            data: questions,
            error: questionError
        } = await supabase
            .from("exam_questions")
            .select(`
                id,
                marks,
                question_bank (
                    question,
                    answer,
                    difficulty_level,
                    topics (
                        topic_name
                    ),
                    sub_topics (
                        sub_topic_name
                    )
                )
            `)
            .eq("exam_id", id);

        if (questionError) {
            throw questionError;
        }

        const prompt = `
You are AfriCore ERP PRO Educational AI.

Analyze this examination accurately.

EXAM:
${JSON.stringify(exam, null, 2)}

QUESTIONS:
${JSON.stringify(questions || [], null, 2)}

Analyze:

1. Subject
2. Topics tested
3. Difficulty level
4. Question distribution
5. Weak areas
6. Skills tested
7. Quality of examination
8. Teacher recommendations

Return valid JSON only.
`;

        const aiResult =
            await askGemini(prompt);

        const {
            data: saved,
            error: saveError
        } = await supabase
            .from("ai_exam_analysis")
            .insert([
                {
                    exam_id: id,
                    summary: aiResult,
                    ai_model: "Gemini",
                    status: "Completed"
                }
            ])
            .select();

        if (saveError) {
            throw saveError;
        }

        return res.json({
            success: true,
            message:
                "AI analysis completed successfully",
            analysis: saved
        });

    } catch (error) {

        console.error(
            "AI ANALYSIS ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// =====================================================
// REJECT EXAMINATION
// POST /api/exams/:id/reject
//
// LEGACY COMPATIBILITY
// =====================================================

export const rejectExam = async (
    req,
    res
) => {
    try {

        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                message:
                    "Exam ID is required"
            });
        }

        const {
            data: exam,
            error: examError
        } = await supabase
            .from("exams")
            .select("*")
            .eq("id", id)
            .maybeSingle();

        if (examError) {
            console.error(
                "REJECT EXAM LOAD ERROR:",
                examError
            );

            return res.status(400).json({
                success: false,
                message:
                    examError.message,
                details:
                    examError.details || null,
                hint:
                    examError.hint || null,
                code:
                    examError.code || null
            });
        }

        if (!exam) {
            return res.status(404).json({
                success: false,
                message:
                    "Exam not found"
            });
        }

        const {
            data: updatedExam,
            error: updateError
        } = await supabase
            .from("exams")
            .update({
                status: "rejected"
            })
            .eq("id", id)
            .select("*")
            .single();

        if (updateError) {
            console.error(
                "REJECT EXAM UPDATE ERROR:",
                updateError
            );

            return res.status(400).json({
                success: false,
                message:
                    updateError.message,
                details:
                    updateError.details || null,
                hint:
                    updateError.hint || null,
                code:
                    updateError.code || null
            });
        }

        return res.json({
            success: true,
            message:
                "Examination rejected successfully",
            exam: updatedExam
        });

    } catch (error) {

        console.error(
            "REJECT EXAM ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error?.message ||
                "Failed to reject examination."
        });
    }
};


// =====================================================
// RESULTS ANALYSIS
// GET /api/exams/:id/results-analysis
// =====================================================
//
// PRIMARY MARK SOURCE:
// exam_question_marks
//
// FALLBACK:
// exam_marks
//
// =====================================================

export const getExamResultsAnalysis = async (
    req,
    res
) => {
    try {

        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                message:
                    "Exam ID is required"
            });
        }

        const round = (
            value,
            decimals = 2
        ) => {

            const n =
                Number(value);

            return Number.isFinite(n)
                ? Number(
                    n.toFixed(
                        decimals
                    )
                )
                : 0;
        };

        const getGrade =
            percentage => {

                const value =
                    Number(
                        percentage
                    ) || 0;

                if (value >= 75)
                    return "A";

                if (value >= 65)
                    return "B";

                if (value >= 45)
                    return "C";

                if (value >= 30)
                    return "D";

                return "F";
            };

        const getGradePoints =
            grade => ({
                A: 1,
                B: 2,
                C: 3,
                D: 4,
                F: 5
            }[
                String(
                    grade || "F"
                ).toUpperCase()
            ] ?? 5);

        const getRemark =
            grade => ({
                A: "Excellent",
                B: "Very Good",
                C: "Good",
                D: "Pass",
                F: "Fail"
            }[
                String(
                    grade || "F"
                ).toUpperCase()
            ] || "Fail");

        // -------------------------------------------------
        // EXAM
        // -------------------------------------------------

        const {
            data: exam,
            error: examError
        } = await supabase
            .from("exams")
            .select("*")
            .eq("id", id)
            .single();

        if (examError) {
            return res.status(404).json({
                success: false,
                message:
                    examError.message,
                details:
                    examError.details || null,
                hint:
                    examError.hint || null,
                code:
                    examError.code || null
            });
        }

        if (!exam) {
            return res.status(404).json({
                success: false,
                message:
                    "Exam not found"
            });
        }

        // -------------------------------------------------
        // EXAM SUBJECTS
        // -------------------------------------------------

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
                created_at
            `)
            .eq("exam_id", id);

        if (examSubjectsError) {
            throw examSubjectsError;
        }

        const safeExamSubjects =
            examSubjects || [];

        if (
            safeExamSubjects.length === 0
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

                grade_distribution: [],
                subjects: [],
                topics: [],
                students: [],

                message:
                    "No subjects found for this examination."
            });
        }

        // -------------------------------------------------
        // SUBJECTS
        // -------------------------------------------------

        const subjectIds = [
            ...new Set(
                safeExamSubjects
                    .map(
                        row =>
                            row.subject_id
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

        const subjectMap =
            new Map(
                subjects.map(
                    subject => [
                        String(
                            subject.id
                        ),
                        subject
                    ]
                )
            );

        const examSubjectMap =
            new Map(
                safeExamSubjects.map(
                    row => [
                        String(
                            row.id
                        ),
                        row
                    ]
                )
            );

        // -------------------------------------------------
        // QUESTIONS
        // -------------------------------------------------

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
            .eq("exam_id", id);

        if (questionsError) {
            throw questionsError;
        }

        const safeQuestions =
            questions || [];

        const questionMap =
            new Map(
                safeQuestions.map(
                    question => [
                        String(
                            question.id
                        ),
                        question
                    ]
                )
            );

        // -------------------------------------------------
        // PRIMARY QUESTION MARKS
        // -------------------------------------------------

        let questionMarks = [];

        let questionMarksAvailable =
            true;

        const {
            data: loadedQuestionMarks,
            error:
                questionMarksError
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
                is_selected,
                created_at
            `)
            .eq(
                "exam_id",
                id
            );

        if (
            questionMarksError
        ) {

            console.warn(
                "QUESTION-LEVEL MARKS LOAD WARNING:",
                questionMarksError
            );

            questionMarksAvailable =
                false;

        } else {

            questionMarks =
                loadedQuestionMarks ||
                [];
        }

        // -------------------------------------------------
        // LEGACY MARKS FALLBACK
        // -------------------------------------------------

        let legacyMarks = [];

        if (
            !questionMarksAvailable ||
            questionMarks.length === 0
        ) {

            const {
                data,
                error
            } = await supabase
                .from("exam_marks")
                .select(`
                    id,
                    exam_id,
                    student_id,
                    subject_id,
                    class_id,
                    marks,
                    grade,
                    remarks,
                    entered_by,
                    status,
                    created_at
                `)
                .eq(
                    "exam_id",
                    id
                );

            if (error) {
                throw error;
            }

            legacyMarks =
                data || [];
        }

        // -------------------------------------------------
        // STUDENT IDS
        // -------------------------------------------------

        const studentIds = [
            ...new Set([
                ...questionMarks.map(
                    mark =>
                        mark.student_id
                ),

                ...legacyMarks.map(
                    mark =>
                        mark.student_id
                )
            ].filter(
                value =>
                    value !== null &&
                    value !== undefined
            ))
        ];

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

        const studentMap =
            new Map(
                students.map(
                    student => [
                        String(
                            student.id
                        ),
                        student
                    ]
                )
            );

        const getStudentName =
            student => {

                if (!student)
                    return "Unknown Student";

                return [
                    student.first_name,
                    student.middle_name,
                    student.last_name
                ]
                    .filter(Boolean)
                    .join(" ") ||
                    "Unknown Student";
            };

        // -------------------------------------------------
        // SUBJECT ANALYSIS
        // -------------------------------------------------

        const subjectAnalysis =
            safeExamSubjects.map(
                examSubject => {

                    const subject =
                        subjectMap.get(
                            String(
                                examSubject.subject_id
                            )
                        ) || null;

                    const fullMarks =
                        Number(
                            examSubject.full_marks
                        ) || 0;

                    const passMarks =
                        Number(
                            examSubject.pass_marks
                        ) || 0;

                    const subjectQuestionMarks =
                        questionMarks.filter(
                            mark =>
                                String(
                                    mark.exam_subject_id
                                ) ===
                                String(
                                    examSubject.id
                                )
                        );

                    const subjectLegacyMarks =
                        legacyMarks.filter(
                            mark =>
                                String(
                                    mark.subject_id
                                ) ===
                                String(
                                    examSubject.subject_id
                                ) &&
                                String(
                                    mark.class_id
                                ) ===
                                String(
                                    examSubject.class_id
                                )
                        );

                    const studentTotals =
                        new Map();

                    if (
                        questionMarksAvailable &&
                        subjectQuestionMarks.length >
                            0
                    ) {

                        subjectQuestionMarks.forEach(
                            mark => {

                                const studentId =
                                    String(
                                        mark.student_id
                                    );

                                const current =
                                    studentTotals.get(
                                        studentId
                                    ) || 0;

                                studentTotals.set(
                                    studentId,

                                    current +
                                    (
                                        Number(
                                            mark.marks_obtained
                                        ) || 0
                                    )
                                );
                            }
                        );

                    } else {

                        subjectLegacyMarks.forEach(
                            mark => {

                                studentTotals.set(
                                    String(
                                        mark.student_id
                                    ),
                                    Number(
                                        mark.marks
                                    ) || 0
                                );
                            }
                        );
                    }

                    const percentages =
                        Array.from(
                            studentTotals.values()
                        ).map(
                            total =>
                                fullMarks > 0
                                    ? (
                                        total /
                                        fullMarks
                                    ) * 100
                                    : 0
                        );

                    const average =
                        percentages.length > 0
                            ? percentages.reduce(
                                (
                                    a,
                                    b
                                ) =>
                                    a + b,
                                0
                            ) /
                            percentages.length
                            : 0;

                    const highest =
                        percentages.length > 0
                            ? Math.max(
                                ...percentages
                            )
                            : 0;

                    const lowest =
                        percentages.length > 0
                            ? Math.min(
                                ...percentages
                            )
                            : 0;

                    const passedCount =
                        Array.from(
                            studentTotals.values()
                        ).filter(
                            total => {

                                if (
                                    passMarks > 0
                                ) {
                                    return (
                                        total >=
                                        passMarks
                                    );
                                }

                                return (
                                    getGrade(
                                        fullMarks > 0
                                            ? (
                                                total /
                                                fullMarks
                                            ) * 100
                                            : 0
                                    ) !==
                                    "F"
                                );
                            }
                        ).length;

                    const gradeCounts = {
                        A: 0,
                        B: 0,
                        C: 0,
                        D: 0,
                        F: 0
                    };

                    percentages.forEach(
                        percentage => {

                            gradeCounts[
                                getGrade(
                                    percentage
                                )
                            ] += 1;
                        }
                    );

                    const subjectQuestions =
                        safeQuestions.filter(
                            question =>
                                String(
                                    question.subject_id
                                ) ===
                                String(
                                    examSubject.subject_id
                                )
                        );

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

                        subject_name:
                            subject?.subject_name ||
                            "Unknown Subject",

                        subject_code:
                            subject?.subject_code ||
                            "",

                        candidates:
                            studentTotals.size,

                        questions:
                            subjectQuestions.length,

                        marks_entered:
                            questionMarksAvailable
                                ? subjectQuestionMarks.length
                                : subjectLegacyMarks.length,

                        full_marks:
                            fullMarks,

                        pass_marks:
                            passMarks,

                        average:
                            round(
                                average
                            ),

                        highest:
                            round(
                                highest
                            ),

                        lowest:
                            round(
                                lowest
                            ),

                        pass_rate:
                            studentTotals.size > 0
                                ? round(
                                    (
                                        passedCount /
                                        studentTotals.size
                                    ) * 100
                                )
                                : 0,

                        grade:
                            getGrade(
                                average
                            ),

                        performance:
                            average >= 75
                                ? "Strong"
                                : average >= 65
                                    ? "Good"
                                    : average >= 45
                                        ? "Average"
                                        : "Needs Attention",

                        grade_distribution:
                            gradeCounts
                    };
                }
            );

        // -------------------------------------------------
        // TOPIC ANALYSIS
        // -------------------------------------------------

        const topicMap =
            new Map();

        safeQuestions.forEach(
            question => {

                const subject =
                    subjectMap.get(
                        String(
                            question.subject_id
                        )
                    ) || null;

                const topicName =
                    String(
                        question.topic ||
                        "Unclassified"
                    ).trim() ||
                    "Unclassified";

                const key =
                    `${question.subject_id}::${topicName}`;

                if (
                    !topicMap.has(key)
                ) {

                    topicMap.set(
                        key,
                        {
                            subject_id:
                                question.subject_id,

                            subject:
                                subject?.subject_name ||
                                "Unknown Subject",

                            subject_name:
                                subject?.subject_name ||
                                "Unknown Subject",

                            topic:
                                topicName,

                            questions:
                                0,

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
                    topicMap.get(key);

                topic.questions += 1;

                topic.max_marks +=
                    Number(
                        question.max_marks
                    ) || 0;

                questionMarks
                    .filter(
                        mark =>
                            String(
                                mark.question_id
                            ) ===
                            String(
                                question.id
                            )
                    )
                    .forEach(
                        mark => {

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
            }
        );

        const topicAnalysis =
            Array.from(
                topicMap.values()
            ).map(
                topic => {

                    const candidates =
                        topic.students.size;

                    const totalPossible =
                        (
                            Number(
                                topic.max_marks
                            ) || 0
                        ) *
                        candidates;

                    const performance =
                        totalPossible > 0
                            ? (
                                topic.obtained /
                                totalPossible
                            ) * 100
                            : 0;

                    return {
                        subject_id:
                            topic.subject_id,

                        subject:
                            topic.subject,

                        subject_name:
                            topic.subject_name,

                        topic:
                            topic.topic,

                        questions:
                            topic.questions,

                        max_marks:
                            round(
                                topic.max_marks
                            ),

                        obtained:
                            round(
                                topic.obtained
                            ),

                        candidates,

                        performance:
                            round(
                                performance
                            ),

                        grade:
                            getGrade(
                                performance
                            )
                    };
                }
            );

        // -------------------------------------------------
        // STUDENT ANALYSIS
        // -------------------------------------------------

        const studentAnalysisMap =
            new Map();

        const ensureStudent =
            studentId => {

                const key =
                    String(
                        studentId
                    );

                if (
                    !studentAnalysisMap.has(
                        key
                    )
                ) {

                    const student =
                        studentMap.get(
                            key
                        ) || null;

                    studentAnalysisMap.set(
                        key,
                        {
                            student_id:
                                studentId,

                            name:
                                getStudentName(
                                    student
                                ),

                            full_name:
                                getStudentName(
                                    student
                                ),

                            admission_number:
                                student?.admission_number ||
                                student?.admission_no ||
                                "",

                            admission:
                                student?.admission_number ||
                                student?.admission_no ||
                                "",

                            gender:
                                student?.gender ||
                                "",

                            class_name:
                                student?.class_name ||
                                "",

                            subjects: [],

                            total_marks:
                                0,

                            total_possible:
                                0,

                            percentage:
                                0,

                            grade:
                                "F",

                            grade_points:
                                5,

                            remarks:
                                "Fail"
                        }
                    );
                }

                return studentAnalysisMap.get(
                    key
                );
            };

        safeExamSubjects.forEach(
            examSubject => {

                const fullMarks =
                    Number(
                        examSubject.full_marks
                    ) || 0;

                const subject =
                    subjectMap.get(
                        String(
                            examSubject.subject_id
                        )
                    ) || null;

                const subjectMarks =
                    questionMarks.filter(
                        mark =>
                            String(
                                mark.exam_subject_id
                            ) ===
                            String(
                                examSubject.id
                            )
                    );

                const legacySubjectMarks =
                    legacyMarks.filter(
                        mark =>
                            String(
                                mark.subject_id
                            ) ===
                            String(
                                examSubject.subject_id
                            ) &&
                            String(
                                mark.class_id
                            ) ===
                            String(
                                examSubject.class_id
                            )
                    );

                const totals =
                    new Map();

                if (
                    questionMarksAvailable &&
                    subjectMarks.length > 0
                ) {

                    subjectMarks.forEach(
                        mark => {

                            const key =
                                String(
                                    mark.student_id
                                );

                            totals.set(
                                key,

                                (
                                    totals.get(
                                        key
                                    ) || 0
                                ) +
                                (
                                    Number(
                                        mark.marks_obtained
                                    ) || 0
                                )
                            );
                        }
                    );

                } else {

                    legacySubjectMarks.forEach(
                        mark => {

                            totals.set(
                                String(
                                    mark.student_id
                                ),
                                Number(
                                    mark.marks
                                ) || 0
                            );
                        }
                    );
                }

                totals.forEach(
                    (
                        obtained,
                        studentId
                    ) => {

                        const row =
                            ensureStudent(
                                studentId
                            );

                        const percentage =
                            fullMarks > 0
                                ? (
                                    obtained /
                                    fullMarks
                                ) * 100
                                : 0;

                        const grade =
                            getGrade(
                                percentage
                            );

                        row.subjects.push({
                            exam_subject_id:
                                examSubject.id,

                            subject_id:
                                examSubject.subject_id,

                            subject_name:
                                subject?.subject_name ||
                                "Unknown Subject",

                            subject_code:
                                subject?.subject_code ||
                                "",

                            class_id:
                                examSubject.class_id,

                            marks:
                                round(
                                    obtained
                                ),

                            full_marks:
                                fullMarks,

                            percentage:
                                round(
                                    percentage
                                ),

                            grade,

                            grade_points:
                                getGradePoints(
                                    grade
                                ),

                            remarks:
                                getRemark(
                                    grade
                                )
                        });

                        row.total_marks +=
                            obtained;

                        row.total_possible +=
                            fullMarks;
                    }
                );
            }
        );

        const studentAnalysis =
            Array.from(
                studentAnalysisMap.values()
            ).map(
                row => {

                    const percentage =
                        row.total_possible > 0
                            ? (
                                row.total_marks /
                                row.total_possible
                            ) * 100
                            : 0;

                    const grade =
                        getGrade(
                            percentage
                        );

                    return {
                        ...row,

                        total_marks:
                            round(
                                row.total_marks
                            ),

                        total_possible:
                            round(
                                row.total_possible
                            ),

                        percentage:
                            round(
                                percentage
                            ),

                        grade,

                        grade_points:
                            getGradePoints(
                                grade
                            ),

                        remarks:
                            getRemark(
                                grade
                            ),

                        subjects_count:
                            row.subjects.length
                    };
                }
            );

        // -------------------------------------------------
        // OVERVIEW
        // -------------------------------------------------

        const percentages =
            studentAnalysis.map(
                student =>
                    Number(
                        student.percentage
                    ) || 0
            );

        const overallAverage =
            percentages.length > 0
                ? percentages.reduce(
                    (
                        a,
                        b
                    ) =>
                        a + b,
                    0
                ) /
                percentages.length
                : 0;

        const highest =
            percentages.length > 0
                ? Math.max(
                    ...percentages
                )
                : 0;

        const lowest =
            percentages.length > 0
                ? Math.min(
                    ...percentages
                )
                : 0;

        const passedStudents =
            studentAnalysis.filter(
                student =>
                    student.grade !==
                    "F"
            ).length;

        const totalCandidates =
            studentAnalysis.length;

        const totalPossible =
            safeExamSubjects.reduce(
                (
                    sum,
                    item
                ) =>
                    sum +
                    (
                        Number(
                            item.full_marks
                        ) || 0
                    ),
                0
            );

        const gradeDistribution =
            [
                "A",
                "B",
                "C",
                "D",
                "F"
            ].map(
                grade => {

                    const count =
                        studentAnalysis.filter(
                            student =>
                                student.grade ===
                                grade
                        ).length;

                    return {
                        grade,

                        count,

                        percentage:
                            totalCandidates > 0
                                ? round(
                                    (
                                        count /
                                        totalCandidates
                                    ) * 100
                                )
                                : 0
                    };
                }
            );

        return res.json({
            success: true,

            exam,

            overview: {
                candidates:
                    totalCandidates,

                subjects:
                    safeExamSubjects.length,

                average:
                    round(
                        overallAverage
                    ),

                pass_rate:
                    totalCandidates > 0
                        ? round(
                            (
                                passedStudents /
                                totalCandidates
                            ) * 100
                        )
                        : 0,

                highest:
                    round(
                        highest
                    ),

                lowest:
                    round(
                        lowest
                    ),

                total_possible:
                    round(
                        totalPossible
                    ),

                total_marks_entered:
                    questionMarksAvailable
                        ? questionMarks.length
                        : legacyMarks.length
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

    } catch (error) {

        console.error(
            "GET EXAM RESULTS ANALYSIS ERROR:",
            error
        );

        return res.status(500).json({
            success: false,

            message:
                error?.message ||
                "Failed to load examination results analysis.",

            details:
                error?.details ||
                null,

            hint:
                error?.hint ||
                null,

            code:
                error?.code ||
                null
        });
    }
};


// =====================================================
// GET EXAMINATION PAPERS HISTORY
// GET /api/exams/papers/history
// =====================================================

export const getExamPapersHistory = async (
    req,
    res
) => {
    try {

        const {
            data: papers,
            error: papersError
        } = await supabase
            .from("exam_papers")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );

        if (papersError) {
            return res.status(400).json({
                success: false,
                message:
                    papersError.message,
                details:
                    papersError.details ||
                    null,
                hint:
                    papersError.hint ||
                    null,
                code:
                    papersError.code ||
                    null
            });
        }

        let rows = papers || [];

        // The service-role client bypasses RLS, so scope paper history explicitly.
        if (!req.schoolContext?.isSuperAdmin) {
            const schoolId = Number(req.schoolContext?.schoolId);
            const { data: ownedExams, error: ownedExamsError } = await supabase
                .from("exams")
                .select("id")
                .eq("school_id", schoolId);

            if (ownedExamsError) throw ownedExamsError;
            const ownedExamIds = new Set((ownedExams || []).map(exam => Number(exam.id)));
            rows = rows.filter(paper => ownedExamIds.has(Number(paper.exam_id)));
        } else if (req.query?.school_id) {
            const schoolId = Number(req.query.school_id);
            const { data: ownedExams, error: ownedExamsError } = await supabase
                .from("exams")
                .select("id")
                .eq("school_id", schoolId);

            if (ownedExamsError) throw ownedExamsError;
            const ownedExamIds = new Set((ownedExams || []).map(exam => Number(exam.id)));
            rows = rows.filter(paper => ownedExamIds.has(Number(paper.exam_id)));
        }

        if (
            rows.length === 0
        ) {

            return res.json({
                success: true,
                total: 0,
                papers: []
            });
        }

        const examIds = [
            ...new Set(
                rows
                    .map(
                        paper =>
                            paper.exam_id
                    )
                    .filter(Boolean)
            )
        ];

        const examSubjectIds = [
            ...new Set(
                rows
                    .map(
                        paper =>
                            paper.exam_subject_id
                    )
                    .filter(Boolean)
            )
        ];

        const [
            examsResult,
            examSubjectsResult,
            subjectsResult
        ] = await Promise.all([

            examIds.length > 0
                ? supabase
                    .from("exams")
                    .select("*")
                    .in(
                        "id",
                        examIds
                    )
                : Promise.resolve({
                    data: [],
                    error: null
                }),

            examSubjectIds.length > 0
                ? supabase
                    .from("exam_subjects")
                    .select("*")
                    .in(
                        "id",
                        examSubjectIds
                    )
                : Promise.resolve({
                    data: [],
                    error: null
                }),

            supabase
                .from("subjects")
                .select("*")
        ]);

        if (
            examsResult.error
        ) {
            throw examsResult.error;
        }

        if (
            examSubjectsResult.error
        ) {
            throw examSubjectsResult.error;
        }

        if (
            subjectsResult.error
        ) {
            throw subjectsResult.error;
        }

        const examMap =
            new Map(
                (
                    examsResult.data ||
                    []
                ).map(
                    exam => [
                        String(
                            exam.id
                        ),
                        exam
                    ]
                )
            );

        const examSubjectMap =
            new Map(
                (
                    examSubjectsResult.data ||
                    []
                ).map(
                    row => [
                        String(
                            row.id
                        ),
                        row
                    ]
                )
            );

        const subjectMap =
            new Map(
                (
                    subjectsResult.data ||
                    []
                ).map(
                    subject => [
                        String(
                            subject.id
                        ),
                        subject
                    ]
                )
            );

        const history =
            rows.map(
                paper => {

                    const examSubject =
                        examSubjectMap.get(
                            String(
                                paper.exam_subject_id
                            )
                        ) || null;

                    const subject =
                        examSubject?.subject_id
                            ? subjectMap.get(
                                String(
                                    examSubject.subject_id
                                )
                            ) || null
                            : null;

                    return {
                        ...paper,

                        exam:
                            examMap.get(
                                String(
                                    paper.exam_id
                                )
                            ) || null,

                        exam_subject:
                            examSubject,

                        subject
                    };
                }
            );

        return res.json({
            success: true,
            total:
                history.length,
            papers:
                history
        });

    } catch (error) {

        console.error(
            "GET EXAM PAPERS HISTORY SERVER ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error?.message ||
                "Failed to load examination papers history."
        });
    }
};


// =====================================================
// DELETE ONE EXAMINATION PAPER
// DELETE /api/exams/papers/:paperId
//
// MANUAL ONLY
// =====================================================

export const deleteExamPaper = async (
    req,
    res
) => {
    try {

        const {
            paperId
        } = req.params;

        if (!paperId) {
            return res.status(400).json({
                success: false,
                message:
                    "Paper ID is required."
            });
        }

        const {
            data: paper,
            error: paperError
        } = await supabase
            .from("exam_papers")
            .select("*")
            .eq("id", paperId)
            .maybeSingle();

        if (paperError) {
            return res.status(400).json({
                success: false,
                message:
                    paperError.message,
                details:
                    paperError.details ||
                    null,
                hint:
                    paperError.hint ||
                    null,
                code:
                    paperError.code ||
                    null
            });
        }

        if (!paper) {
            return res.status(404).json({
                success: false,
                message:
                    "Examination paper not found."
            });
        }

        const {
            error: deleteError
        } = await supabase
            .from("exam_papers")
            .delete()
            .eq("id", paperId);

        if (deleteError) {
            return res.status(400).json({
                success: false,
                message:
                    deleteError.message,
                details:
                    deleteError.details ||
                    null,
                hint:
                    deleteError.hint ||
                    null,
                code:
                    deleteError.code ||
                    null
            });
        }

        return res.json({
            success: true,
            message:
                "Examination paper deleted successfully.",

            paper: {
                id:
                    paper.id,

                exam_id:
                    paper.exam_id,

                exam_subject_id:
                    paper.exam_subject_id,

                file_name:
                    paper.file_name ||
                    null
            }
        });

    } catch (error) {

        console.error(
            "DELETE EXAM PAPER SERVER ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error?.message ||
                "Failed to delete examination paper."
        });
    }
};