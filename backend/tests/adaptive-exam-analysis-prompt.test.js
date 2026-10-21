import test from "node:test";
import assert from "node:assert/strict";

// Importing the prompt builder is safe: this test never calls Supabase or Gemini.
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_KEY = "test-only-placeholder-key-not-for-network-use";

const { buildExamAnalysisPrompt } = await import("../controllers/ai.controller.js");

test("builds a paper-first prompt that supports unfamiliar examination formats", () => {
    const prompt = buildExamAnalysisPrompt({
        pdfText: "ADVANCED BIOLOGY\nPAPER 2\nQuestion I: Explain the diagram.",
        structuralQuestions: [
            { question_number: 1, text: "Explain the diagram." },
        ],
        subjectName: "Biology",
        level: "Advanced Level",
        examName: "Internal Assessment",
        examType: "School Examination",
        curriculum: "",
        gradingCriteria: "",
    });

    assert.match(prompt, /Treat the uploaded PDF itself as the source of truth/i);
    assert.match(prompt, /visually as well as using extracted text/i);
    assert.match(prompt, /Never require the paper to contain sections A\/B\/C/i);
    assert.match(prompt, /If the paper uses an unfamiliar or mixed format, adapt the analysis to it/i);
    assert.match(prompt, /Cross-check the number of questions and total marks against the PDF/i);
    assert.match(prompt, /ADVANCED BIOLOGY/);
    assert.match(prompt, /Explain the diagram/);
});

test("keeps unknown paper details as uncertainty rather than encouraging guesses", () => {
    const prompt = buildExamAnalysisPrompt({
        pdfText: "A scanned paper with unclear marks.",
        structuralQuestions: [],
        subjectName: "General Studies",
        level: "Unknown",
        examName: "Test",
        examType: "",
        curriculum: "",
        gradingCriteria: "",
    });

    assert.match(prompt, /If a field does not apply to this paper/i);
    assert.match(prompt, /explain the discrepancy in recommendations; do not silently invent a reconciliation/i);
    assert.match(prompt, /Never invent arbitrary marks/i);
});


test("supports the three uploaded real-paper layouts without imposing one template", () => {
    const paperSamples = [
        {
            name: "English Standard IV",
            level: "Standard IV",
            text: [
                "IRINGA MUNICIPAL COUNCIL",
                "MOCK EXAMINATION STD IV",
                "SUBJECT: ENGLISH LANGUAGE",
                "SECTION A: 30 MARKS",
                "1. Listen carefully to the sentences read by your invigilator",
                "2. Choose the most correct answer from the given alternatives",
                "3. Match the words from List A with the words with similar sounds in List B",
                "SECTION B: 10 MARKS",
                "SECTION C: 10 marks",
                "6. Read the following passage carefully and then answer the questions that follow",
            ].join("\\n"),
            expected: [/SECTION A: 30 MARKS/, /Match the words/, /Read the following passage/],
        },
        {
            name: "Commerce Form Four 2025",
            level: "Form Four",
            text: [
                "COMMERCE 061",
                "Year: 2025",
                "This paper consists of a total of eleven (11) questions",
                "Answer all questions in sections A and B and two (2) questions from section C",
                "SECTION A (16 Marks)",
                "SECTION B (54 Marks)",
                "SECTION C (30 Marks)",
            ].join("\\n"),
            expected: [/eleven \\(11\\) questions/, /two \\(2\\) questions from section C/, /SECTION C \\(30 Marks\\)/],
        },
        {
            name: "Basic Mathematics Form Three 2026",
            level: "Form Three",
            text: [
                "BASIC MATHEMATICS",
                "This paper consists of section A and B with a total of fourteen (14) questions",
                "SECTION A: (60 MARKS)",
                "Round off 0.63102 to 4 decimal places (1 mark)",
                "If a water tank fills up with 200 litres in five minutes, find the rate of flow (1.5 marks)",
                "Draw a Histogram to represent the information (3 marks)",
                "SECTION B: (40 MARKS)",
            ].join("\\n"),
            expected: [/fourteen \\(14\\) questions/, /1\\.5 marks/, /Draw a Histogram/, /SECTION B: \\(40 MARKS\\)/],
        },
    ];

    for (const sample of paperSamples) {
        const prompt = buildExamAnalysisPrompt({
            pdfText: sample.text,
            structuralQuestions: [],
            subjectName: sample.name,
            level: sample.level,
            examName: sample.name,
            examType: "Uploaded examination paper",
            curriculum: "",
            gradingCriteria: "",
        });

        assert.match(prompt, /Treat the uploaded PDF itself as the source of truth/i, sample.name);
        assert.match(prompt, /Never require the paper to contain sections A\\/B\\/C/i, sample.name);
        assert.match(prompt, /optional-answer rules/i, sample.name);
        for (const pattern of sample.expected) {
            assert.match(prompt, pattern, sample.name);
        }
    }
});
