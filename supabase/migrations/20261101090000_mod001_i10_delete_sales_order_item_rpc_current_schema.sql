CREATE OR REPLACE FUNCTION public.rpc_delete_so_item(
  p_item_id uuid,
  p_org_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_order_id uuid;
  v_item RECORD;
  v_order_status text;
  v_new_total numeric;
  v_balance_id uuid;
  v_current_allocated integer;
BEGIN
  IF p_item_id IS NULL THEN
    RAISE EXCEPTION 'Item id is required';
  END IF;

  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'Organization id is required';
  END IF;

  /*
   * Read only the order id first so the lock order remains:
   * sales_orders -> sales_order_items -> inventory_balances.
   */
  SELECT order_id
  INTO v_order_id
  FROM public.sales_order_items
  WHERE id = p_item_id
    AND org_id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  SELECT status
  INTO v_order_status
  FROM public.sales_orders
  WHERE id = v_order_id
    AND org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Cannot modify items unless order is pending';
  END IF;

  SELECT *
  INTO v_item
  FROM public.sales_order_items
  WHERE id = p_item_id
    AND org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  IF v_item.location_id IS NULL THEN
    RAISE EXCEPTION 'LEGACY_SALES_EXCEPTION';
  END IF;

  /*
   * Legacy rows are not protected by a quantity CHECK constraint.
   * Reject malformed reservations before allocation is mutated.
   */
  IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
    RAISE EXCEPTION
      'Invalid reservation quantity on sales order item';
  END IF;

  SELECT id, allocated_quantity
  INTO v_balance_id, v_current_allocated
  FROM public.inventory_balances
  WHERE product_id = v_item.product_id
    AND location_id = v_item.location_id
    AND org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Inventory balance not found for product % at location %',
      v_item.product_id,
      v_item.location_id;
  END IF;

  IF v_current_allocated < v_item.quantity THEN
    RAISE EXCEPTION
      'Allocation mismatch: allocated_quantity (%) is less than reservation_quantity (%)',
      v_current_allocated,
      v_item.quantity;
  END IF;

  UPDATE public.inventory_balances
  SET allocated_quantity = allocated_quantity - v_item.quantity,
      updated_at = NOW()
  WHERE id = v_balance_id
    AND org_id = p_org_id;

  DELETE FROM public.sales_order_items
  WHERE id = p_item_id
    AND org_id = p_org_id;

  SELECT COALESCE(SUM(quantity * unit_price), 0)
  INTO v_new_total
  FROM public.sales_order_items
  WHERE order_id = v_item.order_id
    AND org_id = p_org_id;

  UPDATE public.sales_orders
  SET total_amount = v_new_total,
      updated_at = NOW()
  WHERE id = v_item.order_id
    AND org_id = p_org_id;
END;
$function$;

ALTER FUNCTION public.rpc_delete_so_item(uuid,uuid)
OWNER TO postgres;

REVOKE ALL
ON FUNCTION public.rpc_delete_so_item(uuid,uuid)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.rpc_delete_so_item(uuid,uuid)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.rpc_delete_so_item(uuid,uuid)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.rpc_delete_so_item(uuid,uuid)
TO service_role;

COMMENT ON FUNCTION public.rpc_delete_so_item(uuid,uuid)
IS 'MOD-001 I-10 hardened sales-order item deletion and inventory reservation release';
