-- ========================================================================================
-- ERP Roadmap Step 3: E-Commerce & Order Management (บุกตลาดออนไลน์)
-- ========================================================================================

-- 1. สร้างตารางช่องทางการขาย (Sales Channels)
CREATE TABLE sales_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,         -- เช่น 'TikTok Shop', 'Shopee', 'Facebook Live'
  platform TEXT,              -- 'tiktok', 'shopee', 'lazada', 'facebook', 'other'
  fee_percentage NUMERIC(5,2) DEFAULT 0.00, -- หักเปอร์เซ็นต์ GP ของแพลตฟอร์ม
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. ประเภทสถานะออเดอร์และการชำระเงิน
CREATE TYPE sales_order_status AS ENUM ('pending', 'paid', 'packing', 'shipped', 'delivered', 'cancelled');
CREATE TYPE payment_method_type AS ENUM ('bank_transfer', 'cod', 'credit_card', 'platform_wallet');

-- 3. สร้างตารางใบสั่งขาย (Sales Orders)
CREATE TABLE sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  channel_id UUID REFERENCES sales_channels(id) ON DELETE SET NULL,
  
  -- ข้อมูลลูกค้า B2C
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  shipping_address TEXT,
  
  -- ข้อมูลเงินและการจัดส่ง
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  payment_method payment_method_type DEFAULT 'bank_transfer',
  status sales_order_status DEFAULT 'pending',
  tracking_number TEXT,
  courier TEXT,               -- เช่น 'Kerry', 'Flash', 'J&T'
  notes TEXT,
  
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. สร้างตารางรายการสินค้าในออเดอร์ (Sales Order Items)
CREATE TABLE sales_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- เปิด RLS
ALTER TABLE sales_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY sales_channels_rw ON sales_channels
  FOR ALL TO authenticated USING (private.is_org_member(org_id)) WITH CHECK (private.is_org_member(org_id));

CREATE POLICY sales_orders_rw ON sales_orders
  FOR ALL TO authenticated USING (private.is_org_member(org_id)) WITH CHECK (private.is_org_member(org_id));

CREATE POLICY sales_order_items_rw ON sales_order_items
  FOR ALL TO authenticated USING (private.is_org_member(org_id)) WITH CHECK (private.is_org_member(org_id));

