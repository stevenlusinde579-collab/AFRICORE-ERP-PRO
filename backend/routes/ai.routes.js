import express from "express";
import multer from "multer";

import {
    analyzePaper,
    getAIAnalysisByExamSubject,
    getAIAnalysis,
    aiHealthCheck,
} from "../controllers/ai.controller.js";

const router = express.Router();


// ============================================================
// MULTER — MEMORY STORAGE
// ============================================================
// ai.controller.js expects req.file.buffer
// Therefore the uploaded PDF must remain in memory.

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 25 * 1024 * 1024, // 25 MB
    },
});


// ============================================================
// AI HEALTH
// ============================================================

router.get(
    "/health",
    aiHealthCheck
);


// ============================================================
// AI ANALYSIS — EXAM SUBJECT
// ============================================================

router.get(
    "/analysis/:examId/:examSubjectId",
    getAIAnalysisByExamSubject
);


// ============================================================
// AI ANALYSIS — WHOLE EXAM
// ============================================================

router.get(
    "/analysis/:examId",
    getAIAnalysis
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