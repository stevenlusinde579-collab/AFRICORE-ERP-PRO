import express from "express";

import {

    getExams,

    getExamById,

    createExam,

    updateExam,

    deleteExam,

    getExamSubjects,

    getStudentsForExamSubject,

    saveExamMarks,

    analyzeExamWithAI,

    getExamResultsAnalysis,

    rejectExam,

    deleteExamPaper,

    getExamPapersHistory

} from "../controllers/examController.js";


import {

    getExamSubjectApproval,

    getExamApprovalStatuses,

    approveExamSubject,

    rejectExamSubject,

    resetExamSubjectApproval

} from "../controllers/approvalController.js";


const router =
    express.Router();


// =====================================================
// EXAMINATION ROUTER
// =====================================================

console.log(
    "====================================="
);

console.log(
    "EXAMINATION ROUTES LOADED"
);

console.log(
    "====================================="
);


// =====================================================
// ROUTER TEST
// GET /api/exams/route-test
// =====================================================

router.get(

    "/route-test",

    (req, res) => {

        return res.json({

            success:
                true,

            message:
                "EXAM ROUTER IS CONNECTED"

        });

    }

);


// =====================================================
// GET ALL EXAMINATIONS
// GET /api/exams
// =====================================================

router.get(

    "/",

    getExams

);


// =====================================================
// CREATE EXAMINATION
// POST /api/exams
// =====================================================

router.post(

    "/",

    createExam

);


// =====================================================
// SAVE EXAM MARKS
// POST /api/exams/marks
// =====================================================

router.post(

    "/marks",

    saveExamMarks

);


// =====================================================
// GET STUDENTS FOR EXAM SUBJECT
// GET /api/exams/exam-subject/:examSubjectId/students
// =====================================================

router.get(

    "/exam-subject/:examSubjectId/students",

    getStudentsForExamSubject

);


// =====================================================
// GET SUBJECT-LEVEL APPROVAL STATUS
//
// GET /api/exams/exam-subject/:examSubjectId/approval
//
// IMPORTANT:
// This reads approval from exam_subjects,
// NOT from exams.
// =====================================================

router.get(

    "/exam-subject/:examSubjectId/approval",

    getExamSubjectApproval

);


// =====================================================
// APPROVE SUBJECT-LEVEL EXAMINATION
//
// POST /api/exams/exam-subject/:examSubjectId/approve
//
// Body:
// {
//     type,
//     user_id,
//     role
// }
// =====================================================

router.post(

    "/exam-subject/:examSubjectId/approve",

    approveExamSubject

);


// =====================================================
// REJECT SUBJECT-LEVEL EXAMINATION
//
// POST /api/exams/exam-subject/:examSubjectId/reject
//
// Body:
// {
//     reason,
//     rejected_by
// }
// =====================================================

router.post(

    "/exam-subject/:examSubjectId/reject",

    rejectExamSubject

);


// =====================================================
// RESET SUBJECT-LEVEL APPROVAL
//
// POST /api/exams/exam-subject/:examSubjectId/reset-approval
// =====================================================

router.post(

    "/exam-subject/:examSubjectId/reset-approval",

    resetExamSubjectApproval

);


// =====================================================
// GET APPROVAL STATUS FOR ALL SUBJECTS IN ONE EXAM
//
// GET /api/exams/:examId/approval-statuses
//
// IMPORTANT:
// This returns individual status for every exam_subject.
// =====================================================

router.get(

    "/:examId/approval-statuses",

    getExamApprovalStatuses

);


// =====================================================
// GET ALL EXAMINATION PAPERS HISTORY
//
// GET /api/exams/papers/history
//
// MUST COME BEFORE /:id
// =====================================================

router.get(

    "/papers/history",

    getExamPapersHistory

);


// =====================================================
// DELETE ONE EXAMINATION PAPER
//
// DELETE /api/exams/papers/:paperId
// =====================================================

router.delete(

    "/papers/:paperId",

    deleteExamPaper

);


// =====================================================
// GET EXAM SUBJECTS
//
// GET /api/exams/:id/subjects
// =====================================================

router.get(

    "/:id/subjects",

    getExamSubjects

);


// =====================================================
// AI EXAMINATION ANALYSIS
//
// GET /api/exams/:id/ai-analysis
// =====================================================

router.get(

    "/:id/ai-analysis",

    analyzeExamWithAI

);


// =====================================================
// RESULTS ANALYSIS
//
// GET /api/exams/:id/results-analysis
// =====================================================

router.get(

    "/:id/results-analysis",

    getExamResultsAnalysis

);


// =====================================================
// LEGACY REJECT EXAMINATION
//
// POST /api/exams/:id/reject
//
// KEPT FOR OLD FRONTEND COMPATIBILITY.
//
// IMPORTANT:
// ExamApproval.jsx mpya haitumii route hii.
// =====================================================

router.post(

    "/:id/reject",

    rejectExam

);


// =====================================================
// GET SINGLE EXAMINATION
//
// GET /api/exams/:id
// =====================================================

router.get(

    "/:id",

    getExamById

);


// =====================================================
// UPDATE EXAMINATION
//
// PUT /api/exams/:id
// =====================================================

router.put(

    "/:id",

    updateExam

);


// =====================================================
// DELETE EXAMINATION
//
// DELETE /api/exams/:id
// =====================================================

router.delete(

    "/:id",

    deleteExam

);


export default router;