import crypto from "crypto";

import { supabase } from "../config/supabase.js";
import { readPDF } from "../services/pdfReader.js";
import { askGemini } from "../services/gemini.service.js";

// ============================================================
// AI ANALYSIS LOCKS
// ============================================================

const analysisLocks = new Map();

const ANALYSIS_LOCK_TIMEOUT = 15 * 60 * 1000;

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

    const existingLock =
        analysisLocks.get(key);

    if (existingLock) {
        const age =
            Date.now() -
            existingLock.startedAt;

        if (
            age <
            ANALYSIS_LOCK_TIMEOUT
        ) {
            return false;
        }

        console.warn(
            "Removing stale AI analysis lock:",
            key
        );

        analysisLocks.delete(key);
    }

    analysisLocks.set(key, {
        startedAt:
            Date.now(),
    });

    return true;
};

const unlockAnalysis = (
    examId,
    examSubjectId
) => {
    return analysisLocks.delete(
        getAnalysisKey(
            examId,
            examSubjectId
        )
    );
};

// ============================================================
// TIMEOUT HELPER
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

                        error.status =
                            504;

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
        value === null ||
        value === undefined
    ) {
        return null;
    }

    const text =
        String(value).trim();

    return text.length > 0
        ? text
        : null;
};

const integerOrZero = (
    value
) => {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return 0;
    }

    const number =
        Number(value);

    if (
        !Number.isFinite(
            number
        )
    ) {
        return 0;
    }

    return Math.max(
        0,
        Math.round(number)
    );
};

const numberOrNull = (
    value
) => {
    if (
        value === null ||
        value === undefined ||
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
    value,
    fallback = false
) => {
    if (
        typeof value ===
        "boolean"
    ) {
        return value;
    }

    if (
        typeof value ===
        "number"
    ) {
        return value === 1;
    }

    if (
        typeof value ===
        "string"
    ) {
        const normalized =
            value
                .trim()
                .toLowerCase();

        if (
            [
                "true",
                "1",
                "yes",
                "required",
                "selective",
                "optional",
            ].includes(
                normalized
            )
        ) {
            return true;
        }

        if (
            [
                "false",
                "0",
                "no",
                "none",
                "compulsory",
                "mandatory",
            ].includes(
                normalized
            )
        ) {
            return false;
        }
    }

    return fallback;
};

const normalizeMaxMarks = (
    value
) => {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return 0;
    }

    const number =
        Number(
            String(value)
                .trim()
                .replace(
                    /,/g,
                    ""
                )
        );

    if (
        Number.isFinite(
            number
        ) &&
        number > 0
    ) {
        return number;
    }

    return 0;
};

