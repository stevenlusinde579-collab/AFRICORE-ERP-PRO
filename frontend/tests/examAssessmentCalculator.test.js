import test from "node:test";
import assert from "node:assert/strict";
import { calculateAssessmentFinalMark } from "../src/utils/examAssessmentCalculator.js";

test("returns null when optional assessment setup is not used", () => {
    assert.equal(calculateAssessmentFinalMark({ components: [] }), null);
});

test("averages two Test marks and the examination mark equally", () => {
    const result = calculateAssessmentFinalMark({
        components: [
            { key: "test_1", label: "Test 1", type: "test", max_marks: 100 },
            { key: "test_2", label: "Test 2", type: "test", max_marks: 100 }
        ],
        marksByComponent: { test_1: 76, test_2: 80 },
        examMarks: 75,
        examMaxMarks: 100,
        subjectFullMarks: 100
    });
    assert.equal(result.theory_marks, 77);
    assert.equal(result.percentage, 77);
    assert.equal(result.marks_obtained, 77);
});

test("averages the stated 74, 80 and 75 Theory marks", () => {
    const result = calculateAssessmentFinalMark({
        components: [
            { key: "test_1", type: "test", max_marks: 100 },
            { key: "test_2", type: "test", max_marks: 100 }
        ],
        marksByComponent: { test_1: 74, test_2: 80 },
        examMarks: 75,
        examMaxMarks: 100
    });
    assert.equal(result.theory_marks, 76.33);
    assert.equal(result.marks_obtained, 76);
});

test("averages one configured Test with the examination paper", () => {
    const result = calculateAssessmentFinalMark({
        components: [{ key: "test_1", type: "test", max_marks: 100 }],
        marksByComponent: { test_1: 80 },
        examMarks: 70,
        examMaxMarks: 100
    });
    assert.equal(result.theory_marks, 75);
    assert.equal(result.marks_obtained, 75);
});

test("uses the examination paper alone as Theory when no Test is configured", () => {
    const result = calculateAssessmentFinalMark({
        components: [{ key: "practical", type: "practical", max_marks: 50 }],
        marksByComponent: { practical: 40 },
        examMarks: 80,
        examMaxMarks: 100,
        subjectFullMarks: 100
    });
    assert.equal(result.theory_marks, 80);
    assert.equal(result.combined_marks, 120);
    assert.equal(result.combined_full_marks, 150);
    assert.equal(result.percentage, 80);
});

test("adds Practical out of 50 to Theory and converts total out of 150 to 100", () => {
    const result = calculateAssessmentFinalMark({
        components: [{ key: "practical", type: "practical", max_marks: 50 }],
        marksByComponent: { practical: 30 },
        examMarks: 80,
        examMaxMarks: 100,
        subjectFullMarks: 100
    });
    assert.equal(result.theory_marks, 80);
    assert.equal(result.practical_marks, 30);
    assert.equal(result.combined_marks, 110);
    assert.equal(result.combined_full_marks, 150);
    assert.equal(result.percentage, 73.33);
    assert.equal(result.marks_obtained, 73);
});

test("adds Practical to the average of configured Tests and paper marks", () => {
    const result = calculateAssessmentFinalMark({
        components: [
            { key: "test_1", type: "test", max_marks: 100 },
            { key: "test_2", type: "test", max_marks: 100 },
            { key: "practical", type: "practical", max_marks: 50 }
        ],
        marksByComponent: { test_1: 74, test_2: 80, practical: 30 },
        examMarks: 75,
        examMaxMarks: 100,
        subjectFullMarks: 100
    });
    assert.equal(result.theory_marks, 76.33);
    assert.equal(result.combined_full_marks, 150);
    assert.equal(result.percentage, 70.89);
    assert.equal(result.marks_obtained, 71);
});

test("returns a configuration error for Practical setup that is not out of 50 without throwing", () => {
    const result = calculateAssessmentFinalMark({
        components: [{ key: "practical", type: "practical", max_marks: 25 }],
        marksByComponent: { practical: 10 },
        examMarks: 80,
        examMaxMarks: 100,
        subjectFullMarks: 100
    });
    assert.equal(result.complete, false);
    assert.match(result.configuration_error, /Practical Max Marks lazima iwe 50/);
    assert.equal(result.marks_obtained, null);
});

test("ignores blank components and calculates using only this student's entered Test marks", () => {
    const result = calculateAssessmentFinalMark({
        components: [
            { key: "test_1", type: "test", max_marks: 50 },
            { key: "test_2", type: "test", max_marks: 50 },
            { key: "practical", label: "Practical", type: "practical", max_marks: 50 }
        ],
        marksByComponent: { test_1: 30, test_2: "", practical: "" },
        examMarks: 70,
        examMaxMarks: 100
    });
    assert.equal(result.complete, true);
    assert.equal(result.theory_marks, 50);
    assert.equal(result.practical_marks, null);
    assert.equal(result.marks_obtained, 50);
});

test("uses the examination paper alone when every optional component is blank", () => {
    const result = calculateAssessmentFinalMark({
        components: [
            { key: "test_1", type: "test", max_marks: 50 },
            { key: "practical", type: "practical", max_marks: 50 }
        ],
        marksByComponent: { test_1: "", practical: "" },
        examMarks: 70,
        examMaxMarks: 100
    });
    assert.equal(result.complete, true);
    assert.equal(result.theory_marks, 70);
    assert.equal(result.practical_marks, null);
    assert.equal(result.marks_obtained, 70);
});

test("counts a zero component mark as entered and includes it in the calculation", () => {
    const result = calculateAssessmentFinalMark({
        components: [
            { key: "test_1", type: "test", max_marks: 100 },
            { key: "practical", type: "practical", max_marks: 50 }
        ],
        marksByComponent: { test_1: 0, practical: 0 },
        examMarks: 80,
        examMaxMarks: 100
    });
    assert.equal(result.complete, true);
    assert.equal(result.theory_marks, 40);
    assert.equal(result.practical_marks, 0);
    assert.equal(result.percentage, 26.67);
    assert.equal(result.marks_obtained, 27);
});

test("requires an examination mark before calculating configured assessments", () => {
    const result = calculateAssessmentFinalMark({
        components: [{ key: "test_1", type: "test", max_marks: 100 }],
        marksByComponent: { test_1: 80 }
    });
    assert.equal(result.complete, false);
    assert.equal(result.missing, "Examination marks");
});

test("returns a validation message instead of throwing when a Test mark exceeds its maximum", () => {
    const result = calculateAssessmentFinalMark({
        components: [{ key: "test_2", label: "Test 2", type: "test", max_marks: 75 }],
        marksByComponent: { test_2: 76 },
        examMarks: 60,
        examMaxMarks: 100
    });
    assert.equal(result.complete, false);
    assert.match(result.validation_error, /Test 2.*0 na 75/);
    assert.equal(result.invalid_component, "test_2");
    assert.equal(result.marks_obtained, null);
});
