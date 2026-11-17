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
    ],
    instructions: [{ text: "Answer any TWO out of FOUR questions.", scope: "A", evidence: [evidence("Answer any TWO out of FOUR questions.", 2)] }],
};

test("extracts only explicit non-negative mark evidence", () => {
    assert.equal(extractMark("Explain the term [4 marks]").value, 4);
    assert.equal(extractMark("State two reasons (2)").value, 2);
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
