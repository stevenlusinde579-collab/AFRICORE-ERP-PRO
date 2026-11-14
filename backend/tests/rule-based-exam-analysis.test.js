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
Section A carries sixteen (16) marks, section B fifty four (54) marks and section C (30) marks.
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

test("recognizes selection instructions that specify a section without printing its denominator", () => {
    const result = analyzePaperWithRules({
        subjectName: "Chemistry",
        level: "Form Four",
        pdfText: `CHEMISTRY
SECTION C (30 MARKS)
Answer two (2) questions from section C.
9. Explain Le Chatelier's principle (15 marks)
10. Describe chemical properties of ethanol (15 marks)
11. Explain extraction of sulphur (15 marks)`,
    });
    const sectionC = result.questions.filter(question => question.section === "C");
    assert.equal(sectionC.length, 3);
    assert.ok(sectionC.every(question => question.selection_required));
    assert.ok(sectionC.every(question => question.selection_count === 2));
    assert.ok(sectionC.every(question => question.selection_total === 3));
    assert.equal(result.total_marks, 30);
});

test("uses declared section totals for the paper total and reports a question allocation mismatch", () => {
    const result = analyzePaperWithRules({
        subjectName: "Mathematics",
        level: "Form Three",
        pdfText: `MATHEMATICS
SECTION A (40 MARKS)
1. Calculate the value of x (5 marks)
2. Solve the equation (5 marks)
SECTION B (60 MARKS)
3. Find the area of a triangle (20 marks)
4. Calculate the volume of a cylinder (20 marks)`,
    });
    assert.equal(result.total_marks, 50);
    assert.ok(result.recommendations.some(item =>
        item.includes("printed section totals add up to 100") &&
        item.includes("detected question allocation gives 50")
    ));
});

test("computes selective effective marks from the highest required optional question marks", () => {
    const result = analyzePaperWithRules({
        subjectName: "Geography",
        level: "Form Four",
        pdfText: `GEOGRAPHY
SECTION C (30 MARKS)
Answer any two out of the following three questions.
1. Explain climate (20 marks)
2. Describe weather (15 marks)
3. Discuss rainfall (10 marks)`,
    });
    assert.equal(result.total_marks, 35);
    assert.ok(result.recommendations.some(item => item.includes("declares 30 marks")));
});

test("multiplies a single @ mark annotation across all Roman-numeral subparts", () => {
    const result = analyzePaperWithRules({
        subjectName: "Mathematics",
        level: "Form Three",
        pdfText: `MATHEMATICS
SECTION B (10 MARKS)
12. Given the relation R. Find the:
I. Domain of R (2 marks @)
II. Range of R
III. Inverse of R
IV. Domain of R-1
V. Range of R-1`,
    });
    assert.equal(result.questions.length, 1);
    assert.equal(result.questions[0].max_marks, 10);
    assert.equal(result.total_marks, 10);
});


