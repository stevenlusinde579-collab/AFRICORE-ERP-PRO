import { Router } from "express";
import multer from "multer";
import { authenticateUser } from "../middleware/authMiddleware.js";
import { previewSignatureRegisterPdf } from "../controllers/hrSignatureRegisterController.js";

const router = Router();
const allowedTypes = new Set(["application/pdf", "image/png", "image/jpeg"]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extensionAllowed = /\.(pdf|png|jpe?g)$/i.test(file.originalname || "");
    if (!allowedTypes.has(file.mimetype) || !extensionAllowed) {
      return callback(new Error("Upload PDF, PNG au JPG/JPEG pekee."));
    }
    callback(null, true);
  }
});

router.post("/preview", authenticateUser, upload.single("file"), previewSignatureRegisterPdf);

export default router;
