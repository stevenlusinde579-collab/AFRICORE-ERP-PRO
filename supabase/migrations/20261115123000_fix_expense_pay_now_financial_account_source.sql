-- Keep Add Expense (Pay Now) aligned with the current school-scoped
-- finance.cash_accounts model used by Cash & Financial Accounts.
-- Preserve the existing RPC contract and public.expenses history field.

DO $migration$
DECLARE
    v_definition text;
    v_old text;
    v_new text;
BEGIN
    SELECT pg_get_functiondef(
        'public.create_expense_with_payable(date,text,text,numeric,text,character varying,bigint,uuid,character varying,bigint,character varying,date)'::regprocedure
    )
    INTO v_definition;

    IF v_definition IS NULL THEN
        RAISE EXCEPTION 'create_expense_with_payable function was not found';
    END IF;

    v_old := 'v_financial public.financial_accounts%rowtype;';
    v_new := 'v_financial finance.cash_accounts%rowtype;';
    IF position(v_old IN v_definition) = 0 THEN
        RAISE EXCEPTION 'Expected financial account row type was not found';
    END IF;
    v_definition := replace(v_definition, v_old, v_new);

    v_old := 'from public.financial_accounts';
    v_new := 'from finance.cash_accounts';
    IF position(v_old IN v_definition) = 0 THEN
        RAISE EXCEPTION 'Expected legacy financial account lookup was not found';
    END IF;
    v_definition := replace(v_definition, v_old, v_new);

    v_old := 'and school_id = v_school_id' || chr(10) || '    for update;';
    v_new := 'and school_id = v_school_id' || chr(10) ||
             '      and is_active = true' || chr(10) ||
             '    for update;';
    IF position(v_old IN v_definition) = 0 THEN
        RAISE EXCEPTION 'Expected school-scoped account lock was not found';
    END IF;
    v_definition := replace(v_definition, v_old, v_new);

    v_old := 'select account_code into v_public_payment_coa_code' || chr(10) ||
             '    from public.chart_of_accounts' || chr(10) ||
             '    where id = v_financial.chart_of_account_id' || chr(10) ||
             '      and account_type = ''asset''' || chr(10) ||
             '      and is_active = true' || chr(10) ||
             '    limit 1;';
    v_new := 'select account_code into v_public_payment_coa_code' || chr(10) ||
             '    from finance.chart_of_accounts' || chr(10) ||
             '    where id = v_financial.chart_of_account_id' || chr(10) ||
             '      and school_id = v_school_id' || chr(10) ||
             '      and account_type = ''asset''' || chr(10) ||
             '      and is_active = true' || chr(10) ||
             '    limit 1;';
    IF position(v_old IN v_definition) = 0 THEN
        RAISE EXCEPTION 'Expected linked asset account lookup was not found';
    END IF;
    v_definition := replace(v_definition, v_old, v_new);

    v_old := 'if not found then' || chr(10) ||
             '      raise exception ''Selected financial account does not belong to this school'';';
    v_new := 'if not found then' || chr(10) ||
             '      raise exception ''Selected financial account does not belong to this school or is inactive'';';
    IF position(v_old IN v_definition) = 0 THEN
        RAISE EXCEPTION 'Expected financial account validation was not found';
    END IF;
    v_definition := replace(v_definition, v_old, v_new);

    v_old := 'if not found then' || chr(10) ||
             '      raise exception ''Selected financial account does not belong to this school or is inactive'';' || chr(10) ||
             '    end if;';
    v_new := v_old || chr(10) ||
             chr(10) ||
             '    if coalesce(v_financial.current_balance, 0) < p_amount then' || chr(10) ||
             '      raise exception ''Insufficient funds in selected financial account'';' || chr(10) ||
             '    end if;';
    IF position(v_old IN v_definition) = 0 THEN
        RAISE EXCEPTION 'Expected financial account existence check was not found';
    END IF;
    v_definition := replace(v_definition, v_old, v_new);

    v_old := 'update public.financial_accounts';
    v_new := 'update finance.cash_accounts';
    IF position(v_old IN v_definition) = 0 THEN
        RAISE EXCEPTION 'Expected legacy financial account balance update was not found';
    END IF;
    v_definition := replace(v_definition, v_old, v_new);

    EXECUTE v_definition;
END;
$migration$;
