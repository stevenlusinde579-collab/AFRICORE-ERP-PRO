import { supabase } from "../config/supabase.js";

const fail = (res, status, message) => res.status(status).json({ success: false, message });
const db = async (query) => {
  const { data, error } = await query;
  if (error) throw error;
  return data;
};

const schoolIdFor = (req) => {
  const ownSchool = req.profile?.school_id ?? req.access?.schoolId ?? null;
  if (ownSchool) return Number(ownSchool);
  if (req.access?.isSuperAdmin) {
    const requested = Number(req.body?.school_id ?? req.query?.school_id);
    if (Number.isInteger(requested) && requested > 0) return requested;
  }
  throw new Error("School context is required.");
};

const roleNames = (req) => (req.access?.roles || []).map((r) => String(r.role_name || "").trim().toLowerCase());
const isSuper = (req) => req.access?.isSuperAdmin === true;
const hasRole = (req, ...names) => isSuper(req) || names.some((name) => roleNames(req).includes(name));
const canManageTransport = (req) => hasRole(req, "secretary");
const canSubmitFinance = (req) => hasRole(req, "accountant");
const canReviewFinance = (req) => hasRole(req, "hr manager");

const withSchool = (query, schoolId) => query.eq("school_id", schoolId);
const today = () => new Date().toISOString().slice(0, 10);

export const getTransportOverview = async (req, res) => {
  try {
    const schoolId = schoolIdFor(req);
    const [vehicles, routes, assignments, pending] = await Promise.all([
      db(withSchool(supabase.from("transport_vehicles").select("id,status,seating_capacity"), schoolId)),
      db(withSchool(supabase.from("transport_routes").select("id,status"), schoolId)),
      db(withSchool(supabase.from("transport_student_assignments").select("id,is_active"), schoolId).eq("is_active", true)),
      db(withSchool(supabase.from("transport_finance_transactions").select("id,status,amount,transaction_type"), schoolId).eq("status", "pending"))
    ]);
    return res.json({ success: true, data: {
      vehicles: vehicles.length,
      activeVehicles: vehicles.filter(v => v.status === "active").length,
      routes: routes.filter(r => r.status === "active").length,
      assignedStudents: assignments.length,
      pendingTransactions: pending.length,
      pendingAmount: pending.reduce((sum, row) => sum + Number(row.amount || 0), 0)
    }});
  } catch (error) { return fail(res, 400, error.message || "Unable to load transport overview."); }
};

export const listTransportVehicles = async (req, res) => {
  try {
    const schoolId = schoolIdFor(req);
    const data = await db(withSchool(supabase.from("transport_vehicles").select("*").order("created_at", { ascending: false }), schoolId));
    return res.json({ success: true, data });
  } catch (error) { return fail(res, 400, error.message); }
};

export const saveTransportVehicle = async (req, res) => {
  try {
    if (!canManageTransport(req)) return fail(res, 403, "Only the Secretary or Super Admin can manage transport vehicles.");
    const schoolId = schoolIdFor(req);
    const body = req.body || {};
    const registration_number = String(body.registration_number || "").trim().toUpperCase();
    const seating_capacity = Number(body.seating_capacity);
    if (!registration_number) return fail(res, 400, "Vehicle registration number is required.");
    if (!Number.isInteger(seating_capacity) || seating_capacity < 1) return fail(res, 400, "Enter a valid seating capacity.");
    const payload = {
      school_id: schoolId, registration_number, seating_capacity,
      make: body.make?.trim() || null, model: body.model?.trim() || null,
      manufacture_year: body.manufacture_year ? Number(body.manufacture_year) : null,
      vehicle_type: body.vehicle_type || "bus", status: body.status || "active",
      insurance_expiry: body.insurance_expiry || null, inspection_expiry: body.inspection_expiry || null,
      notes: body.notes?.trim() || null, updated_at: new Date().toISOString()
    };
    const data = body.id
      ? await db(supabase.from("transport_vehicles").update(payload).eq("id", Number(body.id)).eq("school_id", schoolId).select("*").single())
      : await db(supabase.from("transport_vehicles").insert({ ...payload, created_by: req.user.id }).select("*").single());
    return res.status(body.id ? 200 : 201).json({ success: true, data });
  } catch (error) { return fail(res, 400, error.message || "Unable to save vehicle."); }
};

export const listTransportEmployees = async (req, res) => {
  try {
    const schoolId = schoolIdFor(req);
    const data = await db(supabase.from("employees").select("id,employee_number,first_name,middle_name,last_name,employee_type,position,phone,status").eq("school_id", schoolId).order("first_name"));
    return res.json({ success: true, data });
  } catch (error) { return fail(res, 400, error.message); }
};

