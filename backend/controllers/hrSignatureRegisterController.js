import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";

const MAX_PAGES = 30;
const MAX_RENDER_SIDE = 1800;

export async function previewSignatureRegisterPdf(req, res) {
  try {
    const roleNames = (req.access?.roles || []).map((role) => String(role.role_name || "").trim().toLowerCase());
    if (req.access?.isSuperAdmin !== true && !roleNames.includes("hr manager")) {
      return res.status(403).json({ success: false, message: "HR Manager pekee ndiye anayeruhusiwa kuchakata fomu hii." });
    }
    if (!req.file?.buffer || req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ success: false, message: "Chagua PDF ya fomu ya saini." });
    }
    const loadingTask = getDocument({ data: new Uint8Array(req.file.buffer), useSystemFonts: true, isEvalSupported: false });
    const pdf = await loadingTask.promise;
    if (!pdf.numPages || pdf.numPages > MAX_PAGES) {
      await pdf.destroy();
      return res.status(400).json({ success: false, message: `PDF inaruhusiwa kuwa na kurasa 1 hadi ${MAX_PAGES}.` });
    }
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(1.5, MAX_RENDER_SIDE / Math.max(baseViewport.width, baseViewport.height));
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext("2d");
      await page.render({ canvasContext: context, viewport, canvas }).promise;
      pages.push({ page: pageNumber, width: canvas.width, height: canvas.height, dataUrl: canvas.toDataURL("image/png") });
      page.cleanup();
    }
    await pdf.destroy();
    return res.json({ success: true, pageCount: pages.length, pages });
  } catch (error) {
    console.error("HR SIGNATURE PDF PREVIEW ERROR:", error);
    return res.status(422).json({ success: false, message: error?.message || "PDF haikuweza kusomwa. Hakikisha si PDF iliyoharibika au yenye password." });
  }
}
