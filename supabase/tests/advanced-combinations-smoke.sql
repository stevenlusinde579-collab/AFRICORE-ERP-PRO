\set ON_ERROR_STOP on

-- Run against a disposable PostgreSQL instance only.
BEGIN;

-- The migration should install both tables and the student guard.
\i supabase/migrations/20261012120000_advanced_subject_combinations.sql

DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n
  FROM public.subject_combinations
  WHERE school_id IS NULL AND is_system_default = true;

  IF n <> 13 THEN
    RAISE EXCEPTION 'Expected 13 system templates; found %', n;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='students' AND column_name='combination_id'
  ) THEN
    RAISE EXCEPTION 'students.combination_id was not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname='trg_validate_student_advanced_combination'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Student combination validation trigger is missing';
  END IF;
END
$$;

-- Global system templates must be usable by any school's Advanced class.
INSERT INTO public.students (school_id, current_class_id, combination_id)
SELECT 2, 2, id
FROM public.subject_combinations
WHERE school_id IS NULL
  AND is_system_default = true
  AND combination_code = 'PCM';

DO $body$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.subject_combinations c ON c.id = s.combination_id
    WHERE s.school_id = 2
      AND s.current_class_id = 2
      AND c.school_id IS NULL
      AND c.combination_code = 'PCM'
  ) THEN
    RAISE EXCEPTION 'Global PCM template could not be assigned to another school';
  END IF;
END
$body$;

-- A valid school-owned combination can be assigned to an Advanced class.
INSERT INTO public.subject_combinations
  (school_id, combination_code, combination_name, is_system_default)
VALUES (1, 'TST', 'Disposable test combination', false);

INSERT INTO public.combination_subjects (combination_id, subject_id)
SELECT id, 1 FROM public.subject_combinations
WHERE school_id=1 AND combination_code='TST';

INSERT INTO public.students (school_id, current_class_id, combination_id)
SELECT 1, 1, id FROM public.subject_combinations
WHERE school_id=1 AND combination_code='TST';

-- Cross-school assignment must fail.
DO $$
DECLARE
  combo_id bigint;
BEGIN
  SELECT id INTO combo_id FROM public.subject_combinations
  WHERE school_id=1 AND combination_code='TST';

  BEGIN
    INSERT INTO public.students (school_id, current_class_id, combination_id)
    VALUES (2, 2, combo_id);
    RAISE EXCEPTION 'TEST FAILURE: cross-school assignment unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'TEST FAILURE:%' THEN RAISE; END IF;
  END;
END
$$;

-- Non-Advanced class assignment must fail.
DO $$
DECLARE
  combo_id bigint;
BEGIN
  SELECT id INTO combo_id FROM public.subject_combinations
  WHERE school_id=1 AND combination_code='TST';

  BEGIN
    INSERT INTO public.students (school_id, current_class_id, combination_id)
    VALUES (1, 3, combo_id);
    RAISE EXCEPTION 'TEST FAILURE: non-Advanced assignment unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'TEST FAILURE:%' THEN RAISE; END IF;
  END;
END
$$;

-- Inactive combination assignment must fail.
UPDATE public.subject_combinations
SET is_active=false
WHERE school_id=1 AND combination_code='TST';

DO $$
DECLARE
  combo_id bigint;
BEGIN
  SELECT id INTO combo_id FROM public.subject_combinations
  WHERE school_id=1 AND combination_code='TST';

  BEGIN
    INSERT INTO public.students (school_id, current_class_id, combination_id)
    VALUES (1, 1, combo_id);
    RAISE EXCEPTION 'TEST FAILURE: inactive assignment unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'TEST FAILURE:%' THEN RAISE; END IF;
  END;
END
$$;

ROLLBACK;
