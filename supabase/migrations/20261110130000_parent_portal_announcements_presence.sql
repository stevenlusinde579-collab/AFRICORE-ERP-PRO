-- Parent Portal: managed notices, group presence, and live parent conference support.
-- All access remains backend-only through the trusted service role.

create table if not exists public.parent_portal_announcements (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null references public.schools(id) on delete cascade,
  class_id bigint references public.classes(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 180),
  message text not null check (char_length(message) between 5 and 5000),
  category text not null default 'Taarifa',
  status text not null default 'published' check (status in ('published','archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists parent_portal_announcements_scope_idx
  on public.parent_portal_announcements(school_id, status, class_id, created_at desc);

create table if not exists public.parent_portal_presence (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null references public.schools(id) on delete cascade,
  class_id bigint not null references public.classes(id) on delete cascade,
  parent_account_id uuid references public.parent_portal_accounts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  participant_type text not null check (participant_type in ('parent','staff')),
  display_name text not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parent_portal_presence_identity_check check (
    (participant_type = 'parent' and parent_account_id is not null and user_id is null)
    or
    (participant_type = 'staff' and user_id is not null and parent_account_id is null)
  )
);
create unique index if not exists parent_portal_presence_parent_unique
  on public.parent_portal_presence(class_id, parent_account_id)
  where parent_account_id is not null;
create unique index if not exists parent_portal_presence_staff_unique
  on public.parent_portal_presence(class_id, user_id)
  where user_id is not null;
create index if not exists parent_portal_presence_online_idx
  on public.parent_portal_presence(school_id, class_id, last_seen_at desc);

alter table public.parent_portal_announcements enable row level security;
alter table public.parent_portal_presence enable row level security;
revoke all on public.parent_portal_announcements from anon, authenticated;
revoke all on public.parent_portal_presence from anon, authenticated;
grant all on public.parent_portal_announcements to service_role;
grant all on public.parent_portal_presence to service_role;
