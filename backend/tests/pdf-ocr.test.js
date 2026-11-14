import test from "node:test";
import assert from "node:assert/strict";
import { createCanvas } from "@napi-rs/canvas";
import {
    cleanOcrText,
    extractScannedPdfText,
    isLikelyScannedPdfText,
} from "../services/pdfOcr.js";


const createImageOnlyPdf = () => {
    const width = 1400;
    const height = 500;
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#000000";
    context.font = "bold 76px sans-serif";
    context.fillText("QUESTION 1. ACCOUNTING", 55, 155);
    context.font = "54px sans-serif";
    context.fillText("Explain the accounting equation.", 55, 275);
    context.fillText("Assets equal liabilities plus capital.", 55, 365);
    const jpeg = canvas.toBuffer("image/jpeg", 0.95);

    const objects = [
        Buffer.from("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"),
        Buffer.from("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"),
        Buffer.from("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>\nendobj\n"),
        Buffer.from("4 0 obj\n<< /Length 37 >>\nstream\nq\n560 0 0 200 20 300 cm\n/Im0 Do\nQ\nendstream\nendobj\n"),
        Buffer.concat([
            Buffer.from("5 0 obj\n<< /Type /XObject /Subtype /Image /Width " + width +
                " /Height " + height + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " +
                jpeg.length + " >>\nstream\n"),
            jpeg,
            Buffer.from("\nendstream\nendobj\n"),
        ]),
    ];

    const chunks = [Buffer.from("%PDF-1.4\n")];
    const offsets = [];
    for (const object of objects) {
        offsets.push(Buffer.concat(chunks).length);
        chunks.push(object);
    }
    const xrefOffset = Buffer.concat(chunks).length;
    const xref = [
        "xref",
        "0 6",
        "0000000000 65535 f ",
        ...offsets.map(offset => String(offset).padStart(10, "0") + " 00000 n "),
        "trailer",
        "<< /Size 6 /Root 1 0 R >>",
        "startxref",
        String(xrefOffset),
        "%%EOF",
        "",
    ].join("\n");
    chunks.push(Buffer.from(xref));
    return Buffer.concat(chunks);
};

test("identifies CamScanner-only extraction as a scanned PDF", () => {
    assert.equal(isLikelyScannedPdfText("CamScanner\nCamScanner"), true);
});

test("does not classify a short but readable examination as scanned", () => {
    assert.equal(isLikelyScannedPdfText("QUESTION 1. Define assets and liabilities."), false);
});

test("does not classify a readable text-based paper as scanned", () => {
    const paper = Array.from({ length: 35 }, (_, index) =>
        "QUESTION " + (index + 1) + ". Explain the accounting treatment and prepare the relevant financial statements."
    ).join("\n");
    assert.equal(isLikelyScannedPdfText(paper), false);
});

test("normalizes OCR text while preserving question and line boundaries", () => {
    assert.equal(
        cleanOcrText(" QUESTION 1.   Explain  \r\n\r\n (a)  Prepare accounts. "),
        "QUESTION 1. Explain\n(a) Prepare accounts."
    );
});

test("renders and recognizes each PDF page in order and releases OCR resources", async () => {
    const rendered = [];
    const recognized = [];
    let terminated = false;
    let destroyed = false;
    const fakeDocument = {
        numPages: 2,
        async getPage(number) {
            return {
                getViewport: () => ({ width: 100, height: 120 }),
                render: async () => { rendered.push(number); return { promise: Promise.resolve() }; },
                cleanup: () => {},
            };
        },
        async destroy() { destroyed = true; },
    };
    const result = await extractScannedPdfText(Buffer.from("%PDF-test"), {
        getDocument: () => ({ promise: Promise.resolve(fakeDocument) }),
        createCanvas: () => ({
            width: 100,
            height: 120,
            getContext: () => ({}),
            toBuffer: () => Buffer.from("page-image"),
        }),
        createWorker: async (languages) => {
            assert.equal(languages, "eng+swa");
            return {
                setParameters: async () => {},
                recognize: async () => {
                    const page = recognized.length + 1;
                    recognized.push(page);
                    return { data: { text: "QUESTION " + page + ". Explain the accounting treatment.", confidence: 91 } };
                },
                async terminate() { terminated = true; },
            };
        },
    });
    assert.deepEqual(rendered, [1, 2]);
    assert.deepEqual(recognized, [1, 2]);
    assert.match(result, /=== PDF PAGE 1 ===[\s\S]*=== PDF PAGE 2 ===/);
    assert.equal(terminated, true);
    assert.equal(destroyed, true);
});

test("rejects PDFs beyond the OCR page safety limit", async () => {
    await assert.rejects(
        extractScannedPdfText(Buffer.from("%PDF-test"), {
            getDocument: () => ({ promise: Promise.resolve({ numPages: 26, destroy: async () => {} }) }),
            createWorker: async () => { throw new Error("worker should not start"); },
        }),
        /safety limit/
    );
});

test("falls back to English if the Swahili language pack cannot load", async () => {
    const requestedLanguages = [];
    const fakeDocument = {
        numPages: 1,
        async getPage() {
            return {
                getViewport: () => ({ width: 10, height: 10 }),
                render: () => ({ promise: Promise.resolve() }),
                cleanup: () => {},
            };
        },
        async destroy() {},
    };
    const result = await extractScannedPdfText(Buffer.from("%PDF-test"), {
        getDocument: () => ({ promise: Promise.resolve(fakeDocument) }),
        createCanvas: () => ({
            width: 10,
            height: 10,
            getContext: () => ({}),
            toBuffer: () => Buffer.from("image"),
        }),
        createWorker: async (languages) => {
            requestedLanguages.push(languages);
            if (languages === "eng+swa") throw new Error("Swahili traineddata unavailable");
            return {
                setParameters: async () => {},
                recognize: async () => ({ data: { text: "QUESTION 1. Explain the accounting process.", confidence: 88 } }),
                terminate: async () => {},
            };
        },
    });
    assert.deepEqual(requestedLanguages, ["eng+swa", "eng"]);
    assert.match(result, /QUESTION 1/);
});

test("recognizes text from a real image-only PDF using PDF.js and Tesseract", { timeout: 240000 }, async () => {
    const pdfBuffer = createImageOnlyPdf();
    const recognizedText = await extractScannedPdfText(pdfBuffer, {
        languages: "eng",
        renderScale: 1.5,
    });
    assert.match(recognizedText, /QUESTION\\s*1/i);
    assert.match(recognizedText, /accounting/i);
});
