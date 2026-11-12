-- Restore authenticated SELECT access to fee items while preserving
-- the existing restrictive school-tenant guard.
--
-- The tenant policy is intentionally RESTRICTIVE. PostgreSQL combines
-- restrictive policies with at least one applicable PERMISSIVE policy.
-- finance.fee_items had only the restrictive policy, so authenticated users
-- saw zero rows even when their profile.school_id and fee_items.school_id
-- matched. This caused save_student_payment_setup to reject valid fee IDs.
--
-- The permissive policy grants no cross-school visibility: the existing
-- af_score_tenant_guard still filters every selected row by school ID (or
-- SuperAdmin status). Only SELECT is enabled here; writes remain governed by
-- the existing policies and grants.

drop policy if exists af_score_authenticated_base on finance.fee_items;

create policy af_score_authenticated_base
on finance.fee_items
as permissive
for select
to authenticated
using (true);
