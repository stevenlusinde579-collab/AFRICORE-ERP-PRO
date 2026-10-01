import crypto from "crypto";
import { supabase } from "../config/supabase.js";
import { readPDF } from "../services/pdfReader.js";
import { askGemini } from "../services/gemini.service.js";


// ============================================================
// AI ANALYSIS QUEUE
// ============================================================
//
// - Hakuna lock ya exam + subject.
// - Papers nyingi za subject moja zinaruhusiwa.
// - Queue inachakata paper moja baada ya nyingine.
// - Kila upload mpya inapata exam_papers record mpya.
// - Same PDF ikiwa tayari Processing, duplicate request
//   inazuiwa.
// ============================================================

const analysisQueue = [];

let analysisWorkerRunning =
    false;


// ============================================================
// ACTIVE ANALYSIS REQUESTS
// ============================================================
//
// Hii inalinda dhidi ya frontend kutuma request ile ile
// mara mbili kwa wakati mmoja.
//
// HAIJAFUNGI exam subject.
// Paper tofauti bado inaruhusiwa.
// ============================================================

const activeAnalysisHashes =
    new Set();


// ============================================================
// ANALYSIS HASH KEY
// ============================================================

const getAnalysisHashKey = (
    examId,
    examSubjectId,
    fileHash
) => {
    return `${Number(
        examId
    )}:${Number(
        examSubjectId
    )}:${fileHash}`;
};


// ============================================================
// RUN NEXT ANALYSIS JOB
// ============================================================

const runNextAnalysisJob =
    async () => {
        if (
            analysisWorkerRunning
        ) {
            return;
        }

        const job =
            analysisQueue.shift();

        if (!job) {
            return;
        }

        analysisWorkerRunning =
            true;

        try {
            await job();
        } catch (error) {
            console.error(
                "UNHANDLED BACKGROUND AI JOB ERROR:",
                error
            );
        } finally {
            analysisWorkerRunning =
                false;

            if (
                analysisQueue.length >
                0
            ) {
                setImmediate(
                    () => {
                        void runNextAnalysisJob();
                    }
                );
            }
        }
    };


// ============================================================
// ENQUEUE ANALYSIS JOB
// ============================================================

const enqueueAnalysisJob = (
    job
) => {
    analysisQueue.push(
        job
    );

    setImmediate(
        () => {
            void runNextAnalysisJob();
        }
    );

    return analysisQueue.length;
};


// ============================================================
// TIMEOUT HELPER
// ============================================================

const withTimeout = async (
    promise,
    timeoutMs,
    message =
        "Operation timed out"
) => {
    let timer;

    try {
        return await Promise.race([
            promise,

            new Promise(
                (
                    _,
                    reject
                ) => {
                    timer =
                        setTimeout(
                            () => {
                                reject(
                                    new Error(
                                        message
                                    )
                                );
                            },
                            timeoutMs
                        );
                }
            ),
        ]);
    } finally {
        if (timer) {
            clearTimeout(
                timer
            );
        }
    }
};


// ============================================================
// TEXT NORMALIZER
// ============================================================

const normalizeText = (
    value
) => {
    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replace(
            /\r\n/g,
            "\n"
        )
        .replace(
            /\r/g,
            "\n"
        )
        .trim();
};


// ============================================================
// NORMALIZE NUMBER
// ============================================================

const normalizeNumber = (
    value,
    fallback = null
) => {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return fallback;
    }

    const number =
        Number(value);

    return Number.isFinite(
        number
    )
        ? number
        : fallback;
};


// ============================================================
// SAFE JSON PARSER
// ============================================================

const parseJsonSafely = (
    value
) => {
    if (
        value === null ||
        value === undefined
    ) {
        return null;
    }

    if (
        typeof value ===
        "object"
    ) {
        return value;
    }

    const text =
        String(value).trim();

    if (!text) {
        return null;
    }

    try {
        return JSON.parse(
            text
        );
    } catch (_) {
        return null;
    }
};


// ============================================================
// REMOVE MARKDOWN JSON FENCE
// ============================================================

const stripMarkdownCodeFence = (
    text
) => {
    let value =
        normalizeText(text);

    if (!value) {
        return "";
    }

    value = value
        .replace(
            /^```json\s*/i,
            ""
        )
        .replace(
            /^```javascript\s*/i,
            ""
        )
        .replace(
            /^```\s*/i,
            ""
        )
        .replace(
            /\s*```$/i,
            ""
        )
        .trim();

    return value;
};


// ============================================================
// EXTRACT JSON
// ============================================================

const extractJsonObject = (
    text
) => {
    const cleaned =
        stripMarkdownCodeFence(
            text
        );

    if (!cleaned) {
        return null;
    }

    const direct =
        parseJsonSafely(
            cleaned
        );

    if (direct) {
        return direct;
    }

    const firstBrace =
        cleaned.indexOf(
            "{"
        );

    const lastBrace =
        cleaned.lastIndexOf(
            "}"
        );

    if (
        firstBrace >= 0 &&
        lastBrace >
            firstBrace
    ) {
        const candidate =
            cleaned.slice(
                firstBrace,
                lastBrace + 1
            );

        const parsed =
            parseJsonSafely(
                candidate
            );

        if (parsed) {
            return parsed;
        }
    }

    const firstBracket =
        cleaned.indexOf(
            "["
        );

    const lastBracket =
        cleaned.lastIndexOf(
            "]"
        );

    if (
        firstBracket >= 0 &&
        lastBracket >
            firstBracket
    ) {
        const candidate =
            cleaned.slice(
                firstBracket,
                lastBracket + 1
            );

        const parsed =
            parseJsonSafely(
                candidate
            );

        if (parsed) {
            return parsed;
        }
    }

    return null;
};


// ============================================================
// SUPABASE ERROR HANDLER
// ============================================================

const throwSupabaseError = (
    error,
    message
) => {
    if (error) {
        console.error(
            message,
            error
        );

        throw new Error(
            `${message}: ${
                error.message ||
                error.details ||
                error.hint ||
                "Unknown Supabase error"
            }`
        );
    }
};


// ============================================================
// GET EXAM SUBJECT
// ============================================================

