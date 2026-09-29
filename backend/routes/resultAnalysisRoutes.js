import express from "express";

import {
    getResultAnalysis
} from "../controllers/resultAnalysiscontroller.js";


const router = express.Router();


// =====================================================
// GET RESULT ANALYSIS
// GET /api/result-analysis/exam/:examId
// =====================================================

router.get(
    "/exam/:examId",
    getResultAnalysis
);


// =====================================================
// TEST ROUTE
// =====================================================

router.get(
    "/test",
    (req, res) => {

        return res.json({
            success: true,
            message: "Result Analysis route is working"
        });

    }
);


export default router;