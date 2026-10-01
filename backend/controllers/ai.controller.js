import crypto from "crypto";
import { supabase } from "../config/supabase.js";
import { readPDF } from "../services/pdfReader.js";
import { askGemini } from "../services/gemini.service.js";

const CONTROLLER_VERSION =
    "MAIN-QUESTION-GROUPING-V6";

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

    /*
     * Gemini mara nyingi hurudisha
     * 0.95 badala ya 95.
     */
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
    const match =
        text(
            value
        ).match(
            /^(?:question\s*)?\d{1,3}\s*(?:[.)\-:]\s*)?\(?\s*([a-z]|[ivxlcdm]+)\s*\)?/i
        );

    return match
        ? match[1].toLowerCase()
        : "";
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
        const match =
            line.match(
                /^\s*(?:question\s*)?(\d{1,3})\s*[.)\-:]/i
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
   SECTION / SELECTION EVIDENCE
============================================================ */

const sectionTotalsFromPdf = (
    pdf
) => {
    const value =
        cleanPdf(
            pdf
        ).replace(
            /\s+/g,
            " "
        );

    const output =
        {};

    for (
        const section of
            [
                "A",
                "B",
                "C",
                "D",
                "E",
            ]
    ) {
        const match =
            value.match(
                new RegExp(
                    `SECTION\\s*${section}[\\s\\S]{0,300}?(\\d+(?:\\.\\d+)?)\\s*MARKS?`,
                    "i"
                )
            );

        if (
            match
        ) {
            output[
                section
            ] =
                marks(
                    match[1]
                );
        }
    }

    return output;
};

const selectionFromPdf = (
    pdf
) => {
    const value =
        cleanPdf(
            pdf
        ).replace(
            /\s+/g,
            " "
        );

    const sectionPattern =
        /SECTION\s+([A-Z])[\s\S]{0,400}?(?:answer|attempt|choose|select)\s+(?:any|only)?\s*(\d+)\s+(?:questions?|items?)[\s\S]{0,120}?(?:from|out of)\s+(?:the\s+)?(\d+)/i;

    const globalPattern =
        /(?:answer|attempt|choose|select)\s+(?:any|only)?\s*(\d+)\s+(?:questions?|items?)[\s\S]{0,120}?(?:from|out of)\s+(?:the\s+)?(\d+)/i;

    const sectionMatch =
        value.match(
            sectionPattern
        );

    if (
        sectionMatch
    ) {
        return {
            section:
                sectionMatch[1].toUpperCase(),

            count:
                integer(
                    sectionMatch[2]
                ),

            total:
                integer(
                    sectionMatch[3]
                ),

            instruction:
                sectionMatch[0],
        };
    }

    const globalMatch =
        value.match(
            globalPattern
        );

    if (
        globalMatch
    ) {
        return {
            section:
                null,

            count:
                integer(
                    globalMatch[1]
                ),

            total:
                integer(
                    globalMatch[2]
                ),

            instruction:
                globalMatch[0],
        };
    }

    return null;
};

/* ============================================================
   NORMALIZE AI QUESTION
============================================================ */

const normalizeQuestion = (
    question,
    index
) => {
    const rawNumber =
        text(
            question?.question_number ??
                question?.questionNumber ??
                question?.number
        ) ||
        String(
            index + 1
        );

    const numberValue =
        mainNumber(
            rawNumber,
            index + 1
        );

    const instruction =
        nullable(
            question?.selection_instruction ??
                question?.selectionInstruction ??
                question?.instruction
        );

    const explicitSelective =
        question?.is_selective ??
        question?.selective;

    const selective =
        typeof explicitSelective !==
        "undefined"
            ? Boolean(
                  explicitSelective
              )
            : !!instruction &&
              /(?:answer|attempt|choose|select)\s+(?:any|only)?\s*(?:one|two|three|four|five|\d+)/i.test(
                  instruction
              );

    return {
        question_number:
            numberValue,

        raw_question_number:
            rawNumber,

        sub_question_label:
            subLabel(
                rawNumber
            ),

        question_text:
            text(
                question?.question_text ??
                    question?.questionText ??
                    question?.text ??
                    question?.question
            ) ||
            `Question ${numberValue}`,

        topic:
            nullable(
                question?.topic ??
                    question?.main_topic
            ),

        sub_topic:
            nullable(
                question?.sub_topic ??
                    question?.subtopic ??
                    question?.subTopic
            ),

        difficulty_level:
            nullable(
                question?.difficulty_level ??
                    question?.difficulty
            ),

        bloom_level:
            nullable(
                question?.bloom_level ??
                    question?.blooms_level ??
                    question?.bloomsLevel
            ),

        question_type:
            nullable(
                question?.question_type ??
                    question?.type
            ),

        answer_expected:
            nullable(
                question?.answer_expected ??
                    question?.expected_answer ??
                    question?.answer
            ),

        ai_confidence:
            normalizeConfidence(
                question?.ai_confidence ??
                    question?.confidence
            ),

        ai_explanation:
            nullable(
                question?.ai_explanation ??
                    question?.explanation
            ),

        max_marks:
            marks(
                question?.max_marks ??
                    question?.marks ??
                    question?.total_marks
            ),

        mark_source:
            nullable(
                question?.mark_source
            ) ||
            "ai_detected",

        mark_evidence:
            nullable(
                question?.mark_evidence
            ),

        section:
            nullable(
                question?.section
            ),

        section_type:
            nullable(
                question?.section_type ??
                    question?.sectionType
            ),

        is_selective:
            selective,

        selection_required:
            Boolean(
                question?.selection_required ??
                    question?.selectionRequired ??
                    selective
            ),

        selection_count:
            integer(
                question?.selection_count ??
                    question?.selectionCount ??
                    question?.questions_to_answer
            ),

        selection_total:
            integer(
                question?.selection_total ??
                    question?.selectionTotal ??
                    question?.total_group_questions
            ),

        selection_group:
            nullable(
                question?.selection_group ??
                    question?.selectionGroup ??
                    question?.group
            ),

        selection_instruction:
            instruction,
    };
};

/* ============================================================
   AUTHORITATIVE MAIN QUESTION GROUPING
   ------------------------------------------------------------
   IMPORTANT:

   Q1(i), Q1(ii), Q1(iii) => ONE Q1

   Q4(a), Q4(b), Q4(c)    => ONE Q4

   If Gemini gives:

   Q1 {
      sub_items: [...]
   }

   the parent Q1 itself is NOT duplicated as a child.

   If Gemini gives only:

   Q1(i)
   Q1(ii)
   Q1(iii)

   they are merged into ONE Q1 with 3 sub_items.
============================================================ */

