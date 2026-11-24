-- Separate read access to transport finance from general transport operations.
insert into public.permissions (module, permission_name, description, is_active, module_name, action_name)
select 'transport', 'view_transport_finance',
       'View transport income, expenses and HR review records.', true,
       'Transport Finance', 'view'
where not exists (
  select 1 from public.permissions where permission_name = 'view_transport_finance'
);

-- Accountant prepares transactions; HR Manager reviews them; Super Admin retains full oversight.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where lower(trim(r.role_name)) = 'super admin'
  and p.permission_name in ('view_transport_finance','manage_transport','manage_transport_finance','approve_transport_finance')
  and not exists (
    select 1 from public.role_permissions rp
    where rp.role_id = r.id and rp.permission_id = p.id
  );

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.permission_name = 'view_transport_finance'
where lower(trim(r.role_name)) in ('accountant','hr manager')
  and not exists (
    select 1 from public.role_permissions rp
    where rp.role_id = r.id and rp.permission_id = p.id
  );
