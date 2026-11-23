begin;

-- Private, school-scoped staff signature registry. One signature is attached to
-- the staff account identity; primary authority is configured separately by role.
create table if not exists public.hr_staff_signatures (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null references public.schools(id) on delete restrict,
  teacher_id bigint not null references public.teachers(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role_id bigint references public.roles(id) on delete set null,
  storage_path text not null,
  is_active boolean not null default true,
  registered_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep previous signature versions so already signed documents retain their exact asset.
create unique index if not exists hr_staff_signatures_one_active_per_teacher_uidx
  on public.hr_staff_signatures(school_id, teacher_id) where is_active is true;

create index if not exists hr_staff_signatures_school_profile_idx
  on public.hr_staff_signatures(school_id, profile_id);

create table if not exists public.hr_primary_signatories (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null references public.schools(id) on delete restrict,
  role_id bigint not null references public.roles(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  teacher_id bigint not null references public.teachers(id) on delete restrict,
  set_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_primary_signatories_school_role_uidx unique (school_id, role_id)
);

create index if not exists hr_primary_signatories_school_profile_idx
  on public.hr_primary_signatories(school_id, profile_id);

alter table public.hr_staff_signatures enable row level security;
alter table public.hr_primary_signatories enable row level security;

drop policy if exists hr_staff_signatures_school_read on public.hr_staff_signatures;
create policy hr_staff_signatures_school_read
on public.hr_staff_signatures for select to authenticated
using (
  public.is_current_user_super_admin()
  or exists (
    select 1 from public.profile_roles pr
    join public.roles r on r.id = pr.role_id
    where pr.profile_id = (select auth.uid())
      and pr.school_id = hr_staff_signatures.school_id
      and pr.is_active is true
      and lower(trim(r.role_name)) = 'secretary'
  )
  or profile_id = (select auth.uid())
);

drop policy if exists hr_staff_signatures_hr_manage on public.hr_staff_signatures;
create policy hr_staff_signatures_hr_manage
on public.hr_staff_signatures for all to authenticated
using (
  public.is_current_user_super_admin()
  or exists (
    select 1 from public.profile_roles pr
    join public.roles r on r.id = pr.role_id
    where pr.profile_id = (select auth.uid())
      and pr.school_id = hr_staff_signatures.school_id
      and pr.is_active is true
      and lower(trim(r.role_name)) = 'hr manager'
  )
)
with check (
  public.is_current_user_super_admin()
  or exists (
    select 1 from public.profile_roles pr
    join public.roles r on r.id = pr.role_id
    where pr.profile_id = (select auth.uid())
      and pr.school_id = hr_staff_signatures.school_id
      and pr.is_active is true
      and lower(trim(r.role_name)) = 'hr manager'
  )
);

drop policy if exists hr_primary_signatories_school_read on public.hr_primary_signatories;
create policy hr_primary_signatories_school_read
on public.hr_primary_signatories for select to authenticated
using (
  public.is_current_user_super_admin()
  or exists (
    select 1 from public.profile_roles pr
    join public.roles r on r.id = pr.role_id
    where pr.profile_id = (select auth.uid())
      and pr.school_id = hr_primary_signatories.school_id
      and pr.is_active is true
      and lower(trim(r.role_name)) in ('secretary','hr manager')
  )
  or profile_id = (select auth.uid())
);

drop policy if exists hr_primary_signatories_hr_manage on public.hr_primary_signatories;
create policy hr_primary_signatories_hr_manage
on public.hr_primary_signatories for all to authenticated
using (
  public.is_current_user_super_admin()
  or exists (
    select 1 from public.profile_roles actor
    join public.roles ar on ar.id = actor.role_id
    where actor.profile_id = (select auth.uid())
      and actor.school_id = hr_primary_signatories.school_id
      and actor.is_active is true
      and lower(trim(ar.role_name)) = 'hr manager'
  )
)
with check (
  public.is_current_user_super_admin()
  or (
    exists (
      select 1 from public.profile_roles target_role
      where target_role.profile_id = hr_primary_signatories.profile_id
        and target_role.school_id = hr_primary_signatories.school_id
        and target_role.role_id = hr_primary_signatories.role_id
        and target_role.is_active is true
    )
    and exists (
      select 1 from public.teachers t
      where t.id = hr_primary_signatories.teacher_id
        and t.school_id = hr_primary_signatories.school_id
        and t.user_id = hr_primary_signatories.profile_id
    )
    and exists (
      select 1 from public.profile_roles actor
      join public.roles ar on ar.id = actor.role_id
      where actor.profile_id = (select auth.uid())
        and actor.school_id = hr_primary_signatories.school_id
        and actor.is_active is true
        and lower(trim(ar.role_name)) = 'hr manager'
    )
  )
);

revoke all on public.hr_staff_signatures, public.hr_primary_signatories from anon, authenticated;
grant select, insert, update, delete on public.hr_staff_signatures to authenticated;
grant select, insert, update, delete on public.hr_primary_signatories to authenticated;

-- The existing Secretary signing screen already expects these two tables.
create table if not exists public.document_signing_requests (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null references public.schools(id) on delete restrict,
  title text not null,
  description text,
  document_path text not null,
  status text not null default 'pending'
    check (status in ('pending','in_progress','completed','cancelled')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.document_signing_recipients (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.document_signing_requests(id) on delete cascade,
  school_id bigint not null references public.schools(id) on delete restrict,
  teacher_id bigint not null references public.teachers(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending','signed','declined')),
  signed_at timestamptz,
  signature_id uuid references public.hr_staff_signatures(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint document_signing_recipients_request_profile_uidx unique (request_id, profile_id)
);

create index if not exists document_signing_requests_school_created_idx
  on public.document_signing_requests(school_id, created_at desc);
create index if not exists document_signing_recipients_profile_status_idx
  on public.document_signing_recipients(school_id, profile_id, status);

alter table public.document_signing_requests enable row level security;
alter table public.document_signing_recipients enable row level security;

drop policy if exists document_signing_requests_school_read on public.document_signing_requests;
create policy document_signing_requests_school_read
on public.document_signing_requests for select to authenticated
using (
  public.is_current_user_super_admin()
  or created_by = (select auth.uid())
  or exists (
    select 1 from public.document_signing_recipients dsr
    where dsr.request_id = document_signing_requests.id
      and dsr.profile_id = (select auth.uid())
  )
  or exists (
    select 1 from public.profile_roles pr
    join public.roles r on r.id = pr.role_id
    where pr.profile_id = (select auth.uid())
      and pr.school_id = document_signing_requests.school_id
      and pr.is_active is true
      and lower(trim(r.role_name)) in ('secretary','hr manager')
  )
);

drop policy if exists document_signing_requests_secretary_create on public.document_signing_requests;
create policy document_signing_requests_secretary_create
on public.document_signing_requests for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    public.is_current_user_super_admin()
    or exists (
      select 1 from public.profile_roles pr
      join public.roles r on r.id = pr.role_id
      where pr.profile_id = (select auth.uid())
        and pr.school_id = document_signing_requests.school_id
        and pr.is_active is true
        and lower(trim(r.role_name)) = 'secretary'
    )
  )
);

drop policy if exists document_signing_recipients_school_read on public.document_signing_recipients;
create policy document_signing_recipients_school_read
on public.document_signing_recipients for select to authenticated
using (
  public.is_current_user_super_admin()
  or profile_id = (select auth.uid())
  or exists (
    select 1 from public.profile_roles pr
    join public.roles r on r.id = pr.role_id
    where pr.profile_id = (select auth.uid())
      and pr.school_id = document_signing_recipients.school_id
      and pr.is_active is true
      and lower(trim(r.role_name)) in ('secretary','hr manager')
  )
);

drop policy if exists document_signing_recipients_secretary_create on public.document_signing_recipients;
create policy document_signing_recipients_secretary_create
on public.document_signing_recipients for insert to authenticated
with check (
  exists (
    select 1 from public.document_signing_requests dsr
    where dsr.id = document_signing_recipients.request_id
      and dsr.school_id = document_signing_recipients.school_id
      and dsr.created_by = (select auth.uid())
  )
  and exists (
    select 1 from public.teachers t
    where t.id = document_signing_recipients.teacher_id
      and t.school_id = document_signing_recipients.school_id
      and t.user_id = document_signing_recipients.profile_id
  )
);

drop policy if exists document_signing_recipients_self_update on public.document_signing_recipients;
create policy document_signing_recipients_self_update
on public.document_signing_recipients for update to authenticated
using (
  profile_id = (select auth.uid()) and status = 'pending'
)
with check (
  profile_id = (select auth.uid())
  and status in ('signed','declined')
  and (
    status <> 'signed'
    or (
      signed_at is not null
      and exists (
        select 1 from public.hr_staff_signatures hs
        where hs.id = document_signing_recipients.signature_id
          and hs.school_id = document_signing_recipients.school_id
          and hs.teacher_id = document_signing_recipients.teacher_id
          and hs.profile_id = (select auth.uid())
          and hs.is_active is true
      )
    )
  )
);

revoke all on public.document_signing_requests, public.document_signing_recipients from anon, authenticated;
grant select, insert on public.document_signing_requests to authenticated;
grant select, insert on public.document_signing_recipients to authenticated;
grant update (status, signed_at, signature_id) on public.document_signing_recipients to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hr-staff-signatures', 'hr-staff-signatures', false, 2097152, array['image/png','image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/png','image/jpeg'];

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('school-signing-documents', 'school-signing-documents', false, 15728640, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 15728640, allowed_mime_types = array['application/pdf'];

drop policy if exists hr_signature_objects_read on storage.objects;
create policy hr_signature_objects_read on storage.objects for select to authenticated
using (
  bucket_id = 'hr-staff-signatures'
  and (
    public.is_current_user_super_admin()
    or exists (
      select 1 from public.profile_roles pr
      join public.roles r on r.id = pr.role_id
      where pr.profile_id = (select auth.uid())
        and pr.school_id = (storage.foldername(name))[1]::bigint
        and pr.is_active is true
        and lower(trim(r.role_name)) in ('hr manager','secretary')
    )
    or exists (
      select 1 from public.hr_staff_signatures hs
      where hs.storage_path = name and hs.profile_id = (select auth.uid())
    )
    or exists (
      select 1 from public.document_signing_recipients dsr
      join public.hr_staff_signatures hs on hs.id = dsr.signature_id
      where dsr.profile_id = (select auth.uid()) and hs.storage_path = name
    )
  )
);

drop policy if exists hr_signature_objects_hr_insert on storage.objects;
create policy hr_signature_objects_hr_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'hr-staff-signatures'
  and (
    public.is_current_user_super_admin()
    or exists (
      select 1 from public.profile_roles pr
      join public.roles r on r.id = pr.role_id
      where pr.profile_id = (select auth.uid())
        and pr.school_id = (storage.foldername(name))[1]::bigint
        and pr.is_active is true
        and lower(trim(r.role_name)) = 'hr manager'
    )
  )
);

drop policy if exists hr_signature_objects_hr_delete on storage.objects;
create policy hr_signature_objects_hr_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'hr-staff-signatures'
  and (
    public.is_current_user_super_admin()
    or exists (
      select 1 from public.profile_roles pr
      join public.roles r on r.id = pr.role_id
      where pr.profile_id = (select auth.uid())
        and pr.school_id = (storage.foldername(name))[1]::bigint
        and pr.is_active is true
        and lower(trim(r.role_name)) = 'hr manager'
    )
  )
);

drop policy if exists school_signing_documents_school_read on storage.objects;
create policy school_signing_documents_school_read on storage.objects for select to authenticated
using (
  bucket_id = 'school-signing-documents'
  and (
    public.is_current_user_super_admin()
    or exists (
      select 1 from public.profile_roles pr
      join public.roles r on r.id = pr.role_id
      where pr.profile_id = (select auth.uid())
        and pr.school_id = (storage.foldername(name))[1]::bigint
        and pr.is_active is true
        and lower(trim(r.role_name)) in ('secretary','hr manager')
    )
    or exists (
      select 1 from public.document_signing_recipients dsr
      where dsr.profile_id = (select auth.uid())
        and dsr.school_id = (storage.foldername(name))[1]::bigint
    )
  )
);

drop policy if exists school_signing_documents_secretary_insert on storage.objects;
create policy school_signing_documents_secretary_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'school-signing-documents'
  and (
    public.is_current_user_super_admin()
    or exists (
      select 1 from public.profile_roles pr
      join public.roles r on r.id = pr.role_id
      where pr.profile_id = (select auth.uid())
        and pr.school_id = (storage.foldername(name))[1]::bigint
        and pr.is_active is true
        and lower(trim(r.role_name)) = 'secretary'
    )
  )
);


-- Immutable audit trail for signature registration/replacement and primary signatory changes.
create table if not exists public.hr_signature_audit (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null references public.schools(id) on delete restrict,
  entity_type text not null check (entity_type in ('staff_signature','primary_signatory')),
  entity_id uuid not null,
  action text not null check (action in ('registered','replaced','deactivated','primary_assigned','primary_changed','primary_removed')),
  actor_user_id uuid references auth.users(id) on delete set null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);
create index if not exists hr_signature_audit_school_created_idx
  on public.hr_signature_audit(school_id, created_at desc);
alter table public.hr_signature_audit enable row level security;
drop policy if exists hr_signature_audit_hr_read on public.hr_signature_audit;
create policy hr_signature_audit_hr_read on public.hr_signature_audit
for select to authenticated using (
  public.is_current_user_super_admin()
  or exists (
    select 1 from public.profile_roles pr
    join public.roles r on r.id = pr.role_id
    where pr.profile_id = (select auth.uid())
      and pr.school_id = hr_signature_audit.school_id
      and pr.is_active is true
      and lower(trim(r.role_name)) = 'hr manager'
  )
);
revoke all on public.hr_signature_audit from anon, authenticated;
grant select on public.hr_signature_audit to authenticated;

create or replace function public.audit_hr_signature_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id bigint;
  v_entity_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_action text;
begin
  if tg_op = 'DELETE' then
    v_school_id := old.school_id;
    v_entity_id := old.id;
    v_old := to_jsonb(old) - 'storage_path';
    v_new := null;
    v_action := case when tg_table_name = 'hr_staff_signatures' then 'deactivated' else 'primary_removed' end;
  elsif tg_op = 'INSERT' then
    v_school_id := new.school_id;
    v_entity_id := new.id;
    v_old := null;
    v_new := to_jsonb(new) - 'storage_path';
    v_action := case when tg_table_name = 'hr_staff_signatures' then 'registered' else 'primary_assigned' end;
  else
    v_school_id := new.school_id;
    v_entity_id := new.id;
    v_old := to_jsonb(old) - 'storage_path';
    v_new := to_jsonb(new) - 'storage_path';
    if tg_table_name = 'hr_staff_signatures' then
      v_action := case when old.is_active and not new.is_active then 'deactivated' else 'replaced' end;
    else
      v_action := 'primary_changed';
    end if;
  end if;

  insert into public.hr_signature_audit
    (school_id, entity_type, entity_id, action, actor_user_id, old_value, new_value)
  values (
    v_school_id,
    case when tg_table_name = 'hr_staff_signatures' then 'staff_signature' else 'primary_signatory' end,
    v_entity_id,
    v_action,
    auth.uid(),
    v_old,
    v_new
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_audit_hr_staff_signatures on public.hr_staff_signatures;
create trigger trg_audit_hr_staff_signatures
after insert or update or delete on public.hr_staff_signatures
for each row execute function public.audit_hr_signature_change();

drop trigger if exists trg_audit_hr_primary_signatories on public.hr_primary_signatories;
create trigger trg_audit_hr_primary_signatories
after insert or update or delete on public.hr_primary_signatories
for each row execute function public.audit_hr_signature_change();

commit;
