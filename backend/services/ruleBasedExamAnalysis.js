const NUMBER_WORDS = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
    fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
    nineteen: 19, twenty: 20, hundred: 100,
    moja: 1, mmoja: 1, moja: 1, mawili: 2, wawili: 2,
    matatu: 3, watatu: 3, manne: 4, wanne: 4,
    matano: 5, watano: 5, sita: 6, saba: 7,
    nane: 8, tisa: 9, kumi: 10,
};

const TOPIC_KEYWORDS = {
    Accounting: ["ledger", "debit", "credit", "journal", "trial balance", "cash book", "financial statement", "capital", "asset", "liability", "profit", "loss", "balance sheet"],
    Commerce: ["trade", "business", "entrepreneur", "market", "commerce", "consumer", "producer", "wholesale", "retail", "banking", "insurance", "transport"],
    Mathematics: ["equation", "calculate", "solve", "factor", "algebra", "geometry", "percentage", "fraction", "probability", "statistics", "ratio", "angle"],
    Biology: ["cell", "organ", "plant", "animal", "photosynthesis", "respiration", "reproduction", "tissue", "organism", "ecosystem", "nutrition"],
    Chemistry: ["chemical", "reaction", "acid", "element", "compound", "molecule", "atom", "periodic", "oxidation", "reduction", "mixture"],
    Physics: ["force", "energy", "motion", "velocity", "acceleration", "mass", "pressure", "electricity", "current", "voltage", "density", "wave"],
    Geography: ["climate", "weather", "erosion", "population", "map", "scale", "river", "mountain", "soil", "vegetation", "environment"],
    History: ["colonial", "independence", "revolution", "war", "civilisation", "civilization", "treaty", "nationalism", "slave trade"],
    "Civics": ["citizen", "government", "constitution", "democracy", "human rights", "election", "leadership", "law", "responsibility"],
    English: ["grammar", "comprehension", "composition", "noun", "verb", "adjective", "tense", "literature", "passage"],
    Kiswahili: ["sarufi", "fasihi", "methali", "nahau", "nomino", "kitenzi", "ufahamu", "insha"],
    "Business Studies": ["business", "entrepreneur", "marketing", "management", "customer", "capital", "enterprise", "trade"],
};

const BLOOM_VERBS = [
    { level: "Creating", verbs: ["design", "construct", "compose", "formulate", "develop", "invent", "prepare a plan"] },
    { level: "Evaluating", verbs: ["evaluate", "assess", "justify", "criticise", "criticize", "recommend", "judge", "defend"] },
    { level: "Analysing", verbs: ["analyse", "analyze", "compare", "contrast", "differentiate", "examine", "distinguish", "investigate"] },
    { level: "Applying", verbs: ["calculate", "solve", "demonstrate", "use", "apply", "illustrate", "show how"] },
    { level: "Understanding", verbs: ["explain", "describe", "summarise", "summarize", "discuss", "interpret", "outline", "classify"] },
    { level: "Remembering", verbs: ["define", "state", "list", "name", "identify", "mention", "what is", "who is"] },
];

const normalize = (value) => String(value || "")
    .replace(/\r/g, "\n")
    // Remove recurring PDF page headers/footers before detecting question numbers.
    .replace(/\bpage\s*\d+\s*of\s*\d+\b/gi, " ")
    .replace(/\b(?:csee|necta|es[e]?e)\s*20\d{2}\b/gi, " ")
    .replace(/[\t ]+/g, " ")
    .replace(/^\s*\d{1,2}\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const isAdministrativeInstruction = (value) => /^(?:(?:this\s+paper\s+)?consists\b|section\s*[a-c]\s+(?:carries|has|contains)\b|answer\s+all\s+questions?\b|answer\s+any\b|answer\s+two\b|jibu\s*maswali\s*yote\b|jibu\s*maswali\s*mawili\b|write\s+your\s+(?:examination|exam)\s+number\b|communication\s*devices\b|all\s*writing\s*must\b|non[- ]programmable\s+calculators?\b|the\s*following\s+constants\b|unauthorized\s+materials\b|do\s+not\s+open\b|cellular\s+phones?\b.*\bnot\s+allowed\b|(?:any\s+)?unauthorized\s+materials?\b.*\bnot\s+allowed\b|(?:candidates?|students?)\s+are\s+not\s+allowed\b)/i.test(String(value || "").trim());
const numberValue = (value) => {
    const token = String(value || "").trim().toLowerCase();
    if (/^\d+(?:\.\d+)?$/.test(token)) return Number(token);
    return NUMBER_WORDS[token] ?? null;
};

const extractMarkValues = (text) => {
    // Normalize common Kiswahili mark notation before applying the existing mark hierarchy.
    const source = String(text || "")
        .replace(/\balama\s*(\d+(?:\.\d+)?)/gi, "$1 marks")
        .replace(/(\d+(?:\.\d+)?)\s*alama\b/gi, "$1 marks")
        .replace(/\bpoints?\s*(\d+(?:\.\d+)?)/gi, "$1 marks")
        .replace(/(\d+(?:\.\d+)?)\s*pts?\b/gi, "$1 marks");
    const markPattern = /(?:\(|\[)?\s*(\d+(?:\.\d+)?)\s*(?:marks?|mks?)\s*(?:\)|\])?/gi;
    const matches = [...source.matchAll(markPattern)];
    if (!matches.length) return 0;

    // Explicit parent totals (including totals printed after the subparts)
    // always take precedence over the sum of sub-question marks.
    const totalPatterns = [
        /(?:total|maximum|question\s+total|in\s+total|jumla(?:\s+ya)?|jumla\s+kuu)\s*(?:of|ya|:)?\s*(\d+(?:\.\d+)?)\s*(?:marks?|mks?)/gi,
        /(?:question\s+)?(?:carries|is\s+worth|has|lina|ina|ni)\s*(?:alama\s*)?(\d+(?:\.\d+)?)\s*(?:marks?|mks?)/gi,
    ];
    for (const pattern of totalPatterns) {
        const totals = [...source.matchAll(pattern)];
        if (totals.length) return Number(totals[totals.length - 1][1]);
    }

    // Identify labelled subparts (a), (b), a), b), etc. A mark token inside
    // a subpart belongs to that subpart; one outside all subparts is a parent
    // question mark and must not be added to its children.
    const labels = [...source.matchAll(/(?:\(\s*(?:iii|ii|iv|vi{0,3}|ix|v|x|[a-i])\s*\)|(?:^|\n)\s*(?:[a-i]|iii|ii|iv|vi{0,3}|ix|v|x)\s*[.)])(?=\s|$)/gim)];
    if (labels.length) {
        // Some papers print a mark value once with an at-sign to mean
        // "for each subpart" (for example, five Roman-numbered parts and
        // "(2 marks @)"). Apply that explicit per-part value to every
        // detected subpart instead of counting the annotation only once.
        const perPartMark = source.match(/(\d+(?:\.\d+)?)\s*(?:marks?|mks?)\s*@/i);
        if (perPartMark && labels.length > 1) {
            return Number(perPartMark[1]) * labels.length;
        }

        const ranges = labels.map((label, index) => ({
            start: label.index,
            end: labels[index + 1]?.index ?? source.length,
        }));
        const childMarks = matches.filter(mark =>
            ranges.some(range => mark.index >= range.start && mark.index < range.end)
        );
        const parentMarks = matches.filter(mark =>
            !ranges.some(range => mark.index >= range.start && mark.index < range.end)
        );

        if (parentMarks.length === 1) return Number(parentMarks[0][1]);
        if (parentMarks.length > 1) {
            // Ambiguous competing parent-level values: do not invent a total.
            return 0;
        }
        if (childMarks.length) {
            return childMarks.reduce((sum, mark) => sum + Number(mark[1]), 0);
        }
    }

    // Without labelled subparts, multiple mark annotations are only summed
    // when no explicit parent-total wording exists.
    return matches.reduce((sum, match) => sum + Number(match[1]), 0);
};

