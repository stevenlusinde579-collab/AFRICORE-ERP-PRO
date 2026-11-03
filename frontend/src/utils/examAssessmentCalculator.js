/**
 * Optional Test/Practical calculation.
 *
 * Test marks (when configured) and the examination-paper mark are averaged
 * to produce the Theory mark. If Practical is configured, its raw mark is
 * added to Theory and the combined total is converted to the subject's
 * /100 scale. For a 100-mark Theory and 50-mark Practical, the denominator
 * is 150. Practical is NOT weighted 70/30.
 *
 * Returns null when no optional components are configured, preserving the
 * legacy question-by-question calculation path.
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

    // A component is used only when this particular student has entered a value.
    // Blank means "not entered"; numeric zero is a real mark and must be included.
    const enteredComponents = configured.filter(component => {
        const value = marksByComponent[String(component.key)];
        return value !== "" && value !== null && value !== undefined;
    });

    const tests = [];
    const practicals = [];

    for (const component of enteredComponents) {
        const rawValue = marksByComponent[String(component.key)];
        const obtained = Number(rawValue);
        const maximum = Number(component.max_marks);
        if (!Number.isFinite(obtained) || obtained < 0 || obtained > maximum) {
            return {
                complete: false,
                validation_error: `Marks za ${component.label || component.key} lazima ziwe kati ya 0 na ${maximum}. Rekebisha alama iliyoingizwa; kiwango cha juu hakijabadilishwa.`,
                invalid_component: String(component.key),
                percentage: null,
                marks_obtained: null,
                full_marks: Number(subjectFullMarks) || 100
            };
        }

        if (String(component.type).toLowerCase() === "test") {
            tests.push(obtained);
        } else {
            if (maximum !== 50) {
                return {
                    complete: false,
                    configuration_error: "Practical Max Marks lazima iwe 50. Rekebisha usanidi wa somo hili kabla ya kuingiza marks.",
                    percentage: null,
                    marks_obtained: null,
                    full_marks: Number(subjectFullMarks) || 100
                };
            }
            practicals.push({ obtained, maximum: 50 });
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
        return {
            complete: false,
            validation_error: `Marks za Examination Paper lazima ziwe kati ya 0 na ${paperMaximum}. Rekebisha alama za maswali; kiwango cha juu hakijabadilishwa.`,
            invalid_component: "examination_paper",
            percentage: null,
            marks_obtained: null,
            full_marks: Number(subjectFullMarks) || 100
        };
    }

    const theoryFullMarks = Number(subjectFullMarks) > 0 ? Number(subjectFullMarks) : 100;
    const theoryParts = [...tests, paperObtained];
    const theoryMarks = theoryParts.reduce((sum, value) => sum + value, 0) / theoryParts.length;

    const practicalMarks = practicals.length
        ? practicals.reduce((sum, item) => sum + item.obtained, 0)
        : null;
    const practicalFullMarks = practicals.length
        ? practicals.reduce((sum, item) => sum + item.maximum, 0)
        : 0;

    const combinedObtained = practicalMarks === null
        ? theoryMarks
        : theoryMarks + practicalMarks;
    const combinedMaximum = practicalMarks === null
        ? theoryFullMarks
        : theoryFullMarks + practicalFullMarks;
    const percentage = (combinedObtained / combinedMaximum) * 100;
    const finalMarks = (percentage / 100) * theoryFullMarks;

    return {
        complete: true,
        theory_marks: Math.round(theoryMarks * 100) / 100,
        theory_full_marks: theoryFullMarks,
        practical_marks: practicalMarks === null
            ? null
            : Math.round(practicalMarks * 100) / 100,
        practical_full_marks: practicalFullMarks || null,
        combined_marks: Math.round(combinedObtained * 100) / 100,
        combined_full_marks: combinedMaximum,
        percentage: Math.round(percentage * 100) / 100,
        // exam_marks.marks_obtained is an integer column in the current schema.
        marks_obtained: Math.round(finalMarks),
        full_marks: theoryFullMarks
    };
}
