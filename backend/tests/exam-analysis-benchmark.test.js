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
