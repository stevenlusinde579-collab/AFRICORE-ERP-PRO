-- Allow employees to submit and track only their own leave requests.
-- HR Manager and Super Admin retain school-level review access.
ALTER TABLE public.hr_leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hr_school_scope ON public.hr_leave_requests;
DROP POLICY IF EXISTS hr_leave_requests_select_scope ON public.hr_leave_requests;
DROP POLICY IF EXISTS hr_leave_requests_insert_own ON public.hr_leave_requests;
DROP POLICY IF EXISTS hr_leave_requests_update_hr ON public.hr_leave_requests;

CREATE POLICY hr_leave_requests_select_scope
ON public.hr_leave_requests
FOR SELECT
TO authenticated
USING (
  public.is_current_user_super_admin()
  OR EXISTS (
    SELECT 1
    FROM public.profile_roles pr
    JOIN public.roles r ON r.id = pr.role_id
    WHERE pr.profile_id = (SELECT auth.uid())
      AND pr.is_active IS TRUE
      AND pr.school_id = hr_leave_requests.school_id
      AND lower(trim(r.role_name)) = 'hr manager'
  )
  OR EXISTS (
    SELECT 1
    FROM public.employees e
    LEFT JOIN public.profiles p ON p.id = (SELECT auth.uid())
    WHERE e.id = hr_leave_requests.employee_id
      AND e.school_id = hr_leave_requests.school_id
      AND (
        e.user_id = (SELECT auth.uid())
        OR p.employee_id = e.id
        OR (p.teacher_id IS NOT NULL AND p.teacher_id = e.source_teacher_id)
      )
  )
);

CREATE POLICY hr_leave_requests_insert_own
ON public.hr_leave_requests
FOR INSERT
TO authenticated
WITH CHECK (
  status = 'pending'
  AND reviewed_by IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.employees e
    LEFT JOIN public.profiles p ON p.id = (SELECT auth.uid())
    WHERE e.id = hr_leave_requests.employee_id
      AND e.school_id = hr_leave_requests.school_id
      AND (
        e.user_id = (SELECT auth.uid())
        OR p.employee_id = e.id
        OR (p.teacher_id IS NOT NULL AND p.teacher_id = e.source_teacher_id)
      )
  )
);

CREATE POLICY hr_leave_requests_update_hr
ON public.hr_leave_requests
FOR UPDATE
TO authenticated
USING (
  public.is_current_user_super_admin()
  OR EXISTS (
    SELECT 1
    FROM public.profile_roles pr
    JOIN public.roles r ON r.id = pr.role_id
    WHERE pr.profile_id = (SELECT auth.uid())
      AND pr.is_active IS TRUE
      AND pr.school_id = hr_leave_requests.school_id
      AND lower(trim(r.role_name)) IN ('hr manager', 'headmaster')
  )
)
WITH CHECK (
  public.is_current_user_super_admin()
  OR EXISTS (
    SELECT 1
    FROM public.profile_roles pr
    JOIN public.roles r ON r.id = pr.role_id
    WHERE pr.profile_id = (SELECT auth.uid())
      AND pr.is_active IS TRUE
      AND pr.school_id = hr_leave_requests.school_id
      AND lower(trim(r.role_name)) IN ('hr manager', 'headmaster')
  )
);
