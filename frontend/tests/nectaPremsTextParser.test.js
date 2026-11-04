import test from "node:test";
import assert from "node:assert/strict";
import { parseNectaQualifiedList, parseNectaStudentProfile, parseNectaStudentProfiles } from "../src/utils/nectaPremsTextParser.js";

test("parses a copied PReMS Qualified markdown table", () => {
  const source = `| Prem Number | Cert. Entry Number | Full Name | Sex | Status | Actions |
| --- | --- | --- | --- | --- | --- |
| 20190079473 | | ABIGAELI LUKA SKOINE | Female | active | |
| 20191597581 | | BELINDA DANIEL SAIDI | Female | active | |`;
  const result = parseNectaQualifiedList(source);
  assert.equal(result.row_count, 2);
  assert.equal(result.students[0].prem_number, "20190079473");
  assert.equal(result.students[0].first_name, "ABIGAELI");
  assert.equal(result.students[0].middle_name, "LUKA");
  assert.equal(result.students[0].last_name, "SKOINE");
  assert.equal(result.students[0].gender, "Female");
});

test("parses copied tab-separated Qualified rows and reports duplicates", () => {
  const source = ["Prem Number\tCert. Entry Number\tFull Name\tSex",
    "20190079473\t\tABIGAELI LUKA SKOINE\tFemale",
    "20190079473\t\tABIGAELI LUKA SKOINE\tFemale"].join("\n");
  const result = parseNectaQualifiedList(source);
  assert.equal(result.row_count, 2);
  assert.deepEqual(result.duplicate_prem_numbers, ["20190079473"]);
});

const profileBase = `# Student Profile
### ABIGAELI LUKA SKOINE
#### PREM# : 20190079473
- **Sex**Female
- **Date Of Birth**Oct 14, 2012
- **Admission Number**2612
- **Registration Date**Mar 12, 2026 08:47
- **Registration Type**Tanzania Mainland
### Details
Form : **Form I**
Status : **active**
School : **S1067-BISHOP ALPHA MEMORIAL SECONDARY SCHOOL**
Stream : **General Stream**
Field : **General**
Trade : **GN01-General**
Is Repeater : **NO**
Parenting Status : **Both Parents Alive**
Citizenship : **Tanzanian**
### Qualifications
Exam/Reference Number : **PS0701012-0046**
Exam/Reference Year : **2025**
### Guardian Information
National ID Number :
Full Name :
Sex : **Female**
Relationship :
Email :
Phone :
Occupation :
Address :
Physical Addres :
Education Level :
### Difficulties
Student's difficulties
No Difficulties
Student's disabilities
No Disabilities`;

test("parses profile data and preserves explicit no-difficulties state", () => {
  const result = parseNectaStudentProfile(profileBase);
  assert.equal(result.prem_number, "20190079473");
  assert.equal(result.full_name, "ABIGAELI LUKA SKOINE");
  assert.equal(result.admission_number, "2612");
  assert.equal(result.date_of_birth, "Oct 14, 2012");
  assert.equal(result.form, "Form I");
  assert.equal(result.exam_reference_number, "PS0701012-0046");
  assert.equal(result.exam_reference_year, "2025");
  assert.equal(result.condition.difficulties_status, "none");
  assert.equal(result.condition.disabilities_status, "none");
  assert.equal(result.guardian.full_name, "");
});

test("does not convert missing condition data into none", () => {
  const source = profileBase.slice(0, profileBase.indexOf("### Difficulties"));
  const result = parseNectaStudentProfile(source);
  assert.equal(result.condition.difficulties_status, "unknown");
  assert.equal(result.condition.disabilities_status, "unknown");
});

test("keeps recorded condition text distinct from no difficulties", () => {
  const source = profileBase.replace("No Difficulties", "Uses a hearing aid").replace("No Disabilities", "Hearing impairment");
  const result = parseNectaStudentProfile(source);
  assert.equal(result.condition.difficulties_status, "recorded");
  assert.equal(result.condition.disabilities_status, "recorded");
  assert.match(result.condition.difficulties, /hearing aid/i);
});


test("parses multiple pasted profiles and flags repeated PREM numbers", () => {
  const source = [profileBase, profileBase.replace("ABIGAELI LUKA SKOINE", "BELINDA DANIEL SAIDI")].join("\\n");
  const result = parseNectaStudentProfiles(source);
  assert.equal(result.profile_count, 2);
  assert.deepEqual(result.duplicate_prem_numbers, ["20190079473"]);
});
