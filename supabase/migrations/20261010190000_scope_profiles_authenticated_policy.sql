-- Scope authenticated access to profiles by school.
-- The restrictive af_score_tenant_guard remains in place as defense in depth.
DROP POLICY IF EXISTS af_score_profiles_authenticated_base ON public.profiles;

CREATE POLICY af_score_profiles_authenticated_base
ON public.profiles
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  public.is_current_user_super_admin()
  OR school_id = public.get_current_user_school_id()
  OR id = auth.uid()
)
WITH CHECK (
  public.is_current_user_super_admin()
  OR school_id = public.get_current_user_school_id()
  OR id = auth.uid()
);
