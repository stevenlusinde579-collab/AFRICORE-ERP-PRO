begin;

create table if not exists public.necta_student_records (
    id bigserial primary key,
    student_id bigint not null references public.students(id) on delete cascade,
    school_id bigint not null references public.schools(id) on delete cascade,
    prem_number text,
    exam_number text,
    exam_year integer,
    registration_type text,
    form text,
    stream_trade text,
    field text,
    trade text,
    is_repeater boolean,
    citizenship text,
    parenting_status text,
    health_status_category text,
    accommodation text,
    birth_certificate_no text,
    student_id_number text,
    distance_from_home numeric,
    address_line_1 text,
    address_line_2 text,
    address_line_3 text,
    physical_address text,
    place_of_domicile text,
    source_school_number text,
    source_school_name text,
    import_source text not null default 'NECTA_PReMS',
    created_at timestamptz not null default now(),
    constraint necta_student_records_student_school_unique unique (student_id, school_id)
);

create unique index if not exists necta_student_records_prem_school_unique
    on public.necta_student_records (school_id, prem_number)
    where prem_number is not null and btrim(prem_number) <> '';

create index if not exists necta_student_records_exam_lookup
    on public.necta_student_records (school_id, exam_number, exam_year)
    where exam_number is not null;

alter table public.necta_student_records enable row level security;

drop policy if exists necta_student_records_tenant_guard on public.necta_student_records;
create policy necta_student_records_tenant_guard
on public.necta_student_records
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

drop policy if exists necta_student_records_authenticated_access on public.necta_student_records;
create policy necta_student_records_authenticated_access
on public.necta_student_records
for all
to authenticated
using (true)
with check (true);

grant select, insert, update on public.necta_student_records to authenticated;
grant usage, select on sequence public.necta_student_records_id_seq to authenticated;

commit;
