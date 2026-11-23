import { supabase } from "../config/supabase.js";

const ROLE_ACCOUNTANT = "Accountant";
const ROLE_HR_MANAGER = "HR Manager";

const responseError = (res, error, fallback = "Payroll request failed.") => {
    const message = error?.message || fallback;
    const status = /not found/i.test(message) ? 404
        : /required|invalid|must |cannot |already |only |configure|no open|not active|not belong|negative|greater than/i.test(message) ? 400
        : 500;
    if (status === 500) console.error("PAYROLL API ERROR:", error);
    return res.status(status).json({ success: false, message });
};

const getSchoolId = (req) => {
    const requestedSchoolId = req.body?.school_id || req.query?.school_id || req.params?.schoolId;
    const schoolId = Number(requestedSchoolId || req.profile?.school_id);
    if (!Number.isInteger(schoolId) || schoolId <= 0) {
        throw new Error("A valid school context is required.");
    }
    if (req.access?.isSuperAdmin === true) return schoolId;

    const assignments = req.access?.profile_roles || [];
    if (assignments.length) {
        if (!assignments.some((assignment) => Number(assignment.school_id) === schoolId)) {
            throw new Error("You do not have an active role assignment for this school.");
        }
    } else if (schoolId !== Number(req.profile?.school_id)) {
        throw new Error("You cannot access payroll records for another school.");
    }
    return schoolId;
};

const hasRoleForSchool = (req, roleName, schoolId) => {
    if (req.access?.isSuperAdmin === true) return true;
    const role = (req.access?.roles || []).find((item) => item.role_name === roleName);
    if (!role) return false;
    const assignments = req.access?.profile_roles || [];
    if (assignments.length) {
        return assignments.some((assignment) =>
            Number(assignment.school_id) === Number(schoolId) &&
            Number(assignment.role_id) === Number(role.id)
        );
    }
    return Number(req.profile?.school_id) === Number(schoolId) &&
        Number(req.profile?.role_id) === Number(role.id);
};

const requireRoleForSchool = (req, res, roleName, schoolId) => {
    if (!req.user?.id) {
        res.status(401).json({ success: false, message: "Authentication required." });
        return false;
    }
    if (!hasRoleForSchool(req, roleName, schoolId)) {
        res.status(403).json({ success: false, message: `${roleName} access for this school is required.` });
        return false;
    }
    return true;
};

const loadPayroll = async (schoolId, payrollId) => {
    const { data, error } = await supabase.from("payrolls")
        .select("*, payroll_items(*)")
        .eq("school_id", schoolId).eq("id", payrollId).single();
    if (error) throw error;
    return data;
};

export const getPayrollWorkspace = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        if (!hasRoleForSchool(req, ROLE_ACCOUNTANT, schoolId) && !hasRoleForSchool(req, ROLE_HR_MANAGER, schoolId)) {
            return res.status(403).json({ success: false, message: "Accountant or HR Manager access for this school is required." });
        }
        const payrollMonth = /^\d{4}-\d{2}$/.test(String(req.query.payroll_month || ""))
            ? String(req.query.payroll_month) : new Date().toISOString().slice(0, 7);
        const monthStart = `${payrollMonth}-01`;
        const monthEnd = new Date(Number(payrollMonth.slice(0, 4)), Number(payrollMonth.slice(5, 7)), 0)
            .toISOString().slice(0, 10);
        const [employeesResult, contractsResult, payrollsResult, settingsResult, accountsResult, cashResult] = await Promise.all([
            supabase.from("employees")
                .select("id,employee_number,first_name,middle_name,last_name,department,position,employee_type,basic_salary,status")
                .eq("school_id", schoolId).in("status", ["active", "Active", "ACTIVE", "enabled", "Enabled", "working", "Working"])
                .order("first_name", { ascending: true }),
            supabase.from("hr_employment_contracts")
                .select("employee_id,basic_salary,start_date,end_date,status")
                .eq("school_id", schoolId).eq("status", "active")
                .not("basic_salary", "is", null)
                .order("start_date", { ascending: false }),
            supabase.from("payrolls")
                .select("id,school_id,payroll_number,payroll_month,status,total_basic_salary,total_allowances,total_deductions,total_net_salary,created_by,created_at,submitted_at,reviewed_at,approved_at,posted_at,review_notes,snapshot_locked_at")
                .eq("school_id", schoolId).order("payroll_month", { ascending: false }).limit(36),
            supabase.from("payroll_settings").select("*").eq("school_id", schoolId).maybeSingle(),
            supabase.schema("finance").from("chart_of_accounts")
                .select("id,account_code,account_name,account_type,is_active")
                .eq("school_id", schoolId).eq("is_active", true).order("account_code"),
            supabase.schema("finance").from("cash_accounts")
                .select("id,account_name,account_type,is_active")
                .eq("school_id", schoolId).eq("is_active", true).order("account_name"),
        ]);
        for (const result of [employeesResult, contractsResult, payrollsResult, settingsResult, accountsResult, cashResult]) {
            if (result.error) throw result.error;
        }
        const contracts = contractsResult.data || [];
        const employeesWithContractSalary = (employeesResult.data || []).map((employee) => {
            const contract = contracts.find((row) =>
                Number(row.employee_id) === Number(employee.id) &&
                row.start_date <= monthEnd &&
                (!row.end_date || row.end_date >= monthStart)
            );
            return {
                ...employee,
                basic_salary: contract?.basic_salary ?? employee.basic_salary ?? 0,
                salary_source: contract ? "active_contract" : "employee_record",
            };
        });
        return res.json({
            success: true,
            data: {
                employees: hasRoleForSchool(req, ROLE_ACCOUNTANT, schoolId) ? employeesWithContractSalary : [],
                payrolls: payrollsResult.data || [],
                settings: settingsResult.data || null,
                accounts: accountsResult.data || [],
                cashAccounts: cashResult.data || [],
                canPrepare: hasRoleForSchool(req, ROLE_ACCOUNTANT, schoolId),
                canReview: hasRoleForSchool(req, ROLE_HR_MANAGER, schoolId),
                canPostAndPay: hasRoleForSchool(req, ROLE_ACCOUNTANT, schoolId),
            },
        });
    } catch (error) {
        return responseError(res, error, "Unable to load payroll workspace.");
    }
};

