import test from "node:test";
import assert from "node:assert/strict";
import { inferCurriculumTopic } from "../services/curriculumTopicMapper.js";
import { analyzePaperWithRules } from "../services/ruleBasedExamAnalysis.js";

test("maps English daily-routine verb task to grammar with evidence", () => {
    const topic = inferCurriculumTopic({
        subjectName: "English Language",
        questionText: "Complete Mary's daily routine by writing the verbs in the brackets into the correct form.",
    });
    assert.equal(topic.topic, "Grammar");
    assert.equal(topic.sub_topic, "Verb forms and tenses");
    assert.ok(topic.topic_confidence > 0);
    assert.match(topic.topic_evidence, /daily routine|verb|correct form/i);
});

test("maps subject-specific topics without relying on Bloom verbs", () => {
    const cases = [
        ["Mathematics", "Solve the equation 2x + 5 = 15.", "Algebra"],
        ["Biology", "Explain the process of photosynthesis in green plants.", "Nutrition"],
        ["Chemistry", "Describe the structure of an atom and its electrons.", "Atomic structure"],
        ["Physics", "Calculate acceleration from the velocity-time data.", "Mechanics"],
        ["Geography", "Explain causes of soil erosion.", "Physical geography"],
        ["Accounting", "Prepare a trial balance from the ledger accounts.", "Trial balance"],
        ["Kiswahili", "Taja nomino na vitenzi katika sentensi.", "Sarufi"],
    ];
    for (const [subjectName, questionText, expected] of cases) {
        const result = inferCurriculumTopic({ subjectName, questionText });
        assert.equal(result.topic, expected, subjectName);
        assert.ok(result.topic_confidence > 0, subjectName);
        assert.ok(result.topic_evidence, subjectName);
    }
});

test("returns an honest unknown when question text has no topic evidence", () => {
    const result = inferCurriculumTopic({
        subjectName: "Chemistry",
        questionText: "Answer the following question.",
    });
    assert.equal(result.topic, null);
    assert.equal(result.topic_confidence, 0);
    assert.equal(result.topic_source, "not_identified");
});

test("includes topic confidence and evidence in Rule-Based question output", () => {
    const result = analyzePaperWithRules({
        subjectName: "English Language",
        level: "Standard IV",
        pdfText: "STANDARD IV ENGLISH LANGUAGE\n1. Complete Mary's daily routine by writing the verbs in the brackets into the correct form.",
    });
    assert.equal(result.questions[0].topic, "Grammar");
    assert.equal(result.questions[0].sub_topic, "Verb forms and tenses");
    assert.ok(result.questions[0].topic_confidence > 0);
    assert.match(result.questions[0].topic_evidence, /daily routine|verb|correct form/i);
});