const extractPerQuestionMarks = (text) => {
    const source = String(text || "").replace(/\s+/g, " ");
    const patterns = [
        /\beach\s+(?:main\s+)?question\s+(?:carries|is\s+worth|has|is\s+allocated)\s+(\d+(?:\.\d+)?)\s*(?:marks?|mks?)\b/i,
        /\bkila\s+swali\s+(?:lina|ni)\s+(?:alama\s*)?(\d+(?:\.\d+)?)\s*(?:marks?|mks?)?\b/i,
        /\b(?:all|every)\s+questions?\s+(?:carry|carries|are\s+worth)\s+(\d+(?:\.\d+)?)\s*(?:marks?|mks?)\b/i,
        /\bquestions?\s+(?:carry|are\s+worth)\s+(\d+(?:\.\d+)?)\s*(?:marks?|mks?)\s+each\b/i,
    ];
    for (const pattern of patterns) {
        const match = source.match(pattern);
        if (match) {
            const value = Number(match[1]);
            if (Number.isFinite(value) && value > 0) return value;
        }
    }
    return null;
};

const extractSectionTotal = (text) => {
    const source = String(text || "")
        .replace(/\balama\s*(\d+(?:\.\d+)?)/gi, "$1 marks")
        .replace(/(\d+(?:\.\d+)?)\s*alama\b/gi, "$1 marks");
    const explicitTotal = source.match(/(?:total|jumla(?:\s+ya)?|jumla\s+kuu)\s*(?:of|ya|:)?\s*(\d+(?:\.\d+)?)\s*(?:marks?|mks?)\b/i);
    if (explicitTotal) return Number(explicitTotal[1]);
    const firstMark = source.match(/(\d+(?:\.\d+)?)\s*(?:marks?|mks?)\b/i);
    return firstMark ? Number(firstMark[1]) : null;
};

