-- ========================================================================================
-- ERP Roadmap Phase 2 - Step 3: Mobile Face & GPS Check-in
-- ========================================================================================

ALTER TABLE timesheets
ADD COLUMN check_in_photo TEXT,
ADD COLUMN check_out_photo TEXT,
ADD COLUMN check_in_location JSONB,
ADD COLUMN check_out_location JSONB;
