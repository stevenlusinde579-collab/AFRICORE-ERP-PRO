-- Allow active finance managers to create and update cash/bank accounts
-- while preserving the existing restrictive school-tenant guard.

DROP POLICY IF EXISTS finance_cash_accounts_manage_insert ON finance.cash_accounts;
DROP POLICY IF EXISTS finance_cash_accounts_manage_update ON finance.cash_accounts;

CREATE POLICY finance_cash_accounts_manage_insert
ON finance.cash_accounts
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT is_current_user_super_admin())
  OR (
    school_id = (SELECT get_current_user_school_id())
    AND EXISTS (
      SELECT 1
      FROM public.profile_roles pr
      JOIN public.role_permissions rp ON rp.role_id = pr.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE pr.profile_id = (SELECT auth.uid())
        AND pr.school_id = finance.cash_accounts.school_id
        AND pr.is_active IS TRUE
        AND p.is_active IS TRUE
        AND p.permission_name = 'manage_finance'
    )
  )
);

CREATE POLICY finance_cash_accounts_manage_update
ON finance.cash_accounts
FOR UPDATE
TO authenticated
USING (
  (SELECT is_current_user_super_admin())
  OR (
    school_id = (SELECT get_current_user_school_id())
    AND EXISTS (
      SELECT 1
      FROM public.profile_roles pr
      JOIN public.role_permissions rp ON rp.role_id = pr.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE pr.profile_id = (SELECT auth.uid())
        AND pr.school_id = finance.cash_accounts.school_id
        AND pr.is_active IS TRUE
        AND p.is_active IS TRUE
        AND p.permission_name = 'manage_finance'
    )
  )
)
WITH CHECK (
  (SELECT is_current_user_super_admin())
  OR (
    school_id = (SELECT get_current_user_school_id())
    AND EXISTS (
      SELECT 1
      FROM public.profile_roles pr
      JOIN public.role_permissions rp ON rp.role_id = pr.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE pr.profile_id = (SELECT auth.uid())
        AND pr.school_id = finance.cash_accounts.school_id
        AND pr.is_active IS TRUE
        AND p.is_active IS TRUE
        AND p.permission_name = 'manage_finance'
    )
  )
);

GRANT SELECT, INSERT, UPDATE ON finance.cash_accounts TO authenticated;
