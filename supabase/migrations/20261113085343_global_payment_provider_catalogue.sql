-- Global bank and mobile money provider catalogue.
-- Provider names are shared system setup; actual cash accounts and balances remain school-scoped.
create table if not exists finance.payment_providers (
    id uuid primary key default gen_random_uuid(),
    provider_name varchar(120) not null,
    provider_type varchar(30) not null check (provider_type in ('bank','mobile_money','cash')),
    sort_order integer not null default 100,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint payment_providers_name_type_unique unique (provider_name, provider_type)
);

alter table finance.payment_providers enable row level security;

drop policy if exists payment_providers_read_authenticated on finance.payment_providers;
create policy payment_providers_read_authenticated
on finance.payment_providers for select to authenticated
using (is_active = true or is_current_user_super_admin());

drop policy if exists payment_providers_superadmin_manage on finance.payment_providers;
create policy payment_providers_superadmin_manage
on finance.payment_providers for all to authenticated
using (is_current_user_super_admin())
with check (is_current_user_super_admin());

grant select, insert, update, delete on finance.payment_providers to authenticated;

insert into finance.payment_providers (provider_name, provider_type, sort_order) values
('NMB', 'bank', 10),
('CRDB', 'bank', 20),
('NBC', 'bank', 30),
('TPB / TCB', 'bank', 40),
('Exim Bank', 'bank', 50),
('Equity Bank', 'bank', 60),
('Stanbic Bank', 'bank', 70),
('Absa Bank', 'bank', 80),
('Standard Chartered', 'bank', 90),
('Access Bank', 'bank', 100),
('M-Pesa', 'mobile_money', 10),
('Airtel Money', 'mobile_money', 20),
('Mixx by Yas', 'mobile_money', 30),
('HaloPesa', 'mobile_money', 40),
('AzamPesa', 'mobile_money', 50),
('Cash', 'cash', 10)
on conflict (provider_name, provider_type) do update
set sort_order = excluded.sort_order, is_active = true;
