import crypto from "crypto";
import { supabase } from "../config/supabase.js";
import { readPDF } from "../services/pdfReader.js";
import { askGemini } from "../services/gemini.service.js";

// ============================================================
// AFRICORE ERP - AI EXAMINATION ANALYSIS
// Main rules:
// 1(i)..1(x) = ONE main Question 1
// 4(a)..4(c) = ONE main Question 4
// Q1 MCQ items are preserved inside sub_items.
// ============================================================

const queue = [];
let workerRunning = false;
const AI_TIMEOUT = 180000;
const META_TIMEOUT = 120000;

const t = (v) => v == null ? "" : String(v).trim();
const tn = (v) => t(v) || null;
const n = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;
const i = (v, d = 0) => Math.round(n(v, d));
const marks = (v) => Math.max(0, n(v, 0));
const pct = (v, d = 0) => Math.max(0, Math.min(100, n(v, d)));
const uniq = (a = []) => [...new Set(a.map(t).filter(Boolean))];

const bool = (v, d = false) => {
  if (typeof v === "boolean") return v;

  const s = t(v).toLowerCase();

  if (
    [
      "true",
      "1",
      "yes",
      "required",
      "selective",
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
    ].includes(s)
  ) {
    return false;
  }

  return d;
};

const timeout = (
  promise,
  ms,
  message
) => {
  let timer;

  const p =
    new Promise(
      (
        _,
        reject
      ) => {
        timer =
          setTimeout(
            () => {
              const e =
                new Error(
                  message
                );

              e.status =
                504;

              e.code =
                "OPERATION_TIMEOUT";

              reject(e);
            },
            ms
          );
      }
    );

  return Promise.race([
    Promise.resolve(
      promise
    ).finally(
      () =>
        clearTimeout(
          timer
        )
    ),

    p,
  ]);
};

const dbError = (
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
    error.code ||
    null;

  e.details =
    error.details ||
    null;

  e.hint =
    error.hint ||
    null;

  e.status =
    error.status ||
    500;

  throw e;
};

const hashFile = (
  buffer
) =>
  crypto
    .createHash(
      "sha256"
    )
    .update(buffer)
    .digest(
      "hex"
    );

const cleanPdf = (
  v
) =>
  t(v)
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
    );

// ============================================================
// JSON RECOVERY
// ============================================================

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

  let s =
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
      .trim();

  const positions = [
    s.indexOf("{"),
    s.indexOf("["),
  ].filter(
    (x) => x >= 0
  );

  if (!positions.length) {
    throw new Error(
      "Gemini returned empty JSON."
    );
  }

  const start =
    Math.min(
      ...positions
    );

  s =
    s.slice(
      start
    );

  let depth = 0;
  let quote = false;
  let escape = false;
  let end =
    s.length;

  for (
    let k = 0;
    k < s.length;
    k++
  ) {
    const c =
      s[k];

    if (quote) {
      if (escape) {
        escape =
          false;
      } else if (
        c === "\\"
      ) {
        escape =
          true;
      } else if (
        c === '"'
      ) {
        quote =
          false;
      }

      continue;
    }

    if (c === '"') {
      quote =
        true;
    } else if (
      c === "{" ||
      c === "["
    ) {
      depth++;
    } else if (
      c === "}" ||
      c === "]"
    ) {
      depth--;

      if (
        depth ===
        0
      ) {
        end =
          k + 1;

        break;
      }
    }
  }

  const candidates = [
    s.slice(
      0,
      end
    ),

    s
      .slice(
        0,
        end
      )
      .replace(
        /,\s*([}\]])/g,
        "$1"
      ),
  ];

  for (
    const candidate of
      candidates
  ) {
    try {
      return JSON.parse(
        candidate
      );
    } catch (_) {}
  }

  throw new Error(
    "Gemini returned invalid JSON."
  );
};

// ============================================================
// MAIN QUESTION GROUPING
// ============================================================

const mainNo = (
  value,
  fallback = 0
) => {
  const match =
    t(value).match(
      /^\s*(\d{1,3})\b/
    );

  if (match) {
    return Math.max(
      0,
      i(
        match[1],
        fallback
      )
    );
  }

  return Math.max(
    0,
    i(
      value,
      fallback
    )
  );
};

const subNo = (
  value
) => {
  const match =
    t(value).match(
      /^\s*\d{1,3}\s*[.)\-:]?\s*\(?\s*([a-z]|[ivxlcdm]+)\s*\)?/i
    );

  return match
    ? match[1].toLowerCase()
    : "";
};

const mainNumbersFromPdf = (
  pdf
) => {
  const set =
    new Set();

  for (
    const line of cleanPdf(
      pdf
    ).split("\n")
  ) {
    const match =
      line.match(
        /^\s*(?:QUESTION\s*)?(\d{1,3})\s*[.)\-:]/i
      );

    if (match) {
      const number =
        i(
          match[1]
        );

      if (
        number > 0 &&
        number < 100
      ) {
        set.add(
          number
        );
      }
    }
  }

  return [
    ...set,
  ].sort(
    (a, b) =>
      a - b
  );
};

