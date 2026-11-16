-- Prevent paid expenses from reducing finance.cash_accounts twice.
--
-- create_expense_with_payable explicitly updates cash_accounts.current_balance.
-- The legacy journal_lines trigger also updates that balance for expense
-- journals whose source_id is NULL. The RPC previously passed NULL as source_id,
-- so both paths ran for the same paid expense.
--
-- Pass the created expense ID as the journal source_id. The legacy trigger
-- intentionally skips source-linked expenses, leaving the RPC as the single
-- balance updater. Other legacy expense journals (source_id IS NULL) retain
-- their existing trigger behavior.

do $$
declare
  v_function_def text;
  v_old text := $old$'expense'::varchar,
      null::uuid,
      v_user,$old$;
  v_new text := $new$'expense'::varchar,
      v_expense.id,
      v_user,$new$;
  v_occurrences integer;
begin
  select pg_get_functiondef(p.oid)
    into v_function_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'create_expense_with_payable'
  order by p.oid
  limit 1;

  if v_function_def is null then
    raise exception 'public.create_expense_with_payable was not found';
  end if;

  v_occurrences :=
    (length(v_function_def) - length(replace(v_function_def, v_old, '')))
    / length(v_old);

  if v_occurrences <> 2 then
    raise exception 'Expected exactly 2 paid/unpaid expense journal source references; found %', v_occurrences;
  end if;

  v_function_def := replace(v_function_def, v_old, v_new);
  execute v_function_def;
end;
$$;

-- Reconcile the school's active bank account to its posted General Ledger.
-- This is idempotent and corrects the previously duplicated TZS 143,000
-- deduction without creating or changing any journal entries.
update finance.cash_accounts ca
set current_balance = coalesce(ca.opening_balance, 0) + coalesce((
  select sum(coalesce(jl.debit, 0) - coalesce(jl.credit, 0))
  from finance.journal_lines jl
  join finance.journal_entries je
    on je.id = jl.journal_entry_id
  where jl.account_id = ca.chart_of_account_id
    and je.school_id = ca.school_id
    and je.status::text = 'posted'
), 0)
where ca.id = 9
  and ca.school_id = 3
  and ca.is_active = true
  and ca.chart_of_account_id = '3fe9c147-dddb-4a0d-b785-e3e7b4106924'::uuid;

do $$
declare
  v_cash numeric(18,2);
  v_ledger numeric(18,2);
begin
  select current_balance into v_cash
  from finance.cash_accounts
  where id = 9 and school_id = 3 and is_active = true;

  select coalesce(ca.opening_balance, 0) + coalesce(sum(jl.debit - jl.credit), 0)
    into v_ledger
  from finance.cash_accounts ca
  left join finance.journal_lines jl
    on jl.account_id = ca.chart_of_account_id
  left join finance.journal_entries je
    on je.id = jl.journal_entry_id
   and je.school_id = ca.school_id
   and je.status::text = 'posted'
  where ca.id = 9 and ca.school_id = 3
  group by ca.opening_balance;

  if v_cash is distinct from v_ledger then
    raise exception 'Cash account reconciliation failed: cash %, ledger %', v_cash, v_ledger;
  end if;
end;
$$;
