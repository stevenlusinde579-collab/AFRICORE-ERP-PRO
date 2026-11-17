# Examination Analysis Golden Dataset

This directory is reserved for representative examination fixtures used to measure Rule-Based V2 against trusted reference results.

## Trust levels

- **Historical AI baseline:** saved AI output used only to measure parity. It is not assumed correct.
- **Teacher verified:** an authorised teacher has checked every question boundary, subpart, printed mark, selection instruction, topic and question type. Only this level may be called golden data.

Do not set `teacher_verified: true` merely because Gemini returned a successful response.

## Required fixture fields

Each fixture should include:

- `fixture_id`, `education_level`, `subject`, `paper_year`
- `source_text`: selectable PDF text with page breaks and section headings preserved
- `reference.teacher_verified`
- `reference.questions[]`: section, printed question number, question type, marks, topic, sub-topic, Bloom level and selection fields
- `reference.selection_rules[]` and declared section/paper totals
- `verification_notes`: teacher-confirmed corrections and any ambiguous source material

## Safety rules

- Do not include student names, admission numbers, marks registers or other student personal data.
- Keep the original question text and its source page/line evidence.
- Distinguish marks printed on the paper from marks inferred by a previous AI engine.
- Record uncertain or unreadable items as unknown; do not manufacture a correct answer.
- Include Baby Class, Primary, O-Level, A-Level and Certificate/Diploma samples, including English and Kiswahili papers.

## Promotion rule

A fixture becomes golden only after teacher verification. Benchmark reports must show question detection, explicit-mark agreement, inferred-mark agreement, topic agreement, question-type agreement and selection-rule agreement separately.


## Real-paper regression coverage (November 2026)

The V2 parser has also been exercised against selectable-text extracts from the Business Studies Form One, Book-Keeping Form Three and Commerce Form Three examination papers. These are structural regression samples only; no teacher-verified answer or mark reference is claimed. Expected paper-level structures are 10 questions for Business Studies, 9 for Book-Keeping and 11 for Commerce, with section totals preserved independently. The Commerce Section C instruction to answer any two of three questions is checked as a selective group. Matching tables with A-I response options and two-column rows are included in parser regression tests.
