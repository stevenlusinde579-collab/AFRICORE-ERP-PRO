import React from "react";
import { Navigate } from "react-router-dom";


// =====================================================
// FINANCE ENTRY POINT
// =====================================================
//
// Finance module imejengwa upya.
//
// /finance
//      ↓
// /finance/dashboard
//
// Hii file haipaswi tena kuwa na logic ya zamani ya:
// - student_fee_payments
// - financial_accounts
// - old payment dashboard
// - old test-data clearing
//
// Financial Dashboard mpya ndiyo source ya interface ya
// Finance module.
// =====================================================

function Finance() {
    return (
        <Navigate
            to="/finance/dashboard"
            replace
        />
    );
}

export default Finance;