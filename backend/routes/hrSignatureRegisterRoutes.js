import { Router } from "express";
import multer from "multer";
import { authenticateUser } from "../middleware/authMiddleware.js";
import { previewSignatureRegisterPdf } from "../controllers/hrSignatureRegisterController.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype !== "application/pdf" || !/\.pdf$/i.test(file.originalname || "")) {
      return callback(new Error("Upload PDF pekee."));
    }
    callback(null, true);
  }
});

router.post("/preview", authenticateUser, upload.single("file"), previewSignatureRegisterPdf);

export default router;
