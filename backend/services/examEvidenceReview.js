/**
 * Compact, teacher-facing cross-check from the evidence-based V2 parser.
 * This is advisory only: it never replaces Rule-Based question marks or
 * question records, and it never blocks the existing analysis pipeline.
 */
export const buildExamEvidenceReview = ({ v2Result, ruleBasedQuestionCount = 0 } = {}) => {
    const analysis = v2Result?.analysis || {};
    const documentQuestions = Array.isArray(v2Result?.document?.questions) ? v2Result.document.questions : [];
    const questions = Array.isArray(analysis.questions) ? analysis.questions : [];
    const questionCount = documentQuestions.length || questions.length;
    const types = {};
    for (const question of analysis.questions || []) {
        const type = question.classification?.type || "unclassified";
        types[type] = (types[type] || 0) + 1;
    }

    const diagnostics = (v2Result?.diagnostics || []).slice(0, 20).map(item => ({
        code: item.code || "REVIEW_REQUIRED",
        severity: item.severity || "warning",
        section: item.section || null,
        question_id: item.question_id || null,
        message: item.message || null,
    }));

    const recommendations = [];
    if (questionCount && Number(ruleBasedQuestionCount) !== questionCount) {
        recommendations.push(
            `Evidence-based cross-check identified ${questionCount} question boundaries while Rule-Based Engine identified ${Number(ruleBasedQuestionCount) || 0}. Review the original PDF for missing, duplicated, or split questions before approval.`
        );
    }
    if (analysis.totals?.declared != null &&
        analysis.totals?.effective_calculated_total != null &&
        Number(analysis.totals.declared) !== Number(analysis.totals.effective_calculated_total)) {
        recommendations.push(
            `Evidence-based cross-check found a marks discrepancy: the printed total is ${analysis.totals.declared}, while supported effective question marks total ${analysis.totals.effective_calculated_total}. Confirm the original paper before grading.`
        );
    }
    if (diagnostics.length) {
        recommendations.push(
            `Evidence-based cross-check raised ${diagnostics.length} structural or marks warning(s). Review the evidence report before approving this paper.`
        );
    }
    if (analysis.quality?.status && analysis.quality.status !== "high") {
        recommendations.push(
            `Evidence-based cross-check confidence is ${analysis.quality.status.replace(/_/g, " ")}. Teacher verification is required for uncertain question boundaries, marks, or topics.`
        );
    }

    return {
        metadata: {
            engine: "evidence_based_v2",
            schema_version: v2Result?.schema_version || "2.0.0",
            question_count: questionCount,
            rule_based_question_count: Number(ruleBasedQuestionCount) || 0,
            question_type_counts: types,
            quality: analysis.quality || null,
            totals: analysis.totals || null,
            section_totals: (analysis.section_totals || []).map(section => ({
                section: section.section,
                declared_total: section.declared_total ?? null,
                calculated_total: section.calculated_from_detected_question_marks ?? null,
                explicit_question_marks_total: section.calculated_from_explicit_question_marks ?? null,
                all_detected_question_marks_total: section.all_detected_question_marks_total ?? null,
                selection_applied: Boolean(section.selection_applied),
                question_count: section.question_count ?? null,
            })),
            selection_rules: (analysis.selection_rules || []).map(rule => ({
                scope: rule.scope || "PAPER",
                mode: rule.mode,
                required: rule.required ?? null,
                available: rule.available ?? null,
                confidence: rule.confidence ?? null,
                evidence_text: rule.evidence_text || null,
            })),
            diagnostics,
            requires_human_review: true,
        },
        recommendations,
    };
};


