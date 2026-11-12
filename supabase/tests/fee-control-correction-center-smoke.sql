-- Fee Control & Correction Center regression smoke checks.
-- Run after the migration on a disposable/staging database.

do $$
declare
    v_submit text;
    v_approve text;
    v_reject text;
    v_balance_generated text;
begin
    if to_regclass('finance.fee_correction_requests') is null
       or to_regclass('finance.fee_correction_request_items') is null then
        raise exception 'Fee correction request tables are missing';
    end if;

    select lower(pg_get_functiondef(
        'finance.submit_fee_correction(bigint,bigint,text,jsonb)'::regprocedure
    )) into v_submit;

    select lower(pg_get_functiondef(
        'finance.approve_fee_correction(uuid,text)'::regprocedure
    )) into v_approve;

    select lower(pg_get_functiondef(
        'finance.reject_fee_correction(uuid,text)'::regprocedure
    )) into v_reject;

    if position('only an accountant or super admin' in v_submit) = 0 then
        raise exception 'Only Accountant/Super Admin may submit a correction';
    end if;

    if position('proposed_amount < v_charge.paid_amount' in v_submit) = 0 then
        raise exception 'Corrections below paid amounts must be blocked';
    end if;

    if position('the saved payment setup and student charge do not match' in v_submit) = 0
       or position('already has a pending correction request' in v_submit) = 0 then
        raise exception 'Correction requests must reject stale setup links and duplicate pending requests';
    end if;

    if position('only the headmaster or super admin' in v_approve) = 0
       or position('v_request.requested_by = v_user_id' in v_approve) = 0 then
        raise exception 'Approval must be restricted and separated from requester';
    end if;

    if position('post_journal_entry' in v_approve) = 0
       or position('fee_correction' in v_approve) = 0 then
        raise exception 'Approved corrections must post accounting journals';
    end if;

    if position('old_amount' in v_approve) = 0
       or position('paid_amount' in v_approve) = 0
       or position('fee correction was submitted' in v_approve) > 0 then
        raise exception 'Approval must retain stale-data and payment checks';
    end if;

    if position('only the headmaster or super admin' in v_reject) = 0
       or position('rejected' in v_reject) = 0 then
        raise exception 'Rejection workflow is incomplete';
    end if;

    select is_generated
      into v_balance_generated
      from information_schema.columns
     where table_schema = 'finance'
       and table_name = 'student_charges'
       and column_name = 'balance';

    if v_balance_generated is distinct from 'ALWAYS' then
        raise exception 'Expected student charge balance to remain generated';
    end if;

    if position('balance =' in v_approve) > 0 then
        raise exception 'Approval must not write to generated balance column';
    end if;
end;
$$;
