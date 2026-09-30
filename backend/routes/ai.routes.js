import express from "express";

import {
    analyzePaper,
    getAnalysis,
    getAnalysisByExam,
    healthCheck,
} from "../controllers/ai.controller.js";

import upload from "../middleware/upload.js";

const router = express.Router();


// ============================================================
// AI HEALTH
// ============================================================

router.get(
    "/health",
    healthCheck
);


// ============================================================
// AI ANALYSIS — EXAM SUBJECT
// ============================================================

router.get(
    "/analysis/:examId/:examSubjectId",
    getAnalysis
);


// ============================================================
// AI ANALYSIS — WHOLE EXAM
// ============================================================

router.get(
    "/analysis/:examId",
    getAnalysisByExam
);


// ============================================================
// UPLOAD EXAMINATION PAPER
// ============================================================

router.post(
    "/analyze-paper",
    upload.single("paper"),
    analyzePaper
);


export default router;