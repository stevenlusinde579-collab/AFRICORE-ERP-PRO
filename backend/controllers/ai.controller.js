import crypto from "crypto";
import { supabase } from "../config/supabase.js";
import { readPDF } from "../services/pdfReader.js";
import { askGemini } from "../services/gemini.service.js";

// ============================================================
// AI ANALYSIS LOCKS
// ============================================================

const analysisLocks = new Map();

const ANALYSIS_LOCK_TIMEOUT =
    15 * 60 * 1000;

const getAnalysisKey = (
    examId,
    examSubjectId
) =>
    `${Number(examId)}:${Number(examSubjectId)}`;

const lockAnalysis = (
    examId,
    examSubjectId
) => {
    const key =
        getAnalysisKey(
            examId,
            examSubjectId
        );

    const existing =
        analysisLocks.get(key);

    if (existing) {
        if (
            Date.now() -
                existing.startedAt <
            ANALYSIS_LOCK_TIMEOUT
        ) {
            return false;
        }

        analysisLocks.delete(key);
    }

    analysisLocks.set(key, {
        startedAt: Date.now(),
    });

    return true;
};

const unlockAnalysis = (
    examId,
    examSubjectId
) => {
    const key =
        getAnalysisKey(
            examId,
            examSubjectId
        );

    analysisLocks.delete(key);
};

// ============================================================
// TIMEOUT
// ============================================================

const withTimeout = (
    promise,
    milliseconds,
    message
) => {
    let timeoutId;

    const timeoutPromise =
        new Promise(
            (_, reject) => {
                timeoutId =
                    setTimeout(() => {
                        const error =
                            new Error(
                                message
                            );

                        error.code =
                            "OPERATION_TIMEOUT";

                        reject(error);
                    }, milliseconds);
            }
        );

    return Promise.race([
        Promise.resolve(
            promise
        ).finally(() => {
            clearTimeout(
                timeoutId
            );
        }),
        timeoutPromise,
    ]);
};

// ============================================================
// BASIC HELPERS
// ============================================================

const textOrNull = (
    value
) => {
    if (
        value === undefined ||
        value === null
    ) {
        return null;
    }

    const text =
        String(value).trim();

    return text || null;
};

const integerOrZero = (
    value
) => {
    const number =
        Number(value);

    return Number.isInteger(
        number
    )
        ? number
        : 0;
};

const numberOrNull = (
    value
) => {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return null;
    }

    const number =
        Number(value);

    return Number.isFinite(
        number
    )
        ? number
        : null;
};

const normalizeBoolean = (
    value
) => {
    if (
        value === true ||
        value === 1 ||
        value === "1" ||
        value === "true" ||
        value === "TRUE" ||
        value === "yes" ||
        value === "YES"
    ) {
        return true;
    }

    return false;
};

const normalizeMaxMarks = (
    value
) => {
    const number =
        Number(value);

    if (
        !Number.isFinite(
            number
        )
    ) {
        return 0;
    }

    return number;
};

const errorDetails = (
    error
) => ({
    message:
        error?.message ||
        null,

    code:
        error?.code ||
        null,

    status:
        error?.status ||
        error?.statusCode ||
        null,

    details:
        error?.details ||
        null,

    hint:
        error?.hint ||
        null,
});

const throwSupabaseError = (
    error,
    fallbackMessage
) => {
    if (!error) {
        return;
    }

    const supabaseError =
        new Error(
            error.message ||
                fallbackMessage
        );

    supabaseError.code =
        error.code ||
        null;

    supabaseError.status =
        error.status ||
        500;

    supabaseError.details =
        error.details ||
        null;

    supabaseError.hint =
        error.hint ||
        null;

    throw supabaseError;
};

// ============================================================
// FILE HASH
// ============================================================

const calculateFileHash = (
    buffer
) =>
    crypto
        .createHash(
            "sha256"
        )
        .update(buffer)
        .digest("hex");

// ============================================================
// JSON CLEANING
// ============================================================

const normalizeAIJsonCharacters =
    (value) => {
        if (
            typeof value !==
            "string"
        ) {
            return value;
        }

        return value
            .replace(
                /[\u2018\u2019]/g,
                "'"
            )
            .replace(
                /[\u201C\u201D]/g,
                '"'
            )
            .replace(
                /\u00A0/g,
                " "
            )
            .replace(
                /\uFEFF/g,
                ""
            );
    };

const stripMarkdownJson = (
    value
) => {
    let text =
        normalizeAIJsonCharacters(
            value
        );

    text =
        text.trim();

    text =
        text.replace(
            /^```(?:json)?\s*/i,
            ""
        );

    text =
        text.replace(
            /\s*```$/i,
            ""
        );

    return text.trim();
};

const extractCompleteJsonValue =
    (text) => {
        const source =
            String(
                text || ""
            ).trim();

        if (!source) {
            return "";
        }

        const firstObject =
            source.indexOf("{");

        const firstArray =
            source.indexOf("[");

        let start = -1;

        if (
            firstObject === -1
        ) {
            start =
                firstArray;
        } else if (
            firstArray === -1
        ) {
            start =
                firstObject;
        } else {
            start =
                Math.min(
                    firstObject,
                    firstArray
                );
        }

        if (
            start < 0
        ) {
            return source;
        }

        const opening =
            source[start];

        const closing =
            opening === "{"
                ? "}"
                : "]";

        let depth = 0;
        let inString = false;
        let escaped = false;

        for (
            let index = start;
            index < source.length;
            index++
        ) {
            const character =
                source[index];

            if (inString) {
                if (escaped) {
                    escaped = false;
                    continue;
                }

                if (
                    character === "\\"
                ) {
                    escaped = true;
                    continue;
                }

                if (
                    character === '"'
                ) {
                    inString = false;
                }

                continue;
            }

            if (
                character === '"'
            ) {
                inString = true;
                continue;
            }

            if (
                character === opening
            ) {
                depth++;
            } else if (
                character === closing
            ) {
                depth--;

                if (
                    depth === 0
                ) {
                    return source.slice(
                        start,
                        index + 1
                    );
                }
            }
        }

        return source.slice(
            start
        );
    };

const repairCommonAIJsonErrors =
    (value) => {
        let text =
            String(value || "");

        text =
            text.replace(
                /,\s*([}\]])/g,
                "$1"
            );

        text =
            text.replace(
                /:\s*undefined\b/g,
                ": null"
            );

        text =
            text.replace(
                /:\s*NaN\b/g,
                ": null"
            );

        text =
            text.replace(
                /([{[]\s*)'([A-Za-z_$][\w$]*)'\s*:/g,
                '$1"$2":'
            );

        return text;
    };

const parseAIResult = (
    aiRawResponse
) => {
    let rawText;

    if (
        typeof aiRawResponse ===
        "string"
    ) {
        rawText =
            aiRawResponse;
    } else if (
        aiRawResponse?.text
    ) {
        rawText =
            aiRawResponse.text;
    } else if (
        aiRawResponse?.response
    ) {
        rawText =
            typeof aiRawResponse.response ===
            "string"
                ? aiRawResponse.response
                : JSON.stringify(
                    aiRawResponse.response
                );
    } else {
        rawText =
            JSON.stringify(
                aiRawResponse
            );
    }

    rawText =
        stripMarkdownJson(
            rawText
        );

    let jsonText =
        extractCompleteJsonValue(
            rawText
        );

    jsonText =
        repairCommonAIJsonErrors(
            jsonText
        );

    try {
        return JSON.parse(
            jsonText
        );
    } catch (
        firstError
    ) {
        try {
            const cleaned =
                jsonText.replace(
                    /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,
                    ""
                );

            return JSON.parse(
                cleaned
            );
        } catch (
            secondError
        ) {
            const error =
                new Error(
                    "Gemini returned an invalid JSON examination analysis."
                );

            error.code =
                "INVALID_AI_JSON";

            error.details = {
                firstError:
                    firstError.message,

                secondError:
                    secondError.message,

                responsePreview:
                    rawText.slice(
                        0,
                        2000
                    ),
            };

            throw error;
        }
    }
};

// ============================================================
// DISPLAY HELPERS
// ============================================================

const getDisplayName = (
    value
) => {
    if (!value) {
        return null;
    }

    if (
        typeof value ===
        "string"
    ) {
        return (
            value.trim() ||
            null
        );
    }

    return (
        value.name ||
        value.subject_name ||
        value.title ||
        value.display_name ||
        value.label ||
        null
    );
};

// ============================================================
// PDF HELPERS
// ============================================================

const normalizePdfText = (
    value
) => {
    return String(
        value || ""
    )
        .replace(
            /\r\n/g,
            "\n"
        )
        .replace(
            /\r/g,
            "\n"
        )
        .replace(
            /[ \t]+/g,
            " "
        )
        .replace(
            /\n{3,}/g,
            "\n\n"
        )
        .trim();
};

const numberWords = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
    twenty: 20,
};

