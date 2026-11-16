-- Resolve system-wide and school-owned expense accounts without breaking legacy records.
alter table public.expenses
  add column if not exists finance_expense_account_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.expenses'::regclass
      and conname = 'expenses_finance_expense_account_id_fkey'
  ) then
    alter table public.expenses
      add constraint expenses_finance_expense_account_id_fkey
      foreign key (finance_expense_account_id)
      references finance.chart_of_accounts(id)
      on delete set null;
  end if;
end $$;

create index if not exists expenses_school_finance_expense_account_idx
  on public.expenses (school_id, finance_expense_account_id);

update public.expenses e
set finance_expense_account_id = f.id
from public.chart_of_accounts p
join finance.chart_of_accounts f
  on f.account_code = p.account_code
 and f.account_type = 'expense'
where e.expense_account_id = p.id
  and e.school_id = f.school_id
  and p.account_type = 'expense'
  and e.finance_expense_account_id is null;

CREATE OR REPLACE FUNCTION public.create_expense_with_payable(p_expense_date date, p_expense_category text, p_description text, p_amount numeric, p_payment_status text, p_payment_method character varying DEFAULT NULL::character varying, p_financial_account_id bigint DEFAULT NULL::bigint, p_expense_account_id uuid DEFAULT NULL::uuid, p_reference_number character varying DEFAULT NULL::character varying, p_supplier_id bigint DEFAULT NULL::bigint, p_bill_number character varying DEFAULT NULL::character varying, p_due_date date DEFAULT NULL::date)
 RETURNS expenses
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'finance'
AS $function$
declare
  v_user uuid;
  v_school_id bigint;
  v_expense public.expenses%rowtype;
  v_public_expense_coa_code text;
  v_finance_expense_coa uuid;
  v_legacy_public_expense_account uuid;
  v_financial finance.cash_accounts%rowtype;
  v_public_payment_coa_code text;
  v_finance_payment_coa uuid;
  v_ap_coa uuid;
  v_supplier finance.suppliers%rowtype;
  v_bill finance.supplier_bills%rowtype;
  v_party_id bigint;
  v_journal_id uuid;
