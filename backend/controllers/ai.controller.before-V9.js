import crypto from "crypto";

import { supabase } from "../config/supabase.js";
import { readPDF } from "../services/pdfReader.js";
import { askGemini } from "../services/gemini.service.js";

const CONTROLLER_VERSION =
    "MAIN-QUESTION-GROUPING-V9";

const queue = [];

let workerRunning =
    false;

/* ============================================================
   BASIC HELPERS
============================================================ */

const text = (
    value
) =>
    value == null
        ? ""
        : String(
              value
          ).trim();

const nullable = (
    value
) =>
    text(value) ||
    null;

const number = (
    value,
    fallback = 0
) =>
    Number.isFinite(
        Number(value)
    )
        ? Number(value)
        : fallback;

const integer = (
    value,
    fallback = 0
) =>
    Math.max(
        0,
        Math.round(
            number(
                value,
                fallback
            )
        )
    );

const marks = (
    value
) =>
    Math.max(
        0,
        number(
            value,
            0
        )
    );

const clamp100 = (
    value,
    fallback = 0
) =>
    Math.max(
        0,
        Math.min(
            100,
            number(
                value,
                fallback
            )
        )
    );

const unique = (
    values = []
) =>
    [
        ...new Set(
            values
                .map(text)
                .filter(Boolean)
        ),
    ];

const normalizeConfidence = (
    value
) => {
    const n =
        Number(
            value
        );

    if (
        !Number.isFinite(
            n
        )
    ) {
        return 0;
    }

    if (
        n > 0 &&
        n <= 1
    ) {
        return Math.round(
            n * 100
        );
    }

    return Math.max(
        0,
        Math.min(
            100,
            Math.round(
                n
            )
        )
    );
};

