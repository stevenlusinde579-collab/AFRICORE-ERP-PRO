-- Tighten the grants applied to the NECTA PReMS records table.
-- RLS policies remain the row-level boundary; grants limit which operations
-- authenticated clients may request, and anonymous clients get no table access.
begin;

revoke all on table public.necta_student_records from anon, authenticated;
grant select, insert on table public.necta_student_records to authenticated;

revoke all on sequence public.necta_student_records_id_seq from anon, authenticated;
grant usage, select on sequence public.necta_student_records_id_seq to authenticated;

commit;
