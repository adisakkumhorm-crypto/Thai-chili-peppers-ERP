-- MOD-001 I-8
-- Harden and correct Sales Order shipment orchestration.
--
-- Scope:
--   * rpc_ship_sales_order only
--   * preserve four-argument compatibility signature
--   * do not modify rpc_issue_stock
--   * fail closed on invalid order/item state
--   * deterministic shipment idempotency
--   * hardened ACL/search_path

CREATE OR REPLACE FUNCTION public.rpc_ship_sales_order(
  p_order_id uuid,
  p_user_id uuid,
  p_org_id uuid,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_so_record public.sales_orders%ROWTYPE;
  v_item public.sales_order_items%ROWTYPE;
  v_issue_result jsonb;
  v_item_count integer := 0;
  v_item_idempotency_key text;
BEGIN
  -- 1. Serialize shipment attempts for this Sales Order.
  SELECT *
  INTO v_so_record
  FROM public.sales_orders
  WHERE id = p_order_id
    AND org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Sales order % not found.',
      p_order_id;
  END IF;

  -- 2. Exact replay after a committed shipment is safe.
  IF v_so_record.status = 'shipped' THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Already shipped'
    );
  END IF;

  -- 3. Terminal states may never issue stock.
  IF v_so_record.status IN ('cancelled', 'delivered') THEN
    RAISE EXCEPTION
      'Cannot ship sales order in % status',
      v_so_record.status;
  END IF;

  -- 4. Lock the complete item set before validation/mutation.
  -- Product/location ordering is compatible with rpc_issue_stock's
  -- product -> inventory balance lock hierarchy.
  PERFORM 1
  FROM public.sales_order_items
  WHERE order_id = p_order_id
    AND org_id = p_org_id
  ORDER BY product_id, location_id, id
  FOR UPDATE;

  GET DIAGNOSTICS v_item_count = ROW_COUNT;

  IF v_item_count = 0 THEN
    RAISE EXCEPTION
      'Sales order % has no items to ship',
      p_order_id;
  END IF;

  -- 5. Validate every item before any stock mutation.
  FOR v_item IN
    SELECT *
    FROM public.sales_order_items
    WHERE order_id = p_order_id
      AND org_id = p_org_id
    ORDER BY product_id, location_id, id
  LOOP
    IF v_item.quantity <= 0 THEN
      RAISE EXCEPTION
        'Sales order item % has invalid quantity %',
        v_item.id,
        v_item.quantity;
    END IF;

    IF v_item.location_id IS NULL THEN
      RAISE EXCEPTION
        'LEGACY_SALES_EXCEPTION';
    END IF;
  END LOOP;

  -- 6. Issue every reserved item through the existing stock authority.
  FOR v_item IN
    SELECT *
    FROM public.sales_order_items
    WHERE order_id = p_order_id
      AND org_id = p_org_id
    ORDER BY product_id, location_id, id
  LOOP
    v_item_idempotency_key :=
      'sales-shipped:'
      || COALESCE(
        p_idempotency_key,
        p_order_id::text
      )
      || ':'
      || v_item.id::text;

    v_issue_result :=
      public.rpc_issue_stock(
        p_org_id,
        'ALLOCATED_FULFILLMENT',
        v_item.quantity,
        v_item_idempotency_key,
        p_user_id,
        NULL,
        NULL,
        v_so_record.order_number,
        v_item.id
      );

    IF COALESCE(
      (v_issue_result->>'success')::boolean,
      false
    ) IS NOT TRUE THEN
      RAISE EXCEPTION
        'Failed to issue stock for item %: %',
        v_item.id,
        COALESCE(
          v_issue_result->>'error',
          'Unknown error'
        );
    END IF;
  END LOOP;

  -- 7. Only a fully successful stock issue may mark the order shipped.
  UPDATE public.sales_orders
  SET status = 'shipped'::sales_order_status,
      updated_at = NOW()
  WHERE id = p_order_id
    AND org_id = p_org_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Sales order shipped successfully'
  );
END;
$function$;

REVOKE EXECUTE
ON FUNCTION public.rpc_ship_sales_order(
  uuid,
  uuid,
  uuid,
  text
)
FROM PUBLIC;

REVOKE EXECUTE
ON FUNCTION public.rpc_ship_sales_order(
  uuid,
  uuid,
  uuid,
  text
)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.rpc_ship_sales_order(
  uuid,
  uuid,
  uuid,
  text
)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.rpc_ship_sales_order(
  uuid,
  uuid,
  uuid,
  text
)
TO service_role;

COMMENT ON FUNCTION public.rpc_ship_sales_order(
  uuid,
  uuid,
  uuid,
  text
)
IS
  'MOD-001 I-8 hardened Sales Order shipment orchestration with strict item validation and deterministic idempotency.';