export const listTransportStudents = async (req, res) => {
  try {
    const schoolId = schoolIdFor(req);
    const data = await db(supabase.from("students").select("id,admission_number,admission_no,first_name,middle_name,last_name,current_class_id,class_name,stream,student_status,status").eq("school_id", schoolId).order("first_name"));
    return res.json({ success: true, data });
  } catch (error) { return fail(res, 400, error.message); }
};

export const listTransportRoutes = async (req, res) => {
  try {
    const schoolId = schoolIdFor(req);
    const [routes, stops] = await Promise.all([
      db(withSchool(supabase.from("transport_routes").select("*").order("route_name"), schoolId)),
      db(withSchool(supabase.from("transport_route_stops").select("*").order("stop_order"), schoolId))
    ]);
    const data = routes.map(route => ({ ...route, stops: stops.filter(stop => stop.route_id === route.id) }));
    return res.json({ success: true, data });
  } catch (error) { return fail(res, 400, error.message); }
};

export const saveTransportRoute = async (req, res) => {
  try {
    if (!canManageTransport(req)) return fail(res, 403, "Only the Secretary or Super Admin can manage routes.");
    const schoolId = schoolIdFor(req);
    const body = req.body || {};
    const route_name = String(body.route_name || "").trim();
    const vehicle_id = Number(body.vehicle_id);
    if (!route_name || !Number.isInteger(vehicle_id)) return fail(res, 400, "Route name and vehicle are required.");
    const payload = {
      school_id: schoolId, vehicle_id, route_name,
      start_location: body.start_location?.trim() || null,
      end_location: body.end_location?.trim() || null,
      departure_time: body.departure_time || null, return_time: body.return_time || null,
      monthly_fee: Math.max(0, Number(body.monthly_fee || 0)),
      status: body.status || "active", notes: body.notes?.trim() || null,
      updated_at: new Date().toISOString()
    };
    const data = body.id
      ? await db(supabase.from("transport_routes").update(payload).eq("id", Number(body.id)).eq("school_id", schoolId).select("*").single())
      : await db(supabase.from("transport_routes").insert({ ...payload, created_by: req.user.id }).select("*").single());
    return res.status(body.id ? 200 : 201).json({ success: true, data });
  } catch (error) { return fail(res, 400, error.message || "Unable to save route."); }
};

export const addTransportStop = async (req, res) => {
  try {
    if (!canManageTransport(req)) return fail(res, 403, "Only the Secretary or Super Admin can manage route stops.");
    const schoolId = schoolIdFor(req);
    const routeId = Number(req.params.routeId);
    const stop_name = String(req.body?.stop_name || "").trim();
    const stop_order = Number(req.body?.stop_order);
    if (!stop_name || !Number.isInteger(stop_order) || stop_order < 1) return fail(res, 400, "Stop name and a positive stop order are required.");
    const data = await db(supabase.from("transport_route_stops").insert({
      school_id: schoolId, route_id: routeId, stop_name, stop_order,
      pickup_time: req.body?.pickup_time || null, dropoff_time: req.body?.dropoff_time || null
    }).select("*").single());
    return res.status(201).json({ success: true, data });
  } catch (error) { return fail(res, 400, error.message || "Unable to add route stop."); }
};

export const listTransportCrew = async (req, res) => {
  try {
    const schoolId = schoolIdFor(req);
    const rows = await db(withSchool(supabase.from("transport_vehicle_crew").select("*").order("created_at", { ascending: false }), schoolId));
    const ids = [...new Set(rows.map(r => r.employee_id))];
    const employees = ids.length ? await db(supabase.from("employees").select("id,employee_number,first_name,middle_name,last_name,phone,position").eq("school_id", schoolId).in("id", ids)) : [];
    const map = new Map(employees.map(e => [e.id, e]));
    return res.json({ success: true, data: rows.map(row => ({ ...row, employee: map.get(row.employee_id) || null })) });
  } catch (error) { return fail(res, 400, error.message); }
};

export const assignTransportCrew = async (req, res) => {
  try {
    if (!canManageTransport(req)) return fail(res, 403, "Only the Secretary or Super Admin can assign drivers and conductors.");
    const schoolId = schoolIdFor(req);
    const vehicle_id = Number(req.body?.vehicle_id);
    const employee_id = Number(req.body?.employee_id);
    const crew_role = req.body?.crew_role;
    if (!Number.isInteger(vehicle_id) || !Number.isInteger(employee_id) || !["driver", "conductor"].includes(crew_role)) return fail(res, 400, "Select a vehicle, employee and crew role.");
    const [vehicle, employee] = await Promise.all([
      db(supabase.from("transport_vehicles").select("id").eq("id", vehicle_id).eq("school_id", schoolId).single()),
      db(supabase.from("employees").select("id,status").eq("id", employee_id).eq("school_id", schoolId).single())
    ]);
    if (!vehicle || !employee) return fail(res, 404, "Vehicle or employee was not found in this school.");
    const current = await db(supabase.from("transport_vehicle_crew").select("id").eq("school_id", schoolId).eq("vehicle_id", vehicle_id).eq("crew_role", crew_role).eq("is_active", true));
    if (current.length) await db(supabase.from("transport_vehicle_crew").update({ is_active: false, end_date: today() }).in("id", current.map(x => x.id)).eq("school_id", schoolId));
    const data = await db(supabase.from("transport_vehicle_crew").insert({
      school_id: schoolId, vehicle_id, employee_id, crew_role, assigned_by: req.user.id
    }).select("*").single());
    return res.status(201).json({ success: true, data });
  } catch (error) { return fail(res, 400, error.message || "Unable to assign crew member."); }
};

