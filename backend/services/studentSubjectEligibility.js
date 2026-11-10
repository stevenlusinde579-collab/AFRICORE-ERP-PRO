/**
 * Restrict an exam-subject roster to students who were registered for
 * that exact subject in that class and academic year.
 *
 * No class-wide fallback is allowed: an empty registration set must produce
 * an empty roster rather than exposing every student in the class.
 */
export const filterStudentsBySubjectRegistration = (
    students = [],
    registrations = [],
    {
        subjectId,
        classId,
        academicYearId = null
    } = {}
) => {
    const normalizeId = value =>
        value === null || value === undefined || value === ""
            ? null
            : String(value);

    const expectedSubjectId = normalizeId(subjectId);
    const expectedClassId = normalizeId(classId);
    const expectedAcademicYearId = normalizeId(academicYearId);

    if (!expectedSubjectId || !expectedClassId) {
        return [];
    }

    const registeredStudentIds = new Set(
        registrations
            .filter(row =>
                normalizeId(row.subject_id) === expectedSubjectId &&
                normalizeId(row.class_id) === expectedClassId &&
                (
                    !expectedAcademicYearId ||
                    normalizeId(row.academic_year_id) === expectedAcademicYearId
                )
            )
            .map(row => normalizeId(row.student_id))
            .filter(Boolean)
    );

    return students.filter(student =>
        registeredStudentIds.has(normalizeId(student.id))
    );
};
