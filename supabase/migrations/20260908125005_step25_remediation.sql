-- BUG-25-02 & BUG-25-03: rpc_reserve_so_item
CREATE OR REPLACE FUNCTION rpc_reserve_so_item(
    p_order_id UUID, 
    p_product_id UUID, 
    p_location_id UUID, 
    p_quantity INTEGER, 
    p_unit_price NUMERIC, 
    p_org_id UUID
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance RECORD;
  v_available INTEGER;
  v_order_status TEXT;
  v_new_total NUMERIC;
BEGIN
  -- BUG-25-02: Lock Sales Order first to prevent Race Conditions with Ship/Cancel
  SELECT status INTO v_order_status 
  FROM sales_orders 
  WHERE id = p_order_id AND org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order_status != 'pending' THEN
    RAISE EXCEPTION 'Cannot modify items unless order is pending';
  END IF;

  -- Lock Balance
  SELECT * INTO v_balance
  FROM inventory_balances
  WHERE product_id = p_product_id AND location_id = p_location_id AND org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory balance not found for this location';
  END IF;

  v_available := v_balance.on_hand_quantity - v_balance.allocated_quantity;

  IF p_quantity > v_available THEN
    RAISE EXCEPTION 'Not enough available stock at this location (Available: %)', v_available;
  END IF;

  -- Update Balance
  UPDATE inventory_balances
  SET allocated_quantity = allocated_quantity + p_quantity
  WHERE id = v_balance.id;

  -- Insert SO Item
  INSERT INTO sales_order_items (
    org_id, order_id, product_id, location_id, quantity, unit_price
  ) VALUES (
    p_org_id, p_order_id, p_product_id, p_location_id, p_quantity, p_unit_price
  );

  -- BUG-25-03: Atomic Order Total update
  SELECT COALESCE(SUM(quantity * unit_price), 0) INTO v_new_total
  FROM sales_order_items
  WHERE order_id = p_order_id AND org_id = p_org_id;

  UPDATE sales_orders
  SET total_amount = v_new_total,
      updated_at = NOW()
  WHERE id = p_order_id AND org_id = p_org_id;

END;
$$;

-- BUG-25-01, BUG-25-02, BUG-25-03, BUG-25-05: rpc_delete_so_item
CREATE OR REPLACE FUNCTION rpc_delete_so_item(
    p_item_id UUID, 
    p_org_id UUID
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_item RECORD;
  v_order_status TEXT;
  v_new_total NUMERIC;
  v_balance_id UUID;
  v_current_allocated INT;
BEGIN
  -- We need the order_id first to lock the header properly (Lock ordering: sales_orders -> items -> balances)
  SELECT order_id INTO v_item FROM sales_order_items WHERE id = p_item_id AND org_id = p_org_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  -- BUG-25-02: Lock Sales Order
  SELECT status INTO v_order_status 
  FROM sales_orders 
  WHERE id = v_item.order_id AND org_id = p_org_id
  FOR UPDATE;

  IF v_order_status != 'pending' THEN
    RAISE EXCEPTION 'Cannot modify items unless order is pending';
  END IF;

  -- Lock the item
  SELECT * INTO v_item FROM sales_order_items WHERE id = p_item_id AND org_id = p_org_id FOR UPDATE;

  -- BUG-25-05: Legacy location check
  IF v_item.location_id IS NULL THEN
      RAISE EXCEPTION 'LEGACY_SALES_EXCEPTION';
  END IF;

  -- Lock Inventory Balance explicitly
  SELECT id, allocated_quantity INTO v_balance_id, v_current_allocated
  FROM inventory_balances
  WHERE product_id = v_item.product_id AND location_id = v_item.location_id AND org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
       RAISE EXCEPTION 'Inventory balance not found for product % at location %', v_item.product_id, v_item.location_id;
  END IF;

  -- BUG-25-01: Check allocation before decreasing
  IF v_current_allocated < v_item.quantity THEN
       RAISE EXCEPTION 'Allocation mismatch: allocated_quantity (%) is less than reservation_quantity (%)', v_current_allocated, v_item.quantity;
  END IF;

  -- Free up the allocated quantity
  UPDATE inventory_balances
  SET allocated_quantity = allocated_quantity - v_item.quantity,
      updated_at = NOW()
  WHERE id = v_balance_id;

  -- Delete the item
  DELETE FROM sales_order_items WHERE id = p_item_id AND org_id = p_org_id;

  -- BUG-25-03: Atomic Order Total update
  SELECT COALESCE(SUM(quantity * unit_price), 0) INTO v_new_total
  FROM sales_order_items
  WHERE order_id = v_item.order_id AND org_id = p_org_id;

  UPDATE sales_orders
  SET total_amount = v_new_total,
      updated_at = NOW()
  WHERE id = v_item.order_id AND org_id = p_org_id;

END;
$$;