test("parses stored Chemistry structure, selective Section C and 100 marks", () => {
    const result = analyzePaperWithRules({
        subjectName: "Chemistry",
        level: "Form Four",
        examName: "PRE-MOCK",
        pdfText: [
            "1. consists of sections A, B and C with a total of eleven (11) questions.",
            "2. Answer all questions in sections A and B and two (2) questions from section C.",
            "3. Section A carries sixteen (16) marks, section B fifty four (54) marks and section C thirty (30) marks.",
            "All writing must be in blue/black ink except diagrams.",
            "Answer all questions in this section.",
            "1. For each of the items (i)-(x), choose the correct answer from the given alternatives.",
            "(i) Item one", "(ii) Item two", "(iii) Item three", "(iv) Item four", "(v) Item five",
            "(vi) Item six", "(vii) Item seven", "(viii) Item eight", "(ix) Item nine", "(x) Item ten",
            "A. option B. option C. option D. option E. option",
            "Match the parts of the electrolytic cell in List A with the respective terms in List B.",
            "List A", "(i) item one", "(ii) item two", "(iii) item three", "(iv) item four",
            "(v) item five", "(vi) item six", "List B", "A. option B. option C. option D. option E. option F. option",
            "SECTION B",
            "3. Explain economic activities that depend on water.",
            "4. Explain hydrogen properties.",
            "5. Describe a scientific investigation.",
            "6. Explain hydrogen as a fuel.",
            "7. Describe lighting a luminous flame.",
            "8. Explain water hardness.",
            "SECTION C",
            "Answer any two questions from Section C.",
            "9. Explain Le Chatelier's principle.",
            "10. Describe chemical properties of ethanol.",
            "11. Explain extraction of sulphur."
        ].join("\n"),
    });
    assert.equal(result.total_questions, 11);
    assert.equal(result.total_marks, 100);
    const sectionA = result.questions.filter(question => question.section === "A");
    assert.equal(sectionA.length, 2);
    assert.deepEqual(sectionA.map(question => question.max_marks), [10, 6]);
    const sectionB = result.questions.filter(question => question.section === "B");
    assert.equal(sectionB.length, 6);
    assert.ok(sectionB.every(question => question.max_marks === 9));
    const sectionC = result.questions.filter(question => question.section === "C");
    assert.equal(sectionC.length, 3);
    assert.ok(sectionC.every(question => question.selection_required));
    assert.ok(sectionC.every(question => question.selection_count === 2));
    assert.ok(sectionC.every(question => question.max_marks === 15));
});

test("recognizes OCR-compressed Kiswahili answer-two-from-Section-C instruction", () => {
    const result = analyzePaperWithRules({
        subjectName: "Kiswahili",
        level: "Form Four",
        pdfText: [
            "JibumaswaliyotekutokasehemuA,Bnamaswalimawili(2)kutokaSehemuC.",
            "SECTION A (Alama 16)",
            "1. Katikaswalilai-x,chaguaherufiyajibusahihi.",
            "i. Swali la kwanza", "ii. Swali la pili", "iii. Swali la tatu", "iv. Swali la nne",
            "v. Swali la tano", "vi. Swali la sita", "vii. Swali la saba", "viii. Swali la nane",
            "ix. Swali la tisa", "x. Swali la kumi",
            "2. OanishamaanazadhanambalimbalizatungokatikaorodhaA na orodha B.",
            "KIFUNGU A KIFUNGU B", "(i) Sehemu ya sentensi", "(ii) Sehemu ya sentensi",
            "(iii) Sehemu ya sentensi", "(iv) Sehemu ya sentensi", "(v) Sehemu ya sentensi",
            "(vi) Sehemu ya sentensi",
            "SECTION B (Alama 54)",
            "3. Fafanua maana ya lugha.", "4. Tunga sentensi.", "5. Eleza umuhimu wa kamusi.",
            "6. Bainisha kishazi tegemezi.", "7. Andika visawe.", "8. Soma kifungu cha habari.",
            "SECTION C (Alama 30)",
            "9. Mhakiki ni nani?", "10. Jadili tamthilia mbili.", "11. Eleza usanaa wa fasihi."
        ].join("\n"),
    });
    const sectionC = result.questions.filter(question => question.section === "C");
    assert.equal(sectionC.length, 3);
    assert.ok(sectionC.every(question => question.selection_required));
    assert.ok(sectionC.every(question => question.selection_count === 2));
    assert.ok(sectionC.every(question => question.max_marks === 15));
    assert.equal(result.total_marks, 100);
});


