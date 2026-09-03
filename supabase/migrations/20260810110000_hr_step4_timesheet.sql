-- ========================================================================================
-- ERP Roadmap Step 4: HR & Timesheet (บริหารบุคคลและบันทึกเวลาเข้างาน)
-- ========================================================================================

CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_code TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  nickname TEXT,
  position TEXT,
  department TEXT,
  daily_wage NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  qr_code TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  regular_hours NUMERIC(5,2) DEFAULT 0.00,
  ot_hours NUMERIC(5,2) DEFAULT 0.00,
  wage_amount NUMERIC(10,2) DEFAULT 0.00,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY employees_rw ON employees FOR ALL TO authenticated USING (private.is_org_member(org_id)) WITH CHECK (private.is_org_member(org_id));
CREATE POLICY timesheets_rw ON timesheets FOR ALL TO authenticated USING (private.is_org_member(org_id)) WITH CHECK (private.is_org_member(org_id));