const getExamSubject =
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
                    "exam_subjects"
                )
                .select(`
                    id,
                    exam_id,
                    subject_id,
                    class_id,
                    full_marks,
                    pass_marks,
                    question_selection_type,
                    questions_to_answer
                `)
                .eq(
                    "id",
                    examSubjectId
                )
                .eq(
                    "exam_id",
                    examId
                )
                .maybeSingle();

        throwSupabaseError(
            error,
            "Failed to load examination subject"
        );

        return data || null;
    };


// ============================================================
// GET EXAM
// ============================================================

const getExam = async (
    examId
) => {
    const {
        data,
        error,
    } =
        await supabase
            .from(
                "exams"
            )
            .select("*")
            .eq(
                "id",
                examId
            )
            .maybeSingle();

    throwSupabaseError(
        error,
        "Failed to load examination"
    );

    return data || null;
};


// ============================================================
// GET SUBJECT
// ============================================================

const getSubject = async (
    subjectId
) => {
    const {
        data,
        error,
    } =
        await supabase
            .from(
                "subjects"
            )
            .select("*")
            .eq(
                "id",
                subjectId
            )
            .maybeSingle();

    throwSupabaseError(
        error,
        "Failed to load subject"
    );

    return data || null;
};


// ============================================================
// FIND LATEST PAPER
// ============================================================

const findExistingPaper =
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
                    "created_at",
                    {
                        ascending:
                            false,
                    }
                )
                .limit(1)
                .maybeSingle();

        throwSupabaseError(
            error,
            "Failed to find existing examination paper"
        );

        return data || null;
    };


// ============================================================
// FIND PAPER BY HASH
// ============================================================

const findPaperByHash =
    async (
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
                    "created_at",
                    {
                        ascending:
                            false,
                    }
                )
                .limit(1)
                .maybeSingle();

        throwSupabaseError(
            error,
            "Failed to find duplicate examination paper"
        );

        return data || null;
    };


// ============================================================
// UPDATE PAPER STATUS
// ============================================================

const updatePaperStatus =
    async (
        paperId,
        values
    ) => {
        if (!paperId) {
            return null;
        }

        const {
            data,
            error,
        } =
            await supabase
                .from(
                    "exam_papers"
                )
                .update(
                    values
                )
                .eq(
                    "id",
                    paperId
                )
                .select("*")
                .maybeSingle();

        throwSupabaseError(
            error,
            "Failed to update examination paper status"
        );

        return data || null;
    };


// ============================================================
// DELETE PREVIOUS AI DATA
// ============================================================
//
// exam_question_analysis haina analysis_id.
// Tunatumia exam_id + exam_subject_id.
//
// exam_questions pia inatakiwa kusafishwa kabla ya
// analysis mpya ya subject hiyo.
// ============================================================

const deleteExistingAiData =
    async (
        examId,
        examSubjectId
    ) => {
        // ====================================================
        // GET OLD ANALYSES
        // ====================================================

        const {
            data: analyses,
            error: analysisError,
        } =
            await supabase
                .from(
                    "exam_ai_analysis"
                )
                .select(
                    "id"
                )
                .eq(
                    "exam_id",
                    examId
                )
                .eq(
                    "exam_subject_id",
                    examSubjectId
                );

        throwSupabaseError(
            analysisError,
            "Failed to find previous AI analysis"
        );

        const analysisIds =
            (
                analyses || []
            ).map(
                (item) =>
                    item.id
            );

        // ====================================================
        // DELETE OLD QUESTION ANALYSIS
        // ====================================================

        const {
            error:
                questionAnalysisError,
        } =
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

        throwSupabaseError(
            questionAnalysisError,
            "Failed to delete previous question analysis"
        );

        // ====================================================
        // DELETE OLD MAIN ANALYSIS
        // ====================================================

        if (
            analysisIds.length >
            0
        ) {
            const {
                error:
                    analysisDeleteError,
            } =
                await supabase
                    .from(
                        "exam_ai_analysis"
                    )
                    .delete()
                    .in(
                        "id",
                        analysisIds
                    );

            throwSupabaseError(
                analysisDeleteError,
                "Failed to delete previous AI analysis"
            );
        }

        // ====================================================
        // DELETE OLD EXAM QUESTIONS
        // ====================================================

        const {
            error:
                questionsError,
        } =
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

        throwSupabaseError(
            questionsError,
            "Failed to delete previous examination questions"
        );
    };


// ============================================================
// VALIDATE QUESTIONS
// ============================================================

