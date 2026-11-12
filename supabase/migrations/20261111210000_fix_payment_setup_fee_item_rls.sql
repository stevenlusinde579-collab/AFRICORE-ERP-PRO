-- Fix Payment Setup fee-item validation under tenant RLS.
--
-- save_student_payment_setup already performs explicit authorization checks:
--   * authenticated user and school membership (or SuperAdmin)
--   * created_by must match auth.uid()
--   * student, academic year and class must belong to p_school_id
--   * each fee item must belong to p_school_id and be active with a revenue account
--
-- The function was SECURITY INVOKER. The fee_items RLS policy resolves the
-- profile's home school, which can hide a valid fee item for the school context
-- selected in the application. Run the validated RPC as its trusted owner so
-- the explicit tenant checks above remain authoritative and the RLS policy
-- does not incorrectly mask the fee item.
--
-- Keep a fixed search_path and restrict execution to authenticated callers.

alter function finance.save_student_payment_setup(
    bigint,
    bigint,
    bigint,
    bigint,
    uuid,
    uuid,
    numeric,
    numeric,
    jsonb
) security definer;

alter function finance.save_student_payment_setup(
    bigint,
    bigint,
    bigint,
    bigint,
    uuid,
    uuid,
    numeric,
    numeric,
    jsonb
) set search_path = finance, public;

revoke all on function finance.save_student_payment_setup(
    bigint,
    bigint,
    bigint,
    bigint,
    uuid,
    uuid,
    numeric,
    numeric,
    jsonb
) from public, anon;

grant execute on function finance.save_student_payment_setup(
    bigint,
    bigint,
    bigint,
    bigint,
    uuid,
    uuid,
    numeric,
    numeric,
    jsonb
) to authenticated;
