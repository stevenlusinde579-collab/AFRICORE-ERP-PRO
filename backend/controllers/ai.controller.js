import crypto from "crypto";
import { supabase } from "../config/supabase.js";
import { readPDF } from "../services/pdfReader.js";
import { askGemini } from "../services/gemini.service.js";

// ============================================================
// AfriCore ERP - FULL AI EXAMINATION ANALYSIS CONTROLLER
// ============================================================
// Key rules:
// 1) Re-analysis is allowed for the same subject and same PDF.
// 2) 1(i), 1(ii), ... belong to MAIN Question 1.
// 3) 4(a), 4(b), ... belong to MAIN Question 4.
// 4) AI must determine topic, quality, confidence, difficulty,
//    Bloom level, question type and expected answer.
// 5) AI analysis is marked Completed only after exam_questions
//    and exam_question_analysis have been saved and verified.
// ============================================================

const jobs = [];
let workerRunning = false;

const withTimeout = (promise, ms, message) => {
  let timer;

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(message);
      error.status = 504;
      error.code = "OPERATION_TIMEOUT";
      reject(error);
    }, ms);
  });

  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timer)),
    timeout,
  ]);
};

const text = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const nullableText = (value) => text(value) || null;

const num = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const int = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n)
    ? Math.max(0, Math.round(n))
    : fallback;
};

const bool = (value, fallback = false) => {
  if (typeof value === "boolean") return value;

  if (typeof value === "number") {
    return value === 1;
  }

  const s = text(value).toLowerCase();

  if (
    [
      "true",
      "1",
      "yes",
      "required",
      "selective",
      "optional",
    ].includes(s)
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
    ].includes(s)
  ) {
    return false;
  }

  return fallback;
};

const marks = (value) => {
  const n = Number(
    String(value ?? "").replace(/,/g, "")
  );

  return Number.isFinite(n) && n > 0
    ? n
    : 0;
};

const clamp100 = (
  value,
  fallback = 0
) =>
  Math.max(
    0,
    Math.min(
      100,
      num(value, fallback)
    )
  );

const unique = (values) =>
  [
    ...new Set(
      (values || [])
        .map(text)
        .filter(Boolean)
    ),
  ];

const sha256 = (buffer) =>
  crypto
    .createHash("sha256")
    .update(buffer)
    .digest("hex");

const supabaseError = (
  error,
  context
) => {
  if (!error) return;

  const e =
    new Error(
      `${context}: ${
        error.message ||
        "Supabase error"
      }`
    );

  e.code =
    error.code || null;

  e.details =
    error.details || null;

  e.hint =
    error.hint || null;

  e.status =
    error.status || 500;

  throw e;
};

// ============================================================
// JSON PARSING
// ============================================================

const cleanJson = (
  value
) =>
  String(value || "")
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
    .replace(
      /[“”]/g,
      '"'
    )
    .replace(
      /[‘’]/g,
      "'"
    )
    .trim();

const extractJson = (
  value
) => {
  const s =
    cleanJson(value);

  const indexes = [
    s.indexOf("{"),
    s.indexOf("["),
  ].filter(
    (x) => x >= 0
  );

  const start =
    indexes.length
      ? Math.min(...indexes)
      : -1;

  if (
    !Number.isFinite(start) ||
    start < 0
  ) {
    return s;
  }

  let depth = 0;
  let quote = false;
  let escape = false;

  for (
    let i = start;
    i < s.length;
    i++
  ) {
    const c =
      s[i];

    if (quote) {
      if (escape) {
        escape = false;
      } else if (
        c === "\\"
      ) {
        escape = true;
      } else if (
        c === '"'
      ) {
        quote = false;
      }

      continue;
    }

    if (c === '"') {
      quote = true;
      continue;
    }

    if (
      c === "{" ||
      c === "["
    ) {
      depth++;
    }

    if (
      c === "}" ||
      c === "]"
    ) {
      depth--;

      if (depth === 0) {
        return s.slice(
          start,
          i + 1
        );
      }
    }
  }

  return s.slice(start);
};

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

  const raw =
    extractJson(value);

  const candidates = [
    raw,
    raw.replace(
      /,\s*([}\]])/g,
      "$1"
    ),
  ];

  for (
    const candidate of
      candidates
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
    } catch (_) {}
  }

  const error =
    new Error(
      "Gemini returned invalid JSON."
    );

  error.code =
    "GEMINI_INVALID_JSON";

  throw error;
};

// ============================================================
// MAIN QUESTION NUMBERING
// ============================================================

const rawNumber = (
  question
) =>
  text(
    question?.question_number ??
      question?.questionNumber ??
      question?.number
  );

const mainNumber = (
  value,
  fallback = 0
) => {
  const s =
    text(value);

  const match =
    s.match(
      /^(\d{1,3})\s*(?:[.)\-:]|\(|$)/
    );

  if (match) {
    return int(
      match[1],
      fallback
    );
  }

  const direct =
    Number(s);

  return Number.isFinite(
    direct
  ) &&
    direct > 0
    ? Math.round(
        direct
      )
    : fallback;
};

const subLabel = (
  value
) => {
  const s =
    text(value);

  const match =
    s.match(
      /^\d+\s*[.):-]?\s*\(?\s*([ivxlcdm]+|[a-z])\s*\)?/i
    );

  return match
    ? match[1].toLowerCase()
    : "";
};

const normalizePdf = (
  value
) =>
  String(value || "")
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

