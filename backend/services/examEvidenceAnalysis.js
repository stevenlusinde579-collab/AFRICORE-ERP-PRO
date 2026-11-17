import inferCurriculumTopic from "./curriculumTopicMapper.js";

/**
 * Evidence-backed interpretation layer for the V2 examination document model.
 *
 * This stage deliberately reports evidence and ambiguity instead of guessing.
 * It is additive and is not wired into the live Rule-Based or Gemini pipeline.
 */

const MARK_PATTERNS = [
    /\[\s*(?:alama\s*)?(\d+(?:\.\d+)?)\s*(?:marks?|mks?|alama)?\s*\]/i,
    /\(\s*alama\s+(\d+(?:\.\d+)?)\s*\)/i,
    /(?:^|\s)(\d+(?:\.\d+)?)\s*(?:marks?|mks?)\b/i,
    /\b(?:marks?|alama)\s*[:=]?\s*(\d+(?:\.\d+)?)/i,
];

const SELECTION_PATTERNS = [
    /(?:answer|attempt|choose|select|chagua|jibu)\s+(?:any\s+)?(?:maswali\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten|moja|mawili|matatu|manne|matano|sita|saba|nane|tisa|kumi)\s+(?:out\s+of|from|of the following|kati ya)\s+(\d+|\w+)/i,
    /(?:answer|attempt|choose|select|chagua|jibu)\s+(?:any\s+)?(?:maswali\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten|moja|mawili|matatu|manne|matano|sita|saba|nane|tisa|kumi)\s+(?:questions?|items?|maswali?)/i,
    /(?:chagua|jibu)\s+(?:maswali\s+)?(\d+|moja|mawili|matatu|manne|matano|sita|saba|nane|tisa|kumi)\s+kati ya\s+(?:yafuatayo|yaliyo chini)/i,
];

const NUMBER_WORDS = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    moja: 1, mawili: 2, matatu: 3, manne: 4, matano: 5,
    sita: 6, saba: 7, nane: 8, tisa: 9, kumi: 10,
};

const toNumber = (value) => {
    if (value == null) return null;
    const token = String(value).toLowerCase();
    if (/^\d+(?:\.\d+)?$/.test(token)) return Number(token);
    return NUMBER_WORDS[token] ?? null;
};

const extractMark = (text) => {
    const source = String(text || "");
    for (const pattern of MARK_PATTERNS) {
        const match = source.match(pattern);
        if (match) {
            const value = Number(match[1]);
            if (Number.isFinite(value) && value >= 0) {
                return { value, text: match[0].trim() };
            }
        }
    }
    return null;
};

