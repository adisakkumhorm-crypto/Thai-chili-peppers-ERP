-- PHASE 7 STEP B: Moving Average Cost Engine + Receiving

-- Drop the previous signature to replace with the 6-arg one
DROP FUNCTION IF EXISTS public.rpc_receive_po_items(uuid, uuid, uuid, uuid, jsonb);

CREATE OR REPLACE FUNCTION public.rpc_receive_po_items(
  p_po_id uuid,
  p_location_id uuid,
  p_org_id uuid,
  p_user_id uuid,
  p_items jsonb,
  p_idempotency_key text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  v_item JSONB;
  v_po_item_id UUID;
  v_product_id UUID;
  v_qty_to_receive INTEGER;
  v_po_item RECORD;
  v_remaining INTEGER;
  v_po RECORD;
  v_all_fully_received BOOLEAN := TRUE;
  
  -- Moving average vars
  v_product RECORD;
  v_new_avg_cost NUMERIC(19,4);
  v_new_total_val NUMERIC(19,4);
  v_new_total_qty INTEGER;
  v_unit_cost NUMERIC(19,4);
  v_total_cost NUMERIC(19,4);
BEGIN
  -- Idempotency check (Table has unique constraint on org_id, idempotency_key)
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
        SELECT 1 FROM inventory_transactions 
        WHERE org_id = p_org_id AND idempotency_key = p_idempotency_key
    ) THEN
        RETURN; -- Already processed
    END IF;
  END IF;

  -- Lock PO to serialize receives for the same PO
  SELECT * INTO v_po FROM purchase_orders WHERE id = p_po_id AND org_id = p_org_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PO not found';
  END IF;

  -- PRE-LOCK products to prevent deadlocks (Order by product_id)
  PERFORM id FROM products 
  WHERE id IN (
      SELECT (jsonb_array_elements(p_items)->>'product_id')::UUID
  ) AND org_id = p_org_id
  ORDER BY id
  FOR UPDATE;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_po_item_id := (v_item->>'id')::UUID;
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty_to_receive := (v_item->>'quantityToReceive')::INTEGER;

    IF v_qty_to_receive <= 0 THEN
      CONTINUE;
    END IF;

    -- Lock and get PO item
    SELECT * INTO v_po_item 
    FROM purchase_order_items 
    WHERE id = v_po_item_id AND po_id = p_po_id AND org_id = p_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PO Item % not found', v_po_item_id;
    END IF;

    v_remaining := v_po_item.quantity - COALESCE(v_po_item.received_quantity, 0);

    IF v_qty_to_receive > v_remaining THEN
      RAISE EXCEPTION 'Cannot receive % for item %. Remaining is %', v_qty_to_receive, v_po_item_id, v_remaining;
    END IF;

    -- GET PRODUCT INFO (Already locked)
    SELECT * INTO v_product FROM products WHERE id = v_product_id AND org_id = p_org_id;
    
    -- LEGACY STOCK SAFETY CHECK
    IF v_product.stock_quantity > 0 AND v_product.average_cost = 0 AND v_product.total_inventory_value = 0 THEN
      RAISE EXCEPTION 'OPENING_INVENTORY_REQUIRED: Cannot receive valuation for legacy product % without opening inventory balance', v_product.name;
    END IF;

    -- CALCULATE MOVING AVERAGE
    v_unit_cost := v_po_item.unit_price::NUMERIC(19,4);
    v_total_cost := (v_qty_to_receive * v_unit_cost)::NUMERIC(19,4);
    
    v_new_total_qty := v_product.stock_quantity + v_qty_to_receive;
    v_new_total_val := v_product.total_inventory_value + v_total_cost;
    
    IF v_new_total_qty > 0 THEN
        v_new_avg_cost := (v_new_total_val / v_new_total_qty)::NUMERIC(19,4);
    ELSE
        v_new_avg_cost := v_unit_cost; 
    END IF;

    -- Update received_quantity
    UPDATE purchase_order_items
    SET received_quantity = COALESCE(received_quantity, 0) + v_qty_to_receive
    WHERE id = v_po_item_id;

    -- Insert transaction
    INSERT INTO inventory_transactions (
      org_id, product_id, location_id, transaction_type, quantity, reference_no, created_by,
      idempotency_key, unit_cost, total_cost
    ) VALUES (
      p_org_id, v_product_id, p_location_id, 'receive', v_qty_to_receive, v_po.po_number, p_user_id,
      p_idempotency_key, v_unit_cost, v_total_cost
    );

    -- Update inventory_balances
    INSERT INTO inventory_balances (
      org_id, product_id, location_id, on_hand_quantity, allocated_quantity
    ) VALUES (
      p_org_id, v_product_id, p_location_id, v_qty_to_receive, 0
    )
    ON CONFLICT (product_id, location_id)
    DO UPDATE SET on_hand_quantity = inventory_balances.on_hand_quantity + EXCLUDED.on_hand_quantity;
    
    -- Update global product stock and moving average
    PERFORM set_config('app.bypass_cost_readonly', 'true', true);

    UPDATE products
    SET stock_quantity = v_new_total_qty,
        total_inventory_value = v_new_total_val,
        average_cost = v_new_avg_cost
    WHERE id = v_product_id AND org_id = p_org_id;
    
    PERFORM set_config('app.bypass_cost_readonly', 'false', true);

  END LOOP;

  -- Check if fully received for the whole PO
  FOR v_po_item IN SELECT quantity, received_quantity FROM purchase_order_items WHERE po_id = p_po_id AND org_id = p_org_id
  LOOP
    IF COALESCE(v_po_item.received_quantity, 0) < v_po_item.quantity THEN
      v_all_fully_received := FALSE;
      EXIT;
    END IF;
  END LOOP;

  IF v_all_fully_received THEN
    UPDATE purchase_orders SET status = 'received' WHERE id = p_po_id;
  ELSE
    UPDATE purchase_orders SET status = 'partially_received' WHERE id = p_po_id;
  END IF;

END;
$function$;