const detectSelection = (text, availableQuestions = 0, defaultSection = null) => {
    const source = String(text || "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase()
        .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|mawili|matatu|manne|matano|sita|saba|nane|tisa|kumi)\s*\(\s*\d+\s*\)/gi, "$1");
    const token = "(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|moja|mmoja|mawili|wawili|matatu|watatu|manne|wanne|matano|watano|sita|saba|nane|tisa|kumi)";
    // OCR can remove every space from instructions. Recover compact English
    // and Kiswahili selection clauses that name their target section.
    const compact = source.replace(/[^a-z0-9()]/g, "");
    const compactEnglish = compact.match(/(?:answer|attempt|choose|select)?(?:any)?(one|two|three|four|five|six|seven|eight|nine|ten|\d+)(?:\((\d+)\))?questions?(?:from|in|within)section([a-e])/i);
    if (compactEnglish) {
        const count = numberValue(compactEnglish[2] || compactEnglish[1]);
        if (count > 0 && availableQuestions > count) {
            return {
                selection_required: true,
                selection_count: count,
                selection_total: availableQuestions,
                selection_instruction: compactEnglish[0],
                selection_section: compactEnglish[3].toUpperCase(),
            };
        }
    }
    const compactSwahili = compact.match(/(?:jibu(?:ni)?maswali(?:yote)?|maswali)?(moja|mmoja|mawili|wawili|matatu|watatu|manne|wanne|matano|watano|sita|saba|nane|tisa|kumi|\d+)(?:\((\d+)\))?(?:kutoka|katika)(?:sehemu|section)([a-e])/i);
    if (compactSwahili) {
        const count = numberValue(compactSwahili[2] || compactSwahili[1]);
        if (count > 0 && availableQuestions > count) {
            return {
                selection_required: true,
                selection_count: count,
                selection_total: availableQuestions,
                selection_instruction: compactSwahili[0],
                selection_section: compactSwahili[3].toUpperCase(),
            };
        }
    }
    const patterns = [
        { regex: new RegExp("(?:answer|attempt|choose|select|do)\\s+(?:any\\s+)?"+token+"\\s+(?:questions?\\s+)?(?:out of|from)\\s+(?:the\\s+following\\s+)?"+token+"\\b", "i"), count: 1, total: 2 },
        { regex: new RegExp("(?:answer|attempt|choose|select|do)\\s+(?:any\\s+)?"+token+"\\s+questions?\\s+(?:from|in|within)\\s+(?:the\\s+)?section\\s+([a-e])\\b", "i"), count: 1, total: 0, section: 2 },
        { regex: new RegExp("(?:jibu|jibuni|chagua|fanya)\\s+(?:maswali?\\s+)?"+token+"\\s+(?:kutoka|katika)\\s+(?:sehemu|section)\\s+([a-e])\\b", "i"), count: 1, total: 0, section: 2 },
        { regex: new RegExp("(?:answer|attempt|choose|select|do)\\s+(?:any\\s+)?"+token+"\\s+of\\s+(?:the\\s+)?following\\s+"+token+"\\s+questions?\\b", "i"), count: 1, total: 2 },
        { regex: new RegExp("(?:answer|attempt|choose|select|do)\\s+(?:any\\s+)?"+token+"\\s+of\\s+(?:the\\s+)?(?:the\\s+)?questions?\\s+(?:in|from)\\s+(?:this|the)\\s+section\\b", "i"), count: 1, total: 0 },
        { regex: new RegExp("(?:answer|attempt|choose|select|do)\\s+(?:any\\s+)?"+token+"\\s+questions?\\s+(?:in|from)\\s+(?:this|the)\\s+section\\b", "i"), count: 1, total: 0 },
        { regex: new RegExp("(?:answer|attempt|choose|select|do)\\s+(?:any\\s+)?"+token+"\\s+questions?\\s+from\\s+section\\s+[a-e]\\b", "i"), count: 1, total: 0 },
        { regex: new RegExp("(?:answer|attempt|choose|select|do)\\s+(?:any\\s+)?"+token+"\\s+of\\s+the\\s+following\\s+"+token+"\\b", "i"), count: 1, total: 2 },
        { regex: new RegExp("(?:jibu|jibuni|chagua|fanya)\\s+(?:maswali?\\s+)?"+token+"\\s+(?:kati ya|miongoni mwa)\\s+(?:maswali?\\s+)?"+token+"\\b", "i"), count: 1, total: 2 },
        { regex: new RegExp("(?:jibu|jibuni|chagua|fanya)\\s+(?:maswali?\\s+)?"+token+"\\s+ya\\s+(?:maswali?\\s+)?"+token+"\\b", "i"), count: 1, total: 2 },
        { regex: new RegExp("(?:answer|attempt|choose|select|do)\\s+(?:any\\s+)?"+token+"\\s+questions?\\b", "i"), count: 1, total: 0 },
        { regex: new RegExp("(?:jibu|jibuni|chagua|fanya)\\s+(?:maswali?\\s+)?(?:yoyote\\s+)?"+token+"\\s+(?:tu\\s+)?(?:maswali?)?\\b", "i"), count: 1, total: 0 },
        { regex: new RegExp("any\\s+"+token+"\\s+questions?\\b", "i"), count: 1, total: 0 },
    ];

    for (const item of patterns) {
        const match = source.match(item.regex);
        if (!match) continue;
        const selectionCount = numberValue(match[item.count]);
        const statedTotal = item.total ? numberValue(match[item.total]) : null;
        if (!Number.isFinite(selectionCount) || selectionCount <= 0) continue;
        if (statedTotal !== null && (!Number.isFinite(statedTotal) || statedTotal < selectionCount)) continue;

        // A selection instruction can be embedded in a question stem or
        // extracted on a separate line. Use the section's detected main
        // question count when the paper does not print an explicit denominator.
        const effectiveTotal = statedTotal || availableQuestions;
        if (!Number.isFinite(effectiveTotal) || effectiveTotal <= selectionCount) continue;
        return {
            selection_required: true,
            selection_count: selectionCount,
            selection_total: effectiveTotal,
            selection_instruction: match[0],
            selection_section: item.section ? String(match[item.section]).toUpperCase() : defaultSection,
        };
    }

    return {
        selection_required: false,
        selection_count: 0,
        selection_total: 0,
        selection_instruction: null,
    };
};

