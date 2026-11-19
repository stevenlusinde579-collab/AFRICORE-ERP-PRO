-- Validate the correct parent FK for each order-line table without referencing
-- a field that does not exist on the other table's trigger record.
create or replace function public.validate_stock_order_item_tenant()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.stock_items i
    where i.id = new.item_id and i.school_id = new.school_id
  ) then
    raise exception 'Stock item must belong to the same school.';
  end if;

  if tg_table_name = 'stock_purchase_order_items' then
    if not exists (
      select 1 from public.stock_purchase_orders o
      where o.id = new.purchase_order_id and o.school_id = new.school_id
    ) then
      raise exception 'Purchase order must belong to the same school.';
    end if;
  elsif tg_table_name = 'stock_student_order_items' then
    if not exists (
      select 1 from public.stock_student_orders o
      where o.id = new.student_order_id and o.school_id = new.school_id
    ) then
      raise exception 'Student order must belong to the same school.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.validate_stock_order_item_tenant() from public, anon, authenticated;
