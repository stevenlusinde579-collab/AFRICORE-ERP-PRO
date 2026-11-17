import test from "node:test";
import assert from "node:assert/strict";
import { buildExamEvidenceReview } from "../services/examEvidenceReview.js";

test("builds advisory evidence review without changing Rule-Based question records", () => {
    const result = buildExamEvidenceReview({
        ruleBasedQuestionCount: 10,
        v2Result: {
            schema_version: "2.0.0",
            document: { questions: Array.from({ length: 11 }, (_, index) => ({ id: "q" + (index + 1) })) },
            diagnostics: [{ code: "DECLARED_TOTAL_MISMATCH", message: "Printed total differs." }],
            analysis: {
                questions: [
                    { classification: { type: "multiple_choice" } },
                    { classification: { type: "extended_response" } },
                ],
                quality: { status: "review_required", confidence: 0.72 },
                totals: { declared: 100, effective_calculated_total: 87 },
                section_totals: [{ section: "A", declared_total: 16, calculated_total: 3, effective_total: 3, question_count: 2 }],
                selection_rules: [{ scope: "C", mode: "choose_count", required: 2, available: 3, confidence: 0.86 }],
            },
        },
    });

    assert.equal(result.metadata.question_count, 11);
    assert.equal(result.metadata.rule_based_question_count, 10);
    assert.equal(result.metadata.question_type_counts.multiple_choice, 1);
    assert.equal(result.metadata.requires_human_review, true);
    assert.equal(result.recommendations.length, 3);
    assert.match(result.recommendations.join(" "), /11 question boundaries/);
    assert.match(result.recommendations.join(" "), /printed total is 100/);
});

test("does not create mismatch warnings when both engines agree and evidence is clean", () => {
    const result = buildExamEvidenceReview({
        ruleBasedQuestionCount: 2,
        v2Result: {
            document: { questions: [{ id: "q1" }, { id: "q2" }] },
            diagnostics: [],
            analysis: {
                questions: [{ classification: { type: "matching" } }, { classification: { type: "structured_response" } }],
                quality: { status: "high", confidence: 0.96 },
                totals: { declared: 20, effective_calculated_total: 20 },
                section_totals: [],
                selection_rules: [],
            },
        },
    });
    assert.deepEqual(result.recommendations, []);
});
