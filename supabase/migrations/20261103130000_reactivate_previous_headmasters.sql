-- Allow previously removed Headmasters to be appointed again without
-- restoring their former school's access or deleting their account.
CREATE OR REPLACE FUNCTION public.assign_headmaster_to_school(
    p_profile_id uuid,
    p_school_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_headmaster_role_id bigint;
    v_profile record;
    v_school record;
    v_has_headmaster_history boolean;
    v_has_active_headmaster boolean;
    v_previous record;
    v_inactive_role_id bigint;
BEGIN
    IF p_profile_id IS NULL OR p_school_id IS NULL OR p_school_id <= 0 THEN
        RAISE EXCEPTION 'A valid Headmaster profile and school are required.';
    END IF;

    SELECT s.id, s.school_name, s.is_active
      INTO v_school
      FROM public.schools s
     WHERE s.id = p_school_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'The selected school was not found.';
    END IF;
    IF v_school.is_active IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'The selected school is inactive.';
    END IF;

    SELECT r.id INTO v_headmaster_role_id
      FROM public.roles r
     WHERE lower(trim(r.role_name)) = 'headmaster'
     ORDER BY r.id LIMIT 1;
    IF v_headmaster_role_id IS NULL THEN
        RAISE EXCEPTION 'The Headmaster role is not configured.';
    END IF;

    SELECT p.id, p.full_name, p.phone, p.role_id, p.school_id
      INTO v_profile
      FROM public.profiles p
     WHERE p.id = p_profile_id
     FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'The selected Headmaster account was not found.';
    END IF;

    SELECT
        EXISTS (
            SELECT 1 FROM public.profile_roles pr
             WHERE pr.profile_id = p_profile_id
               AND pr.role_id = v_headmaster_role_id
        ),
        EXISTS (
            SELECT 1 FROM public.profile_roles pr
             WHERE pr.profile_id = p_profile_id
               AND pr.role_id = v_headmaster_role_id
               AND pr.is_active IS TRUE
        )
      INTO v_has_headmaster_history, v_has_active_headmaster;

    -- Existing inactive Headmaster records are valid candidates for reappointment.
    -- Do not allow an unrelated account with no Headmaster history to be promoted.
    IF NOT v_has_headmaster_history
       AND COALESCE(v_profile.role_id, 0) <> v_headmaster_role_id THEN
        RAISE EXCEPTION 'The selected account does not have a Headmaster role.';
    END IF;

    -- Revoke the previous Headmaster for this destination school only.
    FOR v_previous IN
        SELECT DISTINCT pr.profile_id
          FROM public.profile_roles pr
         WHERE pr.role_id = v_headmaster_role_id
           AND pr.school_id = p_school_id
           AND pr.is_active IS TRUE
           AND pr.profile_id <> p_profile_id
    LOOP
        UPDATE public.profile_roles
           SET is_active = false, is_primary = false
         WHERE profile_id = v_previous.profile_id
           AND role_id = v_headmaster_role_id
           AND school_id = p_school_id
           AND is_active IS TRUE;

        UPDATE public.profile_roles pr
           SET is_primary = true
         WHERE pr.id = (
             SELECT candidate.id
               FROM public.profile_roles candidate
              WHERE candidate.profile_id = v_previous.profile_id
                AND candidate.is_active IS TRUE
              ORDER BY candidate.is_primary DESC, candidate.id
              LIMIT 1
         );

        UPDATE public.profiles p
           SET role_id = (
                   SELECT pr.role_id FROM public.profile_roles pr
                    WHERE pr.profile_id = p.id AND pr.is_active IS TRUE
                    ORDER BY pr.is_primary DESC, pr.id LIMIT 1
               ),
               school_id = (
                   SELECT pr.school_id FROM public.profile_roles pr
                    WHERE pr.profile_id = p.id AND pr.is_active IS TRUE
                    ORDER BY pr.is_primary DESC, pr.id LIMIT 1
               )
         WHERE p.id = v_previous.profile_id;
    END LOOP;

    -- Keep all other active roles, but make the new Headmaster assignment primary.
    UPDATE public.profile_roles
       SET is_primary = false
     WHERE profile_id = p_profile_id
       AND is_active IS TRUE;

    -- Reuse an inactive Headmaster role row when one exists; otherwise insert it.
    SELECT pr.id INTO v_inactive_role_id
      FROM public.profile_roles pr
     WHERE pr.profile_id = p_profile_id
       AND pr.role_id = v_headmaster_role_id
       AND pr.is_active IS NOT TRUE
     ORDER BY pr.id DESC
     LIMIT 1
     FOR UPDATE;

    IF v_inactive_role_id IS NOT NULL THEN
        UPDATE public.profile_roles
           SET school_id = p_school_id,
               is_active = true,
               is_primary = true
         WHERE id = v_inactive_role_id;
    ELSIF v_has_active_headmaster THEN
        UPDATE public.profile_roles
           SET school_id = p_school_id,
               is_active = true,
               is_primary = true
         WHERE profile_id = p_profile_id
           AND role_id = v_headmaster_role_id
           AND is_active IS TRUE;
    ELSE
        INSERT INTO public.profile_roles
            (profile_id, role_id, school_id, is_active, is_primary)
        VALUES
            (p_profile_id, v_headmaster_role_id, p_school_id, true, true);
    END IF;

    UPDATE public.profiles
       SET school_id = p_school_id,
           role_id = v_headmaster_role_id
     WHERE id = p_profile_id;

    RETURN jsonb_build_object(
        'id', v_profile.id,
        'full_name', COALESCE(v_profile.full_name, 'Headmaster'),
        'phone', v_profile.phone,
        'school_id', p_school_id,
        'school_name', v_school.school_name
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.assign_headmaster_to_school(uuid, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_headmaster_to_school(uuid, bigint) FROM anon;
REVOKE ALL ON FUNCTION public.assign_headmaster_to_school(uuid, bigint) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.assign_headmaster_to_school(uuid, bigint) TO service_role;
