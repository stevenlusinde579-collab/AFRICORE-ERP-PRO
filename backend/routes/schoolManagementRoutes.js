import express from "express";
import { authenticateUser } from "../middleware/authMiddleware.js";
import { createSchoolHeadmaster } from "../controllers/schoolManagementController.js";

const router = express.Router();

router.post(
    "/headmaster",
    authenticateUser,
    createSchoolHeadmaster
);

export default router;
