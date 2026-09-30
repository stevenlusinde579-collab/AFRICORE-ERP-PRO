import express from "express";

import {
    analyzePaper,
    getAIAnalysis,
    getAIAnalysisByExamSubject,
    aiHealthCheck,
} from "../controllers/ai.controller.js";

import upload from "../middleware/upload.js";

const router = express.Router();


// ============================================================
// AI HEALTH CHECK
// ============================================================

router.get(
    "/health",
    aiHealthCheck
);


// ============================================================
// GET AI ANALYSIS BY EXAM + SUBJECT
// ============================================================

router.get(
    "/analysis/:examId/:examSubjectId",
    getAIAnalysisByExamSubject
);


// ============================================================
// GET AI ANALYSIS BY EXAM
// ============================================================

router.get(
    "/analysis/:examId",
    getAIAnalysis
);


// ============================================================
// UPLOAD EXAMINATION PAPER FOR AI ANALYSIS
// ============================================================

router.post(
    "/analyze-paper",
    upload.single("paper"),
    analyzePaper
);


export default router;