-- Rule-Based analysis may legitimately be unable to infer a question's
-- maximum marks from the paper. The CHECK constraint already permits NULL,
-- but the column's NOT NULL constraint prevented that state from being saved.
--
-- Preserve DEFAULT 0 for legacy insert paths and preserve the CHECK constraint:
-- every supplied numeric mark must remain > 0. Rule-Based inserts explicitly
-- write NULL only when teacher confirmation is required.
-- Gemini continues to submit normal positive numeric marks; no AI prompt,
-- provider call, parsing, or Gemini-specific validation is changed.
ALTER TABLE public.exam_questions
  ALTER COLUMN max_marks DROP NOT NULL;

COMMENT ON COLUMN public.exam_questions.max_marks IS
  'Maximum question marks. NULL means marks have not yet been confirmed; non-NULL values must be greater than zero.';
