import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { createWorker } from "tesseract.js";

const MAX_PAGES = 30;
const MAX_RENDER_SIDE = 1500;
const MAX_OCR_TEXT = 12000;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg"]);

const canvasToPage = async (canvas, pageNumber, worker) => {
  const imageBuffer = canvas.toBuffer("image/png");
  const { data } = await worker.recognize(imageBuffer);
  return {
    page: pageNumber,
    width: canvas.width,
    height: canvas.height,
    dataUrl: canvas.toDataURL("image/png"),
    recognizedText: String(data?.text || "").slice(0, MAX_OCR_TEXT),
    textConfidence: Number.isFinite(data?.confidence) ? Math.round(data.confidence) : null
  };
};

export async function previewSignatureRegisterPdf(req, res) {
  let pdf;
  let worker;
  try {
    const roleNames = (req.access?.roles || []).map((role) => String(role.role_name || "").trim().toLowerCase());
    if (req.access?.isSuperAdmin !== true && !roleNames.includes("hr manager")) {
      return res.status(403).json({ success: false, message: "HR Manager pekee ndiye anayeruhusiwa kuchakata fomu hii." });
    }
    if (!req.file?.buffer) {
      return res.status(400).json({ success: false, message: "Chagua PDF au picha ya fomu ya saini." });
    }

    const mimeType = req.file.mimetype;
    const isPdf = mimeType === "application/pdf" && /\.pdf$/i.test(req.file.originalname || "");
    const isImage = IMAGE_TYPES.has(mimeType) && /\.(png|jpe?g)$/i.test(req.file.originalname || "");
    if (!isPdf && !isImage) {
      return res.status(415).json({ success: false, message: "Aina ya faili haikubaliki. Tumia PDF, PNG au JPG/JPEG." });
    }

    worker = await createWorker("eng");
    const pages = [];
    if (isPdf) {
      const loadingTask = getDocument({ data: new Uint8Array(req.file.buffer), useSystemFonts: true, isEvalSupported: false });
      pdf = await loadingTask.promise;
      if (!pdf.numPages || pdf.numPages > MAX_PAGES) {
        return res.status(400).json({ success: false, message: `PDF inaruhusiwa kuwa na kurasa 1 hadi ${MAX_PAGES}.` });
      }
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(1.5, MAX_RENDER_SIDE / Math.max(baseViewport.width, baseViewport.height));
        const viewport = page.getViewport({ scale });
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const context = canvas.getContext("2d");
        await page.render({ canvasContext: context, viewport }).promise;
        pages.push(await canvasToPage(canvas, pageNumber, worker));
        canvas.width = 0;
        canvas.height = 0;
        page.cleanup();
      }
    } else {
      const image = await loadImage(req.file.buffer);
      const scale = Math.min(1, MAX_RENDER_SIDE / Math.max(image.width, image.height));
      const canvas = createCanvas(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      pages.push(await canvasToPage(canvas, 1, worker));
      canvas.width = 0;
      canvas.height = 0;
    }

    const recognizedText = pages.map((item) => item.recognizedText).filter(Boolean).join("\n\n").slice(0, 30000);
    return res.json({
      success: true,
      fileType: isPdf ? "pdf" : "image",
      pageCount: pages.length,
      recognizedText,
      pages
    });
  } catch (error) {
    console.error("HR SIGNATURE REGISTER PREVIEW/OCR ERROR:", error);
    return res.status(422).json({ success: false, message: error?.message || "Faili haikuweza kusomwa. Hakikisha haijaharibika au haijalindwa kwa password." });
  } finally {
    if (pdf) await pdf.destroy().catch(() => {});
    if (worker) await worker.terminate().catch(() => {});
  }
}
