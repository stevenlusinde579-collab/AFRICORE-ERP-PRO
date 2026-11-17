import inferCurriculumTopic from "./examCurriculumTopicMapperV2.js";

/**
 * Evidence-backed interpretation layer for the V2 examination document model.
 *
 * This stage deliberately reports evidence and ambiguity instead of guessing.
 * It is additive and is not wired into the live Rule-Based or Gemini pipeline.
 */

const MARK_PATTERNS = [
    /\[\s*(?:alama\s*)?(\d+(?:\.\d+)?)\s*(?:marks?|mks?|alama)?\s*\]/i,
    /\(\s*alama\s+(\d+(?:\.\d+)?)\s*\)/i,
    /\(\s*(\d+(?:\.\d+)?)\s*(?:marks?|mks?)\s*\)/i,
    /(?:^|\s)(\d+(?:\.\d+)?)\s*(?:marks?|mks?)\b/i,
    /\b(?:marks?|alama)\s*[:=]?\s*(\d+(?:\.\d+)?)/i,
];

const SELECTION_PATTERNS = [
    /(?:answer|attempt|choose|select|chagua|jibu)\s+(?:any\s+)?(?:maswali\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten|moja|mawili|matatu|manne|matano|sita|saba|nane|tisa|kumi)\s+(?:out\s+of|from|of the following|kati ya)\s+(\d+|\w+)/i,
    /(?:answer|attempt|choose|select|chagua|jibu)\s+(?:any\s+)?(?:maswali\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten|moja|mawili|matatu|manne|matano|sita|saba|nane|tisa|kumi)(?:\s*\(\s*\d+\s*\))?\s*(?:questions?|items?|maswali?)/i,
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
    if (/\b(match the (?:following|items|words|descriptions|terms|statements)|match items|column\s+[ab]|pair the following)\b/.test(value) || /\boanisha\b/i.test(value)) {
        return { type: "matching", confidence: 0.9, reason: "Matching instruction or pairing structure detected." };
    }
    if (/\b(dictation|listen carefully to the sentences|write the sentences read)\b/i.test(value)) {
        return { type: "dictation", confidence: 0.88, reason: "Listening and dictation task detected." };
    }
    if (/\b(read the (?:following )?passage|reading comprehension|answer the questions that follow)\b/i.test(value) || /\b(soma kifungu|soma habari)\b/i.test(value)) {
        return { type: "reading_comprehension", confidence: 0.84, reason: "Passage-based comprehension task detected." };
    }
    const labelledOptions = value.match(/(?:^|\n)\s*(?:\(?[a-d]\)|[a-d][.)])\s+\S[^\n]*/g) || [];
    if (/\b(multiple choice|choose the correct(?: answer)?|choose the most correct answer|circle the correct|tick the correct|chagua (?:herufi|jibu) (?:(?:la|ya) )?jibu sahihi|chagua jibu sahihi)\b/i.test(value) ||
        labelledOptions.length >= 3) {
        return { type: "multiple_choice", confidence: 0.88, reason: "Choice instruction or labelled answer options detected." };
    }
    if (/\b(true or false|write true or false|kweli au si kweli)\b/i.test(value)) {
        return { type: "true_false", confidence: 0.9, reason: "True/false response format detected." };
    }
    if (/\b(arrange .*order|put .*sequence|sequence the following|pangilia .*mfuatano)\b/i.test(value)) {
        return { type: "sequencing", confidence: 0.86, reason: "Ordering or sequencing instruction detected." };
    }
    if (/\b(experiment|laboratory|apparatus|specimen|draw and label|measure the|carry out an investigation|practical|chunguza|fanya jaribio)\b/i.test(value)) {
        return { type: "practical", confidence: 0.8, reason: "Practical activity language detected." };
    }
    if (/\b(jumbled letters|rearrange the letters|word formation|spell the word|spelling)\b/i.test(value)) {
        return { type: "word_formation", confidence: 0.86, reason: "Word-building or spelling task detected." };
    }
    if (/\b(essay|composition|write an essay|write a story|andika insha|utungaji)\b/.test(value)) {
        return { type: "extended_response", confidence: 0.8, reason: "Extended writing instruction detected." };
    }
    if (/\b(fill in the blanks?|complete (?:the )?(?:sentences?|routine|words?)|fill the gaps?)\b/.test(value) ||
        /\b(jaza nafasi|jaza mapengo)\b/i.test(value) || /_{2,}/.test(value) || /\.{5,}/.test(value)) {
        return { type: "fill_in_the_blanks", confidence: 0.86, reason: "Blank-completion structure detected." };
    }
    if (/\b(trace|colour|color|count|circle|paint|cut|paste|sing|recite|point|repeat|connect|tick|underline|trace|chora|paka|hesabu|zungushia|unganisha)\b/i.test(value)) {
        return { type: "activity", confidence: 0.82, reason: "Learner activity prompt detected." };
    }
    if (/\b(calculate|solve|show that|work out|give reasons|explain|describe|state|define|list|identify|justify|argue|elaborate|differentiate|distinguish|discuss|outline|illustrate|compare|contrast|how (?:are|is|do|does)|used in|taja|eleza|fafanua|ainisha|linganisha|hesabu|kokotoa|onyesha|andika)\b/i.test(value)) {
        return { type: "structured_response", confidence: 0.72, reason: "Structured response command detected." };
    }
    return { type: "unclassified", confidence: 0.25, reason: "No reliable question-type evidence found." };
};

