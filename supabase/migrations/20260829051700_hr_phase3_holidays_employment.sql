-- ========================================================================================
-- ERP HR Phase 3 - Holidays, Employment Types & Unpaid Leave
-- ========================================================================================

-- 1. Create Employment Type Enum & Add to Employees
CREATE TYPE employment_type AS ENUM ('monthly', 'daily', 'part_time');

ALTER TABLE employees 
ADD COLUMN employment_type employment_type DEFAULT 'monthly';

-- 2. Add is_unpaid flag to leave_requests
ALTER TABLE leave_requests
ADD COLUMN is_unpaid BOOLEAN DEFAULT false;

-- 3. Create Public Holidays Table
CREATE TABLE public_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, date)
);

-- Enable RLS for public_holidays
ALTER TABLE public_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY public_holidays_rw ON public_holidays 
FOR ALL TO authenticated 
USING (private.is_org_member(org_id)) 
WITH CHECK (private.is_org_member(org_id));

-- 4. Add working_days setting to organizations
-- เก็บวันทำงานปกติเป็น Array ของตัวเลข (0=อาทิตย์, 1=จันทร์, ..., 6=เสาร์)
-- ค่าเริ่มต้นคือ จันทร์-ศุกร์ (1, 2, 3, 4, 5)
ALTER TABLE organizations
ADD COLUMN working_days INTEGER[] DEFAULT '{1,2,3,4,5}';
