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
    region text,
    district text,
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
    or (
        school_id = public.get_current_user_school_id()
        and exists (
            select 1
            from public.students s
            where s.id = necta_student_records.student_id
              and s.school_id = necta_student_records.school_id
        )
    )
)
with check (
    public.is_current_user_super_admin()
    or (
        school_id = public.get_current_user_school_id()
        and exists (
            select 1
            from public.students s
            where s.id = necta_student_records.student_id
              and s.school_id = necta_student_records.school_id
        )
    )
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


-- Import one workbook as a single database transaction. If any student,
-- subject assignment, or NECTA record fails, PostgreSQL rolls back the whole call.
create or replace function public.import_necta_prems_students(
    p_school_id bigint,
    p_academic_year_id bigint,
    p_class_id bigint,
    p_combination_id bigint,
    p_subject_ids bigint[],
    p_students jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
    v_class public.classes%rowtype;
    v_subject_ids bigint[];
    v_combination_subject_ids bigint[];
    v_item jsonb;
    v_student_id bigint;
    v_student_ids bigint[] := array[]::bigint[];
    v_count integer := 0;
    v_exam_year integer;
begin
    if auth.uid() is null then
        raise exception 'Authentication is required.';
    end if;

    if p_school_id is null or p_academic_year_id is null or p_class_id is null then
        raise exception 'School, academic year and class are required.';
    end if;

    if jsonb_typeof(p_students) is distinct from 'array'
       or jsonb_array_length(p_students) < 1
       or jsonb_array_length(p_students) > 500 then
        raise exception 'Import must contain between 1 and 500 student rows.';
    end if;

    if p_subject_ids is null or cardinality(p_subject_ids) < 1 then
        raise exception 'At least one subject must be selected.';
    end if;

    -- Only school managers, Super Admins, or a Class Teacher assigned
    -- to this exact class may run the import.
    if not public.is_current_user_super_admin()
       and not public.is_current_user_school_manager_for_school(p_school_id)
       and not exists (
            select 1
            from public.profile_roles pr
            join public.roles r on r.id = pr.role_id
            join public.profiles p on p.id = pr.profile_id
            join public.teacher_assignments ta
              on ta.teacher_id = p.teacher_id
             and ta.school_id = p_school_id
             and ta.class_id = p_class_id
            where pr.profile_id = auth.uid()
              and pr.school_id = p_school_id
              and pr.is_active is true
              and lower(trim(r.role_name)) = 'class teacher'
       ) then
        raise exception 'You are not authorized to import students into this class.';
    end if;

    select *
      into v_class
      from public.classes
     where id = p_class_id
       and school_id = p_school_id
       and academic_year_id = p_academic_year_id
       and is_active is true;

    if not found then
        raise exception 'Selected class is not active in this school and academic year.';
    end if;

    if not exists (
        select 1 from public.academic_years ay
         where ay.id = p_academic_year_id
           and ay.school_id = p_school_id
    ) then
        raise exception 'Selected academic year does not belong to this school.';
    end if;

    select array_agg(x order by x)
      into v_subject_ids
      from (select distinct unnest(p_subject_ids) as x) ids;

    if cardinality(v_subject_ids) <> cardinality(p_subject_ids) then
        raise exception 'Duplicate subjects were selected.';
    end if;

    if (
        select count(*)
          from public.subjects s
         where s.id = any(v_subject_ids)
           and s.education_level = v_class.academic_level
           and s.is_active is true
    ) <> cardinality(v_subject_ids) then
        raise exception 'One or more subjects are inactive or do not match the class education level.';
    end if;

    if lower(trim(v_class.academic_level)) = 'advanced' then
        if p_combination_id is null or not exists (
            select 1 from public.subject_combinations sc
             where sc.id = p_combination_id
               and sc.school_id = p_school_id
               and sc.is_active is true
        ) then
            raise exception 'Select an active Advanced combination belonging to this school.';
        end if;

        select array_agg(cs.subject_id order by cs.subject_id)
          into v_combination_subject_ids
          from public.combination_subjects cs
         where cs.combination_id = p_combination_id;

        if v_combination_subject_ids is null
           or v_combination_subject_ids <> v_subject_ids then
            raise exception 'Selected subjects must exactly match the Advanced combination.';
        end if;
    elsif p_combination_id is not null then
        raise exception 'A subject combination may only be assigned to an Advanced class.';
    end if;

    for v_item in select value from jsonb_array_elements(p_students)
    loop
        if nullif(trim(v_item->>'first_name'), '') is null
           or nullif(trim(v_item->>'last_name'), '') is null
           or nullif(trim(v_item->>'admission_number'), '') is null then
            raise exception 'A student row is missing a required name or admission number.';
        end if;

        if lower(trim(coalesce(v_item->>'gender', ''))) not in ('male', 'female') then
            raise exception 'A student row has an invalid sex value.';
        end if;

        if nullif(v_item->>'exam_year', '') ~ '^\d{4}
 then
            v_exam_year := (v_item->>'exam_year')::integer;
        else
            v_exam_year := null;
        end if;

        insert into public.students (
            school_id, academic_year_id, current_class_id,
            admission_number, first_name, middle_name, last_name,
            gender, date_of_birth, admission_date,
            student_status, status, stream, combination_id
        ) values (
            p_school_id, p_academic_year_id, p_class_id,
            trim(v_item->>'admission_number'),
            trim(v_item->>'first_name'),
            nullif(trim(v_item->>'middle_name'), ''),
            trim(v_item->>'last_name'),
            initcap(lower(trim(v_item->>'gender'))),
            nullif(v_item->>'date_of_birth', '')::date,
            null,
            'Active', 'Active',
            nullif(trim(v_item->>'stream'), ''),
            case when lower(trim(v_class.academic_level)) = 'advanced'
                 then p_combination_id else null end
        )
        returning id into v_student_id;

        insert into public.student_subjects (
            student_id, subject_id, class_id, academic_year_id
        )
        select v_student_id, unnest(v_subject_ids), p_class_id, p_academic_year_id;

        insert into public.necta_student_records (
            student_id, school_id, exam_number, exam_year,
            registration_type, form, region, district, stream_trade,
            source_school_number, source_school_name, import_source
        ) values (
            v_student_id, p_school_id,
            nullif(trim(v_item->>'exam_number'), ''),
            v_exam_year,
            nullif(trim(v_item->>'registration_type'), ''),
            nullif(trim(v_item->>'form'), ''),
            nullif(trim(v_item->>'region'), ''),
            nullif(trim(v_item->>'district'), ''),
            nullif(trim(v_item->>'stream'), ''),
            nullif(trim(v_item->>'source_school_number'), ''),
            nullif(trim(v_item->>'source_school_name'), ''),
            'NECTA_PReMS'
        );

        v_student_ids := array_append(v_student_ids, v_student_id);
        v_count := v_count + 1;
    end loop;

    return jsonb_build_object(
        'imported_count', v_count,
        'student_ids', to_jsonb(v_student_ids)
    );
end;
$function$;

revoke all on function public.import_necta_prems_students(bigint, bigint, bigint, bigint, bigint[], jsonb) from public, anon;
grant execute on function public.import_necta_prems_students(bigint, bigint, bigint, bigint, bigint[], jsonb) to authenticated;

commit;
