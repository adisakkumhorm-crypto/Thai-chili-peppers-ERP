-- ========================================================================================
-- ERP Purchase Request (PR) Step 5 - Quotations
-- ========================================================================================

CREATE TYPE pr_quotation_status AS ENUM ('draft', 'received', 'selected', 'rejected', 'approved');

CREATE TABLE pr_quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  pr_id UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  quotation_number TEXT,
  quotation_date DATE,
  price NUMERIC(15,2) DEFAULT 0,
  quantity INTEGER DEFAULT 1,
  unit TEXT,
  lead_time TEXT,
  payment_term TEXT,
  valid_until DATE,
  remark TEXT,
  attachment_url TEXT,
  status pr_quotation_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Triggers for updated_at
CREATE TRIGGER set_updated_at_pr_quotations BEFORE UPDATE ON pr_quotations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE pr_quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY pr_quotations_select ON pr_quotations FOR SELECT TO authenticated USING (private.is_org_member(org_id));
CREATE POLICY pr_quotations_insert ON pr_quotations FOR INSERT TO authenticated WITH CHECK (private.is_org_member(org_id));
CREATE POLICY pr_quotations_update ON pr_quotations FOR UPDATE TO authenticated USING (private.is_org_member(org_id));
CREATE POLICY pr_quotations_delete ON pr_quotations FOR DELETE TO authenticated USING (private.is_org_member(org_id));

