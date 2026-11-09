-- Store each school's NewHope sender credentials in Supabase Vault.
-- The settings table contains Vault references only; plaintext keys are returned
-- exclusively by a service-role-only function used by trusted server code.

create table if not exists public.school_sms_settings (
    school_id bigint primary key references public.schools(id) on delete cascade,
    sender_id text not null,
    api_key_secret_id uuid not null,
    secret_key_secret_id uuid not null,
    approval_status text not null default 'pending'
        check (approval_status in ('pending', 'approved', 'rejected')),
    approval_note text,
    updated_at timestamptz not null default now(),
    constraint school_sms_sender_id_format
        check (sender_id ~ '^[A-Za-z0-9]{1,11}$')
);

alter table public.school_sms_settings enable row level security;
revoke all on public.school_sms_settings from anon, authenticated;
grant select, insert, update, delete on public.school_sms_settings to service_role;

create or replace function public.set_school_sms_settings(
    p_school_id bigint,
    p_sender_id text,
    p_api_key text,
    p_secret_key text,
    p_approval_status text default 'pending',
    p_approval_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_api_secret_id uuid;
    v_secret_secret_id uuid;
begin
    if p_school_id is null or p_school_id <= 0 then
        raise exception 'A valid school ID is required.';
    end if;
    if p_sender_id is null or p_sender_id !~ '^[A-Za-z0-9]{1,11}$' then
        raise exception 'Sender ID must contain 1 to 11 letters or digits, without spaces.';
    end if;
    if coalesce(length(trim(p_api_key)), 0) < 8
       or coalesce(length(trim(p_secret_key)), 0) < 8 then
        raise exception 'Both NewHope API Key and Secret Key are required.';
    end if;
    if coalesce(p_approval_status, 'pending') not in ('pending', 'approved', 'rejected') then
        raise exception 'Invalid Sender ID approval status.';
    end if;
    if not exists (select 1 from public.schools s where s.id = p_school_id) then
        raise exception 'School was not found.';
    end if;

    select api_key_secret_id, secret_key_secret_id
      into v_api_secret_id, v_secret_secret_id
      from public.school_sms_settings
     where school_id = p_school_id;

    if v_api_secret_id is null then
        v_api_secret_id := vault.create_secret(
            trim(p_api_key),
            'school_sms_' || p_school_id || '_api_key',
            'NewHope SMS API key for school ' || p_school_id
        );
    else
        perform vault.update_secret(
            v_api_secret_id,
            trim(p_api_key),
            'school_sms_' || p_school_id || '_api_key',
            'NewHope SMS API key for school ' || p_school_id
        );
    end if;

    if v_secret_secret_id is null then
        v_secret_secret_id := vault.create_secret(
            trim(p_secret_key),
            'school_sms_' || p_school_id || '_secret_key',
            'NewHope SMS secret key for school ' || p_school_id
        );
    else
        perform vault.update_secret(
            v_secret_secret_id,
            trim(p_secret_key),
            'school_sms_' || p_school_id || '_secret_key',
            'NewHope SMS secret key for school ' || p_school_id
        );
    end if;

    insert into public.school_sms_settings (
        school_id, sender_id, api_key_secret_id, secret_key_secret_id,
        approval_status, approval_note, updated_at
    ) values (
        p_school_id, trim(p_sender_id), v_api_secret_id, v_secret_secret_id,
        coalesce(p_approval_status, 'pending'), nullif(trim(coalesce(p_approval_note, '')), ''), now()
    )
    on conflict (school_id) do update set
        sender_id = excluded.sender_id,
        api_key_secret_id = excluded.api_key_secret_id,
        secret_key_secret_id = excluded.secret_key_secret_id,
        approval_status = excluded.approval_status,
        approval_note = excluded.approval_note,
        updated_at = now();

    return jsonb_build_object('success', true, 'school_id', p_school_id);
end;
$$;

create or replace function public.get_school_sms_credentials(p_school_id bigint)
returns table (
    sender_id text,
    approval_status text,
    api_key text,
    secret_key text
)
language sql
security definer
set search_path = ''
stable
as $$
    select
        settings.sender_id,
        settings.approval_status,
        api_secret.decrypted_secret,
        secret_secret.decrypted_secret
    from public.school_sms_settings settings
    join vault.decrypted_secrets api_secret
      on api_secret.id = settings.api_key_secret_id
    join vault.decrypted_secrets secret_secret
      on secret_secret.id = settings.secret_key_secret_id
    where settings.school_id = p_school_id
    limit 1;
$$;

revoke all on function public.set_school_sms_settings(bigint, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.get_school_sms_credentials(bigint) from public, anon, authenticated;
grant execute on function public.set_school_sms_settings(bigint, text, text, text, text, text) to service_role;
grant execute on function public.get_school_sms_credentials(bigint) to service_role;

comment on table public.school_sms_settings is
    'Per-school NewHope sender configuration. API credentials are stored only in Supabase Vault.';
