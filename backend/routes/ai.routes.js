import express from "express";
import multer from "multer";

import {
    analyzePaper,
    getAIAnalysis,
    getAIAnalysisByExamSubject,
    aiHealthCheck,
} from "../controllers/ai.controller.js";

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 20 * 1024 * 1024,
    },

    fileFilter: (req, file, cb) => {
        const isPdf =
            file?.mimetype === "application/pdf" ||
            String(file?.originalname || "")
                .toLowerCase()
                .endsWith(".pdf");

        if (!isPdf) {
            return cb(
                new Error(
                    "Only PDF examination papers are allowed."
                ),
                false
            );
        }

        cb(null, true);
    },
});


// ===============================
// AI HEALTH CHECK
// ===============================
router.get("/health", aiHealthCheck);


// ===============================
// UPLOAD + AI ANALYSIS
// ===============================
router.post(
    "/analyze-paper",
    upload.single("paper"),
    analyzePaper
);


// ===============================
// GET AI ANALYSIS BY EXAM
// ===============================
router.get(
    "/analysis/:examId",
    getAIAnalysis
);


// ===============================
// GET AI ANALYSIS BY EXAM + SUBJECT
// ===============================
router.get(
    "/analysis/:examId/:examSubjectId",
    getAIAnalysisByExamSubject
);


export default router;