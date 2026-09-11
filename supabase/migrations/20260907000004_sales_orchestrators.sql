-- Migration: Sales Shipped and Cancel Orchestrators

-- 1. rpc_ship_sales_order
CREATE OR REPLACE FUNCTION rpc_ship_sales_order(
    p_order_id UUID,
    p_user_id UUID,
    p_org_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_item RECORD;
    v_idempotency_key UUID;
    v_result JSONB;
BEGIN
    -- 1. Lock Sales Order
    SELECT * INTO v_order
    FROM public.sales_orders
    WHERE id = p_order_id AND org_id = p_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    -- 2. State Validation
    IF v_order.status = 'shipped' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Already shipped');
    END IF;

    IF v_order.status IN ('delivered', 'cancelled') THEN
        RAISE EXCEPTION 'Cannot ship order with status: %', v_order.status;
    END IF;

    -- 3. Lock Order Items and process in deterministic order
    FOR v_item IN
        SELECT * FROM public.sales_order_items
        WHERE order_id = p_order_id AND org_id = p_org_id
        ORDER BY product_id, location_id
        FOR UPDATE
    LOOP
        -- 4. Legacy Check
        IF v_item.location_id IS NULL THEN
            RAISE EXCEPTION 'LEGACY_SALES_EXCEPTION';
        END IF;

        -- 5. Generate deterministic idempotency key for the transaction
        v_idempotency_key := md5('sales-shipped:' || p_order_id::text || ':' || v_item.id::text)::uuid;

        -- 6. Issue Stock via existing Core RPC
        SELECT rpc_issue_stock(
            p_org_id,
            'ALLOCATED_FULFILLMENT',
            v_item.quantity,
            v_idempotency_key,
            p_user_id,
            NULL,
            NULL,
            NULL,
            v_item.id
        ) INTO v_result;
    END LOOP;

    -- 7. Update status
    UPDATE public.sales_orders
    SET status = 'shipped',
        updated_at = NOW()
    WHERE id = p_order_id AND org_id = p_org_id;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;


-- 2. rpc_cancel_sales_order_reservation
CREATE OR REPLACE FUNCTION rpc_cancel_sales_order_reservation(
    p_order_id UUID,
    p_user_id UUID,
    p_org_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_item RECORD;
    v_balance RECORD;
BEGIN
    -- 1. Lock Sales Order
    SELECT * INTO v_order
    FROM public.sales_orders
    WHERE id = p_order_id AND org_id = p_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    -- 2. State Validation
    IF v_order.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Already cancelled');
    END IF;

    IF v_order.status IN ('shipped', 'delivered') THEN
        RAISE EXCEPTION 'Cannot cancel order with status: %', v_order.status;
    END IF;

    -- 3. Lock Items in deterministic order
    FOR v_item IN
        SELECT * FROM public.sales_order_items
        WHERE order_id = p_order_id AND org_id = p_org_id
        ORDER BY product_id, location_id
        FOR UPDATE
    LOOP
        -- 4. Legacy check
        IF v_item.location_id IS NULL THEN
            RAISE EXCEPTION 'LEGACY_SALES_EXCEPTION';
        END IF;

        -- 5. Lock Balance
        SELECT * INTO v_balance
        FROM public.inventory_balances
        WHERE product_id = v_item.product_id 
          AND location_id = v_item.location_id 
          AND org_id = p_org_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Balance not found for product % at location %', v_item.product_id, v_item.location_id;
        END IF;

        -- 6. Strict Allocation Check (No GREATEST)
        IF v_balance.allocated_quantity < v_item.quantity THEN
            RAISE EXCEPTION 'Allocation mismatch for product %: expected at least % but found %', 
                v_item.product_id, v_item.quantity, v_balance.allocated_quantity;
        END IF;

        -- 7. Reduce Allocation
        UPDATE public.inventory_balances
        SET allocated_quantity = allocated_quantity - v_item.quantity,
            updated_at = NOW()
        WHERE id = v_balance.id;
        
    END LOOP;

    -- 8. Update status
    UPDATE public.sales_orders
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE id = p_order_id AND org_id = p_org_id;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;
