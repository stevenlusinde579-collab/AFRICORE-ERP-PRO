-- Fee Control & Correction Center
-- All requests are school-scoped, append-only in intent, and approved separately.
-- Corrections update the existing student charge and setup in one transaction.

create table if not exists finance.fee_correction_requests (
    id uuid primary key default gen_random_uuid(),
    school_id bigint not null references public.schools(id),
    academic_year_id bigint not null references public.academic_years(id),
    status text not null default 'pending'
        check (status in ('pending', 'approved', 'rejected')),
    reason text not null check (length(trim(reason)) >= 8),
    requested_by uuid not null references auth.users(id),
    approved_by uuid references auth.users(id),
    approved_at timestamptz,
    rejected_by uuid references auth.users(id),
    rejected_at timestamptz,
    decision_note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists finance.fee_correction_request_items (
    id uuid primary key default gen_random_uuid(),
    request_id uuid not null references finance.fee_correction_requests(id) on delete cascade,
    school_id bigint not null references public.schools(id),
    charge_id uuid not null references finance.student_charges(id),
    payment_setup_id uuid not null references finance.student_payment_setups(id),
    student_id bigint not null references public.students(id),
    fee_item_id uuid,
    term_number smallint,
    old_amount numeric(18,2) not null check (old_amount > 0),
    paid_amount numeric(18,2) not null default 0 check (paid_amount >= 0),
    old_balance numeric(18,2) not null default 0,
    proposed_amount numeric(18,2) not null check (proposed_amount > 0),
    delta_amount numeric(18,2) not null,
    journal_entry_id uuid references finance.journal_entries(id),
    created_at timestamptz not null default now(),
    constraint fee_correction_request_items_unique_charge unique (request_id, charge_id)
);

create index if not exists fee_correction_requests_school_status_idx
    on finance.fee_correction_requests (school_id, status, created_at desc);
create index if not exists fee_correction_request_items_request_idx
    on finance.fee_correction_request_items (request_id, school_id);
create index if not exists fee_correction_request_items_charge_idx
    on finance.fee_correction_request_items (charge_id, school_id);

alter table finance.fee_correction_requests enable row level security;
alter table finance.fee_correction_request_items enable row level security;

drop policy if exists fee_correction_requests_school_select
    on finance.fee_correction_requests;
create policy fee_correction_requests_school_select
    on finance.fee_correction_requests
    as permissive for select to authenticated
    using (
        school_id = get_current_user_school_id()
        or is_current_user_super_admin()
    );

drop policy if exists fee_correction_requests_tenant_guard
    on finance.fee_correction_requests;
create policy fee_correction_requests_tenant_guard
    on finance.fee_correction_requests
    as restrictive for all to authenticated
    using (
        school_id = get_current_user_school_id()
        or is_current_user_super_admin()
    )
    with check (
        school_id = get_current_user_school_id()
        or is_current_user_super_admin()
    );

drop policy if exists fee_correction_items_school_select
    on finance.fee_correction_request_items;
create policy fee_correction_items_school_select
    on finance.fee_correction_request_items
    as permissive for select to authenticated
    using (
        school_id = get_current_user_school_id()
        or is_current_user_super_admin()
    );

drop policy if exists fee_correction_items_tenant_guard
    on finance.fee_correction_request_items;
create policy fee_correction_items_tenant_guard
    on finance.fee_correction_request_items
    as restrictive for all to authenticated
    using (
        school_id = get_current_user_school_id()
        or is_current_user_super_admin()
    )
    with check (
        school_id = get_current_user_school_id()
        or is_current_user_super_admin()
    );

grant select on finance.fee_correction_requests to authenticated;
grant select on finance.fee_correction_request_items to authenticated;

create or replace function finance.submit_fee_correction(
    p_school_id bigint,
    p_academic_year_id bigint,
    p_reason text,
    p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = finance, public, auth, pg_temp
as $function$
declare
    v_user_id uuid := auth.uid();
    v_profile_school bigint;
    v_is_super_admin boolean := false;
    v_is_accountant boolean := false;
    v_request_id uuid;
    v_item jsonb;
    v_charge finance.student_charges%rowtype;
    v_setup finance.student_payment_setups%rowtype;
    v_charge_id uuid;
    v_new_amount numeric(18,2);
    v_item_count integer := 0;
begin
    if v_user_id is null then
        raise exception 'Authentication required';
    end if;

    if coalesce(length(trim(p_reason)), 0) < 8 then
        raise exception 'Please provide a clear reason of at least 8 characters';
    end if;

    if jsonb_typeof(coalesce(p_items, 'null'::jsonb)) <> 'array'
       or jsonb_array_length(p_items) = 0 then
        raise exception 'Select at least one fee charge to correct';
    end if;

    select school_id into v_profile_school
      from public.profiles
     where id = v_user_id
     limit 1;

    select
        coalesce(bool_or(lower(r.role_name) = 'super admin'), false),
        coalesce(bool_or(lower(r.role_name) = 'accountant'), false)
      into v_is_super_admin, v_is_accountant
      from public.profile_roles pr
      join public.roles r on r.id = pr.role_id
     where pr.profile_id = v_user_id
       and pr.is_active = true
       and (pr.school_id = p_school_id or pr.school_id is null);

    if not v_is_super_admin and not v_is_accountant then
        raise exception 'Only an Accountant or Super Admin can submit a fee correction';
    end if;

    if not v_is_super_admin and v_profile_school is distinct from p_school_id then
        raise exception 'You are not authorized for this school';
    end if;

    if not exists (
        select 1 from public.academic_years
         where id = p_academic_year_id
           and school_id = p_school_id
    ) then
        raise exception 'Academic year does not belong to this school';
    end if;

    insert into finance.fee_correction_requests (
        school_id, academic_year_id, reason, requested_by
    ) values (
        p_school_id, p_academic_year_id, trim(p_reason), v_user_id
    ) returning id into v_request_id;

    for v_item in select value from jsonb_array_elements(p_items)
    loop
        begin
            v_charge_id := (v_item->>'charge_id')::uuid;
            v_new_amount := round((v_item->>'proposed_amount')::numeric, 2);
        exception when others then
            raise exception 'Each correction item needs a valid charge_id and proposed_amount';
        end;

        if v_new_amount <= 0 then
            raise exception 'Corrected fee amount must be greater than zero';
        end if;

        select * into v_charge
          from finance.student_charges
         where id = v_charge_id
           and school_id = p_school_id
           and academic_year_id = p_academic_year_id
         for update;

        if not found then
            raise exception 'A selected fee charge does not belong to this school and academic year';
        end if;

        if v_charge.payment_setup_id is null then
            raise exception 'A selected charge is not linked to a Payment Setup and cannot be corrected here';
        end if;

        select * into v_setup
          from finance.student_payment_setups
         where id = v_charge.payment_setup_id
           and school_id = p_school_id
           and student_id = v_charge.student_id
           and academic_year_id = p_academic_year_id
         for update;

        if not found then
            raise exception 'The linked Payment Setup could not be verified';
        end if;

        if round(v_new_amount, 2) = round(v_charge.amount, 2) then
            raise exception 'A selected correction has no amount change';
        end if;

        -- A fee cannot be reduced below money already allocated to it.
        -- A future credit-note workflow will handle refunds/unapplied credits.
        if v_new_amount < v_charge.paid_amount then
            raise exception 'This correction is below the amount already paid. It needs an approved refund or student-credit process and cannot be applied as a fee correction yet.';
        end if;

        insert into finance.fee_correction_request_items (
            request_id, school_id, charge_id, payment_setup_id,
            student_id, fee_item_id, term_number,
            old_amount, paid_amount, old_balance,
            proposed_amount, delta_amount
        ) values (
            v_request_id, p_school_id, v_charge.id, v_setup.id,
            v_charge.student_id, v_charge.fee_item_id, v_charge.term_number,
            v_charge.amount, v_charge.paid_amount, v_charge.balance,
            v_new_amount, v_new_amount - v_charge.amount
        );

        v_item_count := v_item_count + 1;
    end loop;

    if v_item_count = 0 then
        raise exception 'No valid correction items were submitted';
    end if;

    insert into finance.audit_logs (
        school_id, user_id, action, module, table_name, record_id,
        old_values, new_values, reason
    ) values (
        p_school_id, v_user_id, 'FEE_CORRECTION_REQUESTED',
        'Fee Control & Correction', 'fee_correction_requests', v_request_id,
        null,
        jsonb_build_object('academic_year_id', p_academic_year_id, 'item_count', v_item_count, 'status', 'pending'),
        trim(p_reason)
    );

    return v_request_id;
end;
$function$;

create or replace function finance.approve_fee_correction(
    p_request_id uuid,
    p_decision_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = finance, public, auth, pg_temp
as $function$
declare
    v_user_id uuid := auth.uid();
    v_request finance.fee_correction_requests%rowtype;
    v_item finance.fee_correction_request_items%rowtype;
    v_charge finance.student_charges%rowtype;
    v_setup finance.student_payment_setups%rowtype;
    v_profile_school bigint;
    v_is_super_admin boolean := false;
    v_is_headmaster boolean := false;
    v_receivable_account uuid;
    v_revenue_account uuid;
    v_period_id uuid;
    v_delta numeric(18,2);
    v_journal_id uuid;
    v_reference text;
    v_lines jsonb;
begin
    if v_user_id is null then
        raise exception 'Authentication required';
    end if;

    select * into v_request
      from finance.fee_correction_requests
     where id = p_request_id
     for update;

    if not found then
        raise exception 'Fee correction request not found';
    end if;

    select school_id into v_profile_school
      from public.profiles
     where id = v_user_id
     limit 1;

    select
        coalesce(bool_or(lower(r.role_name) = 'super admin'), false),
        coalesce(bool_or(lower(r.role_name) = 'headmaster'), false)
      into v_is_super_admin, v_is_headmaster
      from public.profile_roles pr
      join public.roles r on r.id = pr.role_id
     where pr.profile_id = v_user_id
       and pr.is_active = true
       and (pr.school_id = v_request.school_id or pr.school_id is null);

    if not v_is_super_admin and not v_is_headmaster then
        raise exception 'Only the Headmaster or Super Admin can approve fee corrections';
    end if;

    if not v_is_super_admin and v_profile_school is distinct from v_request.school_id then
        raise exception 'You are not authorized for this school';
    end if;

    if v_request.requested_by = v_user_id then
        raise exception 'The person who requested a correction cannot approve the same request';
    end if;

    if v_request.status <> 'pending' then
        raise exception 'Only pending fee correction requests can be approved';
    end if;

    select id into v_receivable_account
      from finance.chart_of_accounts
     where school_id = v_request.school_id
       and account_code = '1100'
       and account_type = 'asset'
       and account_category = 'Accounts Receivable'
       and is_active = true
     limit 1;

    if v_receivable_account is null then
        raise exception 'Student Receivables account 1100 is not configured for this school';
    end if;

    select id into v_period_id
      from finance.accounting_periods
     where school_id = v_request.school_id
       and current_date between start_date and end_date
       and status = 'open'
     order by start_date desc
     limit 1;

    if v_period_id is null then
        raise exception 'No open accounting period covers today. Open the accounting period before approving this correction';
    end if;

    for v_item in
        select * from finance.fee_correction_request_items
         where request_id = v_request.id
           and school_id = v_request.school_id
         order by created_at, id
         for update
    loop
        select * into v_charge
          from finance.student_charges
         where id = v_item.charge_id
           and school_id = v_request.school_id
         for update;

        if not found then
            raise exception 'A fee charge was removed or moved after the request was submitted';
        end if;

        select * into v_setup
          from finance.student_payment_setups
         where id = v_item.payment_setup_id
           and school_id = v_request.school_id
           and student_id = v_item.student_id
         for update;

        if not found then
            raise exception 'The linked Payment Setup is no longer available';
        end if;

        if round(v_charge.amount, 2) <> round(v_item.old_amount, 2)
           or round(v_charge.paid_amount, 2) <> round(v_item.paid_amount, 2)
           or round(v_setup.amount, 2) <> round(v_item.old_amount, 2) then
            raise exception 'A fee or payment changed after this request was submitted. Refresh the request and submit a new correction';
        end if;

        if v_item.proposed_amount < v_charge.paid_amount then
            raise exception 'This correction would create an overpayment. Use the approved refund or student-credit process first';
        end if;

        v_delta := round(v_item.proposed_amount - v_charge.amount, 2);
        v_revenue_account := v_charge.revenue_account_id;

        if v_revenue_account is null then
            select revenue_account_id into v_revenue_account
              from finance.fee_items
             where id = v_charge.fee_item_id
               and school_id = v_request.school_id
               and is_active = true
             limit 1;
        end if;

        if v_revenue_account is null then
            raise exception 'The fee item has no active revenue account. Correct the fee item setup before approval';
        end if;

        if v_delta <> 0 then
            if v_delta > 0 then
                v_lines := jsonb_build_array(
                    jsonb_build_object('account_id', v_receivable_account, 'debit', v_delta, 'credit', 0, 'party_id', v_charge.student_id, 'description', 'Fee correction - additional receivable'),
                    jsonb_build_object('account_id', v_revenue_account, 'debit', 0, 'credit', v_delta, 'party_id', v_charge.student_id, 'description', 'Fee correction - additional fee revenue')
                );
            else
                v_lines := jsonb_build_array(
                    jsonb_build_object('account_id', v_revenue_account, 'debit', abs(v_delta), 'credit', 0, 'party_id', v_charge.student_id, 'description', 'Fee correction - reduce fee revenue'),
                    jsonb_build_object('account_id', v_receivable_account, 'debit', 0, 'credit', abs(v_delta), 'party_id', v_charge.student_id, 'description', 'Fee correction - reduce student receivable')
                );
            end if;

            v_reference := 'FCR-' || substr(replace(v_request.id::text, '-', ''), 1, 12)
                || '-' || substr(replace(v_item.id::text, '-', ''), 1, 6);

            v_journal_id := finance.post_journal_entry(
                v_request.school_id,
                current_date,
                'Approved student fee correction: ' || v_charge.description,
                v_reference,
                'fee_correction',
                v_request.id,
                v_user_id,
                v_period_id,
                v_lines
            );

            update finance.student_charges
               set amount = v_item.proposed_amount,
                   balance = greatest(v_item.proposed_amount - v_charge.paid_amount, 0),
                   status = case
                       when v_charge.paid_amount >= v_item.proposed_amount then 'paid'
                       when v_charge.paid_amount > 0 then 'partially_paid'
                       else 'posted'
                   end
             where id = v_charge.id
               and school_id = v_request.school_id;

            update finance.student_payment_setups
               set amount = v_item.proposed_amount,
                   updated_at = now()
             where id = v_setup.id
               and school_id = v_request.school_id;

            update finance.fee_correction_request_items
               set journal_entry_id = v_journal_id
             where id = v_item.id
               and request_id = v_request.id;

            insert into finance.audit_logs (
                school_id, user_id, action, module, table_name, record_id,
                old_values, new_values, reason
            ) values (
                v_request.school_id, v_user_id, 'FEE_CORRECTION_APPLIED',
                'Fee Control & Correction', 'student_charges', v_charge.id,
                jsonb_build_object('amount', v_charge.amount, 'paid_amount', v_charge.paid_amount, 'balance', v_charge.balance),
                jsonb_build_object('amount', v_item.proposed_amount, 'paid_amount', v_charge.paid_amount, 'balance', greatest(v_item.proposed_amount - v_charge.paid_amount, 0), 'journal_entry_id', v_journal_id),
                coalesce(nullif(trim(p_decision_note), ''), v_request.reason)
            );
        end if;
    end loop;

    update finance.fee_correction_requests
       set status = 'approved',
           approved_by = v_user_id,
           approved_at = now(),
           decision_note = nullif(trim(p_decision_note), ''),
           updated_at = now()
     where id = v_request.id;

    return v_request.id;
end;
$function$;

create or replace function finance.reject_fee_correction(
    p_request_id uuid,
    p_decision_note text
)
returns uuid
language plpgsql
security definer
set search_path = finance, public, auth, pg_temp
as $function$
declare
    v_user_id uuid := auth.uid();
    v_request finance.fee_correction_requests%rowtype;
    v_profile_school bigint;
    v_is_super_admin boolean := false;
    v_is_headmaster boolean := false;
begin
    if v_user_id is null then
        raise exception 'Authentication required';
    end if;

    if coalesce(length(trim(p_decision_note)), 0) < 5 then
        raise exception 'Please provide a reason for rejecting this correction';
    end if;

    select * into v_request
      from finance.fee_correction_requests
     where id = p_request_id
     for update;

    if not found then
        raise exception 'Fee correction request not found';
    end if;

    select school_id into v_profile_school
      from public.profiles
     where id = v_user_id
     limit 1;

    select
        coalesce(bool_or(lower(r.role_name) = 'super admin'), false),
        coalesce(bool_or(lower(r.role_name) = 'headmaster'), false)
      into v_is_super_admin, v_is_headmaster
      from public.profile_roles pr
      join public.roles r on r.id = pr.role_id
     where pr.profile_id = v_user_id
       and pr.is_active = true
       and (pr.school_id = v_request.school_id or pr.school_id is null);

    if not v_is_super_admin and not v_is_headmaster then
        raise exception 'Only the Headmaster or Super Admin can reject fee corrections';
    end if;

    if not v_is_super_admin and v_profile_school is distinct from v_request.school_id then
        raise exception 'You are not authorized for this school';
    end if;

    if v_request.requested_by = v_user_id then
        raise exception 'The person who requested a correction cannot reject the same request';
    end if;

    if v_request.status <> 'pending' then
        raise exception 'Only pending fee correction requests can be rejected';
    end if;

    update finance.fee_correction_requests
       set status = 'rejected',
           rejected_by = v_user_id,
           rejected_at = now(),
           decision_note = trim(p_decision_note),
           updated_at = now()
     where id = v_request.id;

    insert into finance.audit_logs (
        school_id, user_id, action, module, table_name, record_id,
        old_values, new_values, reason
    ) values (
        v_request.school_id, v_user_id, 'FEE_CORRECTION_REJECTED',
        'Fee Control & Correction', 'fee_correction_requests', v_request.id,
        jsonb_build_object('status', 'pending'),
        jsonb_build_object('status', 'rejected'),
        trim(p_decision_note)
    );

    return v_request.id;
end;
$function$;

revoke all on function finance.submit_fee_correction(bigint, bigint, text, jsonb) from public, anon;
revoke all on function finance.approve_fee_correction(uuid, text) from public, anon;
revoke all on function finance.reject_fee_correction(uuid, text) from public, anon;

grant execute on function finance.submit_fee_correction(bigint, bigint, text, jsonb) to authenticated;
grant execute on function finance.approve_fee_correction(uuid, text) to authenticated;
grant execute on function finance.reject_fee_correction(uuid, text) to authenticated;
