-- ========================================================================================
-- ERP Roadmap Phase 2 - Step 2: Leave & Shift Management (ขาด ลา มา สาย)
-- ========================================================================================

CREATE TYPE leave_type AS ENUM ('sick', 'personal', 'vacation');
CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  year INTEGER NOT NULL DEFAULT extract(year from current_date),
  
  sick_total INTEGER DEFAULT 30,
  sick_used INTEGER DEFAULT 0,
  
  personal_total INTEGER DEFAULT 6,
  personal_used INTEGER DEFAULT 0,
  
  vacation_total INTEGER DEFAULT 6,
  vacation_used INTEGER DEFAULT 0,
  
  UNIQUE(employee_id, year)
);

CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  
  type leave_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  
  status leave_status DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- เพิ่มคอลัมน์เก็บข้อมูลการ "มาสาย" เข้าตารางเวลาทำงาน
ALTER TABLE timesheets
ADD COLUMN is_late BOOLEAN DEFAULT false,
ADD COLUMN late_minutes INTEGER DEFAULT 0;

-- เปิดใช้งาน RLS
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY leave_balances_rw ON leave_balances FOR ALL TO authenticated USING (private.is_org_member(org_id)) WITH CHECK (private.is_org_member(org_id));
CREATE POLICY leave_requests_rw ON leave_requests FOR ALL TO authenticated USING (private.is_org_member(org_id)) WITH CHECK (private.is_org_member(org_id));
