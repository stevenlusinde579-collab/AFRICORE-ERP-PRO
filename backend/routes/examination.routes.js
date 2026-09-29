import express from "express";

import {
    getResultAnalysis
} from "../controllers/resultAnalysiscontroller.js";

const router = express.Router();

// =====================================================
// RESULT ANALYSIS
// =====================================================

router.get(
    "/exam/:examId",
    getResultAnalysis
);

export default router;