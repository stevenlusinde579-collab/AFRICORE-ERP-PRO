// ============================================================
// AFRICORE ERP PRO
// FINANCE CONTROLLER
// ============================================================

import { supabase } from "../config/supabase.js";


// ============================================================
// HELPERS
// ============================================================

const numberValue = (value, fallback = 0) => {

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;

};


const today = () => {

    return new Date()
        .toISOString()
        .slice(0, 10);

};


const getSchoolId = (req) => {

    const schoolId =
        req.user?.school_id ??
        req.school?.id ??
        req.body?.school_id ??
        req.query?.school_id;

    if (!schoolId) {

        throw new Error(
            "School ID is required."
        );

    }

    return Number(schoolId);

};


const getUserId = (req, fallback = null) => {

    return (
        req.user?.id ??
        fallback ??
        null
    );

};


const sendError = (
    res,
    error,
    defaultMessage = "Finance request failed."
) => {

    console.error(
        "FINANCE ERROR:",
        error
    );

    return res.status(500).json({

        success: false,

        message:
            error?.message ||
            defaultMessage,

        error:
            error?.details ||
            error?.hint ||
            null

    });

};


const normalizeRpcRow = (data) => {

    if (Array.isArray(data)) {

        return data[0] || null;

    }

    return data || null;

};


// ============================================================
// DASHBOARD
// ============================================================

export const getFinanceDashboard = async (
    req,
    res
) => {

    try {

        const schoolId =
            getSchoolId(req);


        // ----------------------------------------------------
        // RECEIVABLES
        // ----------------------------------------------------

        const {
            data: receivables,
            error: receivableError
        } = await supabase
            .schema("finance")
            .from("student_charges")
            .select(
                "amount, paid_amount, balance, status"
            )
            .eq(
                "school_id",
                schoolId
            );


        if (receivableError) {

            throw receivableError;

        }


        // ----------------------------------------------------
        // EXPENSES
        // ----------------------------------------------------

        const {
            data: expenses,
            error: expenseError
        } = await supabase
            .schema("finance")
            .from("expenses")
            .select(
                "amount, status"
            )
            .eq(
                "school_id",
                schoolId
            );


        if (expenseError) {

            throw expenseError;

        }


        // ----------------------------------------------------
        // BUDGETS
        // ----------------------------------------------------

        const {
            data: budgets,
            error: budgetError
        } = await supabase
            .schema("finance")
            .from("budgets")
            .select("*")
            .eq(
                "school_id",
                schoolId
            );


        if (budgetError) {

            throw budgetError;

        }


        // ----------------------------------------------------
        // CALCULATE RECEIVABLES
        // ----------------------------------------------------

        const expectedAmount =
            (receivables || []).reduce(
                (
                    total,
                    row
                ) => {

                    return (
                        total +
                        numberValue(
                            row.amount
                        )
                    );

                },
                0
            );


        const collectedAmount =
            (receivables || []).reduce(
                (
                    total,
                    row
                ) => {

                    return (
                        total +
                        numberValue(
                            row.paid_amount
                        )
                    );

                },
                0
            );


        const outstandingAmount =
            (receivables || []).reduce(
                (
                    total,
                    row
                ) => {

                    return (
                        total +
                        numberValue(
                            row.balance
                        )
                    );

                },
                0
            );


        // ----------------------------------------------------
        // EXPENSES / USED AMOUNT
        // ----------------------------------------------------

        const usedAmount =
            (expenses || []).reduce(
                (
                    total,
                    row
                ) => {

                    return (
                        total +
                        numberValue(
                            row.amount
                        )
                    );

                },
                0
            );


        // ----------------------------------------------------
        // BUDGET AMOUNT
        // ----------------------------------------------------

        let budgetAmount = 0;


        for (
            const budget
            of budgets || []
        ) {

            budgetAmount +=
                numberValue(
                    budget.total_amount ??
                    budget.amount ??
                    budget.budget_amount
                );

        }


        // ----------------------------------------------------
        // CASH ACCOUNTS
        // ----------------------------------------------------

        const {
            data: cashAccounts,
            error: cashError
        } = await supabase
            .schema("finance")
            .from("cash_accounts")
            .select("*")
            .eq(
                "school_id",
                schoolId
            )
            .eq(
                "is_active",
                true
            );


        if (cashError) {

            throw cashError;

        }


        let cashBalance = 0;
        let bankBalance = 0;
        let mobileMoneyBalance = 0;


        for (
            const account
            of cashAccounts || []
        ) {

            const balance =
                numberValue(
                    account.current_balance
                );


            const type =
                String(
                    account.account_type ||
                    account.type ||
                    ""
                )
                    .toLowerCase();


            if (
                type === "cash"
            ) {

                cashBalance +=
                    balance;

            } else if (
                type.includes("mobile")
            ) {

                mobileMoneyBalance +=
                    balance;

            } else {

                bankBalance +=
                    balance;

            }

        }


        // ----------------------------------------------------
        // RESPONSE
        // ----------------------------------------------------

        return res.json({

            success: true,

            data: {

                expectedAmount,

                collectedAmount,

                outstandingAmount,

                usedAmount,

                budgetAmount,

                cashBalance,

                bankBalance,

                mobileMoneyBalance,

                totalCashAndBank:
                    cashBalance +
                    bankBalance +
                    mobileMoneyBalance

            }

        });

    } catch (error) {

        return sendError(
            res,
            error,
            "Unable to load finance dashboard."
        );

    }

};


