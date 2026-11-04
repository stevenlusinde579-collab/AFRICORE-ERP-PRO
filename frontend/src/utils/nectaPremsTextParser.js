const normalizeHeader = (value) => String(value || "")
  .replace(/^\\*+|\\*+$/g, "")
  .replace(/<[^>]*>/g, " ")
  .replace(/&nbsp;/gi, " ")
  .replace(/&#x20;/gi, " ")
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const splitTableLine = (line) => {
  const value = String(line || "").trim();
  if (value.includes("|")) {
    return value.replace(/^\\|/, "").replace(/\\|$/, "").split("|").map((cell) =>
      cell.trim().replace(/^\\*+|\\*+$/g, "")
    );
  }
  if (value.includes("\\t")) return value.split("\\t").map((cell) => cell.trim());
  return null;
};

const isMarkdownDivider = (cells) =>
  cells?.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\\s/g, "")));

export function parseNectaQualifiedList(text) {
  const lines = String(text || "").split(/\\r?\\n/).map((line) => line.trim()).filter(Boolean);
  let headerIndex = -1;
  let headers = [];

  for (let index = 0; index < lines.length; index += 1) {
    const cells = splitTableLine(lines[index]);
    if (!cells || isMarkdownDivider(cells)) continue;
    const normalized = cells.map(normalizeHeader);
    const hasPrem = normalized.some((item) => item === "prem number" || item === "prem");
    const hasName = normalized.some((item) => item === "full name" || item === "student name");
    const hasSex = normalized.some((item) => item === "sex" || item === "gender");
    if (hasPrem && hasName && hasSex) {
      headerIndex = index;
      headers = normalized;
      break;
    }
  }

  if (headerIndex < 0) {
    throw new Error("Qualified list headers were not recognized. Expected PREM Number, Full Name and Sex.");
  }

  const findColumn = (...names) => headers.findIndex((header) => names.includes(header));
  const premIndex = findColumn("prem number", "prem");
  const certIndex = findColumn("cert entry number", "certificate entry number", "birth certificate number");
  const nameIndex = findColumn("full name", "student name");
  const sexIndex = findColumn("sex", "gender");
  const statusIndex = findColumn("status");

  const students = [];
  for (const line of lines.slice(headerIndex + 1)) {
    const cells = splitTableLine(line);
    if (!cells || isMarkdownDivider(cells)) continue;
    if (cells.length <= Math.max(premIndex, nameIndex, sexIndex)) continue;
    const premNumber = String(cells[premIndex] || "").replace(/\\s/g, "").trim();
    const fullName = String(cells[nameIndex] || "").trim();
    const sex = String(cells[sexIndex] || "").trim();
    if (!/^\\d{8,}$/.test(premNumber) || !fullName || !sex) continue;
    const nameParts = fullName.split(/\\s+/).filter(Boolean);
    students.push({
      prem_number: premNumber,
      certificate_entry_number: certIndex >= 0 ? String(cells[certIndex] || "").trim() : "",
      full_name: fullName,
      first_name: nameParts[0] || "",
      middle_name: nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : "",
      last_name: nameParts.length > 1 ? nameParts[nameParts.length - 1] : "",
      gender: /^f(emale)?$/i.test(sex) ? "Female" : /^m(ale)?$/i.test(sex) ? "Male" : "",
      source_sex: sex,
      status: statusIndex >= 0 ? String(cells[statusIndex] || "").trim() : "",
    });
  }

  if (!students.length) throw new Error("No valid student rows were found in the Qualified list.");
  if (students.length > 5000) throw new Error("Qualified list exceeds the safe limit of 5,000 rows per batch.");

  const seen = new Set();
  const duplicates = new Set();
  for (const student of students) {
    if (seen.has(student.prem_number)) duplicates.add(student.prem_number);
    seen.add(student.prem_number);
  }
  return {
    students,
    duplicate_prem_numbers: [...duplicates],
    row_count: students.length,
  };
}

const LABELS = {
  prem_number: ["prem#","prem number"],
  sex: ["sex"],
  date_of_birth: ["date of birth"],
  admission_number: ["admission number"],
  registration_date: ["registration date"],
  registration_type: ["registration type"],
  form: ["form"],
  status: ["status"],
  school: ["school"],
  stream: ["stream"],
  field: ["field"],
  trade: ["trade"],
  is_repeater: ["is repeater"],
  parenting_status: ["parenting status"],
  citizenship: ["citizenship"],
  health_status_category: ["health status category"],
  accommodation: ["accommodation"],
  birth_certificate_no: ["birth certificate no"],
  student_id_number: ["student id number"],
  distance_from_home: ["distance from home"],
  address_line_1: ["address line 1"],
  address_line_2: ["address line 2"],
  address_line_3: ["address line 3"],
  physical_address: ["physical address","physical addres"],
  place_of_domicile: ["place of domicile"],
  exam_reference_number: ["exam reference number","exam reference number","exam reference"],
  exam_reference_year: ["exam reference year","exam year"],
  guardian_national_id: ["national id number"],
  guardian_full_name: ["full name"],
  guardian_sex: ["sex"],
  guardian_relationship: ["relationship"],
  guardian_email: ["email"],
  guardian_phone: ["phone"],
  guardian_occupation: ["occupation"],
  guardian_address: ["address"],
  guardian_physical_address: ["physical addres","physical address"],
  guardian_education_level: ["education level"],
};