const groupMainQuestions = (
    questions,
    sectionTotals
) => {
    const groups =
        new Map();

    for (
        const question of
            Array.isArray(
                questions
            )
                ? questions
                : []
    ) {
        const rawNumber =
            question?.raw_question_number ??
            question?.question_number ??
            "";

        const numberValue =
            mainNumber(
                rawNumber,
                0
            );

        if (
            !numberValue
        ) {
            continue;
        }

        if (
            !groups.has(
                numberValue
            )
        ) {
            groups.set(
                numberValue,
                []
            );
        }

        groups
            .get(
                numberValue
            )
            .push({
                ...question,

                question_number:
                    numberValue,

                raw_question_number:
                    String(
                        rawNumber
                    ),
            });
    }

    return [
        ...groups.entries(),
    ]
        .sort(
            (
                a,
                b
            ) =>
                Number(
                    a[0]
                ) -
                Number(
                    b[0]
                )
        )
        .map(
            ([
                numberValue,
                items,
            ]) => {
                if (
                    !items.length
                ) {
                    return null;
                }

                /*
                 * ------------------------------------------------
                 * FIND REAL PARENT ROW
                 * ------------------------------------------------
                 *
                 * A parent is Q1.
                 *
                 * A child is Q1(i), Q1(ii), Q1(a), etc.
                 */
                const parentItems =
                    items.filter(
                        (
                            item
                        ) => {
                            const raw =
                                text(
                                    item.raw_question_number
                                );

                            const label =
                                text(
                                    item.sub_question_label
                                );

                            const hasSubNumber =
                                /^\s*(?:question\s*)?\d{1,3}\s*(?:\(\s*[a-zivxlcdm0-9]+\s*\)|[.)]\s*[a-zivxlcdm]+)\s*$/i.test(
                                    raw
                                );

                            return (
                                !label &&
                                !hasSubNumber
                            );
                        }
                    );

                const parent =
                    parentItems[0] ||
                    null;

                /*
                 * ------------------------------------------------
                 * CHILD ROWS
                 * ------------------------------------------------
                 */
                const explicitChildren =
                    items.filter(
                        (
                            item
                        ) => {
                            const raw =
                                text(
                                    item.raw_question_number
                                );

                            const label =
                                text(
                                    item.sub_question_label
                                );

                            const hasSubNumber =
                                /^\s*(?:question\s*)?\d{1,3}\s*(?:\(\s*[a-zivxlcdm0-9]+\s*\)|[.)]\s*[a-zivxlcdm]+)\s*$/i.test(
                                    raw
                                );

                            return (
                                Boolean(
                                    label
                                ) ||
                                hasSubNumber
                            );
                        }
                    );

                /*
                 * If there is a real parent AND children,
                 * use children only as sub_items.
                 *
                 * This prevents:
                 *
                 * Q1 parent
                 * Q1(i)
                 * Q1(ii)
                 *
                 * from becoming 3 sub-items.
                 */
                const childRows =
                    explicitChildren.length
                        ? explicitChildren
                        : parent
                        ? []
                        : items;

                const first =
                    parent ||
                    items[0];

                const isMCQ =
                    items.some(
                        (
                            question
                        ) =>
                            /multiple\s*choice|mcq|objective/i.test(
                                text(
                                    question.question_type
                                )
                            )
                    );

                const multiple =
                    childRows.length >
                        0 ||
                    items.length >
                        1;

                const subItems =
                    childRows.map(
                        (
                            question,
                            index
                        ) => {
                            let label =
                                text(
                                    question.sub_question_label
                                );

                            if (
                                !label
                            ) {
                                const raw =
                                    text(
                                        question.raw_question_number
                                    );

                                const match =
                                    raw.match(
                                        /\(\s*([a-z]+|[ivxlcdm]+|\d+)\s*\)/i
                                    );

                                if (
                                    match
                                ) {
                                    label =
                                        match[1].toLowerCase();
                                }
                            }

                            if (
                                !label
                            ) {
                                const raw =
                                    text(
                                        question.raw_question_number
                                    );

                                const match =
                                    raw.match(
                                        /^\s*\d{1,3}\s*[.)]\s*([a-z]+|[ivxlcdm]+|\d+)\b/i
                                    );

                                if (
                                    match
                                ) {
                                    label =
                                        match[1].toLowerCase();
                                }
                            }

                            if (
                                !label &&
                                isMCQ &&
                                multiple
                            ) {
                                label =
                                    roman(
                                        index +
                                            1
                                    );
                            }

                            if (
                                !label &&
                                multiple
                            ) {
                                label =
                                    String(
                                        index +
                                            1
                                    );
                            }

                            return {
                                label:
                                    label ||
                                    null,

                                question_text:
                                    text(
                                        question.question_text
                                    ) ||
                                    null,

                                answer_expected:
                                    question.answer_expected ??
                                    null,

                                topic:
                                    question.topic ??
                                    null,

                                sub_topic:
                                    question.sub_topic ??
                                    null,

                                difficulty_level:
                                    question.difficulty_level ??
                                    null,

                                bloom_level:
                                    question.bloom_level ??
                                    null,

                                question_type:
                                    question.question_type ??
                                    null,

                                ai_confidence:
                                    normalizeConfidence(
                                        question.ai_confidence
                                    ),

                                ai_explanation:
                                    question.ai_explanation ??
                                    null,

                                max_marks:
                                    marks(
                                        question.max_marks
                                    ),

                                is_selective:
                                    Boolean(
                                        question.is_selective
                                    ),

                                selection_required:
                                    Boolean(
                                        question.selection_required
                                    ),

                                selection_count:
                                    integer(
                                        question.selection_count
                                    ),

                                selection_total:
                                    integer(
                                        question.selection_total
                                    ),

                                selection_group:
                                    question.selection_group ??
                                    null,

                                selection_instruction:
                                    question.selection_instruction ??
                                    null,
                            };
                        }
                    );

                /*
                 * ------------------------------------------------
                 * MAIN QUESTION MARKS
                 * ------------------------------------------------
                 */
                let maxMarks =
                    multiple &&
                    subItems.length
                        ? subItems.reduce(
                              (
                                  sum,
                                  item
                              ) =>
                                  sum +
                                  marks(
                                      item.max_marks
                                  ),
                              0
                          )
                        : marks(
                              first.max_marks
                          );

                /*
                 * MCQ STRUCTURE:
                 *
                 * If Gemini incorrectly gives 1.6 marks
                 * for each of 10 MCQs, use section total
                 * where available.
                 */
                if (
                    isMCQ &&
                    subItems.length
                ) {
                    const section =
                        text(
                            first.section
                        ).toUpperCase();

                    const sectionTotal =
                        Number(
                            sectionTotals?.[
                                section
                            ]
                        ) || 0;

                    const allFractional =
                        subItems.length >
                            0 &&
                        subItems.every(
                            (
                                item
                            ) => {
                                const value =
                                    Number(
                                        item.max_marks
                                    );

                                return (
                                    value >
                                        0 &&
                                    value <
                                        2
                                );
                            }
                        );

                    if (
                        sectionTotal >
                            0 &&
                        sectionTotal >=
                            subItems.length &&
                        sectionTotal <=
                            subItems.length +
                                20
                    ) {
                        maxMarks =
                            sectionTotal;
                    } else if (
                        allFractional ||
                        maxMarks <
                            subItems.length
                    ) {
                        maxMarks =
                            subItems.length;
                    }
                }

                /*
                 * ------------------------------------------------
                 * CONFIDENCE
                 * ------------------------------------------------
                 */
                const confidenceValues =
                    (
                        subItems.length
                            ? subItems
                            : [
                                  {
                                      ai_confidence:
                                          first.ai_confidence,
                                  },
                              ]
                    )
                        .map(
                            (
                                item
                            ) =>
                                normalizeConfidence(
                                    item.ai_confidence
                                )
                        )
                        .filter(
                            (
                                value
                            ) =>
                                value >
                                0
                        );

                const averageConfidence =
                    confidenceValues.length
                        ? Math.round(
                              confidenceValues.reduce(
                                  (
                                      a,
                                      b
                                  ) =>
                                      a +
                                      b,
                                  0
                              ) /
                                  confidenceValues.length
                          )
                        : 0;

                /*
                 * ------------------------------------------------
                 * METADATA MERGING
                 * ------------------------------------------------
                 */
                const topics =
                    unique(
                        items
                            .map(
                                (
                                    item
                                ) =>
                                    text(
                                        item.topic
                                    )
                            )
                            .filter(Boolean)
                    );

                const subTopics =
                    unique(
                        items
                            .map(
                                (
                                    item
                                ) =>
                                    text(
                                        item.sub_topic
                                    )
                            )
                            .filter(Boolean)
                    );

                const difficulties =
                    unique(
                        items
                            .map(
                                (
                                    item
                                ) =>
                                    text(
                                        item.difficulty_level
                                    )
                            )
                            .filter(Boolean)
                    );

                const blooms =
                    unique(
                        items
                            .map(
                                (
                                    item
                                ) =>
                                    text(
                                        item.bloom_level
                                    )
                            )
                            .filter(Boolean)
                    );

                const questionTypes =
                    unique(
                        items
                            .map(
                                (
                                    item
                                ) =>
                                    text(
                                        item.question_type
                                    )
                            )
                            .filter(Boolean)
                    );

                const explanations =
                    unique(
                        items
                            .map(
                                (
                                    item
                                ) =>
                                    text(
                                        item.ai_explanation
                                    )
                            )
                            .filter(Boolean)
                    );

                /*
                 * ------------------------------------------------
                 * QUESTION TEXT
                 * ------------------------------------------------
                 */
                let combinedQuestionText =
                    text(
                        first.question_text
                    );

                if (
                    subItems.length
                ) {
                    combinedQuestionText =
                        subItems
                            .map(
                                (
                                    item
                                ) =>
                                    item.question_text
                                        ? `(${item.label || ""}) ${item.question_text}`
                                        : ""
                            )
                            .filter(
                                Boolean
                            )
                            .join(
                                " "
                            );
                }

                /*
                 * ------------------------------------------------
                 * EXPECTED ANSWERS
                 * ------------------------------------------------
                 */
                let combinedAnswers =
                    first.answer_expected ??
                    null;

                if (
                    subItems.length
                ) {
                    combinedAnswers =
                        subItems
                            .map(
                                (
                                    item
                                ) =>
                                    item.answer_expected
                                        ? `(${item.label || ""}) ${item.answer_expected}`
                                        : ""
                            )
                            .filter(
                                Boolean
                            )
                            .join(
                                " | "
                            ) ||
                        null;
                }

                /*
                 * ------------------------------------------------
                 * RETURN ONE MAIN QUESTION
                 * ------------------------------------------------
                 */
                return {
                    ...first,

                    question_number:
                        numberValue,

                    raw_question_number:
                        String(
                            numberValue
                        ),

                    question_text:
                        combinedQuestionText ||
                        `Question ${numberValue}`,

                    answer_expected:
                        combinedAnswers,

                    topic:
                        topics.join(
                            "; "
                        ) ||
                        first.topic ||
                        null,

                    sub_topic:
                        subTopics.join(
                            "; "
                        ) ||
                        first.sub_topic ||
                        null,

                    difficulty_level:
                        difficulties.join(
                            "; "
                        ) ||
                        first.difficulty_level ||
                        null,

                    bloom_level:
                        blooms.join(
                            "; "
                        ) ||
                        first.bloom_level ||
                        null,

                    question_type:
                        questionTypes.join(
                            "; "
                        ) ||
                        first.question_type ||
                        null,

                    ai_confidence:
                        averageConfidence ||
                        normalizeConfidence(
                            first.ai_confidence
                        ),

                    ai_explanation:
                        explanations.join(
                            " "
                        ) ||
                        first.ai_explanation ||
                        null,

                    max_marks:
                        Number(
                            maxMarks
                        ) || 0,

                    sub_items:
                        subItems,

                    is_selective:
                        items.some(
                            (
                                question
                            ) =>
                                Boolean(
                                    question.is_selective
                                )
                        ),

                    selection_required:
                        items.some(
                            (
                                question
                            ) =>
                                Boolean(
                                    question.selection_required
                                )
                        ),

                    selection_count:
                        Math.max(
                            0,
                            ...items.map(
                                (
                                    question
                                ) =>
                                    integer(
                                        question.selection_count
                                    )
                            )
                        ),

                    selection_total:
                        Math.max(
                            0,
                            ...items.map(
                                (
                                    question
                                ) =>
                                    integer(
                                        question.selection_total
                                    )
                            )
                        ),

                    selection_group:
                        unique(
                            items
                                .map(
                                    (
                                        question
                                    ) =>
                                        text(
                                            question.selection_group
                                        )
                                )
                                .filter(
                                    Boolean
                                )
                        ).join(
                            ", "
                        ) ||
                        first.selection_group ||
                        null,

                    selection_instruction:
                        unique(
                            items
                                .map(
                                    (
                                        question
                                    ) =>
                                        text(
                                            question.selection_instruction
                                        )
                                )
                                .filter(
                                    Boolean
                                )
                        ).join(
                            " "
                        ) ||
                        first.selection_instruction ||
                        null,

                    mark_source:
                        isMCQ &&
                        subItems.length
                            ? "derived_from_structure"
                            : first.mark_source,

                    mark_evidence:
                        isMCQ &&
                        subItems.length
                            ? `Question ${numberValue} contains ${subItems.length} multiple-choice items and is stored as one main question.`
                            : first.mark_evidence,
                };
            }
        )
        .filter(
            Boolean
        );
};

