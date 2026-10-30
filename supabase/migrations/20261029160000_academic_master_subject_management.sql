begin;

-- Subjects is a shared curriculum catalogue (the table has no school_id).
-- Academic Masters may create and update catalogue entries, but may not delete.
-- Resolve active profile_roles first, with legacy profiles.role_id fallback.
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

drop policy if exists af_score_subjects_academic_master_insert on public.subjects;
create policy af_score_subjects_academic_master_insert
on public.subjects
for insert
to authenticated
with check (
    public.is_current_user_super_admin()
    or public.is_current_user_academic_master()
);

drop policy if exists af_score_subjects_academic_master_update on public.subjects;
create policy af_score_subjects_academic_master_update
on public.subjects
for update
to authenticated
using (
    public.is_current_user_super_admin()
    or public.is_current_user_academic_master()
)
with check (
    public.is_current_user_super_admin()
    or public.is_current_user_academic_master()
);

commit;