export const getPayrollDetails = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        if (!hasRoleForSchool(req, ROLE_ACCOUNTANT, schoolId) && !hasRoleForSchool(req, ROLE_HR_MANAGER, schoolId)) {
            return res.status(403).json({ success: false, message: "Payroll access for this school is required." });
        }
        const payroll = await loadPayroll(schoolId, Number(req.params.payrollId));
        const { data: audit, error } = await supabase.from("hr_payroll_audit_events")
            .select("id,event_type,event_note,event_data,actor_id,created_at")
            .eq("school_id", payroll.school_id).eq("payroll_id", payroll.id)
            .order("created_at", { ascending: true });
        if (error) throw error;
        const actorIds = [...new Set((audit || []).map((event) => event.actor_id).filter(Boolean))];
        let actorMap = new Map();
        if (actorIds.length) {
            const { data: actors, error: actorsError } = await supabase
                .from("profiles").select("id,full_name").in("id", actorIds);
            if (actorsError) throw actorsError;
            actorMap = new Map((actors || []).map((actor) => [actor.id, actor.full_name]));
        }
        const auditWithNames = (audit || []).map((event) => ({
            ...event,
            actor_name: actorMap.get(event.actor_id) || "System user",
        }));
        return res.json({ success: true, data: { ...payroll, audit: auditWithNames } });
    } catch (error) {
        return responseError(res, error, "Unable to load payroll details.");
    }
};

export const savePayrollSettings = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        if (!requireRoleForSchool(req, res, ROLE_ACCOUNTANT, schoolId)) return;
        const expenseId = req.body?.salary_expense_account_id;
        const payableId = req.body?.salary_payable_account_id;
        const deductionId = req.body?.deductions_payable_account_id || null;
        if (!expenseId || !payableId) throw new Error("Salary expense and salary payable accounts are required.");
        const ids = [expenseId, payableId, deductionId].filter(Boolean);
        const { data: accounts, error: accountError } = await supabase.schema("finance")
            .from("chart_of_accounts").select("id,account_type,is_active")
            .eq("school_id", schoolId).in("id", ids);
        if (accountError) throw accountError;
        const byId = new Map((accounts || []).map((row) => [String(row.id), row]));
        if (byId.get(String(expenseId))?.account_type !== "expense" || !byId.get(String(expenseId))?.is_active) {
            throw new Error("Select an active expense account for salary costs.");
        }
        if (byId.get(String(payableId))?.account_type !== "liability" || !byId.get(String(payableId))?.is_active) {
            throw new Error("Select an active liability account for net salaries payable.");
        }
        if (deductionId && (byId.get(String(deductionId))?.account_type !== "liability" || !byId.get(String(deductionId))?.is_active)) {
            throw new Error("Select an active liability account for deductions payable.");
        }
        const { data, error } = await supabase.from("payroll_settings").upsert({
            school_id: schoolId,
            salary_expense_account_id: expenseId,
            salary_payable_account_id: payableId,
            deductions_payable_account_id: deductionId,
            updated_by: req.user.id,
        }, { onConflict: "school_id" }).select().single();
        if (error) throw error;
        return res.json({ success: true, data, message: "Payroll accounts saved." });
    } catch (error) {
        return responseError(res, error, "Unable to save payroll accounts.");
    }
};

