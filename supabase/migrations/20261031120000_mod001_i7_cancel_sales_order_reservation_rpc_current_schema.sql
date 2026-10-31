-- ============================================================================
-- MOD-001 I-7
-- Harden sales-order reservation cancellation.
--
-- Capability:
--   inventory.stock.cancel.sales-order-reservation
--
-- Provider candidate:
--   legacy-inventory-sales-order-cancel-reservation
--
-- Scope:
--   * preserve the existing 3-argument RPC signature
--   * preserve JSONB return contract
--   * restore strict reservation consistency checks
--   * fail closed on legacy/null-location items
--   * fail closed on missing balances / allocation mismatch
--   * deterministic lock ordering
--   * tighten execution ACL
--   * no changes to ship/reserve/delete RPCs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_cancel_sales_order_reservation(
  p_order_id uuid,
  p_user_id uuid,
  p_org_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_so_record public.sales_orders%ROWTYPE;
  v_item public.sales_order_items%ROWTYPE;

  v_group RECORD;

  v_balance_id uuid;
  v_allocated_quantity integer;
BEGIN
  -- p_user_id is intentionally preserved for compatibility with the
  -- existing application/RPC contract. Authorization is not derived from
  -- this caller-supplied value; SECURITY INVOKER + table RLS remain active.

  -- 1) Lock the target order first. This preserves the existing sales
  -- lock hierarchy and serializes reserve/delete/ship/cancel operations
  -- affecting the same order.
  SELECT *
  INTO v_so_record
  FROM public.sales_orders
  WHERE id = p_order_id
    AND org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sales order % not found.', p_order_id;
  END IF;

  -- Preserve idempotent cancellation semantics.
  IF v_so_record.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Already cancelled'
    );
  END IF;

  IF v_so_record.status IN ('shipped', 'delivered') THEN
    RAISE EXCEPTION
      'Cannot cancel sales order in % status',
      v_so_record.status;
  END IF;

  -- Explicit fail-closed state contract.
  IF v_so_record.status NOT IN ('pending', 'paid', 'packing') THEN
    RAISE EXCEPTION
      'Cannot cancel sales order in % status',
      v_so_record.status;
  END IF;

  -- 2) Lock all reservation items in deterministic global balance order.
  -- No business mutation occurs during this validation phase.
  PERFORM 1
  FROM public.sales_order_items
  WHERE order_id = p_order_id
    AND org_id = p_org_id
  ORDER BY product_id, location_id, id
  FOR UPDATE;

  -- Validate every item before touching any allocation.
  FOR v_item IN
    SELECT *
    FROM public.sales_order_items
    WHERE order_id = p_order_id
      AND org_id = p_org_id
    ORDER BY product_id, location_id, id
  LOOP
    IF v_item.quantity <= 0 THEN
      RAISE EXCEPTION
        'Invalid sales order item quantity for item %: %',
        v_item.id,
        v_item.quantity;
    END IF;

    IF v_item.location_id IS NULL THEN
      RAISE EXCEPTION 'LEGACY_SALES_EXCEPTION';
    END IF;
  END LOOP;

  -- 3) Aggregate reservations by balance key, then lock and validate every
  -- required balance in deterministic order before any decrement occurs.
  FOR v_group IN
    SELECT
      product_id,
      location_id,
      SUM(quantity)::integer AS reserved_quantity
    FROM public.sales_order_items
    WHERE order_id = p_order_id
      AND org_id = p_org_id
    GROUP BY product_id, location_id
    ORDER BY product_id, location_id
  LOOP
    SELECT
      id,
      allocated_quantity
    INTO
      v_balance_id,
      v_allocated_quantity
    FROM public.inventory_balances
    WHERE product_id = v_group.product_id
      AND location_id = v_group.location_id
      AND org_id = p_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'Inventory balance not found for product % at location %',
        v_group.product_id,
        v_group.location_id;
    END IF;

    IF v_allocated_quantity < v_group.reserved_quantity THEN
      RAISE EXCEPTION
        'Allocation mismatch for product % at location %: expected at least % but found %',
        v_group.product_id,
        v_group.location_id,
        v_group.reserved_quantity,
        v_allocated_quantity;
    END IF;
  END LOOP;

  -- 4) All required rows are now validated and locked. Release each
  -- aggregated reservation exactly; never clamp an inconsistency to zero.
  FOR v_group IN
    SELECT
      product_id,
      location_id,
      SUM(quantity)::integer AS reserved_quantity
    FROM public.sales_order_items
    WHERE order_id = p_order_id
      AND org_id = p_org_id
    GROUP BY product_id, location_id
    ORDER BY product_id, location_id
  LOOP
    UPDATE public.inventory_balances
    SET
      allocated_quantity =
        allocated_quantity - v_group.reserved_quantity,
      updated_at = NOW()
    WHERE product_id = v_group.product_id
      AND location_id = v_group.location_id
      AND org_id = p_org_id;
  END LOOP;

  -- 5) Only after every reservation is safely released may the order
  -- transition to cancelled.
  UPDATE public.sales_orders
  SET
    status = 'cancelled'::sales_order_status,
    updated_at = NOW()
  WHERE id = p_order_id
    AND org_id = p_org_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Sales order cancelled successfully'
  );
END;
$function$;

REVOKE EXECUTE
ON FUNCTION public.rpc_cancel_sales_order_reservation(uuid, uuid, uuid)
FROM PUBLIC;

REVOKE EXECUTE
ON FUNCTION public.rpc_cancel_sales_order_reservation(uuid, uuid, uuid)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.rpc_cancel_sales_order_reservation(uuid, uuid, uuid)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.rpc_cancel_sales_order_reservation(uuid, uuid, uuid)
TO service_role;

COMMENT ON FUNCTION public.rpc_cancel_sales_order_reservation(
  uuid,
  uuid,
  uuid
)
IS
'MOD-001 I-7 hardened sales-order reservation cancellation: SECURITY INVOKER, strict allocation validation, deterministic locking, and restricted execution ACL.';
