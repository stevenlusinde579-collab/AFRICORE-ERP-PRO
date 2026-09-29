import express from "express";


import {
    getCurrentUser
} from "../controllers/authController.js";


import {
    getCurrentProfile
} from "../controllers/profileController.js";


import {
    testAccessScope
} from "../controllers/accessTestController.js";


import {
    authenticateUser
} from "../middleware/authMiddleware.js";


const router =
    express.Router();


/**
 * ============================================================
 * GET CURRENT SUPABASE AUTH USER
 *
 * GET /api/auth/me
 * ============================================================
 */

router.get(
    "/me",
    authenticateUser,
    getCurrentUser
);


/**
 * ============================================================
 * GET CURRENT AFRICORE PROFILE
 *
 * GET /api/auth/profile
 * ============================================================
 */

router.get(
    "/profile",
    authenticateUser,
    getCurrentProfile
);


/**
 * ============================================================
 * TEST ACCESS SCOPE ENGINE
 *
 * GET /api/auth/access-test
 *
 * Basic test:
 *
 * /api/auth/access-test
 *
 * Subject/Class test:
 *
 * /api/auth/access-test?subjectId=21&classId=29
 *
 * ============================================================
 */

router.get(
    "/access-test",
    authenticateUser,
    testAccessScope
);


export default router;