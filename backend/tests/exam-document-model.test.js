import test from "node:test";
import assert from "node:assert/strict";
import { buildExamDocumentModel, validateExamDocumentModel } from "../services/examDocumentModel.js";

test("preserves pages, sections, question hierarchy and source evidence", () => {
    const model = buildExamDocumentModel({
        level: "Standard IV",
        subject: "English",
        text: "STANDARD IV ENGLISH\nSECTION A\nAnswer all questions.\n1. Read the passage.\n(a) Identify the main character.\n(b) Give two reasons.\n2. Write five sentences.\fSECTION B\nQUESTION III\n(i) Define energy.\n(ii) State its unit."
    });
    assert.equal(model.summary.page_count, 2);
    assert.equal(model.summary.question_count, 3);
    assert.equal(model.summary.instruction_count, 1);
    assert.equal(model.questions[0].subparts.length, 2);
    assert.equal(model.questions[2].printed_label, "III");
    assert.ok(model.questions[0].evidence[0].page === 1);
    assert.equal(validateExamDocumentModel(model).valid, true);
});

test("does not mistake an answer instruction for a question", () => {
    const model = buildExamDocumentModel({
        text: "MATHEMATICS\nSECTION A\nAnswer any TWO questions.\n1. Solve x + 2 = 5.\n2. Find the area."
    });
    assert.equal(model.summary.question_count, 2);
    assert.equal(model.instructions.length, 1);
});

test("reports ambiguous repeated unqualified labels instead of silently merging them", () => {
    const model = buildExamDocumentModel({
        text: "SCIENCE\n1. First question.\n2. Second question.\n1. Another section-like repeated question."
    });
    assert.equal(model.summary.question_count, 2);
    assert.ok(model.diagnostics.some(item => item.code === "AMBIGUOUS_REPEATED_LABEL"));
});

test("keeps question text split across lines and validates missing structure safely", () => {
    const model = buildExamDocumentModel({
        text: "GEOGRAPHY\nQUESTION 1\nExplain the causes\nof soil erosion.\n(a) Give two examples."
    });
    assert.match(model.questions[0].text, /causes\nof soil erosion/);
    assert.equal(validateExamDocumentModel(model).valid, true);
});

test("builds nested letter and Roman subparts without flattening their parent-child relationship", () => {
    const model = buildExamDocumentModel({
        text: "SECTION A\nQUESTION 1\n(a) Explain the process.\n(i) First stage [2 marks].\n(ii) Second stage [3 marks].\n(b) Give one example."
    });
    assert.equal(model.questions[0].subparts.length, 2);
    assert.equal(model.questions[0].subparts[0].children.length, 2);
    assert.equal(model.questions[0].subparts[0].children[1].printed_label, "ii");
    assert.equal(model.summary.subpart_count, 4);
});

test("preserves unnumbered and mixed early-years activity prompts as separate tasks", () => {
    const unnumbered = buildExamDocumentModel({
        level: "Baby Class",
        text: "BABY CLASS\nTrace letter A.\nColour the red circle.\nCount five objects."
    });
    assert.equal(unnumbered.summary.question_count, 3);
    assert.match(unnumbered.questions[0].text, /Trace letter A/);
    assert.match(unnumbered.questions[1].text, /Colour the red circle/);
    const mixed = buildExamDocumentModel({
        level: "Nursery",
        text: "ACTIVITY 1 Trace letter A.\nColour the red circle.\nCount five objects."
    });
    assert.equal(mixed.summary.question_count, 3);
});

