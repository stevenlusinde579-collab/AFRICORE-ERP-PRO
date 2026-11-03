/**
 * Optional Test/Practical calculation.
 *
 * Tests are averaged equally inside the Test group. The Test group and
 * Practical group are then weighted by their configured maximum marks.
 * This lets the school use the actual paper maxima (for example Theory 100
 * and Practical 50) without imposing one universal Science percentage.
 *
 * Returns null when no optional components are configured, so callers can
 * keep the legacy question-level calculation unchanged.
 */
export function calculateAssessmentFinalMark({
    components = [],
    marksByComponent = {},
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

    const groups = {
        test: [],
        practical: []
    };

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

        groups[String(component.type).toLowerCase()].push({
            percentage: (obtained / maximum) * 100,
            maximum
        });
    }

    const weightedGroups = Object.values(groups)
        .filter(group => group.length > 0)
        .map(group => ({
            percentage: group.reduce((sum, item) => sum + item.percentage, 0) / group.length,
            weight: group.reduce((sum, item) => sum + item.maximum, 0) / group.length
        }));

    const totalWeight = weightedGroups.reduce((sum, group) => sum + group.weight, 0);
    const percentage = totalWeight > 0
        ? weightedGroups.reduce((sum, group) => sum + group.percentage * group.weight, 0) / totalWeight
        : 0;
    const fullMarks = Number(subjectFullMarks) > 0 ? Number(subjectFullMarks) : 100;

    return {
        complete: true,
        percentage: Math.round(percentage * 100) / 100,
        marks_obtained: Math.round((percentage / 100) * fullMarks),
        full_marks: fullMarks
    };
}
