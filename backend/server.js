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

/* =========================================================
   APP
========================================================= */

const app = express();

const PORT = process.env.PORT || 5000;


/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(
    cors({
        origin: true,
        credentials: true,
    })
);


app.use(
    express.json({
        limit: "20mb",
    })
);


app.use(
    express.urlencoded({
        extended: true,
        limit: "20mb",
    })
);


/* =========================================================
   ROOT / HEALTH CHECK
========================================================= */

app.get("/", (req, res) => {

    res.json({
        success: true,
        message: "AfriCore ERP Backend is running",
        port: PORT,
    });

});


/* =========================================================
   API ROUTES
========================================================= */

app.use(
    "/api/exams",
    examRoutes
);

app.use(
    "/api/finance",
    financeRoutes
);

app.use(
    "/api/ai",
    aiRoutes
);


app.use(
    "/api/result-analysis",
    resultAnalysisRoutes
);


app.use(
    "/api/auth",
    authRoutes
);


app.use(
    "/api/teachers",
    teacherRoutes
);


/*
 * COMMUNICATION
 *
 * Frontend endpoint:
 *
 * POST /api/communication/parent-result
 *
 * Used for:
 * SMS
 * WhatsApp
 * Email
 */
app.use(
    "/api/communication",
    communicationRoutes
);


/* =========================================================
   404 HANDLER
========================================================= */

app.use((req, res) => {

    res.status(404).json({
        success: false,
        message: "API route not found",
        method: req.method,
        path: req.originalUrl,
    });

});


/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use(
    (error, req, res, next) => {

        console.error(
            "========================================"
        );

        console.error(
            "AFRICORE BACKEND ERROR"
        );

        console.error(
            "========================================"
        );

        console.error(error);


        res.status(500).json({
            success: false,
            message:
                error?.message ||
                "Internal server error",
        });

    }
);


/* =========================================================
   START SERVER
========================================================= */

const server = app.listen(
    PORT,
    () => {

        console.log("");
        console.log(
            "========================================"
        );

        console.log(
            "AFRICORE ERP BACKEND"
        );

        console.log(
            "========================================"
        );

        console.log(
            `Server running on port ${PORT}`
        );

        console.log(
            `http://localhost:${PORT}`
        );

        console.log(
            `Communication API: http://localhost:${PORT}/api/communication`
        );

        console.log(
            "========================================"
        );

        console.log("");

    }
);


/* =========================================================
   SERVER ERROR
========================================================= */

server.on(
    "error",
    (error) => {

        console.error(
            "SERVER ERROR:"
        );

        console.error(error);

    }
);


/* =========================================================
   GRACEFUL SHUTDOWN
========================================================= */

process.on(
    "SIGINT",
    () => {

        console.log(
            "Shutting down server..."
        );

        server.close(
            () => {
                process.exit(0);
            }
        );

    }
);


process.on(
    "SIGTERM",
    () => {

        console.log(
            "Shutting down server..."
        );

        server.close(
            () => {
                process.exit(0);
            }
        );

    }
);