import express from "express";

import {
    getSchools,
    getSchoolOverview,
    createSchool,
    updateSchool,
    getHeadmasters,
    createSchoolHeadmaster,
    resendHeadmasterCredentials,
    assignHeadmaster,
    getSchoolSmsSettings,
    saveSchoolSmsSettings
} from "../controllers/schoolManagementController.js";

import { authenticateUser } from "../middleware/authMiddleware.js";
import { requireSuperAdmin } from "../middleware/superAdminMiddleware.js";

const router = express.Router();

// Every school-management endpoint is restricted to authenticated Super Admins.
router.use(authenticateUser, requireSuperAdmin);

router.get("/headmasters", getHeadmasters);
router.post("/:id/headmasters", createSchoolHeadmaster);
router.post("/headmasters/:profileId/resend-credentials", resendHeadmasterCredentials);
router.patch("/headmasters/:profileId/school", assignHeadmaster);

router.get("/:id/overview", getSchoolOverview);
router.get("/:id/sms-settings", getSchoolSmsSettings);
router.put("/:id/sms-settings", saveSchoolSmsSettings);
router.get("/", getSchools);
router.post("/", createSchool);
router.patch("/:id", updateSchool);

export default router;
