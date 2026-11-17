import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import { createWorker } from "tesseract.js";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

// PDF.js uses browser canvas primitives while rendering pages in Node.
if (typeof globalThis.DOMMatrix === "undefined") globalThis.DOMMatrix = DOMMatrix;
if (typeof globalThis.ImageData === "undefined") globalThis.ImageData = ImageData;
if (typeof globalThis.Path2D === "undefined") globalThis.Path2D = Path2D;

export const OCR_MAX_PAGES = 25;
export const OCR_MAX_FILE_BYTES = 30 * 1024 * 1024;

// Abort active OCR/render work when the HTTP request reaches its deadline.
const createAbortError = (signal) => {
    if (signal?.reason instanceof Error) return signal.reason;
    const error = new Error("PDF OCR was cancelled.");
    error.name = "AbortError";
    return error;
};
const throwIfAborted = (signal) => {
    if (signal?.aborted) throw createAbortError(signal);
};
const awaitWithAbort = (operation, signal, onAbort) => {
    if (!signal) return Promise.resolve(operation);
    if (signal.aborted) {
        try { onAbort?.(); } catch {}
        return Promise.reject(createAbortError(signal));
    }
    return new Promise((resolve, reject) => {
        const abort = () => {
            try { onAbort?.(); } catch {}
            reject(createAbortError(signal));
        };
        signal.addEventListener("abort", abort, { once: true });
        Promise.resolve(operation).then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    });
};