begin
  v_user := auth.uid();

  if v_user is null then
    raise exception 'User session is required';
  end if;

  select school_id into v_school_id
  from public.profiles
  where id = v_user
  limit 1;

  if v_school_id is null then
    raise exception 'User school is not configured';
  end if;

  if p_expense_date is null then
    raise exception 'Expense date is required';
  end if;

  if nullif(trim(p_expense_category), '') is null then
    raise exception 'Expense category is required';
  end if;

  if nullif(trim(p_description), '') is null then
    raise exception 'Expense description is required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Expense amount must be greater than zero';
  end if;

  if p_payment_status not in ('paid','unpaid') then
    raise exception 'Payment status must be paid or unpaid';
  end if;

  if p_expense_account_id is null then
    raise exception 'Expense account is required';
  end if;

  -- Accept either a school-owned finance account or a global system template.
  select id, account_code
    into v_finance_expense_coa, v_public_expense_coa_code
  from finance.chart_of_accounts
  where id = p_expense_account_id
    and school_id = v_school_id
    and account_type = 'expense'
    and is_active = true
    and allow_manual_posting = true
  limit 1;

  if v_finance_expense_coa is not null then
    select id into v_legacy_public_expense_account
    from public.chart_of_accounts
    where account_code = v_public_expense_coa_code
      and account_type = 'expense'
      and is_active = true
    order by id
    limit 1;
  else
    select id, account_code
      into v_legacy_public_expense_account, v_public_expense_coa_code
    from public.chart_of_accounts
    where id = p_expense_account_id
      and account_type = 'expense'
      and is_active = true
    limit 1;

    if v_legacy_public_expense_account is null then
      raise exception 'Selected expense account is invalid or does not belong to this school';
    end if;

    select id into v_finance_expense_coa
    from finance.chart_of_accounts
    where school_id = v_school_id
      and account_code = v_public_expense_coa_code
      and account_type = 'expense'
      and is_active = true
      and allow_manual_posting = true
    order by id
    limit 1;

    if v_finance_expense_coa is null then
      if exists (
        select 1 from finance.chart_of_accounts
        where school_id = v_school_id
          and account_code = v_public_expense_coa_code
      ) then
        raise exception 'System expense account code % conflicts with an existing inactive or incompatible school account. Please review Chart of Accounts.', v_public_expense_coa_code;
      end if;

      insert into finance.chart_of_accounts (
        school_id, account_code, account_name, account_type,
        normal_balance, account_category, description,
        is_control_account, allow_manual_posting, is_active, opening_balance
      )
      select
        v_school_id, account_code, account_name, 'expense'::finance.account_type,
        'debit'::finance.normal_balance, account_category, description,
        false, true, true, 0
      from public.chart_of_accounts
      where id = v_legacy_public_expense_account
      returning id into v_finance_expense_coa;
    end if;
  end if;

  if v_finance_expense_coa is null then
    raise exception 'Unable to resolve the selected expense account for this school';
  end if;

  if p_payment_status = 'paid' then

    if p_financial_account_id is null then
      raise exception 'Financial account is required for a paid expense';
    end if;

    if p_payment_method is null
       or p_payment_method not in ('cash','bank','mobile_money') then
      raise exception 'Payment method must be cash, bank, or mobile_money';
    end if;

    select * into v_financial
    from finance.cash_accounts
    where id = p_financial_account_id
      and school_id = v_school_id
      and is_active = true
    for update;

    if not found then
      raise exception 'Selected financial account does not belong to this school or is inactive';
    end if;

    select account_code into v_public_payment_coa_code
    from finance.chart_of_accounts
    where id = v_financial.chart_of_account_id
      and school_id = v_school_id
      and account_type = 'asset'
      and is_active = true
    limit 1;

    if v_public_payment_coa_code is null then
      raise exception 'Financial account is not linked to an active asset account';
    end if;

    select id into v_finance_payment_coa
    from finance.chart_of_accounts
    where school_id = v_school_id
      and account_code = v_public_payment_coa_code
      and account_type = 'asset'
      and is_active = true
    order by id
    limit 1;

    if v_finance_payment_coa is null then
      raise exception 'Finance payment account % is not configured for this school', v_public_payment_coa_code;
    end if;

  else

    if p_supplier_id is null then
      raise exception 'Supplier is required when an expense is unpaid';
    end if;

    if nullif(trim(p_bill_number), '') is null then
      raise exception 'Bill number is required when an expense is unpaid';
    end if;

    select * into v_supplier
    from finance.suppliers
    where id = p_supplier_id
      and school_id = v_school_id
      and is_active = true
    for update;

    if not found then
      raise exception 'Selected supplier does not belong to this school or is inactive';
    end if;

    select id into v_ap_coa
    from finance.chart_of_accounts
    where school_id = v_school_id
      and account_code = '2000'
      and account_type = 'liability'
      and is_active = true
    order by id
    limit 1;

    if v_ap_coa is null then
      raise exception 'Accounts Payable account 2000 is not configured for this school';
    end if;

    /*
      journal_lines.party_id references finance.parties.id, not
      finance.suppliers.id. Create/reuse the supplier party so the
      payable journal line has a valid foreign key.
    */
    perform pg_advisory_xact_lock(
      hashtextextended(
        'finance-supplier-party-' || v_school_id::text || '-' || p_supplier_id::text,
        0
      )
    );

    select id into v_party_id
    from finance.parties
    where school_id = v_school_id
      and party_type = 'supplier'
      and full_name = v_supplier.supplier_name
    order by id
    limit 1;

    if v_party_id is null then
      insert into finance.parties (
        school_id,
        party_type,
        full_name,
        phone,
        email,
        address,
        opening_balance,
        is_active
      )
      values (
        v_school_id,
        'supplier',
        v_supplier.supplier_name,
        v_supplier.phone,
        v_supplier.email,
        v_supplier.address,
        0,
        true
      )
      returning id into v_party_id;
    end if;

  end if;

  insert into public.expenses (
    school_id,
    expense_category,
    description,
    amount,
    expense_date,
    payment_status,
    payment_method,
    financial_account_id,
    expense_account_id,
    finance_expense_account_id,
    reference_number,
    created_by
  )
  values (
    v_school_id,
    trim(p_expense_category),
    trim(p_description),
    p_amount,
    p_expense_date,
    p_payment_status,
    case when p_payment_status='paid' then p_payment_method else null end,
    case when p_payment_status='paid' then p_financial_account_id else null end,
    v_legacy_public_expense_account,
    v_finance_expense_coa,
    nullif(trim(p_reference_number),''),
    v_user
  )
  returning * into v_expense;

  if p_payment_status = 'paid' then

    v_journal_id := finance.post_journal_entry(
      v_school_id,
      p_expense_date,
      'Expense: ' || trim(p_description),
      nullif(trim(p_reference_number),''),
      'expense'::varchar,
      null::uuid,
      v_user,
      null::uuid,
      jsonb_build_array(
        jsonb_build_object(
          'account_id', v_finance_expense_coa,
          'debit', p_amount,
          'credit', 0,
          'description', trim(p_description)
        ),
        jsonb_build_object(
          'account_id', v_finance_payment_coa,
          'debit', 0,
          'credit', p_amount,
          'description', 'Payment for ' || trim(p_description)
        )
      )
    );

    update public.expenses
    set journal_entry_id = v_journal_id
    where id = v_expense.id;

    update finance.cash_accounts
    set current_balance = coalesce(current_balance,0) - p_amount
    where id = p_financial_account_id
      and school_id = v_school_id;

  else

    v_journal_id := finance.post_journal_entry(
      v_school_id,
      p_expense_date,
      'Unpaid expense: ' || trim(p_description),
      nullif(trim(p_reference_number),''),
      'expense'::varchar,
      null::uuid,
      v_user,
      null::uuid,
      jsonb_build_array(
        jsonb_build_object(
          'account_id', v_finance_expense_coa,
          'debit', p_amount,
          'credit', 0,
          'description', trim(p_description)
        ),
        jsonb_build_object(
          'account_id', v_ap_coa,
          'debit', 0,
          'credit', p_amount,
          'party_id', v_party_id,
          'description', 'Supplier payable for ' || v_supplier.supplier_name
        )
      )
    );

    insert into finance.supplier_bills (
      school_id,
      supplier_id,
      bill_number,
      bill_date,
      due_date,
      expense_account_id,
      description,
      amount,
      paid_amount,
      status,
      journal_entry_id,
      created_by,
      expense_id
    )
    values (
      v_school_id,
      p_supplier_id,
      trim(p_bill_number),
      p_expense_date,
      p_due_date,
      v_finance_expense_coa,
      trim(p_description),
      p_amount,
      0,
      'open',
      v_journal_id,
      v_user,
      v_expense.id
    )
    returning * into v_bill;

    update public.expenses
    set journal_entry_id = v_journal_id,
        supplier_bill_id = v_bill.id
    where id = v_expense.id;

    update finance.suppliers
    set current_balance = coalesce(current_balance,0) + p_amount
    where id = p_supplier_id
      and school_id = v_school_id;

  end if;

  select * into v_expense
  from public.expenses
  where id = v_expense.id;

  return v_expense;
end;
$function$

