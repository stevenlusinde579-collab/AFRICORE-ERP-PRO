-- Allow each stock item to remember its preferred/default store.
alter table public.stock_items
  add column if not exists default_location_id bigint
  references public.stock_locations(id) on delete set null;

create or replace function public.validate_stock_item_default_location()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_location_school_id bigint;
begin
  if new.default_location_id is null then
    return new;
  end if;

  select school_id into v_location_school_id
  from public.stock_locations
  where id = new.default_location_id;

  if v_location_school_id is null or v_location_school_id is distinct from new.school_id then
    raise exception 'The default stock location must belong to the same school as the item.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_stock_item_default_location on public.stock_items;
create trigger trg_validate_stock_item_default_location
before insert or update of school_id, default_location_id
on public.stock_items
for each row execute function public.validate_stock_item_default_location();

revoke all on function public.validate_stock_item_default_location() from public, anon, authenticated;
