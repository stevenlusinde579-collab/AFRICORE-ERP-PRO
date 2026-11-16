-- Persistent, revocable sessions for Parent and Sponsor Portal.
-- Session tokens are opaque random values; only SHA-256 hashes are stored.
create table if not exists public.portal_sessions (
  id uuid primary key default gen_random_uuid(),
  account_type text not null check (account_type in ('parent','sponsor')),
  account_id uuid not null,
  school_id bigint not null references public.schools(id) on delete cascade,
  student_id bigint null references public.students(id) on delete cascade,
  center_id uuid null references public.sponsor_centers(id) on delete cascade,
  token_hash text not null unique,
  user_agent text null,
  ip_address inet null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz null,
  constraint portal_sessions_account_scope_check check (
    (account_type = 'parent' and student_id is not null and center_id is null)
    or (account_type = 'sponsor' and center_id is not null)
  )
);

create index if not exists portal_sessions_account_active_idx
  on public.portal_sessions(account_type, account_id) where revoked_at is null;
create index if not exists portal_sessions_school_active_idx
  on public.portal_sessions(school_id) where revoked_at is null;

alter table public.portal_sessions enable row level security;
revoke all on public.portal_sessions from anon, authenticated;
grant all on public.portal_sessions to service_role;

create or replace function public.revoke_portal_sessions_on_account_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.password_hash is distinct from old.password_hash)
     or (new.password_salt is distinct from old.password_salt)
     or (old.is_active is true and new.is_active is false) then
    update public.portal_sessions
       set revoked_at = coalesce(revoked_at, now())
     where account_type = tg_argv[0]
       and account_id = new.id
       and revoked_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists parent_portal_revoke_sessions_on_change on public.parent_portal_accounts;
create trigger parent_portal_revoke_sessions_on_change
after update of password_hash, password_salt, is_active on public.parent_portal_accounts
for each row execute function public.revoke_portal_sessions_on_account_change('parent');

drop trigger if exists sponsor_portal_revoke_sessions_on_change on public.sponsor_portal_accounts;
create trigger sponsor_portal_revoke_sessions_on_change
after update of password_hash, password_salt, is_active on public.sponsor_portal_accounts
for each row execute function public.revoke_portal_sessions_on_account_change('sponsor');

create or replace function public.revoke_portal_sessions_on_school_deactivation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_active is true and new.is_active is false then
    update public.portal_sessions set revoked_at = coalesce(revoked_at, now())
     where school_id = new.id and revoked_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists schools_revoke_portal_sessions_on_deactivation on public.schools;
create trigger schools_revoke_portal_sessions_on_deactivation
after update of is_active on public.schools
for each row execute function public.revoke_portal_sessions_on_school_deactivation();

create or replace function public.revoke_portal_sessions_on_sponsor_center_deactivation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_active is true and new.is_active is false then
    update public.portal_sessions set revoked_at = coalesce(revoked_at, now())
     where account_type = 'sponsor' and center_id = new.id and revoked_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists sponsor_centers_revoke_portal_sessions_on_deactivation on public.sponsor_centers;
create trigger sponsor_centers_revoke_portal_sessions_on_deactivation
after update of is_active on public.sponsor_centers
for each row execute function public.revoke_portal_sessions_on_sponsor_center_deactivation();

create or replace function public.revoke_portal_sessions_on_student_deactivation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.status, 'active')) = 'inactive'
     and lower(coalesce(old.status, 'active')) <> 'inactive' then
    update public.portal_sessions set revoked_at = coalesce(revoked_at, now())
     where student_id = new.id and school_id = new.school_id and revoked_at is null;
  end if;
  return new;
end;
$$;
revoke all on function public.revoke_portal_sessions_on_student_deactivation() from public, anon, authenticated;
drop trigger if exists students_revoke_portal_sessions_on_deactivation on public.students;
create trigger students_revoke_portal_sessions_on_deactivation
after update of status on public.students
for each row execute function public.revoke_portal_sessions_on_student_deactivation();

create or replace function public.revoke_sponsor_portal_sessions_on_assignment_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.portal_sessions set revoked_at = coalesce(revoked_at, now())
   where account_type = 'sponsor'
     and school_id = old.school_id
     and center_id = old.center_id
     and student_id = old.student_id
     and revoked_at is null;
  return old;
end;
$$;
revoke all on function public.revoke_sponsor_portal_sessions_on_assignment_removal() from public, anon, authenticated;
drop trigger if exists sponsor_assignments_revoke_portal_sessions_on_delete on public.sponsor_center_students;
create trigger sponsor_assignments_revoke_portal_sessions_on_delete
after delete on public.sponsor_center_students
for each row execute function public.revoke_sponsor_portal_sessions_on_assignment_removal();

revoke all on function public.revoke_portal_sessions_on_account_change() from public, anon, authenticated;
revoke all on function public.revoke_portal_sessions_on_school_deactivation() from public, anon, authenticated;
revoke all on function public.revoke_portal_sessions_on_sponsor_center_deactivation() from public, anon, authenticated;