const pdfTotal = (
  pdf
) => {
  const s =
    cleanPdf(
      pdf
    ).replace(
      /\s+/g,
      " "
    );

  const patterns = [
    /TOTAL\s+MARKS?\s*[:\-]?\s*(\d+(?:\.\d+)?)/i,
    /MAXIMUM\s+MARKS?\s*[:\-]?\s*(\d+(?:\.\d+)?)/i,
    /TOTAL\s*[:\-]?\s*(\d+(?:\.\d+)?)/i,
  ];

  for (
    const pattern of
      patterns
  ) {
    const match =
      s.match(
        pattern
      );

    if (
      match &&
      marks(
        match[1]
      ) > 0
    ) {
      return marks(
        match[1]
      );
    }
  }

  return 0;
};

const selectionEvidence = (
  pdf
) => {
  const s =
    cleanPdf(
      pdf
    ).replace(
      /\s+/g,
      " "
    );

  const patterns = [
    /SECTION\s+([A-Z])[\s\S]{0,250}?(?:answer|attempt|choose|select)\s+(?:any|only)?\s*(\d+)\s*\(\s*\d+\s*\)\s+(?:questions?|items?)[\s\S]{0,80}?(?:from|out of)\s+(?:the\s+)?(\d+)/i,

    /SECTION\s+([A-Z])[\s\S]{0,250}?(?:answer|attempt|choose|select)\s+(?:any|only)?\s*(\d+)\s+(?:questions?|items?)[\s\S]{0,80}?(?:from|out of)\s+(?:the\s+)?(\d+)/i,
  ];

  for (
    const pattern of
      patterns
  ) {
    const match =
      s.match(
        pattern
      );

    if (match) {
      return {
        section:
          match[1].toUpperCase(),

        count:
          i(
            match[2]
          ),

        total:
          i(
            match[3]
          ),

        instruction:
          match[0],
      };
    }
  }

  return null;
};

const normalizeQ = (
  question,
  index
) => {
  const raw =
    t(
      question?.question_number ??
        question?.questionNumber ??
        question?.number
    ) ||
    String(
      index + 1
    );

  const number =
    mainNo(
      raw,
      index + 1
    );

  const instruction =
    tn(
      question?.selection_instruction ??
        question?.selectionInstruction ??
        question?.instruction
    );

  const selective =
    bool(
      question?.is_selective ??
        question?.selective,

      !!instruction &&
        /(?:answer|attempt|choose|select)\s+(?:any|only)\s+\d+/i.test(
          instruction
        )
    );

  return {
    question_number:
      number,

    raw_question_number:
      raw,

    sub_part:
      subNo(
        raw
      ),

    question_text:
      t(
        question?.question_text ??
          question?.questionText ??
          question?.text ??
          question?.question
      ) ||
      `Question ${number}`,

    topic:
      tn(
        question?.topic ??
          question?.main_topic
      ),

    sub_topic:
      tn(
        question?.sub_topic ??
          question?.subtopic ??
          question?.subTopic
      ),

    difficulty_level:
      tn(
        question?.difficulty_level ??
          question?.difficulty
      ),

    bloom_level:
      tn(
        question?.bloom_level ??
          question?.blooms_level ??
          question?.bloomsLevel
      ),

    question_type:
      tn(
        question?.question_type ??
          question?.type
      ),

    answer_expected:
      tn(
        question?.answer_expected ??
          question?.expected_answer ??
          question?.answer
      ),

    ai_confidence:
      pct(
        question?.ai_confidence ??
          question?.confidence,
        0
      ),

    ai_explanation:
      tn(
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
      tn(
        question?.mark_source
      ) ||
      "ai_detected",

    mark_evidence:
      tn(
        question?.mark_evidence
      ),

    section:
      tn(
        question?.section
      ),

    section_type:
      tn(
        question?.section_type ??
          question?.sectionType
      ),

    is_selective:
      selective,

    selection_required:
      bool(
        question?.selection_required ??
          question?.selectionRequired,
        selective
      ),

    selection_count:
      i(
        question?.selection_count ??
          question?.selectionCount ??
          question?.questions_to_answer
      ),

    selection_total:
      i(
        question?.selection_total ??
          question?.selectionTotal ??
          question?.total_group_questions
      ),

    selection_group:
      tn(
        question?.selection_group ??
          question?.selectionGroup ??
          question?.group
      ),

    selection_instruction:
      instruction,
  };
};

const combineGroup = (
  items
) => {
  const first =
    items[0];

  const children =
    items.map(
      (q) => ({
        label:
          q.sub_part ||
          q.raw_question_number,

        raw_question_number:
          q.raw_question_number,

        question_text:
          q.question_text,

        answer_expected:
          q.answer_expected,

        topic:
          q.topic,

        sub_topic:
          q.sub_topic,

        difficulty_level:
          q.difficulty_level,

        bloom_level:
          q.bloom_level,

        question_type:
          q.question_type,

        ai_confidence:
          q.ai_confidence,

        ai_explanation:
          q.ai_explanation,

        max_marks:
          q.max_marks,
      })
    );

  const confidence =
    items
      .map(
        (q) =>
          q.ai_confidence
      )
      .filter(
        (x) =>
          x > 0
      );

  return {
    ...first,

    question_number:
      first.question_number,

    question_text:
      items.length > 1
        ? items
            .map(
              (q) =>
                `${
                  q.sub_part
                    ? `(${q.sub_part}) `
                    : ""
                }${q.question_text}`
            )
            .join(
              " | "
            )
        : first.question_text,

    answer_expected:
      items.length > 1
        ? items
            .map(
              (q) =>
                q.answer_expected
                  ? `${
                      q.sub_part
                        ? `(${q.sub_part}) `
                        : ""
                    }${q.answer_expected}`
                  : ""
            )
            .filter(Boolean)
            .join(
              " | "
            ) ||
          null
        : first.answer_expected,

    topic:
      uniq(
        items.map(
          (q) =>
            q.topic
        )
      ).join(
        "; "
      ) ||
      null,

    sub_topic:
      uniq(
        items.map(
          (q) =>
            q.sub_topic
        )
      ).join(
        "; "
      ) ||
      null,

    difficulty_level:
      uniq(
        items.map(
          (q) =>
            q.difficulty_level
        )
      ).join(
        "; "
      ) ||
      null,

    bloom_level:
      uniq(
        items.map(
          (q) =>
            q.bloom_level
        )
      ).join(
        "; "
      ) ||
      null,

    question_type:
      uniq(
        items.map(
          (q) =>
            q.question_type
        )
      ).join(
        "; "
      ) ||
      first.question_type,

    ai_confidence:
      confidence.length
        ? Math.round(
            confidence.reduce(
              (
                a,
                b
              ) =>
                a + b,
              0
            ) /
              confidence.length
          )
        : 0,

    ai_explanation:
      uniq(
        items.map(
          (q) =>
            q.ai_explanation
        )
      ).join(
        " "
      ) ||
      null,

    max_marks:
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
      ),

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
        0,
        ...items.map(
          (q) =>
            i(
              q.selection_count
            )
        )
      ),

    selection_total:
      Math.max(
        0,
        ...items.map(
          (q) =>
            i(
              q.selection_total
            )
        )
      ),

    selection_group:
      uniq(
        items.map(
          (q) =>
            q.selection_group
        )
      ).join(
        ", "
      ) ||
      null,

    selection_instruction:
      uniq(
        items.map(
          (q) =>
            q.selection_instruction
        )
      ).join(
        " "
      ) ||
      null,

    sub_items:
      items.length > 1
        ? children
        : [],
  };
};

