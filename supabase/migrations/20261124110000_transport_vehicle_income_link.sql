-- Link each transport finance transaction to the vehicle it belongs to.
-- Nullable for legacy rows and school-wide expenses; transport income is vehicle-specific.
alter table public.transport_finance_transactions
  add column if not exists vehicle_id bigint;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'transport_finance_vehicle_school_fk'
      and conrelid = 'public.transport_finance_transactions'::regclass
  ) then
    alter table public.transport_finance_transactions
      add constraint transport_finance_vehicle_school_fk
      foreign key (vehicle_id, school_id)
      references public.transport_vehicles(id, school_id)
      on delete restrict;
  end if;
end $$;

create index if not exists transport_finance_vehicle_idx
  on public.transport_finance_transactions(school_id, vehicle_id, transaction_type, status, transaction_date desc);

-- Atomic bulk allocation: lock the vehicle row so concurrent allocations cannot
-- overbook its seats. The backend invokes this only after authentication and
-- permission middleware; this function independently validates the school role.
create or replace function public.assign_transport_students_bulk(
  p_school_id bigint,
  p_route_id bigint,
  p_student_ids bigint[],
  p_monthly_fee numeric,
  p_actor_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_vehicle_id bigint;
  v_capacity integer;
  v_existing integer;
  v_requested integer;
  v_inserted integer;
begin
  if p_school_id is null or p_actor_id is null then
    raise exception 'School and actor context are required';
  end if;
  if not (
    exists (
      select 1 from public.profile_roles pr
      join public.roles r on r.id = pr.role_id
      where pr.profile_id = p_actor_id and pr.is_active = true
        and (pr.school_id = p_school_id or lower(trim(r.role_name)) = 'super admin')
        and lower(trim(r.role_name)) in ('secretary','super admin')
    )
    or exists (
      select 1 from public.profiles p
      join public.roles r on r.id = p.role_id
      where p.id = p_actor_id
        and (lower(trim(r.role_name)) = 'super admin'
          or (p.school_id = p_school_id and lower(trim(r.role_name)) = 'secretary'))
    )
  ) then
    raise exception 'Only this school Secretary or Super Admin can allocate transport students';
  end if;

  if p_student_ids is null or cardinality(p_student_ids) = 0 then
    raise exception 'Select at least one student';
  end if;
  if cardinality(p_student_ids) > 1000 then
    raise exception 'Select no more than 1,000 students at a time';
  end if;
  if p_monthly_fee is null or p_monthly_fee < 0 then
    raise exception 'Monthly fee must be zero or greater';
  end if;

  select r.vehicle_id into v_vehicle_id
  from public.transport_routes r
  where r.id = p_route_id and r.school_id = p_school_id and r.status = 'active';
  if not found then raise exception 'Active route was not found in this school'; end if;

  select v.seating_capacity into v_capacity
  from public.transport_vehicles v
  where v.id = v_vehicle_id and v.school_id = p_school_id
  for update;
  if not found then raise exception 'Vehicle was not found in this school'; end if;

  if (select count(*) from public.students s
      where s.school_id = p_school_id and s.id = any(p_student_ids))
      <> (select count(distinct x) from unnest(p_student_ids) x) then
    raise exception 'Some selected students do not belong to this school';
  end if;

  if exists (
    select 1 from public.transport_student_assignments a
    where a.school_id = p_school_id and a.is_active = true
      and a.student_id = any(p_student_ids)
  ) then
    raise exception 'One or more selected students already have an active transport assignment';
  end if;

  select count(*) into v_existing
  from public.transport_student_assignments a
  join public.transport_routes r on r.id = a.route_id and r.school_id = a.school_id
  where a.school_id = p_school_id and a.is_active = true
    and r.vehicle_id = v_vehicle_id and r.status = 'active';

  v_requested := (select count(distinct x) from unnest(p_student_ids) x);
  if v_existing + v_requested > v_capacity then
    raise exception 'Vehicle capacity exceeded. Available seats: %; selected: %',
      greatest(0, v_capacity - v_existing), v_requested;
  end if;

  insert into public.transport_student_assignments
    (school_id, student_id, route_id, monthly_fee, start_date, assigned_by)
  select p_school_id, x, p_route_id, p_monthly_fee, current_date, p_actor_id
  from (select distinct unnest(p_student_ids) as x) selected;

  get diagnostics v_inserted = row_count;
  return jsonb_build_object('allocated', v_inserted, 'vehicle_id', v_vehicle_id, 'route_id', p_route_id);
end;
$$;

revoke all on function public.assign_transport_students_bulk(bigint,bigint,bigint[],numeric,uuid) from public, anon, authenticated;
grant execute on function public.assign_transport_students_bulk(bigint,bigint,bigint[],numeric,uuid) to service_role;