const supabaseError = (
    error,
    context
) => {
    if (!error) {
        return;
    }

    const wrapped =
        new Error(
            `${context}: ${
                error.message ||
                "Supabase error"
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
        500;

    throw wrapped;
};

const withTimeout = (
    promise,
    milliseconds,
    message
) => {
    let timer;

    const timeoutPromise =
        new Promise(
            (
                _,
                reject
            ) => {
                timer =
                    setTimeout(
                        () => {
                            const error =
                                new Error(
                                    message
                                );

                            error.status =
                                504;

                            error.code =
                                "OPERATION_TIMEOUT";

                            reject(
                                error
                            );
                        },
                        milliseconds
                    );
            }
        );

    return Promise.race(
        [
            Promise.resolve(
                promise
            ).finally(
                () =>
                    clearTimeout(
                        timer
                    )
            ),
            timeoutPromise,
        ]
    );
};

const fileHash = (
    buffer
) =>
    crypto
        .createHash(
            "sha256"
        )
        .update(
            buffer
        )
        .digest(
            "hex"
        );

const cleanPdf = (
    value
) =>
    text(value)
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

/* ============================================================
   JSON PARSER
============================================================ */

const parseAI = (
    value
) => {
    if (
        value &&
        typeof value ===
            "object"
    ) {
        return value;
    }

    let raw =
        String(
            value || ""
        )
            .replace(
                /^\uFEFF/,
                ""
            )
            .replace(
                /```json/gi,
                ""
            )
            .replace(
                /```/g,
                ""
            )
            .trim();

    const positions = [
        raw.indexOf(
            "{"
        ),
        raw.indexOf(
            "["
        ),
    ].filter(
        (
            position
        ) =>
            position >=
            0
    );

    if (
        positions.length ===
        0
    ) {
        throw new Error(
            "Gemini returned no JSON."
        );
    }

    raw =
        raw.slice(
            Math.min(
                ...positions
            )
        );

    const stack = [];

    let inString =
        false;

    let escaped =
        false;

    let end =
        -1;

    for (
        let i = 0;
        i < raw.length;
        i++
    ) {
        const c =
            raw[i];

        if (
            inString
        ) {
            if (
                escaped
            ) {
                escaped =
                    false;
            } else if (
                c === "\\"
            ) {
                escaped =
                    true;
            } else if (
                c === '"'
            ) {
                inString =
                    false;
            }

            continue;
        }

        if (
            c === '"'
        ) {
            inString =
                true;

            continue;
        }

        if (
            c === "{" ||
            c === "["
        ) {
            stack.push(
                c
            );
        } else if (
            c === "}" ||
            c === "]"
        ) {
            const expected =
                c === "}"
                    ? "{"
                    : "[";

            if (
                stack[
                    stack.length -
                        1
                ] ===
                expected
            ) {
                stack.pop();
            }

            if (
                stack.length ===
                0
            ) {
                end =
                    i + 1;

                break;
            }
        }
    }

    const candidate =
        (
            end > 0
                ? raw.slice(
                      0,
                      end
                  )
                : raw
        ).replace(
            /,\s*([}\]])/g,
            "$1"
        );

    try {
        return JSON.parse(
            candidate
        );
    } catch (
        error
    ) {
        throw new Error(
            `Gemini returned invalid JSON: ${error.message}`
        );
    }
};

/* ============================================================
   QUESTION NUMBERING
============================================================ */

const mainNumber = (
    value,
    fallback = 0
) => {
    const match =
        text(
            value
        ).match(
            /^(?:question\s*)?(\d{1,3})/i
        );

    if (
        match
    ) {
        return integer(
            match[1],
            fallback
        );
    }

    return integer(
        value,
        fallback
    );
};

const subLabel = (
    value
) => {
    const raw =
        text(
            value
        );

    /*
     * Supports:
     *
     * Q1(i)
     * 1(i)
     * 1(ii)
     * 1(a)
     * 1(b)
     * 1. a
     * 1) a
     */

    const match =
        raw.match(
            /^(?:question\s*)?\d{1,3}\s*(?:\(\s*([a-z]+|[ivxlcdm]+|\d+)\s*\)|[.)\-:]\s*([a-z]+|[ivxlcdm]+|\d+))/i
        );

    if (
        match
    ) {
        return (
            match[1] ||
            match[2] ||
            ""
        )
            .toLowerCase()
            .trim();
    }

    return "";
};

const roman = (
    numberValue
) => {
    const table = [
        [10, "x"],
        [9, "ix"],
        [8, "viii"],
        [7, "vii"],
        [6, "vi"],
        [5, "v"],
        [4, "iv"],
        [3, "iii"],
        [2, "ii"],
        [1, "i"],
    ];

    let value =
        Math.max(
            1,
            numberValue
        );

    let result =
        "";

    for (
        const [
            valueNumber,
            symbol,
        ] of table
    ) {
        while (
            value >=
            valueNumber
        ) {
            result +=
                symbol;

            value -=
                valueNumber;
        }
    }

    return result;
};

/* ============================================================
   PDF TOP-LEVEL QUESTION DETECTION
============================================================ */

const topLevelNumbersFromPdf = (
    pdf
) => {
    const numbers =
        new Set();

    for (
        const line of
            cleanPdf(
                pdf
            ).split(
                "\n"
            )
    ) {
        const trimmed =
            text(
                line
            );

        /*
         * Top-level question:
         *
         * 1.
         * 1)
         * 1:
         * 1-
         * Question 1.
         *
         * Do NOT treat:
         *
         * 1(i)
         * 1(ii)
         * 1(a)
         * 1(b)
         *
         * as separate main questions.
         */

        const match =
            trimmed.match(
                /^(?:question\s*)?(\d{1,3})\s*[.)\-:](?!\s*(?:\([a-zivxlcdm0-9]+\)|[a-zivxlcdm]+\b))/i
            );

        if (
            match
        ) {
            const value =
                integer(
                    match[1]
                );

            if (
                value > 0 &&
                value < 200
            ) {
                numbers.add(
                    value
                );
            }
        }

        /*
         * Also support:
         *
         * 1 Choose the correct answer...
         * 2 Explain...
         *
         * But never:
         *
         * 1(i)
         * 1(ii)
         * 1(a)
         */

        const plainMatch =
            trimmed.match(
                /^(?:question\s+)?(\d{1,3})(?!\s*\([a-zivxlcdm0-9]+\))\s+(.{8,})$/i
            );

        if (
            plainMatch
        ) {
            const value =
                integer(
                    plainMatch[1]
                );

            if (
                value > 0 &&
                value < 200
            ) {
                numbers.add(
                    value
                );
            }
        }

        /*
         * Explicit:
         *
         * QUESTION 1
         *
         * is always a main question.
         */

        const explicitQuestionMatch =
            trimmed.match(
                /^question\s+(\d{1,3})(?:\s|$)/i
            );

        if (
            explicitQuestionMatch
        ) {
            const value =
                integer(
                    explicitQuestionMatch[1]
                );

            if (
                value > 0 &&
                value < 200
            ) {
                numbers.add(
                    value
                );
            }
        }
    }

    return [
        ...numbers,
    ].sort(
        (
            a,
            b
        ) =>
            a - b
    );
};

/* ============================================================
   V9 AUTHORITATIVE PDF STRUCTURE EXTRACTION
============================================================ */

const pdfQuestionHeading = (
    line
) => {
    const value =
        text(
            line
        );

    let match =
        value.match(
            /^(?:question\s*)?(\d{1,3})\s*[.)\-:]\s*(.*)$/i
        );

    if (
        match
    ) {
        const rest =
            text(
                match[2]
            );

        if (
            !/^\s*\(?[a-zivxlcdm0-9]+\)?\s*(?:[.)\-:]|$)/i.test(
                rest
            )
        ) {
            return {
                number:
                    integer(
                        match[1]
                    ),
                text:
                    rest,
            };
        }
    }

    match =
        value.match(
            /^(?:question\s+)?(\d{1,3})\s+(.{8,})$/i
        );

    if (
        match &&
        !/^\(?[a-zivxlcdm0-9]+\)?\s*(?:[.)\-:]|$)/i.test(
            text(
                match[2]
            )
        )
    ) {
        return {
            number:
                integer(
                    match[1]
                ),
            text:
                text(
                    match[2]
                ),
        };
    }

    match =
        value.match(
            /^question\s+(\d{1,3})(?:\s+|$)(.*)$/i
        );

    if (
        match
    ) {
        return {
            number:
                integer(
                    match[1]
                ),
            text:
                text(
                    match[2]
                ),
        };
    }

    return null;
};

const extractMarksFromText = (
    value
) => {
    const source =
        text(
            value
        );

    const patterns = [
        /\[\s*(\d+(?:\.\d+)?)\s*marks?\s*\]/i,
        /\(\s*(\d+(?:\.\d+)?)\s*marks?\s*\)/i,
        /(?:for|=|worth)\s*(\d+(?:\.\d+)?)\s*marks?/i,
        /\b(\d+(?:\.\d+)?)\s*marks?\b/i,
    ];

    for (
        const pattern of
            patterns
    ) {
        const match =
            source.match(
                pattern
            );

        if (
            match
        ) {
            return marks(
                match[1]
            );
        }
    }

    return 0;
};

const extractPdfQuestionStructure = (
    pdf
) => {
    const lines =
        cleanPdf(
            pdf
        ).split(
            "\n"
        );

    const blocks =
        [];

    let current =
        null;

    const pushCurrent =
        () => {
            if (
                !current ||
                !current.number
            ) {
                return;
            }

            const blockText =
                text(
                    current.lines.join(
                        " "
                    )
                );

            if (
                !blockText
            ) {
                return;
            }

            blocks.push(
                {
                    question_number:
                        current.number,

                    question_text:
                        blockText,

                    max_marks:
                        extractMarksFromText(
                            blockText
                        ),

                    section:
                        current.section ||
                        null,
                }
            );
        };

    for (
        const rawLine of
            lines
    ) {
        const line =
            text(
                rawLine
            );

        if (
            !line
        ) {
            continue;
        }

        const heading =
            pdfQuestionHeading(
                line
            );

        if (
            heading &&
            heading.number > 0 &&
            heading.number < 200
        ) {
            pushCurrent();

            current =
                {
                    number:
                        heading.number,

                    lines:
                        heading.text
                            ? [
                                  heading.text,
                              ]
                            : [],

                    section:
                        null,
                };

            continue;
        }

        if (
            /^SECTION\s+[A-Z]\b/i.test(
                line
            ) &&
            current
        ) {
            const m =
                line.match(
                    /^SECTION\s+([A-Z])\b/i
                );

            current.section =
                m
                    ? m[1].toUpperCase()
                    : null;
        }

        if (
            current
        ) {
            current.lines.push(
                line
            );
        }
    }

    pushCurrent();

    const byNumber =
        new Map();

    for (
        const row of
            blocks
    ) {
        if (
            !byNumber.has(
                row.question_number
            )
        ) {
            byNumber.set(
                row.question_number,
                row
            );
        } else {
            const old =
                byNumber.get(
                    row.question_number
                );

            old.question_text =
                `${old.question_text} ${row.question_text}`.trim();

            old.max_marks =
                old.max_marks ||
                row.max_marks;

            old.section =
                old.section ||
                row.section;
        }
    }

    return [
        ...byNumber.values(),
    ].sort(
        (
            a,
            b
        ) =>
            a.question_number -
            b.question_number
    );
};

/* ============================================================
   MERGE PDF STRUCTURE WITH AI
============================================================ */

const mergePdfStructureIntoQuestions = (
    questions,
    pdfRows
) => {
    const aiMap =
        new Map(
            (
                questions ||
                []
            ).map(
                (
                    q
                ) => [
                    integer(
                        q.question_number
                    ),
                    q,
                ]
            )
        );

    const merged =
        [];

    const missing =
        [];

    for (
        const pdfRow of
            pdfRows ||
            []
    ) {
        const n =
            integer(
                pdfRow.question_number
            );

        if (
            !n
        ) {
            continue;
        }

        const existing =
            aiMap.get(
                n
            );

        if (
            existing
        ) {
            merged.push(
                {
                    ...existing,

                    question_number:
                        n,

                    pdf_evidence:
                        existing.pdf_evidence ||
                        "pdf_structure",

                    max_marks:
                        marks(
                            existing.max_marks
                        ) ||
                        marks(
                            pdfRow.max_marks
                        ),

                    section:
                        existing.section ||
                        pdfRow.section ||
                        null,

                    question_text:
                        text(
                            existing.question_text
                        ) &&
                        !/^Question \d+$/i.test(
                            text(
                                existing.question_text
                            )
                        )
                            ? existing.question_text
                            : pdfRow.question_text,
                }
            );
        } else {
            merged.push(
                {
                    question_number:
                        n,

                    raw_question_number:
                        String(
                            n
                        ),

                    question_text:
                        pdfRow.question_text ||
                        `Question ${n}`,

                    section:
                        pdfRow.section ||
                        null,

                    section_type:
                        "compulsory",

                    max_marks:
                        marks(
                            pdfRow.max_marks
                        ),

                    mark_source:
                        pdfRow.max_marks >
                        0
                            ? "pdf_structure"
                            : "missing_mark_evidence",

                    mark_evidence:
                        pdfRow.max_marks >
                        0
                            ? pdfRow.question_text
                            : null,

                    topic:
                        null,

                    sub_topic:
                        null,

                    difficulty_level:
                        null,

                    bloom_level:
                        null,

                    question_type:
                        null,

                    answer_expected:
                        null,

                    ai_confidence:
                        0,

                    ai_explanation:
                        "Question reconstructed from PDF structure because primary AI output omitted it.",

                    is_selective:
                        false,

                    selection_required:
                        false,

                    selection_count:
                        0,

                    selection_total:
                        0,

                    selection_group:
                        null,

                    selection_instruction:
                        null,

                    sub_items:
                        [],

                    pdf_evidence:
                        "pdf_structure_reconstructed",
                }
            );

            missing.push(
                n
            );
        }
    }

    return {
        questions:
            merged.sort(
                (
                    a,
                    b
                ) =>
                    a.question_number -
                    b.question_number
            ),

        missing,
    };
};

/* ============================================================
   V9 STRUCTURAL AUDIT
============================================================ */

const structuralAudit = ({
    questions,
    pdfRows,
    examSubject,
}) => {
    const expected =
        (
            pdfRows ||
            []
        )
            .map(
                (
                    r
                ) =>
                    integer(
                        r.question_number
                    )
            )
            .filter(
                Boolean
            );

    const actual =
        (
            questions ||
            []
        )
            .map(
                (
                    q
                ) =>
                    integer(
                        q.question_number
                    )
            )
            .filter(
                Boolean
            );

    const expectedSet =
        new Set(
            expected
        );

    const actualSet =
        new Set(
            actual
        );

    const missing =
        expected.filter(
            (
                n
            ) =>
                !actualSet.has(
                    n
                )
        );

    const extra =
        actual.filter(
            (
                n
            ) =>
                !expectedSet.has(
                    n
                )
        );

    const configuredFullMarks =
        marks(
            examSubject?.full_marks
        );

    const structuralMarks =
        (
            questions ||
            []
        ).reduce(
            (
                sum,
                q
            ) =>
                sum +
                marks(
                    q.max_marks
                ),
            0
        );

    const selectionType =
        text(
            examSubject?.question_selection_type
        ).toUpperCase();

    const totalMismatch =
        configuredFullMarks >
            0 &&
        selectionType ===
            "ALL"
            ? Math.abs(
                  structuralMarks -
                      configuredFullMarks
              )
            : 0;

    const complete =
        expected.length >
            0 &&
        missing.length ===
            0 &&
        extra.length ===
            0;

    let score =
        100;

    if (
        expected.length
    ) {
        score -=
            Math.round(
                (
                    missing.length /
                    expected.length
                ) *
                    60
            );
    }

    if (
        extra.length
    ) {
        score -=
            Math.min(
                25,
                extra.length *
                    10
            );
    }

    if (
        totalMismatch >
        0
    ) {
        score -=
            totalMismatch >
            Math.max(
                2,
                configuredFullMarks *
                    0.05
            )
                ? 25
                : 10;
    }

    if (
        (
            questions ||
            []
        ).some(
            (
                q
            ) =>
                marks(
                    q.max_marks
                ) <=
                0
        )
    ) {
        score -=
            10;
    }

    return {
        expected,
        actual,
        missing,
        extra,
        structuralMarks,
        configuredFullMarks,
        totalMismatch,
        complete,
        score:
            clamp100(
                score
            ),
    };
};

/* ============================================================
   QUESTION EVIDENCE
============================================================ */

const normalizeEvidenceText =
    (
        value
    ) =>
        text(
            value
        )
            .toLowerCase()
            .replace(
                /[^\p{L}\p{N}]+/gu,
                " "
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();

const questionTextEvidenceInPdf =
    (
        pdf,
        question
    ) => {
        const numberValue =
            integer(
                question?.question_number
            );

        if (
            !numberValue
        ) {
            return {
                found:
                    false,

                source:
                    "invalid_number",
            };
        }

        const normalizedPdf =
            normalizeEvidenceText(
                pdf
            );

        const escapedNumber =
            String(
                numberValue
            ).replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );

        const headingPattern =
            new RegExp(
                `(?:^|\\n|\\s)question\\s+${escapedNumber}(?:\\s|$|[.):\\-])`,
                "i"
            );

        if (
            headingPattern.test(
                pdf
            )
        ) {
            return {
                found:
                    true,

                source:
                    "explicit_question_heading",
            };
        }

        const topLevelPattern =
            new RegExp(
                `(?:^|\\n)\\s*${escapedNumber}\\s*[.)\\-:]\\s+`,
                "i"
            );

        if (
            topLevelPattern.test(
                pdf
            )
        ) {
            return {
                found:
                    true,

                source:
                    "top_level_number",
            };
        }

        const questionText =
            normalizeEvidenceText(
                question?.question_text
            );

        const words =
            questionText
                .split(
                    " "
                )
                .filter(
                    (
                        word
                    ) =>
                        word.length >=
                        2
                )
                .slice(
                    0,
                    10
                );

        if (
            words.length >=
            4
        ) {
            const phrase =
                words.join(
                    " "
                );

            if (
                normalizedPdf.includes(
                    phrase
                )
            ) {
                return {
                    found:
                        true,

                    source:
                        "question_text",
                };
            }

            const matched =
                words.filter(
                    (
                        word
                    ) =>
                        normalizedPdf.includes(
                            word
                        )
                ).length;

            if (
                matched >=
                Math.max(
                    4,
                    Math.ceil(
                        words.length *
                            0.7
                    )
                )
            ) {
                return {
                    found:
                        true,

                    source:
                        "question_text_partial",
                };
            }
        }

        return {
            found:
                false,

            source:
                "no_pdf_evidence",
        };
    };

                                        )
                        )
                    );

                const bloomLevels =
                    unique(
                        items.map(
                            (
                                item
                            ) =>
                                text(
                                    item.bloom_level
                                )
                        )
                    );

                const questionTypes =
                    unique(
                        items.map(
                            (
                                item
                            ) =>
                                text(
                                    item.question_type
                                )
                        )
                    );

                const answers =
                    unique(
                        items.map(
                            (
                                item
                            ) =>
                                text(
                                    item.answer_expected
                                )
                        )
                    );

                const explanations =
                    unique(
                        items.map(
                            (
                                item
                            ) =>
                                text(
                                    item.ai_explanation
                                )
                        )
                    );

                const selectiveItems =
                    items.filter(
                        (
                            item
                        ) =>
                            Boolean(
                                item.is_selective ||
                                    item.selection_required
                            )
                    );

                const selectionRequired =
                    selectiveItems.length >
                    0;

                const selectionCount =
                    Math.max(
                        0,
                        ...selectiveItems.map(
                            (
                                item
                            ) =>
                                integer(
                                    item.selection_count
                                )
                        )
                    );

                const selectionTotal =
                    Math.max(
                        0,
                        ...selectiveItems.map(
                            (
                                item
                            ) =>
                                integer(
                                    item.selection_total
                                )
                        )
                    );

                const selectionGroup =
                    nullable(
                        selectiveItems.find(
                            (
                                item
                            ) =>
                                text(
                                    item.selection_group
                                )
                        )
                            ?.selection_group
                    );

                const selectionInstruction =
                    nullable(
                        selectiveItems.find(
                            (
                                item
                            ) =>
                                text(
                                    item.selection_instruction
                                )
                        )
                            ?.selection_instruction
                    );

                return {
                    question_number:
                        integer(
                            numberValue
                        ),

                    raw_question_number:
                        text(
                            first.raw_question_number
                        ) ||
                        String(
                            numberValue
                        ),

                    sub_question_label:
                        "",

                    question_text:
                        text(
                            first.question_text
                        ) ||
                        `Question ${numberValue}`,

                    topic:
                        topics[0] ||
                        null,

                    sub_topic:
                        subTopics[0] ||
                        null,

                    difficulty_level:
                        difficulties[0] ||
                        null,

                    bloom_level:
                        bloomLevels[0] ||
                        null,

                    question_type:
                        questionTypes[0] ||
                        null,

                    answer_expected:
                        answers[0] ||
                        null,

                    ai_confidence:
                        averageConfidence,

                    ai_explanation:
                        explanations[0] ||
                        null,

                    max_marks:
                        marks(
                            maxMarks
                        ),

                    mark_source:
                        first.mark_source ||
                        "grouped_ai",

                    mark_evidence:
                        first.mark_evidence ||
                        null,

                    section:
                        text(
                            first.section
                        ).toUpperCase() ||
                        null,

                    section_type:
                        text(
                            first.section_type
                        ) ||
                        null,

                    is_selective:
                        selectionRequired,

                    selection_required:
                        selectionRequired,

                    selection_count:
                        selectionCount,

                    selection_total:
                        selectionTotal,

                    selection_group:
                        selectionGroup,

                    selection_instruction:
                        selectionInstruction,

                    sub_items:
                        subItems,

                    pdf_evidence:
                        first.pdf_evidence ||
                        null,
                };
            }
        )
        .filter(
            Boolean
        );
};

/* ============================================================
   AI PROMPT — STRUCTURAL FIRST
============================================================ */

const buildPrimaryPrompt = ({
    pdf,
    examSubject,
}) => {
    const configuredFullMarks =
        marks(
            examSubject?.full_marks
        );

    const selectionType =
        text(
            examSubject?.question_selection_type
        ).toUpperCase();

    return `
