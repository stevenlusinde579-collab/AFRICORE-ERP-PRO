begin;

-- Add tenant ownership without rewriting or deleting existing shared catalog rows.
alter table public.subjects
  add column if not exists school_id bigint null
  references public.schools(id) on delete cascade;

-- Resolve Academic Master permissions from active profile_roles first; support
-- legacy profiles.role_id only when the user has no active role assignments.
create or replace function public.is_current_user_academic_master()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select case
    when exists (
      select 1
      from public.profile_roles pr
      where pr.profile_id = auth.uid()
        and pr.is_active is true
    )
    then exists (
      select 1
      from public.profile_roles pr
      join public.roles r on r.id = pr.role_id
      where pr.profile_id = auth.uid()
        and pr.is_active is true
        and lower(trim(r.role_name)) = 'academic master'
    )
    else exists (
      select 1
      from public.profiles p
      join public.roles r on r.id = p.role_id
      where p.id = auth.uid()
        and lower(trim(r.role_name)) = 'academic master'
    )
  end;
$function$;

revoke all on function public.is_current_user_academic_master() from public;
revoke all on function public.is_current_user_academic_master() from anon;
grant execute on function public.is_current_user_academic_master() to authenticated;
grant execute on function public.is_current_user_academic_master() to service_role;

-- Replace the previous shared-catalog write policy. Existing school_id IS NULL
-- rows remain readable as reference subjects; newly created school subjects are
-- visible only to their own school (or the Super Admin).
drop policy if exists af_score_subjects_authenticated_read on public.subjects;
drop policy if exists af_score_subjects_superadmin_write on public.subjects;
drop policy if exists subjects_tenant_select on public.subjects;
drop policy if exists subjects_tenant_insert on public.subjects;
drop policy if exists subjects_tenant_update on public.subjects;
drop policy if exists subjects_tenant_delete on public.subjects;

create policy subjects_tenant_select
on public.subjects
for select
to authenticated
using (
  public.is_current_user_super_admin()
  or school_id is null
  or school_id = public.get_current_user_school_id()
);

create policy subjects_tenant_insert
on public.subjects
for insert
to authenticated
with check (
  public.is_current_user_super_admin()
  or (
    school_id is not null
    and school_id = public.get_current_user_school_id()
    and public.is_current_user_academic_master()
  )
);

create policy subjects_tenant_update
on public.subjects
for update
to authenticated
using (
  public.is_current_user_super_admin()
  or (
    school_id is not null
    and school_id = public.get_current_user_school_id()
    and public.is_current_user_academic_master()
  )
)
with check (
  public.is_current_user_super_admin()
  or (
    school_id is not null
    and school_id = public.get_current_user_school_id()
    and public.is_current_user_academic_master()
  )
);

create policy subjects_tenant_delete
on public.subjects
for delete
to authenticated
using (
  public.is_current_user_super_admin()
  or (
    school_id is not null
    and school_id = public.get_current_user_school_id()
    and public.is_current_user_academic_master()
  )
);

commit;
