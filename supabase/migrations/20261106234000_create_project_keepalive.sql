-- Keep AfriCore ERP PRO's Free Plan project active with a harmless read-only API check.
-- This table contains no school, student, staff, financial, or other user data.
create table if not exists public.project_keepalive (
  id smallint primary key check (id = 1)
);

insert into public.project_keepalive (id)
values (1)
on conflict (id) do nothing;

alter table public.project_keepalive enable row level security;

revoke all on table public.project_keepalive from public, anon, authenticated;
grant select on table public.project_keepalive to anon;

drop policy if exists project_keepalive_anon_read
  on public.project_keepalive;

create policy project_keepalive_anon_read
  on public.project_keepalive
  for select
  to anon
  using (true);

comment on table public.project_keepalive is
  'Single-row, non-sensitive read-only endpoint for scheduled Supabase project activity checks.';
