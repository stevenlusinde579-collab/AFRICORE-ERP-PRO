-- Publish approved stock / uniform payment receipts through the Parent Portal.
-- Receipt creation remains owned by approve_stock_finance_request; this trigger only
-- creates the corresponding portal document after Finance approval has posted it.

create or replace function public.create_stock_parent_portal_receipt_document()
returns trigger
language plpgsql
security definer
set search_path = public, finance, pg_temp
as $$
declare
  v_payment public.stock_student_order_payments%rowtype;
  v_order public.stock_student_orders%rowtype;
  v_student public.students%rowtype;
  v_parent_account_id uuid;
  v_receipt finance.receipts%rowtype;
  v_school_name text;
begin
  if new.status <> 'approved'
     or new.request_type <> 'student_order_payment'
     or new.receipt_id is null then
    return new;
  end if;

  select * into v_payment
  from public.stock_student_order_payments
  where id = new.source_payment_id and school_id = new.school_id;
  if not found then return new; end if;

  select * into v_order
  from public.stock_student_orders
  where id = v_payment.student_order_id and school_id = new.school_id;
  if not found then return new; end if;

  select * into v_student
  from public.students
  where id = v_order.student_id and school_id = new.school_id;
  if not found then return new; end if;

  select * into v_receipt
  from finance.receipts
  where id = new.receipt_id and school_id = new.school_id;
  if not found then return new; end if;

  select id into v_parent_account_id
  from public.parent_portal_accounts
  where id = v_order.parent_account_id
    and school_id = new.school_id
    and student_id = v_order.student_id
    and is_active is true
  limit 1;

  if v_parent_account_id is null then
    select id into v_parent_account_id
    from public.parent_portal_accounts
    where school_id = new.school_id
      and student_id = v_order.student_id
      and is_active is true
    order by created_at desc
    limit 1;
  end if;

  if v_parent_account_id is null then return new; end if;

  select school_name into v_school_name
  from public.schools where id = new.school_id;

  insert into public.parent_portal_documents(
    school_id, parent_account_id, student_id, document_type, document_number,
    source_type, source_id, amount, document_date, payload
  ) values (
    new.school_id, v_parent_account_id, v_order.student_id, 'receipt',
    v_receipt.receipt_number, 'stock_student_order_payment',
    v_payment.id::text, v_receipt.amount, v_receipt.receipt_date,
    jsonb_build_object(
      'school_name', v_school_name,
      'parent_name', coalesce(v_student.parent_name, v_student.guardian_name, 'Parent/Guardian'),
      'student_name', concat_ws(' ', v_student.first_name, v_student.middle_name, v_student.last_name),
      'admission_number', coalesce(v_student.admission_number, v_student.admission_no),
      'description', coalesce(v_receipt.description, 'Stock / uniform order payment'),
      'payment_method', v_receipt.payment_method,
      'reference_number', v_receipt.reference_number,
      'order_number', v_order.order_number,
      'payment_id', v_payment.id
    )
  )
  on conflict (school_id, document_type, source_type, source_id) do nothing;

  return new;
end;
$$;

revoke all on function public.create_stock_parent_portal_receipt_document() from public, anon, authenticated;

drop trigger if exists trg_stock_parent_portal_receipt_document
  on public.stock_finance_approval_requests;

create trigger trg_stock_parent_portal_receipt_document
after update of status, receipt_id on public.stock_finance_approval_requests
for each row
when (new.status = 'approved' and new.request_type = 'student_order_payment' and new.receipt_id is not null)
execute function public.create_stock_parent_portal_receipt_document();

-- Backfill existing approved stock receipts for Bishop Alpha (school 3) only.
insert into public.parent_portal_documents(
  school_id, parent_account_id, student_id, document_type, document_number,
  source_type, source_id, amount, document_date, payload
)
select
  req.school_id,
  coalesce(
    (select a.id from public.parent_portal_accounts a
     where a.id = ord.parent_account_id and a.school_id = req.school_id
       and a.student_id = ord.student_id and a.is_active is true limit 1),
    (select a.id from public.parent_portal_accounts a
     where a.school_id = req.school_id and a.student_id = ord.student_id
       and a.is_active is true order by a.created_at desc limit 1)
  ),
  ord.student_id,
  'receipt',
  rec.receipt_number,
  'stock_student_order_payment',
  pay.id::text,
  rec.amount,
  rec.receipt_date,
  jsonb_build_object(
    'school_name', sch.school_name,
    'parent_name', coalesce(st.parent_name, st.guardian_name, 'Parent/Guardian'),
    'student_name', concat_ws(' ', st.first_name, st.middle_name, st.last_name),
    'admission_number', coalesce(st.admission_number, st.admission_no),
    'description', coalesce(rec.description, 'Stock / uniform order payment'),
    'payment_method', rec.payment_method,
    'reference_number', rec.reference_number,
    'order_number', ord.order_number,
    'payment_id', pay.id
  )
from public.stock_finance_approval_requests req
join public.stock_student_order_payments pay
  on pay.id = req.source_payment_id and pay.school_id = req.school_id
join public.stock_student_orders ord
  on ord.id = pay.student_order_id and ord.school_id = req.school_id
join public.students st
  on st.id = ord.student_id and st.school_id = req.school_id
join finance.receipts rec
  on rec.id = req.receipt_id and rec.school_id = req.school_id
left join public.schools sch on sch.id = req.school_id
where req.school_id = 3
  and req.request_type = 'student_order_payment'
  and req.status = 'approved'
  and req.receipt_id is not null
  and coalesce(
    (select a.id from public.parent_portal_accounts a
     where a.id = ord.parent_account_id and a.school_id = req.school_id
       and a.student_id = ord.student_id and a.is_active is true limit 1),
    (select a.id from public.parent_portal_accounts a
     where a.school_id = req.school_id and a.student_id = ord.student_id
       and a.is_active is true order by a.created_at desc limit 1)
  ) is not null
on conflict (school_id, document_type, source_type, source_id) do nothing;
