import test from "node:test";
import assert from "node:assert/strict";
import { analyzeExaminationV2 } from "../services/examAnalysisV2.js";

test("runs the V2 pipeline end-to-end without invoking Gemini or production controllers", () => {
    const result = analyzeExaminationV2({
        level: "Form Four",
        subject: "Chemistry",
        text: [
            "CHEMISTRY",
            "SECTION A",
            "Answer all questions.",
            "QUESTION 1 [5 marks]",
            "Explain why acids turn blue litmus paper red.",
            "QUESTION 2 [5 marks]",
            "Describe the separation of a mixture by filtration.",
            "TOTAL MARKS: 10",
        ].join("\n"),
    });

    assert.equal(result.engine, "evidence_based_v2");
    assert.equal(result.document.summary.question_count, 2);
    assert.equal(result.analysis.totals.declared, 10);
    assert.equal(result.analysis.totals.calculated_from_explicit_evidence, 10);
    assert.equal(result.analysis.questions[0].marks, 5);
    assert.equal(result.analysis.questions[1].marks, 5);
    assert.equal(result.analysis.questions[0].curriculum.topic, "Acids, bases and salts");
    assert.equal(result.analysis.questions[1].curriculum.topic, "Separation of mixtures");
    assert.equal(result.decision.ready_for_review, true);
    assert.equal(result.decision.safe_to_auto_approve, false);
    assert.equal(result.decision.requires_human_review, true);
});

test("never auto-approves an analysis with incomplete marks or ambiguous structure", () => {
    const result = analyzeExaminationV2({
        level: "Standard IV",
        subject: "English",
        text: "SECTION A\n1. Read the passage.\n(a) Answer the questions.\n2. Write a story.",
    });

    assert.equal(result.decision.ready_for_review, true);
    assert.equal(result.decision.safe_to_auto_approve, false);
    assert.equal(result.decision.requires_human_review, true);
});

test("supports Baby Class activities, Primary tasks, A-Level Roman questions and Diploma tasks", () => {
    const cases = [
        { level: "Baby Class", subject: "General", text: "ACTIVITY 1 Colour the red circle." },
        { level: "Nursery", subject: "General", text: "Trace letter A.\nColour the red circle.\nCount five objects.", expectedQuestionCount: 3 },
        { level: "Standard IV", subject: "Mathematics", text: "TASK 1 Calculate 25 + 15." },
        { level: "Form Six", subject: "Physics", text: "I. Explain the principle of conservation of energy." },
        { level: "Diploma", subject: "Accounting", text: "TASK 1 Calculate depreciation using the straight-line method." },
    ];
    for (const sample of cases) {
        const result = analyzeExaminationV2(sample);
        assert.equal(result.document.summary.question_count, sample.expectedQuestionCount || 1, sample.level);
        assert.equal(result.decision.ready_for_review, true, sample.level);
        assert.equal(result.decision.safe_to_auto_approve, false, sample.level);
    }
});
