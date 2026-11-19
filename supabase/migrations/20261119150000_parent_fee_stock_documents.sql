-- Parent Portal invoices and payment receipts for fees and stock orders.
-- Documents are generated from the source transactions; no duplicate accounting entries are posted.

create table if not exists public.parent_portal_documents (
  id bigint generated always as identity primary key,
  school_id bigint not null references public.schools(id) on delete cascade,
  parent_account_id uuid not null references public.parent_portal_accounts(id) on delete cascade,
  student_id bigint not null references public.students(id) on delete cascade,
  document_type text not null check (document_type in ('invoice','receipt')),
  document_number text not null,
  source_type text not null check (source_type in ('fee_payment','stock_order','stock_payment')),
  source_id text not null,
  amount numeric(14,2) not null check (amount >= 0),
  document_date date not null default current_date,
  status text not null default 'issued' check (status in ('issued','voided')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (school_id, document_type, source_type, source_id)
);

create index if not exists parent_portal_documents_parent_idx
  on public.parent_portal_documents(school_id, parent_account_id, student_id, document_date desc);

alter table public.parent_portal_documents enable row level security;
drop policy if exists parent_portal_documents_staff_read on public.parent_portal_documents;
create policy parent_portal_documents_staff_read
  on public.parent_portal_documents for select to authenticated
  using (
    public.is_current_user_super_admin()
    or (
      school_id = public.get_current_user_school_id()
      and exists (
        select 1 from public.profile_roles pr
        join public.roles r on r.id = pr.role_id
        where pr.profile_id = auth.uid()
          and pr.school_id = parent_portal_documents.school_id
          and pr.is_active is true
          and lower(trim(r.role_name)) in ('headmaster','accountant','secretary')
      )
    )
  );
grant select on public.parent_portal_documents to authenticated;
revoke insert, update, delete on public.parent_portal_documents from anon, authenticated;

-- Build a stock invoice after its order lines are inserted. The upsert refreshes
-- the item list as each order line is saved, while preserving one invoice number.
create or replace function public.sync_parent_stock_order_invoice()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.stock_student_orders%rowtype;
  v_student public.students%rowtype;
  v_account uuid;
  v_school_name text;
  v_lines jsonb;
  v_parent_name text;
begin
  select * into v_order
  from public.stock_student_orders
  where id = new.student_order_id and school_id = new.school_id;
  if not found then return new; end if;

  select * into v_student from public.students
  where id = v_order.student_id and school_id = v_order.school_id;
  if not found then return new; end if;

  v_account := v_order.parent_account_id;
  if v_account is null then
    select id into v_account from public.parent_portal_accounts
    where student_id = v_order.student_id and school_id = v_order.school_id and is_active is true
    limit 1;
  end if;
  if v_account is null then return new; end if;

  select coalesce(parent_name, guardian_name, 'Mzazi/Mlezi')
    into v_parent_name from public.students
    where id = v_order.student_id and school_id = v_order.school_id;
  select school_name into v_school_name from public.schools where id = v_order.school_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'item_name', si.item_name,
    'variant_label', si.variant_label,
    'quantity', oi.quantity_ordered,
    'unit_price', oi.unit_price,
    'line_total', round(oi.quantity_ordered * oi.unit_price, 2)
  ) order by oi.id), '[]'::jsonb)
    into v_lines
    from public.stock_student_order_items oi
    join public.stock_items si on si.id = oi.item_id and si.school_id = oi.school_id
    where oi.student_order_id = v_order.id and oi.school_id = v_order.school_id;

  insert into public.parent_portal_documents(
    school_id,parent_account_id,student_id,document_type,document_number,
    source_type,source_id,amount,document_date,status,payload
  ) values (
    v_order.school_id,v_account,v_order.student_id,'invoice',
    'INV-' || v_order.order_number,'stock_order',v_order.id::text,
    v_order.total_amount,v_order.order_date,
    case when v_order.status = 'cancelled' then 'voided' else 'issued' end,
    jsonb_build_object(
      'school_name',v_school_name,
      'parent_name',v_parent_name,
      'student_name',concat_ws(' ',v_student.first_name,v_student.middle_name,v_student.last_name),
      'admission_number',coalesce(v_student.admission_number,v_student.admission_no),
      'order_number',v_order.order_number,
      'items',v_lines,
      'total_amount',v_order.total_amount,
      'payment_status',v_order.payment_status,
      'notes',v_order.notes
    )
  )
  on conflict (school_id,document_type,source_type,source_id)
  do update set amount=excluded.amount,document_date=excluded.document_date,
    status=excluded.status,payload=excluded.payload,parent_account_id=excluded.parent_account_id;
  return new;
end;
$$;
revoke all on function public.sync_parent_stock_order_invoice() from public, anon, authenticated;

drop trigger if exists trg_parent_stock_order_invoice on public.stock_student_order_items;
create trigger trg_parent_stock_order_invoice
after insert or update on public.stock_student_order_items
for each row execute function public.sync_parent_stock_order_invoice();

-- A posted school-fee payment already contains its journal entry. This trigger
-- only creates a printable receipt record and portal document; it never posts
-- a second journal entry.
create or replace function finance.create_fee_payment_receipt()
returns trigger
language plpgsql
security definer
set search_path = finance, public, pg_temp
as $$
declare
  v_charge finance.student_charges%rowtype;
  v_student public.students%rowtype;
  v_account uuid;
  v_receipt_number text;
  v_school_name text;
  v_parent_name text;
