import { supabase } from "../config/supabase.js";


// =====================================================
// GET RESULT ANALYSIS
// GET /api/result-analysis/exam/:examId
// =====================================================

export const getResultAnalysis = async (req, res) => {

    try {

        const {
            examId
        } = req.params;


        // =================================================
        // VALIDATE EXAM ID
        // =================================================

        if (!examId) {

            return res.status(400).json({
                success: false,
                message: "Exam ID is required"
            });

        }


        const examIdNumber =
            Number(examId);


        if (
            Number.isNaN(examIdNumber)
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid Exam ID"
            });

        }


        // =================================================
        // GET EXAM
        // =================================================

        const {
            data: exam,
            error: examError
        } = await supabase

            .from("exams")

            .select("*")

            .eq(
                "id",
                examIdNumber
            )

            .maybeSingle();


        if (examError) {

            console.error(
                "GET EXAM ERROR:",
                examError
            );

            return res.status(500).json({
                success: false,
                message: examError.message
            });

        }


        if (!exam) {

            return res.status(404).json({
                success: false,
                message: "Examination not found"
            });

        }


        // =================================================
        // GET EXAM SUBJECTS
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
                pass_marks
            `)

            .eq(
                "exam_id",
                examIdNumber
            );


        if (examSubjectsError) {

            console.error(
                "GET EXAM SUBJECTS ERROR:",
                examSubjectsError
            );

            return res.status(500).json({
                success: false,
                message: examSubjectsError.message
            });

        }


        // =================================================
        // GET QUESTIONS
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
                ai_explanation,
                ai_processed,
                max_marks
            `)

            .eq(
                "exam_id",
                examIdNumber
            )

            .order(
                "question_number",
                {
                    ascending: true
                }
            );


        if (questionsError) {

            console.error(
                "GET QUESTIONS ERROR:",
                questionsError
            );

            return res.status(500).json({
                success: false,
                message: questionsError.message
            });

        }


        // =================================================
        // GET STUDENT QUESTION MARKS
        // =================================================

        const {
            data: marks,
            error: marksError
        } = await supabase

            .from("student_question_marks")

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
                examIdNumber
            );


        if (marksError) {

            console.error(
                "GET STUDENT MARKS ERROR:",
                marksError
            );

            return res.status(500).json({
                success: false,
                message: marksError.message
            });

        }


        // =================================================
        // GET STUDENTS
        // =================================================

        const studentIds = [
            ...new Set(
                (marks || [])
                    .map(
                        item =>
                            item.student_id
                    )
                    .filter(Boolean)
            )
        ];


        let students = [];


        if (
            studentIds.length > 0
        ) {

            const {
                data: studentData,
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
                    class_name,
                    stream,
                    status,
                    student_status
                `)

                .in(
                    "id",
                    studentIds
                );


            if (studentsError) {

                console.error(
                    "GET STUDENTS ERROR:",
                    studentsError
                );

                return res.status(500).json({
                    success: false,
                    message: studentsError.message
                });

            }


            students =
                studentData || [];

        }


        // =================================================
        // CREATE LOOKUPS
        // =================================================

        const studentMap =
            new Map(
                students.map(
                    student => [
                        Number(student.id),
                        student
                    ]
                )
            );


        const questionMap =
            new Map(
                (questions || []).map(
                    question => [
                        Number(question.id),
                        question
                    ]
                )
            );


        const subjectMap =
            new Map(
                (examSubjects || []).map(
                    subject => [
                        Number(subject.id),
                        subject
                    ]
                )
            );


        // =================================================
        // BUILD STUDENT RESULTS
        // =================================================

        const studentResultsMap =
            new Map();


        (marks || []).forEach(
            mark => {

                const studentId =
                    Number(
                        mark.student_id
                    );


                const question =
                    questionMap.get(
                        Number(
                            mark.question_id
                        )
                    );


                const examSubject =
                    subjectMap.get(
                        Number(
                            mark.exam_subject_id
                        )
                    );


                if (
                    !studentResultsMap.has(
                        studentId
                    )
                ) {

                    studentResultsMap.set(
                        studentId,
                        {
                            student_id:
                                studentId,

                            total_marks:
                                0,

                            maximum_marks:
                                0,

                            percentage:
                                0,

                            question_count:
                                0,

                            answered_questions:
                                0,

                            pass:
                                false,

                            subjects: {},

                            questions: []
                        }
                    );

                }


                const result =
                    studentResultsMap.get(
                        studentId
                    );


                const obtained =
                    Number(
                        mark.marks_obtained
                    ) || 0;


                const maxMarks =
                    Number(
                        question?.max_marks
                    ) || 0;


                result.total_marks +=
                    obtained;


                result.maximum_marks +=
                    maxMarks;


                result.question_count += 1;


                if (
                    mark.marks_obtained !== null &&
                    mark.marks_obtained !== undefined
                ) {

                    result.answered_questions += 1;

                }


                result.questions.push({

                    question_id:
                        mark.question_id,

                    question_number:
                        question?.question_number ?? null,

                    subject_id:
                        question?.subject_id ?? null,

                    exam_subject_id:
                        mark.exam_subject_id,

                    marks_obtained:
                        obtained,

                    max_marks:
                        maxMarks,

                    topic:
                        question?.topic || null,

                    sub_topic:
                        question?.sub_topic || null,

                    difficulty:
                        question?.difficulty_level || null

                });


                // =================================================
                // SUBJECT RESULT
                // =================================================

                const subjectKey =
                    String(
                        mark.exam_subject_id
                    );


                if (
                    !result.subjects[subjectKey]
                ) {

                    result.subjects[subjectKey] = {

                        exam_subject_id:
                            mark.exam_subject_id,

                        subject_id:
                            question?.subject_id ?? null,

                        total_marks:
                            0,

                        maximum_marks:
                            0,

                        percentage:
                            0,

                        question_count:
                            0

                    };

                }


                const subjectResult =
                    result.subjects[
                        subjectKey
                    ];


                subjectResult.total_marks +=
                    obtained;


                subjectResult.maximum_marks +=
                    maxMarks;


                subjectResult.question_count +=
                    1;

            }
        );


        // =================================================
        // CALCULATE STUDENT PERCENTAGES
        // =================================================

        const studentResults =
            Array.from(
                studentResultsMap.values()
            ).map(
                result => {

                    result.percentage =
                        result.maximum_marks > 0
                            ? Number(
                                (
                                    result.total_marks /
                                    result.maximum_marks *
                                    100
                                ).toFixed(2)
                            )
                            : 0;


                    result.pass =
                        result.percentage >= 40;


                    Object.values(
                        result.subjects
                    ).forEach(
                        subject => {

                            subject.percentage =
                                subject.maximum_marks > 0
                                    ? Number(
                                        (
                                            subject.total_marks /
                                            subject.maximum_marks *
                                            100
                                        ).toFixed(2)
                                    )
                                    : 0;

                        }
                    );


                    const student =
                        studentMap.get(
                            Number(
                                result.student_id
                            )
                        );


                    return {

                        ...result,

                        student:

                            student || null

                    };

                }
            );


        // =================================================
        // OVERALL STATISTICS
        // =================================================

        const totalStudents =
            studentResults.length;


        const passedStudents =
            studentResults.filter(
                student =>
                    student.pass
            ).length;


        const failedStudents =
            studentResults.filter(
                student =>
                    !student.pass
            ).length;


        const percentages =
            studentResults
                .map(
                    student =>
                        Number(
                            student.percentage
                        ) || 0
                );


        const totalPercentage =
            percentages.reduce(
                (
                    total,
                    value
                ) =>
                    total + value,
                0
            );


        const averagePercentage =
            totalStudents > 0
                ? Number(
                    (
                        totalPercentage /
                        totalStudents
                    ).toFixed(2)
                )
                : 0;


        const highestPercentage =
            percentages.length > 0
                ? Math.max(
                    ...percentages
                )
                : 0;


        const lowestPercentage =
            percentages.length > 0
                ? Math.min(
                    ...percentages
                )
                : 0;


        const passRate =
            totalStudents > 0
                ? Number(
                    (
                        passedStudents /
                        totalStudents *
                        100
                    ).toFixed(2)
                )
                : 0;


        // =================================================
        // QUESTION ANALYSIS
        // =================================================

        const questionAnalysisMap =
            new Map();


        (marks || []).forEach(
            mark => {

                const questionId =
                    Number(
                        mark.question_id
                    );


                const question =
                    questionMap.get(
                        questionId
                    );


                if (!question) {
                    return;
                }


                if (
                    !questionAnalysisMap.has(
                        questionId
                    )
                ) {

                    questionAnalysisMap.set(
                        questionId,
                        {
                            question_id:
                                question.id,

                            question_number:
                                question.question_number,

                            question_text:
                                question.question_text,

                            topic:
                                question.topic,

                            sub_topic:
                                question.sub_topic,

                            difficulty:
                                question.difficulty_level,

                            max_marks:
                                Number(
                                    question.max_marks
                                ) || 0,

                            total_students:
                                0,

                            total_marks:
                                0,

                            average_marks:
                                0,

                            percentage:
                                0

                        }
                    );

                }


                const item =
                    questionAnalysisMap.get(
                        questionId
                    );


                const obtained =
                    Number(
                        mark.marks_obtained
                    ) || 0;


                item.total_students += 1;

                item.total_marks +=
                    obtained;

            }
        );


        const questionAnalysis =
            Array.from(
                questionAnalysisMap.values()
            ).map(
                item => {

                    item.average_marks =
                        item.total_students > 0
                            ? Number(
                                (
                                    item.total_marks /
                                    item.total_students
                                ).toFixed(2)
                            )
                            : 0;


                    item.percentage =
                        item.max_marks > 0
                            ? Number(
                                (
                                    item.average_marks /
                                    item.max_marks *
                                    100
                                ).toFixed(2)
                            )
                            : 0;


                    return item;

                }
            );


        // =================================================
        // TOPIC ANALYSIS
        // =================================================

        const topicMap =
            new Map();


        (marks || []).forEach(
            mark => {

                const question =
                    questionMap.get(
                        Number(
                            mark.question_id
                        )
                    );


                if (!question) {
                    return;
                }


                const topic =
                    question.topic ||
                    "General";


                if (
                    !topicMap.has(
                        topic
                    )
                ) {

                    topicMap.set(
                        topic,
                        {
                            topic,

                            total_marks:
                                0,

                            max_marks:
                                0,

                            responses:
                                0
                        }
                    );

                }


                const topicItem =
                    topicMap.get(
                        topic
                    );


                topicItem.total_marks +=
                    Number(
                        mark.marks_obtained
                    ) || 0;


                topicItem.max_marks +=
                    Number(
                        question.max_marks
                    ) || 0;


                topicItem.responses +=
                    1;

            }
        );


        const topicAnalysis =
            Array.from(
                topicMap.values()
            ).map(
                item => ({

                    ...item,

                    percentage:
                        item.max_marks > 0
                            ? Number(
                                (
                                    item.total_marks /
                                    item.max_marks *
                                    100
                                ).toFixed(2)
                            )
                            : 0

                })
            );


        // =================================================
        // RECOMMENDATION
        // =================================================

        let recommendation;


        if (
            totalStudents === 0
        ) {

            recommendation =
                "Hakuna marks zilizopatikana kwa ajili ya kufanya analysis.";

        }

        else if (
            passRate < 50
        ) {

            recommendation =
                "Academic team inashauriwa kufanya review ya maeneo yenye ufaulu mdogo na kutoa remedial teaching.";

        }

        else if (
            averagePercentage < 60
        ) {

            recommendation =
                "Matokeo yanaonyesha kiwango cha kati. Walimu wanashauriwa kuimarisha maeneo yenye changamoto.";

        }

        else {

            recommendation =
                "Matokeo yanaonyesha ufaulu mzuri kwa ujumla. Endelea kufuatilia wanafunzi wenye performance ya chini.";

        }


        // =================================================
        // RESPONSE
        // =================================================

        return res.json({

            success: true,

            exam: {

                id:
                    exam.id,

                exam_name:
                    exam.exam_name,

                exam_type:
                    exam.exam_type,

                term:
                    exam.term,

                status:
                    exam.status

            },

            statistics: {

                total_students:
                    totalStudents,

                passed_students:
                    passedStudents,

                failed_students:
                    failedStudents,

                pass_rate:
                    passRate,

                average_percentage:
                    averagePercentage,

                highest_percentage:
                    highestPercentage,

                lowest_percentage:
                    lowestPercentage

            },

            students:
                studentResults,

            questions:
                questionAnalysis,

            topics:
                topicAnalysis,

            recommendation

        });

    }

    catch (error) {

        console.error(
            "RESULT ANALYSIS ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error?.message ||
                "Failed to generate result analysis."

        });

    }

};