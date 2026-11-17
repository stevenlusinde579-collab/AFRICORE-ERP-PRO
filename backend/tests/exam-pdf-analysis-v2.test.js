import test from "node:test";
import assert from "node:assert/strict";
import { analyzeExamPdfV2 } from "../services/examPdfAnalysisV2.js";

test("routes selectable PDF text through V2 and explicitly disables OCR", async () => {
    let receivedOptions = null;
    const result = await analyzeExamPdfV2({
        buffer: Buffer.from("test-pdf"),
        level: "Form Four",
        subject: "Chemistry",
        options: { enableOcr: true },
        readPdf: async (_buffer, options) => {
            receivedOptions = options;
            return [
                "SECTION A",
                "QUESTION 1 [5 marks]",
                "Explain why acids turn blue litmus paper red.",
                "TOTAL MARKS: 5",
            ].join("\n");
        },
    });

    assert.equal(receivedOptions.enableOcr, false);
    assert.equal(result.input.type, "selectable_pdf_text");
    assert.equal(result.input.ocr_used, false);
    assert.equal(result.analysis.questions.length, 1);
    assert.equal(result.analysis.questions[0].marks, 5);
});

test("rejects a missing PDF buffer instead of pretending analysis succeeded", async () => {
    await assert.rejects(() => analyzeExamPdfV2({ level: "Form Four" }), /PDF buffer is required/);
});
