import test from "node:test";
import assert from "node:assert/strict";
import { buildExamEvidenceReview, buildRuleBasedQuestionsFromEvidence } from "../services/examEvidenceReview.js";

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
    assert.equal(result.recommendations.length, 4);
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

test("converts only complete high-confidence V2 evidence into Rule-Based question records", () => {
    const questions = [
        { id: "q1", order: 1, question_number: 1, section: "A", text: "Choose the correct answer.", subparts: [], boundary_confidence: "high" },
        { id: "q2", order: 2, question_number: 2, section: "C", text: "Explain the main factors.", subparts: [], boundary_confidence: "high" },
    ];
    const enriched = [
        { ...questions[0], marks: 4, marks_source: "inferred_from_response_slots", mark_confidence: 0.86, mark_evidence: [], classification: { type: "multiple_choice", confidence: 0.9, reason: "Options detected" }, topic: "Accounting", sub_topic: "Assets", difficulty_level: "easy", bloom_level: "remembering", answer_expected: "Choose one option." },
        { ...questions[1], marks: 6, marks_source: "inferred_from_selective_section_total", mark_confidence: 0.8, mark_evidence: [], classification: { type: "extended_response", confidence: 0.8, reason: "Extended prompt" }, topic: "Commerce", sub_topic: "Trade", difficulty_level: "challenging", bloom_level: "understanding", answer_expected: "Explain with points." },
    ];
    const result = buildRuleBasedQuestionsFromEvidence({
        expectedQuestionCount: 2,
        v2Result: {
            document: { questions },
            validation: { valid: true },
            decision: { ready_for_review: true },
            diagnostics: [],
            analysis: {
                questions: enriched,
                quality: { status: "high" },
                totals: { declared: 10, effective_calculated_total: 10 },
                selection_rules: [{ scope: "C", mode: "choose_count", required: 1, available: 1, evidence_text: "Answer one question from section C" }],
            },
        },
    });
    assert.equal(result.length, 2);
    assert.equal(result[0].question_type, "Multiple Choice");
    assert.equal(result[0].max_marks, 4);
    assert.equal(result[1].question_type, "Essay");
    assert.equal(result[1].is_selective, true);
    assert.equal(result[1].selection_count, 1);
    assert.equal(result[1].selection_total, 1);
});

test("refuses to replace Rule-Based questions when V2 marks do not reconcile with the printed total", () => {
    const question = { id: "q1", order: 1, question_number: 1, section: "A", text: "Explain.", subparts: [], boundary_confidence: "high" };
    const result = buildRuleBasedQuestionsFromEvidence({
        expectedQuestionCount: 1,
        v2Result: {
            document: { questions: [question] },
            validation: { valid: true },
            decision: { ready_for_review: true },
            diagnostics: [],
            analysis: {
                questions: [{ ...question, marks: 8, marks_source: "inferred", mark_confidence: 0.8, classification: { type: "structured_response", confidence: 0.8 }, subparts: [] }],
                quality: { status: "high" },
                totals: { declared: 10, effective_calculated_total: 8 },
                selection_rules: [],
            },
        },
    });
    assert.equal(result, null);
});

test("uses V2-detected question count when the PDF has no printed total question count", () => {
    const rows = [{ id: "q1", order: 1, question_number: 1, section: "A", text: "Explain.", subparts: [], boundary_confidence: "high" }];
    const enriched = [{ ...rows[0], marks: 5, mark_confidence: 0.9, classification: { type: "structured_response", confidence: 0.9 } }];
    const result = buildRuleBasedQuestionsFromEvidence({
        v2Result: {
            document: { questions: rows },
            validation: { valid: true },
            decision: { ready_for_review: true },
            diagnostics: [],
            analysis: {
                questions: enriched,
                quality: { status: "high" },
                totals: { declared: null, effective_calculated_total: 5 },
                selection_rules: [],
            },
        },
    });
    assert.equal(result.length, 1);
});