const extractQuestionNumbers = (
  pdfText
) => {
  const lines =
    normalizePdf(
      pdfText
    ).split("\n");

  const set =
    new Set();

  for (
    const line of
      lines
  ) {
    const m =
      line.match(
        /^\s*(?:question\s*)?(\d{1,3})\s*[.)\-:]/i
      );

    if (m) {
      set.add(
        int(m[1])
      );
    }
  }

  return [
    ...set,
  ].sort(
    (a, b) =>
      a - b
  );
};

// ============================================================
// MARK / SELECTION EVIDENCE
// ============================================================

const extractSectionTotals = (
  pdfText
) => {
  const result = {};

  const s =
    normalizePdf(
      pdfText
    );

  for (
    const section of
      ["A", "B", "C", "D", "E"]
  ) {
    const re =
      new RegExp(
        `SECTION\\s*${section}[\\s\\S]{0,250}?(\\d+(?:\\.\\d+)?)\\s*MARKS?`,
        "i"
      );

    const m =
      s.match(re);

    if (m) {
      result[
        section
      ] =
        marks(
          m[1]
        );
    }
  }

  return result;
};

const extractSelection = (
  pdfText
) => {
  const s =
    normalizePdf(
      pdfText
    ).replace(
      /\s+/g,
      " "
    );

  const patterns = [
    /(?:answer|attempt|choose|select)\s+(?:any|only)?\s*(\d+)\s+(?:questions?|items?)\s+(?:from|out of)\s+(?:the\s+)?(\d+)/i,

    /(?:answer|attempt|choose|select)\s+(?:any|only)?\s*(\d+)\s+(?:questions?|items?)/i,
  ];

  for (
    const re of
      patterns
  ) {
    const m =
      s.match(re);

    if (m) {
      return {
        count:
          int(m[1]),

        total:
          int(m[2]),

        section:
          m[0].match(
            /section\s+([A-Z])/i
          )?.[1] ||
          null,

        instruction:
          m[0],
      };
    }
  }

  return null;
};

// ============================================================
// AI PROMPT
// ============================================================

const buildPrompt = ({
  pdfText,
  subjectName,
  level,
  examName,
}) => `
You are an expert Tanzanian secondary-school examination analyst.
Read the ENTIRE examination paper before answering.

CRITICAL QUESTION COUNTING RULE:
- 1(i), 1(ii), 1(iii), ... 1(x) are SUB-ITEMS of MAIN Question 1.
- 4(a), 4(b), 4(c) are SUB-PARTS of MAIN Question 4.
- Do NOT count these sub-items as separate main questions.
- Keep all sub-items inside the parent main question.
- Only a new top-level number such as 2, 3, 4 starts another main question.
- For multiple-choice Question 1, preserve every item and expected answer inside Question 1.

ANALYSIS REQUIRED:
1. Correct main-question number and grouping.
2. Actual marks for each main question.
3. Topic.
4. Sub-topic.
5. Difficulty.
6. Bloom taxonomy level.
7. Question type.
8. Expected answer.
9. Evidence-based AI confidence 0-100.
10. Detailed explanation of the AI reasoning / answer.
11. Selective-question information.
12. Paper-level topics_found.
13. Paper-level weak_topics.
14. Paper-level strong_topics.
15. Paper-level syllabus_coverage 0-100.
16. Paper-level quality_score 0-100.
17. quality_explanation describing WHY the score was assigned.
18. teacher_comments.
19. recommendations.
20. blooms_distribution.

QUALITY SCORE:
Evaluate structure, clarity, topic coverage, cognitive coverage, mark consistency,
question quality, balance and completeness. Do not invent a score without evidence.

AI CONFIDENCE:
0-100 confidence in your own classification of the question based on the paper.
Use high confidence when topic/marks/type/answer are explicit and lower confidence
when the PDF evidence is ambiguous.

EXPECTED ANSWERS:
For MCQ, give the correct option letter AND a concise answer where possible.
For matching questions, preserve the matching response.
For structured questions, summarize the expected answer points.

RETURN ONLY VALID JSON.

Schema:
{
  "summary": "",
  "quality_score": 0,
  "quality_explanation": "",
  "syllabus_coverage": 0,
  "difficulty": "",
  "topics_found": [],
  "weak_topics": [],
  "strong_topics": [],
  "recommendations": [],
  "teacher_comments": "",
  "blooms_distribution": {},
  "instructions": [],
  "questions": [
    {
      "question_number": "1",
      "question_text": "",
      "section": "A",
      "section_type": "compulsory",
      "max_marks": 10,
      "mark_source": "printed_on_paper|inferred_from_exam_structure|derived_from_section_total",
      "mark_evidence": "",
      "topic": "",
      "sub_topic": "",
      "difficulty_level": "",
      "bloom_level": "",
      "question_type": "Multiple Choice|Matching|Short Answer|Structured|Essay|Calculation|Practical|Other",
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

EXAMINATION: ${examName || "Unknown"}
SUBJECT: ${subjectName || "Unknown"}
LEVEL: ${level || "Unknown"}

SECTION TOTAL EVIDENCE:
${JSON.stringify(
  extractSectionTotals(
    pdfText
  )
)}

SELECTION EVIDENCE:
${JSON.stringify(
  extractSelection(
    pdfText
  )
)}

TOP-LEVEL QUESTION NUMBERS DETECTED BY PDF TEXT:
${JSON.stringify(
  extractQuestionNumbers(
    pdfText
  )
)}

FULL PAPER:
${pdfText}
`;

