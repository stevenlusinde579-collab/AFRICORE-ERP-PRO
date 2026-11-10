-- Parent Portal foundation: separate parent identities, credentials history and class chat.
-- Direct browser access is intentionally disabled. Trusted backend uses service_role.
create table if not exists public.parent_portal_accounts (
  id uuid primary key default gen_random_uuid(),
  student_id bigint not null unique references public.students(id) on delete cascade,
  school_id bigint not null references public.schools(id) on delete cascade,
  username text not null,
  password_hash text not null,
  password_salt text not null,
  must_change_password boolean not null default true,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists parent_portal_accounts_school_idx on public.parent_portal_accounts(school_id);
create index if not exists parent_portal_accounts_username_idx on public.parent_portal_accounts(school_id, username);

create table if not exists public.parent_portal_credential_history (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null references public.schools(id) on delete cascade,
  student_id bigint not null references public.students(id) on delete cascade,
  recipient_phone text,
  status text not null default 'pending' check (status in ('pending','sent','queued','delivered','failed')),
  provider text,
  provider_message_id text,
  error_message text,
  sent_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists parent_portal_credential_history_student_idx
  on public.parent_portal_credential_history(school_id, student_id, created_at desc);

create table if not exists public.parent_portal_chat_messages (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null references public.schools(id) on delete cascade,
  class_id bigint not null references public.classes(id) on delete cascade,
  student_id bigint references public.students(id) on delete set null,
  parent_account_id uuid references public.parent_portal_accounts(id) on delete set null,
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_type text not null check (sender_type in ('parent','staff')),
  sender_name text not null,
  message text not null check (char_length(message) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists parent_portal_chat_class_idx
  on public.parent_portal_chat_messages(school_id, class_id, created_at desc);

create table if not exists public.parent_portal_meetings (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null references public.schools(id) on delete cascade,
  class_id bigint references public.classes(id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  meeting_url text,
  meeting_provider text,
  status text not null default 'scheduled' check (status in ('scheduled','cancelled','completed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint parent_portal_meeting_times_valid check (ends_at is null or ends_at > starts_at)
);
create index if not exists parent_portal_meetings_scope_idx
  on public.parent_portal_meetings(school_id, class_id, starts_at);

alter table public.parent_portal_accounts enable row level security;
alter table public.parent_portal_credential_history enable row level security;
alter table public.parent_portal_chat_messages enable row level security;
alter table public.parent_portal_meetings enable row level security;

-- No direct browser access, even for authenticated staff/parents.
revoke all on public.parent_portal_accounts from anon, authenticated;
revoke all on public.parent_portal_credential_history from anon, authenticated;
revoke all on public.parent_portal_chat_messages from anon, authenticated;
revoke all on public.parent_portal_meetings from anon, authenticated;
grant all on public.parent_portal_accounts to service_role;
grant all on public.parent_portal_credential_history to service_role;
grant all on public.parent_portal_chat_messages to service_role;
grant all on public.parent_portal_meetings to service_role;
