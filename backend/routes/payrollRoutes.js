import express from "express";
import { authenticateUser } from "../middleware/authMiddleware.js";
import {
    getPayrollWorkspace,
    getPayrollDetails,
    savePayrollSettings,
    createPayrollDraft,
    updatePayrollItem,
    submitPayrollForReview,
    reviewPayroll,
    postPayrollToFinance,
    payPayrollItem,
} from "../controllers/payrollController.js";

const router = express.Router();

router.use(authenticateUser);

router.get("/", getPayrollWorkspace);
router.get("/:payrollId", getPayrollDetails);
router.put("/settings", savePayrollSettings);
router.post("/", createPayrollDraft);
router.patch("/:payrollId/items/:itemId", updatePayrollItem);
router.post("/:payrollId/submit", submitPayrollForReview);
router.post("/:payrollId/review", reviewPayroll);
router.post("/:payrollId/post", postPayrollToFinance);
router.post("/:payrollId/items/:itemId/pay", payPayrollItem);

export default router;
