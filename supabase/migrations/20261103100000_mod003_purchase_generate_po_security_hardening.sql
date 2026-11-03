-- MOD-003
-- Purchasing / Procurement privileged RPC security hardening.
--
-- Scope:
--   public.generate_po_from_pr(uuid, uuid)
--
-- Security objectives:
--   * preserve existing function signature and return type
--   * preserve SECURITY DEFINER atomic transaction semantics
--   * lock search_path
--   * remove PUBLIC / anon EXECUTE
--   * retain authenticated / service_role execution
--   * bind p_user_id to auth.uid() for non-service callers
--   * enforce organization membership
--   * enforce procurement / owner / admin authorization
--   * validate tenant-sensitive relationships before writes
--   * preserve existing PR -> PO business semantics

CREATE OR REPLACE FUNCTION public.generate_po_from_pr(
  p_pr_id uuid,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_pr RECORD;
  v_quote RECORD;
  v_po_id uuid;
  v_po_number text;
  v_item RECORD;
  v_total_qty integer;
  v_unit_price numeric(15,2);
  v_actor uuid;
  v_is_service boolean;
  v_authorized boolean;
BEGIN
  v_is_service :=
    COALESCE(
      auth.role(),
      ''
    ) = 'service_role';

  IF NOT v_is_service THEN
    v_actor := auth.uid();

    IF v_actor IS NULL THEN
      RAISE EXCEPTION
        'PURCHASE_AUTH_REQUIRED'
        USING ERRCODE = '42501';
    END IF;

    IF p_user_id IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION
        'PURCHASE_ACTOR_MISMATCH'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT *
  INTO v_pr
  FROM public.purchase_requests
  WHERE id = p_pr_id
  FOR UPDATE;

  IF v_pr IS NULL THEN
    RAISE EXCEPTION 'PR not found';
  END IF;

  IF NOT v_is_service THEN
    IF NOT private.is_org_member(
      v_pr.org_id
    ) THEN
      RAISE EXCEPTION
        'PURCHASE_ORG_FORBIDDEN'
        USING ERRCODE = '42501';
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.memberships m
      LEFT JOIN public.employees e
        ON e.org_id = m.org_id
       AND e.user_id = m.user_id
      WHERE m.org_id = v_pr.org_id
        AND m.user_id = v_actor
        AND (
          m.role IN (
            'owner'::public.role_enum,
            'admin'::public.role_enum
          )
          OR lower(
            COALESCE(
              e.department,
              ''
            )
          ) = 'procurement'
          OR lower(
            COALESCE(
              e.role::text,
              ''
            )
          ) = 'procurement'
        )
    )
    INTO v_authorized;

    IF NOT COALESCE(
      v_authorized,
      false
    ) THEN
      RAISE EXCEPTION
        'PURCHASE_PERMISSION_FORBIDDEN'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_pr.status !=
     'approved'::public.pr_status THEN

    RAISE EXCEPTION
      'Only approved PRs can be generated into POs';
  END IF;

  IF v_pr.po_id IS NOT NULL THEN
    RAISE EXCEPTION
      'PR นี้ถูกสร้างเป็น PO แล้ว (PO Reference)';
  END IF;

  IF v_pr.selected_quotation_id IS NULL THEN
    RAISE EXCEPTION
      'PR has no selected quotation to generate PO from';
  END IF;

  SELECT *
  INTO v_quote
  FROM public.pr_quotations
  WHERE id = v_pr.selected_quotation_id
    AND pr_id = v_pr.id
    AND org_id = v_pr.org_id;

  IF v_quote IS NULL THEN
    RAISE EXCEPTION
      'PURCHASE_QUOTATION_SCOPE_MISMATCH'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.suppliers s
    WHERE s.id = v_quote.supplier_id
      AND s.org_id = v_pr.org_id
  ) THEN
    RAISE EXCEPTION
      'PURCHASE_SUPPLIER_ORG_MISMATCH'
      USING ERRCODE = '42501';
  END IF;

  IF v_pr.project_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.projects p
       WHERE p.id = v_pr.project_id
         AND p.org_id = v_pr.org_id
     ) THEN

    RAISE EXCEPTION
      'PURCHASE_PROJECT_ORG_MISMATCH'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.purchase_request_items i
    WHERE i.pr_id = p_pr_id
      AND i.org_id IS DISTINCT FROM
          v_pr.org_id
  ) THEN

    RAISE EXCEPTION
      'PURCHASE_PR_ITEM_ORG_MISMATCH'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.purchase_request_items i
    LEFT JOIN public.products p
      ON p.id = i.product_id
    WHERE i.pr_id = p_pr_id
      AND (
        p.id IS NULL
        OR p.org_id IS DISTINCT FROM
           v_pr.org_id
      )
  ) THEN

    RAISE EXCEPTION
      'PURCHASE_PRODUCT_ORG_MISMATCH'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(
    sum(quantity),
    0
  )
  INTO v_total_qty
  FROM public.purchase_request_items
  WHERE pr_id = p_pr_id
    AND org_id = v_pr.org_id;

  IF v_total_qty = 0 THEN
    RAISE EXCEPTION
      'PR has no items to generate PO';
  END IF;

  v_po_number :=
    'PO-' ||
    v_pr.pr_number ||
    '-' ||
    right(
      extract(epoch from now())::text,
      4
    );

  INSERT INTO public.purchase_orders (
    org_id,
    supplier_id,
    po_number,
    status,
    total_amount,
    expected_date,
    notes,
    requested_by,
    pr_id
  )
  VALUES (
    v_pr.org_id,
    v_quote.supplier_id,
    v_po_number,
    'draft'::public.po_status,
    v_quote.price,
    v_pr.required_date,
    'Generated from PR: ' ||
      v_pr.pr_number ||
      COALESCE(
        '. Quotation: ' ||
        v_quote.quotation_number,
        ''
      ),
    p_user_id,
    p_pr_id
  )
  RETURNING id
  INTO v_po_id;

  FOR v_item IN (
    SELECT *
    FROM public.purchase_request_items
    WHERE pr_id = p_pr_id
      AND org_id = v_pr.org_id
  )
  LOOP
    IF v_quote.quantity IS NOT NULL
       AND v_quote.quantity > 0 THEN

      v_unit_price :=
        ROUND(
          (
            v_quote.price /
            v_quote.quantity
          )::numeric,
          2
        );
    ELSE
      v_unit_price :=
        ROUND(
          (
            v_quote.price /
            v_total_qty
          )::numeric,
          2
        );
    END IF;

    INSERT INTO public.purchase_order_items (
      org_id,
      po_id,
      product_id,
      quantity,
      unit_price,
      project_id
    )
    VALUES (
      v_pr.org_id,
      v_po_id,
      v_item.product_id,
      v_item.quantity,
      v_unit_price,
      v_pr.project_id
    );
  END LOOP;

  UPDATE public.purchase_requests
  SET
    status =
      'po_created'::public.pr_status,
    po_id = v_po_id,
    po_created_at = now(),
    po_created_by = p_user_id
  WHERE id = p_pr_id
    AND org_id = v_pr.org_id;

  RETURN v_po_id;
END;
$function$;

ALTER FUNCTION public.generate_po_from_pr(
  uuid,
  uuid
)
OWNER TO postgres;

REVOKE ALL
ON FUNCTION public.generate_po_from_pr(
  uuid,
  uuid
)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.generate_po_from_pr(
  uuid,
  uuid
)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.generate_po_from_pr(
  uuid,
  uuid
)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.generate_po_from_pr(
  uuid,
  uuid
)
TO service_role;

COMMENT ON FUNCTION public.generate_po_from_pr(
  uuid,
  uuid
)
IS
  'MOD-003 hardened atomic PR-to-PO generation with caller, role and tenant-integrity guards.';
