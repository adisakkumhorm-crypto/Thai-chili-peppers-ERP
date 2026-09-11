ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES inventory_locations(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION rpc_reserve_so_item(
  p_order_id UUID,
  p_product_id UUID,
  p_location_id UUID,
  p_quantity INTEGER,
  p_unit_price NUMERIC,
  p_org_id UUID
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance RECORD;
  v_available INTEGER;
  v_order_status TEXT;
BEGIN
  -- Validate Order Status
  SELECT status INTO v_order_status 
  FROM sales_orders 
  WHERE id = p_order_id AND org_id = p_org_id;

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
    RAISE EXCEPTION 'Not enough available stock at this location';
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

END;
$$;
