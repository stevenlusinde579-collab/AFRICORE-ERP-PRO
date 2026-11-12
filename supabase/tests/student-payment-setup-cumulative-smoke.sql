-- Regression checks for cumulative student payment setup behavior.
-- Run after applying the migrations to a disposable/staging database.

do $$
declare
    v_save_definition text;
    v_charge_definition text;
    v_term_check text;
begin
    select lower(pg_get_functiondef(
        'finance.save_student_payment_setup(bigint,bigint,bigint,bigint,uuid,uuid,numeric,numeric,jsonb)'::regprocedure
    )) into v_save_definition;

    if position('delete from finance.student_payment_setups' in v_save_definition) > 0 then
        raise exception 'Regression: saving a payment setup must not delete previous setup history';
    end if;

    if position('amount = amount + v_amount' in v_save_definition) = 0 then
        raise exception 'Regression: additional setup amounts must accumulate';
    end if;

    if position('ensure_student_charge_for_setup' in v_save_definition) = 0 then
        raise exception 'Regression: saved setups must immediately ensure a student charge';
    end if;

    select lower(pg_get_functiondef(
        'finance.ensure_student_charge_for_setup(uuid,date,uuid)'::regprocedure
    )) into v_charge_definition;

    if position('student_charge_adjustment' in v_charge_definition) = 0 then
        raise exception 'Regression: charge increases must create a balanced accounting adjustment';
    end if;

    if position('greatest(s.amount - c.amount, 0)' in v_charge_definition) = 0 then
        raise exception 'Regression: only the additional unpaid charge amount may be posted';
    end if;

    select lower(pg_get_constraintdef(oid))
      into v_term_check
      from pg_constraint
     where conrelid = 'finance.student_payment_setups'::regclass
       and conname = 'student_payment_setups_term_check';

    if v_term_check is null or position('3' in v_term_check) = 0 then
        raise exception 'Regression: Other Fee must support Term 3';
    end if;
end;
$$;
