-- ========================================================================================
-- ERP HR Phase 4 - Payroll Settings (OT & Late Penalty)
-- ========================================================================================

-- Add OT & Late penalty settings to organizations table
ALTER TABLE organizations
ADD COLUMN ot_rate_per_hour NUMERIC DEFAULT 0,
ADD COLUMN late_penalty_per_minute NUMERIC DEFAULT 0;

