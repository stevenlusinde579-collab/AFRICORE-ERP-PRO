-- Preserve payment setup history, accumulate additional fees, and support
-- term-scoped Other Fees. Existing unassigned Other Fee rows remain valid.

alter table finance.student_payment_setups
    drop constraint if exists student_payment_setups_term_check;

alter table finance.student_payment_setups
    add constraint student_payment_setups_term_check
    check (
        (
            setup_type = 'tuition'
            and term_number in (1, 2)
        )
        or
        (
            setup_type = 'other'
            and (term_number is null or term_number in (1, 2, 3))
        )
    );

create or replace function finance.ensure_student_charge_for_setup(
    p_setup_id uuid,
    p_charge_date date,
    p_created_by uuid
)
returns table(charge_id uuid, journal_entry_id uuid)
language plpgsql
security definer
set search_path = finance, public
as $function$
declare
    s finance.student_payment_setups%rowtype;
    fi finance.fee_items%rowtype;
    c finance.student_charges%rowtype;
    v_profile_school bigint;
    v_receivable_account uuid;
    v_period_id uuid;
    v_invoice text;
    v_description text;
    v_delta numeric(18,2);
    v_journal_id uuid;
    v_matching_count integer;
begin
    if auth.uid() is null then
        raise exception 'Authentication required';
    end if;

    select school_id
      into v_profile_school
      from public.profiles
     where id = auth.uid()
     limit 1;

    if v_profile_school is null then
        raise exception 'User profile school haijapatikana';
    end if;

    if p_created_by is not null and p_created_by <> auth.uid() then
        raise exception 'Invalid created_by user';
    end if;

    select *
      into s
      from finance.student_payment_setups
     where id = p_setup_id
       and status = 'active'
     for update;

    if not found then
        raise exception 'Payment setup not found';
    end if;

    if s.school_id <> v_profile_school then
        raise exception 'You are not authorized for this payment setup';
    end if;

    if s.fee_item_id is null or s.amount <= 0 then
        raise exception 'Payment setup requires a fee item and a positive amount';
    end if;

    select *
      into fi
      from finance.fee_items
     where id = s.fee_item_id
       and school_id = s.school_id
       and is_active = true
     limit 1;

    if not found or fi.revenue_account_id is null then
        raise exception 'Fee item or its revenue account is not configured for this school';
    end if;

    v_description := case
        when s.setup_type = 'tuition'
            then 'Tuition Fee - Term ' || s.term_number
        when s.term_number is not null
            then coalesce(fi.item_name, 'Other Fee') || ' - Term ' || s.term_number
        else coalesce(fi.item_name, 'Other Fee')
    end;

    -- Prefer the explicit link. For legacy unlinked charges, only adopt a
    -- matching row when exactly one exists; never merge ambiguous history.
    select *
      into c
      from finance.student_charges
     where payment_setup_id = s.id
       and school_id = s.school_id
       and student_id = s.student_id
     order by created_at desc
     limit 1
     for update;

    if not found then
        select count(*)
          into v_matching_count
          from finance.student_charges
         where school_id = s.school_id
           and student_id = s.student_id
           and academic_year_id = s.academic_year_id
           and fee_item_id = s.fee_item_id
           and term_number is not distinct from s.term_number
           and payment_setup_id is null;

        if v_matching_count = 1 then
            select *
              into c
              from finance.student_charges
             where school_id = s.school_id
               and student_id = s.student_id
               and academic_year_id = s.academic_year_id
               and fee_item_id = s.fee_item_id
               and term_number is not distinct from s.term_number
               and payment_setup_id is null
             limit 1
             for update;

            update finance.student_charges
               set payment_setup_id = s.id
             where id = c.id;
            c.payment_setup_id := s.id;
        end if;
    end if;

    if c.id is not null then
        v_delta := greatest(s.amount - c.amount, 0);

        if v_delta > 0 then
            select id
              into v_receivable_account
              from finance.chart_of_accounts
             where school_id = s.school_id
               and account_code = '1100'
               and account_type = 'asset'
               and account_category = 'Accounts Receivable'
               and is_active = true
             limit 1;

            if v_receivable_account is null then
                raise exception 'Student Receivables account 1100 is not configured for this school';
            end if;

            select id
              into v_period_id
              from finance.accounting_periods
             where school_id = s.school_id
               and p_charge_date between start_date and end_date
               and status = 'open'
             order by start_date desc
             limit 1;

            if v_period_id is null then
                raise exception 'No open accounting period covers the charge date';
            end if;

            update finance.student_charges
               set amount = amount + v_delta,
                   description = v_description,
                   due_date = coalesce(s.due_date, due_date),
                   status = case
                       when paid_amount >= amount + v_delta then 'paid'
                       when paid_amount > 0 then 'partially_paid'
                       else 'posted'
                   end
             where id = c.id;

            v_journal_id := finance.post_journal_entry(
                s.school_id,
                p_charge_date,
                'Additional ' || v_description,
                'ADJ-' || replace(s.id::text, '-', '') || '-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
                'student_charge_adjustment',
                c.id,
                coalesce(p_created_by, auth.uid()),
                v_period_id,
                jsonb_build_array(
                    jsonb_build_object(
                        'account_id', v_receivable_account,
                        'debit', v_delta,
                        'credit', 0,
                        'description', 'Additional ' || v_description
                    ),
                    jsonb_build_object(
                        'account_id', fi.revenue_account_id,
                        'debit', 0,
                        'credit', v_delta,
                        'description', 'Additional ' || v_description
                    )
                )
            );

            return query select c.id, v_journal_id;
            return;
        end if;

        return query select c.id, c.journal_entry_id;
        return;
    end if;

    v_invoice := 'STU-' || s.student_id || '-' || replace(s.id::text, '-', '');

    select r.charge_id, r.journal_entry_id
      into charge_id, journal_entry_id
      from finance.record_student_charge(
          s.school_id,
          s.student_id,
          p_charge_date,
          s.academic_year_id,
          v_description,
          s.amount,
          fi.revenue_account_id,
          s.fee_item_id,
          s.term_number,
          s.due_date,
          v_invoice,
          coalesce(p_created_by, auth.uid())
      ) r;

    update finance.student_charges
       set payment_setup_id = s.id
     where id = charge_id;

    return next;
