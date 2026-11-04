-- Secure Headmaster replacement and reassignment.
-- Transactional: a school has at most one active Headmaster assignment.
-- Previous Headmasters lose the old school scope immediately.

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
    v_school record;
    v_has_active_roles boolean;
    v_previous record;
begin
    if p_profile_id is null or p_school_id is null or p_school_id <= 0 then
        raise exception 'A valid Headmaster profile and school are required.';
    end if;

    select s.id, s.school_name, s.is_active
      into v_school
      from public.schools s
     where s.id = p_school_id
     for update;

    if not found then
        raise exception 'The selected school was not found.';
    end if;
    if v_school.is_active is distinct from true then
        raise exception 'The selected school is inactive.';
    end if;

    select r.id into v_headmaster_role_id
      from public.roles r
     where lower(trim(r.role_name)) = 'headmaster'
     order by r.id limit 1;
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

    select exists (
        select 1 from public.profile_roles pr
         where pr.profile_id = p_profile_id and pr.is_active is true
    ) into v_has_active_roles;

    if v_has_active_roles then
        if not exists (
            select 1 from public.profile_roles pr
             where pr.profile_id = p_profile_id
               and pr.role_id = v_headmaster_role_id
               and pr.is_active is true
        ) then
            raise exception 'The selected account does not have an active Headmaster role.';
        end if;
    elsif coalesce(v_profile.role_id, 0) <> v_headmaster_role_id then
        raise exception 'The selected account does not have an active Headmaster role.';
    end if;

    -- Revoke Headmaster assignments currently attached to the destination.
    for v_previous in
        select distinct pr.profile_id
          from public.profile_roles pr
         where pr.role_id = v_headmaster_role_id
           and pr.school_id = p_school_id
           and pr.is_active is true
           and pr.profile_id <> p_profile_id
    loop
        update public.profile_roles
           set is_active = false, is_primary = false
         where profile_id = v_previous.profile_id
           and role_id = v_headmaster_role_id
           and school_id = p_school_id
           and is_active is true;

        -- Re-elect a primary role for any remaining roles.
        update public.profile_roles pr
           set is_primary = true
         where pr.id = (
             select candidate.id
               from public.profile_roles candidate
              where candidate.profile_id = v_previous.profile_id
                and candidate.is_active is true
              order by candidate.is_primary desc, candidate.id
              limit 1
         );

        -- Legacy role_id is only a fallback when no active profile_roles exist.
        update public.profiles p
           set role_id = (
                   select pr.role_id from public.profile_roles pr
                    where pr.profile_id = p.id and pr.is_active is true
                    order by pr.is_primary desc, pr.id limit 1
               ),
               school_id = (
                   select pr.school_id from public.profile_roles pr
                    where pr.profile_id = p.id and pr.is_active is true
                    order by pr.is_primary desc, pr.id limit 1
               )
         where p.id = v_previous.profile_id;
    end loop;

    -- Also revoke legacy-only Headmaster accounts that have no profile_roles row.
    -- Keep any other active role and its school as the user's effective profile.
    update public.profiles p
       set role_id = (
               select pr.role_id from public.profile_roles pr
                where pr.profile_id = p.id and pr.is_active is true
                order by pr.is_primary desc, pr.id limit 1
           ),
           school_id = (
               select pr.school_id from public.profile_roles pr
                where pr.profile_id = p.id and pr.is_active is true
                order by pr.is_primary desc, pr.id limit 1
           )
     where p.role_id = v_headmaster_role_id
       and p.school_id = p_school_id
       and p.id <> p_profile_id;

    -- Move all active Headmaster role rows for the selected account.
    update public.profile_roles
       set school_id = p_school_id, is_primary = true
     where profile_id = p_profile_id
       and role_id = v_headmaster_role_id
       and is_active is true;

    update public.profiles
       set school_id = p_school_id, role_id = v_headmaster_role_id
     where id = p_profile_id;

    return jsonb_build_object(
        'id', v_profile.id,
        'full_name', coalesce(v_profile.full_name, 'Headmaster'),
        'phone', v_profile.phone,
        'school_id', p_school_id,
        'school_name', v_school.school_name
    );
end;
$function$;

revoke all on function public.assign_headmaster_to_school(uuid, bigint) from public;
revoke all on function public.assign_headmaster_to_school(uuid, bigint) from anon;
revoke all on function public.assign_headmaster_to_school(uuid, bigint) from authenticated;
grant execute on function public.assign_headmaster_to_school(uuid, bigint) to service_role;
