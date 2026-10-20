import test from "node:test";
import assert from "node:assert/strict";
import { extractDeclaredTotalMarks } from "../services/examMarkValidation.js";

test("extracts an explicit total marks label", () => {
    assert.equal(extractDeclaredTotalMarks("ENGLISH EXAMINATION\nTOTAL MARKS: 50"), 50);
    assert.equal(extractDeclaredTotalMarks("Maximum Marks - 100"), 100);
});

test("extracts an explicit sentence declaring the whole paper total", () => {
    assert.equal(extractDeclaredTotalMarks("This paper carries 50 marks."), 50);
    assert.equal(extractDeclaredTotalMarks("Total of 80 marks"), 80);
});

test("does not guess the whole-paper total from unrelated question marks", () => {
    assert.equal(extractDeclaredTotalMarks("Question 1 carries 10 marks. Section A has 20 marks."), null);
    assert.equal(extractDeclaredTotalMarks(""), null);
});