const extractDeclaredPaperTotal = (text) => {
    const source = String(text || "").replace(/\s+/g, " ");
    const patterns = [
        /\b(?:total|maximum|full)\s+(?:possible\s+)?(?:marks?|score)\s*(?:of|is|are|:|-)?\s*(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\s*(?:marks?|mks?|alama)?\b/i,
        /\b(?:the\s+)?paper\s+(?:carries|is\s+out\s+of|has)\s*(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\s*(?:marks?|mks?|alama)\b/i,
        /\b(?:jumla(?:\s+kuu)?(?:\s+ya)?\s+alama|alama\s+ya\s+jumla)\s*(?:ni|:|-)?\s*(\d+(?:\.\d+)?|moja|mawili|matatu|nne|tano|sita|saba|nane|tisa|kumi|ishirini|thelathini|arobaini|hamsini|sitini|sabini|themanini|tisini|mia)\b/i,
    ];
    const swahiliNumbers = {
        moja: 1, mawili: 2, matatu: 3, nne: 4, tano: 5, sita: 6,
        saba: 7, nane: 8, tisa: 9, kumi: 10, ishirini: 20,
        thelathini: 30, arobaini: 40, hamsini: 50, sitini: 60,
        sabini: 70, themanini: 80, tisini: 90, mia: 100,
    };
    for (const pattern of patterns) {
        const match = source.match(pattern);
        if (!match) continue;
        const token = String(match[1]).toLowerCase();
        const value = numberValue(token) ?? swahiliNumbers[token];
        if (Number.isFinite(value) && value > 0) return value;
    }
    return null;
};

const extractDeclaredQuestionCount = (text) => {
    const source = String(text || "").replace(/\s+/g, " ").toLowerCase();
    const numberToken = "(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)";
    const patterns = [
        new RegExp("(?:consists?\\s+of|contains?|has|comprises?)\\s+(?:a\\s+total\\s+of\\s+)?"+numberToken+"(?:\\s*\\(\\s*(\\d+)\\s*\\))?\\s+(?:main\\s+)?questions?\\b", "i"),
        new RegExp("(?:total|number)\\s+of\\s+questions?\\s*[:=-]?\\s*"+numberToken+"\\b", "i"),
    ];
    for (const pattern of patterns) {
        const match = source.match(pattern);
        if (!match) continue;
        const value = numberValue(match[2] || match[1]);
        if (Number.isInteger(value) && value > 0 && value <= 100) return value;
    }
    return null;
};

const detectSectionHeading = (line) => {
    const match = String(line || "").match(/^\s*(?:SECTION|PART|SEHEMU)\s*([A-E]|[IVX]+|\d+)\b(?:\s*[:.)-]?\s*(.*))?$/i);
    if (!match) return null;
    return { name: String(match[1]).toUpperCase(), title: String(match[2] || "").trim() };
};

const extractNamedSectionTotals = (text) => {
    const totals = new Map();
    const source = String(text || "").replace(/\s+/g, " ");
    const pattern = /\b(?:section|sehemu)\s*([a-z])\b[^.]{0,55}?\(?\s*(\d{1,3})\s*\)?\s*(?:marks?|mks?|alama)\b/gi;
    let match;
    while ((match = pattern.exec(source)) !== null) {
        const name = String(match[1]).toUpperCase();
        const value = Number(match[2]);
        if (value > 0 && !totals.has(name)) totals.set(name, value);
    }
    return totals;
};

const splitPaper = (pdfText) => {
    const normalizedText = normalize(pdfText);
    const lines = normalizedText.split("\n");
    const namedSectionTotals = extractNamedSectionTotals(normalizedText);
    const sections = [];
    const sectionMap = new Map();
    let currentSection = null;
    let currentQuestion = null;

    const ensureSection = (name = "UNSECTIONED", title = "") => {
        const key = String(name).toUpperCase();
        if (!sectionMap.has(key)) {
            const section = { name: key, title, instructionText: [], questions: [] };
            sectionMap.set(key, section);
            sections.push(section);
        }
        return sectionMap.get(key);
    };

    currentSection = ensureSection();
    // Accept both "1. Explain..." and explicit headers such as
    // "QUESTION 1" followed by the question on the next line. Do not treat
    // arbitrary standalone page numbers as questions.
    const questionPattern = /^\s*(\d{1,3})\s*[.)\]:-]\s*(.*)$/i;
    const explicitQuestionHeaderPattern = /^\s*(?:QUESTION|Q)\s*(\d{1,2})\s*[.)\]:-]?\s*(.*)$/i;

    for (const line of lines) {
        const heading = detectSectionHeading(line);
        if (heading) {
            if (currentQuestion) {
                currentQuestion.text = currentQuestion.text.trim();
                currentQuestion = null;
            }
            currentSection = ensureSection(heading.name, heading.title);
            currentSection.instructionText.push(line);
            continue;
        }

        const questionMatch =
            line.match(explicitQuestionHeaderPattern) ||
            line.match(questionPattern);
        if (questionMatch) {
            const questionNumber = Number(questionMatch[1]);
            const questionOpening = String(questionMatch[2] || "").trim();

            // Exam-room instructions and page furniture are not question stems,
            // even when OCR places a question-like number before them.
            if (isAdministrativeInstruction(questionOpening)) {
                if (currentQuestion) currentQuestion.text = currentQuestion.text.trim();
                currentQuestion = null;
                currentSection.instructionText.push(line);
                continue;
            }

            // Repeated numbering across a page break is a continuation, not
            // another question record.
            const existingQuestion = currentSection.questions.find(
                question => question.question_number === questionNumber
            );
            if (existingQuestion) {
                if (currentQuestion) currentQuestion.text = currentQuestion.text.trim();
                currentQuestion = existingQuestion;
                if (questionOpening && !currentQuestion.text.includes(questionOpening)) {
                    currentQuestion.text += (currentQuestion.text ? "\n" : "") + questionOpening;
                }
                continue;
            }

            if (currentQuestion) currentQuestion.text = currentQuestion.text.trim();
            currentQuestion = {
                question_number: questionNumber,
                text: questionOpening,
                section: currentSection.name,
            };
            currentSection.questions.push(currentQuestion);
            continue;
        }

        // OCR often drops the printed "2." before a matching exercise.
        // When a multiple-choice question is followed by a List A/List B
        // matching instruction, recover the next main-question boundary.
        const looksLikeMatchingQuestion = /\blist\s*b\b/i.test(line) &&
            /(?:match|respective|pair|items|terms)/i.test(line);
        const previousLooksLikeObjective = currentQuestion &&
            /(?:correct answer|alternatives|multiple.choice|choose the correct)/i.test(currentQuestion.text);
        if (currentQuestion && !currentSection.name.match(/^[B-Z]$/) &&
            looksLikeMatchingQuestion && previousLooksLikeObjective) {
            currentQuestion.text = currentQuestion.text.trim();
            currentQuestion = {
                question_number: Math.max(0, ...currentSection.questions.map(q => q.question_number)) + 1,
                text: line,
                section: currentSection.name,
            };
            currentSection.questions.push(currentQuestion);
            continue;
        }

        if (isAdministrativeInstruction(line)) {
            if (currentQuestion) currentQuestion.text = currentQuestion.text.trim();
            currentQuestion = null;
            currentSection.instructionText.push(line);
            continue;
        }

        if (currentQuestion) currentQuestion.text += (currentQuestion.text ? "\n" : "") + line;
        else currentSection.instructionText.push(line);
    }

    // Some papers state all section totals in one introductory sentence and
    // omit a standalone "SECTION A" heading. If B/C headings are present and
    // the opening unsectioned block has questions, treat that block as Section A.
    const opening = sectionMap.get("UNSECTIONED");
    if (opening && opening.questions.length &&
        (namedSectionTotals.has("A") || sectionMap.has("A")) &&
        (sectionMap.has("B") || sectionMap.has("C"))) {
        const explicitA = sectionMap.get("A");
        if (explicitA && explicitA !== opening) {
            opening.instructionText.push(...explicitA.instructionText);
            opening.questions.push(...explicitA.questions);
            opening.title = explicitA.title || opening.title;
            const duplicateIndex = sections.indexOf(explicitA);
            if (duplicateIndex >= 0) sections.splice(duplicateIndex, 1);
        }
        opening.name = "A";
        opening.questions.sort((left, right) => left.question_number - right.question_number);
        sectionMap.delete("UNSECTIONED");
        sectionMap.set("A", opening);
    }

    for (const section of sections) {
        section.instructionText = section.instructionText.join("\n");
        section.total_marks = extractSectionTotal(section.instructionText);
        if (namedSectionTotals.has(section.name)) {
            section.total_marks = namedSectionTotals.get(section.name);
        }
        const headingTotal = extractSectionTotal(section.title);
        if (Number(headingTotal) > 0) section.total_marks = headingTotal;
        section.selection = detectSelection(section.instructionText, section.questions.length, section.name);
        section.questions = section.questions.filter(question => question.text.trim());
    }

    const nonEmpty = sections.filter(section => section.questions.length);
    if (!nonEmpty.length) {
        throw new Error("Rule-Based Engine could not detect numbered main questions. Use a text-based PDF with clear question numbering or select AI Analysis (Gemini).");
    }
    return nonEmpty;
};