/* ============================================================
   FALLBACK CONFIDENCE / QUALITY
============================================================ */

const deriveConfidence = (
    question
) => {
    const fields = [
        question.topic,
        question.sub_topic,
        question.difficulty_level,
        question.bloom_level,
        question.question_type,
        question.max_marks >
            0,
        question.answer_expected,
        question.ai_explanation,
    ];

    const filled =
        fields.filter(
            Boolean
        ).length;

    return Math.min(
        98,
        50 +
            Math.round(
                (
                    filled /
                    fields.length
                ) *
                    48
            )
    );
};

const deriveQuality = (
    questions
) => {
    if (
        !questions.length
    ) {
        return {
            score:
                0,

            explanation:
                "No main questions were identified.",
        };
    }

    const topicCoverage =
        (
            questions.filter(
                (
                    question
                ) =>
                    Boolean(
                        text(
                            question.topic
                        )
                    )
            ).length /
            questions.length
        ) *
        100;

    const metadataCoverage =
        (
            questions.filter(
                (
                    question
                ) =>
                    Boolean(
                        text(
                            question.topic
                        )
                    ) &&
                    Boolean(
                        text(
                            question.sub_topic
                        )
                    ) &&
                    Boolean(
                        text(
                            question.difficulty_level
                        )
                    ) &&
                    Boolean(
                        text(
                            question.bloom_level
                        )
                    ) &&
                    Boolean(
                        text(
                            question.question_type
                        )
                    )
            ).length /
            questions.length
        ) *
        100;

    const marksCoverage =
        (
            questions.filter(
                (
                    question
                ) =>
                    Number(
                        question.max_marks
                    ) >
                    0
            ).length /
            questions.length
        ) *
        100;

    const answerCoverage =
        (
            questions.filter(
                (
                    question
                ) =>
                    Boolean(
                        text(
                            question.answer_expected
                        )
                    )
            ).length /
            questions.length
        ) *
        100;

    const confidenceValues =
        questions
            .map(
                (
                    question
                ) =>
                    normalizeConfidence(
                        question.ai_confidence
                    )
            )
            .filter(
                (
                    value
                ) =>
                    value >
                    0
            );

    const confidence =
        confidenceValues.length
            ? confidenceValues.reduce(
                  (
                      a,
                      b
                  ) =>
                      a +
                      b,
                  0
              ) /
              confidenceValues.length
            : 0;

    const score =
        Math.round(
            topicCoverage *
                0.25 +
                metadataCoverage *
                0.25 +
                marksCoverage *
                0.15 +
                answerCoverage *
                0.15 +
                confidence *
                0.20
        );

    return {
        score:
            clamp100(
                score
            ),

        explanation:
            `Paper quality score ${score}/100. Topic detection ${Math.round(
                topicCoverage
            )}%, metadata completeness ${Math.round(
                metadataCoverage
            )}%, mark identification ${Math.round(
                marksCoverage
            )}%, expected-answer coverage ${Math.round(
                answerCoverage
            )}%, average AI confidence ${Math.round(
                confidence
            )}%.`,
    };
};

/* ============================================================
   GEMINI PRIMARY PROMPT
============================================================ */