// ============================================================
// CHART OF ACCOUNTS
// ============================================================

export const getAccounts = async (
    req,
    res
) => {

    try {

        const schoolId =
            getSchoolId(req);


        const {
            data,
            error
        } = await supabase
            .schema("finance")
            .from("chart_of_accounts")
            .select("*")
            .eq(
                "school_id",
                schoolId
            )
            .order(
                "account_code",
                {
                    ascending: true
                }
            );


        if (error) {

            throw error;

        }


        return res.json({

            success: true,

            data:
                data || []

        });

    } catch (error) {

        return sendError(
            res,
            error,
            "Unable to load chart of accounts."
        );

    }

};


// ============================================================
// CASH ACCOUNTS
// ============================================================

export const getCashAccounts = async (
    req,
    res
) => {

    try {

        const schoolId =
            getSchoolId(req);


        const {
            data,
            error
        } = await supabase
            .schema("finance")
            .from("cash_accounts")
            .select("*")
            .eq(
                "school_id",
                schoolId
            )
            .order(
                "name",
                {
                    ascending: true
                }
            );


        if (error) {

            throw error;

        }


        return res.json({

            success: true,

            data:
                data || []

        });

    } catch (error) {

        return sendError(
            res,
            error,
            "Unable to load cash accounts."
        );

    }

};


// ============================================================
// RECEIPTS
// ============================================================

export const getReceipts = async (
    req,
    res
) => {

    try {

        const schoolId =
            getSchoolId(req);


        let query =
            supabase
                .schema("finance")
                .from("receipts")
                .select("*")
                .eq(
                    "school_id",
                    schoolId
                )
                .order(
                    "receipt_date",
                    {
                        ascending: false
                    }
                );


        if (
            req.query.status
        ) {

            query =
                query.eq(
                    "status",
                    req.query.status
                );

        }


        if (
            req.query.student_id
        ) {

            query =
                query.eq(
                    "student_id",
                    Number(
                        req.query.student_id
                    )
                );

        }


        const {
            data,
            error
        } =
            await query;


        if (error) {

            throw error;

        }


        return res.json({

            success: true,

            data:
                data || []

        });

    } catch (error) {

        return sendError(
            res,
            error,
            "Unable to load receipts."
        );

    }

};


// ============================================================
// CREATE RECEIPT
//
// Accounting:
// DR Cash / Bank
// CR Revenue
//
// Uses finance.record_receipt RPC.
// ============================================================

export const createReceipt = async (
    req,
    res
) => {

    try {

        const schoolId =
            getSchoolId(req);


        const {

            receipt_number,

            receipt_date,

            student_id,

            payer_name,

            income_account_id,

            cash_account_id,

            payment_method,

            amount,

            reference_number,

            description,

            created_by,

            issued_by

        } = req.body;


        const receiptAmount =
            numberValue(
                amount
            );


        if (
            !receipt_number
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Receipt number is required."

            });

        }


        if (
            !income_account_id
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Income account is required."

            });

        }


        if (
            !cash_account_id
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Cash / bank account is required."

            });

        }


        if (
            receiptAmount <= 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Receipt amount must be greater than zero."

            });

        }


        if (
            !payment_method
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Payment method is required."

            });

        }


        const {
            data: rpcData,
            error: rpcError
        } = await supabase
            .schema("finance")
            .rpc(
                "record_receipt",
                {

                    p_school_id:
                        schoolId,

                    p_receipt_number:
                        String(
                            receipt_number
                        ).trim(),

                    p_receipt_date:
                        receipt_date ||
                        today(),

                    p_student_id:
                        student_id
                            ? Number(student_id)
                            : null,

                    p_payer_name:
                        payer_name ||
                        null,

                    p_income_account_id:
                        income_account_id,

                    p_cash_account_id:
                        Number(
                            cash_account_id
                        ),

                    p_payment_method:
                        String(
                            payment_method
                        ).trim(),

                    p_amount:
                        receiptAmount,

                    p_reference_number:
                        reference_number ||
                        null,

                    p_description:
                        description ||
                        null,

                    p_created_by:
                        created_by ||
                        getUserId(req),

                    p_issued_by:
                        issued_by ||
                        getUserId(req)

                }
            );


        if (rpcError) {

            throw rpcError;

        }


        const result =
            normalizeRpcRow(
                rpcData
            );


        if (!result?.receipt_id) {

            throw new Error(
                "Receipt was not created."
            );

        }


        // ----------------------------------------------------
        // LOAD CREATED RECEIPT
        // ----------------------------------------------------

        const {
            data: receipt,
            error: receiptError
        } = await supabase
            .schema("finance")
            .from("receipts")
            .select("*")
            .eq(
                "id",
                result.receipt_id
            )
            .eq(
                "school_id",
                schoolId
            )
            .single();


        if (receiptError) {

            throw receiptError;

        }


        return res.status(201).json({

            success: true,

            message:
                "Receipt recorded successfully.",

            data: receipt,

            receipt_id:
                result.receipt_id,

            journal_entry_id:
                result.journal_entry_id

        });

    } catch (error) {

        return sendError(
            res,
            error,
            "Unable to record receipt."
        );

    }

};