const validateQuestions = (
    questions,
    fullMarks
) => {
    if (
        !Array.isArray(
            questions
        )
    ) {
        throw new Error(
            "AI returned an invalid questions array"
        );
    }

    if (
        questions.length ===
        0
    ) {
        throw new Error(
            "AI did not detect any examination questions"
        );
    }

    const normalized = [];

    let totalMarks = 0;

    questions.forEach(
        (
            question,
            index
        ) => {
            if (
                !question ||
                typeof question !==
                    "object"
            ) {
                return;
            }

            const questionNumber =
                normalizeText(
                    question.question_number ||
                        question.number ||
                        question.questionNo ||
                        String(
                            index + 1
                        )
                );

            const questionText =
                normalizeText(
                    question.question_text ||
                        question.text ||
                        question.question
                );

            let maxMarks =
                normalizeNumber(
                    question.max_marks ??
                        question.marks ??
                        question.mark
                );

            if (
                !Number.isFinite(
                    maxMarks
                ) ||
                maxMarks <= 0
            ) {
                maxMarks = 1;
            }

            const isSelective =
                Boolean(
                    question.is_selective ||
                        question.selective
                );

            const selectionCount =
                normalizeNumber(
                    question.selection_count ??
                        question.questions_to_answer,
                    null
                );

            const totalGroupQuestions =
                normalizeNumber(
                    question.total_group_questions ??
                        question.total_questions,
                    null
                );

            const group =
                normalizeText(
                    question.group ||
                        question.section ||
                        ""
                );

            const instruction =
                normalizeText(
                    question.instruction ||
                        question.instructions ||
                        ""
                );

            const expectedAnswer =
                normalizeText(
                    question.expected_answer ||
                        question.answer ||
                        question.answer_expected ||
                        ""
                );

            const explanation =
                normalizeText(
                    question.explanation ||
                        question.ai_explanation ||
                        ""
                );

            if (!questionText) {
                return;
            }

            totalMarks +=
                maxMarks;

            normalized.push({
                question_number:
                    questionNumber,

                question_text:
                    questionText,

                max_marks:
                    maxMarks,

                is_selective:
                    isSelective,

                selection_count:
                    selectionCount,

                total_group_questions:
                    totalGroupQuestions,

                group,

                instruction,

                expected_answer:
                    expectedAnswer,

                explanation:
                    explanation,

                topic:
                    normalizeText(
                        question.topic ||
                            question.main_topic ||
                            ""
                    ),

                sub_topic:
                    normalizeText(
                        question.sub_topic ||
                            question.subtopic ||
                            question.subTopic ||
                            ""
                    ),

                difficulty_level:
                    normalizeText(
                        question.difficulty_level ||
                            question.difficulty ||
                            ""
                    ),

                bloom_level:
                    normalizeText(
                        question.bloom_level ||
                            question.blooms_level ||
                            question.bloomsLevel ||
                            ""
                    ),

                question_type:
                    normalizeText(
                        question.question_type ||
                            question.type ||
                            ""
                    ),

                ai_confidence:
                    normalizeNumber(
                        question.ai_confidence ??
                            question.confidence,
                        null
                    ),
            });
        }
    );

    if (
        normalized.length ===
        0
    ) {
        throw new Error(
            "AI returned no usable examination questions"
        );
    }

    if (
        Number.isFinite(
            Number(fullMarks)
        ) &&
        Number(fullMarks) >
            0
    ) {
        const expected =
            Number(fullMarks);

        const difference =
            Math.abs(
                totalMarks -
                    expected
            );

        if (
            difference >
            Math.max(
                5,
                expected *
                    0.15
            )
        ) {
            console.warn(
                "AI question marks differ materially from examination full marks:",
                {
                    expected,
                    detected:
                        totalMarks,
                }
            );
        }
    }

    return normalized;
};


// ============================================================
// BUILD GEMINI PROMPT
// ============================================================

const buildGeminiPrompt = ({
    exam,
    subject,
    examSubject,
    pdfText,
}) => {
    return `
You are an expert examination-paper analysis assistant.

Analyze the examination paper below and return ONLY valid JSON.

Do not use Markdown.
Do not use code fences.
Do not add explanations before or after the JSON.

The JSON must follow this structure:

{
  "summary": "short summary",
  "instructions": ["instruction 1"],
  "questions": [
    {
      "question_number": "1",
      "question_text": "complete question",
      "expected_answer": "expected answer if reasonably detectable",
      "explanation": "brief explanation if reasonably useful",
      "max_marks": 10,
      "is_selective": false,
      "selection_count": null,
      "total_group_questions": null,
      "group": "",
      "instruction": "",
      "topic": "",
      "sub_topic": "",
      "difficulty_level": "",
      "bloom_level": "",
      "question_type": "",
      "ai_confidence": 0
    }
  ]
}

Rules:
1. Preserve every detectable question.
2. Preserve question numbering.
3. Preserve the exact meaning of each question.
4. Detect question marks carefully.
5. If a question has subparts, keep the complete question together unless the paper clearly treats them as independent numbered questions.
6. Detect selective questions such as "answer any two", "choose three", etc.
7. Never invent a question.
8. Never invent marks that are clearly visible in the paper.
9. If marks are not visible for a question, use the most reasonable value based on the paper structure.
10. Expected answers should only be provided where reasonably inferable from the question.
11. Do not invent unsupported facts.
12. Identify topic only when reasonably detectable.
13. Identify difficulty only when reasonably justified.
14. Identify Bloom level only when reasonably justified.
15. Return valid JSON only.

EXAMINATION:
${normalizeText(
    exam?.name ||
        exam?.title ||
        ""
)}

SUBJECT:
${normalizeText(
    subject?.name ||
        subject?.subject_name ||
        ""
)}

FULL MARKS:
${normalizeText(
    examSubject?.full_marks ||
        ""
)}

PASS MARKS:
${normalizeText(
    examSubject?.pass_marks ||
        ""
)}

PAPER TEXT:
${pdfText}
`;
};


// ============================================================
// SAVE AI ANALYSIS
// ============================================================
//
// IMPORTANT PRODUCTION SCHEMA:
//
// exam_ai_analysis:
//   ai_summary
//   analysis_status
//   instructions TEXT
//
// exam_question_analysis:
//   exam_id
//   exam_subject_id
//   exam_paper_id
//   question_number
//   question_text
//   answer_expected
//   ai_explanation
//   marks
//   max_marks
//   ...
//
// exam_questions:
//   exam_id
//   subject_id
//   exam_subject_id
//   question_number
//   question_text
//   max_marks
//   section
//   section_type
//   is_selective
//   selection_required
//   selection_count
//   selection_total
//   selection_group
//   selection_instruction
//
// ============================================================