const parseSelection = (text) => {
    const source = String(text || "").replace(/\s+/g, " ").trim();
    const sectionSelection = source.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)(?:\s*\(\s*\d+\s*\))?\s+questions?\s+from\s+section\b[\s\S]{0,60}?\b([A-F])\b/i);
    if (sectionSelection) {
        return {
            required: toNumber(sectionSelection[1]),
            available: null,
            mode: "choose_count",
            section_scope: sectionSelection[2].toUpperCase(),
            evidence_text: sectionSelection[0],
            confidence: 0.86,
        };
    }
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

const inferBloomLevel = (text) => {
    const source = String(text || "").toLowerCase();
    const levels = [
        ["creating", /\b(design|construct|compose|develop|formulate|create|propose|tunga|buni)\b/i],
        ["evaluating", /\b(evaluate|assess|justify|recommend|critique|defend|tathmini|toa hoja)\b/i],
        ["analysing", /\b(compare|contrast|distinguish|classify|examine|analyse|analyze|categorise|categorize|linganisha|ainisha)\b/i],
        ["applying", /\b(calculate|solve|apply|use|demonstrate|perform|compute|kokotoa|hesabu|tumia)\b/i],
        ["understanding", /\b(explain|describe|summarise|summarize|interpret|discuss|eleza|fafanua)\b/i],
        ["remembering", /\b(define|state|list|name|identify|mention|recall|which of the following|which business|who is|what is|choose the correct|select the correct|taja|orodhesha)\b/i],
    ];
    const match = levels.find(([, pattern]) => pattern.test(source));
    if (!match) return { level: "unknown", confidence: 0, evidence: null };
    const evidence = source.match(match[1])?.[0] || null;
    return { level: match[0], confidence: 0.82, evidence };
};

const estimateDifficulty = ({ bloom, marks, subparts = 0 } = {}) => {
    const base = {
        remembering: "easy",
        understanding: "moderate",
        applying: "moderate",
        analysing: "challenging",
        evaluating: "challenging",
        creating: "challenging",
    }[bloom?.level] || "unknown";
    if (base === "unknown") return { level: "unknown", confidence: 0, evidence: null };
    const reasons = [bloom.level + " cognitive demand"];
    let level = base;
    if (Number.isFinite(marks) && marks >= 10 && level !== "challenging") {
        level = "challenging";
        reasons.push("10 or more marks");
    }
    if (subparts >= 4 && level !== "challenging") {
        level = "challenging";
        reasons.push("four or more response parts");
    }
    return { level, confidence: 0.62, evidence: reasons.join("; ") };
};