// ============================================================
// STUDENT RECEIVABLES
// ============================================================

export const getStudentReceivables = async (
    req,
    res
) => {

    try {

        const schoolId =
            getSchoolId(req);


        const studentId =
            Number(
                req.params.studentId
            );


        if (
            !studentId ||
            Number.isNaN(studentId)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Valid student ID is required."

            });

        }


        const {
            data: charges,
            error: chargeError
        } = await supabase
            .schema("finance")
            .from("student_charges")
            .select("*")
            .eq(
                "school_id",
                schoolId
            )
            .eq(
                "student_id",
                studentId
            )
            .order(
                "charge_date",
                {
                    ascending: false
                }
            );


        if (chargeError) {

            throw chargeError;

        }


        const {
            data: payments,
            error: paymentError
        } = await supabase
            .schema("finance")
            .from("student_payments")
            .select("*")
            .eq(
                "school_id",
                schoolId
            )
            .eq(
                "student_id",
                studentId
            )
            .order(
                "payment_date",
                {
                    ascending: false
                }
            );


        if (paymentError) {

            throw paymentError;

        }


        const expectedAmount =
            (charges || []).reduce(
                (
                    total,
                    charge
                ) =>
                    total +
                    numberValue(
                        charge.amount
                    ),
                0
            );


        const paidAmount =
            (payments || []).reduce(
                (
                    total,
                    payment
                ) =>
                    total +
                    numberValue(
                        payment.amount
                    ),
                0
            );


        const balance =
            (charges || []).reduce(
                (
                    total,
                    charge
                ) =>
                    total +
                    numberValue(
                        charge.balance ??
                        (
                            numberValue(
                                charge.amount
                            ) -
                            numberValue(
                                charge.paid_amount
                            )
                        )
                    ),
                0
            );


        return res.json({

            success: true,

            data: {

                charges:
                    charges || [],

                payments:
                    payments || [],

                summary: {

                    expectedAmount,

                    paidAmount,

                    balance

                }

            }

        });

    } catch (error) {

        return sendError(
            res,
            error,
            "Unable to load student receivables."
        );

    }

};


// ============================================================
// STUDENT STATEMENT
// ============================================================

export const getStudentStatement = async (
    req,
    res
) => {

    try {

        const schoolId =
            getSchoolId(req);


        const studentId =
            Number(
                req.params.studentId
            );


        if (
            !studentId ||
            Number.isNaN(studentId)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Valid student ID is required."

            });

        }


        // ----------------------------------------------------
        // STUDENT
        // ----------------------------------------------------

        const {
            data: student,
            error: studentError
        } = await supabase
            .from("students")
            .select("*")
            .eq(
                "id",
                studentId
            )
            .eq(
                "school_id",
                schoolId
            )
            .maybeSingle();


        if (studentError) {

            throw studentError;

        }


        // ----------------------------------------------------
        // CHARGES
        // ----------------------------------------------------

        const {
            data: charges,
            error: chargeError
        } = await supabase
            .schema("finance")
            .from("student_charges")
            .select("*")
            .eq(
                "school_id",
                schoolId
            )
            .eq(
                "student_id",
                studentId
            )
            .order(
                "charge_date",
                {
                    ascending: true
                }
            );


        if (chargeError) {

            throw chargeError;

        }


        // ----------------------------------------------------
        // PAYMENTS
        // ----------------------------------------------------

        const {
            data: payments,
            error: paymentError
        } = await supabase
            .schema("finance")
            .from("student_payments")
            .select("*")
            .eq(
                "school_id",
                schoolId
            )
            .eq(
                "student_id",
                studentId
            )
            .order(
                "payment_date",
                {
                    ascending: true
                }
            );


        if (paymentError) {

            throw paymentError;

        }


        const expectedAmount =
            (charges || []).reduce(
                (
                    total,
                    charge
                ) =>
                    total +
                    numberValue(
                        charge.amount
                    ),
                0
            );


        const paidAmount =
            (payments || []).reduce(
                (
                    total,
                    payment
                ) =>
                    total +
                    numberValue(
                        payment.amount
                    ),
                0
            );


        const balance =
            expectedAmount -
            paidAmount;


        // ----------------------------------------------------
        // TERM SUMMARY
        // ----------------------------------------------------

        const termSummary =
            [1, 2, 3].map(
                (termNumber) => {

                    const termCharges =
                        (
                            charges || []
                        ).filter(
                            charge =>
                                Number(
                                    charge.term_number
                                ) === termNumber
                        );


                    const termChargeIds =
                        new Set(
                            termCharges.map(
                                charge =>
                                    String(
                                        charge.id
                                    )
                            )
                        );


                    const termPayments =
                        (
                            payments || []
                        ).filter(
                            payment =>
                                payment.charge_id &&
                                termChargeIds.has(
                                    String(
                                        payment.charge_id
                                    )
                                )
                        );


                    const expected =
                        termCharges.reduce(
                            (
                                total,
                                charge
                            ) =>
                                total +
                                numberValue(
                                    charge.amount
                                ),
                            0
                        );


                    const paid =
                        termPayments.reduce(
                            (
                                total,
                                payment
                            ) =>
                                total +
                                numberValue(
                                    payment.amount
                                ),
                            0
                        );


                    return {

                        term:
                            termNumber,

                        expected,

                        paid,

                        balance:
                            expected -
                            paid

                    };

                }
            );


        return res.json({

            success: true,

            data: {

                student,

                charges:
                    charges || [],

                payments:
                    payments || [],

                termSummary,

                summary: {

                    expectedAmount,

                    paidAmount,

                    balance

                }

            }

        });

    } catch (error) {

        return sendError(
            res,
            error,
            "Unable to load student statement."
        );

    }

};


