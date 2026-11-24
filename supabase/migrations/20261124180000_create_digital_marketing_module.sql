-- Digital Marketing & Publicity
-- Tenant-scoped social accounts, campaigns, guardian consent and delivery records.
-- Credentials are encrypted by the backend; raw access tokens must never be stored.

create table if not exists public.school_social_accounts (
    id uuid primary key default gen_random_uuid(),
    school_id bigint not null references public.schools(id) on delete cascade,
    platform text not null check (platform in ('facebook', 'instagram', 'whatsapp')),
    external_account_id text not null,
    account_name text,
    access_token_ciphertext text not null,
    access_token_iv text not null,
    access_token_tag text not null,
    token_expires_at timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    connection_status text not null default 'connected'
        check (connection_status in ('connected', 'expired', 'revoked', 'error')),
    connected_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (school_id, platform, external_account_id)
);

create index if not exists idx_school_social_accounts_school_platform
    on public.school_social_accounts(school_id, platform);

create table if not exists public.marketing_contact_consents (
    id uuid primary key default gen_random_uuid(),
    school_id bigint not null references public.schools(id) on delete cascade,
    parent_id bigint references public.parents(id) on delete set null,
    student_id bigint references public.students(id) on delete set null,
    guardian_name text,
    guardian_phone text not null,
    consent_status text not null default 'pending'
        check (consent_status in ('pending', 'opted_in', 'opted_out')),
    consent_source text,
    consent_evidence text,
    consented_at timestamptz,
    revoked_at timestamptz,
    recorded_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists uq_marketing_consent_school_phone
    on public.marketing_contact_consents(school_id, guardian_phone);

create index if not exists idx_marketing_consent_audience
    on public.marketing_contact_consents(school_id, consent_status);

create table if not exists public.marketing_campaigns (
    id uuid primary key default gen_random_uuid(),
    school_id bigint not null references public.schools(id) on delete cascade,
    title text not null,
    message text not null,
    media_url text,
    platforms text[] not null default '{}'
        check (platforms <@ array['facebook', 'instagram', 'whatsapp']::text[]),
    audience_type text not null default 'all_school'
        check (audience_type in ('all_school', 'class')),
    target_class_id bigint,
    status text not null default 'draft'
        check (status in ('draft', 'scheduled', 'processing', 'published', 'partially_failed', 'failed', 'cancelled')),
    scheduled_at timestamptz,
    created_by uuid references auth.users(id) on delete set null,
    published_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint marketing_campaign_class_target check (
        (audience_type = 'all_school' and target_class_id is null)
        or (audience_type = 'class' and target_class_id is not null)
    )
);

create index if not exists idx_marketing_campaigns_school_created
    on public.marketing_campaigns(school_id, created_at desc);

create index if not exists idx_marketing_campaigns_schedule
    on public.marketing_campaigns(status, scheduled_at)
    where status = 'scheduled';

create table if not exists public.marketing_campaign_deliveries (
    id uuid primary key default gen_random_uuid(),
    school_id bigint not null references public.schools(id) on delete cascade,
    campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
    platform text not null check (platform in ('facebook', 'instagram', 'whatsapp')),
    parent_id bigint references public.parents(id) on delete set null,
    student_id bigint references public.students(id) on delete set null,
    recipient_phone text,
    provider_message_id text,
    delivery_status text not null default 'pending'
        check (delivery_status in ('pending', 'queued', 'sent', 'delivered', 'failed', 'skipped')),
    error_message text,
    sent_at timestamptz,
    created_at timestamptz not null default now()
);

create unique index if not exists uq_marketing_delivery_campaign_platform_phone
    on public.marketing_campaign_deliveries(campaign_id, platform, recipient_phone)
    where recipient_phone is not null;

create index if not exists idx_marketing_deliveries_campaign
    on public.marketing_campaign_deliveries(school_id, campaign_id, delivery_status);

-- All access is mediated by authenticated backend routes using the service role.
-- Browser clients must never read provider credentials or campaign recipient records.
alter table public.school_social_accounts enable row level security;
alter table public.marketing_contact_consents enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.marketing_campaign_deliveries enable row level security;

revoke all on public.school_social_accounts from anon, authenticated;
revoke all on public.marketing_contact_consents from anon, authenticated;
revoke all on public.marketing_campaigns from anon, authenticated;
revoke all on public.marketing_campaign_deliveries from anon, authenticated;

grant all on public.school_social_accounts to service_role;
grant all on public.marketing_contact_consents to service_role;
grant all on public.marketing_campaigns to service_role;
grant all on public.marketing_campaign_deliveries to service_role;
