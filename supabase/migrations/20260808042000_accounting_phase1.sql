-- ==========================================
-- Phase 1: Accounting Foundation & Setup
-- 1. Chart of Accounts (ผังบัญชี)
-- 2. Tax Settings (ตั้งค่าภาษี)
-- ==========================================

-- ── Enums ───────────────────────────────────────────────────────────────────
CREATE TYPE account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');
CREATE TYPE tax_type AS ENUM ('vat', 'wht');

-- ── Table: accounts (ผังบัญชี) ────────────────────────────────────────────────
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL, -- รหัสบัญชี เช่น 1001, 2001
  name VARCHAR(255) NOT NULL, -- ชื่อบัญชี เช่น เงินสด, เจ้าหนี้การค้า
  type account_type NOT NULL, -- หมวดบัญชี
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, code)
);

CREATE INDEX ON accounts (org_id, type);
CREATE INDEX ON accounts (org_id, code);

-- ── Table: tax_rates (อัตราภาษี) ───────────────────────────────────────────────
CREATE TABLE tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- เช่น 'VAT 7%', 'WHT 3%'
  rate NUMERIC(5,2) NOT NULL, -- อัตราภาษี เช่น 7.00, 3.00
  type tax_type NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, name, type)
);

CREATE INDEX ON tax_rates (org_id, type);

-- ── Triggers ────────────────────────────────────────────────────────────────
CREATE TRIGGER set_updated_at_accounts BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_tax_rates BEFORE UPDATE ON tax_rates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS Policies ────────────────────────────────────────────────────────────
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rates FORCE ROW LEVEL SECURITY;

-- Org-scoped CRUD for accounts
CREATE POLICY accounts_rw ON accounts
  FOR ALL TO authenticated
  USING (private.is_org_member(org_id)) WITH CHECK (private.is_org_member(org_id));

-- Org-scoped CRUD for tax_rates
CREATE POLICY tax_rates_rw ON tax_rates
  FOR ALL TO authenticated
  USING (private.is_org_member(org_id)) WITH CHECK (private.is_org_member(org_id));
