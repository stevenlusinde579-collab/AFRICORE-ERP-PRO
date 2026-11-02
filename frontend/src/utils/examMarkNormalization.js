/**
 * Convert a raw examination mark to a percentage using the actual maximum
 * available for that student/subject. A missing or invalid maximum is not
 * silently treated as 100.
 */
export const normalizeExamMarksToPercentage = (obtained, maximum) => {
    const rawMaximum = Number(maximum);
    const rawObtained = Number(obtained);

    if (!Number.isFinite(rawMaximum) || rawMaximum <= 0 || !Number.isFinite(rawObtained)) {
        return 0;
    }

    return Math.min(100, Math.max(0, (rawObtained / rawMaximum) * 100));
};
