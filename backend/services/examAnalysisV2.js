import { buildExamDocumentModel, validateExamDocumentModel } from "./examDocumentModel.js";
import { analyzeExamEvidence } from "./examEvidenceAnalysis.js";

/**
 * Runs the additive V2 analysis pipeline on extracted, selectable PDF text.
 * This module is intentionally not connected to production controllers yet.
 */
export const analyzeExaminationV2 = ({ text, level = "", subject = "" } = {}) => {
    const document = buildExamDocumentModel({ text, level, subject });
    const validation = validateExamDocumentModel(document);
    const analysis = analyzeExamEvidence({ document, sourceText: text || "" });

    const diagnostics = [
        ...(document.diagnostics || []),
        ...(validation.errors || []).map(message => ({ code: "DOCUMENT_VALIDATION_ERROR", severity: "error", message })),
        ...(validation.warnings || []).map(message => ({ code: "DOCUMENT_VALIDATION_WARNING", severity: "warning", message })),
        ...(analysis.diagnostics || []),
    ];

    const hasStructuralErrors = !validation.valid;
    const hasBoundaryWarnings = diagnostics.some(item =>
        ["NO_QUESTION_BOUNDARIES", "AMBIGUOUS_REPEATED_LABEL", "UNATTACHED_TEXT", "EMPTY_QUESTION"].includes(item.code)
    );
    const readyForReview = !hasStructuralErrors && document.questions.length > 0;
    const safeToAutoApprove = readyForReview &&
        !hasBoundaryWarnings &&
        analysis.quality.status === "high" &&
        diagnostics.length === 0;

    return {
        schema_version: "2.0.0",
        engine: "evidence_based_v2",
        document,
        analysis,
        validation,
        diagnostics,
        decision: {
            ready_for_review: readyForReview,
            safe_to_auto_approve: safeToAutoApprove,
            requires_human_review: !safeToAutoApprove,
            reason: safeToAutoApprove
                ? "All configured evidence and structural checks passed."
                : "Human review is required because one or more structure, evidence, or confidence checks are incomplete.",
        },
    };
};

export default analyzeExaminationV2;
