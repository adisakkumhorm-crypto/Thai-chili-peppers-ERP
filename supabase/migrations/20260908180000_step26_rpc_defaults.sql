-- Migration: Add DEFAULT NULL to RPCs (BUG-26-01 Cleanup)

-- Drop old functions
DROP FUNCTION IF EXISTS rpc_create_invoice(UUID, UUID, UUID, UUID, TEXT, invoice_status, DATE, DATE, BIGINT, BIGINT, BIGINT, UUID, UUID, BIGINT, BOOLEAN, recurring_interval, TEXT);
DROP FUNCTION IF EXISTS rpc_create_cost(UUID, UUID, cost_category, BIGINT, BIGINT, BIGINT, UUID, UUID, BIGINT, DATE, TEXT, UUID, TEXT, UUID, UUID);
DROP FUNCTION IF EXISTS rpc_record_payment(UUID, UUID, UUID, BIGINT, DATE, payment_method, TEXT);
DROP FUNCTION IF EXISTS rpc_record_payment(UUID, UUID, UUID, BIGINT, TIMESTAMPTZ, payment_method, TEXT); -- Just in case

-- 1. Create Invoice RPC
CREATE OR REPLACE FUNCTION rpc_create_invoice(
    p_id UUID,
    p_org_id UUID,
    p_client_id UUID,
    p_number TEXT,
    p_status invoice_status,
    p_subtotal_satang BIGINT,
    p_vat_amount_satang BIGINT,
    p_wht_amount_satang BIGINT,
    p_amount_satang BIGINT,
    p_is_recurring BOOLEAN,
    p_project_id UUID DEFAULT NULL,
    p_issue_date DATE DEFAULT NULL,
    p_due_date DATE DEFAULT NULL,
    p_vat_rate_id UUID DEFAULT NULL,
    p_wht_rate_id UUID DEFAULT NULL,
    p_recurring_interval recurring_interval DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_ar_acct UUID;
    v_rev_acct UUID;
    v_out_vat_acct UUID;
    v_wht_rec_acct UUID;
    v_lines JSONB := '[]'::jsonb;
BEGIN
    INSERT INTO invoices (
        id, org_id, client_id, project_id, number, status, issue_date, due_date,
        subtotal_satang, vat_amount_satang, wht_amount_satang,
        vat_rate_id, wht_rate_id, amount_satang, is_recurring, recurring_interval, notes
    ) VALUES (
        p_id, p_org_id, p_client_id, p_project_id, p_number, p_status, COALESCE(p_issue_date, CURRENT_DATE), p_due_date,
        p_subtotal_satang, p_vat_amount_satang, p_wht_amount_satang,
        p_vat_rate_id, p_wht_rate_id, p_amount_satang, p_is_recurring, p_recurring_interval, p_notes
    );

    SELECT id INTO v_ar_acct FROM accounts WHERE org_id = p_org_id AND code = '1200';
    SELECT id INTO v_rev_acct FROM accounts WHERE org_id = p_org_id AND code = '4100';
    IF v_ar_acct IS NULL OR v_rev_acct IS NULL THEN
        RAISE EXCEPTION 'Required accounts (1200, 4100) not found for org %', p_org_id;
    END IF;

    v_lines := v_lines || jsonb_build_object('account_id', v_ar_acct, 'debit', p_amount_satang, 'credit', 0);
    v_lines := v_lines || jsonb_build_object('account_id', v_rev_acct, 'debit', 0, 'credit', p_subtotal_satang);

    IF p_vat_amount_satang > 0 THEN
        SELECT id INTO v_out_vat_acct FROM accounts WHERE org_id = p_org_id AND code = '2150';
        IF v_out_vat_acct IS NOT NULL THEN
            v_lines := v_lines || jsonb_build_object('account_id', v_out_vat_acct, 'debit', 0, 'credit', p_vat_amount_satang);
        END IF;
    END IF;

    IF p_wht_amount_satang > 0 THEN
        SELECT id INTO v_wht_rec_acct FROM accounts WHERE org_id = p_org_id AND code = '1154';
        IF v_wht_rec_acct IS NOT NULL THEN
            v_lines := v_lines || jsonb_build_object('account_id', v_wht_rec_acct, 'debit', p_wht_amount_satang, 'credit', 0);
        END IF;
    END IF;

    PERFORM create_automated_journal_entry(
        p_org_id, 'invoice'::journal_entry_source, p_id, 'ตั้งหนี้ลูกหนี้การค้า ใบแจ้งหนี้ ' || p_number, v_lines
    );

    RETURN p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create Cost RPC
CREATE OR REPLACE FUNCTION rpc_create_cost(
    p_id UUID,
    p_org_id UUID,
    p_category cost_category,
    p_subtotal_satang BIGINT,
    p_vat_amount_satang BIGINT,
    p_wht_amount_satang BIGINT,
    p_amount_satang BIGINT,
    p_vat_rate_id UUID DEFAULT NULL,
    p_wht_rate_id UUID DEFAULT NULL,
    p_incurred_on DATE DEFAULT NULL,
    p_vendor TEXT DEFAULT NULL,
    p_project_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_po_id UUID DEFAULT NULL,
    p_supplier_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_exp_code TEXT;
    v_exp_acct UUID;
    v_bank_acct UUID;
    v_in_vat_acct UUID;
    v_wht_pay_acct UUID;
    v_lines JSONB := '[]'::jsonb;
    v_desc TEXT;
BEGIN
    INSERT INTO costs (
        id, org_id, category, subtotal_satang, vat_amount_satang, wht_amount_satang,
        vat_rate_id, wht_rate_id, amount_satang, incurred_on, vendor, project_id, notes, po_id, supplier_id
    ) VALUES (
        p_id, p_org_id, p_category, p_subtotal_satang, p_vat_amount_satang, p_wht_amount_satang,
        p_vat_rate_id, p_wht_rate_id, p_amount_satang, COALESCE(p_incurred_on, CURRENT_DATE), p_vendor, p_project_id, p_notes, p_po_id, p_supplier_id
    );

    IF p_category IN ('software', 'infra') THEN v_exp_code := '5400';
    ELSIF p_category = 'contractor' THEN v_exp_code := '5500';
    ELSIF p_category = 'marketing' THEN v_exp_code := '5300';
    ELSIF p_category = 'salary' THEN v_exp_code := '5200';
    ELSE v_exp_code := '5900';
    END IF;

    SELECT id INTO v_exp_acct FROM accounts WHERE org_id = p_org_id AND code = v_exp_code;
    SELECT id INTO v_bank_acct FROM accounts WHERE org_id = p_org_id AND code = '1120';
    IF v_exp_acct IS NULL OR v_bank_acct IS NULL THEN
        RAISE EXCEPTION 'Required accounts (%, 1120) not found for org %', v_exp_code, p_org_id;
    END IF;

    v_lines := v_lines || jsonb_build_object('account_id', v_exp_acct, 'debit', p_subtotal_satang, 'credit', 0);
    v_lines := v_lines || jsonb_build_object('account_id', v_bank_acct, 'debit', 0, 'credit', p_amount_satang);

    IF p_vat_amount_satang > 0 THEN
        SELECT id INTO v_in_vat_acct FROM accounts WHERE org_id = p_org_id AND code = '1155';
        IF v_in_vat_acct IS NOT NULL THEN
            v_lines := v_lines || jsonb_build_object('account_id', v_in_vat_acct, 'debit', p_vat_amount_satang, 'credit', 0);
        END IF;
    END IF;

    IF p_wht_amount_satang > 0 THEN
        SELECT id INTO v_wht_pay_acct FROM accounts WHERE org_id = p_org_id AND code = '2130';
        IF v_wht_pay_acct IS NOT NULL THEN
            v_lines := v_lines || jsonb_build_object('account_id', v_wht_pay_acct, 'debit', 0, 'credit', p_wht_amount_satang);
        END IF;
    END IF;

    IF p_vendor IS NOT NULL AND p_vendor <> '' THEN
        v_desc := 'บันทึกค่าใช้จ่าย ' || p_category || ' - ' || p_vendor;
    ELSE
        v_desc := 'บันทึกค่าใช้จ่าย ' || p_category;
    END IF;

    PERFORM create_automated_journal_entry(
        p_org_id, 'manual'::journal_entry_source, p_id, v_desc, v_lines
    );

    RETURN p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create Record Payment RPC
CREATE OR REPLACE FUNCTION rpc_record_payment(
    p_id UUID,
    p_org_id UUID,
    p_invoice_id UUID,
    p_amount_satang BIGINT,
    p_method payment_method,
    p_paid_at TIMESTAMPTZ DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_inv_amount BIGINT;
    v_inv_status invoice_status;
    v_inv_number TEXT;
    v_total_paid BIGINT;
    v_next_status invoice_status;
    v_cash_code TEXT;
    v_cash_acct UUID;
    v_ar_acct UUID;
    v_lines JSONB := '[]'::jsonb;
BEGIN
    SELECT amount_satang, status, number INTO v_inv_amount, v_inv_status, v_inv_number
    FROM invoices WHERE id = p_invoice_id AND org_id = p_org_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice not found';
    END IF;

    INSERT INTO payments (
        id, org_id, invoice_id, amount_satang, paid_at, method, notes
    ) VALUES (
        p_id, p_org_id, p_invoice_id, p_amount_satang, COALESCE(p_paid_at, NOW()), p_method, p_notes
    );

    SELECT COALESCE(SUM(amount_satang), 0) INTO v_total_paid
    FROM payments WHERE invoice_id = p_invoice_id AND org_id = p_org_id;

    IF v_inv_status NOT IN ('draft', 'cancelled') THEN
        v_next_status := v_inv_status;
        IF v_inv_amount > 0 AND v_total_paid >= v_inv_amount THEN
            v_next_status := 'paid';
        ELSIF v_total_paid > 0 THEN
            v_next_status := 'partially_paid';
        END IF;

        IF v_next_status != v_inv_status THEN
            UPDATE invoices SET status = v_next_status WHERE id = p_invoice_id;
        END IF;
    END IF;

    IF p_method = 'cash' THEN v_cash_code := '1110'; ELSE v_cash_code := '1120'; END IF;
    SELECT id INTO v_cash_acct FROM accounts WHERE org_id = p_org_id AND code = v_cash_code;
    SELECT id INTO v_ar_acct FROM accounts WHERE org_id = p_org_id AND code = '1200';

    IF v_cash_acct IS NULL OR v_ar_acct IS NULL THEN
        RAISE EXCEPTION 'Required accounts (%, 1200) not found', v_cash_code;
    END IF;

    v_lines := v_lines || jsonb_build_object('account_id', v_cash_acct, 'debit', p_amount_satang, 'credit', 0);
    v_lines := v_lines || jsonb_build_object('account_id', v_ar_acct, 'debit', 0, 'credit', p_amount_satang);

    PERFORM create_automated_journal_entry(
        p_org_id, 'payment'::journal_entry_source, p_id, 'รับชำระเงินตามใบแจ้งหนี้ ' || v_inv_number, v_lines
    );

    RETURN p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