const saveAiAnalysis = async ({
    examId,
    examSubjectId,
    exam,
    subject,
    examSubject,
    aiResult,
    paperId,
}) => {
    const questions =
        validateQuestions(
            aiResult.questions,
            examSubject?.full_marks
        );

    // ========================================================
    // DELETE PREVIOUS DATA
    // ========================================================

    await deleteExistingAiData(
        examId,
        examSubjectId
    );

    // ========================================================
    // PREPARE INSTRUCTIONS
    // ========================================================

    let instructionsText =
        "";

    if (
        Array.isArray(
            aiResult.instructions
        )
    ) {
        instructionsText =
            aiResult.instructions
                .map(
                    (item) =>
                        normalizeText(
                            item
                        )
                )
                .filter(
                    Boolean
                )
                .join("\n");
    } else {
        instructionsText =
            normalizeText(
                aiResult.instructions
            );
    }

    // ========================================================
    // TOTAL MARKS
    // ========================================================

    const totalMarks =
        questions.reduce(
            (
                total,
                question
            ) =>
                total +
                (
                    Number(
                        question.max_marks
                    ) || 0
                ),
            0
        );

    // ========================================================
    // INSERT MAIN ANALYSIS
    // ========================================================
    //
    // DO NOT set Completed here.
    //
    // It becomes Completed only after:
    //
    // 1. exam_question_analysis saved
    // 2. exam_questions saved
    //
    // ========================================================

    const {
        data: analysis,
        error: analysisError,
    } =
        await supabase
            .from(
                "exam_ai_analysis"
            )
            .insert({
                exam_id:
                    examId,

                exam_subject_id:
                    examSubjectId,

                exam_paper_id:
                    paperId,

                ai_summary:
                    normalizeText(
                        aiResult.summary
                    ),

                instructions:
                    instructionsText,

                raw_response:
                    aiResult,

                analysis_status:
                    "Processing",

                total_questions:
                    questions.length,

                total_marks:
                    totalMarks,

                subject:
                    normalizeText(
                        subject?.name ||
                            subject?.subject_name ||
                            ""
                    ),
            })
            .select("*")
            .single();

    throwSupabaseError(
        analysisError,
        "Failed to save AI analysis"
    );

    // ========================================================
    // SAVE QUESTION ANALYSIS
    // ========================================================

    const questionAnalysisRows =
        questions.map(
            (
                question,
                index
            ) => {
                const parsedQuestionNumber =
                    Number.parseInt(
                        String(
                            question.question_number ||
                                ""
                        ).match(
                            /^\d+/
                        )?.[0] ||
                            "",
                        10
                    );

                const questionNumber =
                    Number.isFinite(
                        parsedQuestionNumber
                    )
                        ? parsedQuestionNumber
                        : index + 1;

                return {
                    exam_id:
                        examId,

                    exam_subject_id:
                        examSubjectId,

                    exam_paper_id:
                        paperId,

                    question_number:
                        questionNumber,

                    question_text:
                        question.question_text,

                    topic:
                        question.topic ||
                        null,

                    subtopic:
                        question.sub_topic ||
                        null,

                    sub_topic:
                        question.sub_topic ||
                        null,

                    difficulty:
                        question.difficulty_level ||
                        null,

                    difficulty_level:
                        question.difficulty_level ||
                        null,

                    blooms_level:
                        question.bloom_level ||
                        null,

                    bloom_level:
                        question.bloom_level ||
                        null,

                    question_type:
                        question.question_type ||
                        null,

                    ai_confidence:
                        question.ai_confidence,

                    ai_explanation:
                        normalizeText(
                            question.explanation ||
                                ""
                        ),

                    answer_expected:
                        normalizeText(
                            question.expected_answer ||
                                ""
                        ),

                    marks:
                        Math.trunc(
                            Number(
                                question.max_marks
                            ) || 0
                        ),

                    max_marks:
                        Number(
                            question.max_marks
                        ) || 0,

                    section:
                        normalizeText(
                            question.group ||
                                ""
                        ),

                    section_type:
                        null,

                    is_selective:
                        Boolean(
                            question.is_selective
                        ),

                    selection_required:
                        Boolean(
                            question.is_selective
                        ),

                    selection_count:
                        question.selection_count,

                    selection_total:
                        question.total_group_questions,

                    selection_group:
                        normalizeText(
                            question.group ||
                                ""
                        ),

                    selection_instruction:
                        normalizeText(
                            question.instruction ||
                                ""
                        ),
                };
            }
        );

    try {
        if (
            questionAnalysisRows.length >
            0
        ) {
            const {
                error:
                    questionAnalysisError,
            } =
                await supabase
                    .from(
                        "exam_question_analysis"
                    )
                    .insert(
                        questionAnalysisRows
                    );

            throwSupabaseError(
                questionAnalysisError,
                "Failed to save AI question analysis"
            );
        }

        // ====================================================
        // SAVE EXAM QUESTIONS
        // ====================================================

        const questionRows =
            questions.map(
                (
                    question,
                    index
                ) => {
                    const parsedQuestionNumber =
                        Number.parseInt(
                            String(
                                question.question_number ||
                                    ""
                            ).match(
                                /^\d+/
                            )?.[0] ||
                                "",
                            10
                        );

                    const questionNumber =
                        Number.isFinite(
                            parsedQuestionNumber
                        )
                            ? parsedQuestionNumber
                            : index + 1;

                    return {
                        exam_id:
                            examId,

                        subject_id:
                            examSubject
                                ?.subject_id ||
                            null,

                        exam_subject_id:
                            examSubjectId,

                        question_number:
                            questionNumber,

                        question_text:
                            question.question_text,

                        topic:
                            question.topic ||
                            null,

                        sub_topic:
                            question.sub_topic ||
                            null,

                        difficulty_level:
                            question.difficulty_level ||
                            null,

                        ai_confidence:
                            question.ai_confidence,

                        bloom_level:
                            question.bloom_level ||
                            null,

                        question_type:
                            question.question_type ||
                            null,

                        ai_explanation:
                            normalizeText(
                                question.explanation ||
                                    ""
                            ),

                        ai_processed:
                            true,

                        max_marks:
                            Number(
                                question.max_marks
                            ) || 0,

                        section:
                            normalizeText(
                                question.group ||
                                    ""
                            ),

                        section_type:
                            null,

                        is_selective:
                            Boolean(
                                question.is_selective
                            ),

                        selection_required:
                            Boolean(
                                question.is_selective
                            ),

                        selection_count:
                            question.selection_count,

                        selection_total:
                            question.total_group_questions,

                        selection_group:
                            normalizeText(
                                question.group ||
                                    ""
                            ),

                        selection_instruction:
                            normalizeText(
                                question.instruction ||
                                    ""
                            ),
                    };
                }
            );

        if (
            questionRows.length >
            0
        ) {
            const {
                error:
                    questionInsertError,
            } =
                await supabase
                    .from(
                        "exam_questions"
                    )
                    .insert(
                        questionRows
                    );

            throwSupabaseError(
                questionInsertError,
                "Failed to save examination questions"
            );
        }

        // ====================================================
        // ONLY NOW MARK ANALYSIS COMPLETED
        // ====================================================

        const {
            data:
                completedAnalysis,
            error:
                completedAnalysisError,
        } =
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
                )
                .select("*")
                .single();

        throwSupabaseError(
            completedAnalysisError,
            "Failed to mark AI analysis as completed"
        );

        // ====================================================
        // RETURN
        // ====================================================

        return {
            analysis:
                completedAnalysis,

            questions,

            exam,

            subject,
        };
    } catch (error) {
        // ====================================================
        // MARK ANALYSIS FAILED
        // ====================================================

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
                    "id",
                    analysis.id
                );
        } catch (
            statusError
        ) {
            console.error(
                "FAILED TO MARK AI ANALYSIS AS FAILED:",
                statusError
            );
        }

        throw error;
    }
};


