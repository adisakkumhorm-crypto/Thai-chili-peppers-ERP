-- MOD-009
-- Sales Order actor authorization hardening.
--
-- Scope:
--   public.rpc_cancel_sales_order_reservation
--   public.rpc_ship_sales_order
--
-- Policy:
--   authenticated callers bind p_user_id to auth.uid()
--   authenticated callers require membership in p_org_id
--   service_role compatibility is preserved
--   all other callers fail closed
--
-- IMPORTANT:
-- Business logic below each marked MOD009 authorization guard
-- is copied from the authoritative production definition and
-- must remain unchanged.

BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_cancel_sales_order_reservation(p_order_id uuid, p_user_id uuid, p_org_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_so_record public.sales_orders%ROWTYPE;
  v_item public.sales_order_items%ROWTYPE;

  v_group RECORD;

  v_balance_id uuid;
  v_allocated_quantity integer;
BEGIN

  -- MOD009_AUTH_GUARD_BEGIN:CANCEL
  IF current_user = 'authenticated' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'SALES_ORDER_CANCEL_AUTH_REQUIRED'
        USING ERRCODE = '42501';
    END IF;

    IF p_user_id IS NULL THEN
      RAISE EXCEPTION 'SALES_ORDER_CANCEL_ACTOR_REQUIRED'
        USING ERRCODE = '42501';
    END IF;

    IF p_user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'SALES_ORDER_CANCEL_ACTOR_MISMATCH'
        USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.memberships m
      WHERE m.org_id = p_org_id
        AND m.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'SALES_ORDER_CANCEL_ORG_FORBIDDEN'
        USING ERRCODE = '42501';
    END IF;

  ELSIF current_user = 'service_role' THEN
    NULL;

  ELSE
    RAISE EXCEPTION 'SALES_ORDER_CANCEL_CALLER_FORBIDDEN'
      USING ERRCODE = '42501';
  END IF;
  -- MOD009_AUTH_GUARD_END:CANCEL

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

CREATE OR REPLACE FUNCTION public.rpc_ship_sales_order(p_order_id uuid, p_user_id uuid, p_org_id uuid, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_so_record public.sales_orders%ROWTYPE;
  v_item public.sales_order_items%ROWTYPE;
  v_issue_result jsonb;
  v_item_count integer := 0;
  v_item_idempotency_key text;
BEGIN

  -- MOD009_AUTH_GUARD_BEGIN:SHIP
  IF current_user = 'authenticated' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'SALES_ORDER_SHIP_AUTH_REQUIRED'
        USING ERRCODE = '42501';
    END IF;

    IF p_user_id IS NULL THEN
      RAISE EXCEPTION 'SALES_ORDER_SHIP_ACTOR_REQUIRED'
        USING ERRCODE = '42501';
    END IF;

    IF p_user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'SALES_ORDER_SHIP_ACTOR_MISMATCH'
        USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.memberships m
      WHERE m.org_id = p_org_id
        AND m.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'SALES_ORDER_SHIP_ORG_FORBIDDEN'
        USING ERRCODE = '42501';
    END IF;

  ELSIF current_user = 'service_role' THEN
    NULL;

  ELSE
    RAISE EXCEPTION 'SALES_ORDER_SHIP_CALLER_FORBIDDEN'
      USING ERRCODE = '42501';
  END IF;
  -- MOD009_AUTH_GUARD_END:SHIP

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

COMMIT;