const metadataPrompt = ({
  pdfText,
  subjectName,
  level,
  questions,
}) => `
Audit the following examination analysis.
Do NOT renumber sub-items as main questions.
1(i), 1(ii), ... are all Question 1. 4(a), 4(b) are Question 4.

Return ONLY valid JSON:
{
  "quality_score": 0,
  "quality_explanation": "",
  "syllabus_coverage": 0,
  "topics_found": [],
  "weak_topics": [],
  "strong_topics": [],
  "teacher_comments": "",
  "questions": [
    {
      "question_number": 1,
      "topic": "",
      "sub_topic": "",
      "difficulty_level": "",
      "bloom_level": "",
      "question_type": "",
      "ai_confidence": 0,
      "ai_explanation": "",
      "answer_expected": ""
    }
  ]
}

SUBJECT: ${subjectName || "Unknown"}
LEVEL: ${level || "Unknown"}

CURRENT MAIN QUESTIONS:
${questions
  .map(
    (q) =>
      `Q${q.question_number}: ${q.question_text}`
  )
  .join("\n")}

FULL PAPER:
${pdfText}
`;

// ============================================================
// QUESTION NORMALIZATION AND GROUPING
// ============================================================

const normalizeAIQuestion = (
  q,
  index
) => {
  const raw =
    rawNumber(q) ||
    String(index + 1);

  const number =
    mainNumber(
      raw,
      index + 1
    );

  const child =
    subLabel(
      raw
    );

  const instruction =
    nullableText(
      q.selection_instruction ??
        q.instruction
    );

  let selective =
    bool(
      q.is_selective ??
        q.selective,
      false
    );

  let required =
    bool(
      q.selection_required ??
        q.selectionRequired,
      false
    );

  if (
    instruction &&
    /(?:answer|attempt|choose|select)\s+(?:any|only)\s+\d+/i.test(
      instruction
    )
  ) {
    selective =
      true;

    required =
      true;
  }

  return {
    question_number:
      number,

    raw_question_number:
      raw,

    sub_question_label:
      child,

    question_text:
      text(
        q.question_text ??
          q.questionText ??
          q.text ??
          q.question
      ) ||
      `Question ${number}`,

    topic:
      nullableText(
        q.topic ??
          q.main_topic
      ),

    sub_topic:
      nullableText(
        q.sub_topic ??
          q.subtopic ??
          q.subTopic
      ),

    difficulty_level:
      nullableText(
        q.difficulty_level ??
          q.difficulty
      ),

    bloom_level:
      nullableText(
        q.bloom_level ??
          q.blooms_level ??
          q.bloomsLevel
      ),

    question_type:
      nullableText(
        q.question_type ??
          q.type
      ),

    answer_expected:
      nullableText(
        q.answer_expected ??
          q.expected_answer ??
          q.answer
      ),

    ai_confidence:
      clamp100(
        q.ai_confidence ??
          q.confidence,
        0
      ),

    ai_explanation:
      nullableText(
        q.ai_explanation ??
          q.explanation
      ),

    max_marks:
      marks(
        q.max_marks ??
          q.marks
      ),

    mark_source:
      nullableText(
        q.mark_source
      ) ||
      "inferred_from_exam_structure",

    mark_evidence:
      nullableText(
        q.mark_evidence
      ),

    section:
      nullableText(
        q.section
      ),

    section_type:
      nullableText(
        q.section_type ??
          q.sectionType
      ),

    is_selective:
      selective,

    selection_required:
      required,

    selection_count:
      int(
        q.selection_count ??
          q.selectionCount
      ),

    selection_total:
      int(
        q.selection_total ??
          q.selectionTotal
      ),

    selection_group:
      nullableText(
        q.selection_group ??
          q.selectionGroup ??
          q.group
      ),

    selection_instruction:
      instruction,
  };
};

