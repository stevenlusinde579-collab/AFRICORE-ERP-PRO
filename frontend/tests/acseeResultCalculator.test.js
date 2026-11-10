import test from "node:test";
import assert from "node:assert/strict";
import { getAcseeGrade, getAcseeGradePoint, calculateAcseeResult } from "../src/utils/acseeResultCalculator.js";

test("uses ACSEE A, B, C, D, E, S and F boundaries", () => {
  assert.deepEqual([80,70,60,50,40,35,34].map(getAcseeGrade), ["A","B","C","D","E","S","F"]);
  assert.deepEqual(["A","B","C","D","E","S","F"].map(getAcseeGradePoint), [1,2,3,4,5,6,7]);
});

const subject = (id, percentage) => ({ subject_id: id, percentage, total: percentage, status: "Complete" });

test("uses only three principal subjects for aggregate and division", () => {
  const result = calculateAcseeResult([
    subject(10, 85), subject(11, 75), subject(12, 65), subject(13, 100)
  ], [10,11,12]);
  assert.equal(result.aggregate, 6);
  assert.equal(result.division, "I");
  assert.equal(result.average, 75);
  assert.equal(result.principalSubjects.length, 3);
  assert.equal(result.subsidiarySubjects.length, 1);
  assert.equal(result.subsidiarySubjects[0].subject_id, 13);
});

test("does not calculate a division for missing or incomplete principal marks", () => {
  const missing = calculateAcseeResult([subject(10,80), subject(11,70)], [10,11,12]);
  assert.equal(missing.eligible, false);
  assert.equal(missing.division, null);
  const partial = calculateAcseeResult([
    subject(10,80), {...subject(11,70), status:"Partial"}, subject(12,60)
  ], [10,11,12]);
  assert.equal(partial.eligible, false);
  assert.equal(partial.division, null);
});

test("requires exactly three distinct principal subjects", () => {
  assert.equal(calculateAcseeResult([], [1,2]).eligible, false);
  assert.equal(calculateAcseeResult([], [1,2,3,4]).eligible, false);
});

test("maps aggregate points to all ACSEE divisions including Division 0", () => {
  const make = (marks) => calculateAcseeResult(marks.map((mark,i)=>subject(i+1,mark)), [1,2,3]);
  assert.equal(make([80,80,80]).division, "I");
  assert.equal(make([70,70,70]).division, "II");
  assert.equal(make([60,60,60]).division, "III");
  assert.equal(make([50,50,40]).division, "III");
  assert.equal(make([35,35,35]).division, "IV");
  assert.equal(make([34,34,35]).division, "0");
  assert.equal(make([80,34,34]).division, "III");
  assert.equal(make([40,34,34]).division, "IV");
  assert.equal(make([40,35,35]).division, "IV");
});
