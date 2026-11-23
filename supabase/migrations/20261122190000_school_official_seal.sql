-- Official school seal settings, isolated by school.
-- Disabled by default. Only Super Admin and authorized school management roles can change it.

create table if not exists public.school_document_settings (
    id bigserial primary key,
    school_id bigint not null unique references public.schools(id) on delete cascade,
    show_official_seal boolean not null default false,
    updated_by uuid null references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create or replace function public.set_school_document_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_school_document_settings_updated_at
    on public.school_document_settings;
create trigger trg_school_document_settings_updated_at
before update on public.school_document_settings
for each row execute function public.set_school_document_settings_updated_at();

alter table public.school_document_settings enable row level security;

revoke all on public.school_document_settings from anon;
revoke all on public.school_document_settings from authenticated;
grant select, insert, update on public.school_document_settings to authenticated;
grant usage, select on sequence public.school_document_settings_id_seq to authenticated;

drop policy if exists school_document_settings_select_own_school
    on public.school_document_settings;
create policy school_document_settings_select_own_school
on public.school_document_settings
for select to authenticated
using (
    public.is_current_user_super_admin()
    or school_id = public.get_current_user_school_id()
);

drop policy if exists school_document_settings_insert_admin
    on public.school_document_settings;
create policy school_document_settings_insert_admin
on public.school_document_settings
for insert to authenticated
with check (
    public.is_current_user_super_admin()
    or exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.school_id = school_document_settings.school_id
          and p.role_id in (1, 2, 3, 4)
    )
);

drop policy if exists school_document_settings_update_admin
    on public.school_document_settings;
create policy school_document_settings_update_admin
on public.school_document_settings
for update to authenticated
using (
    public.is_current_user_super_admin()
    or exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.school_id = school_document_settings.school_id
          and p.role_id in (1, 2, 3, 4)
    )
)
with check (
    public.is_current_user_super_admin()
    or exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.school_id = school_document_settings.school_id
          and p.role_id in (1, 2, 3, 4)
    )
);
