-- Migration: Add Trigger to protect posted invoices (BUG-26-02)

CREATE OR REPLACE FUNCTION protect_posted_invoice_financials()
RETURNS TRIGGER AS $$
DECLARE
    v_journal_status journal_entry_status;
BEGIN
    -- Check if there's a posted journal for this invoice
    SELECT status INTO v_journal_status
    FROM journal_entries
    WHERE source = 'invoice' AND reference_id = NEW.id
    LIMIT 1;

    IF v_journal_status = 'posted' THEN
        -- Block changes to financial fields
        IF OLD.subtotal_satang IS DISTINCT FROM NEW.subtotal_satang OR
           OLD.vat_amount_satang IS DISTINCT FROM NEW.vat_amount_satang OR
           OLD.wht_amount_satang IS DISTINCT FROM NEW.wht_amount_satang OR
           OLD.amount_satang IS DISTINCT FROM NEW.amount_satang OR
           OLD.vat_rate_id IS DISTINCT FROM NEW.vat_rate_id OR
           OLD.wht_rate_id IS DISTINCT FROM NEW.wht_rate_id THEN
            
            RAISE EXCEPTION 'Invoice นี้ถูกบันทึกบัญชีแล้ว ไม่สามารถแก้ไขข้อมูลทางการเงินได้ กรุณายกเลิกเอกสารและสร้าง Invoice ใหม่'
            USING ERRCODE = 'P0002';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_protect_posted_invoice_financials ON invoices;
CREATE TRIGGER tr_protect_posted_invoice_financials
BEFORE UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION protect_posted_invoice_financials();
