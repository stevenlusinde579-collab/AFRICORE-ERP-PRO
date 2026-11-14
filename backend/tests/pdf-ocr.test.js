import test from "node:test";
import assert from "node:assert/strict";
import { cleanOcrText, isLikelyScannedPdfText } from "../services/pdfOcr.js";

test("identifies CamScanner-only extraction as a scanned PDF", () => {
    assert.equal(isLikelyScannedPdfText("CamScanner\nCamScanner"), true);
});

test("does not classify a readable text-based paper as scanned", () => {
    const paper = Array.from({ length: 35 }, (_, index) =>
        "QUESTION " + (index + 1) + ". Explain the accounting treatment and prepare the relevant financial statements."
    ).join("\n");
    assert.equal(isLikelyScannedPdfText(paper), false);
});

test("normalizes OCR text while preserving page and question line breaks", () => {
    assert.equal(
        cleanOcrText(" QUESTION 1.   Explain  \r\n\r\n (a)  Prepare accounts. "),
        "QUESTION 1. Explain\n(a) Prepare accounts."
    );
});
