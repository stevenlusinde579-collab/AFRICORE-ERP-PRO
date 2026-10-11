import express from "express";

import {
    getSchools,
    createSchool,
    updateSchool,
    getHeadmasters,
    assignHeadmaster
} from "../controllers/schoolManagementController.js";

import { authenticateUser } from "../middleware/authMiddleware.js";
import { requireSuperAdmin } from "../middleware/superAdminMiddleware.js";

const router = express.Router();

// Every school-management endpoint is restricted to authenticated Super Admins.
router.use(authenticateUser, requireSuperAdmin);

router.get("/headmasters", getHeadmasters);
router.patch("/headmasters/:profileId/school", assignHeadmaster);

router.get("/", getSchools);
router.post("/", createSchool);
router.patch("/:id", updateSchool);

export default router;
