import test from "node:test";
import assert from "node:assert/strict";
import {
    cleanOcrText,
    extractScannedPdfText,
    isLikelyScannedPdfText,
} from "../services/pdfOcr.js";

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
            getDocument: () => ({ promise: Promise.resolve({ numPages: 26 }) }),
            createWorker: async () => { throw new Error("worker should not start"); },
        }),
        /safety limit/
    );
});
