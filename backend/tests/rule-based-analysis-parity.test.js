import test from "node:test";
import assert from "node:assert/strict";
import { inferEducationProfile, classifyQuestionFormat } from "../services/ruleBasedAnalysisParity.js";
import { analyzePaperWithRules } from "../services/ruleBasedExamAnalysis.js";

test("education profile detects early years, primary, ordinary, advanced and tertiary levels", () => {
    const cases = [
        [{ level: "Baby Class" }, "early_childhood"],
        [{ pdfText: "SHULE YA MSINGI DARASA LA NNE" }, "primary"],
        [{ level: "Form Three" }, "ordinary_secondary"],
        [{ examName: "ACSEE", pdfText: "ADVANCED CERTIFICATE EXAMINATION" }, "advanced_secondary"],
        [{ curriculum: "Diploma in Accounting" }, "vocational_or_tertiary"],
    ];
    for (const [input, expected] of cases) {
        assert.equal(inferEducationProfile(input).category, expected);
    }
});

test("unknown education level remains unclassified rather than defaulting to O-Level", () => {
    const profile = inferEducationProfile({
        level: "Level X - School Internal",
        pdfText: "INTERNAL ASSESSMENT PAPER",
    });
    assert.equal(profile.category, "unclassified");
    assert.equal(profile.confidence, "insufficient_evidence");
});

test("classifies common early-years and school question formats", () => {
    const cases = [
        ["Match the pictures in List A and List B", "Matching"],
        ["Tick the correct answer", "Objective"],
        ["Fill in the blank spaces", "Fill-in"],
        ["Trace the letters", "Tracing/Writing"],
        ["Colour the picture", "Colouring"],
        ["Look at the picture and name the object", "Picture Identification"],
        ["Listen and repeat the words", "Oral/Listening"],
        ["Draw and label the diagram", "Diagram"],
        ["Calculate the total", "Calculation"],
    ];
    for (const [question, expected] of cases) {
        assert.equal(classifyQuestionFormat(question), expected);
    }
});

test("Rule-Based analysis returns the detected education profile and preserves shared question schema", () => {
    const result = analyzePaperWithRules({
        subjectName: "General Knowledge",
        level: "Baby Class",
        examName: "End of Term",
        pdfText: `BABY CLASS ASSESSMENT
SECTION A (10 MARKS)
Answer all questions.
1. Colour the picture. (5 marks)
2. Match the shapes. (5 marks)`,
    });
    assert.equal(result.education_profile.category, "early_childhood");
    assert.equal(result.total_questions, 2);
    assert.equal(result.questions[0].question_type, "Colouring");
    assert.equal(result.questions[1].question_type, "Matching");
    assert.equal(result.questions[0].max_marks, 5);
});
