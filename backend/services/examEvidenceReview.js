/**
 * Compact, teacher-facing cross-check from the evidence-based V2 parser.
 * This is advisory only: it never replaces Rule-Based question marks or
 * question records, and it never blocks the existing analysis pipeline.
 */
export const buildExamEvidenceReview = ({ v2Result, ruleBasedQuestionCount = 0 } = {}) => {
    const analysis = v2Result?.analysis || {};
    const questions = Array.isArray(v2Result?.document?.questions) ? v2Result.document.questions : [];
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
    if (questions.length && Number(ruleBasedQuestionCount) !== questions.length) {
        recommendations.push(
            `Evidence-based cross-check identified ${questions.length} question boundaries while Rule-Based Engine identified ${Number(ruleBasedQuestionCount) || 0}. Review the original PDF for missing, duplicated, or split questions before approval.`
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
            question_count: questions.length,
            rule_based_question_count: Number(ruleBasedQuestionCount) || 0,
            question_type_counts: types,
            quality: analysis.quality || null,
            totals: analysis.totals || null,
            section_totals: (analysis.section_totals || []).map(section => ({
                section: section.section,
                declared_total: section.declared_total ?? null,
                calculated_total: section.calculated_total ?? null,
                effective_total: section.effective_total ?? null,
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

export default buildExamEvidenceReview;
