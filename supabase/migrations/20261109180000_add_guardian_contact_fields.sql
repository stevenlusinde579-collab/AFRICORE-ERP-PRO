-- Add dedicated guardian contact details while preserving existing parent contacts.
alter table public.students
  add column if not exists guardian_name text,
  add column if not exists guardian_phone text;

comment on column public.students.guardian_name is
  'Primary guardian contact name for school communications.';
comment on column public.students.guardian_phone is
  'Primary guardian phone for school communications; parent_phone remains the fallback.';