You are an examination-paper analysis engine.

Your task is to analyse the examination paper below.

THIS IS A STRUCTURAL EXTRACTION TASK.

Do NOT invent questions.

Do NOT merge different main questions.

Do NOT split sub-items into separate main questions.

A MAIN QUESTION is a top-level numbered question such as:

1.
2.
3.
4.

The following are SUB-ITEMS of the parent question:

1(i)
1(ii)
1(a)
1(b)
2(a)
2(b)

Therefore:

1(i) + 1(ii) = ONE main question: Q1.

4(a) + 4(b) = ONE main question: Q4.

The database must contain MAIN QUESTIONS ONLY.

For every main question, preserve its sub-items inside "sub_items".

IMPORTANT:
The question number printed in the paper is authoritative.

If a paper contains Q1 through Q11, return Q1 through Q11.

Do not skip a question because another question looks similar.

Do not renumber questions.

Do not create missing questions from imagination.

Do not include instructions such as "Answer any..." as questions.

Configured examination information:

FULL MARKS:
${configuredFullMarks || "unknown"}

QUESTION SELECTION TYPE:
${selectionType || "unknown"}

Return ONLY valid JSON.

Use exactly this structure:

{
  "questions": [
    {
      "question_number": 1,
      "raw_question_number": "1",
      "question_text": "...",
      "max_marks": 10,
      "section": "A",
      "section_type": "compulsory",
      "topic": "...",
      "sub_topic": "...",
      "difficulty_level": "...",
      "bloom_level": "...",
      "question_type": "...",
      "answer_expected": "...",
      "ai_confidence": 0,
      "ai_explanation": "...",
      "is_selective": false,
      "selection_required": false,
      "selection_count": 0,
      "selection_total": 0,
      "selection_group": null,
      "selection_instruction": null,
      "sub_items": [
        {
          "label": "i",
          "question_text": "...",
          "max_marks": 5,
          "answer_expected": "...",
          "topic": "...",
          "sub_topic": "...",
          "difficulty_level": "...",
          "bloom_level": "...",
          "question_type": "...",
          "ai_confidence": 0
        }
      ]
    }
  ],

  "total_marks": 0,
  "quality_score": 0,
  "syllabus_coverage": 0,
  "summary": "...",
  "warnings": []
}