const buildPrimaryPrompt = ({
    pdf,
    examName,
    subject,
    level,
    mainNumbers,
    sectionTotals,
    selection,
}) => `
You are an expert Tanzanian secondary-school examination analyst.

READ THE ENTIRE PAPER.

============================================================
MANDATORY MAIN QUESTION RULES
============================================================

The paper's TOP-LEVEL question number is authoritative.

1(i), 1(ii), 1(iii), 1(iv) ... 1(x)
are ONE main Question 1.

4(a), 4(b), 4(c)
are ONE main Question 4.

DO NOT count Roman-numeral or lettered sub-items as new
main questions.

If Question 1 contains ten sub-items, return:

Question 1
  sub_items:
    i
    ii
    iii
    iv
    v
    vi
    vii
    viii
    ix
    x

DO NOT return ten separate top-level questions.

Only a NEW top-level number begins a new main question.

For example:

1(i)
1(ii)
1(iii)
2
3(a)
3(b)
4

means exactly:

Question 1
Question 2
Question 3
Question 4

NOT:

Question 1
Question 1
Question 1
Question 2
Question 3
Question 3
Question 4

============================================================
MARKING RULES
============================================================

Use the actual paper structure.

If Question 1 has ten one-mark multiple-choice items:

Question 1 = 10 marks.

Do NOT divide a section total into strange fractions such as
1.6 marks per MCQ unless the paper explicitly says so.

For structured questions, add the marks of the sub-parts.

For selective questions:

If candidates answer 2 of 3 questions worth 15 marks each:

each optional question = 15 marks;

effective contribution = 30 marks.

============================================================
ANALYSIS REQUIRED
============================================================

For every MAIN question determine:

- topic
- sub-topic
- difficulty
- Bloom taxonomy level
- question type
- expected answer
- AI confidence 0-100
- AI explanation

For sub-items, place their individual analysis inside
sub_items.

For the WHOLE paper determine:

- summary
- quality_score 0-100
- quality_explanation
- syllabus_coverage 0-100
- topics_found
- weak_topics
- strong_topics
- blooms_distribution
- recommendations
- teacher_comments

============================================================
EXAMINATION
============================================================

NAME:
${examName}

SUBJECT:
${subject}

LEVEL:
${level}

TOP LEVEL NUMBERS DETECTED FROM PDF:
${JSON.stringify(
    mainNumbers
)}

SECTION TOTALS:
${JSON.stringify(
    sectionTotals
)}

SELECTION EVIDENCE:
${JSON.stringify(
    selection ||
        null
)}

============================================================
RETURN ONLY JSON
============================================================

{
  "summary":"",
  "quality_score":0,
  "quality_explanation":"",
  "syllabus_coverage":0,
  "difficulty":"",
  "topics_found":[],
  "weak_topics":[],
  "strong_topics":[],
  "recommendations":[],
  "teacher_comments":"",
  "blooms_distribution":{},
  "instructions":[],
  "questions":[
    {
      "question_number":"1",
      "question_text":"",
      "section":"A",
      "section_type":"compulsory",
      "max_marks":10,
      "mark_source":"",
      "mark_evidence":"",
      "topic":"",
      "sub_topic":"",
      "difficulty_level":"",
      "bloom_level":"",
      "question_type":"Multiple Choice",
      "answer_expected":"",
      "ai_confidence":95,
      "ai_explanation":"",
      "is_selective":false,
      "selection_required":false,
      "selection_count":0,
      "selection_total":0,
      "selection_group":"",
      "selection_instruction":"",
      "sub_items":[
        {
          "label":"i",
          "question_text":"",
          "answer_expected":"",
          "topic":"",
          "sub_topic":"",
          "difficulty_level":"",
          "bloom_level":"",
          "question_type":"Multiple Choice",
          "ai_confidence":95,
          "ai_explanation":"",
          "max_marks":1
        }
      ]
    }
  ]
}

============================================================
FULL PAPER
============================================================

${pdf}
`;

/* ============================================================
   GEMINI METADATA PROMPT
============================================================ */

const buildMetadataPrompt = ({
    pdf,
    questions,
}) => `
You are auditing the metadata of an examination paper.

DO NOT create new main questions.

DO NOT split:

1(i), 1(ii), 1(iii)

or

4(a), 4(b), 4(c).

Each belongs to its parent main question.

Return ONLY JSON.

{
  "quality_score":0,
  "quality_explanation":"",
  "syllabus_coverage":0,
  "topics_found":[],
  "weak_topics":[],
  "strong_topics":[],
  "teacher_comments":"",
  "questions":[
    {
      "question_number":1,
      "topic":"",
      "sub_topic":"",
      "difficulty_level":"",
      "bloom_level":"",
      "question_type":"",
      "answer_expected":"",
      "ai_confidence":95,
      "ai_explanation":""
    }
  ]
}

CURRENT MAIN QUESTIONS:

${questions
    .map(
        (
            question
        ) =>
            `Q${question.question_number}: ${question.question_text}`
    )
    .join(
        "\n"
    )}

FULL PAPER:

${pdf}
`;

/* ============================================================
   DB HELPERS
============================================================ */

const loadExamSubject =
    async (
        id
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
                    id
                )
                .maybeSingle();

        supabaseError(
            error,
            "Failed to load exam subject"
        );

        if (
            !data
        ) {
            throw new Error(
                `Exam subject ${id} was not found.`
            );
        }

        return data;
    };

const loadExam =
    async (
        id
    ) => {
        const {
            data,
            error,
        } =
            await supabase
                .from(
                    "exams"
                )
                .select(
                    "*"
                )
                .eq(
                    "id",
                    id
                )
                .maybeSingle();

        supabaseError(
            error,
            "Failed to load examination"
        );

        if (
            !data
        ) {
            throw new Error(
                `Examination ${id} was not found.`
            );
        }

        return data;
    };

const loadSubject =
    async (
        id
    ) => {
        if (
            !id
        ) {
            return null;
        }

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
                    id
                )
                .maybeSingle();

        supabaseError(
            error,
            "Failed to load subject"
        );

        return (
            data ||
            null
        );
    };

const createPaper =
    async (
        examId,
        examSubjectId,
        file,
        hash
    ) => {
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
                        file.originalname,

                    file_url:
                        null,

                    file_type:
                        file.mimetype,

                    file_hash:
                        hash,

                    ai_status:
                        "Processing",

                    status:
                        "Processing",

                    error_message:
                        null,
                })
                .select(
                    "*"
                )
                .single();

        supabaseError(
            error,
            "Failed to create exam paper"
        );

        return data;
    };

const updatePaper =
    async (
        paperId,
        status,
        errorMessage = null
    ) => {
        const {
            error,
        } =
            await supabase
                .from(
                    "exam_papers"
                )
                .update({
                    ai_status:
                        status,

                    status,

                    error_message:
                        errorMessage,
                })
                .eq(
                    "id",
                    paperId
                );

        supabaseError(
            error,
            "Failed to update exam paper status"
        );
    };

const clearOldAnalysis =
    async (
        examId,
        examSubjectId
    ) => {
        const qa =
            await supabase
                .from(
                    "exam_question_analysis"
                )
                .delete()
                .eq(
                    "exam_id",
                    examId
                )
                .eq(
                    "exam_subject_id",
                    examSubjectId
                );

        supabaseError(
            qa.error,
            "Failed to clear question analysis"
        );

        const eq =
            await supabase
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
                );

        supabaseError(
            eq.error,
            "Failed to clear exam questions"
        );

        const ea =
            await supabase
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
                );

        supabaseError(
            ea.error,
            "Failed to clear AI analysis"
        );
    };

const saveAnalysis =
    async (
        payload
    ) => {
        const {
            data,
            error,
        } =
            await supabase
                .from(
                    "exam_ai_analysis"
                )
                .insert(
                    payload
                )
                .select(
                    "*"
                )
                .single();

        supabaseError(
            error,
            "Failed to save exam AI analysis"
        );

        return data;
    };

const saveQuestions =
    async ({
        examId,
        examSubjectId,
        subjectId,
        paperId,
        questions,
    }) => {
        const questionAnalysisRows =
            questions.map(
                (
                    question
                ) => ({
                    exam_id:
                        examId,

                    exam_subject_id:
                        examSubjectId,

                    exam_paper_id:
                        paperId,

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

                    ai_explanation:
                        question.ai_explanation,

                    max_marks:
                        question.max_marks,

                    section:
                        question.section,

                    section_type:
                        question.section_type,

                    is_selective:
                        !!question.is_selective,

                    selection_required:
                        !!question.selection_required,

                    selection_count:
                        integer(
                            question.selection_count
                        ),

                    selection_total:
                        integer(
                            question.selection_total
                        ),

                    selection_group:
                        question.selection_group,

                    selection_instruction:
                        question.selection_instruction,

                    ai_confidence:
                        normalizeConfidence(
                            question.ai_confidence
                        ),

                    question_type:
                        question.question_type,
                })
            );

        const examQuestionRows =
            questions.map(
                (
                    question
                ) => ({
                    exam_id:
                        examId,

                    subject_id:
                        subjectId ||
                        null,

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
                        normalizeConfidence(
                            question.ai_confidence
                        ),

                    bloom_level:
                        question.bloom_level,

                    question_type:
                        question.question_type,

                    ai_explanation:
                        question.ai_explanation,

                    ai_processed:
                        true,

                    max_marks:
                        question.max_marks,

                    section:
                        question.section,

                    section_type:
                        question.section_type,

                    is_selective:
                        !!question.is_selective,

                    selection_required:
                        !!question.selection_required,

                    selection_count:
                        integer(
                            question.selection_count
                        ),

                    selection_total:
                        integer(
                            question.selection_total
                        ),

                    selection_group:
                        question.selection_group,

                    selection_instruction:
                        question.selection_instruction,
                })
            );

        const questionAnalysisInsert =
            await supabase
                .from(
                    "exam_question_analysis"
                )
                .insert(
                    questionAnalysisRows
                );

        supabaseError(
            questionAnalysisInsert.error,
            "Failed to save AI question analysis"
        );

        const examQuestionInsert =
            await supabase
                .from(
                    "exam_questions"
                )
                .insert(
                    examQuestionRows
                );

        supabaseError(
            examQuestionInsert.error,
            "Failed to save exam questions"
        );
    };

