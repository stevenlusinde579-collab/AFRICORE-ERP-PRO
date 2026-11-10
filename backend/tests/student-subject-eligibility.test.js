import test from "node:test";
import assert from "node:assert/strict";
import { filterStudentsBySubjectRegistration } from "../services/studentSubjectEligibility.js";

const students = [
    { id: 10, first_name: "ECA student" },
    { id: 11, first_name: "Chemistry student" },
    { id: 12, first_name: "Other student" }
];

const registrations = [
    { student_id: 10, subject_id: 38, class_id: 50, academic_year_id: 3 },
    { student_id: 10, subject_id: 39, class_id: 50, academic_year_id: 3 },
    { student_id: 10, subject_id: 45, class_id: 50, academic_year_id: 3 },
    { student_id: 11, subject_id: 41, class_id: 50, academic_year_id: 3 },
    { student_id: 12, subject_id: 38, class_id: 51, academic_year_id: 3 }
];

test("ECA learner is returned for a registered combination subject only", () => {
    const result = filterStudentsBySubjectRegistration(
        students,
        registrations,
        { subjectId: 38, classId: 50, academicYearId: 3 }
    );

    assert.deepEqual(result.map(student => student.id), [10]);
});

test("learner registered for Chemistry is not returned for Accountancy", () => {
    const result = filterStudentsBySubjectRegistration(
        students,
        registrations,
        { subjectId: 41, classId: 50, academicYearId: 3 }
    );

    assert.deepEqual(result.map(student => student.id), [11]);
});

test("registration from another class or academic year is not accepted", () => {
    const result = filterStudentsBySubjectRegistration(
        students,
        registrations,
        { subjectId: 38, classId: 50, academicYearId: 4 }
    );

    assert.deepEqual(result, []);
});

test("empty registrations never fall back to the whole class", () => {
    const result = filterStudentsBySubjectRegistration(
        students,
        [],
        { subjectId: 41, classId: 50, academicYearId: 3 }
    );

    assert.deepEqual(result, []);
});
