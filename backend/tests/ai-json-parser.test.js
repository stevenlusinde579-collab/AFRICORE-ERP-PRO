import test from "node:test";
import assert from "node:assert/strict";
import { parseAIResult } from "../services/aiJsonParser.js";

test("accepts valid JSON for different exam levels and structures", () => {
    const payload = {
        exam_type: "A-Level",
        level: "Advanced",
        subjects: ["Biology"],
        questions: [
            { number: 1, text: "Explain photosynthesis.", marks: 10 },
            { number: 2, text: "Compare two processes.", marks: 15 },
        ],
    };

    assert.deepEqual(parseAIResult(JSON.stringify(payload)), payload);
});

test("repairs unescaped quotation marks inside a question string", () => {
    const malformed = String.raw`{"questions":[{"text":"What does "osmosis" mean?","marks":2}]}`;
    const parsed = parseAIResult(malformed);

    assert.equal(parsed.questions[0].marks, 2);
    assert.match(parsed.questions[0].text, /osmosis/);
});

test("extracts JSON from explanatory text and markdown fences", () => {
    const payload = { level: "Primary", questions: [{ text: "Read and answer.", marks: 5 }] };
    const input = "Analysis result follows:\n```json\n" + JSON.stringify(payload) + "\n```";
    assert.deepEqual(parseAIResult(input), payload);
});

test("supports nested arrays, objects, and punctuation inside quoted text", () => {
    const payload = {
        level: "O-Level",
        sections: [
            { title: "Section A", questions: [{ text: "Choose: A, B, C, or D.", options: ["A", "B", "C", "D"] }] },
            { title: "Section B", questions: [{ text: "Explain {in your own words}.", marks: 8 }] },
        ],
    };
    assert.deepEqual(parseAIResult(JSON.stringify(payload)), payload);
});

test("rejects truncated JSON instead of returning partial analysis", () => {
    assert.throws(
        () => parseAIResult('{"level":"Primary","questions":[{"text":"unfinished'),
        (error) => error?.code === "INVALID_AI_JSON"
    );
});