const parseNumberToken = (
    value
) => {
    if (
        value === undefined ||
        value === null
    ) {
        return null;
    }

    const text =
        String(value)
            .trim()
            .toLowerCase();

    const numeric =
        Number(
            text.replace(
                /,/g,
                ""
            )
        );

    if (
        Number.isFinite(
            numeric
        )
    ) {
        return numeric;
    }

    if (
        Object.prototype.hasOwnProperty.call(
            numberWords,
            text
        )
    ) {
        return numberWords[
            text
        ];
    }

    return null;
};

// ============================================================
// PDF STRUCTURAL EVIDENCE
// ============================================================

const extractSectionTotals = (
    pdfText
) => {
    const sections = [];

    const patterns = [
        {
            name: "A",
            regex:
                /(?:SECTION|PART)\s*A[\s\S]{0,180}?\b(\d+(?:\.\d+)?)\s*MARKS?\b/i,
        },
        {
            name: "B",
            regex:
                /(?:SECTION|PART)\s*B[\s\S]{0,180}?\b(\d+(?:\.\d+)?)\s*MARKS?\b/i,
        },
        {
            name: "C",
            regex:
                /(?:SECTION|PART)\s*C[\s\S]{0,180}?\b(\d+(?:\.\d+)?)\s*MARKS?\b/i,
        },
        {
            name: "D",
            regex:
                /(?:SECTION|PART)\s*D[\s\S]{0,180}?\b(\d+(?:\.\d+)?)\s*MARKS?\b/i,
        },
        {
            name: "E",
            regex:
                /(?:SECTION|PART)\s*E[\s\S]{0,180}?\b(\d+(?:\.\d+)?)\s*MARKS?\b/i,
        },
    ];

    for (
        const item of patterns
    ) {
        const match =
            pdfText.match(
                item.regex
            );

        if (match) {
            const marks =
                parseNumberToken(
                    match[1]
                );

            if (
                marks !== null &&
                marks > 0
            ) {
                sections.push({
                    section:
                        item.name,

                    marks,
                });
            }
        }
    }

    return sections;
};

const extractExpectedQuestionCount =
    (pdfText) => {
        const patterns = [
            /\banswer\s+(?:all|the)\s+(\d+)\s+questions?\b/i,
            /\battempt\s+(?:all|the)\s+(\d+)\s+questions?\b/i,
            /\b(\d+)\s+questions?\s+(?:are\s+)?required\b/i,
            /\btotal\s+(?:of\s+)?(\d+)\s+questions?\b/i,
            /\bthere\s+are\s+(\d+)\s+questions?\b/i,
        ];

        for (
            const regex of patterns
        ) {
            const match =
                pdfText.match(
                    regex
                );

            if (match) {
                const count =
                    Number(
                        match[1]
                    );

                if (
                    Number.isInteger(
                        count
                    ) &&
                    count > 0
                ) {
                    return count;
                }
            }
        }

        return 0;
    };

const extractGlobalSelection = (
    pdfText
) => {
    const patterns = [
        /answer\s+any\s+(\d+)\s+out\s+of\s+(\d+)/i,
        /attempt\s+any\s+(\d+)\s+out\s+of\s+(\d+)/i,
        /choose\s+any\s+(\d+)\s+from\s+(\d+)/i,
        /answer\s+(\d+)\s+questions?\s+from\s+(\d+)/i,
    ];

    for (
        const regex of patterns
    ) {
        const match =
            pdfText.match(
                regex
            );

        if (match) {
            const required =
                Number(
                    match[1]
                );

            const available =
                Number(
                    match[2]
                );

            if (
                Number.isInteger(
                    required
                ) &&
                Number.isInteger(
                    available
                ) &&
                required > 0 &&
                available > 0 &&
                required <=
                    available
            ) {
                return {
                    required,
                    available,
                    source:
                        match[0],
                };
            }
        }
    }

    return null;
};

const extractQuestionBlocks = (
    pdfText
) => {
    const lines =
        String(
            pdfText || ""
        )
            .split("\n")
            .map(
                (line) =>
                    line.trim()
            )
            .filter(
                Boolean
            );

    const questionRegex =
        /^\s*(?:question\s*)?(\d{1,3})\s*[.)\-:]\s*(.*)$/i;

    const questions = [];

    let current = null;

    for (
        const line of lines
    ) {
        const match =
            line.match(
                questionRegex
            );

        if (match) {
            if (current) {
                questions.push(
                    current
                );
            }

            current = {
                question_number:
                    Number(
                        match[1]
                    ),

                text:
                    match[2] ||
                    "",
            };

            continue;
        }

        if (current) {
            current.text =
                `${current.text} ${line}`.trim();
        }
    }

    if (current) {
        questions.push(
            current
        );
    }

    return questions;
};

// ============================================================
// GEMINI PROMPT
// ============================================================

const buildExamAnalysisPrompt =
    ({
        pdfText,
        structuralQuestions,
        subjectName,
        level,
        examName,
    }) => {
        const structuralEvidence =
            structuralQuestions
                .map(
                    (question) =>
                        `Q${question.question_number}: ${question.text}`
                )
                .join("\n");

        return `
You are analyzing a complete examination paper.

EXAMINATION:
${examName}

SUBJECT:
${subjectName}

LEVEL:
${level}

IMPORTANT:
Analyze the WHOLE examination paper.

Do not invent questions, marks, answers, sections, topics, or selection rules.

A main examination question must remain ONE question even if it contains subparts such as:
(a), (b), (c), (i), (ii), etc.

Do NOT convert every subpart into a separate main question.

Use the printed examination paper as the primary evidence.

Determine marks from the actual paper whenever possible.

If a mark value is not explicitly visible, infer it only when the structure of the paper provides strong evidence.

Never invent arbitrary marks.

If a question is selective, preserve the exact selection structure.

For example:

"Answer any 2 out of 3 questions, each carrying 10 marks"

means:
selection_required = true
selection_count = 2
selection_total = 3
selection_group = the relevant group
and the effective contribution is 20 marks.

Do not treat the printed 30 marks as the effective student-answer total.

RETURN STRICT JSON ONLY.

Do not wrap the JSON in markdown.

Expected JSON structure:

{
  "summary": "",
  "total_questions": 0,
  "total_marks": 0,
  "difficulty": "",
  "quality_score": 0,
  "syllabus_coverage": 0,
  "sections": [],
  "topics_found": [],
  "weak_topics": [],
  "strong_topics": [],
  "recommendations": [],
  "teacher_comments": "",
  "blooms_distribution": {},
  "questions": [
    {
      "question_number": 1,
      "question_text": "",
      "section": "",
      "section_type": "",
      "max_marks": 0,
      "mark_source": "",
      "mark_evidence": "",
      "topic": "",
      "sub_topic": "",
      "difficulty_level": "",
      "bloom_level": "",
      "question_type": "",
      "answer_expected": "",
      "ai_confidence": 0,
      "ai_explanation": "",
      "is_selective": false,
      "selection_required": false,
      "selection_count": 0,
      "selection_total": 0,
      "selection_group": "",
      "selection_instruction": ""
    }
  ]
}

The question_text must represent the complete main question.

The answer_expected field should contain the expected answer or marking expectation when it can reasonably be determined from the paper. Do not fabricate an answer when the paper does not provide enough evidence.

The AI confidence must be between 0 and 100.

SECTION ANALYSIS:
Identify section names and section totals from the actual paper.

QUESTION NUMBERING:
Preserve the actual main-question numbering.

SELECTION:
Detect explicit instructions such as:
- Answer any 2 out of 3
- Attempt any 4 questions
- Choose any 3 from Section C
- Answer all questions
- Attempt all questions

If no selection is present, set:
is_selective = false
selection_required = false
selection_count = 0
selection_total = 0

STRUCTURAL EVIDENCE EXTRACTED FROM PDF:

${structuralEvidence || "No reliable structural question list was extracted."}

FULL PDF TEXT:

${pdfText}
`;
    };

// ============================================================
// AI QUESTION NORMALIZATION
// ============================================================

