-- Make Super Admin-created Headmasters part of the normal Staff directory.
-- Keep the Auth profile as the source of login identity and link it to one
-- teachers row so existing staff counts, profiles and role editor can be reused.

begin;

alter table public.teachers
  add column if not exists is_headmaster boolean not null default false;

-- One login account maps to one Staff row. Existing data was checked for duplicates.
create unique index if not exists teachers_user_id_unique_idx
  on public.teachers(user_id) where user_id is not null;

-- Restore the Headmaster marker on staff records that are already linked.
update public.teachers t
   set is_headmaster = true,
       user_id = coalesce(t.user_id, p.id),
       school_id = coalesce(p.school_id, t.school_id),
       staff_type = 'Staff',
       status = 'Active',
       phone = coalesce(t.phone, p.phone)
  from public.profiles p
  left join auth.users u on u.id = p.id
 where (p.teacher_id = t.id or t.user_id = p.id)
   and (
     p.role_id = (select r.id from public.roles r where lower(trim(r.role_name)) = 'headmaster' order by r.id limit 1)
     or exists (
       select 1
         from public.profile_roles pr
         join public.roles r on r.id = pr.role_id
        where pr.profile_id = p.id
          and pr.is_active is true
          and lower(trim(r.role_name)) = 'headmaster'
          and pr.school_id = coalesce(t.school_id, p.school_id)
     )
   );

-- Backfill Headmaster accounts created by Super Admin that have no Staff row.
with headmaster_role as (
  select id from public.roles
   where lower(trim(role_name)) = 'headmaster'
   order by id limit 1
),
headmaster_profiles as (
  select distinct
         p.id as profile_id,
         p.full_name,
         p.phone,
         coalesce(pr.school_id, p.school_id) as school_id,
         p.teacher_id
    from public.profiles p
    left join public.profile_roles pr
      on pr.profile_id = p.id
     and pr.role_id = (select id from headmaster_role)
     and pr.is_active is true
   where coalesce(pr.school_id, p.school_id) is not null
     and (
       p.role_id = (select id from headmaster_role)
       or pr.profile_id is not null
     )
),
missing as (
  select hp.*,
         regexp_split_to_array(trim(coalesce(hp.full_name, 'Headmaster Account')), '\s+') as name_parts
    from headmaster_profiles hp
   where not exists (
     select 1 from public.teachers t
      where t.user_id = hp.profile_id
         or t.id = hp.teacher_id
   )
)
insert into public.teachers (
  school_id, employee_number, first_name, middle_name, last_name,
  phone, status, staff_type, user_id, is_headmaster
)
select
  m.school_id,
  'HM-' || m.school_id::text || '-' || replace(m.profile_id::text, '-', ''),
  coalesce(nullif(m.name_parts[1], ''), 'Headmaster'),
  case when cardinality(m.name_parts) > 2
       then array_to_string(m.name_parts[2:cardinality(m.name_parts)-1], ' ')
       else null end,
  case when cardinality(m.name_parts) > 1
       then m.name_parts[cardinality(m.name_parts)]
       else 'Account' end,
  m.phone,
  'Active',
  'Staff',
  m.profile_id,
  true
from missing m
left join auth.users u on u.id = m.profile_id
on conflict (user_id) where user_id is not null do nothing;

-- Link each Headmaster profile to the matching Staff row.
update public.profiles p
   set teacher_id = t.id
  from public.teachers t
 where t.user_id = p.id
   and p.teacher_id is distinct from t.id;

commit;
