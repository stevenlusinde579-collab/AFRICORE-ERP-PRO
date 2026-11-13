-- Allow school finance managers to maintain their own cash/bank/mobile-money
-- account register. Existing tenant RLS policy af_score_tenant_guard enforces
-- school_id = get_current_user_school_id() (or Super Admin).
--
-- The table was previously SELECT-only for authenticated users, so the UI
-- could display accounts but could not create or update them.

GRANT INSERT, UPDATE
    ON TABLE finance.cash_accounts
    TO authenticated;

GRANT USAGE, SELECT
    ON SEQUENCE finance.cash_accounts_id_seq
    TO authenticated;
