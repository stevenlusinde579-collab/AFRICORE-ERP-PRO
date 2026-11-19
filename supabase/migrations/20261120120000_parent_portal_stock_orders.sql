-- Parent Portal ordering for school uniforms and other sale-enabled stock items.
-- Parent identity is linked to the existing one-student Parent Portal account.
alter table public.stock_student_orders
  add column if not exists parent_account_id uuid
  references public.parent_portal_accounts(id) on delete set null;

create index if not exists stock_student_orders_parent_account_idx
  on public.stock_student_orders(school_id, parent_account_id, created_at desc);

-- This function is called only by the trusted backend service-role client after
-- parentAuth verifies the portal session. It independently validates that the
-- account, student, and school are the same tenant before creating any records.
create or replace function public.create_parent_stock_student_order(
  p_parent_account_id uuid,
  p_student_id bigint,
  p_school_id bigint,
  p_items jsonb,
  p_notes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_order_id bigint;
  v_order_number text;
  v_total numeric(14,2) := 0;
  v_line jsonb;
  v_item public.stock_items%rowtype;
  v_quantity numeric(14,3);
  v_count integer := 0;
begin
  if p_parent_account_id is null or p_student_id is null or p_school_id is null then
    raise exception 'Parent account, student and school are required.';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 20 then
    raise exception 'Choose between 1 and 20 items.';
  end if;
  if not exists (
    select 1 from public.parent_portal_accounts a
    where a.id = p_parent_account_id
      and a.student_id = p_student_id
      and a.school_id = p_school_id
      and a.is_active is true
  ) then
    raise exception 'This Parent Portal account is not linked to the selected student and school.';
  end if;
  if not exists (
    select 1 from public.students s
    join public.schools sc on sc.id = s.school_id
    where s.id = p_student_id and s.school_id = p_school_id and sc.is_active is true
  ) then
    raise exception 'Student or school is not active in this school.';
  end if;

  for v_line in select value from jsonb_array_elements(p_items)
  loop
    v_count := v_count + 1;
    if coalesce((v_line->>'item_id')::bigint, 0) <= 0
      or coalesce((v_line->>'quantity')::numeric, 0) <= 0
      or (v_line->>'quantity')::numeric > 1000 then
      raise exception 'Invalid item or quantity.';
    end if;
    select * into v_item from public.stock_items
    where id = (v_line->>'item_id')::bigint
      and school_id = p_school_id
      and is_active is true
      and is_for_sale is true;
    if not found then raise exception 'One selected item is not available for sale by this school.'; end if;
    v_quantity := (v_line->>'quantity')::numeric;
    v_total := v_total + (v_quantity * coalesce(v_item.selling_price, 0));
  end loop;

  v_order_number := 'SO-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS-MS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  insert into public.stock_student_orders (
    school_id, student_id, parent_account_id, order_number, status,
    payment_status, total_amount, notes
  ) values (
    p_school_id, p_student_id, p_parent_account_id, v_order_number,
    'pending', 'unpaid', v_total, nullif(left(coalesce(p_notes, ''), 1000), '')
  ) returning id into v_order_id;

  for v_line in select value from jsonb_array_elements(p_items)
  loop
    select * into v_item from public.stock_items
    where id = (v_line->>'item_id')::bigint and school_id = p_school_id;
    insert into public.stock_student_order_items (
      school_id, student_order_id, item_id, quantity_ordered, unit_price
    ) values (
      p_school_id, v_order_id, v_item.id,
      (v_line->>'quantity')::numeric, coalesce(v_item.selling_price, 0)
    );
  end loop;

  return jsonb_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'status', 'pending',
    'total_amount', v_total,
    'items_count', v_count
  );
end;
$$;

revoke all on function public.create_parent_stock_student_order(uuid,bigint,bigint,jsonb,text) from public, anon, authenticated;
grant execute on function public.create_parent_stock_student_order(uuid,bigint,bigint,jsonb,text) to service_role;
