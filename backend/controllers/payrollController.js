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

const hasRole = (req, roleName) =>
    req.access?.isSuperAdmin === true ||
    (req.access?.roles || []).some((role) => role.role_name === roleName);

const requireRole = (req, res, roleName) => {
    if (!req.user?.id) {
        res.status(401).json({ success: false, message: "Authentication required." });
        return false;
    }
    if (!hasRole(req, roleName)) {
        res.status(403).json({ success: false, message: `${roleName} access is required.` });
        return false;
    }
    return true;
};

const getSchoolId = (req) => {
    const schoolId = req.access?.isSuperAdmin === true
        ? Number(req.body?.school_id || req.query?.school_id || req.params?.schoolId)
        : Number(req.profile?.school_id);
    if (!Number.isInteger(schoolId) || schoolId <= 0) {
        throw new Error("A valid school context is required.");
    }
    if (req.access?.isSuperAdmin !== true && schoolId !== Number(req.profile?.school_id)) {
        throw new Error("You cannot access payroll records for another school.");
    }
    return schoolId;
};

const loadPayroll = async (schoolId, payrollId) => {
    const { data, error } = await supabase.from("payrolls")
        .select("*, payroll_items(*)")
        .eq("school_id", schoolId).eq("id", payrollId).single();
    if (error) throw error;
    return data;
};

export const getPayrollWorkspace = async (req, res) => {
    if (!hasRole(req, ROLE_ACCOUNTANT) && !hasRole(req, ROLE_HR_MANAGER)) {
        return res.status(403).json({ success: false, message: "Accountant or HR Manager access is required." });
    }
    try {
        const schoolId = getSchoolId(req);
        const [employeesResult, payrollsResult, settingsResult, accountsResult, cashResult] = await Promise.all([
            supabase.from("employees")
                .select("id,employee_number,first_name,middle_name,last_name,department,position,employee_type,basic_salary,status")
                .eq("school_id", schoolId).in("status", ["active", "Active", "enabled", "working"])
                .order("first_name", { ascending: true }),
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
        for (const result of [employeesResult, payrollsResult, settingsResult, accountsResult, cashResult]) {
            if (result.error) throw result.error;
        }
        return res.json({
            success: true,
            data: {
                employees: hasRole(req, ROLE_ACCOUNTANT) ? (employeesResult.data || []) : [],
                payrolls: payrollsResult.data || [],
                settings: settingsResult.data || null,
                accounts: accountsResult.data || [],
                cashAccounts: cashResult.data || [],
                canPrepare: hasRole(req, ROLE_ACCOUNTANT),
                canReview: hasRole(req, ROLE_HR_MANAGER),
                canPostAndPay: hasRole(req, ROLE_ACCOUNTANT),
            },
        });
    } catch (error) {
        return responseError(res, error, "Unable to load payroll workspace.");
    }
};

export const getPayrollDetails = async (req, res) => {
    if (!hasRole(req, ROLE_ACCOUNTANT) && !hasRole(req, ROLE_HR_MANAGER)) {
        return res.status(403).json({ success: false, message: "Payroll access is required." });
    }
    try {
        const payroll = await loadPayroll(getSchoolId(req), Number(req.params.payrollId));
        const { data: audit, error } = await supabase.from("hr_payroll_audit_events")
            .select("id,event_type,event_note,event_data,actor_id,created_at")
            .eq("school_id", payroll.school_id).eq("payroll_id", payroll.id)
            .order("created_at", { ascending: true });
        if (error) throw error;
        return res.json({ success: true, data: { ...payroll, audit: audit || [] } });
    } catch (error) {
        return responseError(res, error, "Unable to load payroll details.");
    }
};

export const savePayrollSettings = async (req, res) => {
    if (!requireRole(req, res, ROLE_ACCOUNTANT)) return;
    try {
        const schoolId = getSchoolId(req);
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
    if (!requireRole(req, res, ROLE_ACCOUNTANT)) return;
    try {
        const schoolId = getSchoolId(req);
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
    if (!requireRole(req, res, ROLE_ACCOUNTANT)) return;
    try {
        const schoolId = getSchoolId(req);
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
    if (!requireRole(req, res, ROLE_ACCOUNTANT)) return;
    try {
        const schoolId = getSchoolId(req);
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
    if (!requireRole(req, res, ROLE_HR_MANAGER)) return;
    try {
        const schoolId = getSchoolId(req);
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
    if (!requireRole(req, res, ROLE_ACCOUNTANT)) return;
    try {
        const schoolId = getSchoolId(req);
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
    if (!requireRole(req, res, ROLE_ACCOUNTANT)) return;
    try {
        const schoolId = getSchoolId(req);
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
