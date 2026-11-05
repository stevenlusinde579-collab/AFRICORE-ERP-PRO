begin;

alter table public.necta_student_records
  add column if not exists guardian_details jsonb,
  add column if not exists condition_details jsonb,
  add column if not exists profile_details jsonb;

-- Only grant column-level UPDATE rights needed to enrich the row created
-- by the existing importer. Tenant RLS policies remain in force.
grant update (
  prem_number,
  stream_trade,
  field,
  trade,
  is_repeater,
  citizenship,
  parenting_status,
  health_status_category,
  accommodation,
  birth_certificate_no,
  student_id_number,
  distance_from_home,
  address_line_1,
  address_line_2,
  address_line_3,
  physical_address,
  place_of_domicile,
  source_school_number,
  source_school_name,
  guardian_details,
  condition_details,
  profile_details
) on public.necta_student_records to authenticated;

create or replace function public.import_necta_prems_profile_students(
  p_school_id bigint,
  p_academic_year_id bigint,
  p_class_id bigint,
  p_combination_id bigint,
  p_subject_ids bigint[],
  p_profile_students jsonb
)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_item jsonb;
  v_student_rows jsonb := '[]'::jsonb;
  v_result jsonb;
  v_student_id bigint;
  v_index integer := 0;
  v_count integer := 0;
  v_prem text;
  v_exam_year integer;
  v_school text;
  v_school_number text;
  v_destination_school_number text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if p_school_id is null then
    raise exception 'Destination school is required.';
  end if;

  select upper(substring(registration_number from '(S[0-9]+)'))
    into v_destination_school_number
    from public.schools
   where id = p_school_id;

  if v_destination_school_number is null then
    raise exception 'The destination school must have a valid NECTA school registration number before PReMS import.';
  end if;

  if p_profile_students is null
     or jsonb_typeof(p_profile_students) is distinct from 'array'
     or jsonb_array_length(p_profile_students) < 1
     or jsonb_array_length(p_profile_students) > 500 then
    raise exception 'Profile import must contain between 1 and 500 student rows.';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_profile_students) as rows(item)
     where jsonb_typeof(item) is distinct from 'object'
  ) then
    raise exception 'Each profile row must be a JSON object.';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_profile_students) as rows(item)
     group by regexp_replace(trim(coalesce(item->>'prem_number', '')), '[[:space:]]', '', 'g')
    having count(*) > 1
  ) then
    raise exception 'The pasted profiles contain duplicate PREM Numbers.';
  end if;

  for v_item in select value from jsonb_array_elements(p_profile_students)
  loop
    v_prem := regexp_replace(trim(coalesce(v_item->>'prem_number', '')), '[[:space:]]', '', 'g');
    if v_prem !~ '^[0-9]{8,}$' then
      raise exception 'A profile has a missing or invalid PREM Number.';
    end if;

    v_school := nullif(trim(v_item->>'school'), '');
    v_school_number := null;
    if v_school ~* '^S[0-9]+' then
      v_school_number := upper(substring(v_school from '^(S[0-9]+)'));
    end if;

    if v_school_number is null then
      raise exception 'A PReMS profile is missing a valid NECTA school number.';
    end if;
    if v_school_number <> v_destination_school_number then
      raise exception 'The PReMS source school does not match the selected AfriCore school.';
    end if;

    if nullif(trim(v_item->>'admission_number'), '') is null
       or nullif(trim(v_item->>'first_name'), '') is null
       or nullif(trim(v_item->>'last_name'), '') is null
       or nullif(trim(v_item->>'date_of_birth'), '') is null then
      raise exception 'A profile is missing Admission Number, name, or Date of Birth.';
    end if;

    if lower(trim(coalesce(v_item->>'gender', ''))) not in ('male', 'female') then
      raise exception 'A profile has an invalid Sex value.';
    end if;

    if coalesce(v_item->>'date_of_birth', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'A profile has an invalid Date of Birth format.';
    end if;

    v_exam_year := null;
    if coalesce(v_item->>'exam_reference_year', '') ~ '^[0-9]{4}$' then
      v_exam_year := (v_item->>'exam_reference_year')::integer;
    end if;

    v_student_rows := v_student_rows || jsonb_build_array(jsonb_build_object(
      'admission_number', trim(v_item->>'admission_number'),
      'first_name', trim(v_item->>'first_name'),
      'middle_name', nullif(trim(v_item->>'middle_name'), ''),
      'last_name', trim(v_item->>'last_name'),
      'gender', initcap(lower(trim(v_item->>'gender'))),
      'date_of_birth', trim(v_item->>'date_of_birth'),
      'stream', nullif(trim(v_item->>'stream'), ''),
      'exam_number', nullif(trim(v_item->>'exam_reference_number'), ''),
      'exam_year', v_exam_year,
      'registration_type', nullif(trim(v_item->>'registration_type'), ''),
      'form', nullif(trim(v_item->>'form'), ''),
      'source_school_name', v_school
    ));
    v_count := v_count + 1;
  end loop;

  -- Delegate student creation to the existing secured importer. It validates
  -- school membership, role permission, class, subjects and Advanced combination.
  v_result := public.import_necta_prems_students(
    p_school_id,
    p_academic_year_id,
    p_class_id,
    p_combination_id,
    p_subject_ids,
    v_student_rows
  );

  for v_item in select value from jsonb_array_elements(p_profile_students)
  loop
    v_student_id := (v_result->'student_ids'->>v_index)::bigint;
    v_prem := regexp_replace(trim(v_item->>'prem_number'), '[[:space:]]', '', 'g');
    v_school := nullif(trim(v_item->>'school'), '');
    v_school_number := upper(substring(v_school from '^(S[0-9]+)'));

    update public.necta_student_records
       set prem_number = v_prem,
           stream_trade = nullif(trim(v_item->>'stream'), ''),
           field = nullif(trim(v_item->>'field'), ''),
           trade = nullif(trim(v_item->>'trade'), ''),
           is_repeater = case
             when upper(trim(coalesce(v_item->>'is_repeater', ''))) in ('YES', 'Y', 'TRUE') then true
             when upper(trim(coalesce(v_item->>'is_repeater', ''))) in ('NO', 'N', 'FALSE') then false
             else null end,
           citizenship = nullif(trim(v_item->>'citizenship'), ''),
           parenting_status = nullif(trim(v_item->>'parenting_status'), ''),
           health_status_category = nullif(trim(v_item->>'health_status_category'), ''),
           accommodation = nullif(trim(v_item->>'accommodation'), ''),
           birth_certificate_no = nullif(trim(v_item->>'birth_certificate_no'), ''),
           student_id_number = nullif(trim(v_item->>'student_id_number'), ''),
           distance_from_home = case
             when coalesce(v_item->>'distance_from_home', '') ~ '^[0-9]+([.][0-9]+)?$'
             then (v_item->>'distance_from_home')::numeric else null end,
           address_line_1 = nullif(trim(v_item->>'address_line_1'), ''),
           address_line_2 = nullif(trim(v_item->>'address_line_2'), ''),
           address_line_3 = nullif(trim(v_item->>'address_line_3'), ''),
           physical_address = nullif(trim(v_item->>'physical_address'), ''),
           place_of_domicile = nullif(trim(v_item->>'place_of_domicile'), ''),
           source_school_number = v_school_number,
           source_school_name = v_school,
           guardian_details = case
             when jsonb_typeof(v_item->'guardian') = 'object' then v_item->'guardian'
             else null end,
           condition_details = case
             when jsonb_typeof(v_item->'condition') = 'object' then v_item->'condition'
             else null end,
           profile_details = v_item
     where student_id = v_student_id
       and school_id = p_school_id;

    if not found then
      raise exception 'NECTA profile metadata could not be linked to the imported student.';
    end if;

    v_index := v_index + 1;
  end loop;

  return jsonb_build_object(
    'imported_count', v_count,
    'student_ids', v_result->'student_ids',
    'profile_import', true
  );
end;
$function$;

revoke all on function public.import_necta_prems_profile_students(bigint,bigint,bigint,bigint,bigint[],jsonb) from public;
grant execute on function public.import_necta_prems_profile_students(bigint,bigint,bigint,bigint,bigint[],jsonb) to authenticated;

commit;
