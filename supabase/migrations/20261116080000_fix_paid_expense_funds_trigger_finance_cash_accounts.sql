-- Keep the paid-expense funds guard aligned with the finance cash-account
-- source used by Add Expenses and create_expense_with_payable.
-- The row lock serializes concurrent payments against the same account.
create or replace function public.assert_paid_expense_has_funds()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'finance'
as $function$
declare
  v_account finance.cash_accounts%rowtype;
begin
  if new.payment_status is distinct from 'paid' then
    return new;
  end if;

  if new.financial_account_id is null then
    raise exception 'Financial account is required for a paid expense';
  end if;

  select *
    into v_account
  from finance.cash_accounts
  where id = new.financial_account_id
    and school_id = new.school_id
    and is_active = true
  for update;

  if not found then
    raise exception 'Selected financial account does not belong to this school or is inactive';
  end if;

  if coalesce(v_account.current_balance, 0) < coalesce(new.amount, 0) then
    raise exception using message = format(
      'Insufficient funds in %s. Available balance is TZS %s, but the expense requires TZS %s.',
      coalesce(v_account.account_name, 'selected financial account'),
      to_char(coalesce(v_account.current_balance, 0), 'FM999999999999990.00'),
      to_char(coalesce(new.amount, 0), 'FM999999999999990.00')
    );
  end if;

  return new;
end;
$function$;
