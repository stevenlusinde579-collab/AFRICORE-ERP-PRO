import test from "node:test";
import assert from "node:assert/strict";
import { inferCurriculumTopic } from "../services/examCurriculumTopicMapperV2.js";

test("maps Primary Science and Technology topics from TIE curriculum competencies", () => {
    const cases = [
        ["Explain the concept of science and branches of science.", "Scientific concepts and inquiry"],
        ["Describe types of energy and their uses.", "Energy"],
        ["Explain how ICT is used in learning.", "ICT in learning"],
        ["Design a simple computer program.", "Simple computer programming"],
        ["Oanisha milango ya fahamu na kazi zake. Jicho hutumika katika kuona.", "Human body and health"],
    ];
    for (const [questionText, expectedTopic] of cases) {
        const result = inferCurriculumTopic({ questionText, subjectName: "Science and Technology", level: "Standard IV" });
        assert.equal(result.topic, expectedTopic, questionText);
        assert.equal(result.curriculum_level, "primary");
        assert.ok(result.topic_evidence);
    }
});

test("keeps Chemistry plural acid concepts mapped to acids, bases and salts", () => {
    const result = inferCurriculumTopic({
        questionText: "Explain why acids turn blue litmus paper red.",
        subjectName: "Chemistry",
        level: "Form Four",
    });
    assert.equal(result.topic, "Acids, bases and salts");
});

test("maps Business Studies topics across Form One examination concepts", () => {
    const cases = [
        ["Identify the form of business known as sole proprietorship.", "Business ownership"],
        ["Explain the four business processes: production, distribution, exchange and consumption.", "Business processes"],
        ["State the four factors of production: land, labour, capital and entrepreneurship.", "Factors of production"],
        ["Explain the importance of entrepreneurship in Tanzania.", "Entrepreneurship"],
        ["Describe leadership, communication, networking and financial management skills.", "Entrepreneurial skills"],
        ["Classify vaccines, cigarettes and public libraries into merit and demerit goods.", "Classification of goods"],
        ["Explain the relationship between Business Studies, Mathematics, Music and Agriculture.", "Related disciplines"],
    ];
    for (const [questionText, expectedTopic] of cases) {
        const result = inferCurriculumTopic({ questionText, subjectName: "Business Studies", level: "Form One" });
        assert.equal(result.topic, expectedTopic, questionText);
        assert.equal(result.curriculum_level, "ordinary_secondary");
        assert.ok(result.topic_evidence);
    }
});
