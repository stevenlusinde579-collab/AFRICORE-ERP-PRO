import test from "node:test";
import assert from "node:assert/strict";
import { calculateAssessmentFinalMark } from "../src/utils/examAssessmentCalculator.js";

test("returns null when optional assessment setup is not used", () => {
    assert.equal(calculateAssessmentFinalMark({ components: [] }), null);
});

test("averages two Tests and the examination paper equally", () => {
    const result = calculateAssessmentFinalMark({
        components: [
            { key: "test_1", label: "Test 1", type: "test", max_marks: 100 },
            { key: "test_2", label: "Test 2", type: "test", max_marks: 100 }
        ],
        marksByComponent: { test_1: 74, test_2: 80 },
        examMarks: 75,
        examMaxMarks: 100,
        subjectFullMarks: 100
    });
    assert.equal(result.percentage, 76.33);
    assert.equal(result.marks_obtained, 76);
});

test("averages one configured Test with the examination paper", () => {
    const result = calculateAssessmentFinalMark({
        components: [
            { key: "test_1", label: "Test 1", type: "test", max_marks: 100 }
        ],
        marksByComponent: { test_1: 80 },
        examMarks: 70,
        examMaxMarks: 100,
        subjectFullMarks: 100
    });
    assert.equal(result.percentage, 75);
    assert.equal(result.marks_obtained, 75);
});

test("does not add a Test average when no Test is configured", () => {
    const result = calculateAssessmentFinalMark({
        components: [
            { key: "practical", label: "Practical", type: "practical", max_marks: 50 }
        ],
        marksByComponent: { practical: 40 },
        examMarks: 80,
        examMaxMarks: 100,
        subjectFullMarks: 100
    });
    assert.equal(result.theory_percentage, 80);
    assert.equal(result.practical_percentage, 80);
    assert.equal(result.percentage, 80);
});

test("uses 70 percent Theory and 30 percent Practical", () => {
    const result = calculateAssessmentFinalMark({
        components: [
            { key: "test_1", label: "Test 1", type: "test", max_marks: 100 },
            { key: "test_2", label: "Test 2", type: "test", max_marks: 100 },
            { key: "practical", label: "Practical", type: "practical", max_marks: 50 }
        ],
        marksByComponent: { test_1: 70, test_2: 90, practical: 40 },
        examMarks: 80,
        examMaxMarks: 100,
        subjectFullMarks: 100
    });
    assert.equal(result.theory_percentage, 80);
    assert.equal(result.practical_percentage, 80);
    assert.equal(result.percentage, 80);
});

test("normalizes each Test against its own configured maximum before averaging", () => {
    const result = calculateAssessmentFinalMark({
        components: [
            { key: "test_1", label: "Test 1", type: "test", max_marks: 50 },
            { key: "test_2", label: "Test 2", type: "test", max_marks: 80 }
        ],
        marksByComponent: { test_1: 40, test_2: 40 },
        examMarks: 60,
        examMaxMarks: 100,
        subjectFullMarks: 100
    });
    assert.equal(result.percentage, 66.67);
});

test("does not calculate while a configured component mark is missing", () => {
    const result = calculateAssessmentFinalMark({
        components: [
            { key: "test_1", label: "Test 1", type: "test", max_marks: 50 },
            { key: "practical", label: "Practical", type: "practical", max_marks: 50 }
        ],
        marksByComponent: { test_1: 30 },
        examMarks: 70,
        examMaxMarks: 100
    });
    assert.equal(result.complete, false);
    assert.equal(result.missing, "Practical");
});

test("requires an examination mark before calculating configured assessments", () => {
    const result = calculateAssessmentFinalMark({
        components: [
            { key: "test_1", label: "Test 1", type: "test", max_marks: 100 }
        ],
        marksByComponent: { test_1: 80 },
        subjectFullMarks: 100
    });
    assert.equal(result.complete, false);
    assert.equal(result.missing, "Examination marks");
});

test("rejects a component mark above its maximum", () => {
    assert.throws(() => calculateAssessmentFinalMark({
        components: [{ key: "test_1", label: "Test 1", type: "test", max_marks: 20 }],
        marksByComponent: { test_1: 21 },
        examMarks: 10,
        examMaxMarks: 20
    }), /between 0 and 20/);
});

test("rejects examination marks above the paper maximum", () => {
    assert.throws(() => calculateAssessmentFinalMark({
        components: [],
        examMarks: 101,
        examMaxMarks: 100
    }), /between 0 and 100/);
});
