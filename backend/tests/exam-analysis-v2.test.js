import test from "node:test";
import assert from "node:assert/strict";
import { analyzeExaminationV2 } from "../services/examAnalysisV2.js";

test("runs the V2 pipeline end-to-end without invoking Gemini or production controllers", () => {
    const result = analyzeExaminationV2({
        level: "Form Four",
        subject: "Chemistry",
        text: [
            "CHEMISTRY",
            "SECTION A",
            "Answer all questions.",
            "QUESTION 1 [5 marks]",
            "Explain why acids turn blue litmus paper red.",
            "QUESTION 2 [5 marks]",
            "Describe the separation of a mixture by filtration.",
            "TOTAL MARKS: 10",
        ].join("\n"),
    });

    assert.equal(result.engine, "evidence_based_v2");
    assert.equal(result.document.summary.question_count, 2);
    assert.equal(result.analysis.totals.declared, 10);
    assert.equal(result.analysis.totals.calculated_from_explicit_evidence, 10);
    assert.equal(result.analysis.questions[0].marks, 5);
    assert.equal(result.analysis.questions[1].marks, 5);
    assert.equal(result.analysis.questions[0].curriculum.topic, "Acids, bases and salts");
    assert.equal(result.analysis.questions[1].curriculum.topic, "Separation of mixtures");
    assert.equal(result.decision.ready_for_review, true);
    assert.equal(result.decision.safe_to_auto_approve, false);
    assert.equal(result.decision.requires_human_review, true);
});

test("never auto-approves an analysis with incomplete marks or ambiguous structure", () => {
    const result = analyzeExaminationV2({
        level: "Standard IV",
        subject: "English",
        text: "SECTION A\n1. Read the passage.\n(a) Answer the questions.\n2. Write a story.",
    });

    assert.equal(result.decision.ready_for_review, true);
    assert.equal(result.decision.safe_to_auto_approve, false);
    assert.equal(result.decision.requires_human_review, true);
});

test("supports Baby Class activities, Primary tasks, A-Level Roman questions and Diploma tasks", () => {
    const cases = [
        { level: "Baby Class", subject: "General", text: "ACTIVITY 1 Colour the red circle." },
        { level: "Nursery", subject: "General", text: "Trace letter A.\nColour the red circle.\nCount five objects.", expectedQuestionCount: 3 },
        { level: "Standard IV", subject: "Mathematics", text: "TASK 1 Calculate 25 + 15." },
        { level: "Form Six", subject: "Physics", text: "I. Explain the principle of conservation of energy." },
        { level: "Diploma", subject: "Accounting", text: "TASK 1 Calculate depreciation using the straight-line method." },
    ];
    for (const sample of cases) {
        const result = analyzeExaminationV2(sample);
        assert.equal(result.document.summary.question_count, sample.expectedQuestionCount || 1, sample.level);
        assert.equal(result.decision.ready_for_review, true, sample.level);
        assert.equal(result.decision.safe_to_auto_approve, false, sample.level);
    }
});

test("recognizes six Standard IV English tasks when question 4 is printed twice", () => {
    const text = [
        "IRINGA MUNICIPAL COUNCIL",
        "MOCK EXAMINATION STD IV",
        "SUBJECT: ENGLISH LANGUAGE",
        "SECTION A: 30 MARKS",
        "1. Listen carefully to the sentences read by your invigilator then write them correctly in the space provided.",
        "i. First sentence",
        "ii. Second sentence",
        "iii. Third sentence",
        "iv. Fourth sentence",
        "v. Fifth sentence",
        "2. Choose the most correct answer from the given alternatives and write its letter in the box provided.",
        "i. My sister cooks food every day. Therefore, she is a teacher, cook, nurse or driver.",
        "ii. Breakfast is the meal we take early in the morning.",
        "3. Match the words from List A with the words with similar sounds in List B by writing the correct letter.",
        "i. Blue - Two",
        "ii. Night - Light",
        "SECTION B: 10 MARKS",
        "4. Write the correct English word from the jumbled letters in the brackets to make meaningful sentences.",
        "i. She is a (tarms) girl in our class.",
        "ii. Peter (dawelk) to school yesterday.",
        "iii. She (dekoco) rice for dinner.",
        "4. Complete Mary's daily routine by writing the verbs in the brackets into the correct form.",
        "Mary (i) (wake up) at six o'clock every morning. She (ii) (make) her bed. Then she (iii) (help) her mother in the kitchen. After that, she (iv) (walk) to school with her friends.",
        "SECTION C: 10 MARKS",
        "6. Read the following passage carefully and then answer the questions that follow.",
        "My name is Grace. I am in class four. I study at Furaha primary school.",
        "i. What is the name of Grace's school?",
        "ii. How many members are in Grace's family?",
    ].join("\n");
    const result = analyzeExaminationV2({ level: "Standard IV", subject: "English Language", text });
    assert.equal(result.document.summary.question_count, 6);
    assert.deepEqual(result.analysis.questions.map(question => question.question_number), [1, 2, 3, 4, 5, 6]);
    assert.equal(result.analysis.questions[4].classification.type, "fill_in_the_blanks");
    assert.equal(result.analysis.questions[5].classification.type, "reading_comprehension");
    assert.equal(result.validation.valid, true);
});