const extractSection = (source, start, end) => {
  const startIndex = source.toLowerCase().indexOf(start.toLowerCase());
  if (startIndex < 0) return "";
  const remainder = source.slice(startIndex + start.length);
  if (!end) return remainder;
  const endIndex = remainder.toLowerCase().indexOf(end.toLowerCase());
  return endIndex < 0 ? remainder : remainder.slice(0, endIndex);
};

const readLabel = (source, labels) => {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");
    const match = source.match(new RegExp(`(?:^|\\n)\\s*[-*]?\\s*\\*?${escaped}\\*?\\s*:?\\s*([^\\n]*)`, "i"));
    if (match) return match[1].trim();
  }
  return "";
};

export function parseNectaStudentProfile(text) {
  const source = String(text || "").replace(/\\r/g, "");
  if (!source.trim()) throw new Error("Paste the NECTA Student Profile text first.");

  const headerMatch = source.match(/^\\s*#{1,6}\\s+(.+)$/m);
  const fullName = headerMatch?.[1]?.replace(/Student Profile/i, "").trim() || "";
  const registration = extractSection(source, "Registration", "Guardian");
  const guardian = extractSection(source, "Guardian Information", "Condition");
  const condition = extractSection(source, "Difficulties", "History");
  const qualifications = extractSection(source, "Qualifications", "History");

  const value = (key, section = source) => readLabel(section, LABELS[key] || [key.replace(/_/g, " ")]);
  const premMatch = source.match(/PREM\\s*#?\\s*:\\s*([0-9]+)/i);
  const premNumber = premMatch?.[1] || value("prem_number");

  const difficultiesText = extractSection(condition, "Student's difficulties", "Student's disabilities");
  const disabilitiesText = extractSection(condition, "Student's disabilities");
  const noDifficulties = /no difficulties/i.test(difficultiesText);
  const noDisabilities = /no disabilities/i.test(disabilitiesText);

  return {
    prem_number: premNumber.trim(),
    full_name: fullName,
    gender: value("sex"),
    date_of_birth: value("date_of_birth"),
    admission_number: value("admission_number"),
    registration_date: value("registration_date"),
    registration_type: value("registration_type"),
    form: value("form", registration),
    status: value("status", registration),
    school: value("school", registration),
    stream: value("stream", registration),
    field: value("field", registration),
    trade: value("trade", registration),
    is_repeater: value("is_repeater", registration),
    parenting_status: value("parenting_status", registration),
    citizenship: value("citizenship", registration),
    health_status_category: value("health_status_category", registration),
    accommodation: value("accommodation", registration),
    birth_certificate_no: value("birth_certificate_no", registration),
    student_id_number: value("student_id_number", registration),
    distance_from_home: value("distance_from_home", registration),
    address_line_1: value("address_line_1", registration),
    address_line_2: value("address_line_2", registration),
    address_line_3: value("address_line_3", registration),
    physical_address: value("physical_address", registration),
    place_of_domicile: value("place_of_domicile", registration),
    exam_reference_number: value("exam_reference_number", qualifications),
    exam_reference_year: value("exam_reference_year", qualifications),
    guardian: {
      national_id_number: value("guardian_national_id", guardian),
      full_name: value("guardian_full_name", guardian),
      sex: value("guardian_sex", guardian),
      relationship: value("guardian_relationship", guardian),
      email: value("guardian_email", guardian),
      phone: value("guardian_phone", guardian),
      occupation: value("guardian_occupation", guardian),
      address: value("guardian_address", guardian),
      physical_address: value("guardian_physical_address", guardian),
      education_level: value("guardian_education_level", guardian),
    },
    condition: {
      difficulties: noDifficulties ? [] : difficultiesText.trim(),
      disabilities: noDisabilities ? [] : disabilitiesText.trim(),
      difficulties_status: noDifficulties ? "none" : difficultiesText.trim() ? "recorded" : "unknown",
      disabilities_status: noDisabilities ? "none" : disabilitiesText.trim() ? "recorded" : "unknown",
    },
    qualifications_text: qualifications.trim(),
  };
}
