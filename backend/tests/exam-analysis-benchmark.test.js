import test from "node:test";
import assert from "node:assert/strict";
import { compareExamAnalysisToReference } from "../services/examAnalysisBenchmark.js";

test("measures question, marks, topic and question-type parity against a reference", () => {
    const result = compareExamAnalysisToReference({
        candidate: {
            questions: [
                { section: "A", question_number: 1, marks: 5, curriculum: { topic: "Acids, bases and salts" }, classification: { type: "structured_response" } },
                { section: "A", question_number: 2, marks: 5, curriculum: { topic: "Separation of mixtures" }, classification: { type: "practical" } },
            ],
        },
        reference: {
            teacher_verified: true,
            questions: [
                { section: "A", question_number: 1, max_marks: 5, topic: "Acids, bases and salts", question_type: "structured_response" },
                { section: "A", question_number: 2, max_marks: 5, topic: "Separation of mixtures", question_type: "practical" },
            ],
        },
    });
    assert.equal(result.comparison_type, "teacher_verified_accuracy");
    assert.equal(result.question_detection.f1, 1);
    assert.equal(result.marks.agreement, 1);
    assert.equal(result.topics.agreement, 1);
    assert.equal(result.question_types.agreement, 1);
});

test("does not label unverified historical AI output as ground truth", () => {
    const result = compareExamAnalysisToReference({
        candidate: { questions: [{ section: "A", question_number: 1, marks: 4 }] },
        reference: { question_analysis: [{ section: "A", question_number: 1, max_marks: 5 }] },
    });
    assert.equal(result.comparison_type, "historical_ai_baseline_parity");
    assert.equal(result.reference_is_teacher_verified, false);
    assert.ok(result.warning);
    assert.equal(result.marks.agreement, 0);
});

test("reports missing and extra questions without hiding count differences", () => {
    const result = compareExamAnalysisToReference({
        candidate: { questions: [{ section: "A", question_number: 1 }, { section: "B", question_number: 3 }] },
        reference: { questions: [{ section: "A", question_number: 1 }, { section: "A", question_number: 2 }] },
    });
    assert.equal(result.counts.matched, 1);
    assert.equal(result.counts.missing, 1);
    assert.equal(result.counts.extra, 1);
});

test("separates explicit and inferred reference marks and checks selection rules", () => {
    const result = compareExamAnalysisToReference({
        candidate: {
            questions: [
                { section: "A", question_number: 1, marks: 5 },
                { section: "C", question_number: 2, marks: 4 },
            ],
            selection_rules: [{ scope: "C", required: 2, available: 3 }],
        },
        reference: {
            questions: [
                { section: "A", question_number: 1, max_marks: 5, mark_source: "printed_on_paper" },
                { section: "C", question_number: 2, max_marks: 4, mark_source: "inferred_from_section_structure", selection_required: true, selection_count: 2, selection_total: 3 },
            ],
        },
    });
    assert.equal(result.marks.explicit_reference.agreement, 1);
    assert.equal(result.marks.inferred_reference.agreement, 1);
    assert.equal(result.selection.agreement, 1);
});

test("normalizes equivalent historical AI question type labels", () => {
    const result = compareExamAnalysisToReference({
        candidate: { questions: [
            { section: "A", question_number: 1, classification: { type: "multiple_choice" } },
            { section: "A", question_number: 2, classification: { type: "matching" } },
            { section: "B", question_number: 3, classification: { type: "structured_response" } },
            { section: "B", question_number: 4, classification: { type: "extended_response" } },
        ] },
        reference: { questions: [
            { section: "A", question_number: 1, question_type: "Multiple Choice" },
            { section: "A", question_number: 2, question_type: "Matching" },
            { section: "B", question_number: 3, question_type: "Short Answer" },
            { section: "B", question_number: 4, question_type: "Essay" },
        ] },
    });
    assert.equal(result.question_types.agreement, 1);
});

// Regression coverage includes historical AI label aliases.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildExamDocumentModel } from "../services/examDocumentModel.js";
import { analyzeExamEvidence } from "../services/examEvidenceAnalysis.js";

test("commerce historical paper regression preserves structure and classifies response types", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const fixture = JSON.parse(readFileSync(join(here, "fixtures/exam-analysis-golden/commerce-form-four-2025-historical-ai-baseline.json"), "utf8"));
    const document = buildExamDocumentModel({
        text: fixture.extracted_text,
        level: fixture.education_level,
        subject: fixture.subject,
    });
    const candidate = analyzeExamEvidence({ document, sourceText: fixture.extracted_text });
    const comparison = compareExamAnalysisToReference({ candidate, reference: fixture.reference });

    assert.equal(document.questions.length, 11);
    assert.equal(comparison.question_detection.f1, 1);
    assert.equal(comparison.marks.agreement, 1);
    assert.equal(comparison.selection.agreement, 1);
    assert.ok(comparison.question_types.agreement >= 0.9);
    assert.ok(candidate.questions.every(question => question.classification.type !== "unclassified"));
});
