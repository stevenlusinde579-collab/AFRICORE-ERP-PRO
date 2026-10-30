begin;
create or replace function public.is_current_user_academic_master_for_school(target_school_id bigint)
returns boolean language sql stable security definer set search_path = public, pg_temp as $function$
select exists (
 select 1 from public.profile_roles pr join public.roles r on r.id = pr.role_id
 where pr.profile_id = auth.uid() and pr.is_active is true
 and lower(trim(r.role_name)) = 'academic master' and pr.school_id = target_school_id
) or (
 not exists (select 1 from public.profile_roles pr where pr.profile_id = auth.uid() and pr.is_active is true)
 and exists (select 1 from public.profiles p join public.roles r on r.id = p.role_id
 where p.id = auth.uid() and lower(trim(r.role_name)) = 'academic master' and p.school_id = target_school_id)
);
$function$;
revoke all on function public.is_current_user_academic_master_for_school(bigint) from public;
revoke all on function public.is_current_user_academic_master_for_school(bigint) from anon;
grant execute on function public.is_current_user_academic_master_for_school(bigint) to authenticated;
grant execute on function public.is_current_user_academic_master_for_school(bigint) to service_role;
drop policy if exists af_score_tenant_guard on public.class_timetables;
create policy af_score_tenant_guard on public.class_timetables for all to authenticated
using (public.is_current_user_super_admin() or school_id = public.get_current_user_school_id() or public.is_current_user_academic_master_for_school(school_id))
with check (public.is_current_user_super_admin() or school_id = public.get_current_user_school_id() or public.is_current_user_academic_master_for_school(school_id));
commit;