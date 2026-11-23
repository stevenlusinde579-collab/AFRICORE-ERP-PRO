-- Keep payroll deductions individually named and amount-specific in the immutable print snapshot.
-- Backward compatible: legacy deduction totals remain valid when no named components exist.

create or replace function public.hr_payroll_create(
    p_school_id bigint,
    p_payroll_month date,
    p_created_by uuid,
    p_items jsonb
)
returns bigint
language plpgsql
set search_path = public, finance
as $$
declare
    v_payroll_id bigint;
    v_item jsonb;
    v_employee public.employees%rowtype;
    v_profile public.employee_financial_profiles%rowtype;
    v_contract_salary numeric(14,2);
    v_basic numeric(14,2);
    v_allowances numeric(14,2);
    v_deductions numeric(14,2);
    v_net numeric(14,2);
    v_components jsonb;
    v_total_basic numeric(14,2) := 0;
    v_total_allowances numeric(14,2) := 0;
    v_total_deductions numeric(14,2) := 0;
    v_total_net numeric(14,2) := 0;
    v_temp_number text;
begin
    if p_school_id is null or p_created_by is null then
        raise exception 'School and preparer are required';
    end if;
    if p_payroll_month is null or extract(day from p_payroll_month) <> 1 then
        raise exception 'Payroll month must be the first day of the selected month';
    end if;
    if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array'
       or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
        raise exception 'Select at least one employee';
    end if;

    perform pg_advisory_xact_lock(
        p_school_id::integer,
        (extract(year from p_payroll_month)::integer * 100) + extract(month from p_payroll_month)::integer
    );

    if exists (
        select 1 from public.payrolls
        where school_id = p_school_id
          and payroll_month = p_payroll_month
          and status <> 'cancelled'
    ) then
        raise exception 'A payroll already exists for this school and month';
    end if;

    if (
        select count(distinct (x->>'employee_id'))
        from jsonb_array_elements(p_items) x
    ) <> jsonb_array_length(p_items) then
        raise exception 'An employee can appear only once in a payroll';
    end if;

    v_temp_number := 'TMP-' || gen_random_uuid()::text;
    insert into public.payrolls (
        school_id, payroll_number, payroll_month, status, workflow_managed,
        total_basic_salary, total_allowances, total_deductions,
        total_net_salary, created_by
    ) values (
        p_school_id, v_temp_number, p_payroll_month, 'draft', true,
        0, 0, 0, 0, p_created_by
    ) returning id into v_payroll_id;

    for v_item in select value from jsonb_array_elements(p_items)
    loop
        if coalesce(v_item->>'employee_id', '') !~ '^[0-9]+$' then
            raise exception 'Invalid employee ID in payroll';
        end if;

        select * into v_employee
        from public.employees
        where id = (v_item->>'employee_id')::bigint
          and school_id = p_school_id
          and lower(coalesce(status, 'active')) in ('active', 'enabled', 'working');
        if not found then
            raise exception 'Employee % is not active in this school', v_item->>'employee_id';
        end if;

        select * into v_profile
        from public.employee_financial_profiles
        where employee_id = v_employee.id;

        select hc.basic_salary into v_contract_salary
        from public.hr_employment_contracts hc
        where hc.employee_id = v_employee.id
          and hc.school_id = p_school_id
          and hc.status = 'active'
          and hc.start_date <= (p_payroll_month + interval '1 month - 1 day')::date
          and (hc.end_date is null or hc.end_date >= p_payroll_month)
          and hc.basic_salary is not null
        order by hc.start_date desc, hc.id desc
        limit 1;

        v_basic := round(coalesce((v_item->>'basic_salary')::numeric, v_contract_salary, v_employee.basic_salary, 0), 2);
        v_allowances := round(coalesce((v_item->>'allowances')::numeric, 0), 2);
        v_components := coalesce(v_item->'components', '[]'::jsonb);
        if jsonb_typeof(v_components) <> 'array' then
            raise exception 'Salary components must be an array';
        end if;
        if exists (
            select 1 from jsonb_array_elements(v_components) component
            where component->>'type' = 'deduction'
              and (
                coalesce(trim(component->>'name'), '') = ''
                or jsonb_typeof(component->'amount') <> 'number'
                or (component->>'amount')::numeric < 0
            raise exception 'Salary values cannot be negative or exceed gross earnings';
        end if;
        if jsonb_typeof(v_components) <> 'array' then
            raise exception 'Salary components must be an array';
        end if;

        insert into public.payroll_items (
            payroll_id, employee_id, basic_salary, allowances, deductions,
            net_salary, payment_status, workflow_managed, employee_snapshot, components_snapshot
        ) values (
            v_payroll_id, v_employee.id, v_basic, v_allowances, v_deductions,
            v_net, 'unpaid', true,
            jsonb_build_object(
                'employee_id', v_employee.id,
                'employee_number', v_employee.employee_number,
                'first_name', v_employee.first_name,
                'middle_name', v_employee.middle_name,
                'last_name', v_employee.last_name,
                'department', v_employee.department,
                'position', v_employee.position,
                'employee_type', v_employee.employee_type,
                'phone', v_employee.phone,
                'email', v_employee.email,
                'bank_name', coalesce(v_profile.bank_name, v_employee.bank_name),
                'bank_account_number', coalesce(v_profile.bank_account_number, v_employee.bank_account_number),
                'mobile_money_provider', v_profile.mobile_money_provider,
                'mobile_money_number', coalesce(v_profile.mobile_money_number, v_employee.mobile_money_number),
                'tax_number', v_profile.tax_number,
                'social_security_number', v_profile.social_security_number,
                'pension_number', v_profile.pension_number,
                'salary_type', coalesce(v_profile.salary_type, 'monthly')
            ),
            v_components
        );

        v_total_basic := v_total_basic + v_basic;
        v_total_allowances := v_total_allowances + v_allowances;
        v_total_deductions := v_total_deductions + v_deductions;
        v_total_net := v_total_net + v_net;
    end loop;

    update public.payrolls
    set payroll_number = 'PAY-' || to_char(p_payroll_month, 'YYYYMM') || '-' || lpad(v_payroll_id::text, 6, '0'),
        total_basic_salary = v_total_basic,
        total_allowances = v_total_allowances,
        total_deductions = v_total_deductions,
        total_net_salary = v_total_net
    where id = v_payroll_id;

    perform public.hr_payroll_audit(
        p_school_id, v_payroll_id, p_created_by, 'draft_created',
        'Payroll draft created', jsonb_build_object('employee_count', jsonb_array_length(p_items))
    );
    return v_payroll_id;
end;
$$;
              )
        ) then
            raise exception 'Each named deduction requires a description and a valid non-negative amount';
        end if;
        if exists (select 1 from jsonb_array_elements(v_components) component where component->>'type' = 'deduction') then
            select round(coalesce(sum((component->>'amount')::numeric), 0), 2)
            into v_deductions
            from jsonb_array_elements(v_components) component
            where component->>'type' = 'deduction';
        else
            v_deductions := round(coalesce((v_item->>'deductions')::numeric, 0), 2);
        end if;
        v_net := round(v_basic + v_allowances - v_deductions, 2);

        if v_basic < 0 or v_allowances < 0 or v_deductions < 0 or v_net <= 0 then
            raise exception 'Salary values cannot be negative or exceed gross earnings';
        end if;
        if jsonb_typeof(v_components) <> 'array' then
            raise exception 'Salary components must be an array';
        end if;

        insert into public.payroll_items (
            payroll_id, employee_id, basic_salary, allowances, deductions,
            net_salary, payment_status, workflow_managed, employee_snapshot, components_snapshot
        ) values (
            v_payroll_id, v_employee.id, v_basic, v_allowances, v_deductions,
            v_net, 'unpaid', true,
            jsonb_build_object(
                'employee_id', v_employee.id,
                'employee_number', v_employee.employee_number,
                'first_name', v_employee.first_name,
                'middle_name', v_employee.middle_name,
                'last_name', v_employee.last_name,
                'department', v_employee.department,
                'position', v_employee.position,
                'employee_type', v_employee.employee_type,
                'phone', v_employee.phone,
                'email', v_employee.email,
                'bank_name', coalesce(v_profile.bank_name, v_employee.bank_name),
                'bank_account_number', coalesce(v_profile.bank_account_number, v_employee.bank_account_number),
                'mobile_money_provider', v_profile.mobile_money_provider,
                'mobile_money_number', coalesce(v_profile.mobile_money_number, v_employee.mobile_money_number),
                'tax_number', v_profile.tax_number,
                'social_security_number', v_profile.social_security_number,
                'pension_number', v_profile.pension_number,
                'salary_type', coalesce(v_profile.salary_type, 'monthly')
            ),
            v_components
        );

        v_total_basic := v_total_basic + v_basic;
        v_total_allowances := v_total_allowances + v_allowances;
        v_total_deductions := v_total_deductions + v_deductions;
        v_total_net := v_total_net + v_net;
    end loop;

    update public.payrolls
    set payroll_number = 'PAY-' || to_char(p_payroll_month, 'YYYYMM') || '-' || lpad(v_payroll_id::text, 6, '0'),
        total_basic_salary = v_total_basic,
        total_allowances = v_total_allowances,
        total_deductions = v_total_deductions,
        total_net_salary = v_total_net
    where id = v_payroll_id;

    perform public.hr_payroll_audit(
        p_school_id, v_payroll_id, p_created_by, 'draft_created',
        'Payroll draft created', jsonb_build_object('employee_count', jsonb_array_length(p_items))
    );
    return v_payroll_id;
