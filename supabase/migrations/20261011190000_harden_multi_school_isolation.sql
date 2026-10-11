begin;

-- Canonical Super Admin check: use active profile_roles first and retain
-- profiles.role_id only for legacy profiles that have no active role rows.
create or replace function public.is_current_user_super_admin()
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
              and lower(trim(r.role_name)) = 'super admin'
        )
        else exists (
            select 1
            from public.profiles p
            where p.id = auth.uid()
              and p.role_id = 1
        )
    end;
$function$;

create or replace function public.get_current_user_school_id()
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
    select p.school_id
    from public.profiles p
    where p.id = auth.uid()
    limit 1;
$function$;

-- Restrict profile tenant and role changes to the Super Admin.
create or replace function public.protect_profile_tenant_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
    if auth.uid() is not null
       and not public.is_current_user_super_admin()
       and (
           new.role_id is distinct from old.role_id
           or new.school_id is distinct from old.school_id
           or new.teacher_id is distinct from old.teacher_id
           or new.employee_id is distinct from old.employee_id
       )
    then
        raise exception 'Only Super Admin can change profile role or school assignments.'
            using errcode = '42501';
    end if;

    return new;
end;
$function$;

drop trigger if exists af_score_protect_profile_tenant_fields on public.profiles;
create trigger af_score_protect_profile_tenant_fields
before update on public.profiles
for each row
execute function public.protect_profile_tenant_fields();

-- Preserve access to a user's own profile, but prevent a profile from being
-- reassigned to another tenant through a direct authenticated update.
drop policy if exists af_score_tenant_guard on public.profiles;
create policy af_score_tenant_guard
on public.profiles
as restrictive
for all
to authenticated
using (
    public.is_current_user_super_admin()
    or school_id = public.get_current_user_school_id()
    or id = auth.uid()
)
with check (
    public.is_current_user_super_admin()
    or school_id is not distinct from public.get_current_user_school_id()
);

-- School list visibility follows the canonical Super Admin check.
drop policy if exists schools_authenticated_select on public.schools;
create policy schools_authenticated_select
on public.schools
for select
to authenticated
using (
    public.is_current_user_super_admin()
    or id = public.get_current_user_school_id()
);

-- Remove legacy PUBLIC teacher policies. The restrictive tenant guard remains.
drop policy if exists "Allow delete teachers" on public.teachers;
drop policy if exists "Allow insert teachers" on public.teachers;
drop policy if exists "Allow select teachers" on public.teachers;
drop policy if exists "Allow update teachers" on public.teachers;
drop policy if exists af_score_teachers_authenticated_base on public.teachers;
create policy af_score_teachers_authenticated_base
on public.teachers
for all
to authenticated
using (true)
with check (true);

-- Teacher assignments must be authenticated and restricted to the assigned school.
drop policy if exists "Allow teacher assignments" on public.teacher_assignments;
drop policy if exists af_score_teacher_assignments_authenticated_base on public.teacher_assignments;
drop policy if exists af_score_teacher_assignments_tenant_guard on public.teacher_assignments;
create policy af_score_teacher_assignments_authenticated_base
on public.teacher_assignments
for all
to authenticated
using (true)
with check (true);
create policy af_score_teacher_assignments_tenant_guard
on public.teacher_assignments
as restrictive
for all
to authenticated
using (
    public.is_current_user_super_admin()
    or school_id = public.get_current_user_school_id()
)
with check (
    public.is_current_user_super_admin()
    or school_id = public.get_current_user_school_id()
);

-- Timetable settings must be authenticated and restricted to the assigned school.
drop policy if exists "Allow delete timetable settings" on public.timetable_settings;
drop policy if exists "Allow insert timetable settings" on public.timetable_settings;
drop policy if exists "Allow select timetable settings" on public.timetable_settings;
drop policy if exists "Allow update timetable settings" on public.timetable_settings;
drop policy if exists af_score_timetable_settings_authenticated_base on public.timetable_settings;
drop policy if exists af_score_timetable_settings_tenant_guard on public.timetable_settings;
create policy af_score_timetable_settings_authenticated_base
on public.timetable_settings
for all
to authenticated
using (true)
with check (true);
create policy af_score_timetable_settings_tenant_guard
on public.timetable_settings
as restrictive
for all
to authenticated
using (
    public.is_current_user_super_admin()
    or school_id = public.get_current_user_school_id()
)
with check (
    public.is_current_user_super_admin()
    or school_id = public.get_current_user_school_id()
);

