-- ========================================================================================
-- ERP Purchase Request (PR) Step 2
-- ========================================================================================

CREATE TYPE pr_status AS ENUM ('draft', 'submitted', 'in_procurement', 'approved', 'rejected', 'cancelled');

CREATE TABLE purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  pr_number TEXT NOT NULL,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  reason TEXT,
  required_date DATE,
  estimated_budget NUMERIC(15, 2),
  attachment_url TEXT,
  status pr_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, pr_number)
);

CREATE TABLE purchase_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  pr_id UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit TEXT,
  specification TEXT,
  -- Snapshot for Inventory Check (Populated on Submit)
  on_hand_at_request INTEGER DEFAULT 0,
  allocated_at_request INTEGER DEFAULT 0,
  available_at_request INTEGER DEFAULT 0,
  suggested_stock_usage INTEGER DEFAULT 0,
  purchase_shortage INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Triggers for updated_at
CREATE TRIGGER set_updated_at_purchase_requests BEFORE UPDATE ON purchase_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_request_items ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read PRs in their org (Admins/Procurement need to see all, employees see their own via UI filtering, but DB level allow read for org)
CREATE POLICY purchase_requests_select ON purchase_requests FOR SELECT TO authenticated USING (private.is_org_member(org_id));
CREATE POLICY purchase_requests_insert ON purchase_requests FOR INSERT TO authenticated WITH CHECK (private.is_org_member(org_id) AND requested_by = auth.uid());
CREATE POLICY purchase_requests_update ON purchase_requests FOR UPDATE TO authenticated USING (private.is_org_member(org_id));
CREATE POLICY purchase_requests_delete ON purchase_requests FOR DELETE TO authenticated USING (private.is_org_member(org_id) AND requested_by = auth.uid() AND status = 'draft');

CREATE POLICY pr_items_select ON purchase_request_items FOR SELECT TO authenticated USING (private.is_org_member(org_id));
CREATE POLICY pr_items_insert ON purchase_request_items FOR INSERT TO authenticated WITH CHECK (private.is_org_member(org_id));
CREATE POLICY pr_items_update ON purchase_request_items FOR UPDATE TO authenticated USING (private.is_org_member(org_id));
CREATE POLICY pr_items_delete ON purchase_request_items FOR DELETE TO authenticated USING (private.is_org_member(org_id));