const errorDetails = (
    error
) => ({
    message:
        error?.message ||
        "Unknown error",

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
    context = "Supabase error"
) => {
    if (!error) {
        return;
    }

    console.error(
        `${context}:`,
        error
    );

    const wrapped =
        new Error(
            `${context}: ${
                error.message ||
                "Unknown Supabase error"
            }`
        );

    wrapped.code =
        error.code ||
        null;

    wrapped.details =
        error.details ||
        null;

    wrapped.hint =
        error.hint ||
        null;

    wrapped.status =
        error.status ||
        error.statusCode ||
        null;

    throw wrapped;
};

// ============================================================
// FILE HASH
// ============================================================

const calculateFileHash = (
    buffer
) => {
    if (
        !buffer ||
        !Buffer.isBuffer(
            buffer
        )
    ) {
        throw new Error(
            "Unable to calculate examination paper hash because the uploaded file buffer is missing."
        );
    }

    return crypto
        .createHash("sha256")
        .update(buffer)
        .digest("hex");
};

// ============================================================
// ROBUST JSON CLEANING
// ============================================================

const normalizeAIJsonCharacters = (
    value
) => {
    return String(value || "")
        .replace(
            /^\uFEFF/,
            ""
        )
        .replace(
            /[\u200B-\u200D\u2060\u00A0]/g,
            " "
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
            /[“”]/g,
            '"'
        )
        .replace(
            /[‘’]/g,
            "'"
        )
        .trim();
};

// ============================================================
// REMOVE MARKDOWN CODE FENCES
// ============================================================

const stripMarkdownJson = (
    value
) => {
    let text =
        normalizeAIJsonCharacters(
            value
        );

    text = text
        .replace(
            /^```(?:json)?\s*/i,
            ""
        )
        .replace(
            /\s*```$/i,
            ""
        )
        .trim();

    return text;
};

// ============================================================
// EXTRACT COMPLETE JSON VALUE
// ============================================================

const extractCompleteJsonValue = (
    value
) => {
    const text =
        stripMarkdownJson(
            value
        );

    if (!text) {
        return "";
    }

    let start = -1;

    for (
        let i = 0;
        i < text.length;
        i++
    ) {
        const char =
            text[i];

        if (
            char === "{" ||
            char === "["
        ) {
            start = i;
            break;
        }
    }

    if (start < 0) {
        return text.trim();
    }

    const stack = [];

    let inString =
        false;

    let escaped =
        false;

    for (
        let i = start;
        i < text.length;
        i++
    ) {
        const char =
            text[i];

        if (inString) {
            if (escaped) {
                escaped = false;
                continue;
            }

            if (
                char === "\\"
            ) {
                escaped = true;
                continue;
            }

            if (
                char === '"'
            ) {
                inString =
                    false;
            }

            continue;
        }

        if (
            char === '"'
        ) {
            inString =
                true;

            continue;
        }

        if (
            char === "{" ||
            char === "["
        ) {
            stack.push(
                char
            );

            continue;
        }

        if (
            char === "}" ||
            char === "]"
        ) {
            const expectedOpening =
                char === "}"
                    ? "{"
                    : "[";

            const last =
                stack[
                    stack.length - 1
                ];

            if (
                last !==
                expectedOpening
            ) {
                continue;
            }

            stack.pop();

            if (
                stack.length === 0
            ) {
                return text
                    .slice(
                        start,
                        i + 1
                    )
                    .trim();
            }
        }
    }

    return text
        .slice(start)
        .trim();
};

// ============================================================
// SAFE COMMON JSON REPAIRS
// ============================================================

const repairCommonAIJsonErrors = (
    value
) => {
    let text =
        normalizeAIJsonCharacters(
            value
        );

    text =
        stripMarkdownJson(
            text
        );

    text = text.replace(
        /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,
        ""
    );

    text = text.replace(
        /([{\[,]\s*)-\s*([A-Za-z_$][\w$]*)\s*:/g,
        '$1"$2":'
    );

    text = text.replace(
        /([{\[,]\s*)([A-Za-z_$][\w$]*)\s*:/g,
        '$1"$2":'
    );

    text = text.replace(
        /([{\[,]\s*)'([A-Za-z_$][\w$]*)'\s*:/g,
        '$1"$2":'
    );

    text = text.replace(
        /,\s*([}\]])/g,
        "$1"
    );

    text = text.replace(
        /:\s*undefined\b/g,
        ": null"
    );

    text = text.replace(
        /:\s*NaN\b/g,
        ": null"
    );

    return text.trim();
};

// ============================================================
// PARSE AI RESULT
// ============================================================

const parseAIResult = (
    value
) => {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        throw new Error(
            "Gemini returned an empty response."
        );
    }

    if (
        typeof value ===
        "object"
    ) {
        return value;
    }

    const original =
        String(value);

    const candidates = [];

    const cleaned =
        extractCompleteJsonValue(
            original
        );

    if (cleaned) {
        candidates.push(
            cleaned
        );
    }

    const repaired =
        repairCommonAIJsonErrors(
            cleaned ||
            original
        );

    if (
        repaired &&
        !candidates.includes(
            repaired
        )
    ) {
        candidates.push(
            repaired
        );
    }

    const repairedExtracted =
        extractCompleteJsonValue(
            repaired
        );

    if (
        repairedExtracted &&
        !candidates.includes(
            repairedExtracted
        )
    ) {
        candidates.push(
            repairedExtracted
        );
    }

    let lastError =
        null;

    for (
        const candidate of candidates
    ) {
        try {
            const parsed =
                JSON.parse(
                    candidate
                );

            if (
                parsed &&
                typeof parsed ===
                    "object"
            ) {
                return parsed;
            }
        } catch (error) {
            lastError =
                error;
        }
    }

    console.error(
        "=========================================="
    );

    console.error(
        "GEMINI INVALID JSON"
    );

    console.error(
        "ORIGINAL RESPONSE LENGTH:",
        original.length
    );

    if (lastError) {
        console.error(
            "JSON PARSE ERROR:",
            lastError.message
        );
    }

    console.error(
        "RESPONSE PREVIEW:",
        original.slice(
            0,
            2500
        )
    );

    console.error(
        "=========================================="
    );

    const error =
        new Error(
            "Gemini ilirudisha response ambayo si valid JSON. Jaribu analysis tena."
        );

    error.code =
        "GEMINI_INVALID_JSON";

    error.details =
        lastError?.message ||
        null;

    throw error;
};

// ============================================================
// DISPLAY NAME
// ============================================================

const getDisplayName = (
    row
) => {
    if (!row) {
        return null;
    }

    return (
        row.name ||
        row.subject_name ||
        row.title ||
        row.subject ||
        null
    );
};

// ============================================================
// PDF NORMALIZATION
// ============================================================

const normalizePdfText = (
    pdfText
) => {
    return String(
        pdfText || ""
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

// ============================================================
// NUMBER WORDS
// ============================================================

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
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90,
};

const parseNumberToken = (
    value
) => {
    if (
        value === null ||
        value === undefined
    ) {
        return 0;
    }

    const raw =
        String(value)
            .trim()
            .toLowerCase();

    if (!raw) {
        return 0;
    }

    const numeric =
        Number(raw);

    if (
        Number.isFinite(
            numeric
        )
    ) {
        return Math.round(
            numeric
        );
    }

    return (
        numberWords[
            raw
        ] ?? 0
    );
};

// ============================================================
// EXTRACT SECTION TOTALS
// ============================================================

const extractSectionTotals = (
    pdfText
) => {
    const text =
        String(
            pdfText || ""
        );

    const result = {};

    const patterns = [
        {
            section: "A",

            regex:
                /SECTION\s*A[\s\S]{0,180}?\(?\s*(\d+(?:\.\d+)?)\s*Marks?\s*\)?/i,
        },

        {
            section: "B",

            regex:
                /SECTION\s*B[\s\S]{0,180}?\(?\s*(\d+(?:\.\d+)?)\s*Marks?\s*\)?/i,
        },

        {
            section: "C",

            regex:
                /SECTION\s*C[\s\S]{0,180}?\(?\s*(\d+(?:\.\d+)?)\s*Marks?\s*\)?/i,
        },

        {
            section: "D",

            regex:
                /SECTION\s*D[\s\S]{0,180}?\(?\s*(\d+(?:\.\d+)?)\s*Marks?\s*\)?/i,
        },

        {
            section: "E",

            regex:
                /SECTION\s*E[\s\S]{0,180}?\(?\s*(\d+(?:\.\d+)?)\s*Marks?\s*\)?/i,
        },
    ];

    for (
        const item of patterns
    ) {
        const match =
            text.match(
                item.regex
            );

        if (!match) {
            continue;
        }

        const marks =
            normalizeMaxMarks(
                match[1]
            );

        if (marks > 0) {
            result[
                item.section
            ] = marks;
        }
    }

    return result;
};

// ============================================================
// EXPECTED QUESTION COUNT
// ============================================================

const extractExpectedQuestionCount = (
    pdfText
) => {
    const text =
        String(
            pdfText || ""
        )
            .replace(
                /\s+/g,
                " "
            )
            .trim();

    const numericPatterns = [
        /(?:total\s+of|there\s+are|contains|has)\s+(\d+)\s+(?:main\s+)?questions?/i,

        /(\d+)\s+(?:main\s+)?questions?\s+(?:in\s+this\s+paper|are\s+provided|are\s+given)/i,

        /answer\s+(?:all|any|only)\s+\d+\s+(?:questions?|of)\s+(?:the\s+)?(\d+)/i,

        /(?:questions?|items?)\s*[:\-]?\s*(\d+)\s*$/i,
    ];

    for (
        const pattern of numericPatterns
    ) {
        const match =
            text.match(
                pattern
            );

        if (
            match?.[1]
        ) {
            const count =
                parseNumberToken(
                    match[1]
                );

            if (
                count > 0 &&
                count <= 200
            ) {
                return count;
            }
        }
    }

    const wordPatterns = [
        /(?:total\s+of|there\s+are|contains|has)\s+(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+(?:main\s+)?questions?/i,

        /(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+(?:main\s+)?questions?/i,
    ];

    for (
        const pattern of wordPatterns
    ) {
        const match =
            text.match(
                pattern
            );

        if (
            match?.[1]
        ) {
            const count =
                parseNumberToken(
                    match[1]
                );

            if (
                count > 0 &&
                count <= 200
            ) {
                return count;
            }
        }
    }

    return 0;
};

// ============================================================
// GLOBAL / TEXT SELECTION
// ============================================================

const extractGlobalSelection = (
    pdfText
) => {
    const text =
        String(
            pdfText || ""
        )
            .replace(
                /\s+/g,
                " "
            )
            .trim();

    const patterns = [
        {
            regex:
                /(?:answer|attempt|choose|select)\s+(?:any|only)?\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:questions?|items?)\s+(?:from|out\s+of)\s+(?:the\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)/i,

            mode: "count_total",
        },

        {
            regex:
                /(?:answer|attempt|choose|select)\s+(?:any|only)?\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:questions?|items?)\s+(?:from|in)\s+(?:section\s+([A-Z]))/i,

            mode: "section",
        },

        {
            regex:
                /(?:answer|attempt|choose|select)\s+(?:any|only)?\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:questions?|items?)\s+(?:out\s+of)\s+(?:the\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)/i,

            mode: "count_total",
        },

        {
            regex:
                /(?:answer|attempt|choose|select)\s+(?:any|only)?\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:questions?|items?)/i,

            mode: "count_only",
        },
    ];

    for (
        const item of patterns
    ) {
        const match =
            text.match(
                item.regex
            );

        if (!match) {
            continue;
        }

        const count =
            parseNumberToken(
                match[1]
            );

        if (
            count <= 0
        ) {
            continue;
        }

        if (
            item.mode ===
            "count_total"
        ) {
            const total =
                parseNumberToken(
                    match[2]
                );

            return {
                count,
                total,
                section: null,
                instruction:
                    match[0],
            };
        }

        if (
            item.mode ===
            "section"
        ) {
            return {
                count,
                total: 0,
                section:
                    String(
                        match[2]
                    ).toUpperCase(),
                instruction:
                    match[0],
            };
        }

        return {
            count,
            total: 0,
            section: null,
            instruction:
                match[0],
        };
    }

    return null;
};

// ============================================================
// QUESTION BLOCK EXTRACTION
// ============================================================

const extractQuestionBlocks = (
    pdfText
) => {
    const text =
        normalizePdfText(
            pdfText
        );

    if (!text) {
        return [];
    }

    const lines =
        text.split("\n");

    const starts = [];

    const regex =
        /^\s*(?:question\s*)?(\d{1,3})\s*[\.\):\-]\s*(.*)$/i;

    for (
        let i = 0;
        i < lines.length;
        i++
    ) {
        const line =
            lines[i].trim();

        if (!line) {
            continue;
        }

        const match =
            line.match(
                regex
            );

        if (!match) {
            continue;
        }

        const number =
            Number(
                match[1]
            );

        if (
            !Number.isInteger(
                number
            ) ||
            number <= 0 ||
            number > 200
        ) {
            continue;
        }

        starts.push({
            lineIndex:
                i,

            questionNumber:
                number,

            firstText:
                match[2] || "",
        });
    }

    const blocks = [];

    for (
        let i = 0;
        i < starts.length;
        i++
    ) {
        const current =
            starts[i];

        const next =
            starts[i + 1];

        const endLine =
            next
                ? next.lineIndex
                : lines.length;

        const content =
            lines
                .slice(
                    current.lineIndex,
                    endLine
                )
                .join(" ")
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();

        blocks.push({
            question_number:
                current.questionNumber,

            question_text:
                content
                    .replace(
                        regex,
                        "$2"
                    )
                    .trim(),
        });
    }

    const map =
        new Map();

    for (
        const block of blocks
    ) {
        if (
            !map.has(
                block.question_number
            )
        ) {
            map.set(
                block.question_number,
                block
            );
        }
    }

    return Array.from(
        map.values()
    ).sort(
        (a, b) =>
            a.question_number -
            b.question_number
    );
};

// ============================================================
// GEMINI PROMPT
// ============================================================

const buildExamAnalysisPrompt = ({
    pdfText,
    structuralQuestions,
    subjectName,
    level,
    examName,
}) => {
    const sectionTotals =
        extractSectionTotals(
            pdfText
        );

    const expectedQuestions =
        extractExpectedQuestionCount(
            pdfText
        );

    const globalSelection =
        extractGlobalSelection(
            pdfText
        );

    const detectedQuestions =
        structuralQuestions
            .map(
                (
                    question
                ) =>
                    `Q${question.question_number}: ${question.question_text}`
            )
            .join("\n");

    return `
You are an expert examination-paper analyst.

You are analyzing the ACTUAL examination paper below.

YOUR PRIMARY JOB IS TO UNDERSTAND THE PAPER ITSELF.

Read the FULL paper before returning the JSON.

Do NOT depend only on explicit phrases such as:
"10 marks", "(10)", "[10]", etc.

Many examination papers do NOT print marks beside every main question.

Use all available evidence:

1. Section marks.
2. Examination instructions.
3. Number of questions.
4. Number of sub-questions.
5. Number of items.
6. Answer-all instructions.
7. Answer-any/selective instructions.
8. Matching questions.
9. Multiple-choice questions.
10. Expected responses.
11. Repeated mark patterns.
12. Section totals.
13. Question structure.
14. Selection groups.

IMPORTANT:

Do NOT invent arbitrary marks.

If a mark is explicitly printed, use it.

If a mark is not printed beside a question,
infer it only when the structure provides strong evidence.

For inferred marks:

"mark_source": "inferred_from_exam_structure"

For printed marks:

"mark_source": "printed_on_paper"

For section-derived marks:

"mark_source": "derived_from_section_total"

If the mark cannot be reliably determined:

"max_marks": 0,
"mark_source": "unknown"

============================================================
EXAMINATION
============================================================

Name:
${examName || "Unknown Examination"}

Subject:
${subjectName || "Unknown Subject"}

Level:
${level || "Unknown Level"}

============================================================
DETECTED SECTION TOTALS
============================================================

${JSON.stringify(
        sectionTotals,
        null,
        2
    )}

============================================================
EXPECTED QUESTION COUNT
============================================================

${expectedQuestions || "Unknown"}

============================================================
GLOBAL SELECTION EVIDENCE
============================================================

${
    globalSelection
        ? JSON.stringify(
            globalSelection,
            null,
            2
        )
        : "None detected"
}

============================================================
QUESTIONS DETECTED BY TEXT EXTRACTION
============================================================

${detectedQuestions || "None"}

============================================================
FULL EXAMINATION PAPER
============================================================

${pdfText}

============================================================
TASK
============================================================

Analyze the FULL examination paper.

Identify every REAL MAIN question.

Do not rely only on PDF text extraction numbering.

Do not create fake questions.

Do not split subparts (a), (b), (c) into fake main questions.

If a question contains subparts, keep them inside the same
main question.

Preserve the actual main question numbers appearing in the paper.

Do not manufacture missing question numbers merely to satisfy
a pattern.

============================================================
MARK UNDERSTANDING
============================================================

Understand marks from the actual paper.

Use section totals and instructions as evidence.

For selective sections, understand:

- how many questions are available;
- how many the candidate must answer;
- marks assigned to each optional question;
- whether the same selection rule applies to the entire group.

Do NOT assign arbitrary marks.

============================================================
SELECTIVE QUESTIONS
============================================================

A question is selective only when the paper provides actual
evidence that the candidate chooses from a group.

Examples:

"Answer any 2 questions from Section C"

"Attempt two questions out of questions 9, 10 and 11"

"Choose any 3 of the following 5 questions"

When such evidence exists:

selection_required = true
is_selective = true

selection_count = number candidate must answer

selection_total = total number of questions available in that
selection group

selection_group = a stable group identifier

selection_instruction = the actual instruction from the paper

If the paper does NOT provide sufficient evidence for a
selection count or selection total, do NOT invent one.

Return zero for the unknown value.

============================================================
EFFECTIVE TOTAL MARKS
============================================================

"total_marks" must represent the actual obtainable maximum
for a candidate.

IMPORTANT:

Do NOT simply add every optional question.

For example, if a paper has three optional questions worth
10 marks each and the candidate must answer only two, the
effective maximum contributed by that group is 20, not 30.

============================================================
RETURN JSON ONLY
============================================================

IMPORTANT JSON RULES:

1. Return ONLY valid JSON.
2. Do NOT use markdown fences.
3. Every property name MUST be enclosed in double quotes.
4. Never use unquoted property names.
5. Never use single quotes for JSON strings.
6. Never use comments.
7. Never use trailing commas.
8. Never use undefined.
9. Never use NaN.
10. Ensure all braces and brackets are correctly closed.
11. Escape quotation marks inside strings.
12. The response must be directly parseable by JSON.parse().

{
  "summary": "",
  "total_questions": 0,
  "total_marks": 0,
  "difficulty": "Unknown",
  "quality_score": 0,
  "syllabus_coverage": 0,

  "sections": [
    {
      "section": "A",
      "section_marks": 0,
      "question_numbers": [],
      "answer_required": 0,
      "selection_required": false,
      "evidence": ""
    }
  ],

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
      "section": "A",
      "section_type": "compulsory",
      "max_marks": 0,
      "mark_source": "printed_on_paper",
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

============================================================
STRICT RULES
============================================================

1. Return exactly the real main examination questions.
2. Do not fabricate question numbers.
3. Do not fabricate marks.
4. Do not use database values to determine marks.
5. Do not assume every question has the same marks.
6. Read the whole paper before determining marks.
7. Use section totals as evidence.
8. Use instructions as evidence.
9. Use sub-question structure as evidence.
10. Use selective instructions as evidence.
11. max_marks must be numeric.
12. max_marks must be greater than zero only when supported by evidence.
13. mark_source must explain where the mark came from.
14. mark_evidence must explain the evidence.
15. If a mark cannot be reliably determined, return zero.
16. total_marks must represent the actual obtainable examination maximum.
17. Do not sum all optional questions into the effective student maximum.
18. quality_score must be 0-100.
19. syllabus_coverage must be 0-100.
20. ai_confidence must be 0-100.
21. Return JSON only.
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
        integerOrZero(
            question?.question_number ??
                question?.questionNumber ??
                question?.number
        ) ||
        index + 1;

    const maxMarks =
        normalizeMaxMarks(
            question?.max_marks
        );

    const section =
        textOrNull(
            question?.section
        );

    const sectionType =
        textOrNull(
            question?.section_type ??
                question?.sectionType
        );

    const selectionCount =
        integerOrZero(
            question?.selection_count ??
                question?.selectionCount
        );

    const selectionTotal =
        integerOrZero(
            question?.selection_total ??
                question?.selectionTotal
        );

    const selectionInstruction =
        textOrNull(
            question?.selection_instruction ??
                question?.selectionInstruction
        );

    let isSelective =
        normalizeBoolean(
            question?.is_selective ??
                question?.selective,
            false
        );

    let selectionRequired =
        normalizeBoolean(
            question?.selection_required ??
                question?.selectionRequired,
            false
        );

    if (
        selectionInstruction &&
        /(?:answer|attempt|choose|select)\s+(?:any|only)?\s*(?:one|two|three|four|five|\d+)/i.test(
            selectionInstruction
        )
    ) {
        isSelective = true;
        selectionRequired = true;
    }

    return {
        question_number:
            questionNumber,

        question_text:
            textOrNull(
                question?.question_text ??
                    question?.questionText ??
                    question?.text ??
                    question?.question
            ) ||
            `Question ${questionNumber}`,

        topic:
            textOrNull(
                question?.topic ??
                    question?.main_topic
            ),

        sub_topic:
            textOrNull(
                question?.sub_topic ??
                    question?.subtopic ??
                    question?.subTopic
            ),

        difficulty_level:
            textOrNull(
                question?.difficulty_level ??
                    question?.difficulty
            ),

        bloom_level:
            textOrNull(
                question?.bloom_level ??
                    question?.blooms_level ??
                    question?.bloomsLevel
            ),

        question_type:
            textOrNull(
                question?.question_type ??
                    question?.type
            ),

        ai_confidence:
            Math.max(
                0,
                Math.min(
                    100,
                    numberOrNull(
                        question?.ai_confidence ??
                            question?.confidence
                    ) ?? 0
                )
            ),

        ai_explanation:
            textOrNull(
                question?.ai_explanation ??
                    question?.explanation
            ),

        answer_expected:
            textOrNull(
                question?.answer_expected ??
                    question?.expected_answer ??
                    question?.answer
            ),

        max_marks:
            maxMarks,

        mark_source:
            textOrNull(
                question?.mark_source
            ) ||
            "unknown",

        mark_evidence:
            textOrNull(
                question?.mark_evidence
            ),

        section,

        section_type:
            sectionType,

        is_selective:
            Boolean(
                isSelective
            ),

        selection_required:
            Boolean(
                selectionRequired
            ),

        selection_count:
            selectionCount,

        selection_total:
            selectionTotal,

        selection_group:
            textOrNull(
                question?.selection_group ??
                    question?.selectionGroup ??
                    question?.group
            ),

        selection_instruction:
            selectionInstruction,
    };
};

// ============================================================
// APPLY TEXTUAL SELECTION EVIDENCE
// ============================================================

const applyTextualSelectionEvidence = (
    questions,
    globalSelection
) => {
    if (
        !Array.isArray(
            questions
        ) ||
        !globalSelection
    ) {
        return questions;
    }

    const result =
        questions.map(
            (question) => ({
                ...question,
            })
        );

    const candidateQuestions =
        globalSelection.section
            ? result.filter(
                (question) =>
                    String(
                        question.section ||
                            ""
                    )
                        .trim()
                        .toUpperCase() ===
                    globalSelection.section
            )
            : result;

    if (
        candidateQuestions.length ===
        0
    ) {
        return result;
    }

    const count =
        integerOrZero(
            globalSelection.count
        );

    const totalFromText =
        integerOrZero(
            globalSelection.total
        );

    if (
        count <= 0
    ) {
        return result;
    }

    /*
     * If AI already identified a selection group,
     * preserve it.
     *
     * Otherwise textual evidence can establish the
     * selection rule for the candidate questions.
     */

    const aiSelective =
        candidateQuestions.filter(
            (question) =>
                question.is_selective
        );

    const targets =
        aiSelective.length > 0
            ? aiSelective
            : candidateQuestions;

    const inferredTotal =
        totalFromText > 0
            ? totalFromText
            : targets.length;

    if (
        inferredTotal <
        count
    ) {
        return result;
    }

    const groupName =
        globalSelection.section
            ? `TEXT-${globalSelection.section}-SELECTION`
            : "TEXT-GLOBAL-SELECTION";

    const targetNumbers =
        new Set(
            targets.map(
                (question) =>
                    Number(
                        question.question_number
                    )
            )
        );

    return result.map(
        (question) => {
            if (
                !targetNumbers.has(
                    Number(
                        question.question_number
                    )
                )
            ) {
                return question;
            }

            return {
                ...question,

                is_selective:
                    true,

                selection_required:
                    true,

                selection_count:
                    count,

                selection_total:
                    inferredTotal,

                selection_group:
                    question.selection_group ||
                    groupName,

                selection_instruction:
                    question.selection_instruction ||
                    globalSelection.instruction,
            };
        }
    );
};

// ============================================================
// VALIDATE SELECTIVE QUESTIONS
// ============================================================

const validateSelectiveQuestions = (
    questions
) => {
    const problems = [];

    const groups =
        new Map();

    for (
        const question of questions
    ) {
        if (
            !question.is_selective
        ) {
            continue;
        }

        const count =
            integerOrZero(
                question.selection_count
            );

        const total =
            integerOrZero(
                question.selection_total
            );

        if (
            count <= 0
        ) {
            problems.push(
                `Selective Q${question.question_number} has no valid selection_count.`
            );
        }

        if (
            total <= 0
        ) {
            problems.push(
                `Selective Q${question.question_number} has no valid selection_total.`
            );
        }

        if (
            count > 0 &&
            total > 0 &&
            count > total
        ) {
            problems.push(
                `Invalid selective structure for Q${question.question_number}: selection_count (${count}) cannot be greater than selection_total (${total}).`
            );
        }

        const key =
            question.selection_group ||
            `SECTION-${String(
                question.section ||
                    "UNKNOWN"
            ).toUpperCase()}-SELECTIVE`;

        if (
            !groups.has(key)
        ) {
            groups.set(
                key,
                []
            );
        }

        groups
            .get(key)
            .push(question);
    }

    for (
        const [
            groupKey,
            groupQuestions,
        ] of groups.entries()
    ) {
        const first =
            groupQuestions[0];

        const firstCount =
            integerOrZero(
                first.selection_count
            );

        const firstTotal =
            integerOrZero(
                first.selection_total
            );

        for (
            const question of groupQuestions
        ) {
            if (
                integerOrZero(
                    question.selection_count
                ) !==
                firstCount
            ) {
                problems.push(
                    `Selection group ${groupKey} has inconsistent selection_count values.`
                );

                break;
            }

            if (
                integerOrZero(
                    question.selection_total
                ) !==
                firstTotal
            ) {
                problems.push(
                    `Selection group ${groupKey} has inconsistent selection_total values.`
                );

                break;
            }
        }

        if (
            firstTotal >
            groupQuestions.length
        ) {
            /*
             * The total may include questions not reconstructed
             * by AI. We reject this because it would make the
             * selection structure unreliable.
             */
            problems.push(
                `Selection group ${groupKey} says ${firstTotal} available questions but only ${groupQuestions.length} selective main questions were reconstructed.`
            );
        }
    }

    return {
        valid:
            problems.length === 0,

        problems,
    };
};

// ============================================================
// SECTION VALIDATION
// ============================================================

const validateSectionMarks = ({
    questions,
    aiSections,
    pdfText,
}) => {
    const pdfSectionTotals =
        extractSectionTotals(
            pdfText
        );

    const problems = [];

    if (
        !Array.isArray(
            questions
        )
    ) {
        return {
            valid: false,

            problems: [
                "Questions are missing.",
            ],
        };
    }

    const sectionMap =
        new Map();

    for (
        const question of questions
    ) {
        const section =
            String(
                question.section ||
                    "UNKNOWN"
            )
                .trim()
                .toUpperCase();

        if (
            !sectionMap.has(
                section
            )
        ) {
            sectionMap.set(
                section,
                []
            );
        }

        sectionMap
            .get(section)
            .push(question);
    }

    for (
        const [
            section,
            sectionQuestions,
        ] of sectionMap.entries()
    ) {
        if (
            section === "UNKNOWN"
        ) {
            continue;
        }

        const expected =
            normalizeMaxMarks(
                pdfSectionTotals[
                    section
                ]
            );

        if (
            expected <= 0
        ) {
            continue;
        }

        /*
         * Raw marks = all reconstructed questions.
         *
         * Effective marks = marks available to one candidate
         * after applying selection rules.
         */

        const rawMarks =
            sectionQuestions.reduce(
                (
                    sum,
                    question
                ) =>
                    sum +
                    normalizeMaxMarks(
                        question.max_marks
                    ),
                0
            );

        const effectiveMarks =
            calculateEffectiveSectionMarks(
                sectionQuestions
            );

        /*
         * A printed section total may represent either:
         *
         * 1. the total of all questions printed in that section;
         * OR
         * 2. the actual marks obtainable by a candidate.
         *
         * Therefore accept either interpretation when the
         * question structure is otherwise consistent.
         */

        const rawMatches =
            Math.abs(
                rawMarks -
                    expected
            ) <= 0.01;

        const effectiveMatches =
            Math.abs(
                effectiveMarks -
                    expected
            ) <= 0.01;

        if (
            !rawMatches &&
            !effectiveMatches
        ) {
            problems.push(
                `Section ${section}: paper indicates ${expected} marks, while reconstructed questions give ${rawMarks} raw marks and ${effectiveMarks} effective candidate marks.`
            );
        }
    }

    return {
        valid:
            problems.length === 0,

        problems,

        pdfSectionTotals,

        aiSections:
            Array.isArray(
                aiSections
            )
                ? aiSections
                : [],
    };
};

// ============================================================
// EFFECTIVE SECTION MARKS
// ============================================================

const calculateEffectiveSectionMarks = (
    questions
) => {
    if (
        !Array.isArray(
            questions
        )
    ) {
        return 0;
    }

    const groups =
        new Map();

    let total = 0;

    for (
        const question of questions
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
            !question.is_selective
        ) {
            total += marks;

            continue;
        }

        const groupKey =
            question.selection_group ||
            `SECTION-SELECTIVE-${String(
                question.section ||
                    "UNKNOWN"
            ).toUpperCase()}`;

        if (
            !groups.has(
                groupKey
            )
        ) {
            groups.set(
                groupKey,
                {
                    marks: [],
                    count:
                        integerOrZero(
                            question.selection_count
                        ),
                }
            );
        }

        groups
            .get(groupKey)
            .marks.push(
                marks
            );
    }

    for (
        const group of groups.values()
    ) {
        const count =
            integerOrZero(
                group.count
            );

        if (
            count <= 0 ||
            group.marks.length === 0
        ) {
            continue;
        }

        /*
         * If all optional questions carry the same marks:
         *
         * count × marks
         *
         * If they carry different marks, the maximum obtainable
         * marks is the sum of the highest `count` marks.
         */

        const sortedMarks =
            [...group.marks].sort(
                (a, b) =>
                    b - a
            );

        total +=
            sortedMarks
                .slice(
                    0,
                    count
                )
                .reduce(
                    (
                        sum,
                        marks
                    ) =>
                        sum +
                        marks,
                    0
                );
    }

    return total;
};

// ============================================================
// EFFECTIVE TOTAL MARKS
// ============================================================

const calculateEffectiveTotalMarks = (
    questions
) => {
    if (
        !Array.isArray(
            questions
        )
    ) {
        return 0;
    }

    return calculateEffectiveSectionMarks(
        questions
    );
};

// ============================================================
// LOAD EXAM SUBJECT
// ============================================================

const loadExamSubject = async (
    examSubjectId
) => {
    if (!examSubjectId) {
        throw new Error(
            "exam_subject_id is required."
        );
    }

    const {
        data,
        error,
    } = await supabase
        .from(
            "exam_subjects"
        )
        .select("*")
        .eq(
            "id",
            examSubjectId
        )
        .maybeSingle();

    throwSupabaseError(
        error,
        "Failed to load exam subject"
    );

    if (!data) {
        throw new Error(
            `Exam subject ${examSubjectId} was not found.`
        );
    }

    return data;
};

// ============================================================
// FIND PAPER BY HASH
// ============================================================

const findExamPaperByHash = async (
    examId,
    examSubjectId,
    fileHash
) => {
    if (!fileHash) {
        return null;
    }

    const {
        data,
        error,
    } = await supabase
        .from(
            "exam_papers"
        )
        .select("*")
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
        .limit(1)
        .maybeSingle();

    throwSupabaseError(
        error,
        "Failed to check duplicate examination paper"
    );

    return data || null;
};

// ============================================================
// FIND CURRENT PAPER
// ============================================================

const findExistingExamPaper = async (
    examId,
    examSubjectId
) => {
    const {
        data,
        error,
    } = await supabase
        .from(
            "exam_papers"
        )
        .select("*")
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
        .limit(1)
        .maybeSingle();

    throwSupabaseError(
        error,
        "Failed to check existing exam paper"
    );

    return data || null;
};

// ============================================================
// SANITIZE EXAM QUESTION
// ============================================================

const sanitizeExamQuestionRecord = (
    record
) => {
    return {
        exam_id:
            Number(
                record.exam_id
            ),

        subject_id:
            record.subject_id ===
                null ||
            record.subject_id ===
                undefined
                ? null
                : Number(
                    record.subject_id
                ),

        exam_subject_id:
            Number(
                record.exam_subject_id
            ),

        question_number:
            integerOrZero(
                record.question_number
            ),

        question_text:
            textOrNull(
                record.question_text
            ) || "",

        topic:
            textOrNull(
                record.topic
            ),

        sub_topic:
            textOrNull(
                record.sub_topic
            ),

        difficulty_level:
            textOrNull(
                record.difficulty_level
            ),

        ai_confidence:
            numberOrNull(
                record.ai_confidence
            ) ?? 0,

        created_at:
            record.created_at ||
            new Date().toISOString(),

        bloom_level:
            textOrNull(
                record.bloom_level
            ),

        question_type:
            textOrNull(
                record.question_type
            ),

        ai_explanation:
            textOrNull(
                record.ai_explanation
            ),

        ai_processed:
            true,

        max_marks:
            normalizeMaxMarks(
                record.max_marks
            ),

        section:
            textOrNull(
                record.section
            ),

        section_type:
            textOrNull(
                record.section_type
            ),

        is_selective:
            normalizeBoolean(
                record.is_selective,
                false
            ),

        selection_required:
            normalizeBoolean(
                record.selection_required,
                false
            ),

        selection_count:
            integerOrZero(
                record.selection_count
            ),

        selection_total:
            integerOrZero(
                record.selection_total
            ),

        selection_group:
            textOrNull(
                record.selection_group
            ),

        selection_instruction:
            textOrNull(
                record.selection_instruction
            ),
    };
};

// ============================================================
// SANITIZE QUESTION ANALYSIS
// ============================================================

const sanitizeQuestionAnalysisRecord = (
    record
) => {
    return {
        exam_id:
            Number(
                record.exam_id
            ),

        question_number:
            integerOrZero(
                record.question_number
            ),

        topic:
            textOrNull(
                record.topic
            ),

        subtopic:
            textOrNull(
                record.subtopic
            ),

        difficulty:
            textOrNull(
                record.difficulty
            ),

        blooms_level:
            textOrNull(
                record.blooms_level
            ),

        marks:
            normalizeMaxMarks(
                record.marks
            ),

        question_text:
            textOrNull(
                record.question_text
            ),

        answer_expected:
            textOrNull(
                record.answer_expected
            ),
    };
};

// ============================================================
// UPDATE PAPER STATUS
// ============================================================

const updatePaperStatus = async (
    paperId,
    {
        status,
        aiStatus,
        errorMessage,
    } = {}
) => {
    if (!paperId) {
        return;
    }

    const payload = {};

    if (status) {
        payload.status =
            status;
    }

    if (aiStatus) {
        payload.ai_status =
            aiStatus;
    }

    if (
        errorMessage !==
        undefined
    ) {
        payload.error_message =
            errorMessage
                ? String(
                    errorMessage
                ).slice(
                    0,
                    5000
                )
                : null;
    }

    if (
        Object.keys(
            payload
        ).length === 0
    ) {
        return;
    }

    const {
        error,
    } = await supabase
        .from(
            "exam_papers"
        )
        .update(
            payload
        )
        .eq(
            "id",
            paperId
        );

    throwSupabaseError(
        error,
        "Failed to update exam paper status"
    );
};

// ============================================================
// ANALYZE PAPER
// ============================================================

export const analyzePaper =
    async (
        req,
        res
    ) => {
        let examId =
            null;

        let examSubjectId =
            null;

        let examPaperId =
            null;

        let lockAcquired =
            false;

        let reusedPaper =
            false;

        const startedAt =
            Date.now();

        try {
            examId =
                Number(
                    req.body?.exam_id ??
                        req.query?.exam_id
                );

            examSubjectId =
                Number(
                    req.body?.exam_subject_id ??
                        req.query?.exam_subject_id
                );

            // ------------------------------------------------
            // REQUEST VALIDATION
            // ------------------------------------------------

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
                            "Valid exam_id is required.",
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
                            "Valid exam_subject_id is required.",
                    });
            }

            if (!req.file) {
                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            "Examination paper PDF is required.",
                    });
            }

            console.log(
                "=========================================="
            );

            console.log(
                "STARTING FULL-PAPER AI ANALYSIS"
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

            console.log(
                "=========================================="
            );

            // ------------------------------------------------
            // FILE HASH
            // ------------------------------------------------

            const fileHash =
                calculateFileHash(
                    req.file.buffer
                );

            console.log(
                "FILE SHA-256:",
                fileHash
            );

            // ------------------------------------------------
            // LOCK
            // ------------------------------------------------

            lockAcquired =
                lockAnalysis(
                    examId,
                    examSubjectId
                );

            if (!lockAcquired) {
                return res
                    .status(202)
                    .json({
                        success:
                            true,

                        code:
                            "AI_ANALYSIS_ALREADY_RUNNING",

                        analysis_in_progress:
                            true,

                        message:
                            "AI analysis for this examination subject is already running. Please wait for it to complete.",

                        exam_id:
                            examId,

                        exam_subject_id:
                            examSubjectId,
                    });
            }

            // ------------------------------------------------
            // LOAD EXAM DATA
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
                return res
                    .status(404)
                    .json({
                        success:
                            false,

                        message:
                            `Examination ${examId} was not found.`,
                    });
            }

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
                            "The selected exam subject does not belong to this examination.",
                    });
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

            if (subjectId) {
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
            //
            // Priority:
            //
            // 1. Exact same hash -> reuse that row.
            // 2. Existing current paper -> update that row.
            // 3. No paper -> insert one.
            // ------------------------------------------------

            let examPaper =
                null;

            if (hashPaper) {
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
                throw new Error(
                    `Unable to read PDF: ${error.message}`
                );
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
                throw new Error(
                    "The PDF contains little or no readable text."
                );
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
                        "AI analysis timed out after 120 seconds. Please try again."
                    );
            } catch (
                error
            ) {
                const aiError =
                    new Error(
                        `AI analysis failed: ${error.message}`
                    );

                aiError.code =
                    error.code ||
                    null;

                aiError.status =
                    error.status ||
                    error.statusCode ||
                    500;

                aiError.details =
                    error.details ||
                    null;

                aiError.hint =
                    error.hint ||
                    null;

                throw aiError;
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

            const aiResult =
                parseAIResult(
                    aiRawResponse
                );

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
                throw new Error(
                    "AI could not identify any examination questions from the paper."
                );
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
                const question of questions
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
                    `AI identified ${questions.length} main questions, but the examination instructions indicate ${expectedQuestionCount} questions. The paper was not saved because the AI question structure is incomplete.`
                );
            }

            // ------------------------------------------------
            // QUESTION NUMBER VALIDATION
            //
            // Only require sequential Q1...Qn when the paper
            // explicitly provides a reliable total and its
            // numbering starts from 1.
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
                        )}. No invented marks were used.`
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

            /*
             * IMPORTANT:
             *
             * Never replace effective marks with the sum of
             * printed section totals.
             *
             * If Section C has 3 optional questions × 10 marks
             * and the student answers 2, effective total is 20,
             * not 30.
             */

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
                const row of examQuestionRecords
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
            //
            // IMPORTANT:
            //
            // exam_question_analysis has NOT been given an
            // exam_subject_id column in the schema information
            // supplied so far.
            //
            // Therefore do NOT add an unverified filter here.
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