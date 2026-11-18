import express from "express";
import { authenticateUser } from "../middleware/authMiddleware.js";
import { requireSuperAdmin } from "../middleware/superAdminMiddleware.js";
import {
    getAiUsageOverview,
    getAiUsageSchoolDetail,
    updateAiUsagePolicy,
} from "../controllers/aiUsageController.js";

const router = express.Router();
router.use(authenticateUser, requireSuperAdmin);
router.get("/overview", getAiUsageOverview);
router.get("/schools/:schoolId", getAiUsageSchoolDetail);
router.put("/schools/:schoolId/policy", updateAiUsagePolicy);

export default router;