export const createPayrollDraft = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        if (!requireRoleForSchool(req, res, ROLE_ACCOUNTANT, schoolId)) return;
        const month = String(req.body?.payroll_month || "");
        if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Select a valid payroll month.");
        const items = Array.isArray(req.body?.items) ? req.body.items : [];
        const { data, error } = await supabase.rpc("hr_payroll_create", {
            p_school_id: schoolId,
            p_payroll_month: `${month}-01`,
            p_created_by: req.user.id,
            p_items: items,
        });
        if (error) throw error;
        const payroll = await loadPayroll(schoolId, Number(data));
        return res.status(201).json({ success: true, data: payroll, message: "Payroll draft created." });
    } catch (error) {
        return responseError(res, error, "Unable to create payroll draft.");
    }
};

export const updatePayrollItem = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        if (!requireRoleForSchool(req, res, ROLE_ACCOUNTANT, schoolId)) return;
        const payrollId = Number(req.params.payrollId);
        const itemId = Number(req.params.itemId);
        const { data, error } = await supabase.rpc("hr_payroll_update_item", {
            p_school_id: schoolId,
            p_payroll_id: payrollId,
            p_item_id: itemId,
            p_basic_salary: Number(req.body?.basic_salary),
            p_allowances: Number(req.body?.allowances),
            p_deductions: Number(req.body?.deductions),
            p_components: Array.isArray(req.body?.components) ? req.body.components : [],
            p_actor_id: req.user.id,
        });
        if (error) throw error;
        return res.json({ success: true, data, message: "Payroll employee values updated." });
    } catch (error) {
        return responseError(res, error, "Unable to update payroll item.");
    }
};

export const submitPayrollForReview = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        if (!requireRoleForSchool(req, res, ROLE_ACCOUNTANT, schoolId)) return;
        const { error } = await supabase.rpc("hr_payroll_submit", {
            p_school_id: schoolId, p_payroll_id: Number(req.params.payrollId), p_actor_id: req.user.id,
        });
        if (error) throw error;
        return res.json({ success: true, message: "Payroll submitted to HR for review." });
    } catch (error) {
        return responseError(res, error, "Unable to submit payroll.");
    }
};

export const reviewPayroll = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        if (!requireRoleForSchool(req, res, ROLE_HR_MANAGER, schoolId)) return;
        const decision = String(req.body?.decision || "");
        const note = String(req.body?.note || "").trim();
        const { error } = await supabase.rpc("hr_payroll_review", {
            p_school_id: schoolId,
            p_payroll_id: Number(req.params.payrollId),
            p_reviewer_id: req.user.id,
            p_decision: decision,
            p_review_note: note || null,
        });
        if (error) throw error;
        return res.json({ success: true, message: decision === "approve" ? "Payroll approved and snapshot locked." : "Payroll returned to Accountant." });
    } catch (error) {
        return responseError(res, error, "Unable to review payroll.");
    }
};

export const postPayrollToFinance = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        if (!requireRoleForSchool(req, res, ROLE_ACCOUNTANT, schoolId)) return;
        const { data, error } = await supabase.rpc("hr_payroll_post", {
            p_school_id: schoolId, p_payroll_id: Number(req.params.payrollId), p_actor_id: req.user.id,
        });
        if (error) throw error;
        return res.json({ success: true, data: { journal_entry_id: data }, message: "Payroll posted to Finance." });
    } catch (error) {
        return responseError(res, error, "Unable to post payroll.");
    }
};

export const payPayrollItem = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        if (!requireRoleForSchool(req, res, ROLE_ACCOUNTANT, schoolId)) return;
        const cashAccountId = Number(req.body?.cash_account_id);
        const paymentDate = String(req.body?.payment_date || "");
        const method = String(req.body?.payment_method || "").trim();
        if (!Number.isInteger(cashAccountId) || !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate) || !method) {
            throw new Error("Select a cash/bank account, payment date and payment method.");
        }
        const { data, error } = await supabase.rpc("hr_payroll_pay_item", {
            p_school_id: schoolId,
            p_payroll_id: Number(req.params.payrollId),
            p_item_id: Number(req.params.itemId),
            p_cash_account_id: cashAccountId,
            p_payment_date: paymentDate,
            p_payment_method: method,
            p_reference: String(req.body?.reference || "").trim() || null,
            p_actor_id: req.user.id,
        });
        if (error) throw error;
        return res.json({ success: true, data: { journal_entry_id: data }, message: "Employee payment recorded in Finance." });
    } catch (error) {
        return responseError(res, error, "Unable to record employee payment.");
    }
};
