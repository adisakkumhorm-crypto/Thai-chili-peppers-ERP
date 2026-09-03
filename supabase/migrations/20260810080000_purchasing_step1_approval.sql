-- ========================================================================================
-- ERP Roadmap Step 1: Purchasing & Approval Workflow (อุดรอยรั่วต้นทุน)
-- ========================================================================================

-- 1. เพิ่มสถานะ 'pending_approval' (รออนุมัติ) ให้กับใบสั่งซื้อ (PO)
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'pending_approval' AFTER 'draft';

-- 2. เพิ่มช่องเก็บประวัติคนขอซื้อ (Requested By) และคนอนุมัติ (Approved By)
ALTER TABLE purchase_orders 
  ADD COLUMN requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN approved_at TIMESTAMPTZ;

-- 3. ผูกรายการสินค้า (PO Items) เข้ากับ Project เพื่อแยกต้นทุน
ALTER TABLE purchase_order_items 
  ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- 4. สร้างตารางสิทธิ์การอนุมัติวงเงิน (Approval Limits)
CREATE TABLE approval_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_name TEXT, -- เช่น 'Foreman' (ขอได้อย่างเดียว), 'Manager' (อนุมัติได้ระดับนึง)
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- ระบุตัวบุคคล (เช่น พี่โอ อนุมัติได้ไม่จำกัด)
  max_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00, -- วงเงินสูงสุดที่อนุมัติได้
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- ต้องระบุอย่างน้อย 1 อย่าง: ชื่อตำแหน่ง หรือ ชื่อบุคคล
  CONSTRAINT chk_approval_target CHECK (role_name IS NOT NULL OR user_id IS NOT NULL)
);

-- เปิดใช้งานความปลอดภัย (Row Level Security) สำหรับตารางใหม่
ALTER TABLE approval_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY approval_limits_rw ON approval_limits
  FOR ALL TO authenticated
  USING (private.is_org_member(org_id)) WITH CHECK (private.is_org_member(org_id));