export const listTransportAssignments = async (req, res) => {
  try {
    const schoolId = schoolIdFor(req);
    const rows = await db(withSchool(supabase.from("transport_student_assignments").select("*").order("created_at", { ascending: false }), schoolId));
    const studentIds = [...new Set(rows.map(r => r.student_id))];
    const routeIds = [...new Set(rows.map(r => r.route_id))];
    const [students, routes] = await Promise.all([
      studentIds.length ? db(supabase.from("students").select("id,admission_number,admission_no,first_name,middle_name,last_name,class_name").eq("school_id", schoolId).in("id", studentIds)) : [],
      routeIds.length ? db(supabase.from("transport_routes").select("id,route_name,vehicle_id").eq("school_id", schoolId).in("id", routeIds)) : []
    ]);
    const sm = new Map(students.map(x => [x.id, x])); const rm = new Map(routes.map(x => [x.id, x]));
    return res.json({ success: true, data: rows.map(row => ({ ...row, student: sm.get(row.student_id) || null, route: rm.get(row.route_id) || null })) });
  } catch (error) { return fail(res, 400, error.message); }
};

export const assignTransportStudent = async (req, res) => {
  try {
    if (!canManageTransport(req)) return fail(res, 403, "Only the Secretary or Super Admin can assign students to routes.");
    const schoolId = schoolIdFor(req);
    const student_id = Number(req.body?.student_id); const route_id = Number(req.body?.route_id);
    if (!Number.isInteger(student_id) || !Number.isInteger(route_id)) return fail(res, 400, "Select a student and route.");
    const [student, route] = await Promise.all([
      db(supabase.from("students").select("id").eq("id", student_id).eq("school_id", schoolId).single()),
      db(supabase.from("transport_routes").select("id,vehicle_id").eq("id", route_id).eq("school_id", schoolId).eq("status", "active").single())
    ]);
    if (!student || !route) return fail(res, 404, "Student or active route was not found in this school.");
    const vehicle = await db(supabase.from("transport_vehicles").select("seating_capacity").eq("id", route.vehicle_id).eq("school_id", schoolId).single());
    const activeRows = await db(supabase.from("transport_student_assignments").select("id").eq("school_id", schoolId).eq("route_id", route_id).eq("is_active", true));
    if (activeRows.length >= Number(vehicle.seating_capacity)) return fail(res, 409, "This vehicle has reached its seating capacity.");
    const payload = {
      school_id: schoolId, student_id, route_id,
      pickup_stop_id: req.body?.pickup_stop_id ? Number(req.body.pickup_stop_id) : null,
      dropoff_stop_id: req.body?.dropoff_stop_id ? Number(req.body.dropoff_stop_id) : null,
      monthly_fee: Math.max(0, Number(req.body?.monthly_fee || 0)),
      start_date: req.body?.start_date || today(), assigned_by: req.user.id
    };
    const data = await db(supabase.from("transport_student_assignments").insert(payload).select("*").single());
    return res.status(201).json({ success: true, data });
  } catch (error) { return fail(res, 400, error.message || "Unable to assign student."); }
};

export const getTransportFinanceOptions = async (req, res) => {
  try {
    const schoolId = schoolIdFor(req);
    const [accounts, cashAccounts] = await Promise.all([
      db(supabase.schema("finance").from("chart_of_accounts").select("id,account_code,account_name,account_type").eq("school_id", schoolId).eq("is_active", true).in("account_type", ["revenue", "expense"]).order("account_code")),
      db(supabase.schema("finance").from("cash_accounts").select("id,account_name,account_type").eq("school_id", schoolId).eq("is_active", true).order("account_name"))
    ]);
    return res.json({ success: true, data: { accounts, cashAccounts } });
  } catch (error) { return fail(res, 400, error.message); }
};

export const listTransportFinanceTransactions = async (req, res) => {
  try {
    const schoolId = schoolIdFor(req);
    let query = withSchool(supabase.from("transport_finance_transactions").select("*").order("transaction_date", { ascending: false }), schoolId);
    if (req.query?.status) query = query.eq("status", req.query.status);
    const data = await db(query);
    return res.json({ success: true, data });
  } catch (error) { return fail(res, 400, error.message); }
};