// ============================================================
// MERGE QUESTION ANALYSIS INTO EXAM QUESTIONS
// ============================================================
//
// Frontend mostly reads:
//
// payload.questions
//
// Therefore we merge:
//
// exam_questions
// +
// exam_question_analysis
//
// into one usable question object.
//
// Matching preference:
// 1. exact normalized question text
// 2. question number only as fallback
//
// Hii ni muhimu kwa sababu AI inaweza kurudisha question
// number ile ile kwa sub-questions.
// ============================================================

const mergeQuestionData = (
    questions,
    questionAnalysis
) => {
    const sourceQuestions =
        Array.isArray(
            questions
        )
            ? questions
            : [];

    const sourceAnalysis =
        Array.isArray(
            questionAnalysis
        )
            ? questionAnalysis
            : [];

    const normalizeQuestionText =
        (
            value
        ) =>
            normalizeText(
                value
            )
                .toLowerCase()
                .replace(
                    /\s+/g,
                    " "
                );

    const usedAnalysisIds =
        new Set();

    return sourceQuestions.map(
        (
            question,
            index
        ) => {
            const questionTextKey =
                normalizeQuestionText(
                    question.question_text ||
                        question.questionText
                );

            let matched =
                null;

            // =================================================
            // FIRST: EXACT QUESTION TEXT
            // =================================================

            if (
                questionTextKey
            ) {
                matched =
                    sourceAnalysis.find(
                        (
                            item
                        ) =>
                            !usedAnalysisIds.has(
                                item.id
                            ) &&
                            normalizeQuestionText(
                                item.question_text ||
                                    item.questionText
                            ) ===
                                questionTextKey
                    ) ||
                    null;
            }

            // =================================================
            // SECOND: QUESTION NUMBER
            // =================================================

            if (
                !matched
            ) {
                const currentNumber =
                    Number(
                        question.question_number ||
                            question.number ||
                            index + 1
                    );

                matched =
                    sourceAnalysis.find(
                        (
                            item
                        ) =>
                            !usedAnalysisIds.has(
                                item.id
                            ) &&
                            Number(
                                item.question_number
                            ) ===
                                currentNumber
                    ) ||
                    null;
            }

            if (
                matched?.id
            ) {
                usedAnalysisIds.add(
                    matched.id
                );
            }

            return {
                ...question,

                // =================================================
                // ANALYSIS FIELDS
                // =================================================

                topic:
                    matched?.topic ||
                    question.topic ||
                    null,

                sub_topic:
                    matched?.sub_topic ||
                    matched?.subtopic ||
                    question.sub_topic ||
                    null,

                difficulty_level:
                    matched?.difficulty_level ||
                    matched?.difficulty ||
                    question.difficulty_level ||
                    null,

                bloom_level:
                    matched?.bloom_level ||
                    matched?.blooms_level ||
                    question.bloom_level ||
                    null,

                question_type:
                    matched?.question_type ||
                    question.question_type ||
                    null,

                ai_confidence:
                    matched?.ai_confidence ??
                    question.ai_confidence ??
                    null,

                ai_explanation:
                    matched?.ai_explanation ||
                    question.ai_explanation ||
                    "",

                explanation:
                    matched?.ai_explanation ||
                    question.ai_explanation ||
                    "",

                // =================================================
                // EXPECTED ANSWER
                // =================================================

                answer_expected:
                    matched?.answer_expected ||
                    "",

                expected_answer:
                    matched?.answer_expected ||
                    "",

                answer:
                    matched?.answer_expected ||
                    "",

                // =================================================
                // MARKS
                // =================================================

                marks:
                    matched?.marks ??
                    matched?.max_marks ??
                    question.marks ??
                    question.max_marks ??
                    0,

                max_marks:
                    matched?.max_marks ??
                    matched?.marks ??
                    question.max_marks ??
                    0,

                // =================================================
                // SELECTIVE QUESTION INFORMATION
                // =================================================

                is_selective:
                    matched?.is_selective ??
                    question.is_selective ??
                    false,

                selection_required:
                    matched?.selection_required ??
                    question.selection_required ??
                    false,

                selection_count:
                    matched?.selection_count ??
                    question.selection_count ??
                    null,

                selection_total:
                    matched?.selection_total ??
                    question.selection_total ??
                    question.total_group_questions ??
                    null,

                selection_group:
                    matched?.selection_group ||
                    question.selection_group ||
                    question.group ||
                    "",

                selection_instruction:
                    matched?.selection_instruction ||
                    question.selection_instruction ||
                    question.instruction ||
                    "",

                // =================================================
                // ORIGINAL QUESTION ANALYSIS
                // =================================================

                question_analysis:
                    matched ||
                    null,
            };
        }
    );
};


// ============================================================
// PROCESS AI ANALYSIS
// ============================================================

