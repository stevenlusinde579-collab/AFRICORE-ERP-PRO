import express from "express";
import { authenticateUser } from "../middleware/authMiddleware.js";
import { requireSchoolContext, requireExamSchoolScope } from "../middleware/schoolContextMiddleware.js";
import { requirePermission } from "../middleware/permissionMiddleware.js";

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

// Every examination endpoint requires a verified user and school context.
router.use(authenticateUser, requireSchoolContext, requireExamSchoolScope);


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

    requirePermission("EXAM_VIEW"),
    getExams

);


// =====================================================
// CREATE EXAMINATION
// POST /api/exams
// =====================================================

router.post(

    "/",

    requirePermission("EXAM_CREATE"),
    createExam

);


// =====================================================
// SAVE EXAM MARKS
// POST /api/exams/marks
// =====================================================

router.post(

    "/marks",

    requirePermission("EXAM_ENTER_MARKS"),
    saveExamMarks

);


// =====================================================
// GET STUDENTS FOR EXAM SUBJECT
// GET /api/exams/exam-subject/:examSubjectId/students
// =====================================================

router.get(

    "/exam-subject/:examSubjectId/students",

    requirePermission("EXAM_VIEW"),
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

    requirePermission("EXAM_VIEW"),
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

    (req, res, next) => {
        const type = String(req.body?.type || "").trim().toLowerCase();
        const permissions = {
            academic: "EXAM_APPROVE_ACADEMIC",
            deputy: "EXAM_APPROVE_SECOND_MASTER",
            headmaster: "EXAM_APPROVE_HEADMASTER"
        };
        if (!permissions[type]) {
            return res.status(400).json({ success: false, message: "Valid approval type is required." });
        }
        return requirePermission(permissions[type])(req, res, next);
    },
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

    requirePermission("EXAM_APPROVE_HEADMASTER"),
    rejectExamSubject

);


// =====================================================
// RESET SUBJECT-LEVEL APPROVAL
//
// POST /api/exams/exam-subject/:examSubjectId/reset-approval
// =====================================================

router.post(

    "/exam-subject/:examSubjectId/reset-approval",

    requirePermission("EXAM_MANAGE_PERMISSION"),
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

    requirePermission("EXAM_VIEW"),
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

    requirePermission("EXAM_VIEW"),
    getExamPapersHistory

);


// =====================================================
// DELETE ONE EXAMINATION PAPER
//
// DELETE /api/exams/papers/:paperId
// =====================================================

router.delete(

    "/papers/:paperId",

    requirePermission("EXAM_UPLOAD_PAPER"),
    deleteExamPaper

);


// =====================================================
// GET EXAM SUBJECTS
//
// GET /api/exams/:id/subjects
// =====================================================

router.get(

    "/:id/subjects",

    requirePermission("EXAM_VIEW"),
    getExamSubjects

);


// =====================================================
// AI EXAMINATION ANALYSIS
//
// GET /api/exams/:id/ai-analysis
// =====================================================

router.get(

    "/:id/ai-analysis",

    requirePermission("EXAM_VIEW_AI_REPORT"),
    analyzeExamWithAI

);


// =====================================================
// RESULTS ANALYSIS
//
// GET /api/exams/:id/results-analysis
// =====================================================

router.get(

    "/:id/results-analysis",

    requirePermission("EXAM_VIEW"),
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

    requirePermission("EXAM_APPROVE_HEADMASTER"),
    rejectExam

);


// =====================================================
// GET SINGLE EXAMINATION
//
// GET /api/exams/:id
// =====================================================

router.get(

    "/:id",

    requirePermission("EXAM_VIEW"),
    getExamById

);


// =====================================================
// UPDATE EXAMINATION
//
// PUT /api/exams/:id
// =====================================================

router.put(

    "/:id",

    requirePermission("EXAM_EDIT"),
    updateExam

);


// =====================================================
// DELETE EXAMINATION
//
// DELETE /api/exams/:id
// =====================================================

router.delete(

    "/:id",

    requirePermission("EXAM_DELETE"),
    deleteExam

);


export default router;