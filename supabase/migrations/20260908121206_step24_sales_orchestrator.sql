-- ========================================================================================
-- ERP Sales Phase - Step 24: Sales Orchestrator (Ship & Cancel)
-- ========================================================================================

DROP FUNCTION IF EXISTS rpc_cancel_sales_order_reservation(UUID);
DROP FUNCTION IF EXISTS rpc_cancel_sales_order_reservation(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS rpc_ship_sales_order(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS rpc_ship_sales_order(UUID, UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION rpc_cancel_sales_order_reservation(
    p_order_id UUID,
    p_user_id UUID,
    p_org_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_so_record RECORD;
    v_item RECORD;
BEGIN
    -- 1. Lock Sales Order
    SELECT * INTO v_so_record 
    FROM sales_orders 
    WHERE id = p_order_id AND org_id = p_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sales order % not found.', p_order_id;
    END IF;

    -- Only pending/packing orders might have stock reserved
    IF v_so_record.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Already cancelled');
    END IF;
    
    IF v_so_record.status = 'shipped' OR v_so_record.status = 'delivered' THEN
         RAISE EXCEPTION 'Cannot cancel sales order in % status', v_so_record.status;
    END IF;

    -- 2. Lock Sales Order Items and Free Allocation
    FOR v_item IN (
        SELECT * FROM sales_order_items
        WHERE order_id = p_order_id AND org_id = p_org_id
        ORDER BY id -- Consistent locking order
        FOR UPDATE
    ) LOOP
        IF v_item.location_id IS NOT NULL AND v_item.quantity > 0 THEN
            -- Free up the allocated quantity in inventory_balances
            UPDATE inventory_balances
            SET allocated_quantity = GREATEST(0, allocated_quantity - v_item.quantity),
                updated_at = NOW()
            WHERE product_id = v_item.product_id AND location_id = v_item.location_id AND org_id = p_org_id;
        END IF;
    END LOOP;

    -- 3. Update Sales Order Status to 'cancelled'
    UPDATE sales_orders
    SET status = 'cancelled'::sales_order_status,
        updated_at = NOW()
    WHERE id = p_order_id AND org_id = p_org_id;

    RETURN jsonb_build_object('success', true, 'message', 'Sales order cancelled successfully');
END;
$$;

CREATE OR REPLACE FUNCTION rpc_ship_sales_order(
    p_order_id UUID,
    p_user_id UUID,
    p_org_id UUID,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_so_record RECORD;
    v_item RECORD;
    v_issue_result JSONB;
BEGIN
    -- 1. Lock Sales Order
    SELECT * INTO v_so_record 
    FROM sales_orders 
    WHERE id = p_order_id AND org_id = p_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sales order % not found.', p_order_id;
    END IF;

    IF v_so_record.status = 'shipped' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Already shipped');
    END IF;

    IF v_so_record.status = 'cancelled' THEN
         RAISE EXCEPTION 'Cannot ship cancelled order';
    END IF;

    -- 2. Iterate and process items (Locks are acquired inside rpc_issue_stock)
    FOR v_item IN (
        SELECT * FROM sales_order_items
        WHERE order_id = p_order_id AND org_id = p_org_id
        ORDER BY id
        FOR UPDATE
    ) LOOP
        IF v_item.location_id IS NOT NULL AND v_item.quantity > 0 THEN
            -- Call the atomic rpc_issue_stock
            v_issue_result := rpc_issue_stock(
                p_org_id,
                'ALLOCATED_FULFILLMENT',
                v_item.quantity,
                COALESCE(p_idempotency_key, gen_random_uuid()::text) || '-' || v_item.id::text,
                p_user_id,
                v_item.product_id,
                v_item.location_id,
                v_so_record.order_number,
                v_item.id
            );

            IF NOT (v_issue_result->>'success')::boolean THEN
                 RAISE EXCEPTION 'Failed to issue stock for item %: %', v_item.id, v_issue_result->>'error';
            END IF;
        END IF;
    END LOOP;

    -- 3. Update Sales Order Status to 'shipped'
    UPDATE sales_orders
    SET status = 'shipped'::sales_order_status,
        updated_at = NOW()
    WHERE id = p_order_id AND org_id = p_org_id;

    RETURN jsonb_build_object('success', true, 'message', 'Sales order shipped successfully');
END;
$$;