const normalizeAIQuestion = (
    question,
    index
) => {
    const questionNumber =
        Number(
            question?.question_number
        );

    const maxMarks =
        normalizeMaxMarks(
            question?.max_marks
        );

    const selectionCount =
        integerOrZero(
            question?.selection_count
        );

    const selectionTotal =
        integerOrZero(
            question?.selection_total
        );

    const isSelective =
        normalizeBoolean(
            question?.is_selective
        );

    const selectionRequired =
        normalizeBoolean(
            question?.selection_required
        ) ||
        isSelective;

    return {
        question_number:
            Number.isInteger(
                questionNumber
            ) &&
            questionNumber > 0
                ? questionNumber
                : index + 1,

        question_text:
            textOrNull(
                question?.question_text
            ) ||
            `Question ${index + 1}`,

        section:
            textOrNull(
                question?.section
            ),

        section_type:
            textOrNull(
                question?.section_type
            ),

        max_marks:
            maxMarks,

        mark_source:
            textOrNull(
                question?.mark_source
            ),

        mark_evidence:
            textOrNull(
                question?.mark_evidence
            ),

        topic:
            textOrNull(
                question?.topic
            ),

        sub_topic:
            textOrNull(
                question?.sub_topic
            ),

        difficulty_level:
            textOrNull(
                question?.difficulty_level
            ) ||
            "Unknown",

        bloom_level:
            textOrNull(
                question?.bloom_level
            ) ||
            "Unknown",

        question_type:
            textOrNull(
                question?.question_type
            ) ||
            "Unknown",

        answer_expected:
            textOrNull(
                question?.answer_expected
            ),

        ai_confidence:
            Math.max(
                0,
                Math.min(
                    100,
                    numberOrNull(
                        question?.ai_confidence
                    ) ?? 0
                )
            ),

        ai_explanation:
            textOrNull(
                question?.ai_explanation
            ),

        is_selective:
            isSelective,

        selection_required:
            selectionRequired,

        selection_count:
            selectionCount,

        selection_total:
            selectionTotal,

        selection_group:
            textOrNull(
                question?.selection_group
            ),

        selection_instruction:
            textOrNull(
                question?.selection_instruction
            ),
    };
};

// ============================================================
// TEXTUAL SELECTION EVIDENCE
// ============================================================

const applyTextualSelectionEvidence = (
    questions,
    globalSelection
) => {
    if (
        !Array.isArray(
            questions
        )
    ) {
        return [];
    }

    if (
        !globalSelection
    ) {
        return questions;
    }

    const {
        required,
        available,
        source,
    } =
        globalSelection;

    return questions.map(
        (question) => {
            const text =
                `${question.question_text || ""} ${
                    question.selection_instruction || ""
                }`;

            const hasSelectionText =
                /answer\s+any|attempt\s+any|choose\s+any|select\s+any/i.test(
                    text
                );

            if (
                hasSelectionText
            ) {
                return {
                    ...question,

                    is_selective:
                        true,

                    selection_required:
                        true,

                    selection_count:
                        question.selection_count ||
                        required,

                    selection_total:
                        question.selection_total ||
                        available,

                    selection_group:
                        question.selection_group ||
                        `GLOBAL-${required}-OF-${available}`,

                    selection_instruction:
                        question.selection_instruction ||
                        source,
                };
            }

            return question;
        }
    );
};

// ============================================================
// SELECTIVE VALIDATION
// ============================================================

const validateSelectiveQuestions = (
    questions
) => {
    const problems = [];

    for (
        const question of
            questions
    ) {
        const isSelective =
            Boolean(
                question.is_selective
            );

        const selectionRequired =
            Boolean(
                question.selection_required
            );

        const selectionCount =
            integerOrZero(
                question.selection_count
            );

        const selectionTotal =
            integerOrZero(
                question.selection_total
            );

        if (
            isSelective ||
            selectionRequired
        ) {
            if (
                selectionCount <=
                0
            ) {
                problems.push(
                    `Q${question.question_number}: selection_count must be greater than zero`
                );
            }

            if (
                selectionTotal <=
                0
            ) {
                problems.push(
                    `Q${question.question_number}: selection_total must be greater than zero`
                );
            }

            if (
                selectionCount >
                selectionTotal
            ) {
                problems.push(
                    `Q${question.question_number}: selection_count cannot exceed selection_total`
                );
            }
        }
    }

    return {
        valid:
            problems.length ===
            0,

        problems,
    };
};

// ============================================================
// SECTION MARK VALIDATION
// ============================================================

const validateSectionMarks = ({
    questions,
    aiSections,
    pdfText,
}) => {
    const problems = [];

    const sections =
        Array.isArray(
            aiSections
        )
            ? aiSections
            : [];

    const pdfTotals =
        extractSectionTotals(
            pdfText
        );

    if (
        pdfTotals.length ===
        0
    ) {
        return {
            valid: true,
            problems: [],
        };
    }

    for (
        const pdfSection of
            pdfTotals
    ) {
        const matchingQuestions =
            questions.filter(
                (question) =>
                    String(
                        question.section ||
                            ""
                    )
                        .trim()
                        .toUpperCase()
                        .includes(
                            String(
                                pdfSection.section
                            )
                                .trim()
                                .toUpperCase()
                        )
            );

        if (
            matchingQuestions.length ===
            0
        ) {
            continue;
        }

        const questionMarks =
            matchingQuestions.reduce(
                (
                    total,
                    question
                ) =>
                    total +
                    normalizeMaxMarks(
                        question.max_marks
                    ),
                0
            );

        const hasSelective =
            matchingQuestions.some(
                (
                    question
                ) =>
                    question.is_selective ||
                    question.selection_required
            );

        if (
            hasSelective
        ) {
            continue;
        }

        if (
            Math.abs(
                questionMarks -
                    Number(
                        pdfSection.marks
                    )
            ) >
            0.01
        ) {
            problems.push(
                `Section ${pdfSection.section}: PDF indicates ${pdfSection.marks} marks but AI questions total ${questionMarks} marks`
            );
        }
    }

    if (
        sections.length >
        0
    ) {
        for (
            const section of
                sections
        ) {
            if (
                typeof section !==
                "object"
            ) {
                continue;
            }

            const name =
                textOrNull(
                    section.section ||
                        section.name ||
                        section.title
                );

            const marks =
                numberOrNull(
                    section.marks ||
                        section.total_marks ||
                        section.max_marks
                );

            if (
                !name ||
                marks ===
                    null
            ) {
                continue;
            }

            const matching =
                pdfTotals.find(
                    (item) =>
                        String(
                            item.section
                        )
                            .toUpperCase() ===
                        String(
                            name
                        )
                            .trim()
                            .toUpperCase()
                );

            if (
                matching &&
                Math.abs(
                    Number(
                        matching.marks
                    ) -
                        Number(
                            marks
                        )
                ) >
                    0.01
            ) {
                problems.push(
                    `Section ${name}: AI reported ${marks} marks while PDF evidence indicates ${matching.marks} marks`
                );
            }
        }
    }

    return {
        valid:
            problems.length ===
            0,

        problems,
    };
};

// ============================================================
// EFFECTIVE MARK CALCULATIONS
// ============================================================

const calculateEffectiveSectionMarks =
    (
        questions
    ) => {
        const groups =
            new Map();

        for (
            const question of
                questions
        ) {
            const marks =
                normalizeMaxMarks(
                    question.max_marks
                );

            if (
                marks <= 0
            ) {
                continue;
            }

            if (
                !question.is_selective &&
                !question.selection_required
            ) {
                const key =
                    `QUESTION-${question.question_number}`;

                groups.set(
                    key,
                    marks
                );

                continue;
            }

            const group =
                question.selection_group ||
                `SELECTIVE-${question.section || "UNKNOWN"}-${question.selection_count}-${question.selection_total}`;

            if (
                !groups.has(
                    group
                )
            ) {
                const count =
                    integerOrZero(
                        question.selection_count
                    );

                const effectiveMarks =
                    count > 0
                        ? marks * count
                        : marks;

                groups.set(
                    group,
                    effectiveMarks
                );
            }
        }

        return Array.from(
            groups.values()
        ).reduce(
            (
                total,
                marks
            ) =>
                total + marks,
            0
        );
    };

const calculateEffectiveTotalMarks =
    (
        questions
    ) =>
        calculateEffectiveSectionMarks(
            questions
        );

// ============================================================
// SUPABASE HELPERS
// ============================================================

const loadExamSubject = async (
    examSubjectId
) => {
    const {
        data,
        error,
    } =
        await supabase
            .from(
                "exam_subjects"
            )
            .select(
                "*"
            )
            .eq(
                "id",
                examSubjectId
            )
            .maybeSingle();

    throwSupabaseError(
        error,
        "Failed to load examination subject"
    );

    if (!data) {
        const error =
            new Error(
                "Examination subject not found."
            );

        error.status =
            404;

        error.code =
            "EXAM_SUBJECT_NOT_FOUND";

        throw error;
    }

    return data;
};

