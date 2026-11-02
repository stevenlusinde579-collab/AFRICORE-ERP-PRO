import test from "node:test";
import assert from "node:assert/strict";
import { normalizeExamMarksToPercentage } from "../src/utils/examMarkNormalization.js";

test("normalizes a 50-mark paper to a percentage out of 100", () => {
    assert.equal(normalizeExamMarksToPercentage(35, 50), 70);
});

test("uses the actual maximum instead of a fixed denominator", () => {
    assert.equal(normalizeExamMarksToPercentage(28, 40), 70);
    assert.equal(normalizeExamMarksToPercentage(60, 75), 80);
});

test("keeps marks already out of 100 unchanged", () => {
    assert.equal(normalizeExamMarksToPercentage(84, 100), 84);
});

test("does not invent a percentage when the maximum is missing", () => {
    assert.equal(normalizeExamMarksToPercentage(35, 0), 0);
    assert.equal(normalizeExamMarksToPercentage(35, null), 0);
});

test("clamps invalid over-maximum results to the valid percentage range", () => {
    assert.equal(normalizeExamMarksToPercentage(55, 50), 100);
    assert.equal(normalizeExamMarksToPercentage(-5, 50), 0);
});
