-- Remove Teacher on Duty as a standalone account role.
-- The Teacher on Duty feature/module remains available through the normal
-- Headmaster, Deputy Headmaster, Academic Master, Subject Teacher and Class Teacher roles.
--
-- Role ID 13 was verified in production as "Teacher on Duty".
-- This removes only role assignments and role-to-permission links for that role;
-- it does not delete profiles, teacher records, duty schedules, incidents or module data.

begin;

do $$
declare
    v_role_name text;
begin
    select role_name
      into v_role_name
      from public.roles
     where id = 13;

    if v_role_name is not null and lower(trim(v_role_name)) <> 'teacher on duty' then
        raise exception 'Role ID 13 is %, not Teacher on Duty. Aborting.', v_role_name;
    end if;
end
$$;

delete from public.profile_roles
 where role_id = 13;

delete from public.role_permissions
 where role_id = 13;

delete from public.profiles
 where role_id = 13;

delete from public.roles
 where id = 13
   and lower(trim(role_name)) = 'teacher on duty';

commit;
