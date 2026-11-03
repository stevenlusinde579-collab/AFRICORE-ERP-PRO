import test from "node:test";
import assert from "node:assert/strict";
import { calculateAssessmentFinalMark } from "../src/utils/examAssessmentCalculator.js";

test("returns null when optional assessment setup is not used", () => {
    assert.equal(calculateAssessmentFinalMark({ components: [] }), null);
});

test("averages Test 1 and Test 2 equally when no Practical is configured", () => {
    const result = calculateAssessmentFinalMark({
        components: [
            { key: "test_1", label: "Test 1", type: "test", max_marks: 50 },
            { key: "test_2", label: "Test 2", type: "test", max_marks: 100 }
        ],
        marksByComponent: { test_1: 40, test_2: 60 },
        subjectFullMarks: 100
    });
    assert.equal(result.percentage, 70);
    assert.equal(result.marks_obtained, 70);
});

test("weights Test and Practical groups using their configured maximum marks", () => {
    const result = calculateAssessmentFinalMark({
        components: [
            { key: "test_1", label: "Theory", type: "test", max_marks: 100 },
            { key: "practical", label: "Practical", type: "practical", max_marks: 50 }
        ],
        marksByComponent: { test_1: 80, practical: 40 },
        subjectFullMarks: 100
    });
    assert.equal(result.percentage, 80);
    assert.equal(result.marks_obtained, 80);
});

test("does not calculate a final mark while a configured component is missing", () => {
    const result = calculateAssessmentFinalMark({
        components: [
            { key: "test_1", label: "Test 1", type: "test", max_marks: 50 },
            { key: "practical", label: "Practical", type: "practical", max_marks: 50 }
        ],
        marksByComponent: { test_1: 30 }
    });
    assert.equal(result.complete, false);
    assert.equal(result.missing, "Practical");
});

test("rejects a component mark above its maximum", () => {
    assert.throws(() => calculateAssessmentFinalMark({
        components: [{ key: "test_1", label: "Test 1", type: "test", max_marks: 20 }],
        marksByComponent: { test_1: 21 }
    }), /between 0 and 20/);
});

test("combines the examination paper, average Tests and optional Practical by configured maximum marks", () => {
    const result = calculateAssessmentFinalMark({
        components: [
            { key: "test_1", label: "Test 1", type: "test", max_marks: 50 },
            { key: "test_2", label: "Test 2", type: "test", max_marks: 50 },
            { key: "practical", label: "Practical", type: "practical", max_marks: 50 }
        ],
        marksByComponent: { test_1: 40, test_2: 30, practical: 40 },
        examMarks: 70,
        examMaxMarks: 100,
        subjectFullMarks: 100
    });
    assert.equal(result.percentage, 72.5);
    assert.equal(result.marks_obtained, 73);
});

test("supports Practical-only setup without requiring Tests", () => {
    const result = calculateAssessmentFinalMark({
        components: [
            { key: "practical", label: "Practical", type: "practical", max_marks: 50 }
        ],
        marksByComponent: { practical: 35 },
        subjectFullMarks: 100
    });
    assert.equal(result.percentage, 70);
    assert.equal(result.marks_obtained, 70);
});
