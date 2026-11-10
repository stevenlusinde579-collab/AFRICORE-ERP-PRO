const normalizeGrade = value => String(value || "").trim().toUpperCase();

/**
 * Tanzania ACSEE subject grade and point conversion.
 * This utility intentionally works only with the three principal subjects
 * assigned to a student's saved Advanced combination.
 */
export const getAcseeGrade = percentage => {
  const mark = Number(percentage);
  if (!Number.isFinite(mark)) return "F";
  if (mark >= 80) return "A";
  if (mark >= 70) return "B";
  if (mark >= 60) return "C";
  if (mark >= 50) return "D";
  if (mark >= 40) return "E";
  if (mark >= 35) return "S";
  return "F";
};

export const getAcseeGradePoint = grade => ({
  A: 1, B: 2, C: 3, D: 4, E: 5, S: 6, F: 7
})[normalizeGrade(grade)] ?? null;

/**
 * Calculate an Advanced Level result without including subsidiary subjects
 * in the principal aggregate. principalSubjectIds must come from the student's
 * combination_subjects mapping, not from subject order or marks availability.
 */
export const calculateAcseeResult = (subjectResults = [], principalSubjectIds = []) => {
  const ids = [...new Set((principalSubjectIds || []).map(String).filter(Boolean))];
  if (ids.length !== 3) {
    return {
      eligible: false, complete: false, reason: "A valid combination of exactly three principal subjects is required.",
      principalSubjects: [], subsidiarySubjects: [], aggregate: null, division: null,
      divisionLabel: "Not calculated", gpa: null, average: null, total: null, possible: 300
    };
  }

  const bySubject = new Map((Array.isArray(subjectResults) ? subjectResults : [])
    .map(row => [String(row.subject_id), row]));
  const principalSubjects = ids.map(id => bySubject.get(id)).filter(Boolean);
  if (principalSubjects.length !== 3) {
    return {
      eligible: false, complete: false, reason: "One or more principal subjects are not included in this examination.",
      principalSubjects, subsidiarySubjects: [], aggregate: null, division: null,
      divisionLabel: "Not calculated", gpa: null, average: null, total: null, possible: 300
    };
  }

  const incomplete = principalSubjects.filter(row =>
    row.status !== "Complete" || !Number.isFinite(Number(row.percentage))
  );
  if (incomplete.length) {
    return {
      eligible: false, complete: false,
      reason: "All three principal-subject marks must be complete before an ACSEE division can be calculated.",
      principalSubjects, subsidiarySubjects: (subjectResults || []).filter(row => !ids.includes(String(row.subject_id))),
      aggregate: null, division: null, divisionLabel: "Awaiting principal marks",
      gpa: null, average: null, total: null, possible: 300
    };
  }

  const graded = principalSubjects.map(row => {
    const percentage = Math.max(0, Math.min(100, Number(row.percentage)));
    const grade = getAcseeGrade(percentage);
    return { ...row, percentage, grade, point: getAcseeGradePoint(grade), isPrincipal: true };
  });
  const aggregate = graded.reduce((sum, row) => sum + row.point, 0);
  let division = null;
  if (aggregate >= 3 && aggregate <= 9) division = "I";
  else if (aggregate >= 10 && aggregate <= 12) division = "II";
  else if (aggregate >= 13 && aggregate <= 17) division = "III";
  else if (aggregate >= 18 && aggregate <= 19) division = "IV";
  else if (aggregate >= 20 && aggregate <= 21) division = "0";

  const total = graded.reduce((sum, row) => sum + row.percentage, 0);
  const average = total / 3;
  const principalPassCount = graded.filter(row => ["A", "B", "C", "D", "E"].includes(row.grade)).length;
  const principalSubsidiaryPassCount = graded.filter(row => row.grade === "S").length;
  const hasHighPrincipalPass = graded.some(row => ["A", "B", "C"].includes(row.grade));

  // ACSEE award rules distinguish principal passes from subsidiary passes.
  // Division III requires either two principal passes or one principal pass
  // at grade C or better. Division IV also covers a candidate with at least
  // one principal pass or two subsidiary passes, even when aggregate points
  // alone would otherwise fall in the Division 0 band.
  let awardDivision = null;
  if (aggregate >= 3 && aggregate <= 9) awardDivision = "I";
  else if (aggregate >= 10 && aggregate <= 12 && principalPassCount >= 2) awardDivision = "II";
  else if (aggregate >= 13 && aggregate <= 17 && (principalPassCount >= 2 || hasHighPrincipalPass)) awardDivision = "III";
  else if ((aggregate >= 18 && aggregate <= 19) || principalPassCount >= 1 || principalSubsidiaryPassCount >= 2) awardDivision = "IV";

  const subsidiarySubjects = (Array.isArray(subjectResults) ? subjectResults : [])
    .filter(row => !ids.includes(String(row.subject_id)))
    .map(row => ({ ...row, isPrincipal: false }));

  return {
    eligible: true, complete: true, reason: null,
    principalSubjects: graded,
    subsidiarySubjects,
    aggregate,
    division,
    divisionLabel: division === "0" ? "Division 0" : division ? `Division ${division}` : "Not classified",
    gpa: Number((aggregate / 3).toFixed(4)),
    average: Number(average.toFixed(2)),
    total: Number(total.toFixed(2)),
    possible: 300,
    grade: getAcseeGrade(average),
    passed: Boolean(awardDivision)
  };
};

export const ACSEE_GRADE_LABELS = Object.freeze(["A", "B", "C", "D", "E", "S", "F"]);
