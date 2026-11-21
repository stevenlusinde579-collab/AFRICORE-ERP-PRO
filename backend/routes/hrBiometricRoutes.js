import { Router } from "express";
import { authenticateUser } from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/permissionMiddleware.js";
import {
  pairBiometricDevice, revokeBiometricPairing, authenticateBiometricAgent,
  biometricAgentHeartbeat, getAgentEnrollmentRoster, syncEnrollmentMetadata,
  syncBiometricAttendance
} from "../controllers/hrBiometricController.js";

const router = Router();

router.post("/devices/:deviceId/pair", authenticateUser, requirePermission("manage_hr_attendance"), pairBiometricDevice);
router.delete("/devices/:deviceId/pair", authenticateUser, requirePermission("manage_hr_attendance"), revokeBiometricPairing);

router.use("/agent", authenticateBiometricAgent);
router.post("/agent/heartbeat", biometricAgentHeartbeat);
router.get("/agent/enrollments", getAgentEnrollmentRoster);
router.post("/agent/enrollments/sync", syncEnrollmentMetadata);
router.post("/agent/attendance/sync", syncBiometricAttendance);

export default router;
