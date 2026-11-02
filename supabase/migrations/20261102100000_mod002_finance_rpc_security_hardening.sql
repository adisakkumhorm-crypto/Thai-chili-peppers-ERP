-- MOD-002
-- Finance privileged RPC security hardening.
--
-- Scope:
--   * create_automated_journal_entry
--   * rpc_create_cost
--   * rpc_create_invoice
--   * rpc_record_payment
--
-- Preserve signatures, defaults and atomic accounting behavior.
-- Keep SECURITY DEFINER, but add explicit tenant authorization,
-- foreign-reference tenant validation, fixed search_path and restricted ACL.

CREATE OR REPLACE FUNCTION public.create_automated_journal_entry(
  p_org_id uuid,
  p_source public.journal_entry_source,
  p_reference_id uuid,
  p_description text,
  p_lines jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_entry_id UUID;
  v_entry_number VARCHAR;
  v_line JSONB;
  v_total_debit BIGINT := 0;
  v_total_credit BIGINT := 0;
  v_year VARCHAR;
  v_month VARCHAR;
  v_seq INT;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND NOT private.is_org_member(p_org_id)
  THEN
    RAISE EXCEPTION 'FINANCE_ORG_FORBIDDEN'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_lines) AS x(line)
    LEFT JOIN public.accounts a
      ON a.id = NULLIF(x.line->>'account_id', '')::uuid
     AND a.org_id = p_org_id
    WHERE a.id IS NULL
  ) THEN
    RAISE EXCEPTION 'FINANCE_ACCOUNT_ORG_MISMATCH'
      USING ERRCODE = '42501';
  END IF;

  FOR v_line IN
    SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_total_debit :=
      v_total_debit +
      COALESCE((v_line->>'debit')::BIGINT, 0);

    v_total_credit :=
      v_total_credit +
      COALESCE((v_line->>'credit')::BIGINT, 0);
  END LOOP;

  IF v_total_debit != v_total_credit THEN
    RAISE EXCEPTION
      'Debit (%) must equal Credit (%)',
      v_total_debit,
      v_total_credit;
  END IF;

  IF v_total_debit = 0 THEN
    RAISE EXCEPTION
      'Journal entry must have a non-zero amount';
  END IF;

  v_year := to_char(CURRENT_DATE, 'YYYY');
  v_month := to_char(CURRENT_DATE, 'MM');

  SELECT COUNT(*) + 1
  INTO v_seq
  FROM public.journal_entries
  WHERE org_id = p_org_id
    AND to_char(entry_date, 'YYYYMM')
        = v_year || v_month;

  v_entry_number :=
    'JV-' || v_year || v_month || '-' ||
    LPAD(v_seq::TEXT, 4, '0');

  INSERT INTO public.journal_entries (
    org_id,
    entry_date,
    entry_number,
    source,
    reference_id,
    description,
    status
  )
  VALUES (
    p_org_id,
    CURRENT_DATE,
    v_entry_number,
    p_source,
    p_reference_id,
    p_description,
    'draft'
  )
  RETURNING id INTO v_entry_id;

  FOR v_line IN
    SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    INSERT INTO public.journal_entry_lines (
      org_id,
      entry_id,
      account_id,
      debit_amount_satang,
      credit_amount_satang
    )
    VALUES (
      p_org_id,
      v_entry_id,
      (v_line->>'account_id')::UUID,
      COALESCE((v_line->>'debit')::BIGINT, 0),
      COALESCE((v_line->>'credit')::BIGINT, 0)
    );
  END LOOP;

  UPDATE public.journal_entries
  SET status = 'posted'
  WHERE id = v_entry_id;

  RETURN v_entry_id;
END;
$function$;


