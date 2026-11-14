-- Rule-Based analysis may legitimately be unable to infer a question's
-- maximum marks from the paper. The existing CHECK constraint explicitly
-- permits NULL, but the column's NOT NULL constraint and DEFAULT 0 made that
-- state impossible to persist.
--
-- Keep the CHECK constraint: every supplied numeric mark must remain > 0.
-- Gemini continues to submit its normal positive numeric marks; no AI prompt,
-- provider call, parsing, or Gemini-specific validation is changed.
ALTER TABLE public.exam_questions
  ALTER COLUMN max_marks DROP NOT NULL,
  ALTER COLUMN max_marks DROP DEFAULT;

COMMENT ON COLUMN public.exam_questions.max_marks IS
  'Maximum question marks. NULL means marks have not yet been confirmed; non-NULL values must be greater than zero.';
