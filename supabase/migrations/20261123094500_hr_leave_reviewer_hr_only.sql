-- Restrict leave decisions to HR Manager and Super Admin.
DROP POLICY IF EXISTS hr_leave_requests_update_hr ON public.hr_leave_requests;

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
      AND lower(trim(r.role_name)) = 'hr manager'
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
      AND lower(trim(r.role_name)) = 'hr manager'
  )
);
