-- ========================================================================================
-- ERP HR Phase 5 - OT Multiplier per Timesheet
-- ========================================================================================

-- Add ot_multiplier to timesheets table (default 1.5 as per standard Thai labor law)
ALTER TABLE timesheets
ADD COLUMN ot_multiplier NUMERIC DEFAULT 1.5;

