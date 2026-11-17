import test from "node:test";
import assert from "node:assert/strict";
import { analyzeExamEvidence, classifyQuestion, extractMark, parseSelection } from "../services/examEvidenceAnalysis.js";

const evidence = (text, line = 1) => ({ text, page: 1, line, kind: "pdf_text" });

const sampleDocument = {
    questions: [
        {
            id: "q1", order: 1, printed_label: "1", section: "A",
            text: "Choose the correct answer.",
            evidence: [evidence("1. Choose the correct answer. [5 marks]")],
            subparts: [],
        },
        {
            id: "q2", order: 2, printed_label: "2", section: "A",
            text: "Match the items.",
            evidence: [evidence("2. Match the items.")],
            subparts: [
                { id: "q2a", printed_label: "a", text: "Column A and B", evidence: [evidence("(a) Column A and B (3 marks)", 3)] },
                { id: "q2b", printed_label: "b", text: "Complete pairs", evidence: [evidence("(b) Complete pairs (2 marks)", 4)] },
            ],
        },
        {
            id: "q3", order: 3, printed_label: "3", section: "A",
            text: "Fill in the blank.",
            evidence: [evidence("3. Fill in the blank [0 marks].", 5)],
            subparts: [],
        },
        {
            id: "q4", order: 4, printed_label: "4", section: "A",
            text: "List the answer.",
            evidence: [evidence("4. List the answer [0 marks].", 6)],
            subparts: [],
        },
    ],
    instructions: [{ text: "Answer any TWO out of FOUR questions.", scope: "A", evidence: [evidence("Answer any TWO out of FOUR questions.", 2)] }],
};

test("extracts only explicit non-negative mark evidence", () => {
    assert.equal(extractMark("Explain the term [4 marks]").value, 4);
    assert.equal(extractMark("State two reasons (2)"), null);
    assert.equal(extractMark("State two reasons (2 marks)").value, 2);
    assert.equal(extractMark("There are 5 students in the class."), null);
});

test("parses answer selection instructions with a traceable source", () => {
    const selection = parseSelection("Answer any TWO out of FOUR questions.");
    assert.equal(selection.required, 2);
    assert.equal(selection.available, 4);
    assert.equal(selection.mode, "choose_from_pool");
    assert.equal(parseSelection("Answer all questions.").mode, "answer_all");
});

test("classifies common examination question formats", () => {
    assert.equal(classifyQuestion("Match the following items").type, "matching");
    assert.equal(classifyQuestion("Fill in the blanks").type, "fill_in_the_blanks");
    assert.equal(classifyQuestion("Choose the correct answer").type, "multiple_choice");
    assert.equal(classifyQuestion("Carry out the experiment using the apparatus").type, "practical");
});

test("builds marks from explicit question or complete subpart evidence and flags gaps", () => {
    const result = analyzeExamEvidence({ document: sampleDocument, sourceText: "TOTAL MARKS: 10" });
    assert.equal(result.questions[0].marks, 5);
    assert.equal(result.questions[1].marks, 5);
    assert.equal(result.questions[1].marks_source, "sum_of_explicit_subpart_evidence");
    assert.equal(result.questions[0].is_selective, true);
    assert.equal(result.questions[0].selection_count, 2);
    assert.equal(result.questions[0].selection_total, 4);
    assert.equal(result.totals.effective_calculated_total, 10);
    assert.equal(result.totals.calculated_from_explicit_evidence, 10);
    assert.equal(result.totals.declared, 10);
    assert.equal(result.selection_rules[0].required, 2);
    assert.equal(result.selection_rules[0].available, 4);
    assert.equal(result.diagnostics.length, 0);
});

test("does not invent marks when one subpart has no printed mark", () => {
    const doc = {
        questions: [{
            id: "q1", order: 1, printed_label: "1", section: "A", text: "Answer",
            evidence: [evidence("1. Answer")],
            subparts: [
                { id: "a", printed_label: "a", text: "First", evidence: [evidence("(a) First [2]")] },
                { id: "b", printed_label: "b", text: "Second", evidence: [evidence("(b) Second")] },
            ],
        }],
        instructions: [],
    };
    const result = analyzeExamEvidence({ document: doc });
    assert.equal(result.questions[0].marks, null);
    assert.ok(result.diagnostics.some((item) => item.code === "QUESTION_MARKS_INCOMPLETE"));
});