const findExamPaperByHash = async (
    examId,
    examSubjectId,
    fileHash
) => {
    const {
        data,
        error,
    } =
        await supabase
            .from(
                "exam_papers"
            )
            .select(
                "*"
            )
            .eq(
                "exam_id",
                examId
            )
            .eq(
                "exam_subject_id",
                examSubjectId
            )
            .eq(
                "file_hash",
                fileHash
            )
            .order(
                "id",
                {
                    ascending:
                        false,
                }
            )
            .limit(
                1
            )
            .maybeSingle();

    throwSupabaseError(
        error,
        "Failed to find examination paper by hash"
    );

    return data || null;
};

const findExistingExamPaper =
    async (
        examId,
        examSubjectId
    ) => {
        const {
            data,
            error,
        } =
            await supabase
                .from(
                    "exam_papers"
                )
                .select(
                    "*"
                )
                .eq(
                    "exam_id",
                    examId
                )
                .eq(
                    "exam_subject_id",
                    examSubjectId
                )
                .order(
                    "id",
                    {
                        ascending:
                            false,
                    }
                )
                .limit(
                    1
                )
                .maybeSingle();

        throwSupabaseError(
            error,
            "Failed to find existing examination paper"
        );

        return data || null;
    };

// ============================================================
// RECORD SANITIZERS
// ============================================================

const sanitizeExamQuestionRecord =
    (question) => ({
        exam_id:
            question.exam_id,

        subject_id:
            question.subject_id,

        exam_subject_id:
            question.exam_subject_id,

        question_number:
            integerOrZero(
                question.question_number
            ),

        question_text:
            textOrNull(
                question.question_text
            ),

        topic:
            textOrNull(
                question.topic
            ),

        sub_topic:
            textOrNull(
                question.sub_topic
            ),

        difficulty_level:
            textOrNull(
                question.difficulty_level
            ),

        ai_confidence:
            numberOrNull(
                question.ai_confidence
            ) ?? 0,

        bloom_level:
            textOrNull(
                question.bloom_level
            ),

        question_type:
            textOrNull(
                question.question_type
            ),

        ai_explanation:
            textOrNull(
                question.ai_explanation
            ),

        max_marks:
            normalizeMaxMarks(
                question.max_marks
            ),

        section:
            textOrNull(
                question.section
            ),

        section_type:
            textOrNull(
                question.section_type
            ),

        is_selective:
            normalizeBoolean(
                question.is_selective
            ),

        selection_required:
            normalizeBoolean(
                question.selection_required
            ),

        selection_count:
            integerOrZero(
                question.selection_count
            ),

        selection_total:
            integerOrZero(
                question.selection_total
            ),

        selection_group:
            textOrNull(
                question.selection_group
            ),

        selection_instruction:
            textOrNull(
                question.selection_instruction
            ),
    });

const sanitizeQuestionAnalysisRecord =
    (question) => ({
        exam_id:
            question.exam_id,

        question_number:
            integerOrZero(
                question.question_number
            ),

        topic:
            textOrNull(
                question.topic
            ),

        subtopic:
            textOrNull(
                question.subtopic
            ),

        difficulty:
            textOrNull(
                question.difficulty
            ),

        blooms_level:
            textOrNull(
                question.blooms_level
            ),

        marks:
            normalizeMaxMarks(
                question.marks
            ),

        question_text:
            textOrNull(
                question.question_text
            ),

        answer_expected:
            textOrNull(
                question.answer_expected
            ),
    });

// ============================================================
// PAPER STATUS
// ============================================================

const updatePaperStatus = async (
    paperId,
    {
        status,
        aiStatus,
        errorMessage,
    }
) => {
    const {
        data,
        error,
    } =
        await supabase
            .from(
                "exam_papers"
            )
            .update({
                status,

                ai_status:
                    aiStatus,

                error_message:
                    errorMessage,
            })
            .eq(
                "id",
                paperId
            )
            .select(
                "*"
            )
            .single();

    throwSupabaseError(
        error,
        "Failed to update examination paper status"
    );

    return data;
};

// ============================================================
// ANALYZE PAPER
// ============================================================

