-- ========================================================================================
-- ERP Purchase Request (PR) Step 8 - PO Creation
-- ========================================================================================

ALTER TYPE pr_status ADD VALUE IF NOT EXISTS 'po_created' AFTER 'approved';

ALTER TABLE purchase_requests 
ADD COLUMN po_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
ADD COLUMN po_created_at TIMESTAMPTZ,
ADD COLUMN po_created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- เพิ่ม pr_id ไปที่ purchase_orders เพื่ออ้างอิงกลับ (ถ้ายังไม่มี)
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'purchase_orders' AND column_name = 'pr_id'
  ) THEN 
    ALTER TABLE purchase_orders ADD COLUMN pr_id UUID REFERENCES purchase_requests(id) ON DELETE SET NULL;
  END IF; 
END $$;