-- Periods are school-owned; remove anonymous/global reads.
drop policy if exists "Enable read access for periods" on public.periods;
drop policy if exists af_score_periods_authenticated_select on public.periods;
drop policy if exists af_score_periods_tenant_guard on public.periods;
create policy af_score_periods_authenticated_select
on public.periods
for select
to authenticated
using (true);
create policy af_score_periods_tenant_guard
on public.periods
as restrictive
for select
to authenticated
using (
    public.is_current_user_super_admin()
    or school_id = public.get_current_user_school_id()
);

-- Update profile and profile_roles assignment together in one transaction.
create or replace function public.assign_headmaster_to_school(
    p_profile_id uuid,
    p_school_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
    v_headmaster_role_id bigint;
    v_profile record;
begin
    if p_profile_id is null or p_school_id is null or p_school_id <= 0 then
        raise exception 'A valid Headmaster profile and school are required.';
    end if;

    if not exists (
        select 1 from public.schools s where s.id = p_school_id
    ) then
        raise exception 'The selected school was not found.';
    end if;

    select r.id
      into v_headmaster_role_id
      from public.roles r
     where lower(trim(r.role_name)) = 'headmaster'
     order by r.id
     limit 1;

    if v_headmaster_role_id is null then
        raise exception 'The Headmaster role is not configured.';
    end if;

    select p.id, p.full_name, p.phone, p.role_id, p.school_id
      into v_profile
      from public.profiles p
     where p.id = p_profile_id
     for update;

    if not found then
        raise exception 'The selected Headmaster account was not found.';
    end if;

    if not (
        coalesce(v_profile.role_id, 0) = v_headmaster_role_id
        or exists (
            select 1
            from public.profile_roles pr
            where pr.profile_id = p_profile_id
              and pr.role_id = v_headmaster_role_id
              and pr.is_active is true
        )
    ) then
        raise exception 'The selected account does not have an active Headmaster role.';
    end if;

    update public.profiles
       set school_id = p_school_id
     where id = p_profile_id;

    update public.profile_roles
       set school_id = p_school_id
     where profile_id = p_profile_id
       and role_id = v_headmaster_role_id
       and is_active is true;

    return jsonb_build_object(
        'id', v_profile.id,
        'full_name', coalesce(v_profile.full_name, 'Headmaster'),
        'phone', v_profile.phone,
        'school_id', p_school_id
    );
end;
$function$;

revoke all on function public.assign_headmaster_to_school(uuid, bigint) from public;
revoke all on function public.assign_headmaster_to_school(uuid, bigint) from anon;
revoke all on function public.assign_headmaster_to_school(uuid, bigint) from authenticated;
grant execute on function public.assign_headmaster_to_school(uuid, bigint) to service_role;

-- The RLS helpers must be executable by authenticated policies, but not anonymous users.
revoke all on function public.is_current_user_super_admin() from public;
revoke all on function public.is_current_user_super_admin() from anon;
grant execute on function public.is_current_user_super_admin() to authenticated;
grant execute on function public.is_current_user_super_admin() to service_role;
revoke all on function public.get_current_user_school_id() from public;
revoke all on function public.get_current_user_school_id() from anon;
grant execute on function public.get_current_user_school_id() to authenticated;
grant execute on function public.get_current_user_school_id() to service_role;

revoke all on function public.protect_profile_tenant_fields() from public;
revoke all on function public.protect_profile_tenant_fields() from anon;
revoke all on function public.protect_profile_tenant_fields() from authenticated;

commit;