test("keeps Roman response items as siblings and stores MCQ options under their item", () => {
    const model = buildExamDocumentModel({
        level: "Form One",
        subject: "Business Studies",
        text: [
            "SECTION A (15 marks) Answer all questions in this section",
            "1. Choose the correct answer.",
            "i. First question item",
            "A. First option",
            "B. Second option",
            "C. Third option",
            "D. Fourth option",
            "ii. Second question item",
            "A. First option",
            "B. Second option",
            "C. Third option",
            "D. Fourth option",
            "2. Match the items in List A with List B.",
            "i. Production",
            "ii. Distribution",
            "iii. Exchange",
            "iv. Consumption",
            "v. Scarcity",
            "A. Definition A",
            "B. Definition B",
            "C. Definition C",
        ].join("\n"),
    });
    assert.equal(model.summary.question_count, 2);
    assert.equal(model.questions[0].subparts.length, 2);
    assert.equal(model.questions[0].subparts[0].options.length, 4);
    assert.equal(model.questions[1].subparts.length, 5);
    assert.equal(model.questions[1].response_options.length, 3);
    assert.equal(model.questions[0].subparts[1].printed_label, "ii");
});

test("does not promote numbered instructions before the first section to questions", () => {
    const model = buildExamDocumentModel({
        text: [
            "INSTRUCTIONS:",
            "1. This paper consists of section A, B and C with total of 10 questions",
            "2. Answer all questions in section A, B and C",
            "3. Section A carries fifteen (15) marks, section B 70 marks and section C fifteen (15) marks.",
            "SECTION A (15 marks)",
            "1. Explain the term.",
        ].join("\n"),
    });
    assert.equal(model.summary.question_count, 1);
    assert.equal(model.questions[0].question_number, 1);
});

test("keeps numbered paper instructions out of the examination question count", () => {
    const model = buildExamDocumentModel({
        text: [
            "INSTRUCTIONS:",
            "1. This paper consists of sections A, B and C with ten questions.",
            "2. Answer all questions in sections A, B and C.",
            "3. Section A carries fifteen marks and Section B carries seventy marks.",
            "SECTION A (15 marks)",
            "1. Explain the meaning of business.",
            "SECTION B (70 marks)",
            "2. Describe four business processes.",
        ].join("\n"),
    });
    assert.equal(model.summary.question_count, 2);
    assert.deepEqual(model.questions.map(item => item.question_number), [1, 2]);
    assert.ok(model.instructions.some(item => /ten questions/.test(item.text)));
});

test("supports matching response options A through I without promoting option I to a main question", () => {
    const model = buildExamDocumentModel({
        text: [
            "SECTION A",
            "2. Match the descriptions in List A with List B.",
            "i. Production",
            "ii. Distribution",
            "iii. Exchange",
            "iv. Consumption",
            "v. Scarcity",
            "A. Definition A",
            "B. Definition B",
            "C. Definition C",
            "D. Definition D",
            "E. Definition E",
            "F. Definition F",
            "G. Definition G",
            "H. Definition H",
            "I. Definition I",
            "SECTION B",
            "3. Explain four business processes.",
        ].join("\n"),
    });
    assert.equal(model.summary.question_count, 2);
    assert.equal(model.questions[0].subparts.length, 5);
    assert.equal(model.questions[0].response_options.length, 9);
    assert.equal(model.questions[1].question_number, 3);
});

test("does not treat ordinary A-E enumerated examples as multiple-choice options", () => {
    const model = buildExamDocumentModel({
        text: [
            "SECTION B",
            "3. Describe the following points.",
            "i. First item",
            "A. An example within the explanation",
            "ii. Second item",
        ].join("\n"),
    });
    assert.equal(model.questions[0].subparts[0].options, undefined);
});

test("preserves page boundaries from PDF reader and extracted PDF page markers", () => {
    const pdfReaderMarkers = buildExamDocumentModel({
        text: "SECTION A\n1. First question.\n--- PDF PAGE BREAK ---\nContinuation of question.\nSECTION B\n2. Second question.",
    });
    assert.equal(pdfReaderMarkers.summary.page_count, 2);
    assert.match(pdfReaderMarkers.questions[0].text, /Continuation of question/);
    const extractedPageMarkers = buildExamDocumentModel({
        text: "<PARSED TEXT OF PAGE: 1 / 2>\nSECTION A\n1. First question.\n<PARSED TEXT OF PAGE: 2 / 2>\nSECTION B\n2. Second question.",
    });
    assert.equal(extractedPageMarkers.summary.page_count, 2);
});

