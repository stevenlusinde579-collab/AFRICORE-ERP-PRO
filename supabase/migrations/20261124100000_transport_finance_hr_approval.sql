-- Secure, atomic HR review and Finance posting for Transport transactions.
-- This function is called by the backend service role, but validates the acting
-- user's HR Manager / Super Admin role inside the database before posting.

create or replace function public.approve_transport_finance_transaction(
  p_transaction_id bigint,
  p_school_id bigint,
  p_actor_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, finance, pg_temp
as $$
declare
  v_tx public.transport_finance_transactions%rowtype;
  v_receipt_id uuid;
  v_expense_id bigint;
  v_journal_id uuid;
  v_cash_chart_id uuid;
  v_account_type finance.account_type;
begin
  if p_actor_id is null or p_school_id is null then
    raise exception 'Reviewer and school context are required';
  end if;

  if not (
    exists (
      select 1
      from public.profile_roles pr
      join public.roles r on r.id = pr.role_id
      where pr.profile_id = p_actor_id
        and pr.is_active = true
        and lower(trim(r.role_name)) = 'super admin'
    )
    or exists (
      select 1
      from public.profile_roles pr
      join public.roles r on r.id = pr.role_id
      where pr.profile_id = p_actor_id
        and pr.school_id = p_school_id
        and pr.is_active = true
        and lower(trim(r.role_name)) = 'hr manager'
    )
    or exists (
      select 1
      from public.profiles p
      join public.roles r on r.id = p.role_id
      where p.id = p_actor_id
        and (
          lower(trim(r.role_name)) = 'super admin'
          or (p.school_id = p_school_id and lower(trim(r.role_name)) = 'hr manager')
        )
    )
  ) then
    raise exception 'Only the school HR Manager or Super Admin can approve transport finance transactions';
  end if;

  select * into v_tx
  from public.transport_finance_transactions
  where id = p_transaction_id
    and school_id = p_school_id
  for update;

  if not found then
    raise exception 'Transport transaction was not found in this school';
  end if;
  if v_tx.status <> 'pending' then
    raise exception 'Only pending transport transactions can be approved';
  end if;

  select ca.chart_of_account_id
  into v_cash_chart_id
  from finance.cash_accounts ca
  where ca.id = v_tx.cash_account_id
    and ca.school_id = p_school_id
    and ca.is_active = true
  for update;

  if v_cash_chart_id is null then
    raise exception 'Selected cash or bank account is unavailable for this school';
  end if;

  if v_tx.transaction_type = 'income' then
    select a.account_type into v_account_type
    from finance.chart_of_accounts a
    where a.id = v_tx.revenue_account_id
      and a.school_id = p_school_id
      and a.is_active = true;

    if not found or v_account_type <> 'revenue' then
      raise exception 'Selected income account is not an active revenue account for this school';
    end if;

    select rr.receipt_id, rr.journal_entry_id
    into v_receipt_id, v_journal_id
    from finance.record_receipt(
      p_school_id,
      v_tx.transaction_number,
      v_tx.transaction_date,
      v_tx.student_id,
      v_tx.payer_name,
      v_tx.revenue_account_id,
      v_tx.cash_account_id,
      coalesce(v_tx.payment_method, 'cash'),
      v_tx.amount,
      v_tx.reference_number,
      v_tx.description,
      p_actor_id,
      p_actor_id
    ) rr;

    -- Mark the ledger source explicitly so Finance reports classify it as Transport.
    update finance.journal_entries
    set source_type = 'transport_income',
        reference_number = v_tx.transaction_number,
        description = 'Transport income: ' || v_tx.category || ' — ' || v_tx.description
    where id = v_journal_id
      and school_id = p_school_id;

    update finance.receipts
    set description = v_tx.category || ': ' || v_tx.description
    where id = v_receipt_id
      and school_id = p_school_id;

  elsif v_tx.transaction_type = 'expense' then
    if coalesce(v_tx.payment_method, 'cash') not in ('cash','bank','mobile_money') then
      raise exception 'Transport expenses must use cash, bank or mobile money payment method';
    end if;

    select a.account_type into v_account_type
    from finance.chart_of_accounts a
    where a.id = v_tx.expense_account_id
      and a.school_id = p_school_id
      and a.is_active = true
      and a.allow_manual_posting = true;

    if not found or v_account_type <> 'expense' then
      raise exception 'Selected expense account is not an active manual-posting expense account for this school';
    end if;

    insert into public.expenses (
      school_id, expense_category, description, amount, expense_date,
      approved_by, payment_status, payment_method, financial_account_id,
      finance_expense_account_id, reference_number, created_by
    ) values (
      p_school_id, v_tx.category, v_tx.description, v_tx.amount, v_tx.transaction_date,
      p_actor_id, 'paid', coalesce(v_tx.payment_method, 'cash'), v_tx.cash_account_id,
      v_tx.expense_account_id, v_tx.reference_number, v_tx.submitted_by
    ) returning id into v_expense_id;

    v_journal_id := finance.post_journal_entry(
      p_school_id,
      v_tx.transaction_date,
      'Transport expense: ' || v_tx.description,
      v_tx.transaction_number,
      'transport_expense',
      null,
      p_actor_id,
      null,
      jsonb_build_array(
        jsonb_build_object(
          'account_id', v_tx.expense_account_id,
          'debit', v_tx.amount,
          'credit', 0,
          'description', v_tx.description
        ),
        jsonb_build_object(
          'account_id', v_cash_chart_id,
          'debit', 0,
          'credit', v_tx.amount,
          'description', 'Payment for transport expense'
        )
      )
    );

    update public.expenses
    set journal_entry_id = v_journal_id
    where id = v_expense_id;

    update finance.cash_accounts
    set current_balance = current_balance - v_tx.amount
    where id = v_tx.cash_account_id
      and school_id = p_school_id;
  else
    raise exception 'Unsupported transport transaction type';
  end if;

  update finance.journal_entries
  set approved_by = p_actor_id,
      approved_at = now(),
      updated_at = now()
  where id = v_journal_id
    and school_id = p_school_id;

  update public.transport_finance_transactions
  set status = 'approved',
      reviewed_by = p_actor_id,
      reviewed_at = now(),
      receipt_id = v_receipt_id,
      expense_id = v_expense_id,
      journal_entry_id = v_journal_id,
      updated_at = now()
  where id = v_tx.id
    and school_id = p_school_id;

  return jsonb_build_object(
    'transaction_id', v_tx.id,
    'status', 'approved',
    'receipt_id', v_receipt_id,
    'expense_id', v_expense_id,
    'journal_entry_id', v_journal_id
  );
end;
$$;

create or replace function public.reject_transport_finance_transaction(
  p_transaction_id bigint,
  p_school_id bigint,
  p_actor_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tx public.transport_finance_transactions%rowtype;
begin
  if p_actor_id is null or p_school_id is null then
    raise exception 'Reviewer and school context are required';
  end if;

  if not (
    exists (
      select 1 from public.profile_roles pr
      join public.roles r on r.id = pr.role_id
      where pr.profile_id = p_actor_id and pr.is_active = true
        and lower(trim(r.role_name)) = 'super admin'
    )
    or exists (
      select 1 from public.profile_roles pr
      join public.roles r on r.id = pr.role_id
      where pr.profile_id = p_actor_id and pr.school_id = p_school_id
        and pr.is_active = true and lower(trim(r.role_name)) = 'hr manager'
    )
    or exists (
      select 1 from public.profiles p
      join public.roles r on r.id = p.role_id
      where p.id = p_actor_id and (
        lower(trim(r.role_name)) = 'super admin'
        or (p.school_id = p_school_id and lower(trim(r.role_name)) = 'hr manager')
      )
    )
  ) then
    raise exception 'Only the school HR Manager or Super Admin can reject transport finance transactions';
  end if;

  select * into v_tx from public.transport_finance_transactions
  where id = p_transaction_id and school_id = p_school_id
  for update;

  if not found then raise exception 'Transport transaction was not found in this school'; end if;
  if v_tx.status <> 'pending' then raise exception 'Only pending transport transactions can be rejected'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'A rejection reason is required'; end if;

  update public.transport_finance_transactions
  set status = 'rejected',
      reviewed_by = p_actor_id,
      reviewed_at = now(),
      rejection_reason = trim(p_reason),
      updated_at = now()
  where id = v_tx.id and school_id = p_school_id;

  return jsonb_build_object('transaction_id', v_tx.id, 'status', 'rejected');
end;
$$;

revoke all on function public.approve_transport_finance_transaction(bigint,bigint,uuid) from public, anon, authenticated;
revoke all on function public.reject_transport_finance_transaction(bigint,bigint,uuid,text) from public, anon, authenticated;
grant execute on function public.approve_transport_finance_transaction(bigint,bigint,uuid) to service_role;
grant execute on function public.reject_transport_finance_transaction(bigint,bigint,uuid,text) to service_role;

-- Secretary must also be able to read the Transport workspace.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.permission_name = 'view_transport'
where lower(trim(r.role_name)) = 'secretary'
and not exists (
  select 1 from public.role_permissions rp
  where rp.role_id = r.id and rp.permission_id = p.id
);