const inferTopic = (text, subjectName) => {
    const lower = String(text || "").toLowerCase();
    const subject = Object.keys(TOPIC_KEYWORDS).find(key =>
        String(subjectName || "").toLowerCase().includes(key.toLowerCase())
    );
    const dictionary = subject ? { [subject]: TOPIC_KEYWORDS[subject] } : TOPIC_KEYWORDS;
    let best = null;
    for (const [name, words] of Object.entries(dictionary)) {
        const found = words.filter(word => lower.includes(word));
        if (found.length > (best?.matches.length || 0)) best = { name, matches: found };
    }
    return best
        ? {
            topic: best.matches[0].replace(/\b\w/g, character => character.toUpperCase()),
            sub_topic: best.matches.slice(1, 4).join(", ") || null,
        }
        : { topic: null, sub_topic: null };
};

const inferBloom = (text) => {
    const lower = String(text || "").toLowerCase();
    for (const item of BLOOM_VERBS) {
        if (item.verbs.some(verb => lower.includes(verb))) return item.level;
    }
    return "Unknown";
};

const inferDifficulty = (text, marks) => {
    const lower = String(text || "").toLowerCase();
    const complex = ["evaluate", "justify", "analyse", "analyze", "design", "construct", "derive", "prove", "discuss"];
    const simple = ["define", "state", "list", "name", "identify", "mention"];
    if (complex.some(word => lower.includes(word)) || marks >= 15) return "Hard";
    if (simple.some(word => lower.includes(word)) && marks > 0 && marks <= 5) return "Easy";
    return "Medium";
};

const inferQuestionType = (text) => {
    const lower = String(text || "").toLowerCase();
    if (/\b(calculate|solve|compute|find the value|work out)\b/.test(lower)) return "Calculation";
    if (/\b(true or false|multiple choice|choose the correct|tick the correct|fill in the blank)\b/.test(lower)) return "Objective";
    if (/\b(draw|sketch|label the diagram)\b/.test(lower)) return "Diagram";
    if (/\b(explain|describe|discuss|analyse|analyze|compare|evaluate)\b/.test(lower)) return "Structured/Essay";
    return "Short Answer";
};

const countObjectiveItems = (text) => {
    const source = String(text || "");
    const roman = [...source.matchAll(/(?:^|\n)\s*\(?\s*(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)\s*[.)]\s+/gim)];
    return roman.length;
};

