import "dotenv/config";

import express from "express";
import cors from "cors";

import examRoutes from "./routes/examRoutes.js";
import aiRoutes from "./routes/ai.routes.js";
import resultAnalysisRoutes from "./routes/resultAnalysisRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import teacherRoutes from "./routes/teacherRoutes.js";
import communicationRoutes from "./routes/communicationRoutes.js";
import financeRoutes from "./routes/financeRoutes.js";
import schoolManagementRoutes from "./routes/schoolManagementRoutes.js";
import { authenticateUser } from "./middleware/authMiddleware.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "AfriCore ERP Backend is running",
        port: PORT
    });
});

// Public operational probes only. All other /api requests must pass
// authentication AND the current school-active check before reaching a route.
const publicApiPaths = new Set([
    "GET /ai/health",
    "GET /exams/route-test",
    "GET /result-analysis/test",
    "GET /finance/route-test",
    "GET /communication",
    "GET /communication/"
]);

app.use("/api", (req, res, next) => {
    const key = `${req.method} ${req.path}`;
    if (publicApiPaths.has(key)) return next();
    return authenticateUser(req, res, next);
});

app.use("/api/exams", examRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/result-analysis", resultAnalysisRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/schools", schoolManagementRoutes);
app.use("/api/communication", communicationRoutes);

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "API route not found",
        method: req.method,
        path: req.originalUrl
    });
});

app.use((error, req, res, next) => {
    console.error("AFRICORE BACKEND ERROR", error);
    res.status(500).json({
        success: false,
        message: error?.message || "Internal server error"
    });
});

const server = app.listen(PORT, () => {
    console.log("========================================");
    console.log("AFRICORE ERP BACKEND");
    console.log("========================================");
    console.log(`Server running on port ${PORT}`);
    console.log(`http://localhost:${PORT}`);
    console.log(`Communication API: http://localhost:${PORT}/api/communication`);
    console.log("========================================");
});

server.on("error", (error) => {
    console.error("SERVER ERROR:", error);
});

process.on("SIGINT", () => {
    console.log("Shutting down server...");
    server.close(() => process.exit(0));
});

process.on("SIGTERM", () => {
    console.log("Shutting down server...");
    server.close(() => process.exit(0));
});