export const analyzePaper =
    async (
        req,
        res
    ) => {
        const startedAt =
            Date.now();

        let examId =
            Number(
                req.body?.exam_id
            );

        let examSubjectId =
            Number(
                req.body?.exam_subject_id
            );

        let examPaperId =
            null;

        let lockAcquired =
            false;

        let reusedPaper =
            false;

        try {
            if (
                !Number.isInteger(
                    examId
                ) ||
                examId <= 0
            ) {
                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            "Invalid exam ID.",
                    });
            }

            if (
                !Number.isInteger(
                    examSubjectId
                ) ||
                examSubjectId <= 0
            ) {
                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            "Invalid exam subject ID.",
                    });
            }

            if (
                !req.file ||
                !req.file.buffer
            ) {
                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            "Examination paper PDF is required.",
                    });
            }

            lockAcquired =
                lockAnalysis(
                    examId,
                    examSubjectId
                );

            if (
                !lockAcquired
            ) {
                return res
                    .status(409)
                    .json({
                        success:
                            false,

                        message:
                            "AI analysis for this examination subject is already running.",
                    });
            }

            console.log(
                "=========================================="
            );

            console.log(
                "FULL-PAPER AI ANALYSIS STARTED"
            );

            console.log(
                "EXAM:",
                examId
            );

            console.log(
                "EXAM SUBJECT:",
                examSubjectId
            );

            console.log(
                "FILE:",
                req.file.originalname
            );

            const fileHash =
                calculateFileHash(
                    req.file.buffer
                );

            console.log(
                "FILE HASH:",
                fileHash
            );

            // ------------------------------------------------
            // LOAD EXAMINATION DATA
            // ------------------------------------------------

            const [
                examResult,
                examSubject,
                existingPaper,
                hashPaper,
            ] =
                await Promise.all([
                    supabase
                        .from(
                            "exams"
                        )
                        .select(
                            "*"
                        )
                        .eq(
                            "id",
                            examId
                        )
                        .maybeSingle(),

                    loadExamSubject(
                        examSubjectId
                    ),

                    findExistingExamPaper(
                        examId,
                        examSubjectId
                    ),

                    findExamPaperByHash(
                        examId,
                        examSubjectId,
                        fileHash
                    ),
                ]);

            throwSupabaseError(
                examResult.error,
                "Failed to load examination"
            );

            const exam =
                examResult.data;

            if (!exam) {
                const error =
                    new Error(
                        "Examination not found."
                    );

                error.status =
                    404;

                error.code =
                    "EXAM_NOT_FOUND";

                throw error;
            }

            if (
                Number(
                    examSubject.exam_id
                ) !==
                Number(
                    examId
                )
            ) {
                const error =
                    new Error(
                        "Exam subject does not belong to this examination."
                    );

                error.status =
                    400;

                error.code =
                    "EXAM_SUBJECT_MISMATCH";

                throw error;
            }

            // ------------------------------------------------
            // SUBJECT
            // ------------------------------------------------

            const subjectId =
                examSubject.subject_id
                    ? Number(
                        examSubject.subject_id
                    )
                    : null;

            let subject =
                null;

            if (
                subjectId
            ) {
                const {
                    data,
                    error,
                } =
                    await supabase
                        .from(
                            "subjects"
                        )
                        .select(
                            "*"
                        )
                        .eq(
                            "id",
                            subjectId
                        )
                        .maybeSingle();

                throwSupabaseError(
                    error,
                    "Failed to load subject"
                );

                subject =
                    data;
            }

            const subjectName =
                getDisplayName(
                    subject
                ) ||
                examSubject.subject_name ||
                examSubject.name ||
                "Unknown Subject";

            const level =
                examSubject.level ||
                examSubject.class_level ||
                exam.level ||
                "Unknown Level";

            const examName =
                exam.name ||
                exam.exam_name ||
                `Examination ${examId}`;

            // ------------------------------------------------
            // PAPER RECORD
            // ------------------------------------------------

            let examPaper =
                null;

            if (
                hashPaper
            ) {
                const {
                    data,
                    error,
                } =
                    await supabase
                        .from(
                            "exam_papers"
                        )
                        .update({
                            file_name:
                                req.file
                                    .originalname,

                            file_type:
                                req.file
                                    .mimetype,

                            file_hash:
                                fileHash,

                            status:
                                "Processing",

                            ai_status:
                                "Processing",

                            error_message:
                                null,
                        })
                        .eq(
                            "id",
                            hashPaper.id
                        )
                        .select(
                            "*"
                        )
                        .single();

                throwSupabaseError(
                    error,
                    "Failed to reuse duplicate examination paper"
                );

                examPaper =
                    data;

                reusedPaper =
                    true;
            } else if (
                existingPaper
            ) {
                const {
                    data,
                    error,
                } =
                    await supabase
                        .from(
                            "exam_papers"
                        )
                        .update({
                            file_name:
                                req.file
                                    .originalname,

                            file_type:
                                req.file
                                    .mimetype,

                            file_hash:
                                fileHash,

                            status:
                                "Processing",

                            ai_status:
                                "Processing",

                            error_message:
                                null,
                        })
                        .eq(
                            "id",
                            existingPaper.id
                        )
                        .select(
                            "*"
                        )
                        .single();

                throwSupabaseError(
                    error,
                    "Failed to update existing exam paper"
                );

                examPaper =
                    data;

                reusedPaper =
                    true;
            } else {
                const {
                    data,
                    error,
                } =
                    await supabase
                        .from(
                            "exam_papers"
                        )
                        .insert({
                            exam_id:
                                examId,

                            exam_subject_id:
                                examSubjectId,

                            file_name:
                                req.file
                                    .originalname,

                            file_type:
                                req.file
                                    .mimetype,

                            file_hash:
                                fileHash,

                            status:
                                "Processing",

                            ai_status:
                                "Processing",

                            error_message:
                                null,
                        })
                        .select(
                            "*"
                        )
                        .single();

                throwSupabaseError(
                    error,
                    "Failed to create exam paper"
                );

                examPaper =
                    data;

                reusedPaper =
                    false;
            }

            examPaperId =
                examPaper.id;

            console.log(
                "EXAM PAPER ID:",
                examPaperId
            );

            console.log(
                "REUSED PAPER:",
                reusedPaper
            );

            // ------------------------------------------------
            // READ PDF
            // ------------------------------------------------

            console.log(
                "READING COMPLETE PDF..."
            );

            const pdfStartedAt =
                Date.now();

            let pdfText =
                "";

            try {
                pdfText =
                    await withTimeout(
                        readPDF(
                            req.file
                                .buffer
                        ),
                        30000,
                        "PDF reading timed out after 30 seconds."
                    );
            } catch (
                error
            ) {
                console.error(
                    "PDF READING FAILED:",
                    error
                );

                await updatePaperStatus(
                    examPaperId,
                    {
                        status:
                            "Failed",

                        aiStatus:
                            "Failed",

                        errorMessage:
                            "The examination paper was saved, but its PDF text could not be read.",
                    }
                );

                return res
                    .status(200)
                    .json({
                        success:
                            true,

                        paper_saved:
                            true,

                        analysis_completed:
                            false,

                        ai_status:
                            "Failed",

                        exam_id:
                            examId,

                        exam_subject_id:
                            examSubjectId,

                        exam_paper_id:
                            examPaperId,

                        reused_paper:
                            reusedPaper,

                        message:
                            "The examination paper was saved, but AI analysis could not be completed because the PDF could not be read.",
                    });
            }

            pdfText =
                normalizePdfText(
                    pdfText
                );

            console.log(
                "PDF READ TIME:",
                `${Date.now() - pdfStartedAt}ms`
            );

            if (
                pdfText.length <
                50
            ) {
                await updatePaperStatus(
                    examPaperId,
                    {
                        status:
                            "Failed",

                        aiStatus:
                            "Failed",

                        errorMessage:
                            "The examination paper was saved, but the PDF contains little or no readable text.",
                    }
                );

                return res
                    .status(200)
                    .json({
                        success:
                            true,

                        paper_saved:
                            true,

                        analysis_completed:
                            false,

                        ai_status:
                            "Failed",

                        exam_id:
                            examId,

                        exam_subject_id:
                            examSubjectId,

                        exam_paper_id:
                            examPaperId,

                        reused_paper:
                            reusedPaper,

                        message:
                            "The examination paper was saved, but AI analysis could not be completed because the PDF contains little or no readable text.",
                    });
            }

            console.log(
                "PDF TEXT LENGTH:",
                pdfText.length
            );

            // ------------------------------------------------
            // PDF STRUCTURAL EVIDENCE
            // ------------------------------------------------

            const sectionTotals =
                extractSectionTotals(
                    pdfText
                );

            const expectedQuestionCount =
                extractExpectedQuestionCount(
                    pdfText
                );

            const globalSelection =
                extractGlobalSelection(
                    pdfText
                );

            const structuralQuestions =
                extractQuestionBlocks(
                    pdfText
                );

            console.log(
                "PDF SECTION TOTALS:",
                sectionTotals
            );

            console.log(
                "EXPECTED QUESTIONS:",
                expectedQuestionCount
            );

            console.log(
                "GLOBAL SELECTION:",
                globalSelection
            );

            console.log(
                "PARTIAL PDF QUESTIONS:",
                structuralQuestions.length
            );

            // ------------------------------------------------
            // BUILD PROMPT
            // ------------------------------------------------

            const prompt =
                buildExamAnalysisPrompt({
                    pdfText,

                    structuralQuestions,

                    subjectName,

                    level,

                    examName,
                });

            console.log(
                "PROMPT LENGTH:",
                prompt.length
            );

            console.log(
                "SENDING WHOLE EXAMINATION PAPER TO GEMINI..."
            );

            // ------------------------------------------------
            // GEMINI
            //
            // IMPORTANT:
            // Gemini errors NEVER delete the saved paper.
            // The frontend receives only a safe message.
            // ------------------------------------------------

            const aiStartedAt =
                Date.now();

            let aiRawResponse;

            try {
                aiRawResponse =
                    await withTimeout(
                        askGemini(
                            prompt
                        ),
                        120000,
                        "AI analysis timed out."
                    );
            } catch (
                error
            ) {
                console.error(
                    "GEMINI ANALYSIS ERROR:",
                    error
                );

                const rawMessage =
                    String(
                        error?.message ||
                            ""
                    );

                const isQuotaError =
                    error?.status ===
                        429 ||
                    error?.statusCode ===
                        429 ||
                    error?.code ===
                        429 ||
                    /429/i.test(
                        rawMessage
                    ) ||
                    /quota/i.test(
                        rawMessage
                    ) ||
                    /resource.?exhausted/i.test(
                        rawMessage
                    ) ||
                    /gemini_quota_exceeded/i.test(
                        rawMessage
                    );

                const safeMessage =
                    isQuotaError
                        ? "The examination paper was saved successfully, but AI analysis is temporarily unavailable. Please try the AI analysis again later."
                        : "The examination paper was saved successfully, but AI analysis could not be completed. Please try again.";

                try {
                    await updatePaperStatus(
                        examPaperId,
                        {
                            status:
                                "Failed",

                            aiStatus:
                                "Failed",

                            errorMessage:
                                safeMessage,
                        }
                    );
                } catch (
                    statusError
                ) {
                    console.error(
                        "FAILED TO UPDATE PAPER AFTER GEMINI ERROR:",
                        statusError
                    );
                }

                return res
                    .status(200)
                    .json({
                        success:
                            true,

                        paper_saved:
                            true,

                        analysis_completed:
                            false,

                        ai_status:
                            "Failed",

                        exam_id:
                            examId,

                        exam_subject_id:
                            examSubjectId,

                        exam_paper_id:
                            examPaperId,

                        reused_paper:
                            reusedPaper,

                        message:
                            safeMessage,
                    });
            }

            console.log(
                "GEMINI RESPONSE RECEIVED"
            );

            console.log(
                "AI RESPONSE TIME:",
                `${Date.now() - aiStartedAt}ms`
            );

            // ------------------------------------------------
            // PARSE AI
            // ------------------------------------------------

            let aiResult;

            try {
                aiResult =
                    parseAIResult(
                        aiRawResponse
                    );
            } catch (
                error
            ) {
                console.error(
                    "AI JSON PARSE ERROR:",
                    error
                );

                const safeMessage =
                    "The examination paper was saved successfully, but the AI response could not be processed. Please try the AI analysis again.";

                await updatePaperStatus(
                    examPaperId,
                    {
                        status:
                            "Failed",

                        aiStatus:
                            "Failed",

                        errorMessage:
                            safeMessage,
                    }
                );

                return res
                    .status(200)
                    .json({
                        success:
                            true,

                        paper_saved:
                            true,

                        analysis_completed:
                            false,

                        ai_status:
                            "Failed",

                        exam_id:
                            examId,

                        exam_subject_id:
                            examSubjectId,

                        exam_paper_id:
                            examPaperId,

                        reused_paper:
                            reusedPaper,

                        message:
                            safeMessage,
                    });
            }

            const rawQuestions =
                Array.isArray(
                    aiResult.questions
                )
                    ? aiResult.questions
                    : [];

            if (
                rawQuestions.length ===
                0
            ) {
                const safeMessage =
                    "The examination paper was saved successfully, but AI could not identify the examination questions. Please try the AI analysis again.";

                await updatePaperStatus(
                    examPaperId,
                    {
                        status:
                            "Failed",

                        aiStatus:
                            "Failed",

                        errorMessage:
                            safeMessage,
                    }
                );

                return res
                    .status(200)
                    .json({
                        success:
                            true,

                        paper_saved:
                            true,

                        analysis_completed:
                            false,

                        ai_status:
                            "Failed",

                        exam_id:
                            examId,

                        exam_subject_id:
                            examSubjectId,

                        exam_paper_id:
                            examPaperId,

                        reused_paper:
                            reusedPaper,

                        message:
                            safeMessage,
                    });
            }

            console.log(
                "AI QUESTIONS RECEIVED:",
                rawQuestions.length
            );

            // ------------------------------------------------
            // NORMALIZE
            // ------------------------------------------------

            let questions =
                rawQuestions.map(
                    (
                        question,
                        index
                    ) =>
                        normalizeAIQuestion(
                            question,
                            index
                        )
                );

            // ------------------------------------------------
            // APPLY TEXTUAL SELECTION EVIDENCE
            // ------------------------------------------------

            questions =
                applyTextualSelectionEvidence(
                    questions,
                    globalSelection
                );

            // ------------------------------------------------
            // REMOVE DUPLICATES
            // ------------------------------------------------

            const questionMap =
                new Map();

            for (
                const question of
                    questions
            ) {
                const number =
                    Number(
                        question.question_number
                    );

                if (
                    !Number.isInteger(
                        number
                    ) ||
                    number <= 0
                ) {
                    continue;
                }

                if (
                    !questionMap.has(
                        number
                    )
                ) {
                    questionMap.set(
                        number,
                        question
                    );
                }
            }

            questions =
                Array.from(
                    questionMap.values()
                ).sort(
                    (a, b) =>
                        a.question_number -
                        b.question_number
                );

            // ------------------------------------------------
            // QUESTION COUNT VALIDATION
            // ------------------------------------------------

            if (
                expectedQuestionCount >
                    0 &&
                questions.length !==
                    expectedQuestionCount
            ) {
                throw new Error(
                    `AI identified ${questions.length} main questions, but the examination instructions indicate ${expectedQuestionCount} questions.`
                );
            }

            // ------------------------------------------------
            // QUESTION NUMBER VALIDATION
            // ------------------------------------------------

            if (
                expectedQuestionCount >
                    0
            ) {
                const actualNumbers =
                    questions.map(
                        (
                            question
                        ) =>
                            Number(
                                question.question_number
                            )
                    );

                const hasSequentialNumbering =
                    actualNumbers.every(
                        (
                            number,
                            index
                        ) =>
                            number ===
                            index + 1
                    );

                if (
                    !hasSequentialNumbering
                ) {
                    throw new Error(
                        `AI did not correctly reconstruct the examination question numbering. Detected: ${actualNumbers.join(", ")}.`
                    );
                }
            }

            // ------------------------------------------------
            // SELECTIVE VALIDATION
            // ------------------------------------------------

            const selectiveValidation =
                validateSelectiveQuestions(
                    questions
                );

            if (
                !selectiveValidation.valid
            ) {
                throw new Error(
                    `Invalid selective-question structure: ${selectiveValidation.problems.join(
                        " | "
                    )}`
                );
            }

            // ------------------------------------------------
            // MARK VALIDATION
            // ------------------------------------------------

            const questionsWithoutMarks =
                questions.filter(
                    (
                        question
                    ) =>
                        normalizeMaxMarks(
                            question.max_marks
                        ) <= 0
                );

            if (
                questionsWithoutMarks.length >
                0
            ) {
                console.error(
                    "QUESTIONS WITHOUT AI-DETERMINED MARKS:",
                    questionsWithoutMarks.map(
                        (
                            question
                        ) => ({
                            question:
                                question.question_number,

                            marks:
                                question.max_marks,

                            source:
                                question.mark_source,

                            evidence:
                                question.mark_evidence,
                        })
                    )
                );

                throw new Error(
                    `AI could not reliably determine marks for: ${questionsWithoutMarks
                        .map(
                            (q) =>
                                `Q${q.question_number}`
                        )
                        .join(
                            ", "
                        )}.`
                );
            }

            // ------------------------------------------------
            // SECTION VALIDATION
            // ------------------------------------------------

            const sectionValidation =
                validateSectionMarks({
                    questions,

                    aiSections:
                        aiResult.sections,

                    pdfText,
                });

            console.log(
                "SECTION VALIDATION:",
                sectionValidation
            );

            if (
                !sectionValidation.valid
            ) {
                throw new Error(
                    `AI mark structure does not agree with the examination paper: ${sectionValidation.problems.join(
                        " | "
                    )}`
                );
            }

            // ------------------------------------------------
            // TOTAL MARKS
            // ------------------------------------------------

            const effectiveCalculatedMarks =
                calculateEffectiveTotalMarks(
                    questions
                );

            const rawQuestionMarks =
                questions.reduce(
                    (
                        total,
                        question
                    ) =>
                        total +
                        normalizeMaxMarks(
                            question.max_marks
                        ),
                    0
                );

            const totalMarks =
                effectiveCalculatedMarks;

            if (
                totalMarks <= 0
            ) {
                throw new Error(
                    "The examination paper does not provide enough evidence to determine a valid effective total mark."
                );
            }

            console.log(
                "RAW QUESTION MARKS:",
                rawQuestionMarks
            );

            console.log(
                "EFFECTIVE TOTAL MARKS:",
                totalMarks
            );

            // ------------------------------------------------
            // AI SUMMARY FIELDS
            // ------------------------------------------------

            const topicsFound =
                Array.isArray(
                    aiResult.topics_found
                )
                    ? aiResult.topics_found
                    : [];

            const weakTopics =
                Array.isArray(
                    aiResult.weak_topics
                )
                    ? aiResult.weak_topics
                    : [];

            const strongTopics =
                Array.isArray(
                    aiResult.strong_topics
                )
                    ? aiResult.strong_topics
                    : [];

            const recommendations =
                Array.isArray(
                    aiResult.recommendations
                )
                    ? aiResult.recommendations
                    : [];

            const bloomsDistribution =
                aiResult.blooms_distribution &&
                typeof aiResult.blooms_distribution ===
                    "object"
                    ? aiResult.blooms_distribution
                    : {};

            const qualityScore =
                Math.max(
                    0,
                    Math.min(
                        100,
                        numberOrNull(
                            aiResult.quality_score
                        ) ?? 0
                    )
                );

            const syllabusCoverage =
                Math.max(
                    0,
                    Math.min(
                        100,
                        numberOrNull(
                            aiResult.syllabus_coverage
                        ) ?? 0
                    )
                );

            const difficulty =
                textOrNull(
                    aiResult.difficulty
                ) ||
                "Unknown";

            const summary =
                textOrNull(
                    aiResult.summary
                ) ||
                "AI analysis completed.";

            const teacherComments =
                textOrNull(
                    aiResult.teacher_comments
                );

            // ------------------------------------------------
            // BUILD AI ANALYSIS RECORD
            // ------------------------------------------------

            const analysisRecord = {
                exam_id:
                    examId,

                exam_subject_id:
                    examSubjectId,

                exam_paper_id:
                    examPaperId,

                analysis_status:
                    "Completed",

                total_questions:
                    questions.length,

                total_marks:
                    totalMarks,

                topics_found:
                    topicsFound,

                syllabus_coverage:
                    syllabusCoverage,

                difficulty:
                    difficulty,

                quality_score:
                    qualityScore,

                recommendations:
                    recommendations.join(
                        "\n"
                    ),

                subject:
                    subjectName,

                level:
                    level,

                question_analysis:
                    questions,

                weak_topics:
                    weakTopics,

                strong_topics:
                    strongTopics,

                blooms_distribution:
                    bloomsDistribution,

                teacher_comments:
                    teacherComments,

                ai_summary:
                    summary,

                raw_response:
                    typeof aiRawResponse ===
                    "string"
                        ? aiRawResponse
                        : JSON.stringify(
                            aiRawResponse
                        ),
            };

            // ------------------------------------------------
            // QUESTION ANALYSIS RECORDS
            // ------------------------------------------------

            const questionAnalysisRecords =
                questions.map(
                    (
                        question
                    ) =>
                        sanitizeQuestionAnalysisRecord({
                            exam_id:
                                examId,

                            question_number:
                                question.question_number,

                            topic:
                                question.topic,

                            subtopic:
                                question.sub_topic,

                            difficulty:
                                question.difficulty_level,

                            blooms_level:
                                question.bloom_level,

                            marks:
                                question.max_marks,

                            question_text:
                                question.question_text,

                            answer_expected:
                                question.answer_expected,
                        })
                );

            // ------------------------------------------------
            // EXAM QUESTION RECORDS
            // ------------------------------------------------

            const examQuestionRecords =
                questions.map(
                    (
                        question
                    ) =>
                        sanitizeExamQuestionRecord({
                            exam_id:
                                examId,

                            subject_id:
                                subjectId,

                            exam_subject_id:
                                examSubjectId,

                            question_number:
                                question.question_number,

                            question_text:
                                question.question_text,

                            topic:
                                question.topic,

                            sub_topic:
                                question.sub_topic,

                            difficulty_level:
                                question.difficulty_level,

                            ai_confidence:
                                question.ai_confidence,

                            bloom_level:
                                question.bloom_level,

                            question_type:
                                question.question_type,

                            ai_explanation:
                                question.ai_explanation,

                            max_marks:
                                question.max_marks,

                            section:
                                question.section,

                            section_type:
                                question.section_type,

                            is_selective:
                                question.is_selective,

                            selection_required:
                                question.selection_required,

                            selection_count:
                                question.selection_count,

                            selection_total:
                                question.selection_total,

                            selection_group:
                                question.selection_group,

                            selection_instruction:
                                question.selection_instruction,
                        })
                );

            // ------------------------------------------------
            // FINAL VALIDATION
            // ------------------------------------------------

            for (
                const row of
                    examQuestionRecords
            ) {
                if (
                    !Number.isInteger(
                        row.question_number
                    ) ||
                    row.question_number <=
                        0
                ) {
                    throw new Error(
                        "Invalid question number detected."
                    );
                }

                if (
                    !Number.isFinite(
                        Number(
                            row.max_marks
                        )
                    ) ||
                    Number(
                        row.max_marks
                    ) <= 0
                ) {
                    throw new Error(
                        `Invalid max_marks for Q${row.question_number}.`
                    );
                }

                if (
                    typeof row.is_selective !==
                    "boolean"
                ) {
                    throw new Error(
                        `Invalid is_selective for Q${row.question_number}.`
                    );
                }

                if (
                    typeof row.selection_required !==
                    "boolean"
                ) {
                    throw new Error(
                        `Invalid selection_required for Q${row.question_number}.`
                    );
                }

                if (
                    !Number.isInteger(
                        row.selection_count
                    )
                ) {
                    throw new Error(
                        `Invalid selection_count for Q${row.question_number}.`
                    );
                }

                if (
                    !Number.isInteger(
                        row.selection_total
                    )
                ) {
                    throw new Error(
                        `Invalid selection_total for Q${row.question_number}.`
                    );
                }

                if (
                    row.is_selective
                ) {
                    if (
                        row.selection_count <=
                            0
                    ) {
                        throw new Error(
                            `Selective Q${row.question_number} has invalid selection_count.`
                        );
                    }

                    if (
                        row.selection_total <=
                            0
                    ) {
                        throw new Error(
                            `Selective Q${row.question_number} has invalid selection_total.`
                        );
                    }

                    if (
                        row.selection_count >
                        row.selection_total
                    ) {
                        throw new Error(
                            `Selective Q${row.question_number} has selection_count greater than selection_total.`
                        );
                    }
                }
            }

            // ------------------------------------------------
            // FINAL QUESTION MARKS
            // ------------------------------------------------

            const finalRawQuestionMarks =
                examQuestionRecords.reduce(
                    (
                        total,
                        row
                    ) =>
                        total +
                        Number(
                            row.max_marks
                        ),
                    0
                );

            if (
                !Number.isFinite(
                    finalRawQuestionMarks
                ) ||
                finalRawQuestionMarks <=
                    0
            ) {
                throw new Error(
                    "Final question marks are invalid."
                );
            }

            // ------------------------------------------------
            // LOG FINAL STRUCTURE
            // ------------------------------------------------

            console.log(
                "=========================================="
            );

            console.log(
                "FINAL AI EXAM STRUCTURE"
            );

            console.log(
                "QUESTIONS:",
                examQuestionRecords.length
            );

            console.log(
                "RAW QUESTION MARKS:",
                finalRawQuestionMarks
            );

            console.log(
                "EFFECTIVE EXAM MARKS:",
                totalMarks
            );

            for (
                const question of
                    examQuestionRecords
            ) {
                console.log(
                    `Q${question.question_number}`,
                    {
                        section:
                            question.section,

                        marks:
                            question.max_marks,

                        selective:
                            question.is_selective,

                        selection_count:
                            question.selection_count,

                        selection_total:
                            question.selection_total,

                        selection_group:
                            question.selection_group,

                        selection_instruction:
                            question.selection_instruction,
                    }
                );
            }

            console.log(
                "=========================================="
            );

            // ------------------------------------------------
            // DELETE OLD AI DATA
            // ------------------------------------------------

            console.log(
                "REMOVING OLD AI DATA..."
            );

            const [
                deleteQuestionAnalysis,
                deleteQuestions,
                deleteAnalysis,
            ] =
                await Promise.all([
                    supabase
                        .from(
                            "exam_question_analysis"
                        )
                        .delete()
                        .eq(
                            "exam_id",
                            examId
                        ),

                    supabase
                        .from(
                            "exam_questions"
                        )
                        .delete()
                        .eq(
                            "exam_id",
                            examId
                        )
                        .eq(
                            "exam_subject_id",
                            examSubjectId
                        ),

                    supabase
                        .from(
                            "exam_ai_analysis"
                        )
                        .delete()
                        .eq(
                            "exam_id",
                            examId
                        )
                        .eq(
                            "exam_subject_id",
                            examSubjectId
                        ),
                ]);

            throwSupabaseError(
                deleteQuestionAnalysis.error,
                "Failed to delete old question analysis"
            );

            throwSupabaseError(
                deleteQuestions.error,
                "Failed to delete old exam questions"
            );

            throwSupabaseError(
                deleteAnalysis.error,
                "Failed to delete old AI analysis"
            );

            // ------------------------------------------------
            // SAVE NEW AI DATA
            // ------------------------------------------------

            console.log(
                "SAVING NEW AI ANALYSIS..."
            );

            const [
                analysisInsert,
                questionAnalysisInsert,
                questionsInsert,
            ] =
                await Promise.all([
                    supabase
                        .from(
                            "exam_ai_analysis"
                        )
                        .insert(
                            analysisRecord
                        )
                        .select(
                            "*"
                        )
                        .single(),

                    questionAnalysisRecords.length >
                        0
                        ? supabase
                            .from(
                                "exam_question_analysis"
                            )
                            .insert(
                                questionAnalysisRecords
                            )
                        : Promise.resolve({
                            data: [],
                            error:
                                null,
                        }),

                    supabase
                        .from(
                            "exam_questions"
                        )
                        .insert(
                            examQuestionRecords
                        )
                        .select(
                            "*"
                        ),
                ]);

            throwSupabaseError(
                analysisInsert.error,
                "Failed to save exam AI analysis"
            );

            throwSupabaseError(
                questionAnalysisInsert.error,
                "Failed to save question analysis"
            );

            throwSupabaseError(
                questionsInsert.error,
                "Failed to save exam questions"
            );

            const savedAnalysis =
                analysisInsert.data;

            // ------------------------------------------------
            // VERIFY SAVED QUESTIONS
            // ------------------------------------------------

            const {
                data:
                    verifiedQuestions,
                error:
                    verifyError,
            } =
                await supabase
                    .from(
                        "exam_questions"
                    )
                    .select(
                        "*"
                    )
                    .eq(
                        "exam_id",
                        examId
                    )
                    .eq(
                        "exam_subject_id",
                        examSubjectId
                    )
                    .order(
                        "question_number",
                        {
                            ascending:
                                true,
                        }
                    );

            throwSupabaseError(
                verifyError,
                "Failed to verify saved exam questions"
            );

            if (
                !verifiedQuestions ||
                verifiedQuestions.length ===
                    0
            ) {
                throw new Error(
                    "AI analysis completed but no exam questions were saved."
                );
            }

            for (
                const question of
                    verifiedQuestions
            ) {
                const marks =
                    Number(
                        question.max_marks
                    );

                if (
                    !Number.isFinite(
                        marks
                    ) ||
                    marks <= 0
                ) {
                    throw new Error(
                        `Database returned invalid max_marks for Q${question.question_number}.`
                    );
                }
            }

            // ------------------------------------------------
            // COMPLETE PAPER
            // ------------------------------------------------

            await updatePaperStatus(
                examPaperId,
                {
                    status:
                        "Completed",

                    aiStatus:
                        "Completed",

                    errorMessage:
                        null,
                }
            );

            // ------------------------------------------------
            // SUCCESS
            // ------------------------------------------------

            const processingTime =
                Date.now() -
                startedAt;

            console.log(
                "=========================================="
            );

            console.log(
                "FULL-PAPER AI ANALYSIS COMPLETED"
            );

            console.log(
                "EXAM:",
                examId
            );

            console.log(
                "EXAM SUBJECT:",
                examSubjectId
            );

            console.log(
                "PAPER:",
                examPaperId
            );

            console.log(
                "FILE HASH:",
                fileHash
            );

            console.log(
                "QUESTIONS:",
                verifiedQuestions.length
            );

            console.log(
                "RAW MARKS:",
                finalRawQuestionMarks
            );

            console.log(
                "EFFECTIVE TOTAL MARKS:",
                totalMarks
            );

            console.log(
                "REUSED:",
                reusedPaper
            );

            console.log(
                "PROCESSING TIME:",
                `${processingTime}ms`
            );

            console.log(
                "=========================================="
            );

            return res
                .status(200)
                .json({
                    success:
                        true,

                    message:
                        "Examination paper analyzed successfully using full-paper AI structure analysis.",

                    exam_id:
                        examId,

                    exam_subject_id:
                        examSubjectId,

                    exam_paper_id:
                        examPaperId,

                    file_hash:
                        fileHash,

                    analysis_id:
                        savedAnalysis?.id ||
                        null,

                    total_questions:
                        verifiedQuestions.length,

                    raw_question_marks:
                        finalRawQuestionMarks,

                    total_marks:
                        totalMarks,

                    questions:
                        verifiedQuestions,

                    analysis:
                        savedAnalysis,

                    reused:
                        reusedPaper,
                });
        } catch (
            error
        ) {
            console.error(
                "=========================================="
            );

            console.error(
                "FULL-PAPER AI ANALYSIS FAILED"
            );

            console.error(
                error
            );

            console.error(
                "ERROR DETAILS:",
                errorDetails(
                    error
                )
            );

            console.error(
                "=========================================="
            );

            if (
                examPaperId
            ) {
                try {
                    await updatePaperStatus(
                        examPaperId,
                        {
                            status:
                                "Failed",

                            aiStatus:
                                "Failed",

                            errorMessage:
                                error?.message ||
                                "AI analysis failed.",
                        }
                    );
                } catch (
                    statusError
                ) {
                    console.error(
                        "FAILED TO UPDATE PAPER STATUS:",
                        statusError
                    );
                }

                return res
                    .status(200)
                    .json({
                        success:
                            true,

                        paper_saved:
                            true,

                        analysis_completed:
                            false,

                        ai_status:
                            "Failed",

                        exam_id:
                            examId,

                        exam_subject_id:
                            examSubjectId,

                        exam_paper_id:
                            examPaperId,

                        message:
                            "The examination paper was saved successfully, but AI analysis could not be completed. Please try the AI analysis again.",
                    });
            }

            const status =
                Number(
                    error?.status
                );

            const httpStatus =
                Number.isInteger(
                    status
                ) &&
                status >= 400 &&
                status <= 599
                    ? status
                    : 500;

            return res
                .status(
                    httpStatus
                )
                .json({
                    success:
                        false,

                    code:
                        error?.code ||
                        "AI_ANALYSIS_FAILED",

                    message:
                        error?.message ||
                        "AI paper analysis failed.",

                    error:
                        errorDetails(
                            error
                        ),

                    exam_id:
                        examId,

                    exam_subject_id:
                        examSubjectId,

                    exam_paper_id:
                        examPaperId,
                });
        } finally {
            if (
                lockAcquired
            ) {
                unlockAnalysis(
                    examId,
                    examSubjectId
                );
            }
        }
    };

