-- Immutable per-student copies of finance letters published to Parent/Sponsor Portal.
create table if not exists public.parent_portal_published_letters (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null references public.schools(id) on delete cascade,
  student_id bigint not null references public.students(id) on delete cascade,
  letter_type text not null check (letter_type in ('fee_reminder','annual_fee_guidance')),
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists parent_portal_published_letters_student_idx
  on public.parent_portal_published_letters(school_id, student_id, published_at desc);
create index if not exists parent_portal_published_letters_school_idx
  on public.parent_portal_published_letters(school_id, letter_type, published_at desc);
alter table public.parent_portal_published_letters enable row level security;
revoke all on public.parent_portal_published_letters from anon, authenticated;
grant all on public.parent_portal_published_letters to service_role;
