-- Per-parent/sponsor read cursors for each Parent Portal section.
-- A separate row per account + student + section keeps notifications private
-- and prevents one parent/sponsor login from clearing another login's badges.
create table if not exists public.parent_portal_notification_reads (
  school_id bigint not null references public.schools(id) on delete cascade,
  student_id bigint not null,
  account_id uuid not null,
  section text not null check (section in ('reports','results','finance','communication','chat','attendance')),
  last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (school_id, student_id, account_id, section)
);

create index if not exists idx_parent_portal_notification_reads_account
  on public.parent_portal_notification_reads (school_id, student_id, account_id);

alter table public.parent_portal_notification_reads enable row level security;
revoke all on public.parent_portal_notification_reads from anon, authenticated;
grant all on public.parent_portal_notification_reads to service_role;