CREATE OR REPLACE FUNCTION public.rpc_create_cost(
  p_id uuid,
  p_org_id uuid,
  p_category public.cost_category,
  p_subtotal_satang bigint,
  p_vat_amount_satang bigint,
  p_wht_amount_satang bigint,
  p_amount_satang bigint,
  p_vat_rate_id uuid DEFAULT NULL::uuid,
  p_wht_rate_id uuid DEFAULT NULL::uuid,
  p_incurred_on date DEFAULT NULL::date,
  p_vendor text DEFAULT NULL::text,
  p_project_id uuid DEFAULT NULL::uuid,
  p_notes text DEFAULT NULL::text,
  p_po_id uuid DEFAULT NULL::uuid,
  p_supplier_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_exp_code TEXT;
  v_exp_acct UUID;
  v_bank_acct UUID;
  v_in_vat_acct UUID;
  v_wht_pay_acct UUID;
  v_lines JSONB := '[]'::jsonb;
  v_desc TEXT;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND NOT private.is_org_member(p_org_id)
  THEN
    RAISE EXCEPTION 'FINANCE_ORG_FORBIDDEN'
      USING ERRCODE = '42501';
  END IF;

  IF p_project_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.projects
       WHERE id = p_project_id
         AND org_id = p_org_id
     )
  THEN
    RAISE EXCEPTION 'FINANCE_PROJECT_ORG_MISMATCH'
      USING ERRCODE = '42501';
  END IF;

  IF p_supplier_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.suppliers
       WHERE id = p_supplier_id
         AND org_id = p_org_id
     )
  THEN
    RAISE EXCEPTION 'FINANCE_SUPPLIER_ORG_MISMATCH'
      USING ERRCODE = '42501';
  END IF;

  IF p_po_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.purchase_orders
       WHERE id = p_po_id
         AND org_id = p_org_id
     )
  THEN
    RAISE EXCEPTION 'FINANCE_PO_ORG_MISMATCH'
      USING ERRCODE = '42501';
  END IF;

  IF p_vat_rate_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.tax_rates
       WHERE id = p_vat_rate_id
         AND org_id = p_org_id
     )
  THEN
    RAISE EXCEPTION 'FINANCE_VAT_RATE_ORG_MISMATCH'
      USING ERRCODE = '42501';
  END IF;

  IF p_wht_rate_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.tax_rates
       WHERE id = p_wht_rate_id
         AND org_id = p_org_id
     )
  THEN
    RAISE EXCEPTION 'FINANCE_WHT_RATE_ORG_MISMATCH'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.costs (
    id,
    org_id,
    category,
    subtotal_satang,
    vat_amount_satang,
    wht_amount_satang,
    vat_rate_id,
    wht_rate_id,
    amount_satang,
    incurred_on,
    vendor,
    project_id,
    notes,
    po_id,
    supplier_id
  )
  VALUES (
    p_id,
    p_org_id,
    p_category,
    p_subtotal_satang,
    p_vat_amount_satang,
    p_wht_amount_satang,
    p_vat_rate_id,
    p_wht_rate_id,
    p_amount_satang,
    COALESCE(p_incurred_on, CURRENT_DATE),
    p_vendor,
    p_project_id,
    p_notes,
    p_po_id,
    p_supplier_id
  );

  IF p_category IN ('software', 'infra') THEN
    v_exp_code := '5400';
  ELSIF p_category = 'contractor' THEN
    v_exp_code := '5500';
  ELSIF p_category = 'marketing' THEN
    v_exp_code := '5300';
  ELSIF p_category = 'salary' THEN
    v_exp_code := '5200';
  ELSE
    v_exp_code := '5900';
  END IF;

  SELECT id INTO v_exp_acct
  FROM public.accounts
  WHERE org_id = p_org_id
    AND code = v_exp_code;

  SELECT id INTO v_bank_acct
  FROM public.accounts
  WHERE org_id = p_org_id
    AND code = '1120';

  IF v_exp_acct IS NULL OR v_bank_acct IS NULL THEN
    RAISE EXCEPTION
      'Required accounts (%, 1120) not found for org %',
      v_exp_code,
      p_org_id;
  END IF;

  v_lines :=
    v_lines || jsonb_build_object(
      'account_id', v_exp_acct,
      'debit', p_subtotal_satang,
      'credit', 0
    );

  v_lines :=
    v_lines || jsonb_build_object(
      'account_id', v_bank_acct,
      'debit', 0,
      'credit', p_amount_satang
    );

  IF p_vat_amount_satang > 0 THEN
    SELECT id INTO v_in_vat_acct
    FROM public.accounts
    WHERE org_id = p_org_id
      AND code = '1155';

    IF v_in_vat_acct IS NOT NULL THEN
      v_lines :=
        v_lines || jsonb_build_object(
          'account_id', v_in_vat_acct,
          'debit', p_vat_amount_satang,
          'credit', 0
        );
    END IF;
  END IF;

  IF p_wht_amount_satang > 0 THEN
    SELECT id INTO v_wht_pay_acct
    FROM public.accounts
    WHERE org_id = p_org_id
      AND code = '2130';

    IF v_wht_pay_acct IS NOT NULL THEN
      v_lines :=
        v_lines || jsonb_build_object(
          'account_id', v_wht_pay_acct,
          'debit', 0,
          'credit', p_wht_amount_satang
        );
    END IF;
  END IF;

  IF p_vendor IS NOT NULL AND p_vendor <> '' THEN
    v_desc :=
      'บันทึกค่าใช้จ่าย ' ||
      p_category ||
      ' - ' ||
      p_vendor;
  ELSE
    v_desc :=
      'บันทึกค่าใช้จ่าย ' ||
      p_category;
  END IF;

  PERFORM public.create_automated_journal_entry(
    p_org_id,
    'manual'::public.journal_entry_source,
    p_id,
    v_desc,
    v_lines
  );

  RETURN p_id;
