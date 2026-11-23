import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";

const MAX_PAGES = 30;
const MAX_RENDER_SIDE = 1300;

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
      const canvasFactory = {
        create(width, height) {
          const canvas = createCanvas(width, height);
          return { canvas, context: canvas.getContext("2d") };
        },
        reset(canvasAndContext, width, height) {
          canvasAndContext.canvas.width = width;
          canvasAndContext.canvas.height = height;
        },
        destroy(canvasAndContext) {
          canvasAndContext.canvas.width = 0;
          canvasAndContext.canvas.height = 0;
          canvasAndContext.canvas = null;
          canvasAndContext.context = null;
        }
      };
      const rendered = canvasFactory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvasContext: rendered.context, viewport, canvasFactory }).promise;
      pages.push({ page: pageNumber, width: rendered.canvas.width, height: rendered.canvas.height, dataUrl: rendered.canvas.toDataURL("image/png") });
      canvasFactory.destroy(rendered);
      page.cleanup();
    }
    await pdf.destroy();
    return res.json({ success: true, pageCount: pages.length, pages });
  } catch (error) {
    console.error("HR SIGNATURE PDF PREVIEW ERROR:", error);
    return res.status(422).json({ success: false, message: error?.message || "PDF haikuweza kusomwa. Hakikisha si PDF iliyoharibika au yenye password." });
  }
}
