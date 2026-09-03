-- ========================================================================================
-- Add face_descriptor to employees for AI Face Scan Check-in
-- ========================================================================================

ALTER TABLE employees ADD COLUMN IF NOT EXISTS face_descriptor JSONB;
