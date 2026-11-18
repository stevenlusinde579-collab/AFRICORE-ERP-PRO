begin;

-- Exam PDFs are stored as private objects. Legacy upload paths are not
-- consistently keyed by exam_id, so use the Storage owner recorded by
-- Supabase and resolve that owner's current school from public.profiles.
-- This preserves access for files with a valid owner/profile mapping while
-- denying orphaned ownerless objects until they are safely reconciled.
--
-- Existing permissive bucket policies are intentionally retained for
-- compatibility; these restrictive policies are ANDed with them.

drop policy if exists af_score_exam_papers_school_select
  on storage.objects;
create policy af_score_exam_papers_school_select
  on storage.objects
  as restrictive
  for select
  to authenticated
  using (
    bucket_id <> 'exam-papers'
    or public.is_current_user_super_admin()
    or exists (
      select 1
      from public.profiles owner_profile
      where owner_profile.id::text = storage.objects.owner_id
        and owner_profile.school_id = public.get_current_user_school_id()
    )
  );

drop policy if exists af_score_exam_papers_school_insert
  on storage.objects;
create policy af_score_exam_papers_school_insert
  on storage.objects
  as restrictive
  for insert
  to authenticated
  with check (
    bucket_id <> 'exam-papers'
    or public.is_current_user_super_admin()
    or (
      storage.objects.owner_id = (select auth.uid())::text
      and exists (
        select 1
        from public.profiles owner_profile
        where owner_profile.id = (select auth.uid())
          and owner_profile.school_id = public.get_current_user_school_id()
      )
    )
  );

drop policy if exists af_score_exam_papers_school_update
  on storage.objects;
create policy af_score_exam_papers_school_update
  on storage.objects
  as restrictive
  for update
  to authenticated
  using (
    bucket_id <> 'exam-papers'
    or public.is_current_user_super_admin()
    or exists (
      select 1
      from public.profiles owner_profile
      where owner_profile.id::text = storage.objects.owner_id
        and owner_profile.school_id = public.get_current_user_school_id()
    )
  )
  with check (
    bucket_id <> 'exam-papers'
    or public.is_current_user_super_admin()
    or (
      storage.objects.owner_id = (select auth.uid())::text
      and exists (
        select 1
        from public.profiles owner_profile
        where owner_profile.id = (select auth.uid())
          and owner_profile.school_id = public.get_current_user_school_id()
      )
    )
  );

drop policy if exists af_score_exam_papers_school_delete
  on storage.objects;
create policy af_score_exam_papers_school_delete
  on storage.objects
  as restrictive
  for delete
  to authenticated
  using (
    bucket_id <> 'exam-papers'
    or public.is_current_user_super_admin()
    or exists (
      select 1
      from public.profiles owner_profile
      where owner_profile.id::text = storage.objects.owner_id
        and owner_profile.school_id = public.get_current_user_school_id()
    )
  );

commit;
