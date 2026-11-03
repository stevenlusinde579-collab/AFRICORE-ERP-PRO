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
