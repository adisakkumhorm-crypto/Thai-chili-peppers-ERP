-- MOD-001 I-9
-- Harden the existing six-argument sales-order-item reservation RPC.
-- Idempotency is intentionally deferred until the caller has a true,
-- stable request identifier. Do not add an overload or fake random key.

CREATE OR REPLACE FUNCTION public.rpc_reserve_so_item(
  p_order_id uuid,
  p_product_id uuid,
  p_location_id uuid,
  p_quantity integer,
  p_unit_price numeric,
  p_org_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_order_status text;

  v_balance_id uuid;
  v_on_hand_quantity integer;
  v_allocated_quantity integer;
  v_available integer;

  v_new_total numeric;
BEGIN
  -- Fail closed on malformed direct RPC calls. The server action also
  -- validates these fields, but the database boundary must stand alone.
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Order id is required';
  END IF;

  IF p_product_id IS NULL THEN
    RAISE EXCEPTION 'Product id is required';
  END IF;

  IF p_location_id IS NULL THEN
    RAISE EXCEPTION 'Location id is required';
  END IF;

  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'Organization id is required';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION
      'Reservation quantity must be greater than zero';
  END IF;

  IF p_unit_price IS NULL OR p_unit_price < 0 THEN
    RAISE EXCEPTION
      'Unit price must be zero or greater';
  END IF;

  -- Lock hierarchy begins with the Sales Order. This serializes Reserve
  -- against Ship, Cancel, and Delete operations for the same order.
  SELECT status
  INTO v_order_status
  FROM public.sales_orders
  WHERE id = p_order_id
    AND org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION
      'Cannot modify items unless order is pending';
  END IF;

  -- Explicit same-org product validation. No competing product write lock
  -- is introduced here; stock authority remains the inventory balance.
  PERFORM 1
  FROM public.products
  WHERE id = p_product_id
    AND org_id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Product not found for this organization';
  END IF;

  -- Lock the authoritative balance after the order lock.
  SELECT
    id,
    on_hand_quantity,
    allocated_quantity
  INTO
    v_balance_id,
    v_on_hand_quantity,
    v_allocated_quantity
  FROM public.inventory_balances
  WHERE product_id = p_product_id
    AND location_id = p_location_id
    AND org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Inventory balance not found for this location';
  END IF;

  v_available := v_on_hand_quantity - v_allocated_quantity;

  IF p_quantity > v_available THEN
    RAISE EXCEPTION
      'Not enough available stock at this location (Available: %)',
      v_available;
  END IF;

  -- All validation succeeded. Apply the reservation exactly once for this
  -- invocation. Duplicate-request idempotency is a documented residual risk.
  UPDATE public.inventory_balances
  SET allocated_quantity = allocated_quantity + p_quantity
  WHERE id = v_balance_id
    AND org_id = p_org_id;

  INSERT INTO public.sales_order_items (
    org_id,
    order_id,
    product_id,
    location_id,
    quantity,
    unit_price
  )
  VALUES (
    p_org_id,
    p_order_id,
    p_product_id,
    p_location_id,
    p_quantity,
    p_unit_price
  );

  SELECT COALESCE(SUM(quantity * unit_price), 0)
  INTO v_new_total
  FROM public.sales_order_items
  WHERE order_id = p_order_id
    AND org_id = p_org_id;

  UPDATE public.sales_orders
  SET
    total_amount = v_new_total,
    updated_at = NOW()
  WHERE id = p_order_id
    AND org_id = p_org_id;
END;
$function$;

ALTER FUNCTION public.rpc_reserve_so_item(
  uuid,
  uuid,
  uuid,
  integer,
  numeric,
  uuid
)
OWNER TO postgres;

REVOKE ALL
ON FUNCTION public.rpc_reserve_so_item(
  uuid,
  uuid,
  uuid,
  integer,
  numeric,
  uuid
)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.rpc_reserve_so_item(
  uuid,
  uuid,
  uuid,
  integer,
  numeric,
  uuid
)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.rpc_reserve_so_item(
  uuid,
  uuid,
  uuid,
  integer,
  numeric,
  uuid
)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.rpc_reserve_so_item(
  uuid,
  uuid,
  uuid,
  integer,
  numeric,
  uuid
)
TO service_role;

COMMENT ON FUNCTION public.rpc_reserve_so_item(
  uuid,
  uuid,
  uuid,
  integer,
  numeric,
  uuid
)
IS 'MOD-001 I-9 hardened sales-order-item reservation. Six-argument compatibility preserved; duplicate-request idempotency intentionally deferred until a stable request identifier exists.';