test("applies an introductory selective instruction only to its named section", () => {
    const result = analyzePaperWithRules({
        subjectName: "History",
        level: "Form Four",
        pdfText: [
            "HISTORY EXAMINATION",
            "This paper consists of eleven (11) questions.",
            "Answer all questions in Sections A and B and any two questions from Section C.",
            "TOTAL MARKS: 100",
            "SECTION A (20 MARKS)",
            "1. Explain the meaning of history (10 marks).",
            "2. State sources of history (10 marks).",
            "SECTION B (50 MARKS)",
            "3. Explain migration (10 marks).",
            "4. Describe trade (10 marks).",
            "5. Explain colonialism (10 marks).",
            "6. Discuss nationalism (10 marks).",
            "7. Explain independence (10 marks).",
            "SECTION C (30 MARKS)",
            "8. Discuss the causes of the First World War (15 marks).",
            "9. Explain its effects (15 marks).",
            "10. Describe the peace settlement (15 marks).",
            "11. Discuss the League of Nations (15 marks)."
        ].join("\n"),
    });
    const sectionA = result.questions.filter(q => q.section === "A");
    const sectionB = result.questions.filter(q => q.section === "B");
    const sectionC = result.questions.filter(q => q.section === "C");
    assert.ok(sectionA.every(q => !q.selection_required));
    assert.ok(sectionB.every(q => !q.selection_required));
    assert.equal(sectionC.length, 4);
    assert.ok(sectionC.every(q => q.selection_required));
    assert.ok(sectionC.every(q => q.selection_count === 2));
    assert.ok(sectionC.every(q => q.selection_total === 4));
    assert.equal(result.total_questions, 11);
    assert.equal(result.total_marks, 100);
});

test("recognizes compact English selective wording with 'any' and named section", () => {
    const result = analyzePaperWithRules({
        subjectName: "Geography",
        level: "Form Three",
        pdfText: [
            "GEOGRAPHY",
            "SECTION C (30 MARKS)",
            "Answer any two questions from Section C.",
            "1. Explain weathering (15 marks).",
            "2. Describe erosion (15 marks).",
            "3. Discuss climate (15 marks)."
        ].join("\n"),
    });
    assert.ok(result.questions.every(q => q.selection_required));
    assert.ok(result.questions.every(q => q.selection_count === 2));
    assert.ok(result.questions.every(q => q.selection_total === 3));
    assert.equal(result.total_marks, 30);
});

test("uses explicit whole-paper total and reports disagreement with section reconciliation", () => {
    const result = analyzePaperWithRules({
        subjectName: "Commerce",
        level: "Form Two",
        pdfText: [
            "COMMERCE",
            "TOTAL MARKS: 100",
            "SECTION A (20 MARKS)",
            "1. Define trade (10 marks).",
            "2. Explain commerce (10 marks).",
            "SECTION B (70 MARKS)",
            "3. Explain retail trade (35 marks).",
            "4. Describe wholesale trade (35 marks)."
        ].join("\n"),
    });
    assert.equal(result.total_marks, 90);
    assert.ok(result.recommendations.some(message =>
        message.includes("explicitly states 100 total marks") &&
        message.includes("90")
    ));
});


