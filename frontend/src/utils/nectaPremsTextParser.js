export function parseNectaQualifiedList(text) {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const clean = (value) => String(value || "").replace(/^\*+|\*+$/g, "").replace(/<[^>]*>/g, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const cellsOf = (line) => {
    const value = line.trim();
    if (value.includes("|")) return value.replace(/^\|/, "").replace(/\|$/, "").split("|").map((x) => x.trim());
    if (value.includes("\t")) return value.split("\t").map((x) => x.trim());
    return null;
  };
  let headerAt = -1;
  let headers = [];
  for (let i = 0; i < lines.length; i += 1) {
    const cells = cellsOf(lines[i]);
    if (!cells) continue;
    const normalized = cells.map(clean);
    if (normalized.some((x) => x === "prem number" || x === "prem") &&
        normalized.some((x) => x === "full name" || x === "student name") &&
        normalized.some((x) => x === "sex" || x === "gender")) {
      headerAt = i; headers = normalized; break;
    }
  }
  if (headerAt < 0) throw new Error("Qualified list headers were not recognized.");
  const index = (...names) => headers.findIndex((x) => names.includes(x));
  const p = index("prem number", "prem"), c = index("cert entry number", "certificate entry number", "birth certificate number");
  const n = index("full name", "student name"), s = index("sex", "gender"), st = index("status");
  const students = [];
  for (const line of lines.slice(headerAt + 1)) {
    const cells = cellsOf(line);
    if (!cells || cells.every((x) => /^:?-{3,}:?$/.test(x))) continue;
    if (cells.length <= Math.max(p, n, s)) continue;
    const prem = String(cells[p] || "").replace(/\s/g, "");
    const name = String(cells[n] || "").trim(), sex = String(cells[s] || "").trim();
    if (!/^\d{8,}$/.test(prem) || !name || !sex) continue;
    const parts = name.split(/\s+/);
    students.push({ prem_number: prem, certificate_entry_number: c < 0 ? "" : cells[c] || "",
      full_name: name, first_name: parts[0], middle_name: parts.length > 2 ? parts.slice(1,-1).join(" ") : "",
      last_name: parts.length > 1 ? parts[parts.length-1] : "",
      gender: /^f(emale)?$/i.test(sex) ? "Female" : /^m(ale)?$/i.test(sex) ? "Male" : "",
      source_sex: sex, status: st < 0 ? "" : cells[st] || "" });
  }
  if (!students.length) throw new Error("No valid student rows were found.");
  if (students.length > 5000) throw new Error("Qualified list exceeds 5,000 rows per batch.");
  const seen = new Set(), duplicates = new Set();
  for (const row of students) { if (seen.has(row.prem_number)) duplicates.add(row.prem_number); seen.add(row.prem_number); }
  return { students, duplicate_prem_numbers: [...duplicates], row_count: students.length };
}

const section = (source, start, end) => {
  const lower = source.toLowerCase(), at = lower.indexOf(start.toLowerCase());
  if (at < 0) return "";
  const rest = source.slice(at + start.length);
  if (!end) return rest;
  const stop = rest.toLowerCase().indexOf(end.toLowerCase());
  return stop < 0 ? rest : rest.slice(0, stop);
};

const field = (source, label) => {
  const target = label.toLowerCase();
  for (const line of String(source || "").split(/\r?\n/)) {
    const cleaned = line.trim().replace(/^[-*]\s*/, "").replace(/^\*\*/, "").replace(/\*\*/g, "");
    const lower = cleaned.toLowerCase();
    if (lower.startsWith(target)) return cleaned.slice(label.length).replace(/^\s*:?\s*/, "").trim();
  }
  return "";
};

export function parseNectaStudentProfile(text) {
  const source = String(text || "").replace(/\r/g, "");
  if (!source.trim()) throw new Error("Paste the NECTA Student Profile text first.");
  const headings = [...source.matchAll(/^\s*#{1,6}\s+(.+)$/gm)].map((m) => m[1].trim());
  const fullName = headings.find((x) => !/student profile/i.test(x)) || "";
  const guardian = section(source, "Guardian Information", "Condition");
  const condition = section(source, "Difficulties");
  const qualifications = section(source, "Qualifications", "Guardian");
  const difficulties = section(condition, "Student's difficulties", "Student's disabilities").trim();
  const disabilities = section(condition, "Student's disabilities").trim();
  const noDifficulties = /no difficulties/i.test(difficulties);
  const noDisabilities = /no disabilities/i.test(disabilities);
  const prems = source.match(/PREM\s*#?\s*:\s*([0-9]+)/i);
  return {
    prem_number: prems?.[1] || field(source, "PREM#"),
    full_name: fullName,
    gender: field(source, "Sex"), date_of_birth: field(source, "Date Of Birth"),
    admission_number: field(source, "Admission Number"), registration_date: field(source, "Registration Date"),
    registration_type: field(source, "Registration Type"), form: field(source, "Form"),
    status: field(source, "Status"), school: field(source, "School"), stream: field(source, "Stream"),
    field: field(source, "Field"), trade: field(source, "Trade"), is_repeater: field(source, "Is Repeater"),
    parenting_status: field(source, "Parenting Status"), citizenship: field(source, "Citizenship"),
    health_status_category: field(source, "Health Status Category"), accommodation: field(source, "Accommodation"),
    birth_certificate_no: field(source, "Birth Certificate No"), student_id_number: field(source, "Student ID Number"),
    distance_from_home: field(source, "Distance From Home"), address_line_1: field(source, "Address Line 1"),
    address_line_2: field(source, "Address Line 2"), address_line_3: field(source, "Address Line 3"),
    physical_address: field(source, "Physical Address"), place_of_domicile: field(source, "Place Of Domicile"),
    exam_reference_number: field(qualifications, "Exam/Reference Number"),
    exam_reference_year: field(qualifications, "Exam/Reference Year"),
    guardian: { national_id_number: field(guardian, "National ID Number"), full_name: field(guardian, "Full Name"),
      sex: field(guardian, "Sex"), relationship: field(guardian, "Relationship"), email: field(guardian, "Email"),
      phone: field(guardian, "Phone"), occupation: field(guardian, "Occupation"), address: field(guardian, "Address"),
      physical_address: field(guardian, "Physical Addres"), education_level: field(guardian, "Education Level") },
    condition: { difficulties: noDifficulties ? [] : difficulties, disabilities: noDisabilities ? [] : disabilities,
      difficulties_status: noDifficulties ? "none" : difficulties ? "recorded" : "unknown",
      disabilities_status: noDisabilities ? "none" : disabilities ? "recorded" : "unknown" },
    qualifications_text: qualifications.trim()
  };
}


export function mergeNectaQualifiedProfiles(qualified, profiles) {
  const rows = Array.isArray(qualified?.students) ? qualified.students : [];
  const profileRows = Array.isArray(profiles) ? profiles : [];
  const byPrem = new Map();
  const duplicateProfiles = new Set();
  for (const profile of profileRows) {
    const prem = String(profile?.prem_number || "").replace(/\\s/g, "");
    if (!prem) continue;
    if (byPrem.has(prem)) duplicateProfiles.add(prem);
    else byPrem.set(prem, profile);
  }
  const matched = new Set();
  const students = rows.map((row) => {
    const profile = byPrem.get(row.prem_number) || null;
    if (profile) matched.add(row.prem_number);
    const nameMatches = !profile?.full_name ||
      profile.full_name.trim().toLowerCase().replace(/\\s+/g, " ") ===
      row.full_name.trim().toLowerCase().replace(/\\s+/g, " ");
    const sexMatches = !profile?.gender ||
      normalizeProfileSex(profile.gender) === normalizeProfileSex(row.gender);
    return {
      ...row,
      profile,
      profile_status: !profile ? "missing" : duplicateProfiles.has(row.prem_number) ? "duplicate_profile" :
        !nameMatches || !sexMatches ? "mismatch" : "matched",
      profile_warnings: [
        ...(profile && !nameMatches ? ["Profile name does not match Qualified list"] : []),
        ...(profile && !sexMatches ? ["Profile sex does not match Qualified list"] : []),
        ...(profile && !profile.admission_number ? ["Admission Number missing in profile"] : []),
        ...(profile && !profile.date_of_birth ? ["Date of Birth missing in profile"] : [])
      ]
    };
  });
  const unmatchedProfiles = profileRows.filter((profile) =>
    profile?.prem_number && !matched.has(String(profile.prem_number).replace(/\\s/g, ""))
  ).map((profile) => String(profile.prem_number).replace(/\\s/g, ""));
  return {
    students,
    unmatched_profile_prem_numbers: [...new Set(unmatchedProfiles)],
    duplicate_profile_prem_numbers: [...duplicateProfiles],
    matched_count: students.filter((row) => row.profile_status === "matched").length,
    missing_profile_count: students.filter((row) => row.profile_status === "missing").length,
    mismatch_count: students.filter((row) => row.profile_status === "mismatch" || row.profile_status === "duplicate_profile").length
  };
}

function normalizeProfileSex(value) {
  const sex = String(value || "").trim().toLowerCase();
  if (sex === "f" || sex === "female") return "female";
  if (sex === "m" || sex === "male") return "male";
  return sex;
}


export function parseNectaStudentProfiles(text) {
  const source = String(text || "").trim();
  if (!source) throw new Error("Paste at least one PReMS Student Profile.");
  const starts = [...source.matchAll(/^\\s*#\\s*Student Profile\\s*$/gim)].map((match) => match.index);
  const chunks = starts.length > 1
    ? starts.map((start, index) => source.slice(start, starts[index + 1] ?? source.length).trim()).filter(Boolean)
    : [source];
  const profiles = chunks.map((chunk) => parseNectaStudentProfile(chunk));
  const missingPrem = profiles.filter((profile) => !profile.prem_number).length;
  if (missingPrem) throw new Error(`${missingPrem} profile(s) have no PREM Number. Each profile must include its PREM Number.`);
  const seen = new Set();
  const duplicates = new Set();
  for (const profile of profiles) {
    if (seen.has(profile.prem_number)) duplicates.add(profile.prem_number);
    seen.add(profile.prem_number);
  }
  return { profiles, duplicate_prem_numbers: [...duplicates], profile_count: profiles.length };
}