// ============================================================
// CREATE STUDENT CHARGE
//
// Accounting:
// DR Student Receivables 1400
// CR Fee Revenue
//
// This handler is ready for the next route.
// ============================================================

export const createStudentCharge = async (
    req,
    res
) => {

    try {

        const schoolId =
            getSchoolId(req);


        const {

            student_id,

            charge_date,

            academic_year_id,

            description,

            amount,

            revenue_account_id,

            fee_item_id,

            term_number,

            due_date,

            invoice_number,

            created_by

        } = req.body;


        const chargeAmount =
            numberValue(
                amount
            );


        if (!student_id) {

            return res.status(400).json({

                success: false,

                message:
                    "Student ID is required."

            });

        }


        if (!academic_year_id) {

            return res.status(400).json({

                success: false,

                message:
                    "Academic year is required."

            });

        }


        if (!description) {

            return res.status(400).json({

                success: false,

                message:
                    "Charge description is required."

            });

        }


        if (
            chargeAmount <= 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Charge amount must be greater than zero."

            });

        }


        if (
            !revenue_account_id
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Revenue account is required."

            });

        }


        const {
            data,
            error
        } = await supabase
            .schema("finance")
            .rpc(
                "record_student_charge",
                {

                    p_school_id:
                        schoolId,

                    p_student_id:
                        Number(
                            student_id
                        ),

                    p_charge_date:
                        charge_date ||
                        today(),

                    p_academic_year_id:
                        Number(
                            academic_year_id
                        ),

                    p_description:
                        String(
                            description
                        ).trim(),

                    p_amount:
                        chargeAmount,

                    p_revenue_account_id:
                        revenue_account_id,

                    p_fee_item_id:
                        fee_item_id ||
                        null,

                    p_term_number:
                        term_number
                            ? Number(
                                term_number
                            )
                            : null,

                    p_due_date:
                        due_date ||
                        null,

                    p_invoice_number:
                        invoice_number ||
                        null,

                    p_created_by:
                        created_by ||
                        getUserId(req)

                }
            );


        if (error) {

            throw error;

        }


        const result =
            normalizeRpcRow(
                data
            );


        return res.status(201).json({

            success: true,

            message:
                "Student charge recorded successfully.",

            data:
                result

        });

    } catch (error) {

        return sendError(
            res,
            error,
            "Unable to record student charge."
        );

    }

};


// ============================================================
// CREATE STUDENT PAYMENT
//
// Accounting:
// DR Cash / Bank
// CR Student Receivables 1400
//
// Ready for Record Payment route.
// ============================================================

export const createStudentPayment = async (
    req,
    res
) => {

    try {

        const schoolId =
            getSchoolId(req);


        const {

            student_id,

            charge_id,

            payment_date,

            amount,

            payment_method,

            financial_account_id,

            provider_name,

            reference_number,

            description,

            created_by

        } = req.body;


        const paymentAmount =
            numberValue(
                amount
            );


        if (!student_id) {

            return res.status(400).json({

                success: false,

                message:
                    "Student ID is required."

            });

        }


        if (!charge_id) {

            return res.status(400).json({

                success: false,

                message:
                    "Charge ID is required."

            });

        }


        if (
            paymentAmount <= 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Payment amount must be greater than zero."

            });

        }


        if (
            !payment_method
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Payment method is required."

            });

        }


        if (
            !financial_account_id
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Cash / bank account is required."

            });

        }


        const {
            data,
            error
        } = await supabase
            .schema("finance")
            .rpc(
                "record_student_payment",
                {

                    p_school_id:
                        schoolId,

                    p_student_id:
                        Number(
                            student_id
                        ),

                    p_charge_id:
                        charge_id,

                    p_payment_date:
                        payment_date ||
                        today(),

                    p_amount:
                        paymentAmount,

                    p_payment_method:
                        String(
                            payment_method
                        ).trim(),

                    p_financial_account_id:
                        Number(
                            financial_account_id
                        ),

                    p_provider_name:
                        provider_name ||
                        null,

                    p_reference_number:
                        reference_number ||
                        null,

                    p_description:
                        description ||
                        null,

                    p_created_by:
                        created_by ||
                        getUserId(req)

                }
            );


        if (error) {

            throw error;

        }


        const result =
            normalizeRpcRow(
                data
            );


        return res.status(201).json({

            success: true,

            message:
                "Student payment recorded successfully.",

            data:
                result

        });

    } catch (error) {

        return sendError(
            res,
            error,
            "Unable to record student payment."
        );

    }

};


// ============================================================
// SUPPLIERS
// ============================================================

