/**
 * Optional Test/Practical calculation.
 *
 * Theory is the simple average of every configured Test used and the
 * examination paper percentage. If no Tests are configured, the paper alone
 * is the Theory mark. When Practical is configured, the final mark follows
 * the NECTA-style 70% Theory + 30% Practical weighting.
 *
 * Each assessment is first normalized against its own maximum marks so
 * different configured maxima do not distort the average.
 *
 * Returns null when no optional components are configured, preserving the
 * existing question-by-question calculation path.
 */
export function calculateAssessmentFinalMark({
    components = [],
    marksByComponent = {},
    examMarks = 0,
    examMaxMarks = 0,
    subjectFullMarks = 100
} = {}) {
    const configured = Array.isArray(components)
        ? components.filter(component =>
            component &&
            String(component.key || "").trim() &&
            ["test", "practical"].includes(String(component.type || "").toLowerCase()) &&
            Number.isFinite(Number(component.max_marks)) &&
            Number(component.max_marks) > 0
        )
        : [];

    if (configured.length === 0) return null;

    const tests = [];
    const practicals = [];

    for (const component of configured) {
        const rawValue = marksByComponent[String(component.key)];
        if (rawValue === "" || rawValue === null || rawValue === undefined) {
            return {
                complete: false,
                missing: component.label || component.key,
                percentage: null,
                marks_obtained: null,
                full_marks: Number(subjectFullMarks) || 100
            };
        }

        const obtained = Number(rawValue);
        const maximum = Number(component.max_marks);
        if (!Number.isFinite(obtained) || obtained < 0 || obtained > maximum) {
            throw new Error(
                `Marks for ${component.label || component.key} must be between 0 and ${maximum}.`
            );
        }

        const percentage = (obtained / maximum) * 100;
        if (String(component.type).toLowerCase() === "test") {
            tests.push(percentage);
        } else {
            practicals.push(percentage);
        }
    }

    const paperMaximum = Number(examMaxMarks);
    const paperObtained = Number(examMarks);
    if (!Number.isFinite(paperMaximum) || paperMaximum <= 0) {
        return {
            complete: false,
            missing: "Examination marks",
            percentage: null,
            marks_obtained: null,
            full_marks: Number(subjectFullMarks) || 100
        };
    }

    if (!Number.isFinite(paperObtained) || paperObtained < 0 || paperObtained > paperMaximum) {
        throw new Error(`Examination marks must be between 0 and ${paperMaximum}.`);
    }

    const theoryParts = [...tests, (paperObtained / paperMaximum) * 100];
    const theoryPercentage = theoryParts.reduce((sum, value) => sum + value, 0) / theoryParts.length;

    const practicalPercentage = practicals.length
        ? practicals.reduce((sum, value) => sum + value, 0) / practicals.length
        : null;

    const percentage = practicalPercentage === null
        ? theoryPercentage
        : (theoryPercentage * 0.70) + (practicalPercentage * 0.30);

    const fullMarks = Number(subjectFullMarks) > 0 ? Number(subjectFullMarks) : 100;
    const roundedPercentage = Math.round(percentage * 100) / 100;

    return {
        complete: true,
        theory_percentage: Math.round(theoryPercentage * 100) / 100,
        practical_percentage: practicalPercentage === null
            ? null
            : Math.round(practicalPercentage * 100) / 100,
        percentage: roundedPercentage,
        // exam_marks.marks_obtained is an integer column in the current schema.
        marks_obtained: Math.round((percentage / 100) * fullMarks),
        full_marks: fullMarks
    };
}
