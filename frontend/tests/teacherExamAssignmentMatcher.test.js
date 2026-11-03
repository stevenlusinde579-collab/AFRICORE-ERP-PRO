import test from "node:test";
import assert from "node:assert/strict";
import { isTeacherAssignedToExamSubject } from "../src/utils/teacherExamAssignmentMatcher.js";

const assignment = {
    subject_id: 28,
    class_id: 32,
    school_id: 3,
    classRow: {
        id: 32,
        school_id: 3,
        academic_level: "Secondary",
        class_name: "Form 4",
        academic_year_id: null
    }
};

const examSubject = {
    subject_id: 28,
    class_id: 46,
    classRow: {
        id: 46,
        school_id: 3,
        academic_level: "Secondary",
        class_name: "Form 4",
        academic_year_id: 3
    }
};

test("allows an assigned subject when legacy and current-year class rows identify the same class", () => {
    assert.equal(
        isTeacherAssignedToExamSubject(assignment, examSubject, 3),
        true
    );
});

test("does not allow a subject that was not assigned to the teacher", () => {
    assert.equal(
        isTeacherAssignedToExamSubject(
            assignment,
            { ...examSubject, subject_id: 18 },
            3
        ),
        false
    );
});

test("does not allow a different class", () => {
    assert.equal(
        isTeacherAssignedToExamSubject(
            assignment,
            {
                ...examSubject,
                classRow: { ...examSubject.classRow, class_name: "Form 3" }
            },
            3
        ),
        false
    );
});

test("does not allow a class from another school", () => {
    assert.equal(
        isTeacherAssignedToExamSubject(
            assignment,
            {
                ...examSubject,
                classRow: { ...examSubject.classRow, school_id: 4 }
            },
            3
        ),
        false
    );
});

test("does not allow a different academic level", () => {
    assert.equal(
        isTeacherAssignedToExamSubject(
            assignment,
            {
                ...examSubject,
                classRow: { ...examSubject.classRow, academic_level: "Primary" }
            },
            3
        ),
        false
    );
});

test("allows the exact assigned class id", () => {
    assert.equal(
        isTeacherAssignedToExamSubject(
            assignment,
            { ...examSubject, class_id: 32 },
            3
        ),
        true
    );
});
