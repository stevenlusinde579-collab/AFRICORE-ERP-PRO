import express from "express";
import { authenticateUser } from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/permissionMiddleware.js";
import {
  getTransportOverview, listTransportVehicles, saveTransportVehicle,
  listTransportEmployees, listTransportStudents, listTransportRoutes,
  saveTransportRoute, addTransportStop, listTransportCrew, assignTransportCrew,
  listTransportAssignments, assignTransportStudent, getTransportFinanceOptions,
  listTransportFinanceTransactions, submitTransportFinanceTransaction,
  listTransportFinancePending, approveTransportFinanceTransaction, rejectTransportFinanceTransaction
} from "../controllers/transportController.js";

const router = express.Router();
router.use(authenticateUser);

router.get("/overview", requirePermission("view_transport"), getTransportOverview);
router.get("/vehicles", requirePermission("view_transport"), listTransportVehicles);
router.post("/vehicles", requirePermission("manage_transport"), saveTransportVehicle);
router.patch("/vehicles/:id", requirePermission("manage_transport"), (req, res, next) => { req.body.id = req.params.id; next(); }, saveTransportVehicle);

router.get("/employees", requirePermission("view_transport"), listTransportEmployees);
router.get("/students", requirePermission("view_transport"), listTransportStudents);
router.get("/routes", requirePermission("view_transport"), listTransportRoutes);
router.post("/routes", requirePermission("manage_transport"), saveTransportRoute);
router.patch("/routes/:id", requirePermission("manage_transport"), (req, res, next) => { req.body.id = req.params.id; next(); }, saveTransportRoute);
router.post("/routes/:routeId/stops", requirePermission("manage_transport"), addTransportStop);

router.get("/crew", requirePermission("view_transport"), listTransportCrew);
router.post("/crew", requirePermission("manage_transport"), assignTransportCrew);
router.get("/assignments", requirePermission("view_transport"), listTransportAssignments);
router.post("/assignments", requirePermission("manage_transport"), assignTransportStudent);

router.get("/finance/options", requirePermission("view_transport_finance"), getTransportFinanceOptions);
router.get("/finance/transactions", requirePermission("view_transport_finance"), listTransportFinanceTransactions);
router.post("/finance/transactions", requirePermission("manage_transport_finance"), submitTransportFinanceTransaction);
router.get("/finance/pending", requirePermission("approve_transport_finance"), listTransportFinancePending);
router.post("/finance/transactions/:id/approve", requirePermission("approve_transport_finance"), approveTransportFinanceTransaction);
router.post("/finance/transactions/:id/reject", requirePermission("approve_transport_finance"), rejectTransportFinanceTransaction);

export default router;
