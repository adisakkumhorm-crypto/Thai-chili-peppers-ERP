CREATE OR REPLACE FUNCTION rpc_receive_po_items(
  p_po_id UUID,
  p_location_id UUID,
  p_org_id UUID,
  p_user_id UUID,
  p_items JSONB
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_item JSONB;
  v_po_item_id UUID;
  v_product_id UUID;
  v_qty_to_receive INTEGER;
  v_po_item RECORD;
  v_remaining INTEGER;
  v_po RECORD;
  v_all_fully_received BOOLEAN := TRUE;
BEGIN
  -- Check PO exists and is valid
  SELECT * INTO v_po FROM purchase_orders WHERE id = p_po_id AND org_id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PO not found';
  END IF;

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

    -- Update received_quantity
    UPDATE purchase_order_items
    SET received_quantity = COALESCE(received_quantity, 0) + v_qty_to_receive
    WHERE id = v_po_item_id;

    -- Insert transaction
    INSERT INTO inventory_transactions (
      org_id, product_id, location_id, transaction_type, quantity, reference_no, created_by
    ) VALUES (
      p_org_id, v_product_id, p_location_id, 'receive', v_qty_to_receive, v_po.po_number, p_user_id
    );

    -- Update inventory_balances
    INSERT INTO inventory_balances (
      org_id, product_id, location_id, on_hand_quantity, allocated_quantity
    ) VALUES (
      p_org_id, v_product_id, p_location_id, v_qty_to_receive, 0
    )
    ON CONFLICT (product_id, location_id)
    DO UPDATE SET on_hand_quantity = inventory_balances.on_hand_quantity + EXCLUDED.on_hand_quantity;
    
    -- Update global product stock
    UPDATE products
    SET stock_quantity = stock_quantity + v_qty_to_receive
    WHERE id = v_product_id AND org_id = p_org_id;

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
$$;
