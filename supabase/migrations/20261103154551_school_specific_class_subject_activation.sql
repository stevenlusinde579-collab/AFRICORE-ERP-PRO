ALTER TABLE public.classes
    ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.class_subjects
    ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.is_current_user_school_manager_for_school(target_school_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
    SELECT CASE
        WHEN EXISTS (
            SELECT 1
            FROM public.profile_roles pr
            WHERE pr.profile_id = auth.uid()
              AND pr.is_active IS TRUE
        )
        THEN EXISTS (
            SELECT 1
            FROM public.profile_roles pr
            JOIN public.roles r ON r.id = pr.role_id
            WHERE pr.profile_id = auth.uid()
              AND pr.is_active IS TRUE
              AND pr.school_id = target_school_id
              AND lower(trim(r.role_name)) IN (
                  'headmaster',
                  'deputy headmaster',
                  'academic master'
              )
        )
        ELSE EXISTS (
            SELECT 1
            FROM public.profiles p
            JOIN public.roles r ON r.id = p.role_id
            WHERE p.id = auth.uid()
              AND p.school_id = target_school_id
              AND lower(trim(r.role_name)) IN (
                  'headmaster',
                  'deputy headmaster',
                  'academic master'
              )
        )
    END;
$function$;

REVOKE ALL ON FUNCTION public.is_current_user_school_manager_for_school(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_school_manager_for_school(bigint) TO authenticated;

DROP POLICY IF EXISTS af_school_managers_update_classes ON public.classes;
CREATE POLICY af_school_managers_update_classes
ON public.classes
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
    public.is_current_user_super_admin()
    OR public.is_current_user_school_manager_for_school(school_id)
)
WITH CHECK (
    public.is_current_user_super_admin()
    OR public.is_current_user_school_manager_for_school(school_id)
);

DROP POLICY IF EXISTS af_school_managers_insert_class_subjects ON public.class_subjects;
CREATE POLICY af_school_managers_insert_class_subjects
ON public.class_subjects
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_current_user_super_admin()
    OR EXISTS (
        SELECT 1
        FROM public.classes c
        WHERE c.id = class_subjects.class_id
          AND public.is_current_user_school_manager_for_school(c.school_id)
    )
);

DROP POLICY IF EXISTS af_school_managers_update_class_subjects ON public.class_subjects;
CREATE POLICY af_school_managers_update_class_subjects
ON public.class_subjects
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
    public.is_current_user_super_admin()
    OR EXISTS (
        SELECT 1
        FROM public.classes c
        WHERE c.id = class_subjects.class_id
          AND public.is_current_user_school_manager_for_school(c.school_id)
    )
)
WITH CHECK (
    public.is_current_user_super_admin()
    OR EXISTS (
        SELECT 1
        FROM public.classes c
        WHERE c.id = class_subjects.class_id
          AND public.is_current_user_school_manager_for_school(c.school_id)
    )
);

DROP POLICY IF EXISTS af_school_managers_delete_class_subjects ON public.class_subjects;
CREATE POLICY af_school_managers_delete_class_subjects
ON public.class_subjects
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (
    public.is_current_user_super_admin()
    OR EXISTS (
        SELECT 1
        FROM public.classes c
        WHERE c.id = class_subjects.class_id
          AND public.is_current_user_school_manager_for_school(c.school_id)
    )
);

CREATE INDEX IF NOT EXISTS idx_class_subjects_active_class
    ON public.class_subjects (class_id, is_active);

COMMENT ON COLUMN public.classes.is_active IS
    'School-specific availability flag. Inactive classes are hidden from attendance and normal class selection.';

COMMENT ON COLUMN public.class_subjects.is_active IS
    'School/class-specific subject availability flag. Does not change the shared subject catalog.';