END;
$function$;


CREATE OR REPLACE FUNCTION public.rpc_create_invoice(
  p_id uuid,
  p_org_id uuid,
  p_client_id uuid,
  p_number text,
  p_status public.invoice_status,
  p_subtotal_satang bigint,
  p_vat_amount_satang bigint,
  p_wht_amount_satang bigint,
  p_amount_satang bigint,
  p_is_recurring boolean,
  p_project_id uuid DEFAULT NULL::uuid,
  p_issue_date date DEFAULT NULL::date,
  p_due_date date DEFAULT NULL::date,
  p_vat_rate_id uuid DEFAULT NULL::uuid,
  p_wht_rate_id uuid DEFAULT NULL::uuid,
  p_recurring_interval public.recurring_interval DEFAULT NULL::public.recurring_interval,
  p_notes text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_ar_acct UUID;
  v_rev_acct UUID;
  v_out_vat_acct UUID;
  v_wht_rec_acct UUID;
  v_lines JSONB := '[]'::jsonb;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND NOT private.is_org_member(p_org_id)
  THEN
    RAISE EXCEPTION 'FINANCE_ORG_FORBIDDEN'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.clients
    WHERE id = p_client_id
      AND org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'FINANCE_CLIENT_ORG_MISMATCH'
      USING ERRCODE = '42501';
  END IF;

  IF p_project_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.projects
       WHERE id = p_project_id
         AND org_id = p_org_id
     )
  THEN
    RAISE EXCEPTION 'FINANCE_PROJECT_ORG_MISMATCH'
      USING ERRCODE = '42501';
  END IF;

  IF p_vat_rate_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.tax_rates
       WHERE id = p_vat_rate_id
         AND org_id = p_org_id
     )
  THEN
    RAISE EXCEPTION 'FINANCE_VAT_RATE_ORG_MISMATCH'
      USING ERRCODE = '42501';
  END IF;

  IF p_wht_rate_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.tax_rates
       WHERE id = p_wht_rate_id
         AND org_id = p_org_id
     )
  THEN
    RAISE EXCEPTION 'FINANCE_WHT_RATE_ORG_MISMATCH'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.invoices (
    id,
    org_id,
    client_id,
    project_id,
    number,
    status,
    issue_date,
    due_date,
    subtotal_satang,
    vat_amount_satang,
    wht_amount_satang,
    vat_rate_id,
    wht_rate_id,
    amount_satang,
    is_recurring,
    recurring_interval,
    notes
  )
  VALUES (
    p_id,
    p_org_id,
    p_client_id,
    p_project_id,
    p_number,
    p_status,
    COALESCE(p_issue_date, CURRENT_DATE),
    p_due_date,
    p_subtotal_satang,
    p_vat_amount_satang,
    p_wht_amount_satang,
    p_vat_rate_id,
    p_wht_rate_id,
    p_amount_satang,
    p_is_recurring,
    p_recurring_interval,
    p_notes
  );

  SELECT id INTO v_ar_acct
  FROM public.accounts
  WHERE org_id = p_org_id
    AND code = '1200';

  SELECT id INTO v_rev_acct
  FROM public.accounts
  WHERE org_id = p_org_id
    AND code = '4100';

  IF v_ar_acct IS NULL OR v_rev_acct IS NULL THEN
    RAISE EXCEPTION
      'Required accounts (1200, 4100) not found for org %',
      p_org_id;
  END IF;

  v_lines :=
    v_lines || jsonb_build_object(
      'account_id', v_ar_acct,
      'debit', p_amount_satang,
      'credit', 0
    );

  v_lines :=
    v_lines || jsonb_build_object(
      'account_id', v_rev_acct,
      'debit', 0,
      'credit', p_subtotal_satang
    );

  IF p_vat_amount_satang > 0 THEN
    SELECT id INTO v_out_vat_acct
    FROM public.accounts
    WHERE org_id = p_org_id
      AND code = '2150';

    IF v_out_vat_acct IS NOT NULL THEN
      v_lines :=
        v_lines || jsonb_build_object(
          'account_id', v_out_vat_acct,
          'debit', 0,
          'credit', p_vat_amount_satang
        );
    END IF;
  END IF;

  IF p_wht_amount_satang > 0 THEN
    SELECT id INTO v_wht_rec_acct
    FROM public.accounts
    WHERE org_id = p_org_id
      AND code = '1154';

    IF v_wht_rec_acct IS NOT NULL THEN
      v_lines :=
        v_lines || jsonb_build_object(
          'account_id', v_wht_rec_acct,
          'debit', p_wht_amount_satang,
          'credit', 0
        );
    END IF;
  END IF;

  PERFORM public.create_automated_journal_entry(
    p_org_id,
    'invoice'::public.journal_entry_source,
    p_id,
    'ตั้งหนี้ลูกหนี้การค้า ใบแจ้งหนี้ ' || p_number,
    v_lines
  );

  RETURN p_id;
