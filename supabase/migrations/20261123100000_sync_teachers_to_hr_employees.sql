-- Keep teacher records available to HR workflows through the canonical employees table.
-- The source teacher id is nullable so non-teaching employees remain supported.

alter table public.employees
  add column if not exists source_teacher_id bigint;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'employees_source_teacher_id_fkey'
      and conrelid = 'public.employees'::regclass
  ) then
    alter table public.employees
      add constraint employees_source_teacher_id_fkey
      foreign key (source_teacher_id) references public.teachers(id)
      on delete set null;
  end if;
end $$;

create unique index if not exists employees_school_source_teacher_uidx
  on public.employees (school_id, source_teacher_id)
  where source_teacher_id is not null;

-- Link existing employee rows by the school's unique employee number first.
update public.employees e
set source_teacher_id = t.id
from public.teachers t
where t.school_id = e.school_id
  and t.employee_number = e.employee_number
  and e.source_teacher_id is null
  and not exists (
    select 1 from public.employees linked
    where linked.school_id = t.school_id
      and linked.source_teacher_id = t.id
  );

-- Create missing HR employee rows for teachers. The unique school/employee number
-- constraint makes this safe to rerun and prevents duplicate employee records.
insert into public.employees (
  school_id, employee_number, first_name, middle_name, last_name,
  gender, phone, email, employee_type, department, position,
  employment_date, status, user_id, source_teacher_id
)
select
  t.school_id,
  t.employee_number,
  t.first_name,
  t.middle_name,
  t.last_name,
  t.gender,
  t.phone,
  t.email,
  coalesce(nullif(t.staff_type, ''), 'staff'),
  t.staff_type,
  t.specialization,
  t.employment_date,
  case
    when lower(trim(coalesce(t.status, ''))) in ('inactive','disabled','terminated','left','resigned','retired') then 'inactive'
    when lower(trim(coalesce(t.status, ''))) in ('active','enabled','working') then 'active'
    else 'inactive'
  end,
  t.user_id,
  t.id
from public.teachers t
where t.school_id is not null
  and not exists (
    select 1 from public.employees e
    where e.school_id = t.school_id
      and e.employee_number = t.employee_number
  )
  and not exists (
    select 1 from public.employees e
    where e.school_id = t.school_id
      and e.source_teacher_id = t.id
  );

-- Keep mirrored HR data current when teacher details/status are edited.
create or replace function public.sync_teacher_to_hr_employee()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.school_id is null then
    return new;
  end if;

  update public.employees e
  set employee_number = new.employee_number,
      first_name = new.first_name,
      middle_name = new.middle_name,
      last_name = new.last_name,
      gender = new.gender,
      phone = new.phone,
      email = new.email,
      employee_type = coalesce(nullif(new.staff_type, ''), 'staff'),
      department = new.staff_type,
      position = new.specialization,
      employment_date = new.employment_date,
      status = case
        when lower(trim(coalesce(new.status, ''))) in ('active','enabled','working') then 'active'
        else 'inactive'
      end,
      user_id = coalesce(e.user_id, new.user_id),
      source_teacher_id = new.id
  where e.school_id = new.school_id
    and (e.source_teacher_id = new.id or e.employee_number = new.employee_number);

  if not found then
    insert into public.employees (
      school_id, employee_number, first_name, middle_name, last_name,
      gender, phone, email, employee_type, department, position,
      employment_date, status, user_id, source_teacher_id
    ) values (
      new.school_id, new.employee_number, new.first_name, new.middle_name, new.last_name,
      new.gender, new.phone, new.email, coalesce(nullif(new.staff_type, ''), 'staff'),
      new.staff_type, new.specialization, new.employment_date,
      case
        when lower(trim(coalesce(new.status, ''))) in ('active','enabled','working') then 'active'
        else 'inactive'
      end,
      new.user_id, new.id
    )
    on conflict (school_id, employee_number) do update
      set source_teacher_id = coalesce(public.employees.source_teacher_id, excluded.source_teacher_id),
          first_name = excluded.first_name,
          middle_name = excluded.middle_name,
          last_name = excluded.last_name,
          gender = excluded.gender,
          phone = excluded.phone,
          email = excluded.email,
          department = excluded.department,
          position = excluded.position,
          employment_date = excluded.employment_date,
          status = excluded.status;
  end if;

  return new;
end;
$$;

drop trigger if exists teachers_sync_hr_employee on public.teachers;
create trigger teachers_sync_hr_employee
after insert or update of school_id, employee_number, first_name, middle_name, last_name,
  gender, phone, email, staff_type, specialization, employment_date, status, user_id
on public.teachers
for each row execute function public.sync_teacher_to_hr_employee();
