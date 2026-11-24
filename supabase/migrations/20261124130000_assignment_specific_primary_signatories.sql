begin;

-- Keep the signer choice specific to a role and, where applicable, its class/subject assignment.
alter table public.hr_primary_signatories
  add column if not exists class_id bigint references public.classes(id) on delete restrict,
  add column if not exists subject_id bigint references public.subjects(id) on delete restrict;

alter table public.hr_primary_signatories
  add column if not exists assignment_key text
  generated always as (
    coalesce(class_id::text, '') || ':' || coalesce(subject_id::text, '')
  ) stored;

alter table public.hr_primary_signatories
  drop constraint if exists hr_primary_signatories_school_role_uidx;

create unique index if not exists hr_primary_signatories_school_role_assignment_uidx
  on public.hr_primary_signatories(school_id, role_id, assignment_key);

create index if not exists hr_primary_signatories_school_assignment_idx
  on public.hr_primary_signatories(school_id, class_id, subject_id);

commit;
