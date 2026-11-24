begin;

-- Staff signatures are embedded in official school documents (payroll, receipts,
-- letters and reports). Allow active members of the same school to read the
-- signature registry; keep writes restricted to HR Manager as before.
drop policy if exists hr_staff_signatures_school_document_read on public.hr_staff_signatures;
create policy hr_staff_signatures_school_document_read
on public.hr_staff_signatures
for select
to authenticated
using (
  public.is_current_user_super_admin()
  or exists (
    select 1
    from public.profile_roles pr
    where pr.profile_id = (select auth.uid())
      and pr.school_id = hr_staff_signatures.school_id
      and pr.is_active is true
  )
);

-- Signed URLs are generated only after the registry row is visible. This
-- matching storage policy allows those same-school document renderers to read
-- the private image without making the bucket public.
drop policy if exists hr_signature_objects_school_document_read on storage.objects;
create policy hr_signature_objects_school_document_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'hr-staff-signatures'
  and (
    public.is_current_user_super_admin()
    or exists (
      select 1
      from public.profile_roles pr
      where pr.profile_id = (select auth.uid())
        and pr.school_id = (storage.foldername(name))[1]::bigint
        and pr.is_active is true
    )
  )
);

commit;