export const getSuppliers = async (
    req,
    res
) => {

    try {

        const schoolId =
            getSchoolId(req);


        const {
            data,
            error
        } = await supabase
            .schema("finance")
            .from("suppliers")
            .select("*")
            .eq(
                "school_id",
                schoolId
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


        if (error) {

            throw error;

        }


        return res.json({

            success: true,

            data:
                data || []

        });

    } catch (error) {

        return sendError(
            res,
            error,
            "Unable to load suppliers."
        );

    }

};


// ============================================================
// CREATE SUPPLIER
// ============================================================

export const createSupplier = async (
    req,
    res
) => {

    try {

        const schoolId =
            getSchoolId(req);


        const payload = {

            ...req.body,

            school_id:
                schoolId

        };


        const {
            data,
            error
        } = await supabase
            .schema("finance")
            .from("suppliers")
            .insert(
                payload
            )
            .select()
            .single();


        if (error) {

            throw error;

        }


        return res.status(201).json({

            success: true,

            message:
                "Supplier created successfully.",

            data

        });

    } catch (error) {

        return sendError(
            res,
            error,
            "Unable to create supplier."
        );

    }

};


// ============================================================
// PAYABLES
// ============================================================

export const getPayables = async (
    req,
    res
) => {

    try {

        const schoolId =
            getSchoolId(req);


        const {
            data,
            error
        } = await supabase
            .schema("finance")
            .from("supplier_bills")
            .select("*")
            .eq(
                "school_id",
                schoolId
            )
            .order(
                "bill_date",
                {
                    ascending: false
                }
            );


        if (error) {

            throw error;

        }


        return res.json({

            success: true,

            data:
                data || []

        });

    } catch (error) {

        return sendError(
            res,
            error,
            "Unable to load payables."
        );

    }

};


// ============================================================
// CREATE PAYABLE
// ============================================================

export const createPayable = async (
    req,
    res
) => {

    try {

        const schoolId =
            getSchoolId(req);


        const payload = {

            ...req.body,

            school_id:
                schoolId

        };


        const {
            data,
            error
        } = await supabase
            .schema("finance")
            .from("supplier_bills")
            .insert(
                payload
            )
            .select()
            .single();


        if (error) {

            throw error;

        }


        return res.status(201).json({

            success: true,

            message:
                "Payable created successfully.",

            data

        });

    } catch (error) {

        return sendError(
            res,
            error,
            "Unable to create payable."
        );

    }

};


// ============================================================
// EXPENSES
// ============================================================

export const getExpenses = async (
    req,
    res
) => {

    try {

        const schoolId =
            getSchoolId(req);


        const {
            data,
            error
        } = await supabase
            .schema("finance")
            .from("expenses")
            .select("*")
            .eq(
                "school_id",
                schoolId
            )
            .order(
                "expense_date",
                {
                    ascending: false
                }
            );


        if (error) {

            throw error;

        }


        return res.json({

            success: true,

            data:
                data || []

        });

    } catch (error) {

        return sendError(
            res,
            error,
            "Unable to load expenses."
        );

    }

};


// ============================================================
// CREATE EXPENSE
// ============================================================

export const createExpense = async (
    req,
    res
) => {

    try {

        const schoolId =
            getSchoolId(req);


        const payload = {

            ...req.body,

            school_id:
                schoolId,

            status:
                req.body.status ||
                "draft"

        };


        const {
            data,
            error
        } = await supabase
            .schema("finance")
            .from("expenses")
            .insert(
                payload
            )
            .select()
            .single();


        if (error) {

            throw error;

        }


        return res.status(201).json({

            success: true,

            message:
                "Expense saved successfully.",

            data

        });

    } catch (error) {

        return sendError(
            res,
            error,
            "Unable to create expense."
        );

    }

};


// ============================================================
// BUDGETS
// ============================================================

export const getBudgets = async (
    req,
    res
) => {

    try {

        const schoolId =
            getSchoolId(req);


        const {
            data,
            error
        } = await supabase
            .schema("finance")
            .from("budgets")
            .select(
                `
                    *,
                    budget_lines (*)
                `
            )
            .eq(
                "school_id",
                schoolId
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


        if (error) {

            throw error;

        }


        return res.json({

            success: true,

            data:
                data || []

        });

    } catch (error) {

        return sendError(
            res,
            error,
            "Unable to load budgets."
        );

    }

};


// ============================================================
// CREATE BUDGET
// ============================================================

export const createBudget = async (
    req,
    res
) => {

    try {

        const schoolId =
            getSchoolId(req);


        const {

            budgetLines,
            ...budgetData

        } = req.body;


        const {
            data: budget,
            error: budgetError
        } = await supabase
            .schema("finance")
            .from("budgets")
            .insert({

                ...budgetData,

                school_id:
                    schoolId

            })
            .select()
            .single();


        if (budgetError) {

            throw budgetError;

        }


        if (
            Array.isArray(
                budgetLines
            ) &&
            budgetLines.length > 0
        ) {

            const lines =
                budgetLines.map(
                    line => ({

                        ...line,

                        budget_id:
                            budget.id,

                        school_id:
                            schoolId

                    })
                );


            const {
                error: lineError
            } = await supabase
                .schema("finance")
                .from("budget_lines")
                .insert(
                    lines
                );


            if (lineError) {

                throw lineError;

            }

        }


        return res.status(201).json({

            success: true,

            message:
                "Budget created successfully.",

            data: budget

        });

    } catch (error) {

        return sendError(
            res,
            error,
            "Unable to create budget."
        );

    }

};


// ============================================================
// TRIAL BALANCE
// ============================================================

export const getTrialBalance = async (
    req,
    res
) => {

    try {

        const schoolId =
            getSchoolId(req);


        const {
            data: accounts,
            error: accountError
        } = await supabase
            .schema("finance")
            .from("chart_of_accounts")
            .select(
                `
                    id,
                    account_code,
                    account_name,
                    account_type,
                    normal_balance,
                    opening_balance
                `
            )
            .eq(
                "school_id",
                schoolId
            )
            .order(
                "account_code",
                {
                    ascending: true
                }
            );


        if (accountError) {

            throw accountError;

        }


        const {
            data: activity,
            error: activityError
        } = await supabase
            .schema("finance")
            .from("v_account_activity")
            .select("*")
            .eq(
                "school_id",
                schoolId
            );


        if (activityError) {

            throw activityError;

        }


        const rows =
            (accounts || []).map(
                account => {

                    const accountActivity =
                        (
                            activity || []
                        ).filter(
                            row =>
                                String(
                                    row.account_id
                                ) ===
                                String(
                                    account.id
                                )
                        );


                    const debit =
                        accountActivity.reduce(
                            (
                                total,
                                row
                            ) =>
                                total +
                                numberValue(
                                    row.debit
                                ),
                            0
                        );


                    const credit =
                        accountActivity.reduce(
                            (
                                total,
                                row
                            ) =>
                                total +
                                numberValue(
                                    row.credit
                                ),
                            0
                        );


                    const opening =
                        numberValue(
                            account.opening_balance
                        );


                    let debitBalance = 0;
                    let creditBalance = 0;


                    if (
                        account.normal_balance ===
                        "debit"
                    ) {

                        const balance =
                            opening +
                            debit -
                            credit;


                        if (
                            balance >= 0
                        ) {

                            debitBalance =
                                balance;

                        } else {

                            creditBalance =
                                Math.abs(
                                    balance
                                );

                        }

                    } else {

                        const balance =
                            opening +
                            credit -
                            debit;


                        if (
                            balance >= 0
                        ) {

                            creditBalance =
                                balance;

                        } else {

                            debitBalance =
                                Math.abs(
                                    balance
                                );

                        }

                    }


                    return {

                        ...account,

                        debit,

                        credit,

                        debit_balance:
                            debitBalance,

                        credit_balance:
                            creditBalance

                    };

                }
            );


        const totalDebit =
            rows.reduce(
                (
                    total,
                    row
                ) =>
                    total +
                    numberValue(
                        row.debit_balance
                    ),
                0
            );


        const totalCredit =
            rows.reduce(
                (
                    total,
                    row
                ) =>
                    total +
                    numberValue(
                        row.credit_balance
                    ),
                0
            );


        return res.json({

            success: true,

            data: {

                rows,

                totals: {

                    debit:
                        totalDebit,

                    credit:
                        totalCredit,

                    difference:
                        totalDebit -
                        totalCredit

                }

            }

        });

    } catch (error) {

        return sendError(
            res,
            error,
            "Unable to generate trial balance."
        );

    }

};


// ============================================================
// INCOME & EXPENSES SUMMARY
// Posted general-ledger entries are the single source of truth.
// Receipts and expense records are classification metadata only.
// ============================================================

export const getIncomeExpensesSummary = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        // Reports use Tanzania school-local dates, not the server's UTC date.
        const dateParts = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Africa/Dar_es_Salaam",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).formatToParts(new Date());
        const localToday = Object.fromEntries(dateParts.map(part => [part.type, part.value]));
        const todayDate = `${localToday.year}-${localToday.month}-${localToday.day}`;
        const fromDate = String(req.query.from || (todayDate.slice(0, 4) + "-01-01"));
        const toDate = String(req.query.to || todayDate);
        const validDate = value => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
            const [year, month, day] = value.split("-").map(Number);
            const parsed = new Date(Date.UTC(year, month - 1, day));
            return parsed.getUTCFullYear() === year &&
                parsed.getUTCMonth() === month - 1 &&
                parsed.getUTCDate() === day;
        };
        if (!validDate(fromDate) || !validDate(toDate) || fromDate > toDate) {
            return res.status(400).json({ success: false, message: "Choose a valid reporting date range." });
        }

        const fetchAll = async buildQuery => {
            const rows = [];
            for (let offset = 0; ; offset += 1000) {
                const result = await buildQuery().range(offset, offset + 999);
                if (result.error) throw result.error;
                rows.push(...(result.data || []));
                if (!result.data || result.data.length < 1000) break;
            }
            return rows;
        };
        const chunks = (items, size = 100) => {
            const result = [];
            for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
            return result;
        };

        const entries = await fetchAll(() => supabase.schema("finance").from("journal_entries")
            .select("id,source_type,transaction_date,reference_number,description")
            .eq("school_id", schoolId).eq("status", "posted").is("reversed_at", null)
            .gte("transaction_date", fromDate).lte("transaction_date", toDate)
            .order("transaction_date", { ascending: true }));

        if (!entries.length) {
            return res.json({ success: true, data: {
                school_id: schoolId, period: { from: fromDate, to: toDate },
                totalIncome: 0, totalExpenses: 0, netResult: 0,
                incomeSources: [], expenseSources: [], transactionCount: 0,
                basis: "posted_general_ledger"
            }});
        }

        const entryIds = entries.map(row => row.id);
        // Load independent ledger details concurrently; the previous implementation
        // waited for every 1,000-row page and every table before starting the next.
        const lineChunks = chunks(entryIds);
        const journalLineGroups = await Promise.all(lineChunks.map(ids =>
            fetchAll(() => supabase.schema("finance").from("journal_lines")
                .select("journal_entry_id,account_id,debit,credit").in("journal_entry_id", ids))
        ));
        const journalLines = journalLineGroups.flat();
        const accountIds = [...new Set(journalLines.map(row => row.account_id).filter(Boolean))];
        const accountGroups = await Promise.all(chunks(accountIds).map(ids =>
            supabase.schema("finance").from("chart_of_accounts")
                .select("id,account_name,account_type,account_category")
                .eq("school_id", schoolId).in("id", ids)
                .then(result => {
                    if (result.error) throw result.error;
                    return result.data || [];
                })
        ));
        const accounts = accountGroups.flat();

        const [expenseGroups, receiptGroups] = await Promise.all([
            Promise.all(lineChunks.map(ids => fetchAll(() =>
                supabase.schema("finance").from("expenses")
                    .select("journal_entry_id,expense_category,description")
                    .eq("school_id", schoolId).in("journal_entry_id", ids)
            ))),
            Promise.all(lineChunks.map(ids => fetchAll(() =>
                supabase.schema("finance").from("receipts")
                    .select("journal_entry_id,receipt_number,description")
                    .eq("school_id", schoolId).in("journal_entry_id", ids)
            )))
        ]);
        const expenseRows = expenseGroups.flat();
        const receiptRows = receiptGroups.flat();

        const entryMap = new Map(entries.map(row => [String(row.id), row]));
        const accountMap = new Map(accounts.map(row => [String(row.id), row]));
        const expenseMap = new Map(expenseRows.map(row => [String(row.journal_entry_id), row]));
        const receiptMap = new Map(receiptRows.map(row => [String(row.journal_entry_id), row]));
        const incomeBuckets = new Map();
        const expenseBuckets = new Map();
        const addAmount = (buckets, label, accountName, amount, entryId) => {
            if (!buckets.has(label)) buckets.set(label, { source: label, amount: 0, entries: new Set(), accounts: new Map() });
            const bucket = buckets.get(label);
            bucket.amount += amount;
            bucket.entries.add(String(entryId));
            bucket.accounts.set(accountName, (bucket.accounts.get(accountName) || 0) + amount);
        };

        for (const line of journalLines) {
            const entry = entryMap.get(String(line.journal_entry_id));
            const account = accountMap.get(String(line.account_id));
            if (!entry || !account) continue;
            const type = String(account.account_type || "").toLowerCase();
            if (type === "revenue") {
                const amount = numberValue(line.credit) - numberValue(line.debit);
                if (!amount) continue;
                const sourceType = String(entry.source_type || "").toLowerCase();
                const receipt = receiptMap.get(String(entry.id));
                const reference = String(receipt?.receipt_number || entry.reference_number || "").toUpperCase();
                const description = String(receipt?.description || entry.description || "").toLowerCase();
                const accountText = String((account.account_name || "") + " " + (account.account_category || "")).toLowerCase();
                let label = "Other Income";
                if (sourceType.includes("transport") || accountText.includes("transport")) label = "Transport";
                else if (["student_charge", "student_charge_adjustment", "fee_correction"].includes(sourceType) || /school fee|tuition|student fee/.test(accountText)) label = "Student Fees";
                else if (reference.startsWith("STOCK-") || description.includes("stock order")) label = "Stock Sales";
                addAmount(incomeBuckets, label, account.account_name || label, amount, entry.id);
            } else if (type === "expense") {
                const amount = numberValue(line.debit) - numberValue(line.credit);
                if (!amount) continue;
                const expense = expenseMap.get(String(entry.id));
                const sourceType = String(entry.source_type || "").toLowerCase();
                const rawCategory = String(expense?.expense_category || account.account_category || account.account_name || "Other Expenses");
                const label = sourceType.includes("transport") ? "Transport" : sourceType.includes("payroll") ? "Staff Payroll" : rawCategory.replace(/[_-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                addAmount(expenseBuckets, label, account.account_name || label, amount, entry.id);
            }
        }

        const serialize = buckets => [...buckets.values()].map(bucket => ({
            source: bucket.source,
            amount: Number(bucket.amount.toFixed(2)),
            transactionCount: bucket.entries.size,
            accounts: [...bucket.accounts.entries()]
                .map(([account, amount]) => ({ account, amount: Number(amount.toFixed(2)) }))
                .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
        })).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
        const incomeSources = serialize(incomeBuckets);
        const expenseSources = serialize(expenseBuckets);
        const totalIncome = Number(incomeSources.reduce((sum, row) => sum + row.amount, 0).toFixed(2));
        const totalExpenses = Number(expenseSources.reduce((sum, row) => sum + row.amount, 0).toFixed(2));
        const allEntryIds = new Set();
        for (const bucket of [...incomeBuckets.values(), ...expenseBuckets.values()]) {
            for (const id of bucket.entries) allEntryIds.add(id);
        }

        return res.json({ success: true, data: {
            school_id: schoolId,
            period: { from: fromDate, to: toDate },
            totalIncome,
            totalExpenses,
            netResult: Number((totalIncome - totalExpenses).toFixed(2)),
            incomeSources,
            expenseSources,
            transactionCount: allEntryIds.size,
            basis: "posted_general_ledger"
        }});
    } catch (error) {
        return sendError(res, error, "Unable to generate income and expenses summary.");
    }
};

// ============================================================
// INCOME STATEMENT
// ============================================================

export const getIncomeStatement = async (
    req,
    res
) => {

    try {

        const schoolId =
            getSchoolId(req);


        const {
            data,
            error
        } = await supabase
            .schema("finance")
            .from("v_income_statement")
            .select("*")
            .eq(
                "school_id",
                schoolId
            );


        if (error) {

            throw error;

        }


        const rows =
            data || [];


        const revenue =
            rows.filter(
                row =>
                    row.account_type ===
                    "revenue"
            );


        const expenses =
            rows.filter(
                row =>
                    row.account_type ===
                    "expense"
            );


        const totalRevenue =
            revenue.reduce(
                (
                    total,
                    row
                ) =>
                    total +
                    Math.abs(
                        numberValue(
                            row.amount
                        )
                    ),
                0
            );


        const totalExpenses =
            expenses.reduce(
                (
                    total,
                    row
                ) =>
                    total +
                    Math.abs(
                        numberValue(
                            row.amount
                        )
                    ),
                0
            );


        const netIncome =
            totalRevenue -
            totalExpenses;


        return res.json({

            success: true,

            data: {

                revenue,

                expenses,

                totalRevenue,

                totalExpenses,

                netIncome

            }

        });

    } catch (error) {

        return sendError(
            res,
            error,
            "Unable to generate income statement."
        );

    }

};


// ============================================================
// STATEMENT OF FINANCIAL POSITION
// ============================================================

export const getFinancialPosition = async (
    req,
    res
) => {

    try {

        const schoolId =
            getSchoolId(req);


        const {
            data,
            error
        } = await supabase
            .schema("finance")
            .from(
                "v_statement_of_financial_position"
            )
            .select("*")
            .eq(
                "school_id",
                schoolId
            );


        if (error) {

            throw error;

        }


        const rows =
            data || [];


        const assets =
            rows.filter(
                row =>
                    row.account_type ===
                    "asset"
            );


        const liabilities =
            rows.filter(
                row =>
                    row.account_type ===
                    "liability"
            );


        const equity =
            rows.filter(
                row =>
                    row.account_type ===
                    "equity"
            );


        const totalAssets =
            assets.reduce(
                (
                    total,
                    row
                ) =>
                    total +
                    Math.abs(
                        numberValue(
                            row.balance
                        )
                    ),
                0
            );


        const totalLiabilities =
            liabilities.reduce(
                (
                    total,
                    row
                ) =>
                    total +
                    Math.abs(
                        numberValue(
                            row.balance
                        )
                    ),
                0
            );


        const totalEquity =
            equity.reduce(
                (
                    total,
                    row
                ) =>
                    total +
                    Math.abs(
                        numberValue(
                            row.balance
                        )
                    ),
                0
            );


        return res.json({

            success: true,

            data: {

                assets,

                liabilities,

                equity,

                totalAssets,

                totalLiabilities,

                totalEquity,

                liabilitiesAndEquity:
                    totalLiabilities +
                    totalEquity

            }

        });

    } catch (error) {

        return sendError(
            res,
            error,
            "Unable to generate statement of financial position."
        );

    }

};


// ============================================================
// RECEIVABLES REPORT
// ============================================================

export const getReceivablesReport = async (
    req,
    res
) => {

    try {

        const schoolId =
            getSchoolId(req);


        const {
            data,
            error
        } = await supabase
            .schema("finance")
            .from(
                "v_receivables_summary"
            )
            .select("*")
            .eq(
                "school_id",
                schoolId
            );


        if (error) {

            throw error;

        }


        return res.json({

            success: true,

            data:
                data || []

        });

    } catch (error) {

        return sendError(
            res,
            error,
            "Unable to generate receivables report."
        );

    }

};


// ============================================================
// PAYABLES REPORT
// ============================================================

export const getPayablesReport = async (
    req,
    res
) => {

    try {

        const schoolId =
            getSchoolId(req);


        const {
            data,
            error
        } = await supabase
            .schema("finance")
            .from(
                "v_payables_summary"
            )
            .select("*")
            .eq(
                "school_id",
                schoolId
            );


        if (error) {

            throw error;

        }


        return res.json({

            success: true,

            data:
                data || []

        });

    } catch (error) {

        return sendError(
            res,
            error,
            "Unable to generate payables report."
        );

    }

};