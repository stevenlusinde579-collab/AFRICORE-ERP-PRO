/**
 * Evidence-based examination document model (V2 foundation).
 *
 * This module is intentionally additive: it does not replace the production
 * Rule-Based output contract. It builds a provenance-preserving document
 * structure that later analysis stages can consume and validate.
 */

const QUESTION_HEADER = /^\s*(?:(?:QUESTION|Q(?:UESTION)?\.?|ACTIVITY|TASK|EXERCISE|ITEM)\s*(?:NO\.?|NUMBER)?\s*)?(\d{1,3}|[ivxlcdm]{1,8})\s*[.)\]:-]?\s*(.*)$/i;
const SECTION_HEADER = /^\s*(?:SECTION|PART|SEHEMU)\s+([A-F]|[IVXLCDM]+|\d+)\b\s*[:.)-]?\s*(.*)$/i;
const SUBPART_HEADER = /^\s*(?:\(\s*([a-z]|[ivxlcdm]+)\s*\)|([a-z]|[ivxlcdm]+)[.)])\s*(.*)$/i;
const ADMIN_LINE = /^(?:answer all questions|answer any|attempt all|attempt any|jibu maswali yote|majibu yote yaandikwe|zingatia usafi|kwa matumizi ya mtahini|namba ya swali|jumla\b|ukurasa wa \d+|write your (?:name|examination number)|do not open|this paper consists|this paper consist|section [a-f] carries|all writing must|cellular phones|non programmable calculator|all answers must|total marks?|maximum marks?|max[.]? marks?|paper total|end of (?:the )?examination)/i;

const romanValue = (value) => {
    const token = String(value || "").toUpperCase();
    if (!/^[IVXLCDM]+$/.test(token)) return null;
    const values = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
    let total = 0;
    for (let i = 0; i < token.length; i += 1) {
        const current = values[token[i]];
        const next = values[token[i + 1]] || 0;
        total += current < next ? -current : current;
    }
    return total;
};

const numberValue = (token) => {
    const value = String(token || "").trim();
    if (/^\d+$/.test(value)) return Number(value);
    return romanValue(value);
};

const isEarlyYearsLevel = (level, text) =>
    /\b(baby\s*class|nursery|kindergarten|pre[- ]?primary|early\s+years|early\s+childhood)\b/i.test(String(level || "") + " " + String(text || "").slice(0, 5000));

const EARLY_YEARS_TASK = /^(?:trace|colour|color|match|circle|count|draw|join|write|name|identify|sing|recite|sort|complete|fill|read|point|arrange|paint|cut|paste|show|say|repeat|tick|underline|connect|taja|chora|paka(?:\s+rangi)?|oanisha|hesabu|unganisha|andika|soma|zungushia|jaza|onyesha|fafanua)\b/i;

const makeEvidence = (text, page, line, kind) => ({
    text,
    page,
    line,
    kind,
});

