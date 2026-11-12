-- Fix fee correction journal party reference.
-- journal_lines.party_id references finance.parties(id), not public.students(id).
-- Keep it NULL when no mapped student party exists; do not fabricate party records.
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
    v_party_id bigint;
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

        -- journal_lines.party_id references finance.parties(id), not students(id).
        -- Use the mapped student party when one exists; party_id is optional.
        select id into v_party_id
          from finance.parties
         where school_id = v_request.school_id
           and student_id = v_charge.student_id
           and party_type = 'student'::finance.party_type
           and is_active = true
         order by id
         limit 1;

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
                    jsonb_build_object('account_id', v_receivable_account, 'debit', v_delta, 'credit', 0, 'party_id', v_party_id, 'description', 'Fee correction - additional receivable'),
                    jsonb_build_object('account_id', v_revenue_account, 'debit', 0, 'credit', v_delta, 'party_id', v_party_id, 'description', 'Fee correction - additional fee revenue')
                );
            else
                v_lines := jsonb_build_array(
                    jsonb_build_object('account_id', v_revenue_account, 'debit', abs(v_delta), 'credit', 0, 'party_id', v_party_id, 'description', 'Fee correction - reduce fee revenue'),
                    jsonb_build_object('account_id', v_receivable_account, 'debit', 0, 'credit', abs(v_delta), 'party_id', v_party_id, 'description', 'Fee correction - reduce student receivable')
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

            -- balance is a GENERATED ALWAYS column (amount - paid_amount).
            -- Update amount only; PostgreSQL recalculates balance automatically.
            update finance.student_charges
               set amount = v_item.proposed_amount,
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