end;
$function$;

create or replace function finance.save_student_payment_setup(
    p_school_id bigint,
    p_student_id bigint,
    p_academic_year_id bigint,
    p_class_id bigint,
    p_created_by uuid,
    p_tuition_fee_item_id uuid,
    p_tuition_term_1 numeric,
    p_tuition_term_2 numeric,
    p_other_fees jsonb
)
returns setof finance.student_payment_setups
language plpgsql
set search_path = finance, public
as $function$
declare
    v_fee jsonb;
    v_fee_item_id uuid;
    v_amount numeric(18,2);
    v_term smallint;
    v_setup finance.student_payment_setups%rowtype;
    v_setup_id uuid;
    v_profile_school bigint;
begin
    if auth.uid() is null then
        raise exception 'Authentication required';
    end if;

    select school_id
      into v_profile_school
      from public.profiles
     where id = auth.uid()
     limit 1;

    if v_profile_school is null or v_profile_school <> p_school_id then
        raise exception 'You are not authorized for this school';
    end if;

    if p_created_by is not null and p_created_by <> auth.uid() then
        raise exception 'Invalid created_by user';
    end if;

    if not exists (
        select 1 from public.students
         where id = p_student_id and school_id = p_school_id
    ) then
        raise exception 'Student does not belong to this school';
    end if;

    if not exists (
        select 1 from public.academic_years
         where id = p_academic_year_id and school_id = p_school_id
    ) then
        raise exception 'Academic year does not belong to this school';
    end if;

    if p_class_id is not null and not exists (
        select 1 from public.classes
         where id = p_class_id and school_id = p_school_id
    ) then
        raise exception 'Class does not belong to this school';
    end if;

    if jsonb_typeof(coalesce(p_other_fees, '[]'::jsonb)) <> 'array' then
        raise exception 'Other fees must be a JSON array';
    end if;

    -- Serialize edits for the same student/year to avoid concurrent duplicate
    -- setup rows while keeping the unique business key stable.
    perform pg_advisory_xact_lock(
        hashtext(p_school_id::text || ':' || p_student_id::text || ':' || p_academic_year_id::text)
    );

    if p_tuition_fee_item_id is not null then
        if not exists (
            select 1 from finance.fee_items
             where id = p_tuition_fee_item_id
               and school_id = p_school_id
               and is_active = true
               and revenue_account_id is not null
        ) then
            raise exception 'Tuition fee item is not active or has no revenue account for this school';
        end if;

        for v_term, v_amount in
            select x.term_number, greatest(coalesce(x.amount, 0), 0)::numeric(18,2)
              from (values
                    (1::smallint, coalesce(p_tuition_term_1, 0)),
                    (2::smallint, coalesce(p_tuition_term_2, 0))
              ) as x(term_number, amount)
        loop
            if v_amount > 0 then
                select *
                  into v_setup
                  from finance.student_payment_setups
                 where school_id = p_school_id
                   and student_id = p_student_id
                   and academic_year_id = p_academic_year_id
                   and setup_type = 'tuition'
                   and fee_item_id = p_tuition_fee_item_id
                   and term_number = v_term
                 for update;

                if found then
                    update finance.student_payment_setups
                       set amount = amount + v_amount,
                           class_id = p_class_id,
                           status = 'active',
                           created_by = coalesce(p_created_by, created_by),
                           updated_at = now()
                     where id = v_setup.id
                    returning id into v_setup_id;
                else
                    insert into finance.student_payment_setups(
                        school_id, student_id, academic_year_id, class_id,
                        fee_item_id, setup_type, term_number, amount, created_by
                    )
                    values (
                        p_school_id, p_student_id, p_academic_year_id, p_class_id,
                        p_tuition_fee_item_id, 'tuition', v_term, v_amount, p_created_by
                    )
                    returning id into v_setup_id;
                end if;

                perform finance.ensure_student_charge_for_setup(
                    v_setup_id, current_date, coalesce(p_created_by, auth.uid())
                );
            end if;
        end loop;
    end if;

    for v_fee in
        select value from jsonb_array_elements(coalesce(p_other_fees, '[]'::jsonb))
    loop
        v_fee_item_id := nullif(v_fee->>'fee_item_id', '')::uuid;
        v_amount := greatest(coalesce((v_fee->>'amount')::numeric, 0), 0)::numeric(18,2);
        v_term := coalesce(nullif(v_fee->>'term_number', '')::smallint, 0);

        if v_fee_item_id is null then
            raise exception 'Other fee item is required';
        end if;

        if v_term not in (1, 2, 3) then
            raise exception 'Other Fee term must be 1, 2 or 3';
        end if;

        if not exists (
            select 1 from finance.fee_items
             where id = v_fee_item_id
               and school_id = p_school_id
               and is_active = true
               and revenue_account_id is not null
        ) then
            raise exception 'Other fee item is not active or has no revenue account for this school';
        end if;

        if v_amount <= 0 then
            continue;
        end if;

        select *
          into v_setup
          from finance.student_payment_setups
         where school_id = p_school_id
           and student_id = p_student_id
           and academic_year_id = p_academic_year_id
           and setup_type = 'other'
           and fee_item_id = v_fee_item_id
           and term_number = v_term
         for update;

        if found then
            update finance.student_payment_setups
               set amount = amount + v_amount,
                   class_id = p_class_id,
                   status = 'active',
                   created_by = coalesce(p_created_by, created_by),
                   updated_at = now()
             where id = v_setup.id
            returning id into v_setup_id;
        else
            insert into finance.student_payment_setups(
                school_id, student_id, academic_year_id, class_id,
                fee_item_id, setup_type, term_number, amount, created_by
            )
            values (
                p_school_id, p_student_id, p_academic_year_id, p_class_id,
                v_fee_item_id, 'other', v_term, v_amount, p_created_by
            )
            returning id into v_setup_id;
        end if;

        perform finance.ensure_student_charge_for_setup(
            v_setup_id, current_date, coalesce(p_created_by, auth.uid())
        );
    end loop;

    return query
    select *
      from finance.student_payment_setups
     where school_id = p_school_id
       and student_id = p_student_id
       and academic_year_id = p_academic_year_id
       and status = 'active'
     order by setup_type, term_number nulls last, created_at;
end;
$function$;

revoke all on function finance.save_student_payment_setup(bigint, bigint, bigint, bigint, uuid, uuid, numeric, numeric, jsonb) from public, anon;
grant execute on function finance.save_student_payment_setup(bigint, bigint, bigint, bigint, uuid, uuid, numeric, numeric, jsonb) to authenticated;

revoke all on function finance.ensure_student_charge_for_setup(uuid, date, uuid) from public, anon;
grant execute on function finance.ensure_student_charge_for_setup(uuid, date, uuid) to authenticated;
