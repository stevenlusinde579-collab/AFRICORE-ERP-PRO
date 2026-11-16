-- Move supplier bill settlement fully onto the Finance cash account model.
-- The UI now supplies finance.cash_accounts.id. The previous RPC still read
-- public.financial_accounts, which is empty for schools migrated to Finance.

create or replace function finance.pay_supplier_bill(
  p_bill_id uuid,
  p_amount numeric,
  p_financial_account_id bigint,
  p_payment_method character varying,
  p_reference_number character varying default null::character varying,
  p_payment_date date default current_date
)
returns finance.supplier_bills
language plpgsql
security definer
set search_path to 'finance', 'public'
as $function$
declare
  v_user uuid;
  v_bill finance.supplier_bills%rowtype;
  v_supplier finance.suppliers%rowtype;
  v_financial finance.cash_accounts%rowtype;
  v_payment_coa uuid;
  v_ap_coa uuid;
  v_party_id bigint;
  v_payment_id uuid;
  v_journal_id uuid;
  v_new_paid numeric;
  v_new_balance numeric;
  v_new_status varchar;
begin
  v_user := auth.uid();

  if v_user is null then
    raise exception 'User session is required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  if p_payment_method not in ('cash','bank','mobile_money') then
    raise exception 'Payment method must be cash, bank, or mobile_money';
  end if;

  select * into v_bill
  from finance.supplier_bills
  where id = p_bill_id
  for update;

  if not found then
    raise exception 'Payable not found';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = v_user
      and school_id = v_bill.school_id
  ) then
    raise exception 'You are not authorized for this school';
  end if;

  if v_bill.status in ('paid','voided') then
    raise exception 'This payable cannot receive another payment';
  end if;

  if p_amount > coalesce(v_bill.balance, greatest(v_bill.amount - coalesce(v_bill.paid_amount,0),0)) then
    raise exception 'Payment exceeds the outstanding payable balance';
  end if;

  select * into v_supplier
  from finance.suppliers
  where id = v_bill.supplier_id
    and school_id = v_bill.school_id
  limit 1;

  if not found then
    raise exception 'Supplier was not found for this payable';
  end if;

  -- The payment account ID is a finance.cash_accounts.id, never a legacy
  -- public.financial_accounts.id.
  select * into v_financial
  from finance.cash_accounts
  where id = p_financial_account_id
    and school_id = v_bill.school_id
    and is_active = true
    and account_type = p_payment_method
  for update;

  if not found then
    raise exception 'Selected active cash/bank/mobile-money account was not found for this school';
  end if;

  if v_financial.chart_of_account_id is null then
    raise exception 'Selected financial account is not linked to a Chart of Account';
  end if;

  if coalesce(v_financial.current_balance,0) < p_amount then
    raise exception using message = format(
      'Insufficient funds in %s. Available balance is TZS %s, but the payment requires TZS %s.',
      coalesce(v_financial.account_name,'selected financial account'),
      to_char(coalesce(v_financial.current_balance,0),'FM999999999999990.00'),
      to_char(p_amount,'FM999999999999990.00')
    );
  end if;

  select id into v_payment_coa
  from finance.chart_of_accounts
  where id = v_financial.chart_of_account_id
    and school_id = v_bill.school_id
    and account_type = 'asset'
    and is_active = true
  limit 1;

  if v_payment_coa is null then
    raise exception 'Selected financial account is not linked to an active school asset account';
  end if;

  select id into v_ap_coa
  from finance.chart_of_accounts
  where school_id = v_bill.school_id
    and account_code = '2000'
    and account_type = 'liability'
    and is_active = true
  order by is_control_account desc, id
  limit 1;

  if v_ap_coa is null then
    raise exception 'Accounts Payable account 2000 was not found';
  end if;

  select p.id into v_party_id
  from finance.parties p
  where p.school_id = v_bill.school_id
    and p.party_type = 'supplier'
    and lower(trim(p.full_name)) = lower(trim(v_supplier.supplier_name))
  order by p.id
  limit 1;

  if v_party_id is null then
    raise exception using message = format(
      'Supplier finance party was not found for "%s"',
      v_supplier.supplier_name
    );
  end if;

  insert into finance.supplier_payments (
    school_id, supplier_id, payment_date, amount, financial_account_id,
    payment_method, reference_number, description, status, created_at
  )
  values (
    v_bill.school_id, v_bill.supplier_id, coalesce(p_payment_date,current_date),
    p_amount, v_financial.id, p_payment_method,
    nullif(trim(p_reference_number), ''),
    'Payment for supplier bill ' || v_bill.bill_number,
    'draft'::finance.payment_status, now()
  )
  returning id into v_payment_id;

  v_journal_id := finance.post_journal_entry(
    v_bill.school_id,
    coalesce(p_payment_date,current_date),
    'Supplier payment: ' || v_bill.bill_number,
    nullif(trim(p_reference_number), ''),
    'supplier_payment',
    v_payment_id,
    v_user,
    null,
    jsonb_build_array(
      jsonb_build_object(
        'account_id',v_ap_coa,
        'debit',p_amount,
        'credit',0,
        'party_id',v_party_id,
        'description','Settlement of ' || v_bill.bill_number
      ),
      jsonb_build_object(
        'account_id',v_payment_coa,
        'debit',0,
        'credit',p_amount,
        'description','Payment for ' || v_bill.bill_number
      )
    )
  );

  update finance.supplier_payments
  set status = 'posted'::finance.payment_status,
      journal_entry_id = v_journal_id
  where id = v_payment_id;

  if not found then
    raise exception 'Supplier payment could not be finalized';
  end if;

  v_new_paid := coalesce(v_bill.paid_amount,0) + p_amount;
  v_new_balance := greatest(coalesce(v_bill.amount,0) - v_new_paid,0);
  v_new_status := case when v_new_balance = 0 then 'paid' else 'partial' end;

  update finance.supplier_bills
  set paid_amount = v_new_paid,
      status = v_new_status,
      updated_at = now()
  where id = v_bill.id
  returning * into v_bill;

  if not found then
    raise exception 'Supplier payable could not be updated';
  end if;

  update finance.suppliers
  set current_balance = greatest(coalesce(current_balance,0) - p_amount,0)
  where id = v_bill.supplier_id
    and school_id = v_bill.school_id;

  -- Single balance mutation: journal source_id is non-null, so the legacy
  -- journal-line cash synchronizer does not apply a second deduction.
  update finance.cash_accounts
  set current_balance = coalesce(current_balance,0) - p_amount
  where id = v_financial.id
    and school_id = v_bill.school_id
    and is_active = true;

  if not found then
    raise exception 'Selected cash/bank account could not be updated';
  end if;

  return v_bill;
exception
  when others then
    raise exception using message = sqlerrm, detail = sqlstate;
end;
$function$;