const groupMainQuestions = (
  rawQuestions
) => {
  const map =
    new Map();

  for (
    const q of
      rawQuestions || []
  ) {
    const normalized =
      normalizeAIQuestion(
        q,
        map.size
      );

    if (
      !map.has(
        normalized.question_number
      )
    ) {
      map.set(
        normalized.question_number,
        []
      );
    }

    map
      .get(
        normalized.question_number
      )
      .push(
        normalized
      );
  }

  return [
    ...map.entries(),
  ]
    .sort(
      (a, b) =>
        a[0] - b[0]
    )
    .map(
      ([
        number,
        items,
      ]) => {
        const first =
          items[0];

        const labels =
          items.filter(
            (q) =>
              q.sub_question_label ||
              q.raw_question_number !==
                String(
                  number
                )
          );

        const parts =
          items.map(
            (q) => {
              const label =
                q.sub_question_label
                  ? `(${q.sub_question_label}) `
                  : "";

              return `${label}${q.question_text}`;
            }
          );

        const answers =
          items
            .map(
              (q) => {
                if (
                  !q.answer_expected
                ) {
                  return "";
                }

                const label =
                  q.sub_question_label
                    ? `(${q.sub_question_label}) `
                    : "";

                return `${label}${q.answer_expected}`;
              }
            )
            .filter(Boolean);

        const topicList =
          unique(
            items.flatMap(
              (q) =>
                String(
                  q.topic || ""
                ).split(
                  /[,;|]/
                )
            )
          );

        const subTopicList =
          unique(
            items.flatMap(
              (q) =>
                String(
                  q.sub_topic ||
                    ""
                ).split(
                  /[,;|]/
                )
            )
          );

        const difficultyList =
          unique(
            items.map(
              (q) =>
                q.difficulty_level
            )
          );

        const bloomList =
          unique(
            items.map(
              (q) =>
                q.bloom_level
            )
          );

        const typeList =
          unique(
            items.map(
              (q) =>
                q.question_type
            )
          );

        const confidenceValues =
          items
            .map(
              (q) =>
                q.ai_confidence
            )
            .filter(
              (v) =>
                v > 0
            );

        const averageConfidence =
          confidenceValues.length
            ? Math.round(
                confidenceValues.reduce(
                  (a, b) =>
                    a + b,
                  0
                ) /
                  confidenceValues.length
              )
            : 0;

        const markTotal =
          items.reduce(
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

        return {
          ...first,

          question_number:
            number,

          question_text:
            labels.length > 0
              ? parts.join(
                  " | "
                )
              : first.question_text,

          answer_expected:
            labels.length > 0
              ? answers.join(
                  " | "
                )
              : first.answer_expected,

          topic:
            topicList.join(
              "; "
            ) ||
            null,

          sub_topic:
            subTopicList.join(
              "; "
            ) ||
            null,

          difficulty_level:
            difficultyList.join(
              "; "
            ) ||
            null,

          bloom_level:
            bloomList.join(
              "; "
            ) ||
            null,

          question_type:
            typeList.join(
              "; "
            ) ||
            first.question_type,

          ai_confidence:
            averageConfidence ||
            first.ai_confidence,

          ai_explanation:
            unique(
              items.map(
                (q) =>
                  q.ai_explanation
              )
            ).join(
              " "
            ) ||
            null,

          max_marks:
            markTotal ||
            first.max_marks,

          is_selective:
            items.some(
              (q) =>
                q.is_selective
            ),

          selection_required:
            items.some(
              (q) =>
                q.selection_required
            ),

          selection_count:
            Math.max(
              ...items.map(
                (q) =>
                  int(
                    q.selection_count
                  )
              ),
              0
            ),

          selection_total:
            Math.max(
              ...items.map(
                (q) =>
                  int(
                    q.selection_total
                  )
              ),
              0
            ),

          selection_group:
            unique(
              items.map(
                (q) =>
                  q.selection_group
              )
            ).join(
              ", "
            ) ||
            null,

          selection_instruction:
            unique(
              items.map(
                (q) =>
                  q.selection_instruction
              )
            ).join(
              " "
            ) ||
            null,

          sub_items:
            labels.length > 0
              ? items
              : undefined,
        };
      }
    );
};

const deriveConfidence = (
  q
) => {
  const checks = [
    !!q.topic,
    !!q.sub_topic,
    !!q.difficulty_level,
    !!q.bloom_level,
    !!q.question_type,
    q.max_marks > 0,
    !!q.answer_expected,
    !!q.ai_explanation,
  ];

  return Math.min(
    98,
    50 +
      Math.round(
        (
          checks.filter(
            Boolean
          ).length /
          checks.length
        ) *
          48
      )
  );
};

const deriveQuality = (
  questions,
  expectedCount
) => {
  if (
    !questions.length
  ) {
    return {
      score: 0,
      explanation:
        "No main questions were identified.",
    };
  }

  const structure =
    expectedCount > 0
      ? Math.min(
          100,
          Math.round(
            (questions.length /
              expectedCount) *
              100
          )
        )
      : 90;

  const topics =
    Math.round(
      (
        questions.filter(
          (q) =>
            q.topic
        ).length /
        questions.length
      ) *
        100
    );

  const metadataFields =
    questions.flatMap(
      (q) => [
        q.topic,
        q.sub_topic,
        q.difficulty_level,
        q.bloom_level,
        q.question_type,
        q.ai_explanation,
      ]
    );

  const metadata =
    Math.round(
      (
        metadataFields.filter(
          Boolean
        ).length /
        Math.max(
          1,
          metadataFields.length
        )
      ) *
        100
    );

  const answers =
    Math.round(
      (
        questions.filter(
          (q) =>
            q.answer_expected
        ).length /
        questions.length
      ) *
        100
    );

  const marksScore =
    Math.round(
      (
        questions.filter(
          (q) =>
            q.max_marks >
            0
        ).length /
        questions.length
      ) *
        100
    );

  const score =
    Math.round(
      structure * 0.25 +
        topics * 0.25 +
        metadata * 0.2 +
        answers * 0.15 +
        marksScore * 0.15
    );

  return {
    score,

    explanation:
      `Paper quality score ${score}/100. ` +
      `Main-question structure ${structure}%; ` +
      `topic detection ${topics}%; ` +
      `metadata completeness ${metadata}%; ` +
      `expected-answer coverage ${answers}%; ` +
      `mark identification ${marksScore}%.`,
  };
};

const applySelectionEvidence = (
  questions,
  selection
) => {
  if (!selection?.count) {
    return questions;
  }

  const targetSection =
    text(
      selection.section
    ).toUpperCase();

  const candidate =
    questions.filter(
      (q) =>
        !targetSection ||
        text(
          q.section
        ).toUpperCase() ===
          targetSection
    );

  const total =
    selection.total > 0
      ? selection.total
      : candidate.length;

  if (
    !candidate.length ||
    total <
      selection.count
  ) {
    return questions;
  }

  const targetNumbers =
    new Set(
      candidate.map(
        (q) =>
          q.question_number
      )
    );

  return questions.map(
    (q) => {
      if (
        !targetNumbers.has(
          q.question_number
        )
      ) {
        return q;
      }

      return {
        ...q,

        is_selective:
          true,

        selection_required:
          true,

        selection_count:
          q.selection_count ||
          selection.count,

        selection_total:
          q.selection_total ||
          total,

        selection_group:
          q.selection_group ||
          `TEXT-${
            targetSection ||
            "GLOBAL"
          }-SELECTION`,

        selection_instruction:
          q.selection_instruction ||
          selection.instruction,
      };
    }
  );
};

// ============================================================
// DB HELPERS
// ============================================================

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
        .select("*")
        .eq(
          "id",
          id
        )
        .maybeSingle();

    supabaseError(
      error,
      "Failed to load exam subject"
    );

    if (!data) {
      throw new Error(
        `Exam subject ${id} was not found.`
      );
    }

    return data;
  };

