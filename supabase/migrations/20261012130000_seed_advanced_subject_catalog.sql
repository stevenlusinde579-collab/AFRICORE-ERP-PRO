-- Seed the Tanzania Advanced Secondary (Form V-VI) subject catalog.
-- Additive and idempotent: existing Nursery, Primary and Form I-IV subjects are untouched.
-- Subject names are based on NECTA ACSEE subject information and TIE Form V-VI syllabi.

WITH advanced_catalog(subject_name, subject_code, is_compulsory) AS (
  VALUES
    ('General Studies', 'ADV-GS', true),
    ('History', 'ADV-HIST', false),
    ('Geography', 'ADV-GEO', false),
    ('Divinity', 'ADV-DIV', false),
    ('Islamic Knowledge', 'ADV-ISL', false),
    ('Fine Art', 'ADV-ART', false),
    ('Physical Education', 'ADV-PE', false),
    ('Kiswahili', 'ADV-KIS', false),
    ('English Language', 'ADV-ENG', false),
    ('French Language', 'ADV-FRE', false),
    ('Arabic Language', 'ADV-ARB', false),
    ('Chinese Language', 'ADV-CHN', false),
    ('Physics', 'ADV-PHY', false),
    ('Chemistry', 'ADV-CHEM', false),
    ('Biology', 'ADV-BIO', false),
    ('Agriculture', 'ADV-AGR', false),
    ('Computer Science', 'ADV-CS', false),
    ('Information and Computer Studies', 'ADV-ICS', false),
    ('Basic Applied Mathematics', 'ADV-BAM', false),
    ('Advanced Mathematics', 'ADV-AMATH', false),
    ('Economics', 'ADV-ECON', false),
    ('Commerce', 'ADV-COM', false),
    ('Accountancy', 'ADV-ACC', false),
    ('Food and Human Nutrition', 'ADV-FHN', false),
    ('Education', 'ADV-EDU', false),
    ('Literature in English', 'ADV-LIT', false),
    ('Music', 'ADV-MUSIC', false),
    ('Tourism', 'ADV-TOUR', false),
    ('Theatre Arts', 'ADV-THEATRE', false),
    ('Sport Studies', 'ADV-SPORT', false)
)
INSERT INTO public.subjects
  (curriculum_id, subject_name, subject_code, education_level, is_compulsory, is_active, class_scope)
SELECT
  1,
  catalog.subject_name,
  catalog.subject_code,
  'Advanced',
  catalog.is_compulsory,
  true,
  'Form 5-6'
FROM advanced_catalog catalog
WHERE NOT EXISTS (
  SELECT 1
  FROM public.subjects existing
  WHERE lower(trim(existing.education_level)) = 'advanced'
    AND lower(trim(existing.subject_name)) = lower(trim(catalog.subject_name))
);

-- Keep the KLF template label aligned with the official subject name so the
-- template picker can preselect the subject without requiring manual matching.
UPDATE public.subject_combinations
SET suggested_subjects = array_replace(suggested_subjects, 'French', 'French Language')
WHERE school_id IS NULL
  AND is_system_default = true
  AND combination_code = 'KLF'
  AND 'French' = ANY(suggested_subjects);

-- Populate reusable mappings for the global templates. School-specific copies
-- and custom combinations remain managed by each school.
INSERT INTO public.combination_subjects (combination_id, subject_id)
SELECT c.id, s.id
FROM public.subject_combinations c
CROSS JOIN LATERAL unnest(c.suggested_subjects) AS suggestion(subject_name)
JOIN public.subjects s
  ON lower(trim(s.subject_name)) = lower(trim(suggestion.subject_name))
 AND lower(trim(s.education_level)) = 'advanced'
WHERE c.school_id IS NULL
  AND c.is_system_default = true
ON CONFLICT (combination_id, subject_id) DO NOTHING;