const processAnalyzePaper =
    async ({
        examId,
        examSubjectId,
        paperId,
        fileBuffer,
        fileName,
        hashKey,
    }) => {
        try {
            // ====================================================
            // MARK PAPER PROCESSING
            // ====================================================

            await updatePaperStatus(
                paperId,
                {
                    ai_status:
                        "Processing",

                    status:
                        "Processing",

                    error_message:
                        null,
                }
            );

            // ====================================================
            // GET EXAM
            // ====================================================

            const exam =
                await getExam(
                    examId
                );

            if (!exam) {
                throw new Error(
                    "Examination not found"
                );
            }

            // ====================================================
            // GET EXAM SUBJECT
            // ====================================================

            const examSubject =
                await getExamSubject(
                    examId,
                    examSubjectId
                );

            if (!examSubject) {
                throw new Error(
                    "Examination subject not found"
                );
            }

            // ====================================================
            // GET SUBJECT
            // ====================================================

            const subject =
                await getSubject(
                    examSubject.subject_id
                );

            if (!subject) {
                throw new Error(
                    "Subject not found"
                );
            }

            // ====================================================
            // FILE VALIDATION
            // ====================================================

            if (
                !fileBuffer ||
                !Buffer.isBuffer(
                    fileBuffer
                )
            ) {
                throw new Error(
                    "Examination paper file is missing"
                );
            }

            // ====================================================
            // READ PDF
            // ====================================================

            const pdfText =
                await withTimeout(
                    readPDF(
                        fileBuffer
                    ),
                    30000,
                    "PDF reading timed out"
                );

            const cleanPdfText =
                normalizeText(
                    pdfText
                );

            if (!cleanPdfText) {
                throw new Error(
                    "Could not extract readable text from the examination paper"
                );
            }

            console.log(
                "AI PDF TEXT EXTRACTED:",
                {
                    examId,
                    examSubjectId,
                    paperId,
                    characters:
                        cleanPdfText.length,
                }
            );

            // ====================================================
            // BUILD PROMPT
            // ====================================================

            const prompt =
                buildGeminiPrompt({
                    exam,
                    subject,
                    examSubject,
                    pdfText:
                        cleanPdfText,
                });

            // ====================================================
            // GEMINI
            // ====================================================

            const aiResponse =
                await withTimeout(
                    askGemini(
                        prompt
                    ),
                    120000,
                    "Gemini analysis timed out"
                );

            const rawAiText =
                typeof aiResponse ===
                "string"
                    ? aiResponse
                    : aiResponse?.text ||
                      aiResponse?.content ||
                      aiResponse?.response ||
                      JSON.stringify(
                          aiResponse
                      );

            console.log(
                "GEMINI RESPONSE RECEIVED:",
                {
                    examId,
                    examSubjectId,
                    paperId,
                    responseLength:
                        normalizeText(
                            rawAiText
                        ).length,
                }
            );

            // ====================================================
            // PARSE JSON
            // ====================================================

            const aiResult =
                extractJsonObject(
                    rawAiText
                );

            if (
                !aiResult ||
                typeof aiResult !==
                    "object"
            ) {
                throw new Error(
                    "Gemini returned invalid JSON"
                );
            }

            if (
                !Array.isArray(
                    aiResult.questions
                )
            ) {
                throw new Error(
                    "Gemini response does not contain questions"
                );
            }

            // ====================================================
            // SAVE ALL DATA
            // ====================================================

            const saved =
                await saveAiAnalysis({
                    examId,
                    examSubjectId,
                    exam,
                    subject,
                    examSubject,
                    aiResult,
                    paperId,
                });

            // ====================================================
            // MARK PAPER COMPLETED
            // ====================================================

            await updatePaperStatus(
                paperId,
                {
                    ai_status:
                        "Completed",

                    status:
                        "Completed",

                    error_message:
                        null,
                }
            );

            console.log(
                "AI EXAMINATION ANALYSIS COMPLETED:",
                {
                    examId,
                    examSubjectId,
                    paperId,
                    fileName,
                    questions:
                        saved
                            .questions
                            .length,
                }
            );

            return saved;
        } catch (error) {
            console.error(
                "BACKGROUND AI EXAMINATION ANALYSIS FAILED:",
                {
                    examId,
                    examSubjectId,
                    paperId,
                    fileName,
                    error,
                }
            );

            // ====================================================
            // MARK PAPER FAILED
            // ====================================================

            try {
                await updatePaperStatus(
                    paperId,
                    {
                        ai_status:
                            "Failed",

                        status:
                            "Failed",

                        error_message:
                            normalizeText(
                                error?.message ||
                                    "AI analysis failed"
                            ).slice(
                                0,
                                2000
                            ),
                    }
                );
            } catch (
                statusError
            ) {
                console.error(
                    "FAILED TO UPDATE AI PAPER FAILURE STATUS:",
                    statusError
                );
            }

            return null;
        } finally {
            // ====================================================
            // RELEASE HASH
            // ====================================================

            if (
                hashKey
            ) {
                activeAnalysisHashes.delete(
                    hashKey
                );
            }
        }
    };


// ============================================================
// ANALYZE PAPER
// ============================================================