const groupMainQuestions = (
  rawQuestions
) => {
  const groups =
    new Map();

  for (
    let index = 0;
    index <
    rawQuestions.length;
    index += 1
  ) {
    const raw =
      rawQuestions[
        index
      ] || {};

    const parent =
      normalizeQ(
        raw,
        index
      );

    const flat = [];

    if (
      Array.isArray(
        raw.sub_items
      ) &&
      raw.sub_items.length
    ) {
      for (
        let k = 0;
        k <
        raw.sub_items.length;
        k += 1
      ) {
        const child =
          raw.sub_items[
            k
          ] || {};

        flat.push(
          normalizeQ(
            {
              ...child,

              question_number:
                `${parent.question_number}(${
                  child.label ||
                  child.question_number ||
                  k + 1
                })`,
            },
            k
          )
        );
      }

      if (
        parent.max_marks >
        0
      ) {
        flat.push(
          parent
        );
      }
    } else {
      flat.push(
        parent
      );
    }

    for (
      const item of
        flat
    ) {
      if (
        !groups.has(
          item.question_number
        )
      ) {
        groups.set(
          item.question_number,
          []
        );
      }

      groups
        .get(
          item.question_number
        )
        .push(
          item
        );
    }
  }

  return [
    ...groups.entries(),
  ]
    .sort(
      (
        a,
        b
      ) =>
        a[0] -
        b[0]
    )
    .map(
      ([
        ,
        items,
      ]) => {
        const parent =
          items.find(
            (q) =>
              !q.sub_part &&
              q.raw_question_number ===
                String(
                  q.question_number
                ) &&
              q.max_marks >
                0
          );

        if (
          !parent ||
          items.length ===
            1
        ) {
          return combineGroup(
            items
          );
        }

        const childItems =
          items.filter(
            (q) =>
              q !==
              parent
          );

        const grouped =
          combineGroup(
            childItems
          );

        return {
          ...grouped,
          ...parent,

          question_number:
            parent.question_number,

          question_text:
            grouped.question_text,

          answer_expected:
            grouped.answer_expected,

          topic:
            grouped.topic ||
            parent.topic,

          sub_topic:
            grouped.sub_topic ||
            parent.sub_topic,

          difficulty_level:
            grouped.difficulty_level ||
            parent.difficulty_level,

          bloom_level:
            grouped.bloom_level ||
            parent.bloom_level,

          question_type:
            grouped.question_type ||
            parent.question_type,

          ai_confidence:
            grouped.ai_confidence ||
            parent.ai_confidence,

          ai_explanation:
            grouped.ai_explanation ||
            parent.ai_explanation,

          max_marks:
            parent.max_marks,

          sub_items:
            grouped.sub_items,
        };
      }
    );
};