test("maps question topic using the declared subject and education level", async () => {
    const { buildExamDocumentModel } = await import("../services/examDocumentModel.js");
    const document = buildExamDocumentModel({
        level: "Form Four",
        subject: "Chemistry",
        text: "SECTION A\nQUESTION 1\nExplain why acids turn blue litmus paper red."
    });
    const result = analyzeExamEvidence({ document });
    assert.equal(result.questions[0].curriculum.curriculum_level, "ordinary_secondary");
    assert.equal(result.questions[0].curriculum.topic, "Acids, bases and salts");
    assert.ok(result.questions[0].curriculum.topic_evidence);
});

test("understands Swahili marks, matching, multiple choice and selection instructions", () => {
    assert.equal(extractMark("(Alama 22)").value, 22);
    assert.equal(classifyQuestion("Oanisha milango ya fahamu kutoka orodha A na B").type, "matching");
    assert.equal(classifyQuestion("Chagua herufi ya jibu sahihi kisha uandike").type, "multiple_choice");
    const selection = parseSelection("Chagua maswali mawili kati ya yafuatayo");
    assert.equal(selection.required, 2);
    assert.equal(selection.mode, "choose_count");
    const englishSelection = parseSelection("Answer any two of the following three questions");
    assert.equal(englishSelection.required, 2);
    assert.equal(englishSelection.available, 3);
});

test("sums nested Roman subpart marks without double counting the parent", async () => {
    const { analyzeExaminationV2 } = await import("../services/examAnalysisV2.js");
    const result = analyzeExaminationV2({
        level: "Standard IV",
        subject: "Science and Technology",
        text: [
            "SECTION A",
            "QUESTION 1",
            "(a) Explain the process.",
            "(i) First stage [2 marks].",
            "(ii) Second stage [3 marks].",
            "(b) Give one example [1 mark].",
        ].join("\n"),
    });
    assert.equal(result.document.questions[0].subparts.length, 2);
    assert.equal(result.document.questions[0].subparts[0].children.length, 2);
    assert.equal(result.analysis.questions[0].subparts[0].marks, 5);
    assert.equal(result.analysis.questions[0].marks, 6);
});

test("keeps printed section totals separate when question marks are not evidenced", async () => {
    const { buildExamDocumentModel } = await import("../services/examDocumentModel.js");
    const document = buildExamDocumentModel({
        level: "Primary",
        subject: "Science and Technology",
        text: "SECTION A (Alama 22)\nQUESTION 1\nChagua jibu sahihi."
    });
    const result = analyzeExamEvidence({ document, sourceText: "SECTION A (Alama 22)\nQUESTION 1\nChagua jibu sahihi." });
    assert.equal(result.section_totals[0].declared_total, 22);
    assert.equal(result.section_totals[0].calculated_from_explicit_question_marks, null);
    assert.ok(result.diagnostics.some(item => item.code === "SECTION_MARKS_UNALLOCATED"));
    assert.equal(result.questions[0].marks, null);
});

test("classifies Primary word-building, dotted blanks, dictation and comprehension tasks", () => {
    assert.equal(classifyQuestion("Write the correct English word from the jumbled letters in brackets.").type, "word_formation");
    assert.equal(classifyQuestion("Complete the routine by writing the verbs: ....................................").type, "fill_in_the_blanks");
    assert.equal(classifyQuestion("Listen carefully to the sentences read by your invigilator then write them correctly.").type, "dictation");
    assert.equal(classifyQuestion("Read the following passage and answer the questions that follow.").type, "reading_comprehension");
});

test("adds evidence-backed Bloom levels, estimated difficulty and safe marking guidance", async () => {
    const { buildExamDocumentModel } = await import("../services/examDocumentModel.js");
    const document = buildExamDocumentModel({
        level: "Form Four",
        subject: "Chemistry",
        text: [
            "SECTION A",
            "QUESTION 1 [2 marks]",
            "Define an acid.",
            "QUESTION 2 [12 marks]",
            "Compare strong acids and weak acids.",
        ].join("\n"),
    });
    const result = analyzeExamEvidence({ document });
    assert.equal(result.questions[0].bloom_level, "remembering");
    assert.equal(result.questions[1].bloom_level, "analysing");
    assert.equal(result.questions[1].difficulty_level, "challenging");
    assert.match(result.questions[0].answer_expected, /definition/i);
    assert.ok(result.questions[0].bloom_evidence);
    assert.ok(result.quality.topic_coverage > 0);
});