end;
$$;

create or replace function public.hr_payroll_update_item(
    p_school_id bigint,
    p_payroll_id bigint,
    p_item_id bigint,
    p_basic_salary numeric,
    p_allowances numeric,
    p_deductions numeric,
    p_components jsonb,
    p_actor_id uuid
)
returns boolean
language plpgsql
set search_path = public
as $$
declare
    v_net numeric(14,2);
    v_status text;
begin
    select status into v_status
    from public.payrolls
    where id = p_payroll_id and school_id = p_school_id
    for update;
    if not found then raise exception 'Payroll not found'; end if;
    if v_status not in ('draft', 'returned') then
        raise exception 'Only draft or returned payrolls can be edited';
    end if;

    if jsonb_typeof(coalesce(p_components, '[]'::jsonb)) <> 'array' then
        raise exception 'Salary components must be an array';
    end if;
    if exists (
        select 1 from jsonb_array_elements(coalesce(p_components, '[]'::jsonb)) component
        where component->>'type' = 'deduction'
          and (
            coalesce(trim(component->>'name'), '') = ''
                or jsonb_typeof(component->'amount') <> 'number'
                or (component->>'amount')::numeric < 0

    update public.payroll_items
    set basic_salary = round(p_basic_salary, 2),
        allowances = round(p_allowances, 2),
        deductions = round(p_deductions, 2),
        net_salary = v_net,
        components_snapshot = coalesce(p_components, '[]'::jsonb)
    where id = p_item_id and payroll_id = p_payroll_id;
    if not found then raise exception 'Payroll employee row not found'; end if;

    update public.payrolls p
    set total_basic_salary = x.basic_total,
        total_allowances = x.allowance_total,
        total_deductions = x.deduction_total,
        total_net_salary = x.net_total
    from (
        select sum(basic_salary) basic_total,
               sum(allowances) allowance_total,
               sum(deductions) deduction_total,
               sum(net_salary) net_total
        from public.payroll_items where payroll_id = p_payroll_id
    ) x
    where p.id = p_payroll_id;

    perform public.hr_payroll_audit(
        p_school_id, p_payroll_id, p_actor_id, 'draft_item_updated',
        'Payroll employee values updated', jsonb_build_object('payroll_item_id', p_item_id)
    );
    return true;
end;
$$;
          )
    ) then
        raise exception 'Each named deduction requires a description and a valid non-negative amount';
    end if;
    if exists (select 1 from jsonb_array_elements(coalesce(p_components, '[]'::jsonb)) component where component->>'type' = 'deduction') then
        select round(coalesce(sum((component->>'amount')::numeric), 0), 2)
        into p_deductions
        from jsonb_array_elements(coalesce(p_components, '[]'::jsonb)) component
        where component->>'type' = 'deduction';
    end if;
    v_net := round(coalesce(p_basic_salary, 0) + coalesce(p_allowances, 0) - coalesce(p_deductions, 0), 2);
    if coalesce(p_basic_salary, 0) < 0 or coalesce(p_allowances, 0) < 0
       or coalesce(p_deductions, 0) < 0 or v_net <= 0 then
        raise exception 'Invalid salary amounts';
    end if;

    update public.payroll_items
    set basic_salary = round(p_basic_salary, 2),
        allowances = round(p_allowances, 2),
        deductions = round(p_deductions, 2),
        net_salary = v_net,
        components_snapshot = coalesce(p_components, '[]'::jsonb)
    where id = p_item_id and payroll_id = p_payroll_id;
    if not found then raise exception 'Payroll employee row not found'; end if;

    update public.payrolls p
    set total_basic_salary = x.basic_total,
        total_allowances = x.allowance_total,
        total_deductions = x.deduction_total,
        total_net_salary = x.net_total
    from (
        select sum(basic_salary) basic_total,
               sum(allowances) allowance_total,
               sum(deductions) deduction_total,
               sum(net_salary) net_total
        from public.payroll_items where payroll_id = p_payroll_id
    ) x
    where p.id = p_payroll_id;

    perform public.hr_payroll_audit(
        p_school_id, p_payroll_id, p_actor_id, 'draft_item_updated',
        'Payroll employee values updated', jsonb_build_object('payroll_item_id', p_item_id)
    );
    return true;
end;
$$;
