import test from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_KEY = "test-only-placeholder-key-not-for-network-use";

const { buildExamAnalysisPrompt } = await import("../controllers/ai.controller.js");

const buildPrompt = ({ text, level, subject }) => buildExamAnalysisPrompt({
    pdfText: text,
    structuralQuestions: [],
    subjectName: subject,
    level,
    examName: subject,
    examType: "Uploaded examination paper",
    curriculum: "",
    gradingCriteria: "",
});

test("uses concise page-by-page evidence instructions without replacing established analysis rules", () => {
    const prompt = buildPrompt({
        text: "ADVANCED BIOLOGY\nPAPER 2\nQuestion I: Explain the diagram.",
        level: "Advanced Level",
        subject: "Biology",
    });

    assert.match(prompt, /Read the uploaded PDF page by page, in order/i);
    assert.match(prompt, /original PDF pages together with extracted text/i);
    assert.match(prompt, /Keep the existing JSON schema and analysis flow/i);
    assert.match(prompt, /ADVANCED BIOLOGY/);
    assert.match(prompt, /Explain the diagram/);
    assert.match(prompt, /A main examination question must remain ONE question/i);
    assert.match(prompt, /MARK ALLOCATION MUST BE STRUCTURE-DRIVEN, NOT TEMPLATE-DRIVEN/i);
    assert.match(prompt, /count answerable units/i);
    assert.match(prompt, /Do not assume every question or sub-item has equal marks/i);
    assert.match(prompt, /Keep the paper's own numbering, repeated labels, section names, item types and mark conventions/i);
});

test("supports Primary, Ordinary Level, Advanced Level and unfamiliar layouts without fixed format assumptions", () => {
    const samples = [
        {
            name: "English Standard IV",
            level: "Standard IV",
            text: "ENGLISH LANGUAGE\nSECTION A: 30 MARKS\nChoose the correct answer.\nMatch List A and List B.\nRead the passage and answer questions.",
            expected: [/SECTION A: 30 MARKS/, /Match List A and List B/, /Read the passage/],
        },
        {
            name: "Commerce Form Four",
            level: "Form Four",
            text: "COMMERCE 061\nAnswer all questions in A and B and any TWO questions from C.\nSECTION A (16 Marks)\nSECTION B (54 Marks)\nSECTION C (30 Marks)",
            expected: [/any TWO questions from C/, /SECTION C \(30 Marks\)/],
        },
        {
            name: "Basic Mathematics Form Three",
            level: "Form Three",
            text: "BASIC MATHEMATICS\nSECTION A (60 MARKS)\nRound off 0.63102 to 4 decimal places (1 mark).\nFind the rate of flow (1.5 marks).\nDraw a histogram (3 marks).\nSECTION B (40 MARKS)",
            expected: [/1\.5 marks/, /Draw a histogram/, /SECTION B \(40 MARKS\)/],
        },
        {
            name: "Ordinary Level English",
            level: "Ordinary Level",
            text: "ENGLISH LANGUAGE\nSECTION A\nQuestion 1. Answer all items.\nSECTION B\nQuestion 2(a) Explain the meaning of the following words.",
            expected: [/Question 2\(a\)/, /Ordinary Level/],
        },
    ];

    for (const sample of samples) {
        const prompt = buildPrompt(sample);
        assert.match(prompt, /Read the uploaded PDF page by page, in order/i, sample.name);
        assert.match(prompt, /Use the printed examination paper as the primary evidence/i, sample.name);
        assert.match(prompt, /Never fail analysis merely because the paper does not match a familiar template/i, sample.name);
        for (const pattern of sample.expected) assert.match(prompt, pattern, sample.name);
    }
});

test("keeps missing or unreadable paper details as uncertainty rather than inventing marks", () => {
    const prompt = buildPrompt({
        text: "A scanned paper with unclear marks.",
        level: "Unknown",
        subject: "General Studies",
    });

    assert.match(prompt, /If a field does not apply to this paper/i);
    assert.match(prompt, /Never invent arbitrary marks/i);
    assert.match(prompt, /If the level or curriculum cannot be determined reliably/i);
});


test("applies primary-specific counting and mark reconciliation rules to the uploaded Standard IV English paper", () => {
    const prompt = buildPrompt({
        text: [
            "IRINGA MUNICIPAL COUNCIL",
            "MOCK EXAMINATION STD IV",
            "SUBJECT: ENGLISH LANGUAGE",
            "SECTION A: 30 MARKS",
            "1. Listen carefully and write five sentences (i-v).",
            "2. Choose the most correct answer (i-x).",
            "3. Match List A with List B (i-v).",
            "SECTION B: (10 MARKS)",
            "4. Write the correct word from jumbled letters (i-iii).",
            "4. Complete Mary's daily routine (i-iv).",
            "SECTION C: (10 marks)",
            "6. Read the passage and answer five questions (i-v).",
        ].join("\\n"),
        level: "Standard IV",
        subject: "English Language",
    });

    assert.match(prompt, /PRIMARY-SCHOOL PAPER RULES/i);
    assert.match(prompt, /every answer slot\/sub-item/i);
    assert.match(prompt, /repeats a number/i);
    assert.match(prompt, /do not merge them or silently renumber them/i);
    assert.match(prompt, /Cross-check sub-items against their parent question, question totals against section totals, and section totals against the paper total/i);
    assert.match(prompt, /do not fabricate precision/i);
});

test("detects Baby Class, Nursery and Swahili primary labels and adds dedicated early-years analysis rules", () => {
    const samples = [
        { level: "Baby Class", text: "BABY CLASS\nCOLOUR THE PICTURE\nTRACE THE LETTER A", subject: "Environmental Activities" },
        { level: "Nursery", text: "CHEKECHEA\nUNGANISHA PICHA NA MANENO", subject: "Language" },
        { level: "Darasa la Nne", text: "SHULE YA MSINGI\nMTIHANI WA KISWAHILI\nJibu maswali yote.", subject: "Kiswahili" },
        { level: "Unknown", text: "STANDARD IV ENGLISH\nMATCH THE PICTURES\nFILL IN THE BLANKS", subject: "English" },
    ];

    for (const sample of samples) {
        const prompt = buildPrompt(sample);
        assert.match(prompt, /PRIMARY-SCHOOL PAPER RULES/i, sample.level);
        assert.match(prompt, /USE A PRIMARY\/EARLY-YEARS ANALYSIS MODE/i, sample.level);
        assert.match(prompt, /Keep JSON compact to reduce truncation/i, sample.level);
    }
});

test("does not apply primary-only rules to a Form Four paper", () => {
    const prompt = buildPrompt({
        text: "FORM FOUR COMMERCE\\nSECTION A (16 MARKS)\\nAnswer all questions.",
        level: "Form Four",
        subject: "Commerce",
    });

    assert.doesNotMatch(prompt, /PRIMARY-SCHOOL PAPER RULES/i);
});