export const scoreExamTextQuality = (value) => {
    const text = String(value || "").replace(/\u0000/g, "").trim();
    if (!text) return 0;

    const words = text.match(/[\p{L}\p{N}]{2,}/gu) || [];
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const questionHeaders = [
        ...text.matchAll(/^\s*(?:QUESTION\s*)?\d{1,3}\s*[.)\-:]?\s*\S/gim),
        ...text.matchAll(/^\s*Q\s*\d{1,3}\b/gim),
    ].length;
    const sectionHeaders = [...text.matchAll(/^\s*(?:SECTION|SEHEMU)\s+[A-F]\b/gim)].length;
    const markEvidence = [...text.matchAll(/\b\d+(?:\.\d+)?\s*(?:marks?|mks?|alama)\b/gi)].length;
    const visibleChars = [...text].filter(char => !/\s/.test(char));
    const readableChars = visibleChars.filter(char => /[\p{L}\p{N},.;:!?()[\]{}%+\-/'"’]/u.test(char));
    const readability = visibleChars.length
        ? readableChars.length / visibleChars.length
        : 0;

    return Math.round(
        Math.min(20, words.length * 0.8) +
        Math.min(15, lines.length * 0.5) +
        Math.min(25, questionHeaders * 5) +
        Math.min(10, sectionHeaders * 3) +
        Math.min(10, markEvidence * 2) +
        Math.max(0, Math.min(20, readability * 20))
    );
};

export const isLikelyScannedPdfText = (value) => {
    const raw = String(value || "").trim();
    const text = raw.replace(/\s+/g, " ");
    const words = text.match(/[\p{L}\p{N}]{2,}/gu) || [];
    const usefulWords = words.filter(word => !/^camscanner$/i.test(word));
    const scannerWatermarkOnly =
        /camscanner/i.test(text) && usefulWords.length <= 3;

    // Preserve short, genuinely readable papers. Trigger OCR for longer but
    // structurally weak extraction too (e.g. a scanned page with OCR-like
    // fragments, broken glyphs, or a few unrelated text-layer artefacts).
    const hasExamStructure =
        /^\s*(?:QUESTION\s*\d+|Q\s*\d+|\d{1,3}\s*[.)\-:]|SECTION\s+[A-F]|SEHEMU\s+[A-F])(?=\s|$|[.)\-:])/im.test(raw);
    const visibleCharacters = [...raw].filter(char => !/\s/.test(char));
    const nonWordCharacters = visibleCharacters.filter(char => !/[\p{L}\p{N}]/u.test(char));
    const symbolNoiseRatio = visibleCharacters.length
        ? nonWordCharacters.length / visibleCharacters.length
        : 0;
    const structurallyNoisyExtraction =
        !hasExamStructure && symbolNoiseRatio > 0.28;
    const weakLongExtraction = raw.length >= 120 &&
        (usefulWords.length < 10 ||
            scoreExamTextQuality(raw) < 30 ||
            structurallyNoisyExtraction);
    return scannerWatermarkOnly ||
        (text.length < 100 && usefulWords.length < 5) ||
        usefulWords.length < 3 ||
        weakLongExtraction;
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
    const renderScale = Number(options.renderScale) > 0 ? Number(options.renderScale) : 1.8;
    const signal = options.signal;

    let document;
    let worker;
    let workerTerminated = false;
    const terminateWorker = async () => {
        if (!worker || workerTerminated) return;
        workerTerminated = true;
        await worker.terminate().catch(() => {});
    };
    try {
        throwIfAborted(signal);
        document = await awaitWithAbort(pdfjs({
            data: new Uint8Array(buffer),
            useSystemFonts: true,
            isEvalSupported: false,
            stopAtErrors: true,
        }).promise, signal);
        throwIfAborted(signal);

        const pageCount = Number(document.numPages) || 0;
        if (!pageCount) throw new Error("OCR could not find any pages in the PDF.");
        if (pageCount > OCR_MAX_PAGES) {
            throw new Error("OCR safety limit: this PDF has " + pageCount +
                " pages; the current limit is " + OCR_MAX_PAGES + " pages per analysis.");
        }

        const workerOptions = {
            logger: () => {},
            cacheMethod: "write",
        };
        const createAbortableWorker = async (languages) => {
            const pendingWorker = Promise.resolve(workerFactory(languages, 1, workerOptions));
            // If the language data finishes loading after cancellation, terminate
            // the late-created worker immediately so it cannot leak resources.
            pendingWorker.then(async lateWorker => {
                if (signal?.aborted) await lateWorker?.terminate?.().catch(() => {});
            }).catch(() => {});
            return await awaitWithAbort(pendingWorker, signal);
        };
        try {
            worker = await createAbortableWorker(options.languages || "eng+swa");
            console.log("PDF OCR LANGUAGES: English + Swahili");
        } catch (languageError) {
            if (signal?.aborted) throw createAbortError(signal);
            // Some deployments may not have the Swahili traineddata available.
            // English remains a safe fallback so OCR can still attempt the paper.
            console.warn("Swahili OCR language unavailable; retrying English:", languageError?.message || languageError);
            worker = await createAbortableWorker("eng");
            console.log("PDF OCR LANGUAGES: English fallback");
        }
        throwIfAborted(signal);
        await awaitWithAbort(worker.setParameters({
            preserve_interword_spaces: "1",
            user_defined_dpi: "180",
        }), signal, terminateWorker);

        const pageTexts = [];
        for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
            throwIfAborted(signal);
            const page = await awaitWithAbort(document.getPage(pageNumber), signal);
            const viewport = page.getViewport({ scale: renderScale });
            const width = Math.max(1, Math.ceil(viewport.width));
            const height = Math.max(1, Math.ceil(viewport.height));

            if (width * height > 18_000_000) {
                throw new Error("OCR stopped: page " + pageNumber + " exceeds the safe image size.");
            }

            const canvas = canvasFactory(width, height);
            try {
                const context = canvas.getContext("2d");
                const renderTask = page.render({ canvasContext: context, viewport });
                await awaitWithAbort(renderTask.promise, signal, () => renderTask.cancel());
                throwIfAborted(signal);
                const image = canvas.toBuffer("image/png");
                const pageStartedAt = Date.now();
                const result = await awaitWithAbort(worker.recognize(image), signal, terminateWorker);
                const pageText = cleanOcrText(result?.data?.text);
                pageTexts.push("=== PDF PAGE " + pageNumber + " ===\n" + pageText);
                console.log("PDF OCR PAGE:", {
                    page: pageNumber,
                    pages: pageCount,
                    characters: pageText.length,
                    confidence: Math.round(Number(result?.data?.confidence) || 0),
                    durationMs: Date.now() - pageStartedAt,
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
        await terminateWorker();
        if (document && typeof document.destroy === "function") {
            await Promise.resolve(document.destroy()).catch(() => {});
        }
    }
};

export default extractScannedPdfText;
