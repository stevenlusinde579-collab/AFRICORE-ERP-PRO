import express from "express";

import {
    createTeacher,
    updateTeacher,
    deleteTeacher
} from "../controllers/teacherController.js";

import {
    authenticateUser
} from "../middleware/authMiddleware.js";

import {
    requirePermission
} from "../middleware/permissionMiddleware.js";

import {
    requireStaffManagementSchoolScope
} from "../middleware/staffManagementMiddleware.js";

const router = express.Router();


/**
 * ============================================================
 * CREATE STAFF / NON-STAFF
 * ============================================================
 */

router.post(
    "/",
    authenticateUser,
    requirePermission("create_staff"),
    requireStaffManagementSchoolScope,
    createTeacher
);


/**
 * ============================================================
 * UPDATE STAFF / NON-STAFF
 * ============================================================
 */

router.put(
    "/:id",
    authenticateUser,
    requirePermission("edit_staff"),
    requireStaffManagementSchoolScope,
    updateTeacher
);


/**
 * ============================================================
 * DELETE STAFF / NON-STAFF
 * ============================================================
 *
 * Headmaster:
 * - delete_staff permission required
 * - own school only
 *
 * Super Admin:
 * - existing permission system allows Super Admin
 * - school scope middleware bypasses for Super Admin
 *
 * ============================================================
 */

router.delete(
    "/:id",
    authenticateUser,
    requirePermission("delete_staff"),
    requireStaffManagementSchoolScope,
    deleteTeacher
);


export default router;