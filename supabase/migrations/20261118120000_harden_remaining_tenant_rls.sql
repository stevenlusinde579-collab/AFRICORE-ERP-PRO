begin;

-- Defense-in-depth tenant guards for legacy tables whose permissive policies
-- currently allow all authenticated users. Restrictive policies are ANDed
-- with permissive policies and therefore cannot be bypassed by a broad
-- authenticated base policy.

-- Timetables already have a tenant predicate in a permissive policy. Make
-- that predicate restrictive so the broad base policy cannot OR around it.
drop policy if exists af_score_class_timetables_tenant_restrictive
  on public.class_timetables;
create policy af_score_class_timetables_tenant_restrictive
  on public.class_timetables
  as restrictive
  for all
  to authenticated
  using (
    public.is_current_user_super_admin()
    or school_id = public.get_current_user_school_id()
    or public.is_current_user_academic_master_for_school(school_id)
  )
  with check (
    public.is_current_user_super_admin()
    or school_id = public.get_current_user_school_id()
    or public.is_current_user_academic_master_for_school(school_id)
  );

-- Exam grading scales are owned by the school that owns their exam.
drop policy if exists af_score_exam_grading_scales_tenant_restrictive
  on public.exam_grading_scales;
create policy af_score_exam_grading_scales_tenant_restrictive
  on public.exam_grading_scales
  as restrictive
  for all
  to authenticated
  using (
    public.is_current_user_super_admin()
    or exists (
      select 1
      from public.exams e
      where e.id = exam_grading_scales.exam_id
        and e.school_id = public.get_current_user_school_id()
    )
  )
  with check (
    public.is_current_user_super_admin()
    or exists (
      select 1
      from public.exams e
      where e.id = exam_grading_scales.exam_id
        and e.school_id = public.get_current_user_school_id()
    )
  );

-- Exam questions are scoped through their parent exam. If an exam_subject_id
-- is supplied, it must belong to the same exam to prevent cross-exam links.
drop policy if exists af_score_exam_questions_tenant_restrictive
  on public.exam_questions;
create policy af_score_exam_questions_tenant_restrictive
  on public.exam_questions
  as restrictive
  for all
  to authenticated
  using (
    public.is_current_user_super_admin()
    or exists (
      select 1
      from public.exams e
      where e.id = exam_questions.exam_id
        and e.school_id = public.get_current_user_school_id()
    )
  )
  with check (
    public.is_current_user_super_admin()
    or (
      exists (
        select 1
        from public.exams e
        where e.id = exam_questions.exam_id
          and e.school_id = public.get_current_user_school_id()
      )
      and (
        exam_questions.exam_subject_id is null
        or exists (
          select 1
          from public.exam_subjects es
          where es.id = exam_questions.exam_subject_id
            and es.exam_id = exam_questions.exam_id
        )
      )
    )
  );

-- Student question marks must reference a student and exam from the same
-- school, and the question/subject links must belong to that same exam.
drop policy if exists af_score_student_question_marks_tenant_restrictive
  on public.student_question_marks;
create policy af_score_student_question_marks_tenant_restrictive
  on public.student_question_marks
  as restrictive
  for all
  to authenticated
  using (
    public.is_current_user_super_admin()
    or exists (
      select 1
      from public.students s
      join public.exams e on e.id = student_question_marks.exam_id
      where s.id = student_question_marks.student_id
        and s.school_id = public.get_current_user_school_id()
        and e.school_id = public.get_current_user_school_id()
    )
  )
  with check (
    public.is_current_user_super_admin()
    or (
      exists (
        select 1
        from public.students s
        join public.exams e on e.id = student_question_marks.exam_id
        where s.id = student_question_marks.student_id
          and s.school_id = public.get_current_user_school_id()
          and e.school_id = public.get_current_user_school_id()
      )
      and exists (
        select 1
        from public.exam_questions q
        where q.id = student_question_marks.question_id
          and q.exam_id = student_question_marks.exam_id
      )
      and exists (
        select 1
        from public.exam_subjects es
        where es.id = student_question_marks.exam_subject_id
          and es.exam_id = student_question_marks.exam_id
      )
    )
  );

-- Legacy public-schema audit logs have no school_id; derive tenancy from
-- the profile of the actor. Super Admin retains global audit visibility.
drop policy if exists af_score_finance_audit_logs_tenant_restrictive
  on public.finance_audit_logs;
create policy af_score_finance_audit_logs_tenant_restrictive
  on public.finance_audit_logs
  as restrictive
  for select
  to authenticated
  using (
    public.is_current_user_super_admin()
    or exists (
      select 1
      from public.profiles p
      where p.id = finance_audit_logs.user_id
        and p.school_id = public.get_current_user_school_id()
    )
  );

-- Legacy journal entries are scoped by their accounting period. Older entries
-- without a period are scoped by their creator's profile.
drop policy if exists af_score_journal_entries_tenant_restrictive
  on public.journal_entries;
create policy af_score_journal_entries_tenant_restrictive
  on public.journal_entries
  as restrictive
  for select
  to authenticated
  using (
    public.is_current_user_super_admin()
    or exists (
      select 1
      from public.accounting_periods ap
      where ap.id = journal_entries.period_id
        and ap.school_id = public.get_current_user_school_id()
    )
    or (
      journal_entries.period_id is null
      and exists (
        select 1
        from public.profiles p
        where p.id = journal_entries.created_by
          and p.school_id = public.get_current_user_school_id()
      )
    )
  );

-- Journal lines inherit the tenant from their parent journal entry.
drop policy if exists af_score_journal_lines_tenant_restrictive
  on public.journal_lines;
create policy af_score_journal_lines_tenant_restrictive
  on public.journal_lines
  as restrictive
  for select
  to authenticated
  using (
    public.is_current_user_super_admin()
    or exists (
      select 1
      from public.journal_entries je
      left join public.accounting_periods ap on ap.id = je.period_id
      left join public.profiles creator on creator.id = je.created_by
      where je.id = journal_lines.journal_entry_id
        and (
          ap.school_id = public.get_current_user_school_id()
          or (
            je.period_id is null
            and creator.school_id = public.get_current_user_school_id()
          )
        )
    )
  );

commit;
