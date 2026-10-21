import crypto from "crypto";
import { supabase } from "../config/supabase.js";
import { readPDF } from "../services/pdfReader.js";
import { askGeminiWithPDF } from "../services/gemini.service.js";
import { parseAIResult } from "../services/aiJsonParser.js";
import { extractDeclaredTotalMarks, resolveExamTotalMarks, hasMarkTotalMismatch } from "../services/examMarkValidation.js";

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

export const buildExamAnalysisPrompt =
    ({
        pdfText,
        structuralQuestions,
        subjectName,
        level,
        examName,
        examType,
        curriculum,
        gradingCriteria,
    }) => {
        const structuralEvidence =
            structuralQuestions
                .map(
                    (question) =>
                        `Q${question.question_number}: ${question.text}`
                )
                .join("\n");

        // Detect early-years and primary papers from metadata AND the PDF.
        // Baby Class/Nursery and Swahili school labels were not covered by the
        // previous detector, causing those papers to receive only generic rules.
        const primaryLevelContext =
            `${level || ""} ${subjectName || ""} ${examName || ""} ${String(pdfText || "").slice(0, 12000)}`;

        const isPrimaryPaper =
            /\bprimary\b|\bprimary\s+school\b|\bshule\s+ya\s+msingi\b|\bdarasa\s+la\s*(?:kwanza|pili|tatu|nne|tano|sita|saba|[1-7])\b|\bstandard\s*(?:[1-7]|i{1,3}|iv|v|vi|vii)\b|\bstd\.?\s*(?:[1-7]|i{1,3}|iv|v|vi|vii)\b|\bclass\s*(?:one|two|three|four|five|six|seven|[1-7])\b|\bbaby\s*class\b|\bnursery\b|\bpre[- ]?primary\b|\bkindergarten\b|\bchekechea\b|\bawali\b/i.test(
                primaryLevelContext
            );

        const primaryAnalysisRules = `
PRIMARY / EARLY-YEARS ANALYSIS GUIDANCE (always supplied; apply only when the original PDF's visible content indicates Baby Class, Nursery, Pre-primary, Kindergarten or Primary):
- The extracted-text detector ${isPrimaryPaper ? 'found a likely primary/early-years label' : 'did not find a reliable primary/early-years text label; this does not mean the PDF is secondary-level'}. Inspect the original attached PDF page by page and use its visual content to determine the level, even if extracted text is empty or incomplete.
- Never classify a paper as Ordinary Level only because its class metadata or extracted PDF text is blank or unrecognized.

- Analyse at the level shown by this paper (for example Standard IV / Class Four). Do not apply secondary-school or CSEE conventions.
- Read and account for every answer slot/sub-item, including Roman numerals (i, ii, iii), matching-table rows, multiple-choice items, fill-in blanks, dictation lines, and comprehension questions. These are sub-items of the printed main question, not automatically separate main questions.
- Preserve the paper's printed question labels exactly. If the paper repeats a number (for example two separate questions labelled 4) or skips a number, do not merge them or silently renumber them. Distinguish repeated labels by section, wording, and their order in the paper.
- Use a hierarchy of evidence for marks: (1) marks printed beside the question/sub-item, (2) explicit instructions such as "each carries 2 marks", (3) an explicit section total plus the count and type of answerable items in that section, (4) the whole-paper total only as a final cross-check. Never override stronger evidence with weaker evidence.
- If a question has no printed mark but the section has a printed total, infer question marks from the actual answer structure: count response slots, matching pairs, multiple-choice items, dictation words/lines, blanks, calculations, written explanations and subparts; account for their relative effort and cognitive demand. Allocate the section total across those items proportionally to the evidence, not by a fixed template and not automatically equally. Use fractional marks when the paper's conventions support them.
- If a section total is known and individual item marks are absent, make a transparent best-fit allocation only when the visible item structure supports it. Set mark_source to "inferred_from_section_structure" and explain the count, allocation logic and confidence in mark_evidence. Ensure inferred question marks reconcile to the section total, but do not alter any explicitly printed item marks to force a match.
- If the section total is absent too, infer marks only from explicit per-item clues or a clearly repeated pattern in the paper. Otherwise leave the mark uncertain (0 if the schema requires a number), label it as uncertain, and recommend teacher confirmation instead of fabricating precision.
- Cross-check marks at all levels: sub-items to main question, questions to section, and sections to whole-paper total. Distinguish a printed total from a calculated total, and account for selective questions (e.g. answer any 2 of 4) so the student's effective marks are not confused with the marks available in the paper.
- A printed section total is not proof that visible question-level marks add up correctly. Count all answer slots and disclose unresolved discrepancies for teacher review.
- Evaluate age-appropriate language, foundational skills, clarity of instructions, and whether the tasks match the stated primary class; do not penalize a primary paper for not using secondary-school question styles.
- USE A PRIMARY/EARLY-YEARS ANALYSIS MODE: this is a different analysis strategy from Ordinary Level. Treat Baby Class, Nursery, Kindergarten, Pre-primary and Primary/Standard papers according to young learners' actual tasks and visual layout, not CSEE conventions.
- Keep JSON compact to reduce truncation: preserve every required top-level key and every main question, but keep summary, recommendations, topic explanations and mark_evidence concise (normally one short sentence each). Do not repeat the full question text in multiple fields. Do not emit long essays explaining routine items.
- Count visible response slots and sub-items from the PDF, including picture identification, tracing, colouring, matching, oral/listening tasks, simple numeracy, letter/word recognition and fill-in blanks. Do not treat answer options, page numbers or subpart labels as separate main questions.
- For early-years papers, prioritize a faithful inventory of tasks and age appropriateness. If marks are absent, preserve uncertainty and teacher review rather than inventing a secondary-school mark scheme.
`

        return `
You are analyzing a complete examination paper.

EXAMINATION:
${examName}

SUBJECT:
${subjectName}

LEVEL:
${level}

EXAM TYPE:
${examType || "Not specified"}

CURRICULUM / SYLLABUS:
${curriculum || "Use the curriculum and topics evident in the paper; do not assume a specific national syllabus."}

CONFIGURED GRADING CRITERIA:
${gradingCriteria || "No exam-specific grading criteria supplied. Do not invent a grading system."}

LEVEL-AWARE RULES:
- Apply criteria appropriate to the stated education level, subject, exam type and supplied curriculum.
- Do not apply CSEE/O-Level conventions such as Best 7, Division or O-Level grade boundaries to Baby Class, Nursery, Primary, A-Level or other levels unless explicitly specified in the configured criteria.
- For early childhood and lower primary, assess age/level appropriateness, foundational skills, clarity, simple instructions and developmental suitability; do not expect advanced-secondary terminology.
- For A-Level, use the stated subject and syllabus context; do not assume O-Level scope.
- If level, curriculum, grading criteria or a paper detail is unknown, state that limitation in recommendations rather than inventing requirements.
- AI analysis is advisory. It must not alter the saved examination, marks, approval status or publish results.

${primaryAnalysisRules}

ADAPTIVE PAPER-FIRST ANALYSIS (CRITICAL):
- Read the uploaded PDF page by page, in order. Use the original PDF pages together with extracted text; do not rely on extracted text alone when it omits diagrams, marks, tables, or question wording.
- Before finalizing, cross-check each identified main question, its printed subparts, the marks shown, section totals, and the paper-level total against the source. If the evidence conflicts or is unreadable, state the exact uncertainty in recommendations rather than guessing.
- Keep the existing JSON schema and analysis flow; a paper with a different level or layout is not a reason to reject analysis.
- Do not assume that this paper is an Ordinary Level / CSEE examination. The level value may be a class label, a school-specific label, or incomplete metadata; use the actual PDF content as primary evidence and use the supplied level as context.
- First infer the paper's own structure from the complete PDF: title/header, class or form, subject, duration, instructions, sections, question numbering, subparts, marks, diagrams/tables, and question formats. Support any structure that actually appears instead of forcing a familiar template.
- This analyzer must work across early-childhood, nursery, primary, Ordinary Level, Advanced Level, vocational, college, internal school exams, mock exams, terminal exams, mid-term exams, and other paper types. This list is illustrative, not restrictive.
- Never require the paper to contain sections A/B/C, a fixed number of questions, a particular mark total, multiple-choice questions, essay questions, or any standard national-exam layout. Use the paper's actual layout.
- Do not interpret missing metadata as proof that a paper is Ordinary Level. Do not import CSEE/NECTA, Best 7, division, GPA, grade bands, topic lists, or syllabus assumptions unless the paper metadata or configured criteria explicitly support them.
- If the PDF's visible structure conflicts with extracted structural evidence or expected-question heuristics, trust the full paper text and explain uncertainty; structuralQuestions, section totals, and expected question counts are hints only, not hard constraints.
- Identify main questions and their subparts according to the paper's own numbering convention. Handle Roman numerals, letters, nested numbering, continuous numbering, repeated numbering by section, and question prompts without a simple numeric prefix. Do not split a main question into multiple questions just because it has subparts.
- For each field in the required JSON, use evidence from this paper. If a field does not apply to this paper, use an empty array/object, null, or a neutral explanatory value consistent with the schema rather than fabricating data. Never fail analysis merely because the paper does not match a familiar template.
- Keep section names, question labels, marks, question types, and selection instructions as printed. Do not silently renumber or normalize them to an Ordinary Level pattern.
- Assess suitability and quality relative to the stated/inferred level, subject, exam purpose, and available curriculum. If the level or curriculum cannot be determined reliably, describe the uncertainty and avoid unsupported curriculum-coverage percentages or claims.

IMPORTANT:
Analyze the WHOLE examination paper.

Do not invent questions, marks, answers, sections, topics, or selection rules.

A main examination question must remain ONE question even if it contains subparts such as:
(a), (b), (c), (i), (ii), etc.

Do NOT convert every subpart into a separate main question.

Use the printed examination paper as the primary evidence.

Determine marks from the actual paper whenever possible.

MARK ALLOCATION MUST BE STRUCTURE-DRIVEN, NOT TEMPLATE-DRIVEN (all education levels):
- Use the strongest available evidence first: explicit marks beside a question/item, then explicit "each carries" instructions, then section totals plus the actual item/response structure, and finally the whole-paper total as a cross-check.
- If item marks are missing but a section total exists, inspect the actual tasks and count answerable units: blanks, MCQ choices, matching pairs, dictation words/lines, short responses, calculations, essays, diagrams, practical steps and nested subparts. Use task type, expected work and repeated patterns in this paper to infer a defensible allocation. Do not assume every question or sub-item has equal marks, and do not import a mark pattern from a different exam level or subject.
- A defensible inferred allocation should reconcile to the printed section total while leaving explicit item marks unchanged. Record mark_source as "inferred_from_section_structure" and explain the evidence and allocation in mark_evidence. Use fractional marks only if compatible with the paper's marking convention.
- If neither item marks nor section totals provide enough evidence, do not fabricate precision. Mark the value as uncertain (use 0 if the schema requires a numeric value) and recommend teacher confirmation.
- Cross-check sub-items against their parent question, question totals against section totals, and section totals against the paper total. Keep printed totals distinct from calculated totals, and account for selective-answer instructions so available marks are not confused with the effective marks a student can earn.
- Keep the paper's own numbering, repeated labels, section names, item types and mark conventions. These instructions apply to unfamiliar layouts too; they are not a fixed template.

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

JSON VALIDITY RULES (CRITICAL):
- Return one complete, syntactically valid JSON object and nothing else.
- Escape every double quote that appears inside a JSON string value as \\".
- Escape backslashes and control characters correctly inside JSON strings.
- Do not place literal, unescaped line breaks inside a JSON string value.
- Preserve quoted phrases from the examination paper as text, but encode them using valid JSON escaping.
- Before returning, verify that the entire response can be parsed as JSON. Never return comments, trailing commas, or explanatory prose outside the JSON object.

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
                    `SECTION-${String(question.section || "UNSECTIONED").trim().toUpperCase()}-QUESTION-${question.question_number}`;

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

            let classContext = null;
            if (examSubject.class_id) {
                const { data: classData, error: classError } = await supabase
                    .from("classes")
                    .select("*")
                    .eq("id", examSubject.class_id)
                    .maybeSingle();
                if (classError) {
                    console.warn("AI class-level context unavailable:", classError.message);
                } else {
                    classContext = classData;
                }
            }

            const level =
                examSubject.level ||
                examSubject.class_level ||
                subject?.education_level ||
                classContext?.academic_level ||
                classContext?.class_name ||
                classContext?.name ||
                exam.level ||
                exam.education_level ||
                "Unknown Level";

            let gradingCriteria = "";
            try {
                const { data: gradingRows, error: gradingError } = await supabase
                    .from("exam_grading_scales")
                    .select("grade, min_percentage, max_percentage, remark, result")
                    .eq("exam_id", examId)
                    .order("sort_order", { ascending: true });
                if (gradingError) {
                    console.warn("AI grading criteria unavailable:", gradingError.message);
                } else if (gradingRows?.length) {
                    gradingCriteria = gradingRows.map(row =>
                        String(row.grade) + ": " + row.min_percentage + "-" + row.max_percentage + "% (" + (row.result || "unspecified") + "; " + (row.remark || "no remark") + ")"
                    ).join("; ");
                }
            } catch (gradingLoadError) {
                console.warn("AI grading criteria load failed:", gradingLoadError?.message);
            }

            const curriculum = [
                exam.curriculum,
                exam.syllabus,
                subject?.curriculum,
                subject?.syllabus,
                subject?.education_level
            ].filter(Boolean).join(" / ");

            const examType = exam.exam_type || exam.type || "";

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

            // PDF text extraction is supporting evidence only. A scanned PDF,
            // a PDF with diagrams, or a paper with complex layout must still be
            // sent to Gemini as the original PDF instead of being rejected here.
            try {
                pdfText =
                    await withTimeout(
                        readPDF(
                            req.file.buffer
                        ),
                        30000,
                        "PDF text extraction timed out after 30 seconds."
                    );
            } catch (error) {
                console.error(
                    "PDF TEXT EXTRACTION FAILED; CONTINUING WITH ORIGINAL PDF:",
                    error?.message || error
                );
                pdfText = "";
            }

            pdfText =
                normalizePdfText(
                    pdfText
                );

            console.log(
                "PDF READ TIME:",
                `${Date.now() - pdfStartedAt}ms`
            );

            // Do not reject image-only/scanned papers because extracted text is
            // short. Gemini receives the original PDF below and can inspect its
            // visual content. Empty extraction simply means fewer text hints.
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

                    examType,

                    curriculum,

                    gradingCriteria,
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
                        askGeminiWithPDF(
                            prompt,
                            req.file.buffer.toString("base64")
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
                            false,

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
                aiResult = parseAIResult(aiRawResponse);
            } catch (firstParseError) {
                console.error(
                    "AI JSON PARSE ERROR; STARTING ONE CONTROLLED RECOVERY ATTEMPT:",
                    errorDetails(firstParseError)
                );

                // Gemini's service validates JSON syntax, but the controller
                // parser can still reject an unusual provider response. Retry
                // the original PDF once here as well, using a concise recovery
                // instruction. This is especially useful for long primary and
                // early-years papers; never fabricate questions or marks.
                try {
                    const recoveryPrompt = [
                        String(prompt),
                        "",
                        "FINAL JSON RECOVERY MODE:",
                        "Return exactly one complete valid JSON object using the required schema. Do not include markdown, commentary, or text outside JSON.",
                        "Keep explanatory text concise to avoid truncation. Preserve all visible main questions and sub-items from the PDF.",
                        "Do not invent questions, answers, or marks. If marks are not printed or cannot be established from the paper, represent uncertainty according to the schema and recommend teacher review.",
                        "Close every string, object, and array. Escape quotation marks and control characters inside string values.",
                    ].join("\n");

                    const recoveryRawResponse = await withTimeout(
                        askGeminiWithPDF(
                            recoveryPrompt,
                            req.file.buffer.toString("base64")
                        ),
                        120000,
                        "AI analysis recovery timed out."
                    );

                    aiResult = parseAIResult(recoveryRawResponse);

                    console.warn(
                        "AI JSON RECOVERY SUCCEEDED",
                        JSON.stringify({
                            examId,
                            examPaperId,
                            originalErrorCode: firstParseError?.code || null,
                        })
                    );
                } catch (recoveryError) {
                    console.error(
                        "AI JSON RECOVERY FAILED:",
                        errorDetails(recoveryError)
                    );

                    const safeMessage =
                        "The examination paper was saved, but AI could not produce a complete readable analysis after an automatic retry. Please try again later; if it continues, check the backend AI error logs.";

                    await updatePaperStatus(
                        examPaperId,
                        {
                            status: "Failed",
                            aiStatus: "Failed",
                            errorMessage: safeMessage,
                        }
                    );

                    return res.status(200).json({
                        success: false,
                        paper_saved: true,
                        analysis_completed: false,
                        ai_status: "Failed",
                        exam_id: examId,
                        exam_subject_id: examSubjectId,
                        exam_paper_id: examPaperId,
                        reused_paper: reusedPaper,
                        message: safeMessage,
                    });
                }
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
                            false,

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

            // Deduplicate only genuinely repeated entries. Question numbering
            // can restart inside each section (e.g. Section B, Question 1),
            // so question number alone is not a safe identity key.
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

                const normalizedQuestionText =
                    String(
                        question.question_text ||
                        question.text ||
                        ""
                    )
                        .toLowerCase()
                        .replace(/\s+/g, " ")
                        .replace(/[^\p{L}\p{N}]+/gu, " ")
                        .trim();

                const identityKey =
                    `${number}:${normalizedQuestionText}`;

                if (
                    !questionMap.has(
                        identityKey
                    )
                ) {
                    questionMap.set(
                        identityKey,
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
                console.warn(
                    "QUESTION COUNT DIFFERENCE (NON-BLOCKING):",
                    {
                        detectedByPdfHeuristic: expectedQuestionCount,
                        identifiedByAI: questions.length,
                        note: "PDF count extraction is a hint; papers may use section-based, repeated, nested, or non-standard numbering."
                    }
                );
            }

            // ------------------------------------------------
            // QUESTION NUMBER VALIDATION
            // ------------------------------------------------

            {
                const actualNumbers =
                    questions.map(
                        (question) =>
                            Number(
                                question.question_number
                            )
                    );

                const hasSequentialNumbering =
                    actualNumbers.every(
                        (number, index) =>
                            number === index + 1
                    );

                if (!hasSequentialNumbering) {
                    console.warn(
                        "NON-SEQUENTIAL QUESTION LABELS (NON-BLOCKING):",
                        actualNumbers,
                        "The printed paper may restart numbering by section or use non-standard numbering."
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
                console.warn(
                    "SELECTIVE QUESTION STRUCTURE WARNING (NON-BLOCKING):",
                    selectiveValidation.problems.join(" | "),
                    "The AI analysis will continue; confirm selection instructions against the original paper."
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
                console.warn(
                    "QUESTIONS WITHOUT RELIABLE MARK VALUES:",
                    questionsWithoutMarks.map(
                        (question) => ({
                            question: question.question_number,
                            section: question.section,
                            marks: question.max_marks,
                            source: question.mark_source,
                            evidence: question.mark_evidence,
                        })
                    ),
                    "Continue structural/content analysis without inventing marks."
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

            if (!sectionValidation.valid) {
    console.warn(
        "SECTION MARK VALIDATION WARNING:",
        sectionValidation.problems.join(" | ")
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

            const reportedTotalMarks =
                numberOrNull(
                    aiResult.total_marks
                );

            // Prefer an explicitly printed paper total when the PDF provides
            // one. The AI's question-by-question mark sum can be incomplete;
            // never silently replace a printed total with that lower sum.
            const declaredTotalMarks =
                extractDeclaredTotalMarks(pdfText);

            // Resolve the paper total from the strongest available whole-paper
            // evidence first. The sum of detected question rows can be lower if
            // a question/mark was missed during extraction, so it is a cross-check,
            // not an automatic replacement for the paper-level total.
            const totalMarks =
                resolveExamTotalMarks({
                    declaredTotalMarks,
                    reportedTotalMarks,
                    calculatedQuestionMarks: effectiveCalculatedMarks,
                });

            const totalMarksMismatch =
                hasMarkTotalMismatch(
                    totalMarks,
                    effectiveCalculatedMarks
                );

            if (totalMarksMismatch) {
                console.warn(
                    "PAPER TOTAL DIFFERS FROM SUM OF AI-IDENTIFIED QUESTION MARKS:",
                    {
                        paperTotal: totalMarks,
                        declaredTotalMarks,
                        reportedTotalMarks,
                        calculatedQuestionMarks: effectiveCalculatedMarks,
                        difference: totalMarks - effectiveCalculatedMarks,
                    }
                );
            }

            if (
                totalMarks <= 0
            ) {
                console.warn(
                    "TOTAL MARKS NOT ESTABLISHED:",
                    "Analysis will be saved with total_marks = 0. Do not use this paper's AI mark totals for grading until marks are confirmed."
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

            if (
                questionsWithoutMarks.length > 0
            ) {
                recommendations.push(
                    "Some questions do not have reliable mark values in the paper or AI response. Confirm the original marking scheme before using totals for grading."
                );
            }

            if (
                totalMarks <= 0
            ) {
                recommendations.push(
                    "The examination's total marks could not be reliably established. Content and structure analysis is available, but confirm the marking scheme before using any mark-based calculations."
                );
            }

            if (totalMarksMismatch) {
                const totalEvidence =
                    declaredTotalMarks !== null
                        ? "The PDF text contains an explicit paper-total declaration"
                        : "The AI identified a paper-level total";

                recommendations.push(
                    `${totalEvidence} of ${totalMarks} marks, but the marks assigned to the identified questions add up to ${effectiveCalculatedMarks}. Review every page and question: one or more questions or mark values may have been missed, misread, or counted incorrectly. Do not treat this discrepancy as resolved until checked against the original paper.`
                );
            }

            if (
                !selectiveValidation.valid
            ) {
                recommendations.push(
                    "The paper may contain selection instructions that need teacher verification: " +
                    selectiveValidation.problems.join(" | ")
                );
            }

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
                            false,

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