-- ========================================================================================
-- ERP Roadmap Step 2: Multi-Warehouse & QR Code Inventory (คลังสินค้าอัจฉริยะ)
-- ========================================================================================

-- 1. สร้างตารางคลังสินค้า (Locations / Warehouses)
CREATE TABLE inventory_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,          -- เช่น 'คลังวัตถุดิบ (Raw Material)', 'คลังออนไลน์ (Finished Goods)'
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. สร้างตารางเก็บสต็อกแยกตามคลัง (Inventory Balances)
-- (แทนที่จะเก็บ stock_quantity รวมๆ ไว้ใน products อย่างเดียว)
CREATE TABLE inventory_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES inventory_locations(id) ON DELETE CASCADE,
  on_hand_quantity INTEGER NOT NULL DEFAULT 0,    -- ของที่มีจริงในคลัง (Physical)
  allocated_quantity INTEGER NOT NULL DEFAULT 0,  -- ของที่ถูกจองไว้แล้ว (รอเบิก/รอแพ็คส่ง)
  -- Available Qty = on_hand_quantity - allocated_quantity
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, location_id)
);

-- 3. อัปเดตตาราง Products (เพิ่ม Min/Max Stock และ QR Code/Barcode)
ALTER TABLE products 
  ADD COLUMN min_stock INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN max_stock INTEGER,
  ADD COLUMN barcode TEXT UNIQUE; -- รองรับการยิงสแกนบาร์โค้ดสากล

-- 4. สร้างตารางบันทึกความเคลื่อนไหว (Inventory Transactions) สำหรับ Track ด้วย QR Code
CREATE TYPE inventory_transaction_type AS ENUM ('receive', 'issue', 'transfer', 'adjust');

CREATE TABLE inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES inventory_locations(id) ON DELETE CASCADE,
  transaction_type inventory_transaction_type NOT NULL,
  quantity INTEGER NOT NULL,          -- บวก (รับเข้า) หรือ ลบ (จ่ายออก)
  reference_no TEXT,                  -- อ้างอิงเช่น 'PO-001', 'PRJ-PTT'
  batch_qr_code TEXT,                 -- รหัส QR Code ประจำล็อตที่ Generate ตอนรับของ
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- เปิด RLS
ALTER TABLE inventory_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_locations_rw ON inventory_locations
  FOR ALL TO authenticated USING (private.is_org_member(org_id)) WITH CHECK (private.is_org_member(org_id));

CREATE POLICY inventory_balances_rw ON inventory_balances
  FOR ALL TO authenticated USING (private.is_org_member(org_id)) WITH CHECK (private.is_org_member(org_id));

CREATE POLICY inventory_transactions_rw ON inventory_transactions
  FOR ALL TO authenticated USING (private.is_org_member(org_id)) WITH CHECK (private.is_org_member(org_id));