const analyzePaper = async (
    req,
    res
) => {
    const examId =
        Number(
            req.params.examId ||
                req.body?.exam_id ||
                req.body?.examId
        );

    const examSubjectId =
        Number(
            req.params.examSubjectId ||
                req.body
                    ?.exam_subject_id ||
                req.body?.examSubjectId
        );

    // ========================================================
    // VALIDATE IDS
    // ========================================================

    if (
        !Number.isFinite(
            examId
        ) ||
        !Number.isFinite(
            examSubjectId
        )
    ) {
        return res.status(400).json({
            success: false,
            message:
                "examId and examSubjectId are required",
        });
    }

    // ========================================================
    // VALIDATE FILE
    // ========================================================

    const file =
        req.file;

    if (!file) {
        return res.status(400).json({
            success: false,
            message:
                "Examination paper PDF is required",
        });
    }

    // ========================================================
    // GET EXAM
    // ========================================================

    const exam =
        await getExam(
            examId
        );

    if (!exam) {
        return res.status(404).json({
            success: false,
            message:
                "Examination not found",
        });
    }

    // ========================================================
    // GET EXAM SUBJECT
    // ========================================================

    const examSubject =
        await getExamSubject(
            examId,
            examSubjectId
        );

    if (!examSubject) {
        return res.status(404).json({
            success: false,
            message:
                "Examination subject not found",
        });
    }

    let paper =
        null;

    let hashKey =
        null;

    try {
        // ====================================================
        // HASH PDF
        // ====================================================

        const fileHash =
            crypto
                .createHash(
                    "sha256"
                )
                .update(
                    file.buffer
                )
                .digest("hex");

        hashKey =
            getAnalysisHashKey(
                examId,
                examSubjectId,
                fileHash
            );

        // ====================================================
        // SAME REQUEST ALREADY ACTIVE
        // ====================================================

        if (
            activeAnalysisHashes.has(
                hashKey
            )
        ) {
            const samePaper =
                await findPaperByHash(
                    examId,
                    examSubjectId,
                    fileHash
                );

            return res.status(200).json({
                success: true,

                message:
                    "Examination paper is already queued for AI analysis",

                processing:
                    true,

                paper:
                    samePaper ||
                    null,
            });
        }

        // ====================================================
        // CHECK SAME PAPER
        // ====================================================

        const samePaper =
            await findPaperByHash(
                examId,
                examSubjectId,
                fileHash
            );

        if (
            samePaper &&
            (
                samePaper.ai_status ===
                    "Processing" ||
                samePaper.status ===
                    "Processing"
            )
        ) {
            return res.status(200).json({
                success: true,

                message:
                    "Examination paper is already queued for AI analysis",

                processing:
                    true,

                paper:
                    samePaper,
            });
        }

        // ====================================================
        // LOCK ONLY EXACT HASH
        // ====================================================

        activeAnalysisHashes.add(
            hashKey
        );

        // ====================================================
        // NEW PAPER
        // ====================================================

        const paperPayload = {
            exam_id:
                examId,

            exam_subject_id:
                examSubjectId,

            file_name:
                file.originalname ||
                "examination-paper.pdf",

            file_type:
                file.mimetype ||
                "application/pdf",

            file_hash:
                fileHash,

            status:
                "Processing",

            ai_status:
                "Processing",

            error_message:
                null,
        };

        // ====================================================
        // ALWAYS INSERT NEW PAPER
        // ====================================================

        const {
            data,
            error,
        } =
            await supabase
                .from(
                    "exam_papers"
                )
                .insert(
                    paperPayload
                )
                .select("*")
                .single();

        throwSupabaseError(
            error,
            "Failed to save examination paper"
        );

        paper =
            data;

        // ====================================================
        // COPY BUFFER
        // ====================================================

        const buffer =
            Buffer.from(
                file.buffer
            );

        // ====================================================
        // QUEUE
        // ====================================================

        const queuePosition =
            enqueueAnalysisJob(
                () =>
                    processAnalyzePaper({
                        examId,
                        examSubjectId,
                        paperId:
                            paper.id,
                        fileBuffer:
                            buffer,
                        fileName:
                            file.originalname ||
                            "examination-paper.pdf",
                        hashKey,
                    })
            );

        console.log(
            "AI EXAMINATION PAPER QUEUED:",
            {
                examId,
                examSubjectId,
                paperId:
                    paper.id,
                fileName:
                    file.originalname ||
                    "examination-paper.pdf",
                fileHash,
                queuePosition,
            }
        );

        // ====================================================
        // SUCCESS
        // ====================================================

        return res.status(200).json({
            success: true,

            message:
                "Examination paper uploaded successfully. AI analysis is processing in the background.",

            processing:
                true,

            queue_position:
                queuePosition,

            paper: {
                id:
                    paper.id,

                exam_id:
                    paper.exam_id,

                exam_subject_id:
                    paper.exam_subject_id,

                file_name:
                    paper.file_name,

                status:
                    "Processing",

                ai_status:
                    "Processing",
            },
        });
    } catch (error) {
        console.error(
            "EXAMINATION PAPER UPLOAD FAILED:",
            error
        );

        // ====================================================
        // RELEASE HASH IF PAPER WAS NEVER SAVED
        // ====================================================

        if (
            hashKey &&
            !paper?.id
        ) {
            activeAnalysisHashes.delete(
                hashKey
            );
        }

        // ====================================================
        // PAPER ALREADY SAVED
        // ====================================================

        if (
            paper?.id
        ) {
            try {
                await updatePaperStatus(
                    paper.id,
                    {
                        ai_status:
                            "Failed",

                        status:
                            "Failed",

                        error_message:
                            normalizeText(
                                error?.message ||
                                    "Failed to start AI analysis"
                            ).slice(
                                0,
                                2000
                            ),
                    }
                );
            } catch (
                statusError
            ) {
                console.error(
                    "FAILED TO UPDATE PAPER FAILURE STATUS:",
                    statusError
                );
            }

            return res.status(200).json({
                success: true,

                processing:
                    false,

                ai_failed:
                    true,

                paper: {
                    id:
                        paper.id,

                    exam_id:
                        paper.exam_id,

                    exam_subject_id:
                        paper.exam_subject_id,

                    file_name:
                        paper.file_name,

                    status:
                        "Failed",

                    ai_status:
                        "Failed",

                    error_message:
                        normalizeText(
                            error?.message ||
                                "Failed to start AI analysis"
                        ).slice(
                            0,
                            2000
                        ),
                },

                message:
                    "Examination paper was saved, but AI analysis could not be started.",
            });
        }

        // ====================================================
        // NOTHING SAVED
        // ====================================================

        return res.status(500).json({
            success: false,

            message:
                error?.message ||
                "Failed to upload examination paper",
        });
    }
};


// ============================================================
// GET ANALYSIS BY EXAM + SUBJECT
// ============================================================