const repairMarks = (
  questions,
  pdf
) => {
  const total =
    pdfTotal(
      pdf
    );

  const q1 =
    questions.find(
      (q) =>
        q.question_number ===
        1
    );

  if (
    q1 &&
    q1.sub_items?.length ===
      10 &&
    /multiple\s*choice|mcq/i.test(
      q1.question_type ||
        ""
    )
  ) {
    q1.max_marks =
      total >= 10
        ? 10
        : q1.sub_items.reduce(
            (
              s,
              x
            ) =>
              s +
              marks(
                x.max_marks
              ),
            0
          );

    q1.mark_source =
      "derived_from_mcq_structure";

    q1.mark_evidence =
      "Question 1 contains ten multiple-choice items and is treated as one main question.";
  }

  for (
    const q of
      questions
  ) {
    if (
      q.max_marks <=
        0 &&
      q.sub_items?.length
    ) {
      q.max_marks =
        q.sub_items.reduce(
          (
            s,
            x
          ) =>
            s +
            marks(
              x.max_marks
            ),
          0
        );
    }
  }

  return questions;
};

const effectiveMarks = (
  questions
) => {
  const normal =
    questions
      .filter(
        (q) =>
          !q.is_selective
      )
      .reduce(
        (
          s,
          q
        ) =>
          s +
          marks(
            q.max_marks
          ),
        0
      );

  const groups =
    new Map();

  for (
    const q of
      questions
  ) {
    if (
      !q.is_selective
    ) {
      continue;
    }

    const key =
      q.selection_group ||
      "SELECTIVE_DEFAULT";

    if (
      !groups.has(
        key
      )
    ) {
      groups.set(
        key,
        {
          count:
            i(
              q.selection_count,
              1
            ) ||
            1,

          marks:
            [],
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

  let selected =
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

    selected +=
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
    selected
  );
};

const qualityFallback = (
  questions
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

  const topic =
    (questions.filter(
      (q) =>
        q.topic
    ).length /
      questions.length) *
    100;

  const metadata =
    (questions.filter(
      (q) =>
        q.topic &&
        q.sub_topic &&
        q.difficulty_level &&
        q.bloom_level &&
        q.question_type
    ).length /
      questions.length) *
    100;

  const answers =
    (questions.filter(
      (q) =>
        q.answer_expected
    ).length /
      questions.length) *
    100;

  const marksScore =
    (questions.filter(
      (q) =>
        q.max_marks >
        0
    ).length /
      questions.length) *
    100;

  const confidence =
    questions
      .map(
        (q) =>
          q.ai_confidence
      )
      .filter(
        (x) =>
          x > 0
      );

  const averageConfidence =
    confidence.length
      ? confidence.reduce(
          (
            a,
            b
          ) =>
            a + b,
          0
        ) /
        confidence.length
      : 0;

  const score =
    Math.round(
      topic * 0.25 +
        metadata *
          0.25 +
        answers *
          0.15 +
        marksScore *
          0.15 +
        averageConfidence *
          0.2
    );

  return {
    score:
      pct(
        score
      ),

    explanation:
      `Quality score ${score}/100: topic coverage ${Math.round(
        topic
      )}%, metadata completeness ${Math.round(
        metadata
      )}%, expected-answer coverage ${Math.round(
        answers
      )}%, marks identified ${Math.round(
        marksScore
      )}%, and average AI confidence ${Math.round(
        averageConfidence
      )}%.`,
  };
};

// ============================================================
// PROMPTS
// ============================================================

const primaryPrompt = ({
  pdf,
  examName,
  subject,
  level,
}) => `
You are an expert Tanzanian examination-paper analyst for AfriCore ERP.
Read the ENTIRE paper before returning JSON.

CRITICAL MAIN-QUESTION RULE:
1(i), 1(ii), 1(iii)... are sub-items of ONE main Question 1.
4(a), 4(b), 4(c)... are sub-parts of ONE main Question 4.
Never turn sub-items into separate main questions.
A new top-level integer (2,3,4,5...) starts a new main question.

MULTIPLE CHOICE:
Question 1 with items 1(i)-1(x) is ONE main Multiple Choice question.
Keep every item in sub_items with its expected answer.

MARKS:
Use printed marks, section structure, number of items and instructions.
For ten one-mark MC items grouped in Q1, main Q1 is 10 marks.
For sub-parts 3+2+4, main question is 9 marks.
For selective 2 out of 3 questions worth 15 each, each question is 15 and
its effective contribution is 30.

ANALYSIS:
For every MAIN question identify topic, sub-topic, difficulty, Bloom level,
question type, expected answer, AI confidence 0-100 and AI explanation.
At paper level identify quality_score, quality_explanation, syllabus_coverage,
topics_found, weak_topics, strong_topics, blooms_distribution,
recommendations and teacher_comments.

RETURN ONLY VALID JSON.

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
  "questions":[{
    "question_number":1,
    "question_text":"",
    "section":"A",
    "section_type":"compulsory",
    "max_marks":10,
    "mark_source":"printed_on_paper|derived_from_structure|inferred_from_exam_structure",
    "mark_evidence":"",
    "topic":"",
    "sub_topic":"",
    "difficulty_level":"",
    "bloom_level":"",
    "question_type":"Multiple Choice|Matching|Structured|Short Answer|Essay|Calculation|Practical|Other",
    "answer_expected":"",
    "ai_confidence":95,
    "ai_explanation":"",
    "is_selective":false,
    "selection_required":false,
    "selection_count":0,
    "selection_total":0,
    "selection_group":"",
    "selection_instruction":"",
    "sub_items":[{
      "label":"i",
      "question_text":"",
      "answer_expected":"",
      "topic":"",
      "sub_topic":"",
      "difficulty_level":"",
      "bloom_level":"",
      "question_type":"",
      "max_marks":1,
      "ai_confidence":95,
      "ai_explanation":""
    }]
  }]
}

EXAMINATION: ${examName}
SUBJECT: ${subject}
LEVEL: ${level}

FULL PAPER:
${pdf}`;

const metadataPrompt = ({
  pdf,
  questions,
  subject,
  level,
}) => `
Audit this examination analysis. Do not change main question numbering or marks.
Do not split 1(i)-1(x) or 4(a)-4(c) into new main questions.
Repair only topics, sub-topics, difficulty, Bloom, question type,
expected answers, AI confidence and paper-level quality/topic information.
Return ONLY JSON:

{
 "quality_score":0,
 "quality_explanation":"",
 "syllabus_coverage":0,
 "topics_found":[],
 "weak_topics":[],
 "strong_topics":[],
 "teacher_comments":"",
 "questions":[{
  "question_number":1,
  "topic":"",
  "sub_topic":"",
  "difficulty_level":"",
  "bloom_level":"",
  "question_type":"",
  "answer_expected":"",
  "ai_confidence":95,
  "ai_explanation":""
 }]
}

SUBJECT: ${subject}
LEVEL: ${level}

MAIN QUESTIONS:
${questions
  .map(
    (q) =>
      `Q${q.question_number}: ${q.question_text}`
  )
  .join(
    "\n"
  )}

FULL PAPER:
${pdf}`;

// ============================================================
// DB
// ============================================================

const getExamSubject =
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

    dbError(
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

const getExam =
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

    dbError(
      error,
      "Failed to load examination"
    );

    if (!data) {
      throw new Error(
        `Examination ${id} was not found.`
      );
    }

    return data;
  };

const getSubject =
  async (
    id
  ) => {
    if (!id) {
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

    dbError(
      error,
      "Failed to load subject"
    );

    return (
      data || null
    );
  };

const createPaper =
  async ({
    examId,
    examSubjectId,
    file,
    fileHash,
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
            fileHash,

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

    dbError(
      error,
      "Failed to create examination paper"
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

    dbError(
      error,
      "Failed to update paper status"
    );
  };

const clearPrevious =
  async (
    examId,
    examSubjectId
  ) => {
    const [
      a,
      b,
      c,
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
          )
          .eq(
            "exam_subject_id",
            examSubjectId
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

    dbError(
      a.error,
      "Failed to delete old question analysis"
    );

    dbError(
      b.error,
      "Failed to delete old exam questions"
    );

    dbError(
      c.error,
      "Failed to delete old AI analysis"
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

    dbError(
      error,
      "Failed to save exam AI analysis"
    );

    return data;
  };

const questionRows =
  ({
    examId,
    examSubjectId,
    subjectId,
    questions,
  }) =>
    questions.map(
      (
        q
      ) => ({
        exam_id:
          examId,

        subject_id:
          subjectId ||
          null,

        exam_subject_id:
          examSubjectId,

        question_number:
          i(
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
          pct(
            q.ai_confidence
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
          i(
            q.selection_count
          ),

        selection_total:
          i(
            q.selection_total
          ),

        selection_group:
          q.selection_group,

        selection_instruction:
          q.selection_instruction,
      })
    );

const analysisRows =
  ({
    examId,
    examSubjectId,
    paperId,
    questions,
  }) =>
    questions.map(
      (
        q
      ) => ({
        exam_id:
          examId,

        exam_subject_id:
          examSubjectId,

        exam_paper_id:
          paperId,

        question_number:
          i(
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
          i(
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
          i(
            q.selection_count
          ),

        selection_total:
          i(
            q.selection_total
          ),

        selection_group:
          q.selection_group,

        selection_instruction:
          q.selection_instruction,

        ai_confidence:
          pct(
            q.ai_confidence
          ),

        question_type:
          q.question_type,
      })
    );

// ============================================================
// PROCESSOR
// ============================================================

const processJob =
  async (
    job
  ) => {
    const examSubject =
      await getExamSubject(
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
      await getExam(
        job.examId
      );

    const subject =
      await getSubject(
        examSubject.subject_id
      );

    const subjectName =
      t(
        subject?.name ??
          subject?.subject_name ??
          subject?.title
      ) ||
      "Unknown Subject";

    const level =
      t(
        examSubject.level ??
          examSubject.class_level ??
          exam.level
      ) ||
      "Unknown Level";

    const examName =
      t(
        exam.name ??
          exam.exam_name ??
          exam.title
      ) ||
      `Examination ${job.examId}`;

    let pdf =
      await timeout(
        readPDF({
          buffer:
            job.buffer,

          originalname:
            job.fileName,
        }),
        AI_TIMEOUT,
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

    const primary =
      await timeout(
        askGemini(
          primaryPrompt({
            pdf,

            examName,

            subject:
              subjectName,

            level,
          })
        ),
        AI_TIMEOUT,
        "AI analysis timed out after 180 seconds."
      );

    const ai =
      parseAI(
        primary
      );

    if (
      !Array.isArray(
        ai.questions
      ) ||
      !ai.questions.length
    ) {
      throw new Error(
        "AI could not identify examination questions."
      );
    }

    let questions =
      groupMainQuestions(
        ai.questions
      );

    questions =
      repairMarks(
        questions,
        pdf
      );

    const selection =
      selectionEvidence(
        pdf
      );

    if (
      selection?.section
    ) {
      const candidates =
        questions.filter(
          (q) =>
            t(
              q.section
            ).toUpperCase() ===
            selection.section
        );

      if (
        candidates.length >=
        selection.count
      ) {
        questions =
          questions.map(
            (q) =>
              candidates.includes(
                q
              )
                ? {
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
                      selection.total ||
                      candidates.length,

                    selection_group:
                      q.selection_group ||
                      `AUTO-${selection.section}`,

                    selection_instruction:
                      q.selection_instruction ||
                      selection.instruction,
                  }
                : q
          );
      }
    }

    questions =
      questions.map(
        (q) => ({
          ...q,

          ai_confidence:
            q.ai_confidence ||
            Math.min(
              98,
              55 +
                (q.topic
                  ? 10
                  : 0) +
                (q.sub_topic
                  ? 8
                  : 0) +
                (q.difficulty_level
                  ? 5
                  : 0) +
                (q.bloom_level
                  ? 5
                  : 0) +
                (q.question_type
                  ? 5
                  : 0) +
                (q.max_marks
                  ? 7
                  : 0) +
                (q.answer_expected
                  ? 8
                  : 0)
            ),
        })
      );

    let meta =
      null;

    try {
      meta =
        parseAI(
          await timeout(
            askGemini(
              metadataPrompt({
                pdf,

                questions,

                subject:
                  subjectName,

                level,
              })
            ),

            META_TIMEOUT,

            "AI metadata audit timed out."
          )
        );
    } catch (
      error
    ) {
      console.warn(
        "AI metadata audit failed:",
        error.message
      );
    }

    if (
      Array.isArray(
        meta?.questions
      )
    ) {
      const metadataMap =
        new Map(
          meta.questions.map(
            (q) => [
              mainNo(
                q.question_number
              ),
              q,
            ]
          )
        );

      questions =
        questions.map(
          (q) => {
            const metadata =
              metadataMap.get(
                q.question_number
              );

            if (
              !metadata
            ) {
              return q;
            }

            return {
              ...q,

              topic:
                tn(
                  metadata.topic
                ) ||
                q.topic,

              sub_topic:
                tn(
                  metadata.sub_topic
                ) ||
                q.sub_topic,

              difficulty_level:
                tn(
                  metadata.difficulty_level
                ) ||
                q.difficulty_level,

              bloom_level:
                tn(
                  metadata.bloom_level
                ) ||
                q.bloom_level,

              question_type:
                tn(
                  metadata.question_type
                ) ||
                q.question_type,

              answer_expected:
                tn(
                  metadata.answer_expected
                ) ||
                q.answer_expected,

              ai_confidence:
                pct(
                  metadata.ai_confidence,
                  q.ai_confidence
                ),

              ai_explanation:
                tn(
                  metadata.ai_explanation
                ) ||
                q.ai_explanation,
            };
          }
        );
    }

    const quality =
      (() => {
        const topic =
          questions.length
            ? (
                questions.filter(
                  (q) =>
                    q.topic
                ).length /
                questions.length
              ) *
              100
            : 0;

        const metadata =
          questions.length
            ? (
                questions.filter(
                  (q) =>
                    q.topic &&
                    q.sub_topic &&
                    q.difficulty_level &&
                    q.bloom_level &&
                    q.question_type
                ).length /
                questions.length
              ) *
              100
            : 0;

        const answers =
          questions.length
            ? (
                questions.filter(
                  (q) =>
                    q.answer_expected
                ).length /
                questions.length
              ) *
              100
            : 0;

        const marksCoverage =
          questions.length
            ? (
                questions.filter(
                  (q) =>
                    q.max_marks >
                    0
                ).length /
                questions.length
              ) *
              100
            : 0;

        const confidence =
          questions
            .map(
              (q) =>
                q.ai_confidence
            )
            .filter(
              (x) =>
                x > 0
            );

        const averageConfidence =
          confidence.length
            ? confidence.reduce(
                (
                  a,
                  b
                ) =>
                  a + b,
                0
              ) /
              confidence.length
            : 0;

        const fallback =
          Math.round(
            topic *
                0.25 +
              metadata *
                0.25 +
              answers *
                0.15 +
              marksCoverage *
                0.15 +
              averageConfidence *
                0.2
          );

        return {
          score:
            pct(
              meta?.quality_score ??
                ai.quality_score ??
                fallback
            ),

          explanation:
            t(
              meta?.quality_explanation ||
                ai.quality_explanation
            ) ||
            `Quality is based on topic coverage ${Math.round(
              topic
            )}%, metadata completeness ${Math.round(
              metadata
            )}%, expected-answer coverage ${Math.round(
              answers
            )}%, mark identification ${Math.round(
              marksCoverage
            )}%, and average AI confidence ${Math.round(
              averageConfidence
            )}%.`,
        };
      })();

    const topics =
      uniq([
        ...(Array.isArray(
          ai.topics_found
        )
          ? ai.topics_found
          : []),

        ...(Array.isArray(
          meta?.topics_found
        )
          ? meta.topics_found
          : []),

        ...questions.flatMap(
          (q) =>
            String(
              q.topic ||
                ""
            ).split(
              /[;,|]/
            )
        ),
      ]);

    const weak =
      uniq([
        ...(Array.isArray(
          ai.weak_topics
        )
          ? ai.weak_topics
          : []),

        ...(Array.isArray(
          meta?.weak_topics
        )
          ? meta.weak_topics
          : []),
      ]);

    const strong =
      uniq([
        ...(Array.isArray(
          ai.strong_topics
        )
          ? ai.strong_topics
          : []),

        ...(Array.isArray(
          meta?.strong_topics
        )
          ? meta.strong_topics
          : []),
      ]);

    const blooms =
      ai.blooms_distribution &&
      typeof ai.blooms_distribution ===
        "object"
        ? ai.blooms_distribution
        : questions.reduce(
            (
              object,
              q
            ) => {
              const key =
                q.bloom_level ||
                "Unknown";

              object[key] =
                (object[key] ||
                  0) +
                1;

              return object;
            },
            {}
          );

    const effective =
      effectiveMarks(
        questions
      );

    const totalFromPdf =
      pdfTotal(
        pdf
      );

    const totalMarks =
      totalFromPdf >
        0 &&
      Math.abs(
        totalFromPdf -
          effective
      ) <=
        5
        ? totalFromPdf
        : effective;

    if (
      totalMarks <=
      0
    ) {
      throw new Error(
        "Could not determine valid examination total marks."
      );
    }

    const summary =
      t(
        ai.summary ||
          ai.ai_summary
      ) ||
      `AI analysed ${questions.length} main questions and detected ${topics.length} topics.`;

    const recommendations =
      Array.isArray(
        ai.recommendations
      )
        ? ai.recommendations
            .map(t)
            .filter(Boolean)
        : [];

    const teacherComments =
      [
        t(
          meta?.teacher_comments
        ),

        t(
          ai.teacher_comments
        ),

        `Average AI confidence: ${Math.round(
          questions.reduce(
            (
              sum,
              q
            ) =>
              sum +
              q.ai_confidence,
            0
          ) /
            Math.max(
              1,
              questions.length
            )
        )}%.`,

        `Paper Quality Score: ${Math.round(
          quality.score
        )}/100.`,

        quality.explanation,
      ]
        .filter(Boolean)
        .join(
          "\n\n"
        );

    const instructions =
      Array.isArray(
        ai.instructions
      )
        ? ai.instructions
            .map(t)
            .filter(Boolean)
            .join(
              "\n"
            )
        : t(
            ai.instructions
          );

    const duplicateNumbers =
      questions.map(
        (q) =>
          q.question_number
      );

    if (
      new Set(
        duplicateNumbers
      ).size !==
      duplicateNumbers.length
    ) {
      throw new Error(
        "Duplicate main question numbers remain after grouping."
      );
    }

    if (
      questions.some(
        (q) =>
          q.max_marks <=
          0
      )
    ) {
      throw new Error(
        "One or more main questions have invalid marks after AI analysis."
      );
    }

    await clearPrevious(
      job.examId,
      job.examSubjectId
    );

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
          topics,

        syllabus_coverage:
          pct(
            meta?.syllabus_coverage ??
              ai.syllabus_coverage,
            0
          ),

        difficulty:
          t(
            ai.difficulty
          ) ||
          "Unknown",

        quality_score:
          quality.score,

        recommendations:
          recommendations.join(
            "\n"
          ),

        subject:
          subjectName,

        level,

        question_analysis:
          questions,

        weak_topics:
          weak,

        strong_topics:
          strong,

        blooms_distribution:
          blooms,

        teacher_comments:
          teacherComments,

        ai_summary:
          summary,

        instructions,

        raw_response:
          ai,
      });

    const qaRows =
      analysisRows({
        examId:
          job.examId,

        examSubjectId:
          job.examSubjectId,

        paperId:
          job.paperId,

        questions,
      });

    const qRows =
      questionRows({
        examId:
          job.examId,

        examSubjectId:
          job.examSubjectId,

        subjectId:
          examSubject.subject_id,

        questions,
      });

    const qaInsert =
      await supabase
        .from(
          "exam_question_analysis"
        )
        .insert(
          qaRows
        );

    dbError(
      qaInsert.error,
      "Failed to save AI question analysis"
    );

    const qInsert =
      await supabase
        .from(
          "exam_questions"
        )
        .insert(
          qRows
        );

    dbError(
      qInsert.error,
      "Failed to save examination questions"
    );

    const verified =
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
          "question_number"
        );

    dbError(
      verified.error,
      "Failed to verify examination questions"
    );

    if (
      !verified.data ||
      verified.data.length !==
        questions.length
    ) {
      throw new Error(
        `Question verification failed. Expected ${questions.length}, found ${
          verified.data?.length ||
          0
        }.`
      );
    }

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

    dbError(
      completed.error,
      "Failed to complete AI analysis"
    );

    await updatePaper(
      job.paperId,
      "Completed",
      null
    );

    console.log(
      "AI ANALYSIS COMPLETED",
      {
        examId:
          job.examId,

        examSubjectId:
          job.examSubjectId,

        paperId:
          job.paperId,

        mainQuestions:
          questions.length,

        totalMarks,

        qualityScore:
          quality.score,

        topics:
          topics.length,
      }
    );
  };

// ============================================================
// WORKER
// ============================================================

const worker =
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
          statusError
        ) {
          console.error(
            statusError
          );
        }

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

const enqueue =
  (
    job
  ) => {
    queue.push(
      job
    );

    void worker();
  };

// ============================================================
// POST /ai/analyze-paper
// ============================================================

export const analyzePaper =
  async (
    req,
    res
  ) => {
    try {
      const examId =
        i(
          req.body?.exam_id ??
            req.query?.exam_id
        );

      const examSubjectId =
        i(
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

      if (
        !req.file
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

      const fileHash =
        hashFile(
          req.file.buffer
        );

      const paper =
        await createPaper({
          examId,

          examSubjectId,

          file:
            req.file,

          fileHash,
        });

      enqueue({
        examId,

        examSubjectId,

        paperId:
          paper.id,

        fileName:
          req.file
            .originalname,

        buffer:
          req.file
            .buffer,
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
            "Examination paper uploaded. AI analysis is processing.",

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

// ============================================================
// GET /ai/analysis/:examId/:examSubjectId
// ============================================================

const mergeRows =
  (
    questions,
    analysisRows
  ) =>
    questions.map(
      (q) => {
        const questionText =
          t(
            q.question_text
          )
            .toLowerCase()
            .replace(
              /\s+/g,
              " "
            );

        let match =
          analysisRows.find(
            (row) =>
              i(
                row.question_number
              ) ===
                i(
                  q.question_number
                ) &&
              t(
                row.question_text
              )
                .toLowerCase()
                .replace(
                  /\s+/g,
                  " "
                ) ===
                questionText
          );

        if (
          !match
        ) {
          match =
            analysisRows.find(
              (row) =>
                i(
                  row.question_number
                ) ===
                i(
                  q.question_number
                )
            );
        }

        if (
          !match
        ) {
          return q;
        }

        return {
          ...q,

          expected_answer:
            match.answer_expected ||
            q.expected_answer ||
            null,

          answer_expected:
            match.answer_expected ||
            q.answer_expected ||
            null,

          topic:
            match.topic ||
            q.topic ||
            null,

          sub_topic:
            match.subtopic ||
            q.sub_topic ||
            null,

          difficulty_level:
            match.difficulty ||
            q.difficulty_level ||
            null,

          bloom_level:
            match.blooms_level ||
            q.bloom_level ||
            null,

          question_type:
            match.question_type ||
            q.question_type ||
            null,

          ai_confidence:
            n(
              match.ai_confidence,
              q.ai_confidence ||
                0
            ),

          ai_explanation:
            match.ai_explanation ||
            q.ai_explanation ||
            null,

          question_analysis:
            match,
        };
      }
    );

export const getAIAnalysisByExamSubject =
  async (
    req,
    res
  ) => {
    try {
      const examId =
        i(
          req.params.examId
        );

      const examSubjectId =
        i(
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
        await getExamSubject(
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

      dbError(
        analysisResult.error,
        "Failed to load exam AI analysis"
      );

      dbError(
        questionsResult.error,
        "Failed to load exam questions"
      );

      dbError(
        questionAnalysisResult.error,
        "Failed to load question analysis"
      );

      dbError(
        paperResult.error,
        "Failed to load exam paper"
      );

      const analysis =
        analysisResult.data ||
        null;

      const questions =
        questionsResult.data ||
        [];

      const questionAnalysis =
        questionAnalysisResult.data ||
        [];

      const paper =
        paperResult.data ||
        null;

      let status =
        t(
          paper?.ai_status ||
            paper?.status ||
            analysis?.analysis_status
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
          t(
            analysis?.analysis_status
          )
        )
      ) {
        status =
          "Completed";
      }

      const merged =
        mergeRows(
          questions,
          questionAnalysis
        );

      const finalQuestions =
        merged.length
          ? merged
          : Array.isArray(
              analysis?.question_analysis
            )
          ? analysis.question_analysis
          : [];

      const finalAnalysis =
        analysis
          ? {
              ...analysis,

              status,

              analysis_status:
                status,

              summary:
                analysis.ai_summary ||
                analysis.summary ||
                null,
            }
          : null;

      return res
        .status(200)
        .json({
          success:
            true,

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

          message:
            status ===
            "Completed"
              ? "AI Analysis imekamilika."
              : status ===
                "Processing"
              ? "AI Analysis inaendelea."
              : status ===
                "Failed"
              ? paper?.error_message ||
                "AI Analysis imepata hitilafu."
              : "AI Analysis bado haijakamilika.",

          analysis:
            finalAnalysis,

          questions:
            finalQuestions,

          question_analysis:
            questionAnalysis,

          paper,

          total_questions:
            finalQuestions.length,

          total_marks:
            Number(
              finalAnalysis?.total_marks
            ) ||
            effectiveMarks(
              finalQuestions
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

// ============================================================
// GET /ai/analysis/:examId
// ============================================================

export const getAIAnalysis =
  async (
    req,
    res
  ) => {
    try {
      const examId =
        i(
          req.params.examId
        );

      if (
        !examId
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

      dbError(
        error,
        "Failed to load AI analysis"
      );

      if (
        !data
      ) {
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
            {
              ...data,

              status:
                data.analysis_status,

              summary:
                data.ai_summary,
            },
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