export const submitTransportFinanceTransaction = async (req, res) => {
  try {
    if (!canSubmitFinance(req)) return fail(res, 403, "Only the Accountant or Super Admin can submit transport income and expenses.");
    const schoolId = schoolIdFor(req); const body = req.body || {};
    const transaction_type = body.transaction_type;
    const amount = Number(body.amount);
    const category = String(body.category || "").trim();
    const description = String(body.description || "").trim();
    if (!["income", "expense"].includes(transaction_type) || !category || !description || !Number.isFinite(amount) || amount <= 0) return fail(res, 400, "Enter a valid transaction type, category, description and amount.");
    const accountId = transaction_type === "income" ? body.revenue_account_id : body.expense_account_id;
    if (!accountId || !body.cash_account_id) return fail(res, 400, "Select the correct Finance account and cash/bank account.");
    const accountType = transaction_type === "income" ? "revenue" : "expense";
    const [account, cash] = await Promise.all([
      db(supabase.schema("finance").from("chart_of_accounts").select("id").eq("id", accountId).eq("school_id", schoolId).eq("account_type", accountType).eq("is_active", true).single()),
      db(supabase.schema("finance").from("cash_accounts").select("id").eq("id", Number(body.cash_account_id)).eq("school_id", schoolId).eq("is_active", true).single())
    ]);
    if (!account || !cash) return fail(res, 400, "The selected account does not belong to this school or is inactive.");
    const number = `TRN-${schoolId}-${Date.now()}`;
    const payload = {
      school_id: schoolId, transaction_number: number, transaction_type, category, description, amount,
      transaction_date: body.transaction_date || today(),
      student_id: body.student_id ? Number(body.student_id) : null,
      payer_name: body.payer_name?.trim() || null,
      employee_id: body.employee_id ? Number(body.employee_id) : null,
      revenue_account_id: transaction_type === "income" ? accountId : null,
      expense_account_id: transaction_type === "expense" ? accountId : null,
      cash_account_id: Number(body.cash_account_id),
      payment_method: body.payment_method || "cash",
      reference_number: body.reference_number?.trim() || null,
      submitted_by: req.user.id
    };
    const data = await db(supabase.from("transport_finance_transactions").insert(payload).select("*").single());
    return res.status(201).json({ success: true, message: "Transaction submitted for HR Manager review.", data });
  } catch (error) { return fail(res, 400, error.message || "Unable to submit transport transaction."); }
};

export const approveTransportFinanceTransaction = async (req, res) => {
  try {
    if (!canReviewFinance(req)) return fail(res, 403, "Only the HR Manager or Super Admin can approve transport finance transactions.");
    const schoolId = schoolIdFor(req);
    const transactionId = Number(req.params.id);
    if (!Number.isInteger(transactionId) || transactionId < 1) return fail(res, 400, "Valid transaction ID is required.");
    const { data, error } = await supabase.rpc("approve_transport_finance_transaction", {
      p_transaction_id: transactionId,
      p_school_id: schoolId,
      p_actor_id: req.user.id
    });
    if (error) throw error;
    return res.json({ success: true, message: "Transaction approved and posted to Finance and General Journal.", data });
  } catch (error) { return fail(res, 400, error.message || "Unable to approve transport transaction."); }
};

export const rejectTransportFinanceTransaction = async (req, res) => {
  try {
    if (!canReviewFinance(req)) return fail(res, 403, "Only the HR Manager or Super Admin can reject transport finance transactions.");
    const schoolId = schoolIdFor(req);
    const transactionId = Number(req.params.id);
    const reason = String(req.body?.reason || "").trim();
    if (!Number.isInteger(transactionId) || transactionId < 1) return fail(res, 400, "Valid transaction ID is required.");
    if (!reason) return fail(res, 400, "A rejection reason is required.");
    const { data, error } = await supabase.rpc("reject_transport_finance_transaction", {
      p_transaction_id: transactionId,
      p_school_id: schoolId,
      p_actor_id: req.user.id,
      p_reason: reason
    });
    if (error) throw error;
    return res.json({ success: true, message: "Transaction rejected.", data });
  } catch (error) { return fail(res, 400, error.message || "Unable to reject transport transaction."); }
};

export const listTransportFinancePending = async (req, res) => {
  try {
    if (!canReviewFinance(req)) return fail(res, 403, "Only the HR Manager or Super Admin can review transport finance transactions.");
    const schoolId = schoolIdFor(req);
    const data = await db(withSchool(supabase.from("transport_finance_transactions").select("*").eq("status", "pending").order("submitted_at"), schoolId));
    return res.json({ success: true, data });
  } catch (error) { return fail(res, 400, error.message); }
};
