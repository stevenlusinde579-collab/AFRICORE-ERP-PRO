const numberOrNull = value => {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};

const normalizeSection = value => String(value || "UNSECTIONED").trim().toUpperCase();
const questionNumber = item => item.question_number ?? item.order ?? item.questionNumber ?? null;

const groupByIdentity = questions => {
    const groups = new Map();
    for (const item of questions || []) {
        const number = questionNumber(item);
        const key = normalizeSection(item.section) + ":" + String(number ?? "UNNUMBERED");
        const group = groups.get(key) || [];
        group.push(item);
        groups.set(key, group);
    }
    return groups;
};

/**
 * Compares a V2 result against a saved AI analysis reference.
 * This measures parity only; a historical AI result is not ground truth unless
 * the reference explicitly carries teacher_verified: true.
 */
export const compareExamAnalysisToReference = ({ candidate, reference } = {}) => {
    const candidateQuestions = candidate?.questions || candidate?.analysis?.questions || [];
    const referenceQuestions = reference?.questions || reference?.question_analysis || [];
    const candidateGroups = groupByIdentity(candidateQuestions);
    const referenceGroups = groupByIdentity(referenceQuestions);
    const keys = new Set([...candidateGroups.keys(), ...referenceGroups.keys()]);

    let matched = 0;
    let missing = 0;
    let extra = 0;
    let marksCompared = 0;
    let marksExact = 0;
    let topicsCompared = 0;
    let topicsExact = 0;
    let typesCompared = 0;
    let typesExact = 0;

    for (const key of keys) {
        const expected = referenceGroups.get(key) || [];
        const actual = candidateGroups.get(key) || [];
        const count = Math.min(expected.length, actual.length);
        matched += count;
        missing += Math.max(0, expected.length - actual.length);
        extra += Math.max(0, actual.length - expected.length);

        for (let index = 0; index < count; index += 1) {
            const referenceQuestion = expected[index];
            const candidateQuestion = actual[index];
            const expectedMarks = numberOrNull(referenceQuestion.max_marks ?? referenceQuestion.marks);
            const actualMarks = numberOrNull(candidateQuestion.marks ?? candidateQuestion.max_marks);
            if (expectedMarks != null) {
                marksCompared += 1;
                if (actualMarks != null && Math.abs(expectedMarks - actualMarks) <= 0.01) marksExact += 1;
            }

            const expectedTopic = String(referenceQuestion.topic || "").trim().toLowerCase();
            const actualTopic = String(candidateQuestion.curriculum?.topic ?? candidateQuestion.topic ?? "").trim().toLowerCase();
            if (expectedTopic) {
                topicsCompared += 1;
                if (actualTopic && expectedTopic === actualTopic) topicsExact += 1;
            }

            const expectedType = String(referenceQuestion.question_type || "").trim().toLowerCase();
            const actualType = String(candidateQuestion.classification?.type ?? candidateQuestion.question_type ?? "").trim().toLowerCase();
            if (expectedType) {
                typesCompared += 1;
                if (actualType && expectedType === actualType) typesExact += 1;
            }
        }
    }

    const precision = candidateQuestions.length ? matched / candidateQuestions.length : 0;
    const recall = referenceQuestions.length ? matched / referenceQuestions.length : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    const rate = (correct, total) => total ? Number((correct / total).toFixed(3)) : null;

    return {
        comparison_type: reference?.teacher_verified === true ? "teacher_verified_accuracy" : "historical_ai_baseline_parity",
        reference_is_teacher_verified: reference?.teacher_verified === true,
        counts: {
            candidate_questions: candidateQuestions.length,
            reference_questions: referenceQuestions.length,
            matched,
            missing,
            extra,
        },
        question_detection: {
            precision: Number(precision.toFixed(3)),
            recall: Number(recall.toFixed(3)),
            f1: Number(f1.toFixed(3)),
        },
        marks: {
            compared: marksCompared,
            exact_matches: marksExact,
            agreement: rate(marksExact, marksCompared),
        },
        topics: {
            compared: topicsCompared,
            exact_matches: topicsExact,
            agreement: rate(topicsExact, topicsCompared),
        },
        question_types: {
            compared: typesCompared,
            exact_matches: typesExact,
            agreement: rate(typesExact, typesCompared),
        },
        warning: reference?.teacher_verified === true
            ? null
            : "This is parity with a historical AI result, not proof of correctness. A teacher must verify the reference before it becomes golden data.",
    };
};

export default compareExamAnalysisToReference;
