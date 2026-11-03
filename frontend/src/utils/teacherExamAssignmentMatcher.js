const normalizeId = (value) =>
    value === null || value === undefined || value === ""
        ? ""
        : String(value);

const normalizeClassName = (value) =>
    String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\\s+/g, " ");

export function isTeacherAssignedToExamSubject(
    assignment,
    examSubject,
    expectedSchoolId
) {
    if (!assignment || !examSubject) return false;

    // A teacher must always be assigned to the exact subject.
    if (
        normalizeId(assignment.subject_id) !==
        normalizeId(examSubject.subject_id)
    ) {
        return false;
    }

    // Keep the school boundary strict.
    const schoolId = normalizeId(expectedSchoolId);
    if (
        !schoolId ||
        normalizeId(assignment.school_id) !== schoolId ||
        normalizeId(examSubject.classRow?.school_id) !== schoolId
    ) {
        return false;
    }

    // Exact class assignment is the preferred match.
    if (
        normalizeId(assignment.class_id) ===
        normalizeId(examSubject.class_id)
    ) {
        return true;
    }

    // Older assignments may point to a legacy class row without an
    // academic_year_id. Match only when both records describe the same
    // school, academic level and class name.
    const assignedClass = assignment.classRow;
    const examClass = examSubject.classRow;

    if (!assignedClass || !examClass) return false;

    if (
        normalizeId(assignedClass.school_id) !== schoolId ||
        normalizeId(examClass.school_id) !== schoolId
    ) {
        return false;
    }

    const assignedLevel = normalizeClassName(assignedClass.academic_level);
    const examLevel = normalizeClassName(examClass.academic_level);
    const assignedName = normalizeClassName(
        assignedClass.class_name || assignedClass.short_name
    );
    const examName = normalizeClassName(
        examClass.class_name || examClass.short_name
    );

    return Boolean(
        assignedLevel &&
        examLevel &&
        assignedLevel === examLevel &&
        assignedName &&
        examName &&
        assignedName === examName
    );
}
