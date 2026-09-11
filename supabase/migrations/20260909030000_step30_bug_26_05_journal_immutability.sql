-- ==============================================================================
-- PHASE 6: P0 JOURNAL IMMUTABILITY
-- ป้องกัน Posted/Cancelled Journal ไม่ให้ถูกแก้ไขหรือลบ
-- ==============================================================================

-- 1. Trigger Function สำหรับ journal_entries
CREATE OR REPLACE FUNCTION check_journal_entry_immutable()
RETURNS TRIGGER AS $$
BEGIN
    -- กรณี DELETE: ถ้าเป็น posted หรือ cancelled ให้ห้ามลบ
    IF TG_OP = 'DELETE' THEN
        IF OLD.status IN ('posted', 'cancelled') THEN
            RAISE EXCEPTION '%_JOURNAL_IMMUTABLE: สมุดรายวันที่ % แล้ว ไม่สามารถลบได้', UPPER(OLD.status::text), OLD.status
                USING ERRCODE = 'P0003';
        END IF;
        RETURN OLD;
    END IF;

    -- กรณี UPDATE
    IF TG_OP = 'UPDATE' THEN
        -- ถ้าพยายามแก้ไขข้อมูลในขณะที่สถานะเดิมเป็น posted หรือ cancelled 
        IF OLD.status IN ('posted', 'cancelled') THEN
            -- อนุญาตเฉพาะกรณีที่พยายามเปลี่ยนกลับมาเป็น draft? ไม่! เราจะ block หมด
            RAISE EXCEPTION '%_JOURNAL_IMMUTABLE: สมุดรายวันที่ % แล้ว ไม่สามารถแก้ไขได้', UPPER(OLD.status::text), OLD.status
                USING ERRCODE = 'P0003';
        END IF;

        -- ถ้าต้นทางเป็น draft 
        -- อนุญาตให้อัปเดตเป็น posted หรือ cancelled ได้ (Business logic ปกติ)
        -- หรือแก้ไขข้อมูลอื่นๆ ใน draft ได้

        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ผูก Trigger เข้ากับ journal_entries
DROP TRIGGER IF EXISTS trg_check_journal_entry_immutable_update ON journal_entries;
CREATE TRIGGER trg_check_journal_entry_immutable_update
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION check_journal_entry_immutable();

DROP TRIGGER IF EXISTS trg_check_journal_entry_immutable_delete ON journal_entries;
CREATE TRIGGER trg_check_journal_entry_immutable_delete
    BEFORE DELETE ON journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION check_journal_entry_immutable();

-- 2. Trigger Function สำหรับ journal_entry_lines
CREATE OR REPLACE FUNCTION check_journal_entry_lines_immutable()
RETURNS TRIGGER AS $$
DECLARE
    v_journal_status journal_entry_status;
    v_entry_id UUID;
BEGIN
    -- ดึง entry_id ขึ้นอยู่กับ Operation
    IF TG_OP = 'DELETE' THEN
        v_entry_id := OLD.entry_id;
    ELSE
        v_entry_id := NEW.entry_id;
    END IF;

    -- ค้นหาสถานะของ Header
    SELECT status INTO v_journal_status
    FROM journal_entries
    WHERE id = v_entry_id
    FOR SHARE; -- ป้องกัน Race Condition กรณี Header กำลังถูกเปลี่ยนสถานะ

    IF v_journal_status IN ('posted', 'cancelled') THEN
        IF TG_OP = 'INSERT' THEN
            RAISE EXCEPTION '%_JOURNAL_IMMUTABLE: สมุดรายวันที่ % แล้ว ไม่สามารถเพิ่มรายการบัญชีได้', UPPER(v_journal_status::text), v_journal_status
                USING ERRCODE = 'P0003';
        ELSIF TG_OP = 'UPDATE' THEN
            RAISE EXCEPTION '%_JOURNAL_IMMUTABLE: สมุดรายวันที่ % แล้ว ไม่สามารถแก้ไขรายการบัญชีได้', UPPER(v_journal_status::text), v_journal_status
                USING ERRCODE = 'P0003';
        ELSIF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION '%_JOURNAL_IMMUTABLE: สมุดรายวันที่ % แล้ว ไม่สามารถลบรายการบัญชีได้', UPPER(v_journal_status::text), v_journal_status
                USING ERRCODE = 'P0003';
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ผูก Trigger เข้ากับ journal_entry_lines
DROP TRIGGER IF EXISTS trg_check_journal_entry_lines_immutable_insert ON journal_entry_lines;
CREATE TRIGGER trg_check_journal_entry_lines_immutable_insert
    BEFORE INSERT ON journal_entry_lines
    FOR EACH ROW
    EXECUTE FUNCTION check_journal_entry_lines_immutable();

DROP TRIGGER IF EXISTS trg_check_journal_entry_lines_immutable_update ON journal_entry_lines;
CREATE TRIGGER trg_check_journal_entry_lines_immutable_update
    BEFORE UPDATE ON journal_entry_lines
    FOR EACH ROW
    EXECUTE FUNCTION check_journal_entry_lines_immutable();

DROP TRIGGER IF EXISTS trg_check_journal_entry_lines_immutable_delete ON journal_entry_lines;
CREATE TRIGGER trg_check_journal_entry_lines_immutable_delete
    BEFORE DELETE ON journal_entry_lines
    FOR EACH ROW
    EXECUTE FUNCTION check_journal_entry_lines_immutable();

-- 3. แก้ไข rpc `create_automated_journal_entry` เพื่อให้ทำงานกับ Immutable logic ได้
-- โดยต้องสร้าง Journal เป็น draft ก่อน แล้วเพิ่ม lines ค่อย update เป็น posted
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

  -- 1. Create Header AS DRAFT
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
    'draft' -- << CHANGED: Create as draft first to allow line insertion
  ) RETURNING id INTO v_entry_id;

  -- 2. Create Lines
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

  -- 3. Post the Journal
  UPDATE journal_entries SET status = 'posted' WHERE id = v_entry_id;

  RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
