import express from "express";
import multer from "multer";

import {
    analyzePaper,
    getAnalysis,
    getAnalysisByExam,
    healthCheck,
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