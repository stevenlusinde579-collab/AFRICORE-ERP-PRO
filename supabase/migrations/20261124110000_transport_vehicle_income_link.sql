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
