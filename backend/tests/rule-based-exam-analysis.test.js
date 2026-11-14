import test from "node:test";
import assert from "node:assert/strict";
import { analyzePaperWithRules } from "../services/ruleBasedExamAnalysis.js";

test("analyses a primary paper and preserves main questions, marks and shared schema", () => {
    const result = analyzePaperWithRules({
        subjectName: "Mathematics",
        level: "Standard IV",
        examName: "Mid Term",
        pdfText: `PRIMARY SCHOOL EXAMINATION
STANDARD IV MATHEMATICS
SECTION A (20 MARKS)
Answer all questions.
1. Add 25 and 17. (5 marks)
2. Calculate 8 x 7. (5 marks)
3. Define a fraction. (5 marks)
4. Find 50% of 40. (5 marks)`,
    });

    assert.equal(result.level, "Standard IV");
    assert.equal(result.total_questions, 4);
    assert.equal(result.questions.length, 4);
    assert.equal(result.total_marks, 20);
    assert.equal(result.sections[0].section, "A");
    assert.equal(result.questions[0].max_marks, 5);
    assert.equal(result.questions[0].mark_source, "explicit_in_paper");
    assert.ok(Object.hasOwn(result, "blooms_distribution"));
    assert.ok(Object.hasOwn(result.questions[0], "selection_group"));
});

test("uses section totals and explicit answer-any selection to infer marks", () => {
    const result = analyzePaperWithRules({
        subjectName: "Commerce",
        level: "Form Three",
        pdfText: `COMMERCE
SECTION B (40 MARKS)
Answer any 2 out of 4 questions.
1. Explain the role of trade.
2. Discuss the functions of a wholesaler.
3. Describe insurance.
4. Explain banking services.`,
    });

    assert.equal(result.questions.length, 4);
    assert.ok(result.questions.every(question => question.selection_required));
    assert.ok(result.questions.every(question => question.selection_count === 2));
    assert.ok(result.questions.every(question => question.selection_total === 4));
    assert.ok(result.questions.every(question => question.max_marks === 20));
    assert.equal(result.total_marks, 40);
    assert.equal(result.questions[0].mark_source, "inferred_from_section_structure");
});

test("does not invent marks when neither question nor section provides evidence", () => {
    const result = analyzePaperWithRules({
        subjectName: "History",
        level: "Form One",
        pdfText: `HISTORY TEST
1. Define history.
2. Explain two causes of migration.`,
    });

    assert.ok(result.questions.every(question => question.max_marks === 0));
    assert.ok(result.questions.every(question => question.mark_source === "uncertain_teacher_confirmation_required"));
    assert.ok(result.recommendations.some(item => item.includes("Confirm")));
});

test("rejects scanned or text-empty PDFs with a useful explanation", () => {
    assert.throws(
        () => analyzePaperWithRules({ pdfText: "", subjectName: "Biology" }),
        /requires readable text/
    );
});

test("recognizes explicit QUESTION N headers without punctuation and keeps following lines together", () => {
    const result = analyzePaperWithRules({
        subjectName: "History",
        level: "Form Two",
        pdfText: `HISTORY TEST
SECTION A (10 MARKS)
Answer all questions.
QUESTION 1
Explain two causes of migration.
QUESTION 2.
State two effects of migration.`,
    });

    assert.equal(result.questions.length, 2);
    assert.equal(result.questions[0].question_number, 1);
    assert.match(result.questions[0].question_text, /Explain two causes of migration/);
    assert.equal(result.questions[1].question_number, 2);
    assert.match(result.questions[1].question_text, /State two effects of migration/);
    assert.equal(result.questions[0].max_marks, 5);
    assert.equal(result.questions[1].max_marks, 5);
});