begin
  if new.status::text <> 'posted' then return new; end if;
  select * into v_charge from finance.student_charges
  where id = new.charge_id and school_id = new.school_id and student_id = new.student_id;
  select * into v_student from public.students
  where id = new.student_id and school_id = new.school_id;
  if not found then return new; end if;
  select id into v_account from public.parent_portal_accounts
  where student_id = new.student_id and school_id = new.school_id and is_active is true
  limit 1;

  v_receipt_number := 'FEE-' || coalesce(new.payment_number::text,new.id::text);
  v_parent_name := coalesce(v_student.parent_name,v_student.guardian_name,'Mzazi/Mlezi');
  select school_name into v_school_name from public.schools where id = new.school_id;

  if v_charge.revenue_account_id is not null
     and new.financial_account_id is not null
     and not exists (select 1 from finance.receipts r where r.school_id=new.school_id and r.receipt_number=v_receipt_number) then
    insert into finance.receipts(
      school_id,receipt_number,receipt_date,student_id,payer_name,
      income_account_id,cash_account_id,payment_method,amount,reference_number,
      description,status,journal_entry_id,created_by,issued_by
    ) values (
      new.school_id,v_receipt_number,new.payment_date,new.student_id,v_parent_name,
      v_charge.revenue_account_id,new.financial_account_id,
      case lower(new.payment_method::text)
        when 'bank_transfer' then 'bank'
        when 'mobile_money' then 'mobile_money'
        when 'cash' then 'cash'
        when 'cheque' then 'cheque'
        else 'other'
      end,
      new.amount,new.reference_number,
      coalesce(new.description,v_charge.description,'School fees payment'),
      'posted',new.journal_entry_id,new.created_by,new.created_by
    );
  end if;

  if v_account is not null then
    insert into public.parent_portal_documents(
      school_id,parent_account_id,student_id,document_type,document_number,
      source_type,source_id,amount,document_date,payload
    ) values (
      new.school_id,v_account,new.student_id,'receipt',v_receipt_number,
      'fee_payment',new.id::text,new.amount,new.payment_date,
      jsonb_build_object(
        'school_name',v_school_name,'parent_name',v_parent_name,
        'student_name',concat_ws(' ',v_student.first_name,v_student.middle_name,v_student.last_name),
        'admission_number',coalesce(v_student.admission_number,v_student.admission_no),
        'description',coalesce(new.description,v_charge.description,'School fees payment'),
        'payment_method',new.payment_method,'reference_number',new.reference_number,
        'charge_id',new.charge_id,'payment_number',new.payment_number
      )
    ) on conflict (school_id,document_type,source_type,source_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function finance.create_fee_payment_receipt() from public, anon, authenticated;

drop trigger if exists trg_create_fee_payment_receipt on finance.student_payments;
create trigger trg_create_fee_payment_receipt
after insert or update of status on finance.student_payments
for each row when (new.status::text = 'posted')
execute function finance.create_fee_payment_receipt();

-- Stock receipts are issued only after Headmaster approval has posted the
-- payment into Finance and linked its finance.receipts row.
create or replace function public.sync_parent_stock_payment_receipt()
returns trigger
language plpgsql
security definer
set search_path = public, finance, pg_temp
as $$
declare
  v_payment public.stock_student_order_payments%rowtype;
  v_order public.stock_student_orders%rowtype;
  v_student public.students%rowtype;
  v_receipt finance.receipts%rowtype;
  v_school_name text;
  v_parent_name text;
begin
  if new.status <> 'approved' or new.request_type <> 'student_order_payment' or new.receipt_id is null then
    return new;
  end if;
  select * into v_payment from public.stock_student_order_payments
  where id=new.source_payment_id and school_id=new.school_id;
  select * into v_order from public.stock_student_orders
  where id=v_payment.student_order_id and school_id=new.school_id;
  select * into v_student from public.students
  where id=v_order.student_id and school_id=new.school_id;
  select * into v_receipt from finance.receipts
  where id=new.receipt_id and school_id=new.school_id;
  if not found or v_order.id is null or v_student.id is null then return new; end if;
  select school_name into v_school_name from public.schools where id=new.school_id;
  v_parent_name := coalesce(v_student.parent_name,v_student.guardian_name,'Mzazi/Mlezi');
  insert into public.parent_portal_documents(
    school_id,parent_account_id,student_id,document_type,document_number,
    source_type,source_id,amount,document_date,status,payload
  )
  select new.school_id,a.id,v_student.id,'receipt',v_receipt.receipt_number,
    'stock_payment',v_payment.id::text,v_receipt.amount,v_receipt.receipt_date,
    case when v_receipt.status='voided' then 'voided' else 'issued' end,
    jsonb_build_object(
      'school_name',v_school_name,'parent_name',v_parent_name,
      'student_name',concat_ws(' ',v_student.first_name,v_student.middle_name,v_student.last_name),
      'admission_number',coalesce(v_student.admission_number,v_student.admission_no),
      'order_number',v_order.order_number,'description',v_receipt.description,
      'payment_method',v_receipt.payment_method,'reference_number',v_receipt.reference_number
    )
  from public.parent_portal_accounts a
  where a.id=coalesce(v_order.parent_account_id,a.id)
    and a.student_id=v_student.id and a.school_id=new.school_id and a.is_active is true
  limit 1
  on conflict (school_id,document_type,source_type,source_id) do nothing;
  return new;
end;
$$;
revoke all on function public.sync_parent_stock_payment_receipt() from public, anon, authenticated;

drop trigger if exists trg_parent_stock_payment_receipt on public.stock_finance_approval_requests;
create trigger trg_parent_stock_payment_receipt
after update of status, receipt_id on public.stock_finance_approval_requests
for each row when (new.status='approved' and new.request_type='student_order_payment')
execute function public.sync_parent_stock_payment_receipt();

