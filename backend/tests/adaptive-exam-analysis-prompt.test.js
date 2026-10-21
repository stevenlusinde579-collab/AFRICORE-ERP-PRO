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
