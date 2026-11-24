-- Cover Transport foreign keys and remove one redundant employee key index.
-- The HR Employee Digital File migration already provides employees(id, school_id).
drop index if exists public.transport_employee_id_school_uq;

create index if not exists transport_routes_vehicle_school_fk_idx
  on public.transport_routes(vehicle_id, school_id);
create index if not exists transport_routes_created_by_fk_idx
  on public.transport_routes(created_by);
create index if not exists transport_routes_school_fk_idx
  on public.transport_routes(school_id);

create index if not exists transport_route_stops_route_school_fk_idx
  on public.transport_route_stops(route_id, school_id);
create index if not exists transport_route_stops_school_fk_idx
  on public.transport_route_stops(school_id);

create index if not exists transport_crew_vehicle_school_fk_idx
  on public.transport_vehicle_crew(vehicle_id, school_id);
create index if not exists transport_crew_employee_school_fk_idx
  on public.transport_vehicle_crew(employee_id, school_id);
create index if not exists transport_crew_employee_fk_idx
  on public.transport_vehicle_crew(employee_id);
create index if not exists transport_crew_assigned_by_fk_idx
  on public.transport_vehicle_crew(assigned_by);

create index if not exists transport_assignments_student_school_fk_idx
  on public.transport_student_assignments(student_id, school_id);
create index if not exists transport_assignments_route_school_fk_idx
  on public.transport_student_assignments(route_id, school_id);
create index if not exists transport_assignments_pickup_fk_idx
  on public.transport_student_assignments(pickup_stop_id, route_id, school_id);
create index if not exists transport_assignments_dropoff_fk_idx
  on public.transport_student_assignments(dropoff_stop_id, route_id, school_id);
create index if not exists transport_assignments_assigned_by_fk_idx
  on public.transport_student_assignments(assigned_by);

create index if not exists transport_vehicles_created_by_fk_idx
  on public.transport_vehicles(created_by);

create index if not exists transport_finance_student_school_fk_idx
  on public.transport_finance_transactions(student_id, school_id);
create index if not exists transport_finance_employee_school_fk_idx
  on public.transport_finance_transactions(employee_id, school_id);
create index if not exists transport_finance_revenue_account_fk_idx
  on public.transport_finance_transactions(revenue_account_id);
create index if not exists transport_finance_expense_account_fk_idx
  on public.transport_finance_transactions(expense_account_id);
create index if not exists transport_finance_cash_account_fk_idx
  on public.transport_finance_transactions(cash_account_id);
create index if not exists transport_finance_receipt_fk_idx
  on public.transport_finance_transactions(receipt_id);
create index if not exists transport_finance_expense_fk_idx
  on public.transport_finance_transactions(expense_id);
create index if not exists transport_finance_journal_fk_idx
  on public.transport_finance_transactions(journal_entry_id);
create index if not exists transport_finance_submitted_by_fk_idx
  on public.transport_finance_transactions(submitted_by);
create index if not exists transport_finance_reviewed_by_fk_idx
  on public.transport_finance_transactions(reviewed_by);
