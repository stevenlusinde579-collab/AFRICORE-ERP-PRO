import { createRequire } from "node:module";
import { createCanvas } from "@napi-rs/canvas";
import { createWorker } from "tesseract.js";

const require = createRequire(import.meta.url);

// Reuse the PDF.js build already bundled by pdf-parse so both extraction
// paths interpret the uploaded PDF consistently.
const pdfjs = require("pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js");

const MAX_OCR_PAGES = 30;
const TARGET_RENDER_SCALE = 1.6;
const MAX_PAGE_PIXELS = 18_000_000;
const OCR_LANGUAGE = process.env.EXAM_OCR_LANGUAGES || "eng+swa";

const cleanOcrText = (value = "") =>
    String(value)
        .replace(/\u0000/g, "")
        .replace(/[\t ]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

/**
 * Render image-only/scanned PDF pages and recognise their text.
 * This is called only when the normal PDF text extractors produce weak output.
 * Throws on partial-page limits instead of silently analysing an incomplete paper.
 */
export async function extractScannedPdfText(buffer, options = {}) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 8 || buffer.subarray(0, 5).toString("utf8") !== "%PDF-") {
        throw new Error("OCR input must be a valid PDF buffer.");
    }

    const maxPages = Math.min(
        MAX_OCR_PAGES,
        Math.max(1, Number(options.maxPages) || MAX_OCR_PAGES)
    );

    let document;
    let worker;
    const pageTexts = [];

    try {
        const loadingTask = pdfjs.getDocument({
            data: new Uint8Array(buffer),
            disableFontFace: true,
            isEvalSupported: false,
        });
        document = await loadingTask.promise;

        if (document.numPages > maxPages) {
            throw new Error(
                `Scanned PDF has ${document.numPages} pages; OCR limit is ${maxPages}. Refusing to return a partial examination paper.`
            );
        }

        worker = await createWorker(OCR_LANGUAGE, 1, {
            logger: (message) => {
                if (message?.status === "recognizing text") {
                    console.log(
                        `EXAM OCR PAGE PROGRESS: ${Math.round((message.progress || 0) * 100)}%`
                    );
                }
            },
        });

        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
            const page = await document.getPage(pageNumber);
            let scale = TARGET_RENDER_SCALE;
            let viewport = page.getViewport(scale);

            const pixels = viewport.width * viewport.height;
            if (pixels > MAX_PAGE_PIXELS) {
                scale *= Math.sqrt(MAX_PAGE_PIXELS / pixels);
                viewport = page.getViewport(scale);
            }

            const width = Math.max(1, Math.ceil(viewport.width));
            const height = Math.max(1, Math.ceil(viewport.height));
            const canvas = createCanvas(width, height);
            const context = canvas.getContext("2d");

            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, width, height);

            try {
                await page.render({
                    canvasContext: context,
                    viewport,
                }).promise;

                const image = canvas.toBuffer("image/png");
                const result = await worker.recognize(image);
                const text = cleanOcrText(result?.data?.text);

                console.log(
                    `EXAM OCR PAGE ${pageNumber}/${document.numPages}: ${text.length} chars; confidence ${Math.round(result?.data?.confidence || 0)}`
                );

                pageTexts.push(
                    `===== OCR PAGE ${pageNumber} =====\n${text}`
                );
            } finally {
                canvas.width = 1;
                canvas.height = 1;
                page.cleanup?.();
            }
        }

        return pageTexts.filter(Boolean).join("\n\n").trim();
    } finally {
        if (worker) {
            await worker.terminate();
        }
        if (document) {
            await document.destroy();
        }
    }
}

export default extractScannedPdfText;
