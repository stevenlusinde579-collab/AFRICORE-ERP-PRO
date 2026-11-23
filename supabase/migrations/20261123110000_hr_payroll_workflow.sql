-- HR-reviewed payroll workflow integrated with the current Finance ledger.
-- Additive: preserves legacy payroll rows and their legacy foreign keys.

alter table public.payrolls
    add column if not exists workflow_managed boolean not null default false,
    add column if not exists submitted_at timestamptz,
    add column if not exists submitted_by uuid references auth.users(id) on delete set null,
    add column if not exists reviewed_at timestamptz,
    add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
    add column if not exists review_notes text,
    add column if not exists approved_at timestamptz,
    add column if not exists approved_by uuid references auth.users(id) on delete set null,
    add column if not exists payroll_snapshot jsonb,
    add column if not exists snapshot_locked_at timestamptz,
    add column if not exists finance_source_id uuid not null default gen_random_uuid(),
    add column if not exists finance_journal_entry_id uuid references finance.journal_entries(id) on delete set null;

alter table public.payroll_items
    add column if not exists workflow_managed boolean not null default false,
    add column if not exists employee_snapshot jsonb not null default '{}'::jsonb,
    add column if not exists components_snapshot jsonb not null default '[]'::jsonb,
    add column if not exists finance_source_id uuid not null default gen_random_uuid(),
    add column if not exists finance_journal_entry_id uuid references finance.journal_entries(id) on delete set null,
    add column if not exists cash_account_id bigint references finance.cash_accounts(id) on delete set null,
    add column if not exists payment_method text,
    add column if not exists paid_by uuid references auth.users(id) on delete set null;

alter table public.payrolls drop constraint if exists payrolls_status_check;
alter table public.payrolls
    add constraint payrolls_status_check
    check (status in (
        'draft',
        'submitted_for_review',
        'returned',
        'approved',
        'posted',
        'partially_paid',
        'paid',
        'cancelled'
    )) not valid;

-- Legacy payroll rows are preserved as-is. New workflow rows are marked explicitly,
-- so these indexes enforce the new workflow without rejecting historical duplicates.
create unique index if not exists payrolls_one_active_month_per_school
    on public.payrolls(school_id, payroll_month)
    where workflow_managed = true and status <> 'cancelled';

create unique index if not exists payroll_items_employee_once_per_payroll
    on public.payroll_items(payroll_id, employee_id)
    where workflow_managed = true;

create unique index if not exists payrolls_finance_source_unique
    on public.payrolls(finance_source_id);
create unique index if not exists payroll_items_finance_source_unique
    on public.payroll_items(finance_source_id);