const extractPerItemMarks = (text) => {
    const source = String(text || "").replace(/\s+/g, " ").toLowerCase();
    const patterns = [
        /\beach\s+(?:correct\s+)?(?:item|question|response|answer)\s+(?:carries|is\s+worth|gets|earns|has)\s+(\d+(?:\.\d+)?|one|two|three|four|five)\s*(?:marks?|mks?)\b/i,
        /\b(\d+(?:\.\d+)?|one|two|three|four|five)\s*(?:marks?|mks?)\s+(?:for|per)\s+(?:each\s+)?(?:item|question|correct\s+answer)\b/i,
        /\bone\s+mark\s+(?:is\s+)?awarded\s+for\s+each\s+(?:item|correct\s+answer|match)\b/i,
        /\b(\d+(?:\.\d+)?|one|two|three|four|five)\s*(?:marks?|mks?)\s+each\b/i,
        /\beach\s+(?:item|match|correct\s+answer)\s+(?:is\s+)?(\d+(?:\.\d+)?|one|two|three|four|five)\s*(?:marks?|mks?)\b/i,
        /\bkila\s+(?:kipengele|jibu|oanisha)\s+(?:kina|lina|ni)\s+(?:alama\s*)?(moja|mbili|tatu|nne|tano|\d+)\b/i,
        /\b(moja|mbili|tatu|nne|tano|\d+)\s*(?:alama|marks?)\s+kwa\s+kila\s+(?:kipengele|jibu|oanisha)\b/i,
    ];
    for (const pattern of patterns) {
        const match = source.match(pattern);
        if (!match) continue;
        const raw = String(match[1] || "one").trim();
        const value = numberValue(raw) ?? ({ mbili: 2, tatu: 3, nne: 4, tano: 5 }[raw]);
        if (Number.isFinite(value) && value > 0) return value;
    }
    return null;
};

const isObjectiveOrMatching = (text) =>
    /choose.{0,120}correct\s+(?:answer|alternative)|multiple.choice|select.{0,120}correct\s+(?:answer|alternative)|list\s*a[\s\S]{0,700}list\s*b|list\s*b[\s\S]{0,700}list\s*a|kifungu\s*a[\s\S]{0,700}kifungu\s*b|kifungu\s*b[\s\S]{0,700}kifungu\s*a|match.{0,100}(?:list|terms|items|kifungu)/i.test(String(text || ""));

const effectiveMarks = (questions) => {
    const total = new Map();
    const selective = new Map();
    for (const question of questions) {
        const marks = Number(question.max_marks) || 0;
        if (marks <= 0) continue;
        if (!question.selection_required) {
            total.set("Q-" + question.question_number + "-" + question.section, marks);
            continue;
        }
        const group = question.selection_group || ("SECTION-" + question.section);
        if (!selective.has(group)) {
            selective.set(group, {
                count: Math.max(1, Number(question.selection_count) || 1),
                marks: [],
            });
        }
        selective.get(group).marks.push(marks);
    }
    for (const [group, data] of selective) {
        // If optional questions carry different marks, the maximum available
        // score is the sum of the highest-marked required number of options.
        const bestAvailable = data.marks.sort((a, b) => b - a).slice(0, data.count);
        total.set(group, bestAvailable.reduce((sum, value) => sum + value, 0));
    }
    return [...total.values()].reduce((sum, value) => sum + value, 0);
};

