import crypto from "crypto";
import { supabase } from "../config/supabase.js";
import { readPDF } from "../services/pdfReader.js";
import { askGemini } from "../services/gemini.service.js";

// ============================================================
// AI ANALYSIS QUEUE
// ============================================================
//
// Muhimu:
// - Hakuna lock ya exam + subject tena.
// - Papers nyingi za subject moja zinaweza kuingia kwenye queue.
// - Queue inazichakata moja baada ya nyingine.
// - Hii inaruhusu Upload Another / Re-analysis.
// ============================================================

const analysisQueue = [];
let analysisWorkerRunning = false;


// ============================================================
// RUN NEXT AI ANALYSIS JOB
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
// ENQUEUE AI ANALYSIS JOB
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
// NUMBER NORMALIZER
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
// REMOVE MARKDOWN JSON CODE FENCE
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
// EXTRACT JSON OBJECT
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
            .from("exams")
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
            .from("subjects")
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
// FIND PAPER BY EXACT HASH
// ============================================================
//
// Used only to stop the same exact PDF from being submitted
// twice while the first request is still processing.
//
// This does NOT block a new/different paper.
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

const deleteExistingAiData =
    async (
        examId,
        examSubjectId
    ) => {
        const {
            data: analyses,
            error: analysisError,
        } =
            await supabase
                .from(
                    "exam_ai_analysis"
                )
                .select("id")
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

        if (
            analysisIds.length >
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
                    .delete()
                    .in(
                        "analysis_id",
                        analysisIds
                    );

            throwSupabaseError(
                questionAnalysisError,
                "Failed to delete previous question analysis"
            );

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
      "max_marks": 10,
      "is_selective": false,
      "selection_count": null,
      "total_group_questions": null,
      "group": "",
      "instruction": ""
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
10. Return valid JSON only.

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

    await deleteExistingAiData(
        examId,
        examSubjectId
    );

    // ========================================================
    // SAVE AI ANALYSIS
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

                summary:
                    normalizeText(
                        aiResult.summary
                    ),

                instructions:
                    Array.isArray(
                        aiResult.instructions
                    )
                        ? aiResult.instructions
                        : [],

                raw_response:
                    aiResult,

                status:
                    "Completed",
            })
            .select("*")
            .single();

    throwSupabaseError(
        analysisError,
        "Failed to save AI analysis"
    );

    // ========================================================
    // SAVE AI QUESTION ANALYSIS
    // ========================================================

    const questionAnalysisRows =
        questions.map(
            (
                question,
                index
            ) => ({
                analysis_id:
                    analysis.id,

                exam_id:
                    examId,

                exam_subject_id:
                    examSubjectId,

                question_number:
                    question.question_number ||
                    String(
                        index + 1
                    ),

                question_text:
                    question.question_text,

                expected_answer:
                    normalizeText(
                        question.expected_answer ||
                            question.answer ||
                            ""
                    ),

                explanation:
                    normalizeText(
                        question.explanation ||
                            ""
                    ),

                max_marks:
                    question.max_marks,

                raw_question:
                    question,
            })
        );

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

    // ========================================================
    // SAVE EXAM QUESTIONS
    // ========================================================

    const questionRows =
        questions.map(
            (
                question,
                index
            ) => ({
                exam_id:
                    examId,

                exam_subject_id:
                    examSubjectId,

                question_number:
                    question.question_number ||
                    String(
                        index + 1
                    ),

                question_text:
                    question.question_text,

                max_marks:
                    question.max_marks,

                is_selective:
                    Boolean(
                        question.is_selective
                    ),

                selection_count:
                    question.selection_count,

                total_group_questions:
                    question.total_group_questions,

                group:
                    question.group,

                instruction:
                    question.instruction,
            })
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

    return {
        analysis,
        questions,
        exam,
        subject,
    };
};


// ============================================================
// PROCESS AI ANALYSIS BACKGROUND JOB
// ============================================================

