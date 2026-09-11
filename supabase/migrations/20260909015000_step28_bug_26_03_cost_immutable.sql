-- BUG-26-03: POSTED COST DELETE PROTECTION

-- 1. สร้าง Trigger Function สำหรับเช็คก่อน DELETE Cost
CREATE OR REPLACE FUNCTION check_posted_cost_immutable()
RETURNS TRIGGER AS $$
DECLARE
    v_is_posted BOOLEAN;
BEGIN
    -- เช็คว่า Cost นี้มีการผูกกับ Journal Entry ที่ status = 'posted' หรือไม่
    -- โดย Journal Entry ของ Cost จะใช้ source = 'manual' และ reference_id = costs.id
    SELECT EXISTS (
        SELECT 1 
        FROM journal_entries 
        WHERE source = 'manual' 
          AND reference_id = OLD.id 
          AND status = 'posted'
    ) INTO v_is_posted;

    IF v_is_posted THEN
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'POSTED_COST_IMMUTABLE: Cost นี้ถูกบันทึกบัญชีแล้ว ไม่สามารถลบได้ กรุณาใช้กระบวนการ Cancel/Reverse ที่รองรับ' 
                USING ERRCODE = 'P0002';
        ELSIF TG_OP = 'UPDATE' THEN
            RAISE EXCEPTION 'POSTED_COST_IMMUTABLE: Cost นี้ถูกบันทึกบัญชีแล้ว ไม่สามารถแก้ไขได้ กรุณาใช้กระบวนการ Cancel/Reverse ที่รองรับ' 
                USING ERRCODE = 'P0002';
        END IF;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 2. สร้าง Trigger ผูกกับตาราง costs
DROP TRIGGER IF EXISTS trg_check_posted_cost_delete ON costs;
CREATE TRIGGER trg_check_posted_cost_delete
    BEFORE DELETE ON costs
    FOR EACH ROW
    EXECUTE FUNCTION check_posted_cost_immutable();

DROP TRIGGER IF EXISTS trg_check_posted_cost_update ON costs;
CREATE TRIGGER trg_check_posted_cost_update
    BEFORE UPDATE ON costs
    FOR EACH ROW
    EXECUTE FUNCTION check_posted_cost_immutable();
