import test from "node:test";
import assert from "node:assert/strict";
import { analyzePaperWithRules } from "../services/ruleBasedExamAnalysis.js";

test("analyses a primary paper and preserves main questions, marks and shared schema", () => {
    const result = analyzePaperWithRules({
        subjectName: "Mathematics",
        level: "Standard IV",
        examName: "Mid Term",
        pdfText: `PRIMARY SCHOOL EXAMINATION
STANDARD IV MATHEMATICS
SECTION A (20 MARKS)
Answer all questions.
1. Add 25 and 17. (5 marks)
2. Calculate 8 x 7. (5 marks)
3. Define a fraction. (5 marks)
4. Find 50% of 40. (5 marks)`,
    });

    assert.equal(result.level, "Standard IV");
    assert.equal(result.total_questions, 4);
    assert.equal(result.questions.length, 4);
    assert.equal(result.total_marks, 20);
    assert.equal(result.sections[0].section, "A");
    assert.equal(result.questions[0].max_marks, 5);
    assert.equal(result.questions[0].mark_source, "explicit_in_paper");
    assert.ok(Object.hasOwn(result, "blooms_distribution"));
    assert.ok(Object.hasOwn(result.questions[0], "selection_group"));
});

test("uses section totals and explicit answer-any selection to infer marks", () => {
    const result = analyzePaperWithRules({
        subjectName: "Commerce",
        level: "Form Three",
        pdfText: `COMMERCE
SECTION B (40 MARKS)
Answer any 2 out of 4 questions.
1. Explain the role of trade.
2. Discuss the functions of a wholesaler.
3. Describe insurance.
4. Explain banking services.`,
    });

    assert.equal(result.questions.length, 4);
    assert.ok(result.questions.every(question => question.selection_required));
    assert.ok(result.questions.every(question => question.selection_count === 2));
    assert.ok(result.questions.every(question => question.selection_total === 4));
    assert.ok(result.questions.every(question => question.max_marks === 20));
    assert.equal(result.total_marks, 40);
    assert.equal(result.questions[0].mark_source, "inferred_from_section_structure");
});

test("does not invent marks when neither question nor section provides evidence", () => {
    const result = analyzePaperWithRules({
        subjectName: "History",
        level: "Form One",
        pdfText: `HISTORY TEST
1. Define history.
2. Explain two causes of migration.`,
    });

    assert.ok(result.questions.every(question => question.max_marks === 0));
    assert.ok(result.questions.every(question => question.mark_source === "uncertain_teacher_confirmation_required"));
    assert.ok(result.recommendations.some(item => item.includes("Confirm")));
});

test("rejects scanned or text-empty PDFs with a useful explanation", () => {
    assert.throws(
        () => analyzePaperWithRules({ pdfText: "", subjectName: "Biology" }),
        /requires readable text/
    );
});

test("recognizes explicit QUESTION N headers without punctuation and keeps following lines together", () => {
    const result = analyzePaperWithRules({
        subjectName: "History",
        level: "Form Two",
        pdfText: `HISTORY TEST
SECTION A (10 MARKS)
Answer all questions.
QUESTION 1
Explain two causes of migration.
QUESTION 2.
State two effects of migration.`,
    });

    assert.equal(result.questions.length, 2);
    assert.equal(result.questions[0].question_number, 1);
    assert.match(result.questions[0].question_text, /Explain two causes of migration/);
    assert.equal(result.questions[1].question_number, 2);
    assert.match(result.questions[1].question_text, /State two effects of migration/);
    assert.equal(result.questions[0].max_marks, 5);
    assert.equal(result.questions[1].max_marks, 5);
});


test("uses parent question total once and does not double-count sub-question marks", () => {
    const result = analyzePaperWithRules({
        subjectName: "Commerce",
        level: "Form Four",
        pdfText: `COMMERCE
SECTION A (10 MARKS)
Answer all questions.
QUESTION 1 (10 marks)
(a) Define trade (2 marks)
(b) Explain commerce (3 marks)
(c) State five aids to trade (5 marks)`,
    });

    assert.equal(result.questions.length, 1);
    assert.equal(result.questions[0].max_marks, 10);
    assert.equal(result.total_marks, 10);
});

