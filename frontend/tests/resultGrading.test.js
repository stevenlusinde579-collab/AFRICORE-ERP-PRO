import test from "node:test";
import assert from "node:assert/strict";
import {
  getEducationLevelType,
  gradeForEducationLevel,
  gradeLabelsForEducationLevel,
  remarkForEducationLevel
} from "../src/utils/resultGrading.js";

test("recognizes Baby Class, primary, O-Level and A-Level separately", () => {
  assert.equal(getEducationLevelType("Baby Class"), "EARLY_YEARS");
  assert.equal(getEducationLevelType("Standard IV"), "PRIMARY");
  assert.equal(getEducationLevelType("Class 4"), "PRIMARY");
  assert.equal(getEducationLevelType("Primary Class 4"), "PRIMARY");
  assert.equal(getEducationLevelType("Ordinary Level Form IV"), "O_LEVEL");
  assert.equal(getEducationLevelType("Advanced Level Form VI"), "A_LEVEL");
});

test("preserves existing O-Level grade boundaries", () => {
  assert.equal(gradeForEducationLevel(75, "O-Level"), "A");
  assert.equal(gradeForEducationLevel(65, "O-Level"), "B");
  assert.equal(gradeForEducationLevel(45, "O-Level"), "C");
  assert.equal(gradeForEducationLevel(30, "O-Level"), "D");
  assert.equal(gradeForEducationLevel(29, "O-Level"), "F");
});

test("uses ACSEE grade bands when no exam-specific scale is configured", () => {
  assert.equal(gradeForEducationLevel(80, "Advanced Level"), "A");
  assert.equal(gradeForEducationLevel(70, "Form V"), "B");
  assert.equal(gradeForEducationLevel(60, "A-Level"), "C");
  assert.equal(gradeForEducationLevel(50, "A-Level"), "D");
  assert.equal(gradeForEducationLevel(40, "A-Level"), "E");
  assert.equal(gradeForEducationLevel(35, "A-Level"), "S");
  assert.equal(gradeForEducationLevel(34, "A-Level"), "F");
  assert.equal(remarkForEducationLevel("S", "A-Level"), "Subsidiary");
  assert.deepEqual(gradeLabelsForEducationLevel("Form VI"), ["A", "B", "C", "D", "E", "S", "F"]);
});

test("uses NECTA PSLE A–E bands for primary and does not apply inherited O-Level defaults", () => {
  const legacyScale = [
    { grade: "A", min_percentage: 75, max_percentage: 100 },
    { grade: "B", min_percentage: 65, max_percentage: 74 },
    { grade: "C", min_percentage: 45, max_percentage: 64 },
    { grade: "D", min_percentage: 30, max_percentage: 44 },
    { grade: "F", min_percentage: 0, max_percentage: 29 }
  ];
  assert.equal(gradeForEducationLevel(82, "Primary", legacyScale), "A");
  assert.equal(gradeForEducationLevel(62, "Standard IV", legacyScale), "B");
  assert.equal(gradeForEducationLevel(42, "Primary", legacyScale), "C");
  assert.equal(gradeForEducationLevel(22, "Primary", legacyScale), "D");
  assert.equal(gradeForEducationLevel(21, "Primary", legacyScale), "E");
  assert.deepEqual(gradeLabelsForEducationLevel("Primary", legacyScale), ["A", "B", "C", "D", "E"]);
  assert.equal(remarkForEducationLevel("E", "Primary"), "Unsatisfactory");
test("Primary always displays A-E grades and never inherited support labels", () => {
  const inheritedEarlyYearsScale = [
    { grade: "Excellent", min_percentage: 80, max_percentage: 100 },
    { grade: "Good", min_percentage: 65, max_percentage: 79 },
    { grade: "Satisfactory", min_percentage: 50, max_percentage: 64 },
    { grade: "Developing", min_percentage: 40, max_percentage: 49 },
    { grade: "Needs Support", min_percentage: 0, max_percentage: 39 }
  ];

  assert.equal(gradeForEducationLevel(20, "Primary", inheritedEarlyYearsScale), "E");
  assert.equal(gradeForEducationLevel(39, "Standard IV", inheritedEarlyYearsScale), "D");
  assert.equal(gradeForEducationLevel(50, "Primary", inheritedEarlyYearsScale), "C");
  assert.equal(gradeForEducationLevel(70, "Primary", inheritedEarlyYearsScale), "B");
  assert.equal(gradeForEducationLevel(90, "Primary", inheritedEarlyYearsScale), "A");
  assert.deepEqual(
    gradeLabelsForEducationLevel("Primary", inheritedEarlyYearsScale),
    ["A", "B", "C", "D", "E"]
  );
});

  assert.equal(gradeForEducationLevel(75, "Baby Class", legacyScale), "Good");
  assert.equal(gradeForEducationLevel(75, "Ordinary Level", legacyScale), "A");
  assert.equal(gradeForEducationLevel(75, "Advanced Level"), "B");
});

test("uses Primary letter grades and honors remarks for valid letter-grade scales", () => {
  const nonLetterScale = [{ grade: "Merit", min_percentage: 60, max_percentage: 100, remark: "Very good" }];
  assert.equal(gradeForEducationLevel(75, "Primary", nonLetterScale), "B");

  const primaryScale = [{ grade: "A", min_percentage: 60, max_percentage: 100, remark: "Very good" }];
  assert.equal(gradeForEducationLevel(75, "Primary", primaryScale), "B");
  assert.equal(remarkForEducationLevel("A", "Primary", primaryScale), "Very good");
});
