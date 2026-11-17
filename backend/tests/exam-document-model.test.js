import test from "node:test";
import assert from "node:assert/strict";
import { buildExamDocumentModel, validateExamDocumentModel } from "../services/examDocumentModel.js";

test("preserves pages, sections, question hierarchy and source evidence", () => {
    const model = buildExamDocumentModel({
        level: "Standard IV",
        subject: "English",
        text: "STANDARD IV ENGLISH\nSECTION A\nAnswer all questions.\n1. Read the passage.\n(a) Identify the main character.\n(b) Give two reasons.\n2. Write five sentences.\fSECTION B\nQUESTION III\n(i) Define energy.\n(ii) State its unit."
    });
    assert.equal(model.summary.page_count, 2);
    assert.equal(model.summary.question_count, 3);
    assert.equal(model.summary.instruction_count, 1);
    assert.equal(model.questions[0].subparts.length, 2);
    assert.equal(model.questions[2].printed_label, "III");
    assert.ok(model.questions[0].evidence[0].page === 1);
    assert.equal(validateExamDocumentModel(model).valid, true);
});

test("does not mistake an answer instruction for a question", () => {
    const model = buildExamDocumentModel({
        text: "MATHEMATICS\nSECTION A\nAnswer any TWO questions.\n1. Solve x + 2 = 5.\n2. Find the area."
    });
    assert.equal(model.summary.question_count, 2);
    assert.equal(model.instructions.length, 1);
});

test("reports ambiguous repeated unqualified labels instead of silently merging them", () => {
    const model = buildExamDocumentModel({
        text: "SCIENCE\n1. First question.\n2. Second question.\n1. Another section-like repeated question."
    });
    assert.equal(model.summary.question_count, 2);
    assert.ok(model.diagnostics.some(item => item.code === "AMBIGUOUS_REPEATED_LABEL"));
});

test("keeps question text split across lines and validates missing structure safely", () => {
    const model = buildExamDocumentModel({
        text: "GEOGRAPHY\nQUESTION 1\nExplain the causes\nof soil erosion.\n(a) Give two examples."
    });
    assert.match(model.questions[0].text, /causes\nof soil erosion/);
    assert.equal(validateExamDocumentModel(model).valid, true);
});

test("builds nested letter and Roman subparts without flattening their parent-child relationship", () => {
    const model = buildExamDocumentModel({
        text: "SECTION A\\nQUESTION 1\\n(a) Explain the process.\\n(i) First stage [2 marks].\\n(ii) Second stage [3 marks].\\n(b) Give one example."
    });
    assert.equal(model.questions[0].subparts.length, 2);
    assert.equal(model.questions[0].subparts[0].children.length, 2);
    assert.equal(model.questions[0].subparts[0].children[1].printed_label, "ii");
    assert.equal(model.summary.subpart_count, 4);
});