test("sums labelled sub-question marks when no parent total is printed", () => {
    const result = analyzePaperWithRules({
        subjectName: "Biology",
        level: "Form Two",
        pdfText: `BIOLOGY
SECTION A (10 MARKS)
1. Answer the following:
(a) Define a cell (2 marks)
(b) Name three cell organelles (3 marks)
(c) Explain the function of the nucleus (5 marks)`,
    });

    assert.equal(result.questions[0].max_marks, 10);
    assert.equal(result.total_marks, 10);
});

test("uses explicit equal-per-question instructions ahead of inferred section division", () => {
    const result = analyzePaperWithRules({
        subjectName: "History",
        level: "Form Three",
        pdfText: `HISTORY
SECTION B (40 MARKS)
Each question carries 10 marks. Answer any 2 out of 4 questions.
1. Explain migration.
2. Discuss colonial rule.
3. Describe nationalism.
4. Explain independence.`,
    });

    assert.ok(result.questions.every(question => question.max_marks === 10));
    assert.equal(result.total_marks, 20);
    assert.ok(result.recommendations.some(item => item.includes("declares 40 marks")));
});

test("flags a mismatch between printed section total and explicit question marks", () => {
    const result = analyzePaperWithRules({
        subjectName: "Mathematics",
        level: "Standard IV",
        pdfText: `MATHEMATICS
SECTION A (40 MARKS)
1. Add 2 and 3 (5 marks)
2. Multiply 4 and 5 (5 marks)
3. Divide 20 by 4 (5 marks)
4. Subtract 3 from 9 (5 marks)`,
    });

    assert.ok(result.recommendations.some(item =>
        item.includes("declares 40 marks") && item.includes("20 marks")
    ));
});


test("detects Kiswahili alama notation on parent questions and roman subparts", () => {
    const result = analyzePaperWithRules({
        subjectName: "Kiswahili",
        level: "Form Two",
        pdfText: "MTIHANI WA KISWAHILI\nSEHEMU A (ALAMA 20)\nJibu maswali yote.\n1. Soma habari kisha jibu maswali yafuatayo:\n(i) Eleza maana ya msamiati (alama 4)\n(ii) Taja wahusika wawili (alama 4)\n(iii) Fafanua dhamira kuu (alama 4)\n2. Andika insha kuhusu mazingira (alama 8)",
    });
    assert.equal(result.questions.length, 2);
    assert.equal(result.questions[0].max_marks, 12);
    assert.equal(result.questions[1].max_marks, 8);
    assert.equal(result.total_marks, 20);
    assert.ok(result.questions.every(question => question.mark_source === "explicit_in_paper"));
});

test("detects Kiswahili section totals and equal marks per question", () => {
    const result = analyzePaperWithRules({
        subjectName: "Kiswahili",
        level: "Standard VII",
        pdfText: "MTIHANI WA KISWAHILI\nSEHEMU B (JUMLA YA ALAMA 40)\nKila swali lina alama 10.\n1. Taja methali nne.\n2. Eleza maana ya nahau.\n3. Andika sentensi tano.\n4. Eleza matumizi ya nomino.",
    });
    assert.equal(result.total_marks, 40);
    assert.ok(result.questions.every(question => question.max_marks === 10));
});


test("recognizes selective questions stated as two of the following three in Section C", () => {
    const result = analyzePaperWithRules({
        subjectName: "Kiswahili",
        level: "Form Four",
        pdfText: `MTIHANI WA KISWAHILI
SEHEMU A (ALAMA 60)
Jibu maswali yote.
1. Swali la kwanza (alama 20)
2. Swali la pili (alama 20)
3. Swali la tatu (alama 20)
SEHEMU C (ALAMA 40)
Jibu maswali mawili kati ya matatu yafuatayo.
7. Jadili matumizi ya lugha (alama 20)
8. Eleza dhamira za fasihi (alama 20)
9. Fafanua umuhimu wa methali (alama 20)`,
    });

    const sectionC = result.questions.filter(question => question.section === "C");
    assert.equal(sectionC.length, 3);
    assert.ok(sectionC.every(question => question.selection_required));
    assert.ok(sectionC.every(question => question.selection_count === 2));
    assert.ok(sectionC.every(question => question.selection_total === 3));
    assert.equal(result.total_marks, 100);
});

