import test from "node:test";
import assert from "node:assert/strict";
import { calculateAssessmentFinalMark } from "../src/utils/examAssessmentCalculator.js";

test("returns null when optional assessment setup is not used", () => {
    assert.equal(calculateAssessmentFinalMark({ components: [] }), null);
});

test("averages two Test marks and the examination mark equally (Joseph's saved marks)", () => {
    const result = calculateAssessmentFinalMark({
        components: [
            { key: "test_1", label: "Test 1", type: "test", max_marks: 76 },
            { key: "test_2", label: "Test 2", type: "test", max_marks: 80 }
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

test("averages two Test marks and paper mark using the stated 74, 80, 75 example", () => {
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
        examMaxMarks: 100
    });
    assert.equal(result.theory_marks, 80);
    assert.equal(result.percentage, 80);
});

test("combines Theory 70 percent and Practical 30 percent", () => {
    const result = calculateAssessmentFinalMark({
        components: [
            { key: "test_1", type: "test", max_marks: 100 },
            { key: "test_2", type: "test", max_marks: 100 },
            { key: "practical", type: "practical", max_marks: 50 }
        ],
        marksByComponent: { test_1: 70, test_2: 90, practical: 40 },
        examMarks: 80,
        examMaxMarks: 100,
        subjectFullMarks: 100
    });
    assert.equal(result.theory_marks, 80);
    assert.equal(result.theory_percentage, 80);
    assert.equal(result.practical_percentage, 80);
    assert.equal(result.percentage, 80);
    assert.equal(result.marks_obtained, 80);
});

test("normalizes Practical against its own maximum before 70/30 weighting", () => {
    const result = calculateAssessmentFinalMark({
        components: [{ key: "practical", type: "practical", max_marks: 50 }],
        marksByComponent: { practical: 25 },
        examMarks: 80,
        examMaxMarks: 100,
        subjectFullMarks: 100
    });
    assert.equal(result.percentage, 71);
    assert.equal(result.marks_obtained, 71);
});

test("does not calculate a final mark while a configured component is missing", () => {
    const result = calculateAssessmentFinalMark({
        components: [
            { key: "test_1", type: "test", max_marks: 50 },
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
        components: [{ key: "test_1", type: "test", max_marks: 100 }],
        marksByComponent: { test_1: 80 }
    });
    assert.equal(result.complete, false);
    assert.equal(result.missing, "Examination marks");
});

test("rejects a component mark above its maximum", () => {
    assert.throws(() => calculateAssessmentFinalMark({
        components: [{ key: "test_1", type: "test", max_marks: 20 }],
        marksByComponent: { test_1: 21 },
        examMarks: 10,
        examMaxMarks: 20
    }), /between 0 and 20/);
});