test("analyses each MCQ response item and preserves answer options in the V2 result", async () => {
    const { buildExamDocumentModel } = await import("../services/examDocumentModel.js");
    const document = buildExamDocumentModel({
        level: "Form One",
        subject: "Business Studies",
        text: [
            "SECTION A",
            "1. Choose the correct answer.",
            "i. Which business is a sole proprietorship?",
            "A. A company owned by several people",
            "B. A partnership",
            "C. A shop owned by one person",
            "D. A public corporation",
        ].join("\n"),
    });
    const result = analyzeExamEvidence({ document });
    assert.equal(result.questions[0].subparts.length, 1);
    assert.equal(result.questions[0].subparts[0].classification.type, "multiple_choice");
    assert.equal(result.questions[0].subparts[0].options.length, 4);
    assert.equal(result.questions[0].subparts[0].topic, "Business ownership");
    assert.equal(result.questions[0].subparts[0].bloom_level, "remembering");
});

test("infers objective item marks then distributes the remaining section marks", () => {
    const document = buildExamDocumentModel({
        level: "Form Three",
        subject: "Commerce",
        text: [
            "SECTION A (16 MARKS)",
            "1. Choose the correct answer.",
            "i. Item one?",
            "A. A",
            "B. B",
            "C. C",
            "D. D",
            "ii. Item two?",
            "A. A",
            "B. B",
            "C. C",
            "D. D",
            "2. Match the following items in List A with List B.",
            "i. First term",
            "ii. Second term",
            "iii. Third term",
            "iv. Fourth term",
            "v. Fifth term",
            "vi. Sixth term",
            "A. One",
            "B. Two",
            "C. Three",
            "D. Four",
            "E. Five",
            "F. Six",
            "SECTION B (54 MARKS)",
            "Answer all questions",
            "3. Explain the first topic.",
            "4. Explain the second topic.",
            "5. Explain the third topic.",
            "6. Explain the fourth topic.",
            "7. Explain the fifth topic.",
            "8. Explain the sixth topic.",
            "SECTION C (30 MARKS)",
            "Answer any TWO questions",
            "9. Explain topic nine.",
            "10. Explain topic ten.",
            "11. Explain topic eleven.",
        ].join("\n"),
    });
    const result = analyzeExamEvidence({ document });
    const q = result.questions;
    assert.equal(q.find(item => item.question_number === 1).marks, 2);
    assert.equal(q.find(item => item.question_number === 2).marks, 6);
    assert.ok(q.filter(item => item.section === "B").every(item => item.marks === 9));
    assert.ok(q.filter(item => item.section === "C").every(item => item.marks === 15));
    assert.equal(result.totals.declared, 100);
    assert.equal(result.totals.effective_calculated_total, 100);
    assert.equal(result.quality.marks_coverage, 1);
    assert.equal(result.diagnostics.some(item => item.code === "SECTION_MARKS_UNALLOCATED"), false);
});

test("preserves explicit marks before allocating the remaining section total", () => {
    const document = buildExamDocumentModel({
        text: [
            "SECTION B (30 MARKS)",
            "1. Explain the first topic. (10 marks)",
            "2. Explain the second topic.",
            "3. Explain the third topic.",
        ].join("\n"),
    });
    const result = analyzeExamEvidence({ document });
    assert.equal(result.questions[0].marks, 10);
    assert.equal(result.questions[1].marks, 10);
    assert.equal(result.questions[2].marks, 10);
    assert.equal(result.questions[0].marks_source, "explicit_question_evidence");
    assert.equal(result.questions[1].marks_source, "inferred_from_section_structure");
});

test("allocates selective section marks by the number of questions learners must answer", () => {
    const document = buildExamDocumentModel({
        text: [
            "SECTION C (30 MARKS)",
            "Answer any two questions out of the following three.",
            "9. Explain the first topic.",
            "10. Explain the second topic.",
            "11. Explain the third topic.",
        ].join("\n"),
    });
    const result = analyzeExamEvidence({ document });
    assert.ok(result.questions.every(item => item.marks === 15));
    assert.ok(result.questions.every(item => item.marks_source === "inferred_from_selective_section_total"));
    assert.equal(result.totals.effective_calculated_total, 30);
    assert.equal(result.totals.calculated_from_explicit_evidence, null);
});

test("does not invent question marks when the paper has no printed section total", () => {
    const document = buildExamDocumentModel({ text: "SECTION A\n1. Explain the concept.\n2. Describe the process." });
    const result = analyzeExamEvidence({ document });
    assert.ok(result.questions.every(item => item.marks == null));
    assert.equal(result.diagnostics.some(item => item.code === "QUESTION_MARKS_INCOMPLETE"), true);
});
