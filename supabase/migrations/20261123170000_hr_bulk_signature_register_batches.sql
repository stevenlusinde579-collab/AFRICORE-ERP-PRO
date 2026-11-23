begin;

create table if not exists public.hr_signature_register_batches (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null references public.schools(id) on delete restrict,
  original_pdf_path text not null,
  original_file_name text not null,
  page_count integer not null check (page_count between 1 and 30),
  staff_count integer not null default 0,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.hr_staff_signatures
  add column if not exists source_batch_id uuid
  references public.hr_signature_register_batches(id) on delete set null;

create index if not exists hr_signature_register_batches_school_created_idx
  on public.hr_signature_register_batches(school_id, created_at desc);
create index if not exists hr_staff_signatures_source_batch_idx
  on public.hr_staff_signatures(source_batch_id);

alter table public.hr_signature_register_batches enable row level security;
drop policy if exists hr_signature_register_batches_hr_read on public.hr_signature_register_batches;
create policy hr_signature_register_batches_hr_read
on public.hr_signature_register_batches for select to authenticated
using (
  public.is_current_user_super_admin()
  or exists (
    select 1 from public.profile_roles pr
    join public.roles r on r.id = pr.role_id
    where pr.profile_id = (select auth.uid())
      and pr.school_id = hr_signature_register_batches.school_id
      and pr.is_active is true
      and lower(trim(r.role_name)) = 'hr manager'
  )
);
revoke all on public.hr_signature_register_batches from anon, authenticated;
grant select on public.hr_signature_register_batches to authenticated;

drop policy if exists school_signing_documents_secretary_insert on storage.objects;
drop policy if exists school_signing_documents_hr_insert on storage.objects;
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
        and lower(trim(r.role_name)) in ('secretary','hr manager')
    )
  )
);

commit;