const getAnalysis = async (
    req,
    res
) => {
    const examId =
        Number(
            req.params.examId
        );

    const examSubjectId =
        Number(
            req.params.examSubjectId ||
                req.params.subjectId
        );

    if (
        !Number.isFinite(
            examId
        ) ||
        !Number.isFinite(
            examSubjectId
        )
    ) {
        return res.status(400).json({
            success: false,
            message:
                "examId and examSubjectId are required",
        });
    }

    try {
        // ====================================================
        // LATEST PAPER
        // ====================================================

        const paper =
            await findExistingPaper(
                examId,
                examSubjectId
            );

        // ====================================================
        // LATEST ANALYSIS
        // ====================================================

        const {
            data: analysis,
            error: analysisError,
        } =
            await supabase
                .from(
                    "exam_ai_analysis"
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
                    "created_at",
                    {
                        ascending:
                            false,
                    }
                )
                .limit(1)
                .maybeSingle();

        throwSupabaseError(
            analysisError,
            "Failed to load AI analysis"
        );

        // ====================================================
        // GET QUESTION ANALYSIS
        // ====================================================

        let questionAnalysis =
            [];

        if (
            analysis?.id
        ) {
            const {
                data,
                error,
            } =
                await supabase
                    .from(
                        "exam_question_analysis"
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
                                true,
                        }
                    );

            throwSupabaseError(
                error,
                "Failed to load AI question analysis"
            );

            questionAnalysis =
                data || [];

            // ==================================================
            // FILTER TO LATEST PAPER IF POSSIBLE
            // ==================================================

            if (
                analysis.exam_paper_id
            ) {
                const latestPaperRows =
                    questionAnalysis.filter(
                        (
                            item
                        ) =>
                            String(
                                item.exam_paper_id
                            ) ===
                            String(
                                analysis.exam_paper_id
                            )
                    );

                if (
                    latestPaperRows.length >
                    0
                ) {
                    questionAnalysis =
                        latestPaperRows;
                }
            }
        }

        // ====================================================
        // GET EXAM QUESTIONS
        // ====================================================

        const {
            data: questions,
            error: questionsError,
        } =
            await supabase
                .from(
                    "exam_questions"
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
                            true,
                    }
                );

        throwSupabaseError(
            questionsError,
            "Failed to load examination questions"
        );

        // ====================================================
        // MERGE QUESTION ANALYSIS + EXAM QUESTIONS
        // ====================================================

        const mergedQuestions =
            mergeQuestionData(
                questions || [],
                questionAnalysis
            );

        // ====================================================
        // NORMALIZE MAIN ANALYSIS
        // ====================================================

        const normalizedAnalysis =
            analysis
                ? {
                    ...analysis,

                    status:
                        analysis.analysis_status,

                    summary:
                        analysis.ai_summary,
                }
                : null;

        // ====================================================
        // RESPONSE
        // ====================================================

        return res.status(200).json({
            success: true,

            processing:
                paper?.ai_status ===
                    "Processing" ||
                paper?.status ===
                    "Processing",

            status:
                normalizedAnalysis
                    ?.analysis_status ||
                paper?.ai_status ||
                paper?.status ||
                null,

            paper:
                paper ||
                null,

            analysis:
                normalizedAnalysis,

            question_analysis:
                questionAnalysis,

            questions:
                mergedQuestions,
        });
    } catch (error) {
        console.error(
            "GET AI ANALYSIS FAILED:",
            error
        );

        return res.status(500).json({
            success: false,

            message:
                error?.message ||
                "Failed to load AI analysis",
        });
    }
};


// ============================================================
// GET ANALYSIS BY EXAM
// ============================================================

const getAnalysisByExam =
    async (
        req,
        res
    ) => {
        const examId =
            Number(
                req.params.examId
            );

        if (
            !Number.isFinite(
                examId
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "examId is required",
            });
        }

        try {
            // ====================================================
            // PAPERS
            // ====================================================

            const {
                data: papers,
                error: papersError,
            } =
                await supabase
                    .from(
                        "exam_papers"
                    )
                    .select("*")
                    .eq(
                        "exam_id",
                        examId
                    )
                    .order(
                        "created_at",
                        {
                            ascending:
                                false,
                        }
                    );

            throwSupabaseError(
                papersError,
                "Failed to load examination papers"
            );

            // ====================================================
            // ANALYSES
            // ====================================================

            const {
                data: analyses,
                error: analysesError,
            } =
                await supabase
                    .from(
                        "exam_ai_analysis"
                    )
                    .select("*")
                    .eq(
                        "exam_id",
                        examId
                    )
                    .order(
                        "created_at",
                        {
                            ascending:
                                false,
                        }
                    );

            throwSupabaseError(
                analysesError,
                "Failed to load examination AI analyses"
            );

            const normalizedAnalyses =
                (
                    analyses || []
                ).map(
                    (
                        item
                    ) => ({
                        ...item,

                        status:
                            item.analysis_status,

                        summary:
                            item.ai_summary,
                    })
                );

            // ====================================================
            // EXAM QUESTIONS
            // ====================================================

            const {
                data: questions,
                error: questionsError,
            } =
                await supabase
                    .from(
                        "exam_questions"
                    )
                    .select("*")
                    .eq(
                        "exam_id",
                        examId
                    )
                    .order(
                        "id",
                        {
                            ascending:
                                true,
                        }
                    );

            throwSupabaseError(
                questionsError,
                "Failed to load examination questions"
            );

            // ====================================================
            // QUESTION ANALYSIS
            // ====================================================

            const {
                data:
                    questionAnalysis,
                error:
                    questionAnalysisError,
            } =
                await supabase
                    .from(
                        "exam_question_analysis"
                    )
                    .select("*")
                    .eq(
                        "exam_id",
                        examId
                    )
                    .order(
                        "id",
                        {
                            ascending:
                                true,
                        }
                    );

            throwSupabaseError(
                questionAnalysisError,
                "Failed to load examination question analysis"
            );

            // ====================================================
            // MERGE DATA
            // ====================================================

            const normalizedQuestionAnalysis =
                questionAnalysis ||
                [];

            const mergedQuestions =
                mergeQuestionData(
                    questions ||
                        [],
                    normalizedQuestionAnalysis
                );

            // ====================================================
            // RESPONSE
            // ====================================================

            return res.status(200).json({
                success: true,

                papers:
                    papers || [],

                analyses:
                    normalizedAnalyses,

                questions:
                    mergedQuestions,

                question_analysis:
                    normalizedQuestionAnalysis,
            });
        } catch (error) {
            console.error(
                "GET EXAM AI ANALYSIS FAILED:",
                error
            );

            return res.status(500).json({
                success: false,

                message:
                    error?.message ||
                    "Failed to load examination AI analysis",
            });
        }
    };


// ============================================================
// HEALTH CHECK
// ============================================================

const healthCheck = async (
    req,
    res
) => {
    return res.status(200).json({
        success: true,

        service:
            "examination-ai",

        status:
            "online",

        queue_length:
            analysisQueue.length,

        worker_running:
            analysisWorkerRunning,

        active_locks:
            0,

        active_requests:
            activeAnalysisHashes.size,

        timestamp:
            new Date().toISOString(),
    });
};


// ============================================================
// EXPORTS
// ============================================================

export {
    analyzePaper,
    getAnalysis,
    getAnalysisByExam,
    healthCheck,
};

export default {
    analyzePaper,
    getAnalysis,
    getAnalysisByExam,
    healthCheck,
};