const processAnalyzePaper =
    async ({
        examId,
        examSubjectId,
        paperId,
        fileBuffer,
        fileName,
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
            // LOAD EXAM
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
            // LOAD EXAM SUBJECT
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
            // LOAD SUBJECT
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
            // VALIDATE FILE
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

            // ====================================================
            // BUILD GEMINI PROMPT
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
            // CALL GEMINI
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

            // ====================================================
            // EXTRACT GEMINI JSON
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
            // SAVE AI ANALYSIS
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
            // MARK ONLY THIS PAPER AS FAILED
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
    // LOAD EXAM
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
    // LOAD EXAM SUBJECT
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

    let paper = null;

    try {
        // ====================================================
        // CREATE FILE HASH
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

        // ====================================================
        // CHECK WHETHER EXACT SAME PAPER IS ALREADY PROCESSING
        // ====================================================
        //
        // Hii ni protection dhidi ya duplicate request.
        //
        // Haizuii paper mpya.
        // Haizuii re-analysis baada ya Completed/Failed.
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
        // NEW PAPER PAYLOAD
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
        // ALWAYS CREATE NEW PAPER RECORD
        // ====================================================
        //
        // IMPORTANT:
        // Hatufanyi UPDATE ya paper ya zamani.
        //
        // Kila upload mpya inapata ID yake mpya.
        //
        // Example:
        //
        // Paper 1 -> ID 334
        // Paper 2 -> ID 335
        // Paper 3 -> ID 336
        //
        // Papers hizi zote zinaweza kuwa za subject moja.
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

        const paperId =
            paper.id;

        // ====================================================
        // COPY FILE BUFFER
        // ====================================================

        const buffer =
            Buffer.from(
                file.buffer
            );

        // ====================================================
        // QUEUE BACKGROUND AI ANALYSIS
        // ====================================================

        const queuePosition =
            enqueueAnalysisJob(
                () =>
                    processAnalyzePaper({
                        examId,
                        examSubjectId,
                        paperId,
                        fileBuffer:
                            buffer,
                        fileName:
                            file.originalname ||
                            "examination-paper.pdf",
                    })
            );

        // ====================================================
        // LOG QUEUED PAPER
        // ====================================================

        console.log(
            "AI EXAMINATION PAPER QUEUED:",
            {
                examId,
                examSubjectId,
                paperId,
                fileName:
                    file.originalname,
                queuePosition,
            }
        );

        // ====================================================
        // RETURN SUCCESS
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
        // PAPER WAS SAVED BUT SOMETHING FAILED AFTERWARD
        // ====================================================

        if (paper?.id) {
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

            // ==================================================
            // PDF ALREADY SAVED.
            // RETURN 200 SO FRONTEND DOES NOT SEE FALSE 500.
            // ==================================================

            return res.status(200).json({
                success: true,

                processing:
                    false,

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
        // NOTHING WAS SAVED
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
// GET AI ANALYSIS BY EXAM + SUBJECT
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
        // GET LATEST PAPER
        // ====================================================

        const paper =
            await findExistingPaper(
                examId,
                examSubjectId
            );

        // ====================================================
        // GET LATEST AI ANALYSIS
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
        // QUESTION ANALYSIS
        // ====================================================

        let questionAnalysis =
            [];

        if (analysis?.id) {
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
                        "analysis_id",
                        analysis.id
                    )
                    .order(
                        "question_number",
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
        }

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
            questionsError,
            "Failed to load examination questions"
        );

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

            paper:
                paper || null,

            analysis:
                analysis || null,

            question_analysis:
                questionAnalysis,

            questions:
                questions || [],
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
// GET AI ANALYSIS BY EXAM
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
            // GET PAPERS
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
            // GET ANALYSES
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

            // ====================================================
            // GET QUESTIONS
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
                        "question_number",
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
            // RESPONSE
            // ====================================================

            return res.status(200).json({
                success: true,

                papers:
                    papers || [],

                analyses:
                    analyses || [],

                questions:
                    questions || [],
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