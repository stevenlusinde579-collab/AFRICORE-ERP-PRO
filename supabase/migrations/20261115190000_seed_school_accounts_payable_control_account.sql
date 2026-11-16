-- Ensure every existing school has its supplier Accounts Payable control account.
-- This account is school-scoped and is used by Pay Later expense posting.
-- Existing accounts are preserved; this migration only inserts missing code 2000 rows.

insert into finance.chart_of_accounts (
  school_id,
  account_code,
  account_name,
  account_type,
  normal_balance,
  account_category,
  description,
  is_control_account,
  allow_manual_posting,
  is_active,
  opening_balance
)
select
  s.id,
  '2000',
  'Accounts Payable - Suppliers',
  'liability'::finance.account_type,
  'credit'::finance.normal_balance,
  'Current Liabilities',
  'Control account for supplier bills and unpaid expenses.',
  true,
  false,
  true,
  0
from public.schools s
where not exists (
  select 1
  from finance.chart_of_accounts coa
  where coa.school_id = s.id
    and coa.account_code = '2000'
)
on conflict (school_id, account_code) do nothing;

-- Verify that every school now has an active Accounts Payable control account.
do $$
begin
  if exists (
    select 1
    from public.schools s
    where not exists (
      select 1
      from finance.chart_of_accounts coa
      where coa.school_id = s.id
        and coa.account_code = '2000'
        and coa.account_type = 'liability'
        and coa.normal_balance = 'credit'
        and coa.is_control_account = true
        and coa.is_active = true
    )
  ) then
    raise exception 'Accounts Payable control account 2000 is missing or incompatible for one or more schools';
  end if;
end;
$$;
