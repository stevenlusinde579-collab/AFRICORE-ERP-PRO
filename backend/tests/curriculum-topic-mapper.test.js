import test from "node:test";
import assert from "node:assert/strict";
import { inferCurriculumTopic } from "../services/curriculumTopicMapper.js";
import { analyzePaperWithRules } from "../services/ruleBasedExamAnalysis.js";
import { TANZANIA_CURRICULUM_SOURCES } from "../data/tanzaniaCurriculumSources.js";

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


test("passes education-level context through the topic mapper", () => {
    const result = inferCurriculumTopic({
        subjectName: "Mathematics",
        level: "Standard IV",
        questionText: "Add 24 and 16.",
    });
    assert.equal(result.curriculum_level, "primary");
    assert.equal(result.topic, "Number");
});

test("does not force a topic when question evidence is ambiguous", () => {
    const result = inferCurriculumTopic({
        subjectName: "English Language",
        level: "Form II",
        questionText: "Read the passage and identify the noun and tense used in the sentences.",
    });
    assert.equal(result.topic, null);
    assert.equal(result.sub_topic, null);
    assert.equal(result.topic_source, "ambiguous_rule_match");
    assert.ok(result.topic_alternatives.length >= 2);
});

test("does not infer a topic from unrelated instruction words", () => {
    const result = inferCurriculumTopic({
        subjectName: "Chemistry",
        level: "Form IV",
        questionText: "Answer all questions. Write your examination number clearly.",
    });
    assert.equal(result.topic, null);
    assert.equal(result.topic_confidence, 0);
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


test("registers official TIE curriculum sources for all school education levels", () => {
    const levels = TANZANIA_CURRICULUM_SOURCES.levels;
    for (const key of ["pre_primary", "primary", "ordinary_secondary", "advanced_secondary"]) {
        assert.ok(levels[key].officialUrl.startsWith("https://www.tie.go.tz/"), key);
        assert.equal(levels[key].year, 2023, key);
        assert.equal(levels[key].status, "official_source_registered", key);
    }
});

test("maps Primary Science and Technology questions to relevant topic evidence", () => {
    const result = inferCurriculumTopic({
        questionText: "Oanisha milango ya fahamu na kazi zake. Jicho hutumika katika kuona.",
        subjectName: "Science and Technology",
        level: "Primary"
    });
    assert.equal(result.curriculum_level, "primary");
    assert.equal(result.topic, "Human body and health");
    assert.ok(result.topic_evidence);
});

test("maps Primary Science syllabus competencies for inquiry, energy and ICT", () => {
    const cases = [
        ["Explain the concept of science and branches of science.", "Scientific concepts and inquiry"],
        ["Describe types of energy and their uses.", "Energy"],
        ["Explain how ICT is used in learning.", "ICT in learning"],
        ["Design a simple computer program.", "Simple computer programming"],
    ];
    for (const [questionText, expectedTopic] of cases) {
        const result = inferCurriculumTopic({ questionText, subjectName: "Science and Technology", level: "Standard IV" });
        assert.equal(result.topic, expectedTopic, questionText);
    }
});