const effectiveMarks =
    (
        questions
    ) => {
        const normal =
            questions
                .filter(
                    (
                        question
                    ) =>
                        !question.is_selective
                )
                .reduce(
                    (
                        sum,
                        question
                    ) =>
                        sum +
                        marks(
                            question.max_marks
                        ),
                    0
                );

        const groups =
            new Map();

        for (
            const question of
                questions
        ) {
            if (
                !question.is_selective
            ) {
                continue;
            }

            const key =
                question.selection_group ||
                "DEFAULT_SELECTIVE";

            if (
                !groups.has(
                    key
                )
            ) {
                groups.set(
                    key,
                    {
                        count:
                            integer(
                                question.selection_count,
                                1
                            ) ||
                            1,

                        marks:
                            [],
                    }
                );
            }

            groups
                .get(
                    key
                )
                .marks.push(
                    marks(
                        question.max_marks
                    )
                );
        }

        let selective =
            0;

        for (
            const group of
                groups.values()
        ) {
            group.marks.sort(
                (
                    a,
                    b
                ) =>
                    b - a
            );

            selective +=
                group.marks
                    .slice(
                        0,
                        group.count
                    )
                    .reduce(
                        (
                            a,
                            b
                        ) =>
                            a + b,
                        0
                    );
        }

        return (
            normal +
            selective
        );
    };

/* ============================================================
   MAIN AI PROCESSOR
============================================================ */