test("treats uppercase Roman item labels under MCQ stems as subparts, not new questions", () => {
    const model = buildExamDocumentModel({
        text: [
            "SECTION A",
            "1. For each item choose the correct answer.",
            "I. First item asks a question.",
            "A. Option one",
            "B. Option two",
            "C. Option three",
            "D. Option four",
            "II. Second item asks a question.",
            "A. Option one",
            "B. Option two",
            "C. Option three",
            "D. Option four",
        ].join("\n"),
    });
    assert.equal(model.summary.question_count, 1);
    assert.deepEqual(model.questions[0].subparts.map(item => item.printed_label), ["i", "ii"]);
    assert.equal(model.questions[0].subparts[0].options.length, 4);
});

test("recognises sequential uppercase Roman main questions when no Arabic question stem exists", () => {
    const model = buildExamDocumentModel({
        text: [
            "SECTION A",
            "I. Explain the first concept.",
            "II. Explain the second concept.",
            "III. Explain the third concept.",
        ].join("\n"),
    });
    assert.equal(model.summary.question_count, 3);
    assert.deepEqual(model.questions.map(item => item.printed_label), ["I", "II", "III"]);
});

test("preserves two-column matching rows when list A and list B share one PDF text line", () => {
    const model = buildExamDocumentModel({
        text: [
            "SECTION A",
            "2. Match the descriptions in List A with List B.",
            "i. Production    A. The act of using goods and services to satisfy needs",
            "ii. Distribution    B. Shortage in supply of resources",
            "iii. Exchange    C. Buying and selling goods and services",
            "iv. Consumption    D. Transforming raw materials into finished products",
            "v. Scarcity    E. Moving goods from production to consumption areas",
        ].join("\n"),
    });
    assert.equal(model.summary.question_count, 1);
    assert.equal(model.questions[0].subparts.length, 5);
    assert.equal(model.questions[0].response_options.length, 5);
    assert.equal(model.questions[0].subparts[0].text, "Production");
    assert.match(model.questions[0].response_options[0].text, /using goods and services/);
});

test("does not count the initial PDF page marker as an empty page", () => {
    const model = buildExamDocumentModel({
        text: "<PARSED TEXT FOR PAGE: 1 / 2>\nSECTION A\n1. First question.\n<PARSED TEXT FOR PAGE: 2 / 2>\nSECTION B\n2. Second question.",
    });
    assert.equal(model.summary.page_count, 2);
});

test("keeps uppercase Roman MCQ items under an Arabic-numbered question", () => {
    const model = buildExamDocumentModel({
        text: [
            "SECTION A",
            "1. For each item choose the correct answer.",
            "I. First item asks a question.",
            "A. Option one",
            "B. Option two",
            "C. Option three",
            "D. Option four",
            "II. Second item asks a question.",
            "A. Option one",
            "B. Option two",
            "C. Option three",
            "D. Option four",
        ].join("\n"),
    });
    assert.equal(model.summary.question_count, 1);
    assert.deepEqual(model.questions[0].subparts.map(item => item.printed_label), ["i", "ii"]);
    assert.equal(model.questions[0].subparts[0].options.length, 4);
});

test("does not interpret the word 'item' in an MCQ instruction as an ITEM question heading", () => {
    const model = buildExamDocumentModel({
        text: [
            "SECTION A",
            "1. For each of the item(i-x) choose the correct answer then write its letter beside the",
            "item number in the space provided",
            "i. How much will the opening balance be?",
            "A. TZS 50,000",
            "B. TZS 620,000",
            "C. TZS 660,000",
            "D. TZS 500,000",
            "E. TZS 540,000",
            "ii. What is the amount to be paid?",
            "A. TZS 1,275,000",
            "B. TZS 217,500",
            "C. TZS 1,282,500",
            "D. TZS 1,350,000",
            "E. TZS 275,000",
        ].join("\n"),
    });
    assert.equal(model.summary.question_count, 1);
    assert.equal(model.questions[0].subparts.length, 2);
    assert.equal(model.questions[0].subparts[0].options.length, 5);
});