RULES FOR MARKS:

1. Read printed marks from the paper whenever possible.
2. A main question's marks should represent the total marks available for that main question.
3. If a main question has sub-items with marks, sum those sub-item marks.
4. Never count a sub-item as another main question.
5. Do not invent marks.
6. If marks cannot be determined, use 0 and put a warning.
7. total_marks must equal the sum of main-question max_marks.
8. quality_score must reflect structural correctness.
9. Missing questions reduce quality_score.
10. Invented questions reduce quality_score.

QUALITY:

A paper with missing main questions MUST NOT receive 99 or 100 quality.

A paper with inconsistent total marks MUST NOT receive 99 or 100 quality.

PAPER:

${pdf}
`;
};

/* ============================================================
   AI METADATA AUDIT PROMPT
============================================================ */

const buildMetadataPrompt = ({
    pdf,
    questions,
}) => {
    const structuralQuestions =
        (
            questions ||
            []
        ).map(
            (
                q
            ) => ({
                question_number:
                    q.question_number,

                question_text:
                    q.question_text,

                max_marks:
                    q.max_marks,
            })
        );

    return `
You are performing a SECONDARY metadata audit.

The question structure has already been determined by a deterministic
PDF reconciliation engine.

YOU ARE NOT ALLOWED TO CREATE QUESTIONS.

YOU ARE NOT ALLOWED TO DELETE QUESTIONS.

YOU ARE NOT ALLOWED TO CHANGE QUESTION NUMBERS.

YOU ARE NOT ALLOWED TO SPLIT MAIN QUESTIONS.

Only improve metadata for the existing questions.

Existing structural questions:

${JSON.stringify(
    structuralQuestions,
    null,
    2
)}

Return ONLY JSON:

{
  "questions": [
    {
      "question_number": 1,
      "topic": "...",
      "sub_topic": "...",
      "difficulty_level": "...",
      "bloom_level": "...",
      "question_type": "...",
      "answer_expected": "...",
      "ai_confidence": 0,
      "ai_explanation": "..."
    }
  ]
}

PAPER:

${pdf}
`;
};

/* ============================================================
   AI RESPONSE NORMALIZATION
============================================================ */

const extractAIQuestions = (
    response
) => {
    const parsed =
        parseAI(
            response
        );

    if (
        Array.isArray(
            parsed
        )
    ) {
        return {
            questions:
                parsed,

            total_marks:
                0,

            quality_score:
                0,

            syllabus_coverage:
                0,

            summary:
                null,

            warnings:
                [],
        };
    }

    const questions =
        Array.isArray(
            parsed?.questions
        )
            ? parsed.questions
            : Array.isArray(
                  parsed?.question_analysis
              )
            ? parsed.question_analysis
            : Array.isArray(
                  parsed?.analysis
              )
            ? parsed.analysis
            : [];

    return {
        questions,

        total_marks:
            marks(
                parsed?.total_marks ??
                    parsed?.totalMarks ??
                    parsed?.marks_total
            ),

        quality_score:
            clamp100(
                parsed?.quality_score ??
                    parsed?.qualityScore ??
                    parsed?.quality
            ),

        syllabus_coverage:
            clamp100(
                parsed?.syllabus_coverage ??
                    parsed?.syllabusCoverage ??
                    parsed?.coverage
            ),

        summary:
            nullable(
                parsed?.summary ??
                    parsed?.ai_summary ??
                    parsed?.overall_summary
            ),

        warnings:
            Array.isArray(
                parsed?.warnings
            )
                ? parsed.warnings
                : [],
    };
};

/* ============================================================
   RECONCILIATION
============================================================ */

const reconcileQuestionStructure = ({
    pdf,
    aiQuestions,
}) => {
    const pdfRows =
        extractPdfQuestionStructure(
            pdf
        );

    const detectedNumbers =
        topLevelNumbersFromPdf(
            pdf
        );

    console.log(
        "============================================================"
    );

    console.log(
        "V9 PDF STRUCTURE QUESTIONS:"
    );

    console.log(
        pdfRows.map(
            (
                row
            ) => ({
                question_number:
                    row.question_number,

                max_marks:
                    row.max_marks,

                text:
                    row.question_text.slice(
                        0,
                        120
                    ),
            })
        )
    );

    console.log(
        "V9 PDF TOP LEVEL NUMBERS:",
        detectedNumbers
    );

    let normalizedQuestions =
        (
            aiQuestions ||
            []
        ).map(
            (
                question,
                index
            ) =>
                normalizeQuestion(
                    question,
                    index
                )
        );

    /*
     * GROUP SUB-ITEMS BEFORE RECONCILIATION.
     *
     * This prevents:
     *
     * 1(i)
     * 1(ii)
     *
     * from becoming Q1 and Q2.
     */

    normalizedQuestions =
        groupMainQuestions(
            normalizedQuestions,
            sectionTotalsFromPdf(
                pdf
            )
        );

    /*
     * AI questions are reconciled against the PDF.
     *
     * Questions explicitly present in PDF are retained.
     *
     * Questions whose text is clearly present are also retained.
     */

    const evidenceResult =
        reconcileQuestionsWithPdf(
            normalizedQuestions,
            pdf
        );

    let keptQuestions =
        evidenceResult.questions;

    const rejected =
        evidenceResult.rejected;

    /*
     * Reconstruct any main questions detected by the PDF but
     * omitted by Gemini.
     */

    const merged =
        mergePdfStructureIntoQuestions(
            keptQuestions,
            pdfRows
        );

    keptQuestions =
        merged.questions;

    const reconstructed =
        merged.missing;

    /*
     * Remove duplicates by main question number.
     */

    const byNumber =
        new Map();

    for (
        const question of
            keptQuestions
    ) {
        const n =
            integer(
                question.question_number
            );

        if (
            !n
        ) {
            continue;
        }

        if (
            !byNumber.has(
                n
            )
        ) {
            byNumber.set(
                n,
                question
            );

            continue;
        }

        const existing =
            byNumber.get(
                n
            );

        /*
         * Merge additional sub-items rather than creating
         * another main question.
         */

        const existingItems =
            Array.isArray(
                existing.sub_items
            )
                ? existing.sub_items
                : [];

        const incomingItems =
            Array.isArray(
                question.sub_items
            )
                ? question.sub_items
                : [];

        const itemMap =
            new Map();

        for (
            const item of
                [
                    ...existingItems,
                    ...incomingItems,
                ]
        ) {
            const key =
                text(
                    item.label
                ).toLowerCase();

            if (
                key &&
                !itemMap.has(
                    key
                )
            ) {
                itemMap.set(
                    key,
                    item
                );
            }
        }

        existing.sub_items =
            [
                ...itemMap.values(),
            ];

        existing.max_marks =
            Math.max(
                marks(
                    existing.max_marks
                ),
                marks(
                    question.max_marks
                )
            );

        existing.answer_expected =
            existing.answer_expected ||
            question.answer_expected ||
            null;

        existing.topic =
            existing.topic ||
            question.topic ||
            null;

        existing.sub_topic =
            existing.sub_topic ||
            question.sub_topic ||
            null;
    }

    keptQuestions =
        [
            ...byNumber.values(),
        ].sort(
            (
                a,
                b
            ) =>
                a.question_number -
                b.question_number
        );

    /*
     * FINAL PDF AUTHORITY:
     *
     * If PDF has no evidence for a question number, do not save it.
     */

    const pdfNumberSet =
        new Set(
            pdfRows.map(
                (
                    row
                ) =>
                    integer(
                        row.question_number
                    )
            )
        );

    const finalQuestions =
        keptQuestions.filter(
            (
                question
            ) => {
                const n =
                    integer(
                        question.question_number
                    );

                return (
                    n > 0 &&
                    (
                        pdfNumberSet.has(
                            n
                        ) ||
                        questionTextEvidenceInPdf(
                            pdf,
                            question
                        ).found
                    )
                );
            }
        );

    /*
     * Re-apply exact PDF question marks where the AI omitted marks.
     *
     * We do NOT blindly overwrite valid AI marks because some papers
     * contain marks in sub-items rather than on the heading line.
     */

    const pdfMap =
        new Map(
            pdfRows.map(
                (
                    row
                ) => [
                    integer(
                        row.question_number
                    ),
                    row,
                ]
            )
        );

    for (
        const question of
            finalQuestions
    ) {
        const pdfRow =
            pdfMap.get(
                integer(
                    question.question_number
                )
            );

        if (
            !pdfRow
        ) {
            continue;
        }

        if (
            marks(
                question.max_marks
            ) <=
                0 &&
            marks(
                pdfRow.max_marks
            ) >
                0
        ) {
            question.max_marks =
                marks(
                    pdfRow.max_marks
                );

            question.mark_source =
                "pdf_structure";
        }

        if (
            (
                !question.question_text ||
                /^Question \d+$/i.test(
                    question.question_text
                )
            ) &&
            pdfRow.question_text
        ) {
            question.question_text =
                pdfRow.question_text;
        }
    }

    const structural =
        structuralAudit({
            questions:
                finalQuestions,

            pdfRows,

            examSubject:
                null,
        });

    console.log(
        "V9 RECONSTRUCTED MISSING AI QUESTIONS:",
        reconstructed
    );

    console.log(
        "V9 REJECTED AI QUESTIONS:",
        rejected.map(
            (
                item
            ) => ({
                question_number:
                    item.question
                        ?.question_number,

                reason:
                    item.reason,
            })
        )
    );

    console.log(
        "V9 FINAL RECONCILED QUESTIONS:",
        finalQuestions.map(
            (
                question
            ) => ({
                question_number:
                    question.question_number,

                max_marks:
                    question.max_marks,

                sub_items:
                    Array.isArray(
                        question.sub_items
                    )
                        ? question.sub_items.length
                        : 0,

                pdf_evidence:
                    question.pdf_evidence,
            })
        )
    );

    return {
        questions:
            finalQuestions,

        pdfRows,

        detectedNumbers,

        reconstructed,

        rejected,

        structural,
    };
};

/* ============================================================
   CONFIDENCE FALLBACK
============================================================ */

const deriveConfidence = (
    question
) => {
    let score =
        50;

    if (
        marks(
            question?.max_marks
        ) >
        0
    ) {
        score +=
            10;
    }

    if (
        text(
            question?.question_text
        )
    ) {
        score +=
            10;
    }

    if (
        text(
            question?.answer_expected
        )
    ) {
        score +=
            10;
    }

    if (
        text(
            question?.topic
        )
    ) {
        score +=
            5;
    }

    if (
        text(
            question?.difficulty_level
        )
    ) {
        score +=
            5;
    }

    if (
        question?.pdf_evidence
    ) {
        score +=
            10;
    }

    return clamp100(
        score
    );
};

/* ============================================================
   APPLY METADATA AUDIT
============================================================ */

const applyMetadataAudit = (
    questions,
    metadata
) => {
    if (
        !Array.isArray(
            metadata?.questions
        )
    ) {
        return questions;
    }

    const metadataMap =
        new Map();

    for (
        const question of
            metadata.questions
    ) {
        const numberValue =
            mainNumber(
                question?.question_number,
                0
            );

        if (
            numberValue >
            0
        ) {
            metadataMap.set(
                numberValue,
                question
            );
        }
    }

    return (
        questions ||
        []
    ).map(
        (
            question
        ) => {
            const repair =
                metadataMap.get(
                    integer(
                        question.question_number
                    )
                );

            if (
                !repair
            ) {
                return question;
            }

            return {
                ...question,

                topic:
                    nullable(
                        repair.topic
                    ) ||
                    question.topic,

                sub_topic:
                    nullable(
                        repair.sub_topic
                    ) ||
                    question.sub_topic,

                difficulty_level:
                    nullable(
                        repair.difficulty_level
                    ) ||
                    question.difficulty_level,

                bloom_level:
                    nullable(
                        repair.bloom_level
                    ) ||
                    question.bloom_level,

                question_type:
                    nullable(
                        repair.question_type
                    ) ||
                    question.question_type,

                answer_expected:
                    nullable(
                        repair.answer_expected
                    ) ||
                    question.answer_expected,

                ai_confidence:
                    normalizeConfidence(
                        repair.ai_confidence
                    ) ||
                    normalizeConfidence(
                        question.ai_confidence
                    ),

                ai_explanation:
                    nullable(
                        repair.ai_explanation
                    ) ||
                    question.ai_explanation,
            };
        }
    );
};

/* ============================================================
   FINAL CONFIDENCE
============================================================ */

const applyConfidenceFallback = (
    questions
) =>
    (
        questions ||
        []
    ).map(
        (
            question
        ) => ({
            ...question,

            ai_confidence:
                normalizeConfidence(
                    question.ai_confidence
                ) ||
                deriveConfidence(
                    question
                ),

            sub_items:
                Array.isArray(
                    question.sub_items
                )
                    ? question.sub_items.map(
                          (
                              item
                          ) => ({
                              ...item,

                              ai_confidence:
                                  normalizeConfidence(
                                      item.ai_confidence
                                  ) ||
                                  deriveConfidence(
                                      item
                                  ),
                          })
                      )
                    : [],
        })
    );

/* ============================================================
   FINAL STRUCTURAL QUALITY SCORE
============================================================ */

const calculateFinalQualityScore = ({
    structural,
    questions,
    aiQuality,
    syllabusCoverage,
}) => {
    let score =
        clamp100(
            aiQuality,
            50
        );

    /*
     * Structural correctness has priority over Gemini's self-score.
     */

    if (
        structural?.expected?.length
    ) {
        const expectedCount =
            structural.expected.length;

        const actualCount =
            structural.actual.length;

        const missingCount =
            structural.missing.length;

        const extraCount =
            structural.extra.length;

        const completeness =
            expectedCount >
            0
                ? actualCount /
                  expectedCount
                : 0;

        score =
            Math.min(
                score,
                Math.round(
                    completeness *
                        100
                )
            );

        if (
            missingCount >
            0
        ) {
            score =
                Math.min(
                    score,
                    Math.max(
                        0,
                        100 -
                            missingCount *
                                15
                    )
                );
        }

        if (
            extraCount >
            0
        ) {
            score =
                Math.min(
                    score,
                    Math.max(
                        0,
                        100 -
                            extraCount *
                                20
                    )
                );
        }

        if (
            structural.totalMismatch >
            0
        ) {
            const configured =
                structural.configuredFullMarks ||
                0;

            const mismatch =
                structural.totalMismatch;

            const ratio =
                configured >
                0
                    ? mismatch /
                      configured
                    : 1;

            score =
                Math.min(
                    score,
                    ratio >
                        0.05
                        ? 70
                        : 90
                );
        }
    }

    /*
     * A zero-mark question is structurally unresolved.
     */

    const zeroMarkCount =
        (
            questions ||
            []
        ).filter(
            (
                q
            ) =>
                marks(
                    q.max_marks
                ) <=
                0
        ).length;

    if (
        zeroMarkCount >
        0
    ) {
        score =
            Math.min(
                score,
                Math.max(
                    0,
                    90 -
                        zeroMarkCount *
                            10
                )
            );
    }

    /*
     * Syllabus coverage is kept separate from structural correctness.
     */

    if (
        Number.isFinite(
            Number(
                syllabusCoverage
            )
        )
    ) {
        score =
            Math.round(
                (
                    score +
                    clamp100(
                        syllabusCoverage
                    )
                ) /
                    2
            );
    }

    /*
     * ABSOLUTE SAFETY:
     *
     * Structural problems cannot receive 99/100.
     */

    if (
        structural?.missing?.length ||
        structural?.extra?.length ||
        structural?.totalMismatch >
            0 ||
        zeroMarkCount >
            0
    ) {
        score =
            Math.min(
                score,
                89
            );
    }

    return clamp100(
        Math.round(
            score
        )
    );
};

/* ============================================================
   TOTAL MARK CALCULATION
============================================================ */

const calculateQuestionTotal = (
    questions
) =>
    (
        questions ||
        []
    ).reduce(
        (
            total,
            question
        ) =>
            total +
            marks(
                question.max_marks
            ),
        0
    );

/* ============================================================
   SUMMARY BUILDER
============================================================ */

const buildStructuralSummary = ({
    questions,
    structural,
}) => {
    const questionCount =
        (
            questions ||
            []
        ).length;

    const totalMarks =
        calculateQuestionTotal(
            questions
        );

    const missing =
        structural?.missing ||
        [];

    const extra =
        structural?.extra ||
        [];

    if (
        !missing.length &&
        !extra.length &&
        !structural?.totalMismatch
    ) {
        return `The paper contains ${questionCount} main questions with a reconciled total of ${totalMarks} marks. PDF structure and AI analysis are consistent.`;
    }

    const parts =
        [
            `The paper contains ${questionCount} reconciled main questions with ${totalMarks} marks.`,
        ];

    if (
        missing.length
    ) {
        parts.push(
            `Missing main questions: ${missing.join(
                ", "
            )}.`
        );
    }

    if (
        extra.length
    ) {
        parts.push(
            `Rejected AI-only questions: ${extra.join(
                ", "
            )}.`
        );
    }

    if (
        structural?.totalMismatch
    ) {
        parts.push(
            `Configured full marks differ from reconciled marks by ${structural.totalMismatch}.`
        );
    }

    return parts.join(
        " "
    );
};

// ============================================================
// BLOCK 3 — V9 RECONCILIATION + DETERMINISTIC STRUCTURE
// ============================================================

const normalizeQuestionNumber = (
    value
) => {
    const n = mainNumber(value);

    if (
        n === null ||
        n === undefined ||
        Number.isNaN(Number(n))
    ) {
        return null;
    }

    return String(
        Number(n)
    );
};


// ============================================================
// EXTRACT QUESTION NUMBER FROM ANY VALUE
// ============================================================

const extractQuestionNumber = (
    value
) => {
    if (
        value === null ||
        value === undefined
    ) {
        return null;
    }

    const raw = String(
        value
    ).trim();

    if (!raw) {
        return null;
    }

    const direct =
        normalizeQuestionNumber(
            raw
        );

    if (direct !== null) {
        return direct;
    }

    const match =
        raw.match(
            /^\s*(\d{1,3})\s*(?:[.)\-:]|\s|$)/
        );

    if (!match) {
        return null;
    }

    return String(
        Number(
            match[1]
        )
    );
};


// ============================================================
// QUESTION MAP
// ============================================================

const createQuestionMap = (
    questions = []
) => {
    const map =
        new Map();

    for (
        const question of questions
    ) {
        if (
            !question ||
            typeof question !== "object"
        ) {
            continue;
        }

        const number =
            extractQuestionNumber(
                question.question_number ??
                question.number ??
                question.question ??
                question.id
            );

        if (
            number === null
        ) {
            continue;
        }

        const existing =
            map.get(
                number
            );

        if (!existing) {
            map.set(
                number,
                {
                    ...question,
                    question_number:
                        number,
                }
            );

            continue;
        }

        // ----------------------------------------------------
        // MERGE DUPLICATE REPRESENTATIONS
        // ----------------------------------------------------

        const existingMarks =
            marks(
                existing.marks ??
                existing.max_marks ??
                existing.total_marks
            );

        const incomingMarks =
            marks(
                question.marks ??
                question.max_marks ??
                question.total_marks
            );

        if (
            incomingMarks >
            existingMarks
        ) {
            existing.marks =
                incomingMarks;
        }

        const existingText =
            text(
                existing.question_text ??
                existing.text ??
                existing.question
            );

        const incomingText =
            text(
                question.question_text ??
                question.text ??
                question.question
            );

        if (
            incomingText.length >
            existingText.length
        ) {
            existing.question_text =
                incomingText;
        }

        if (
            question.section &&
            !existing.section
        ) {
            existing.section =
                question.section;
        }

        if (
            question.type &&
            !existing.type
        ) {
            existing.type =
                question.type;
        }

        if (
            question.selection_required !==
                undefined &&
            question.selection_required !==
                null
        ) {
            existing.selection_required =
                question.selection_required;
        }

        if (
            question.selection_count !==
                undefined &&
            question.selection_count !==
                null
        ) {
            existing.selection_count =
                question.selection_count;
        }

        if (
            question.selection_total !==
                undefined &&
            question.selection_total !==
                null
        ) {
            existing.selection_total =
                question.selection_total;
        }
    }

    return map;
};


// ============================================================
// SORT QUESTIONS NUMERICALLY
// ============================================================

const sortQuestions =
    (
        questions = []
    ) => {
        return [
            ...questions,
        ].sort(
            (
                a,
                b
            ) => {
                const an =
                    Number(
                        extractQuestionNumber(
                            a?.question_number ??
                            a?.number ??
                            a?.question
                        )
                    );

                const bn =
                    Number(
                        extractQuestionNumber(
                            b?.question_number ??
                            b?.number ??
                            b?.question
                        )
                    );

                return an - bn;
            }
        );
    };


// ============================================================
// NORMALIZE ONE QUESTION
// ============================================================

const normalizeQuestion =
    (
        question,
        source = "unknown"
    ) => {
        if (
            !question ||
            typeof question !==
                "object"
        ) {
            return null;
        }

        const questionNumber =
            extractQuestionNumber(
                question.question_number ??
                question.number ??
                question.question
            );

        if (
            questionNumber === null
        ) {
            return null;
        }

        const questionText =
            text(
                question.question_text ??
                question.text ??
                question.question ??
                question.prompt ??
                ""
            );

        const questionMarks =
            marks(
                question.marks ??
                question.max_marks ??
                question.total_marks ??
                question.full_marks ??
                0
            );

        const normalized = {
            ...question,

            question_number:
                questionNumber,

            question_text:
                questionText,

            marks:
                questionMarks,

            max_marks:
                questionMarks,

            source,
        };

        // ----------------------------------------------------
        // NORMALIZE SECTION
        // ----------------------------------------------------

        if (
            normalized.section
        ) {
            normalized.section =
                text(
                    normalized.section
                ).toUpperCase();
        }

        // ----------------------------------------------------
        // NORMALIZE SELECTION
        // ----------------------------------------------------

        if (
            normalized.selection_required !==
                undefined
        ) {
            normalized.selection_required =
                Boolean(
                    normalized.selection_required
                );
        }

        if (
            normalized.selection_count !==
                undefined &&
            normalized.selection_count !==
                null
        ) {
            normalized.selection_count =
                integer(
                    normalized.selection_count,
                    0
                );
        }

        if (
            normalized.selection_total !==
                undefined &&
            normalized.selection_total !==
                null
        ) {
            normalized.selection_total =
                integer(
                    normalized.selection_total,
                    0
                );
        }

        return normalized;
    };


// ============================================================
// NORMALIZE QUESTION COLLECTION
// ============================================================

const normalizeQuestionCollection =
    (
        questions = [],
        source = "unknown"
    ) => {
        const result = [];

        for (
            const question of questions
        ) {
            const normalized =
                normalizeQuestion(
                    question,
                    source
                );

            if (
                normalized
            ) {
                result.push(
                    normalized
                );
            }
        }

        return sortQuestions(
            result
        );
    };


// ============================================================
// BUILD PDF STRUCTURE MAP
// ============================================================

const buildPdfStructureMap =
    (
        pdfStructure = []
    ) => {
        const map =
            new Map();

        for (
            const item of pdfStructure
        ) {
            if (
                !item ||
                typeof item !==
                    "object"
            ) {
                continue;
            }

            const number =
                extractQuestionNumber(
                    item.question_number ??
                    item.number ??
                    item.question
                );

            if (
                number === null
            ) {
                continue;
            }

            const existing =
                map.get(
                    number
                );

            if (!existing) {
                map.set(
                    number,
                    {
                        ...item,
                        question_number:
                            number,
                    }
                );

                continue;
            }

            const currentMarks =
                marks(
                    existing.marks ??
                    existing.max_marks
                );

            const incomingMarks =
                marks(
                    item.marks ??
                    item.max_marks
                );

            if (
                incomingMarks >
                currentMarks
            ) {
                existing.marks =
                    incomingMarks;
            }

            const currentText =
                text(
                    existing.question_text ??
                    existing.text
                );

            const incomingText =
                text(
                    item.question_text ??
                    item.text
                );

            if (
                incomingText.length >
                currentText.length
            ) {
                existing.question_text =
                    incomingText;
            }
        }

        return map;
    };


// ============================================================
// RECONCILE ONE QUESTION
// ============================================================

const reconcileSingleQuestion =
    (
        pdfQuestion,
        aiQuestion
    ) => {
        const pdf =
            pdfQuestion ||
            {};

        const ai =
            aiQuestion ||
            {};

        const number =
            extractQuestionNumber(
                pdf.question_number ??
                ai.question_number ??
                pdf.number ??
                ai.number
            );

        if (
            number === null
        ) {
            return null;
        }

        const pdfText =
            text(
                pdf.question_text ??
                pdf.text ??
                pdf.question ??
                ""
            );

        const aiText =
            text(
                ai.question_text ??
                ai.text ??
                ai.question ??
                ai.prompt ??
                ""
            );

        const finalText =
            pdfText.length >=
            aiText.length
                ? pdfText
                : aiText;

        const pdfMarks =
            marks(
                pdf.marks ??
                pdf.max_marks ??
                pdf.total_marks
            );

        const aiMarks =
            marks(
                ai.marks ??
                ai.max_marks ??
                ai.total_marks ??
                ai.full_marks
            );

        /*
         * PDF structure has priority for marks.
         * Gemini can explain/classify, but it must not
         * silently redefine the paper structure.
         */
        const finalMarks =
            pdfMarks > 0
                ? pdfMarks
                : aiMarks;

        const result = {
            ...ai,
            ...pdf,

            question_number:
                number,

            question_text:
                finalText,

            marks:
                finalMarks,

            max_marks:
                finalMarks,

            source:
                pdfQuestion
                    ? (
                        aiQuestion
                            ? "pdf+ai"
                            : "pdf"
                    )
                    : "ai",

            structure_verified:
                Boolean(
                    pdfQuestion
                ),
        };

        // ----------------------------------------------------
        // AI INTERPRETATION FIELDS
        // ----------------------------------------------------

        if (
            ai.bloom_level
        ) {
            result.bloom_level =
                ai.bloom_level;
        }

        if (
            ai.topic
        ) {
            result.topic =
                ai.topic;
        }

        if (
            ai.expected_answer
        ) {
            result.expected_answer =
                ai.expected_answer;
        }

        if (
            ai.assessment_type
        ) {
            result.assessment_type =
                ai.assessment_type;
        }

        if (
            ai.difficulty
        ) {
            result.difficulty =
                ai.difficulty;
        }

        // ----------------------------------------------------
        // SELECTION DATA
        // ----------------------------------------------------

        if (
            pdf.selection_required !==
                undefined
        ) {
            result.selection_required =
                Boolean(
                    pdf.selection_required
                );
        } else if (
            ai.selection_required !==
                undefined
        ) {
            result.selection_required =
                Boolean(
                    ai.selection_required
                );
        }

        if (
            pdf.selection_count !==
                undefined &&
            pdf.selection_count !==
                null
        ) {
            result.selection_count =
                integer(
                    pdf.selection_count,
                    0
                );
        } else if (
            ai.selection_count !==
                undefined &&
            ai.selection_count !==
                null
        ) {
            result.selection_count =
                integer(
                    ai.selection_count,
                    0
                );
        }

        if (
            pdf.selection_total !==
                undefined &&
            pdf.selection_total !==
                null
        ) {
            result.selection_total =
                integer(
                    pdf.selection_total,
                    0
                );
        } else if (
            ai.selection_total !==
                undefined &&
            ai.selection_total !==
                null
        ) {
            result.selection_total =
                integer(
                    ai.selection_total,
                    0
                );
        }

        return result;
    };


// ============================================================
// RECONCILE PDF + GEMINI
// ============================================================

const deterministicReconcile =
    ({
        pdfQuestions = [],
        aiQuestions = [],
    } = {}) => {
        const pdfNormalized =
            normalizeQuestionCollection(
                pdfQuestions,
                "pdf"
            );

        const aiNormalized =
            normalizeQuestionCollection(
                aiQuestions,
                "ai"
            );

        const pdfMap =
            createQuestionMap(
                pdfNormalized
            );

        const aiMap =
            createQuestionMap(
                aiNormalized
            );

        const allNumbers =
            unique(
                [
                    ...pdfMap.keys(),
                    ...aiMap.keys(),
                ]
            ).sort(
                (
                    a,
                    b
                ) =>
                    Number(a) -
                    Number(b)
            );

        const reconciled = [];

        const missingFromAI = [];

        const inventedByAI = [];

        const matched = [];

        for (
            const number of allNumbers
        ) {
            const pdfQuestion =
                pdfMap.get(
                    number
                );

            const aiQuestion =
                aiMap.get(
                    number
                );

            // ------------------------------------------------
            // PDF EXISTS
            // ------------------------------------------------

            if (
                pdfQuestion
            ) {
                const merged =
                    reconcileSingleQuestion(
                        pdfQuestion,
                        aiQuestion
                    );

                if (
                    merged
                ) {
                    reconciled.push(
                        merged
                    );
                }

                if (
                    !aiQuestion
                ) {
                    missingFromAI.push(
                        number
                    );
                } else {
                    matched.push(
                        number
                    );
                }

                continue;
            }

            // ------------------------------------------------
            // AI ONLY = POTENTIALLY INVENTED
            // ------------------------------------------------

            if (
                aiQuestion
            ) {
                inventedByAI.push(
                    number
                );
            }
        }

        return {
            questions:
                sortQuestions(
                    reconciled
                ),

            pdfQuestionNumbers:
                [
                    ...pdfMap.keys(),
                ].sort(
                    (
                        a,
                        b
                    ) =>
                        Number(a) -
                        Number(b)
                ),

            aiQuestionNumbers:
                [
                    ...aiMap.keys(),
                ].sort(
                    (
                        a,
                        b
                    ) =>
                        Number(a) -
                        Number(b)
                ),

            missingFromAI,

            inventedByAI,

            matched,

            pdfCount:
                pdfMap.size,

            aiCount:
                aiMap.size,

            reconciledCount:
                reconciled.length,
        };
    };


// ============================================================
// STRUCTURAL COMPLETENESS
// ============================================================

const calculateStructuralCompleteness =
    (
        reconciliation
    ) => {
        const pdfCount =
            number(
                reconciliation?.pdfCount,
                0
            );

        const matched =
            number(
                reconciliation?.matched?.length,
                0
            );

        if (
            pdfCount <= 0
        ) {
            return 0;
        }

        return clamp100(
            (
                matched /
                pdfCount
            ) *
            100
        );
    };


// ============================================================
// STRUCTURAL CONSISTENCY
// ============================================================

const calculateStructuralConsistency =
    (
        reconciliation
    ) => {
        if (
            !reconciliation
        ) {
            return 0;
        }

        const pdfCount =
            number(
                reconciliation.pdfCount,
                0
            );

        const missing =
            number(
                reconciliation
                    .missingFromAI
                    ?.length,
                0
            );

        const invented =
            number(
                reconciliation
                    .inventedByAI
                    ?.length,
                0
            );

        if (
            pdfCount <= 0
        ) {
            return 0;
        }

        let score =
            100;

        score -=
            missing *
            15;

        score -=
            invented *
            20;

        return clamp100(
            score
        );
    };


// ============================================================
// TOTAL MARKS FROM RECONCILED STRUCTURE
// ============================================================

const calculateReconciledMarks =
    (
        questions = []
    ) => {
        return questions.reduce(
            (
                total,
                question
            ) => {
                const value =
                    marks(
                        question?.marks ??
                        question?.max_marks
                    );

                return (
                    total +
                    value
                );
            },
            0
        );
    };


// ============================================================
// FULL-MARKS CONSISTENCY
// ============================================================

const calculateMarksConsistency =
    (
        calculatedMarks,
        configuredFullMarks
    ) => {
        const actual =
            number(
                calculatedMarks,
                0
            );

        const expected =
            number(
                configuredFullMarks,
                0
            );

        if (
            expected <= 0
        ) {
            return 100;
        }

        if (
            actual === expected
        ) {
            return 100;
        }

        const difference =
            Math.abs(
                actual -
                expected
            );

        const percentage =
            (
                difference /
                expected
            ) *
            100;

        return clamp100(
            100 -
            percentage
        );
    };


// ============================================================
// FINAL STRUCTURAL AUDIT
// ============================================================

const runFinalStructuralAudit =
    ({
        reconciliation,
        questions,
        configuredFullMarks,
    } = {}) => {
        const calculatedMarks =
            calculateReconciledMarks(
                questions
            );

        const completeness =
            calculateStructuralCompleteness(
                reconciliation
            );

        const consistency =
            calculateStructuralConsistency(
                reconciliation
            );

        const marksConsistency =
            calculateMarksConsistency(
                calculatedMarks,
                configuredFullMarks
            );

        const missing =
            reconciliation
                ?.missingFromAI ??
            [];

        const invented =
            reconciliation
                ?.inventedByAI ??
            [];

        const pdfCount =
            number(
                reconciliation?.pdfCount,
                0
            );

        const reconciledCount =
            number(
                reconciliation
                    ?.reconciledCount,
                0
            );

        const structuralPass =
            pdfCount > 0 &&
            missing.length === 0 &&
            invented.length === 0 &&
            reconciledCount ===
                pdfCount;

        return {
            structuralPass,

            pdfQuestionCount:
                pdfCount,

            reconciledQuestionCount:
                reconciledCount,

            missingFromAI:
                missing,

            inventedByAI:
                invented,

            calculatedMarks,

            configuredFullMarks:
                number(
                    configuredFullMarks,
                    0
                ),

            completeness:
                Math.round(
                    completeness
                ),

            consistency:
                Math.round(
                    consistency
                ),

            marksConsistency:
                Math.round(
                    marksConsistency
                ),
        };
    };


// ============================================================
// HARD STRUCTURAL QUALITY FLOOR
// ============================================================

const applyStructuralQualityFloor =
    (
        qualityScore,
        audit
    ) => {
        let score =
            clamp100(
                qualityScore
            );

        if (
            !audit?.structuralPass
        ) {
            score =
                Math.min(
                    score,
                    79
                );
        }

        if (
            audit?.missingFromAI
                ?.length > 0
        ) {
            score =
                Math.min(
                    score,
                    69
                );
        }

        if (
            audit?.inventedByAI
                ?.length > 0
        ) {
            score =
                Math.min(
                    score,
                    59
                );
        }

        if (
            audit?.marksConsistency <
            100
        ) {
            score =
                Math.min(
                    score,
                    Math.max(
                        0,
                        audit.marksConsistency
                    )
                );
        }

        if (
            audit?.completeness <
            100
        ) {
            score =
                Math.min(
                    score,
                    audit.completeness
                );
        }

        return Math.round(
            clamp100(
                score
            )
        );
    };


// ============================================================
// QUESTION STRUCTURE FINGERPRINT
// ============================================================

const questionStructureFingerprint =
    (
        questions = []
    ) => {
        return sortQuestions(
            questions
        )
            .map(
                (
                    question
                ) => {
                    const number =
                        extractQuestionNumber(
                            question?.question_number
                        );

                    const mark =
                        marks(
                            question?.marks ??
                            question?.max_marks
                        );

                    return `${number}:${mark}`;
                }
            )
            .join("|");
    };


// ============================================================
// QUESTION NUMBER GAP DETECTION
// ============================================================

const detectQuestionNumberGaps =
    (
        questions = []
    ) => {
        const numbers =
            sortQuestions(
                questions
            )
                .map(
                    (
                        question
                    ) =>
                        Number(
                            extractQuestionNumber(
                                question?.question_number
                            )
                        )
                )
                .filter(
                    (
                        n
                    ) =>
                        Number.isFinite(
                            n
                        )
                );

        if (
            numbers.length < 2
        ) {
            return [];
        }

        const gaps = [];

        for (
            let i = 0;
            i <
                numbers.length -
                    1;
            i++
        ) {
            const current =
                numbers[i];

            const next =
                numbers[i + 1];

            if (
                next >
                current + 1
            ) {
                for (
                    let n =
                        current + 1;
                    n <
                        next;
                    n++
                ) {
                    gaps.push(
                        String(n)
                    );
                }
            }
        }

        return gaps;
    };


// ============================================================
// STRUCTURE REPORT
// ============================================================

const buildStructureReport =
    ({
        reconciliation,
        questions,
        configuredFullMarks,
    } = {}) => {
        const audit =
            runFinalStructuralAudit(
                {
                    reconciliation,
                    questions,
                    configuredFullMarks,
                }
            );

        const gaps =
            detectQuestionNumberGaps(
                questions
            );

        return {
            ...audit,

            questionNumberGaps:
                gaps,

            questionCount:
                questions.length,

            marksTotal:
                calculateReconciledMarks(
                    questions
                ),

            fingerprint:
                questionStructureFingerprint(
                    questions
                ),
        };
    };


// ============================================================
// FINALIZE QUESTION ARRAY
// ============================================================

const finalizeQuestionStructure =
    ({
        pdfQuestions = [],
        aiQuestions = [],
        configuredFullMarks = 0,
    } = {}) => {
        const reconciliation =
            deterministicReconcile(
                {
                    pdfQuestions,
                    aiQuestions,
                }
            );

        const questions =
            reconciliation.questions;

        const structureReport =
            buildStructureReport(
                {
                    reconciliation,
                    questions,
                    configuredFullMarks,
                }
            );

        return {
            questions,

            reconciliation,

            structureReport,
        };
    };


// ============================================================
// SAFE JSON SERIALIZATION
// ============================================================

const safeJson =
    (
        value
    ) => {
        try {
            return JSON.stringify(
                value
            );
        } catch {
            return "{}";
        }
    };


// ============================================================
// LOG STRUCTURAL RECONCILIATION
// ============================================================

const logStructuralReconciliation =
    (
        report
    ) => {
        console.log(
            "============================================================"
        );

        console.log(
            "V9 STRUCTURAL RECONCILIATION"
        );

        console.log(
            "PDF QUESTIONS:",
            report?.pdfQuestionCount
        );

        console.log(
            "RECONCILED QUESTIONS:",
            report?.reconciledQuestionCount
        );

        console.log(
            "CALCULATED MARKS:",
            report?.calculatedMarks
        );

        console.log(
            "CONFIGURED FULL MARKS:",
            report?.configuredFullMarks
        );

        console.log(
            "COMPLETENESS:",
            report?.completeness
        );

        console.log(
            "STRUCTURAL CONSISTENCY:",
            report?.consistency
        );

        console.log(
            "MARKS CONSISTENCY:",
            report?.marksConsistency
        );

        console.log(
            "STRUCTURAL PASS:",
            report?.structuralPass
        );

        console.log(
            "MISSING FROM AI:",
            safeJson(
                report?.missingFromAI ??
                []
            )
        );

        console.log(
            "INVENTED BY AI:",
            safeJson(
                report?.inventedByAI ??
                []
            )
        );

        console.log(
            "QUESTION GAPS:",
            safeJson(
                report?.questionNumberGaps ??
                []
            )
        );

        console.log(
            "============================================================"
        );
    };


// ============================================================
// END BLOCK 3
// ============================================================