const processJob =
    async (
        job
    ) => {
        const examSubject =
            await loadExamSubject(
                job.examSubjectId
            );

        if (
            Number(
                examSubject.exam_id
            ) !==
            Number(
                job.examId
            )
        ) {
            throw new Error(
                "Exam subject does not belong to this examination."
            );
        }

        const exam =
            await loadExam(
                job.examId
            );

        const subject =
            await loadSubject(
                examSubject.subject_id
            );

        const subjectName =
            text(
                subject?.name ||
                    subject?.subject_name ||
                    subject?.title
            ) ||
            "Unknown Subject";

        const level =
            text(
                examSubject.level ||
                    examSubject.class_level ||
                    exam.level
            ) ||
            "Unknown Level";

        const examName =
            text(
                exam.name ||
                    exam.exam_name ||
                    exam.title
            ) ||
            `Examination ${job.examId}`;

        /* ========================================================
           PDF READING FIX
           --------------------------------------------------------
           readPDF() expects a Buffer.

           DO NOT pass:
           {
              buffer: job.buffer
           }

           Pass the Buffer directly.
        ======================================================== */

        if (
            !Buffer.isBuffer(
                job.buffer
            )
        ) {
            throw new Error(
                "Queued examination PDF buffer is invalid."
            );
        }

        console.log(
            "AI PDF BUFFER LENGTH:",
            job.buffer.length
        );

        const pdfHeader =
            job.buffer
                .subarray(
                    0,
                    5
                )
                .toString(
                    "utf8"
                );

        console.log(
            "AI PDF HEADER:",
            pdfHeader
        );

        let pdf =
            await withTimeout(
                readPDF(
                    job.buffer
                ),
                180000,
                "PDF reading timed out."
            );

        pdf =
            cleanPdf(
                pdf
            );

        if (
            pdf.length <
            50
        ) {
            throw new Error(
                "The PDF contains little or no readable text."
            );
        }

        console.log(
            "AI FINAL PDF TEXT LENGTH:",
            pdf.length
        );

        const mainNumbers =
            topLevelNumbersFromPdf(
                pdf
            );

        const sectionTotals =
            sectionTotalsFromPdf(
                pdf
            );

        const selection =
            selectionFromPdf(
                pdf
            );

        console.log(
            "PDF TOP LEVEL NUMBERS:",
            mainNumbers
        );

        console.log(
            "PDF SECTION TOTALS:",
            sectionTotals
        );

        console.log(
            "PDF SELECTION:",
            selection
        );

        /* ========================================================
           PRIMARY GEMINI ANALYSIS
        ======================================================== */

        const primaryRaw =
            await withTimeout(
                askGemini(
                    buildPrimaryPrompt({
                        pdf,

                        examName,

                        subject:
                            subjectName,

                        level,

                        mainNumbers,

                        sectionTotals,

                        selection,
                    })
                ),
                180000,
                "AI analysis timed out after 180 seconds."
            );

        const primary =
            parseAI(
                primaryRaw
            );

        if (
            !Array.isArray(
                primary.questions
            ) ||
            !primary.questions.length
        ) {
            throw new Error(
                "AI returned no examination questions."
            );
        }

        /* ========================================================
           NORMALIZE PRIMARY AI QUESTIONS
        ======================================================== */

        const normalizedRows =
            [];

        primary.questions.forEach(
            (
                question,
                index
            ) => {
                const parent =
                    normalizeQuestion(
                        question,
                        index
                    );

                /*
                 * If Gemini returns a proper parent with sub_items,
                 * keep the parent AND add its children as temporary
                 * Q1(i), Q1(ii), etc.
                 *
                 * groupMainQuestions() will then detect the parent
                 * and use ONLY the children as sub_items.
                 */
                if (
                    Array.isArray(
                        question?.sub_items
                    ) &&
                    question.sub_items.length
                ) {
                    normalizedRows.push(
                        parent
                    );

                    question.sub_items.forEach(
                        (
                            child,
                            childIndex
                        ) => {
                            const childLabel =
                                text(
                                    child?.label ??
                                        child?.sub_question_label ??
                                        child?.question_number
                                ) ||
                                roman(
                                    childIndex +
                                        1
                                );

                            normalizedRows.push(
                                normalizeQuestion(
                                    {
                                        ...child,

                                        question_number:
                                            `${parent.question_number}(${childLabel})`,

                                        section:
                                            child?.section ||
                                            parent.section,

                                        section_type:
                                            child?.section_type ||
                                            parent.section_type,

                                        selection_instruction:
                                            child?.selection_instruction ||
                                            parent.selection_instruction,

                                        is_selective:
                                            child?.is_selective ??
                                            parent.is_selective,

                                        selection_required:
                                            child?.selection_required ??
                                            parent.selection_required,

                                        selection_count:
                                            child?.selection_count ??
                                            parent.selection_count,

                                        selection_total:
                                            child?.selection_total ??
                                            parent.selection_total,

                                        selection_group:
                                            child?.selection_group ||
                                            parent.selection_group,
                                    },
                                    childIndex
                                )
                            );
                        }
                    );

                    return;
                }

                /*
                 * Flat Gemini question.
                 *
                 * Examples:
                 *
                 * Q1(i)
                 * Q1(ii)
                 * Q1(iii)
                 *
                 * These will be merged later.
                 */
                normalizedRows.push(
                    parent
                );
            }
        );

        /* ========================================================
           AUTHORITATIVE GROUPING
        ======================================================== */

        let questions =
            groupMainQuestions(
                normalizedRows,
                sectionTotals
            );

        if (
            !questions.length
        ) {
            throw new Error(
                "No main examination questions could be constructed from the AI response."
            );
        }

        /* ========================================================
           PDF QUESTION NUMBER AUTHORITY
           --------------------------------------------------------
           If the PDF clearly contains top-level numbers, only
           those numbers are allowed.
        ======================================================== */

        if (
            mainNumbers.length
        ) {
            const byNumber =
                new Map(
                    questions.map(
                        (
                            question
                        ) => [
                            integer(
                                question.question_number
                            ),
                            question,
                        ]
                    )
                );

            questions =
                mainNumbers
                    .map(
                        (
                            numberValue
                        ) =>
                            byNumber.get(
                                numberValue
                            )
                    )
                    .filter(
                        Boolean
                    );
        }

        if (
            !questions.length
        ) {
            throw new Error(
                "No valid main questions remained after PDF question-number validation."
            );
        }

        /* ========================================================
           SECOND AI METADATA PASS
        ======================================================== */

        let metadata =
            null;

        try {
            metadata =
                parseAI(
                    await withTimeout(
                        askGemini(
                            buildMetadataPrompt({
                                pdf,

                                questions,
                            })
                        ),
                        120000,
                        "AI metadata audit timed out."
                    )
                );
        } catch (
            error
        ) {
            console.warn(
                "AI METADATA AUDIT FAILED:",
                error.message
            );
        }

        /*
         * Metadata is NEVER allowed to create or split questions.
         */
        if (
            Array.isArray(
                metadata?.questions
            )
        ) {
            const metadataMap =
                new Map();

            metadata.questions.forEach(
                (
                    question
                ) => {
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
            );

            questions =
                questions.map(
                    (
                        question
                    ) => {
                        const repair =
                            metadataMap.get(
                                question.question_number
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
        }

        /* ========================================================
           CONFIDENCE FALLBACK
        ======================================================== */

        questions =
            questions.map(
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
                })
            );

        /* ========================================================
           FINAL DUPLICATE SAFETY
        ======================================================== */

        const finalQuestionMap =
            new Map();

        for (
            const question of
                questions
        ) {
            const numberValue =
                mainNumber(
                    question.question_number,
                    0
                );

            if (
                !numberValue
            ) {
                continue;
            }

            if (
                !finalQuestionMap.has(
                    numberValue
                )
            ) {
                finalQuestionMap.set(
                    numberValue,
                    {
                        ...question,

                        question_number:
                            numberValue,

                        raw_question_number:
                            String(
                                numberValue
                            ),

                        sub_items:
                            Array.isArray(
                                question.sub_items
                            )
                                ? question.sub_items
                                : [],
                    }
                );

                continue;
            }

            /*
             * If a duplicate somehow survives, merge only
             * its sub-items into the existing main question.
             */
            const existing =
                finalQuestionMap.get(
                    numberValue
                );

            const existingChildren =
                Array.isArray(
                    existing.sub_items
                )
                    ? existing.sub_items
                    : [];

            const duplicateChildren =
                Array.isArray(
                    question.sub_items
                )
                    ? question.sub_items
                    : [];

            const childKeys =
                new Set();

            const mergedChildren =
                [
                    ...existingChildren,
                    ...duplicateChildren,
                ].filter(
                    (
                        child
                    ) => {
                        const key =
                            `${text(
                                child.label
                            )}|${text(
                                child.question_text
                            )}`;

                        if (
                            childKeys.has(
                                key
                            )
                        ) {
                            return false;
                        }

                        childKeys.add(
                            key
                        );

                        return true;
                    }
                );

            finalQuestionMap.set(
                numberValue,
                {
                    ...existing,

                    sub_items:
                        mergedChildren,
                }
            );
        }

        questions =
            [
                ...finalQuestionMap.values(),
            ];

        questions.sort(
            (
                a,
                b
            ) =>
                Number(
                    a.question_number
                ) -
                Number(
                    b.question_number
                )
        );

        /* ========================================================
           FINAL QUESTION STRUCTURE LOG
        ======================================================== */

        console.log(
            "============================================================"
        );

        console.log(
            "FINAL MAIN QUESTION STRUCTURE"
        );

        console.log(
            JSON.stringify(
                questions.map(
                    (
                        question
                    ) => ({
                        question_number:
                            question.question_number,

                        sub_items:
                            Array.isArray(
                                question.sub_items
                            )
                                ? question.sub_items.length
                                : 0,

                        max_marks:
                            question.max_marks,

                        question_type:
                            question.question_type,
                    })
                ),
                null,
                2
            )
        );

        console.log(
            "TOTAL MAIN QUESTIONS:",
            questions.length
        );

        console.log(
            "============================================================"
        );

        /*
         * If PDF gave authoritative top-level numbers and the
         * counts differ, log it but do not manufacture questions.
         */
        if (
            mainNumbers.length &&
            questions.length !==
                mainNumbers.length
        ) {
            console.warn(
                "MAIN QUESTION COUNT DIFFERENCE:",
                {
                    pdfNumbers:
                        mainNumbers,

                    detected:
                        questions.map(
                            (
                                question
                            ) =>
                                question.question_number
                        ),
                }
            );
        }

        /* ========================================================
           TOPICS
        ======================================================== */

        const topicsFound =
            unique([
                ...(
                    Array.isArray(
                        primary.topics_found
                    )
                        ? primary.topics_found
                        : []
                ),

                ...(
                    Array.isArray(
                        metadata?.topics_found
                    )
                        ? metadata.topics_found
                        : []
                ),

                ...questions.flatMap(
                    (
                        question
                    ) =>
                        String(
                            question.topic ||
                                ""
                        ).split(
                            /[,;|]/
                        )
                ),
            ]);

        /* ========================================================
           QUALITY SCORE
           --------------------------------------------------------
           Never save NULL.
        ======================================================== */

        const quality =
            (() => {
                const derived =
                    deriveQuality(
                        questions
                    );

                const metadataScore =
                    number(
                        metadata?.quality_score,
                        NaN
                    );

                const primaryScore =
                    number(
                        primary?.quality_score,
                        NaN
                    );

                let finalScore =
                    Number.isFinite(
                        metadataScore
                    )
                        ? metadataScore
                        : Number.isFinite(
                              primaryScore
                          )
                        ? primaryScore
                        : derived.score;

                finalScore =
                    clamp100(
                        finalScore
                    );

                /*
                 * If Gemini returned zero while our actual
                 * question data allows a calculated score,
                 * use the deterministic calculated score.
                 */
                if (
                    finalScore ===
                        0 &&
                    derived.score >
                        0
                ) {
                    finalScore =
                        derived.score;
                }

                const explanation =
                    text(
                        metadata?.quality_explanation
                    ) ||
                    text(
                        primary?.quality_explanation
                    ) ||
                    derived.explanation;

                return {
                    score:
                        finalScore,

                    explanation:
                        explanation,
                };
            })();

        /* ========================================================
           SYLLABUS COVERAGE
           --------------------------------------------------------
           Never save NULL.
        ======================================================== */

        const calculatedSyllabusCoverage =
            questions.length
                ? Math.round(
                      (
                          questions.filter(
                              (
                                  question
                              ) =>
                                  Boolean(
                                      text(
                                          question.topic
                                      )
                                  )
                          ).length /
                          questions.length
                      ) *
                          100
                  )
                : 0;

        const metadataSyllabus =
            number(
                metadata?.syllabus_coverage,
                NaN
            );

        const primarySyllabus =
            number(
                primary?.syllabus_coverage,
                NaN
            );

        const syllabusCoverage =
            clamp100(
                Number.isFinite(
                    metadataSyllabus
                )
                    ? metadataSyllabus
                    : Number.isFinite(
                          primarySyllabus
                      )
                    ? primarySyllabus
                    : calculatedSyllabusCoverage
            );

        /* ========================================================
           DIFFICULTY
        ======================================================== */

        const difficulty =
            text(
                primary.difficulty
            ) ||
            "Unknown";

        /* ========================================================
           TOTAL MARKS
        ======================================================== */

        const totalMarksFromStructure =
            effectiveMarks(
                questions
            );

        const totalMarker =
            pdf.match(
                /TOTAL\s+(?:MARKS?|SCORE)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i
            );

        const printedTotalMarks =
            totalMarker
                ? marks(
                      totalMarker[1]
                  )
                : 0;

        const totalMarks =
            printedTotalMarks >
                0 &&
            Math.abs(
                printedTotalMarks -
                    totalMarksFromStructure
            ) <=
                10
                ? printedTotalMarks
                : totalMarksFromStructure;

        if (
            totalMarks <=
            0
        ) {
            throw new Error(
                "Could not determine a valid examination total mark."
            );
        }

        /* ========================================================
           BLOOM DISTRIBUTION
        ======================================================== */

        const blooms =
            primary.blooms_distribution &&
            typeof primary.blooms_distribution ===
                "object"
                ? primary.blooms_distribution
                : questions.reduce(
                      (
                          output,
                          question
                      ) => {
                          const key =
                              text(
                                  question.bloom_level
                              ) ||
                              "Unknown";

                          output[key] =
                              (
                                  output[key] ||
                                  0
                              ) +
                              1;

                          return output;
                      },
                      {}
                  );

        /* ========================================================
           WEAK / STRONG TOPICS
        ======================================================== */

        const weakTopics =
            unique([
                ...(
                    Array.isArray(
                        metadata?.weak_topics
                    )
                        ? metadata.weak_topics
                        : []
                ),

                ...(
                    Array.isArray(
                        primary.weak_topics
                    )
                        ? primary.weak_topics
                        : []
                ),
            ]);

        const strongTopics =
            unique([
                ...(
                    Array.isArray(
                        metadata?.strong_topics
                    )
                        ? metadata.strong_topics
                        : []
                ),

                ...(
                    Array.isArray(
                        primary.strong_topics
                    )
                        ? primary.strong_topics
                        : []
                ),
            ]);

        /* ========================================================
           RECOMMENDATIONS
        ======================================================== */

        const recommendations =
            Array.isArray(
                primary.recommendations
            )
                ? primary.recommendations
                      .map(
                          text
                      )
                      .filter(
                          Boolean
                      )
                : [];

        /* ========================================================
           AVERAGE CONFIDENCE
        ======================================================== */

        const averageConfidence =
            Math.round(
                questions.reduce(
                    (
                        sum,
                        question
                    ) =>
                        sum +
                        normalizeConfidence(
                            question.ai_confidence
                        ),
                    0
                ) /
                    Math.max(
                        1,
                        questions.length
                    )
            );

        /* ========================================================
           TEACHER COMMENTS
        ======================================================== */

        const teacherComments =
            [
                text(
                    metadata?.teacher_comments
                ),

                text(
                    primary.teacher_comments
                ),

                quality.explanation,

                `Average AI confidence: ${averageConfidence}%.`,
            ]
                .filter(
                    Boolean
                )
                .join(
                    "\n\n"
                );

        /* ========================================================
           FINAL VALIDATION BEFORE DB
        ======================================================== */

        const finalNumbers =
            questions.map(
                (
                    question
                ) =>
                    integer(
                        question.question_number
                    )
            );

        const uniqueFinalNumbers =
            [
                ...new Set(
                    finalNumbers
                ),
            ];

        if (
            finalNumbers.length !==
            uniqueFinalNumbers.length
        ) {
            throw new Error(
                "AI analysis contains duplicate main question numbers."
            );
        }

        if (
            !questions.length
        ) {
            throw new Error(
                "AI analysis produced zero main questions."
            );
        }

        if (
            !Number.isFinite(
                quality.score
            )
        ) {
            throw new Error(
                "AI quality score could not be calculated."
            );
        }

        if (
            !Number.isFinite(
                syllabusCoverage
            )
        ) {
            throw new Error(
                "AI syllabus coverage could not be calculated."
            );
        }

        console.log(
            "FINAL QUALITY SCORE:",
            quality.score
        );

        console.log(
            "FINAL SYLLABUS COVERAGE:",
            syllabusCoverage
        );

        console.log(
            "FINAL TOTAL MARKS:",
            totalMarks
        );

        /* ========================================================
           CLEAR OLD ANALYSIS
        ======================================================== */

        await clearOldAnalysis(
            job.examId,
            job.examSubjectId
        );

        /* ========================================================
           SAVE PAPER ANALYSIS
        ======================================================== */

        const analysis =
            await saveAnalysis({
                exam_id:
                    job.examId,

                exam_subject_id:
                    job.examSubjectId,

                exam_paper_id:
                    job.paperId,

                analysis_status:
                    "Processing",

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
                    quality.score,

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
                    blooms,

                teacher_comments:
                    teacherComments,

                ai_summary:
                    text(
                        metadata?.summary ||
                            primary.summary
                    ) ||
                    `AI analysis completed for ${questions.length} main questions.`,

                instructions:
                    Array.isArray(
                        primary.instructions
                    )
                        ? primary.instructions.join(
                              "\n"
                          )
                        : text(
                              primary.instructions
                          ),

                raw_response:
                    primary,
            });

        /* ========================================================
           SAVE QUESTIONS
        ======================================================== */

        await saveQuestions({
            examId:
                job.examId,

            examSubjectId:
                job.examSubjectId,

            subjectId:
                examSubject.subject_id,

            paperId:
                job.paperId,

            questions,
        });

        /* ========================================================
           DATABASE VERIFICATION
        ======================================================== */

        const verification =
            await supabase
                .from(
                    "exam_questions"
                )
                .select(
                    "id,question_number,max_marks"
                )
                .eq(
                    "exam_id",
                    job.examId
                )
                .eq(
                    "exam_subject_id",
                    job.examSubjectId
                )
                .order(
                    "question_number",
                    {
                        ascending:
                            true,
                    }
                );

        supabaseError(
            verification.error,
            "Failed to verify saved examination questions"
        );

        const savedRows =
            verification.data ||
            [];

        const savedNumbers =
            savedRows.map(
                (
                    question
                ) =>
                    integer(
                        question.question_number
                    )
            );

        const uniqueSavedNumbers =
            [
                ...new Set(
                    savedNumbers
                ),
            ];

        console.log(
            "DATABASE SAVED QUESTION NUMBERS:",
            savedNumbers
        );

        console.log(
            "DATABASE UNIQUE QUESTION NUMBERS:",
            uniqueSavedNumbers
        );

        if (
            savedRows.length !==
                questions.length ||
            uniqueSavedNumbers.length !==
                questions.length
        ) {
            throw new Error(
                `Saved question verification failed. Expected ${questions.length} unique main questions; found ${savedRows.length} rows / ${uniqueSavedNumbers.length} unique numbers.`
            );
        }

        /* ========================================================
           COMPLETE ANALYSIS
        ======================================================== */

        const completed =
            await supabase
                .from(
                    "exam_ai_analysis"
                )
                .update({
                    analysis_status:
                        "Completed",
                })
                .eq(
                    "id",
                    analysis.id
                );

        supabaseError(
            completed.error,
            "Failed to complete AI analysis"
        );

        await updatePaper(
            job.paperId,
            "Completed",
            null
        );

        console.log(
            "============================================================"
        );

        console.log(
            "AI ANALYSIS COMPLETED"
        );

        console.log(
            {
                controller_version:
                    CONTROLLER_VERSION,

                exam:
                    job.examId,

                exam_subject:
                    job.examSubjectId,

                paper:
                    job.paperId,

                main_questions:
                    questions.length,

                total_marks:
                    totalMarks,

                quality_score:
                    quality.score,

                syllabus_coverage:
                    syllabusCoverage,

                topics:
                    topicsFound.length,

                confidence:
                    averageConfidence,
            }
        );

        console.log(
            "============================================================"
        );
    };

/* ============================================================
   QUEUE
============================================================ */

const runWorker =
    async () => {
        if (
            workerRunning
        ) {
            return;
        }

        workerRunning =
            true;

        while (
            queue.length
        ) {
            const job =
                queue.shift();

            try {
                await processJob(
                    job
                );
            } catch (
                error
            ) {
                console.error(
                    "AI ANALYSIS JOB FAILED:",
                    error
                );

                try {
                    await updatePaper(
                        job.paperId,
                        "Failed",
                        error.message ||
                            "AI analysis failed."
                    );
                } catch (
                    _
                ) {}

                try {
                    await supabase
                        .from(
                            "exam_ai_analysis"
                        )
                        .update({
                            analysis_status:
                                "Failed",
                        })
                        .eq(
                            "exam_paper_id",
                            job.paperId
                        );
                } catch (
                    _
                ) {}
            }
        }

        workerRunning =
            false;
    };

/* ============================================================
   POST /ai/analyze-paper
============================================================ */

export const analyzePaper =
    async (
        req,
        res
    ) => {
        try {
            const examId =
                integer(
                    req.body?.exam_id ??
                        req.query?.exam_id
                );

            const examSubjectId =
                integer(
                    req.body?.exam_subject_id ??
                        req.query?.exam_subject_id
                );

            if (
                !examId ||
                !examSubjectId
            ) {
                return res
                    .status(
                        400
                    )
                    .json({
                        success:
                            false,

                        message:
                            "Valid exam_id and exam_subject_id are required.",
                    });
            }

            if (
                !req.file
            ) {
                return res
                    .status(
                        400
                    )
                    .json({
                        success:
                            false,

                        message:
                            "Examination paper PDF is required.",
                    });
            }

            if (
                !Buffer.isBuffer(
                    req.file.buffer
                )
            ) {
                return res
                    .status(
                        400
                    )
                    .json({
                        success:
                            false,

                        message:
                            "Uploaded PDF buffer is invalid.",
                    });
            }

            const hash =
                fileHash(
                    req.file.buffer
                );

            const paper =
                await createPaper(
                    examId,
                    examSubjectId,
                    req.file,
                    hash
                );

            queue.push({
                examId,

                examSubjectId,

                paperId:
                    paper.id,

                buffer:
                    req.file.buffer,

                fileName:
                    req.file.originalname,
            });

            void runWorker();

            return res
                .status(
                    202
                )
                .json({
                    success:
                        true,

                    processing:
                        true,

                    status:
                        "Processing",

                    controller_version:
                        CONTROLLER_VERSION,

                    message:
                        "Examination paper uploaded. AI analysis is processing.",

                    exam_id:
                        examId,

                    exam_subject_id:
                        examSubjectId,

                    exam_paper_id:
                        paper.id,

                    file_hash:
                        hash,
                });
        } catch (
            error
        ) {
            console.error(
                "ANALYZE PAPER ERROR:",
                error
            );

            return res
                .status(
                    Number(
                        error.status
                    ) >=
                        400
                        ? Number(
                              error.status
                          )
                        : 500
                )
                .json({
                    success:
                        false,

                    code:
                        error.code ||
                        "AI_ANALYSIS_FAILED",

                    message:
                        error.message ||
                        "AI paper analysis failed.",
                });
        }
    };

/* ============================================================
   MERGE SAVED QUESTION ANALYSIS
============================================================ */

const mergeSavedRows =
    (
        rows,
        analyses
    ) => {
        const byExact =
            new Map();

        for (
            const row of
                analyses || []
        ) {
            const key =
                `${integer(
                    row.question_number
                )}|${text(
                    row.question_text
                )
                    .toLowerCase()
                    .replace(
                        /\s+/g,
                        " "
                    )}`;

            byExact.set(
                key,
                row
            );
        }

        const byNumber =
            new Map();

        for (
            const row of
                analyses || []
        ) {
            byNumber.set(
                integer(
                    row.question_number
                ),
                row
            );
        }

        return (
            rows || []
        ).map(
            (
                question
            ) => {
                const key =
                    `${integer(
                        question.question_number
                    )}|${text(
                        question.question_text
                    )
                        .toLowerCase()
                        .replace(
                            /\s+/g,
                            " "
                        )}`;

                const match =
                    byExact.get(
                        key
                    ) ||
                    byNumber.get(
                        integer(
                            question.question_number
                        )
                    );

                if (
                    !match
                ) {
                    return question;
                }

                return {
                    ...question,

                    expected_answer:
                        match.answer_expected ||
                        question.expected_answer ||
                        null,

                    answer_expected:
                        match.answer_expected ||
                        question.answer_expected ||
                        null,

                    topic:
                        match.topic ||
                        question.topic ||
                        null,

                    sub_topic:
                        match.subtopic ||
                        question.sub_topic ||
                        null,

                    difficulty_level:
                        match.difficulty ||
                        question.difficulty_level ||
                        null,

                    bloom_level:
                        match.blooms_level ||
                        question.bloom_level ||
                        null,

                    question_type:
                        match.question_type ||
                        question.question_type ||
                        null,

                    ai_confidence:
                        normalizeConfidence(
                            match.ai_confidence ||
                                question.ai_confidence
                        ),

                    ai_explanation:
                        match.ai_explanation ||
                        question.ai_explanation ||
                        null,

                    question_analysis:
                        match,
                };
            }
        );
    };

/* ============================================================
   GET /ai/analysis/:examId/:examSubjectId
============================================================ */

export const getAIAnalysisByExamSubject =
    async (
        req,
        res
    ) => {
        try {
            const examId =
                integer(
                    req.params.examId
                );

            const examSubjectId =
                integer(
                    req.params.examSubjectId
                );

            if (
                !examId ||
                !examSubjectId
            ) {
                return res
                    .status(
                        400
                    )
                    .json({
                        success:
                            false,

                        message:
                            "Invalid exam ID or exam subject ID.",
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
                    .status(
                        400
                    )
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
                questionAnalysisResult,
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
                            "exam_question_analysis"
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

            supabaseError(
                analysisResult.error,
                "Failed to load exam AI analysis"
            );

            supabaseError(
                questionsResult.error,
                "Failed to load exam questions"
            );

            supabaseError(
                questionAnalysisResult.error,
                "Failed to load exam question analysis"
            );

            supabaseError(
                paperResult.error,
                "Failed to load exam paper"
            );

            const analysis =
                analysisResult.data ||
                null;

            const paper =
                paperResult.data ||
                null;

            const questionAnalysis =
                questionAnalysisResult.data ||
                [];

            const questions =
                mergeSavedRows(
                    questionsResult.data ||
                        [],
                    questionAnalysis
                );

            let status =
                text(
                    analysis?.analysis_status ||
                        paper?.ai_status ||
                        paper?.status
                ) ||
                "Pending";

            if (
                /processing|pending|running|analyzing/i.test(
                    status
                )
            ) {
                status =
                    "Processing";
            } else if (
                /failed|error/i.test(
                    status
                )
            ) {
                status =
                    "Failed";
            } else if (
                /completed|complete|success/i.test(
                    status
                )
            ) {
                status =
                    "Completed";
            }

            const normalizedAnalysis =
                analysis
                    ? {
                          ...analysis,

                          status,

                          analysis_status:
                              status,

                          summary:
                              analysis.ai_summary ||
                              null,

                          quality_explanation:
                              text(
                                  analysis.teacher_comments ||
                                      ""
                              ),
                      }
                    : null;

            return res
                .status(
                    200
                )
                .json({
                    success:
                        true,

                    controller_version:
                        CONTROLLER_VERSION,

                    exam_id:
                        examId,

                    exam_subject_id:
                        examSubjectId,

                    status,

                    processing:
                        status ===
                            "Processing" ||
                        status ===
                            "Pending",

                    analysis:
                        normalizedAnalysis,

                    questions,

                    question_analysis:
                        questionAnalysis,

                    paper,

                    total_questions:
                        questions.length,

                    total_marks:
                        Number(
                            normalizedAnalysis?.total_marks
                        ) ||
                        effectiveMarks(
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
                .status(
                    Number(
                        error.status
                    ) >=
                        400
                        ? Number(
                              error.status
                          )
                        : 500
                )
                .json({
                    success:
                        false,

                    message:
                        error.message ||
                        "Failed to load AI analysis.",
                });
        }
    };

/* ============================================================
   GET /ai/analysis/:examId
============================================================ */

export const getAIAnalysis =
    async (
        req,
        res
    ) => {
        try {
            const examId =
                integer(
                    req.params.examId
                );

            if (
                !examId
            ) {
                return res
                    .status(
                        400
                    )
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

            supabaseError(
                error,
                "Failed to load AI analysis"
            );

            if (
                !data
            ) {
                return res
                    .status(
                        404
                    )
                    .json({
                        success:
                            false,

                        message:
                            "No AI analysis found for this examination.",
                    });
            }

            return res
                .status(
                    200
                )
                .json({
                    success:
                        true,

                    controller_version:
                        CONTROLLER_VERSION,

                    data,

                    analysis:
                        {
                            ...data,

                            status:
                                data.analysis_status,

                            summary:
                                data.ai_summary ||
                                null,
                        },
                });
        } catch (
            error
        ) {
            return res
                .status(
                    Number(
                        error.status
                    ) >=
                        400
                        ? Number(
                              error.status
                          )
                        : 500
                )
                .json({
                    success:
                        false,

                    message:
                        error.message ||
                        "Failed to load AI analysis.",
                });
        }
    };

/* ============================================================
   HEALTH
============================================================ */

export const aiHealthCheck =
    async (
        req,
        res
    ) => {
        return res
            .status(
                200
            )
            .json({
                success:
                    true,

                service:
                    "AI Examination Analysis",

                controller_version:
                    CONTROLLER_VERSION,

                status:
                    "OK",

                timestamp:
                    new Date().toISOString(),
            });
    };