export const buildExamDocumentModel = ({ text, level = "", subject = "" } = {}) => {
    const source = String(text || "").replace(/\r/g, "\n");
    const pages = source.split(/\f|\n\s*---\s*PAGE\s+\d+\s*---\s*\n/i);
    const document = {
        schema_version: "2.0.0",
        subject: String(subject || "").trim() || null,
        declared_level: String(level || "").trim() || null,
        pages: [],
        header_evidence: [],
        sections: [],
        questions: [],
        instructions: [],
        diagnostics: [],
    };

    let currentSection = null;
    let currentQuestion = null;
    let currentSubpart = null;
    let currentNestedPart = null;
    let currentOption = null;
    let questionOrder = 0;
    const earlyYears = isEarlyYearsLevel(level, source);

    const ensureSection = (name = "UNSECTIONED", title = "") => {
        let section = document.sections.find(item => item.name === name);
        if (!section) {
            section = { id: "section-" + (document.sections.length + 1), name, title, questions: [], evidence: [] };
            document.sections.push(section);
        }
        currentSection = section;
        return section;
    };

    pages.forEach((pageText, pageIndex) => {
        const lines = pageText.split("\n");
        document.pages.push({ page: pageIndex + 1, line_count: lines.length });
        lines.forEach((rawLine, lineIndex) => {
            const line = rawLine.replace(/[\t ]+/g, " ").trim();
            if (!line) return;
            const evidence = makeEvidence(line, pageIndex + 1, lineIndex + 1, "pdf_text");

            const sectionMatch = line.match(SECTION_HEADER);
            if (sectionMatch) {
                currentQuestion = null;
                currentSubpart = null;
                currentNestedPart = null;
                currentOption = null;
                ensureSection(String(sectionMatch[1]).toUpperCase(), sectionMatch[2] || "");
                currentSection.evidence.push(evidence);
                if (/\b(answer all|answer any|attempt all|attempt any|jibu maswali yote)\b/i.test(sectionMatch[2] || "")) {
                    document.instructions.push({ text: sectionMatch[2].trim(), evidence: [evidence], scope: currentSection.name });
                }
                return;
            }

            const optionMatch = line.match(/^([A-E])[.)]\s+(.+)$/);
            if (optionMatch && currentQuestion && (currentSubpart || /\b(choose|match|column|list A|multiple choice)\b/i.test(currentQuestion.text))) {
                const isMatchingPool = /\b(match|column|list A)\b/i.test(currentQuestion.text);
                const target = isMatchingPool ? currentQuestion : (currentSubpart || currentQuestion);
                const option = { label: optionMatch[1], text: optionMatch[2].trim(), evidence: [evidence] };
                if (target === currentQuestion) {
                    target.response_options = target.response_options || [];
                    target.response_options.push(option);
                } else {
                    target.options = target.options || [];
                    target.options.push(option);
                }
                currentOption = option;
                return;
            }

            // Numbered lines before the first examination section belong to the
            // paper instructions/header, not to the question list.
            if (!currentSection && /^\d{1,3}\s*[.)\]:-]\s+/.test(line) &&
                !/^(?:QUESTION|Q\.?|ACTIVITY|TASK|EXERCISE|ITEM)\b/i.test(line)) {
                document.instructions.push({ text: line, evidence: [evidence], scope: "PAPER" });
                document.header_evidence.push(evidence);
                return;
            }

            const questionMatch = line.match(QUESTION_HEADER);
            const isExplicitRomanQuestion = /^[IVXLCDM]{1,8}\s*[.)]/.test(line);
            if (questionMatch && (/^(?:QUESTION|Q|ACTIVITY|TASK|EXERCISE|ITEM)\b/i.test(line) || /^\s*\d{1,3}\s*[.)\]:-]/.test(line) || isExplicitRomanQuestion) && !ADMIN_LINE.test(questionMatch[2] || "")) {
                const number = numberValue(questionMatch[1]);
                const explicitLabel = /^(?:QUESTION|Q(?:UESTION)?\.?|ACTIVITY|TASK|EXERCISE|ITEM)\b/i.test(line);
                const prior = currentSection?.questions || [];
                const repeated = prior.find(item => item.printed_label === String(questionMatch[1]).toUpperCase());
                // A repeated printed label is retained as a distinct occurrence only
                // when an explicit heading establishes a new task; otherwise it is
                // treated as continuation evidence rather than silently duplicated.
                if (repeated && !explicitLabel) {
                    document.diagnostics.push({
                        code: "AMBIGUOUS_REPEATED_LABEL",
                        severity: "warning",
                        page: pageIndex + 1,
                        line: lineIndex + 1,
                        label: questionMatch[1],
                        related_question_id: repeated.id,
                        message: "Repeated question label in the same section was not merged or counted as a new question without stronger boundary evidence.",
                    });
                    if (currentQuestion) currentQuestion.evidence.push({ ...evidence, kind: "ambiguous_boundary" });
                    return;
                }
                currentSection = currentSection || ensureSection();
                questionOrder += 1;
                currentQuestion = {
                    id: "question-" + questionOrder,
                    order: questionOrder,
                    printed_label: String(questionMatch[1]).toUpperCase(),
                    question_number: number,
                    text: String(questionMatch[2] || "").trim(),
                    subparts: [],
                    evidence: [evidence],
                    mark_evidence: [],
                    section: currentSection.name,
                    boundary_confidence: explicitLabel ? "high" : "medium",
                };
                currentSection.questions.push(currentQuestion);
                document.questions.push(currentQuestion);
                currentSubpart = null;
                currentNestedPart = null;
                currentOption = null;
                return;
            }

            if (earlyYears && currentQuestion && EARLY_YEARS_TASK.test(line)) {
                currentQuestion = {
                    id: "question-" + (++questionOrder),
                    order: questionOrder,
                    printed_label: "ACTIVITY " + questionOrder,
                    question_number: questionOrder,
                    text: line,
                    subparts: [],
                    evidence: [evidence],
                    mark_evidence: [],
                    section: currentSection?.name || "UNSECTIONED",
                    boundary_confidence: "medium",
                };
                currentSection = currentSection || ensureSection();
                currentSection.questions.push(currentQuestion);
                document.questions.push(currentQuestion);
                currentSubpart = null;
                currentNestedPart = null;
                currentOption = null;
                return;
            }

            const subpartMatch = line.match(SUBPART_HEADER);
            if (subpartMatch && currentQuestion) {
                currentOption = null;
                const label = String(subpartMatch[1] || subpartMatch[2]).toLowerCase();
                const parentValue = currentSubpart ? romanValue(currentSubpart.printed_label) : null;
                const childValue = romanValue(label);
                const isRomanSequenceSibling = parentValue != null && childValue === parentValue + 1;
                const nested = Boolean(currentSubpart && /^[ivxlcdm]+$/.test(label) && !isRomanSequenceSibling);
                const part = {
                    id: nested ? currentSubpart.id + "-child-" + (currentSubpart.children.length + 1) : currentQuestion.id + "-part-" + (currentQuestion.subparts.length + 1),
                    printed_label: label,
                    text: String(subpartMatch[3] || "").trim(),
                    children: [],
                    evidence: [evidence],
                    mark_evidence: [],
                };
                if (nested) {
                    currentSubpart.children.push(part);
                    currentNestedPart = part;
                } else {
                    currentQuestion.subparts.push(part);
                    currentSubpart = part;
                    currentNestedPart = null;
                }
                return;
            }

            if (ADMIN_LINE.test(line)) {
                document.instructions.push({ text: line, evidence: [evidence], scope: currentSection?.name || "PAPER" });
                currentSubpart = null;
                currentNestedPart = null;
                currentOption = null;
                return;
            }

            if (currentOption) {
                currentOption.text = [currentOption.text, line].filter(Boolean).join("\n");
                currentOption.evidence.push(evidence);
            } else if (currentNestedPart) {
                currentNestedPart.text = [currentNestedPart.text, line].filter(Boolean).join("\n");
                currentNestedPart.evidence.push(evidence);
            } else if (currentSubpart) {
                currentSubpart.text = [currentSubpart.text, line].filter(Boolean).join("\n");
                currentSubpart.evidence.push(evidence);
            } else if (currentQuestion) {
                currentQuestion.text = [currentQuestion.text, line].filter(Boolean).join("\n");
                currentQuestion.evidence.push(evidence);
            } else if (!currentSection) {
                // Keep cover-page and instruction text as document evidence.
                // Do not create a fake UNSECTIONED section with unrelated marks.
                document.header_evidence.push(evidence);
            } else {
                currentSection.evidence.push(evidence);
                if (currentSection.questions.length === 0) {
                    document.header_evidence.push(evidence);
                } else {
                    document.diagnostics.push({ code: "UNATTACHED_TEXT", page: pageIndex + 1, line: lineIndex + 1 });
                }
            }
        });
    });

    if (!document.questions.length) {
        document.diagnostics.push({ code: "NO_QUESTION_BOUNDARIES", severity: "warning" });
    }
    for (const question of document.questions) {
        if (!question.text && !question.subparts.length) {
            document.diagnostics.push({ code: "EMPTY_QUESTION", question_id: question.id, severity: "warning" });
        }
    }

    if (earlyYears && document.questions.length === 0) {
        for (const section of document.sections) {
            let currentTask = null;
            for (const item of section.evidence || []) {
                const line = String(item.text || "").trim();
                if (!line || SECTION_HEADER.test(line) || ADMIN_LINE.test(line)) continue;
                if (EARLY_YEARS_TASK.test(line)) {
                    currentTask = {
                        id: "question-" + (++questionOrder),
                        order: questionOrder,
                        printed_label: "ACTIVITY " + questionOrder,
                        question_number: questionOrder,
                        text: line,
                        subparts: [],
                        evidence: [item],
                        mark_evidence: [],
                        section: section.name,
                        boundary_confidence: "medium",
                    };
                    section.questions.push(currentTask);
                    document.questions.push(currentTask);
                } else if (currentTask) {
                    currentTask.text = [currentTask.text, line].filter(Boolean).join("\n");
                    currentTask.evidence.push(item);
                }
            }
        }
    }

    document.summary = {
        page_count: document.pages.length,
        section_count: document.sections.length,
        question_count: document.questions.length,
        instruction_count: document.instructions.length,
        subpart_count: document.questions.reduce((sum, question) => sum + question.subparts.reduce((partSum, part) => partSum + 1 + (part.children?.length || 0), 0), 0),
    };
    return document;
};

export const validateExamDocumentModel = (document) => {
    const errors = [];
    const warnings = [];
    if (!document || document.schema_version !== "2.0.0") errors.push("Unsupported or missing document schema version.");
    const ids = new Set();
    for (const question of document?.questions || []) {
        if (ids.has(question.id)) errors.push("Duplicate question id: " + question.id);
        ids.add(question.id);
        if (!question.evidence?.length) warnings.push("Question " + question.id + " has no source evidence.");
        if (!question.text && !question.subparts?.length) warnings.push("Question " + question.id + " has no readable stem or subparts.");
        for (const part of question.subparts || []) {
            if (!part.evidence?.length) warnings.push("Subpart " + part.id + " has no source evidence.");
            for (const child of part.children || []) {
                if (!child.evidence?.length) warnings.push("Nested subpart " + child.id + " has no source evidence.");
            }
        }
    }
    return { valid: errors.length === 0, errors, warnings };
};