const createPaper =
  async ({
    examId,
    examSubjectId,
    file,
    hash,
  }) => {
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
        .select("*")
        .single();

    supabaseError(
      error,
      "Failed to create examination paper record"
    );

    return data;
  };

const updatePaper =
  async (
    id,
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
          id
        );

    supabaseError(
      error,
      "Failed to update examination paper status"
    );
  };

const saveMainAnalysis =
  async ({
    examId,
    examSubjectId,
    paperId,
    data,
  }) => {
    const payload = {
      exam_id:
        examId,

      exam_subject_id:
        examSubjectId,

      exam_paper_id:
        paperId,

      analysis_status:
        "Processing",

      total_questions:
        data.questions.length,

      total_marks:
        data.total_marks,

      topics_found:
        data.topics_found,

      syllabus_coverage:
        data.syllabus_coverage,

      difficulty:
        data.difficulty,

      quality_score:
        data.quality_score,

      recommendations:
        data.recommendations.join(
          "\n"
        ),

      subject:
        data.subject,

      level:
        data.level,

      question_analysis:
        data.questions,

      weak_topics:
        data.weak_topics,

      strong_topics:
        data.strong_topics,

      blooms_distribution:
        data.blooms_distribution,

      teacher_comments:
        data.teacher_comments,

      ai_summary:
        data.summary,

      instructions:
        data.instructions,

      raw_response:
        data.raw_response,
    };

    const {
      data: analysis,
      error,
    } =
      await supabase
        .from(
          "exam_ai_analysis"
        )
        .insert(
          payload
        )
        .select("*")
        .single();

    supabaseError(
      error,
      "Failed to save exam AI analysis"
    );

    return analysis;
  };

const buildQuestionRows = ({
  examId,
  examSubjectId,
  paperId,
  subjectId,
  questions,
}) =>
  questions.map(
    (q) => ({
      exam_id:
        examId,

      subject_id:
        subjectId,

      exam_subject_id:
        examSubjectId,

      question_number:
        int(
          q.question_number
        ),

      question_text:
        q.question_text,

      topic:
        q.topic,

      sub_topic:
        q.sub_topic,

      difficulty_level:
        q.difficulty_level,

      ai_confidence:
        clamp100(
          q.ai_confidence ||
            deriveConfidence(q)
        ),

      bloom_level:
        q.bloom_level,

      question_type:
        q.question_type,

      ai_explanation:
        q.ai_explanation,

      ai_processed:
        true,

      max_marks:
        marks(
          q.max_marks
        ),

      section:
        q.section,

      section_type:
        q.section_type,

      is_selective:
        !!q.is_selective,

      selection_required:
        !!q.selection_required,

      selection_count:
        int(
          q.selection_count
        ),

      selection_total:
        int(
          q.selection_total
        ),

      selection_group:
        q.selection_group,

      selection_instruction:
        q.selection_instruction,
    })
  );

const buildAnalysisRows = ({
  examId,
  examSubjectId,
  paperId,
  questions,
}) =>
  questions.map(
    (q) => ({
      exam_id:
        examId,

      exam_subject_id:
        examSubjectId,

      exam_paper_id:
        paperId,

      question_number:
        int(
          q.question_number
        ),

      topic:
        q.topic,

      subtopic:
        q.sub_topic,

      difficulty:
        q.difficulty_level,

      blooms_level:
        q.bloom_level,

      marks:
        marks(
          q.max_marks
        ),

      question_text:
        q.question_text,

      answer_expected:
        q.answer_expected,

      ai_explanation:
        q.ai_explanation,

      max_marks:
        marks(
          q.max_marks
        ),

      section:
        q.section,

      section_type:
        q.section_type,

      is_selective:
        !!q.is_selective,

      selection_required:
        !!q.selection_required,

      selection_count:
        int(
          q.selection_count
        ),

      selection_total:
        int(
          q.selection_total
        ),

      selection_group:
        q.selection_group,

      selection_instruction:
        q.selection_instruction,

      ai_confidence:
        clamp100(
          q.ai_confidence ||
            deriveConfidence(q)
        ),

      question_type:
        q.question_type,
    })
  );

const effectiveMarks = (
  questions
) => {
  const groups =
    new Map();

  let total = 0;

  for (
    const q of
      questions
  ) {
    if (
      !q.is_selective
    ) {
      total += marks(
        q.max_marks
      );

      continue;
    }

    const key =
      q.selection_group ||
      `Q-${q.question_number}`;

    if (
      !groups.has(
        key
      )
    ) {
      groups.set(
        key,
        {
          count:
            int(
              q.selection_count
            ) || 1,

          marks: [],
        }
      );
    }

    groups
      .get(key)
      .marks.push(
        marks(
          q.max_marks
        )
      );
  }

  for (
    const group of
      groups.values()
  ) {
    group.marks.sort(
      (a, b) =>
        b - a
    );

    total +=
      group.marks
        .slice(
          0,
          group.count
        )
        .reduce(
          (a, b) =>
            a + b,
          0
        );
  }

  return total;
};