const uniqueEvidence = (items) => {
    const seen = new Set();
    return (items || []).filter((item) => {
        const key = [item.page, item.line, item.text].join(":");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const classifyQuestion = (text) => {
    const value = String(text || "").toLowerCase();
    if (/\b(match the (?:following|items|words)|match items|column\s+[ab]|pair the following)\b/.test(value) || /\boanisha\b/i.test(value)) {
        return { type: "matching", confidence: 0.9, reason: "Matching instruction or pairing structure detected." };
    }
    if (/\b(fill in the blanks?|complete the sentences?|fill the gaps?)\b/.test(value) ||
        /\b(jaza nafasi|jaza mapengo)\b/i.test(value) || /_{2,}/.test(value)) {
        return { type: "fill_in_the_blanks", confidence: 0.86, reason: "Blank-completion structure detected." };
    }
    if (/\b(true or false|write true or false|kweli au si kweli)\b/i.test(value)) {
        return { type: "true_false", confidence: 0.9, reason: "True/false response format detected." };
    }
    const labelledOptions = value.match(/(?:^|\n)\s*(?:\(?[a-d]\)|[a-d][.)])\s+\S[^\n]*/g) || [];
    if (/\b(multiple choice|choose the correct answer|choose the most correct answer|circle the correct|tick the correct|chagua (?:herufi|jibu) (?:(?:la|ya) )?jibu sahihi|chagua jibu sahihi)\b/i.test(value) ||
        labelledOptions.length >= 3) {
        return { type: "multiple_choice", confidence: 0.88, reason: "Choice instruction or labelled answer options detected." };
    }
    if (/\b(arrange .*order|put .*sequence|sequence the following|pangilia .*mfuatano)\b/i.test(value)) {
        return { type: "sequencing", confidence: 0.86, reason: "Ordering or sequencing instruction detected." };
    }
    if (/\b(experiment|laboratory|apparatus|specimen|draw and label|measure the|carry out an investigation|practical|chunguza|fanya jaribio)\b/i.test(value)) {
        return { type: "practical", confidence: 0.8, reason: "Practical activity language detected." };
    }
    if (/\b(essay|composition|write an essay|write a story|andika insha|utungaji)\b/i.test(value)) {
        return { type: "extended_response", confidence: 0.8, reason: "Extended writing instruction detected." };
    }
    if (/\b(calculate|solve|show that|work out|give reasons|explain|describe|state|define|list|identify|taja|eleza|fafanua|ainisha|linganisha|hesabu|kokotoa|onyesha|andika)\b/i.test(value)) {
        return { type: "structured_response", confidence: 0.72, reason: "Structured response command detected." };
    }
    return { type: "unclassified", confidence: 0.25, reason: "No reliable question-type evidence found." };
};

const parseSelection = (text) => {
    const source = String(text || "").replace(/\s+/g, " ").trim();
    for (const pattern of SELECTION_PATTERNS) {
        const match = source.match(pattern);
        if (!match) continue;
        const required = toNumber(match[1]);
        const available = match[2] ? toNumber(match[2]) : null;
        return {
            required,
            available,
            mode: available == null ? "choose_count" : "choose_from_pool",
            evidence_text: match[0],
            confidence: required == null ? 0.45 : (available == null ? 0.78 : 0.9),
        };
    }
    if (/\b(answer|attempt) all (?:the )?(?:questions|items)\b/i.test(source) || /\bjibu maswali yote\b/i.test(source)) {
        return { required: null, available: null, mode: "answer_all", evidence_text: source, confidence: 0.96 };
    }
    return null;
};

/**
 * @param {object} document - Output from buildExamDocumentModel.
 * @param {string} sourceText - Full extracted PDF text, used only for paper-level totals/instructions.
 */
export const analyzeExamEvidence = ({ document, sourceText = "" } = {}) => {
    const diagnostics = [];
    const questions = (document?.questions || []).map((question) => {
        const questionEvidence = uniqueEvidence(question.evidence);
        const analyzePart = (part) => {
            const evidence = uniqueEvidence(part.evidence);
            const markEvidence = evidence
                .map((item) => ({ ...item, mark: extractMark(item.text) }))
                .filter((item) => item.mark);
            const children = (part.children || []).map(analyzePart);
            const explicitMark = markEvidence[0]?.mark?.value ?? null;
            const childTotal = children.length && children.every(child => Number.isFinite(child.marks))
                ? children.reduce((sum, child) => sum + child.marks, 0)
                : null;
            const marks = explicitMark ?? childTotal;
            const text = [part.text, ...children.map(child => child.text), ...evidence.map(item => item.text)].filter(Boolean).join("\n");
            return {
                id: part.id,
                printed_label: part.printed_label,
                text: part.text || "",
                marks,
                marks_source: explicitMark != null ? "explicit_subpart_evidence" :
                    (childTotal != null ? "sum_of_explicit_nested_subpart_evidence" : "unknown"),
                mark_evidence: markEvidence.map(item => ({ ...item, value: item.mark.value, matched_text: item.mark.text })),
                classification: classifyQuestion(text),
                children,
                evidence,
            };
        };
        const subparts = (question.subparts || []).map(analyzePart);
        const questionMarkEvidence = questionEvidence
            .map((item) => ({ ...item, mark: extractMark(item.text) }))
            .filter((item) => item.mark);
        const explicitQuestionMark = questionMarkEvidence[0]?.mark?.value ?? null;
        const subpartMarks = subparts.every((part) => Number.isFinite(part.marks))
            ? subparts.reduce((sum, part) => sum + part.marks, 0)
            : null;
        const marks = explicitQuestionMark ?? (subparts.length && subpartMarks != null ? subpartMarks : null);
        const text = [question.text, ...subparts.map((part) => part.text), ...questionEvidence.map((item) => item.text)].filter(Boolean).join("\n");

        return {
            id: question.id,
            order: question.order,
            printed_label: question.printed_label,
            section: question.section,
            text: question.text || "",
            marks,
            marks_source: explicitQuestionMark != null ? "explicit_question_evidence" :
                (subparts.length && subpartMarks != null ? "sum_of_explicit_subpart_evidence" : "unknown"),
            mark_evidence: questionMarkEvidence.map((item) => ({ ...item, value: item.mark.value, matched_text: item.mark.text })),
            subparts,
            classification: classifyQuestion(text),
            curriculum: inferCurriculumTopic({ questionText: text, subjectName: document?.subject || "", level: document?.declared_level || "" }),
            evidence: questionEvidence,
        };
    });

    const sectionTotals = (document?.sections || []).map((section) => {
        const markEvidence = uniqueEvidence(section.evidence)
            .map(item => ({ ...item, mark: extractMark(item.text) }))
            .filter(item => item.mark);
        const declared = markEvidence[0]?.mark?.value ?? null;
        const sectionQuestions = questions.filter(question => question.section === section.name);
        const knownMarks = sectionQuestions.filter(question => Number.isFinite(question.marks));
        const calculated = sectionQuestions.length && knownMarks.length === sectionQuestions.length
            ? knownMarks.reduce((sum, question) => sum + question.marks, 0)
            : null;
        if (declared != null && calculated == null) {
            diagnostics.push({
                code: "SECTION_MARKS_UNALLOCATED",
                section: section.name,
                declared_total: declared,
                message: "A printed section total exists, but individual question marks are not all evidenced. No equal allocation has been assumed.",
            });
        } else if (declared != null && calculated != null && declared !== calculated) {
            diagnostics.push({
                code: "SECTION_TOTAL_MISMATCH",
                section: section.name,
                declared_total: declared,
                calculated_total: calculated,
                message: "The section total differs from the sum of evidenced question marks.",
            });
        }
        return {
            section: section.name,
            declared_total: declared,
            calculated_from_explicit_question_marks: calculated,
            mark_evidence: markEvidence.map(item => ({ text: item.text, page: item.page, line: item.line, value: item.mark.value })),
        };
    });

    const instructionEvidence = (document?.instructions || []).flatMap((instruction) =>
        uniqueEvidence(instruction.evidence).map((item) => ({ ...item, scope: instruction.scope || "PAPER" }))
    );
    const instructionTexts = new Set(instructionEvidence.map(item => String(item.text || "").trim().toLowerCase()));
    const allLines = [
        ...instructionEvidence,
        ...String(sourceText || "").split(/\r?\n/).map((text, index) => ({ text: text.trim(), page: null, line: index + 1, scope: "PAPER" }))
            .filter((item) => item.text && !instructionTexts.has(item.text.toLowerCase())),
    ];
    const selections = [];
    const selectionKeys = new Set();
    for (const item of allLines) {
        const selection = parseSelection(item.text);
        if (!selection) continue;
        const key = [item.scope, selection.mode, selection.required, selection.available, selection.evidence_text].join("|");
        if (selectionKeys.has(key)) continue;
        selectionKeys.add(key);
        selections.push({ ...selection, scope: item.scope, evidence: { text: item.text, page: item.page, line: item.line } });
    }

    const totalMatch = String(sourceText || "").match(/\b(?:total\s+marks?|maximum\s+marks?|max\.?\s+marks?|paper\s+total)\s*[:=-]?\s*(\d+(?:\.\d+)?)/i);
    const declaredTotal = totalMatch ? Number(totalMatch[1]) : null;
    const knownQuestionMarks = questions.filter((item) => Number.isFinite(item.marks));
    const calculatedTotal = knownQuestionMarks.length === questions.length && questions.length
        ? knownQuestionMarks.reduce((sum, item) => sum + item.marks, 0)
        : null;

    if (questions.some((item) => item.marks == null)) {
        diagnostics.push({
            code: "QUESTION_MARKS_INCOMPLETE",
            message: "One or more questions do not have explicit, traceable mark evidence.",
            affected_question_ids: questions.filter((item) => item.marks == null).map((item) => item.id),
        });
    }
    if (declaredTotal != null && calculatedTotal != null && declaredTotal !== calculatedTotal) {
        diagnostics.push({
            code: "DECLARED_TOTAL_MISMATCH",
            declared_total: declaredTotal,
            calculated_total: calculatedTotal,
            message: "The printed paper total does not match the sum of detected question marks.",
        });
    }

    const classified = questions.filter((item) => item.classification.type !== "unclassified").length;
    const markCoverage = questions.length ? knownQuestionMarks.length / questions.length : 0;
    const classificationCoverage = questions.length ? classified / questions.length : 0;
    const confidence = Number((0.55 * markCoverage + 0.45 * classificationCoverage).toFixed(3));

    return {
        schema_version: "2.0.0",
        questions,
        selection_rules: selections,
        section_totals: sectionTotals,
        totals: {
            declared: declaredTotal,
            calculated_from_explicit_evidence: calculatedTotal,
            marks_coverage: Number(markCoverage.toFixed(3)),
        },
        quality: {
            confidence,
            classification_coverage: Number(classificationCoverage.toFixed(3)),
            marks_coverage: Number(markCoverage.toFixed(3)),
            status: confidence >= 0.85 ? "high" : confidence >= 0.6 ? "review_required" : "low_evidence",
        },
        diagnostics,
    };
};

export { classifyQuestion, extractMark, parseSelection };