// ============================================================
// GET AI ANALYSIS BY EXAM ID
// ============================================================

export const getAIAnalysis =
    async (
        req,
        res
    ) => {
        try {
            const examId =
                Number(
                    req.params.examId
                );

            if (
                !Number.isInteger(
                    examId
                ) ||
                examId <= 0
            ) {
                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            "Invalid exam ID.",
                    });
            }

            const {
                data,
                error,
            } =
                await supabase
                    .from(
                        "exam_ai_analysis"
                    )
                    .select(
                        "*"
                    )
                    .eq(
                        "exam_id",
                        examId
                    )
                    .order(
                        "id",
                        {
                            ascending:
                                false,
                        }
                    )
                    .limit(
                        1
                    )
                    .maybeSingle();

            throwSupabaseError(
                error,
                "Failed to load AI analysis"
            );

            if (!data) {
                return res
                    .status(404)
                    .json({
                        success:
                            false,

                        message:
                            "No AI analysis found for this examination.",

                        exam_id:
                            examId,
                    });
            }

            return res
                .status(200)
                .json({
                    success:
                        true,

                    data,
                });
        } catch (
            error
        ) {
            console.error(
                "GET AI ANALYSIS ERROR:",
                error
            );

            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        error?.message ||
                        "Failed to load AI analysis.",
                });
        }
    };

