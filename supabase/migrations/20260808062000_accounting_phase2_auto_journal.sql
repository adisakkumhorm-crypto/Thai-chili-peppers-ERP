-- ==========================================
-- Phase 2.2: Automated Journal Functions
-- ฟังก์ชันสำหรับลงบัญชีอัตโนมัติเมื่อเกิดรายการต่างๆ
-- ==========================================

-- ฟังก์ชันสำหรับบันทึกสมุดรายวันอัตโนมัติ
CREATE OR REPLACE FUNCTION create_automated_journal_entry(
  p_org_id UUID,
  p_source journal_entry_source,
  p_reference_id UUID,
  p_description TEXT,
  p_lines JSONB -- Array of { account_id: UUID, debit: satang, credit: satang }
) RETURNS UUID AS $$
DECLARE
  v_entry_id UUID;
  v_entry_number VARCHAR;
  v_line JSONB;
  v_total_debit BIGINT := 0;
  v_total_credit BIGINT := 0;
  v_year VARCHAR;
  v_month VARCHAR;
  v_seq INT;
BEGIN
  -- Validate lines
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_total_debit := v_total_debit + COALESCE((v_line->>'debit')::BIGINT, 0);
    v_total_credit := v_total_credit + COALESCE((v_line->>'credit')::BIGINT, 0);
  END LOOP;

  IF v_total_debit != v_total_credit THEN
    RAISE EXCEPTION 'Debit (%) must equal Credit (%)', v_total_debit, v_total_credit;
  END IF;

  IF v_total_debit = 0 THEN
    RAISE EXCEPTION 'Journal entry must have a non-zero amount';
  END IF;

  -- Generate Entry Number (e.g., JV-202308-0001)
  v_year := to_char(CURRENT_DATE, 'YYYY');
  v_month := to_char(CURRENT_DATE, 'MM');
  
  -- Simple sequence generator for the month
  SELECT COUNT(*) + 1 INTO v_seq 
  FROM journal_entries 
  WHERE org_id = p_org_id 
    AND to_char(entry_date, 'YYYYMM') = v_year || v_month;
    
  v_entry_number := 'JV-' || v_year || v_month || '-' || LPAD(v_seq::TEXT, 4, '0');

  -- Create Header
  INSERT INTO journal_entries (
    org_id, 
    entry_date, 
    entry_number, 
    source, 
    reference_id, 
    description, 
    status
  ) VALUES (
    p_org_id,
    CURRENT_DATE,
    v_entry_number,
    p_source,
    p_reference_id,
    p_description,
    'posted' -- Auto entries are posted immediately
  ) RETURNING id INTO v_entry_id;

  -- Create Lines
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    INSERT INTO journal_entry_lines (
      org_id,
      entry_id,
      account_id,
      debit_amount_satang,
      credit_amount_satang
    ) VALUES (
      p_org_id,
      v_entry_id,
      (v_line->>'account_id')::UUID,
      COALESCE((v_line->>'debit')::BIGINT, 0),
      COALESCE((v_line->>'credit')::BIGINT, 0)
    );
  END LOOP;

  RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
