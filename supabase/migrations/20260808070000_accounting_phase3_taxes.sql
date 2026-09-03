-- ==========================================
-- Phase 3.1: Add Tax Columns to Invoices and Costs
-- ==========================================

ALTER TABLE invoices
ADD COLUMN subtotal_satang BIGINT,
ADD COLUMN vat_amount_satang BIGINT NOT NULL DEFAULT 0,
ADD COLUMN wht_amount_satang BIGINT NOT NULL DEFAULT 0,
ADD COLUMN vat_rate_id UUID REFERENCES tax_rates(id) ON DELETE SET NULL,
ADD COLUMN wht_rate_id UUID REFERENCES tax_rates(id) ON DELETE SET NULL;

-- Backfill subtotal_satang with existing amount
UPDATE invoices SET subtotal_satang = amount_satang;
ALTER TABLE invoices ALTER COLUMN subtotal_satang SET NOT NULL;
ALTER TABLE invoices ALTER COLUMN subtotal_satang SET DEFAULT 0;

ALTER TABLE costs
ADD COLUMN subtotal_satang BIGINT,
ADD COLUMN vat_amount_satang BIGINT NOT NULL DEFAULT 0,
ADD COLUMN wht_amount_satang BIGINT NOT NULL DEFAULT 0,
ADD COLUMN vat_rate_id UUID REFERENCES tax_rates(id) ON DELETE SET NULL,
ADD COLUMN wht_rate_id UUID REFERENCES tax_rates(id) ON DELETE SET NULL;

-- Backfill subtotal_satang with existing amount
UPDATE costs SET subtotal_satang = amount_satang;
ALTER TABLE costs ALTER COLUMN subtotal_satang SET NOT NULL;
ALTER TABLE costs ALTER COLUMN subtotal_satang SET DEFAULT 0;
