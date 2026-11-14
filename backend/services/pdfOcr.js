import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import { createWorker } from "tesseract.js";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

// PDF.js uses browser canvas primitives while rendering pages in Node.
if (typeof globalThis.DOMMatrix === "undefined") globalThis.DOMMatrix = DOMMatrix;
if (typeof globalThis.ImageData === "undefined") globalThis.ImageData = ImageData;
if (typeof globalThis.Path2D === "undefined") globalThis.Path2D = Path2D;

export const OCR_MAX_PAGES = 25;
export const OCR_MAX_FILE_BYTES = 30 * 1024 * 1024;

export const isLikelyScannedPdfText = (value) => {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    const words = text.match(/[\\p{L}\\p{N}]{2,}/gu) || [];
    const usefulWords = words.filter(word => !/^camscanner$/i.test(word));
    const scannerWatermarkOnly =
        /camscanner/i.test(text) && usefulWords.length <= 3;
    // Short but readable papers must not be sent to OCR unnecessarily.
    return scannerWatermarkOnly ||
        (text.length < 100 && usefulWords.length < 5) ||
        usefulWords.length < 3;
};

export const cleanOcrText = (value) => String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(line => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();

/**
 * OCR fallback for image-only/scanned PDFs.
 * Pages are rendered and recognized sequentially to keep memory bounded.
 * The original PDF is never modified.
 */
export const extractScannedPdfText = async (buffer, options = {}) => {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new Error("OCR received an empty or invalid PDF buffer.");
    }
    if (buffer.length > OCR_MAX_FILE_BYTES) {
        throw new Error("OCR skipped: PDF exceeds the 30 MB processing limit.");
    }

    const pdfjs = options.getDocument || getDocument;
    const canvasFactory = options.createCanvas || createCanvas;
    const workerFactory = options.createWorker || createWorker;
    const renderScale = Number(options.renderScale) > 0 ? Number(options.renderScale) : 1.65;

    let document;
    let worker;
    try {
        document = await pdfjs({
            data: new Uint8Array(buffer),
            useSystemFonts: true,
            isEvalSupported: false,
            stopAtErrors: true,
        }).promise;

        const pageCount = Number(document.numPages) || 0;
        if (!pageCount) throw new Error("OCR could not find any pages in the PDF.");
        if (pageCount > OCR_MAX_PAGES) {
            throw new Error("OCR safety limit: this PDF has " + pageCount +
                " pages; the current limit is " + OCR_MAX_PAGES + " pages per analysis.");
        }

        worker = await workerFactory("eng+swa", 1, {
            logger: () => {},
            cacheMethod: "write",
        });
        await worker.setParameters({
            preserve_interword_spaces: "1",
            user_defined_dpi: "180",
        });

        const pageTexts = [];
        for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
            const page = await document.getPage(pageNumber);
            const viewport = page.getViewport({ scale: renderScale });
            const width = Math.max(1, Math.ceil(viewport.width));
            const height = Math.max(1, Math.ceil(viewport.height));

            if (width * height > 18_000_000) {
                throw new Error("OCR stopped: page " + pageNumber + " exceeds the safe image size.");
            }

            const canvas = canvasFactory(width, height);
            try {
                const context = canvas.getContext("2d");
                await page.render({ canvasContext: context, viewport }).promise;
                const image = canvas.toBuffer("image/png");
                const result = await worker.recognize(image);
                const pageText = cleanOcrText(result?.data?.text);
                pageTexts.push("=== PDF PAGE " + pageNumber + " ===\n" + pageText);
                console.log("PDF OCR PAGE:", {
                    page: pageNumber,
                    pages: pageCount,
                    characters: pageText.length,
                    confidence: Math.round(Number(result?.data?.confidence) || 0),
                });
            } finally {
                canvas.width = 1;
                canvas.height = 1;
                page.cleanup?.();
            }
        }

        const text = pageTexts.join("\n\n").trim();
        if (text.replace(/=== PDF PAGE \d+ ===/g, "").trim().length < 40) {
            throw new Error("OCR completed but could not recognize enough readable text.");
        }
        return text;
    } finally {
        if (worker) await worker.terminate().catch(() => {});
        if (document && typeof document.destroy === "function") {
            await Promise.resolve(document.destroy()).catch(() => {});
        }
    }
};

export default extractScannedPdfText;
