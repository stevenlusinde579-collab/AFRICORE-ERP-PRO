import test from "node:test";
import assert from "node:assert/strict";
import { extractDeclaredTotalMarks, resolveExamTotalMarks, hasMarkTotalMismatch } from "../services/examMarkValidation.js";

test("extracts an explicitly declared whole-paper total", () => {
    assert.equal(extractDeclaredTotalMarks("TOTAL MARKS: 50"), 50);
    assert.equal(extractDeclaredTotalMarks("This paper carries 100 marks"), 100);
});

test("does not infer a paper total from unrelated question marks", () => {
    assert.equal(extractDeclaredTotalMarks("Question 1 (10 marks) Question 2 (20 marks)"), null);
});

test("prefers explicit whole-paper total when question marks were missed", () => {
    assert.equal(resolveExamTotalMarks({
        declaredTotalMarks: 50,
        reportedTotalMarks: 40,
        calculatedQuestionMarks: 40,
    }), 50);
});

test("uses AI-reported paper total over an incomplete question sum when no explicit total was extracted", () => {
    assert.equal(resolveExamTotalMarks({
        declaredTotalMarks: null,
        reportedTotalMarks: 50,
        calculatedQuestionMarks: 40,
    }), 50);
});

test("falls back to question sum only when no paper-level total is available", () => {
    assert.equal(resolveExamTotalMarks({
        declaredTotalMarks: null,
        reportedTotalMarks: null,
        calculatedQuestionMarks: 45,
    }), 45);
});

test("flags disagreement between paper total and identified question marks", () => {
    assert.equal(hasMarkTotalMismatch(50, 40), true);
    assert.equal(hasMarkTotalMismatch(50, 50), false);
    assert.equal(hasMarkTotalMismatch(0, 40), false);
});
