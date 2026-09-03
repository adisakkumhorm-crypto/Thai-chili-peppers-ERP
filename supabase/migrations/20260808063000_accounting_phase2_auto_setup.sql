-- ==========================================
-- Phase 2.3: Setup Default Chart of Accounts
-- สร้างผังบัญชีเริ่มต้นให้กับองค์กร และสร้างอัตโนมัติเมื่อมีองค์กรใหม่
-- ==========================================

-- Function to setup default accounts for new org
CREATE OR REPLACE FUNCTION setup_default_accounts()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO accounts (org_id, code, name, type) VALUES 
    (NEW.id, '1110', 'Cash on Hand (เงินสด)', 'asset'),
    (NEW.id, '1120', 'Cash in Bank (เงินฝากธนาคาร)', 'asset'),
    (NEW.id, '1200', 'Accounts Receivable (ลูกหนี้การค้า)', 'asset'),
    (NEW.id, '2100', 'Accounts Payable (เจ้าหนี้การค้า)', 'liability'),
    (NEW.id, '2150', 'Output VAT (ภาษีขาย)', 'liability'),
    (NEW.id, '3100', 'Owner Equity (ทุน)', 'equity'),
    (NEW.id, '4100', 'Sales Revenue (รายได้จากการขาย)', 'revenue'),
    (NEW.id, '4200', 'Service Revenue (รายได้ค่าบริการ)', 'revenue'),
    (NEW.id, '5100', 'Cost of Goods Sold (ต้นทุนขาย)', 'expense'),
    (NEW.id, '5200', 'Salary & Wages (เงินเดือนพนักงาน)', 'expense'),
    (NEW.id, '5300', 'Marketing Expense (ค่าโฆษณา/การตลาด)', 'expense'),
    (NEW.id, '5400', 'Infrastructure & Software (ค่าเซิร์ฟเวอร์/ซอฟต์แวร์)', 'expense'),
    (NEW.id, '5500', 'Contractor Expense (ค่าจ้างบุคคลภายนอก)', 'expense'),
    (NEW.id, '5600', 'Input VAT (ภาษีซื้อ)', 'expense'),
    (NEW.id, '5900', 'Other Expenses (ค่าใช้จ่ายอื่นๆ)', 'expense')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add trigger for new orgs
DROP TRIGGER IF EXISTS on_org_created_setup_accounts ON organizations;
CREATE TRIGGER on_org_created_setup_accounts
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION setup_default_accounts();

-- Create default accounts for all existing orgs (for local dev data)
DO $$
DECLARE
  org RECORD;
BEGIN
  FOR org IN SELECT id FROM organizations LOOP
    INSERT INTO accounts (org_id, code, name, type) VALUES 
      (org.id, '1110', 'Cash on Hand (เงินสด)', 'asset'),
      (org.id, '1120', 'Cash in Bank (เงินฝากธนาคาร)', 'asset'),
      (org.id, '1200', 'Accounts Receivable (ลูกหนี้การค้า)', 'asset'),
      (org.id, '2100', 'Accounts Payable (เจ้าหนี้การค้า)', 'liability'),
      (org.id, '2150', 'Output VAT (ภาษีขาย)', 'liability'),
      (org.id, '3100', 'Owner Equity (ทุน)', 'equity'),
      (org.id, '4100', 'Sales Revenue (รายได้จากการขาย)', 'revenue'),
      (org.id, '4200', 'Service Revenue (รายได้ค่าบริการ)', 'revenue'),
      (org.id, '5100', 'Cost of Goods Sold (ต้นทุนขาย)', 'expense'),
      (org.id, '5200', 'Salary & Wages (เงินเดือนพนักงาน)', 'expense'),
      (org.id, '5300', 'Marketing Expense (ค่าโฆษณา/การตลาด)', 'expense'),
      (org.id, '5400', 'Infrastructure & Software (ค่าเซิร์ฟเวอร์/ซอฟต์แวร์)', 'expense'),
      (org.id, '5500', 'Contractor Expense (ค่าจ้างบุคคลภายนอก)', 'expense'),
      (org.id, '5600', 'Input VAT (ภาษีซื้อ)', 'expense'),
      (org.id, '5900', 'Other Expenses (ค่าใช้จ่ายอื่นๆ)', 'expense')
    ON CONFLICT DO NOTHING;
  END LOOP;
END
$$;
