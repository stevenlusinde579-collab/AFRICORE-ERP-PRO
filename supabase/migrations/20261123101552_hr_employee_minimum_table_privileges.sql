begin;
revoke all on table
  public.hr_employee_profiles,
  public.hr_employee_contacts,
  public.hr_employment_history,
  public.hr_employee_documents,
  public.hr_employment_contracts
from authenticated;

grant select, insert, update on table public.hr_employee_profiles to authenticated;
grant select, insert, update, delete on table public.hr_employee_contacts to authenticated;
grant select, insert on table public.hr_employment_history to authenticated;
grant select, insert on table public.hr_employee_documents to authenticated;
grant select, insert, update on table public.hr_employment_contracts to authenticated;

revoke all on sequence
  public.hr_employee_contacts_id_seq,
  public.hr_employment_history_id_seq,
  public.hr_employee_documents_id_seq,
  public.hr_employment_contracts_id_seq
from anon, authenticated;

grant usage, select on sequence
  public.hr_employee_contacts_id_seq,
  public.hr_employment_history_id_seq,
  public.hr_employee_documents_id_seq,
  public.hr_employment_contracts_id_seq
to authenticated;
commit;
