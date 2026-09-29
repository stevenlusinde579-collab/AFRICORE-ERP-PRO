import express from "express";

import {
    createTeacher,
    updateTeacher
} from "../controllers/teacherController.js";

import {
    authenticateUser
} from "../middleware/authMiddleware.js";

import {
    requireSuperAdmin
} from "../middleware/superAdminMiddleware.js";


const router = express.Router();


// =====================================================
// CREATE TEACHER
// POST /api/teachers
// =====================================================

router.post(
    "/",
    authenticateUser,
    requireSuperAdmin,
    createTeacher
);


// =====================================================
// UPDATE TEACHER
// PUT /api/teachers/:id
// =====================================================

router.put(
    "/:id",
    authenticateUser,
    requireSuperAdmin,
    updateTeacher
);


export default router;