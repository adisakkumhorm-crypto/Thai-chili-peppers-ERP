-- MOD-004
-- Harden public.setup_default_accounts() trigger function.
--
-- Scope:
--   * Preserve trigger signature and 15-account seed semantics.
--   * Lock SECURITY DEFINER search_path to empty.
--   * Schema-qualify the accounts write target.
--   * Remove direct client EXECUTE privilege.
--   * Do not alter the organizations trigger binding.

CREATE OR REPLACE FUNCTION public.setup_default_accounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.accounts (org_id, code, name, type) VALUES
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
$function$;

ALTER FUNCTION public.setup_default_accounts()
OWNER TO postgres;

REVOKE ALL
ON FUNCTION public.setup_default_accounts()
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.setup_default_accounts()
FROM anon;

REVOKE ALL
ON FUNCTION public.setup_default_accounts()
FROM authenticated;

REVOKE ALL
ON FUNCTION public.setup_default_accounts()
FROM service_role;
