-- Avoid inserting a negative excluded row when decrementing stock.
-- Positive movements upsert; negative movements update an existing balance only.
create or replace function public.apply_stock_movement_to_balance()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_delta numeric(14,3);
  v_item_school bigint;
  v_location_school bigint;
begin
  if not public.is_current_user_super_admin() then
    if auth.uid() is null or new.school_id is distinct from public.get_current_user_school_id()
       or not exists (
         select 1 from public.profile_roles pr join public.roles r on r.id = pr.role_id
         where pr.profile_id = auth.uid() and pr.school_id = new.school_id and pr.is_active is true
           and (
             (new.movement_type in ('opening','receive','return','adjustment_in','transfer_in')
               and lower(trim(r.role_name)) = 'accountant')
             or
             (new.movement_type in ('issue','sale','damaged','expired','adjustment_out','transfer_out')
               and lower(trim(r.role_name)) in ('headmaster','accountant'))
           )
       ) then
      raise exception 'You are not authorised to post this type of stock movement for this school.';
    end if;
  end if;

  select school_id into v_item_school from public.stock_items where id = new.item_id;
  select school_id into v_location_school from public.stock_locations where id = new.location_id;
  if v_item_school is distinct from new.school_id or v_location_school is distinct from new.school_id then
    raise exception 'Stock item and location must belong to the selected school.';
  end if;

  v_delta := case
    when new.movement_type in ('opening','receive','return','adjustment_in','transfer_in') then new.quantity
    else -new.quantity
  end;

  if v_delta > 0 then
    insert into public.stock_balances (school_id,item_id,location_id,quantity_on_hand,updated_at)
    values (new.school_id,new.item_id,new.location_id,v_delta,now())
    on conflict (school_id,item_id,location_id)
    do update set
      quantity_on_hand = public.stock_balances.quantity_on_hand + excluded.quantity_on_hand,
      updated_at = now();
  else
    update public.stock_balances
    set quantity_on_hand = quantity_on_hand + v_delta, updated_at = now()
    where school_id = new.school_id and item_id = new.item_id and location_id = new.location_id
      and quantity_on_hand + v_delta >= 0;
    if not found then
      raise exception 'Insufficient stock. This movement would make the balance negative.';
    end if;
  end if;

  return new;
end;
$$;
revoke all on function public.apply_stock_movement_to_balance() from public, anon, authenticated;