create table if not exists public.payroll_settings (
    id bigserial primary key,
    school_id bigint not null unique references public.schools(id) on delete cascade,
    salary_expense_account_id uuid not null references finance.chart_of_accounts(id),
    salary_payable_account_id uuid not null references finance.chart_of_accounts(id),
    deductions_payable_account_id uuid null references finance.chart_of_accounts(id),
    updated_by uuid null references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.hr_payroll_audit_events (
    id bigserial primary key,
    school_id bigint not null references public.schools(id) on delete cascade,
    payroll_id bigint not null references public.payrolls(id) on delete restrict,
    actor_id uuid null references auth.users(id) on delete set null,
    event_type text not null,
    event_note text,
    event_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_hr_payroll_audit_payroll
    on public.hr_payroll_audit_events(school_id, payroll_id, created_at desc);

create or replace function public.hr_payroll_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_payroll_settings_updated_at on public.payroll_settings;
create trigger trg_payroll_settings_updated_at
before update on public.payroll_settings
for each row execute function public.hr_payroll_set_updated_at();

-- Payroll tables are accessed through authenticated, role-checked backend routes.
-- Do not expose salary or bank data directly through the browser Data API.
alter table public.payrolls enable row level security;
alter table public.payroll_items enable row level security;
alter table public.payroll_settings enable row level security;
alter table public.hr_payroll_audit_events enable row level security;
alter table public.salary_components enable row level security;
alter table public.employee_financial_profiles enable row level security;

revoke all on public.payrolls from anon, authenticated;
revoke all on public.payroll_items from anon, authenticated;
revoke all on public.payroll_settings from anon, authenticated;
revoke all on public.hr_payroll_audit_events from anon, authenticated;
revoke all on public.salary_components from anon, authenticated;
revoke all on public.employee_financial_profiles from anon, authenticated;

grant all on public.payrolls to service_role;
grant all on public.payroll_items to service_role;
grant all on public.payroll_settings to service_role;
grant all on public.hr_payroll_audit_events to service_role;
grant all on public.salary_components to service_role;
grant all on public.employee_financial_profiles to service_role;
grant usage, select on sequence public.payroll_settings_id_seq to service_role;
grant usage, select on sequence public.hr_payroll_audit_events_id_seq to service_role;
grant usage, select on sequence public.payrolls_id_seq to service_role;
grant usage, select on sequence public.payroll_items_id_seq to service_role;

drop policy if exists af_score_authenticated_base on public.payrolls;
drop policy if exists af_score_tenant_guard on public.payrolls;
drop policy if exists af_score_authenticated_base on public.payroll_items;
drop policy if exists af_score_tenant_guard on public.payroll_items;
drop policy if exists af_score_authenticated_base on public.payroll_settings;
drop policy if exists af_score_tenant_guard on public.payroll_settings;
drop policy if exists af_score_authenticated_base on public.hr_payroll_audit_events;
drop policy if exists af_score_tenant_guard on public.hr_payroll_audit_events;
drop policy if exists af_score_authenticated_base on public.salary_components;
drop policy if exists af_score_tenant_guard on public.salary_components;
drop policy if exists af_score_authenticated_base on public.employee_financial_profiles;
drop policy if exists af_score_tenant_guard on public.employee_financial_profiles;

create or replace function public.hr_payroll_audit(
    p_school_id bigint,
    p_payroll_id bigint,
    p_actor_id uuid,
    p_event_type text,
    p_event_note text default null,
    p_event_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
set search_path = public
as $$
begin
    insert into public.hr_payroll_audit_events (
        school_id, payroll_id, actor_id, event_type, event_note, event_data
    ) values (
        p_school_id, p_payroll_id, p_actor_id, p_event_type,
        p_event_note, coalesce(p_event_data, '{}'::jsonb)
    );
end;
$$;

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
        v_deductions := round(coalesce((v_item->>'deductions')::numeric, 0), 2);
        v_net := round(v_basic + v_allowances - v_deductions, 2);
        v_components := coalesce(v_item->'components', '[]'::jsonb);

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

    v_net := round(coalesce(p_basic_salary, 0) + coalesce(p_allowances, 0) - coalesce(p_deductions, 0), 2);
    if coalesce(p_basic_salary, 0) < 0 or coalesce(p_allowances, 0) < 0
       or coalesce(p_deductions, 0) < 0 or v_net <= 0 then
        raise exception 'Invalid salary amounts';
    end if;
    if jsonb_typeof(coalesce(p_components, '[]'::jsonb)) <> 'array' then
        raise exception 'Salary components must be an array';
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

create or replace function public.hr_payroll_submit(
    p_school_id bigint,
    p_payroll_id bigint,
    p_actor_id uuid
)
returns boolean
language plpgsql
set search_path = public
as $$
declare
    v_status text;
    v_count integer;
begin
    select status into v_status
    from public.payrolls
    where id = p_payroll_id and school_id = p_school_id
    for update;
    if not found then raise exception 'Payroll not found'; end if;
    if v_status not in ('draft', 'returned') then
        raise exception 'Only draft or returned payrolls can be submitted';
    end if;
    select count(*) into v_count from public.payroll_items where payroll_id = p_payroll_id;
    if v_count = 0 then raise exception 'Payroll has no employees'; end if;

    update public.payrolls
    set status = 'submitted_for_review',
        submitted_at = now(),
        submitted_by = p_actor_id,
        reviewed_at = null,
        reviewed_by = null,
        review_notes = null
    where id = p_payroll_id;

    perform public.hr_payroll_audit(p_school_id, p_payroll_id, p_actor_id, 'submitted_for_review', 'Sent to HR for review');
    return true;
end;
$$;

create or replace function public.hr_payroll_review(
    p_school_id bigint,
    p_payroll_id bigint,
    p_reviewer_id uuid,
    p_decision text,
    p_review_note text default null
)
returns boolean
language plpgsql
set search_path = public
as $$
declare
    v_payroll public.payrolls%rowtype;
    v_items jsonb;
    v_school jsonb;
    v_seal jsonb;
    v_headmaster_name text;
    v_preparer_name text;
    v_reviewer_name text;
    v_snapshot jsonb;
begin
    select * into v_payroll
    from public.payrolls
    where id = p_payroll_id and school_id = p_school_id
    for update;
    if not found then raise exception 'Payroll not found'; end if;
    if v_payroll.status <> 'submitted_for_review' then
        raise exception 'Only submitted payrolls can be reviewed';
    end if;
    if p_decision not in ('approve', 'return') then
        raise exception 'Review decision must be approve or return';
    end if;
    if p_decision = 'return' and coalesce(trim(p_review_note), '') = '' then
        raise exception 'A reason is required when returning payroll';
    end if;

    if p_decision = 'return' then
        update public.payrolls
        set status = 'returned', reviewed_at = now(), reviewed_by = p_reviewer_id,
            review_notes = trim(p_review_note)
        where id = p_payroll_id;
        perform public.hr_payroll_audit(p_school_id, p_payroll_id, p_reviewer_id, 'returned', trim(p_review_note));
        return true;
    end if;

    select to_jsonb(s) into v_school
    from public.schools s where s.id = p_school_id;

    select jsonb_build_object(
        'show_official_seal', coalesce(sds.show_official_seal, false),
        'school_name', s.school_name,
        'registration_number', s.registration_number,
        'headmaster_name', coalesce(hm.full_name, '')
    ) into v_seal
    from public.schools s
    left join public.school_document_settings sds on sds.school_id = s.id
    left join lateral (
        select p.full_name
        from public.profiles p
        left join public.profile_roles pr
            on pr.profile_id = p.id and pr.school_id = s.id and pr.is_active = true
        left join public.roles r on r.id = coalesce(pr.role_id, p.role_id)
        where p.school_id = s.id and r.role_name = 'Headmaster'
        order by coalesce(pr.is_primary, false) desc, p.created_at asc
        limit 1
    ) hm on true
    where s.id = p_school_id;

    select p.full_name into v_preparer_name
    from public.profiles p where p.id = v_payroll.created_by;
    select p.full_name into v_reviewer_name
    from public.profiles p where p.id = p_reviewer_id;

    select jsonb_agg(
        jsonb_build_object(
            'payroll_item_id', pi.id,
            'employee', pi.employee_snapshot,
            'components', pi.components_snapshot,
            'basic_salary', pi.basic_salary,
            'allowances', pi.allowances,
            'deductions', pi.deductions,
            'gross_salary', pi.basic_salary + pi.allowances,
            'net_salary', pi.net_salary
        ) order by pi.id
    ) into v_items
    from public.payroll_items pi
    where pi.payroll_id = p_payroll_id;

    v_snapshot := jsonb_build_object(
        'version', 1,
        'school', v_school,
        'seal', v_seal,
        'payroll', jsonb_build_object(
            'id', v_payroll.id,
            'payroll_number', v_payroll.payroll_number,
            'payroll_month', v_payroll.payroll_month,
            'status', 'approved',
            'prepared_by', v_payroll.created_by,
            'prepared_by_name', coalesce(v_preparer_name, 'Accountant'),
            'prepared_at', v_payroll.created_at,
            'reviewed_by', p_reviewer_id,
            'reviewed_by_name', coalesce(v_reviewer_name, 'HR Manager'),
            'reviewed_at', now(),
            'total_basic_salary', v_payroll.total_basic_salary,
            'total_allowances', v_payroll.total_allowances,
            'total_deductions', v_payroll.total_deductions,
            'total_gross_salary', v_payroll.total_basic_salary + v_payroll.total_allowances,
            'total_net_salary', v_payroll.total_net_salary
        ),
        'items', coalesce(v_items, '[]'::jsonb)
    );

    update public.payrolls
    set status = 'approved',
        reviewed_at = now(),
        reviewed_by = p_reviewer_id,
        approved_at = now(),
        approved_by = p_reviewer_id,
        review_notes = null,
        payroll_snapshot = v_snapshot,
        snapshot_locked_at = now()
    where id = p_payroll_id;

    perform public.hr_payroll_audit(p_school_id, p_payroll_id, p_reviewer_id, 'approved', 'Payroll approved and historical snapshot locked');
    return true;
end;
$$;

create or replace function public.hr_payroll_post(
    p_school_id bigint,
    p_payroll_id bigint,
    p_actor_id uuid
)
returns uuid
language plpgsql
set search_path = public, finance
as $$
declare
    v_payroll public.payrolls%rowtype;
    v_settings public.payroll_settings%rowtype;
    v_period_id uuid;
    v_journal_id uuid;
    v_gross numeric(14,2);
    v_net numeric(14,2);
    v_deductions numeric(14,2);
    v_lines jsonb;
begin
    select * into v_payroll
    from public.payrolls
    where id = p_payroll_id and school_id = p_school_id
    for update;
    if not found then raise exception 'Payroll not found'; end if;
    if v_payroll.status in ('posted', 'partially_paid', 'paid') then
        return v_payroll.finance_journal_entry_id;
    end if;
    if v_payroll.status <> 'approved' or v_payroll.snapshot_locked_at is null then
        raise exception 'HR approval and a locked payroll snapshot are required before posting';
    end if;

    select * into v_settings
    from public.payroll_settings where school_id = p_school_id;
    if not found then raise exception 'Configure payroll expense and liability accounts first'; end if;

    if not exists (
        select 1 from finance.chart_of_accounts
        where id = v_settings.salary_expense_account_id
          and school_id = p_school_id and is_active = true
          and account_type::text = 'expense'
    ) then raise exception 'Salary expense account is invalid'; end if;
    if not exists (
        select 1 from finance.chart_of_accounts
        where id = v_settings.salary_payable_account_id
          and school_id = p_school_id and is_active = true
          and account_type::text = 'liability'
    ) then raise exception 'Salary payable account is invalid'; end if;

    v_gross := v_payroll.total_basic_salary + v_payroll.total_allowances;
    v_net := v_payroll.total_net_salary;
    v_deductions := v_payroll.total_deductions;
    if v_gross <= 0 then raise exception 'Payroll gross total must be greater than zero'; end if;
    if v_deductions > 0 and (
        v_settings.deductions_payable_account_id is null
        or not exists (
            select 1 from finance.chart_of_accounts
            where id = v_settings.deductions_payable_account_id
              and school_id = p_school_id and is_active = true
              and account_type::text = 'liability'
        )
    ) then raise exception 'Configure a valid deductions payable liability account'; end if;

    select id into v_period_id
    from finance.accounting_periods
    where school_id = p_school_id
      and status::text = 'open'
      and start_date <= (v_payroll.payroll_month + interval '1 month - 1 day')::date
      and end_date >= (v_payroll.payroll_month + interval '1 month - 1 day')::date
    order by start_date desc
    limit 1;
    if v_period_id is null then raise exception 'No open accounting period covers this payroll month'; end if;

    v_lines := jsonb_build_array(jsonb_build_object(
        'account_id', v_settings.salary_expense_account_id,
        'debit', v_gross,
        'credit', 0,
        'description', 'Gross staff salaries'
    ));
    if v_net > 0 then
        v_lines := v_lines || jsonb_build_array(jsonb_build_object(
            'account_id', v_settings.salary_payable_account_id,
            'debit', 0,
            'credit', v_net,
            'description', 'Net salaries payable'
        ));
    end if;
    if v_deductions > 0 then
        v_lines := v_lines || jsonb_build_array(jsonb_build_object(
            'account_id', v_settings.deductions_payable_account_id,
            'debit', 0,
            'credit', v_deductions,
            'description', 'Payroll deductions payable'
        ));
    end if;

    select id into v_journal_id
    from finance.journal_entries
    where school_id = p_school_id
      and source_type = 'payroll'
      and source_id = v_payroll.finance_source_id
    limit 1;

    if v_journal_id is null then
        v_journal_id := finance.post_journal_entry(
            p_school_id,
            (v_payroll.payroll_month + interval '1 month - 1 day')::date,
            'Payroll ' || v_payroll.payroll_number,
            v_payroll.payroll_number,
            'payroll',
            v_payroll.finance_source_id,
            p_actor_id,
            v_period_id,
            v_lines
        );
    end if;

    update public.payrolls
    set status = 'posted', posted_at = now(), finance_journal_entry_id = v_journal_id
    where id = p_payroll_id;

    perform public.hr_payroll_audit(
        p_school_id, p_payroll_id, p_actor_id, 'posted',
        'Payroll posted to Finance ledger',
        jsonb_build_object('journal_entry_id', v_journal_id)
    );
    return v_journal_id;
end;
$$;

create or replace function public.hr_payroll_pay_item(
    p_school_id bigint,
    p_payroll_id bigint,
    p_item_id bigint,
    p_cash_account_id bigint,
    p_payment_date date,
    p_payment_method text,
    p_reference text,
    p_actor_id uuid
)
returns uuid
language plpgsql
set search_path = public, finance
as $$
declare
    v_payroll public.payrolls%rowtype;
    v_item public.payroll_items%rowtype;
    v_settings public.payroll_settings%rowtype;
    v_cash finance.cash_accounts%rowtype;
    v_period_id uuid;
    v_journal_id uuid;
    v_unpaid integer;
begin
    select * into v_payroll
    from public.payrolls
    where id = p_payroll_id and school_id = p_school_id
    for update;
    if not found then raise exception 'Payroll not found'; end if;
    if v_payroll.status not in ('posted', 'partially_paid') then
        raise exception 'Payroll must be posted before paying employees';
    end if;

    select * into v_item
    from public.payroll_items
    where id = p_item_id and payroll_id = p_payroll_id
    for update;
    if not found then raise exception 'Payroll employee row not found'; end if;
    if v_item.payment_status = 'paid' then
        raise exception 'This employee has already been paid';
    end if;
    if v_item.net_salary <= 0 then raise exception 'Net salary must be greater than zero'; end if;

    select * into v_settings from public.payroll_settings where school_id = p_school_id;
    if not found then raise exception 'Payroll account settings are missing'; end if;

    select * into v_cash
    from finance.cash_accounts
    where id = p_cash_account_id
      and school_id = p_school_id
      and is_active = true;
    if not found then raise exception 'Selected cash or bank account is not active for this school'; end if;

    select id into v_period_id
    from finance.accounting_periods
    where school_id = p_school_id
      and status::text = 'open'
      and start_date <= p_payment_date
      and end_date >= p_payment_date
    order by start_date desc
    limit 1;
    if v_period_id is null then raise exception 'No open accounting period covers the payment date'; end if;

    select id into v_journal_id
    from finance.journal_entries
    where school_id = p_school_id
      and source_type = 'payroll_payment'
      and source_id = v_item.finance_source_id
    limit 1;

    if v_journal_id is null then
        v_journal_id := finance.post_journal_entry(
            p_school_id,
            p_payment_date,
            'Salary payment - ' || v_payroll.payroll_number,
            coalesce(nullif(trim(p_reference), ''), v_payroll.payroll_number || '/' || v_item.id::text),
            'payroll_payment',
            v_item.finance_source_id,
            p_actor_id,
            v_period_id,
            jsonb_build_array(
                jsonb_build_object(
                    'account_id', v_settings.salary_payable_account_id,
                    'debit', v_item.net_salary,
                    'credit', 0,
                    'description', 'Settlement of net salary payable'
                ),
                jsonb_build_object(
                    'account_id', v_cash.chart_of_account_id,
                    'debit', 0,
                    'credit', v_item.net_salary,
                    'description', 'Salary paid from ' || v_cash.account_name
                )
            )
        );
    end if;

    update public.payroll_items
    set payment_status = 'paid',
        payment_date = p_payment_date,
        payment_reference = nullif(trim(p_reference), ''),
        payment_method = nullif(trim(p_payment_method), ''),
        cash_account_id = p_cash_account_id,
        paid_by = p_actor_id,
        finance_journal_entry_id = v_journal_id
    where id = p_item_id;

    select count(*) into v_unpaid
    from public.payroll_items
    where payroll_id = p_payroll_id and payment_status <> 'paid';

    update public.payrolls
    set status = case when v_unpaid = 0 then 'paid' else 'partially_paid' end
    where id = p_payroll_id;

    perform public.hr_payroll_audit(
        p_school_id, p_payroll_id, p_actor_id, 'employee_paid',
        'Employee salary payment recorded',
        jsonb_build_object('payroll_item_id', p_item_id, 'amount', v_item.net_salary, 'journal_entry_id', v_journal_id)
    );
    return v_journal_id;
end;
$$;

create or replace function public.hr_payroll_prevent_snapshot_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if old.snapshot_locked_at is not null then
        if new.payroll_snapshot is distinct from old.payroll_snapshot
           or new.snapshot_locked_at is distinct from old.snapshot_locked_at
           or new.school_id is distinct from old.school_id
           or new.payroll_month is distinct from old.payroll_month
           or new.payroll_number is distinct from old.payroll_number
           or new.total_basic_salary is distinct from old.total_basic_salary
           or new.total_allowances is distinct from old.total_allowances
           or new.total_deductions is distinct from old.total_deductions
           or new.total_net_salary is distinct from old.total_net_salary then
            raise exception 'Approved payroll snapshot and financial totals are immutable';
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_payroll_snapshot_immutable on public.payrolls;
create trigger trg_payroll_snapshot_immutable
before update on public.payrolls
for each row execute function public.hr_payroll_prevent_snapshot_change();

create or replace function public.hr_payroll_prevent_item_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    v_locked_at timestamptz;
begin
    select snapshot_locked_at into v_locked_at
    from public.payrolls where id = coalesce(new.payroll_id, old.payroll_id);
    if v_locked_at is not null then
        if tg_op = 'DELETE' then
            raise exception 'Approved payroll employee rows cannot be deleted';
        end if;
        if new.payroll_id is distinct from old.payroll_id
           or new.employee_id is distinct from old.employee_id
           or new.basic_salary is distinct from old.basic_salary
           or new.allowances is distinct from old.allowances
           or new.deductions is distinct from old.deductions
           or new.net_salary is distinct from old.net_salary
           or new.employee_snapshot is distinct from old.employee_snapshot
           or new.components_snapshot is distinct from old.components_snapshot then
            raise exception 'Approved payroll employee amounts and snapshots are immutable';
        end if;
    end if;
    if tg_op = 'DELETE' then return old; end if;
    return new;
end;
$$;

drop trigger if exists trg_payroll_item_immutable on public.payroll_items;
create trigger trg_payroll_item_immutable
before update or delete on public.payroll_items
for each row execute function public.hr_payroll_prevent_item_change();

create or replace function public.hr_payroll_prevent_item_insert_after_approval()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if exists (
        select 1 from public.payrolls
        where id = new.payroll_id and snapshot_locked_at is not null
    ) then
        raise exception 'Employees cannot be added to an approved payroll';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_payroll_item_insert_locked on public.payroll_items;
create trigger trg_payroll_item_insert_locked
before insert on public.payroll_items
for each row execute function public.hr_payroll_prevent_item_insert_after_approval();

revoke all on function public.hr_payroll_audit(bigint,bigint,uuid,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.hr_payroll_create(bigint,date,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.hr_payroll_update_item(bigint,bigint,bigint,numeric,numeric,numeric,jsonb,uuid) from public, anon, authenticated;
revoke all on function public.hr_payroll_submit(bigint,bigint,uuid) from public, anon, authenticated;
revoke all on function public.hr_payroll_review(bigint,bigint,uuid,text,text) from public, anon, authenticated;
revoke all on function public.hr_payroll_post(bigint,bigint,uuid) from public, anon, authenticated;
revoke all on function public.hr_payroll_pay_item(bigint,bigint,bigint,bigint,date,text,text,uuid) from public, anon, authenticated;

grant execute on function public.hr_payroll_audit(bigint,bigint,uuid,text,text,jsonb) to service_role;
grant execute on function public.hr_payroll_create(bigint,date,uuid,jsonb) to service_role;
grant execute on function public.hr_payroll_update_item(bigint,bigint,bigint,numeric,numeric,numeric,jsonb,uuid) to service_role;
grant execute on function public.hr_payroll_submit(bigint,bigint,uuid) to service_role;
grant execute on function public.hr_payroll_review(bigint,bigint,uuid,text,text) to service_role;
grant execute on function public.hr_payroll_post(bigint,bigint,uuid) to service_role;
grant execute on function public.hr_payroll_pay_item(bigint,bigint,bigint,bigint,date,text,text,uuid) to service_role;
