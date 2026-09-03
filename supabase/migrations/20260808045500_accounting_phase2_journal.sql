-- ==========================================
-- Phase 2: Automated Journal & General Ledger
-- 1. Journal Entries (สมุดรายวัน)
-- 2. Journal Entry Lines (รายการบัญชี เดบิต/เครดิต)
-- ==========================================

-- ── Enums ───────────────────────────────────────────────────────────────────
CREATE TYPE journal_entry_source AS ENUM ('invoice', 'purchase_order', 'payment', 'manual');
CREATE TYPE journal_entry_status AS ENUM ('draft', 'posted', 'cancelled');

-- ── Table: journal_entries (สมุดรายวัน) ──────────────────────────────────────
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_number VARCHAR(50) NOT NULL, -- เช่น JV-202308-0001
  source journal_entry_source NOT NULL DEFAULT 'manual',
  reference_id UUID, -- ใช้เชื่อมกับ Invoice ID, PO ID หรือ Payment ID
  description TEXT NOT NULL,
  status journal_entry_status NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, entry_number)
);

CREATE INDEX ON journal_entries (org_id, entry_date);
CREATE INDEX ON journal_entries (org_id, source, reference_id);

-- ── Table: journal_entry_lines (รายการบัญชีเดบิต/เครดิต) ──────────────────────
CREATE TABLE journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  description TEXT,
  debit_amount_satang BIGINT NOT NULL DEFAULT 0,
  credit_amount_satang BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT amount_must_be_positive CHECK (debit_amount_satang >= 0 AND credit_amount_satang >= 0),
  CONSTRAINT cannot_be_both_debit_credit CHECK (
    (debit_amount_satang > 0 AND credit_amount_satang = 0) OR
    (debit_amount_satang = 0 AND credit_amount_satang > 0) OR
    (debit_amount_satang = 0 AND credit_amount_satang = 0)
  )
);

CREATE INDEX ON journal_entry_lines (org_id, entry_id);
CREATE INDEX ON journal_entry_lines (org_id, account_id);

-- ── Triggers ────────────────────────────────────────────────────────────────
CREATE TRIGGER set_updated_at_journal_entries BEFORE UPDATE ON journal_entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_journal_entry_lines BEFORE UPDATE ON journal_entry_lines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS Policies ────────────────────────────────────────────────────────────
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines FORCE ROW LEVEL SECURITY;

-- Org-scoped CRUD for journal_entries
CREATE POLICY journal_entries_rw ON journal_entries
  FOR ALL TO authenticated
  USING (private.is_org_member(org_id)) WITH CHECK (private.is_org_member(org_id));

-- Org-scoped CRUD for journal_entry_lines
CREATE POLICY journal_entry_lines_rw ON journal_entry_lines
  FOR ALL TO authenticated
  USING (private.is_org_member(org_id)) WITH CHECK (private.is_org_member(org_id));