const buildAnswerGuidance = ({ text, classification, bloom } = {}) => {
    const source = String(text || "").toLowerCase();
    switch (classification?.type) {
        case "multiple_choice": return "Select the single best option and write its letter. Confirm the correct option against the teacher-approved answer key.";
        case "matching": return "Match each item in the first list or column with its corresponding item in the second. Mark each response slot separately.";
        case "fill_in_the_blanks": return "Supply the missing word or phrase in each blank, preserving the meaning and grammar of the sentence.";
        case "true_false": return "Mark each statement as true or false according to the taught content.";
        case "dictation": return "Transcribe the dictated words or sentences accurately. Apply the teacher's rubric for spelling, word order and punctuation.";
        case "reading_comprehension": return "Answer each item using relevant evidence from the supplied passage. Avoid unsupported information.";
        case "practical": return "Carry out the stated procedure safely, record observations and present the requested results, drawings or labels.";
        case "sequencing": return "Arrange the given items in the requested order and show the sequence clearly.";
        case "word_formation": return "Rearrange or complete the letters to form the correct word, then use it in the requested context.";
        case "activity": return "Complete the stated age-appropriate learner activity. The teacher should confirm the expected response and rubric against the worksheet.";
        case "extended_response": return "Provide a coherent and relevant composition that addresses the prompt. Assess it with the teacher-approved writing rubric.";
    }
    if (/\b(calculate|solve|compute|kokotoa|hesabu)\b/i.test(source)) return "Show the method, relevant working and final answer. Include correct units where required.";
    if (/\b(compare|contrast|linganisha)\b/i.test(source)) return "Present the relevant similarities and differences using clear, paired points.";
    if (/\b(explain|eleza|fafanua)\b/i.test(source)) return "Give clear reasons and explain how or why the stated idea or process occurs.";
    if (/\b(define|fafanua maana ya)\b/i.test(source)) return "Give a clear and accurate definition of the named concept, including its essential distinguishing features.";
    if (/\b(list|state|name|taja|orodhesha)\b/i.test(source)) return "Provide the requested number of distinct, relevant points without repetition.";
    if (bloom?.level === "remembering") return "Give a concise, accurate response based on the taught concept. Confirm subject-specific content with the teacher's marking guide.";
    return "Address the command verb and every printed part of the question. A teacher-approved marking scheme is required for subject-specific answer content.";
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
            const options = Array.isArray(part.options) ? part.options : [];
            const explicitMark = markEvidence[0]?.mark?.value ?? null;
            const childTotal = children.length && children.every(child => Number.isFinite(child.marks))
                ? children.reduce((sum, child) => sum + child.marks, 0)
                : null;
            const marks = explicitMark ?? childTotal;
            const text = [part.text, ...children.map(child => child.text), ...options.map(option => `${option.label}. ${option.text}`), ...evidence.map(item => item.text)].filter(Boolean).join("\n");
            const classification = classifyQuestion(text);
            const curriculum = inferCurriculumTopic({ questionText: text, subjectName: document?.subject || "", level: document?.declared_level || "" });
            const bloom = inferBloomLevel(text);
            const difficulty = estimateDifficulty({ bloom, marks, subparts: children.length });
            return {
                id: part.id,
                printed_label: part.printed_label,
                text: part.text || "",
                marks,
                marks_source: explicitMark != null ? "explicit_subpart_evidence" :
                    (childTotal != null ? "sum_of_explicit_nested_subpart_evidence" : "unknown"),
                mark_evidence: markEvidence.map(item => ({ ...item, value: item.mark.value, matched_text: item.mark.text })),
                classification,
                curriculum,
                topic: curriculum.topic,
                sub_topic: curriculum.sub_topic,
                bloom_level: bloom.level,
                bloom_confidence: bloom.confidence,
                bloom_evidence: bloom.evidence,
                difficulty_level: difficulty.level,
                difficulty_confidence: difficulty.confidence,
                difficulty_evidence: difficulty.evidence,
                answer_expected: buildAnswerGuidance({ text, classification, bloom }),
                options,
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
        const topicText = [question.text, ...subparts.map((part) => part.text)].filter(Boolean).join("\n");
        const classification = classifyQuestion(text);
        const textTokens = text.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter(Boolean);
        const itemTokenIndex = textTokens.findIndex(token => token === "item" || token === "items");
        const romanValues = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15 };
        let rangeCount = 0;
        if (itemTokenIndex >= 0) {
            const startToken = textTokens[itemTokenIndex + 1];
            const nearbyEnd = textTokens.slice(itemTokenIndex + 2, itemTokenIndex + 6).find(token => Number.isFinite(romanValues[token]));
            if (Number.isFinite(romanValues[startToken]) && Number.isFinite(romanValues[nearbyEnd]) && romanValues[nearbyEnd] >= romanValues[startToken]) {
                rangeCount = romanValues[nearbyEnd] - romanValues[startToken] + 1;
            }
        }
        const romanResponseLabels = [...text.matchAll(/^\s*\(?((?:xv|xiv|xiii|xii|xi|x|ix|viii|vii|vi|iv|v|iii|ii|i))\)?[.)]\s+/gim)]
            .map(match => match[1].toLowerCase());
        const printedRomanResponseCount = new Set(romanResponseLabels).size;
        const responseSlotCount = classification.type === "multiple_choice" || classification.type === "matching"
            ? Math.max(subparts.length, rangeCount, printedRomanResponseCount)
            : subparts.length;
        let curriculum = inferCurriculumTopic({ questionText: topicText, subjectName: document?.subject || "", level: document?.declared_level || "" });
        if (document?.subject === "Commerce" && classification.type === "multiple_choice" && subparts.length >= 4) {
            const itemTopics = subparts.map(part => inferCurriculumTopic({
                questionText: part.text,
                subjectName: document?.subject || "",
                level: document?.declared_level || "",
            })).filter(item => item.topic);
            const topicCounts = new Map();
            for (const item of itemTopics) topicCounts.set(item.topic, (topicCounts.get(item.topic) || 0) + 1);
            const dominant = [...topicCounts.entries()].sort((a, b) => b[1] - a[1])[0];
            if (itemTopics.length >= 3 && (!dominant || dominant[1] < 2)) {
                curriculum = {
                    topic: "General Commerce",
                    sub_topic: "Mixed foundational commerce concepts",
                    topic_confidence: 72,
                    topic_evidence: "Multiple-choice items cover several distinct Commerce syllabus topics",
                    topic_source: "mixed_topic_question",
                    topic_alternatives: itemTopics.slice(0, 3).map(item => ({ topic: item.topic, evidence: item.topic_evidence })),
                    curriculum_level: curriculum.curriculum_level,
                };
            }
        }
        const bloom = inferBloomLevel(text);
        const difficulty = estimateDifficulty({ bloom, marks, subparts: subparts.length });

        return {
            id: question.id,
            order: question.order,
            question_number: question.question_number ?? null,
            printed_label: question.printed_label,
            section: question.section,
            text: question.text || "",
            marks,
            marks_source: explicitQuestionMark != null ? "explicit_question_evidence" :
                (subparts.length && subpartMarks != null ? "sum_of_explicit_subpart_evidence" : "unknown"),
            mark_evidence: questionMarkEvidence.map((item) => ({ ...item, value: item.mark.value, matched_text: item.mark.text })),
            mark_confidence: explicitQuestionMark != null ? 1 : (subparts.length && subpartMarks != null ? 1 : 0),
            subparts,
            response_options: Array.isArray(question.response_options) ? question.response_options : [],
            response_slot_count: responseSlotCount,
            unobserved_response_slots: Math.max(0, responseSlotCount - subparts.length),
            classification,
            curriculum,
            topic: curriculum.topic,
            sub_topic: curriculum.sub_topic,
            bloom_level: bloom.level,
            bloom_confidence: bloom.confidence,
            bloom_evidence: bloom.evidence,
            difficulty_level: difficulty.level,
            difficulty_confidence: difficulty.confidence,
            difficulty_evidence: difficulty.evidence,
            answer_expected: buildAnswerGuidance({ text, classification, bloom }),
            evidence: questionEvidence,
        };
    });

    const instructionEvidence = (document?.instructions || []).flatMap((instruction) =>
        uniqueEvidence(instruction.evidence).map((item) => ({ ...item, scope: instruction.scope || "PAPER" }))
    );
    const instructionTexts = new Set(instructionEvidence.map(item => String(item.text || "").trim().toLowerCase()));
    const combinedInstructionText = [
        ...(document?.header_evidence || []).filter(item => item.page === 1),
        ...instructionEvidence.filter(item => item.scope === "PAPER" && item.page === 1),
    ].map(item => String(item.text || "").trim()).filter(Boolean).join(" ");
    const allLines = [
        ...instructionEvidence,
        ...(combinedInstructionText ? [{ text: combinedInstructionText, page: null, line: null, scope: "PAPER" }] : []),
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
        const scope = selection.section_scope || item.scope;
        const available = selection.available ?? (scope !== "PAPER" ? questions.filter(question => question.section === scope).length : null);
        selections.push({ ...selection, scope, available, evidence: { text: item.text, page: item.page, line: item.line } });
    }

    for (const question of questions) {
        const rule = selections.find(item => item.scope === question.section) || selections.find(item => item.scope === "PAPER");
        if (!rule) {
            question.is_selective = false;
            question.selection_required = false;
            question.selection_count = 0;
            question.selection_total = 0;
            question.selection_group = null;
            question.selection_instruction = null;
            continue;
        }
        const selective = rule.mode !== "answer_all";
        const sectionCount = rule.scope === "PAPER"
            ? questions.length
            : questions.filter(item => item.section === question.section).length;
        question.is_selective = selective;
        question.selection_required = selective;
        question.selection_count = selective ? (rule.required ?? 0) : 0;
        question.selection_total = selective ? (rule.available ?? sectionCount) : 0;
        question.selection_group = selective ? rule.scope : null;
        question.selection_instruction = selective ? rule.evidence_text : null;
    }


    // Infer missing question marks from printed section totals, matching the
    // established AI Analysis behaviour while preserving the inference source.
    for (const section of document?.sections || []) {
        const sectionEvidence = uniqueEvidence(section.evidence);
        const sectionMarkEvidence = sectionEvidence
            .map(item => ({ ...item, mark: extractMark(item.text) }))
            .filter(item => item.mark);
        const combinedSectionMark = extractMark(sectionEvidence.map(item => item.text).join(" "));
        const declaredSectionMarks = sectionMarkEvidence[0]?.mark?.value ?? combinedSectionMark?.value ?? null;
        if (!Number.isFinite(declaredSectionMarks)) continue;

        const sectionQuestions = questions.filter(question => question.section === section.name);
        if (!sectionQuestions.length) continue;
        const sectionRule = selections.find(item => item.scope === section.name && item.mode !== "answer_all");
        let knownTotal = sectionQuestions.reduce((sum, question) =>
            sum + (Number.isFinite(question.marks) ? question.marks : 0), 0);

        // Objective one-response-per-item formats have stronger evidence than
        // equal allocation across essay/structured questions.
        for (const question of sectionQuestions) {
            if (Number.isFinite(question.marks)) continue;
            const type = question.classification?.type;
            const itemCount = Number.isFinite(question.response_slot_count) ? question.response_slot_count : (Array.isArray(question.subparts) ? question.subparts.length : 0);
            if ((type === "multiple_choice" || type === "matching") && itemCount > 0) {
                question.marks = itemCount;
                question.marks_source = "inferred_from_response_slots";
                question.mark_confidence = 0.86;
                question.mark_evidence = [
                    ...(question.mark_evidence || []),
                    {
                        text: `${itemCount} detected ${type === "multiple_choice" ? "multiple-choice" : "matching"} response items; one mark per item inferred`,
                        value: itemCount,
                        source: "inferred_from_response_slots",
                        confidence: 0.86,
                    },
                ];
                for (const part of question.subparts) {
                    if (Number.isFinite(part.marks)) continue;
                    part.marks = 1;
                    part.marks_source = "inferred_from_response_slot";
                    part.mark_confidence = 0.86;
                    part.mark_evidence = [
                        ...(part.mark_evidence || []),
                        { text: "One mark per detected objective response item inferred from question structure", value: 1, source: "inferred_from_response_slot", confidence: 0.86 },
                    ];
                }
                knownTotal += itemCount;
                const bloom = { level: question.bloom_level, confidence: question.bloom_confidence, evidence: question.bloom_evidence };
                const difficulty = estimateDifficulty({ bloom, marks: question.marks, subparts: question.subparts.length });
                question.difficulty_level = difficulty.level;
                question.difficulty_confidence = difficulty.confidence;
                question.difficulty_evidence = difficulty.evidence;
            }
        }

        const remainingMarks = Number((declaredSectionMarks - knownTotal).toFixed(4));
        const unmarkedQuestions = sectionQuestions.filter(question => !Number.isFinite(question.marks));
        if (!unmarkedQuestions.length) continue;
        // A single isolated question in a short/partial extract is not enough
        // evidence to assign the entire section total to that question.
        if (sectionQuestions.length === 1 && questions.length < 3 && !sectionRule) continue;
        if (remainingMarks < 0) {
            diagnostics.push({
                code: "SECTION_MARKS_OVERALLOCATED",
                section: section.name,
                declared_total: declaredSectionMarks,
                allocated_total: knownTotal,
                message: "Explicit and response-slot marks exceed the printed section total; remaining marks were not redistributed.",
            });
            continue;
        }

        const requiredAnswers = sectionRule?.required;
        const alreadyMarkedQuestions = sectionQuestions.length - unmarkedQuestions.length;
        const allocationSlots = sectionRule
            ? (Number.isFinite(requiredAnswers) ? requiredAnswers - alreadyMarkedQuestions : 0)
            : unmarkedQuestions.length;
        if (allocationSlots <= 0 || remainingMarks === 0) continue;

        const perQuestionMarks = Number((remainingMarks / allocationSlots).toFixed(4));
        if (!Number.isFinite(perQuestionMarks) || perQuestionMarks < 0) continue;
        const selective = Boolean(sectionRule);
        for (const question of unmarkedQuestions) {
            question.marks = perQuestionMarks;
            question.marks_source = selective ? "inferred_from_selective_section_total" : "inferred_from_section_structure";
            question.mark_confidence = selective ? 0.8 : 0.72;
            question.mark_evidence = [
                ...(question.mark_evidence || []),
                {
                    text: selective
                        ? `Section ${section.name} declares ${declaredSectionMarks} marks and requires ${requiredAnswers} of ${sectionQuestions.length} questions; ${perQuestionMarks} marks per selected question inferred.`
                        : `Section ${section.name} declares ${declaredSectionMarks} marks; after preserving ${knownTotal} known/response-slot marks, the remaining ${remainingMarks} marks are equally distributed across ${unmarkedQuestions.length} unmarked questions.`,
                    value: perQuestionMarks,
                    source: selective ? "inferred_from_selective_section_total" : "inferred_from_section_structure",
                    confidence: selective ? 0.8 : 0.72,
                },
            ];
            const bloom = { level: question.bloom_level, confidence: question.bloom_confidence, evidence: question.bloom_evidence };
            const difficulty = estimateDifficulty({ bloom, marks: question.marks, subparts: question.subparts.length });
            question.difficulty_level = difficulty.level;
            question.difficulty_confidence = difficulty.confidence;
            question.difficulty_evidence = difficulty.evidence;
        }
    }

    // Revisit open-ended response labels after section marks have been
    // allocated from printed totals. The high-mark threshold is never used
    // to invent marks; it only distinguishes extended responses from short
    // structured answers once the allocation evidence exists.
    for (const question of questions) {
        if (question.classification?.type !== "structured_response" ||
            !Number.isFinite(question.marks) || question.marks < 12 ||
            (question.subparts || []).length > 0 ||
            !/\b(explain|elaborate|discuss|justify|argue|describe|outline)\b/i.test(question.text || "")) {
            continue;
        }
        question.classification = {
            type: "extended_response",
            confidence: 0.78,
            reason: "High-mark open-ended prompt with an extended explanatory command detected.",
        };
        question.answer_expected = buildAnswerGuidance({
            text: question.text,
            classification: question.classification,
            bloom: { level: question.bloom_level },
        });
    }

    const sectionTotals = (document?.sections || []).map((section) => {
        const sectionEvidence = uniqueEvidence(section.evidence);
        const markEvidence = sectionEvidence
            .map(item => ({ ...item, mark: extractMark(item.text) }))
            .filter(item => item.mark);
        const combinedSectionText = sectionEvidence.map(item => item.text).join(" ");
        const combinedSectionMark = extractMark(combinedSectionText);
        if (!markEvidence.length && combinedSectionMark) {
            markEvidence.push({ text: combinedSectionText, page: sectionEvidence[0]?.page ?? null, line: sectionEvidence[0]?.line ?? null, mark: combinedSectionMark });
        }
        const declared = markEvidence[0]?.mark?.value ?? null;
        const sectionQuestions = questions.filter(question => question.section === section.name);
        const knownMarks = sectionQuestions.filter(question => Number.isFinite(question.marks));
        const explicitMarks = sectionQuestions.filter(question =>
            question.marks_source === "explicit_question_evidence" ||
            question.marks_source === "sum_of_explicit_subpart_evidence"
        );
        const sectionRule = selections.find(item => item.scope === section.name && item.mode !== "answer_all");
        const allQuestionMarksTotal = sectionQuestions.length && knownMarks.length === sectionQuestions.length
            ? knownMarks.reduce((sum, question) => sum + question.marks, 0)
            : null;
        const explicitQuestionMarksTotal = sectionQuestions.length && explicitMarks.length === sectionQuestions.length
            ? explicitMarks.reduce((sum, question) => sum + question.marks, 0)
            : null;
        const countedQuestions = sectionRule
            ? [...sectionQuestions].sort((a, b) => b.marks - a.marks).slice(0, sectionRule.required ?? sectionQuestions.length)
            : sectionQuestions;
        const calculated = allQuestionMarksTotal == null
            ? null
            : countedQuestions.reduce((sum, question) => sum + question.marks, 0);
        if (declared != null && calculated == null) {
            diagnostics.push({
                code: "SECTION_MARKS_UNALLOCATED",
                section: section.name,
                declared_total: declared,
                message: "A printed section total exists, but the engine could not safely allocate marks from the detected question and selection structure.",
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
            calculated_from_explicit_question_marks: explicitQuestionMarksTotal,
            calculated_from_detected_question_marks: calculated,
            all_detected_question_marks_total: allQuestionMarksTotal,
            selection_applied: Boolean(sectionRule),
            mark_evidence: markEvidence.map(item => ({ text: item.text, page: item.page, line: item.line, value: item.mark.value })),
        };
    });

    for (const rule of selections.filter(item => item.mode !== "answer_all")) {
        const availableCount = rule.scope === "PAPER"
            ? questions.length
            : questions.filter(item => item.section === rule.scope).length;
        if (rule.required != null && rule.available != null && rule.required > rule.available) {
            diagnostics.push({
                code: "INVALID_SELECTION_RULE",
                scope: rule.scope,
                required: rule.required,
                available: rule.available,
                message: "The required answer count exceeds the printed selection pool.",
            });
        }
        if (rule.available != null && rule.available > availableCount) {
            diagnostics.push({
                code: "SELECTION_POOL_MISMATCH",
                scope: rule.scope,
                printed_available: rule.available,
                detected_questions: availableCount,
                message: "The printed selection pool contains more questions than the document model detected.",
            });
        }
    }

    const hasPaperSelection = selections.some(item => item.scope === "PAPER" && item.mode !== "answer_all");
    const hasSectionSelection = selections.some(item => item.scope !== "PAPER" && item.mode !== "answer_all");
    if (hasPaperSelection && hasSectionSelection) {
        diagnostics.push({
            code: "CONFLICTING_SELECTION_RULES",
            message: "Both paper-wide and section-specific selection rules were detected. Effective marks require educator review.",
        });
    }

    const totalMatch = String(sourceText || "").match(/\b(?:total\s+marks?|maximum\s+marks?|max\.?\s+marks?|paper\s+total)\s*[:=-]?\s*(\d+(?:\.\d+)?)/i);
    const sectionDeclaredTotals = sectionTotals
        .map(item => item.declared_total)
        .filter(Number.isFinite);
    const declaredTotal = totalMatch
        ? Number(totalMatch[1])
        : (sectionTotals.length > 0 && sectionDeclaredTotals.length === sectionTotals.length
            ? sectionDeclaredTotals.reduce((sum, value) => sum + value, 0)
            : null);
    const knownQuestionMarks = questions.filter((item) => Number.isFinite(item.marks));
    const explicitQuestionMarks = questions.filter(item =>
        item.marks_source === "explicit_question_evidence" ||
        item.marks_source === "sum_of_explicit_subpart_evidence"
    );
    const calculatedTotal = knownQuestionMarks.length === questions.length && questions.length
        ? knownQuestionMarks.reduce((sum, item) => sum + item.marks, 0)
        : null;
    const explicitCalculatedTotal = explicitQuestionMarks.length === questions.length && questions.length
        ? explicitQuestionMarks.reduce((sum, item) => sum + item.marks, 0)
        : null;
    const inferredMarksTotal = questions
        .filter(item => Number.isFinite(item.marks) && String(item.marks_source || "").startsWith("inferred_"))
        .reduce((sum, item) => sum + item.marks, 0);
    let effectiveCalculatedTotal = null;
    if (questions.length && questions.every(item => Number.isFinite(item.marks))) {
        const paperRule = selections.find(item => item.scope === "PAPER" && item.mode !== "answer_all");
        if (hasPaperSelection && hasSectionSelection) {
            effectiveCalculatedTotal = null;
        } else if (paperRule) {
            const selected = [...questions].sort((a, b) => b.marks - a.marks).slice(0, paperRule.required ?? questions.length);
            effectiveCalculatedTotal = selected.reduce((sum, item) => sum + item.marks, 0);
        } else {
            let effectiveSum = 0;
            for (const section of new Set(questions.map(item => item.section))) {
                const sectionQuestions = questions.filter(item => item.section === section);
                const sectionRule = selections.find(item => item.scope === section && item.mode !== "answer_all");
                const counted = sectionRule
                    ? [...sectionQuestions].sort((a, b) => b.marks - a.marks).slice(0, sectionRule.required ?? sectionQuestions.length)
                    : sectionQuestions;
                effectiveSum += counted.reduce((sum, item) => sum + item.marks, 0);
            }
            effectiveCalculatedTotal = effectiveSum;
        }
    }

    if (questions.some((item) => item.marks == null)) {
        diagnostics.push({
            code: "QUESTION_MARKS_INCOMPLETE",
            message: "One or more questions still have no explicit or safely inferred mark allocation.",
            affected_question_ids: questions.filter((item) => item.marks == null).map((item) => item.id),
        });
    }
    if (declaredTotal != null && effectiveCalculatedTotal != null && declaredTotal !== effectiveCalculatedTotal) {
        diagnostics.push({
            code: "DECLARED_TOTAL_MISMATCH",
            declared_total: declaredTotal,
            calculated_total: effectiveCalculatedTotal,
            message: "The printed paper total does not match the sum of detected question marks.",
        });
    }

    const classified = questions.filter((item) => item.classification.type !== "unclassified").length;
    const markCoverage = questions.length ? knownQuestionMarks.length / questions.length : 0;
    const classificationCoverage = questions.length ? classified / questions.length : 0;
    const topicCoverage = questions.length ? questions.filter(item => item.curriculum?.topic).length / questions.length : 0;
    const confidence = Number((0.4 * markCoverage + 0.35 * classificationCoverage + 0.25 * topicCoverage).toFixed(3));

    return {
        schema_version: "2.0.0",
        questions,
        selection_rules: selections,
        section_totals: sectionTotals,
        totals: {
            declared: declaredTotal,
            calculated_from_explicit_evidence: explicitCalculatedTotal,
            calculated_from_detected_evidence: calculatedTotal,
            inferred_marks_total: Number(inferredMarksTotal.toFixed(4)),
            effective_calculated_total: effectiveCalculatedTotal,
            marks_coverage: Number(markCoverage.toFixed(3)),
        },
        quality: {
            confidence,
            classification_coverage: Number(classificationCoverage.toFixed(3)),
            marks_coverage: Number(markCoverage.toFixed(3)),
            topic_coverage: Number(topicCoverage.toFixed(3)),
            status: confidence >= 0.85 ? "high" : confidence >= 0.6 ? "review_required" : "low_evidence",
        },
        diagnostics,
    };
};

export { classifyQuestion, extractMark, parseSelection };
