begin;

-- Exam PDFs are private objects. Current upload code stores files as:
--   <exam_id>/<exam_subject_id>/<filename>.pdf
-- Older objects may have legacy paths, so read access accepts either a
-- verified exam-to-school relationship or a verified uploader profile.
-- New uploads must use the current exam-id path and the authenticated
-- uploader must belong to that same school.
--
-- These restrictive policies are ANDed with the existing permissive
-- bucket policies; they do not grant access by themselves.

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
      from public.exams e
      where e.id::text = split_part(storage.objects.name, '/', 1)
        and e.school_id = public.get_current_user_school_id()
    )
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
        from public.profiles uploader
        join public.exams e
          on e.id::text = split_part(storage.objects.name, '/', 1)
        where uploader.id = (select auth.uid())
          and uploader.school_id = public.get_current_user_school_id()
          and e.school_id = uploader.school_id
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
      from public.exams e
      where e.id::text = split_part(storage.objects.name, '/', 1)
        and e.school_id = public.get_current_user_school_id()
    )
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
        from public.profiles uploader
        join public.exams e
          on e.id::text = split_part(storage.objects.name, '/', 1)
        where uploader.id = (select auth.uid())
          and uploader.school_id = public.get_current_user_school_id()
          and e.school_id = uploader.school_id
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
      from public.exams e
      where e.id::text = split_part(storage.objects.name, '/', 1)
        and e.school_id = public.get_current_user_school_id()
    )
    or exists (
      select 1
      from public.profiles owner_profile
      where owner_profile.id::text = storage.objects.owner_id
        and owner_profile.school_id = public.get_current_user_school_id()
    )
  );

commit;
