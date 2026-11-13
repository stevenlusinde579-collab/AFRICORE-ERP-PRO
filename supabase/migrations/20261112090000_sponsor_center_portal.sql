-- Sponsor / Centre Portal
-- Isolated by school_id; the API uses the service role after validating the signed-in staff
-- school and sponsor-centre assignment. No accounting tables are changed.
create table if not exists public.sponsor_organizations (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null references public.schools(id) on delete cascade,
  sponsor_name text not null,
  sponsor_phone text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id)
);

create index if not exists sponsor_organizations_school_idx
  on public.sponsor_organizations (school_id, is_active);

create table if not exists public.sponsor_centers (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null,
  sponsor_id uuid not null references public.sponsor_organizations(id) on delete cascade,
  center_name text not null,
  supervisor_name text not null,
  supervisor_phone text not null,
  supervisor_email text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, supervisor_email)
);

create index if not exists sponsor_centers_school_idx
  on public.sponsor_centers (school_id, sponsor_id, is_active);

create table if not exists public.sponsor_center_students (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null,
  center_id uuid not null references public.sponsor_centers(id) on delete cascade,
  student_id bigint not null references public.students(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id) on delete set null,
  unique (center_id, student_id)
);

create index if not exists sponsor_center_students_school_center_idx
  on public.sponsor_center_students (school_id, center_id);
create index if not exists sponsor_center_students_school_student_idx
  on public.sponsor_center_students (school_id, student_id);

create table if not exists public.sponsor_portal_accounts (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null,
  center_id uuid not null references public.sponsor_centers(id) on delete cascade,
  username text not null,
  password_hash text not null,
  password_salt text not null,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, center_id),
  unique (school_id, username)
);

create index if not exists sponsor_portal_accounts_school_username_idx
  on public.sponsor_portal_accounts (school_id, lower(username));

alter table public.sponsor_organizations enable row level security;
alter table public.sponsor_centers enable row level security;
alter table public.sponsor_center_students enable row level security;
alter table public.sponsor_portal_accounts enable row level security;

-- No browser role gets direct table access. All access is mediated by the
-- authenticated backend, which validates school_id and centre assignment.
revoke all on public.sponsor_organizations from anon, authenticated;
revoke all on public.sponsor_centers from anon, authenticated;
revoke all on public.sponsor_center_students from anon, authenticated;
revoke all on public.sponsor_portal_accounts from anon, authenticated;
grant all on public.sponsor_organizations to service_role;
grant all on public.sponsor_centers to service_role;
grant all on public.sponsor_center_students to service_role;
grant all on public.sponsor_portal_accounts to service_role;
