-- Keep finance chart-of-accounts visible only to the user's own school.
-- Users with the manage_finance permission may create and update accounts
-- for their active school role. Super Admin retains cross-school access.

DROP POLICY IF EXISTS af_score_tenant_guard ON finance.chart_of_accounts;

CREATE POLICY finance_chart_accounts_school_select
ON finance.chart_of_accounts
FOR SELECT
TO authenticated
USING (
  school_id = (SELECT public.get_current_user_school_id())
  OR (SELECT public.is_current_user_super_admin())
);

CREATE POLICY finance_chart_accounts_manage_insert
ON finance.chart_of_accounts
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT public.is_current_user_super_admin())
  OR (
    school_id = (SELECT public.get_current_user_school_id())
    AND EXISTS (
      SELECT 1
      FROM public.profile_roles pr
      JOIN public.role_permissions rp ON rp.role_id = pr.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE pr.profile_id = (SELECT auth.uid())
        AND pr.school_id = finance.chart_of_accounts.school_id
        AND pr.is_active IS TRUE
        AND p.is_active IS TRUE
        AND p.permission_name = 'manage_finance'
    )
  )
);

CREATE POLICY finance_chart_accounts_manage_update
ON finance.chart_of_accounts
FOR UPDATE
TO authenticated
USING (
  (SELECT public.is_current_user_super_admin())
  OR (
    school_id = (SELECT public.get_current_user_school_id())
    AND EXISTS (
      SELECT 1
      FROM public.profile_roles pr
      JOIN public.role_permissions rp ON rp.role_id = pr.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE pr.profile_id = (SELECT auth.uid())
        AND pr.school_id = finance.chart_of_accounts.school_id
        AND pr.is_active IS TRUE
        AND p.is_active IS TRUE
        AND p.permission_name = 'manage_finance'
    )
  )
)
WITH CHECK (
  (SELECT public.is_current_user_super_admin())
  OR (
    school_id = (SELECT public.get_current_user_school_id())
    AND EXISTS (
      SELECT 1
      FROM public.profile_roles pr
      JOIN public.role_permissions rp ON rp.role_id = pr.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE pr.profile_id = (SELECT auth.uid())
        AND pr.school_id = finance.chart_of_accounts.school_id
        AND pr.is_active IS TRUE
        AND p.is_active IS TRUE
        AND p.permission_name = 'manage_finance'
    )
  )
);

GRANT SELECT, INSERT, UPDATE ON finance.chart_of_accounts TO authenticated;
