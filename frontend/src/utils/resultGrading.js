const normalize = value => String(value || "")
  .trim()
  .toUpperCase()
  .replace(/[_-]+/g, " ")
  .replace(/\s+/g, " ");

export const getEducationLevelType = value => {
  const level = normalize(Array.isArray(value) ? value.filter(Boolean).join(" ") : value);

  if (/O LEVEL|ORDINARY LEVEL|ORDINARY SECONDARY|FORM\s*(I|1|II|2|III|3|IV|4)(\b|$)|FORM\s*1\s*[-–]\s*4/.test(level)
    && !/A LEVEL|ADVANCED LEVEL|FORM\s*(V|5|VI|6)(\b|$)/.test(level)) return "O_LEVEL";
  if (/A LEVEL|A-LEVEL|ADVANCED LEVEL|ADVANCED SECONDARY|FORM\s*(V|5|VI|6)(\b|$)|FORM\s*5\s*[-–]\s*6/.test(level)) return "A_LEVEL";
  if (/BABY CLASS|BABY|NURSERY|PRE PRIMARY|PRE-PRIMARY|KINDERGARTEN|EARLY YEARS/.test(level)) return "EARLY_YEARS";
  if (/PRIMARY|STANDARD\s*(I|1|II|2|III|3|IV|4|V|5|VI|6|VII|7)(\b|$)|STD\s*(I|1|II|2|III|3|IV|4|V|5|VI|6|VII|7)(\b|$)/.test(level)) return "PRIMARY";
  return "GENERAL";
};

const isLegacyOLevelScale = scales => {
  const grades = (Array.isArray(scales) ? scales : [])
    .map(scale => String(scale.grade || "").trim().toUpperCase())
    .sort();
  return grades.length === 5 && ["A", "B", "C", "D", "F"].every((grade, index) => grades[index] === grade);
};

export const getApplicableGradeScale = (percentage, scales, levelContext) => {
  const levelType = getEducationLevelType(levelContext);
  if (levelType !== "O_LEVEL" && isLegacyOLevelScale(scales)) return null;

  // Primary results must use letter grades. Some schools have a generic
  // early-years scale (Excellent/Good/Developing/Needs Support) attached to
  // the exam; do not let that scale replace Primary A/B/C/D/E grades.
  if (levelType === "PRIMARY") {
    const configuredGrades = (Array.isArray(scales) ? scales : [])
      .map(scale => String(scale?.grade || "").trim().toUpperCase())
      .filter(Boolean);
    if (configuredGrades.length && configuredGrades.some(grade => !/^[A-F]$/.test(grade))) return null;
  }

  const p = Number(percentage) || 0;
  return [...(Array.isArray(scales) ? scales : [])]
    .sort((a, b) => (Number(b.min_percentage) || 0) - (Number(a.min_percentage) || 0))
    .find(scale => p >= (Number(scale.min_percentage) || 0) && p <= (Number(scale.max_percentage) || 0)) || null;
};

export const gradeForEducationLevel = (percentage, levelContext, scales = []) => {
  const p = Math.max(0, Math.min(100, Number(percentage) || 0));
  const levelType = getEducationLevelType(levelContext);
  const configured = getApplicableGradeScale(p, scales, levelContext);
  if (configured) return configured.grade;

  if (levelType === "O_LEVEL") {
    if (p >= 75) return "A";
    if (p >= 65) return "B";
    if (p >= 45) return "C";
    if (p >= 30) return "D";
    return "F";
  }

  if (levelType === "A_LEVEL") {
    if (p >= 80) return "A";
    if (p >= 70) return "B";
    if (p >= 60) return "C";
    if (p >= 50) return "D";
    if (p >= 40) return "E";
    if (p >= 35) return "S";
    return "F";
  }

  // NECTA PSLE subject bands are A=41–50, B=31–40, C=21–30,
  // D=11–20, E=0–10 for a paper marked out of 50. Convert those
  // boundaries to percentages so papers with a different maximum mark
  // can be compared consistently. A valid exam-specific scale above wins.
  if (levelType === "PRIMARY") {
    if (p >= 82) return "A";
    if (p >= 62) return "B";
    if (p >= 42) return "C";
    if (p >= 22) return "D";
    return "E";
  }

  if (p >= 80) return "Excellent";
  if (p >= 65) return "Good";
  if (p >= 50) return "Satisfactory";
  if (p >= 40) return "Developing";
  return "Needs Support";
};

export const remarkForEducationLevel = (grade, levelContext, scales = []) => {
  const levelType = getEducationLevelType(levelContext);
  const normalizedGrade = String(grade || "").trim().toUpperCase();
  const configured = (Array.isArray(scales) ? scales : []).find(scale =>
    String(scale.grade || "").trim().toUpperCase() === normalizedGrade
  );
  if (configured?.remark) return configured.remark;

  if (levelType === "O_LEVEL") {
    return ({ A: "Excellent", B: "Very Good", C: "Good", D: "Pass", F: "Fail" })[normalizedGrade] || grade;
  }
  if (levelType === "A_LEVEL") {
    return ({ A: "Excellent", B: "Very Good", C: "Good", D: "Average", E: "Satisfactory", S: "Subsidiary", F: "Fail" })[normalizedGrade] || grade;
  }
  if (levelType === "PRIMARY") {
    return ({ A: "Excellent", B: "Very Good", C: "Good", D: "Satisfactory", E: "Unsatisfactory" })[normalizedGrade] || grade;
  }
  return grade || "Not assessed";
};

export const gradeLabelsForEducationLevel = (levelContext, scales = []) => {
  const levelType = getEducationLevelType(levelContext);
  const configured = (Array.isArray(scales) ? scales : [])
    .filter(scale => scale && scale.grade)
    .map(scale => String(scale.grade));
  if (configured.length && (levelType === "O_LEVEL" || !isLegacyOLevelScale(scales))) return [...new Set(configured)];
  if (levelType === "O_LEVEL") return ["A", "B", "C", "D", "F"];
  if (levelType === "A_LEVEL") return ["A", "B", "C", "D", "E", "S", "F"];
  if (levelType === "PRIMARY") return ["A", "B", "C", "D", "E"];
  return ["Excellent", "Good", "Satisfactory", "Developing", "Needs Support"];
};