// ============================================================
// BACKGROUND WORKER
// ============================================================

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
      jobs.length
    ) {
      const job =
        jobs.shift();

      try {
        await processJob(
          job
        );
      } catch (
        error
      ) {
        console.error(
          "AI JOB FAILED:",
          error
        );

        await updatePaper(
          job.paperId,
          "Failed",
          error.message ||
            "AI analysis failed."
        );
      }
    }

    workerRunning =
      false;
  };

const enqueue = (
  job
) => {
  jobs.push(
    job
  );

  void runWorker();
};

// ============================================================
// MAIN PROCESSOR
// ============================================================

const processJob =
  async ({
    examId,
    examSubjectId,
    paperId,
    buffer,
    fileName,
  }) => {
    const started =
      Date.now();

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
      throw new Error(
        "Exam subject does not belong to this examination."
      );
    }

    const {
      data: exam,
      error: examError,
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

    supabaseError(
      examError,
      "Failed to load examination"
    );

    if (!exam) {
      throw new Error(
        `Examination ${examId} was not found.`
      );
    }

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
          .select("*")
          .eq(
            "id",
            subjectId
          )
          .maybeSingle();

      supabaseError(
        error,
        "Failed to load subject"
      );

      subject =
        data;
    }

    const subjectName =
      text(
        subject?.name ??
          subject?.subject_name ??
          subject?.title ??
          "Unknown Subject"
      );

    const level =
      text(
        examSubject.level ??
          examSubject.class_level ??
          exam.level ??
          "Unknown Level"
      );

    const examName =
      text(
        exam.name ??
          exam.exam_name ??
          `Examination ${examId}`
      );

    await updatePaper(
      paperId,
      "Processing",
      null
    );

    const pdfText =
      normalizePdf(
        await withTimeout(
          readPDF({
            buffer,
            originalname:
              fileName,
          }),
          120000,
          "PDF reading timed out."
        )
      );

    if (
      pdfText.length <
      50
    ) {
      throw new Error(
        "The PDF contains little or no readable text."
      );
    }

    const prompt =
      buildPrompt({
        pdfText,
        subjectName,
        level,
        examName,
      });

    const aiRaw =
      await withTimeout(
        askGemini(
          prompt
        ),
        150000,
        "AI analysis timed out after 150 seconds."
      );

    const aiResult =
      parseAI(
        aiRaw
      );

    let questions =
      groupMainQuestions(
        Array.isArray(
          aiResult.questions
        )
          ? aiResult.questions
          : []
      );

    if (
      !questions.length
    ) {
      throw new Error(
        "AI could not identify any main examination questions."
      );
    }

    const expectedNumbers =
      extractQuestionNumbers(
        pdfText
      );

    const expectedCount =
      expectedNumbers.length;

    const selection =
      extractSelection(
        pdfText
      );

    questions =
      applySelectionEvidence(
        questions,
        selection
      );

    questions =
      questions.map(
        (q) => ({
          ...q,

          ai_confidence:
            q.ai_confidence >
            0
              ? q.ai_confidence
              : deriveConfidence(
                  q
                ),
        })
      );

    // ----------------------------------------------------------
    // SECOND AI PASS: repair topics, quality and confidence
    // ----------------------------------------------------------

    let audit =
      null;

    try {
      audit =
        parseAI(
          await withTimeout(
            askGemini(
              metadataPrompt({
                pdfText,
                subjectName,
                level,
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
        "SECOND-PASS AI METADATA AUDIT FAILED:",
        error.message
      );
    }

    if (
      audit?.questions &&
      Array.isArray(
        audit.questions
      )
    ) {
      const auditMap =
        new Map(
          audit.questions.map(
            (q) => [
              mainNumber(
                q.question_number
              ),
              q,
            ]
          )
        );

      questions =
        questions.map(
          (q) => {
            const a =
              auditMap.get(
                q.question_number
              );

            if (!a) {
              return q;
            }

            return {
              ...q,

              topic:
                nullableText(
                  a.topic
                ) ||
                q.topic,

              sub_topic:
                nullableText(
                  a.sub_topic
                ) ||
                q.sub_topic,

              difficulty_level:
                nullableText(
                  a.difficulty_level
                ) ||
                q.difficulty_level,

              bloom_level:
                nullableText(
                  a.bloom_level
                ) ||
                q.bloom_level,

              question_type:
                nullableText(
                  a.question_type
                ) ||
                q.question_type,

              answer_expected:
                nullableText(
                  a.answer_expected
                ) ||
                q.answer_expected,

              ai_explanation:
                nullableText(
                  a.ai_explanation
                ) ||
                q.ai_explanation,

              ai_confidence:
                clamp100(
                  a.ai_confidence,
                  q.ai_confidence
                ),
            };
          }
        );
    }

    const derivedQuality =
      deriveQuality(
        questions,
        expectedCount
      );

    const topicsFound =
      unique([
        ...(
          Array.isArray(
            aiResult.topics_found
          )
            ? aiResult.topics_found
            : []
        ),

        ...(
          Array.isArray(
            audit?.topics_found
          )
            ? audit.topics_found
            : []
        ),

        ...questions.flatMap(
          (q) =>
            String(
              q.topic ||
                ""
            ).split(
              /[,;|]/
            )
        ),
      ]);

    const qualityScore =
      clamp100(
        audit?.quality_score ||
          aiResult.quality_score ||
          derivedQuality.score,
        derivedQuality.score
      );

    const qualityExplanation =
      text(
        audit?.quality_explanation ||
          aiResult.quality_explanation ||
          derivedQuality.explanation
      );

    const syllabusCoverage =
      clamp100(
        audit?.syllabus_coverage ??
          aiResult.syllabus_coverage,
        0
      );

    const summary =
      text(
        audit?.summary ||
          aiResult.summary ||
          `AI analysis completed. ${qualityExplanation}`
      );

    const teacherComments = [
      text(
        audit?.teacher_comments
      ),
      text(
        aiResult.teacher_comments
      ),
      qualityExplanation,
    ]
      .filter(Boolean)
      .join(
        "\n\n"
      );

    const recommendations =
      Array.isArray(
        aiResult.recommendations
      )
        ? aiResult.recommendations
            .map(text)
            .filter(Boolean)
        : [];

    const weakTopics =
      unique([
        ...(
          Array.isArray(
            audit?.weak_topics
          )
            ? audit.weak_topics
            : []
        ),

        ...(
          Array.isArray(
            aiResult.weak_topics
          )
            ? aiResult.weak_topics
            : []
        ),
      ]);

    const strongTopics =
      unique([
        ...(
          Array.isArray(
            audit?.strong_topics
          )
            ? audit.strong_topics
            : []
        ),

        ...(
          Array.isArray(
            aiResult.strong_topics
          )
            ? aiResult.strong_topics
            : []
        ),
      ]);

    const bloomsDistribution =
      aiResult.blooms_distribution &&
      typeof aiResult.blooms_distribution ===
        "object"
        ? aiResult.blooms_distribution
        : {};

    const totalMarks =
      effectiveMarks(
        questions
      );

    if (
      totalMarks <=
      0
    ) {
      throw new Error(
        "AI could not determine a valid examination total mark."
      );
    }

    const analysis =
      await saveMainAnalysis({
        examId,
        examSubjectId,
        paperId,

        data: {
          questions,

          total_marks:
            totalMarks,

          topics_found:
            topicsFound,

          syllabus_coverage:
            syllabusCoverage,

          difficulty:
            text(
              aiResult.difficulty
            ) ||
            "Unknown",

          quality_score:
            qualityScore,

          recommendations,

          subject:
            subjectName,

          level,

          weak_topics:
            weakTopics,

          strong_topics:
            strongTopics,

          blooms_distribution:
            bloomsDistribution,

          teacher_comments:
            teacherComments,

          summary,

          instructions:
            Array.isArray(
              aiResult.instructions
            )
              ? aiResult.instructions.join(
                  "\n"
                )
              : text(
                  aiResult.instructions
                ),

          raw_response:
            aiResult,
        },
      });

    const questionRows =
      buildQuestionRows({
        examId,
        examSubjectId,
        paperId,
        subjectId,
        questions,
      });

    const analysisRows =
      buildAnalysisRows({
        examId,
        examSubjectId,
        paperId,
        questions,
      });

    try {
      const {
        error: qaError,
      } =
        await supabase
          .from(
            "exam_question_analysis"
          )
          .insert(
            analysisRows
          );

      supabaseError(
        qaError,
        "Failed to save AI question analysis"
      );

      const {
        error: qError,
      } =
        await supabase
          .from(
            "exam_questions"
          )
          .insert(
            questionRows
          );

      supabaseError(
        qError,
        "Failed to save examination questions"
      );

      const {
        data: verified,
        error: verifyError,
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
          .gte(
            "question_number",
            1
          )
          .order(
            "question_number"
          );

      supabaseError(
        verifyError,
        "Failed to verify examination questions"
      );

      if (
        !verified?.length
      ) {
        throw new Error(
          "No examination questions were saved."
        );
      }

      const {
        error:
          completeError,
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
          );

      supabaseError(
        completeError,
        "Failed to complete AI analysis"
      );

      await updatePaper(
        paperId,
        "Completed",
        null
      );
    } catch (
      error
    ) {
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

      throw error;
    }

    console.log(
      "AI ANALYSIS COMPLETED",
      {
        examId,
        examSubjectId,
        paperId,
        questions:
          questions.length,
        totalMarks,
        qualityScore,
        topics:
          topicsFound.length,
        durationMs:
          Date.now() -
          started,
      }
    );
  };

// ============================================================
// UPLOAD ENDPOINT
// ============================================================

export const analyzePaper =
  async (
    req,
    res
  ) => {
    try {
      const examId =
        int(
          req.body?.exam_id ??
            req.query?.exam_id
        );

      const examSubjectId =
        int(
          req.body?.exam_subject_id ??
            req.query?.exam_subject_id
        );

      if (
        !examId ||
        !examSubjectId
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Valid exam_id and exam_subject_id are required.",
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

      const fileHash =
        sha256(
          req.file.buffer
        );

      const paper =
        await createPaper({
          examId,
          examSubjectId,
          file:
            req.file,
          hash:
            fileHash,
        });

      enqueue({
        examId,
        examSubjectId,
        paperId:
          paper.id,
        buffer:
          req.file.buffer,
        fileName:
          req.file.originalname,
      });

      return res
        .status(202)
        .json({
          success:
            true,

          processing:
            true,

          status:
            "Processing",

          message:
            "Examination paper uploaded. AI analysis is processing in the background.",

          exam_id:
            examId,

          exam_subject_id:
            examSubjectId,

          exam_paper_id:
            paper.id,

          file_hash:
            fileHash,
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
          ) || 500
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

// ============================================================
// MERGE SAVED QUESTION + ANALYSIS
// ============================================================

const mergeQuestionData = (
  questions,
  analyses
) => {
  const rows =
    analyses || [];

  return (
    questions || []
  ).map(
    (q) => {
      const exactText =
        text(
          q.question_text
        )
          .toLowerCase()
          .replace(
            /\s+/g,
            " "
          );

      let a =
        rows.find(
          (r) =>
            int(
              r.question_number
            ) ===
              int(
                q.question_number
              ) &&
            text(
              r.question_text
            )
              .toLowerCase()
              .replace(
                /\s+/g,
                " "
              ) ===
              exactText
        );

      if (!a) {
        a =
          rows.find(
            (r) =>
              int(
                r.question_number
              ) ===
              int(
                q.question_number
              )
          );
      }

      if (!a) {
        return q;
      }

      return {
        ...q,

        expected_answer:
          a.answer_expected ||
          q.expected_answer ||
          null,

        answer_expected:
          a.answer_expected ||
          q.answer_expected ||
          null,

        topic:
          a.topic ||
          q.topic ||
          null,

        sub_topic:
          a.subtopic ||
          a.sub_topic ||
          q.sub_topic ||
          null,

        difficulty_level:
          a.difficulty ||
          a.difficulty_level ||
          q.difficulty_level ||
          null,

        bloom_level:
          a.blooms_level ||
          a.bloom_level ||
          q.bloom_level ||
          null,

        question_type:
          a.question_type ||
          q.question_type ||
          null,

        ai_confidence:
          num(
            a.ai_confidence,
            num(
              q.ai_confidence,
              0
            )
          ),

        ai_explanation:
          a.ai_explanation ||
          q.ai_explanation ||
          null,

        question_analysis:
          a,
      };
    }
  );
};

// ============================================================
// GET BY EXAM + SUBJECT
// ============================================================

export const getAIAnalysisByExamSubject =
  async (
    req,
    res
  ) => {
    try {
      const examId =
        int(
          req.params.examId
        );

      const examSubjectId =
        int(
          req.params.examSubjectId
        );

      if (
        !examId ||
        !examSubjectId
      ) {
        return res
          .status(400)
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
          .status(400)
          .json({
            success:
              false,

            message:
              "Exam subject does not belong to this examination.",
          });
      }

      const [
        aRes,
        qRes,
        qaRes,
        pRes,
      ] =
        await Promise.all([
          supabase
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
            ),

          supabase
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
            .limit(
              1
            )
            .maybeSingle(),
        ]);

      supabaseError(
        aRes.error,
        "Failed to load exam AI analysis"
      );

      supabaseError(
        qRes.error,
        "Failed to load exam questions"
      );

      supabaseError(
        qaRes.error,
        "Failed to load exam question analysis"
      );

      supabaseError(
        pRes.error,
        "Failed to load exam paper"
      );

      const paper =
        pRes.data ||
        null;

      const dbAnalysis =
        aRes.data ||
        null;

      const dbQuestions =
        qRes.data ||
        [];

      const dbQuestionAnalysis =
        qaRes.data ||
        [];

      const latestPaperId =
        paper?.id
          ? Number(
              paper.id
            )
          : null;

      const analysisMatchesLatestPaper =
        dbAnalysis &&
        latestPaperId
          ? Number(
              dbAnalysis.exam_paper_id
            ) ===
            latestPaperId
          : true;

      let status =
        text(
          paper?.ai_status ||
            paper?.status ||
            dbAnalysis?.analysis_status ||
            "Pending"
        );

      if (
        paper &&
        /processing|pending|running|analyzing/i.test(
          status
        )
      ) {
        status =
          "Processing";
      } else if (
        paper &&
        /failed|error/i.test(
          status
        )
      ) {
        status =
          "Failed";
      } else if (
        dbAnalysis?.analysis_status ===
        "Completed"
      ) {
        status =
          "Completed";
      }

      const questions =
        mergeQuestionData(
          dbQuestions,
          dbQuestionAnalysis
        );

      const fallbackQuestions =
        !questions.length &&
        dbAnalysis?.question_analysis
          ? dbAnalysis.question_analysis
          : questions;

      const effectiveStatus =
        !analysisMatchesLatestPaper &&
        /processing|pending/i.test(
          text(
            paper?.ai_status ||
              paper?.status
          )
        )
          ? "Processing"
          : status;

      const analysis =
        dbAnalysis
          ? {
              ...dbAnalysis,
              analysis_status:
                effectiveStatus,
              status:
                effectiveStatus,
              summary:
                dbAnalysis.ai_summary,
            }
          : null;

      if (
        !analysis &&
        effectiveStatus !==
          "Processing"
      ) {
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

          status:
            effectiveStatus,

          processing:
            effectiveStatus ===
              "Processing" ||
            effectiveStatus ===
              "Pending",

          message:
            effectiveStatus ===
            "Completed"
              ? "AI Analysis imekamilika."
              : effectiveStatus ===
                "Processing"
              ? "AI Analysis inaendelea."
              : "AI Analysis imepata hitilafu.",

          analysis,

          questions:
            fallbackQuestions,

          question_analysis:
            dbQuestionAnalysis,

          paper,

          total_questions:
            fallbackQuestions.length,

          total_marks:
            Number(
              analysis?.total_marks
            ) ||
            effectiveMarks(
              fallbackQuestions
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
          ) || 500
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

// ============================================================
// GET BY EXAM
// ============================================================

export const getAIAnalysis =
  async (
    req,
    res
  ) => {
    try {
      const examId =
        int(
          req.params.examId
        );

      if (!examId) {
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
          .select("*")
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

          analysis:
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
        .status(
          Number(
            error.status
          ) || 500
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

// ============================================================
// HEALTH
// ============================================================

export const aiHealthCheck =
  async (
    req,
    res
  ) =>
    res
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