export const analyzePaperWithRules = ({
    pdfText,
    subjectName = "Unknown Subject",
    level = "Unknown Level",
    examName = "Examination",
    examType = "",
    curriculum = "",
}) => {
    const text = normalize(pdfText);
    if (text.length < 20) {
        throw new Error("Rule-Based Engine requires readable text in the PDF. This file appears scanned or contains too little extractable text. Choose AI Analysis (Gemini) for scanned papers.");
    }

    const sections = splitPaper(text);
    const questions = [];
    const blooms = {};
    const topics = new Set();
    const recommendations = [];
    let confidenceTotal = 0;

    for (const section of sections) {
        // Selection rules belong to section instructions, not arbitrary question
        // wording (for example, "choose the correct answer" in MCQs).
        const sectionText = section.instructionText + "\n" + section.questions.map(q => q.text).join("\n");
        const localSelection = detectSelection(section.instructionText, section.questions.length, section.name);
        // Introductory instructions may name a later section (e.g. "two
        // questions from Section C"). Apply that rule only to the named section.
        const paperSelection = detectSelection(text, section.questions.length);
        const selection = localSelection.selection_required &&
            (!localSelection.selection_section || localSelection.selection_section === section.name)
            ? localSelection
            : (paperSelection.selection_required && paperSelection.selection_section === section.name
                ? paperSelection
                : section.selection);
        const groupId = selection.selection_required
            ? "SECTION-" + section.name + "-" + selection.selection_count + "-OF-" + (selection.selection_total || section.questions.length)
            : null;

        const pending = [];
        let explicitTotal = 0;
        const explicitQuestionMarks = [];

        for (const source of section.questions) {
            const marks = extractMarkValues(source.text);
            if (marks > 0) {
                explicitTotal += marks;
                explicitQuestionMarks.push(marks);
            }
            const topic = inferTopic(source.text, subjectName);
            const bloom = inferBloom(source.text);
            const question = {
                question_number: source.question_number,
                question_text: source.text.slice(0, 12000),
                section: section.name,
                section_type: section.title || section.name,
                max_marks: marks,
                mark_source: marks > 0 ? "explicit_in_paper" : "uncertain_teacher_confirmation_required",
                mark_evidence: marks > 0 ? "Explicit mark value(s) detected in the question text." : "No explicit mark value was detected for this question.",
                topic: topic.topic,
                sub_topic: topic.sub_topic,
                difficulty_level: inferDifficulty(source.text, marks),
                bloom_level: bloom,
                question_type: inferQuestionType(source.text),
                answer_expected: null,
                ai_confidence: marks > 0 ? 82 : 55,
                ai_explanation: "Rule-Based Engine uses visible wording and structural evidence; semantic interpretation and expected answers require teacher review.",
                is_selective: Boolean(selection.selection_required),
                selection_required: Boolean(selection.selection_required),
                selection_count: selection.selection_required ? selection.selection_count : 0,
                selection_total: selection.selection_required ? (selection.selection_total || section.questions.length) : 0,
                selection_group: groupId,
                selection_instruction: selection.selection_instruction,
            };
            if (topic.topic) topics.add(topic.topic);
            blooms[bloom] = (blooms[bloom] || 0) + 1;
            confidenceTotal += question.ai_confidence;
            if (!marks) pending.push(question);
            questions.push(question);
        }

        if (pending.length && Number(section.total_marks) > 0) {
            const requiredCount = selection.selection_required
                ? Number(selection.selection_count || 0)
                : section.questions.length;
            let inferred = null;
            let evidence = "";
            const perQuestionInstruction = extractPerQuestionMarks(sectionText);
            const objectiveItemCounts = pending.map(question =>
                isObjectiveOrMatching(question.question_text)
                    ? countObjectiveItems(question.question_text)
                    : 0
            );
            const sectionPerItemInstruction = extractPerItemMarks(section.instructionText);
            const objectiveItemMarkValues = pending.map(question =>
                extractPerItemMarks(question.question_text) ?? sectionPerItemInstruction
            );
            const objectiveItemsHavePerItemMarks = pending.length === section.questions.length &&
                objectiveItemCounts.every(count => count > 0) &&
                objectiveItemMarkValues.every(value => value !== null);
            const objectiveItemsTotal = objectiveItemCounts.reduce((sum, count) => sum + count, 0);
            const objectiveItemsReconcile = pending.length === section.questions.length &&
                objectiveItemCounts.every(count => count > 0) &&
                Number(section.total_marks) > 0 &&
                objectiveItemsTotal === Number(section.total_marks);

            if (objectiveItemsHavePerItemMarks) {
                pending.forEach((question, index) => {
                    const perItemInstruction = objectiveItemMarkValues[index];
                    question.max_marks = Number((objectiveItemCounts[index] * perItemInstruction).toFixed(2));
                    question.mark_source = "inferred_from_section_structure";
                    question.mark_evidence = "Inferred from " + objectiveItemCounts[index] +
                        " objective/matching items multiplied by the PDF instruction of " +
                        perItemInstruction + " mark(s) per item.";
                    question.ai_confidence = 82;
                });
            } else if (objectiveItemsReconcile) {
                pending.forEach((question, index) => {
                    question.max_marks = objectiveItemCounts[index];
                    question.mark_source = "inferred_from_section_structure";
                    question.mark_evidence = "The detected objective/matching item counts exactly reconcile with the printed section total; no conflicting per-item mark instruction was detected.";
                    question.ai_confidence = 82;
                });
            } else if (perQuestionInstruction !== null) {
                inferred = perQuestionInstruction;
                evidence = "Applied the explicit section instruction that each question carries " + perQuestionInstruction + " marks.";
            } else if (selection.selection_required && explicitQuestionMarks.length > 0) {
                const uniqueExplicitMarks = [...new Set(explicitQuestionMarks)];
                if (uniqueExplicitMarks.length === 1) {
                    inferred = uniqueExplicitMarks[0];
                    evidence = "Matched the explicit per-question mark value printed for other questions in the same selective section; the section total is retained as a cross-check.";
                }
            } else {
                const remaining = Number(section.total_marks) - explicitTotal;
                const divisor = selection.selection_required
                    ? requiredCount
                    : pending.length;
                if (divisor > 0 && remaining >= 0) {
                    inferred = remaining / divisor;
                    evidence = selection.selection_required
                        ? "Inferred equally from the printed section total and the explicit answer-any selection count."
                        : "Inferred by distributing the remaining printed section marks equally among questions with no explicit marks, after preserving explicit question marks.";
                }
            }

            if (Number.isFinite(inferred) && inferred > 0) {
                for (const question of pending) {
                    question.max_marks = Number(inferred.toFixed(2));
                    question.mark_source = "inferred_from_section_structure";
                    question.mark_evidence = evidence;
                    question.ai_confidence = 72;
                }
            } else {
                recommendations.push("Section " + section.name + " marks could not be allocated reliably from the available explicit marks and section instructions; confirm the marks with the teacher.");
            }
        } else if (pending.length) {
            recommendations.push("Some questions in Section " + section.name + " have no printed marks; teacher confirmation is required.");
        }
    }

    for (const question of questions) {
        if (question.max_marks <= 0) {
            recommendations.push("Confirm the maximum marks for Question " + question.question_number + " in Section " + question.section + ".");
        }
    }

    // Cross-check fully known question allocations against each printed
    // section total. A mismatch is surfaced for teacher review, never silently
    // corrected by changing explicit marks.
    for (const section of sections) {
        if (!(Number(section.total_marks) > 0)) continue;
        const sectionQuestions = questions.filter(question => question.section === section.name);
        if (!sectionQuestions.length || sectionQuestions.some(question => !(Number(question.max_marks) > 0))) continue;

        const selectedQuestions = sectionQuestions.filter(question => question.selection_required);
        const allocated = selectedQuestions.length
            ? selectedQuestions
                .map(question => Number(question.max_marks) || 0)
                .sort((a, b) => b - a)
                .slice(0, Math.max(1, Number(selectedQuestions[0].selection_count) || 1))
                .reduce((sum, value) => sum + value, 0)
            : sectionQuestions.reduce((sum, question) => sum + Number(question.max_marks), 0);
        const declared = Number(section.total_marks);
        if (Math.abs(allocated - declared) > 0.01) {
            recommendations.push(
                "Section " + section.name + " declares " + declared +
                " marks, but the detected question allocation gives " + Number(allocated.toFixed(2)) +
                " marks. Review the printed instructions before approving this marking structure."
            );
        }
    }

    const declaredQuestionCount = extractDeclaredQuestionCount(text);
    if (declaredQuestionCount !== null && declaredQuestionCount !== questions.length) {
        recommendations.push(
            "The paper states " + declaredQuestionCount +
            " main questions, but the Rule-Based Engine detected " + questions.length +
            ". Review possible missed questions, OCR numbering, or sub-question boundaries before approval."
        );
    }

    const allocatedQuestionMarks = effectiveMarks(questions);
    const declaredSectionTotals = sections
        .filter(section => Number(section.total_marks) > 0)
        .map(section => Number(section.total_marks));
    const allSectionsHaveDeclaredTotals = sections.length > 0 &&
        declaredSectionTotals.length === sections.length;
    const declaredSectionsTotal = allSectionsHaveDeclaredTotals
        ? declaredSectionTotals.reduce((sum, value) => sum + value, 0)
        : null;
    const allQuestionsHaveMarks = questions.length > 0 &&
        questions.every(question => Number(question.max_marks) > 0);
    const declaredTotalIsWithinSmallTolerance = declaredSectionTotals !== null &&
        Math.abs(declaredSectionsTotal - allocatedQuestionMarks) <= 2;
    // Keep the printed total when question marks remain unknown or the
    // difference is small. If every question is marked and the discrepancy
    // is material, report the complete question allocation and flag the mismatch.
    const totalMarks = declaredSectionTotals !== null &&
        (!allQuestionsHaveMarks || declaredTotalIsWithinSmallTolerance)
        ? declaredSectionsTotal
        : allocatedQuestionMarks;
    if (declaredSectionTotals !== null &&
        Math.abs(declaredSectionsTotal - allocatedQuestionMarks) > 0.01) {
        recommendations.push(
            "The printed section totals add up to " + Number(declaredSectionsTotal.toFixed(2)) +
            " marks, while the detected question allocation gives " +
            Number(allocatedQuestionMarks.toFixed(2)) +
            " marks. The reported paper total follows " +
            (totalMarks === declaredSectionsTotal ? "the printed section totals" : "the complete detected question allocation") +
            "; review the difference before approval."
        );
    }
    const sectionOutput = sections.map(section => {
        const sectionQuestions = questions.filter(q => q.section === section.name);
        const selection = sectionQuestions.find(q => q.selection_required);
        return {
            section: section.name,
            name: section.name,
            title: section.title || section.name,
            marks: section.total_marks,
            total_marks: section.total_marks,
            question_count: sectionQuestions.length,
            selection_required: Boolean(selection),
            selection_count: selection?.selection_count || 0,
            selection_total: selection?.selection_total || 0,
        };
    });

    if (!recommendations.length) recommendations.push("Structural analysis completed. Teacher should review topic, Bloom level, difficulty and marking interpretation before approval.");
    const explicitPaperTotal = extractDeclaredPaperTotal(text);
    if (explicitPaperTotal !== null && totalMarks > 0 &&
        Math.abs(explicitPaperTotal - totalMarks) > 0.01) {
        recommendations.push(
            "The paper explicitly states " + explicitPaperTotal +
            " total marks, but section/question reconciliation gives " +
            Number(totalMarks.toFixed(2)) +
            ". The printed paper total is displayed as the declared total; verify the missing or conflicting marks before approval."
        );
    }
    const averageConfidence = questions.length ? Math.round(confidenceTotal / questions.length) : 0;
    const difficultyCounts = questions.reduce((acc, q) => {
        acc[q.difficulty_level] = (acc[q.difficulty_level] || 0) + 1;
        return acc;
    }, {});
    const hardCount = difficultyCounts.Hard || 0;
    const overallDifficulty = hardCount / Math.max(questions.length, 1) >= 0.4 ? "Hard" : (difficultyCounts.Easy || 0) / Math.max(questions.length, 1) >= 0.6 ? "Easy" : "Medium";

    return {
        summary: "Rule-Based structural analysis for " + subjectName + " (" + level + "). " + questions.length + " main questions were detected.",
        subject: subjectName,
        level,
        exam_name: examName,
        exam_type: examType,
        curriculum,
        total_questions: questions.length,
        // A printed paper total is evidence, not a replacement for a
        // contradictory section/question reconciliation. Only use it when
        // the structural calculation is unavailable or agrees with it.
        total_marks: explicitPaperTotal !== null &&
            (totalMarks <= 0 || Math.abs(explicitPaperTotal - totalMarks) <= 0.01)
            ? explicitPaperTotal
            : totalMarks,
        difficulty: overallDifficulty,
        quality_score: Math.min(100, Math.round(45 + Math.min(questions.length, 10) * 4 + averageConfidence / 5)),
        syllabus_coverage: topics.size ? Math.min(100, topics.size * 15) : 0,
        sections: sectionOutput,
        topics_found: [...topics],
        weak_topics: [],
        strong_topics: [],
        recommendations: [...new Set(recommendations)],
        teacher_comments: "Rule-Based Engine does not generate expected answers. Review uncertain marks and all semantic classifications against the original paper before approval.",
        blooms_distribution: blooms,
        questions,
    };
};

export default analyzePaperWithRules;