const formatLabel = value => String(value || "Unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, letter => letter.toUpperCase());

const toRuleBasedQuestionType = question => {
    const type = question.classification?.type || "unclassified";
    if (type === "multiple_choice") return "Multiple Choice";
    if (type === "matching") return "Matching";
    if (type === "extended_response") return "Essay";
    if (type === "structured_response") return "Short Answer";
    return formatLabel(type);
};

/**
 * Only returns replacement rows when V2 has complete, high-confidence
 * structural/marks evidence and its count agrees with the paper's printed
 * expected count. Otherwise the caller must retain existing Rule-Based rows.
 */
export const buildRuleBasedQuestionsFromEvidence = ({ v2Result, expectedQuestionCount = 0 } = {}) => {
    const analysis = v2Result?.analysis || {};
    const documentQuestions = Array.isArray(v2Result?.document?.questions) ? v2Result.document.questions : [];
    const questions = Array.isArray(analysis.questions) ? analysis.questions : [];
    const requestedExpected = Number(expectedQuestionCount);
    const expected = Number.isInteger(requestedExpected) && requestedExpected > 0
        ? requestedExpected
        : documentQuestions.length;
    const diagnostics = Array.isArray(v2Result?.diagnostics) ? v2Result.diagnostics : [];
    const blockingCodes = new Set([
        "NO_QUESTION_BOUNDARIES",
        "AMBIGUOUS_REPEATED_LABEL",
        "UNATTACHED_TEXT",
        "EMPTY_QUESTION",
        "DOCUMENT_VALIDATION_ERROR",
        "SECTION_MARKS_UNALLOCATED",
        "SECTION_TOTAL_MISMATCH",
        "SECTION_MARKS_OVERALLOCATED",
        "DECLARED_TOTAL_MISMATCH",
        "INVALID_SELECTION_RULE",
        "SELECTION_POOL_MISMATCH",
    ]);

    if (!v2Result?.validation?.valid || !v2Result?.decision?.ready_for_review ||
        analysis.quality?.status !== "high" || !Number.isInteger(expected) ||
        expected <= 0 || documentQuestions.length !== expected || questions.length !== expected || !questions.length ||
        diagnostics.some(item => blockingCodes.has(item.code))) {
        return null;
    }

    const declaredTotal = Number(analysis.totals?.declared);
    const effectiveTotal = Number(analysis.totals?.effective_calculated_total);
    if (Number.isFinite(declaredTotal) && declaredTotal > 0 &&
        (!Number.isFinite(effectiveTotal) || Math.abs(declaredTotal - effectiveTotal) > 0.01)) {
        return null;
    }

    if (questions.some(question =>
        !Number.isFinite(question.marks) || question.marks <= 0 ||
        !Number.isFinite(question.mark_confidence) || question.mark_confidence < 0.7 ||
        !question.classification || question.classification.type === "unclassified" ||
        documentQuestions.find(item => item.id === question.id)?.boundary_confidence === "low"
    )) {
        return null;
    }

    const selectionBySection = new Map();
    for (const rule of analysis.selection_rules || []) {
        if (rule.mode === "choose_count" && rule.scope && rule.scope !== "PAPER" &&
            Number.isFinite(rule.required) && Number.isFinite(rule.available)) {
            selectionBySection.set(rule.scope, rule);
        }
    }

    return questions.map((question, index) => {
        const selection = selectionBySection.get(question.section);
        const subpartText = (question.subparts || [])
            .map(part => `${part.printed_label}. ${part.text || ""}`.trim())
            .filter(Boolean);
        const questionText = [question.text, ...subpartText].filter(Boolean).join("\n").trim();
        const markEvidence = (question.mark_evidence || [])
            .map(item => item.text || item.matched_text)
            .filter(Boolean)
            .join(" | ");
        const explanation = [
            question.classification?.reason,
            question.marks_source ? `Marks: ${question.marks_source}` : null,
            question.curriculum?.topic_evidence || null,
        ].filter(Boolean).join(" ");
        const confidence = Math.round(Math.min(
            Number(question.classification?.confidence) || 0.7,
            Number(question.mark_confidence) || 0.7
        ) * 100);

        return {
            question_number: Number.isInteger(question.question_number) && question.question_number > 0
                ? question.question_number : index + 1,
            question_text: questionText || `Question ${index + 1}`,
            section: `Section ${question.section}`,
            section_type: `Section ${question.section}`,
            max_marks: question.marks,
            mark_source: question.marks_source || "evidence_based_v2",
            mark_evidence: markEvidence || null,
            topic: question.topic || null,
            sub_topic: question.sub_topic || null,
            difficulty_level: formatLabel(question.difficulty_level),
            bloom_level: formatLabel(question.bloom_level),
            question_type: toRuleBasedQuestionType(question),
            answer_expected: question.answer_expected || null,
            ai_confidence: confidence,
            ai_explanation: explanation || "Detected by evidence-based V2 document analysis.",
            is_selective: Boolean(selection),
            selection_required: Boolean(selection),
            selection_count: selection ? selection.required : 0,
            selection_total: selection ? selection.available : 0,
            selection_group: selection ? `SECTION-${question.section}-${selection.required}-OF-${selection.available}` : null,
            selection_instruction: selection?.evidence_text || null,
        };
    });
};


export default buildExamEvidenceReview;
