REVOKE EXECUTE ON FUNCTION public.is_current_user_school_manager_for_school(bigint) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_school_manager_for_school(bigint) TO authenticated;