// ============================================================
// GET AI ANALYSIS BY EXAM + SUBJECT
// ============================================================

export const getAIAnalysisByExamSubject =
    async (
        req,
        res
    ) => {
        try {
            const examId =
                Number(
                    req.params.examId
                );

            const examSubjectId =
                Number(
                    req.params.examSubjectId
                );

            if (
                !Number.isInteger(
                    examId
                ) ||
                examId <= 0
            ) {
                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            "Invalid exam ID.",
                    });
            }

            if (
                !Number.isInteger(
                    examSubjectId
                ) ||
                examSubjectId <= 0
            ) {
                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            "Invalid exam subject ID.",
                    });
            }

            const examSubject =
                await loadExamSubject(
                    examSubjectId
                );

            if (
                Number(
                    examSubject.exam_id
                ) !==
                Number(
                    examId
                )
            ) {
                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            "Exam subject does not belong to this examination.",
                    });
            }

            const [
                analysisResult,
                questionsResult,
                paperResult,
            ] =
                await Promise.all([
                    supabase
                        .from(
                            "exam_ai_analysis"
                        )
                        .select(
                            "*"
                        )
                        .eq(
                            "exam_id",
                            examId
                        )
                        .eq(
                            "exam_subject_id",
                            examSubjectId
                        )
                        .order(
                            "id",
                            {
                                ascending:
                                    false,
                            }
                        )
                        .limit(
                            1
                        )
                        .maybeSingle(),

                    supabase
                        .from(
                            "exam_questions"
                        )
                        .select(
                            "*"
                        )
                        .eq(
                            "exam_id",
                            examId
                        )
                        .eq(
                            "exam_subject_id",
                            examSubjectId
                        )
                        .order(
                            "question_number",
                            {
                                ascending:
                                    true,
                            }
                        ),

                    supabase
                        .from(
                            "exam_papers"
                        )
                        .select(
                            "*"
                        )
                        .eq(
                            "exam_id",
                            examId
                        )
                        .eq(
                            "exam_subject_id",
                            examSubjectId
                        )
                        .order(
                            "id",
                            {
                                ascending:
                                    false,
                            }
                        )
                        .limit(
                            1
                        )
                        .maybeSingle(),
                ]);

            throwSupabaseError(
                analysisResult.error,
                "Failed to load exam AI analysis"
            );

            throwSupabaseError(
                questionsResult.error,
                "Failed to load exam questions"
            );

            throwSupabaseError(
                paperResult.error,
                "Failed to load exam paper"
            );

            const analysis =
                analysisResult.data ||
                null;

            const questions =
                questionsResult.data ||
                [];

            const paper =
                paperResult.data ||
                null;

            if (!analysis) {
                return res
                    .status(404)
                    .json({
                        success:
                            false,

                        message:
                            "No AI analysis found for this examination subject.",

                        exam_id:
                            examId,

                        exam_subject_id:
                            examSubjectId,

                        questions,

                        paper,
                    });
            }

            return res
                .status(200)
                .json({
                    success:
                        true,

                    exam_id:
                        examId,

                    exam_subject_id:
                        examSubjectId,

                    analysis,

                    questions,

                    paper,

                    total_questions:
                        questions.length,

                    total_marks:
                        Number(
                            analysis.total_marks
                        ) ||
                        calculateEffectiveTotalMarks(
                            questions
                        ),
                });
        } catch (
            error
        ) {
            console.error(
                "GET AI ANALYSIS BY SUBJECT ERROR:",
                error
            );

            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        error?.message ||
                        "Failed to load AI analysis.",
                });
        }
    };

// ============================================================
// HEALTH CHECK
// ============================================================

export const aiHealthCheck =
    async (
        req,
        res
    ) => {
        return res
            .status(200)
            .json({
                success:
                    true,

                service:
                    "AI Examination Analysis",

                status:
                    "OK",

                timestamp:
                    new Date().toISOString(),
            });
    };