test("Commerce paper excludes exam-room warning and scopes selective Section C only", () => {
    const result = analyzePaperWithRules({
        subjectName: "Commerce",
        level: "Form Four",
        examName: "MOCK",
        pdfText: [
            "COMMERCE MOCK EXAMINATION",
            "This paper consists of eleven (11) questions.",
            "Answer all questions in Sections A and B and any two questions from Section C.",
            "SECTION A (16 MARKS)",
            "Answer all questions. Each item carries one mark.",
            "1. For each of the items (i)-(x), choose the correct alternative.",
            "(i) Item one", "(ii) Item two", "(iii) Item three", "(iv) Item four", "(v) Item five",
            "(vi) Item six", "(vii) Item seven", "(viii) Item eight", "(ix) Item nine", "(x) Item ten",
            "2. Match the taxation terms in List A with the correct descriptions in List B.",
            "List A", "(i) Tax one", "(ii) Tax two", "(iii) Tax three",
            "(iv) Tax four", "(v) Tax five", "(vi) Tax six",
            "List B", "A. Description one", "B. Description two", "C. Description three",
            "D. Description four", "E. Description five", "F. Description six",
            "SECTION B (54 MARKS)",
            "Answer all questions.",
            "Cellular phones and any unauthorized materials are not allowed in the examination room.",
            "3. Explain five ways insurance companies make profit. (9 marks)",
            "4. Describe types and importance of warehouses. (9 marks)",
            "5. Explain sources of capital and their limitations. (9 marks)",
            "6. Explain functions of BRELA. (9 marks)",
            "7. Explain advantages of consumer credit. (9 marks)",
            "8. Explain principles of insurance. (9 marks)",
            "SECTION C (30 MARKS)",
            "Answer any two questions from Section C.",
            "9. Explain essential elements of a business plan. (15 marks)",
            "10. Explain principles of management. (15 marks)",
            "11. Discuss factors influencing buying decisions. (15 marks)"
        ].join("\n"),
    });

    assert.equal(result.total_questions, 11);
    assert.equal(result.questions.length, 11);
    assert.equal(result.total_marks, 100);
    assert.deepEqual(
        result.questions.map(question => question.question_number),
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    );

    const sectionA = result.questions.filter(question => question.section === "A");
    const sectionB = result.questions.filter(question => question.section === "B");
    const sectionC = result.questions.filter(question => question.section === "C");
    assert.equal(sectionA.length, 2);
    assert.ok(sectionA.every(question => !question.selection_required));
    assert.deepEqual(sectionA.map(question => question.max_marks), [10, 6]);
    assert.ok(sectionA.every(question => question.mark_source === "inferred_from_section_structure"));
    assert.match(sectionA[0].mark_evidence, /10 objective\/matching items.*1 mark/i);
    assert.match(sectionA[1].mark_evidence, /6 objective\/matching items.*1 mark/i);
    assert.equal(sectionB.length, 6);
    assert.ok(sectionB.every(question => !question.selection_required));
    assert.ok(sectionB.every(question => question.max_marks === 9));
    assert.equal(sectionC.length, 3);
    assert.ok(sectionC.every(question => question.selection_required));
    assert.ok(sectionC.every(question => question.selection_count === 2));
    assert.ok(sectionC.every(question => question.selection_total === 3));
    assert.ok(sectionC.every(question => question.max_marks === 15));
    assert.ok(!result.questions.some(question =>
        /cellular phones|unauthorized materials|examination room/i.test(question.question_text)
    ));
});


test("Book Keeping PDF: ignores exam instructions and date-like ledger rows as question boundaries", () => {
    const result = analyzePaperWithRules({
        subjectName: "Book Keeping",
        level: "Form Four",
        examName: "PRE-MOCK",
        pdfText: [
            "BOOK KEEPING PRE-MOCK",
            "This paper consists of fifteen (15) questions.",
            "Sections A carries fifteen (15) marks and B carries forty (40) marks and Section C carries forty-five (45) marks.",
            "SECTION A (15 MARKS)",
            "Answer all questions.",
            "Q1",
            "For each of the items (i) – (x), choose the correct answer from among the given alternatives.",
            "(i) Item one (ii) Item two (iii) Item three (iv) Item four (v) Item five",
            "(vi) Item six (vii) Item seven (viii) Item eight (ix) Item nine (x) Item ten",
            "Q2",
            "Match the explanation in column A with the corresponding names in column B.",
            "(i) First definition (ii) Second definition (iii) Third definition (iv) Fourth definition (v) Fifth definition",
            "SECTION B (40 MARKS)",
            "Q3",
            "Briefly explain the following concepts (a) Exchequer account (b) Accounting officer.",
            "Sections A carries fifteen (15) marks and B carries forty (40) marks and Section C carries forty-five (45) marks.",
            "All writings must be in blue or black ink.",
            "All answers must be written in the spaces provided.",
            "Q4",
            "The following information was extracted from the records. 1.2018 Sales ledger (Dr) 190,800 Sales ledger (Cr) 1,100.",
            "SECTION C (45 MARKS)",
            "Answer all questions in this section.",
            "Q5",
            "Prepare a statement of financial position from the information provided (15 marks)."
        ].join("\n"),
    });

    assert.equal(result.questions.some(q => /all writings must|all answers must|sections? a carries/i.test(q.question_text)), false);
    assert.equal(result.questions.some(q => /^1\.2018/m.test(q.question_text)), true);
    assert.equal(result.questions.filter(q => q.section === "A").length, 2);
    assert.deepEqual(
        result.questions.filter(q => q.section === "A").map(q => q.max_marks),
        [10, 5]
    );
    assert.ok(result.questions.every(q => q.question_number > 0));
    assert.ok(!result.questions.some(q => q.question_number === 31));
});