END;
$function$;


CREATE OR REPLACE FUNCTION public.rpc_record_payment(
  p_id uuid,
  p_org_id uuid,
  p_invoice_id uuid,
  p_amount_satang bigint,
  p_method public.payment_method,
  p_paid_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_notes text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_inv_amount BIGINT;
  v_inv_status public.invoice_status;
  v_inv_number TEXT;
  v_total_paid BIGINT;
  v_next_status public.invoice_status;
  v_cash_code TEXT;
  v_cash_acct UUID;
  v_ar_acct UUID;
  v_lines JSONB := '[]'::jsonb;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND NOT private.is_org_member(p_org_id)
  THEN
    RAISE EXCEPTION 'FINANCE_ORG_FORBIDDEN'
      USING ERRCODE = '42501';
  END IF;

  SELECT
    amount_satang,
    status,
    number
  INTO
    v_inv_amount,
    v_inv_status,
    v_inv_number
  FROM public.invoices
  WHERE id = p_invoice_id
    AND org_id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  INSERT INTO public.payments (
    id,
    org_id,
    invoice_id,
    amount_satang,
    paid_at,
    method,
    notes
  )
  VALUES (
    p_id,
    p_org_id,
    p_invoice_id,
    p_amount_satang,
    COALESCE(p_paid_at, NOW()),
    p_method,
    p_notes
  );

  SELECT COALESCE(SUM(amount_satang), 0)
  INTO v_total_paid
  FROM public.payments
  WHERE invoice_id = p_invoice_id
    AND org_id = p_org_id;

  IF v_inv_status NOT IN ('draft', 'cancelled') THEN
    v_next_status := v_inv_status;

    IF v_inv_amount > 0
       AND v_total_paid >= v_inv_amount
    THEN
      v_next_status := 'paid';
    ELSIF v_total_paid > 0 THEN
      v_next_status := 'partially_paid';
    END IF;

    IF v_next_status != v_inv_status THEN
      UPDATE public.invoices
      SET status = v_next_status
      WHERE id = p_invoice_id;
    END IF;
  END IF;

  IF p_method = 'cash' THEN
    v_cash_code := '1110';
  ELSE
    v_cash_code := '1120';
  END IF;

  SELECT id INTO v_cash_acct
  FROM public.accounts
  WHERE org_id = p_org_id
    AND code = v_cash_code;

  SELECT id INTO v_ar_acct
  FROM public.accounts
  WHERE org_id = p_org_id
    AND code = '1200';

  IF v_cash_acct IS NULL OR v_ar_acct IS NULL THEN
    RAISE EXCEPTION
      'Required accounts (%, 1200) not found',
      v_cash_code;
  END IF;

  v_lines :=
    v_lines || jsonb_build_object(
      'account_id', v_cash_acct,
      'debit', p_amount_satang,
      'credit', 0
    );

  v_lines :=
    v_lines || jsonb_build_object(
      'account_id', v_ar_acct,
      'debit', 0,
      'credit', p_amount_satang
    );

  PERFORM public.create_automated_journal_entry(
    p_org_id,
    'payment'::public.journal_entry_source,
    p_id,
    'รับชำระเงินตามใบแจ้งหนี้ ' || v_inv_number,
    v_lines
  );

  RETURN p_id;
END;
$function$;


ALTER FUNCTION public.create_automated_journal_entry(
  uuid,
  public.journal_entry_source,
  uuid,
  text,
  jsonb
)
OWNER TO postgres;

ALTER FUNCTION public.rpc_create_cost(
  uuid,
  uuid,
  public.cost_category,
  bigint,
  bigint,
  bigint,
  bigint,
  uuid,
  uuid,
  date,
  text,
  uuid,
  text,
  uuid,
  uuid
)
OWNER TO postgres;

ALTER FUNCTION public.rpc_create_invoice(
  uuid,
  uuid,
  uuid,
  text,
  public.invoice_status,
  bigint,
  bigint,
  bigint,
  bigint,
  boolean,
  uuid,
  date,
  date,
  uuid,
  uuid,
  public.recurring_interval,
  text
)
OWNER TO postgres;

ALTER FUNCTION public.rpc_record_payment(
  uuid,
  uuid,
  uuid,
  bigint,
  public.payment_method,
  timestamp with time zone,
  text
)
OWNER TO postgres;


REVOKE ALL
ON FUNCTION public.create_automated_journal_entry(
  uuid,
  public.journal_entry_source,
  uuid,
  text,
  jsonb
)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.create_automated_journal_entry(
  uuid,
  public.journal_entry_source,
  uuid,
  text,
  jsonb
)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.create_automated_journal_entry(
  uuid,
  public.journal_entry_source,
  uuid,
  text,
  jsonb
)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.create_automated_journal_entry(
  uuid,
  public.journal_entry_source,
  uuid,
  text,
  jsonb
)
TO service_role;


REVOKE ALL
ON FUNCTION public.rpc_create_cost(
  uuid,
  uuid,
  public.cost_category,
  bigint,
  bigint,
  bigint,
  bigint,
  uuid,
  uuid,
  date,
  text,
  uuid,
  text,
  uuid,
  uuid
)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.rpc_create_cost(
  uuid,
  uuid,
  public.cost_category,
  bigint,
  bigint,
  bigint,
  bigint,
  uuid,
  uuid,
  date,
  text,
  uuid,
  text,
  uuid,
  uuid
)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.rpc_create_cost(
  uuid,
  uuid,
  public.cost_category,
  bigint,
  bigint,
  bigint,
  bigint,
  uuid,
  uuid,
  date,
  text,
  uuid,
  text,
  uuid,
  uuid
)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.rpc_create_cost(
  uuid,
  uuid,
  public.cost_category,
  bigint,
  bigint,
  bigint,
  bigint,
  uuid,
  uuid,
  date,
  text,
  uuid,
  text,
  uuid,
  uuid
)
TO service_role;


REVOKE ALL
ON FUNCTION public.rpc_create_invoice(
  uuid,
  uuid,
  uuid,
  text,
  public.invoice_status,
  bigint,
  bigint,
  bigint,
  bigint,
  boolean,
  uuid,
  date,
  date,
  uuid,
  uuid,
  public.recurring_interval,
  text
)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.rpc_create_invoice(
  uuid,
  uuid,
  uuid,
  text,
  public.invoice_status,
  bigint,
  bigint,
  bigint,
  bigint,
  boolean,
  uuid,
  date,
  date,
  uuid,
  uuid,
  public.recurring_interval,
  text
)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.rpc_create_invoice(
  uuid,
  uuid,
  uuid,
  text,
  public.invoice_status,
  bigint,
  bigint,
  bigint,
  bigint,
  boolean,
  uuid,
  date,
  date,
  uuid,
  uuid,
  public.recurring_interval,
  text
)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.rpc_create_invoice(
  uuid,
  uuid,
  uuid,
  text,
  public.invoice_status,
  bigint,
  bigint,
  bigint,
  bigint,
  boolean,
  uuid,
  date,
  date,
  uuid,
  uuid,
  public.recurring_interval,
  text
)
TO service_role;


REVOKE ALL
ON FUNCTION public.rpc_record_payment(
  uuid,
  uuid,
  uuid,
  bigint,
  public.payment_method,
  timestamp with time zone,
  text
)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.rpc_record_payment(
  uuid,
  uuid,
  uuid,
  bigint,
  public.payment_method,
  timestamp with time zone,
  text
)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.rpc_record_payment(
  uuid,
  uuid,
  uuid,
  bigint,
  public.payment_method,
  timestamp with time zone,
  text
)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.rpc_record_payment(
  uuid,
  uuid,
  uuid,
  bigint,
  public.payment_method,
  timestamp with time zone,
  text
)
TO service_role;


COMMENT ON FUNCTION public.create_automated_journal_entry(
  uuid,
  public.journal_entry_source,
  uuid,
  text,
  jsonb
)
IS 'MOD-002 finance journal RPC security hardening.';

COMMENT ON FUNCTION public.rpc_create_cost(
  uuid,
  uuid,
  public.cost_category,
  bigint,
  bigint,
  bigint,
  bigint,
  uuid,
  uuid,
  date,
  text,
  uuid,
  text,
  uuid,
  uuid
)
IS 'MOD-002 atomic cost RPC security hardening.';

COMMENT ON FUNCTION public.rpc_create_invoice(
  uuid,
  uuid,
  uuid,
  text,
  public.invoice_status,
  bigint,
  bigint,
  bigint,
  bigint,
  boolean,
  uuid,
  date,
  date,
  uuid,
  uuid,
  public.recurring_interval,
  text
)
IS 'MOD-002 atomic invoice RPC security hardening.';

COMMENT ON FUNCTION public.rpc_record_payment(
  uuid,
  uuid,
  uuid,
  bigint,
  public.payment_method,
  timestamp with time zone,
  text
)
IS 'MOD-002 atomic payment RPC security hardening.';