test("does not mark a section selective when all available questions are compulsory", () => {
    const result = analyzePaperWithRules({
        subjectName: "History",
        level: "Form Two",
        pdfText: `HISTORY
SECTION C (30 MARKS)
Answer 3 questions.
1. Explain migration (10 marks)
2. Describe trade (10 marks)
3. Discuss colonialism (10 marks)`,
    });

    assert.ok(result.questions.every(question => !question.selection_required));
    assert.equal(result.total_marks, 30);
});

test("recognizes English selective instructions that say any two of the following three", () => {
    const result = analyzePaperWithRules({
        subjectName: "Geography",
        level: "Form Three",
        pdfText: `GEOGRAPHY
SECTION C (40 MARKS)
Answer any TWO of the following THREE questions.
5. Explain weathering (20 marks)
6. Describe erosion (20 marks)
7. Discuss climate (20 marks)`,
    });

    assert.ok(result.questions.every(question => question.selection_required));
    assert.ok(result.questions.every(question => question.selection_count === 2));
    assert.equal(result.total_marks, 40);
});


test("parses OCR-compressed Chemistry paper headings, excludes instructions and keeps selective Section C", () => {
    const result = analyzePaperWithRules({
        subjectName: "Chemistry",
        level: "Form Four",
        examName: "PRE-MOCK",
        pdfText: `CHEMISTRY PRE-MOCK
This paper consists of eleven (11) questions. This paper
Q1
Foreach ofthe items (i)-(x),choose the correct answer from the given alternatives.
A the respective terms in List B by the parts of the electrolytic cell with the item in the answer booklet.
SECTIONB(54Marks)
Answer all questions in this section.
Q3
Briefly explain six economic activities that depend on water.
Q4
(a) Justify the fact that hydrogen has got both properties of group I and group VII elements.
(b) Compare the reactions of sodium metal with elements G and H.
Q5
(a) Categorize each variable in the solubility experiment.
(b) Identify six steps to follow when conducting a scientific investigation.
Q6
Suggest three advantages and three disadvantages of hydrogen as a fuel.
Q7
Identify six steps in lighting a luminous flame.
Q8
Explain temporary and permanent hardness of water.
SECTIONC(30Marks)
Answer two (2) questions from section C.
Q9
Briefly explain Le Chatelier's principle and explain four ways to increase product yield.
Q10
Describe the chemical properties of ethanol.
Q11
Explain the extraction and uses of sulphur.
Page 5 of 5 CSEE2025
Write your Examination Number on every page of your answer booklet.
Non-programmable calculators may be used.`,
    });

    assert.equal(result.total_questions, 11);
    assert.equal(result.questions.length, 11);
    assert.equal(result.total_marks, 100);
    assert.equal(result.questions.filter(q => q.section === "A").length, 2);
    assert.equal(result.questions.filter(q => q.section === "B").length, 6);
    assert.equal(result.questions.filter(q => q.section === "C").length, 3);
    assert.match(result.questions.find(q => q.section === "A" && q.question_number === 2).question_text, /List B/i);
    assert.equal(result.questions.find(q => q.section === "A" && q.question_number === 1).max_marks, 8);
    assert.equal(result.questions.find(q => q.section === "B" && q.question_number === 3).max_marks, 9);
    assert.equal(result.questions.find(q => q.section === "C" && q.question_number === 9).max_marks, 15);
    assert.ok(result.questions.filter(q => q.section === "C").every(q => q.selection_required));
    assert.ok(result.questions.every(q => !/write your examination number|non-programmable calculators/i.test(q.question_text)));
    assert.ok(!result.questions.some(q => /this paper consists|answer all questions/i.test(q.question_text)));
    assert.equal(result.questions.filter(q => q.question_number === 1).length, 1);
});
